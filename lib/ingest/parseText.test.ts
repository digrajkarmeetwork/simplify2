import { describe, it, expect } from "vitest";
import { parseChannelAmount } from "./parseText";

describe("parseChannelAmount", () => {
  it("parses canonical channel + amount", () => {
    expect(parseChannelAmount("in_store 950")).toEqual({
      channel: "in_store",
      amount: 950,
    });
  });

  it("accepts spaces, casing, and a $ sign", () => {
    expect(parseChannelAmount("Call Center $420.50")).toEqual({
      channel: "call_center",
      amount: 420.5,
    });
  });

  it("accepts aliases", () => {
    expect(parseChannelAmount("uber 310")?.channel).toBe("uber_eats");
    expect(parseChannelAmount("skip 88")?.channel).toBe("skip_dishes");
    expect(parseChannelAmount("store 1200")?.channel).toBe("in_store");
  });

  it("strips thousands separators", () => {
    expect(parseChannelAmount("in_store 1,250.00")).toEqual({
      channel: "in_store",
      amount: 1250,
    });
  });

  it("rejects unknown channels", () => {
    expect(parseChannelAmount("doordash 100")).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(parseChannelAmount("in_store")).toBeNull();
    expect(parseChannelAmount("950")).toBeNull();
    expect(parseChannelAmount("in_store abc")).toBeNull();
    expect(parseChannelAmount("")).toBeNull();
  });

  it("rejects negative amounts", () => {
    expect(parseChannelAmount("in_store -50")).toBeNull();
  });
});
