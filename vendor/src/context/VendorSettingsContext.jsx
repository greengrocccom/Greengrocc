import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { vendorApi } from "../api/vendorApi";
import { useVendorAuth } from "./VendorAuthContext";

export const SETTINGS_STORAGE_KEY = "greengrocc_vendor_panel_settings";

export const DEFAULT_VENDOR_SETTINGS = {
  display: {
    theme: "light",
    compactMode: false,
    autoRefreshInterval: 0,
    dateFormat: "DD/MM/YYYY",
    currency: "INR",
    defaultLandingPage: "/dashboard",
  },
  operations: {
    autoAssignDrivers: false,
    defaultBatchSize: 5,
    collectionCenterOpening: "08:00",
    collectionCenterClosing: "20:00",
    autoConfirmPreorders: false,
    requireQualityPhotos: true,
    strictGradingConfirmation: true,
  },
  notifications: {
    orderReceivedSound: true,
    emailNotifications: true,
    smsAlerts: false,
    lowStockThresholdKg: 50,
    notifyDriverArrival: true,
    notifyQualityCompleted: true,
    dailySummaryEmail: false,
  },
  security: {
    twoFactorAuth: false,
    autoLogoutMinutes: 60,
    ipRestrictionEnabled: false,
    allowedIps: "",
  },
  integrations: {
    erpWebhookUrl: "",
    exportFormat: "excel",
    realtimeSync: true,
  },
};

const VendorSettingsContext = createContext(null);

export function VendorSettingsProvider({ children }) {
  const { logout, isAuthenticated } = useVendorAuth();

  const [settings, setSettings] = useState(() => {
    try {
      const cached = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (cached) return { ...DEFAULT_VENDOR_SETTINGS, ...JSON.parse(cached) };
    } catch {}
    return DEFAULT_VENDOR_SETTINGS;
  });

  const [loading, setLoading] = useState(true);

  // Sync settings from backend upon auth
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    let isMounted = true;
    vendorApi
      .getSettings()
      .then((res) => {
        if (isMounted && res.data?.settings) {
          const merged = {
            ...DEFAULT_VENDOR_SETTINGS,
            ...res.data.settings,
            display: { ...DEFAULT_VENDOR_SETTINGS.display, ...(res.data.settings.display || {}) },
            operations: { ...DEFAULT_VENDOR_SETTINGS.operations, ...(res.data.settings.operations || {}) },
            notifications: { ...DEFAULT_VENDOR_SETTINGS.notifications, ...(res.data.settings.notifications || {}) },
            security: { ...DEFAULT_VENDOR_SETTINGS.security, ...(res.data.settings.security || {}) },
            integrations: { ...DEFAULT_VENDOR_SETTINGS.integrations, ...(res.data.settings.integrations || {}) },
          };
          setSettings(merged);
          localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
        }
      })
      .catch(() => {
        // Fall back to localStorage cached
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  // WORKABLE EFFECT 1: Theme Mode (Light / Dark / System)
  useEffect(() => {
    const theme = settings.display?.theme || "light";
    const root = document.documentElement;

    const applyTheme = (isDark) => {
      if (isDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    if (theme === "dark") {
      applyTheme(true);
    } else if (theme === "light") {
      applyTheme(false);
    } else if (theme === "system") {
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      applyTheme(mql.matches);

      const handler = (e) => applyTheme(e.matches);
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
  }, [settings.display?.theme]);

  // WORKABLE EFFECT 2: Compact Table Row Density
  useEffect(() => {
    const isCompact = Boolean(settings.display?.compactMode);
    if (isCompact) {
      document.body.classList.add("vendor-compact-tables");
    } else {
      document.body.classList.remove("vendor-compact-tables");
    }
  }, [settings.display?.compactMode]);

  // WORKABLE EFFECT 3: Idle Session Auto-Logout
  const lastActivityRef = useRef(Date.now());
  useEffect(() => {
    if (!isAuthenticated) return;
    const minutes = Number(settings.security?.autoLogoutMinutes || 0);
    if (minutes <= 0) return; // Disabled

    const onActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));

    const interval = setInterval(() => {
      const idleTimeMs = Date.now() - lastActivityRef.current;
      const maxIdleMs = minutes * 60 * 1000;
      if (idleTimeMs >= maxIdleMs) {
        clearInterval(interval);
        toast("Session expired due to inactivity", { icon: "🔒" });
        logout();
      }
    }, 15000); // Check every 15s

    return () => {
      clearInterval(interval);
      events.forEach((ev) => window.removeEventListener(ev, onActivity));
    };
  }, [isAuthenticated, settings.security?.autoLogoutMinutes, logout]);

  // WORKABLE AUDIO: Play chime sound for incoming order/pickup alert
  const playOrderAlert = () => {
    if (!settings.notifications?.orderReceivedSound) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5

      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch {}
  };

  // WORKABLE HELPER: Format date string by chosen standard
  const formatDate = (val) => {
    if (!val) return "—";
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val);
      const fmt = settings.display?.dateFormat || "DD/MM/YYYY";
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      if (fmt === "YYYY-MM-DD") return `${year}-${month}-${day}`;
      if (fmt === "DD MMM YYYY") return `${day} ${monthNames[d.getMonth()]} ${year}`;
      return `${day}/${month}/${year}`;
    } catch {
      return String(val);
    }
  };

  // WORKABLE HELPER: Check if collection center is currently open
  const isCentreOpen = () => {
    try {
      const opening = settings.operations?.collectionCenterOpening || "08:00";
      const closing = settings.operations?.collectionCenterClosing || "20:00";
      const now = new Date();
      const [openH, openM] = opening.split(":").map(Number);
      const [closeH, closeM] = closing.split(":").map(Number);

      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
    } catch {
      return true;
    }
  };

  // Save changes to backend and update state immediately
  const saveSettings = async (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
    try {
      const res = await vendorApi.updateSettings(newSettings);
      if (res.data?.settings) {
        setSettings(res.data.settings);
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(res.data.settings));
      }
      return { success: true };
    } catch (err) {
      console.warn("Settings saved locally, server sync failed:", err.message);
      return { success: false, error: err };
    }
  };

  const resetSettings = () => {
    setSettings(DEFAULT_VENDOR_SETTINGS);
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_VENDOR_SETTINGS));
    vendorApi.updateSettings(DEFAULT_VENDOR_SETTINGS).catch(() => {});
  };

  const value = useMemo(
    () => ({
      settings,
      setSettings,
      loading,
      saveSettings,
      resetSettings,
      playOrderAlert,
      formatDate,
      isCentreOpen,
      lowStockThresholdKg: settings.notifications?.lowStockThresholdKg || 50,
      autoRefreshInterval: settings.display?.autoRefreshInterval || 0,
      compactMode: settings.display?.compactMode || false,
      theme: settings.display?.theme || "light",
      defaultLandingPage: settings.display?.defaultLandingPage || "/dashboard",
    }),
    [settings, loading]
  );

  return <VendorSettingsContext.Provider value={value}>{children}</VendorSettingsContext.Provider>;
}

export function useVendorSettings() {
  const ctx = useContext(VendorSettingsContext);
  if (!ctx) throw new Error("useVendorSettings must be used within VendorSettingsProvider");
  return ctx;
}
