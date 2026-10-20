// Cedar Park service worker.
// Bump VERSION whenever you want every visitor to re-download the site files.
const VERSION = "cedar-v2";
const SHELL = VERSION + "-shell";
const IMAGES = VERSION + "-images";

const SHELL_FILES = [
    "./",
    "index.html",
    "about.html",
    "venue.html",
    "booking.html",
    "contact.html",
    "offline.html",
    "manifest.json",
    "css/style.css",
    "css/about.css",
    "css/venue.css",
    "css/booking.css",
    "css/contact.css",
    "css/gallery.css",
    "css/availability.css",
    "css/page-entrance.css",
    "css/splash.css",
    "js/script.js",
    "js/script1.js",
    "js/page-entrance.js",
    "js/splash.js",
    "js/gallery.js",
    "js/availability.js",
    "js/booking.js",
    "js/pwa.js",
    "images/logo.png",
    "images/cedar-logo.png",
    "images/cedar-park.jpg",
    "images/venue5.jpg",
    "images/venue7.jpg",
    "images/venue10.jpg"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(SHELL).then(cache =>
            // add files one by one so one missing file can't break the install
            Promise.all(SHELL_FILES.map(url => cache.add(url).catch(() => {})))
        ).then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    const req = event.request;
    if (req.method !== "GET") return;

    const url = new URL(req.url);

    // Only handle this site's own files. The Google Sheet (availability),
    // web3forms (booking form) and maps always go straight to the network.
    if (url.origin !== self.location.origin) return;

    // Leave the admin area, videos (range requests) and the media list alone.
    if (url.pathname.includes("/admin/")) return;
    if (/\.(mp4|webm|ogg|mov)$/i.test(url.pathname)) return;
    if (req.headers.has("range")) return;

    // Pages: network first so visitors always get your latest version,
    // falling back to the saved copy when offline.
    if (req.mode === "navigate") {
        event.respondWith(
            fetch(req)
                .then(res => {
                    const copy = res.clone();
                    caches.open(SHELL).then(c => c.put(req, copy));
                    return res;
                })
                .catch(() =>
                    caches.match(req, { ignoreSearch: true })
                        .then(hit => hit || caches.match("offline.html"))
                )
        );
        return;
    }

    // Images: show the saved copy instantly, refresh it in the background.
    if (req.destination === "image") {
        event.respondWith(
            caches.open(IMAGES).then(cache =>
                cache.match(req).then(hit => {
                    const fresh = fetch(req)
                        .then(res => {
                            if (res.ok) cache.put(req, res.clone());
                            return res;
                        })
                        .catch(() => hit);
                    return hit || fresh;
                })
            )
        );
        return;
    }

    // CSS, JS, JSON: network first, saved copy when offline.
    event.respondWith(
        fetch(req)
            .then(res => {
                if (res.ok) {
                    const copy = res.clone();
                    caches.open(SHELL).then(c => c.put(req, copy));
                }
                return res;
            })
            .catch(() => caches.match(req, { ignoreSearch: true }))
    );
});
