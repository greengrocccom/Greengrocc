const STORAGE_KEY = 'greengrocc_admin_theme';

export function getAdminTheme() {
  return document.documentElement.dataset.adminTheme === 'dark' ? 'dark' : 'light';
}

export function setAdminTheme(theme) {
  const selected = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.adminTheme = selected;
  try {
    localStorage.setItem(STORAGE_KEY, selected);
  } catch {
    // Apply the theme for this session even if browser storage is unavailable.
  }
  return selected;
}

export function initializeAdminTheme() {
  try {
    document.documentElement.dataset.adminTheme =
      localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    document.documentElement.dataset.adminTheme = 'light';
  }
}
