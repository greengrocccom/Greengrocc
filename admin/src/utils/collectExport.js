import { extractExportDatasets, flattenExportRow, paginationInfo, valueAtPath } from './exportData.js';

export async function collectDatasetRows(source, dataset, request, { signal, onProgress = () => {} } = {}) {
  if (source.snapshot) return dataset.rows;
  const params = { ...source.params };
  const original = paginationInfo(source.payload);
  const candidates = (source.datasets || extractExportDatasets(source.payload)).filter(item => !item.summary);
  const primary = candidates.find(item => ['data', 'items', 'results', 'rows', 'records'].includes(item.path.at(-1))) || candidates.find(item => !/popular|options|filters/i.test(item.path.join('.')));
  const primaryPath = primary && JSON.stringify(primary.path) === JSON.stringify(dataset.path);
  const paginated = !dataset.summary && primaryPath && (original.totalPages > 1 || original.hasMore || original.total > dataset.rows.length || params.page != null);
  if (paginated) params.page = 1;
  const rows = [];
  let expected = 0;
  let previousPage = '';
  for (let page = 1; ; page += 1) {
    signal?.throwIfAborted();
    const payload = await request(source.url, { params: { ...params, ...(paginated ? { page } : {}) }, signal });
    const raw = valueAtPath(payload, dataset.path);
    if (dataset.summary) {
      // Summary datasets intentionally contain only scalar fields, not a second copy of child lists.
      return extractExportDatasets(payload, source.label).find(item => item.summary && JSON.stringify(item.path) === JSON.stringify(dataset.path))?.rows || [];
    }
    if (!Array.isArray(raw)) throw new Error('The selected data changed. Close export and try again.');
    const info = paginationInfo(payload);
    const fingerprint = JSON.stringify(raw);
    if (page > 1 && raw.length && fingerprint === previousPage) throw new Error('The next page did not load. No partial file was exported. Please retry.');
    previousPage = fingerprint;
    rows.push(...raw.map(row => flattenExportRow(row)));
    expected = paginated ? info.total || original.total : 0;
    onProgress(rows.length, expected);
    const totalPages = info.totalPages || original.totalPages || (expected && (info.limit || raw.length || params.limit) ? Math.ceil(expected / (info.limit || raw.length || params.limit)) : 0);
    if (!paginated || (totalPages && page >= totalPages) || (expected && rows.length >= expected) || (!totalPages && !info.hasMore && (!expected || !raw.length))) break;
    if (!raw.length) throw new Error('Some records could not be loaded. No partial file was exported.');
  }
  if (expected && rows.length < expected) throw new Error(`Only ${rows.length} of ${expected} records loaded. No partial file was exported.`);
  return rows;
}

export function captureVisibleTables(root) {
  if (!root) return [];
  return [...root.querySelectorAll('table')].filter(table => table.getClientRects().length).map((table, index) => {
    const headers = [...table.querySelectorAll('thead tr:last-child th')].map(cell => cell.textContent.trim());
    const rows = [...table.querySelectorAll('tbody tr')].filter(row => row.getClientRects().length && !row.querySelector('[colspan]')).map(row => {
      const output = {};
      [...row.cells].forEach((cell, column) => {
        const label = headers[column] || `Column ${column + 1}`;
        if (/^(actions?|trace|select|edit|delete)$/i.test(label) || (!headers[column] && cell.querySelector('button,input[type=checkbox]'))) return;
        output[label] = cell.innerText?.trim() || cell.textContent.trim();
      });
      return output;
    }).filter(row => Object.values(row).some(Boolean));
    return { title: table.querySelector('caption')?.textContent.trim() || `Table ${index + 1}`, rows };
  }).filter(dataset => dataset.rows.length);
}
