/**
 * GreenGrocc Frontend Export / Import Engine
 * 100% Client-side CSV & XML processing for Products and Shop Configurations.
 * No backend access required.
 */

// ----------------------------------------------------------------------
// 1. SAMPLE TEMPLATES (CSV & XML)
// ----------------------------------------------------------------------

export const SAMPLE_PRODUCTS_DATA = [
  {
    sku: "GGC-ART-VEG-TOM-01",
    name: "Fresh Hybrid Tomato Grade-A",
    variety: "Vaishali",
    brandName: "GreenGrocc Farms",
    category: "Vegetables",
    subcategory: "Tomatoes",
    price: 40,
    discountedPrice: 35,
    mrp: 45,
    stock: 500,
    unit: "Kg",
    grade: "Grade A",
    isActive: true,
    farmerName: "Ramesh Patil",
    produceType: "Organic",
    harvestDate: "2026-10-18",
    description: "Farm fresh organic farmgate tomatoes with rich lycopene and firm skin.",
  },
  {
    sku: "GGC-ART-VEG-ONI-01",
    name: "Nashik Garwa Red Onion",
    variety: "Garwa",
    brandName: "GreenGrocc Farms",
    category: "Vegetables",
    subcategory: "Onions",
    price: 32,
    discountedPrice: 28,
    mrp: 35,
    stock: 1200,
    unit: "Kg",
    grade: "Grade A",
    isActive: true,
    farmerName: "Suresh Deshmukh",
    produceType: "Desi",
    harvestDate: "2026-10-19",
    description: "Medium-sized pungent unhali onions with 6-month storage life.",
  },
  {
    sku: "GGC-ART-VEG-POT-01",
    name: "Jyoti Table Potato",
    variety: "Kufri Jyoti",
    brandName: "GreenGrocc Farms",
    category: "Vegetables",
    subcategory: "Potatoes",
    price: 30,
    discountedPrice: 26,
    mrp: 32,
    stock: 900,
    unit: "Kg",
    grade: "Grade A",
    isActive: true,
    farmerName: "Mahesh Jadhav",
    produceType: "Natural",
    harvestDate: "2026-10-15",
    description: "Firm, low-sugar white potatoes ideal for boiling and daily home cooking.",
  },
  {
    sku: "GGC-ART-FRU-APP-01",
    name: "Shimla Royal Delicious Apple",
    variety: "Royal Delicious",
    brandName: "GreenGrocc Orchards",
    category: "Fruits",
    subcategory: "Apples",
    price: 140,
    discountedPrice: 125,
    mrp: 160,
    stock: 350,
    unit: "Kg",
    grade: "Grade A",
    isActive: true,
    farmerName: "Anil Chauhan",
    produceType: "Natural",
    harvestDate: "2026-10-14",
    description: "Crisp and juicy sweet red apples handpicked from high altitude Himachal orchards.",
  },
  {
    sku: "GGC-ART-VEG-CHI-01",
    name: "G4 Fresh Green Chilli",
    variety: "G4",
    brandName: "GreenGrocc Farms",
    category: "Vegetables",
    subcategory: "Chillies",
    price: 65,
    discountedPrice: 58,
    mrp: 75,
    stock: 180,
    unit: "Kg",
    grade: "Grade B",
    isActive: true,
    farmerName: "Ganesh Kulkarni",
    produceType: "Desi",
    harvestDate: "2026-10-20",
    description: "Spicy dark green chillies picked fresh this morning.",
  },
];

