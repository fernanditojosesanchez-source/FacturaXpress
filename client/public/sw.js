/**
 * Service Worker para funcionalidad offline
 * Cache de assets estáticos y estrategias de fallback
 */

const CACHE_NAME = "facturaxpress-v1";
const OFFLINE_URL = "/offline.html";

// Assets críticos para cachear
const STATIC_ASSETS = [
  "/",
  "/offline.html",
  "/manifest.json",
  "/assets/logo.svg",
];

// Estrategia: Cache First para assets estáticos
const CACHE_FIRST_ROUTES = [
  /\.js$/,
  /\.css$/,
  /\.woff2$/,
  /\.png$/,
  /\.jpg$/,
  /\.svg$/,
];

// Estrategia: Network First para API calls
const NETWORK_FIRST_ROUTES = [
  /\/api\//,
];

self.addEventListener("install", (event: any) => {
  console.log("[SW] Instalando Service Worker...");

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Precaching assets...");
      return cache.addAll(STATIC_ASSETS);
    })
  );

  // Activar inmediatamente
  self.skipWaiting();
});

self.addEventListener("activate", (event: any) => {
  console.log("[SW] Activando Service Worker...");

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("[SW] Eliminando cache antiguo:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  // Controlar inmediatamente todas las páginas
  return (self as any).clients.claim();
});

self.addEventListener("fetch", (event: any) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requests no HTTP(S)
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // Ignorar requests a otros dominios
  if (url.origin !== location.origin) {
    return;
  }

  // Estrategia para API calls: Network First
  if (NETWORK_FIRST_ROUTES.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cachear respuesta exitosa
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback a cache si no hay red
          return caches.match(request).then((cached) => {
            if (cached) {
              console.log("[SW] Sirviendo desde cache (offline):", url.pathname);
              return cached;
            }

            // Respuesta offline genérica para API
            return new Response(
              JSON.stringify({ error: "Sin conexión", offline: true }),
              {
                status: 503,
                headers: { "Content-Type": "application/json" },
              }
            );
          });
        })
    );
    return;
  }

  // Estrategia para assets: Cache First
  if (CACHE_FIRST_ROUTES.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }

        return fetch(request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Default: Network First con fallback a cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          return cached || caches.match(OFFLINE_URL);
        });
      })
  );
});

// Listener para mensajes del cliente
self.addEventListener("message", (event: any) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data && event.data.type === "CLEAR_CACHE") {
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        console.log("[SW] Cache limpiado");
        return self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: "CACHE_CLEARED" });
          });
        });
      })
    );
  }
});

// Sincronización en background (cuando vuelve la red)
self.addEventListener("sync", (event: any) => {
  if (event.tag === "sync-drafts") {
    console.log("[SW] Sincronizando borradores...");
    event.waitUntil(
      // Aquí se llamaría a la función de sincronización
      Promise.resolve()
    );
  }
});

export {};
