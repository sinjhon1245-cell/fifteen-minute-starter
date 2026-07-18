/* 15분 시동 - PWA 설치 및 Service Worker 등록 (GitHub Pages 하위 경로 대응 상대 경로 사용) */
(function (global) {
  'use strict';

  var deferredPrompt = null;
  var installListeners = [];

  function isStandalone() {
    return global.matchMedia && global.matchMedia('(display-mode: standalone)').matches ||
      global.navigator.standalone === true;
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);
    return navigator.serviceWorker.register('./service-worker.js').then(function (reg) {
      reg.addEventListener('updatefound', function () {
        var newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', function () {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            global.FMS.PWA._notifyUpdateAvailable();
          }
        });
      });
      return reg;
    }).catch(function () {
      return null;
    });
  }

  global.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    installListeners.forEach(function (fn) { fn(true); });
  });

  global.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    installListeners.forEach(function (fn) { fn(false); });
  });

  var updateListeners = [];

  var PWA = {
    isStandalone: isStandalone,
    registerServiceWorker: registerServiceWorker,

    canPromptInstall: function () {
      return !!deferredPrompt;
    },

    promptInstall: function () {
      if (!deferredPrompt) return Promise.resolve('unavailable');
      var prompt = deferredPrompt;
      deferredPrompt = null;
      prompt.prompt();
      return prompt.userChoice.then(function (choice) {
        return choice.outcome;
      });
    },

    onInstallAvailabilityChange: function (fn) {
      installListeners.push(fn);
    },

    onUpdateAvailable: function (fn) {
      updateListeners.push(fn);
    },

    _notifyUpdateAvailable: function () {
      updateListeners.forEach(function (fn) { fn(); });
    },

    applyUpdate: function () {
      if (!('serviceWorker' in navigator)) return;
      navigator.serviceWorker.getRegistration().then(function (reg) {
        if (reg && reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        global.location.reload();
      });
    }
  };

  global.FMS = global.FMS || {};
  global.FMS.PWA = PWA;
})(window);
