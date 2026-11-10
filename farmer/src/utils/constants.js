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

export const FARMER_STORAGE_KEY = "greengrocc_farmer_auth";

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

export const CROP_STATUSES = [
  "Planning Created",
  "Land Preparation",
  "Soil Testing",
  "Land Preparation Completed",
  "Seed Selection",
  "Seed Treatment",
  "Sowing / Plantation",
  "Germination Started",
  "First Fertilizer Application",
  "Irrigation",
  "Crop Growth",
  "Spray / Pest Control",
  "Weeding / Intercultivation",
  "Second Fertilizer Application",
  "Spray / Disease Control",
  "Second Irrigation",
  "Crop Monitoring",
  "Nutrient / Micronutrient Spray",
  "Flowering / Fruiting",
  "Final Fertilizer / Required Treatment",
  "Pre-Harvest Stage",
  "Ready for Harvest",
];

export const CROP_PLANNING_22_STAGES = [
  { stage: 1, name: "Planning Created", marathi: "नियोजन तयार केले", display: "Planning Date", icon: "📝", fields: ["planningDate"], canRepeat: false },
  { stage: 2, name: "Land Preparation", marathi: "मशागत / जमीन तयार करणे", display: "Date + काम", icon: "🚜", fields: ["date", "activity"], canRepeat: false },
  { stage: 3, name: "Soil Testing", marathi: "माती परीक्षण", display: "Date + Soil Report", icon: "🧪", fields: ["date", "soilReport"], canRepeat: false },
  { stage: 4, name: "Land Preparation Completed", marathi: "मशागत पूर्ण", display: "Date", icon: "✅", fields: ["date"], canRepeat: false },
  { stage: 5, name: "Seed Selection", marathi: "बियाणे निवड", display: "Seed Name + Date", icon: "🌱", fields: ["seedName", "date"], canRepeat: false },
  { stage: 6, name: "Seed Treatment", marathi: "बीजप्रक्रिया", display: "Treatment + Date", icon: "💊", fields: ["treatment", "date"], canRepeat: false },
  { stage: 7, name: "Sowing / Plantation", marathi: "पेरणी / लागवड", display: "Date + Seed/Variety", icon: "🌾", fields: ["date", "variety"], canRepeat: false },
  { stage: 8, name: "Germination Started", marathi: "उगवण सुरू", display: "Date", icon: "🌱", fields: ["date"], canRepeat: false },
  { stage: 9, name: "First Fertilizer Application", marathi: "पहिली खत मात्रा", display: "Fertilizer Name + Quantity + Date", icon: "🧪", fields: ["fertilizerName", "quantity", "date"], canRepeat: false },
  { stage: 10, name: "Irrigation", marathi: "पाणी व्यवस्थापन १", display: "Irrigation Date + Type", icon: "💧", fields: ["date", "irrigationType"], canRepeat: false },
  { stage: 11, name: "Crop Growth", marathi: "पीक वाढ", display: "Date + Growth Observation", icon: "🌿", fields: ["date", "observation"], canRepeat: false },
  { stage: 12, name: "Spray / Pest Control", marathi: "कीड नियंत्रण फवारणी 🔄", display: "Spray Name + Date + Dose + Repeat Spray", icon: "🔄", fields: ["sprayName", "date", "dose", "repeatCount"], canRepeat: true },
  { stage: 13, name: "Weeding / Intercultivation", marathi: "तणनियंत्रण / खुरपणी / कोळपणी", display: "Date", icon: "🌿", fields: ["date"], canRepeat: false },
  { stage: 14, name: "Second Fertilizer Application", marathi: "दुसरी खत मात्रा", display: "Fertilizer Name + Quantity + Date", icon: "🧪", fields: ["fertilizerName", "quantity", "date"], canRepeat: false },
  { stage: 15, name: "Spray / Disease Control", marathi: "रोग नियंत्रण फवारणी 🔄", display: "Medicine/Fungicide + Date + Dose + Repeat Spray", icon: "🔄", fields: ["sprayName", "date", "dose", "repeatCount"], canRepeat: true },
  { stage: 16, name: "Second Irrigation", marathi: "पाणी व्यवस्थापन २", display: "Date + Type", icon: "💧", fields: ["date", "irrigationType"], canRepeat: false },
  { stage: 17, name: "Crop Monitoring", marathi: "पीक पाहणी", display: "Height/Growth + Observation", icon: "🔍", fields: ["height", "observation", "date"], canRepeat: false },
  { stage: 18, name: "Nutrient / Micronutrient Spray", marathi: "सूक्ष्म अन्नद्रव्य फवारणी 🔄", display: "Product + Date + Dose + Repeat Spray", icon: "🔄", fields: ["sprayName", "date", "dose", "repeatCount"], canRepeat: true },
  { stage: 19, name: "Flowering / Fruiting", marathi: "फुलोरा / फळधारणा", display: "Date + Observation", icon: "🌸", fields: ["date", "observation"], canRepeat: false },
  { stage: 20, name: "Final Fertilizer / Required Treatment", marathi: "शेवटची खत मात्रा / आवश्यक उपचार", display: "Product + Date", icon: "🧪", fields: ["product", "date"], canRepeat: false },
  { stage: 21, name: "Pre-Harvest Stage", marathi: "कापणीपूर्व टप्पा", display: "Date + Expected Harvest Date", icon: "🌾", fields: ["date", "expectedHarvestDate"], canRepeat: false },
  { stage: 22, name: "Ready for Harvest", marathi: "काढणीस तयार ✅", display: "Harvest Date + Expected Quantity", icon: "✅", fields: ["harvestDate", "expectedQuantity"], canRepeat: false },
];

