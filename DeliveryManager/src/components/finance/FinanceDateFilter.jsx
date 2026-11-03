import { useState, useEffect } from "react";

export const PRESET_OPTIONS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7", label: "Last 7 Days" },
  { id: "last15", label: "Last 15 Days" },
  { id: "last30", label: "Last 30 Days" },
  { id: "thisMonth", label: "This Month" },
  { id: "lastMonth", label: "Last Month" },
  { id: "thisYear", label: "This Year" },
  { id: "selectMonth", label: "Select Month" },
  { id: "selectYear", label: "Select Year" },
  { id: "custom", label: "Custom Range" },
  { id: "all", label: "All Time" },
];

const MONTHS = [
  { val: "01", label: "January" },
  { val: "02", label: "February" },
  { val: "03", label: "March" },
  { val: "04", label: "April" },
  { val: "05", label: "May" },
  { val: "06", label: "June" },
  { val: "07", label: "July" },
  { val: "08", label: "August" },
  { val: "09", label: "September" },
  { val: "10", label: "October" },
  { val: "11", label: "November" },
  { val: "12", label: "December" },
];

export default function FinanceDateFilter({
  preset = "today",
  startDate = "",
  endDate = "",
  onFilterChange,
}) {
  const currentYear = new Date().getFullYear();
  const [selectedPreset, setSelectedPreset] = useState(preset);
  const [customStart, setCustomStart] = useState(startDate);
  const [customEnd, setCustomEnd] = useState(endDate);
  const [monthVal, setMonthVal] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [yearVal, setYearVal] = useState(String(currentYear));

  useEffect(() => {
    if (preset) setSelectedPreset(preset);
  }, [preset]);

  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  const handlePresetClick = (id) => {
    setSelectedPreset(id);
    if (id === "selectMonth") {
      applyMonthFilter(monthVal, yearVal);
    } else if (id === "selectYear") {
      applyYearFilter(yearVal);
    } else if (id !== "custom") {
      onFilterChange({
        preset: id,
        startDate: "",
        endDate: "",
      });
    }
  };

  const applyCustomRange = () => {
    if (!customStart || !customEnd) return;
    onFilterChange({
      preset: "custom",
      startDate: customStart,
      endDate: customEnd,
    });
  };

  const resetFilter = () => {
    setSelectedPreset("today");
    setCustomStart("");
    setCustomEnd("");
    onFilterChange({
      preset: "today",
      startDate: "",
      endDate: "",
    });
  };

  const applyMonthFilter = (m, y) => {
    const lastDay = new Date(Number(y), Number(m), 0).getDate();
    onFilterChange({
      preset: "custom",
      startDate: `${y}-${m}-01`,
      endDate: `${y}-${m}-${String(lastDay).padStart(2, "0")}`,
    });
  };

  const applyYearFilter = (y) => {
    onFilterChange({
      preset: "custom",
      startDate: `${y}-01-01`,
      endDate: `${y}-12-31`,
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs space-y-2.5">
      {/* Preset Pills */}
      <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
        {PRESET_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => handlePresetClick(opt.id)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition ${
              selectedPreset === opt.id
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Select Month Dropdowns */}
      {selectedPreset === "selectMonth" && (
        <div className="flex items-center gap-2 pt-1">
          <select
            value={monthVal}
            onChange={(e) => {
              setMonthVal(e.target.value);
              applyMonthFilter(e.target.value, yearVal);
            }}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
          >
            {MONTHS.map((m) => (
              <option key={m.val} value={m.val}>
                {m.label}
              </option>
            ))}
          </select>

          <select
            value={yearVal}
            onChange={(e) => {
              setYearVal(e.target.value);
              applyMonthFilter(monthVal, e.target.value);
            }}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Select Year Dropdowns */}
      {selectedPreset === "selectYear" && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs font-semibold text-slate-500">Year:</span>
          <select
            value={yearVal}
            onChange={(e) => {
              setYearVal(e.target.value);
              applyYearFilter(e.target.value);
            }}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Custom Date Range Controls */}
      {selectedPreset === "custom" && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span>From:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-800"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span>To:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-800"
            />
          </div>
          <button
            type="button"
            onClick={applyCustomRange}
            className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 transition"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={resetFilter}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

