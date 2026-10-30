import { useCallback, useMemo, useState } from "react";
import { managerApi } from "../../api/managerApi";
import { useAuth } from "../../context/AuthContext";
import { PageShell } from "../../components/layout/ManagerLayout";
import { useLive } from "../../realtime/useLive";
import ProductFormModal from "./ProductFormModal";
import ProductDetailModal from "./ProductDetailModal";
import { DEPARTMENT_LABELS, DEPARTMENT_STYLES, toDepartment } from "./productDepartments";

const DEPARTMENT_ORDER = { preorder: 0, ready2cook: 1, instant: 2 };

const byDepartmentThenNumber = (a, b) => {
  const dept = DEPARTMENT_ORDER[toDepartment(a.section)] - DEPARTMENT_ORDER[toDepartment(b.section)];
  if (dept) return dept;
  const na = Number(a.deptNumber);
  const nb = Number(b.deptNumber);
  const hasA = a.deptNumber !== "" && Number.isFinite(na);
  const hasB = b.deptNumber !== "" && Number.isFinite(nb);
  if (hasA && hasB && na !== nb) return na - nb;
  if (hasA !== hasB) return hasA ? -1 : 1;
  return String(a.name).localeCompare(String(b.name));
};

const categoryOf = (p) => p.categories?.[0] || "Uncategorised";

const rackLabel = (p) =>
  p.rackRow || p.rackColumn ? `${p.rackRow ? `R${p.rackRow}` : ""}${p.rackColumn ? `C${p.rackColumn}` : ""}` : "—";

