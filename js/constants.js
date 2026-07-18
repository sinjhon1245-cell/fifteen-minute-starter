/* 15분 시동 - 전역 상수 */
(function (global) {
  'use strict';

  var PRODUCTION_TIMER_MS = 15 * 60 * 1000;

  function resolveTimerDuration() {
    var isDevHost = global.location &&
      (global.location.hostname === 'localhost' ||
        global.location.hostname === '127.0.0.1' ||
        global.location.protocol === 'file:');

    if (!isDevHost) {
      return PRODUCTION_TIMER_MS;
    }

    try {
      var params = new URLSearchParams(global.location.search);
      var devSeconds = parseInt(params.get('dev_timer_seconds'), 10);
      if (devSeconds && devSeconds > 0 && devSeconds <= 900) {
        return devSeconds * 1000;
      }
    } catch (e) {
      /* URLSearchParams 미지원 시 운영 설정 사용 */
    }

    return PRODUCTION_TIMER_MS;
  }

  var Constants = {
    APP_NAME: '15분 시동',
    APP_VERSION: '1.0.0',
    CACHE_VERSION: 'fms-v1',
    STORAGE_KEY: 'fms_state_v1',
    SCHEMA_VERSION: 1,
    TIMER_DURATION_MS: resolveTimerDuration(),
    HIDDEN_NOTIFY_MAX_COUNT: 3,
    HIDDEN_NOTIFY_MIN_INTERVAL_MS: 60 * 1000,
    FORCE_RERUN_HOLD_MS: 3000,
    START_CANCEL_WINDOW_MS: 5000,
    FOCUS_MESSAGE_ROTATE_MS: 4 * 60 * 1000,
    SESSION_STATUS: {
      RUNNING: 'running',
      FINISH_PENDING: 'finish_pending',
      FINISHED: 'finished',
      ABANDONED: 'abandoned'
    },
    NOTIFICATION_PREFERENCE: {
      UNSET: 'unset',
      GRANTED: 'granted',
      SCREEN_ONLY: 'screen_only'
    }
  };

  global.FMS = global.FMS || {};
  global.FMS.Constants = Constants;
})(window);
