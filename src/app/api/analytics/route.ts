import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

type EventType = "page_visit" | "qr_generated" | "qr_downloaded";

type Payload = Record<string, string | number | null>;

interface AnalyticsBody {
  eventType?: EventType;
  sessionId?: string;
  payload?: Payload;
}

function readIpAddress(request: NextRequest): string {
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    return xForwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  return "unknown";
}

function hashIpAddress(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as AnalyticsBody | null;

  if (!body?.eventType || !body?.sessionId) {
    return NextResponse.json({ error: "Invalid analytics payload." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: true, stored: false });
  }

  const ipAddress = readIpAddress(request);
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  const { error } = await supabase.from("analytics_events").insert({
    event_type: body.eventType,
    session_id: body.sessionId,
    payload: body.payload ?? {},
    ip_hash: hashIpAddress(ipAddress),
    user_agent: userAgent,
    referrer: request.headers.get("referer"),
  });

  if (error) {
    return NextResponse.json({ error: "Failed to store analytics." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, stored: true });
}
