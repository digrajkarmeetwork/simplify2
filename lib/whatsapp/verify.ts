import crypto from "node:crypto";

/**
 * Meta webhook verification handshake (GET). Returns the challenge string to
 * echo back when the verify token matches, or null to reject.
 */
export function verifyChallenge(params: URLSearchParams): string | null {
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (
    mode === "subscribe" &&
    token &&
    token === process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    return challenge;
  }
  return null;
}

/**
 * Validate the X-Hub-Signature-256 header (HMAC-SHA256 of the raw body with the
 * app secret). Constant-time compare. Must be called on the *raw* request body.
 */
export function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !signatureHeader) return false;

  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");

  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
