'use strict';

const installButton = document.querySelector('#installButton');
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton?.classList.remove('hidden');
});

installButton?.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  try { await deferredInstallPrompt.userChoice; } catch { /* لا يؤثر فشل نافذة التثبيت في عمل التطبيق. */ }
  deferredInstallPrompt = null;
  installButton.classList.add('hidden');
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  installButton?.classList.add('hidden');
});

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js', { scope: './', updateViaCache: 'none' }).then(registration => registration.update()).catch(() => {
      // يظل التطبيق صالحًا للعمل عبر الشبكة حتى إن منع المتصفح تسجيل عامل الخدمة.
    });
  }, { once: true });
}

const heroStartButton = document.querySelector('#heroStartBtn');
heroStartButton?.addEventListener('click', () => {
  document.querySelector('#readerSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
