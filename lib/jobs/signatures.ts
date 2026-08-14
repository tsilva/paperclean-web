import { createHmac, timingSafeEqual } from "node:crypto";

export function signPayload(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function verifyPayloadSignature(
  secret: string,
  timestamp: string,
  body: string,
  signature: string,
  nowMs = Date.now(),
): boolean {
  const unixSeconds = Number(timestamp);
  if (!Number.isFinite(unixSeconds) || Math.abs(nowMs - unixSeconds * 1000) > 5 * 60_000) {
    return false;
  }
  const expected = Buffer.from(signPayload(secret, timestamp, body), "hex");
  const received = Buffer.from(signature, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}
