import { useEffect, useRef, useState } from "react";
import { Clock, History, Percent, ArrowUp, ArrowDown, Scale, Tag, MapPin, PackageCheck, SlidersHorizontal, X } from "lucide-react";
import { useBrandsQuery } from "../../hooks/queries/useBrandsQuery";
import { useProductFilters } from "../../hooks/useProductFilters";
import { useLocation } from "../../context/LocationContext";
import { PRODUCT_SORT_OPTIONS } from "../../utils/productFilters";

export const DEFAULT_PRODUCT_SORT = "newest";
export { PRODUCT_SORT_OPTIONS } from "../../utils/productFilters";
const DISCOUNTS = [10, 20, 30, 40, 50];
const INPUT = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#0c831f]";

function FilterDialog({ title, onClose, children }) {
  const dialog = useRef(null);
  useEffect(() => { dialog.current.showModal(); }, []);
  return (
    <dialog ref={dialog} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }} className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-white p-5 text-slate-800 shadow-2xl backdrop:bg-black/40 sm:inset-0 sm:m-auto sm:max-w-md sm:rounded-3xl">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-bold">{title}</h2><button type="button" onClick={onClose} aria-label="Close filters" className="rounded-full p-2 hover:bg-slate-100"><X size={18} /></button></div>
      {children}
    </dialog>
  );
}

