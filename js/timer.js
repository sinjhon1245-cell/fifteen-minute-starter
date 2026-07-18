/* 15분 시동 - 타이머 (expectedEndTime 기반 계산, 새로고침/백그라운드 복구) */
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

    start: function (params) {
      var startTime = Date.now();
      var session = {
        sessionId: nowId(),
        categoryId: params.categoryId,
        goalId: params.goalId,
        stepId: params.stepId,
        stepNumber: params.stepNumber,
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
        reducedAction: false,
        forcedRerun: !!params.forcedRerun,
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

    applyFallback: function () {
      var state = Storage.load();
      var session = state.activeSession;
      if (!session) return null;
      session.reducedAction = true;
      session.actionText = session.fallbackActionText || session.actionText;
      Storage.update(function (s) {
        s.activeSession = session;
        return s;
      });
      return session;
    },

    markFinishPending: function () {
      var state = Storage.load();
      var session = state.activeSession;
      if (!session) return null;
      session.status = C.SESSION_STATUS.FINISH_PENDING;
      session.actualEndTime = Date.now();
      Storage.update(function (s) {
        s.activeSession = session;
        return s;
      });
      stopTicking();
      return session;
    },

    finalizeCompletion: function () {
      var state = Storage.load();
      var session = state.activeSession;
      if (!session) return null;

      var record = {
        sessionId: session.sessionId,
        categoryId: session.categoryId,
        goalId: session.goalId,
        stepId: session.stepId,
        stepNumber: session.stepNumber,
        date: session.date,
        startTime: session.startTime,
        expectedEndTime: session.expectedEndTime,
        actualEndTime: session.actualEndTime || Date.now(),
        status: 'completed',
        finished: true,
        hiddenCount: session.hiddenCount || 0,
        reducedAction: !!session.reducedAction,
        forcedRerun: !!session.forcedRerun
      };

      Storage.update(function (s) {
        s.history.push(record);
        var progress = s.goalProgress[session.goalId] || { currentStepNumber: 1, completedStepNumbers: [], lastCompletedDate: null };
        if (progress.completedStepNumbers.indexOf(session.stepNumber) === -1) {
          progress.completedStepNumbers.push(session.stepNumber);
        }
        if (!session.forcedRerun && progress.currentStepNumber === session.stepNumber) {
          progress.currentStepNumber = session.stepNumber + 1;
        }
        progress.lastCompletedDate = session.date;
        s.goalProgress[session.goalId] = progress;
        s.activeSession = null;
        return s;
      });

      stopTicking();
      return record;
    },

    abandon: function (reason) {
      var state = Storage.load();
      var session = state.activeSession;
      if (!session) return null;

      var record = {
        sessionId: session.sessionId,
        categoryId: session.categoryId,
        goalId: session.goalId,
        stepId: session.stepId,
        stepNumber: session.stepNumber,
        date: session.date,
        startTime: session.startTime,
        expectedEndTime: session.expectedEndTime,
        actualEndTime: Date.now(),
        status: 'abandoned',
        finished: false,
        hiddenCount: session.hiddenCount || 0,
        reducedAction: !!session.reducedAction,
        forcedRerun: !!session.forcedRerun,
        abandonReason: reason || 'user_gave_up'
      };

      Storage.update(function (s) {
        s.history.push(record);
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
