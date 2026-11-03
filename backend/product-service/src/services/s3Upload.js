import { randomBytes } from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { publicImageUrl } from '../../../legacy/utils/imageUrlConfig.js';

const BUCKET_NAME = () => process.env.AWS_BUCKET_NAME || "";
const REGION = () => process.env.AWS_REGION || "ap-south-1";
// Keys are unique per upload and never overwritten, so objects can be cached indefinitely.
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

export function assertS3Configured() {
  if (!BUCKET_NAME()) throw new Error("AWS_BUCKET_NAME is not configured in backend/.env");
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error("AWS credentials are not configured in backend/.env");
  }
}

export function getS3Client() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("AWS credentials are not configured. Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in backend/.env");
  }
  return new S3Client({
    region: REGION(),
    credentials: { accessKeyId, secretAccessKey },
  });
}

export function buildPublicUrl(s3Key) {
  return publicImageUrl(s3Key);
}

/** Uploads under `<folder>/<timestamp>-<random><ext>` and returns `{ url, key }`. */
export async function uploadBufferToS3({ buffer, folder, ext, contentType, client = getS3Client() }) {
  const key = `${folder}/${Date.now()}-${randomBytes(16).toString("hex")}${ext}`;
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME(),
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: IMMUTABLE_CACHE_CONTROL,
    })
  );
  return { url: buildPublicUrl(key), key };
}
