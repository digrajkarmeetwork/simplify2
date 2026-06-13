import { GRAPH_BASE } from "@/lib/whatsapp/graph";
import { createAdminClient } from "@/lib/supabase/admin";

const RECEIPTS_BUCKET = "receipts";

/**
 * Download a WhatsApp media object's bytes. Two-step: resolve the (short-lived)
 * media URL, then fetch the bytes — both calls require the bearer token.
 */
export async function getMediaBytes(
  mediaId: string,
): Promise<{ bytes: Buffer; mediaType: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN!;
  const auth = { Authorization: `Bearer ${token}` };

  const metaRes = await fetch(`${GRAPH_BASE}/${mediaId}`, { headers: auth });
  if (!metaRes.ok) {
    throw new Error(`media_meta_failed ${metaRes.status}`);
  }
  const meta = (await metaRes.json()) as { url: string; mime_type: string };

  const binRes = await fetch(meta.url, { headers: auth });
  if (!binRes.ok) {
    throw new Error(`media_download_failed ${binRes.status}`);
  }
  const bytes = Buffer.from(await binRes.arrayBuffer());
  return { bytes, mediaType: meta.mime_type };
}

/**
 * Persist receipt bytes to the private `receipts` Storage bucket.
 * Returns the storage path (not a public URL — the bucket is private).
 */
export async function storeReceiptImage(
  bytes: Buffer,
  mediaType: string,
  key: string,
): Promise<string> {
  const supabase = createAdminClient();
  const ext = mediaType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const path = `${key}.${ext}`;

  const { error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .upload(path, bytes, { contentType: mediaType, upsert: true });
  if (error) throw error;

  return path;
}
