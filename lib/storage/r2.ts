import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { requiredEnv } from "@/lib/env";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

let client: S3Client | undefined;

function r2() {
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${requiredEnv("CLOUDFLARE_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
  return client;
}

export function validateUpload(contentType: string, bytes: number) {
  if (!ALLOWED_TYPES.has(contentType)) throw new Error("Use a PDF, JPEG, or PNG file");
  if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > MAX_UPLOAD_BYTES) {
    throw new Error("Files must be between 1 byte and 100 MB");
  }
}

export function uploadObjectKey(accountId: string, fileName: string): string {
  const extension = fileName.toLowerCase().match(/\.(pdf|jpe?g|png)$/)?.[1] || "bin";
  return `accounts/${accountId}/uploads/${crypto.randomUUID()}.${extension}`;
}

export async function presignUpload(objectKey: string, contentType: string, bytes: number) {
  const bucket = requiredEnv("R2_BUCKET");
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: contentType,
    ContentLength: bytes,
    Metadata: { "paperclean-retention": "seven-days" },
  });
  return getSignedUrl(r2(), command, { expiresIn: 10 * 60 });
}

export async function verifyUpload(objectKey: string, expectedBytes: number) {
  const response = await r2().send(
    new HeadObjectCommand({ Bucket: requiredEnv("R2_BUCKET"), Key: objectKey }),
  );
  if (response.ContentLength !== expectedBytes) throw new Error("Uploaded file size did not match");
  return response;
}

export async function presignDownload(objectKey: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 180);
  return getSignedUrl(
    r2(),
    new GetObjectCommand({
      Bucket: requiredEnv("R2_BUCKET"),
      Key: objectKey,
      ResponseContentDisposition: `attachment; filename="${safeName}"`,
    }),
    { expiresIn: 10 * 60 },
  );
}
