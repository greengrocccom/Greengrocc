/**
 * `express.json({ verify })` hook: keep the exact request bytes for signed webhooks
 * (signatures are computed over the raw body, not the parsed JSON).
 */
export function keepRawBodyForWebhooks(req, _res, buf) {
  if (String(req.originalUrl || req.url || "").startsWith("/api/payments/webhook")) {
    req.rawBody = buf.toString("utf8");
  }
}
