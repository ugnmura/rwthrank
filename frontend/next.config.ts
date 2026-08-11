import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Trims the production image to just the files the server needs.
  output: "standalone",
};

export default withNextIntl(nextConfig);
