import { useEffect, useState } from "react";

export const PAGE_SIZE = 50;

/**
 * Client-side paging for a table's rows. Goes back to page 1 whenever any value in
 * `resetDeps` changes (filters, search, tabs) and never points past the last page.
 */
export function usePagination(rows, { pageSize = PAGE_SIZE, resetDeps = [] } = {}) {
  const [page, setPage] = useState(1);
  const total = rows?.length || 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pageCount);

  useEffect(() => {
    setPage(1);
  }, resetDeps); // eslint-disable-line react-hooks/exhaustive-deps

  const start = (current - 1) * pageSize;
  return {
    page: current,
    pageCount,
    pageSize,
    total,
    start,
    end: Math.min(start + pageSize, total),
    pageRows: (rows || []).slice(start, start + pageSize),
    setPage,
  };
}

/** Page numbers to show: first, last, and a window around the current page. */
function pageList(page, pageCount) {
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(`gap-${p}`);
    out.push(p);
  });
  return out;
}

/** Footer for a paged table. Renders nothing when everything fits on one page. */
export function Pagination({ pagination, className = "" }) {
  const { page, pageCount, total, start, end, setPage } = pagination;
  if (pageCount <= 1) return null;

  const btn =
    "h-8 min-w-8 rounded-lg border px-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 px-1 py-2.5 ${className}`}>
      <p className="text-xs text-slate-500">
        Showing <span className="font-bold text-slate-700">{start + 1}–{end}</span> of{" "}
        <span className="font-bold text-slate-700">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
          className={`${btn} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
        >
          ‹ Prev
        </button>
        {pageList(page, pageCount).map((p) =>
          typeof p === "string" ? (
            <span key={p} className="px-1 text-xs text-slate-400">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              className={`${btn} ${
                p === page
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          disabled={page === pageCount}
          onClick={() => setPage(page + 1)}
          className={`${btn} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
        >
          Next ›
        </button>
      </div>
    </div>
  );
}
