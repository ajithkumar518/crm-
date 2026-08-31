# Per-User `disableServiceCrm` Flag — Deploy & Seed Runbook

## Purpose

The `disableServiceCrm` boolean field on the `User` model (`prisma/schema.prisma`) is a per-user kill switch that hides the Sales↔Service CRM toggle and blocks all `/service/*` access at the JWT, server-action, API route, and client-gate layers — independent of the company-level `serviceCrmEnabled` entitlement.

It defaults to `false` for every user. As of this writing, exactly **one** user has it set to `true`:

| Email | Role | Variant | Reason |
|-------|------|---------|--------|
| `shahnaz@sukisoftware.com` | Admin | 2 | Service CRM access intentionally disabled for this account. |

---

## ⚠️ Critical: This Override Lives in a Gitignored Seed File

The `disableServiceCrm: true` override for shahnaz is currently encoded **only** in `prisma/seeds/deploySeed.ts`, which is **gitignored** (see `.gitignore` — the file contains deploy-specific credentials and is intentionally excluded from version control).

**This means:**
- The override exists **only** on the machine/environment where `deploySeed.ts` was manually edited and run.
- It will **NOT** be present in a fresh clone + seed on a new environment (staging, prod, disaster recovery, a new dev machine, CI).
- If the database is reset and re-seeded from scratch without the override in `deploySeed.ts`, shahnaz will regain Service CRM access silently.

---

## Manual Fix for a New Environment

After seeding a fresh environment, apply one of the following to set the flag.

### Option A — Edit the environment's local `deploySeed.ts` before seeding

If the environment has its own copy of `prisma/seeds/deploySeed.ts`, ensure both the `create` and `update` branches include `disableServiceCrm: true` for the shahnaz user, then run:

```bash
npx tsx prisma/seeds/deploySeed.ts
```

The relevant lines (in both branches) should read:

```typescript
    user = await prisma.user.create({   // or .update in the else branch
      data: {
        // ... other fields ...
        variantLocked: true,
        disableServiceCrm: true,        // ← must be present
        companyId: company.id,
      },
    });
```

### Option B — Direct DB update (no seed re-run needed)

If the environment is already seeded and you only need to flip the flag, run this Prisma script:

```bash
npx tsx -e "
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  (async () => {
    const u = await prisma.user.update({
      where: { email: 'shahnaz@sukisoftware.com' },
      data: { disableServiceCrm: true },
    });
    console.log('Updated:', u.email, 'disableServiceCrm =', u.disableServiceCrm);
  })().finally(() => prisma.\$disconnect());
"
```

Or, via raw SQL (SQL Server syntax — this project uses MSSQL):

```sql
UPDATE [User] SET [disableServiceCrm] = 1 WHERE [email] = 'shahnaz@sukisoftware.com';
```

### Option C — Prisma Studio (GUI)

```bash
npx prisma studio
```

Open the `User` table → find `shahnaz@sukisoftware.com` → set `disableServiceCrm` to `true` → Save.

---

## Deploy Checklist Item

Add this to any pre-launch / post-seed deploy checklist:

- [ ] **Verify `disableServiceCrm` flag for shahnaz** — After seeding, confirm `shahnaz@sukisoftware.com` has `disableServiceCrm = true` in the `User` table. If not, apply Option B above. Verify with:
  ```bash
  npx tsx -e "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    (async () => {
      const u = await prisma.user.findUnique({
        where: { email: 'shahnaz@sukisoftware.com' },
        select: { email: true, disableServiceCrm: true },
      });
      console.log(u);
    })().finally(() => prisma.\$disconnect());
  "
  ```
  Expected output: `{ email: 'shahnaz@sukisoftware.com', disableServiceCrm: true }`

---

## Verification After Apply

1. Log in as `shahnaz@sukisoftware.com` — the Sales↔Service CRM toggle should **not** be visible in the dashboard header.
2. Navigate directly to `/service/dashboard/my` — should show the locked "Service CRM License Required" gate (or return 403 at the API layer).
3. Log in as any other user (e.g. `admin@sukisoftware.com`, variant 1/3 demo users) — the toggle should be visible and `/service/*` access should behave exactly as before.

---

## Related Files

| File | Role |
|------|------|
| `prisma/schema.prisma` | `User.disableServiceCrm` column definition (default `false`) |
| `prisma/seeds/deploySeed.ts` | Gitignored seed that sets the flag for shahnaz (environment-local) |
| `lib/auth.ts` | `TokenPayload.disableServiceCrm` — flag travels in JWT |
| `app/actions/auth.ts` | `issueAuthCookie` signs flag into JWT; `getMeAction` surfaces it to client |
| `components/AuthProvider.tsx` | `UserProfile.disableServiceCrm` — client-side type |
| `components/DashboardHeader.tsx` | Toggle hidden when `user.disableServiceCrm === true` |
| `lib/serviceEntitlement.ts` | Early 403 guard — per-user check before company-level entitlement |
| `components/service/ServiceModuleGate.tsx` | Client-side gate locks when `disableServiceCrm === true` |
| `app/(dashboard)/layout.tsx` | Dead-code `CrmToggle` guard for consistency |
