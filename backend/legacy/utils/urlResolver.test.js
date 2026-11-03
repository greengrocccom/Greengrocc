import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveImageUrl, resolveImageArray, transformProductResponse } from './urlResolver.js';
import { buildCdnUrl } from './s3Upload.js';
import { buildPublicUrl } from '../../product-service/src/services/s3Upload.js';

const keys = ['CLOUDFRONT_URL', 'CLOUDFRONT_DOMAIN', 'AWS_BUCKET_NAME', 'AWS_REGION', 'WEBSITE_ASSET_URL'];
let original;
beforeEach(() => { original = Object.fromEntries(keys.map(key => [key, process.env[key]])); keys.forEach(key => delete process.env[key]); });
afterEach(() => { keys.forEach(key => { if (original[key] == null) delete process.env[key]; else process.env[key] = original[key]; }); });

test('relative object keys are trimmed and use the legacy CDN default when no storage is configured', () => {
  assert.equal(resolveImageUrl(' /images/product/123.jpg '), 'https://cdn.greengrocc.com/images/product/123.jpg');
  for (const input of [null, '', '   ', 123, {}]) assert.equal(resolveImageUrl(input), null);
});

test('production CLOUDFRONT_URL is used consistently by uploads and product responses', () => {
  process.env.CLOUDFRONT_URL = 'https://production.example.com/catalog/';
  process.env.CLOUDFRONT_DOMAIN = 'older.example.com';
  const expected = 'https://production.example.com/catalog/images/1.jpg';
  assert.equal(resolveImageUrl('images/1.jpg'), expected);
  assert.equal(buildCdnUrl('/images/1.jpg'), expected);
  assert.equal(buildPublicUrl('/images/1.jpg'), expected);
});

test('domain-only CDN configuration also works for both upload services', () => {
  process.env.CLOUDFRONT_DOMAIN = 'cdn.example.com/';
  assert.equal(resolveImageUrl('images/1.jpg'), 'https://cdn.example.com/images/1.jpg');
  assert.equal(buildCdnUrl('images/1.jpg'), resolveImageUrl('images/1.jpg'));
  assert.equal(buildPublicUrl('images/1.jpg'), resolveImageUrl('images/1.jpg'));
});

test('raw keys use the configured S3 origin when there is no CDN', () => {
  process.env.AWS_BUCKET_NAME = 'production-images';
  process.env.AWS_REGION = 'ap-south-1';
  const expected = 'https://production-images.s3.ap-south-1.amazonaws.com/images/1.jpg';
  assert.equal(resolveImageUrl('images/1.jpg'), expected);
  assert.equal(buildCdnUrl('images/1.jpg'), expected);
});

test('S3 URLs map to an explicitly configured CDN while preserving object paths', () => {
  process.env.CLOUDFRONT_URL = 'https://cdn.example.com';
  for (const host of ['images.s3.ap-south-1.amazonaws.com', 'images.s3.amazonaws.com', 'images.s3-ap-south-1.amazonaws.com']) {
    assert.equal(resolveImageUrl(`https://${host}/images/1.jpg`), 'https://cdn.example.com/images/1.jpg');
  }
});

test('existing origins and signed URLs are preserved', () => {
  const s3 = 'https://original.s3.ap-south-1.amazonaws.com/images/1.jpg';
  assert.equal(resolveImageUrl(s3), s3);
  process.env.CLOUDFRONT_URL = 'https://cdn.example.com';
  const signed = `${s3}?X-Amz-Signature=example`;
  assert.equal(resolveImageUrl(signed), signed);
  assert.equal(resolveImageUrl('https://external.example.com/a.jpg'), 'https://external.example.com/a.jpg');
});

test('image arrays remove invalid values and normalize valid keys', () => {
  process.env.CLOUDFRONT_DOMAIN = 'cdn.example.com';
  assert.deepEqual(resolveImageArray(['images/1.jpg', null, '', ' /images/2.jpg ']), ['https://cdn.example.com/images/1.jpg', 'https://cdn.example.com/images/2.jpg']);
  assert.deepEqual(resolveImageArray(null), []);
});

test('bundled category images use the website origin rather than the S3 CDN', () => {
  process.env.CLOUDFRONT_DOMAIN = 'cdn.greengrocc.com';
  for (const name of ['dairy.webp', 'fruits.webp', 'vegetables.webp']) {
    assert.equal(resolveImageUrl(`/categories/${name}`), `https://greengrocc.com/categories/${name}`);
    assert.equal(resolveImageUrl(`https://cdn.greengrocc.com/categories/${name}`), `https://greengrocc.com/categories/${name}`);
  }
});

test('website origin is configurable and uploaded category images keep their CDN origin', () => {
  process.env.WEBSITE_ASSET_URL = 'https://shop.example.com/';
  process.env.CLOUDFRONT_URL = 'https://cdn.example.com';
  assert.equal(resolveImageUrl('/categories/dairy.webp'), 'https://shop.example.com/categories/dairy.webp');
  assert.equal(resolveImageUrl('/categories/1791288723411-upload.jpg'), 'https://cdn.example.com/categories/1791288723411-upload.jpg');
  assert.equal(resolveImageUrl('https://external.example.com/categories/dairy.webp'), 'https://external.example.com/categories/dairy.webp');
});

test('base-product, variant and farmer images resolve without mutating the source', () => {
  process.env.CLOUDFRONT_URL = 'https://cdn.example.com';
  const product = { productImages: ['products/main.jpg'], baseProductImage: 'base/main.jpg', variants: [{ image: 'variants/large.jpg' }], farmerDetails: { farmerImage: 'farmers/profile.jpg' } };
  const result = transformProductResponse(product);
  assert.equal(result.baseProductImage, 'https://cdn.example.com/base/main.jpg');
  assert.equal(result.variants[0].image, 'https://cdn.example.com/variants/large.jpg');
  assert.equal(result.farmerDetails.farmerImage, 'https://cdn.example.com/farmers/profile.jpg');
  assert.equal(product.variants[0].image, 'variants/large.jpg');
  assert.equal(product.farmerDetails.farmerImage, 'farmers/profile.jpg');
});
