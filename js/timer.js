/* 15분만 - 타이머 (expectedEndTime 기반 계산, 새로고침/백그라운드 복구) */
(function (global) {
  'use strict';

  var C = global.FMS.Constants;
  var Storage = global.FMS.Storage;

  function nowId() {
    return 'sess-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  var tickListeners = [];
  var tickHandle = null;

  function notifyTick() {
    var state = Storage.load();
    var session = state.activeSession;
    tickListeners.forEach(function (fn) {
      try { fn(session); } catch (e) { /* 리스너 오류가 타이머를 멈추지 않게 함 */ }
    });
  }

  function ensureTicking() {
    if (tickHandle) return;
    tickHandle = global.setInterval(notifyTick, 250);
  }

  function stopTicking() {
    if (tickHandle) {
      global.clearInterval(tickHandle);
      tickHandle = null;
    }
  }

  function formatDuration(ms) {
    if (typeof ms !== 'number' || ms == null) return '시간 기록 없음';
    var totalSeconds = Math.round(ms / 1000);
    if (totalSeconds >= C.TIMER_DURATION_MS / 1000) return '15분';
    if (totalSeconds >= 60) {
      var m = Math.floor(totalSeconds / 60);
      var s = totalSeconds % 60;
      return s > 0 ? (m + '분 ' + s + '초') : (m + '분');
    }
    return totalSeconds + '초';
  }

  var Timer = {
    onTick: function (fn) {
      tickListeners.push(fn);
      return function unsubscribe() {
        var idx = tickListeners.indexOf(fn);
        if (idx >= 0) tickListeners.splice(idx, 1);
      };
    },

    getActive: function () {
      return Storage.load().activeSession;
    },

    getRemainingMs: function (session) {
      if (!session) return 0;
      return Math.max(0, session.expectedEndTime - Date.now());
    },

    isExpired: function (session) {
      if (!session) return false;
      return Date.now() >= session.expectedEndTime;
    },

    formatDuration: formatDuration,

    start: function (params) {
      var startTime = Date.now();
      var session = {
        sessionId: nowId(),
        categoryId: params.categoryId,
        goalId: params.goalId,
        goalTitle: params.goalTitle || null,
        stepId: params.stepId,
        stepNumber: params.stepNumber,
        stepTitle: params.stepTitle || null,
        actionText: params.actionText,
        fallbackActionText: params.fallbackActionText,
        finishActionText: params.finishActionText,
        startTime: startTime,
        expectedEndTime: startTime + C.TIMER_DURATION_MS,
        status: C.SESSION_STATUS.RUNNING,
        notificationPreference: params.notificationPreference || C.NOTIFICATION_PREFERENCE.UNSET,
        wakeLockPreference: !!params.wakeLockPreference,
        hiddenCount: 0,
        hiddenEvents: [],
        fallbackUsed: false,
        fallbackUsedAt: null,
        overrideRun: !!params.forcedRerun,
        finishType: null,
        skipFinishScreen: false,
        actualEndTime: null,
        date: Storage.todayKey(new Date(startTime))
      };
      Storage.update(function (state) {
        state.activeSession = session;
        return state;
      });
      ensureTicking();
      return session;
    },

    cancelStart: function () {
      Storage.update(function (state) {
        state.activeSession = null;
        return state;
      });
      stopTicking();
    },

    recordHiddenEvent: function () {
      var state = Storage.load();
      var session = state.activeSession;
      if (!session || session.status !== C.SESSION_STATUS.RUNNING) return null;
      session.hiddenCount = (session.hiddenCount || 0) + 1;
      session.hiddenEvents = session.hiddenEvents || [];
      session.hiddenEvents.push(Date.now());
      Storage.update(function (s) {
        s.activeSession = session;
        return s;
      });
      return session;
    },

    canNotifyHiddenExit: function (session) {
      if (!session) return false;
      var events = session.hiddenEvents || [];
      if (events.length === 0 || events.length > C.HIDDEN_NOTIFY_MAX_COUNT) return false;
      if (events.length === 1) return true;
      var last = events[events.length - 1];
      var prev = events[events.length - 2];
      return (last - prev) >= C.HIDDEN_NOTIFY_MIN_INTERVAL_MS;
    },

    canUseFallback: function (session) {
      return !!session && !session.fallbackUsed;
    },

    applyFallback: function () {
      var state = Storage.load();
      var session = state.activeSession;
      if (!session || session.fallbackUsed) return null;
      session.fallbackUsed = true;
      session.fallbackUsedAt = Date.now();
      session.actionText = session.fallbackActionText || session.actionText;
      Storage.update(function (s) {
        s.activeSession = session;
        return s;
      });
      return session;
    },

    /**
     * 타이머 카운트다운을 멈추고 결과 대기 상태로 전환한다.
     * finishType: timer_complete | early_complete | manual_end | recovered_after_end
     * skipFinishScreen이 true이면 '15분이 끝났습니다' 화면 없이 바로 결과 기록 화면으로 이동한다.
     */
    markFinishPending: function (finishType, opts) {
      opts = opts || {};
      var state = Storage.load();
      var session = state.activeSession;
      if (!session) return null;
      session.status = C.SESSION_STATUS.FINISH_PENDING;
      session.actualEndTime = Date.now();
      session.finishType = finishType || C.FINISH_TYPE.TIMER_COMPLETE;
      session.skipFinishScreen = !!opts.skipFinishScreen;
      Storage.update(function (s) {
        s.activeSession = session;
        return s;
      });
      stopTicking();
      return session;
    },

    /**
     * '15분이 끝났습니다' 화면에서 결과 기록 화면으로 넘어갈 때 라우트 가드가
     * 다시 finish 화면으로 되돌리지 않도록 skipFinishScreen을 true로 갱신한다.
     */
    proceedToRecordResult: function () {
      var state = Storage.load();
      var session = state.activeSession;
      if (!session) return null;
      session.skipFinishScreen = true;
      Storage.update(function (s) {
        s.activeSession = session;
        return s;
      });
      return session;
    },

    /**
     * 사용자가 결과 기록 화면에서 진행 결과를 선택했을 때 세션을 최종 기록으로 전환한다.
     */
    finalizeWithResult: function (progressResult) {
      var state = Storage.load();
      var session = state.activeSession;
      if (!session) return null;

      var actualEndTime = session.actualEndTime || Date.now();
      var actualDurationMs = Math.max(0, actualEndTime - session.startTime);
      var finished = progressResult === C.PROGRESS_RESULT.COMPLETED || progressResult === C.PROGRESS_RESULT.SUFFICIENT;

      var record = {
        sessionId: session.sessionId,
        categoryId: session.categoryId,
        goalId: session.goalId,
        goalTitle: session.goalTitle,
        stepId: session.stepId,
        stepNumber: session.stepNumber,
        stepTitle: session.stepTitle,
        date: session.date,
        dateKey: session.date,
        startTime: session.startTime,
        expectedEndTime: session.expectedEndTime,
        actualEndTime: actualEndTime,
        actualDurationMs: actualDurationMs,
        actualDurationSeconds: Math.round(actualDurationMs / 1000),
        finishType: session.finishType || C.FINISH_TYPE.MANUAL_END,
        progressResult: progressResult,
        status: finished ? 'completed' : 'partial',
        finished: finished,
        hiddenCount: session.hiddenCount || 0,
        fallbackUsed: !!session.fallbackUsed,
        fallbackUsedAt: session.fallbackUsedAt || null,
        overrideRun: !!session.overrideRun,
        notificationPreference: session.notificationPreference || C.NOTIFICATION_PREFERENCE.UNSET,
        completedAt: Date.now()
      };

      Storage.update(function (s) {
        s.history.push(record);
        var progress = s.goalProgress[session.goalId] || { currentStepNumber: 1, completedStepNumbers: [], lastCompletedDate: null };
        if (finished) {
          if (progress.completedStepNumbers.indexOf(session.stepNumber) === -1) {
            progress.completedStepNumbers.push(session.stepNumber);
          }
          if (!session.overrideRun && progress.currentStepNumber === session.stepNumber) {
            progress.currentStepNumber = session.stepNumber + 1;
          }
          progress.lastCompletedDate = session.date;
        }
        s.goalProgress[session.goalId] = progress;
        s.activeSession = null;
        return s;
      });

      stopTicking();
      return record;
    },

    hasCompletedGoalToday: function (goalId, dateKey) {
      var state = Storage.load();
      var today = dateKey || Storage.todayKey();
      return state.history.some(function (r) {
        return r.goalId === goalId && r.date === today && r.finished === true;
      });
    },

    getGoalProgress: function (goalId) {
      var state = Storage.load();
      return state.goalProgress[goalId] || { currentStepNumber: 1, completedStepNumbers: [], lastCompletedDate: null };
    },

    resumeTickingIfActive: function () {
      var session = this.getActive();
      if (session && session.status === C.SESSION_STATUS.RUNNING) {
        ensureTicking();
      }
    },

    stopTicking: stopTicking
  };

  global.FMS.Timer = Timer;
})(window);
