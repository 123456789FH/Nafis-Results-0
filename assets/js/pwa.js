(() => {
  'use strict';
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {
        // عدم تسجيل عامل الخدمة لا يمنع تشغيل التطبيق.
      });
    });
  }
})();