export const SAMPLE_PRODUCTS_CSV = `sku,name,variety,brandName,category,subcategory,price,discountedPrice,mrp,stock,unit,grade,isActive,farmerName,produceType,harvestDate,description
GGC-ART-VEG-TOM-01,"Fresh Hybrid Tomato Grade-A",Vaishali,"GreenGrocc Farms",Vegetables,Tomatoes,40,35,45,500,Kg,"Grade A",true,"Ramesh Patil",Organic,2026-10-18,"Farm fresh organic farmgate tomatoes with rich lycopene and firm skin."
GGC-ART-VEG-ONI-01,"Nashik Garwa Red Onion",Garwa,"GreenGrocc Farms",Vegetables,Onions,32,28,35,1200,Kg,"Grade A",true,"Suresh Deshmukh",Desi,2026-10-19,"Medium-sized pungent unhali onions with 6-month storage life."
GGC-ART-VEG-POT-01,"Jyoti Table Potato","Kufri Jyoti","GreenGrocc Farms",Vegetables,Potatoes,30,26,32,900,Kg,"Grade A",true,"Mahesh Jadhav",Natural,2026-10-15,"Firm low-sugar white potatoes ideal for boiling and daily cooking."
GGC-ART-FRU-APP-01,"Shimla Royal Delicious Apple","Royal Delicious","GreenGrocc Orchards",Fruits,Apples,140,125,160,350,Kg,"Grade A",true,"Anil Chauhan",Natural,2026-10-14,"Crisp and juicy sweet red apples handpicked from high altitude Himachal orchards."
GGC-ART-VEG-CHI-01,"G4 Fresh Green Chilli",G4,"GreenGrocc Farms",Vegetables,Chillies,65,58,75,180,Kg,"Grade B",true,"Ganesh Kulkarni",Desi,2026-10-20,"Spicy dark green chillies picked fresh this morning."`;

export const SAMPLE_PRODUCTS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<shop_catalog version="1.0" generated_by="GreenGrocc Vendor Portal">
  <metadata>
    <exported_at>2026-10-20T12:00:00Z</exported_at>
    <currency>INR</currency>
    <total_products>5</total_products>
  </metadata>
  <products>
    <product>
      <sku>GGC-ART-VEG-TOM-01</sku>
      <name><![CDATA[Fresh Hybrid Tomato Grade-A]]></name>
      <variety>Vaishali</variety>
      <brandName>GreenGrocc Farms</brandName>
      <category>Vegetables</category>
      <subcategory>Tomatoes</subcategory>
      <price currency="INR">40.00</price>
      <discountedPrice currency="INR">35.00</discountedPrice>
      <mrp currency="INR">45.00</mrp>
      <stock unit="Kg">500</stock>
      <grade>Grade A</grade>
      <isActive>true</isActive>
      <farmerName>Ramesh Patil</farmerName>
      <produceType>Organic</produceType>
      <harvestDate>2026-10-18</harvestDate>
      <description><![CDATA[Farm fresh organic farmgate tomatoes with rich lycopene and firm skin.]]></description>
    </product>
    <product>
      <sku>GGC-ART-VEG-ONI-01</sku>
      <name><![CDATA[Nashik Garwa Red Onion]]></name>
      <variety>Garwa</variety>
      <brandName>GreenGrocc Farms</brandName>
      <category>Vegetables</category>
      <subcategory>Onions</subcategory>
      <price currency="INR">32.00</price>
      <discountedPrice currency="INR">28.00</discountedPrice>
      <mrp currency="INR">35.00</mrp>
      <stock unit="Kg">1200</stock>
      <grade>Grade A</grade>
      <isActive>true</isActive>
      <farmerName>Suresh Deshmukh</farmerName>
      <produceType>Desi</produceType>
      <harvestDate>2026-10-19</harvestDate>
      <description><![CDATA[Medium-sized pungent unhali onions with 6-month storage life.]]></description>
    </product>
    <product>
      <sku>GGC-ART-VEG-POT-01</sku>
      <name><![CDATA[Jyoti Table Potato]]></name>
      <variety>Kufri Jyoti</variety>
      <brandName>GreenGrocc Farms</brandName>
      <category>Vegetables</category>
      <subcategory>Potatoes</subcategory>
      <price currency="INR">30.00</price>
      <discountedPrice currency="INR">26.00</discountedPrice>
      <mrp currency="INR">32.00</mrp>
      <stock unit="Kg">900</stock>
      <grade>Grade A</grade>
      <isActive>true</isActive>
      <farmerName>Mahesh Jadhav</farmerName>
      <produceType>Natural</produceType>
      <harvestDate>2026-10-15</harvestDate>
      <description><![CDATA[Firm low-sugar white potatoes ideal for boiling and daily cooking.]]></description>
    </product>
    <product>
      <sku>GGC-ART-FRU-APP-01</sku>
      <name><![CDATA[Shimla Royal Delicious Apple]]></name>
      <variety>Royal Delicious</variety>
      <brandName>GreenGrocc Orchards</brandName>
      <category>Fruits</category>
      <subcategory>Apples</subcategory>
      <price currency="INR">140.00</price>
      <discountedPrice currency="INR">125.00</discountedPrice>
      <mrp currency="INR">160.00</mrp>
      <stock unit="Kg">350</stock>
      <grade>Grade A</grade>
      <isActive>true</isActive>
      <farmerName>Anil Chauhan</farmerName>
      <produceType>Natural</produceType>
      <harvestDate>2026-10-14</harvestDate>
      <description><![CDATA[Crisp and juicy sweet red apples handpicked from high altitude Himachal orchards.]]></description>
    </product>
    <product>
      <sku>GGC-ART-VEG-CHI-01</sku>
      <name><![CDATA[G4 Fresh Green Chilli]]></name>
      <variety>G4</variety>
      <brandName>GreenGrocc Farms</brandName>
      <category>Vegetables</category>
      <subcategory>Chillies</subcategory>
      <price currency="INR">65.00</price>
      <discountedPrice currency="INR">58.00</discountedPrice>
      <mrp currency="INR">75.00</mrp>
      <stock unit="Kg">180</stock>
      <grade>Grade B</grade>
      <isActive>true</isActive>
      <farmerName>Ganesh Kulkarni</farmerName>
      <produceType>Desi</produceType>
      <harvestDate>2026-10-20</harvestDate>
      <description><![CDATA[Spicy dark green chillies picked fresh this morning.]]></description>
    </product>
  </products>
