import fc from 'fast-check';
import 'vitest-browser-react';

// Constraint: 성질 테스트 실패를 그대로 재현할 수 있도록 시드를 고정함
const DEFAULT_SEED = 20261014;

fc.configureGlobal({ seed: DEFAULT_SEED });
