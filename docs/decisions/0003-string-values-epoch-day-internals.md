---
name: 공개 값은 정규 문자열, 내부 계산은 epoch day
description: 공개 값은 Temporal 형식의 정규 문자열(브랜드 타입)로 주고받고, 내부 계산은 epoch day 정수로 한다
status: 수락됨
date: 2026-10-14
supersedes: null
---

# ADR-0003: 공개 값은 정규 문자열, 내부 계산은 epoch day

## 맥락

- web-console과 back-office는 날짜를 이미 `YYYY-MM-DD`, 시간을 `HH:mm` 문자열로 저장한다. URL 쿼리, react-hook-form, Next 서버 컴포넌트 props에도 이 문자열을 그대로 넘긴다.
- back-office는 `toISOString()`으로 UTC "오늘"을 계산한다. 그래서 KST 오전 0~9시에는 기본값이 하루 전 날짜가 된다. web-console은 로컬 날짜에 `Z`만 붙인 가짜 UTC 값을 저장한다. 두 버그 모두 날짜를 `Date` 객체로 다뤄서 생겼다.
- 음력으로 입력한 날짜는 "음력으로 입력했다"는 정보를 잃으면 안 된다.

## 결정

- 공개 값은 문자열이다: 날짜 `YYYY-MM-DD`, 음력 입력 날짜 `YYYY-MM-DD[u-ca=dangi]`, 시간 `HH:mm`, 월 `YYYY-MM`. 모두 Temporal 문자열 형식과 호환된다.
- 출력 타입은 `DateString` 같은 브랜드 타입이다. 입력은 경계에서 한 번만 엄격하게 해석한다. 정규 형식은 하나뿐이므로 같은 날짜·같은 역법이면 `===`로 같다.
- 내부 계산은 epoch day(1970-01-01부터의 일수) 정수로 한다. 화면에 보여 주는 역법과 값의 역법을 분리한다.

## 검토한 대안

- **Temporal 같은 객체를 공개 값으로**: 필드에 바로 접근할 수 있다. 하지만 비교, 직렬화, URL, 폼 연동에서 매번 변환해야 한다.
- **`Date` 객체**: 타임존 버그의 원인이다.

## 결과

- 비교, 직렬화, 폼 연동이 단순해진다. 나중에 `Temporal.PlainDate.from()`으로 바로 읽을 수 있다.
- 필드가 필요하면 `parseDate()`를 한 번 거쳐야 한다.
- 같은 날을 서로 다른 역법으로 입력하면 문자열이 다르다. 같은 날인지는 `isSameDay()`로 비교한다.

## 관련 문서

- 스펙 4장
- M1 계획 Task 3
