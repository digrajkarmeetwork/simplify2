import { createAdminClient } from "@/lib/supabase/admin";
import { whatsappImageConnector } from "@/lib/connectors/whatsappImage";
import { getMediaBytes, storeReceiptImage } from "@/lib/whatsapp/media";
import { sendText } from "@/lib/whatsapp/send";
import { resolveSenderUser, matchBusiness } from "@/lib/ingest/routing";
import type { Channel, ParsedReceipt } from "@/lib/connectors/types";
import type { WhatsAppInboundMessage } from "@/lib/whatsapp/types";

const CONFIDENCE_THRESHOLD = 0.7;

const CHANNEL_LABEL: Record<Channel, string> = {
  in_store: "In-store",
  call_center: "Call-center",
  uber_eats: "Uber Eats",
  skip_dishes: "Skip",
};

/**
 * Process one inbound WhatsApp message end-to-end. Idempotent on the Meta
 * message id: a duplicate delivery is logged once and then skipped.
 */
export async function processMessage(
  msg: WhatsAppInboundMessage,
): Promise<void> {
  const supabase = createAdminClient();

  // 1. Idempotency: first writer wins. A unique-violation here means we've
  //    already seen this message id, so this delivery is a no-op.
  const { error: dupErr } = await supabase.from("whatsapp_messages").insert({
    wam_id: msg.id,
    sender: msg.from,
    media_id: msg.image?.id ?? null,
    status: "received",
  });
  if (dupErr) return; // duplicate (or transient) — do not double-process

  // 2. Only image messages carry receipts in v1. Text replies (EDIT / store
  //    selection) are handled in Phase 3.
  if (msg.type !== "image" || !msg.image) {
    await mark(supabase, msg.id, "ignored_non_image");
    return;
  }

  try {
    // 3. Download + persist the image.
    const { bytes, mediaType } = await getMediaBytes(msg.image.id);
    const imageUrl = await storeReceiptImage(bytes, mediaType, msg.id);

    // 4. Parse with Claude vision.
    const parsed = await whatsappImageConnector.parse({ imageBytes: bytes, mediaType });

    // 5. Route: sender -> user, identifier -> business.
    const userId = await resolveSenderUser(msg.from);
    if (!userId) {
      // Unknown sender: ignore silently (no reply to non-whitelisted numbers).
      await mark(supabase, msg.id, "unknown_sender");
      return;
    }

    const match = await matchBusiness(userId, parsed.business_identifier);
    if (match.kind === "none") {
      await sendText(msg.from, "No business is set up yet. Add one in Simplify2 first, then resend the receipt.");
      await mark(supabase, msg.id, "no_business");
      return;
    }
    if (match.kind === "ambiguous") {
      // Full disambiguation is Phase 3; for now ask the owner to retry once set.
      const list = match.options.map((o, i) => `${i + 1}) ${o.name}`).join("  ");
      await sendText(msg.from, `Which store is this for? ${list}\n(Reply support coming soon — tag the receipt's store keyword for now.)`);
      await mark(supabase, msg.id, "ambiguous_business");
      return;
    }

    // 6. Upsert one entry per channel (idempotent on business/date/channel).
    const status =
      parsed.confidence >= CONFIDENCE_THRESHOLD ? "confirmed" : "needs_review";
    const now = new Date().toISOString();
    const rows = parsed.line_items.map((li) => ({
      business_id: match.businessId,
      entry_date: parsed.entry_date,
      channel: li.channel,
      amount: li.amount,
      source: "whatsapp_ai" as const,
      confidence: parsed.confidence,
      status,
      image_url: imageUrl,
      raw_extraction: parsed,
      updated_at: now,
    }));

    const { error: upErr } = await supabase
      .from("sales_entries")
      .upsert(rows, { onConflict: "business_id,entry_date,channel" });
    if (upErr) throw upErr;

    // 7. Confirmation reply.
    await sendText(msg.from, confirmationText(match.businessName, parsed, status));
    await mark(supabase, msg.id, "processed");
  } catch (err) {
    console.error(`processMessage failed for ${msg.id}:`, err);
    await mark(supabase, msg.id, "error", String(err));
  }
}

function confirmationText(
  businessName: string,
  parsed: ParsedReceipt,
  status: string,
): string {
  const items = parsed.line_items
    .map((li) => `${CHANNEL_LABEL[li.channel]} $${li.amount.toFixed(2)}`)
    .join(", ");
  const head = `Got it ✅ ${businessName} — ${parsed.entry_date}: ${items}.`;
  return status === "needs_review"
    ? `${head}\nLow confidence — please check it in Simplify2. Reply EDIT to fix.`
    : `${head}\nReply EDIT to fix.`;
}

async function mark(
  supabase: ReturnType<typeof createAdminClient>,
  wamId: string,
  status: string,
  error?: string,
): Promise<void> {
  await supabase
    .from("whatsapp_messages")
    .update({ status, error: error ?? null })
    .eq("wam_id", wamId);
}
