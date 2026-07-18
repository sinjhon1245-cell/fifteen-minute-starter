# CLAUDE.md

이 파일은 Claude Code(및 다른 AI 코딩 에이전트)가 이 저장소를 수정할 때 프로젝트의 철학과 기술적 제약을 훼손하지 않도록 안내한다.

## 프로젝트 목적

**15분 시동**은 계획을 도와주는 앱이 아니다. 자기계발 목표를 앱이 미리 15분 단위의 작은 행동으로 쪼개 두고, 사용자는 고민 없이 오늘의 행동 하나를 실행하게 만드는 앱이다. 자유 입력형 할 일 목록이나 AI 계획 생성 기능을 추가하지 않는다.

핵심 문체: 냉정하고 직접적인 실행 촉구형. 사람의 인격·능력·외모·자존감을 공격하는 문구는 절대 추가하지 않는다. 회피 행동(미루기, 준비만 반복, 완벽주의, 몰아서 하기)을 지적하되 사람을 비난하지 않는다. 이모지, 과도한 감탄사, 귀여운 말투, 점수·레벨·배지·경쟁 순위, 폭죽 애니메이션은 사용하지 않는다.

## 모바일 전용 원칙

- 데스크톱 전용 레이아웃을 별도로 만들지 않는다. 데스크톱에서는 `.app-shell`을 480px로 제한하고 중앙 정렬하며 `.desktop-banner`로 안내 문구만 보여준다.
- 최소 지원 너비 320px, 주요 기준 360px~430px. 가로 스크롤이 생기면 버그다.
- `viewport-fit=cover`, `safe-area-inset-*`을 유지한다. 하단 고정 버튼과 제스처 영역이 겹치지 않도록 `--safe-bottom`을 항상 패딩에 반영한다.
- 주요 버튼 최소 높이 56px(`--button-height`), 모든 터치 영역 최소 44px(`--touch-min`)을 유지한다.

## API·서버·백엔드 사용 금지

이 앱은 서버, 데이터베이스, 서버리스 함수, 외부 AI API, Firebase, Supabase, 외부 푸시 서버를 사용하지 않는다. 모든 데이터는 `localStorage`에만 저장한다(`js/storage.js`). 새 기능을 추가할 때 외부 네트워크 호출이 필요하다면, 이는 이 프로젝트의 원칙과 맞지 않으므로 반드시 사용자에게 먼저 확인한다.

## 15분 고정 원칙

`js/constants.js`의 `TIMER_DURATION_MS`는 운영 환경(GitHub Pages 등)에서 항상 15분(900000ms)으로 고정된다. `localhost`/`file://`에서만 `?dev_timer_seconds=N` 쿼리로 테스트용 단축이 가능하지만, 이 우회 로직은 `resolveTimerDuration()`의 호스트 검사를 절대 제거하거나 완화하지 않는다. 사용자가 15분 자체를 조절하는 설정(연장, 단축, 5분 추가 등)은 어떤 화면에도 추가하지 않는다.

## 목표 데이터 위치와 규칙

- 목표·단계 데이터는 `data/goals.js`에만 있다. UI 코드(`js/app.js`)에 하드코딩된 목표 문구를 추가하지 않는다.
- 분야 8개, 목표 24개 이상, 목표당 단계 7개 이상(최대 10개), 전체 단계 168개 이상을 유지한다.
- 각 단계는 `action`, `preparation`, `focusMessage`, `fallbackAction`, `finishAction`, `nextPreview` 여섯 필드를 모두 구체적인 문장으로 채운다. "열심히 한다", "꾸준히 한다" 같은 추상적 문구는 금지한다.
- 데이터를 수정한 뒤에는 반드시 `scripts/validate.html`을 브라우저로 열어 분야/목표/단계 수와 빈 필드·중복 ID 여부를 확인한다.

## 몰아서 실행 방지 원칙

같은 목표는 하루 한 번만 정상적으로 실행할 수 있다(`Timer.hasCompletedGoalToday`). 이 제한을 우회하는 손쉬운 버튼을 추가하지 않는다. 예외 경로("그래도 실행")는 반드시 3초 이상의 길게 누르기(`UI.attachLongPress`)를 거치게 하고, 타이머 종료 후 "5분 연장", "한 번 더", "계속 진행" 같은 즉시 재실행 버튼은 어떤 화면에도 추가하지 않는다.

## 타이머 구현 원칙 (expectedEndTime 기반)

타이머는 절대 "1초씩 숫자를 감소시키는" 방식으로 구현하지 않는다. 항상 `session.expectedEndTime - Date.now()`로 남은 시간을 재계산한다(`js/timer.js`). 이 방식 때문에:

