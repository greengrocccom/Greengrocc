import { Vendor } from "../../../farmer-manager-service/src/models.js";

export async function hasActiveMultivendor(manager) {
  const vendorId = String(manager?.vendorId || "").trim();
  if (!vendorId) return false;
  return Boolean(await Vendor.exists({ id: vendorId, status: "Active" }));
}
