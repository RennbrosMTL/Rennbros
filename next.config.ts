import type { NextConfig } from "next";

/**
 * Two languages, one public URL per page each.
 *
 * Every page lives at app/[lang]/…. English is served at clean URLs:
 *   - REWRITE  /services  ->  /en/services   (internal; the URL stays clean)
 *   - REDIRECT /en/…      ->  /…             (so /en/ never becomes a second
 *                                             indexable copy of every page)
 * French is simply /fr/…, matched by [lang] directly.
 *
 * Excluded from the rewrite: /fr, /en (handled by the redirect), Next's own
 * /_next, the API, and anything with a file extension (media, fonts, icons,
 * the map vendor files, robots.txt, sitemap.xml).
 */
const nextConfig: NextConfig = {
  /* The root layout lives in app/[lang]; global-not-found.tsx renders a
     complete page for a URL that matches nothing. */
  experimental: {
    globalNotFound: true,
    // Only the icons actually used, not the whole Phosphor set.
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  devIndicators: false,
  images: { formats: ["image/avif", "image/webp"] },
  /* Concept preview: keep every page out of search until launch. Remove on
     the concept that goes live on RennBros.com (the launch guard says so).
     Set here, not in netlify.toml: pages are served by Next, not as files. */
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
  async redirects() {
    return [
      { source: "/en", destination: "/", permanent: true },
      { source: "/en/:path*", destination: "/:path*", permanent: true },
      // The prices now live on the services page.
      { source: "/pricing", destination: "/services", permanent: true },
      { source: "/fr/pricing", destination: "/fr/services", permanent: true },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/en" },
        {
          source: "/:path((?!fr(?:/|$)|en(?:/|$)|_next/|api/)(?!.*\\.[a-zA-Z0-9]+$).+)",
          destination: "/en/:path",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
