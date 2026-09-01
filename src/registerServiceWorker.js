export const registerServiceWorker = () => {
  if (typeof window === 'undefined') return;

  // Unregister existing service workers to ensure no stale cached files
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().then((unregistered) => {
          if (unregistered) {
            console.log('🔄 Old ServiceWorker unregistered to prevent cache issues.');
          }
        });
      }
    }).catch((err) => {
      console.warn('Could not unregister service worker:', err);
    });
  }

  // Purge any existing Cache Storage items
  if ('caches' in window) {
    caches.keys().then((names) => {
      names.forEach((name) => {
        caches.delete(name);
      });
    }).catch(() => {});
  }
};


