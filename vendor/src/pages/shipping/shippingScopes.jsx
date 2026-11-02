import { useCallback, useMemo, useState } from "react";
import { MapPinned, RotateCcw, Store } from "lucide-react";

const RULE_KEYS = ["quantityRules", "userRules", "pincodeRules", "categoryRules", "weightRules", "stateRules", "packagingRules"];
export const DEFAULT_SCOPE = "default";

const EMPTY_RULES = {
  quantityRules: { enabled: true, baseCost: 30, freeAboveQuantity: 15, perExtraItemFee: 5, slabs: [] },
  userRules: { enabled: true, defaultCost: 40, userTypes: [] },
  pincodeRules: { enabled: true, defaultCost: 50, pincodes: [] },
  categoryRules: { enabled: true, defaultCost: 30, categories: [] },
  weightRules: { enabled: true, baseWeightKg: 1, baseCost: 30, costPerExtraKg: 15, slabs: [] },
  stateRules: { enabled: true, defaultCost: 90, states: [] },
  packagingRules: { enabled: true, baseCost: 15, freeAboveOrderAmount: 499, perExtraItemFee: 2, slabs: [] },
};

const clone = (value) => JSON.parse(JSON.stringify(value ?? {}));
const rulesOf = (source) =>
  Object.fromEntries(RULE_KEYS.map((key) => [key, source?.[key] || clone(EMPTY_RULES[key])]));

/**
 * Rule sets keyed by scope: "default" (vendor-wide), "zone:<zoneId>", "store:<storeId>".
 * A zone/store without its own entry inherits store → zone → vendor default.
 */
export function useShippingScopes() {
  const [isActive, setIsActive] = useState(true);
  const [rulesByScope, setRulesByScope] = useState(() => ({ [DEFAULT_SCOPE]: clone(EMPTY_RULES) }));
  const [scopes, setScopes] = useState({ zones: [], stores: [] });
  const [scopeKey, setScopeKey] = useState(DEFAULT_SCOPE);

  const storeById = useMemo(() => new Map(scopes.stores.map((s) => [s.id, s])), [scopes.stores]);
  const zoneById = useMemo(() => new Map(scopes.zones.map((z) => [z.id, z])), [scopes.zones]);

  const inheritedKey = useCallback(
    (key, map) => {
      if (key.startsWith("store:")) {
        const zoneId = storeById.get(key.slice(6))?.zoneId;
        if (zoneId && map[`zone:${zoneId}`]) return `zone:${zoneId}`;
      }
      return DEFAULT_SCOPE;
    },
    [storeById]
  );

  const load = useCallback((data, nextScopes) => {
    const map = { [DEFAULT_SCOPE]: rulesOf(data) };
    for (const o of data?.overrides || []) {
      map[`${o.scope}:${o.targetId}`] = { ...rulesOf(o), isActive: o.isActive !== false };
    }
    setRulesByScope(map);
    setIsActive(data?.isActive !== false);
    const zones = nextScopes?.zones || [];
    const stores = nextScopes?.stores || [];
    setScopes({ zones, stores });
    setScopeKey((key) =>
      zones.some((z) => key === `zone:${z.id}`) || stores.some((s) => key === `store:${s.id}`) ? key : DEFAULT_SCOPE
    );
  }, []);

  const isCustom = scopeKey === DEFAULT_SCOPE || Boolean(rulesByScope[scopeKey]);
  const sourceKey = isCustom ? scopeKey : inheritedKey(scopeKey, rulesByScope);
  const config = useMemo(
    () => (isCustom ? rulesByScope[scopeKey] : clone(rulesByScope[sourceKey])) || clone(EMPTY_RULES),
    [isCustom, rulesByScope, scopeKey, sourceKey]
  );

  const setConfig = useCallback(
    (next) =>
      setRulesByScope((prev) => {
        const current = prev[scopeKey] || clone(prev[inheritedKey(scopeKey, prev)]);
        return { ...prev, [scopeKey]: typeof next === "function" ? next(current) : next };
      }),
    [scopeKey, inheritedKey]
  );

  const resetScope = useCallback(() => {
    if (scopeKey === DEFAULT_SCOPE) return;
    setRulesByScope((prev) => {
      const next = { ...prev };
      delete next[scopeKey];
      return next;
    });
  }, [scopeKey]);

  const scopeLabel = useCallback(
    (key) => {
      if (key === DEFAULT_SCOPE) return "All zones & dark stores";
      if (key.startsWith("zone:")) return `Zone: ${zoneById.get(key.slice(5))?.name || "Unknown"}`;
      return storeById.get(key.slice(6))?.name || "Dark store";
    },
    [zoneById, storeById]
  );

  const payload = useCallback(
    () => ({
      isActive,
      ...rulesOf(rulesByScope[DEFAULT_SCOPE]),
      overrides: Object.entries(rulesByScope)
        .filter(([key]) => key !== DEFAULT_SCOPE)
        .map(([key, rules]) => {
          const [scope, ...rest] = key.split(":");
          return { scope, targetId: rest.join(":"), isActive: rules.isActive !== false, ...rulesOf(rules) };
        }),
    }),
    [isActive, rulesByScope]
  );

  return {
    config,
    setConfig,
    isActive,
    setIsActive,
    scopes,
    scopeKey,
    setScopeKey,
    isCustom,
    sourceKey,
    resetScope,
    scopeLabel,
    rulesByScope,
    load,
    payload,
  };
}

