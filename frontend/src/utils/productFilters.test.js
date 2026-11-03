import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractWeightsAndSizes, filterAndSortProducts, productWeight, readProductFilters } from './productFilters.js';

const products = [
  { _id: 'a', name: 'Rice 2 kg', brandName: 'Farm', price: 200, discountedPrice: 100, discountedPercent: 50, stock: 4, createdAt: '2026-11-01' },
  { _id: 'b', name: 'Rice 500 g', brandName: 'Farm', price: 100, discountedPrice: 80, discountedPercent: 20, stock: 0, inStock: true, createdAt: '2026-10-01' },
  { _id: 'c', name: 'Milk 250 ml', brandName: 'Dairy', price: 50, discountedPrice: 50, stock: 8, createdAt: '2026-11-02' },
];
const filters = changes => ({ ...readProductFilters(new URLSearchParams()), ...changes });
const ids = list => list.map(product => product._id);

test('combined mobile filters apply brand, price, discount, size and stock', () => {
  assert.deepEqual(ids(filterAndSortProducts(products, filters({ selectedBrand: 'farm', minPrice: '90', maxPrice: '150', minDiscount: '30', weightSize: '2 kg', inStock: true }))), ['a']);
});

test('stock quantity takes precedence over an outdated inStock flag', () => {
  assert.deepEqual(ids(filterAndSortProducts(products, filters({ inStock: true }))), ['c', 'a']);
});

test('weight ordering normalizes kg, g, litres and ml like the mobile app', () => {
  assert.equal(productWeight({ name: 'Water 1.5 l' }), 1500);
  assert.deepEqual(ids(filterAndSortProducts(products, filters({ sortBy: 'weight-asc' }))), ['c', 'b', 'a']);
  assert.deepEqual(ids(filterAndSortProducts(products, filters({ sortBy: 'weight-desc' }))), ['a', 'b', 'c']);
});

test('discount ordering includes undiscounted products and does not mutate the source', () => {
  assert.deepEqual(ids(filterAndSortProducts(products, filters({ sortBy: 'discount-asc' }))), ['c', 'b', 'a']);
  assert.deepEqual(ids(products), ['a', 'b', 'c']);
});

test('weight and size choices include variants, subcategories and product names', () => {
  assert.deepEqual(extractWeightsAndSizes([{ name: 'Rice 2 kg', subcategory: '500 g', variants: [{ name: '1 kg' }, { name: '1 kg' }] }]), ['1 kg', '2 kg', '500 g']);
});

test('reading filter URLs supports brand pages and keeps defaults', () => {
  const values = readProductFilters(new URLSearchParams('brandName=Farm&minDiscount=20&weightSize=2+kg&inStock=true'));
  assert.equal(values.selectedBrand, 'Farm');
  assert.equal(values.sortBy, 'newest');
  assert.equal(values.weightSize, '2 kg');
  assert.equal(values.inStock, true);
});
