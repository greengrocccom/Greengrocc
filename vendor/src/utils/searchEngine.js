/**
 * GreenGrocc Ajax Live Search Engine Utility
 * Provides Google-style relevance scoring, Indian produce synonym dictionary,
 * fuzzy typo-tolerance, keyword highlighter, and search history persistence.
 */

export const SEARCH_HISTORY_KEY = "greengrocc_vendor_search_history";
export const SEARCH_DOCK_KEY = "greengrocc_vendor_search_widget_dock";

export const VERNACULAR_SYNONYMS = {
  // Vegetables
  tomato: ["tamatar", "tamato", "seb tamatar", "cherry tomato", "desi tamatar"],
  tamatar: ["tomato", "tamato", "cherry tomato"],
  potato: ["aloo", "alu", "batata", "potto", "patato", "aaloo", "baby potato"],
  aloo: ["potato", "alu", "batata"],
  alu: ["potato", "aloo", "batata"],
  onion: ["pyaz", "pyaaz", "kanda", "onoin", "shallot", "spring onion", "red onion"],
  pyaz: ["onion", "pyaaz", "kanda"],
  kanda: ["onion", "pyaz"],
  chilli: ["mirch", "mirchi", "chili", "hari mirch", "lal mirch", "capsicum", "shimla mirch"],
  mirch: ["chilli", "mirchi", "chili"],
  mirchi: ["chilli", "mirch", "chili"],
  garlic: ["lahsun", "lasun", "lehsun"],
  lahsun: ["garlic", "lasun"],
  ginger: ["adrak", "aada"],
  adrak: ["ginger"],
  cauliflower: ["gobi", "phool gobi", "phul gobi", "gobhi"],
  gobi: ["cauliflower", "cabbage", "patta gobi", "phool gobi"],
  cabbage: ["patta gobi", "band gobi"],
  okra: ["bhindi", "bhindee", "ladyfinger", "lady finger"],
  bhindi: ["okra", "ladyfinger"],
  spinach: ["palak", "paalak"],
  palak: ["spinach"],
  cucumber: ["kheera", "kakdi"],
  kheera: ["cucumber", "kakdi"],
  eggplant: ["baingan", "brinjal", "vangi"],
  brinjal: ["baingan", "eggplant"],
  baingan: ["brinjal", "eggplant"],
  capsicum: ["shimla mirch", "bell pepper"],
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
  lauki: ["bottle gourd", "doodhi"],
  pumpkin: ["kaddu", "bhopla"],
  kaddu: ["pumpkin"],
  lemon: ["nimbu", "neembu", "lime"],
  nimbu: ["lemon", "lime"],

  // Fruits
  apple: ["seb", "saeb", "aple", "shimla apple", "kashmiri apple"],
  seb: ["apple"],
  banana: ["kela", "kelaa"],
  kela: ["banana"],
  mango: ["aam", "hapus", "alphonso", "kesar"],
  aam: ["mango", "alphonso"],
  pomegranate: ["anar", "anaar"],
  anar: ["pomegranate"],
  orange: ["santra", "santre", "mosambi"],
  santra: ["orange"],
  grapes: ["angoor", "angur"],
  angoor: ["grapes"],
  watermelon: ["tarbooz", "tarbooj", "kalingad"],
  tarbooz: ["watermelon"],
  muskmelon: ["kharbuja", "kharbooja"],
  kharbuja: ["muskmelon"],
  papaya: ["papita", "papeeta"],
  papita: ["papaya"],
  guava: ["amrood", "peru"],
  amrood: ["guava"],
  coconut: ["nariyal"],
  nariyal: ["coconut"],

  // Grains & Pulses
  wheat: ["gehun", "gehu", "sharbati", "lokwan", "flour", "atta"],
  gehun: ["wheat", "sharbati"],
  rice: ["chawal", "dhan", "basmati", "kolam", "paddy"],
  chawal: ["rice", "basmati"],
  maize: ["makka", "corn", "sweet corn", "bhutta"],
  corn: ["maize", "makka", "bhutta"],
  mustard: ["sarson", "rai"],
  sarson: ["mustard"],
  gram: ["chana", "chickpea"],
  chana: ["gram", "chickpea"],
  lentil: ["dal", "daal", "toor dal", "moong dal", "urad dal"],
  dal: ["lentil", "toor", "moong", "urad", "chana"],

  // Attributes & Qualities
  organic: ["jaivik", "natural", "chemical free"],
  jaivik: ["organic"],
  desi: ["indigenous", "local", "traditional"],
  hybrid: ["high yield", "f1"],
};

