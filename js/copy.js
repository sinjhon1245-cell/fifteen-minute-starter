/* 15분만 - 사용자 노출 UI 문구 중앙 관리 (목표/단계 데이터는 data/goals.js 참고) */
(function (global) {
  'use strict';

  var Copy = {
    brand: {
      name: '15분만',
      tagline: '하나만 고르고, 15분만.',
      subtagline: '끝나면 멈추고, 다음에 이어갑니다.',
      docTitle: '15분만 | 하나만 고르고, 15분만',
      description: '지금 할 행동 하나를 고르고 15분 동안 실행하는 모바일 도구입니다.'
    },

    onboarding: {
      slides: [
        { title: '하나만 고르고,\n15분만.', body: '지금 할 수 있는 행동 하나를 골라 15분만 실행합니다.' },
        { title: '끝나면 멈춥니다.', body: '몰아서 하고 지치는 방식을 반복하지 않습니다.' },
        { title: '다음에 이어갑니다.', body: '오늘 어디까지 했는지 기록하고, 다음에 이어서 시작합니다.' }
      ],
      next: '다음',
      start: '지금 시작하기'
    },

    home: {
      eyebrow: 'TODAY',
      heroTitle: '하나만 고르고,\n15분만.',
      heroAccent: '끝나면 멈추고, 다음에 이어갑니다.',
      continueTitle: '오늘 이어갈 목표',
      categoriesTitle: '분야 선택',
      statsTitle: '이번 주 요약',
      recentTitle: '최근 실행',
      statLabels: {
        weeklyActiveDays: '이번 주 실행일',
        completedCount: '완료한 실행',
        startedCount: '일부라도 시작',
        avgDuration: '평균 실행 시간'
      },
      emptyRecent: '아직 실행 기록이 없습니다.',
      doneTodayBadge: '오늘 완료',
      allStepsDone: '모든 단계 완료'
    },

    category: {
      eyebrow: '분야',
      doneTodayBadge: '오늘 완료',
      allStepsDone: '모든 단계를 완료했습니다.'
    },

    customGoal: {
      addButton: '＋ 내 행동 추가',
      badgeRecommended: '추천',
      badgeCustom: '내가 추가',
      menuButtonLabelSuffix: '메뉴 열기',
      emptyCategory: '아직 이 분야에 행동이 없습니다. 아래에서 내 행동을 추가해 보세요.',

      formAddTitle: '내 행동 추가',
      formEditTitle: '내 행동 수정',
      titleLabel: '행동 이름',
      titlePlaceholder: '예: 저녁 산책 10분',
      descLabel: '첫 번째 작은 행동 또는 설명 (선택)',
      descPlaceholder: '예: 신발을 신고 문 앞까지 걷기',
      stepCountLabel: '단계 수',
      save: '저장',
      cancel: '취소',
      close: '닫기',
      titleRequiredError: '행동 이름을 입력해 주세요.',
      titleTooLongError: '행동 이름은 30자 이내로 입력해 주세요.',
      duplicateError: '이미 같은 이름의 행동이 있습니다.',
      savedToast: '내 행동을 추가했습니다.',
      updatedToast: '내 행동을 수정했습니다.',

      menuTitle: '행동 관리',
      menuEdit: '수정',
      menuEditBody: '이름, 설명, 단계 수를 바꿉니다.',
      menuMoveUp: '위로 이동',
      menuMoveUpBody: '목록에서 한 칸 위로 옮깁니다.',
      menuMoveDown: '아래로 이동',
      menuMoveDownBody: '목록에서 한 칸 아래로 옮깁니다.',
      menuDelete: '삭제',
      menuDeleteBody: '이 행동과 진행 기록을 삭제합니다.',
      menuCopy: '내 행동으로 복사',
      menuCopyBody: '제목과 단계를 복제해 자유롭게 수정할 수 있습니다.',
      menuHide: '이 추천 숨기기',
      menuHideBody: '이 분야 목록에서만 숨깁니다. 진행 기록은 남습니다.',
      copiedToast: '내 행동으로 복사했습니다.',
      hiddenToast: '이 추천을 숨겼습니다.',

      deleteDialogTitle: '이 행동을 삭제할까요?',
      deleteDialogBodyWithProgress: '삭제한 행동과 진행 기록은 복구할 수 없습니다.',
      deleteCancel: '취소',
      deleteConfirm: '삭제',
      deletedToast: '행동을 삭제했습니다.',

      hiddenSectionTitle: '숨긴 추천 보기',
      hiddenSectionEmpty: '숨긴 추천이 없습니다.',
      restoreOne: '다시 보이기',
      restoredToast: '추천을 다시 표시합니다.',
      resetHiddenButton: '추천 행동 초기화',
      resetHiddenToast: '숨긴 추천을 모두 다시 표시합니다.'
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
      allDoneButton: '다른 목표 보기',
      unknownGoalToast: '이전 목표는 더 이상 사용할 수 없습니다. 다른 목표를 선택해 주세요.'
    },

    notificationSheet: {
      title: '15분이 끝나면 알려드릴까요?',
      body: '종료 알림을 켜면 15분이 끝났을 때 휴대전화 알림을 표시합니다.',
      allow: '종료 알림 받기',
      allowHint: '휴대전화 알림으로 종료 시점을 알려드립니다.',
      screenOnly: '앱 화면으로만 알림 받기',
      screenOnlyHint: '앱을 열어 둔 상태에서 종료 화면을 표시합니다.',
      toastGranted: '종료 알림을 켰습니다.',
      toastDenied: '앱 화면으로만 알려드립니다.',
      toastDismissed: '알림 설정은 나중에 바꿀 수 있습니다.',
      toastScreenOnly: '앱 화면으로만 알려드립니다.'
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
      fallbackAvailable: '행동 줄이기 사용 가능',
      fallbackApplied: '행동 줄임 적용됨',
      fallbackAppliedNote: '줄인 행동으로 실행 중',
      stopButton: '이번 실행 멈추기',
      earlyDoneButton: '먼저 끝냈어요',
      returnedToast: '화면을 벗어났습니다. 하던 행동으로 돌아가세요.'
    },

    earlyComplete: {
      title: '정한 행동을 마쳤나요?',
      body: '현재까지의 실행 시간을 저장하고 결과 기록 화면으로 이동합니다.',
      keepGoing: '계속하기',
      keepGoingHint: '남은 시간 동안 현재 행동을 이어갑니다.',
      recordNow: '결과 기록하기',
      recordNowHint: '지금까지 실행한 시간을 저장합니다.'
    },

    midStop: {
      title: '이번 실행을 멈출까요?',
      body: '남은 시간 동안 계속하거나, 행동을 한 번 줄이거나, 지금까지의 실행을 기록하고 종료할 수 있습니다.',
      remainingLabel: '남은 시간',
      keepGoing: {
        title: '남은 시간 계속하기',
        body: '현재 행동과 타이머를 그대로 이어갑니다.'
      },
      reduce: {
        title: '행동 한 번 줄이기',
        body: '더 작은 행동으로 바꾸고 남은 시간을 계속합니다.',
        note: '한 실행에서 한 번만 사용할 수 있습니다.',
        usedTitle: '행동 줄이기 사용 완료',
        usedBody: '이 실행에서는 더 줄일 수 없습니다.'
      },
      recordAndStop: {
        title: '지금까지 기록하고 종료하기',
        body: '현재까지 실행한 시간과 진행 결과를 기록합니다.'
      },
      reducedToast: '행동을 한 번 줄였습니다.'
    },

    secondConfirm: {
      title: '지금까지 기록하고 종료할까요?',
      body: '현재까지의 실행 시간은 저장되며, 이 단계의 진행 정도는 다음 화면에서 선택합니다.',
      keepGoing: '계속하기',
      keepGoingHint: '타이머로 돌아갑니다.',
      confirmStop: '기록하고 종료하기',
      confirmStopHint: '지금까지 실행한 시간을 저장합니다.'
    },

    finish: {
      title: '15분이 끝났습니다.',
      emphasis: '오늘은 여기서 멈춥니다.',
      body: '마무리한 뒤 결과를 기록하세요.',
      actionCardTitle: '마무리 행동',
      finishButton: '결과 기록하기',
      notificationTitle: '15분만 · 15분이 끝났습니다',
      notificationBody: '지금 하던 일을 마무리하고 실행 결과를 기록하세요.',
      hiddenExitNotificationTitle: '화면을 벗어났습니다.',
      hiddenExitNotificationBody: '남은 시간 동안 지금 하던 일로 돌아와 주세요.'
    },

    resultRecord: {
      title: '이번 실행을 기록합니다',
      question: '이번 실행에서 어디까지 진행했나요?',
      durationLabel: '실제 실행 시간',
      hiddenLabel: '화면 이탈',
      hiddenYes: '있었음',
      hiddenNo: '없었음',
      fallbackLabel: '행동 줄이기',
      fallbackYes: '사용함',
      fallbackNo: '사용 안 함',
      options: [
        { value: 'completed', title: '정한 행동을 마쳤어요', body: '제시된 행동을 끝냈습니다.' },
        { value: 'sufficient', title: '필요한 만큼 진행했어요', body: '목표에 도움이 될 만큼 진행했습니다.' },
        { value: 'partial', title: '일부만 진행했어요', body: '행동을 시작했지만 끝내지는 못했습니다.' },
        { value: 'started_only', title: '시작만 했어요', body: '실행을 시작한 기록만 남깁니다.' }
      ],
      submitButton: '기록하고 마무리하기',
      savedToast: '실행을 기록했습니다.'
    },

    result: {
      title: '기록을 남겼습니다',
      subtitle: '다음에 이어서 시작할 수 있습니다.',
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
      recentCompletedTitle: '최근 실행',
      resetTitle: '초기화',
      resetButton: '실행 기록 초기화',
      emptyInProgress: '진행 중인 목표가 없습니다.',
      emptyCompleted: '아직 실행 기록이 없습니다.',
      statLabels: {
        weeklyActiveDays: '이번 주 실행일',
        completedCount: '완료한 실행',
        partialCount: '일부 진행한 실행',
        startedCount: '시작만 한 실행',
        avgDuration: '평균 실행 시간'
      },
      progressResultLabel: {
        completed: '완료',
        sufficient: '필요한 만큼 진행',
        partial: '일부 진행',
        started_only: '시작만 함',
        unknown: '중간 종료'
      },
      finishTypeLabel: {
        timer_complete: '15분 완료',
        early_complete: '먼저 종료',
        manual_end: '중도 종료',
        recovered_after_end: '복귀 후 완료'
      },
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
      notificationChange: '변경',
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
      cardTitle: '홈 화면에 설치하기',
      cardBody: '주소창 없이 앱처럼 바로 실행할 수 있습니다.',
      installButton: '홈 화면에 설치하기',
      alreadyInstalled: '이미 홈 화면에 설치되어 실행 중입니다.',
      manualTitle: '설치 방법',
      manualAndroid: 'Chrome 메뉴에서 "앱 설치" 또는 "홈 화면에 추가"를 선택하세요.',
      manualGeneric: '1. 브라우저 메뉴 열기\n2. "앱 설치" 또는 "홈 화면에 추가" 선택\n3. 설치 후 홈 화면 아이콘으로 실행',
      installedToast: '설치가 완료되었습니다.'
    },

    about: {
      title: '앱 정보',
      limitation: '이 앱은 서버 없이 휴대전화에서만 작동합니다. 앱이나 브라우저를 완전히 종료하면 종료 알림이 늦어지거나 표시되지 않을 수 있습니다. 가장 확실한 사용을 위해 타이머 화면을 유지하세요.',
      privacy: '회원가입과 로그인이 없으며, 모든 기록은 이 기기의 브라우저에만 저장됩니다. 외부 서버로 전송되지 않습니다.'
    },

    updateAvailableToast: '새 버전이 준비되었습니다. 새로고침하면 적용됩니다.'
  };

  global.FMS = global.FMS || {};
  global.FMS.Copy = Copy;
})(window);