export function ProductFiltersBar({ products = [], showBrand = true, showSort = true, className = "" }) {
  const filters = useProductFilters(products);
  const { location, openLocationModal } = useLocation();
  const { data: brands = [] } = useBrandsQuery();
  const [panel, setPanel] = useState(null);
  const [draft, setDraft] = useState({});
  const [brandSearch, setBrandSearch] = useState("");
  const [error, setError] = useState("");
  const brandNames = [...new Set([...brands.map(brand => brand.brandName), ...products.map(product => product.brandName), filters.selectedBrand].filter(Boolean))].sort();
  const sizes = [...new Set([...filters.weightsSizes, filters.weightSize].filter(Boolean))];
  const open = kind => {
    setDraft({ q: filters.searchQuery, brand: filters.selectedBrand, sort: filters.sortBy, minPrice: filters.minPrice, maxPrice: filters.maxPrice, minDiscount: filters.minDiscount, weightSize: filters.weightSize, inStock: filters.inStock });
    setBrandSearch(""); setError(""); setPanel(kind);
  };
  const change = (key, value) => setDraft(previous => ({ ...previous, [key]: value }));
  const select = (key, value) => { filters.updateParam(key, value); setPanel(null); };
  const chooseLocation = () => { setPanel(null); openLocationModal(); };
  const apply = event => {
    event.preventDefault();
    if (draft.minPrice !== "" && draft.maxPrice !== "" && Number(draft.minPrice) > Number(draft.maxPrice)) { setError("Minimum price must not exceed maximum price."); return; }
    filters.applyFilters({ q: draft.q, [filters.brandParamKey]: draft.brand, sort: draft.sort, minPrice: draft.minPrice, maxPrice: draft.maxPrice, minDiscount: draft.minDiscount, weightSize: draft.weightSize, inStock: draft.inStock, onSale: "" });
    setPanel(null);
  };
  const pill = (label, Icon, selected, onClick, dropdown = false) => (
    <button type="button" onClick={onClick} aria-pressed={selected} className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold ${selected ? "border-[#0c831f] bg-[#0c831f] text-white" : "border-gray-200 bg-white text-gray-700"}`}>
      <Icon size={13} />{label}{dropdown ? <span aria-hidden="true">⌄</span> : null}
    </button>
  );
  const sortButtons = ids => <div className="flex gap-2">{ids.map(id => <button key={id} type="button" onClick={() => select("sort", id)} className={`${INPUT} ${filters.sortBy === id ? "border-[#0c831f] bg-green-50 font-bold text-[#0c831f]" : ""}`}>{PRODUCT_SORT_OPTIONS.find(option => option.id === id)?.label}</button>)}</div>;
  const discountOptions = (value, onChange) => <select aria-label="Minimum discount" className={INPUT} value={value} onChange={event => onChange(event.target.value)}><option value="">All Discounts</option>{DISCOUNTS.map(discount => <option key={discount} value={discount}>{discount}% or more</option>)}</select>;
  const sizeOptions = (value, onChange) => <select aria-label="Weight or size" className={INPUT} value={value} onChange={event => onChange(event.target.value)}><option value="">All Weights / Sizes</option>{sizes.map(size => <option key={size} value={size}>{size}</option>)}</select>;
  const brandOptions = (value, onChange) => <div className="space-y-2"><input aria-label="Search brands" className={INPUT} placeholder="Search brands" value={brandSearch} onChange={event => setBrandSearch(event.target.value)} /><select aria-label="Brand" className={INPUT} value={value} onChange={event => onChange(event.target.value)}><option value="">All Brands</option>{brandNames.filter(brand => brand === value || brand.toLowerCase().includes(brandSearch.toLowerCase())).map(brand => <option key={brand} value={brand}>{brand}</option>)}</select></div>;
  return (
    <>
      <div className={`flex min-w-0 items-center gap-1.5 overflow-x-auto border-b border-gray-100 bg-white px-3 py-2 ${className}`}>
        {pill(filters.activeFiltersCount ? `Filters (${filters.activeFiltersCount})` : "Filters", SlidersHorizontal, filters.hasActiveFilters, () => open("filters"))}
        {showSort ? <>
          {pill("Newest", Clock, filters.sortBy === "newest", () => filters.updateParam("sort", "newest"))}
          {pill("Oldest", History, filters.sortBy === "oldest", () => filters.updateParam("sort", filters.sortBy === "oldest" ? "newest" : "oldest"))}
        </> : null}
        {pill(filters.minDiscount ? `${filters.minDiscount}%+ Off` : "Discount", Percent, Boolean(filters.minDiscount || filters.sortBy.startsWith("discount-")), () => open("discount"), true)}
        {showSort ? <>
          {pill("Low to High", ArrowUp, filters.sortBy === "price-asc", () => filters.updateParam("sort", filters.sortBy === "price-asc" ? "newest" : "price-asc"))}
          {pill("High to Low", ArrowDown, filters.sortBy === "price-desc", () => filters.updateParam("sort", filters.sortBy === "price-desc" ? "newest" : "price-desc"))}
        </> : null}
        {pill(filters.weightSize ? `Size: ${filters.weightSize}` : "By Weight / Size", Scale, Boolean(filters.weightSize || filters.sortBy.startsWith("weight-")), () => open("weight"), true)}
        {showBrand ? pill(filters.selectedBrand || "Brand", Tag, Boolean(filters.selectedBrand), () => open("brand"), true) : null}
        {pill(location.pincode ? `Pin: ${location.pincode}` : "Pincode", MapPin, Boolean(location.pincode), chooseLocation, true)}
        {pill("In Stock", PackageCheck, filters.inStock, () => filters.updateParam("inStock", !filters.inStock))}
        {filters.hasActiveFilters ? <button type="button" onClick={filters.clearFilters} className="shrink-0 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-500">Clear</button> : null}
      </div>
      {panel ? <FilterDialog title={panel === "filters" ? "Filters & Sorting" : panel === "discount" ? "Filter / Sort by Discount" : panel === "weight" ? "Filter / Sort by Weight & Size" : "Filter by Brand"} onClose={() => setPanel(null)}>
        {panel === "discount" ? <div className="space-y-4">{sortButtons(["discount-asc", "discount-desc"])}{discountOptions(filters.minDiscount, value => select("minDiscount", value))}</div> : null}
        {panel === "weight" ? <div className="space-y-4">{sortButtons(["weight-asc", "weight-desc"])}{sizeOptions(filters.weightSize, value => select("weightSize", value))}</div> : null}
        {panel === "brand" ? brandOptions(filters.selectedBrand, value => select(filters.brandParamKey, value)) : null}
        {panel === "filters" ? <form onSubmit={apply} className="space-y-4">
          <label className="block space-y-1 text-sm font-semibold"><span>Search products</span><input className={INPUT} value={draft.q} placeholder="Search products" onChange={event => change("q", event.target.value)} /></label>
          <label className="block space-y-1 text-sm font-semibold"><span>Sort by</span><select className={INPUT} value={draft.sort} onChange={event => change("sort", event.target.value)}>{PRODUCT_SORT_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          {showBrand ? <div className="space-y-1"><p className="text-sm font-semibold">Brand</p>{brandOptions(draft.brand, value => change("brand", value))}</div> : null}
          <div className="grid grid-cols-2 gap-3"><label className="space-y-1 text-sm font-semibold"><span>Min Price (₹)</span><input className={INPUT} type="number" min="0" step="any" value={draft.minPrice} onChange={event => change("minPrice", event.target.value)} /></label><label className="space-y-1 text-sm font-semibold"><span>Max Price (₹)</span><input className={INPUT} type="number" min="0" step="any" value={draft.maxPrice} onChange={event => change("maxPrice", event.target.value)} /></label></div>
          <div className="space-y-1"><p className="text-sm font-semibold">Discount</p>{discountOptions(draft.minDiscount, value => change("minDiscount", value))}</div>
          <div className="space-y-1"><p className="text-sm font-semibold">Weight / Size</p>{sizeOptions(draft.weightSize, value => change("weightSize", value))}</div>
          <button type="button" onClick={chooseLocation} className={`${INPUT} flex items-center gap-2 text-left`}><MapPin size={16} />{location.pincode ? `Pincode: ${location.pincode}` : "Select delivery pincode"}</button>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={draft.inStock} onChange={event => change("inStock", event.target.checked)} />In Stock Only</label>
          {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
          <div className="flex gap-3"><button type="button" onClick={() => { filters.clearFilters(); setPanel(null); }} className={`${INPUT} font-semibold`}>Clear All</button><button type="submit" className="w-full rounded-lg bg-[#0c831f] px-3 py-2 font-bold text-white">Apply Filters</button></div>
        </form> : null}
      </FilterDialog> : null}
    </>
  );
}
export default ProductFiltersBar;
