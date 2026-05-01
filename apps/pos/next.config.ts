import type { NextConfig } from "next";

// @ts-ignore - next-pwa doesn't have TypeScript definitions
const withPWAInit = require("next-pwa");

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: false, // Enable PWA in all environments for proper offline support
  buildExcludes: [/middleware-manifest\.json$/],
  // Precache critical pages for offline access
  publicExcludes: ['!manifest.json', '!sw.js', '!workbox-*.js'],
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "google-fonts",
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
        },
      },
    },
    {
      urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "static-font-assets",
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        },
      },
    },
    {
      urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "static-image-assets",
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: /\.(?:js)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "static-js-assets",
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: /\.(?:css|less)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "static-style-assets",
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: /^https?:\/\/[^\/]+\/api\/.*/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "api-cache",
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 5 * 60, // 5 minutes
        },
        networkTimeoutSeconds: 3, // Faster timeout for API calls
      },
    },
    {
      // Cache pages for offline access - use NetworkFirst with quick fallback
      urlPattern: ({ request }: { request: Request }) => request.destination === "document",
      handler: "NetworkFirst",
      options: {
        cacheName: "pages-cache",
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
        networkTimeoutSeconds: 2, // Quick fallback to cache
        plugins: [
          {
            cacheWillUpdate: async ({ response }: { response: Response }) => {
              // Only cache successful responses
              if (response && response.status === 200) {
                return response;
              }
              return null;
            },
          },
        ],
      },
    },
    {
      // Catch all for same-origin navigation requests
      urlPattern: ({ url, request }: { url: URL; request: Request }) =>
        url.origin === self.location.origin && request.mode === "navigate",
      handler: "NetworkFirst",
      options: {
        cacheName: "pages-cache",
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 24 * 60 * 60,
        },
        networkTimeoutSeconds: 2,
      },
    },
  ],
  fallbacks: {
    document: "/offline.html",
  },
});

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
};

export default withPWA(nextConfig);
