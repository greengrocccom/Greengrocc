const PRIVATE_KEY = /password|passwd|secret|token|authorization|private.?key|api.?key|credential|(?:^|_)otp|^salt$|^hash$/i;
const META_KEYS = new Set(['success', 'message', 'pagination', 'total', 'totalPages', 'page', 'limit', 'hasMore', 'hasNextPage', '__v']);

export function readableLabel(value = '') {
  if (value === '_id') return 'Database ID';
  if (value === 'id') return 'ID';
  return String(value).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_./-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()).trim();
}

export function sanitizeExportValue(value) {
  if (Array.isArray(value)) return value.map(sanitizeExportValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !PRIVATE_KEY.test(key) && key !== '__v').map(([key, item]) => [key, sanitizeExportValue(item)]));
  return value;
}

export function formatExportValue(value) {
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map((item, index) => typeof item === 'object' && item ? `${index + 1}. ${formatExportValue(item)}` : formatExportValue(item)).join('\n');
  if (typeof value === 'object') return Object.entries(value).map(([key, item]) => `${readableLabel(key)}: ${formatExportValue(item)}`).join('\n');
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && Number.isFinite(Date.parse(value))) return new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
  return String(value);
}

export function flattenExportRow(value, prefix = '', output = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { Value: formatExportValue(value) };
  for (const [key, item] of Object.entries(sanitizeExportValue(value))) {
    let label = prefix ? `${prefix} / ${readableLabel(key)}` : readableLabel(key);
    if (Object.hasOwn(output, label)) label += ` (${key})`;
    if (item && typeof item === 'object' && !Array.isArray(item)) flattenExportRow(item, label, output);
    else output[label] = formatExportValue(item);
  }
  return output;
}

export function extractExportDatasets(payload, title = 'Records') {
  const datasets = [];
  function visit(value, path, label) {
    if (Array.isArray(value)) {
      if (value.length) datasets.push({ path, title: label || title, rows: value.map(item => flattenExportRow(item)), count: value.length });
      return;
    }
    if (!value || typeof value !== 'object') return;
    const envelope = !value._id && (value.pagination || Array.isArray(value.items) || Array.isArray(value.data));
    const entries = Object.entries(value).filter(([key]) => key !== '__v' && (!envelope || !META_KEYS.has(key)) && !(value.success != null && !value._id && ['success', 'message'].includes(key)) && !PRIVATE_KEY.test(key));
    const scalars = Object.fromEntries(entries.filter(([, item]) => item == null || typeof item !== 'object'));
    if (Object.keys(scalars).length) datasets.push({ path, title: label || title, rows: [flattenExportRow(scalars)], count: 1, summary: true });
    for (const [key, item] of entries) {
      if (item && typeof item === 'object') visit(item, [...path, key], ['data', 'items', 'results', 'rows', 'records'].includes(key) ? label || title : `${label ? `${label} / ` : ''}${readableLabel(key)}`);
    }
  }
  visit(sanitizeExportValue(payload), [], '');
  return datasets;
}

export function paginationInfo(payload) {
  const meta = [payload?.pagination, payload?.data?.pagination, payload?.meta?.pagination, payload?.meta, payload?.data, payload].find(value => value && !Array.isArray(value) && ['page', 'currentPage', 'total', 'totalRecords', 'totalItems', 'totalPages', 'pages', 'hasMore', 'hasNextPage'].some(key => value[key] != null)) || {};
  return { page: Number(meta.page ?? meta.currentPage ?? payload?.page) || 1, limit: Number(meta.limit ?? meta.pageSize ?? payload?.limit) || 0, total: Number(meta.total ?? meta.totalRecords ?? meta.totalItems ?? payload?.total) || 0, totalPages: Number(meta.totalPages ?? meta.pages ?? payload?.totalPages) || 0, hasMore: Boolean(meta.hasMore ?? meta.hasNextPage ?? payload?.hasMore) };
}

export function valueAtPath(payload, path) { return path.reduce((value, key) => value?.[key], payload); }

export function exportColumns(rows) { return [...new Set(rows.flatMap(row => Object.keys(row)))]; }

export function csvCell(value) {
  let text = formatExportValue(value);
  if ((/^[\s]*[=+\-@]/.test(text) && !/^-\d+(?:\.\d+)?$/.test(text)) || /^[\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function createCsv(rows) {
  const columns = exportColumns(rows);
  return '\uFEFF' + [columns.map(csvCell).join(','), ...rows.map(row => columns.map(column => csvCell(row[column])).join(','))].join('\r\n') + '\r\n';
}

export function exportFilename(title, extension, date = new Date()) {
  const day = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  return `GreenGrocc-${title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'Export'}-${day}.${extension}`;
}

export function downloadExport(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
