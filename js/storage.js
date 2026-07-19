/* 15분만 - 로컬 저장소 관리 (localStorage 래핑, 스키마 버전 관리) */
(function (global) {
  'use strict';

  var C = global.FMS.Constants;

  function defaultState() {
    return {
      version: C.SCHEMA_VERSION,
      onboardingCompleted: false,
      installCompleted: false,
      settings: {
        notificationPreference: C.NOTIFICATION_PREFERENCE.UNSET,
        soundEnabled: true,
        vibrationEnabled: true,
        wakeLockEnabled: true,
        darkMode: 'system'
      },
      goalProgress: {},
      history: [],
      activeSession: null,
      customGoals: [],
      hiddenRecommendedGoalIds: []
    };
  }

  var CUSTOM_STEP_FIELDS = ['action', 'preparation', 'focusMessage', 'fallbackAction', 'finishAction', 'nextPreview'];
  var CUSTOM_STEP_FALLBACK = {
    action: '지금 이 단계에서 할 행동을 15분 동안 진행하세요.',
    preparation: '필요한 준비물이나 장소를 미리 정리해 두세요.',
    focusMessage: '지금 하는 행동에 집중하세요.',
    fallbackAction: '시간이 부족하면 더 작은 범위로 줄여서 진행하세요.',
    finishAction: '오늘 진행한 부분을 간단히 기록해 두세요.',
    nextPreview: '다음에는 이어서 진행합니다.'
  };

  function sanitizeCustomStep(s, idx) {
    if (!s || typeof s !== 'object') s = {};
    var out = {
      id: typeof s.id === 'string' && s.id ? s.id : ('custom-step-' + (idx + 1)),
      stepNumber: typeof s.stepNumber === 'number' ? s.stepNumber : (idx + 1),
      title: typeof s.title === 'string' && s.title ? s.title : ('단계 ' + (idx + 1))
    };
    CUSTOM_STEP_FIELDS.forEach(function (f) {
      out[f] = typeof s[f] === 'string' && s[f] ? s[f] : CUSTOM_STEP_FALLBACK[f];
    });
    return out;
  }

  function sanitizeCustomGoal(g) {
    if (!g || typeof g !== 'object') return null;
    if (typeof g.id !== 'string' || !g.id) return null;
    if (typeof g.categoryId !== 'string' || !g.categoryId) return null;
    if (typeof g.title !== 'string' || !g.title.trim()) return null;
    var steps = Array.isArray(g.steps) ? g.steps : [];
    if (!steps.length) return null;
    return {
      id: g.id,
      categoryId: g.categoryId,
      source: 'custom',
      title: g.title,
      description: typeof g.description === 'string' ? g.description : '',
      startMessage: typeof g.startMessage === 'string' && g.startMessage ? g.startMessage : '지금 할 수 있는 만큼 시작하세요.',
      steps: steps.map(sanitizeCustomStep),
      createdAt: typeof g.createdAt === 'number' ? g.createdAt : Date.now(),
      updatedAt: typeof g.updatedAt === 'number' ? g.updatedAt : Date.now()
    };
  }

  function isStorageAvailable() {
    try {
      var testKey = '__fms_test__';
      global.localStorage.setItem(testKey, '1');
      global.localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  function migrateHistoryRecord(r) {
    if (!r || typeof r !== 'object') return null;
    var out = Object.assign({}, r);

    if (typeof out.actualDurationMs !== 'number') {
      if (out.startTime && out.actualEndTime) {
        out.actualDurationMs = Math.max(0, out.actualEndTime - out.startTime);
      } else if (out.finished) {
        out.actualDurationMs = C.TIMER_DURATION_MS;
      } else {
        out.actualDurationMs = null;
      }
    }
    if (typeof out.actualDurationSeconds !== 'number') {
      out.actualDurationSeconds = typeof out.actualDurationMs === 'number' ? Math.round(out.actualDurationMs / 1000) : null;
    }
    if (!out.finishType) {
      out.finishType = out.finished ? C.FINISH_TYPE.TIMER_COMPLETE : C.FINISH_TYPE.MANUAL_END;
    }
    if (!out.progressResult) {
      out.progressResult = out.finished ? C.PROGRESS_RESULT.COMPLETED : null;
    }
    if (typeof out.fallbackUsed !== 'boolean') {
      out.fallbackUsed = !!out.reducedAction;
    }
    if (typeof out.fallbackUsedAt === 'undefined') {
      out.fallbackUsedAt = null;
    }
    if (typeof out.overrideRun !== 'boolean') {
      out.overrideRun = !!out.forcedRerun;
    }
    if (typeof out.completedAt === 'undefined') {
      out.completedAt = out.actualEndTime || null;
    }
    if (!out.dateKey) {
      out.dateKey = out.date || null;
    }
    if (!out.goalTitle) {
      out.goalTitle = null;
    }
    if (!out.stepTitle) {
      out.stepTitle = null;
    }
    return out;
  }

  function migrate(state) {
    if (!state || typeof state !== 'object') {
      return defaultState();
    }
    if (state.version !== C.SCHEMA_VERSION) {
      var fresh = defaultState();
      state.onboardingCompleted = !!state.onboardingCompleted;
      state.installCompleted = !!state.installCompleted;
      state.settings = Object.assign({}, fresh.settings, state.settings || {});
      state.goalProgress = state.goalProgress && typeof state.goalProgress === 'object' ? state.goalProgress : {};
      state.history = (Array.isArray(state.history) ? state.history : [])
        .map(migrateHistoryRecord)
        .filter(Boolean);
      state.activeSession = state.activeSession || null;
      state.version = C.SCHEMA_VERSION;
    }
    return state;
  }

  function sanitize(state) {
    var fresh = defaultState();
    if (!state || typeof state !== 'object') {
      return fresh;
    }
    return {
      version: C.SCHEMA_VERSION,
      onboardingCompleted: !!state.onboardingCompleted,
      installCompleted: !!state.installCompleted,
      settings: Object.assign({}, fresh.settings, state.settings && typeof state.settings === 'object' ? state.settings : {}),
      goalProgress: state.goalProgress && typeof state.goalProgress === 'object' ? state.goalProgress : {},
      history: Array.isArray(state.history) ? state.history : [],
      activeSession: state.activeSession && typeof state.activeSession === 'object' ? state.activeSession : null,
      customGoals: Array.isArray(state.customGoals) ? state.customGoals.map(sanitizeCustomGoal).filter(Boolean) : [],
      hiddenRecommendedGoalIds: Array.isArray(state.hiddenRecommendedGoalIds)
        ? state.hiddenRecommendedGoalIds.filter(function (id) { return typeof id === 'string'; })
        : []
    };
  }

  var Storage = {
    available: isStorageAvailable(),
    _memoryState: null,

    load: function () {
      if (this._memoryState) {
        return this._memoryState;
      }
      if (!this.available) {
        this._memoryState = defaultState();
        return this._memoryState;
      }
      try {
        var raw = global.localStorage.getItem(C.STORAGE_KEY);
        if (!raw) {
          this._memoryState = defaultState();
          return this._memoryState;
        }
        var parsed = JSON.parse(raw);
        var migrated = migrate(parsed);
        this._memoryState = sanitize(migrated);
        return this._memoryState;
      } catch (e) {
        this._memoryState = defaultState();
        return this._memoryState;
      }
    },

    save: function (state) {
      this._memoryState = sanitize(state);
      if (!this.available) {
        return false;
      }
      try {
        global.localStorage.setItem(C.STORAGE_KEY, JSON.stringify(this._memoryState));
        return true;
      } catch (e) {
        return false;
      }
    },

    update: function (mutator) {
      var state = this.load();
      var next = mutator(state) || state;
      this.save(next);
      return next;
    },

    reset: function () {
      var fresh = defaultState();
      this.save(fresh);
      return fresh;
    },

    todayKey: function (date) {
      var d = date || new Date();
      var y = d.getFullYear();
      var m = String(d.getMonth() + 1).padStart(2, '0');
      var day = String(d.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + day;
    }
  };

  global.FMS.Storage = Storage;
})(window);
