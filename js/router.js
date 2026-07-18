/* 15분 시동 - 해시 기반 라우터 (GitHub Pages 하위 경로에서도 동작) */
(function (global) {
  'use strict';

  var listeners = [];

  function parseHash() {
    var hash = global.location.hash || '#/home';
    var path = hash.replace(/^#/, '');
    if (!path || path === '/') path = '/home';
    var parts = path.split('/').filter(Boolean);
    var name = parts[0] || 'home';
    var params = parts.slice(1);
    return { name: name, params: params, raw: path };
  }

  function notify() {
    var route = parseHash();
    listeners.forEach(function (fn) {
      try { fn(route); } catch (e) { /* 라우트 리스너 오류가 앱 전체를 멈추지 않게 함 */ }
    });
  }

  var Router = {
    navigate: function (path, opts) {
      opts = opts || {};
      var target = '#' + path;
      if (opts.replace) {
        var url = global.location.pathname + global.location.search + target;
        global.history.replaceState(null, '', url);
        notify();
      } else {
        global.location.hash = target;
      }
    },

    current: function () {
      return parseHash();
    },

    on: function (fn) {
      listeners.push(fn);
      return function unsubscribe() {
        var idx = listeners.indexOf(fn);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    },

    init: function () {
      global.addEventListener('hashchange', notify);
      if (!global.location.hash) {
        global.history.replaceState(null, '', global.location.pathname + global.location.search + '#/home');
      }
      notify();
    }
  };

  global.FMS = global.FMS || {};
  global.FMS.Router = Router;
})(window);