/** "Applies to" selector: vendor default, each approved zone and the dark stores inside it. */
export function ShippingScopePicker({ state }) {
  const { scopes, scopeKey, setScopeKey, isCustom, sourceKey, resetScope, scopeLabel, rulesByScope, isActive, setIsActive } = state;
  const customMark = (key) => (rulesByScope[key] ? " • custom" : "");
  const storesInZone = (zoneId) => scopes.stores.filter((s) => s.zoneId === zoneId);
  const unzoned = scopes.stores.filter((s) => !s.zoneId || !scopes.zones.some((z) => z.id === s.zoneId));
  const isStore = scopeKey.startsWith("store:");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex-1">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Applies to
          </label>
          <select
            value={scopeKey}
            onChange={(e) => setScopeKey(e.target.value)}
            className="w-full max-w-lg rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-600"
          >
            <option value={DEFAULT_SCOPE}>All zones & dark stores (default rules)</option>
            {scopes.zones.map((zone) => (
              <optgroup key={zone.id} label={`${zone.name}${zone.state ? ` · ${zone.state}` : ""}`}>
                <option value={`zone:${zone.id}`}>Whole zone: {zone.name}{customMark(`zone:${zone.id}`)}</option>
                {storesInZone(zone.id).map((store) => (
                  <option key={store.id} value={`store:${store.id}`}>
                    ↳ {store.name}{store.city ? ` (${store.city})` : ""}{customMark(`store:${store.id}`)}
                  </option>
                ))}
              </optgroup>
            ))}
            {unzoned.length ? (
              <optgroup label="Dark stores without a zone">
                {unzoned.map((store) => (
                  <option key={store.id} value={`store:${store.id}`}>
                    {store.name}{store.city ? ` (${store.city})` : ""}{customMark(`store:${store.id}`)}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded text-emerald-700"
          />
          Use these rules at checkout
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {scopeKey === DEFAULT_SCOPE ? (
          <span className="text-slate-500">
            Default rules for every zone and dark store that has no custom rules of its own.
          </span>
        ) : isCustom ? (
          <>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">
              {isStore ? <Store className="h-3 w-3" /> : <MapPinned className="h-3 w-3" />}
              Custom rules for {scopeLabel(scopeKey)}
            </span>
            <button
              type="button"
              onClick={resetScope}
              className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-rose-600"
            >
              <RotateCcw className="h-3 w-3" /> Use inherited rules
            </button>
          </>
        ) : (
          <span className="text-amber-700">
            Showing rules inherited from <b>{scopeLabel(sourceKey)}</b>. Any change creates custom rules for{" "}
            {isStore ? "this dark store" : "this zone"}.
          </span>
        )}
        {!scopes.zones.length && !scopes.stores.length ? (
          <span className="text-slate-500">No approved zones or dark stores yet — rules apply once they are approved.</span>
        ) : null}
        {!isActive ? (
          <span className="font-semibold text-rose-700">
            Off — checkout uses the platform default delivery charges for these dark stores.
          </span>
        ) : null}
      </div>
    </div>
  );
}
