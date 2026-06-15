import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep sharp (native libvips) out of the bundle so it loads from node_modules
  // at runtime with the correct platform binary on Vercel.
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
