# syntax=docker/dockerfile:1
#
# Multi-stage build for this Next.js app. Ported from suki_crm, which this
# app is a fork of — same layout, same Prisma/SQL Server setup, so the build
# is deliberately kept identical rather than re-invented.
#
# Node 24 matches the Windows host this deployment replaces (node v24.16.0),
# so runtime behaviour is unchanged.
#
# Debian (bookworm-slim) rather than Alpine on purpose: Prisma's query engine
# is built against glibc/openssl. Running it on musl requires adding
# `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` to
# prisma/schema.prisma, and we would rather not change application source to
# suit the base image.
ARG NODE_IMAGE=node:24-bookworm-slim

# ---------------------------------------------------------------- deps -----
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# --ignore-scripts: nothing here needs postinstall hooks, and it keeps a
# compromised transitive dependency from executing at build time.
RUN npm ci --ignore-scripts

# --------------------------------------------------------------- build -----
FROM ${NODE_IMAGE} AS build
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# `prisma generate` reads the datasource block and wants the env var to exist.
# It does not connect, so a syntactically valid placeholder is enough; the real
# DATABASE_URL is supplied at runtime from the stack's .env file.
ENV DATABASE_URL="sqlserver://placeholder:1433;database=placeholder;user=placeholder;password=placeholder;trustServerCertificate=true"
# lib/auth.ts throws at MODULE scope when JWT_SECRET is unset, and Next's
# "collect page data" step imports every route at build time -- so the build
# fails without it. This placeholder exists ONLY in the build stage: the
# runtime image deliberately has no JWT_SECRET, so if the real .env ever fails
# to mount the app crashes loudly instead of silently signing tokens with a
# throwaway key.
ENV JWT_SECRET="build-time-placeholder-not-used-at-runtime"
ENV NEXTAUTH_SECRET="build-time-placeholder-not-used-at-runtime"
RUN npx prisma generate
RUN npm run build

# -------------------------------------------------------------- runner -----
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m -d /home/nextjs nextjs

# node_modules is copied whole rather than pruned. `prisma` is a
# devDependency and its generated client lives in node_modules/.prisma, which
# `npm prune --omit=dev` deletes -- and regenerating afterwards needs the CLI
# that pruning just removed. A larger image is the accepted trade for a build
# that is correct. It also keeps `tsx` available, which the seed scripts and
# the mailbox pollers in scripts/ are run with.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next        ./.next
COPY --from=build /app/public       ./public
COPY --from=build /app/prisma       ./prisma
# Seed/maintenance scripts must be present for the manual db-task job,
# otherwise `seed:*` fails with a missing file inside the image.
COPY --from=build /app/deployment_seeding ./deployment_seeding
COPY --from=build /app/scripts      ./scripts
COPY --from=build /app/services     ./services
COPY --from=build /app/lib          ./lib
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/next.config.* ./

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

# Accept any 2xx/3xx: these apps redirect unauthenticated requests to a login
# page, so demanding a literal 200 would report a healthy app as unhealthy.
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ \
      | grep -qE '^(2|3)' || exit 1

CMD ["./node_modules/.bin/next", "start", "-p", "3000", "-H", "0.0.0.0"]
