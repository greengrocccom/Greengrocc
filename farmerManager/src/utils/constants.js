export const FARMER_COLORS = {
  primary: "#2E7D32",
  secondary: "#4CAF50",
  light: "#E8F5E9",
  background: "#F7F2E8",
  card: "#FFFFFF",
  text: "#1F2937",
  muted: "#6B7280",
  border: "#E5E7EB",
  warning: "#F59E0B",
  error: "#DC2626",
};

export const FARMER_STORAGE_KEY = "greengrocc_farmer_manager_auth";

export const REGISTRATION_STATUS = {
  REGISTERED: "REGISTERED",
  ACTIVE: "ACTIVE",
};

export const KYC_STATUS = {
  PENDING: "PENDING",
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
};

export const GENDER_OPTIONS = ["Male", "Female", "Other"];

export const PREFERRED_LANGUAGES = ["Marathi", "Hindi", "English"];

export const AREA_UNITS = ["Acre", "Hectare"];

export const SOIL_TYPES = ["Black Soil", "Red Soil", "Sandy", "Loamy", "Laterite", "Other"];

export const IRRIGATION_TYPES = ["Drip", "Sprinkler", "Flood", "Rainfed", "Canal"];

export const WATER_SOURCES = ["Borewell", "Well", "Canal", "River", "Pond", "Rainwater"];

export const FARMING_METHODS = ["Conventional", "Mixed", "Natural"];

export const FARMING_TYPES = ["Organic", "Conventional"];

export const CROP_OPTIONS = [
  "Tomato",
  "Onion",
  "Potato",
  "Capsicum",
  "Brinjal",
  "Cabbage",
  "Cauliflower",
  "Okra",
  "Chilli",
  "Cotton",
  "Soybean",
  "Wheat",
  "Rice",
  "Sugarcane",
  "Grapes",
  "Pomegranate",
  "Banana",
  "Maize",
  "Groundnut",
  "Turmeric",
  "Other",
];

/** Standardized varieties so Crop ID stays same across farmers (select from list). */
export const CROP_VARIETY_COMMON = ["Hybrid", "Local", "Desi", "Improved", "Open Pollinated"];

export const CROP_VARIETY_BY_CROP = {
  Tomato: ["Bajeerao", "Abhinav", "Sahoo", "Namdhari", "Heemsohna", "Hybrid", "Local"],
  Onion: ["Nashik Red", "Agrifound Light Red", "Pusa Red", "Hybrid", "Local"],
  Potato: ["Kufri Jyoti", "Kufri Pukhraj", "Kufri Chandramukhi", "Hybrid", "Local"],
  Capsicum: ["California Wonder", "Indra", "Hybrid", "Local"],
  Brinjal: ["Pusa Purple Long", "Hybrid", "Local"],
  Cabbage: ["Golden Acre", "Hybrid", "Local"],
  Cauliflower: ["Pusa Snowball", "Hybrid", "Local"],
  Okra: ["Parbhani Kranti", "Hybrid", "Local"],
  Chilli: ["Guntur", "Byadgi", "Hybrid", "Local"],
  Cotton: ["Bt Hybrid", "Desi", "Hybrid", "Local"],
  Soybean: ["JS 335", "MAUS", "Hybrid", "Local"],
  Wheat: ["Lokwan", "HD 2967", "Hybrid", "Local"],
  Rice: ["Indrayani", "Kolam", "Basmati", "Hybrid", "Local"],
  Sugarcane: ["Co 86032", "Local"],
  Grapes: ["Thompson Seedless", "Sharad Seedless", "Local"],
  Pomegranate: ["Bhagwa", "Ganesh", "Local"],
  Banana: ["Grand Naine", "Robusta", "Local"],
  Maize: ["Hybrid", "Local"],
  Groundnut: ["TAG 24", "Hybrid", "Local"],
  Turmeric: ["Salem", "Rajapore", "Local"],
};

export function varietyOptionsForCrop(cropName = "") {
  const key = String(cropName || "").trim();
  const specific = CROP_VARIETY_BY_CROP[key];
  if (specific?.length) return [...specific, "Other"];
  return [...CROP_VARIETY_COMMON, "Other"];
}

