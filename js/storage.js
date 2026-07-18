/* 15분 시동 - 로컬 저장소 관리 (localStorage 래핑, 스키마 버전 관리) */
(function (global) {
  'use strict';

  var C = global.FMS.Constants;

  function defaultState() {
    return {
      version: C.SCHEMA_VERSION,
      onboardingCompleted: false,
      settings: {
        notificationPreference: C.NOTIFICATION_PREFERENCE.UNSET,
        soundEnabled: true,
        vibrationEnabled: true,
        wakeLockEnabled: true,
        darkMode: 'system'
      },
      goalProgress: {},
      history: [],
      activeSession: null
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

  function migrate(state) {
    if (!state || typeof state !== 'object') {
      return defaultState();
    }
    if (state.version !== C.SCHEMA_VERSION) {
      var fresh = defaultState();
      state.onboardingCompleted = !!state.onboardingCompleted;
      state.settings = Object.assign({}, fresh.settings, state.settings || {});
      state.goalProgress = state.goalProgress && typeof state.goalProgress === 'object' ? state.goalProgress : {};
      state.history = Array.isArray(state.history) ? state.history : [];
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
      settings: Object.assign({}, fresh.settings, state.settings && typeof state.settings === 'object' ? state.settings : {}),
      goalProgress: state.goalProgress && typeof state.goalProgress === 'object' ? state.goalProgress : {},
      history: Array.isArray(state.history) ? state.history : [],
      activeSession: state.activeSession && typeof state.activeSession === 'object' ? state.activeSession : null
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
