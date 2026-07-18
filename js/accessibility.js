/* 15분 시동 - 접근성 유틸 (포커스 이동, 포커스 트랩, 상태 알림용 aria-live) */
(function (global) {
  'use strict';

  var liveRegion = null;
  var lastFocusedBeforeModal = null;

  function getLiveRegion() {
    if (liveRegion) return liveRegion;
    liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('role', 'status');
    liveRegion.className = 'sr-only';
    document.body.appendChild(liveRegion);
    return liveRegion;
  }

  function announce(message) {
    var region = getLiveRegion();
    region.textContent = '';
    global.setTimeout(function () {
      region.textContent = message;
    }, 30);
  }

  function focusElement(el) {
    if (!el) return;
    if (!el.hasAttribute('tabindex')) {
      el.setAttribute('tabindex', '-1');
    }
    el.focus();
  }

  function moveFocusToHeading(root) {
    if (!root) return;
    var heading = root.querySelector('h1, h2, [data-screen-title]');
    focusElement(heading || root);
  }

  function getFocusableElements(container) {
    var selector = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.prototype.slice.call(container.querySelectorAll(selector)).filter(function (el) {
      return el.offsetParent !== null || el === document.activeElement;
    });
  }

  function trapFocus(container) {
    lastFocusedBeforeModal = document.activeElement;
    var focusables = getFocusableElements(container);
    if (focusables.length) {
      focusElement(focusables[0]);
    } else {
      focusElement(container);
    }

    function handleKeydown(e) {
      if (e.key === 'Tab') {
        var items = getFocusableElements(container);
        if (items.length === 0) return;
        var first = items[0];
        var last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          focusElement(last);
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          focusElement(first);
        }
      }
    }

    container.addEventListener('keydown', handleKeydown);

    return function releaseFocus() {
      container.removeEventListener('keydown', handleKeydown);
      if (lastFocusedBeforeModal) {
        focusElement(lastFocusedBeforeModal);
        lastFocusedBeforeModal = null;
      }
    };
  }

  global.FMS = global.FMS || {};
  global.FMS.A11y = {
    announce: announce,
    focusElement: focusElement,
    moveFocusToHeading: moveFocusToHeading,
    trapFocus: trapFocus
  };
})(window);