export const CROP_UNITS = ["Kg", "Quintal", "Ton"];

export const CROP_STATUSES = ["Planned", "Growing", "Ready for Harvest", "Harvested", "Completed"];

export const CROP_STATUS_FLOW = {
  Planned: ["Planned", "Growing"],
  Growing: ["Growing", "Ready for Harvest"],
  "Ready for Harvest": ["Ready for Harvest", "Harvested"],
  Harvested: ["Harvested", "Completed"],
  Completed: ["Completed"],
};

export const DOCUMENT_TYPES = [
  { id: "land_712", name: "7/12 Extract", marathi: "७/१२ उतारा", icon: "📜", required: true },
  { id: "land_8a", name: "8A Extract", marathi: "८-अ उतारा", icon: "📄", required: true },
  { id: "aadhaar", name: "Aadhaar Card", marathi: "आधार कार्ड", icon: "🪪", required: true },
  { id: "bank", name: "Bank Passbook", marathi: "बँक पासबुक", icon: "🏦", required: true },
  { id: "farmer_id", name: "Farmer ID", marathi: "शेतकरी ओळखपत्र", icon: "🌾", required: false },
  { id: "pan", name: "PAN Card", marathi: "पॅन कार्ड", icon: "💳", required: false },
  { id: "address_proof", name: "Address Proof", marathi: "रहिवासी दाखला", icon: "🏠", required: false },
  { id: "farmer_photo", name: "Farmer Photo", marathi: "शेतकरी फोटो", icon: "👤", required: false },
];

export const VERIFICATION_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  NOT_UPLOADED: "not_uploaded",
};

export const PRODUCT_STATUS = [
  "Draft",
  "Pending Approval",
  "Active",
  "Approved",
  "Rejected",
  "Out of Stock",
  "Low Stock",
  "Paused",
  "Inactive",
];

export const FARMER_PRODUCT_STATUSES = [
  "Draft",
  "Pending Approval",
  "Active",
  "Rejected",
  "Low Stock",
  "Out of Stock",
  "Paused",
];

export const FARMER_PRODUCT_UNITS = ["Kg", "Quintal", "Ton"];

export const PRODUCT_GRADE_OPTIONS = ["A", "B", "C"];

/** Status options shown on add / edit product form */
export const FARMER_PRODUCT_FORM_STATUS = [
  "Draft",
  "Pending Approval",
  "Approved",
  "Out of Stock",
  "Inactive",
];

export const PRODUCT_UNITS = [
  "Kg",
  "Gram",
  "Quintal",
  "Litre",
  "ml",
  "Piece",
  "Dozen",
  "Packet",
  "Box",
  "Bundle",
  "Bag",
];

export const PRICING_TYPES = [
  "Fixed Price",
  "Per Kg",
  "Per Gram",
  "Per Piece",
  "Per Litre",
  "Per Packet",
  "Variant Pricing",
  "Bulk Pricing",
];

export const ORDER_STATUS = [
  "New",
  "Confirmed",
  "Processing",
  "Ready for Pickup",
  "Completed",
  "Cancelled",
];

export const FARMER_ORDER_FILTERS = [
  { id: "new", label: "New Orders", to: "/farmer/orders/new" },
  { id: "preparing", label: "Preparing", to: "/farmer/orders/preparing" },
  { id: "ready", label: "Ready for Pickup", to: "/farmer/orders/ready" },
  { id: "completed", label: "Completed", to: "/farmer/orders/completed" },
  { id: "rejected", label: "Rejected", to: "/farmer/orders/rejected" },
];

export const ORDER_REJECTION_REASONS = [
  "Stock Unavailable",
  "Product Unavailable",
  "Quality Issue",
  "Pickup Issue",
  "Quantity Issue",
  "Other",
];

export const ORDER_PACKAGE_TYPES = ["Crate", "Bag", "Box", "Bundle", "Sack", "Other"];

export const PAYMENT_STATUS = ["Pending", "Processing", "Paid", "Failed"];

export const STOCK_REASONS = ["Sale", "Harvest", "Damage", "Manual Update", "Other"];

export const STOCK_GRADES = ["Grade A", "Grade B"];

