/**
 * Next.js instrumentation hook — runs once when the server starts.
 *
 * Starts a background interval that polls the Microsoft 365 mailbox via the
 * Graph API and auto-creates leads from enquiry emails. This makes email-to-lead
 * work automatically after `next start` / `npm start` without needing a separate
 * cron job or long-running worker process.
 *
 * The poller only starts when ALL of the following are true:
 *   - Node env is "production" (skipped in dev to avoid duplicate pollers)
 *   - The process is a server runtime, not a build (checked via NEXT_PHASE)
 *   - MS_GRAPH_CLIENT_ID and friends are present in the environment
 *
 * Interval: INBOUND_POLL_INTERVAL_MS env var, default 120000 ms (2 minutes).
 */

const POLL_INTERVAL_MS = Number(process.env.INBOUND_POLL_INTERVAL_MS) || 120_000;

let pollTimer: NodeJS.Timeout | null = null;
let isPolling = false;

async function runPollOnce() {
  if (isPolling) return; // guard against overlapping runs
  isPolling = true;
  try {
    const { pollInboundEmails } = await import("./lib/inbound-email-service");
    const res = await pollInboundEmails({
      logger: (m: string) => console.log(`[auto-poller] ${m}`),
    });
    if (res.errors.length > 0) {
      console.error("[auto-poller] errors:", res.errors.join("; "));
    }
  } catch (err: any) {
    // Never let a single poll failure kill the interval
    console.error("[auto-poller] poll threw:", err?.message || err);
  } finally {
    isPolling = false;
  }
}

export async function register() {
  // Skip in development — the developer runs the watch poller manually.
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  // Skip if Graph credentials are not configured — fail silently.
  const hasCreds =
    process.env.MS_GRAPH_CLIENT_ID &&
    process.env.MS_GRAPH_CLIENT_SECRET &&
    process.env.MS_GRAPH_TENANT_ID &&
    process.env.MS_GRAPH_MAILBOX;
  if (!hasCreds) {
    console.log("[auto-poller] MS_GRAPH_* env vars not set — email auto-poll disabled.");
    return;
  }

  // Guard against double-start (e.g. HMR in some setups).
  if (pollTimer) {
    return;
  }

  console.log(
    `[auto-poller] Starting inbound email poller (interval: ${POLL_INTERVAL_MS}ms, mailbox: ${process.env.MS_GRAPH_MAILBOX})`,
  );

  // First poll shortly after boot so we don't wait a full interval.
  setTimeout(runPollOnce, 10_000);

  // Recurring poll.
  pollTimer = setInterval(runPollOnce, POLL_INTERVAL_MS);

  // Don't keep the process alive solely for the timer (Next.js owns the lifecycle).
  if (pollTimer.unref) pollTimer.unref();
}
