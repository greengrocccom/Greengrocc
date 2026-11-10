import { useEffect, useState } from "react";
import api from "../../api/api";
import { POLICY_DEFAULTS_UPDATED } from "../../data/policyDefaults";
import PolicyBody from "./PolicyBody";

/** Title fallbacks for policies saved before they were linked to a page. */
const TITLE_PATTERNS = {
  privacy: /privacy\s*policy|^privacy\b/i,
  terms: /terms/i,
  refund: /refund|return/i,
  shipping: /shipping|delivery\s*policy/i,
};

export function findLivePolicy(list, pageKey) {
  const rows = Array.isArray(list) ? list : [];
  const pattern = TITLE_PATTERNS[pageKey];
  return (
    rows.find((row) => row.pageKey === pageKey) ||
    (pattern ? rows.find((row) => !row.pageKey && pattern.test(String(row.title || ""))) : null) ||
    null
  );
}

/** Customer legal page whose content comes from Admin → Policy Management → Users. */
export default function PolicyPage({ pageKey, defaultTitle, fallbackBody }) {
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/api/admin-ops/policies/live", {
          params: { role: "customer" },
        });
        if (!cancelled) setPolicy(findLivePolicy(res.data?.data, pageKey));
      } catch {
        if (!cancelled) setPolicy(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pageKey]);

  const title = policy?.title?.trim() || defaultTitle;
  const body = policy?.body?.trim() || fallbackBody;
  const updatedLabel = policy?.updatedAt
    ? new Date(policy.updatedAt).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : POLICY_DEFAULTS_UPDATED;

  return (
    <div className="info-page legal-page">
      <section className="page-hero-section px-3 sm:px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="page-title">{title}</h1>
          {!loading ? <p className="text-text-secondary">Last updated: {updatedLabel}</p> : null}
        </div>
      </section>

      <section className="legal-content px-3 sm:px-4 pb-16 sm:pb-20">
        <div className="max-w-4xl mx-auto text-text-secondary leading-relaxed">
          {loading ? <p>Loading {defaultTitle.toLowerCase()}…</p> : <PolicyBody text={body} />}
        </div>
      </section>
    </div>
  );
}
