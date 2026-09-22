import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "tesseract.js",
    "minio",
    "@prisma/client",
    "mammoth",
    "html-to-docx",
    "word-extractor",
    "sanitize-html",
    "unpdf",
    "@napi-rs/canvas",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
