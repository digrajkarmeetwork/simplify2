import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";
import type {
  Channel,
  ConnectorInput,
  ParsedReceipt,
  ReceiptType,
} from "@/lib/connectors/types";

const ALLOWED_MEDIA = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
type AllowedMedia = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

function normalizeMediaType(mediaType: string): AllowedMedia {
  const t = mediaType.toLowerCase();
  return ALLOWED_MEDIA.has(t) ? (t as AllowedMedia) : "image/jpeg";
}

/**
 * Prepare the image for Claude. Tries to downscale to ~1568px via sharp (~3x
 * fewer image tokens). sharp is loaded dynamically and any failure (e.g. the
 * native binary missing on a serverless runtime) falls back to the original
 * bytes — it must never crash ingestion.
 */
async function prepImage(
  bytes: Buffer,
  mediaType: string,
): Promise<{ data: string; media_type: AllowedMedia }> {
  try {
    const sharp = (await import("sharp")).default;
    const out = await sharp(bytes)
      .rotate()
      .resize({ width: 1568, height: 1568, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    return { data: out.toString("base64"), media_type: "image/jpeg" };
  } catch {
    return { data: bytes.toString("base64"), media_type: normalizeMediaType(mediaType) };
  }
}

// Minimal schema = minimal output tokens. We extract raw fields and derive the
// channel in code (deterministic) rather than asking the model to apply the rule.
const ReceiptSchema = z.object({
  receipt_type: z.enum([
    "pizzaville_daily",
    "uber_eats",
    "skip_dishes",
    "unknown",
  ]),
  store_identifier: z
    .string()
    .describe("Store number/address on the 'Store:' line, e.g. '0154'"),
  entry_date: z.string().describe("Receipt date as YYYY-MM-DD"),
  total_sales: z
    .number()
    .describe("The number on the 'Total Sales' line (incl. tax)"),
  total_deliveries: z
    .number()
    .nullable()
    .describe("Integer on the 'Total Deliveries' line; null if not present"),
  confidence: z.number().describe("0..1; below 0.6 if any digit is unclear"),
});

const PARSE_PROMPT = `Read this daily sales report image and extract a few fields.

It is usually a Pizzaville "Daily Results" POS receipt:
- Header "Daily Results" with a date like "Sat Jun 13/2026".
- Lines for "Total Pickups", "Total Deliveries", then sales lines ending with "Total Sales <amount>".
- total_sales = the number on the "Total Sales" line (the final total, including HST). Plain number, no $ or commas (e.g. 1537.62).
- total_deliveries = the integer on the "Total Deliveries" line.
- entry_date = the date in the "Daily Results" header, formatted YYYY-MM-DD.
- store_identifier = the value after "Store:" (e.g. "0154").
- receipt_type = "pizzaville_daily".

If instead it's an Uber Eats or Skip the Dishes daily summary, set receipt_type to "uber_eats" or "skip_dishes", put the day's total in total_sales, total_deliveries = null, and the date in entry_date.

If unreadable, receipt_type = "unknown". Set confidence below 0.6 if any digit of total_sales is uncertain. Return only the fields.`;

const client = new Anthropic();

/**
 * Parse a daily-results receipt/summary image into structured sales data.
 * Channel is derived here: a Pizzaville receipt with deliveries is the
 * call-center report; with no deliveries it's the in-store report.
 */
export async function parseReceipt(
  input: ConnectorInput,
): Promise<ParsedReceipt> {
  const img = await prepImage(input.imageBytes, input.mediaType);
  const res = await client.messages.parse({
    model: process.env.PARSER_MODEL ?? "claude-opus-4-8",
    max_tokens: 400,
    output_config: { format: zodOutputFormat(ReceiptSchema) },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: img.media_type,
              data: img.data,
            },
          },
          { type: "text", text: PARSE_PROMPT },
        ],
      },
    ],
  });

  if (res.stop_reason === "refusal") throw new Error("parser_refused");
  const out = res.parsed_output;
  if (!out) throw new Error(`parser_no_output (stop_reason=${res.stop_reason})`);

  const receiptType: ReceiptType =
    out.receipt_type === "pizzaville_daily" ? "pizzaville" : out.receipt_type;

  const line_items = toLineItems(out.receipt_type, out.total_sales, out.total_deliveries);

  return {
    receipt_type: receiptType,
    business_identifier: out.store_identifier,
    entry_date: out.entry_date,
    line_items,
    confidence: out.confidence,
    extracted: {
      total_sales: out.total_sales,
      total_deliveries: out.total_deliveries,
    },
  };
}

function toLineItems(
  type: string,
  totalSales: number,
  totalDeliveries: number | null,
): { channel: Channel; amount: number }[] {
  switch (type) {
    case "pizzaville_daily": {
      // Deliveries present -> call-center report; none -> in-store report.
      const channel: Channel =
        (totalDeliveries ?? 0) > 0 ? "call_center" : "in_store";
      return [{ channel, amount: totalSales }];
    }
    case "uber_eats":
      return [{ channel: "uber_eats", amount: totalSales }];
    case "skip_dishes":
      return [{ channel: "skip_dishes", amount: totalSales }];
    default:
      return [];
  }
}
