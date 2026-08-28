import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["crmdev.sukierp.com", "103.182.210.202", "127.0.0.1", "localhost"],
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "127.0.0.1:3000",
        "*.devtunnels.ms",
        "crmdev.sukierp.com",
        "*.sukierp.com",
      ],
    },
  },
  env: {
    NEXT_PUBLIC_CRM_VARIANT: process.env.NEXT_PUBLIC_CRM_VARIANT || "1",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Handle underscore/legacy URL variants that users may type or have bookmarked
      {
        source: "/sales_pipeline/:id/opportunity_detail",
        destination: "/sales-pipeline/:id/opportunity-detail",
        permanent: true,
      },
      {
        source: "/sales_pipeline/:path*",
        destination: "/sales-pipeline/:path*",
        permanent: true,
      },
      {
        source: "/catalogue/products/import",
        destination: "/catalogue/products",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