export const SIDEBAR_ITEMS = [
  { to: "/farmer/dashboard", label: "Dashboard", icon: "dashboard" },
  { to: "/farmer/market-prices", label: "Market Prices", icon: "market" },
  { to: "/farmer/community", label: "Farmer Community", icon: "community" },
  { to: "/farmer/schemes", label: "Govt Schemes", icon: "schemes" },
  {
    id: "crops",
    label: "Crops",
    icon: "crops",
    children: [
      { to: "/farmer/crops", label: "My Crops", end: true },
      { to: "/farmer/crops/add", label: "Add Crop" },
      { to: "/farmer/crop-planning", label: "Crop Planning" },
    ],
  },
  {
    id: "products",
    label: "Products",
    icon: "products",
    children: [
      { to: "/farmer/products", label: "My Products", end: true },
      { to: "/farmer/products/add", label: "Add Product" },
      { to: "/farmer/products/details", label: "Product Details" },
    ],
  },
  {
    id: "orders",
    label: "Orders",
    icon: "orders",
    children: [
      { to: "/farmer/orders/new", label: "New Orders" },
      { to: "/farmer/orders/preparing", label: "Preparing" },
      { to: "/farmer/orders/ready", label: "Ready for Pickup" },
      { to: "/farmer/orders/completed", label: "Completed" },
      { to: "/farmer/orders/rejected", label: "Rejected" },
      { to: "/farmer/harvest-orders", label: "Harvest Orders" },
    ],
  },
  { to: "/farmer/earnings", label: "Earning", icon: "earnings" },
  { to: "/farmer/documents", label: "Document", icon: "documents" },
  {
    id: "profile",
    label: "Profile",
    icon: "profile",
    children: [
      { to: "/farmer/profile", label: "Farmer Profile" },
      { to: "/farmer/farm-profile", label: "Farm Profile" },
      { to: "/farmer/farm-location", label: "Farm Location" },
    ],
  },
];

export const MANAGER_SIDEBAR_ITEMS = [
  { to: "/manager/dashboard", label: "Dashboard", icon: "dashboard" },
  {
    id: "farmers",
    label: "Farmers",
    icon: "community",
    children: [
      { to: "/manager/farmers", label: "All Farmers" },
      { to: "/manager/farmers/add", label: "Add Farmer" },
    ],
  },
  {
    id: "crops",
    label: "Crops",
    icon: "crops",
    children: [
      { to: "/manager/crops", label: "My Crops", end: true },
      { to: "/manager/crops/add", label: "Add Crop" },
      { to: "/manager/crop-planning", label: "Crop Planning" },
    ],
  },
  {
    id: "products",
    label: "Products",
    icon: "products",
    children: [
      { to: "/manager/products", label: "My Products", end: true },
      { to: "/manager/products/add", label: "Add Product" },
      { to: "/manager/products/details", label: "Product Details" },
    ],
  },
  { to: "/manager/inventory", label: "Inventory", icon: "inventory" },
  {
    id: "orders",
    label: "Orders",
    icon: "orders",
    children: [
      { to: "/manager/orders/new", label: "New Orders" },
      { to: "/manager/orders/preparing", label: "Preparing" },
      { to: "/manager/orders/ready", label: "Ready for Pickup" },
      { to: "/manager/orders/completed", label: "Completed" },
      { to: "/manager/orders/rejected", label: "Rejected" },
      { to: "/manager/harvest-orders", label: "Harvest Orders" },
    ],
  },
  { to: "/manager/documents", label: "Documents", icon: "documents" },
  { to: "/manager/policies", label: "Policies", icon: "documents" },
  { to: "/manager/leave", label: "Apply Leave", icon: "calendar" },
  { to: "/manager/profile", label: "Profile", icon: "profile" },
];

export const ROLES = {
  FARMER: "FARMER",
  FARMER_MANAGER: "FARMER_MANAGER",
  VENDOR: "VENDOR",
  DRIVER: "DRIVER",
};

/** Selling routes require approved documents when verification is enforced */
export const SELLING_ROUTE_PREFIXES = [
  "/farmer/products",
  "/farmer/harvest-orders",
  "/farmer/earnings",
];
