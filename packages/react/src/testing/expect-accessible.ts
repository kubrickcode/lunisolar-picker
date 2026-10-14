import axe from 'axe-core';
import { expect } from 'vitest';

export const expectNoAxeViolations = async (container: Element): Promise<void> => {
  const results = await axe.run(container, {
    resultTypes: ['violations'],
    // Constraint: 부품을 단독으로 검사하므로 랜드마크 구조는 앱 책임
    rules: { region: { enabled: false } },
  });
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
};
