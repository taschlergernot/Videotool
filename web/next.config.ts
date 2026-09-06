import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // The repo root also has a package-lock.json (for the unrelated CLI tool),
  // which makes Next.js guess the wrong workspace root otherwise.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
