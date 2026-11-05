export const STAFF_ROLES = [
  "vendor",
  "segregation_manager",
  "product_manager",
  "farmer_manager",
  "farmer",
];

/** Who can create which roles (staff roles only). Delivery roles handled separately. */
export const CREATE_PERMISSIONS = {
  admin: [
    "vendor",
    "segregation_manager",
    "product_manager",
    "farmer_manager",
    "delivery_boy",
  ],
  vendor: ["delivery_boy"],
  segregation_manager: ["product_manager"],
  product_manager: [],
  farmer_manager: ["farmer"],
  delivery_manager: ["delivery_boy"],
};

export const ROLE_LABELS = {
  vendor: "Vendor",
  segregation_manager: "Segregation Manager",
  product_manager: "Product Manager",
  farmer_manager: "Farmer Manager",
  farmer: "Farmer",
  pickup_driver: "Pickup Driver",
  delivery_manager: "Delivery Manager",
  delivery_boy: "Delivery Boy",
};

export function canCreateRole(actorRole, targetRole) {
  const allowed = CREATE_PERMISSIONS[actorRole] || [];
  return allowed.includes(targetRole);
}
