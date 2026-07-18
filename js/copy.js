/* 15분 시동 - 사용자 노출 UI 문구 중앙 관리 (목표/단계 데이터는 data/goals.js 참고) */
(function (global) {
  'use strict';

  var Copy = {
    onboarding: {
      slides: [
        { title: '더 좋은 계획은 필요 없습니다.', body: '지금 할 수 있는 행동 하나를 골라 15분만 실행합니다.' },
        { title: '15분이 끝나면 멈춥니다.', body: '몰아서 하고 지치는 방식을 반복하지 않습니다.' },
        { title: '내일 다시 시작합니다.', body: '많이 한 시간이 아니라 다시 시작한 날을 기록합니다.' }
      ],
      next: '다음',
      start: '지금 시작하기'
    },

    home: {
      eyebrow: 'TODAY',
      heroTitle: '당신에게 필요한 것은 더 좋은 계획이 아닙니다.',
      heroAccent: '지금 시작할 15분입니다.',
      continueTitle: '오늘 이어갈 목표',
      categoriesTitle: '자기계발 분야',
      statsTitle: '이번 주 요약',
      recentTitle: '최근 완료한 실행',
      statLabels: {
        weeklyActiveDays: '이번 주 실행일',
        totalCompletedSteps: '완료한 행동',
        restartCount: '다시 시작한 날'
      },
      emptyRecent: '아직 완료한 행동이 없습니다.',
      doneTodayBadge: '오늘 완료',
      allStepsDone: '모든 단계 완료'
    },

    category: {
      eyebrow: '자기계발 분야',
      doneTodayBadge: '오늘 완료',
      allStepsDone: '모든 단계를 완료했습니다.'
    },

    goalDetail: {
      actionCardTitle: '지금 할 일',
      prepCardTitle: '시작 전 준비',
      finishCardTitle: '15분 후 마무리',
      startButton: '15분 시작',
      startCaption: '준비는 끝났습니다. 이제 시작하세요.',
      cancelStart: '시작 취소',
      allDoneTitle: '모든 단계를 완료했습니다.',
      allDoneBody: '다른 목표를 선택해 계속 실행하세요.',
      allDoneButton: '다른 목표 보기'
    },

    notificationSheet: {
      title: '15분이 끝났을 때 알려드립니다.',
      body: '알림을 허용하면 15분이 끝났을 때 휴대전화로 알려드립니다.',
      allow: '알림 허용',
      screenOnly: '앱 화면으로만 알림 받기'
    },

    timer: {
      focusMessages: [
        '지금 할 일만 이어가세요.',
        '생각이 많아질수록 손을 움직이세요.',
        '잘하려 하지 말고 끝까지 이어가세요.',
        '지금 이 15분이 오늘의 방향을 정합니다.',
        '다른 일은 잠시 미뤄 두세요. 이것부터 끝내세요.',
        '고민은 이미 끝났습니다. 지금은 움직일 시간입니다.',
        '하기 싫은 마음이 들어도 손은 움직일 수 있습니다.'
      ],
      wakeLockOn: '화면 유지 켜짐',
      wakeLockOff: '화면 유지 꺼짐',
      wakeLockUnsupported: '화면 유지 미지원',
      notificationPrefix: '종료 알림',
      notificationGranted: '허용됨',
      notificationDenied: '거부됨',
      notificationScreenOnly: '화면 알림만',
      notificationUnset: '미설정',
      notificationUnsupported: '미지원',
      focusedStatus: '집중 유지 중',
      exitedStatus: '화면 이탈',
      stopButton: '이번 실행 종료',
      returnedToast: '화면을 벗어났습니다. 하던 행동으로 돌아가세요.'
    },

    midStop: {
      title: '이번 실행을 멈출까요?',
      body: '남은 시간 동안 계속하거나, 행동을 더 작게 줄일 수 있습니다.',
      keepGoing: '계속하기',
      reduceAction: '행동 줄이기',
      stopThis: '이번 실행 종료',
      reducedToast: '행동을 더 작게 줄였습니다.'
    },

    abandonConfirm: {
      title: '완료하지 않고 종료할까요?',
      body: '지금 종료하면 이 단계는 완료되지 않습니다. 기록은 저장됩니다.',
      keepGoing: '계속하기',
      confirmStop: '종료하기',
      stoppedToast: '이번 실행을 종료했습니다.'
    },

    finish: {
      title: '15분이 끝났습니다.',
      emphasis: '오늘은 여기서 멈춥니다.',
      body: '마무리한 뒤 다음 실행에서 이어가세요.',
      actionCardTitle: '마무리 행동',
      finishButton: '마무리하고 끝내기',
      notificationTitle: '15분이 끝났습니다.',
      notificationBody: '오늘은 여기서 멈춥니다. 하던 일을 정리해 주세요.',
      hiddenExitNotificationTitle: '화면을 벗어났습니다.',
      hiddenExitNotificationBody: '남은 시간 동안 지금 하던 일로 돌아와 주세요.'
    },

    result: {
      title: '오늘 실행을 마쳤습니다.',
      subtitle: '다시 시작할 수 있게 끝낸 것이 중요합니다.',
      nextLabel: '다음에 시작할 단계',
      allDone: '모든 단계를 완료했습니다.',
      continueButton: '다음에 이어서 시작하기'
    },

    alreadyDone: {
      title: '오늘의 단계는 완료했습니다.',
      body: '같은 목표는 내일 이어가는 것이 기본입니다. 다른 목표를 시작하거나, 필요하면 같은 단계를 다시 실행할 수 있습니다.',
      emphasis: '다음 단계는 내일 이어집니다.',
      stopToday: '오늘은 여기까지',
      otherGoal: '다른 목표 시작하기',
      forceRerun: '그래도 다시 시작하기',
      forceRerunHint: '3초 동안 누르면 시작됩니다.'
    },

    records: {
      title: '기록',
      recentDaysTitle: '최근 7일',
      inProgressTitle: '진행 중인 목표',
      recentCompletedTitle: '최근 완료한 실행',
      stoppedTitle: '중간에 멈춘 실행',
      resetTitle: '초기화',
      resetButton: '실행 기록 초기화',
      emptyInProgress: '진행 중인 목표가 없습니다.',
      emptyCompleted: '아직 완료한 행동이 없습니다.',
      emptyStopped: '중간에 멈춘 실행이 없습니다.',
      completedSuffix: ' 완료',
      stoppedSuffix: ' 중간에 멈춤',
      resetDialog: {
        title: '기록을 초기화할까요?',
        body: '지금까지의 실행 기록과 진행 상태가 모두 삭제됩니다. 이 작업은 되돌릴 수 없습니다.',
        cancel: '취소',
        confirm: '초기화',
        toast: '기록을 초기화했습니다.'
      }
    },

    settings: {
      title: '설정',
      notificationRow: '종료 알림',
      soundToggle: '종료음',
      vibrationToggle: '진동',
      wakeLockToggle: '화면 유지',
      darkModeToggle: '어두운 화면',
      moreSection: '더 보기',
      replayOnboarding: '시작 화면 다시 보기',
      installLink: '홈 화면에 설치하기',
      aboutLink: '앱 정보'
    },

    install: {
      title: '홈 화면에 설치하기',
      body: '홈 화면에 설치하면 주소창 없이 앱처럼 실행할 수 있습니다.',
      installButton: '지금 설치하기',
      alreadyInstalled: '이미 홈 화면에 설치되어 실행 중입니다.',
      manualTitle: '설치 방법',
      manualSteps: '1. Chrome 메뉴 열기\n2. "앱 설치" 또는 "홈 화면에 추가" 선택\n3. 설치 후 홈 화면 아이콘으로 실행',
      installedToast: '설치가 완료되었습니다.'
    },

    about: {
      title: '앱 정보',
      limitation: '이 앱은 서버 없이 휴대전화에서만 작동합니다. 앱이나 브라우저를 완전히 종료하면 종료 알림이 오지 않을 수 있습니다. 15분 동안 화면을 켜 둔 채로 사용하는 것이 가장 확실합니다.',
      privacy: '회원가입과 로그인이 없으며, 모든 기록은 이 기기의 브라우저에만 저장됩니다. 외부 서버로 전송되지 않습니다.'
    },

    updateAvailableToast: '새 버전이 준비되었습니다. 새로고침하면 적용됩니다.'
  };

  global.FMS = global.FMS || {};
  global.FMS.Copy = Copy;
})(window);
