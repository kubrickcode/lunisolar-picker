import axe from 'axe-core';
import { expect } from 'vitest';

export type AxeCheckOptions = {
  // Goal: 알려진 예외 규칙만 끔. 호출하는 테스트가 이유를 주석으로 남김
  readonly disabledRules?: readonly string[] | undefined;
};

export const expectNoAxeViolations = async (container: Element, options: AxeCheckOptions = {}): Promise<void> => {
  const disabledRules = Object.fromEntries((options.disabledRules ?? []).map((rule) => [rule, { enabled: false }]));
  const results = await axe.run(container, {
    resultTypes: ['violations'],
    // Constraint: 부품을 단독으로 검사하므로 랜드마크 구조는 앱 책임
    rules: { region: { enabled: false }, ...disabledRules },
  });
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
};
