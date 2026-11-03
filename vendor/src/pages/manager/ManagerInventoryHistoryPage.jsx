import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Boxes, History } from "lucide-react";
import { vendorApi } from "../../api/vendorApi";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { listManagerQuality } from "../../api/managerPortApi";
import { CopyButton } from "../../components/ui/CopyId";
import { formatProductBusinessId } from "../../utils/cropLinks";
import { EXCEL_PAGE_TITLE } from "../../utils/excelStyles";
import { todayISODate, yesterdayISODate } from "../../utils/orderDisplay";

const FILTER_CTRL =
  "h-9 w-full min-w-0 rounded-lg border border-[#D1D5DB] bg-white px-2 text-[12px] text-[#1F2937] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#217346] focus:ring-2 focus:ring-[#217346]/20";
const FILTER_CHIP =
  "inline-flex h-9 shrink-0 items-center justify-center rounded-lg border px-2.5 text-[11px] font-semibold transition";
const FILTER_CHIP_IDLE = `${FILTER_CHIP} border-[#D1D5DB] bg-white text-[#374151] hover:bg-[#F9FAFB]`;
const FILTER_CHIP_ACTIVE = `${FILTER_CHIP} border-[#217346] bg-[#217346] text-white`;
const FILTER_LABEL = "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]";

const TH =
  "border border-[#E5E7EB] bg-[#F3F4F6] px-0.5 py-1 text-left text-[8px] font-semibold leading-tight text-[#374151] sm:px-2 sm:py-2 sm:text-[10px]";
const TD =
  "border border-[#E5E7EB] px-0.5 py-1 text-[8px] leading-tight text-[#1F2937] align-top sm:px-2 sm:py-2 sm:text-[11px]";
const GRADE_TD =
  "border px-0.5 py-1 text-center text-[8px] font-bold tabular-nums sm:px-2 sm:py-2 sm:text-[11px]";

