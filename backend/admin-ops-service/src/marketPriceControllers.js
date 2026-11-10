import { MarketPrice } from "./models.js";
import { getIO } from "../../shared/socket.js";
import { createMemoryCache } from "../../shared/cache/memoryCache.js";

const livePricesCache = createMemoryCache({
  name: "market-prices-live",
  ttlMs: 2 * 60_000,
  collections: [MarketPrice.collection.collectionName],
  maxEntries: 50,
});

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getIsoDateOffset(daysOffset = 0) {
  const d = new Date(Date.now() + IST_OFFSET_MS);
  d.setUTCDate(d.getUTCDate() + daysOffset);
  return d.toISOString().slice(0, 10);
}

function safeEmit(fn) {
  try {
    const io = getIO();
    if (io) fn(io);
  } catch (_) {}
}

const LEGACY_SEED_ROWS = [
  ["GreenGrocc Direct Center", "Tomato", "Hybrid Super Grade", "Direct farmgate purchase. 0% middleman commission, 24h instant payout."],
  ["GreenGrocc Direct Center", "Onion", "Garwa / Export", "Direct farm procurement with doorstep pickup."],
  ["GreenGrocc Direct Center", "Potato", "Jyoti Premium", "Direct procurement center at Manchar Hub."],
  ["Pune APMC", "Tomato", "Hybrid No.1", "Good quality arrivals from Narayangaon & Junnar."],
  ["Mumbai Vashi APMC", "Tomato", "Desi Special", "High retail demand in MMR region."],
  ["Nashik APMC", "Onion", "Lal Kaanda", "Major trading volume today."],
  ["Pune APMC", "Onion", "Garwa / Unhali", "Steady supply from Khed and Shirur talukas."],
  ["Solapur APMC", "Onion", "Regular Lal", "Higher arrivals caused mild price easing."],
  ["Mumbai Vashi APMC", "Potato", "Jyoti Grade-A", "Strong demand from central Mumbai distributors."],
  ["Pune APMC", "Potato", "Jyoti / Local", "Fresh arrivals from Manchar cold stores."],
  ["Kolhapur APMC", "Green Chilli", "G4 Green", "Strong demand from local processing units."],
  ["Solapur APMC", "Pomegranate", "Bhagwa Super", "Export grade arrivals fetch higher rates."],
  ["Sangli APMC", "Turmeric", "Rajapore Salem", "Steady auctions in spice yard."],
];

let legacyPurgePromise = null;

/** Removes the demo rows the old auto-seeder wrote. Rows entered by admin are untouched. */
export function purgeLegacySeedMarketPrices() {
  if (!legacyPurgePromise) {
    legacyPurgePromise = MarketPrice.deleteMany({
      $or: LEGACY_SEED_ROWS.map(([marketName, productName, variety, notes]) => ({
        marketName,
        productName,
        variety,
        notes,
      })),
    })
      .then((result) => {
        if (result?.deletedCount) {
          livePricesCache.invalidate();
          console.log(`[MarketPrice] Removed ${result.deletedCount} legacy demo price rows.`);
          safeEmit((io) => io.emit("market_prices_changed", { action: "purge" }));
        }
      })
      .catch((err) => {
        legacyPurgePromise = null;
        console.warn("[MarketPrice] Legacy demo cleanup failed:", err.message);
      });
  }
  return legacyPurgePromise;
}

