export function configuredCdnBase() {
  const value = (process.env.CLOUDFRONT_URL || process.env.CLOUDFRONT_DOMAIN || '').trim().replace(/\/+$/, '');
  return value ? (/^https?:\/\//i.test(value) ? value : `https://${value}`) : null;
}

export function publicImageUrl(key) {
  const cleanKey = String(key || '').trim().replace(/^\/+/, '');
  const cdn = configuredCdnBase();
  if (cdn) return `${cdn}/${cleanKey}`;
  if (process.env.AWS_BUCKET_NAME) {
    return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${cleanKey}`;
  }
  return `https://cdn.greengrocc.com/${cleanKey}`;
}
