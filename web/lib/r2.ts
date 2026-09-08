import { S3Client } from "@aws-sdk/client-s3";

export const R2_BUCKET = "videotool";

export function createR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY fehlen.");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    // Ohne das nutzt der SDK Virtual-Hosted-Style
    // (videotool.<account>.r2.cloudflarestorage.com), das auf R2s generischem
    // Account-Endpoint ohne eigene Domain nicht auflöst.
    forcePathStyle: true,
  });
}