- 새로고침, 백그라운드 전환, 화면 회전, 탭 전환 후에도 남은 시간이 항상 정확하다.
- `render()`의 라우트 가드(`js/app.js`)는 매 렌더링마다 `activeSession`의 만료 여부를 확인해 `finish_pending` 상태로 자동 전이시킨다. 이 복구 로직을 제거하면 종료 시각이 지난 뒤 앱으로 돌아왔을 때 화면이 멈춰 있는 버그가 생긴다.
- Page Visibility API(`visibilitychange`)로 화면이 다시 보일 때 반드시 즉시 재계산한다.

## 알림의 기술적 제한을 과장하지 않는다

이 앱은 서버가 없으므로 브라우저/PWA가 완전히 종료된 상태에서의 정확한 알림, 시스템 알람 권한, 다른 앱 감지·차단, 오버레이, 서버 푸시를 제공할 수 없다. 새로운 알림 관련 기능을 추가하거나 문서를 수정할 때 이 한계를 숨기거나 실제보다 강력한 것처럼 표현하지 않는다(`README.md`의 "웹 알림의 기술적 제한", `js/app.js`의 앱 정보 화면 문구 참고).

## PWA와 GitHub Pages 하위 경로 주의사항

- `manifest.webmanifest`의 `start_url`/`scope`는 `"./"`, Service Worker 등록은 `"./service-worker.js"`처럼 항상 **상대 경로**를 사용한다. 절대 경로(`/js/app.js` 등)로 바꾸면 `https://계정.github.io/저장소명/` 같은 하위 경로 배포에서 깨진다.
- `index.html`의 모든 `<link>`/`<script>` 경로도 `./`로 시작하는 상대 경로를 유지한다.
- `service-worker.js`의 `PRECACHE_URLS` 목록도 상대 경로를 유지한다.

## 파일 구조

```
index.html, manifest.webmanifest, service-worker.js
styles/  reset · variables · layout · components · screens
js/      constants · storage · timer · wake-lock · notifications ·
         router · ui · accessibility · pwa · app
data/    goals.js (목표·단계 데이터, UI와 분리)
assets/icons/  PWA 아이콘
scripts/ serve.ps1(로컬 서버) · generate-icons.ps1 · validate-goals.js · validate.html
```

책임 분리를 유지한다. 예를 들어 알림 관련 로직을 `app.js`에 직접 추가하지 말고 `js/notifications.js`에 함수를 추가한 뒤 `app.js`에서 호출한다.

## 수정 후 필수 테스트

코드를 수정한 뒤에는 최소한 다음을 확인한다.

1. `scripts/validate.html`을 브라우저로 열어 데이터 무결성 통과 확인 (데이터를 건드렸을 때)
2. `powershell -ExecutionPolicy Bypass -File scripts/serve.ps1 -Port 5173`으로 로컬 서버를 띄우고 브라우저 콘솔에 오류가 없는지 확인
3. 온보딩 → 목표 선택 → 15분 시작 → (필요 시 `?dev_timer_seconds=5`로 단축) → 종료 → 마무리 → 결과까지 실제로 눌러 확인
4. 새로고침 시 진행 중인 타이머가 올바르게 복구되는지 확인
5. 320px~430px 폭에서 가로 스크롤이 생기지 않는지 확인
6. Service Worker가 정상 등록되고 `caches`에 최신 파일이 들어있는지 확인

## Git push 전 확인 사항

- 운영 코드에 `dev_timer_seconds` 같은 테스트 우회가 프로덕션 UI에 노출되지 않았는지 확인한다(호스트 가드는 코드에 이미 있으므로 이를 지우지 않았는지 확인).
- 콘솔에 치명적 오류가 없는지 확인한다.
- API 키, 비밀번호, 개인정보가 포함된 파일이 없는지 확인한다(이 프로젝트는 애초에 이런 값을 갖지 않는다).
- `service-worker.js`의 `CACHE_NAME` 버전을 캐시 대상 파일이 바뀔 때마다 올렸는지 확인한다(아래 항목 참고).

## Service Worker 캐시 버전 갱신 규칙

`service-worker.js` 상단의 `CACHE_NAME` 값(예: `fms-cache-v1`)은 다음 중 하나라도 바뀌면 버전 숫자를 반드시 올린다.

- `PRECACHE_URLS`에 나열된 파일 중 하나라도 내용이 바뀐 경우
- 새 파일을 추가하거나 기존 파일을 제거한 경우

버전을 올리지 않으면 GitHub Pages에 새 코드를 배포해도 기존 사용자의 Service Worker가 이전 캐시를 계속 서빙해 변경 사항이 반영되지 않는다.
