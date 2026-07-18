/* 15분 시동 - 알림 / 소리 / 진동 (서버 없이 브라우저 기능만 사용) */
(function (global) {
  'use strict';

  var audioCtx = null;

  function isNotificationSupported() {
    return 'Notification' in global;
  }

  function getPermission() {
    if (!isNotificationSupported()) return 'unsupported';
    return Notification.permission;
  }

  function requestPermission() {
    if (!isNotificationSupported()) return Promise.resolve('unsupported');
    try {
      var result = Notification.requestPermission();
      if (result && typeof result.then === 'function') {
        return result;
      }
      return new Promise(function (resolve) {
        Notification.requestPermission(resolve);
      });
    } catch (e) {
      return Promise.resolve('denied');
    }
  }

  function showViaServiceWorkerOrDirect(title, body, tag) {
    if (getPermission() !== 'granted') return Promise.resolve(false);

    if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
      return navigator.serviceWorker.getRegistration().then(function (reg) {
        if (reg && reg.showNotification) {
          return reg.showNotification(title, {
            body: body,
            tag: tag,
            icon: './assets/icons/icon-192.png',
            badge: './assets/icons/icon-192.png'
          }).then(function () { return true; });
        }
        try {
          new Notification(title, { body: body, tag: tag });
          return true;
        } catch (e) {
          return false;
        }
      }).catch(function () {
        try {
          new Notification(title, { body: body, tag: tag });
          return true;
        } catch (e) {
          return false;
        }
      });
    }

    try {
      new Notification(title, { body: body, tag: tag });
      return Promise.resolve(true);
    } catch (e) {
      return Promise.resolve(false);
    }
  }

  function initAudioContext() {
    if (audioCtx) return audioCtx;
    try {
      var Ctx = global.AudioContext || global.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(function () { /* 무시 */ });
      }
      return audioCtx;
    } catch (e) {
      return null;
    }
  }

  function playEndSound() {
    var ctx = audioCtx || initAudioContext();
    if (!ctx) return false;
    try {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(function () { /* 무시 */ });
      }
      var now = ctx.currentTime;
      [0, 0.18, 0.36].forEach(function (offset, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = i === 2 ? 880 : 660;
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.25, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.16);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.18);
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  function vibrate(pattern) {
    if (!('vibrate' in navigator)) return false;
    try {
      return navigator.vibrate(pattern);
    } catch (e) {
      return false;
    }
  }

  var Notifications = {
    isSupported: isNotificationSupported,
    getPermission: getPermission,
    requestPermission: requestPermission,
    initAudioContext: initAudioContext,
    playEndSound: playEndSound,
    vibrate: vibrate,

    showTimerEndNotification: function () {
      return showViaServiceWorkerOrDirect(
        '15분이 끝났습니다.',
        '더 하지 마세요. 지금 하던 일을 정리하고 오늘은 여기까지 마무리하세요.',
        'fms-timer-end'
      );
    },

    showHiddenExitNotification: function () {
      return showViaServiceWorkerOrDirect(
        '지금 다른 곳으로 가고 있습니다.',
        '남은 15분을 지키세요. 지금 할 일은 하나뿐입니다.',
        'fms-hidden-exit'
      );
    }
  };

  global.FMS = global.FMS || {};
  global.FMS.Notifications = Notifications;
})(window);
