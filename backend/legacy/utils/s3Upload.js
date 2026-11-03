import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import { publicImageUrl } from './imageUrlConfig.js';
import {
  ALLOWED_UPLOAD_FOLDERS,
  buildS3ObjectKey,
  normalizeUploadFolder,
} from "./uploadFolders.js";

const MIME_TO_EXT = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/ogg": "ogv",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
};

function getS3Client() {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error("AWS credentials are not configured");
  }

  return new S3Client({
    region: process.env.AWS_REGION || "ap-south-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

export function isUploadFolder(value) {
  return Boolean(normalizeUploadFolder(value));
}

export function buildCdnUrl(key) {
  return publicImageUrl(key);
}

function extensionFromMime(mimeType) {
  return MIME_TO_EXT[String(mimeType || "").toLowerCase()] || "";
}

function extensionFromName(name) {
  const match = String(name || "").match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : "";
}

export async function uploadBufferToS3({ buffer, mimeType, folder, originalName = "" }) {
  if (!process.env.AWS_BUCKET_NAME) {
    throw new Error("AWS_BUCKET_NAME is not configured");
  }

  const normalizedFolder = normalizeUploadFolder(folder);
  if (!normalizedFolder || !ALLOWED_UPLOAD_FOLDERS.has(normalizedFolder)) {
    throw new Error("Invalid upload folder");
  }

  const ext = extensionFromMime(mimeType) || extensionFromName(originalName) || "bin";
  const fileName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${ext}`;
  const key = buildS3ObjectKey(normalizedFolder, fileName);

  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimeType || "application/octet-stream",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return {
    key,
    folder: normalizedFolder,
    url: buildCdnUrl(key),
  };
}

export async function uploadDataUrlToS3(dataUrl, folder) {
  const match = String(dataUrl).match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (!match) {
    throw new Error("Invalid image data");
  }

  const mimeType = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], "base64");

  return uploadBufferToS3({ buffer, mimeType, folder });
}

export function isS3Configured() {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_BUCKET_NAME
  );
}

/**
 * Generate a presigned PUT URL so the browser can upload directly to S3.
 * Returns { uploadUrl, key, cloudFrontUrl, expiresIn }.
 */
export async function presignUpload({ mimeType, folder, originalName = "", expiresIn = 300 }) {
  if (!process.env.AWS_BUCKET_NAME) {
    throw new Error("AWS_BUCKET_NAME is not configured");
  }

  const normalizedFolder = normalizeUploadFolder(folder);
  if (!normalizedFolder || !ALLOWED_UPLOAD_FOLDERS.has(normalizedFolder)) {
    throw new Error("Invalid upload folder");
  }

  const ext = extensionFromMime(mimeType) || extensionFromName(originalName) || "bin";
  const fileName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${ext}`;
  const key = buildS3ObjectKey(normalizedFolder, fileName);

  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    ContentType: mimeType || "application/octet-stream",
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn });

  return {
    uploadUrl,
    key,
    cloudFrontUrl: buildCdnUrl(key),
    expiresIn,
  };
}
