---
name: 순수 TS 코어 + 층 구조 React API + calendar 패키지 분리
description: 순수 TS 코어 위에 훅·부품·완성형 React 층을 쌓고, 역법은 별도 calendar 패키지로 분리한다
status: 수락됨
date: 2026-10-14
supersedes: null
---

# ADR-0001: 순수 TS 코어 + 층 구조 React API + calendar 패키지 분리

## 맥락

- 이 라이브러리는 어떤 프로젝트에서도 쓸 수 있는 범용성을 목표로 한다. 첫 바인딩은 React이고, Vue·Svelte는 나중에 붙인다.
- 교체 대상인 web-console과 back-office는 react-day-picker(설정형 단일 컴포넌트)를 쓰고 있다. 그런데 열려 있는 슬롯만으로는 부족해서 Nav, DayButton, 팝오버, 드래그 선택, 범위 정책을 결국 직접 다시 짰다.
- 서버에서 음력↔양력 변환만 필요한 소비자가 있다. KASI 데이터를 정정하면 picker와 따로 릴리스해야 한다.

## 결정

- 패키지는 `calendar ← core ← react` 한 방향으로만 의존한다. `theme`는 CSS만 담고 `data-*` 계약에만 의존한다.
- `calendar`: 날짜 타입, 문자열 값, 역법 인터페이스, 양력, `./dangi`. 런타임 의존성은 0이다.
- `core`: 순수 리듀서와 `createStore`로 만든 상태, 제약, 격자, 제스처 계산, 로케일 데이터. DOM과 React를 모른다.
- `react`: 훅 → compound 부품(`Calendar.*` 등) → 완성형(`/pickers`)의 세 층으로 만든다. 완성형은 부품의 공개 API만 쓴다.

## 검토한 대안

- **React 전용**: 가장 빠르게 만들 수 있지만 범용성 목표를 채우지 못한다.
- **Web Components**: Shadow DOM 때문에 Tailwind 유틸리티로 덮어쓸 수 없고, ARIA 참조도 경계를 넘지 못한다. Astro와 Cloudflare의 SSR과도 잘 맞지 않는다.
- **훅만 제공 (React Aria 방식)**: 바로 쓸 수 있는 컴포넌트가 없어서, 앱마다 같은 조립 코드를 반복해서 짜야 한다.
- **설정형 단일 컴포넌트 (rdp 방식)**: 교체 대상 앱들이 이 구조의 한계 때문에 대부분을 다시 짰다.
- **역법을 core 안에 두기**: 나중에 분리하면 import 경로가 바뀌어 하위 호환이 깨진다.

## 결과

- 상태 로직을 프레임워크 없이 단위 테스트할 수 있다. 다른 바인딩은 react에 해당하는 층만 새로 만들면 된다.
- 공개 API가 넓어져서 안정성 등급을 따로 관리해야 한다. 훅, 부품 이름, `data-*`는 stable이고, 완성형은 조합 예시로 본다.
- 처음 설계 비용과 문서 분량이 늘어난다.

## 관련 문서

- 스펙: `docs/superpowers/specs/2026-10-14-lunisolar-picker-design.md` 3장, 7장, 16장
- 근거 조사: web-console과 back-office의 picker 사용 현황 감사(2026-10-14 브레인스토밍 세션)
