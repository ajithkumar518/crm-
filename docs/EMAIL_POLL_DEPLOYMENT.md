# Inbound Email Polling — Deployment Guide

How to make SUKI CRM read incoming email **after deployment**.

## Why this is needed

Email reading is **not** part of the Next.js app. It is a separate job that
connects to the mailbox over IMAP. Starting the web app (`next start`) does not
start it, so mail is never picked up unless one of the triggers below is wired.

Two entry points exist, sharing one implementation (`lib/inbound-email-service.ts`):

| Trigger | Command / URL | Use when |
|---|---|---|
| CLI | `npm run email:poll [-- --watch]` | Host can run a long-lived process |
| HTTP | `GET\|POST /api/cron/email-poll` | Host is serverless, or you prefer an external scheduler |

## Confirmed environment for this project

| Item | Value |
|---|---|
| App host | Self-hosted Linux VPS, `crmdev.sukierp.com` → `103.182.210.202`, behind `nginx` |
| Mail host | `mail.sukierp.com` → `132.148.96.3` (GoDaddy shared hosting, **Dovecot**) |
| IMAP | Port `993`, implicit TLS, `AUTH=PLAIN` / `AUTH=LOGIN` |
| Password type | **Regular mailbox password** — GoDaddy/cPanel mail does not use App Passwords |

> `vercel.json` contains a cron entry for `/api/cron/email-poll`, but this project
> is **not** deployed on Vercel, so that entry never executes. It is kept only in
> case the app moves to Vercel later. On this VPS, use system cron (below).

## Step 1 — Set env vars on the server

`.env` is gitignored and does **not** deploy. Set these in the server's
environment (its own `.env`, or your process manager's env config):

```env
# Mailbox to read
IMAP_HOST=mail.sukierp.com
IMAP_PORT=993
IMAP_USER=<the mailbox address, e.g. sales@sukierp.com>
IMAP_PASS=<that mailbox's password>
IMAP_MAILBOX=INBOX
IMAP_PROCESSED_FOLDER=Processed

# Bearer secret for /api/cron/* routes
CRON_SECRET=<generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">

# Max messages handled per HTTP invocation (backlog is picked up next tick)
INBOUND_MAX_MESSAGES_PER_RUN=25
```

The `Processed` folder is created automatically on first run if missing.

## Step 2 — Choose a trigger

### Option A — Long-running worker (simplest on this VPS)

```bash
npm install -g pm2
pm2 start npm --name suki-email -- run email:poll -- --watch
pm2 save && pm2 startup     # survive reboots
pm2 logs suki-email
```

Interval is `INBOUND_POLL_INTERVAL_MS` (default 120000 = 2 min). The CLI path is
uncapped, so it drains the whole backlog each pass.

### Option B — System cron calling the HTTP route

Requires the app to be running and reachable. Add to the crontab of the user
that owns the deploy (`crontab -e`):

```cron
*/5 * * * * curl -fsS -m 120 -X POST -H "Authorization: Bearer $CRON_SECRET" https://crmdev.sukierp.com/api/cron/email-poll >> /var/log/suki-email-poll.log 2>&1
```

Cron does not expand shell vars from your app's `.env`, so either inline the
literal secret or define `CRON_SECRET=` at the top of the crontab file.

Prefer hitting `http://127.0.0.1:3000` instead of the public hostname to skip
nginx and TLS entirely:

```cron
*/5 * * * * curl -fsS -m 120 -X POST -H "Authorization: Bearer <secret>" http://127.0.0.1:3000/api/cron/email-poll >> /var/log/suki-email-poll.log 2>&1
```

Do **not** run Option A and Option B at the same time — two pollers on one
mailbox will race. Message-ID deduplication prevents duplicate leads, but you
will see avoidable IMAP contention.

### nginx note (Option B, public hostname only)

Polling can take longer than nginx's default 60s proxy timeout. If you call the
public URL, raise it for this path:

```nginx
location /api/cron/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_read_timeout 120s;
}
```

Not needed when calling `127.0.0.1` directly.

## Step 3 — Verify

Auth gate (expect `401`):

```bash
curl -i https://crmdev.sukierp.com/api/cron/email-poll
```

Real run (expect `200` and a JSON summary):

```bash
curl -i -X POST -H "Authorization: Bearer <secret>" \
  https://crmdev.sukierp.com/api/cron/email-poll
```

```json
{"success":true,"data":{"ok":true,"connected":true,"found":2,"processed":2,
 "leadsCreated":1,"duplicates":0,"remaining":0,"errors":[],"durationMs":3412}}
```

Response meanings:

| Field | Meaning |
|---|---|
| `connected: false` + HTTP `502` | IMAP host/credentials wrong, or port 993 blocked outbound |
| `found: 0` | No **unread** mail in `INBOX` |
| `remaining > 0` | Backlog exceeded the batch cap; next tick continues |
| `leadsCreated: 0` with `processed > 0` | Mail was read but classified **General**, not **Enquiry** |

## Expected behaviour (not bugs)

- **Only unread mail is fetched.** Opening the test email in a mail client first
  causes it to be skipped permanently.
- **Processed mail is moved** to `Processed` and flagged `\Seen`, so it is never
  handled twice.
- **Deduplicated by `Message-ID`.** Re-sending an identical message is skipped.
- **Only `Enquiry` mail creates a Lead.** Everything else is written to
  `InboundEmailLog` with no lead. Keywords live in `lib/email-classification.ts`;
  terms like `unsubscribe`, `invoice`, `notification`, `noreply` actively exclude.

Good test subject: *"Requesting a quotation for 500 units, please share pricing"*.
Poor test subject: *"test"* — it will be read but produce no lead.

## Troubleshooting

| Symptom | Cause |
|---|---|
| HTTP `500` `"CRON_SECRET is not configured"` | `CRON_SECRET` missing in the server env |
| HTTP `401` | Header mismatch — must be exactly `Authorization: Bearer <secret>` |
| `connected: false`, auth error | Wrong mailbox password, or IMAP disabled for that mailbox |
| `connected: false`, timeout | Provider firewall blocking outbound 993 from the VPS |
| Route works, nothing scheduled | cron not installed, or `vercel.json` assumed to be active (it is not) |
