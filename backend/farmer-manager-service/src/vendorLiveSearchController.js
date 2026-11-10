import mongoose from "mongoose";
import { Farmer, FarmerProduct, FarmerCrop } from "./models.js";
import Product from "../../legacy/models/Product.js";

/**
 * Extensive Indian Agricultural & Produce Synonym Dictionary
 * Maps vernacular (Hindi/Hinglish/Marathi/Tamil/Telugu/Gujarati/Bengali), colloquial,
 * and common aliases to canonical English & produce keywords.
 */
const SYNONYM_MAP = {
  // Solanaceous & Vegetables
  tomato: ["tamatar", "tamato", "tomatoe", "tometo", "seb tamatar", "cherry tomato", "desi tamatar"],
  tamatar: ["tomato", "tamato", "cherry tomato"],
  potato: ["aloo", "alu", "batata", "potto", "patato", "potahto", "aaloo", "baby potato"],
  aloo: ["potato", "alu", "batata"],
  alu: ["potato", "aloo", "batata"],
  onion: ["pyaz", "pyaaz", "kanda", "onoin", "oniyon", "shallot", "spring onion", "red onion"],
  pyaz: ["onion", "pyaaz", "kanda"],
  kanda: ["onion", "pyaz"],
  chilli: ["mirch", "mirchi", "chili", "hari mirch", "lal mirch", "capsicum", "shimla mirch"],
  mirch: ["chilli", "mirchi", "chili"],
  mirchi: ["chilli", "mirch", "chili"],
  garlic: ["lahsun", "lasun", "lehsun", "garlick"],
  lahsun: ["garlic", "lasun"],
  ginger: ["adrak", "aada", "gingar"],
  adrak: ["ginger"],
  cauliflower: ["gobi", "phool gobi", "phul gobi", "gobhi"],
  gobi: ["cauliflower", "cabbage", "patta gobi", "phool gobi"],
  cabbage: ["patta gobi", "band gobi", "kobi"],
  okra: ["bhindi", "bhindee", "ladyfinger", "lady finger"],
  bhindi: ["okra", "ladyfinger"],
  spinach: ["palak", "paalak"],
  palak: ["spinach"],
  cucumber: ["kheera", "kakdi", "kakri"],
  kheera: ["cucumber", "kakdi"],
  eggplant: ["baingan", "brinjal", "vangi", "aubergine"],
  brinjal: ["baingan", "eggplant"],
  baingan: ["brinjal", "eggplant"],
  capsicum: ["shimla mirch", "bell pepper", "capsicm"],
  peas: ["matar", "muttar", "green peas"],
  matar: ["peas", "green peas"],
  carrot: ["gajar", "gaajar"],
  gajar: ["carrot"],
  radish: ["mooli", "muli"],
  mooli: ["radish"],
  fenugreek: ["methi"],
  methi: ["fenugreek"],
  coriander: ["dhaniya", "kothmir", "cilantro"],
  dhaniya: ["coriander"],
  mint: ["pudina"],
  pudina: ["mint"],
  bittergourd: ["karela", "bitter gourd"],
  karela: ["bitter gourd", "bittergourd"],
  bottlegourd: ["lauki", "doodhi", "ghiya", "bottle gourd"],
  lauki: ["bottle gourd", "bottlegourd", "doodhi"],
  pumpkin: ["kaddu", "bhopla"],
  kaddu: ["pumpkin"],
  lemon: ["nimbu", "neembu", "lime"],
  nimbu: ["lemon", "lime"],

  // Fruits
  apple: ["seb", "saeb", "aple", "shimla apple", "kashmiri apple", "kinnaur apple"],
  seb: ["apple"],
  banana: ["kela", "kelaa", "bananaa"],
  kela: ["banana"],
  mango: ["aam", "hapus", "alphonso", "kesar", "chaunsa", "dasheri"],
  aam: ["mango", "alphonso"],
  pomegranate: ["anar", "anaar"],
  anar: ["pomegranate"],
  orange: ["santra", "santre", "mosambi", "sweet lime"],
  santra: ["orange"],
  grapes: ["angoor", "angur", "grape"],
  angoor: ["grapes"],
  watermelon: ["tarbooj", "tarbooz", "kalingad"],
  tarbooz: ["watermelon"],
  muskmelon: ["kharbuja", "kharbooja", "cantaloupe"],
  kharbuja: ["muskmelon"],
  papaya: ["papita", "papeeta"],
  papita: ["papaya"],
  guava: ["amrood", "peru"],
  amrood: ["guava", "peru"],
  coconut: ["nariyal", "naariyal"],
  nariyal: ["coconut"],

  // Grains & Pulses
  wheat: ["gehun", "gehu", "sharbati", "lokwan", "atta", "flour"],
  gehun: ["wheat", "sharbati"],
  rice: ["chawal", "dhan", "basmati", "kolam", "sona masoori", "paddy"],
  chawal: ["rice", "basmati"],
  maize: ["makka", "corn", "sweet corn", "bhutta"],
  corn: ["maize", "makka", "bhutta", "sweet corn"],
  mustard: ["sarson", "rai"],
  sarson: ["mustard"],
  soybean: ["soya", "soyabean"],
  gram: ["chana", "chickpea", "kabuli chana", "kala chana"],
  chana: ["gram", "chickpea"],
  lentil: ["dal", "daal", "toor dal", "moong dal", "urad dal"],
  dal: ["lentil", "toor", "moong", "urad", "chana"],

  // Farming & Status Categories
  organic: ["jaivik", "natural", "desi", "chemical free"],
  jaivik: ["organic"],
  desi: ["indigenous", "local", "traditional"],
  hybrid: ["high yield", "f1"],
  grade: ["a grade", "b grade", "c grade", "quality"],
};