function parsePrice(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

export async function listMarketPrices(req, res, next) {
  try {
    await purgeLegacySeedMarketPrices();
    const filter = {};
    if (req.query.status && req.query.status !== "all") {
      filter.isActive = req.query.status === "active";
    }
    if (req.query.marketName && req.query.marketName !== "all") {
      filter.marketName = String(req.query.marketName);
    }
    if (req.query.productName && req.query.productName !== "all") {
      filter.productName = String(req.query.productName);
    }
    
    // Date Filters
    const queryDate = req.query.priceDate || req.query.date;
    if (queryDate && queryDate !== "all") {
      filter.priceDate = String(queryDate).slice(0, 10);
    } else if (req.query.startDate && req.query.endDate) {
      filter.priceDate = {
        $gte: String(req.query.startDate).slice(0, 10),
        $lte: String(req.query.endDate).slice(0, 10),
      };
    }

    const rows = await MarketPrice.find(filter).sort({ priceDate: -1, updatedAt: -1 }).lean();

    const allRecords = await MarketPrice.find().lean();
    const uniqueMarkets = new Set(allRecords.map((r) => r.marketName).filter(Boolean));
    const uniqueProducts = new Set(allRecords.map((r) => r.productName).filter(Boolean));
    const uniqueDates = new Set(allRecords.map((r) => r.priceDate).filter(Boolean));
    const todayStr = getIsoDateOffset(0);
    const todayCount = allRecords.filter((r) => r.priceDate === todayStr).length;

    res.json({
      success: true,
      data: rows,
      stats: {
        total: allRecords.length,
        active: allRecords.filter((r) => r.isActive).length,
        totalMarkets: uniqueMarkets.size,
        totalProducts: uniqueProducts.size,
        totalDates: uniqueDates.size,
        todayUpdates: todayCount,
      },
      filters: {
        markets: Array.from(uniqueMarkets).sort(),
        products: Array.from(uniqueProducts).sort(),
        dates: Array.from(uniqueDates).sort().reverse(),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function listLiveMarketPrices(req, res, next) {
  try {
    await purgeLegacySeedMarketPrices();
    const filter = { isActive: true };
    if (req.query.marketName && req.query.marketName !== "all") {
      filter.marketName = String(req.query.marketName);
    }
    if (req.query.productName && req.query.productName !== "all") {
      filter.productName = String(req.query.productName);
    }

    // Date filters for live prices
    const queryDate = req.query.priceDate || req.query.date;
    if (queryDate && queryDate !== "all") {
      filter.priceDate = String(queryDate).slice(0, 10);
    } else if (req.query.startDate && req.query.endDate) {
      filter.priceDate = {
        $gte: String(req.query.startDate).slice(0, 10),
        $lte: String(req.query.endDate).slice(0, 10),
      };
    }

    const payload = await livePricesCache.get(`market-prices:live:${JSON.stringify(filter)}`, async () => {
      const rows = await MarketPrice.find(filter)
        .sort({ priceDate: -1, updatedAt: -1 })
        .limit(500)
        .lean();
      return { success: true, data: rows };
    });
    res.json(payload);
  } catch (err) {
    next(err);
  }
}

export async function getMarketPrice(req, res, next) {
  try {
    const row = await MarketPrice.findById(req.params.id).lean();
    if (!row) return res.status(404).json({ success: false, message: "Market price not found" });
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

export async function createMarketPrice(req, res, next) {
  try {
    const {
      marketName,
      productName,
      variety,
      price,
      minPrice,
      maxPrice,
      unit,
      priceDate,
      district,
      state,
      trend,
      arrivalQuantity,
      arrivalUnit,
      notes,
      isActive,
      isGreenGroo,
    } = req.body;

    if (!marketName || !String(marketName).trim()) {
      return res.status(400).json({ success: false, message: "Market Name is required" });
    }
    if (!productName || !String(productName).trim()) {
      return res.status(400).json({ success: false, message: "Product is required" });
    }
    if (!variety || !String(variety).trim()) {
      return res.status(400).json({ success: false, message: "Variety is required" });
    }
    const numPrice = parsePrice(price);
    if (numPrice === null || Number.isNaN(numPrice)) {
      return res.status(400).json({ success: false, message: "Valid Price is required" });
    }
    const parsedMin = parsePrice(minPrice);
    const parsedMax = parsePrice(maxPrice);
    if (Number.isNaN(parsedMin) || Number.isNaN(parsedMax)) {
      return res.status(400).json({ success: false, message: "Min and Max price must be valid numbers" });
    }
    const numMin = parsedMin ?? numPrice;
    const numMax = parsedMax ?? numPrice;
    if (numMin > numMax) {
      return res.status(400).json({ success: false, message: "Min price cannot be more than Max price" });
    }
    const isGg =
      Boolean(isGreenGroo) ||
      String(marketName).toLowerCase().includes("greengro") ||
      String(marketName).includes("ग्रीनग्र");

    const row = await MarketPrice.create({
      marketName: String(marketName).trim(),
      productName: String(productName).trim(),
      variety: String(variety).trim(),
      price: numPrice,
      minPrice: numMin,
      maxPrice: numMax,
      unit: unit ? String(unit).trim() : "Quintal",
      priceDate: priceDate ? String(priceDate).slice(0, 10) : getIsoDateOffset(0),
      district: district ? String(district).trim() : "Pune",
      state: state ? String(state).trim() : "Maharashtra",
      trend: ["up", "stable", "down"].includes(trend) ? trend : "stable",
      arrivalQuantity: arrivalQuantity ? Number(arrivalQuantity) : 0,
      arrivalUnit: arrivalUnit ? String(arrivalUnit).trim() : "Quintal",
      notes: notes ? String(notes).trim() : "",
      isActive: isActive !== false,
      isGreenGroo: isGg,
    });

    livePricesCache.invalidate();
    safeEmit((io) => {
      io.emit("market_price_updated", row);
      io.emit("market_prices_changed", { action: "create", id: row._id });
    });

    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

export async function updateMarketPrice(req, res, next) {
  try {
    const row = await MarketPrice.findById(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: "Market price not found" });

    const {
      marketName,
      productName,
      variety,
      price,
      minPrice,
      maxPrice,
      unit,
      priceDate,
      district,
      state,
      trend,
      arrivalQuantity,
      arrivalUnit,
      notes,
      isActive,
      isGreenGroo,
    } = req.body;

    if (marketName !== undefined) {
      row.marketName = String(marketName).trim();
      if (
        String(marketName).toLowerCase().includes("greengro") ||
        String(marketName).includes("ग्रीनग्र")
      ) {
        row.isGreenGroo = true;
      }
    }
    if (isGreenGroo !== undefined) row.isGreenGroo = Boolean(isGreenGroo);
    if (productName !== undefined) row.productName = String(productName).trim();
    if (variety !== undefined) row.variety = String(variety).trim();
    const nextPrice = parsePrice(price);
    const nextMin = parsePrice(minPrice);
    const nextMax = parsePrice(maxPrice);
    if (Number.isNaN(nextPrice) || Number.isNaN(nextMin) || Number.isNaN(nextMax)) {
      return res.status(400).json({ success: false, message: "Prices must be valid numbers" });
    }
    if (nextPrice !== null) row.price = nextPrice;
    if (nextMin !== null) row.minPrice = nextMin;
    if (nextMax !== null) row.maxPrice = nextMax;
    if (Number(row.minPrice) > Number(row.maxPrice)) {
      return res.status(400).json({ success: false, message: "Min price cannot be more than Max price" });
    }
    if (unit !== undefined) row.unit = String(unit).trim();
    if (priceDate !== undefined) row.priceDate = String(priceDate).slice(0, 10);
    if (district !== undefined) row.district = String(district).trim();
    if (state !== undefined) row.state = String(state).trim();
    if (trend !== undefined && ["up", "stable", "down"].includes(trend)) row.trend = trend;
    if (arrivalQuantity !== undefined) row.arrivalQuantity = Number(arrivalQuantity) || 0;
    if (arrivalUnit !== undefined) row.arrivalUnit = String(arrivalUnit).trim();
    if (notes !== undefined) row.notes = String(notes).trim();
    if (isActive !== undefined) row.isActive = Boolean(isActive);

    await row.save();

    livePricesCache.invalidate();
    safeEmit((io) => {
      io.emit("market_price_updated", row);
      io.emit("market_prices_changed", { action: "update", id: row._id });
    });

    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

export async function deleteMarketPrice(req, res, next) {
  try {
    const row = await MarketPrice.findByIdAndDelete(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: "Market price not found" });

    livePricesCache.invalidate();
    safeEmit((io) => {
      io.emit("market_price_deleted", { id: req.params.id });
      io.emit("market_prices_changed", { action: "delete", id: req.params.id });
    });

    res.json({ success: true, message: "Market price removed successfully" });
  } catch (err) {
    next(err);
  }
}
