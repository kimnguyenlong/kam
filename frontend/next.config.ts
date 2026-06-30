import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle for a small production image.
  output: "standalone",
};

export default nextConfig;