export const CROP_STATUS_FLOW = Object.fromEntries(
  CROP_STATUSES.map((s, i) => [
    s,
    i < CROP_STATUSES.length - 1 ? [s, CROP_STATUSES[i + 1]] : [s],
  ])
);

export const DOCUMENT_TYPES = [
  { id: "aadhaar", name: "Aadhaar Card", marathi: "आधार कार्ड", icon: "🪪", required: true },
  { id: "farmer_id", name: "Farmer ID", marathi: "शेतकरी ओळखपत्र", icon: "🌾", required: true },
  { id: "land_712", name: "7/12 Extract", marathi: "७/१२ उतारा", icon: "📜", required: true },
  { id: "land_8a", name: "8A Extract", marathi: "८-अ उतारा", icon: "📄", required: true },
  { id: "bank", name: "Bank Passbook", marathi: "बँक पासबुक", icon: "🏦", required: true },
  { id: "farmer_photo", name: "Farmer Photo", marathi: "शेतकरी फोटो", icon: "👤", required: true },
  { id: "address_proof", name: "Address Proof", marathi: "रहिवासी दाखला", icon: "🏠", required: true },
  { id: "pan", name: "PAN Card", marathi: "पॅन कार्ड", icon: "💳", required: true },
];

export const CERTIFICATE_TYPES = [
  { id: "soil_report", name: "Soil Testing Report (मृदा परीक्षण अहवाल)", icon: "🧪", defaultStage: "Soil Report Uploaded" },
  { id: "organic_cert", name: "Organic Farming Certificate (सेंद्रिय शेती प्रमाणपत्र)", icon: "🌿" },
  { id: "land_712", name: "7/12 & 8-A Extract (७/१२ व ८-अ उतारा)", icon: "📜" },
  { id: "crop_insurance", name: "Crop Insurance Certificate (पीक विमा पावती)", icon: "🛡️" },
  { id: "water_testing", name: "Water Testing Report (पाणी चाचणी अहवाल)", icon: "💧" },
  { id: "gap_cert", name: "GAP / APEDA Quality Certificate (जीएपी / गुणवत्ता प्रमाणपत्र)", icon: "🏅" },
  { id: "pesticide_report", name: "Pesticide Residue Free Certificate (कीटकनाशक अवशेषमुक्त अहवाल)", icon: "🌱" },
  { id: "pre_harvest_cert", name: "Pre-Harvest Inspection Report (कापणीपूर्व तपासणी अहवाल)", icon: "📋", defaultStage: "Pre-Harvest Inspection" },
  { id: "other", name: "Other Certificate / Document (इतर प्रमाणपत्र)", icon: "📄" },
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
  { to: "/farmer/inventory", label: "Inventory", icon: "inventory" },
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
  { to: "/farmer/policies", label: "Policies", icon: "documents" },
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
  { to: "/farmer/manager/dashboard", label: "Dashboard", icon: "dashboard" },
  {
    id: "farmers",
    label: "Farmers",
    icon: "community",
    children: [
      { to: "/farmer/manager/farmers", label: "All Farmers" },
      { to: "/farmer/manager/farmers/add", label: "Add Farmer" },
    ],
  },
  {
    id: "products",
    label: "Products",
    icon: "products",
    children: [
      { to: "/farmer/manager/products", label: "All Products", end: true },
      { to: "/farmer/manager/products/add", label: "Add Product" },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: "inventory",
    children: [
      { to: "/farmer/manager/inventory", label: "All Inventory" },
      { to: "/farmer/manager/inventory/history", label: "Inventory History" },
    ],
  },
  {
    id: "orders",
    label: "Orders",
    icon: "orders",
    children: [
      { to: "/farmer/manager/orders", label: "All Orders", end: true },
      { to: "/farmer/manager/orders?tab=by-product", label: "Create Order by Product" },
      { to: "/farmer/manager/orders/create", label: "Create Order" },
    ],
  },
  { to: "/farmer/manager/earnings", label: "Earnings", icon: "earnings" },
  {
    id: "pickup",
    label: "Pickup",
    icon: "pickup",
    match: "/farmer/manager/pickups",
    excludeMatch: [
      "/farmer/manager/pickups/ready",
      "/farmer/manager/pickups/assigned",
      "/farmer/manager/pickups/today",
    ],
    children: [
      { to: "/farmer/manager/pickups/incoming", label: "Incoming Pickups" },
      { to: "/farmer/manager/pickups/centre", label: "Pickups at Centre" },
      { to: "/farmer/manager/pickups/all", label: "All Pickups" },
    ],
  },
  {
    id: "driver",
    label: "Driver",
    icon: "driver",
    match: "/farmer/manager/drivers",
    children: [
      { to: "/farmer/manager/pickups/ready", label: "Ready for Pickup" },
      { to: "/farmer/manager/pickups/assigned", label: "Assigned Pickups" },
      { to: "/farmer/manager/pickups/today", label: "Today's Pickups" },
      { to: "/farmer/manager/drivers", label: "All Drivers", end: true },
    ],
  },
  {
    id: "quality",
    label: "Quality and Grading Manager",
    icon: "quality",
    children: [
      { to: "/farmer/manager/quality/all", label: "All Inspection" },
      { to: "/farmer/manager/quality/pending", label: "Pending Inspection" },
      { to: "/farmer/manager/quality/inspection", label: "Quality Inspection & Grading" },
      { to: "/farmer/manager/quality/completed", label: "Completed" },
    ],
  },
  { to: "/farmer/manager/documents", label: "Documents", icon: "documents" },
  { to: "/farmer/manager/profile", label: "Profile", icon: "profile" },
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
