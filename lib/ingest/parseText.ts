import type { Channel } from "@/lib/connectors/types";

// Normalized (separator-stripped, lowercased) aliases -> channel.
export const CHANNEL_ALIASES: Record<string, Channel> = {
  instore: "in_store",
  store: "in_store",
  callcenter: "call_center",
  call: "call_center",
  uber: "uber_eats",
  ubereats: "uber_eats",
  skip: "skip_dishes",
  skipthedishes: "skip_dishes",
};

/**
 * Parse a "<channel> <amount>" EDIT instruction, e.g. "in_store 950",
 * "call center 420.50", "Uber $310". Returns null if it doesn't match.
 */
export function parseChannelAmount(
  s: string,
): { channel: Channel; amount: number } | null {
  const m = s.trim().match(/^(.+?)\s+\$?([\d.,]+)$/);
  if (!m) return null;
  const key = m[1].toLowerCase().replace(/[\s_\-]/g, "");
  const channel = CHANNEL_ALIASES[key];
  const amount = Number(m[2].replace(/,/g, ""));
  if (!channel || !Number.isFinite(amount) || amount < 0) return null;
  return { channel, amount };
}
