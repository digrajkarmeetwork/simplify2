// Minimal typings for the slice of the WhatsApp Cloud API webhook we consume.

export interface WhatsAppInboundMessage {
  id: string; // Meta message id (wam_id) — idempotency key
  from: string; // sender phone (E.164, no '+')
  timestamp: string;
  type: "text" | "image" | string;
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256?: string; caption?: string };
}

export interface WhatsAppChangeValue {
  messaging_product: string;
  metadata?: { phone_number_id: string; display_phone_number: string };
  contacts?: Array<{ wa_id: string; profile?: { name?: string } }>;
  messages?: WhatsAppInboundMessage[];
}

export interface WhatsAppWebhookBody {
  object: string;
  entry?: Array<{
    id: string;
    changes?: Array<{ field: string; value: WhatsAppChangeValue }>;
  }>;
}

/** Flatten a webhook payload into the inbound messages it contains. */
export function extractMessages(
  body: WhatsAppWebhookBody,
): WhatsAppInboundMessage[] {
  const out: WhatsAppInboundMessage[] = [];
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const msg of change.value.messages ?? []) out.push(msg);
    }
  }
  return out;
}
