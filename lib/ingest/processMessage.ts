import { createAdminClient } from "@/lib/supabase/admin";
import { whatsappImageConnector } from "@/lib/connectors/whatsappImage";
import { getMediaBytes, storeReceiptImage } from "@/lib/whatsapp/media";
import { sendText } from "@/lib/whatsapp/send";
import { resolveSenderUser, matchBusiness } from "@/lib/ingest/routing";
import { setPending, getPending, clearPending } from "@/lib/ingest/conversation";
import { parseChannelAmount } from "@/lib/ingest/parseText";
import type { Channel, ParsedReceipt } from "@/lib/connectors/types";
import type { WhatsAppInboundMessage } from "@/lib/whatsapp/types";

type Supa = ReturnType<typeof createAdminClient>;

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

  // Idempotency: first writer wins; a unique violation = already processed.
  const { error: dupErr } = await supabase.from("whatsapp_messages").insert({
    wam_id: msg.id,
    sender: msg.from,
    media_id: msg.image?.id ?? null,
    status: "received",
  });
  if (dupErr) return;

  // Only whitelisted senders are processed; unknown numbers are ignored silently.
  const userId = await resolveSenderUser(msg.from);
  if (!userId) {
    await mark(supabase, msg.id, "unknown_sender");
    return;
  }

  try {
    if (msg.type === "image" && msg.image) {
      await handleImage(supabase, msg, userId);
    } else if (msg.type === "text" && msg.text?.body) {
      await handleText(supabase, msg, userId, msg.text.body.trim());
    } else {
      await mark(supabase, msg.id, "ignored_unsupported");
    }
  } catch (err) {
    console.error(`processMessage failed for ${msg.id}:`, err);
    await mark(supabase, msg.id, "error", String(err));
  }
}

// ---------------------------------------------------------------------------
// Image: download -> parse -> route -> upsert (or ask which store)
// ---------------------------------------------------------------------------
async function handleImage(
  supabase: Supa,
  msg: WhatsAppInboundMessage,
  userId: string,
): Promise<void> {
  const { bytes, mediaType } = await getMediaBytes(msg.image!.id);
  const imageUrl = await storeReceiptImage(bytes, mediaType, msg.id);
  const parsed = await whatsappImageConnector.parse({ imageBytes: bytes, mediaType });

  // Pizzaville receipts carry a store number; Uber/Skip summaries don't, so also
  // use the photo's caption (e.g. "heartland") as a store hint for matching.
  const caption = msg.image?.caption ?? "";
  const match = await matchBusiness(
    userId,
    `${parsed.business_identifier} ${caption}`.trim(),
  );

  if (match.kind === "none") {
    await sendText(msg.from, "No business is set up yet. Add one in Simplify2, then resend the receipt.");
    await mark(supabase, msg.id, "no_business");
    return;
  }

  if (match.kind === "ambiguous") {
    // Uber/Skip summaries don't show a store. Use the active "store mode" (set by
    // texting a store name) if one is set; otherwise ask the owner to set it.
    const mode = await getPending(msg.from, "store_mode");
    if (mode) {
      const businessId = mode.options.businessId as string;
      const businessName = mode.options.businessName as string;
      const status = await upsertReceipt(supabase, businessId, parsed, imageUrl);
      await sendText(msg.from, confirmationText(businessName, parsed, status));
      await mark(supabase, msg.id, "processed");
      return;
    }
    const hint = match.options
      .map((o) => `"${o.name.replace(/^pizzaville\s+/i, "").toLowerCase()}"`)
      .join(" or ");
    await sendText(
      msg.from,
      `This receipt doesn't show a store (Uber/Skip). Text ${hint} first, then resend — everything after that files under that store until you switch.`,
    );
    await mark(supabase, msg.id, "awaiting_store_mode");
    return;
  }

  const status = await upsertReceipt(supabase, match.businessId, parsed, imageUrl);
  await sendText(msg.from, confirmationText(match.businessName, parsed, status));
  await mark(supabase, msg.id, "processed");
}

