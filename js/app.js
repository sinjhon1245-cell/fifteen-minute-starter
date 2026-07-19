/* 15분만 - 앱 진입점 및 화면 렌더링 (SPA 오케스트레이션) */
(function (global) {
  'use strict';

  var C = global.FMS.Constants;
  var Storage = global.FMS.Storage;
  var Router = global.FMS.Router;
  var Timer = global.FMS.Timer;
  var WakeLock = global.FMS.WakeLock;
  var Notifications = global.FMS.Notifications;
  var UI = global.FMS.UI;
  var A11y = global.FMS.A11y;
  var PWA = global.FMS.PWA;
  var Icons = global.FMS.Icons;
  var Copy = global.FMS.Copy;

  var GOALS = global.FMS_GOALS;
  var CATEGORIES = global.FMS_CATEGORIES;

  var root = document.getElementById('app-root');
  var navEl = document.getElementById('bottom-nav');

  var lastFinishedRecord = null;
  var focusMessageTimer = null;
  var wasHiddenDuringRun = false;
  var timerTickUnsub = null;
  var startCancelTimer = null;
  var onboardingSlideIndex = 0;
  var selectedProgressResult = null;

  var RING_RADIUS = 44;
  var RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

  var WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

  /* ---------------- 데이터 헬퍼 ---------------- */

  function getCategory(id) {
    return CATEGORIES.find(function (c) { return c.id === id; }) || null;
  }

  function getGoalsByCategory(categoryId) {
    return GOALS.filter(function (g) { return g.categoryId === categoryId; });
  }

  function getGoal(id) {
    return GOALS.find(function (g) { return g.id === id; }) || null;
  }

  function getStep(goal, stepNumber) {
    if (!goal) return null;
    return goal.steps.find(function (s) { return s.stepNumber === stepNumber; }) || null;
  }

  function catVar(categoryId, kind) {
    return 'var(--cat-' + categoryId + (kind === 'soft' ? '-soft' : '') + ')';
  }

  /* ---------------- 통계 헬퍼 ---------------- */

  function startOfWeek(date) {
    var d = new Date(date);
    var day = d.getDay();
    var diff = (day === 0 ? -6 : 1) - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function computeStats(state) {
    var history = state.history;
    var finished = history.filter(function (r) { return r.finished; });
    var partial = history.filter(function (r) { return !r.finished && r.progressResult === C.PROGRESS_RESULT.PARTIAL; });
    var startedOnly = history.filter(function (r) { return !r.finished && r.progressResult === C.PROGRESS_RESULT.STARTED_ONLY; });
    var startedAny = history.filter(function (r) { return !r.finished; });

    var weekStart = startOfWeek(new Date());
    var weekDates = {};
    finished.forEach(function (r) {
      var recordDate = new Date(r.actualEndTime || r.startTime);
      if (recordDate >= weekStart) {
        weekDates[r.date] = true;
      }
    });

    var withDuration = history.filter(function (r) { return typeof r.actualDurationMs === 'number'; });
    var avgDurationMs = withDuration.length
      ? withDuration.reduce(function (sum, r) { return sum + r.actualDurationMs; }, 0) / withDuration.length
      : null;

    var activeGoalIds = Object.keys(state.goalProgress).filter(function (gid) {
      var goal = getGoal(gid);
      var progress = state.goalProgress[gid];
      return goal && progress.currentStepNumber <= goal.steps.length;
    });

    var recent = history.slice().sort(function (a, b) {
      return (b.completedAt || b.actualEndTime || 0) - (a.completedAt || a.actualEndTime || 0);
    }).slice(0, 8);

    return {
      weeklyActiveDays: Object.keys(weekDates).length,
      completedCount: finished.length,
      startedCount: startedAny.length,
      partialCount: partial.length,
      startedOnlyCount: startedOnly.length,
      avgDurationMs: avgDurationMs,
      inProgressGoalCount: activeGoalIds.length,
      recent: recent
    };
  }

  /* ---------------- 다크모드 ---------------- */

  function applyTheme(state) {
    var mode = state.settings.darkMode;
    if (mode === 'dark' || mode === 'light') {
      document.documentElement.setAttribute('data-theme', mode);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  /* ---------------- 공통 렌더 ---------------- */

  function setScreen(html, opts) {
    opts = opts || {};
    root.innerHTML = html;
    root.className = 'screen' + (opts.center ? ' screen--center' : '') + (opts.timer ? ' screen--timer' : '');
    if (opts.showNav === false) {
      navEl.classList.add('hidden');
    } else {
      navEl.classList.remove('hidden');
      updateNavActive(opts.navKey);
    }
    global.requestAnimationFrame(function () {
      A11y.moveFocusToHeading(root);
    });
  }

  function updateNavActive(key) {
    Array.prototype.forEach.call(navEl.querySelectorAll('.bottom-nav__item'), function (item) {
      if (item.dataset.navKey === key) {
        item.setAttribute('aria-current', 'page');
      } else {
        item.removeAttribute('aria-current');
      }
    });
  }

  function appBarHtml(opts) {
    opts = opts || {};
    if (opts.back) {
      return '<div class="app-bar">' +
        '<a class="app-bar__settings" href="' + opts.back + '" aria-label="뒤로 가기">' +
        '<span class="icon">' + Icons.ui('back') + '</span></a>' +
        '<span class="text-caption">' + UI.escapeHtml(opts.title || '') + '</span>' +
        '<span class="app-bar__settings" aria-hidden="true"></span>' +
        '</div>';
    }
    return '<div class="app-bar">' +
      '<div class="app-bar__brand">' +
      '<span class="app-bar__mark">15</span>' +
      '<span>' + UI.escapeHtml(C.APP_NAME) + '</span>' +
      '</div>' +
      '<a class="app-bar__settings" href="#/settings" aria-label="설정">' +
      '<span class="icon">' + Icons.nav('settings') + '</span></a>' +
      '</div>';
  }

  function goalCardMeta(goal, state) {
    var progress = state.goalProgress[goal.id] || { currentStepNumber: 1, completedStepNumbers: [] };
    var doneToday = Timer.hasCompletedGoalToday(goal.id);
    var total = goal.steps.length;
    var current = Math.min(progress.currentStepNumber, total);
    var completedAll = progress.currentStepNumber > total;
    var started = (progress.completedStepNumbers || []).length > 0;
    return { progress: progress, doneToday: doneToday, total: total, current: current, completedAll: completedAll, started: started };
  }

  function statusBadgeHtml(meta) {
    if (meta.completedAll) return '<span class="card__badge card__badge--success">전체 완료</span>';
    if (meta.doneToday) return '<span class="card__badge card__badge--accent">' + UI.escapeHtml(Copy.category.doneTodayBadge) + '</span>';
    if (meta.started) return '<span class="card__badge">진행 중</span>';
    return '<span class="card__badge">시작 전</span>';
  }

  function goalCardHtml(goal, state) {
    var meta = goalCardMeta(goal, state);
    var nextStep = getStep(goal, meta.current);
    var pct = Math.round((meta.progress.completedStepNumbers ? meta.progress.completedStepNumbers.length : 0) / meta.total * 100);
    return '<a class="goal-card" href="#/goal/' + goal.id + '">' +
      '<span class="goal-card__icon" style="background:' + catVar(goal.categoryId, 'soft') + ';color:' + catVar(goal.categoryId) + ';">' +
      '<span class="icon">' + Icons.category(goal.categoryId) + '</span></span>' +
      '<span class="goal-card__body">' +
      '<span class="goal-card__title-row"><span class="card__title">' + UI.escapeHtml(goal.title) + '</span>' + statusBadgeHtml(meta) + '</span>' +
      '<span class="goal-card__progress-row"><span class="progress-track"><span class="progress-fill" style="width:' + Math.max(4, pct) + '%;background:' + catVar(goal.categoryId) + ';"></span></span>' +
      '<span class="text-caption">' + meta.current + '/' + meta.total + '</span></span>' +
      '<span class="goal-card__next">' + (meta.completedAll ? UI.escapeHtml(Copy.category.allStepsDone) : UI.escapeHtml(nextStep ? nextStep.title : '')) + '</span>' +
      '</span>' +
      '<span class="goal-card__chevron icon">' + Icons.ui('chevronRight') + '</span>' +
      '</a>';
  }

  /* ---------------- 온보딩 ---------------- */

  function renderOnboarding() {
    var idx = onboardingSlideIndex;
    var slide = Copy.onboarding.slides[idx];
    var isLast = idx === Copy.onboarding.slides.length - 1;

    var dots = Copy.onboarding.slides.map(function (s, i) {
      return '<span class="onboarding-dots__dot" aria-current="' + (i === idx ? 'true' : 'false') + '"></span>';
    }).join('');

    var titleHtml = UI.escapeHtml(slide.title).replace(/\n/g, '<br>');

    var html =
      '<div class="screen__body" style="justify-content:center;">' +
      '<h1 tabindex="-1">' + titleHtml + '</h1>' +
      '<p class="text-body" style="margin-top:16px;">' + UI.escapeHtml(slide.body) + '</p>' +
      '<div class="onboarding-dots">' + dots + '</div>' +
      '</div>' +
      '<div class="screen__footer">' +
      '<button type="button" class="btn btn-primary" id="onboarding-next">' +
      (isLast ? UI.escapeHtml(Copy.onboarding.start) : UI.escapeHtml(Copy.onboarding.next)) +
      '</button>' +
      '</div>';

    setScreen(html, { showNav: false, center: false });

    document.getElementById('onboarding-next').addEventListener('click', function () {
      if (isLast) {
        Storage.update(function (state) {
          state.onboardingCompleted = true;
          return state;
        });
        onboardingSlideIndex = 0;
        Router.navigate('/home', { replace: true });
      } else {
        onboardingSlideIndex += 1;
        renderOnboarding();
      }
    });
  }

  /* ---------------- 홈 ---------------- */

  function renderHome() {
    var state = Storage.load();
    var stats = computeStats(state);
    var K = Copy.home;

    var continueGoal = null;
    var continueEntry = Object.keys(state.goalProgress)
      .map(function (gid) { return { gid: gid, progress: state.goalProgress[gid] }; })
      .filter(function (e) { return getGoal(e.gid) && !Timer.hasCompletedGoalToday(e.gid); })
      .sort(function (a, b) {
        return (b.progress.lastCompletedDate || '').localeCompare(a.progress.lastCompletedDate || '');
      })[0];

    continueGoal = continueEntry ? getGoal(continueEntry.gid) : GOALS[0];

    var meta = goalCardMeta(continueGoal, state);
    var nextStep = getStep(continueGoal, meta.current);
    var pct = Math.round((meta.progress.completedStepNumbers ? meta.progress.completedStepNumbers.length : 0) / meta.total * 100);

    var categoriesHtml = CATEGORIES.map(function (c) {
      var goalsInCat = getGoalsByCategory(c.id);
      var doneCount = goalsInCat.filter(function (g) { return goalCardMeta(g, state).completedAll; }).length;
      return '<a class="category-tile" href="#/category/' + c.id + '">' +
        '<span class="category-tile__icon" style="background:' + catVar(c.id, 'soft') + ';color:' + catVar(c.id) + ';">' +
        '<span class="icon">' + Icons.category(c.id) + '</span></span>' +
        '<span class="category-tile__title">' + UI.escapeHtml(c.title) + '</span>' +
        '<span class="category-tile__meta">' + doneCount + '/' + goalsInCat.length + ' 완주</span>' +
        '</a>';
    }).join('');

    var recentHtml = stats.recent.length
      ? stats.recent.slice(0, 5).map(function (r) { return recordItemHtml(r); }).join('')
      : '<p class="empty-state">' + UI.escapeHtml(K.emptyRecent) + '</p>';

    var showInstallCard = !PWA.isStandalone() && !state.installCompleted;

    var html =
      appBarHtml() +
      '<div class="hero">' +
      '<div class="hero__eyebrow"><span class="text-eyebrow">' + UI.escapeHtml(K.eyebrow) + '</span>' +
      '<span class="text-caption">' + UI.escapeHtml(Storage.todayKey()) + '</span></div>' +
      '<h1 class="hero__title" tabindex="-1">' + UI.escapeHtml(K.heroTitle).replace(/\n/g, '<br>') + '</h1>' +
      '<p class="text-strong hero__accent">' + UI.escapeHtml(K.heroAccent) + '</p>' +
      '</div>' +
      '<div class="screen__body">' +

      '<div class="current-action-card">' +
      '<div class="current-action-card__meta">' +
      '<span class="current-action-card__cat-icon" style="background:' + catVar(continueGoal.categoryId, 'soft') + ';color:' + catVar(continueGoal.categoryId) + ';">' +
      '<span class="icon">' + Icons.category(continueGoal.categoryId) + '</span></span>' +
      '<span class="text-caption">' + UI.escapeHtml(getCategory(continueGoal.categoryId).title) + ' · ' + meta.current + '/' + meta.total + '단계</span>' +
      '</div>' +
      '<div class="current-action-card__title text-h2">' + UI.escapeHtml(continueGoal.title) + '</div>' +
      '<div class="current-action-card__next text-body">' +
      (meta.doneToday ? K.doneTodayBadge : UI.escapeHtml(nextStep ? nextStep.title : K.allStepsDone)) +
      '</div>' +
      '<div class="progress-track"><div class="progress-fill" style="width:' + Math.max(4, pct) + '%;"></div></div>' +
      '<a class="btn btn-primary" style="margin-top:20px;" href="#/goal/' + continueGoal.id + '">15분 시작</a>' +
      '</div>' +

      '<div class="section-title">' + UI.escapeHtml(K.categoriesTitle) + '</div>' +
      '<div class="grid-2">' + categoriesHtml + '</div>' +

      '<div class="section-title">' + UI.escapeHtml(K.statsTitle) + '</div>' +
      '<div class="stat-row">' +
      '<div class="stat-tile"><div class="stat-tile__value">' + stats.weeklyActiveDays + '</div><div class="stat-tile__label">' + UI.escapeHtml(K.statLabels.weeklyActiveDays) + '</div></div>' +
      '<div class="stat-tile"><div class="stat-tile__value">' + stats.completedCount + '</div><div class="stat-tile__label">' + UI.escapeHtml(K.statLabels.completedCount) + '</div></div>' +
      '<div class="stat-tile"><div class="stat-tile__value">' + stats.startedCount + '</div><div class="stat-tile__label">' + UI.escapeHtml(K.statLabels.startedCount) + '</div></div>' +
      '</div>' +

      (showInstallCard ?
        '<div class="section-title">&nbsp;</div>' +
        '<div class="install-card" id="home-install-card">' +
        '<span class="install-card__icon"><span class="icon">' + Icons.ui('install') + '</span></span>' +
        '<span class="install-card__body">' +
        '<span class="install-card__title">' + UI.escapeHtml(Copy.install.cardTitle) + '</span>' +
        '<span class="install-card__desc">' + UI.escapeHtml(Copy.install.cardBody) + '</span>' +
        '</span>' +
        '<button type="button" class="install-card__action" id="home-install-btn">설치</button>' +
        '</div>'
        : '') +

      '<div class="section-title">' + UI.escapeHtml(K.recentTitle) + '</div>' +
      recentHtml +
      '</div>';

    setScreen(html, { navKey: 'home' });

    var installBtn = document.getElementById('home-install-btn');
    if (installBtn) {
      installBtn.addEventListener('click', handleInstallClick);
    }
  }

  function handleInstallClick() {
    if (PWA.canPromptInstall()) {
      PWA.promptInstall().then(function (outcome) {
        if (outcome === 'accepted') {
          UI.showToast(Copy.install.installedToast);
          render(Router.current());
        }
      });
    } else {
      Router.navigate('/install');
    }
  }

  function recordItemHtml(r) {
    var g = getGoal(r.goalId);
    var title = r.goalTitle || (g ? g.title : '삭제된 목표');
    var resultLabel = Copy.records.progressResultLabel[r.progressResult] || Copy.records.progressResultLabel.unknown;
    var isDone = r.finished;
    var iconClass = isDone ? 'timeline-item__icon' : 'timeline-item__icon timeline-item__icon--stopped';
    var iconSvg = isDone ? Icons.ui('check') : Icons.ui('flag');
    var durationLabel = typeof r.actualDurationMs === 'number' ? Timer.formatDuration(r.actualDurationMs) : '시간 기록 없음';
    return '<div class="timeline-item">' +
      '<span class="' + iconClass + '"><span class="icon icon--sm">' + iconSvg + '</span></span>' +
      '<span class="timeline-item__body">' +
      '<span class="timeline-item__title">' + UI.escapeHtml(title) + '</span>' +
      '<span class="timeline-item__meta">' + UI.escapeHtml(r.date || '') + ' · ' + UI.escapeHtml(durationLabel) + ' · ' + UI.escapeHtml(resultLabel) + '</span>' +
      '</span></div>';
  }

  /* ---------------- 분야별 목표 목록 ---------------- */

  function renderCategory(categoryId) {
    var category = getCategory(categoryId);
    if (!category) {
      UI.showToast(Copy.goalDetail.unknownGoalToast);
      Router.navigate('/home', { replace: true });
      return;
    }
    var state = Storage.load();
    var goals = getGoalsByCategory(categoryId);

    var cardsHtml = goals.map(function (goal) {
      return goalCardHtml(goal, state);
    }).join('');

    var html =
      appBarHtml({ back: '#/home', title: Copy.category.eyebrow }) +
      '<div class="screen__header">' +
      '<div style="display:flex;align-items:center;gap:12px;">' +
      '<span class="current-action-card__cat-icon" style="background:' + catVar(category.id, 'soft') + ';color:' + catVar(category.id) + ';">' +
      '<span class="icon">' + Icons.category(category.id) + '</span></span>' +
      '<h1 tabindex="-1">' + UI.escapeHtml(category.title) + '</h1>' +
      '</div>' +
      '</div>' +
      '<div class="screen__body card-list">' + cardsHtml + '</div>';

    setScreen(html, { navKey: 'home' });
  }

  /* ---------------- 오늘의 15분 행동 ---------------- */

  function renderGoalDetail(goalId) {
    var goal = getGoal(goalId);
    if (!goal) {
      UI.showToast(Copy.goalDetail.unknownGoalToast);
      Router.navigate('/home', { replace: true });
      return;
    }
    var state = Storage.load();
    var meta = goalCardMeta(goal, state);
    var K = Copy.goalDetail;

    if (meta.doneToday) {
      Router.navigate('/already-done/' + goalId, { replace: true });
      return;
    }

    if (meta.completedAll) {
      var doneHtml =
        appBarHtml({ back: '#/category/' + goal.categoryId, title: goal.title }) +
        '<div class="screen__header"><h1 tabindex="-1">' + UI.escapeHtml(goal.title) + '</h1></div>' +
        '<div class="screen__body screen--center"><p class="text-strong">' + UI.escapeHtml(K.allDoneTitle) + '</p>' +
        '<p class="text-body">' + UI.escapeHtml(K.allDoneBody) + '</p></div>' +
        '<div class="screen__footer"><a class="btn btn-secondary" href="#/category/' + goal.categoryId + '">' + UI.escapeHtml(K.allDoneButton) + '</a></div>';
      setScreen(doneHtml, { navKey: 'home' });
      return;
    }

    var step = getStep(goal, meta.current);
    var startMessage = goal.startMessage;

    var html =
      appBarHtml({ back: '#/category/' + goal.categoryId, title: goal.title }) +
      '<div class="screen__header">' +
      '<span class="card__badge card__badge--accent">' + step.stepNumber + ' / ' + meta.total + '단계</span>' +
      '<h1 tabindex="-1" style="margin-top:12px;">' + UI.escapeHtml(step.title) + '</h1>' +
      '</div>' +
      '<div class="screen__body">' +
      '<div class="card" style="border-color:' + catVar(goal.categoryId) + ';border-width:1.5px;">' +
      '<div class="card__title">' + UI.escapeHtml(K.actionCardTitle) + '</div><p class="text-body" style="margin-top:8px;">' + UI.escapeHtml(step.action) + '</p></div>' +
      '<div class="card"><div class="card__title">' + UI.escapeHtml(K.prepCardTitle) + '</div><p class="text-body" style="margin-top:8px;">' + UI.escapeHtml(step.preparation) + '</p></div>' +
      '<div class="card"><div class="card__title">' + UI.escapeHtml(K.finishCardTitle) + '</div><p class="text-body" style="margin-top:8px;">' + UI.escapeHtml(step.finishAction) + '</p></div>' +
      '<p class="text-strong" style="margin-top:24px;">' + UI.escapeHtml(startMessage) + '</p>' +
      '</div>' +
      '<div class="screen__footer">' +
      '<button type="button" class="btn btn-primary" id="start-timer-btn">' + UI.escapeHtml(K.startButton) + '</button>' +
      '<p class="text-caption" style="text-align:center;margin-top:8px;">' + UI.escapeHtml(K.startCaption) + '</p>' +
      '</div>';

    setScreen(html, { navKey: 'home' });

    document.getElementById('start-timer-btn').addEventListener('click', function () {
      beginSession(goal, step, false);
    });
  }

  function beginSession(goal, step, forcedRerun) {
    Notifications.initAudioContext();
    var state = Storage.load();

    Timer.start({
      categoryId: goal.categoryId,
      goalId: goal.id,
      goalTitle: goal.title,
      stepId: step.id,
      stepNumber: step.stepNumber,
      stepTitle: step.title,
      actionText: step.action,
      fallbackActionText: step.fallbackAction,
      finishActionText: step.finishAction,
      notificationPreference: state.settings.notificationPreference,
      wakeLockPreference: state.settings.wakeLockEnabled,
      forcedRerun: forcedRerun
    });

    if (state.settings.wakeLockEnabled) {
      WakeLock.enable();
    }

    Router.navigate('/timer', { replace: true });

    if (state.settings.notificationPreference === C.NOTIFICATION_PREFERENCE.UNSET) {
      global.setTimeout(openNotificationSheet, 400);
    }
  }

  /* ---------------- 알림 권한 바텀시트 ---------------- */

  function openNotificationSheet(calledFromSettings) {
    var K = Copy.notificationSheet;
    var busy = false;
    var doReturnFocus = calledFromSettings
      ? function () { renderSettings(); }
      : returnFocusToTimerHeading;

    var close = UI.showSheet({
      title: K.title,
      body: K.body,
      actions: [
        {
          label: K.allow,
          className: 'btn btn-primary',
          onSelect: function () {
            if (busy) return;
            busy = true;
            var allowBtn = document.querySelector('.sheet__actions .btn-primary');
            var screenBtn = document.querySelector('.sheet__actions .btn-secondary');
            if (allowBtn) allowBtn.disabled = true;
            if (screenBtn) screenBtn.disabled = true;

            Notifications.requestPermission().then(function (result) {
              Storage.update(function (state) {
                state.settings.notificationPreference = result === 'granted'
                  ? C.NOTIFICATION_PREFERENCE.GRANTED
                  : C.NOTIFICATION_PREFERENCE.SCREEN_ONLY;
                return state;
              });
              return result;
            }).catch(function () {
              Storage.update(function (state) {
                state.settings.notificationPreference = C.NOTIFICATION_PREFERENCE.SCREEN_ONLY;
                return state;
              });
              return 'default';
            }).then(function (result) {
              UI.closeOverlay();
              if (result === 'granted') {
                UI.showToast(K.toastGranted);
              } else if (result === 'denied') {
                UI.showToast(K.toastDenied);
              } else {
                UI.showToast(K.toastDismissed);
              }
              refreshTimerStatusIfPresent();
              doReturnFocus();
            });
          }
        },
        {
          label: K.screenOnly,
          className: 'btn btn-secondary',
          onSelect: function () {
            if (busy) return;
            busy = true;
            Storage.update(function (state) {
              state.settings.notificationPreference = C.NOTIFICATION_PREFERENCE.SCREEN_ONLY;
              return state;
            });
            UI.closeOverlay();
            UI.showToast(K.toastScreenOnly);
            refreshTimerStatusIfPresent();
            doReturnFocus();
          }
        }
      ]
    });

    global.setTimeout(function () {
      var hintEls = document.querySelectorAll('.sheet__actions button');
      if (hintEls[0]) {
        var hint0 = document.createElement('span');
        hint0.className = 'text-caption';
        hint0.style.display = 'block';
        hint0.style.marginTop = '4px';
        hint0.textContent = K.allowHint;
        hintEls[0].insertAdjacentElement('afterend', hint0);
      }
      if (hintEls[1]) {
        var hint1 = document.createElement('span');
        hint1.className = 'text-caption';
        hint1.style.display = 'block';
        hint1.style.marginTop = '4px';
        hint1.textContent = K.screenOnlyHint;
        hintEls[1].insertAdjacentElement('afterend', hint1);
      }
    }, 0);

    return close;
  }

  function returnFocusToTimerHeading() {
    var heading = document.querySelector('.timer-screen__goal, h1, h2');
    if (heading) A11y.focusElement(heading);
  }

  function refreshTimerStatusIfPresent() {
    var notifStatus = document.getElementById('notification-status');
    if (!notifStatus) return;
    var state = Storage.load();
    notifStatus.textContent = Copy.timer.notificationPrefix + ' ' + notificationStatusLabel(state);
  }

  /* ---------------- 타이머 실행 화면 ---------------- */

  function renderTimer() {
    var session = Timer.getActive();
    if (!session) {
      Router.navigate('/home', { replace: true });
      return;
    }
    var goal = getGoal(session.goalId);
    var state = Storage.load();
    var K = Copy.timer;

    var wakeLockLabel = state.settings.wakeLockEnabled
      ? (WakeLock.isSupported() ? K.wakeLockOn : K.wakeLockUnsupported)
      : K.wakeLockOff;

    var fallbackLabel = session.fallbackUsed ? K.fallbackApplied : K.fallbackAvailable;

    var html =
      '<div class="screen__body">' +
      '<h2 class="sr-only" tabindex="-1">타이머 실행 중</h2>' +
      '<p class="timer-screen__goal">' + UI.escapeHtml(goal ? goal.title : '') + '</p>' +
      '<p class="timer-screen__action">' + UI.escapeHtml(session.actionText) +
      (session.fallbackUsed ? '<br><span class="text-caption">' + UI.escapeHtml(K.fallbackAppliedNote) + '</span>' : '') +
      '</p>' +
      '<div class="timer-ring-wrap">' +
      '<svg viewBox="0 0 100 100" aria-hidden="true">' +
      '<circle class="timer-ring-track" cx="50" cy="50" r="' + RING_RADIUS + '"></circle>' +
      '<circle class="timer-ring-fill" id="timer-ring-fill" cx="50" cy="50" r="' + RING_RADIUS + '" ' +
      'stroke-dasharray="' + RING_CIRCUMFERENCE.toFixed(1) + '" stroke-dashoffset="0"></circle>' +
      '</svg>' +
      '<div class="timer-ring-center">' +
      '<div class="timer-display" id="timer-display" aria-hidden="true">15:00</div>' +
      '<div class="timer-ring-status">집중 중</div>' +
      '</div>' +
      '</div>' +
      '<p class="sr-only" id="timer-live" aria-live="polite"></p>' +
      '<p class="focus-message" id="focus-message"></p>' +
      '<div class="timer-screen__meta">' +
      '<span class="status-chip status-chip--on" id="wakelock-status">' + UI.escapeHtml(wakeLockLabel) + '</span>' +
      '<span class="status-chip" id="notification-status">' + UI.escapeHtml(K.notificationPrefix) + ' ' + notificationStatusLabel(state) + '</span>' +
      '<span class="status-chip" id="hidden-count">' + UI.escapeHtml(K.focusedStatus) + '</span>' +
      '<span class="status-chip' + (session.fallbackUsed ? ' status-chip--warn' : '') + '" id="fallback-status">' + UI.escapeHtml(fallbackLabel) + '</span>' +
      '</div>' +
      '<div class="timer-screen__exit">' +
      '<button type="button" class="btn-quiet" id="early-done-btn">' + UI.escapeHtml(K.earlyDoneButton) + '</button>' +
      '<button type="button" class="btn-danger-quiet" id="mid-stop-btn">' + UI.escapeHtml(K.stopButton) + '</button>' +
      '</div>' +
      '</div>';

    setScreen(html, { showNav: false, timer: true });

    document.title = C.APP_NAME + ' · 실행 중';

    var displayEl = document.getElementById('timer-display');
    var liveEl = document.getElementById('timer-live');
    var ringFillEl = document.getElementById('timer-ring-fill');
    var focusEl = document.getElementById('focus-message');
    var hiddenCountEl = document.getElementById('hidden-count');

    var elapsedSinceStart = Date.now() - session.startTime;
    var msgIndex = Math.min(K.focusMessages.length - 1, Math.floor(elapsedSinceStart / C.FOCUS_MESSAGE_ROTATE_MS));
    focusEl.textContent = K.focusMessages[msgIndex];

    if (focusMessageTimer) global.clearInterval(focusMessageTimer);
    focusMessageTimer = global.setInterval(function () {
      msgIndex = (msgIndex + 1) % K.focusMessages.length;
      focusEl.textContent = K.focusMessages[msgIndex];
    }, C.FOCUS_MESSAGE_ROTATE_MS);

    var lastAnnouncedMinute = -1;

    if (timerTickUnsub) timerTickUnsub();
    timerTickUnsub = Timer.onTick(function (activeSession) {
      if (!activeSession) return;
      var remaining = Timer.getRemainingMs(activeSession);
      displayEl.textContent = UI.formatMs(remaining);
      var elapsedFraction = 1 - (remaining / C.TIMER_DURATION_MS);
      ringFillEl.style.strokeDashoffset = (RING_CIRCUMFERENCE * Math.max(0, Math.min(1, elapsedFraction))).toFixed(1);

      var hc = activeSession.hiddenCount || 0;
      hiddenCountEl.textContent = hc > 0 ? (K.exitedStatus + ' ' + hc + '회') : K.focusedStatus;

      var minuteLeft = Math.ceil(remaining / 60000);
      if (minuteLeft !== lastAnnouncedMinute && remaining > 0 && remaining % 60000 < 300) {
        lastAnnouncedMinute = minuteLeft;
        liveEl.textContent = '남은 시간 약 ' + minuteLeft + '분';
      }

      if (remaining <= 0 && activeSession.status === C.SESSION_STATUS.RUNNING) {
        handleTimerExpired();
      }
    });

    if (startCancelTimer) { global.clearTimeout(startCancelTimer); startCancelTimer = null; }
    var elapsedSinceLaunch = Date.now() - session.startTime;
    if (elapsedSinceLaunch < C.START_CANCEL_WINDOW_MS) {
      var cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn-quiet';
      cancelBtn.textContent = Copy.goalDetail.cancelStart;
      cancelBtn.style.marginTop = '8px';
      cancelBtn.addEventListener('click', function () {
        if (startCancelTimer) global.clearTimeout(startCancelTimer);
        Timer.cancelStart();
        WakeLock.disable();
        Router.navigate('/goal/' + session.goalId, { replace: true });
      });
      document.querySelector('.timer-screen__exit').prepend(cancelBtn);

      startCancelTimer = global.setTimeout(function () {
        if (cancelBtn && cancelBtn.parentNode) cancelBtn.remove();
        startCancelTimer = null;
      }, C.START_CANCEL_WINDOW_MS - elapsedSinceLaunch);
    }

    document.getElementById('mid-stop-btn').addEventListener('click', openMidStopSheet);
    document.getElementById('early-done-btn').addEventListener('click', openEarlyCompleteSheet);
  }

  function notificationStatusLabel(state) {
    var K = Copy.timer;
    if (!Notifications.isSupported()) return K.notificationUnsupported;
    var perm = Notifications.getPermission();
    if (perm === 'granted') return K.notificationGranted;
    if (perm === 'denied') return K.notificationDenied;
    return state.settings.notificationPreference === C.NOTIFICATION_PREFERENCE.SCREEN_ONLY ? K.notificationScreenOnly : K.notificationUnset;
  }

  function stopTimerScreenTimers() {
    if (timerTickUnsub) { timerTickUnsub(); timerTickUnsub = null; }
    if (focusMessageTimer) { global.clearInterval(focusMessageTimer); focusMessageTimer = null; }
  }

  function handleTimerExpired() {
    stopTimerScreenTimers();
    Notifications.playEndSound();
    Notifications.vibrate([200, 100, 200, 100, 400]);
    Notifications.showTimerEndNotification();
    Timer.markFinishPending(C.FINISH_TYPE.TIMER_COMPLETE, { skipFinishScreen: false });
    WakeLock.disable();
    document.title = C.APP_NAME + ' · 종료됨';
    Router.navigate('/finish', { replace: true });
  }

  /* ---------------- 먼저 끝냈어요 ---------------- */

  function openEarlyCompleteSheet() {
    var K = Copy.earlyComplete;
    UI.showActionSheet({
      title: K.title,
      body: K.body,
      actions: [
        {
          title: K.keepGoing,
          body: K.keepGoingHint,
          icon: Icons.ui('play'),
          variant: 'primary',
          onSelect: function () { UI.closeOverlay(); returnFocusToTimerHeading(); }
        },
        {
          title: K.recordNow,
          body: K.recordNowHint,
          icon: Icons.ui('flag'),
          variant: 'danger',
          onSelect: function () {
            UI.closeOverlay();
            stopTimerScreenTimers();
            Timer.markFinishPending(C.FINISH_TYPE.EARLY_COMPLETE, { skipFinishScreen: true });
            WakeLock.disable();
            document.title = C.APP_NAME;
            Router.navigate('/record-result', { replace: true });
          }
        }
      ]
    });
  }

  /* ---------------- 이번 실행을 멈출까요? ---------------- */

  function openMidStopSheet() {
    var session = Timer.getActive();
    if (!session) return;
    var remaining = UI.formatMs(Timer.getRemainingMs(session));
    var K = Copy.midStop;
    var canReduce = Timer.canUseFallback(session);

    UI.showActionSheet({
      title: K.title,
      body: K.body,
      chip: K.remainingLabel + ' ' + remaining,
      actions: [
        {
          title: K.keepGoing.title,
          body: K.keepGoing.body,
          icon: Icons.ui('play'),
          variant: 'primary',
          onSelect: function () { UI.closeOverlay(); returnFocusToTimerHeading(); }
        },
        {
          title: canReduce ? K.reduce.title : K.reduce.usedTitle,
          body: canReduce ? K.reduce.body : K.reduce.usedBody,
          note: canReduce ? K.reduce.note : null,
          icon: canReduce ? Icons.ui('shrink') : Icons.ui('lock'),
          disabled: !canReduce,
          onSelect: function () {
            Timer.applyFallback();
            UI.closeOverlay();
            renderTimer();
            UI.showToast(K.reducedToast);
          }
        },
        {
          title: K.recordAndStop.title,
          body: K.recordAndStop.body,
          icon: Icons.ui('stopCircle'),
          variant: 'danger',
          onSelect: function () {
            UI.closeOverlay();
            openSecondConfirmSheet();
          }
        }
      ]
    });
  }

  function openSecondConfirmSheet() {
    var K = Copy.secondConfirm;
    UI.showActionSheet({
      title: K.title,
      body: K.body,
      actions: [
        {
          title: K.keepGoing,
          body: K.keepGoingHint,
          icon: Icons.ui('play'),
          variant: 'primary',
          onSelect: function () { UI.closeOverlay(); returnFocusToTimerHeading(); }
        },
        {
          title: K.confirmStop,
          body: K.confirmStopHint,
          icon: Icons.ui('stopCircle'),
          variant: 'danger',
          onSelect: function () {
            UI.closeOverlay();
            stopTimerScreenTimers();
            Timer.markFinishPending(C.FINISH_TYPE.MANUAL_END, { skipFinishScreen: true });
            WakeLock.disable();
            document.title = C.APP_NAME;
            Router.navigate('/record-result', { replace: true });
          }
        }
      ]
    });
  }

  /* ---------------- 종료 및 마무리 ---------------- */

  function renderFinish() {
    var session = Timer.getActive();
    if (!session || session.status !== C.SESSION_STATUS.FINISH_PENDING || session.skipFinishScreen) {
      Router.navigate('/home', { replace: true });
      return;
    }
    var K = Copy.finish;

    var html =
      '<div class="screen__body screen--center">' +
      '<div class="result-ring-wrap"><span class="icon icon--lg">' + Icons.ui('check') + '</span></div>' +
      '<h1 tabindex="-1" style="text-align:center;margin-top:20px;">' + UI.escapeHtml(K.title) + '</h1>' +
      '<p class="text-strong" style="text-align:center;margin-top:8px;">' + UI.escapeHtml(K.emphasis) + '</p>' +
      '<p class="text-body" style="text-align:center;margin-top:16px;">' + UI.escapeHtml(K.body) + '</p>' +
      '<div class="card" style="margin-top:24px;">' +
      '<div class="card__title">' + UI.escapeHtml(K.actionCardTitle) + '</div>' +
      '<p class="text-body" style="margin-top:8px;">' + UI.escapeHtml(session.finishActionText) + '</p>' +
      '</div>' +
      '</div>' +
      '<div class="screen__footer">' +
      '<button type="button" class="btn btn-primary" id="finish-btn">' + UI.escapeHtml(K.finishButton) + '</button>' +
      '</div>';

    setScreen(html, { showNav: false, timer: true });
    document.title = C.APP_NAME;

    document.getElementById('finish-btn').addEventListener('click', function () {
      Timer.proceedToRecordResult();
      Router.navigate('/record-result', { replace: true });
    });
  }

  /* ---------------- 결과 기록 ---------------- */

  function renderRecordResult() {
    var session = Timer.getActive();
    if (!session || session.status !== C.SESSION_STATUS.FINISH_PENDING) {
      Router.navigate('/home', { replace: true });
      return;
    }
    var K = Copy.resultRecord;
    var goal = getGoal(session.goalId);
    var durationMs = Math.max(0, (session.actualEndTime || Date.now()) - session.startTime);
    selectedProgressResult = null;

    var optionsHtml = K.options.map(function (opt) {
      return '<button type="button" class="choice-card" data-value="' + opt.value + '" aria-pressed="false">' +
        '<span class="choice-card__check"><span class="icon">' + Icons.ui('check') + '</span></span>' +
        '<span class="choice-card__text"><span class="choice-card__title">' + UI.escapeHtml(opt.title) + '</span>' +
        '<span class="choice-card__body">' + UI.escapeHtml(opt.body) + '</span></span>' +
        '</button>';
    }).join('');

    var html =
      '<div class="screen__header"><h1 tabindex="-1">' + UI.escapeHtml(K.title) + '</h1></div>' +
      '<div class="screen__body">' +
      '<div class="card">' +
      '<div class="summary-row"><span class="summary-row__label">목표</span><span class="summary-row__value">' + UI.escapeHtml(session.goalTitle || (goal ? goal.title : '')) + '</span></div>' +
      '<div class="summary-row"><span class="summary-row__label">단계</span><span class="summary-row__value">' + UI.escapeHtml(session.stepTitle || '') + '</span></div>' +
      '<div class="summary-row"><span class="summary-row__label">' + UI.escapeHtml(K.durationLabel) + '</span><span class="summary-row__value">' + UI.escapeHtml(Timer.formatDuration(durationMs)) + '</span></div>' +
      '<div class="summary-row"><span class="summary-row__label">' + UI.escapeHtml(K.hiddenLabel) + '</span><span class="summary-row__value">' + ((session.hiddenCount || 0) > 0 ? UI.escapeHtml(K.hiddenYes) : UI.escapeHtml(K.hiddenNo)) + '</span></div>' +
      '<div class="summary-row"><span class="summary-row__label">' + UI.escapeHtml(K.fallbackLabel) + '</span><span class="summary-row__value">' + (session.fallbackUsed ? UI.escapeHtml(K.fallbackYes) : UI.escapeHtml(K.fallbackNo)) + '</span></div>' +
      '</div>' +
      '<p class="text-strong" style="margin-top:24px;">' + UI.escapeHtml(K.question) + '</p>' +
      '<div class="choice-card-list" id="result-choice-list" style="margin-top:12px;">' + optionsHtml + '</div>' +
      '</div>' +
      '<div class="screen__footer">' +
      '<button type="button" class="btn btn-primary" id="record-submit-btn" disabled aria-disabled="true">' + UI.escapeHtml(K.submitButton) + '</button>' +
      '</div>';

    setScreen(html, { showNav: false });

    var submitBtn = document.getElementById('record-submit-btn');
    var cards = Array.prototype.slice.call(document.querySelectorAll('#result-choice-list .choice-card'));
    cards.forEach(function (card) {
      card.addEventListener('click', function () {
        cards.forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
        card.setAttribute('aria-pressed', 'true');
        selectedProgressResult = card.getAttribute('data-value');
        submitBtn.disabled = false;
        submitBtn.removeAttribute('aria-disabled');
      });
    });

    submitBtn.addEventListener('click', function () {
      if (!selectedProgressResult) return;
      var record = Timer.finalizeWithResult(selectedProgressResult);
      lastFinishedRecord = record;
      UI.showToast(K.savedToast);
      Router.navigate('/result', { replace: true });
    });
  }

  /* ---------------- 완료 결과 ---------------- */

  function renderResult() {
    var state = Storage.load();
    var record = lastFinishedRecord || state.history[state.history.length - 1];
    if (!record) {
      Router.navigate('/home', { replace: true });
      return;
    }
    var K = Copy.result;
    var goal = getGoal(record.goalId);
    var progress = state.goalProgress[record.goalId];
    var nextStep = goal && progress ? getStep(goal, Math.min(progress.currentStepNumber, goal.steps.length)) : null;
    var completedAll = goal && progress && progress.currentStepNumber > goal.steps.length;
    var pct = goal && progress ? Math.round((progress.completedStepNumbers.length / goal.steps.length) * 100) : 0;

    var html =
      '<div class="screen__body screen--center">' +
      '<div class="result-ring-wrap"><span class="icon icon--lg">' + Icons.ui('check') + '</span></div>' +
      '<h1 tabindex="-1" style="text-align:center;margin-top:20px;">' + UI.escapeHtml(K.title) + '</h1>' +
      '<p class="result-badge" style="text-align:center;margin-top:12px;">' + UI.escapeHtml(K.subtitle) + '</p>' +
      (goal ? '<div class="progress-track" style="margin-top:20px;"><div class="progress-fill" style="width:' + Math.max(4, pct) + '%;background:' + catVar(goal.categoryId) + ';"></div></div>' +
        '<p class="text-caption" style="text-align:center;margin-top:6px;">' + UI.escapeHtml(goal.title) + ' · ' + pct + '%</p>' : '') +
      '<div class="card" style="margin-top:24px;">' +
      '<div class="card__title">' + UI.escapeHtml(K.nextLabel) + '</div>' +
      '<p class="text-body" style="margin-top:8px;">' +
      (completedAll ? UI.escapeHtml(K.allDone) : UI.escapeHtml(nextStep ? nextStep.title : '')) +
      '</p>' +
      '</div>' +
      '</div>' +
      '<div class="screen__footer">' +
      '<button type="button" class="btn btn-primary" id="result-home-btn">' + UI.escapeHtml(K.continueButton) + '</button>' +
      '</div>';

    setScreen(html, { showNav: false });

    document.getElementById('result-home-btn').addEventListener('click', function () {
      lastFinishedRecord = null;
      Router.navigate('/home', { replace: true });
    });
  }

  /* ---------------- 몰아서 실행 방지 ---------------- */

  function renderAlreadyDone(goalId) {
    var goal = getGoal(goalId);
    if (!goal) {
      UI.showToast(Copy.goalDetail.unknownGoalToast);
      Router.navigate('/home', { replace: true });
      return;
    }
    var K = Copy.alreadyDone;

    var html =
      '<div class="screen__body screen--center">' +
      '<h1 tabindex="-1">' + UI.escapeHtml(K.title) + '</h1>' +
      '<p class="text-body" style="margin-top:16px;">' + UI.escapeHtml(K.body) + '</p>' +
      '<p class="text-strong" style="margin-top:16px;">' + UI.escapeHtml(K.emphasis) + '</p>' +
      '</div>' +
      '<div class="screen__footer">' +
      '<button type="button" class="btn btn-primary" id="stop-today-btn">' + UI.escapeHtml(K.stopToday) + '</button>' +
      '<a class="btn btn-secondary" style="margin-top:8px;" href="#/category/' + goal.categoryId + '">' + UI.escapeHtml(K.otherGoal) + '</a>' +
      '<div style="margin-top:16px;text-align:center;">' +
      '<button type="button" class="btn-danger-quiet longpress-track" id="force-rerun-btn">' +
      '<span class="longpress-fill"></span><span class="longpress-label">' + UI.escapeHtml(K.forceRerun) + '</span>' +
      '</button>' +
      '<p class="text-caption" style="margin-top:4px;">' + UI.escapeHtml(K.forceRerunHint) + '</p>' +
      '</div>' +
      '</div>';

    setScreen(html, { showNav: false });

    document.getElementById('stop-today-btn').addEventListener('click', function () {
      Router.navigate('/home', { replace: true });
    });

    var forceBtn = document.getElementById('force-rerun-btn');
    UI.attachLongPress(forceBtn, {
      holdMs: C.FORCE_RERUN_HOLD_MS,
      onComplete: function () {
        var state = Storage.load();
        var progress = state.goalProgress[goalId] || { currentStepNumber: 1 };
        var step = getStep(goal, Math.min(progress.currentStepNumber, goal.steps.length));
        beginSession(goal, step, true);
      }
    });
  }

  /* ---------------- 기록 ---------------- */

  function renderRecords() {
    var state = Storage.load();
    var stats = computeStats(state);
    var K = Copy.records;

    var days = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var key = Storage.todayKey(d);
      var done = state.history.some(function (r) { return r.date === key && r.finished; });
      var weekdayIdx = (d.getDay() + 6) % 7;
      days.push('<div class="record-day"><span class="record-day__label">' + WEEKDAY_LABELS[weekdayIdx] + '</span>' +
        '<span class="record-day__dot" data-done="' + done + '" title="' + key + '">' +
        (done ? '<span class="icon icon--sm">' + Icons.ui('check') + '</span>' : '') + '</span></div>');
    }

    var inProgressHtml = Object.keys(state.goalProgress).map(function (gid) {
      var goal = getGoal(gid);
      if (!goal) return '';
      var progress = state.goalProgress[gid];
      if (progress.currentStepNumber > goal.steps.length) return '';
      return goalCardHtml(goal, state);
    }).join('') || '<p class="empty-state">' + UI.escapeHtml(K.emptyInProgress) + '</p>';

    var recentHtml = stats.recent.length
      ? stats.recent.map(function (r) { return recordItemHtml(r); }).join('')
      : '<p class="empty-state">' + UI.escapeHtml(K.emptyCompleted) + '</p>';

    var avgLabel = stats.avgDurationMs != null ? Timer.formatDuration(stats.avgDurationMs) : '기록 없음';

    var html =
      appBarHtml() +
      '<div class="screen__header"><h1 tabindex="-1">' + UI.escapeHtml(K.title) + '</h1></div>' +
      '<div class="screen__body">' +
      '<div class="stat-row">' +
      '<div class="stat-tile"><div class="stat-tile__value">' + stats.weeklyActiveDays + '</div><div class="stat-tile__label">' + UI.escapeHtml(K.statLabels.weeklyActiveDays) + '</div></div>' +
      '<div class="stat-tile"><div class="stat-tile__value">' + stats.completedCount + '</div><div class="stat-tile__label">' + UI.escapeHtml(K.statLabels.completedCount) + '</div></div>' +
      '<div class="stat-tile"><div class="stat-tile__value">' + stats.partialCount + '</div><div class="stat-tile__label">' + UI.escapeHtml(K.statLabels.partialCount) + '</div></div>' +
      '</div>' +
      '<div class="stat-row" style="margin-top:12px;">' +
      '<div class="stat-tile"><div class="stat-tile__value">' + stats.startedOnlyCount + '</div><div class="stat-tile__label">' + UI.escapeHtml(K.statLabels.startedCount) + '</div></div>' +
      '<div class="stat-tile" style="grid-column: span 2;"><div class="stat-tile__value">' + avgLabel + '</div><div class="stat-tile__label">' + UI.escapeHtml(K.statLabels.avgDuration) + '</div></div>' +
      '</div>' +
      '<div class="section-title">' + UI.escapeHtml(K.recentDaysTitle) + '</div>' +
      '<div class="record-day-grid">' + days.join('') + '</div>' +
      '<div class="section-title">' + UI.escapeHtml(K.inProgressTitle) + '</div>' + inProgressHtml +
      '<div class="section-title">' + UI.escapeHtml(K.recentCompletedTitle) + '</div>' + recentHtml +
      '<div class="section-title">' + UI.escapeHtml(K.resetTitle) + '</div>' +
      '<button type="button" class="btn btn-secondary" id="reset-records-btn">' + UI.escapeHtml(K.resetButton) + '</button>' +
      '</div>';

    setScreen(html, { navKey: 'records' });

    document.getElementById('reset-records-btn').addEventListener('click', function () {
      var RK = K.resetDialog;
      UI.showDialog({
        title: RK.title,
        body: RK.body,
        actions: [
          { label: RK.cancel, className: 'btn btn-secondary', onSelect: function () { UI.closeOverlay(); } },
          {
            label: RK.confirm,
            className: 'btn-danger-quiet',
            onSelect: function () {
              var onboarded = Storage.load().onboardingCompleted;
              var settings = Storage.load().settings;
              var installCompleted = Storage.load().installCompleted;
              Storage.reset();
              Storage.update(function (state2) {
                state2.onboardingCompleted = onboarded;
                state2.settings = settings;
                state2.installCompleted = installCompleted;
                return state2;
              });
              UI.closeOverlay();
              renderRecords();
              UI.showToast(RK.toast);
            }
          }
        ]
      });
    });
  }

  /* ---------------- 설정 ---------------- */

  function renderSettings() {
    var state = Storage.load();
    var s = state.settings;
    var K = Copy.settings;

    function toggleRow(id, iconKey, label, checked) {
      return '<div class="settings-row"><span class="settings-row__icon"><span class="icon icon--sm">' + Icons.ui(iconKey) + '</span></span>' +
        '<span class="settings-row__label">' + UI.escapeHtml(label) + '</span>' +
        '<button type="button" class="switch" id="' + id + '" role="switch" aria-checked="' + checked + '">' +
        '<span class="switch__knob"></span></button></div>';
    }

    var html =
      appBarHtml() +
      '<div class="screen__header"><h1 tabindex="-1">' + UI.escapeHtml(K.title) + '</h1></div>' +
      '<div class="screen__body">' +
      '<div class="settings-row"><span class="settings-row__icon"><span class="icon icon--sm">' + Icons.ui('bell') + '</span></span>' +
      '<span class="settings-row__label">' + UI.escapeHtml(K.notificationRow) + '<br><span class="text-caption">' + notificationStatusLabel(state) + '</span></span>' +
      '<button type="button" class="settings-row__action" id="notification-change-btn">' + UI.escapeHtml(K.notificationChange) + '</button></div>' +
      toggleRow('toggle-sound', 'volume', K.soundToggle, s.soundEnabled) +
      toggleRow('toggle-vibration', 'vibrate', K.vibrationToggle, s.vibrationEnabled) +
      toggleRow('toggle-wakelock', 'info', K.wakeLockToggle, s.wakeLockEnabled) +
      toggleRow('toggle-dark', 'moon', K.darkModeToggle, s.darkMode === 'dark') +
      '<div class="section-title">' + UI.escapeHtml(K.moreSection) + '</div>' +
      '<button type="button" class="settings-link" id="replay-onboarding-btn">' +
      '<span class="settings-row__icon"><span class="icon icon--sm">' + Icons.ui('back') + '</span></span>' +
      '<span class="settings-row__label">' + UI.escapeHtml(K.replayOnboarding) + '</span>' +
      '<span class="settings-link__chevron icon icon--sm">' + Icons.ui('chevronRight') + '</span></button>' +
      '<a class="settings-link" href="#/install">' +
      '<span class="settings-row__icon"><span class="icon icon--sm">' + Icons.ui('download') + '</span></span>' +
      '<span class="settings-row__label">' + UI.escapeHtml(K.installLink) + '</span>' +
      '<span class="settings-link__chevron icon icon--sm">' + Icons.ui('chevronRight') + '</span></a>' +
      '<a class="settings-link" href="#/about">' +
      '<span class="settings-row__icon"><span class="icon icon--sm">' + Icons.ui('info') + '</span></span>' +
      '<span class="settings-row__label">' + UI.escapeHtml(K.aboutLink) + '</span>' +
      '<span class="settings-link__chevron icon icon--sm">' + Icons.ui('chevronRight') + '</span></a>' +
      '<p class="text-caption" style="margin-top:16px;text-align:center;">버전 ' + C.APP_VERSION + '</p>' +
      '</div>';

    setScreen(html, { navKey: 'settings' });

    function bindToggle(id, onChange) {
      var btn = document.getElementById(id);
      btn.addEventListener('click', function () {
        var next = btn.getAttribute('aria-checked') !== 'true';
        btn.setAttribute('aria-checked', String(next));
        onChange(next);
      });
    }

    bindToggle('toggle-sound', function (v) { Storage.update(function (st) { st.settings.soundEnabled = v; return st; }); });
    bindToggle('toggle-vibration', function (v) { Storage.update(function (st) { st.settings.vibrationEnabled = v; return st; }); });
    bindToggle('toggle-wakelock', function (v) {
      Storage.update(function (st) { st.settings.wakeLockEnabled = v; return st; });
      if (!v) WakeLock.disable();
    });
    bindToggle('toggle-dark', function (v) {
      Storage.update(function (st) { st.settings.darkMode = v ? 'dark' : 'system'; return st; });
      applyTheme(Storage.load());
    });

    document.getElementById('replay-onboarding-btn').addEventListener('click', function () {
      onboardingSlideIndex = 0;
      Storage.update(function (st) { st.onboardingCompleted = false; return st; });
      Router.navigate('/onboarding', { replace: true });
    });

    document.getElementById('notification-change-btn').addEventListener('click', function () {
      openNotificationSheet(true);
    });
  }

  /* ---------------- PWA 설치 안내 ---------------- */

  function renderInstall() {
    var installed = PWA.isStandalone() || Storage.load().installCompleted;
    var canPrompt = PWA.canPromptInstall();
    var K = Copy.install;
    var isAndroid = /Android/i.test(navigator.userAgent);

    var html =
      appBarHtml({ back: '#/settings', title: K.cardTitle }) +
      '<div class="screen__header"><h1 tabindex="-1">' + UI.escapeHtml(K.cardTitle) + '</h1></div>' +
      '<div class="screen__body">' +
      '<p class="text-body">' + UI.escapeHtml(K.cardBody) + '</p>' +
      (installed
        ? '<p class="text-strong" style="margin-top:16px;">' + UI.escapeHtml(K.alreadyInstalled) + '</p>'
        : (canPrompt
          ? '<button type="button" class="btn btn-primary" id="install-btn" style="margin-top:16px;">' + UI.escapeHtml(K.installButton) + '</button>'
          : '<div class="card" style="margin-top:16px;"><div class="card__title">' + UI.escapeHtml(K.manualTitle) + '</div>' +
            '<p class="text-body" style="margin-top:8px;white-space:pre-line;">' + UI.escapeHtml(isAndroid ? K.manualAndroid : K.manualGeneric) + '</p></div>')) +
      '</div>';

    setScreen(html, { showNav: false });

    var installBtn = document.getElementById('install-btn');
    if (installBtn) {
      installBtn.addEventListener('click', function () {
        PWA.promptInstall().then(function (outcome) {
          if (outcome === 'accepted') {
            UI.showToast(K.installedToast);
            renderInstall();
          }
        });
      });
    }
  }

  /* ---------------- 앱 정보 ---------------- */

  function renderAbout() {
    var K = Copy.about;
    var html =
      appBarHtml({ back: '#/settings', title: K.title }) +
      '<div class="screen__header"><h1 tabindex="-1">' + UI.escapeHtml(K.title) + '</h1></div>' +
      '<div class="screen__body">' +
      '<p class="text-body">' + UI.escapeHtml(C.APP_NAME) + ' · 버전 ' + C.APP_VERSION + '</p>' +
      '<p class="text-body" style="margin-top:16px;">' + UI.escapeHtml(K.limitation) + '</p>' +
      '<p class="text-caption" style="margin-top:16px;">' + UI.escapeHtml(K.privacy) + '</p>' +
      '</div>';

    setScreen(html, { showNav: false });
  }

  /* ---------------- 라우트 가드 및 디스패치 ---------------- */

  function render(route) {
    var state = Storage.load();
    applyTheme(state);

    if (!state.onboardingCompleted && route.name !== 'onboarding') {
      Router.navigate('/onboarding', { replace: true });
      return;
    }

    var session = state.activeSession;
    if (session) {
      if (session.status === C.SESSION_STATUS.RUNNING && Timer.isExpired(session)) {
        Timer.markFinishPending(C.FINISH_TYPE.RECOVERED_AFTER_END, { skipFinishScreen: false });
        Notifications.playEndSound();
        Notifications.vibrate([200, 100, 200, 100, 400]);
        Notifications.showTimerEndNotification();
        WakeLock.disable();
        session = Storage.load().activeSession;
      }

      if (session && session.status === C.SESSION_STATUS.FINISH_PENDING) {
        var target = session.skipFinishScreen ? 'record-result' : 'finish';
        if (route.name !== target) {
          Router.navigate('/' + target, { replace: true });
          return;
        }
      } else if (session && session.status === C.SESSION_STATUS.RUNNING && route.name !== 'timer') {
        Router.navigate('/timer', { replace: true });
        global.setTimeout(openMidStopSheet, 30);
        return;
      }
    } else if (route.name === 'timer' || route.name === 'finish' || route.name === 'record-result') {
      Router.navigate('/home', { replace: true });
      return;
    }

    switch (route.name) {
      case 'onboarding': renderOnboarding(); break;
      case 'home': renderHome(); break;
      case 'category': renderCategory(route.params[0]); break;
      case 'goal': renderGoalDetail(route.params[0]); break;
      case 'timer': renderTimer(); break;
      case 'finish': renderFinish(); break;
      case 'record-result': renderRecordResult(); break;
      case 'result': renderResult(); break;
      case 'already-done': renderAlreadyDone(route.params[0]); break;
      case 'records': renderRecords(); break;
      case 'settings': renderSettings(); break;
      case 'install': renderInstall(); break;
      case 'about': renderAbout(); break;
      default: Router.navigate('/home', { replace: true });
    }
  }

  /* ---------------- 이탈 감지 ---------------- */

  document.addEventListener('visibilitychange', function () {
    var session = Timer.getActive();
    if (!session || session.status !== C.SESSION_STATUS.RUNNING) return;

    if (document.visibilityState === 'hidden') {
      wasHiddenDuringRun = true;
      var updated = Timer.recordHiddenEvent();
      var state = Storage.load();
      if (updated && Timer.canNotifyHiddenExit(updated) && state.settings.notificationPreference !== C.NOTIFICATION_PREFERENCE.SCREEN_ONLY) {
        Notifications.showHiddenExitNotification();
      }
    } else if (document.visibilityState === 'visible') {
      WakeLock.reacquireIfNeeded();
      if (wasHiddenDuringRun) {
        wasHiddenDuringRun = false;
        UI.showToast(Copy.timer.returnedToast);
      }
      var current = Router.current();
      render(current);
    }
  });

  /* 알림 클릭으로 복귀했을 때 Service Worker가 보내는 메시지에도 반응한다 */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function (event) {
      if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
        render(Router.current());
      }
    });
  }

  /* ---------------- 하단 내비게이션 ---------------- */

  function initNav() {
    var items = [
      { key: 'home', href: '#/home', icon: 'home', label: '홈' },
      { key: 'records', href: '#/records', icon: 'records', label: '기록' },
      { key: 'settings', href: '#/settings', icon: 'settings', label: '설정' }
    ];
    navEl.innerHTML = items.map(function (item) {
      return '<a class="bottom-nav__item" data-nav-key="' + item.key + '" href="' + item.href + '">' +
        '<span class="icon">' + Icons.nav(item.icon) + '</span>' +
        '<span>' + item.label + '</span></a>';
    }).join('');
  }

  /* ---------------- 초기화 ---------------- */

  function init() {
    var state = Storage.load();
    applyTheme(state);
    Timer.resumeTickingIfActive();
    initNav();

    PWA.registerServiceWorker();
    PWA.onUpdateAvailable(function () {
      UI.showToast(Copy.updateAvailableToast);
    });

    Router.on(render);
    Router.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
