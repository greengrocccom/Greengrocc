import { extractExportDatasets, readableLabel, sanitizeExportValue } from './exportData.js';

const sources = new Map();
const latest = new Map();
let generation = 0;
const listeners = new Set();
const EXCLUDED = /\/(?:auth|login|logout|search)(?:\/|$)|\/notifications\/(?:system-alerts|inbox-summary)|\/erp\/modules|\/me(?:\?|$)/i;
export const currentExportScope = () => `${window.location.pathname}${window.location.search}`;
export const exportCaptureGeneration = () => generation;
export const subscribeExportSources = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export const getExportSources = scope => [...sources.values()].filter(source => source.scope === scope);
export function clearExportSources() { sources.clear(); latest.clear(); generation += 1; listeners.forEach(listener => listener()); }

export function captureExportResponse(response) {
  const config = response.config;
  if (config?.exportGeneration != null && config.exportGeneration !== generation) return;
  const method = String(config?.method || 'get').toLowerCase();
  if (config?.exportCapture === false || !['get', 'post', 'put', 'patch'].includes(method) || response.status >= 400 || !response.data || typeof response.data !== 'object' || response.data instanceof Blob) return;
  const snapshot = method !== 'get';
  const url = new URL(/^https?:\/\//.test(config.url) ? config.url : `${(config.baseURL || '').replace(/\/$/, '')}/${config.url.replace(/^\//, '')}`, window.location.origin);
  if (EXCLUDED.test(url.pathname)) return;
  const scope = config.exportScope || currentExportScope();
  if (scope !== currentExportScope()) return;
  const params = Object.fromEntries(new URLSearchParams(url.search));
  Object.assign(params, config.params || {});
  const label = readableLabel(url.pathname.split('/').filter(Boolean).slice(-2).join(' / '));
  const payload = sanitizeExportValue(response.data);
  const datasets = extractExportDatasets(payload, label);
  // Keep the latest filter selection per endpoint; pages are fetched afresh on export.
  const key = `${scope}|${url.pathname}${snapshot ? '|saved' : ''}`;
  if ((latest.get(key) || 0) > (config.exportRequestSequence || 0)) return;
  latest.set(key, config.exportRequestSequence || 0);
  while (latest.size > 200) latest.delete(latest.keys().next().value);
  if (!datasets.length) sources.delete(key);
  else sources.set(key, { key, scope, url: config.url, params, payload, label, datasets, snapshot, sequence: config.exportRequestSequence });
  while (sources.size > 80) sources.delete(sources.keys().next().value);
  listeners.forEach(listener => listener());
}