</shop_catalog>`;

// ----------------------------------------------------------------------
// 2. SHOP CONFIGURATION PRESETS (From Existing Verified Shops)
// ----------------------------------------------------------------------

export const EXISTING_SHOP_PRESETS = [
  {
    id: "organic_farmgate",
    name: "GreenGroccc Organic Farmgate Hub",
    shopType: "Farm Direct & Organic",
    description: "Configured for direct farmgate collection centers, organic produce verification, and strict quality grading.",
    icon: "Sprout",
    config: {
      shopName: "GreenGroccc Organic Farmgate Hub",
      businessType: "Farm Producer Collective",
      storeType: "organic_hub",
      deliveryRadiusKm: 25,
      minimumOrderValue: 200,
      markupPercentage: 8,
      operatingHours: {
        opening: "06:30",
        closing: "19:00",
        closedDays: ["Sunday"],
      },
      display: {
        theme: "light",
        compactMode: false,
        autoRefreshInterval: 30,
        dateFormat: "DD/MM/YYYY",
        currency: "INR",
        defaultLandingPage: "/vendor/farmer-products",
      },
      operations: {
        autoAssignDrivers: false,
        defaultBatchSize: 8,
        collectionCenterOpening: "06:30",
        collectionCenterClosing: "19:00",
        autoConfirmPreorders: false,
        requireQualityPhotos: true,
        strictGradingConfirmation: true,
      },
      notifications: {
        orderReceivedSound: true,
        emailNotifications: true,
        smsAlerts: true,
        lowStockThresholdKg: 100,
        notifyDriverArrival: true,
        notifyQualityCompleted: true,
        dailySummaryEmail: true,
      },
      qualityControl: {
        mandatoryPhotosPerLot: 3,
        autoRejectBrixBelow: 8,
        gradeCAction: "discount_clearance",
      },
    },
  },
  {
    id: "express_darkstore",
    name: "GreenGroccc 10-Min Fast Express Store",
    shopType: "Urban Quick Commerce Dark Store",
    description: "Ultra-fast fulfillment configuration with auto-confirm pre-orders, automated driver dispatch, and instant restock alerts.",
    icon: "Zap",
    config: {
      shopName: "GreenGroccc 10-Min Fast Express Store",
      businessType: "Quick Commerce Dark Store",
      storeType: "mall",
      deliveryRadiusKm: 5,
      minimumOrderValue: 99,
      markupPercentage: 15,
      operatingHours: {
        opening: "06:00",
        closing: "23:30",
        closedDays: [],
      },
      display: {
        theme: "light",
        compactMode: true,
        autoRefreshInterval: 10,
        dateFormat: "DD/MM/YYYY",
        currency: "INR",
        defaultLandingPage: "/dashboard",
      },
      operations: {
        autoAssignDrivers: true,
        defaultBatchSize: 3,
        collectionCenterOpening: "06:00",
        collectionCenterClosing: "23:30",
        autoConfirmPreorders: true,
        requireQualityPhotos: false,
        strictGradingConfirmation: false,
      },
      notifications: {
        orderReceivedSound: true,
        emailNotifications: false,
        smsAlerts: true,
        lowStockThresholdKg: 20,
        notifyDriverArrival: true,
        notifyQualityCompleted: false,
        dailySummaryEmail: false,
      },
      qualityControl: {
        mandatoryPhotosPerLot: 1,
        autoRejectBrixBelow: 5,
        gradeCAction: "auto_reject",
      },
    },
  },
  {
    id: "wholesale_apmc",
    name: "APMC Wholesale Mandi Merchant",
    shopType: "B2B Bulk Mandi Trading",
    description: "High-volume configuration with batch grouping, multi-slab wholesale pricing, ERP integration, and crate weighing.",
    icon: "Building2",
    config: {
      shopName: "APMC Wholesale Mandi Merchant",
      businessType: "B2B Agriculture Wholesaler",
      storeType: "wholesale_mandi",
      deliveryRadiusKm: 60,
      minimumOrderValue: 2000,
      markupPercentage: 5,
      operatingHours: {
        opening: "04:30",
        closing: "15:00",
        closedDays: [],
      },
      display: {
        theme: "light",
        compactMode: false,
        autoRefreshInterval: 60,
        dateFormat: "DD/MM/YYYY",
        currency: "INR",
        defaultLandingPage: "/vendor/inventory",
      },
      operations: {
        autoAssignDrivers: false,
        defaultBatchSize: 20,
        collectionCenterOpening: "04:30",
        collectionCenterClosing: "15:00",
        autoConfirmPreorders: true,
        requireQualityPhotos: true,
        strictGradingConfirmation: true,
      },
      notifications: {
        orderReceivedSound: true,
        emailNotifications: true,
        smsAlerts: true,
        lowStockThresholdKg: 500,
        notifyDriverArrival: true,
        notifyQualityCompleted: true,
        dailySummaryEmail: true,
      },
      qualityControl: {
        mandatoryPhotosPerLot: 4,
        autoRejectBrixBelow: 7,
        gradeCAction: "renegotiate_price",
      },
    },
  },
  {
    id: "hydroponics_greens",
    name: "PureHydro Indoor Greens & Microgreens",
    shopType: "Controlled Agriculture & Hydroponics",
    description: "Precision greenhouse configuration for high-value lettuce, basil, bell peppers, microgreens, and exotic fruits.",
    icon: "Leaf",
    config: {
      shopName: "PureHydro Indoor Greens & Microgreens",
      businessType: "Precision Hydroponic Farming",
      storeType: "exotic_greens",
      deliveryRadiusKm: 30,
      minimumOrderValue: 350,
      markupPercentage: 22,
      operatingHours: {
        opening: "08:00",
        closing: "18:00",
        closedDays: ["Sunday"],
      },
      display: {
        theme: "light",
        compactMode: false,
        autoRefreshInterval: 0,
        dateFormat: "DD/MM/YYYY",
        currency: "INR",
        defaultLandingPage: "/vendor/my-products",
      },
      operations: {
        autoAssignDrivers: false,
        defaultBatchSize: 5,
        collectionCenterOpening: "08:00",
        collectionCenterClosing: "18:00",
        autoConfirmPreorders: false,
        requireQualityPhotos: true,
        strictGradingConfirmation: true,
      },
      notifications: {
        orderReceivedSound: true,
        emailNotifications: true,
        smsAlerts: false,
        lowStockThresholdKg: 15,
        notifyDriverArrival: true,
        notifyQualityCompleted: true,
        dailySummaryEmail: true,
      },
      qualityControl: {
        mandatoryPhotosPerLot: 2,
        autoRejectBrixBelow: 10,
        gradeCAction: "compost",
      },
    },
  },
];

// ----------------------------------------------------------------------
// 3. CLIENT-SIDE CSV PARSER & GENERATOR
// ----------------------------------------------------------------------

/**
 * Parses CSV text handling quotes, commas, escapes, and multi-line fields
 */
export function parseCSV(csvText) {
  if (!csvText || typeof csvText !== "string") return [];

  const rows = [];
  let currentRow = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") i++; // skip \r\n
      currentRow.push(currentField.trim());
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length < 2) return [];

  // Normalize headers
  const rawHeaders = rows[0];
  const headers = rawHeaders.map((h) => normalizeHeaderName(h));

  const items = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const item = {};
    for (let c = 0; c < headers.length; c++) {
      const headerKey = headers[c];
      const rawVal = row[c] ?? "";
      item[headerKey] = normalizeValue(headerKey, rawVal);
    }
    // Only push if has essential field (name or sku)
    if (item.name || item.sku) {
      items.push(item);
    }
  }

  return items;
}

/**
 * Generates RFC 4180 compliant CSV string from an array of product objects
 */
export function generateCSV(products = []) {
  if (!Array.isArray(products) || products.length === 0) return "";

  const headers = [
    "sku",
    "name",
    "variety",
    "brandName",
    "category",
    "subcategory",
    "price",
    "discountedPrice",
    "mrp",
    "stock",
    "unit",
    "grade",
    "isActive",
    "farmerName",
    "produceType",
    "harvestDate",
    "description",
  ];

  const escapeField = (val) => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.join(",");
  const dataLines = products.map((item) => {
    return headers
      .map((header) => {
        let val = item[header];
        if (header === "category" && Array.isArray(item.categories)) {
          val = item.categories[0] || "";
        }
        if (header === "price" && !val && item.sellingPrice) {
          val = item.sellingPrice;
        }
        return escapeField(val ?? "");
      })
      .join(",");
  });

  return [headerLine, ...dataLines].join("\r\n");
}

// ----------------------------------------------------------------------
// 4. CLIENT-SIDE XML PARSER & GENERATOR
// ----------------------------------------------------------------------

/**
 * Parses XML text using browser DOMParser and extracts product records
 */
export function parseXML(xmlText) {
  if (!xmlText || typeof xmlText !== "string") return [];

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");

  const parseError = xmlDoc.getElementsByTagName("parsererror");
  if (parseError.length > 0) {
    const errorMsg = parseError[0].textContent || "Malformed XML file";
    throw new Error(`XML Syntax Error: ${errorMsg.slice(0, 150)}`);
  }

  // Look for product nodes: <product>, <item>, or <entry>
  let productNodes = xmlDoc.getElementsByTagName("product");
  if (productNodes.length === 0) productNodes = xmlDoc.getElementsByTagName("item");
  if (productNodes.length === 0) productNodes = xmlDoc.getElementsByTagName("entry");

  const items = [];
  for (let i = 0; i < productNodes.length; i++) {
    const node = productNodes[i];
    const item = {};

    const getText = (tagName) => {
      const el = node.getElementsByTagName(tagName)[0];
      return el ? el.textContent.trim() : "";
    };

    // Extract fields
    item.sku = getText("sku") || getText("g:id") || getText("id") || `IMPORT-${Date.now()}-${i + 1}`;
    item.name = getText("name") || getText("g:title") || getText("title") || "";
    item.variety = getText("variety") || getText("varietyName") || "";
    item.brandName = getText("brandName") || getText("brand") || getText("g:brand") || "GreenGrocc Fresh";
    item.category = getText("category") || getText("g:product_type") || "Vegetables";
    item.subcategory = getText("subcategory") || "";
    item.price = Number(getText("price")?.replace(/[^0-9.]/g, "") || 0);
    item.discountedPrice = Number(getText("discountedPrice")?.replace(/[^0-9.]/g, "") || item.price);
    item.mrp = Number(getText("mrp")?.replace(/[^0-9.]/g, "") || item.price);
    item.stock = Number(getText("stock")?.replace(/[^0-9.]/g, "") || 0);
    item.unit = getText("unit") || getText("stock_unit") || "Kg";
    item.grade = getText("grade") || "Grade A";
    item.isActive = getText("isActive") !== "false" && getText("status") !== "inactive";
    item.farmerName = getText("farmerName") || getText("farmer") || "Farmer Direct";
    item.produceType = getText("produceType") || "Organic";
    item.harvestDate = getText("harvestDate") || "";
    item.description = getText("description") || getText("g:description") || "";

    if (item.name || item.sku) {
      items.push(item);
    }
  }

  return items;
}

/**
 * Generates well-formed XML string from products array
 */
export function generateXML(products = [], shopName = "GreenGrocc Vendor Portal") {
  if (!Array.isArray(products) || products.length === 0) return "";

  const escapeXML = (str) => {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  };

  const xmlLines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<shop_catalog version="1.0" generated_by="${escapeXML(shopName)}">`,
    `  <metadata>`,
    `    <exported_at>${new Date().toISOString()}</exported_at>`,
    `    <currency>INR</currency>`,
    `    <total_products>${products.length}</total_products>`,
    `  </metadata>`,
    `  <products>`,
  ];

  for (const item of products) {
    const sku = item.sku || `SKU-${Date.now()}`;
    const name = item.name || "Produce Item";
    const variety = item.variety || "";
    const brandName = item.brandName || "GreenGrocc Farms";
    const category = Array.isArray(item.categories) ? item.categories[0] : item.category || "Vegetables";
    const subcategory = item.subcategory || "";
    const price = Number(item.price || item.sellingPrice || 0).toFixed(2);
    const discountedPrice = Number(item.discountedPrice || price).toFixed(2);
    const mrp = Number(item.mrp || price).toFixed(2);
    const stock = Number(item.stock || 0);
    const unit = item.unit || "Kg";
    const grade = item.grade || "Grade A";
    const isActive = Boolean(item.isActive !== false);
    const farmerName = item.farmerName || "Farmer Direct";
    const produceType = item.produceType || "Organic";
    const harvestDate = item.harvestDate || "";
    const description = item.description || "";

    xmlLines.push(
      `    <product>`,
      `      <sku>${escapeXML(sku)}</sku>`,
      `      <name><![CDATA[${name}]]></name>`,
      `      <variety>${escapeXML(variety)}</variety>`,
      `      <brandName>${escapeXML(brandName)}</brandName>`,
      `      <category>${escapeXML(category)}</category>`,
      `      <subcategory>${escapeXML(subcategory)}</subcategory>`,
      `      <price currency="INR">${price}</price>`,
      `      <discountedPrice currency="INR">${discountedPrice}</discountedPrice>`,
      `      <mrp currency="INR">${mrp}</mrp>`,
      `      <stock unit="${escapeXML(unit)}">${stock}</stock>`,
      `      <grade>${escapeXML(grade)}</grade>`,
      `      <isActive>${isActive}</isActive>`,
      `      <farmerName>${escapeXML(farmerName)}</farmerName>`,
      `      <produceType>${escapeXML(produceType)}</produceType>`,
      `      <harvestDate>${escapeXML(harvestDate)}</harvestDate>`,
      `      <description><![CDATA[${description}]]></description>`,
      `    </product>`
    );
  }

  xmlLines.push(`  </products>`, `</shop_catalog>`);
  return xmlLines.join("\n");
}

