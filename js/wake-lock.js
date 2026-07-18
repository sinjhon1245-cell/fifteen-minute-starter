/* 15분 시동 - 화면 잠금 방지 (Screen Wake Lock API, 미지원 시 무시) */
(function (global) {
  'use strict';

  var lock = null;
  var desiredActive = false;

  function isSupported() {
    return 'wakeLock' in navigator;
  }

  function request() {
    if (!isSupported()) return Promise.resolve(false);
    return navigator.wakeLock.request('screen').then(function (sentinel) {
      lock = sentinel;
      lock.addEventListener('release', function () {
        lock = null;
      });
      return true;
    }).catch(function () {
      lock = null;
      return false;
    });
  }

  function release() {
    if (lock) {
      try { lock.release(); } catch (e) { /* 무시 */ }
      lock = null;
    }
  }

  var WakeLock = {
    isSupported: isSupported,

    enable: function () {
      desiredActive = true;
      return request();
    },

    disable: function () {
      desiredActive = false;
      release();
    },

    isActive: function () {
      return !!lock;
    },

    reacquireIfNeeded: function () {
      if (desiredActive && !lock && document.visibilityState === 'visible') {
        request();
      }
    }
  };

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      WakeLock.reacquireIfNeeded();
    }
  });

  global.FMS = global.FMS || {};
  global.FMS.WakeLock = WakeLock;
})(window);
