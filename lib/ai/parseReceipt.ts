import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";
import type { ConnectorInput, ParsedReceipt } from "@/lib/connectors/types";

// Schema built with zod/v4 to match the SDK's zodOutputFormat helper.
const ReceiptSchema = z.object({
  receipt_type: z.enum(["pizzaville", "uber_eats", "skip_dishes", "unknown"]),
  business_identifier: z
    .string()
    .describe("Store name, address, or number printed on the receipt"),
  entry_date: z.string().describe("Business date on the receipt as YYYY-MM-DD"),
  line_items: z.array(
    z.object({
      channel: z.enum(["in_store", "call_center", "uber_eats", "skip_dishes"]),
      amount: z.number().describe("Total sales for this channel, as a number"),
    }),
  ),
  confidence: z
    .number()
    .describe("0..1 — set low when digits are smudged or unreadable"),
  raw_text: z.string().describe("All text read off the image, for audit"),
});

const PARSE_PROMPT = `You are extracting daily sales totals from a photographed receipt or a delivery-app summary screenshot for a pizza restaurant.

There are three possible layouts:
1. A Pizzaville daily receipt (thermal print) — it shows IN-STORE and CALL-CENTER totals, and sometimes a store name/number/address.
2. An Uber Eats sales summary screenshot.
3. A Skip the Dishes sales summary screenshot.

Rules:
- Set receipt_type to the layout you see (or "unknown").
- Put one line_item per sales channel you can read. For a Pizzaville receipt that is in_store and call_center; for Uber/Skip screenshots it is uber_eats / skip_dishes.
- amount is the day's total for that channel as a plain number (no currency symbol or thousands separators).
- entry_date is the business date printed on the document, formatted YYYY-MM-DD. If only month/day is shown, use the current year.
- business_identifier is whatever names the location (store name, number, or address). Empty string if none is visible.
- The image may have glare, smudges, or thermal fading. Read carefully. If any digit of an amount is genuinely unreadable, still return your best estimate but set confidence low (< 0.6).
- raw_text: transcribe all legible text.`;

const ALLOWED_MEDIA = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

function normalizeMediaType(
  mediaType: string,
): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  const t = mediaType.toLowerCase();
  if (ALLOWED_MEDIA.has(t))
    return t as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  return "image/jpeg"; // WhatsApp photos are JPEG; safe default
}

const client = new Anthropic();

/**
 * Parse a receipt image into structured sales data with Claude vision.
 * Uses structured outputs (not a forced tool) — see docs/PLAN.md → AI Parsing.
 * Do not downscale the image; resolution is what saves smudged thermal digits.
 */
export async function parseReceipt(
  input: ConnectorInput,
): Promise<ParsedReceipt> {
  const res = await client.messages.parse({
    model: process.env.PARSER_MODEL ?? "claude-opus-4-8",
    max_tokens: 2000,
    output_config: { format: zodOutputFormat(ReceiptSchema) },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: normalizeMediaType(input.mediaType),
              data: input.imageBytes.toString("base64"),
            },
          },
          { type: "text", text: PARSE_PROMPT },
        ],
      },
    ],
  });

  if (res.stop_reason === "refusal") {
    throw new Error("parser_refused");
  }
  if (!res.parsed_output) {
    throw new Error(`parser_no_output (stop_reason=${res.stop_reason})`);
  }
  return res.parsed_output;
}
