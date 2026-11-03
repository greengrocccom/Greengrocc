import test from 'node:test';
import assert from 'node:assert/strict';
import { createCsv, extractExportDatasets, flattenExportRow, sanitizeExportValue } from './exportData.js';
import { collectDatasetRows } from './collectExport.js';
import { captureExportResponse, clearExportSources, getExportSources } from './adminExportStore.js';

test('CSV preserves quotes, commas, line breaks and Unicode while blocking formulas', () => {
  const csv = createCsv([{ Name: 'संदीप पाटील', Notes: 'a,"b"\nsecond line', Formula: '=HYPERLINK("https://bad.example")', Amount: '-12.50' }]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"संदीप पाटील"'));
  assert.ok(csv.includes('"a,""b""\nsecond line"'));
  assert.ok(csv.includes('"\'=HYPERLINK'));
  assert.ok(csv.includes('"-12.50"'));
});

test('nested business values remain readable and credentials are removed recursively', () => {
  const result = flattenExportRow({ name: 'Customer', address: { city: 'Nashik' }, password: 'hidden', fcmTokens: ['hidden'], items: [{ name: 'Rice', quantity: 2, secret: 'hidden' }], enabled: true });
  assert.equal(result['Address / City'], 'Nashik');
  assert.equal(result.Enabled, 'Yes');
  assert.ok(result.Items.includes('Name: Rice\nQuantity: 2'));
  assert.ok(!JSON.stringify(result).includes('hidden'));
  assert.deepEqual(sanitizeExportValue({ data: [{ otp: '123', name: 'Visible' }] }), { data: [{ name: 'Visible' }] });
  assert.deepEqual(flattenExportRow({ _id: 'mongo-id', id: 'business-id' }), { 'Database ID': 'mongo-id', ID: 'business-id' });
});

test('detail records retain real total and message fields; response metadata stays out', () => {
  const datasets = extractExportDatasets({ success: true, data: { _id: '1', total: 50, message: 'Delivery note', status: 'saved' } });
  assert.equal(datasets.length, 1);
  assert.equal(datasets[0].rows[0].Total, '50');
  assert.equal(datasets[0].rows[0].Message, 'Delivery note');
  assert.equal(datasets[0].rows[0].Success, undefined);
  assert.equal(extractExportDatasets({ success: true, total: 75 })[0].rows[0].Total, '75');
});

test('every page is fetched from page one and source filters are preserved', async () => {
  const payload = { items: [{ _id: '3', name: 'Third' }], total: 3, page: 2, limit: 2 };
  const dataset = extractExportDatasets(payload).find(item => !item.summary);
  const requests = [];
  const rows = await collectDatasetRows({ url: '/erp/farmers', params: { page: 2, limit: 2, q: 'farm', status: 'approved' }, payload }, dataset, async (_, config) => {
    requests.push(config.params);
    return { items: config.params.page === 1 ? [{ _id: '1' }, { _id: '2' }] : [{ _id: '3' }], total: 3, page: config.params.page, limit: 2 };
  });
  assert.equal(rows.length, 3);
  assert.deepEqual(requests.map(item => item.page), [1, 2]);
  assert.ok(requests.every(item => item.q === 'farm' && item.status === 'approved'));
});

test('an incomplete page or repeated next page fails instead of exporting partial data', async () => {
  const payload = { data: [{ _id: '1' }], pagination: { total: 3, totalPages: 3, page: 1, limit: 1 } };
  const dataset = extractExportDatasets(payload)[0];
  await assert.rejects(collectDatasetRows({ url: '/items', params: { page: 1 }, payload }, dataset, async () => payload), /next page did not load/);
  await assert.rejects(collectDatasetRows({ url: '/items', params: { page: 1 }, payload }, dataset, async (_, config) => config.params.page === 1 ? payload : { data: [], pagination: payload.pagination }), /partial file/);
});

test('lookup datasets are not paginated using an unrelated main-list total', async () => {
  const payload = { data: [{ _id: '1' }], total: 90, totalPages: 90, popularCities: ['Nashik', 'Pune'] };
  const dataset = extractExportDatasets(payload).find(item => item.path.at(-1) === 'popularCities');
  let calls = 0;
  const rows = await collectDatasetRows({ url: '/users', params: { page: 1 }, payload }, dataset, async () => { calls += 1; return payload; });
  assert.equal(rows.length, 2);
  assert.equal(calls, 1);
});

test('newly saved records export without repeating their create or update request', async () => {
  const rows = [{ Name: 'New record', Amount: '250' }];
  const result = await collectDatasetRows({ snapshot: true }, { rows }, () => { throw new Error('Write request must never be repeated'); });
  assert.deepEqual(result, rows);
});

test('capture discards stale filter responses, empty results and data from another page', () => {
  globalThis.window = { location: { pathname: '/erp/farmers', search: '' } };
  clearExportSources();
  const capture = (sequence, data, scope = '/erp/farmers') => captureExportResponse({ status: 200, data: { success: true, data }, config: { baseURL: 'http://localhost:5001/api', url: '/erp/farmers', method: 'get', exportRequestSequence: sequence, exportScope: scope } });
  capture(2, [{ name: 'New', password: 'hidden' }]);
  capture(1, [{ name: 'Stale' }]);
  assert.equal(getExportSources('/erp/farmers')[0].datasets[0].rows[0].Name, 'New');
  assert.ok(!JSON.stringify(getExportSources('/erp/farmers')).includes('hidden'));
  capture(3, []);
  capture(2, [{ name: 'Late stale response' }]);
  assert.equal(getExportSources('/erp/farmers').length, 0);
  capture(4, [{ name: 'Other page' }], '/products');
  assert.equal(getExportSources('/erp/farmers').length, 0);
  clearExportSources();
});