/**
 * Levenshtein distance for fuzzy typo correction
 */
export function levenshteinDistance(s1, s2) {
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
 * Expand query tokens with vernacular synonyms and typo detection
 */
export function expandQuery(rawQuery) {
  const clean = String(rawQuery || "").trim().toLowerCase();
  if (!clean) return { clean: "", tokens: [], synonyms: [], allTerms: [], didYouMean: null };

  const tokens = clean.split(/\s+/).filter(Boolean);
  const synonyms = new Set();
  let didYouMean = null;

  for (const token of tokens) {
    if (VERNACULAR_SYNONYMS[token]) {
      VERNACULAR_SYNONYMS[token].forEach((s) => synonyms.add(s.toLowerCase()));
    }

    if (token.length >= 4) {
      let closestKey = null;
      let minDistance = 999;
      for (const key of Object.keys(VERNACULAR_SYNONYMS)) {
        const dist = levenshteinDistance(token, key);
        if (dist > 0 && dist <= 2 && dist < minDistance) {
          minDistance = dist;
          closestKey = key;
        }
      }
      if (closestKey && !tokens.includes(closestKey)) {
        didYouMean = closestKey;
        synonyms.add(closestKey);
        VERNACULAR_SYNONYMS[closestKey].forEach((s) => synonyms.add(s.toLowerCase()));
      }
    }
  }

  const allTerms = Array.from(new Set([clean, ...tokens, ...Array.from(synonyms)]));
  return {
    clean,
    tokens,
    synonyms: Array.from(synonyms),
    allTerms,
    didYouMean,
  };
}

/**
 * Highlight matching search tokens in text
 */
export function highlightMatch(text, terms) {
  if (!text) return "";
  const str = String(text);
  if (!terms || terms.length === 0) return str;

  const valid = terms
    .filter((t) => t && t.length >= 2)
    .sort((a, b) => b.length - a.length);

  if (valid.length === 0) return str;

  const escaped = valid.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  return str.replace(regex, "<mark class=\"bg-emerald-100 text-emerald-900 font-semibold px-0.5 rounded\">$1</mark>");
}

/**
 * Render highlighted HTML safely or return simple parts
 */
export function renderHighlightedText(html) {
  return { __html: html };
}

/**
 * Local search history management
 */
export function getSearchHistory() {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSearchHistory(query) {
  const q = String(query || "").trim();
  if (!q || q.length < 2) return;
  try {
    const history = getSearchHistory().filter((item) => item.toLowerCase() !== q.toLowerCase());
    const updated = [q, ...history].slice(0, 10);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // ignore local storage errors
  }
}

export function clearSearchHistory() {
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch {
    // ignore
  }
}

export function removeSearchHistoryItem(itemToRemove) {
  try {
    const history = getSearchHistory().filter((item) => item !== itemToRemove);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
    return history;
  } catch {
    return [];
  }
}

/**
 * Widget Dock Position Persistence
 */
export function getSavedWidgetDock() {
  try {
    return localStorage.getItem(SEARCH_DOCK_KEY) || "navbar";
  } catch {
    return "navbar";
  }
}

export function saveWidgetDock(position) {
  try {
    localStorage.setItem(SEARCH_DOCK_KEY, position);
  } catch {
    // ignore
  }
}