function StockCell({ product, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const stock = Number(product.storeStock) || 0;

  const save = async (next) => {
    const count = Number(next);
    if (!Number.isInteger(count) || count < 0) {
      setError("Enter 0 or more");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await managerApi.setProductStock(product._id, count);
      setEditing(false);
      onSaved(product._id, count, res.data?.message);
    } catch (err) {
      setError(err.response?.data?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          save(value);
        }}
      >
        <input
          type="number"
          min="0"
          step="1"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-60"
        >
          {saving ? "…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="px-1 text-[11px] font-bold text-slate-500"
        >
          ✕
        </button>
        {error ? <span className="text-[10px] font-semibold text-rose-600">{error}</span> : null}
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
          stock > 10
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : stock > 0
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-rose-200 bg-rose-50 text-rose-700"
        }`}
      >
        {stock > 0 ? `${stock} in stock` : "Out of stock"}
      </span>
      <button
        type="button"
        onClick={() => {
          setValue(String(stock || ""));
          setEditing(true);
        }}
        className="rounded-md border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-100"
      >
        {stock > 0 ? "Edit" : "Make in stock"}
      </button>
      {stock > 0 ? (
        <button
          type="button"
          disabled={saving}
          onClick={() => save(0)}
          className="rounded-md px-1.5 py-0.5 text-[10px] font-bold text-rose-600 hover:bg-rose-50"
        >
          Mark out
        </button>
      ) : null}
    </div>
  );
}

const FILTERS = [
  { id: "all", label: "All" },
  { id: "preorder", label: "Pre-order" },
  { id: "ready2cook", label: "Ready2Cook" },
  { id: "instant", label: "Instant Order" },
];

export default function ProductsPage() {
  const { manager } = useAuth();
  const [products, setProducts] = useState([]);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState("all");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [outOfStockOnly, setOutOfStockOnly] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [viewing, setViewing] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  };

  const load = useCallback(async () => {
    try {
      const res = await managerApi.products();
      setProducts(res.data?.data || []);
      setStore(res.data?.store || null);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useLive(load, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => {
        if (filter !== "all" && toDepartment(p.section) !== filter) return false;
        if (category !== "all" && categoryOf(p) !== category) return false;
        if (outOfStockOnly && Number(p.storeStock) > 0) return false;
        if (!q) return true;
        return [p.name, p.sku, p.departmentId, p.brandName, p.categories?.[0], p.subcategory]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      })
      .sort(byDepartmentThenNumber);
  }, [products, filter, category, search, outOfStockOnly]);

  const outOfStockCount = useMemo(
    () => products.filter((p) => !(Number(p.storeStock) > 0)).length,
    [products]
  );

  const onStockSaved = (id, count, message) => {
    setProducts((prev) => prev.map((p) => (p._id === id ? { ...p, storeStock: count } : p)));
    if (message) showToast(message);
  };

  const counts = useMemo(() => {
    const result = { all: products.length, preorder: 0, ready2cook: 0, instant: 0 };
    products.forEach((p) => {
      result[toDepartment(p.section)] += 1;
    });
    return result;
  }, [products]);

  const categoryCounts = useMemo(() => {
    const result = new Map();
    products
      .filter((p) => filter === "all" || toDepartment(p.section) === filter)
      .forEach((p) => result.set(categoryOf(p), (result.get(categoryOf(p)) || 0) + 1));
    return [...result.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [products, filter]);

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await managerApi.deleteProduct(deleting._id);
      showToast(`"${deleting.name}" deleted`);
      setDeleting(null);
      await load();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to delete product");
    }
  };

  const storeName = store?.storeName || manager?.storeName || "your dark store";
  const pincode = store?.pincode || manager?.pincode;

  return (
    <PageShell
      title="Store Products"
      meta={pincode ? `Pincode ${pincode}` : undefined}
    >
      {toast && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
          {toast}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-600">
          {error}
        </div>
      )}

      <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setFilter(f.id);
                  setCategory("all");
                }}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold ${
                  filter === f.id ? "bg-slate-900 text-white" : "text-slate-600"
                }`}
              >
                {f.label} ({counts[f.id]})
              </button>
            ))}
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => setOutOfStockOnly((v) => !v)}
              className={`whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-bold ${
                outOfStockOnly
                  ? "border-rose-300 bg-rose-600 text-white"
                  : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
              }`}
            >
              Out of stock ({outOfStockCount})
            </button>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, SKU or department ID…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none sm:w-72"
            />
            <button
              type="button"
              onClick={() => setEditing({})}
              className="whitespace-nowrap rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
            >
              + Add product
            </button>
          </div>
        </div>
        {categoryCounts.length > 0 && (
          <div className="flex gap-2 overflow-x-auto border-t border-slate-100 pb-1 pt-4">
            <button
              type="button"
              onClick={() => setCategory("all")}
              className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                category === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All categories
            </button>
            {categoryCounts.map(([name, count]) => (
              <button
                key={name}
                type="button"
                onClick={() => setCategory(name)}
                className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  category === name ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {name} ({count})
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-slate-200/60" />
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-xs">
          <h3 className="text-base font-bold text-slate-800">
            {products.length ? "No matching products" : "No store products yet"}
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-xs text-slate-400">
            {products.length
              ? "Try a different department or search."
              : "Add products for your area — they appear to nearby customers with the stock you set."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-xs">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead>
              <tr className="bg-black text-[11px] font-bold uppercase tracking-wider text-white">
                <th className="whitespace-nowrap px-4 py-3">Dept ID</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3 text-right">MRP</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-center">Rack</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((p, index) => {
                const dept = toDepartment(p.section);
                const discount =
                  p.discountedPercent ||
                  (p.price > p.discountedPrice ? Math.round(((p.price - p.discountedPrice) / p.price) * 100) : 0);
                return (
                  <tr
                    key={p._id}
                    onClick={() => setViewing(p)}
                    className={`cursor-pointer transition hover:bg-emerald-50/50 ${
                      index % 2 ? "bg-slate-50/40" : "bg-white"
                    }`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-bold text-slate-800">
                      {p.departmentId || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.productImages?.[0] ? (
                          <img
                            src={p.productImages[0]}
                            alt=""
                            className="h-11 w-11 shrink-0 rounded-lg border border-slate-200 object-cover"
                          />
                        ) : (
                          <div className="h-11 w-11 shrink-0 rounded-lg bg-slate-100" />
                        )}
                        <div className="min-w-0 max-w-[220px]">
                          <p className="truncate font-bold text-slate-900" title={p.name}>
                            {p.name}
                          </p>
                          <p className="font-mono text-[11px] text-slate-400">{p.sku}</p>
                          {p.isCatalogProduct ? (
                            <span className="mt-0.5 inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-px text-[10px] font-bold text-sky-700">
                              Admin catalog
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${DEPARTMENT_STYLES[dept]}`}
                      >
                        {DEPARTMENT_LABELS[dept]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <p className="font-semibold text-slate-700">{p.categories?.[0] || "—"}</p>
                      {p.subcategory ? <p className="text-slate-400">{p.subcategory}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700">{p.brandName || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{p.unit || "—"}</td>
                    <td className="px-4 py-3 text-right text-xs text-slate-400">
                      {p.price > p.discountedPrice ? <span className="line-through">₹{p.price}</span> : `₹${p.price}`}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-black text-slate-900">₹{p.discountedPrice}</p>
                      {discount > 0 ? (
                        <p className="text-[10px] font-bold text-emerald-600">{discount}% off</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-xs font-bold text-slate-600">{rackLabel(p)}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <StockCell product={p} onSaved={onStockSaved} />
                    </td>
                    <td className="px-4 py-3 text-xs font-bold">
                      {p.isActive ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Live
                        </span>
                      ) : (
                        <span className="text-slate-400">Hidden</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setViewing(p)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                        >
                          View
                        </button>
                        {p.isCatalogProduct ? null : (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditing(p)}
                              className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleting(p)}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {viewing && (
        <ProductDetailModal
          product={products.find((p) => p._id === viewing._id) || viewing}
          onClose={() => setViewing(null)}
          onEdit={
            viewing.isCatalogProduct
              ? undefined
              : () => {
                  setEditing(viewing);
                  setViewing(null);
                }
          }
          onDelete={
            viewing.isCatalogProduct
              ? undefined
              : () => {
                  setDeleting(viewing);
                  setViewing(null);
                }
          }
        />
      )}

      {editing && (
        <ProductFormModal
          product={editing._id ? editing : null}
          defaultDepartment={filter === "ready2cook" ? "ready2cook" : filter === "instant" ? "instantorder" : "preorder"}
          onClose={() => setEditing(null)}
          onSaved={(saved, isEdit) => {
            setEditing(null);
            showToast(`"${saved?.name || "Product"}" ${isEdit ? "updated" : "added"}`);
            load();
          }}
        />
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <div>
              <h3 className="text-base font-bold text-slate-900">Delete product?</h3>
              <p className="mt-1 text-xs text-slate-500">
                <span className="font-semibold">{deleting.name}</span> will be removed from your store and its stock row
                deleted.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
