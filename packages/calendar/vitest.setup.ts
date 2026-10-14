import fc from 'fast-check';

// Constraint: 성질 테스트 실패를 그대로 재현할 수 있도록 시드를 고정함. 다른 시드로 탐색하려면 FAST_CHECK_SEED 지정
const DEFAULT_SEED = 20261014;

fc.configureGlobal({ seed: Number(process.env.FAST_CHECK_SEED ?? DEFAULT_SEED) });
