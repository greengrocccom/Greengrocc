const LOGO_PATH = "/assets/payment/logo.png";

/**
 * Same wordmark the site header serves from `frontend/public`. Absolute so @react-pdf can fetch it;
 * must stay PNG/JPG because @react-pdf cannot render WebP/AVIF.
 */
export const LOGO_URL =
  typeof window !== "undefined" && window.location?.origin
    ? `${window.location.origin}${LOGO_PATH}`
    : LOGO_PATH;

export const INVOICE_LOGO_URL = LOGO_URL;

export const INVOICE_CONFIG = {
  companyName: "GreenGrocc",
  legalEntity: "GreenGrocc",
  email: "greengrocc14@gmail.com",
  supportEmail: "greengrocc14@gmail.com",
  phone: "+91 72490 38005",
  address: "Mumbai Central, Mumbai, Maharashtra",
  stateCode: "27",
  stateName: "Maharashtra",
  defaultHsn: "85171200",
  defaultGstRate: 18,
  bank: {
    name: "",
    ifsc: "",
    accountName: "GreenGrocc",
    accountNumber: "",
    upiId: "",
  },
};

/** Bank/UPI rows that actually have values; placeholder rows are never printed. */
export function getInvoicePaymentRows(config) {
  const bank = config?.bank || {};
  const rows = [
    ["Bank", bank.name],
    ["IFSC Code", bank.ifsc],
    ["Account No", bank.accountNumber],
    ["UPI ID", bank.upiId],
  ].filter(([, value]) => String(value || "").trim());
  if (!rows.length) return [];
  return [["Account Name", bank.accountName || config.companyName], ...rows];
}

export const INDIAN_STATE_CODES = {
  "andaman and nicobar islands": "35",
  "andhra pradesh": "37",
  "arunachal pradesh": "12",
  assam: "18",
  bihar: "10",
  chandigarh: "04",
  chhattisgarh: "22",
  "dadra and nagar haveli and daman and diu": "26",
  delhi: "07",
  goa: "30",
  gujarat: "24",
  haryana: "06",
  "himachal pradesh": "02",
  "jammu and kashmir": "01",
  jharkhand: "20",
  karnataka: "29",
  kerala: "32",
  ladakh: "38",
  lakshadweep: "31",
  "madhya pradesh": "23",
  maharashtra: "27",
  manipur: "14",
  meghalaya: "17",
  mizoram: "15",
  nagaland: "13",
  odisha: "21",
  puducherry: "34",
  punjab: "03",
  rajasthan: "08",
  sikkim: "11",
  "tamil nadu": "33",
  telangana: "36",
  tripura: "16",
  "uttar pradesh": "09",
  uttarakhand: "05",
  "west bengal": "19",
};