// ----------------------------------------------------------------------
// 5. SHOP CONFIGURATION XML GENERATOR & PARSER
// ----------------------------------------------------------------------

/**
 * Exports full shop configuration to formatted XML
 */
export function generateShopConfigXML(shopConfig, vendorName = "Vendor Store") {
  const cfg = shopConfig || {};
  const escapeXML = (str) => String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `<?xml version="1.0" encoding="UTF-8"?>
<greengrocc_shop_configuration version="2.0">
  <metadata>
    <exported_at>${new Date().toISOString()}</exported_at>
    <shop_name>${escapeXML(vendorName)}</shop_name>
    <format>GreenGrocc Unified Shop Spec</format>
  </metadata>
  <shop_profile>
    <store_type>${escapeXML(cfg.storeType || "standard")}</store_type>
    <business_type>${escapeXML(cfg.businessType || "Retail Fresh Produce")}</business_type>
    <delivery_radius_km>${cfg.deliveryRadiusKm || 15}</delivery_radius_km>
    <minimum_order_value>${cfg.minimumOrderValue || 150}</minimum_order_value>
    <markup_percentage>${cfg.markupPercentage || 10}</markup_percentage>
  </shop_profile>
  <operating_hours>
    <opening>${escapeXML(cfg.operatingHours?.opening || cfg.operations?.collectionCenterOpening || "08:00")}</opening>
    <closing>${escapeXML(cfg.operatingHours?.closing || cfg.operations?.collectionCenterClosing || "20:00")}</closing>
  </operating_hours>
  <display_settings>
    <theme>${escapeXML(cfg.display?.theme || "light")}</theme>
    <compact_mode>${Boolean(cfg.display?.compactMode)}</compact_mode>
    <auto_refresh_interval>${cfg.display?.autoRefreshInterval || 0}</auto_refresh_interval>
    <date_format>${escapeXML(cfg.display?.dateFormat || "DD/MM/YYYY")}</date_format>
    <currency>${escapeXML(cfg.display?.currency || "INR")}</currency>
    <default_landing_page>${escapeXML(cfg.display?.defaultLandingPage || "/dashboard")}</default_landing_page>
  </display_settings>
  <operations_settings>
    <auto_assign_drivers>${Boolean(cfg.operations?.autoAssignDrivers)}</auto_assign_drivers>
    <default_batch_size>${cfg.operations?.defaultBatchSize || 5}</default_batch_size>
    <auto_confirm_preorders>${Boolean(cfg.operations?.autoConfirmPreorders)}</auto_confirm_preorders>
    <require_quality_photos>${Boolean(cfg.operations?.requireQualityPhotos !== false)}</require_quality_photos>
    <strict_grading_confirmation>${Boolean(cfg.operations?.strictGradingConfirmation !== false)}</strict_grading_confirmation>
  </operations_settings>
  <notifications_settings>
    <order_received_sound>${Boolean(cfg.notifications?.orderReceivedSound !== false)}</order_received_sound>
    <email_notifications>${Boolean(cfg.notifications?.emailNotifications !== false)}</email_notifications>
    <sms_alerts>${Boolean(cfg.notifications?.smsAlerts)}</sms_alerts>
    <low_stock_threshold_kg>${cfg.notifications?.lowStockThresholdKg || 50}</low_stock_threshold_kg>
    <notify_driver_arrival>${Boolean(cfg.notifications?.notifyDriverArrival !== false)}</notify_driver_arrival>
    <notify_quality_completed>${Boolean(cfg.notifications?.notifyQualityCompleted !== false)}</notify_quality_completed>
    <daily_summary_email>${Boolean(cfg.notifications?.dailySummaryEmail)}</daily_summary_email>
  </notifications_settings>
</greengrocc_shop_configuration>`;
}