function shortDate(value) {
  if (!value) return "—";
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw) && !raw.includes("T") && raw.length <= 10) {
    const [y, m, d] = raw.slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      const [y, m, day] = raw.slice(0, 10).split("-");
      return `${day}/${m}/${y}`;
    }
    return "—";
  }
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function formatTime12h(value) {
  if (!value) return "";
  const raw = String(value).trim();
  if (/am|pm/i.test(raw) && !raw.includes("T")) {
    return raw.replace(/\s+/g, " ").replace(/am/i, "AM").replace(/pm/i, "PM");
  }
  const asDate = new Date(raw);
  if (!Number.isNaN(asDate.getTime()) && (raw.includes("T") || raw.length > 12)) {
    return asDate.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  }
  const m = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return raw;
  let hour = Number(m[1]);
  const min = m[2];
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return raw;
  const period = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${min} ${period}`;
}

function formatExpiryDaysText(expiryDate) {
  if (!expiryDate) return { text: "No Expiry", days: null, status: "none" };
  const exp = new Date(expiryDate);
  if (Number.isNaN(exp.getTime())) return { text: "—", days: null, status: "none" };
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expDay = new Date(exp);
  expDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((expDay - now) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return { text: `Expired (${Math.abs(diffDays)}d ago)`, days: diffDays, status: "expired" };
  }
  if (diffDays === 0) {
    return { text: "Expires Today", days: 0, status: "today" };
  }
  if (diffDays === 1) {
    return { text: "1 day left", days: 1, status: "urgent" };
  }
  if (diffDays <= 7) {
    return { text: `${diffDays} days left`, days: diffDays, status: "warning" };
  }
  return { text: `${diffDays} days left`, days: diffDays, status: "good" };
}

function ExpiryBadge({ expiryDate }) {
  if (!expiryDate) return <span className="text-slate-400 font-normal">No Expiry</span>;
  const { text, status } = formatExpiryDaysText(expiryDate);
  const dateStr = shortDate(expiryDate);

  if (status === "expired") {
    return (
      <span className="inline-flex items-center gap-1 flex-wrap">
        <span className="font-extrabold text-rose-700">{dateStr}</span>
        <span className="rounded bg-rose-100 px-1.5 py-0.2 text-[8px] font-extrabold text-rose-800 uppercase tracking-tight">
          {text}
        </span>
      </span>
    );
  }
  if (status === "today") {
    return (
      <span className="inline-flex items-center gap-1 flex-wrap">
        <span className="font-bold text-amber-700">{dateStr}</span>
        <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[8px] font-extrabold text-amber-800 uppercase tracking-tight">
          {text}
        </span>
      </span>
    );
  }
  if (status === "urgent" || status === "warning") {
    return (
      <span className="inline-flex items-center gap-1 flex-wrap">
        <span className="font-bold text-amber-700">{dateStr}</span>
        <span className="rounded bg-amber-50 px-1.5 py-0.2 text-[8px] font-bold text-amber-700 border border-amber-200">
          {text}
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      <span className="font-bold text-[#217346]">{dateStr}</span>
      <span className="rounded bg-emerald-50 px-1.5 py-0.2 text-[8px] font-bold text-[#217346] border border-emerald-200">
        {text}
      </span>
    </span>
  );
}

function completedAtOf(row) {
  return (
    row.gradingConfirmedAt ||
    row.inspectionCompletedAt ||
    row.updatedAt ||
    row.receivedAt ||
    null
  );
}

function toCompletedDateKey(row) {
  const raw = completedAtOf(row);
  if (!raw) return "";
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function matchesCompletedDateRange(row, from = "", to = "") {
  if (!from && !to) return true;
  const key = toCompletedDateKey(row);
  if (!key) return false;
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
}

function splitIdIntoRows(value, parts = 3) {
  const text = String(value || "").trim();
  if (!text || text === "—") return ["—"];
  const chunks = text.split("-").filter(Boolean);
  if (chunks.length <= 1) {
    const size = Math.ceil(text.length / parts);
    return Array.from({ length: parts }, (_, i) => text.slice(i * size, (i + 1) * size)).filter(Boolean);
  }
  if (chunks.length <= parts) return chunks;
  const rows = Array.from({ length: parts }, () => []);
  chunks.forEach((chunk, i) => {
    const rowIdx = Math.min(parts - 1, Math.floor((i * parts) / chunks.length));
    rows[rowIdx].push(chunk);
  });
  return rows.map((r) => r.join("-")).filter(Boolean);
}

function IdThreeLines({ value, textClassName = "font-mono text-[8px] font-semibold text-[#217346] sm:text-[10px]" }) {
  const full = String(value || "").trim();
  if (!full || full === "—") return <span className="text-[#9CA3AF]">—</span>;
  const lines = splitIdIntoRows(full, 3);
  return (
    <span className="inline-flex max-w-full items-start gap-0.5">
      <span className={`min-w-0 leading-snug ${textClassName}`} title={full}>
        {lines.map((line) => (
          <span key={line} className="block break-all">
            {line}
          </span>
        ))}
      </span>
      <CopyButton value={full} />
    </span>
  );
}

function IdOneLine({ label, value, textClassName = "font-mono text-[9px] font-semibold text-[#217346]" }) {
  const full = String(value || "").trim();
  if (!full || full === "—") {
    return (
      <p className="min-w-0 leading-tight text-[9px] text-[#6B7280]">
        <span className="font-semibold">{label} </span>
        <span className="text-[#9CA3AF]">—</span>
      </p>
    );
  }
  return (
    <div className="flex min-w-0 items-start gap-0.5 leading-tight text-[9px]">
      <span className="shrink-0 font-semibold text-[#6B7280]">{label}</span>
      <span className={`min-w-0 flex-1 break-all ${textClassName}`} title={full}>
        {full}
      </span>
      <CopyButton value={full} />
    </div>
  );
}

function HistoryMobileCard({ row, index, onOpen }) {
  const completedAt = completedAtOf(row);
  const dateText = shortDate(completedAt);
  const timeText = formatTime12h(completedAt);
  const product = row.productName || row.product || "—";
  return (
    <article
      className="flex h-full cursor-pointer flex-col rounded-lg border border-[#E5E7EB] bg-white p-2 shadow-sm active:bg-[#F9FBF9]"
      onClick={() => onOpen(row)}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold text-[#9CA3AF]">#{index}</p>
          <p className="line-clamp-2 text-[11px] font-bold leading-tight text-[#1F2937]">
            {product}
            {row.variety ? <span className="font-medium text-[#6B7280]"> · {row.variety}</span> : null}
          </p>
          <p className="mt-0.5 line-clamp-1 text-[10px] font-medium leading-tight text-[#374151]">
            {row.farmerName || "—"}
          </p>
        </div>
        <div className="shrink-0 text-right leading-tight">
          <p className="text-[9px] font-semibold text-[#1F2937]">{dateText}</p>
          <p className="text-[8px] text-[#6B7280]">{timeText || "—"}</p>
          <p className="mt-0.5 text-[8px] font-semibold text-[#6B7280]">{row.unit}</p>
        </div>
      </div>

      <div className="mt-1.5 space-y-0.5 border-t border-[#F3F4F6] pt-1.5" onClick={(e) => e.stopPropagation()}>
        <IdOneLine label="O:" value={row.orderDisplay} />
        <IdOneLine
          label="B:"
          value={row.batchId}
          textClassName="font-mono text-[9px] font-semibold text-[#1E40AF]"
        />
        <IdOneLine label="C:" value={row.collectionCentreId} />
      </div>

      {(row.packagingDate || row.expiryDate) && (
        <div className="mt-1 flex items-center justify-between border-t border-[#F3F4F6] pt-1 text-[8.5px]">
          <span className="text-[#6B7280]">
            Recv: <span className="font-semibold text-[#1F2937]">{shortDate(row.packagingDate)}</span>
          </span>
          <span className="text-[#6B7280]">
            Exp: <span className="font-semibold text-emerald-800">{shortDate(row.expiryDate)}</span>
          </span>
        </div>
      )}

      <div className="mt-auto grid grid-cols-2 gap-1 pt-1.5 text-center">
        <div className="rounded border border-[#A7F3D0] bg-[#ECFDF5] px-0.5 py-1">
          <p className="text-[8px] font-semibold text-[#065F46]">A</p>
          <p className="text-[10px] font-bold tabular-nums leading-none text-[#065F46]">{row.gradeA.toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded border border-[#BFDBFE] bg-[#EFF6FF] px-0.5 py-1">
          <p className="text-[8px] font-semibold text-[#1E40AF]">B</p>
          <p className="text-[10px] font-bold tabular-nums leading-none text-[#1E40AF]">{row.gradeB.toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded border border-[#FDE68A] bg-[#FFFBEB] px-0.5 py-1">
          <p className="text-[8px] font-semibold text-[#92400E]">C</p>
          <p className="text-[10px] font-bold tabular-nums leading-none text-[#92400E]">{row.gradeC.toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded border border-[#FECACA] bg-[#FEF2F2] px-0.5 py-1">
          <p className="text-[8px] font-semibold text-[#991B1B]">R</p>
          <p className="text-[10px] font-bold tabular-nums leading-none text-[#DC2626]">{row.rejected.toLocaleString("en-IN")}</p>
        </div>
      </div>
    </article>
  );
}

function splitNameTwoRows(value) {
  const text = String(value || "").trim();
  if (!text || text === "—") return ["—"];
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    const mid = Math.ceil(text.length / 2);
    return [text.slice(0, mid), text.slice(mid)].filter(Boolean);
  }
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")].filter(Boolean);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function gradeQty(row, letter) {
  const label = `Grade ${letter}`;
  const assigned = num(row[`grade${letter}Quantity`] ?? row[`grade${letter}Assigned`]);
  const grades = Array.isArray(row.grades) ? row.grades : [];
  const fromGrade = grades.find((g) => String(g.label || g.grade || "").trim() === label);
  const finalRows = Array.isArray(row.finalStatement) ? row.finalStatement : [];
  const fromFinal = finalRows.find((g) => String(g.label || g.grade || "").trim() === label);
  const gq = row.gradeQuality && typeof row.gradeQuality === "object" ? row.gradeQuality : {};
  const rejected = num(gq[label]?.rejectedQuantity || fromFinal?.rejectedQuantity);
  const base = num(
    fromFinal?.finalQty ?? fromFinal?.quantity ?? fromFinal?.qty ?? fromGrade?.quantity ?? fromGrade?.qty ?? assigned
  );
  return Math.max(0, fromFinal?.finalQty != null ? base : base - rejected);
}

function rejectedQty(row) {
  const gq = row.gradeQuality && typeof row.gradeQuality === "object" ? row.gradeQuality : {};
  const fromGq = ["Grade A", "Grade B", "Grade C"].reduce(
    (sum, label) => sum + num(gq[label]?.rejectedQuantity),
    0
  );
  if (fromGq > 0) return fromGq;
  return num(row.rejectedQuantity);
}

function matchesProduct(row, { productId, productBizId, name, variety }) {
  if (!productId && !productBizId && !name) return true;
  const entryProductId = String(row.productId || "").trim().toLowerCase();
  const entryBiz = String(formatProductBusinessId(row) || "").trim().toLowerCase();
  const entryName = String(row.productName || row.product || "").trim().toLowerCase();
  const entryVariety = String(row.variety || "").trim().toLowerCase();
  const wantId = String(productId || productBizId || "").trim().toLowerCase();
  const wantName = String(name || "").trim().toLowerCase();
  const wantVariety = String(variety || "").trim().toLowerCase();

  if (wantId) {
    if (entryProductId && (entryProductId === wantId || entryProductId.includes(wantId) || wantId.includes(entryProductId))) {
      return true;
    }
    if (entryBiz && (entryBiz === wantId || entryBiz.includes(wantId) || wantId.includes(entryBiz))) return true;
  }
  if (wantName && entryName === wantName) {
    if (!wantVariety) return true;
    return entryVariety === wantVariety || entryVariety.includes(wantVariety);
  }
  if (wantName && entryName.includes(wantName)) {
    if (!wantVariety) return true;
    return entryVariety === wantVariety || entryVariety.includes(wantVariety);
  }
  return false;
}

function FarmerInventoryHistoryView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get("productId") || "";
  const productBizId = searchParams.get("productBizId") || "";
  const productName = searchParams.get("name") || "";
  const variety = searchParams.get("variety") || "";
  const productFilter = { productId, productBizId, name: productName, variety };

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [farmerFilter, setFarmerFilter] = useState("");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const setDateRange = (from, to) => {
    setDateFrom(from || "");
    setDateTo(to || "");
  };
  const setTodayFilter = () => {
    const today = todayISODate();
    setDateRange(today, today);
  };
  const setYesterdayFilter = () => {
    const yesterday = yesterdayISODate();
    setDateRange(yesterday, yesterday);
  };
  const clearDateFilter = () => setDateRange("", "");

  useEffect(() => {
    setLoading(true);
    listManagerQuality({ bucket: "completed" })
      .then((data) => setItems(Array.isArray(data?.items) ? data.items : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const farmers = useMemo(() => {
    const map = new Map();
    items.forEach((row) => {
      const id = row.farmerId || "";
      const name = row.farmerName || id;
      if (id && !map.has(id)) map.set(id, name);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((row) => matchesProduct(row, productFilter))
      .filter((row) => !farmerFilter || row.farmerId === farmerFilter)
      .filter((row) => matchesCompletedDateRange(row, dateFrom, dateTo))
      .filter((row) => {
        if (!q) return true;
        return [
          row.productName,
          row.product,
          row.variety,
          row.farmerName,
          row.orderDisplayId,
          row.orderId,
          row.batchId,
          row.collectionCentre,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      })
      .map((row) => ({
        ...row,
        gradeA: gradeQty(row, "A"),
        gradeB: gradeQty(row, "B"),
        gradeC: gradeQty(row, "C"),
        rejected: rejectedQty(row),
        orderDisplay: row.orderDisplayId || row.orderId || "—",
        unit: row.unit || "Kg",
        source: "Quality & Grading · Completed",
      }))
      .sort((a, b) => {
        const ta = new Date(completedAtOf(a) || 0).getTime();
        const tb = new Date(completedAtOf(b) || 0).getTime();
        return tb - ta;
      });
  }, [items, productFilter, farmerFilter, query, dateFrom, dateTo, productId, productBizId, productName, variety]);

  const todayKey = todayISODate();
  const yesterdayKey = yesterdayISODate();
  const isTodayActive = dateFrom === todayKey && dateTo === todayKey;
  const isYesterdayActive = dateFrom === yesterdayKey && dateTo === yesterdayKey;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="min-w-0">
        <Link to="/vendor/inventory" className="mb-1 inline-block text-[12px] font-semibold text-[#217346]">
          ← All Inventory
        </Link>
        <h1 className={EXCEL_PAGE_TITLE}>Inventory History</h1>
      </div>

      <div className="rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-1.5 sm:flex sm:flex-wrap sm:items-end sm:gap-2">
            <label className="min-w-0 sm:w-[9rem]">
              <span className={FILTER_LABEL}>From</span>
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => setDateRange(e.target.value, dateTo)}
                className={FILTER_CTRL}
              />
            </label>
            <label className="min-w-0 sm:w-[9rem]">
              <span className={FILTER_LABEL}>To</span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => setDateRange(dateFrom, e.target.value)}
                className={FILTER_CTRL}
              />
            </label>
            <div className="min-w-0 shrink-0">
              <span className={`${FILTER_LABEL} max-sm:sr-only`}>Quick</span>
              <div className="flex h-9 gap-1">
                <button
                  type="button"
                  onClick={setTodayFilter}
                  className={isTodayActive ? FILTER_CHIP_ACTIVE : FILTER_CHIP_IDLE}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={setYesterdayFilter}
                  className={isYesterdayActive ? FILTER_CHIP_ACTIVE : FILTER_CHIP_IDLE}
                >
                  Yesterday
                </button>
                {dateFrom || dateTo ? (
                  <button type="button" onClick={clearDateFilter} className={FILTER_CHIP_IDLE}>
                    Clear
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
            <label className="min-w-0">
              <span className={FILTER_LABEL}>Farmer</span>
        <select
          value={farmerFilter}
          onChange={(e) => setFarmerFilter(e.target.value)}
                className={FILTER_CTRL}
        >
          <option value="">All Farmers</option>
          {farmers.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
          ))}
        </select>
            </label>
            <label className="min-w-0">
              <span className={FILTER_LABEL}>Search</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={FILTER_CTRL}
                placeholder="Order, batch, farmer…"
              />
            </label>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-[#6B7280]">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-[#6B7280]">No Quality & Grading · Completed history found</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:hidden">
            {rows.map((row, idx) => (
              <HistoryMobileCard
                key={row.inspectionId || row.orderId || idx}
                row={row}
                index={idx + 1}
                onOpen={(r) => navigate(`/vendor/quality/${r.orderId}`)}
              />
            ))}
          </div>

          <div className="hidden w-full overflow-hidden border border-[#E5E7EB] bg-white shadow-sm md:block">
            <table className="w-full table-fixed border-collapse">
            <colgroup>
              <col className="w-[3%] sm:w-[3%] md:w-[3%]" />
              <col className="w-[9%] sm:w-[8%] md:w-[7%]" />
              <col className="w-[10%] sm:w-[9%] md:w-[9%]" />
              <col className="w-[8%] sm:w-[7%] md:w-[7%]" />
              <col className="w-[8%] sm:w-[7%] md:w-[7%]" />
              <col className="w-[9%] sm:w-[8%] md:w-[8%]" />
              <col className="w-[6%] sm:w-[6.5%] md:w-[6.5%]" />
              <col className="w-[6%] sm:w-[6%] md:w-[6%]" />
              <col className="w-[6%] sm:w-[6.5%] md:w-[6.5%]" />
              <col className="w-[6%] sm:w-[6.5%] md:w-[6.5%]" />
              <col className="w-[6%] sm:w-[6.5%] md:w-[6.5%]" />
              <col className="w-[5%] sm:w-[5%] md:w-[5%]" />
              <col className="w-[7%] sm:w-[7.5%] md:w-[8%]" />
              <col className="w-[7%] sm:w-[7.5%] md:w-[8%]" />
              <col className="w-[4%] sm:w-[3.5%] md:w-[3.5%]" />
            </colgroup>
            <thead>
              <tr>
                <th className={`${TH} text-center`}>#</th>
                <th className={TH}>Date</th>
                <th className={TH}>Farmer</th>
                <th className={TH}>
                  <span className="sm:hidden">Order</span>
                  <span className="hidden sm:inline">Order ID</span>
                </th>
                <th className={TH}>
                  <span className="sm:hidden">Batch</span>
                  <span className="hidden sm:inline">Batch ID</span>
                </th>
                <th className={TH}>
                  <span className="sm:hidden">CC ID</span>
                  <span className="hidden sm:inline">Collection Centre ID</span>
                </th>
                <th className={TH}>Product</th>
                <th className={TH}>Variety</th>
                <th className={`${TH} border-[#A7F3D0] bg-[#D1FAE5] text-center text-[#065F46]`}>
                  <span className="sm:hidden">A</span>
                  <span className="hidden sm:inline">Grade A</span>
                </th>
                <th className={`${TH} border-[#BFDBFE] bg-[#DBEAFE] text-center text-[#1E40AF]`}>
                  <span className="sm:hidden">B</span>
                  <span className="hidden sm:inline">Grade B</span>
                </th>
                <th className={`${TH} border-[#FDE68A] bg-[#FEF3C7] text-center text-[#92400E]`}>
                  <span className="sm:hidden">C</span>
                  <span className="hidden sm:inline">Grade C</span>
                </th>
                <th className={`${TH} border-[#FECACA] bg-[#FEE2E2] text-center text-[#991B1B]`}>
                  <span className="sm:hidden">R</span>
                  <span className="hidden sm:inline">Rejected</span>
                </th>
                <th className={`${TH} text-center`}>
                  <span className="sm:hidden">Recv</span>
                  <span className="hidden sm:inline">Receiving Date</span>
                </th>
                <th className={`${TH} text-center`}>
                  <span className="sm:hidden">Exp</span>
                  <span className="hidden sm:inline">Expiry Date</span>
                </th>
                <th className={`${TH} text-center`}>Unit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                  <tr
                    key={row.inspectionId || row.orderId || idx}
                    className="cursor-pointer hover:bg-[#F9FBF9]"
                    onClick={() => navigate(`/vendor/quality/${row.orderId}`)}
                  >
                    <td className={`${TD} text-center text-[#9CA3AF]`}>{idx + 1}</td>
                    <td className={TD}>
                      {(() => {
                        const completedAt = completedAtOf(row);
                        const dateText = shortDate(completedAt);
                        const timeText = formatTime12h(completedAt);
                        return (
                          <>
                            <p className="font-semibold text-[#1F2937]">{dateText}</p>
                            <p className="text-[7px] font-medium text-[#6B7280] sm:text-[10px]">
                              {timeText || "—"}
                            </p>
                          </>
                        );
                      })()}
                    </td>
                    <td className={`${TD} min-w-0 font-medium`}>
                      {(() => {
                        const lines = splitNameTwoRows(row.farmerName);
                        return (
                          <span className="block leading-snug" title={row.farmerName || ""}>
                            {lines.map((line) => (
                              <span key={line} className="block break-words">
                                {line}
                              </span>
                            ))}
                      </span>
                        );
                      })()}
                    </td>
                    <td className={`${TD} min-w-0`} onClick={(e) => e.stopPropagation()}>
                      <IdThreeLines value={row.orderDisplay} />
                    </td>
                    <td className={`${TD} min-w-0`} onClick={(e) => e.stopPropagation()}>
                      <IdThreeLines
                        value={row.batchId}
                        textClassName="font-mono text-[8px] font-semibold text-[#1E40AF] sm:text-[10px]"
                      />
                    </td>
                    <td className={`${TD} min-w-0`} onClick={(e) => e.stopPropagation()}>
                      <IdThreeLines
                        value={row.collectionCentreId}
                        textClassName="font-mono text-[8px] font-semibold text-[#217346] sm:text-[9px]"
                      />
                    </td>
                    <td className={`${TD} break-words font-semibold`}>{row.productName || row.product || "—"}</td>
                    <td className={`${TD} break-words`}>{row.variety || "—"}</td>
                    <td className={`${GRADE_TD} border-[#A7F3D0] bg-[#ECFDF5]`}>
                      {row.gradeA.toLocaleString("en-IN")}
                    </td>
                    <td className={`${GRADE_TD} border-[#BFDBFE] bg-[#EFF6FF]`}>
                      {row.gradeB.toLocaleString("en-IN")}
                    </td>
                    <td className={`${GRADE_TD} border-[#FDE68A] bg-[#FFFBEB]`}>
                      {row.gradeC.toLocaleString("en-IN")}
                    </td>
                    <td className={`${GRADE_TD} border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]`}>
                      {row.rejected.toLocaleString("en-IN")}
                    </td>
                    <td className={`${TD} text-center tabular-nums text-[#374151]`}>
                      {shortDate(row.packagingDate)}
                    </td>
                    <td className={`${TD} text-center tabular-nums font-semibold text-emerald-800`}>
                      {shortDate(row.expiryDate)}
                    </td>
                    <td className={`${TD} text-center font-semibold`}>{row.unit}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}


/* =========================================================================
   SELLER INVENTORY HISTORY VIEW (STOCK TRANSACTIONS & BATCHES)
   ========================================================================= */
function SellerInventoryHistoryView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get("productId") || "";
  const sku = searchParams.get("sku") || "";
  const productName = searchParams.get("name") || "";

  const [activeTab, setActiveTab] = useState("transactions");
  const [transactions, setTransactions] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [typeFilter, setTypeFilter] = useState("all");
  const [reasonFilter, setReasonFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const setDateRange = (from, to) => {
    setDateFrom(from || "");
    setDateTo(to || "");
  };
  const setTodayFilter = () => {
    const today = todayISODate();
    setDateRange(today, today);
  };
  const setYesterdayFilter = () => {
    const yesterday = yesterdayISODate();
    setDateRange(yesterday, yesterday);
  };
  const clearDateFilter = () => setDateRange("", "");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (productId) params.productId = productId;
      const [txRes, batRes] = await Promise.all([
        vendorApi.getStockTransactions({ ...params, limit: 100 }),
        vendorApi.getStockBatches({ ...params, limit: 100 }),
      ]);
      setTransactions(Array.isArray(txRes.data?.transactions) ? txRes.data.transactions : []);
      setBatches(Array.isArray(batRes.data?.batches) ? batRes.data.batches : []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load stock history");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredTransactions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (typeFilter !== "all" && tx.transactionType !== typeFilter) return false;
      if (reasonFilter !== "all" && tx.reason !== reasonFilter) return false;
      if (dateFrom || dateTo) {
        const txDate = tx.createdAt ? tx.createdAt.slice(0, 10) : "";
        if (dateFrom && txDate < dateFrom) return false;
        if (dateTo && txDate > dateTo) return false;
      }
      if (!q) return true;
      return [
        tx.transactionId,
        tx.batchId,
        tx.productName,
        tx.sku,
        tx.reason,
        tx.remarks,
        tx.createdBy,
      ].some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [transactions, typeFilter, reasonFilter, dateFrom, dateTo, query]);

  const filteredBatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return batches.filter((b) => {
      if (dateFrom || dateTo) {
        const bDate = b.receivedDate ? String(b.receivedDate).slice(0, 10) : "";
        if (dateFrom && bDate < dateFrom) return false;
        if (dateTo && bDate > dateTo) return false;
      }
      if (!q) return true;
      return [
        b.batchId,
        b.productName,
        b.sku,
        b.qualityGrade,
        b.stockSource,
        b.storageLocation,
        b.status,
      ].some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [batches, dateFrom, dateTo, query]);

  const todayKey = todayISODate();
  const yesterdayKey = yesterdayISODate();
  const isTodayActive = dateFrom === todayKey && dateTo === todayKey;
  const isYesterdayActive = dateFrom === yesterdayKey && dateTo === yesterdayKey;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link to="/vendor/inventory" className="mb-1 inline-block text-[12px] font-semibold text-[#217346] hover:underline">
            ← All Inventory / परत जा
          </Link>
          <div className="flex items-center gap-2">
            <h1 className={EXCEL_PAGE_TITLE}>Inventory History / स्टॉक इतिहास</h1>
            <span className="rounded-full bg-[#E8F5E9] px-2.5 py-0.5 text-xs font-bold text-[#217346] ring-1 ring-[#A7F3D0]">
              Seller Stock
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {productId || productName ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-emerald-800">Filtered Product:</span>
            <span className="text-xs font-bold text-slate-900">{productName || "Product"}</span>
            {sku ? (
              <span className="rounded bg-white px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-200">
                {sku}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => navigate("/vendor/inventory/history")}
            className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-300 hover:bg-emerald-100 transition"
          >
            Show All Products History / सर्व उत्पादने दाखवा
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>
      ) : null}

      <div className="rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-1.5 sm:flex sm:flex-wrap sm:items-end sm:gap-2">
            <label className="min-w-0 sm:w-[9rem]">
              <span className={FILTER_LABEL}>From</span>
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => setDateRange(e.target.value, dateTo)}
                className={FILTER_CTRL}
              />
            </label>
            <label className="min-w-0 sm:w-[9rem]">
              <span className={FILTER_LABEL}>To</span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => setDateRange(dateFrom, e.target.value)}
                className={FILTER_CTRL}
              />
            </label>
            <div className="min-w-0 shrink-0">
              <span className={`${FILTER_LABEL} max-sm:sr-only`}>Quick</span>
              <div className="flex h-9 gap-1">
                <button
                  type="button"
                  onClick={setTodayFilter}
                  className={isTodayActive ? FILTER_CHIP_ACTIVE : FILTER_CHIP_IDLE}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={setYesterdayFilter}
                  className={isYesterdayActive ? FILTER_CHIP_ACTIVE : FILTER_CHIP_IDLE}
                >
                  Yesterday
                </button>
                {dateFrom || dateTo ? (
                  <button type="button" onClick={clearDateFilter} className={FILTER_CHIP_IDLE}>
                    Clear
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 sm:gap-2">
            <label className="min-w-0">
              <span className={FILTER_LABEL}>Type</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className={FILTER_CTRL}
              >
                <option value="all">All Types (ADD & DEDUCT)</option>
                <option value="ADD">ADD (Stock In)</option>
                <option value="DEDUCT">DEDUCT (Stock Out)</option>
              </select>
            </label>
            <label className="min-w-0">
              <span className={FILTER_LABEL}>Reason</span>
              <select
                value={reasonFilter}
                onChange={(e) => setReasonFilter(e.target.value)}
                className={FILTER_CTRL}
              >
                <option value="all">All Reasons</option>
                <option value="Initial Stock">Initial Stock</option>
                <option value="Supplier Purchase">Supplier Purchase</option>
                <option value="Restock Batch">Restock Batch</option>
                <option value="Order Fulfillment">Order Fulfillment</option>
                <option value="Damaged Stock">Damaged Stock</option>
                <option value="Expired Stock">Expired Stock</option>
                <option value="Quality Rejection">Quality Rejection</option>
                <option value="Internal Usage">Internal Usage</option>
                <option value="Stock Correction">Stock Correction</option>
                <option value="Return to Supplier">Return to Supplier</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <label className="min-w-0">
              <span className={FILTER_LABEL}>Search</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Batch ID, Product, Remarks..."
                className={FILTER_CTRL}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("transactions")}
          className={`flex items-center gap-1.5 border-b-2 px-3 pb-2 text-xs font-bold transition ${
            activeTab === "transactions"
              ? "border-[#217346] text-[#217346]"
              : "border-transparent text-[#6B7280] hover:text-[#1F2937]"
          }`}
        >
          <History className="h-3.5 w-3.5" />
          Stock Transactions ({filteredTransactions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("batches")}
          className={`flex items-center gap-1.5 border-b-2 px-3 pb-2 text-xs font-bold transition ${
            activeTab === "batches"
              ? "border-[#217346] text-[#217346]"
              : "border-transparent text-[#6B7280] hover:text-[#1F2937]"
          }`}
        >
          <Boxes className="h-3.5 w-3.5" />
          Product Batches ({filteredBatches.length})
        </button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-[#6B7280]">Loading history…</p>
      ) : activeTab === "transactions" ? (
        filteredTransactions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-xs text-slate-500">
            No stock transactions found matching criteria.
          </div>
        ) : (
          <div className="w-full overflow-x-auto border border-slate-200/80 bg-white shadow-sm">
            <table className="w-full min-w-[920px] table-fixed border-collapse">
              <colgroup>
                <col className="w-[3.5%]" />
                <col className="w-[14%]" />
                <col className="w-[18%]" />
                <col className="w-[16%]" />
                <col className="w-[7%]" />
                <col className="w-[8%]" />
                <col className="w-[11%]" />
                <col className="w-[10.5%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead>
                <tr>
                  <th className={`${TH} text-center`}>#</th>
                  <th className={TH}>Batch ID</th>
                  <th className={TH}>Product & SKU</th>
                  <th className={TH}>Dates & Expiry</th>
                  <th className={`${TH} text-center`}>Type</th>
                  <th className={`${TH} text-center`}>Quantity</th>
                  <th className={`${TH} text-center`}>Stock Balance</th>
                  <th className={TH}>Reason</th>
                  <th className={TH}>Details & Remarks</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx, idx) => (
                  <tr key={tx.transactionId || idx} className="hover:bg-[#F9FBF9]">
                    <td className={`${TD} text-center align-middle text-[#9CA3AF]`}>{idx + 1}</td>
                    <td className={`${TD} align-middle font-mono text-[10px] font-bold text-[#217346]`}>
                      <div className="flex items-center gap-1">
                        <span className="truncate">{tx.batchId}</span>
                        <CopyButton value={tx.batchId} />
                      </div>
                      <span className="block text-[8px] text-slate-400 font-sans mt-0.5">
                        {shortDate(tx.createdAt)} · {formatTime12h(tx.createdAt)}
                      </span>
                    </td>
                    <td className={`${TD} align-middle`}>
                      <span className="block font-bold leading-snug text-[#111827] text-[11px] sm:text-[12px]">
                        {tx.productName || "Product"}
                      </span>
                      {tx.sku ? (
                        <span className="font-mono text-[9px] text-[#217346] font-semibold block mt-0.5">
                          {tx.sku}
                        </span>
                      ) : null}
                    </td>
                    <td className={`${TD} align-middle text-[11px]`}>
                      <div className="space-y-0.5">
                        <p className="text-[#1F2937]">
                          <span className="text-[10px] text-slate-500 font-medium">Recv: </span>
                          <span className="font-semibold text-slate-800">{shortDate(tx.receivedDate || tx.createdAt)}</span>
                        </p>
                        {tx.mfgDate ? (
                          <p className="text-[#4B5563] text-[10px]">
                            <span className="text-slate-400">Mfg: </span>
                            <span>{shortDate(tx.mfgDate)}</span>
                          </p>
                        ) : null}
                        <p className="text-[11px] flex items-center gap-1 flex-wrap">
                          <span className="text-[10px] text-slate-500 font-medium">Exp: </span>
                          <ExpiryBadge expiryDate={tx.expiryDate} />
                        </p>
                      </div>
                    </td>
                    <td className={`${TD} align-middle text-center`}>
                      <span
                        className={`rounded px-2 py-0.5 text-[9px] font-extrabold uppercase ${
                          tx.transactionType === "ADD"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {tx.transactionType}
                      </span>
                    </td>
                    <td className={`${TD} align-middle text-center font-bold text-[#111827] tabular-nums`}>
                      {tx.transactionType === "ADD" ? "+" : "-"}
                      {tx.quantity} {tx.unit}
                    </td>
                    <td className={`${TD} align-middle text-center font-mono text-[10px] tabular-nums`}>
                      <div className="inline-flex items-center justify-center gap-1">
                        <span className="text-slate-500">{tx.previousStock}</span>
                        <span className="text-slate-400">→</span>
                        <span className="font-extrabold text-[#111827]">{tx.updatedStock}</span>
                      </div>
                    </td>
                    <td className={`${TD} align-middle text-[11px]`}>
                      <span className="block font-semibold text-[#1F2937]">{tx.reason || "—"}</span>
                    </td>
                    <td className={`${TD} align-middle text-[10px] text-[#374151]`}>
                      <span className="block font-medium text-slate-800">{tx.remarks || "—"}</span>
                      {tx.packagingType || tx.storageLocation ? (
                        <span className="block text-[9px] text-slate-500 mt-0.5 font-medium">
                          {[tx.packagingType, tx.storageLocation].filter(Boolean).join(" · ")}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* Batches Tab */
        filteredBatches.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-xs text-slate-500">
            No batches found for this product.
          </div>
        ) : (
          <div className="w-full overflow-x-auto border border-slate-200/80 bg-white shadow-sm">
            <table className="w-full min-w-[900px] table-fixed border-collapse">
              <colgroup>
                <col className="w-[4%]" />
                <col className="w-[15%]" />
                <col className="w-[18%]" />
                <col className="w-[10%]" />
                <col className="w-[8%]" />
                <col className="w-[6%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[9%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead>
                <tr>
                  <th className={`${TH} text-center`}>#</th>
                  <th className={TH}>Batch ID</th>
                  <th className={TH}>Product</th>
                  <th className={`${TH} text-center`}>Available Stock</th>
                  <th className={`${TH} text-center`}>Total Added</th>
                  <th className={`${TH} text-center`}>Unit</th>
                  <th className={`${TH} text-center`}>Received Date</th>
                  <th className={`${TH} text-center`}>Expiry Date</th>
                  <th className={`${TH} text-center`}>Status</th>
                  <th className={TH}>Storage / Source</th>
                </tr>
              </thead>
              <tbody>
                {filteredBatches.map((b, idx) => (
                  <tr key={b.batchId || idx} className="hover:bg-[#F9FBF9]">
                    <td className={`${TD} text-center align-middle text-[#9CA3AF]`}>{idx + 1}</td>
                    <td className={`${TD} align-middle font-mono text-[10px] font-bold text-[#217346]`}>
                      <div className="flex items-center gap-1">
                        <span className="truncate">{b.batchId}</span>
                        <CopyButton value={b.batchId} />
                      </div>
                    </td>
                    <td className={`${TD} align-middle`}>
                      <span className="block font-bold leading-snug text-[#111827]">{b.productName || "Product"}</span>
                      {b.sku ? <span className="font-mono text-[9px] text-[#6B7280]">{b.sku}</span> : null}
                    </td>
                    <td className={`${TD} align-middle text-center font-bold text-[12px] text-[#111827] tabular-nums`}>
                      {b.availableQuantity}
                    </td>
                    <td className={`${TD} align-middle text-center tabular-nums text-[#6B7280]`}>
                      {b.quantity}
                    </td>
                    <td className={`${TD} align-middle text-center font-semibold text-[#374151]`}>{b.unit}</td>
                    <td className={`${TD} align-middle text-center tabular-nums text-[#374151]`}>
                      {shortDate(b.receivedDate)}
                    </td>
                    <td className={`${TD} align-middle text-center tabular-nums`}>
                      <ExpiryBadge expiryDate={b.expiryDate} />
                    </td>
                    <td className={`${TD} align-middle text-center`}>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                          b.status === "Active"
                            ? "bg-emerald-100 text-emerald-800"
                            : b.status === "Low Stock"
                            ? "bg-amber-100 text-amber-800"
                            : b.status === "Expired"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className={`${TD} align-middle text-[10px] text-[#374151]`}>
                      <span className="block font-medium">{b.storageLocation || "—"}</span>
                      <span className="block text-[9px] text-[#6B7280]">{b.stockSource}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

/* =========================================================================
   MAIN EXPORT (ROUTER BETWEEN SELLER & FARMER INVENTORY HISTORY)
   ========================================================================= */
export default function ManagerInventoryHistoryPage() {
  const { vendor } = useVendorAuth();
  const isSeller = vendor?.vendorType === "seller";

  if (isSeller) {
    return <SellerInventoryHistoryView />;
  }

  return <FarmerInventoryHistoryView />;
}
