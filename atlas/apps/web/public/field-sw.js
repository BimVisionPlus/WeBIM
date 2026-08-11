// Service Worker for Viwase Field PWA — offline-first cache for the /field shell.
// Strategy: network-first for API, cache-first for the shell + static assets.
// Failed POSTs to /api/field/checkin or /api/ai/field/voice-form get queued
// in IndexedDB and replayed on next online sync (registered by the page).

const CACHE = "viwase-field-v1";
const SHELL = ["/field", "/manifest.webmanifest", "/icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // API: network-first, no cache fallback (so users see fresh data when online)
  if (url.pathname.startsWith("/api/")) return;
  // Shell: cache-first
  if (e.request.method === "GET" && (url.pathname === "/field" || url.pathname.startsWith("/_next/static/") || url.pathname === "/manifest.webmanifest")) {
    e.respondWith(
      caches.match(e.request).then((cached) =>
        cached || fetch(e.request).then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
          return r;
        }).catch(() => cached || new Response("Offline", { status: 503 }))
      )
    );
  }
});
