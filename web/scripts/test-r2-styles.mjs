import { readFileSync, existsSync } from "node:fs";
import { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
const bucket = "videotool";

async function test(label, forcePathStyle) {
  console.log(`\n=== ${label} (forcePathStyle=${forcePathStyle}) ===`);
  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle,
  });

  try {
    const head = await client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log("HeadBucket OK", head.$metadata.httpStatusCode);
  } catch (err) {
    console.log("HeadBucket FEHLER:", err.name, err.message, err.$metadata?.httpStatusCode);
  }

  try {
    const putUrl = await getSignedUrl(
      client,
      new PutObjectCommand({ Bucket: bucket, Key: "_diag/test.txt" }),
      { expiresIn: 300 }
    );
    console.log("Presigned PUT URL:", putUrl);

    const putRes = await fetch(putUrl, { method: "PUT", body: "hello from diagnostics" });
    console.log("PUT via fetch:", putRes.status, putRes.statusText);

    const getUrl = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: "_diag/test.txt" }),
      { expiresIn: 300 }
    );
    console.log("Presigned GET URL:", getUrl);
    const getRes = await fetch(getUrl);
    console.log("GET via fetch:", getRes.status, getRes.statusText);
    if (getRes.ok) console.log("Inhalt:", await getRes.text());
  } catch (err) {
    console.log("Presign/Fetch FEHLER:", err.name, err.message);
  }
}

await test("Virtual-Hosted-Style", false);
await test("Path-Style", true);
