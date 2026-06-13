import { describe, it, expect, beforeEach } from "vitest";
import crypto from "node:crypto";
import { verifyChallenge, verifySignature } from "./verify";

const SECRET = "test_app_secret";
const VERIFY_TOKEN = "test_verify_token";

function sign(body: string, secret = SECRET): string {
  return (
    "sha256=" + crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex")
  );
}

beforeEach(() => {
  process.env.WHATSAPP_APP_SECRET = SECRET;
  process.env.WHATSAPP_VERIFY_TOKEN = VERIFY_TOKEN;
});

describe("verifyChallenge", () => {
  it("echoes the challenge when mode + token match", () => {
    const params = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": VERIFY_TOKEN,
      "hub.challenge": "12345",
    });
    expect(verifyChallenge(params)).toBe("12345");
  });

  it("rejects a wrong token", () => {
    const params = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": "wrong",
      "hub.challenge": "12345",
    });
    expect(verifyChallenge(params)).toBeNull();
  });

  it("rejects a non-subscribe mode", () => {
    const params = new URLSearchParams({
      "hub.mode": "unsubscribe",
      "hub.verify_token": VERIFY_TOKEN,
      "hub.challenge": "12345",
    });
    expect(verifyChallenge(params)).toBeNull();
  });
});

describe("verifySignature", () => {
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });

  it("accepts a correctly signed body", () => {
    expect(verifySignature(body, sign(body))).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(verifySignature(body + " ", sign(body))).toBe(false);
  });

  it("rejects a signature made with the wrong secret", () => {
    expect(verifySignature(body, sign(body, "other_secret"))).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(verifySignature(body, null)).toBe(false);
  });
});