/**
 * Parses shop configuration XML into standardized settings object
 */
export function parseShopConfigXML(xmlText) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");

  const parseError = xmlDoc.getElementsByTagName("parsererror");
  if (parseError.length > 0) {
    throw new Error("Invalid Shop Configuration XML format");
  }

  const getText = (tagName) => {
    const el = xmlDoc.getElementsByTagName(tagName)[0];
    return el ? el.textContent.trim() : "";
  };

  const getBool = (tagName, def = false) => {
    const val = getText(tagName);
    if (!val) return def;
    return val === "true" || val === "1";
  };

  const getNum = (tagName, def = 0) => {
    const val = getText(tagName);
    const n = Number(val);
    return Number.isFinite(n) ? n : def;
  };

  return {
    shopName: getText("shop_name") || "Imported Shop",
    storeType: getText("store_type") || "standard",
    businessType: getText("business_type") || "Fresh Produce Vendor",
    deliveryRadiusKm: getNum("delivery_radius_km", 15),
    minimumOrderValue: getNum("minimum_order_value", 150),
    markupPercentage: getNum("markup_percentage", 10),
    operatingHours: {
      opening: getText("opening") || "08:00",
      closing: getText("closing") || "20:00",
      closedDays: [],
    },
    display: {
      theme: getText("theme") || "light",
      compactMode: getBool("compact_mode", false),
      autoRefreshInterval: getNum("auto_refresh_interval", 0),
      dateFormat: getText("date_format") || "DD/MM/YYYY",
      currency: getText("currency") || "INR",
      defaultLandingPage: getText("default_landing_page") || "/dashboard",
    },
    operations: {
      autoAssignDrivers: getBool("auto_assign_drivers", false),
      defaultBatchSize: getNum("default_batch_size", 5),
      collectionCenterOpening: getText("opening") || "08:00",
      collectionCenterClosing: getText("closing") || "20:00",
      autoConfirmPreorders: getBool("auto_confirm_preorders", false),
      requireQualityPhotos: getBool("require_quality_photos", true),
      strictGradingConfirmation: getBool("strict_grading_confirmation", true),
    },
    notifications: {
      orderReceivedSound: getBool("order_received_sound", true),
      emailNotifications: getBool("email_notifications", true),
      smsAlerts: getBool("sms_alerts", false),
      lowStockThresholdKg: getNum("low_stock_threshold_kg", 50),
      notifyDriverArrival: getBool("notify_driver_arrival", true),
      notifyQualityCompleted: getBool("notify_quality_completed", true),
      dailySummaryEmail: getBool("daily_summary_email", false),
    },
  };
}

