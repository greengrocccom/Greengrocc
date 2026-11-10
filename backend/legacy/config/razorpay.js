import Razorpay from "razorpay";

/**
 * Created on first use: this module is imported before the server loads .env, so reading
 * the keys at import time would always see them missing.
 */
let client = null;

function getClient() {
  if (client) return client;
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return client;
}

export function isRazorpayConfigured() {
  return Boolean(getClient());
}

const razorpay = {
  get orders() {
    return getClient()?.orders;
  },
  get payments() {
    return getClient()?.payments;
  },
};

export default razorpay;
