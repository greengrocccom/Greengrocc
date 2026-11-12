/** EMI is a full online payment; it only changes which options Razorpay checkout leads with. */
export const PAYMENT_PLAN = {
  FULL: "online",
  EMI: "emi",
  COD: "cod",
};

export const PAYMENT_STATUS = {
  UNPAID: "unpaid",
  PAID_10: "paid_10",
  PAID: "paid",
  REFUNDABLE: "refundable",
  PENDING_VERIFICATION: "pending_verification",
};

export const PAYMENT_STATUS_LABELS = {
  unpaid: "Unpaid",
  paid_10: "Paid 10%",
  paid: "Paid",
  refundable: "Refundable",
  pending_verification: "Pending verification",
};

export function calculatePayableAmount(total, paymentMode) {
  const amount = Number(total) || 0;
  if (paymentMode === PAYMENT_PLAN.COD) {
    return 0;
  }
  return Math.round(amount * 100) / 100;
}

export function getPaymentStatusLabel(status) {
  return PAYMENT_STATUS_LABELS[status] || status;
}

export function getCheckoutPaymentMethod(paymentPlan) {
  if (paymentPlan === PAYMENT_PLAN.COD) return "cod";
  return "online";
}
