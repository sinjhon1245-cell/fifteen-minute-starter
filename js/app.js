/* 15분 시동 - 앱 진입점 및 화면 렌더링 (SPA 오케스트레이션) */
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

  var FOCUS_MESSAGES = [
    '지금 집중하지 않으면 나중에도 같은 자리입니다.',
    '하기 싫은 감정은 행동을 멈출 이유가 아닙니다.',
    '생각이 많아질수록 손을 움직이세요.',
    '잘하려 하지 말고 끝까지 실행하세요.',
    '지금 이 15분이 오늘의 방향을 결정합니다.',
    '다른 일을 시작하지 마세요. 이것만 끝내세요.',
    '계획은 이미 끝났습니다. 지금은 실행할 시간입니다.'
  ];

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
    var finished = state.history.filter(function (r) { return r.finished; });
    var weekStart = startOfWeek(new Date());
    var weekDates = {};
    finished.forEach(function (r) {
      var recordDate = new Date(r.actualEndTime || r.startTime);
      if (recordDate >= weekStart) {
        weekDates[r.date] = true;
      }
    });

    var uniqueDates = Array.from(new Set(finished.map(function (r) { return r.date; }))).sort();
    var restartCount = 0;
    var prevDate = null;
    uniqueDates.forEach(function (dateKey) {
      if (!prevDate) {
        restartCount += 1;
      } else {
        var prev = new Date(prevDate + 'T00:00:00');
        var cur = new Date(dateKey + 'T00:00:00');
        var diffDays = Math.round((cur - prev) / 86400000);
        if (diffDays > 1) restartCount += 1;
      }
      prevDate = dateKey;
    });

    var activeGoalIds = Object.keys(state.goalProgress).filter(function (gid) {
      var goal = getGoal(gid);
      var progress = state.goalProgress[gid];
      return goal && progress.currentStepNumber <= goal.steps.length;
    });

    return {
      weeklyActiveDays: Object.keys(weekDates).length,
      totalCompletedSteps: finished.length,
      restartCount: restartCount,
      inProgressGoalCount: activeGoalIds.length,
      recentCompleted: finished.slice(-5).reverse()
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

  function goalCardMeta(goal, state) {
    var progress = state.goalProgress[goal.id] || { currentStepNumber: 1, completedStepNumbers: [] };
    var doneToday = Timer.hasCompletedGoalToday(goal.id);
    var total = goal.steps.length;
    var current = Math.min(progress.currentStepNumber, total);
    var completedAll = progress.currentStepNumber > total;
    return { progress: progress, doneToday: doneToday, total: total, current: current, completedAll: completedAll };
  }

  /* ---------------- 온보딩 ---------------- */

  var ONBOARDING_SLIDES = [
    { title: '더 좋은 계획은 필요 없습니다.', body: '지금 할 수 있는 행동 하나를 고르고 15분만 실행합니다.' },
    { title: '15분이 끝나면 멈춥니다.', body: '몰아서 하고 지치는 방식을 반복하지 않습니다.' },
    { title: '내일 다시 시작합니다.', body: '많이 한 시간이 아니라 다시 시작한 날을 기록합니다.' }
  ];

  function renderOnboarding() {
    var idx = onboardingSlideIndex;
    var slide = ONBOARDING_SLIDES[idx];
    var isLast = idx === ONBOARDING_SLIDES.length - 1;

    var dots = ONBOARDING_SLIDES.map(function (s, i) {
      return '<span class="onboarding-dots__dot" aria-current="' + (i === idx ? 'true' : 'false') + '"></span>';
    }).join('');

    var html =
      '<div class="screen__body" style="justify-content:center;">' +
      '<h1 tabindex="-1">' + UI.escapeHtml(slide.title) + '</h1>' +
      '<p class="text-body" style="margin-top:16px;">' + UI.escapeHtml(slide.body) + '</p>' +
      '<div class="onboarding-dots">' + dots + '</div>' +
      '</div>' +
      '<div class="screen__footer">' +
      '<button type="button" class="btn btn-primary" id="onboarding-next">' +
      (isLast ? '변명 끝. 시작한다' : '다음') +
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

    var continueGoal = null;
    var continueEntry = Object.keys(state.goalProgress)
      .map(function (gid) { return { gid: gid, progress: state.goalProgress[gid] }; })
      .filter(function (e) { return getGoal(e.gid) && !Timer.hasCompletedGoalToday(e.gid); })
      .sort(function (a, b) {
        return (b.progress.lastCompletedDate || '').localeCompare(a.progress.lastCompletedDate || '');
      })[0];

    if (continueEntry) {
      continueGoal = getGoal(continueEntry.gid);
    } else {
      continueGoal = GOALS[0];
    }

    var meta = goalCardMeta(continueGoal, state);
    var nextStep = getStep(continueGoal, meta.current);

    var categoriesHtml = CATEGORIES.map(function (c) {
      return '<a class="category-tile" href="#/category/' + c.id + '">' + UI.escapeHtml(c.title) + '</a>';
    }).join('');

    var recentHtml = stats.recentCompleted.length
      ? stats.recentCompleted.map(function (r) {
        var g = getGoal(r.goalId);
        return '<div class="card"><div class="card__title">' + UI.escapeHtml(g ? g.title : '') +
          '</div><div class="card__meta">' + UI.escapeHtml(r.date) + ' 완료</div></div>';
      }).join('')
      : '<p class="text-caption">아직 완료한 행동이 없습니다.</p>';

    var html =
      '<div class="screen__header home-hero">' +
      '<p class="home-hero__eyebrow">' + UI.escapeHtml(C.APP_NAME) + ' · ' + UI.escapeHtml(Storage.todayKey()) + '</p>' +
      '<h1 class="home-hero__title" tabindex="-1">당신에게 필요한 것은 더 좋은 계획이 아닙니다.</h1>' +
      '<p class="text-strong home-hero__accent">지금 시작할 15분입니다.</p>' +
      '</div>' +
      '<div class="screen__body">' +
      '<div class="section-title">이어서 진행할 목표</div>' +
      '<a class="card card--pressable" href="#/goal/' + continueGoal.id + '">' +
      '<div class="card__title">' + UI.escapeHtml(continueGoal.title) + '</div>' +
      '<div class="card__meta">' + meta.current + ' / ' + meta.total + '단계 · ' +
      (meta.doneToday ? '오늘 실행 완료' : (nextStep ? UI.escapeHtml(nextStep.title) : '모든 단계 완료')) +
      '</div>' +
      '</a>' +

      '<div class="section-title">자기계발 분야</div>' +
      '<div class="grid-2">' + categoriesHtml + '</div>' +

      '<div class="section-title">이번 주 기록</div>' +
      '<div class="stat-row">' +
      '<div class="stat-tile"><div class="stat-tile__value">' + stats.weeklyActiveDays + '</div><div class="stat-tile__label">이번 주 실행일</div></div>' +
      '<div class="stat-tile"><div class="stat-tile__value">' + stats.totalCompletedSteps + '</div><div class="stat-tile__label">완료한 행동</div></div>' +
      '<div class="stat-tile"><div class="stat-tile__value">' + stats.restartCount + '</div><div class="stat-tile__label">다시 시작한 횟수</div></div>' +
      '</div>' +

      '<div class="section-title">최근 완료한 행동</div>' +
      recentHtml +
      '</div>';

    setScreen(html, { navKey: 'home' });
  }

  /* ---------------- 분야별 목표 목록 ---------------- */

  function renderCategory(categoryId) {
    var category = getCategory(categoryId);
    if (!category) {
      Router.navigate('/home', { replace: true });
      return;
    }
    var state = Storage.load();
    var goals = getGoalsByCategory(categoryId);

    var cardsHtml = goals.map(function (goal) {
      var meta = goalCardMeta(goal, state);
      var nextStep = getStep(goal, meta.current);
      return '<a class="card card--pressable" href="#/goal/' + goal.id + '">' +
        '<div class="card__title">' + UI.escapeHtml(goal.title) + '</div>' +
        '<div class="card__meta">' + meta.current + ' / ' + meta.total + '단계' +
        (meta.doneToday ? ' · 오늘 실행 완료' : '') + '</div>' +
        '<div class="card__meta">' + (meta.completedAll ? '모든 단계를 완료했습니다.' : UI.escapeHtml(nextStep ? nextStep.title : '')) + '</div>' +
        '</a>';
    }).join('');

    var html =
      '<div class="screen__header">' +
      '<p class="text-caption">자기계발 분야</p>' +
      '<h1 tabindex="-1">' + UI.escapeHtml(category.title) + '</h1>' +
      '</div>' +
      '<div class="screen__body card-list">' + cardsHtml + '</div>';

    setScreen(html, { navKey: 'home' });
  }

  /* ---------------- 오늘의 15분 행동 ---------------- */

  function renderGoalDetail(goalId) {
    var goal = getGoal(goalId);
    if (!goal) {
      Router.navigate('/home', { replace: true });
      return;
    }
    var state = Storage.load();
    var meta = goalCardMeta(goal, state);

    if (meta.doneToday) {
      Router.navigate('/already-done/' + goalId, { replace: true });
      return;
    }

    if (meta.completedAll) {
      var doneHtml =
        '<div class="screen__header"><h1 tabindex="-1">' + UI.escapeHtml(goal.title) + '</h1></div>' +
        '<div class="screen__body screen--center"><p class="text-strong">모든 단계를 완료했습니다.</p>' +
        '<p class="text-body">다른 목표를 선택해 계속 실행하세요.</p></div>' +
        '<div class="screen__footer"><a class="btn btn-secondary" href="#/category/' + goal.categoryId + '">다른 목표 보기</a></div>';
      setScreen(doneHtml, { navKey: 'home' });
      return;
    }

    var step = getStep(goal, meta.current);
    var startMessage = goal.startMessage;

    var html =
      '<div class="screen__header">' +
      '<p class="text-caption">' + UI.escapeHtml(goal.title) + ' · ' + step.stepNumber + ' / ' + meta.total + '단계</p>' +
      '<h1 tabindex="-1">' + UI.escapeHtml(step.title) + '</h1>' +
      '</div>' +
      '<div class="screen__body">' +
      '<div class="card"><div class="card__title">오늘 할 행동</div><p class="text-body" style="margin-top:8px;">' + UI.escapeHtml(step.action) + '</p></div>' +
      '<div class="card"><div class="card__title">시작 전 준비</div><p class="text-body" style="margin-top:8px;">' + UI.escapeHtml(step.preparation) + '</p></div>' +
      '<div class="card"><div class="card__title">15분 후 마무리</div><p class="text-body" style="margin-top:8px;">' + UI.escapeHtml(step.finishAction) + '</p></div>' +
      '<p class="text-strong" style="margin-top:24px;">' + UI.escapeHtml(startMessage) + '</p>' +
      '</div>' +
      '<div class="screen__footer">' +
      '<button type="button" class="btn btn-primary" id="start-timer-btn">15분 시작</button>' +
      '<p class="text-caption" style="text-align:center;margin-top:8px;">변명은 행동을 대신하지 못합니다.</p>' +
      '<div id="start-cancel-wrap" class="hidden" style="margin-top:8px;text-align:center;">' +
      '<button type="button" class="btn-quiet" id="start-cancel-btn">시작 취소</button>' +
      '</div>' +
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
      stepId: step.id,
      stepNumber: step.stepNumber,
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

  function openNotificationSheet() {
    UI.showSheet({
      title: '15분이 끝났을 때 알려드립니다.',
      body: '휴대전화 알림을 허용하면 타이머 종료 시 마무리 알림을 표시합니다.',
      actions: [
        {
          label: '알림 허용',
          className: 'btn btn-primary',
          onSelect: function () {
            Notifications.requestPermission().then(function (result) {
              Storage.update(function (state) {
                state.settings.notificationPreference = result === 'granted'
                  ? C.NOTIFICATION_PREFERENCE.GRANTED
                  : C.NOTIFICATION_PREFERENCE.SCREEN_ONLY;
                return state;
              });
            });
          }
        },
        {
          label: '화면 알림만 사용',
          className: 'btn btn-secondary',
          onSelect: function () {
            Storage.update(function (state) {
              state.settings.notificationPreference = C.NOTIFICATION_PREFERENCE.SCREEN_ONLY;
              return state;
            });
          }
        }
      ]
    });
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

    var html =
      '<div class="screen__body">' +
      '<h2 class="sr-only" tabindex="-1">타이머 실행 중</h2>' +
      '<p class="timer-screen__goal">' + UI.escapeHtml(goal ? goal.title : '') + '</p>' +
      '<p class="timer-screen__action">' + UI.escapeHtml(session.actionText) + '</p>' +
      '<div class="timer-display" id="timer-display" aria-hidden="true">15:00</div>' +
      '<p class="sr-only" id="timer-live" aria-live="polite"></p>' +
      '<div class="progress-track"><div class="progress-fill" id="timer-progress" style="width:0%"></div></div>' +
      '<p class="focus-message" id="focus-message"></p>' +
      '<div class="timer-screen__meta">' +
      '<span id="wakelock-status">화면 유지: ' + (state.settings.wakeLockEnabled ? (WakeLock.isSupported() ? '켜짐' : '미지원') : '꺼짐') + '</span>' +
      '<span id="notification-status">알림: ' + notificationStatusLabel(state) + '</span>' +
      '<span id="hidden-count">이탈 ' + (session.hiddenCount || 0) + '회</span>' +
      '</div>' +
      '<div class="timer-screen__exit">' +
      '<button type="button" class="btn-danger-quiet" id="mid-stop-btn">중도 종료</button>' +
      '</div>' +
      '</div>';

    setScreen(html, { showNav: false, timer: true });

    document.title = C.APP_NAME + ' · 실행 중';

    var displayEl = document.getElementById('timer-display');
    var liveEl = document.getElementById('timer-live');
    var progressEl = document.getElementById('timer-progress');
    var focusEl = document.getElementById('focus-message');
    var hiddenCountEl = document.getElementById('hidden-count');

    var elapsedSinceStart = Date.now() - session.startTime;
    focusEl.textContent = FOCUS_MESSAGES[Math.min(FOCUS_MESSAGES.length - 1, Math.floor(elapsedSinceStart / C.FOCUS_MESSAGE_ROTATE_MS))];

    if (focusMessageTimer) global.clearInterval(focusMessageTimer);
    var msgIndex = Math.floor(elapsedSinceStart / C.FOCUS_MESSAGE_ROTATE_MS);
    focusMessageTimer = global.setInterval(function () {
      msgIndex = (msgIndex + 1) % FOCUS_MESSAGES.length;
      focusEl.textContent = FOCUS_MESSAGES[msgIndex];
    }, C.FOCUS_MESSAGE_ROTATE_MS);

    var lastAnnouncedMinute = -1;

    if (timerTickUnsub) timerTickUnsub();
    timerTickUnsub = Timer.onTick(function (activeSession) {
      if (!activeSession) return;
      var remaining = Timer.getRemainingMs(activeSession);
      displayEl.textContent = UI.formatMs(remaining);
      var pct = 100 - Math.round((remaining / C.TIMER_DURATION_MS) * 100);
      progressEl.style.width = Math.max(0, Math.min(100, pct)) + '%';
      hiddenCountEl.textContent = '이탈 ' + (activeSession.hiddenCount || 0) + '회';

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
      cancelBtn.textContent = '시작 취소';
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

    document.getElementById('mid-stop-btn').addEventListener('click', openMidStopDialog);
  }

  function notificationStatusLabel(state) {
    if (!Notifications.isSupported()) return '미지원';
    var perm = Notifications.getPermission();
    if (perm === 'granted') return '허용됨';
    if (perm === 'denied') return '거부됨';
    return state.settings.notificationPreference === C.NOTIFICATION_PREFERENCE.SCREEN_ONLY ? '화면 알림만' : '미설정';
  }

  function handleTimerExpired() {
    if (timerTickUnsub) { timerTickUnsub(); timerTickUnsub = null; }
    if (focusMessageTimer) { global.clearInterval(focusMessageTimer); focusMessageTimer = null; }

    Notifications.playEndSound();
    Notifications.vibrate([200, 100, 200, 100, 400]);
    Notifications.showTimerEndNotification();
    Timer.markFinishPending();
    WakeLock.disable();
    document.title = C.APP_NAME + ' · 종료됨';
    Router.navigate('/finish', { replace: true });
  }

  function openExitAttemptDialog() {
    UI.showDialog({
      title: '지금 나가면 집중은 끝납니다.',
      body: '남은 15분을 지키세요.',
      allowEscape: false,
      actions: [
        {
          label: '계속 실행',
          className: 'btn btn-primary',
          onSelect: function () {
            UI.closeOverlay();
            Router.navigate('/timer', { replace: true });
          }
        },
        {
          label: '실행 종료',
          className: 'btn-danger-quiet',
          onSelect: function () {
            UI.closeOverlay();
            openMidStopDialog();
          }
        }
      ]
    });
  }

  function openMidStopDialog() {
    var session = Timer.getActive();
    var remaining = session ? UI.formatMs(Timer.getRemainingMs(session)) : '';
    UI.showDialog({
      title: '정말 지금 멈춰야 합니까?',
      body: '불편한 것과 불가능한 것은 다릅니다. 남은 시간: ' + remaining,
      actions: [
        {
          label: '끝까지 한다',
          className: 'btn btn-primary',
          onSelect: function () { UI.closeOverlay(); Router.navigate('/timer', { replace: true }); }
        },
        {
          label: '행동을 절반으로 줄인다',
          className: 'btn btn-secondary',
          onSelect: function () {
            Timer.applyFallback();
            UI.closeOverlay();
            Router.navigate('/timer', { replace: true });
            renderTimer();
            UI.showToast('행동을 축소했습니다.');
          }
        },
        {
          label: '오늘 실행을 포기한다',
          className: 'btn-danger-quiet',
          onSelect: function () {
            UI.closeOverlay();
            openAbandonConfirmDialog();
          }
        }
      ]
    });
  }

  function openAbandonConfirmDialog() {
    UI.showDialog({
      title: '실행을 종료합니다.',
      body: '지금 그만두면 문제는 해결되지 않고 그대로 남습니다.',
      actions: [
        {
          label: '돌아가서 계속한다',
          className: 'btn btn-primary',
          onSelect: function () { UI.closeOverlay(); Router.navigate('/timer', { replace: true }); }
        },
        {
          label: '포기 기록을 남기고 종료한다',
          className: 'btn-danger-quiet',
          onSelect: function () {
            Timer.abandon('user_gave_up');
            WakeLock.disable();
            if (timerTickUnsub) { timerTickUnsub(); timerTickUnsub = null; }
            if (focusMessageTimer) { global.clearInterval(focusMessageTimer); focusMessageTimer = null; }
            UI.closeOverlay();
            document.title = C.APP_NAME;
            Router.navigate('/home', { replace: true });
            UI.showToast('오늘 실행을 종료했습니다.');
          }
        }
      ]
    });
  }

  /* ---------------- 종료 및 마무리 ---------------- */

  function renderFinish() {
    var session = Timer.getActive();
    if (!session || session.status !== C.SESSION_STATUS.FINISH_PENDING) {
      Router.navigate('/home', { replace: true });
      return;
    }
    var goal = getGoal(session.goalId);

    var html =
      '<div class="screen__body screen--center">' +
      '<h1 tabindex="-1">15분이 끝났습니다.</h1>' +
      '<p class="text-strong" style="margin-top:8px;">더 하지 마세요.</p>' +
      '<p class="text-body" style="margin-top:16px;">한 번에 몰아서 하는 사람은 오래가지 못합니다. 멈출 줄 알아야 내일 다시 시작할 수 있습니다.</p>' +
      '<div class="card" style="margin-top:24px;">' +
      '<div class="card__title">마무리 행동</div>' +
      '<p class="text-body" style="margin-top:8px;">' + UI.escapeHtml(session.finishActionText) + '</p>' +
      '</div>' +
      '</div>' +
      '<div class="screen__footer">' +
      '<button type="button" class="btn btn-primary" id="finish-btn">정리하고 끝낸다</button>' +
      '</div>';

    setScreen(html, { showNav: false, timer: true });
    document.title = C.APP_NAME;

    document.getElementById('finish-btn').addEventListener('click', function () {
      var record = Timer.finalizeCompletion();
      lastFinishedRecord = record;
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
    var goal = getGoal(record.goalId);
    var progress = state.goalProgress[record.goalId];
    var nextStep = goal && progress ? getStep(goal, Math.min(progress.currentStepNumber, goal.steps.length)) : null;
    var completedAll = goal && progress && progress.currentStepNumber > goal.steps.length;

    var html =
      '<div class="screen__body screen--center">' +
      '<h1 tabindex="-1">오늘 할 일은 끝났습니다.</h1>' +
      '<p class="result-badge" style="margin-top:12px;">다시 시작할 수 있게 끝낸 것이 중요합니다.</p>' +
      '<div class="card" style="margin-top:24px;">' +
      '<div class="card__title">다음에 시작할 단계</div>' +
      '<p class="text-body" style="margin-top:8px;">' +
      (completedAll ? '모든 단계를 완료했습니다.' : UI.escapeHtml(nextStep ? nextStep.title : '')) +
      '</p>' +
      '</div>' +
      '</div>' +
      '<div class="screen__footer">' +
      '<button type="button" class="btn btn-primary" id="result-home-btn">다음에 여기서 시작한다</button>' +
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
      Router.navigate('/home', { replace: true });
      return;
    }

    var html =
      '<div class="screen__body screen--center">' +
      '<h1 tabindex="-1">오늘 이미 실행했습니다.</h1>' +
      '<p class="text-body" style="margin-top:16px;">더 하는 것이 성실함처럼 느껴질 수 있습니다. 하지만 몰아서 하고 지치는 방식은 지금까지 충분히 반복했습니다.</p>' +
      '<p class="text-strong" style="margin-top:16px;">오늘은 멈추세요. 다음 실행은 내일입니다.</p>' +
      '</div>' +
      '<div class="screen__footer">' +
      '<button type="button" class="btn btn-primary" id="stop-today-btn">오늘은 종료</button>' +
      '<a class="btn btn-secondary" style="margin-top:8px;" href="#/category/' + goal.categoryId + '">다른 목표 15분</a>' +
      '<div style="margin-top:16px;text-align:center;">' +
      '<button type="button" class="btn-danger-quiet longpress-track" id="force-rerun-btn" style="border-radius:4px;">' +
      '<span class="longpress-fill"></span><span class="longpress-label">그래도 실행 (3초 길게 누르기)</span>' +
      '</button>' +
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

    var days = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var key = Storage.todayKey(d);
      var done = state.history.some(function (r) { return r.date === key && r.finished; });
      days.push('<div class="record-day" data-done="' + done + '" title="' + key + '"></div>');
    }

    var inProgressHtml = Object.keys(state.goalProgress).map(function (gid) {
      var goal = getGoal(gid);
      if (!goal) return '';
      var progress = state.goalProgress[gid];
      if (progress.currentStepNumber > goal.steps.length) return '';
      return '<div class="card"><div class="card__title">' + UI.escapeHtml(goal.title) + '</div>' +
        '<div class="card__meta">' + progress.currentStepNumber + ' / ' + goal.steps.length + '단계</div></div>';
    }).join('') || '<p class="text-caption">진행 중인 목표가 없습니다.</p>';

    var abandonedHtml = state.history.filter(function (r) { return r.status === 'abandoned'; }).slice(-5).reverse().map(function (r) {
      var g = getGoal(r.goalId);
      return '<div class="card"><div class="card__title">' + UI.escapeHtml(g ? g.title : '') + '</div>' +
        '<div class="card__meta">' + UI.escapeHtml(r.date) + ' 중도 종료</div></div>';
    }).join('') || '<p class="text-caption">중도 종료한 기록이 없습니다.</p>';

    var recentHtml = stats.recentCompleted.map(function (r) {
      var g = getGoal(r.goalId);
      return '<div class="card"><div class="card__title">' + UI.escapeHtml(g ? g.title : '') + '</div>' +
        '<div class="card__meta">' + UI.escapeHtml(r.date) + ' 완료</div></div>';
    }).join('') || '<p class="text-caption">아직 완료한 행동이 없습니다.</p>';

    var html =
      '<div class="screen__header"><h1 tabindex="-1">기록</h1></div>' +
      '<div class="screen__body">' +
      '<div class="stat-row">' +
      '<div class="stat-tile"><div class="stat-tile__value">' + stats.weeklyActiveDays + '</div><div class="stat-tile__label">이번 주 실행일</div></div>' +
      '<div class="stat-tile"><div class="stat-tile__value">' + stats.totalCompletedSteps + '</div><div class="stat-tile__label">완료한 행동</div></div>' +
      '<div class="stat-tile"><div class="stat-tile__value">' + stats.restartCount + '</div><div class="stat-tile__label">다시 시작한 횟수</div></div>' +
      '</div>' +
      '<div class="section-title">최근 7일</div>' +
      '<div class="record-day-grid">' + days.join('') + '</div>' +
      '<div class="section-title">진행 중인 목표</div>' + inProgressHtml +
      '<div class="section-title">최근 완료한 행동</div>' + recentHtml +
      '<div class="section-title">중도 종료한 행동</div>' + abandonedHtml +
      '<div class="section-title">초기화</div>' +
      '<button type="button" class="btn btn-secondary" id="reset-records-btn">실행 기록 초기화</button>' +
      '</div>';

    setScreen(html, { navKey: 'records' });

    document.getElementById('reset-records-btn').addEventListener('click', function () {
      UI.showDialog({
        title: '기록을 초기화합니다.',
        body: '지금까지의 실행 기록과 진행 상태가 모두 삭제됩니다. 이 작업은 되돌릴 수 없습니다.',
        actions: [
          { label: '취소', className: 'btn btn-secondary', onSelect: function () { UI.closeOverlay(); } },
          {
            label: '초기화',
            className: 'btn-danger-quiet',
            onSelect: function () {
              var onboarded = Storage.load().onboardingCompleted;
              var settings = Storage.load().settings;
              Storage.reset();
              Storage.update(function (state) {
                state.onboardingCompleted = onboarded;
                state.settings = settings;
                return state;
              });
              UI.closeOverlay();
              renderRecords();
              UI.showToast('기록을 초기화했습니다.');
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

    function toggleRow(id, label, checked) {
      return '<div class="settings-row"><span>' + UI.escapeHtml(label) + '</span>' +
        '<button type="button" class="switch" id="' + id + '" role="switch" aria-checked="' + checked + '">' +
        '<span class="switch__knob"></span></button></div>';
    }

    var html =
      '<div class="screen__header"><h1 tabindex="-1">설정</h1></div>' +
      '<div class="screen__body">' +
      '<div class="settings-row"><span>알림 상태</span><span class="text-caption">' + notificationStatusLabel(state) + '</span></div>' +
      toggleRow('toggle-sound', '종료음 사용', s.soundEnabled) +
      toggleRow('toggle-vibration', '진동 사용', s.vibrationEnabled) +
      toggleRow('toggle-wakelock', '화면 유지 사용', s.wakeLockEnabled) +
      toggleRow('toggle-dark', '다크 모드', s.darkMode === 'dark') +
      '<div class="section-title">기타</div>' +
      '<button type="button" class="btn btn-secondary" id="replay-onboarding-btn">온보딩 다시 보기</button>' +
      '<a class="btn btn-secondary" style="margin-top:8px;" href="#/install">PWA 설치 안내</a>' +
      '<a class="btn btn-secondary" style="margin-top:8px;" href="#/about">앱 정보 및 알림 제한 안내</a>' +
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
  }

  /* ---------------- PWA 설치 안내 ---------------- */

  function renderInstall() {
    var installed = PWA.isStandalone();
    var canPrompt = PWA.canPromptInstall();

    var html =
      '<div class="screen__header"><h1 tabindex="-1">PWA 설치 안내</h1></div>' +
      '<div class="screen__body">' +
      '<p class="text-body">홈 화면에 설치하면 주소창 없이 실행할 수 있습니다.</p>' +
      (installed
        ? '<p class="text-strong" style="margin-top:16px;">이미 홈 화면에 설치되어 실행 중입니다.</p>'
        : (canPrompt
          ? '<button type="button" class="btn btn-primary" id="install-btn" style="margin-top:16px;">지금 설치하기</button>'
          : '<div class="card" style="margin-top:16px;"><div class="card__title">수동 설치 절차</div>' +
            '<p class="text-body" style="margin-top:8px;">1. Chrome 메뉴 열기<br>2. "앱 설치" 또는 "홈 화면에 추가" 선택<br>3. 설치 후 홈 화면 아이콘으로 실행</p></div>')) +
      '</div>';

    setScreen(html, { showNav: false });

    var installBtn = document.getElementById('install-btn');
    if (installBtn) {
      installBtn.addEventListener('click', function () {
        PWA.promptInstall().then(function (outcome) {
          if (outcome === 'accepted') {
            UI.showToast('설치가 완료되었습니다.');
            renderInstall();
          }
        });
      });
    }
  }

  /* ---------------- 앱 정보 ---------------- */

  function renderAbout() {
    var html =
      '<div class="screen__header"><h1 tabindex="-1">앱 정보</h1></div>' +
      '<div class="screen__body">' +
      '<p class="text-body">' + UI.escapeHtml(C.APP_NAME) + ' · 버전 ' + C.APP_VERSION + '</p>' +
      '<p class="text-body" style="margin-top:16px;">' +
      '이 앱은 서버 없이 작동하는 모바일 웹앱입니다. 앱이나 브라우저를 완전히 종료하거나 휴대전화가 웹앱 실행을 중단하면 종료 알림이 늦어지거나 표시되지 않을 수 있습니다. 가장 확실한 사용을 위해 15분 동안 타이머 화면을 유지하세요.' +
      '</p>' +
      '<p class="text-caption" style="margin-top:16px;">회원가입과 로그인이 없으며, 모든 기록은 이 기기의 브라우저에만 저장됩니다. 외부 서버로 전송되지 않습니다.</p>' +
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
        Timer.markFinishPending();
        Notifications.playEndSound();
        Notifications.vibrate([200, 100, 200, 100, 400]);
        Notifications.showTimerEndNotification();
        WakeLock.disable();
        if (route.name !== 'finish') {
          Router.navigate('/finish', { replace: true });
          return;
        }
      } else if (session.status === C.SESSION_STATUS.FINISH_PENDING && route.name !== 'finish') {
        Router.navigate('/finish', { replace: true });
        return;
      } else if (session.status === C.SESSION_STATUS.RUNNING && route.name !== 'timer') {
        Router.navigate('/timer', { replace: true });
        global.setTimeout(openExitAttemptDialog, 30);
        return;
      }
    } else if (route.name === 'timer' || route.name === 'finish') {
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
        UI.showToast('집중에서 벗어났습니다. 다시 지금 행동으로 돌아오세요.');
      }
      var current = Router.current();
      if (current.name === 'timer') {
        renderTimer();
      } else {
        render(current);
      }
    }
  });

  /* ---------------- 초기화 ---------------- */

  function init() {
    var state = Storage.load();
    applyTheme(state);
    Timer.resumeTickingIfActive();

    PWA.registerServiceWorker();
    PWA.onUpdateAvailable(function () {
      UI.showToast('새 버전이 있습니다. 새로고침하면 적용됩니다.');
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
