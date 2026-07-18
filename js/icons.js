/* 15분 시동 - Inline SVG 아이콘 모음 (외부 아이콘 CDN 미사용) */
(function (global) {
  'use strict';

  function svg(inner, attrs) {
    attrs = attrs || '';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" ' + attrs + '>' + inner + '</svg>';
  }

  var CATEGORY_ICONS = {
    reading: svg('<path d="M4 5.5C4 4.67 4.67 4 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z"/><path d="M20 5.5c0-.83-.67-1.5-1.5-1.5H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5v-13Z"/>'),
    exercise: svg('<path d="M6.5 8.5v7M17.5 8.5v7"/><path d="M3 10v4M21 10v4"/><path d="M6.5 12h11"/>'),
    study: svg('<path d="M3 8 12 4l9 4-9 4-9-4Z"/><path d="M7 10.5V16c0 1.1 2.24 2 5 2s5-.9 5-2v-5.5"/><path d="M21 8v6"/>'),
    english: svg('<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9A1.5 1.5 0 0 1 18.5 16H9l-4 4v-4H5.5A1.5 1.5 0 0 1 4 14.5v-9Z"/>'),
    writing: svg('<path d="M4 20h4L18.5 9.5a2 2 0 0 0-4-4L4 16v4Z"/><path d="M13.5 6.5l4 4"/>'),
    organizing: svg('<path d="M3.5 7.5 5 4h14l1.5 3.5"/><path d="M4 7.5h16V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V7.5Z"/><path d="M9.5 11.5h5"/>'),
    lifestyle: svg('<circle cx="12" cy="12" r="4"/><path d="M12 3v2.2M12 18.8V21M4.2 12H3M21 12h-1.2M6 6l1.3 1.3M16.7 16.7 18 18M18 6l-1.3 1.3M7.3 16.7 6 18"/>'),
    finance: svg('<path d="M3.5 7A1.5 1.5 0 0 1 5 5.5h13A1.5 1.5 0 0 1 19.5 7v.5H3.5V7Z"/><path d="M3.5 7.5h17V17a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17V7.5Z"/><path d="M15 13.2a1.3 1.3 0 1 0 0 .1Z"/>')
  };

  var NAV_ICONS = {
    home: svg('<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v8.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V10"/>'),
    records: svg('<path d="M5 20V10M12 20V4M19 20v-6"/>'),
    settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 13a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V19a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H4a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H10a1.7 1.7 0 0 0 1-1.55V4a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V10c.14.42.42.78.79 1.02.29.19.63.3 1 .32H20a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51.98Z"/>')
  };

  var UI_ICONS = {
    bell: svg('<path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10Z"/><path d="M10 19a2 2 0 0 0 4 0"/>'),
    volume: svg('<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4v-5Z"/><path d="M16 9a4 4 0 0 1 0 6"/>'),
    vibrate: svg('<rect x="8" y="4" width="8" height="16" rx="1.5"/><path d="M3 9v6M21 9v6"/>'),
    moon: svg('<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 6.8 6.8 0 0 0 20 14.5Z"/>'),
    download: svg('<path d="M12 4v11"/><path d="M7.5 11 12 15.5 16.5 11"/><path d="M4 17.5V19A1.5 1.5 0 0 0 5.5 20.5h13A1.5 1.5 0 0 0 20 19v-1.5"/>'),
    info: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><path d="M12 7.8v.1"/>'),
    check: svg('<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>'),
    chevronRight: svg('<path d="M9 5.5 15.5 12 9 18.5"/>'),
    back: svg('<path d="M15 5.5 8.5 12l6.5 6.5"/>'),
    close: svg('<path d="M5.5 5.5 18.5 18.5M18.5 5.5 5.5 18.5"/>')
  };

  global.FMS = global.FMS || {};
  global.FMS.Icons = {
    category: function (categoryId) {
      return CATEGORY_ICONS[categoryId] || '';
    },
    nav: function (key) {
      return NAV_ICONS[key] || '';
    },
    ui: function (key) {
      return UI_ICONS[key] || '';
    }
  };
})(window);
