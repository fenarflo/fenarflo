import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Query strings (e.g. ?ref=CODE invite links) pass through redirects.
  async redirects() {
    return [
      { source: "/", destination: "/resumir", permanent: false },
      { source: "/precios", destination: "/cuenta", permanent: true },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