// ---------------------------------------------------------------------------
// Text: store-pick reply, or EDIT correction
// ---------------------------------------------------------------------------
async function handleText(
  supabase: Supa,
  msg: WhatsAppInboundMessage,
  userId: string,
  body: string,
): Promise<void> {
  const upper = body.toUpperCase();
  const editPending = await getPending(msg.from, "edit");

  // 1. "EDIT" — start, or apply inline "EDIT in_store 950".
  if (upper === "EDIT" || upper.startsWith("EDIT ")) {
    const rest = body.slice(4).trim();
    const parsedEdit = parseChannelAmount(rest);
    const last = await lastEntryContext(supabase, userId);
    if (!last) {
      await sendText(msg.from, "Nothing to edit yet — send a receipt first.");
      await mark(supabase, msg.id, "edit_nothing");
      return;
    }
    if (parsedEdit) {
      await applyCorrection(supabase, last.business_id, last.entry_date, parsedEdit.channel, parsedEdit.amount);
      await sendText(msg.from, `Updated ✅ ${CHANNEL_LABEL[parsedEdit.channel]} ${last.entry_date} = $${parsedEdit.amount.toFixed(2)}`);
      await mark(supabase, msg.id, "edited");
      return;
    }
    await setPending(msg.from, "edit", { businessId: last.business_id, entryDate: last.entry_date });
    await sendText(msg.from, `Editing ${last.entry_date}. Reply with: <channel> <amount>\ne.g. "in_store 950" or "call_center 420"`);
    await mark(supabase, msg.id, "edit_started");
    return;
  }

  // 2. A "<channel> <amount>" reply continues an active EDIT.
  const ca = parseChannelAmount(body);
  if (editPending && ca) {
    const businessId = editPending.options.businessId as string;
    const entryDate = editPending.options.entryDate as string;
    await applyCorrection(supabase, businessId, entryDate, ca.channel, ca.amount);
    await clearPending(msg.from, "edit");
    await sendText(msg.from, `Updated ✅ ${CHANNEL_LABEL[ca.channel]} ${entryDate} = $${ca.amount.toFixed(2)}`);
    await mark(supabase, msg.id, "edited");
    return;
  }

  // 3. A store name sets "store mode" — Uber/Skip receipts file there until changed.
  const storeMatch = await matchBusiness(userId, body);
  if (storeMatch.kind === "matched") {
    await setPending(
      msg.from,
      "store_mode",
      { businessId: storeMatch.businessId, businessName: storeMatch.businessName },
      8 * 60 * 60 * 1000,
    );
    await sendText(
      msg.from,
      `📍 Filing Uber/Skip receipts under ${storeMatch.businessName} now. Send them — text the other store to switch. (Pizzaville receipts auto-route by their store number.)`,
    );
    await mark(supabase, msg.id, "store_mode_set");
    return;
  }

  // 4. Active edit but the reply wasn't a valid "<channel> <amount>".
  if (editPending) {
    await sendText(msg.from, `Format: <channel> <amount> — e.g. "in_store 950".`);
    await mark(supabase, msg.id, "edit_retry");
    return;
  }

  // 5. Anything else.
  await sendText(
    msg.from,
    `Send a receipt photo. For Uber/Skip, text "heartland" or "woodbine" first to set the store. Reply EDIT to fix the last entry.`,
  );
  await mark(supabase, msg.id, "ignored_text");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function upsertReceipt(
  supabase: Supa,
  businessId: string,
  parsed: ParsedReceipt,
  imageUrl: string | null,
): Promise<"confirmed" | "needs_review"> {
  const status =
    parsed.confidence >= CONFIDENCE_THRESHOLD ? "confirmed" : "needs_review";
  const now = new Date().toISOString();
  const rows = parsed.line_items.map((li) => ({
    business_id: businessId,
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
  const { error } = await supabase
    .from("sales_entries")
    .upsert(rows, { onConflict: "business_id,entry_date,channel" });
  if (error) throw error;
  return status;
}

async function applyCorrection(
  supabase: Supa,
  businessId: string,
  entryDate: string,
  channel: Channel,
  amount: number,
): Promise<void> {
  const { error } = await supabase.from("sales_entries").upsert(
    {
      business_id: businessId,
      entry_date: entryDate,
      channel,
      amount,
      source: "manual",
      status: "confirmed",
      confidence: 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id,entry_date,channel" },
  );
  if (error) throw error;
}

/** Most recent entry across the user's businesses — the target for "EDIT". */
async function lastEntryContext(
  supabase: Supa,
  userId: string,
): Promise<{ business_id: string; entry_date: string } | null> {
  const { data } = await supabase
    .from("sales_entries")
    .select("business_id, entry_date, businesses!inner(owner_id)")
    .eq("businesses.owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    business_id: data.business_id as string,
    entry_date: data.entry_date as string,
  };
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
  supabase: Supa,
  wamId: string,
  status: string,
  error?: string,
): Promise<void> {
  await supabase
    .from("whatsapp_messages")
    .update({ status, error: error ?? null })
    .eq("wam_id", wamId);
}
