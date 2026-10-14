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
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(dist|\\.cache)/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: {
      extensions: ['.ts', '.js', '.json'],
      exportsFields: ['exports'],
      conditionNames: ['source', 'import', 'types', 'default'],
    },
  },
};
