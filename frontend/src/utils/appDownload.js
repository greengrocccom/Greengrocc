const PROMPT_DISMISSED_KEY = "bmm_app_download_prompt_dismissed";

export const PLAY_STORE_APP_URL =
  "https://play.google.com/store/apps/details?id=com.greengrocc.userapp&pcampaignid=web_share";

export function getAndroidAppDownloadUrl() {
  const configured = String(import.meta.env.VITE_ANDROID_APP_DOWNLOAD_URL || "").trim();
  if (configured) return configured;
  return PLAY_STORE_APP_URL;
}

export function shouldOfferAppDownload() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return false;
  return true;
}

export function hasDismissedAppDownloadPrompt() {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(PROMPT_DISMISSED_KEY) === "1";
}

export function dismissAppDownloadPrompt() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(PROMPT_DISMISSED_KEY, "1");
}

export function downloadAndroidApp() {
  const url = getAndroidAppDownloadUrl();
  const isExternal = /^https?:\/\//i.test(url);

  if (isExternal) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  const link = document.createElement("a");
  link.href = url;
  link.download = "GreenGrocc.apk";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
