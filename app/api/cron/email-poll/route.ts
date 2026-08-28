import { NextResponse } from "next/server";
import { pollInboundEmails, defaultMaxMessages } from "@/lib/inbound-email-service";

/**
 * GET|POST /api/cron/email-poll
 * ─────────────────────────────────────────────────────────────────────────────
 * HTTP trigger for the inbound email → lead pipeline. Intended for serverless
 * hosts (Vercel/Netlify), which cannot run the long-lived `npm run email:poll
 * -- --watch` process. Drive it from a scheduler (Vercel Cron, cron-job.org,
 * Windows Task Scheduler + curl, etc.).
 *
 * Each invocation calls the Microsoft Graph API to fetch up to
 * INBOUND_MAX_MESSAGES_PER_RUN unread messages, then marks them as read. If
 * more mail is waiting, the response reports `remaining > 0`; the next tick
 * picks it up.
 *
 * Secured by CRON_SECRET Bearer token (set in .env / hosting cron config).
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const runtime = "nodejs";
// Never cache — this performs work and must run on every tick.
export const dynamic = "force-dynamic";
// Allow a longer window than the default; IMAP + parsing is I/O heavy.
export const maxDuration = 60;

async function handle(request: Request) {
  // ── Auth gate ──────────────────────────────────────────────────────────────
  const secret = process.env.CRON_SECRET;

  // Fail closed: without a configured secret the endpoint stays shut rather
  // than silently comparing against `undefined`.
  if (!secret) {
    console.error("[email-poll] CRON_SECRET is not configured; refusing to run.");
    return NextResponse.json(
      { success: false, message: "CRON_SECRET is not configured on the server" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await pollInboundEmails({ maxMessages: defaultMaxMessages() });

    // Surface a connection/auth failure as 502 so a scheduler flags it, rather
    // than reporting a misleading success with zero mail processed.
    if (!summary.connected) {
      return NextResponse.json(
        { success: false, message: "Microsoft Graph connection failed", data: summary },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, data: summary });
  } catch (error: any) {
    console.error("Email Poll Cron Error:", error);
    return NextResponse.json(
      { success: false, message: `Email poll failed: ${error.message}` },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handle(request);
}

// POST is accepted too — some schedulers only issue POST.
export async function POST(request: Request) {
  return handle(request);
}
