// Control de Efectivo: guarda la app en el celular para que abra sin internet.
// La app se pide primero a internet (así siempre llega la versión nueva);
// si no hay señal, se abre la copia guardada. Los datos NO pasan por aquí.
const CACHE = 'efectivo-v15';
const BASE = ['./', './index.html', './manifest.webmanifest', './icono-180.png', './icono-192.png', './icono-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.startsWith('efectivo-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return;                 // datos: siempre a internet

  // La página de la app: primero internet, si no hay, la copia guardada
  if (req.mode === 'navigate' || (url.origin === location.origin && url.pathname.endsWith('/index.html'))) {
    e.respondWith(
      fetch(req).then(r => {
        const copia = r.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copia));
        return r;
      }).catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Íconos, manifiesto y la librería del PDF: la copia guardada, y se refresca por detrás
  if (url.origin === location.origin || url.hostname === 'cdnjs.cloudflare.com') {
    e.respondWith(
      caches.open(CACHE).then(c => c.match(req).then(guardado => {
        const red = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => guardado);
        return guardado || red;
      }))
    );
  }
});
