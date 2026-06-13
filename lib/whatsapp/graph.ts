/** Base URL for the Meta Graph API (WhatsApp Cloud API). Version is overridable. */
export const GRAPH_BASE = `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION ?? "v22.0"}`;
