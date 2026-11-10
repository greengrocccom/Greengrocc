const PLACEHOLDER_PATTERN = /^(your|xxx|test)/i;

const envTemplate = (fallback, ...keys) => {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return fallback;
};

/**
 * 8 Approved MSG91 DLT Template IDs & Sender GREGRC
 *
 * Getters, not values: ES imports run before index.js calls dotenv.config(),
 * so reading process.env at module load would always yield the fallbacks.
 */
export const MSG91_TEMPLATES = {
  // 1. Delivery verification OTP for userapp / frontend / delivery completion
  get DELIVERY_VERIFICATION() {
    return envTemplate("6ad22b384233828ece0fe432", "MSG91_TEMPLATE_DELIVERY_VERIFY");
  },

  // 2. GreenGrocc Admin Login OTP
  get ADMIN_LOGIN() {
    return envTemplate("6ad0c670a33b8888e30b69b2", "MSG91_TEMPLATE_ADMIN_LOGIN");
  },

  // 3. GreenGrocc Customer Login OTP for userapp / frontend
  get USER_LOGIN() {
    return envTemplate("6ad22b01d08f916900083772", "MSG91_TEMPLATE_USER_LOGIN");
  },

  // 4. GreenGrocc Customer Registration OTP for userapp / frontend
  get USER_REGISTRATION() {
    return envTemplate("6ad22ac5cf70e75d8705c454", "MSG91_TEMPLATE_USER_REG");
  },

  // 5. Delivery Partner Login OTP for delivery app
  get DELIVERY_PARTNER_LOGIN() {
    return envTemplate("6ad22d787d4a4a46bb0027d3", "MSG91_TEMPLATE_DELIVERY_LOGIN");
  },

  // 6. Delivery Partner Registration OTP for delivery app
  get DELIVERY_PARTNER_REGISTRATION() {
    return envTemplate("6ad22a84e456c659070eca32", "MSG91_TEMPLATE_DELIVERY_REG");
  },

  // 7. Haritsetu Registration OTP for farmer app
  get HARITSETU_REGISTRATION() {
    return envTemplate("6ad22a3d6c206ccb8808a390", "MSG91_TEMPLATE_FARMER_REG");
  },

  // 8. Haritsetu Login OTP for farmer app
  get HARITSETU_LOGIN() {
    return envTemplate("6ad229e275be8e188e041062", "MSG91_TEMPLATE_FARMER_LOGIN");
  },

  // 9. GreenGrocc Common OTP (GREGRC_Common_OTP) for all other / generic flows
  get COMMON_OTP() {
    return envTemplate(
      "6ad710ca600b25a9f602a842",
      "MSG91_TEMPLATE_COMMON_OTP",
      "MSG91_TEMPLATE_GREGRC_COMMON_OTP"
    );
  },
};

export const msg91Config = {
  get authKey() {
    return process.env.MSG91_AUTH_KEY?.trim() || "";
  },
  get senderId() {
    return process.env.MSG91_SENDER_ID?.trim() || "GREGRC";
  },
  get entityId() {
    return process.env.MSG91_ENTITY_ID?.trim() || "";
  },
  get templateId() {
    return (
      process.env.MSG91_TEMPLATE_ID?.trim() ||
      MSG91_TEMPLATES.COMMON_OTP ||
      "6ad710ca600b25a9f602a842"
    );
  },
  templates: MSG91_TEMPLATES,
  otpLength: 6,
  otpExpiryMinutes: 10,
};

export function isMsg91Configured() {
  const authKey = msg91Config.authKey;
  if (!authKey) return false;
  if (PLACEHOLDER_PATTERN.test(authKey)) return false;
  return true;
}

export function assertMsg91Configured() {
  if (!isMsg91Configured()) {
    throw new Error(
      "MSG91 SMS is not configured. Add MSG91_AUTH_KEY to backend/.env"
    );
  }
}
