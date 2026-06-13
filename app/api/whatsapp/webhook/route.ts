import { after, type NextRequest } from "next/server";
import { verifyChallenge, verifySignature } from "@/lib/whatsapp/verify";
import { extractMessages, type WhatsAppWebhookBody } from "@/lib/whatsapp/types";
import { processMessage } from "@/lib/ingest/processMessage";

// Node runtime: needs crypto (HMAC) + Buffer, and runs the async ingest after responding.
export const runtime = "nodejs";

/** Meta webhook verification handshake. */
export function GET(request: NextRequest) {
  const challenge = verifyChallenge(request.nextUrl.searchParams);
  if (challenge !== null) {
    return new Response(challenge, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }
  return new Response("Forbidden", { status: 403 });
}

/** Inbound messages. Verify signature, ack fast (200), process asynchronously. */
export async function POST(request: NextRequest) {
  const raw = await request.text();

  if (!verifySignature(raw, request.headers.get("x-hub-signature-256"))) {
    return new Response("invalid signature", { status: 401 });
  }

  let body: WhatsAppWebhookBody;
  try {
    body = JSON.parse(raw) as WhatsAppWebhookBody;
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const messages = extractMessages(body);

  // Return 200 immediately; do the slow work (media download + AI parse) after.
  after(async () => {
    for (const msg of messages) {
      try {
        await processMessage(msg);
      } catch (err) {
        console.error("webhook processing error:", err);
      }
    }
  });

  return new Response("ok", { status: 200 });
}