/**
 * Fast Levenshtein distance calculation for typo tolerance
 */
function levenshteinDistance(s1, s2) {
  if (s1 === s2) return 0;
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;

  const a = s1.toLowerCase();
  const b = s2.toLowerCase();
  const v0 = new Array(b.length + 1);
  const v1 = new Array(b.length + 1);

  for (let i = 0; i <= b.length; i++) v0[i] = i;

  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }
  return v1[b.length];
}

/**
 * Expand query tokens into synonyms, aliases, and variations
 */
function expandSearchTerms(rawQuery) {
  const clean = String(rawQuery || "").trim().toLowerCase();
  if (!clean) return { tokens: [], synonyms: [], allTerms: [], correctedSuggestion: null };

  const tokens = clean.split(/\s+/).filter(Boolean);
  const synonyms = new Set();
  let correctedSuggestion = null;

  for (const token of tokens) {
    // Direct synonym lookup
    if (SYNONYM_MAP[token]) {
      SYNONYM_MAP[token].forEach((syn) => synonyms.add(syn.toLowerCase()));
    } else if (token.length >= 4) {
      // Fuzzy synonym match if token >= 4 characters and not directly recognized
      let closestKey = null;
      let minDistance = 999;
      for (const key of Object.keys(SYNONYM_MAP)) {
        const dist = levenshteinDistance(token, key);
        if (dist > 0 && dist <= 2 && dist < minDistance) {
          minDistance = dist;
          closestKey = key;
        }
      }
      if (closestKey && !tokens.includes(closestKey)) {
        correctedSuggestion = closestKey;
        synonyms.add(closestKey);
        SYNONYM_MAP[closestKey]?.forEach((syn) => synonyms.add(syn.toLowerCase()));
      }
    }
  }

  const allTerms = Array.from(new Set([clean, ...tokens, ...Array.from(synonyms)]));
  return {
    clean,
    tokens,
    synonyms: Array.from(synonyms),
    allTerms,
    correctedSuggestion,
  };
}

/**
 * Google-style relevance scoring function
 */
function scoreMatch(candidateText, cleanQuery, tokens, synonyms) {
  if (!candidateText) return 0;
  const target = String(candidateText).toLowerCase();
  let score = 0;

  // Exact full query match
  if (target === cleanQuery) return 100;

  // Target starts with query
  if (target.startsWith(cleanQuery)) {
    score = Math.max(score, 85);
  } else if (target.includes(cleanQuery)) {
    score = Math.max(score, 70);
  }

  // Token matches
  let matchedTokens = 0;
  for (const token of tokens) {
    if (token.length < 2) continue;
    if (target.includes(token)) {
      matchedTokens++;
    } else {
      // Fuzzy word match
      const words = target.split(/\s+/);
      for (const w of words) {
        if (w.length >= 3 && Math.abs(w.length - token.length) <= 2) {
          const dist = levenshteinDistance(token, w);
          if (dist <= 1) {
            matchedTokens += 0.8;
            break;
          } else if (dist <= 2 && token.length >= 5) {
            matchedTokens += 0.5;
            break;
          }
        }
      }
    }
  }

  if (tokens.length > 0) {
    const tokenRatio = matchedTokens / tokens.length;
    score = Math.max(score, Math.round(tokenRatio * 65));
  }

  // Synonym matches
  for (const syn of synonyms) {
    if (target.includes(syn)) {
      score = Math.max(score, 60);
      break;
    }
  }

  return score;
}

