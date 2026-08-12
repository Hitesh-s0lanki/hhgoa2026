import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Brand assets are static files in public/ — no next/image loader needed for
  // canvas drawing, and Image Optimization would be pointless for them.
  images: { unoptimized: true },
};

export default nextConfig;
