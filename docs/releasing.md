# 배포 절차

## 평소 흐름

1. 배포 대상 패키지를 바꾸는 PR에 `pnpm changeset`으로 변경 기록을 넣는다.
2. PR이 main에 머지되면 Release 워크플로가 "chore: release" PR을 만들거나 갱신한다(버전·CHANGELOG 반영).
3. 릴리스 전 `docs/qa/real-device-checklist.md`를 실기기로 채운다.
4. "chore: release" PR을 머지하면 Release 워크플로의 publish 잡이 `npm-publish` 환경 승인을 기다린다.
5. 승인하면 네 패키지가 trusted publishing(OIDC)으로 provenance와 함께 배포되고 GitHub Release가 생긴다.
6. 확인: `npm view @lunisolar-picker/react version`, npm 패키지 페이지의 Provenance 표시.

## 처음 한 번 필요한 설정

| 게이트 | 결정·행동 | 담당 |
|---|---|---|
| A. 라이선스 | 라이선스 종류 결정 | 사용자 |
| B. GitHub 저장소 | `kubrickcode/lunisolar-picker`(현재 비공개)의 공개 여부 결정, `Allow GitHub Actions to create and approve pull requests` 켜기, `npm-publish` 환경과 필수 검토자 만들기 | 사용자 |
| C. npm | `lunisolar-picker` org 생성, 네 패키지에 trusted publisher 등록(저장소, 워크플로 `release.yml`, 환경 `npm-publish`) | 사용자 |
| D. 첫 배포 | 실기기 QA 통과 확인 후 publish 승인 | 사용자 |

provenance는 공개 저장소에서만 붙는다. 비공개 저장소로 시작하면 provenance 없이 배포되거나 trusted publishing 설정이 거부될 수 있다.
