/**
 * PWA Configuration
 * Configuration for Progressive Web App features
 */

export const pwaConfig = {
  // App manifest configuration
  manifest: {
    name: "Confetti Event Planner",
    short_name: "Confetti",
    description: "Professional event planning and management platform",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0891b2", // Teal color for planner dashboard
    orientation: "portrait-primary",
    scope: "/",
    icons: [
      {
        src: "/icons/icon-72x72.png",
        sizes: "72x72",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icons/icon-96x96.png",
        sizes: "96x96",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icons/icon-128x128.png",
        sizes: "128x128",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icons/icon-144x144.png",
        sizes: "144x144",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icons/icon-152x152.png",
        sizes: "152x152",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icons/icon-384x384.png",
        sizes: "384x384",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
    categories: ["business", "productivity", "lifestyle"],
    screenshots: [
      {
        src: "/screenshots/dashboard.png",
        sizes: "1280x720",
        type: "image/png",
      },
      {
        src: "/screenshots/events.png",
        sizes: "1280x720",
        type: "image/png",
      },
    ],
  },

  // Service worker configuration
  serviceWorker: {
    // Cache names
    caches: {
      static: "confetti-static-v1",
      dynamic: "confetti-dynamic-v1",
      images: "confetti-images-v1",
      api: "confetti-api-v1",
    },

    // Cache strategies
    strategies: {
      // Static assets (HTML, CSS, JS)
      static: {
        strategy: "CacheFirst",
        maxAge: 7 * 24 * 60 * 60, // 7 days
        maxEntries: 50,
      },

      // API responses
      api: {
        strategy: "NetworkFirst",
        maxAge: 5 * 60, // 5 minutes
        maxEntries: 100,
      },

      // Images
      images: {
        strategy: "CacheFirst",
        maxAge: 30 * 24 * 60 * 60, // 30 days
        maxEntries: 200,
      },

      // Dynamic content
      dynamic: {
        strategy: "NetworkFirst",
        maxAge: 24 * 60 * 60, // 24 hours
        maxEntries: 50,
      },
    },

    // URLs to precache
    precache: [
      "/",
      "/offline.html",
      "/manifest.json",
      "/icons/icon-192x192.png",
      "/icons/icon-512x512.png",
    ],

    // URLs to exclude from caching
    excludeUrls: [
      /\/api\/auth\//,
      /\/api\/payment\//,
      /\/api\/webhooks\//,
      /\.hot-update\./,
    ],
  },

  // Offline configuration
  offline: {
    // Enable offline mode
    enabled: true,

    // Offline page
    fallbackPage: "/offline.html",

    // Data to cache for offline access
    cacheData: {
      events: {
        maxItems: 10,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
      clients: {
        maxItems: 20,
        maxAge: 24 * 60 * 60 * 1000,
      },
      tasks: {
        maxItems: 50,
        maxAge: 24 * 60 * 60 * 1000,
      },
    },

    // Sync configuration
    sync: {
      enabled: true,
      syncInterval: 5 * 60 * 1000, // 5 minutes
      maxRetries: 3,
    },
  },

  // Push notifications configuration
  pushNotifications: {
    enabled: true,
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
  },

  // Background sync configuration
  backgroundSync: {
    enabled: true,
    tags: {
      syncEvents: "sync-events",
      syncTasks: "sync-tasks",
      syncClients: "sync-clients",
    },
  },
};

export default pwaConfig;
