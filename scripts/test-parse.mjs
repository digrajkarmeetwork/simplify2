// Quick parser validation against real receipt images (dev only).
// Run: node --env-file=.env.local scripts/test-parse.mjs "img1.jpeg" "img2.jpeg"
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import sharp from "sharp";
import * as z from "zod/v4";
import { readFileSync } from "node:fs";

async function downscale(bytes) {
  return sharp(bytes)
    .rotate()
    .resize({ width: 1568, height: 1568, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
}

const ReceiptSchema = z.object({
  receipt_type: z.enum(["pizzaville_daily", "uber_eats", "skip_dishes", "unknown"]),
  store_identifier: z.string(),
  entry_date: z.string(),
  total_sales: z.number(),
  total_deliveries: z.number().nullable(),
  confidence: z.number(),
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

If instead it's an Uber Eats or Skip the Dishes daily summary, set receipt_type accordingly, put the day's total in total_sales, total_deliveries = null, and the date in entry_date.

If unreadable, receipt_type = "unknown". Set confidence below 0.6 if any digit of total_sales is uncertain. Return only the fields.`;

const client = new Anthropic();
const model = process.env.PARSER_MODEL ?? "claude-opus-4-8";

for (const f of process.argv.slice(2)) {
  const bytes = await downscale(readFileSync(f));
  const res = await client.messages.parse({
    model,
    max_tokens: 400,
    output_config: { format: zodOutputFormat(ReceiptSchema) },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: bytes.toString("base64") } },
          { type: "text", text: PARSE_PROMPT },
        ],
      },
    ],
  });
  const u = res.usage;
  const cost = (u.input_tokens * 5 + u.output_tokens * 25) / 1_000_000;
  console.log(`\n${f.split(/[\\/]/).pop()}`);
  console.log("  ->", JSON.stringify(res.parsed_output));
  console.log(`  tokens: in=${u.input_tokens} out=${u.output_tokens}  ~$${cost.toFixed(4)} (opus)`);
}