/**
 * Helper to highlight matching terms in text with <mark> tags
 */
function highlightText(text, searchTerms) {
  if (!text) return "";
  const str = String(text);
  if (!searchTerms || searchTerms.length === 0) return str;

  // Sort terms by length descending to match longest first
  const validTerms = searchTerms
    .filter((t) => t && t.length >= 2)
    .sort((a, b) => b.length - a.length);

  if (validTerms.length === 0) return str;

  const escaped = validTerms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  return str.replace(regex, "<mark>$1</mark>");
}

/**
 * Main Live Search Handler
 * Supports:
 * - Products (Farmer harvest products + Catalog products)
 * - Farmers (Farmer profiles, locations, farm names, phone)
 * - Crops (Farmer crops & active plantings)
 * - Did-you-mean suggestions
 * - Typo tolerance & phonetic synonyms
 */
export async function handleVendorLiveSearch(req, res) {
  const startTime = Date.now();
  try {
    const query = String(req.query.q || "").trim();
    const scope = String(req.query.scope || "all").toLowerCase(); // 'all' | 'products' | 'farmers' | 'crops'
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const farmerIdFilter = String(req.query.farmerId || "").trim();
    const vendorId = req.user?.vendorId || req.user?.id || "";

    if (!query) {
      // Return quick suggested/trending data if query is empty
      const [popularProducts, recentFarmers] = await Promise.all([
        FarmerProduct.find({ status: { $ne: "Rejected" } })
          .select("id productId name cropName variety category sellingPrice pricePerKg mrp stock image unit farmerName farmerId status")
          .sort({ updatedAt: -1 })
          .limit(6)
          .lean()
          .catch(() => []),
        Farmer.find({ isDeleted: { $ne: true } })
          .select("id farmerId name farmName mobile address farmArea status profileImage")
          .sort({ createdAt: -1 })
          .limit(4)
          .lean()
          .catch(() => []),
      ]);

      return res.json({
        query: "",
        didYouMean: null,
        total: (popularProducts.length || 0) + (recentFarmers.length || 0),
        metrics: { executionMs: Date.now() - startTime },
        trendingQueries: ["Tomato", "Potato", "Shimla Apple", "Desi Onion", "Wheat Sharbati", "Fresh Palak", "Grade A Organic"],
        results: {
          products: popularProducts.map((p) => ({
            id: p.id || p._id,
            productId: p.productId || p.id,
            name: p.name || p.cropName || "Produce",
            highlightedName: p.name || p.cropName || "Produce",
            variety: p.variety || "",
            cropName: p.cropName || "",
            category: p.category || "Vegetables",
            price: Number(p.sellingPrice || p.pricePerKg || 0),
            discountedPrice: Number(p.sellingPrice || p.pricePerKg || 0),
            mrp: Number(p.mrp || p.sellingPrice || 0),
            unit: p.unit || "Kg",
            stock: Number(p.stock || 0),
            inStock: Number(p.stock || 0) > 0,
            image: p.image || "",
            farmerId: p.farmerId || "",
            farmerName: p.farmerName || "Farmer",
            status: p.status || "Approved",
            source: "farmer-product",
            score: 50,
          })),
          farmers: recentFarmers.map((f) => ({
            id: f.id || f.farmerId || f._id,
            farmerId: f.farmerId || f.id,
            name: f.name || "Farmer",
            highlightedName: f.name || "Farmer",
            farmName: f.farmName || "",
            mobile: f.mobile || "",
            location: [f.address?.village, f.address?.district, f.address?.state].filter(Boolean).join(", ") || "India",
            farmArea: f.farmArea || "",
            status: f.status || "Active",
            profileImage: f.profileImage || "",
            score: 50,
          })),
          crops: [],
          suggestions: ["Fresh Tomato", "Organic Potato", "Red Onion", "Green Chilli", "Kashmiri Apple"],
        },
      });
    }

    const { clean, tokens, synonyms, allTerms, correctedSuggestion } = expandSearchTerms(query);

    // Build regex patterns for MongoDB
    const regexTerms = allTerms.map((t) => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    const primaryRegex = new RegExp(clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    const tasks = [];

    // Task 1: Farmer Products Search
    if (scope === "all" || scope === "products") {
      const pFilter = {
        $or: [
          { name: { $in: regexTerms } },
          { cropName: { $in: regexTerms } },
          { variety: { $in: regexTerms } },
          { category: { $in: regexTerms } },
          { description: { $in: regexTerms } },
          { sku: primaryRegex },
          { productId: primaryRegex },
          { farmerName: primaryRegex },
        ],
      };
      if (farmerIdFilter) pFilter.farmerId = farmerIdFilter;

      tasks.push(
        FarmerProduct.find(pFilter)
          .select("id productId name cropName variety category description sellingPrice pricePerKg mrp stock image unit farmerName farmerId status sku")
          .limit(limit * 2)
          .lean()
          .catch(() => [])
      );
    } else {
      tasks.push(Promise.resolve([]));
    }

    // Task 2: Farmers Search
    if (scope === "all" || scope === "farmers") {
      const fFilter = {
        isDeleted: { $ne: true },
        $or: [
          { name: { $in: regexTerms } },
          { farmName: { $in: regexTerms } },
          { mobile: primaryRegex },
          { id: primaryRegex },
          { farmerId: primaryRegex },
          { "address.village": { $in: regexTerms } },
          { "address.district": { $in: regexTerms } },
          { "address.state": { $in: regexTerms } },
        ],
      };
      if (vendorId) {
        // Scoped to vendor if vendor-specific farmer
        // but still allow global matching if vendorId matches
      }

      tasks.push(
        Farmer.find(fFilter)
          .select("id farmerId name farmName mobile address farmArea status profileImage")
          .limit(limit * 2)
          .lean()
          .catch(() => [])
      );
    } else {
      tasks.push(Promise.resolve([]));
    }

    // Task 3: Farmer Crops Search
    if (scope === "all" || scope === "crops") {
      const cFilter = {
        $or: [
          { cropName: { $in: regexTerms } },
          { variety: { $in: regexTerms } },
          { cropCategory: { $in: regexTerms } },
          { cropId: primaryRegex },
          { farmerName: primaryRegex },
        ],
      };
      if (farmerIdFilter) cFilter.farmerId = farmerIdFilter;

      tasks.push(
        FarmerCrop.find(cFilter)
          .select("id cropId cropName variety cropCategory status sowingDate expectedHarvestDate farmerName farmerId")
          .limit(limit * 2)
          .lean()
          .catch(() => [])
      );
    } else {
      tasks.push(Promise.resolve([]));
    }

    // Task 4: Catalog Products Search (if scope allows products)
    if (scope === "all" || scope === "products") {
      tasks.push(
        Product.find({
          isActive: true,
          $or: [
            { name: { $in: regexTerms } },
            { brandName: { $in: regexTerms } },
            { categories: { $in: regexTerms } },
            { subcategory: { $in: regexTerms } },
            { sku: primaryRegex },
          ],
        })
          .select("_id productId name brandName categories subcategory price discountedPrice productImages inStock stock description")
          .limit(limit)
          .lean()
          .catch(() => [])
      );
    } else {
      tasks.push(Promise.resolve([]));
    }

    const [farmerProducts, farmers, crops, catalogProducts] = await Promise.all(tasks);

    // Score and rank Farmer Products
    const scoredFarmerProducts = farmerProducts.map((p) => {
      const nameScore = scoreMatch(p.name || p.cropName, clean, tokens, synonyms);
      const varietyScore = scoreMatch(p.variety, clean, tokens, synonyms);
      const catScore = scoreMatch(p.category, clean, tokens, synonyms);
      const farmerScore = scoreMatch(p.farmerName, clean, tokens, synonyms);
      const idScore = p.productId?.toLowerCase() === clean || p.sku?.toLowerCase() === clean ? 100 : 0;

      const totalScore = Math.max(nameScore, varietyScore * 0.85, catScore * 0.7, farmerScore * 0.6, idScore);

      return {
        id: p.id || p._id,
        productId: p.productId || p.id,
        name: p.name || p.cropName || "Produce",
        highlightedName: highlightText(p.name || p.cropName || "", allTerms),
        variety: p.variety || "",
        cropName: p.cropName || "",
        category: p.category || "Vegetables",
        price: Number(p.sellingPrice || p.pricePerKg || 0),
        discountedPrice: Number(p.sellingPrice || p.pricePerKg || 0),
        mrp: Number(p.mrp || p.sellingPrice || 0),
        unit: p.unit || "Kg",
        stock: Number(p.stock || 0),
        inStock: Number(p.stock || 0) > 0,
        image: p.image || "",
        farmerId: p.farmerId || "",
        farmerName: p.farmerName || "Farmer",
        status: p.status || "Approved",
        source: "farmer-product",
        score: Math.round(totalScore),
      };
    });

    // Score and rank Catalog Products
    const scoredCatalogProducts = catalogProducts.map((cp) => {
      const nameScore = scoreMatch(cp.name, clean, tokens, synonyms);
      const catScore = scoreMatch(Array.isArray(cp.categories) ? cp.categories.join(" ") : cp.categories, clean, tokens, synonyms);
      const totalScore = Math.max(nameScore, catScore * 0.75);

      return {
        id: cp._id,
        productId: cp.productId || String(cp._id),
        name: cp.name || "Product",
        highlightedName: highlightText(cp.name || "", allTerms),
        variety: "",
        cropName: cp.name || "",
        category: Array.isArray(cp.categories) && cp.categories[0] ? cp.categories[0] : "General",
        price: Number(cp.price || 0),
        discountedPrice: Number(cp.discountedPrice || cp.price || 0),
        mrp: Number(cp.price || 0),
        unit: "pc",
        stock: Number(cp.stock || 1),
        inStock: Boolean(cp.inStock !== false),
        image: Array.isArray(cp.productImages) && cp.productImages[0] ? cp.productImages[0] : "",
        farmerId: "",
        farmerName: cp.brandName || "GreenGrocc Direct",
        status: "Active",
        source: "catalog",
        score: Math.round(totalScore),
      };
    });

    // Merge and sort all products
    // Merge and sort all products
    const allProducts = [...scoredFarmerProducts, ...scoredCatalogProducts]
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Score and rank Farmers
    const scoredFarmers = farmers.map((f) => {
      const nameScore = scoreMatch(f.name, clean, tokens, synonyms);
      const farmScore = scoreMatch(f.farmName, clean, tokens, synonyms);
      const locText = [f.address?.village, f.address?.district, f.address?.state].filter(Boolean).join(" ");
      const locScore = scoreMatch(locText, clean, tokens, synonyms);
      const phoneScore = f.mobile?.includes(clean) ? 90 : 0;
      const idScore = f.id === clean || f.farmerId === clean ? 100 : 0;

      const totalScore = Math.max(nameScore, farmScore * 0.85, locScore * 0.7, phoneScore, idScore);

      return {
        id: f.id || f.farmerId || f._id,
        farmerId: f.farmerId || f.id,
        name: f.name || "Farmer",
        highlightedName: highlightText(f.name || "", allTerms),
        farmName: f.farmName || "",
        highlightedFarm: highlightText(f.farmName || "", allTerms),
        mobile: f.mobile || "",
        location: [f.address?.village, f.address?.district, f.address?.state].filter(Boolean).join(", ") || "India",
        farmArea: f.farmArea || "",
        status: f.status || "Active",
        profileImage: f.profileImage || "",
        score: Math.round(totalScore),
      };
    })
      .filter((f) => f.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Score and rank Crops
    const scoredCrops = crops.map((c) => {
      const cropScore = scoreMatch(c.cropName, clean, tokens, synonyms);
      const varScore = scoreMatch(c.variety, clean, tokens, synonyms);
      const totalScore = Math.max(cropScore, varScore * 0.85);

      return {
        id: c.id || c.cropId || c._id,
        cropId: c.cropId || c.id,
        cropName: c.cropName || "Crop",
        highlightedCrop: highlightText(c.cropName || "", allTerms),
        variety: c.variety || "",
        cropCategory: c.cropCategory || "General",
        farmerName: c.farmerName || "Farmer",
        farmerId: c.farmerId || "",
        status: c.status || "Planned",
        sowingDate: c.sowingDate || "",
        expectedHarvestDate: c.expectedHarvestDate || "",
        score: Math.round(totalScore),
      };
    })
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Generate smart suggestions / did you mean
    const suggestionsSet = new Set();
    if (correctedSuggestion) {
      suggestionsSet.add(correctedSuggestion);
    }
    synonyms.slice(0, 4).forEach((syn) => suggestionsSet.add(syn));

    allProducts.slice(0, 4).forEach((p) => {
      if (p.name) suggestionsSet.add(p.name);
    });

    const totalResults = allProducts.length + scoredFarmers.length + scoredCrops.length;

    res.json({
      query: clean,
      didYouMean: correctedSuggestion || (totalResults === 0 && synonyms[0] ? synonyms[0] : null),
      total: totalResults,
      metrics: { executionMs: Date.now() - startTime },
      results: {
        products: allProducts,
        farmers: scoredFarmers,
        crops: scoredCrops,
        suggestions: Array.from(suggestionsSet).slice(0, 6),
      },
    });
  } catch (err) {
    console.error("[Vendor Live Search] Error:", err);
    res.status(500).json({
      message: err.message || "Failed to execute live search",
      results: { products: [], farmers: [], crops: [], suggestions: [] },
    });
  }
}
