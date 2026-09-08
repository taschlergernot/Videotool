// Einmaliges Setup: setzt die CORS-Policy auf dem R2-Bucket, damit der
// Browser direkt per Multipart-Upload-Presigned-URLs hochladen kann.
// ETag MUSS in ExposeHeaders stehen -- sonst kann der Browser die
// Part-ETags nicht auslesen und completeR2MultipartUpload schlaegt fehl.
//
// Ausfuehren: node scripts/setup-r2-cors.mjs
// Braucht R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY in .env.local.
import { readFileSync, existsSync } from "node:fs";
import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";

// Kein dotenv-Dependency fuer ein einziges Setup-Skript -- .env.local von Hand parsen.
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

if (!accountId || !accessKeyId || !secretAccessKey) {
  console.error("R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY fehlen in .env.local");
  process.exit(1);
}

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

await r2.send(
  new PutBucketCorsCommand({
    Bucket: "videotool",
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: [
            "https://videotool-git-main-gernot-taschler.vercel.app",
            "https://videotool-two.vercel.app",
            "https://videotool-gernot-taschler.vercel.app",
            "http://localhost:3000",
          ],
          AllowedMethods: ["PUT", "GET", "HEAD"],
          AllowedHeaders: ["*"],
          ExposeHeaders: ["ETag"],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  })
);

console.log("R2 CORS-Policy gesetzt.");
