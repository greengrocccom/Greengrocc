import { useCallback, useState } from "react";
import { getActiveAuthToken, staffApi } from "../api/staffApi";
import { useLive } from "../realtime/useLive";

export function useInventoryRequests(params = {}) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const storeIdParam = params?.storeId || "";

  const load = useCallback(async () => {
    const token = getActiveAuthToken();
    if (!token) {
      setRequests([]);
      setLoading(false);
      return;
    }

    try {
      const q = storeIdParam ? { storeId: storeIdParam } : {};
      const res = await staffApi.inventoryRequests(q);
      setRequests(Array.isArray(res.data?.requests) ? res.data.requests : []);
      setError("");
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setRequests([]);
        setError("");
        return;
      }
      setError(err.response?.data?.message || "Failed to load inventory requests");
    } finally {
      setLoading(false);
    }
  }, [storeIdParam]);

  useLive(load, [load]);

  return { requests, loading, error, reload: load };
}
