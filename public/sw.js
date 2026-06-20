const CACHE_NAME = 'lindonas-pwa-v1';

// Recursos estáticos básicos que podem ser cacheados com segurança
const STATIC_RESOURCES = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/sounds/notification.mp3',
  '/favicon.ico',
];

// O que NÃO deve ser cacheado NUNCA
const SENSITIVE_PATHS = [
  '/api/',
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  '/pwa/', // Para garantir que as páginas do tenant sempre busquem os dados mais novos
  '/admin' // Admin nunca deve ser cacheado
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Ignoramos erros em arquivos faltando no pré-cache
      return Promise.all(
        STATIC_RESOURCES.map(url => {
          return fetch(url).then(response => {
            if (response.ok) {
              return cache.put(url, response);
            }
          }).catch(error => {
            console.warn('Failed to pre-cache', url, error);
          });
        })
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. SE for rota sensível ou requisição não-GET, use apenas Rede (NetworkOnly)
  if (
    event.request.method !== 'GET' ||
    SENSITIVE_PATHS.some(path => url.href.includes(path))
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. Para assets de build Next.js (_next/static), use CacheFirst seguro
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then(fetchRes => {
          if (fetchRes && fetchRes.status === 200) {
            const clone = fetchRes.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return fetchRes;
        });
      })
    );
    return;
  }

  // 3. Outros (Network First, fallback to cache)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Atualiza o cache silenciosamente se for uma resposta válida de domínio próprio
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
