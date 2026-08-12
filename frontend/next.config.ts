import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // GitHub Pages serves files, not a Node server. Everything this app does is
  // client-side calls to PocketBase, so a static export loses nothing.
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
