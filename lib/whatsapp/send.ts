import { GRAPH_BASE } from "@/lib/whatsapp/graph";

/**
 * Send a plain text WhatsApp message (free within the 24h service window).
 * Used for confirmation replies and "which store?" disambiguation prompts.
 */
export async function sendText(to: string, body: string): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN!;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!;

  const res = await fetch(`${GRAPH_BASE}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`whatsapp_send_failed ${res.status}: ${detail}`);
  }
}
