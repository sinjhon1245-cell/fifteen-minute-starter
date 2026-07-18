/* 15분 시동 - 공통 UI 유틸 (렌더 헬퍼, 다이얼로그/시트/토스트/롱프레스) */
(function (global) {
  'use strict';

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatMs(ms) {
    var totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
  }

  var toastTimer = null;
  function showToast(message) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    document.body.appendChild(toast);
    if (toastTimer) global.clearTimeout(toastTimer);
    toastTimer = global.setTimeout(function () {
      toast.remove();
    }, 2600);
  }

  var activeOverlayRelease = null;

  function closeOverlay() {
    var overlay = document.querySelector('.overlay, .sheet-overlay');
    if (overlay) overlay.remove();
    if (activeOverlayRelease) {
      activeOverlayRelease();
      activeOverlayRelease = null;
    }
  }

  function showDialog(opts) {
    closeOverlay();
    var overlay = document.createElement('div');
    overlay.className = 'overlay';

    var dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'dialog-title');

    var titleEl = document.createElement('div');
    titleEl.className = 'dialog__title';
    titleEl.id = 'dialog-title';
    titleEl.textContent = opts.title;
    dialog.appendChild(titleEl);

    if (opts.body) {
      var bodyEl = document.createElement('div');
      bodyEl.className = 'dialog__body';
      bodyEl.textContent = opts.body;
      dialog.appendChild(bodyEl);
    }

    if (opts.extra) {
      dialog.appendChild(opts.extra);
    }

    var actions = document.createElement('div');
    actions.className = 'dialog__actions';
    (opts.actions || []).forEach(function (action) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = action.className || 'btn btn-secondary';
      btn.textContent = action.label;
      btn.addEventListener('click', function () {
        if (action.onSelect) action.onSelect();
      });
      actions.appendChild(btn);
    });
    dialog.appendChild(actions);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    activeOverlayRelease = global.FMS.A11y.trapFocus(dialog);

    overlay.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && opts.allowEscape !== false) {
        closeOverlay();
      }
    });

    return closeOverlay;
  }

  function showSheet(opts) {
    closeOverlay();
    var overlay = document.createElement('div');
    overlay.className = 'sheet-overlay';

    var sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', 'sheet-title');

    var titleEl = document.createElement('div');
    titleEl.className = 'sheet__title';
    titleEl.id = 'sheet-title';
    titleEl.textContent = opts.title;
    sheet.appendChild(titleEl);

    if (opts.body) {
      var bodyEl = document.createElement('div');
      bodyEl.className = 'sheet__body';
      bodyEl.textContent = opts.body;
      sheet.appendChild(bodyEl);
    }

    var actions = document.createElement('div');
    actions.className = 'sheet__actions';
    (opts.actions || []).forEach(function (action) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = action.className || 'btn btn-secondary';
      btn.textContent = action.label;
      btn.addEventListener('click', function () {
        if (action.onSelect) action.onSelect();
      });
      actions.appendChild(btn);
    });
    sheet.appendChild(actions);

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    activeOverlayRelease = global.FMS.A11y.trapFocus(sheet);

    return closeOverlay;
  }

  function attachLongPress(button, opts) {
    var holdMs = opts.holdMs || 3000;
    var fillEl = button.querySelector('.longpress-fill');
    var rafId = null;
    var startTime = null;
    var pointerActive = false;

    function step(ts) {
      if (!startTime) startTime = ts;
      var elapsed = ts - startTime;
      var pct = Math.min(100, (elapsed / holdMs) * 100);
      if (fillEl) fillEl.style.width = pct + '%';
      if (elapsed >= holdMs) {
        cancel();
        opts.onComplete();
        return;
      }
      if (pointerActive) {
        rafId = global.requestAnimationFrame(step);
      }
    }

    function start(e) {
      e.preventDefault();
      pointerActive = true;
      startTime = null;
      rafId = global.requestAnimationFrame(step);
    }

    function cancel() {
      pointerActive = false;
      startTime = null;
      if (rafId) global.cancelAnimationFrame(rafId);
      if (fillEl) fillEl.style.width = '0%';
    }

    button.addEventListener('pointerdown', start);
    button.addEventListener('pointerup', cancel);
    button.addEventListener('pointerleave', cancel);
    button.addEventListener('pointercancel', cancel);

    return cancel;
  }

  global.FMS = global.FMS || {};
  global.FMS.UI = {
    escapeHtml: escapeHtml,
    formatMs: formatMs,
    showToast: showToast,
    showDialog: showDialog,
    showSheet: showSheet,
    closeOverlay: closeOverlay,
    attachLongPress: attachLongPress
  };
})(window);