// ----------------------------------------------------------------------
// 6. VALIDATION & ACTIVITY LOG HELPERS
// ----------------------------------------------------------------------

export const IMPORT_HISTORY_KEY = "greengrocc_vendor_import_history";

export function getImportHistory() {
  try {
    const raw = localStorage.getItem(IMPORT_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveImportHistoryEntry(entry) {
  try {
    const history = getImportHistory();
    const updated = [
      {
        id: `imp-${Date.now()}`,
        timestamp: new Date().toISOString(),
        ...entry,
      },
      ...history,
    ].slice(0, 20); // keep last 20
    localStorage.setItem(IMPORT_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function clearImportHistory() {
  try {
    localStorage.removeItem(IMPORT_HISTORY_KEY);
  } catch {}
}

/**
 * Validates a list of parsed products and returns statistics & warnings
 */
export function validateProductRecords(products = []) {
  const valid = [];
  const warnings = [];
  const seenSkus = new Set();
  const duplicates = [];

  products.forEach((p, index) => {
    const rowNum = index + 1;
    const itemWarnings = [];

    if (!p.name || String(p.name).trim().length < 2) {
      itemWarnings.push("Missing or invalid product name");
    }

    if (p.price === undefined || p.price === null || isNaN(Number(p.price)) || Number(p.price) < 0) {
      itemWarnings.push("Invalid or missing price");
    }

    if (!p.sku) {
      p.sku = `AUTO-${Date.now()}-${rowNum}`;
      itemWarnings.push(`Generated SKU: ${p.sku}`);
    } else {
      if (seenSkus.has(p.sku.toLowerCase())) {
        duplicates.push({ row: rowNum, sku: p.sku, name: p.name });
      } else {
        seenSkus.add(p.sku.toLowerCase());
      }
    }

    if (itemWarnings.length > 0) {
      warnings.push({ row: rowNum, sku: p.sku, name: p.name, issues: itemWarnings });
    }

    valid.push({
      ...p,
      rowNumber: rowNum,
      hasWarnings: itemWarnings.length > 0,
      warningMessages: itemWarnings,
    });
  });

  return {
    totalRecords: products.length,
    validRecords: valid.length - warnings.filter((w) => w.issues.some((i) => i.includes("Missing"))).length,
    warningCount: warnings.length,
    duplicateCount: duplicates.length,
    items: valid,
    warnings,
    duplicates,
  };
}

// ----------------------------------------------------------------------
// 7. UTILS & HELPERS
// ----------------------------------------------------------------------

function normalizeHeaderName(raw) {
  const s = String(raw || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (s === "sku" || s === "id" || s === "code" || s === "productid") return "sku";
  if (s === "name" || s === "productname" || s === "title") return "name";
  if (s === "variety" || s === "varietyname") return "variety";
  if (s === "brandname" || s === "brand") return "brandName";
  if (s === "category" || s === "categories") return "category";
  if (s === "subcategory" || s === "subcategories") return "subcategory";
  if (s === "price" || s === "rate" || s === "sellingprice") return "price";
  if (s === "discountedprice" || s === "saleprice" || s === "discountprice") return "discountedPrice";
  if (s === "mrp" || s === "originalprice") return "mrp";
  if (s === "stock" || s === "quantity" || s === "qty" || s === "availablestock") return "stock";
  if (s === "unit" || s === "stockunit") return "unit";
  if (s === "grade" || s === "qualitygrade") return "grade";
  if (s === "isactive" || s === "active" || s === "status") return "isActive";
  if (s === "farmername" || s === "farmer") return "farmerName";
  if (s === "producetype" || s === "type") return "produceType";
  if (s === "harvestdate" || s === "date") return "harvestDate";
  if (s === "description" || s === "desc") return "description";
  return raw.trim();
}

function normalizeValue(key, val) {
  if (val === undefined || val === null) return "";
  const s = String(val).trim();

  if (key === "price" || key === "discountedPrice" || key === "mrp" || key === "stock") {
    const n = Number(s.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  if (key === "isActive") {
    return s.toLowerCase() === "true" || s === "1" || s.toLowerCase() === "active" || s.toLowerCase() === "yes";
  }

  return s;
}

/**
 * Trigger file download directly in browser
 */
export function triggerDownload(content, filename, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
