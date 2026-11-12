export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }

    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Puts card EMI and cardless EMI first while keeping every other method available. Razorpay only
 * lists EMI plans the account has enabled and the order amount qualifies for.
 */
const EMI_FIRST_DISPLAY = {
  display: {
    blocks: {
      emi: {
        name: "Pay in EMI",
        instruments: [{ method: "emi" }, { method: "cardless_emi" }],
      },
    },
    sequence: ["block.emi"],
    preferences: {
      show_default_blocks: true,
    },
  },
};

export function openRazorpayCheckout({
  keyId,
  amount,
  razorpayOrderId,
  user,
  description = "Order Payment",
  preferEmi = false,
  onSuccess,
  onDismiss,
}) {
  const options = {
    ...(preferEmi ? { config: EMI_FIRST_DISPLAY } : {}),
    key: keyId,
    amount,
    currency: "INR",
    name: "GreenGrocc",
    description,
    order_id: razorpayOrderId,
    prefill: {
      name: user?.name || "",
      email: user?.email || "",
      contact: user?.phone || "",
    },
    theme: {
      color: "#f97316",
    },
    handler: onSuccess,
    modal: {
      ondismiss: onDismiss,
    },
  };

  const rzp = new window.Razorpay(options);
  rzp.on("payment.failed", onDismiss);
  rzp.open();
}
