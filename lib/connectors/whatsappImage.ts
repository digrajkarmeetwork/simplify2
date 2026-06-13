import { parseReceipt } from "@/lib/ai/parseReceipt";
import type {
  ConnectorInput,
  ParsedReceipt,
  SalesConnector,
} from "@/lib/connectors/types";

/**
 * v1 connector: a WhatsApp image is parsed by Claude vision into a ParsedReceipt.
 * Routing and persistence are handled by the ingestion pipeline, not here.
 */
export class WhatsAppImageConnector implements SalesConnector {
  readonly source = "whatsapp_ai" as const;

  parse(input: ConnectorInput): Promise<ParsedReceipt> {
    return parseReceipt(input);
  }
}

export const whatsappImageConnector = new WhatsAppImageConnector();
