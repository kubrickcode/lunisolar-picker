/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'calendar-src-no-runtime-dependencies',
      comment: 'calendar 패키지는 런타임 의존성 0 (스펙 3.2)',
      severity: 'error',
      from: { path: '^packages/calendar/src', pathNot: '\\.test\\.ts$' },
      to: {
        dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-no-pkg', 'npm-unknown', 'core'],
      },
    },
    {
      name: 'calendar-root-no-dangi',
      comment: '음력을 안 쓰는 소비자 번들에 음력 표가 섞이지 않도록 루트 경로는 dangi를 import하지 않음 (스펙 5.1)',
      severity: 'error',
      from: { path: '^packages/calendar/src/(?!dangi/)', pathNot: '\\.test\\.ts$' },
      to: { path: '^packages/calendar/src/dangi/' },
    },
    {
      name: 'calendar-src-no-scripts',
      comment: '배포 코드가 수집·생성 스크립트에 기대지 않도록 함. 정답 데이터 테스트만 예외',
      severity: 'error',
      from: { path: '^packages/calendar/src', pathNot: '\\.test\\.ts$' },
      to: { path: '^packages/calendar/scripts' },
    },
    {
      name: 'core-src-only-calendar',
      comment: 'core의 런타임 의존성은 calendar 하나뿐 (스펙 3.2)',
      severity: 'error',
      from: { path: '^packages/core/src', pathNot: '\\.test\\.ts$' },
      to: {
        dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-no-pkg', 'npm-unknown', 'core'],
      },
    },
    {
      name: 'core-uses-calendar-public-entries',
      comment: 'calendar 내부 파일에 기대면 패키지 경계와 tree-shaking이 무너짐',
      severity: 'error',
      from: { path: '^packages/core/src' },
      to: { path: '^packages/calendar/src/', pathNot: '^packages/calendar/src/(index|dangi/index)\\.ts$' },
    },
    {
      name: 'calendar-does-not-depend-on-core',
      severity: 'error',
      from: { path: '^packages/calendar' },
      to: { path: '^packages/core' },
    },
    {
      name: 'react-no-internal-imports-of-other-packages',
      comment:
        '다른 패키지는 공개 진입점으로만 쓴다 (스펙 3.2). source 조건으로 공개 진입점도 src 파일로 해석되므로 진입점 파일은 허용',
      severity: 'error',
      from: { path: '^packages/react/src' },
      to: {
        path: '^packages/(calendar|core)/src/',
        pathNot: '^packages/calendar/src/(index|dangi/index)\\.ts$|^packages/core/src/(index|locales/(ko|en|ja))\\.ts$',
      },
    },
    {
      name: 'react-src-allowed-dependencies',
      comment: 'react 패키지 배포 코드는 react 계열, floating-ui, core, calendar만 쓴다 (스펙 3.2)',
      severity: 'error',
      from: { path: '^packages/react/src', pathNot: '\\.test\\.tsx?$|^packages/react/src/(testing|visual)/' },
      to: {
        dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-no-pkg', 'npm-unknown'],
        pathNot:
          'node_modules/(react|react-dom|@floating-ui/react-dom|@lunisolar-picker/(core|calendar))(/|$)|^packages/(core|calendar)/',
      },
    },
    {
      name: 'pickers-public-api-only',
      comment:
        '완성형이 부품 내부에 기대면 앱이 복사해 고쳐 쓸 수 없으므로 공개 진입점과 계약 상수만 쓰게 함 (스펙 7.5, ADR-0001). 테스트는 testing 헬퍼를 쓰므로 예외',
      severity: 'error',
      from: { path: '^packages/react/src/pickers/', pathNot: '\\.test\\.tsx?$' },
      to: { path: '^packages/react/src/(?!pickers/|index\\.ts$|contract/)' },
    },
    {
      name: 'replays-public-api-only',
      comment:
        '소비 앱 재현·SSR·시각 회귀 테스트는 앱처럼 공개 진입점(., /pickers, /contract)만 쓴다. 오늘 고정·브라우저 조작용 testing 헬퍼만 예외',
      severity: 'error',
      from: {
        path: '^packages/react/src/(pickers/(consumer-parity|hydration)\\.test|visual/pickers\\.visual\\.test)\\.tsx$',
      },
      to: { path: '^packages/react/src/(?!index\\.ts$|pickers/index\\.ts$|contract\\.ts$|testing/)' },
    },
    {
      name: 'react-src-no-node-builtins',
      severity: 'error',
      from: { path: '^packages/react/src' },
      to: { dependencyTypes: ['core'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(dist|\\.cache)/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.json'],
      exportsFields: ['exports'],
      conditionNames: ['@lunisolar-picker/source', 'import', 'types', 'default'],
    },
  },
};
