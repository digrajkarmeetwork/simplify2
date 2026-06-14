// Shared domain types + the connector abstraction.
// v1 ingests everything through WhatsAppImageConnector; future UberReporting /
// EmailForward connectors implement the same interface without a pipeline rewrite.

export type Channel = "in_store" | "call_center" | "uber_eats" | "skip_dishes";
export type EntrySource = "whatsapp_ai" | "manual" | "api";
export type EntryStatus = "confirmed" | "needs_review";
export type ReceiptType = "pizzaville" | "uber_eats" | "skip_dishes" | "unknown";

/** Structured result of parsing one receipt/summary image. */
export interface ParsedReceipt {
  receipt_type: ReceiptType;
  business_identifier: string;
  entry_date: string; // ISO date as read off the receipt
  line_items: { channel: Channel; amount: number }[];
  confidence: number; // 0..1
  extracted?: Record<string, unknown>; // raw fields kept for audit
}

/** Raw input a connector turns into a ParsedReceipt. */
export interface ConnectorInput {
  imageBytes: Buffer;
  mediaType: string;
}

/**
 * A source of sales documents. The pipeline owns routing + persistence; a
 * connector only knows how to turn its source payload into a ParsedReceipt.
 */
export interface SalesConnector {
  readonly source: EntrySource;
  parse(input: ConnectorInput): Promise<ParsedReceipt>;
}
