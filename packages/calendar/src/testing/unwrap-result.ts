import type { Result } from '../result';

export const unwrapOk = <T, E>(result: Result<T, E>): T => {
  if (!result.isOk) throw new Error(`expected an ok result, received error ${String(result.error)}`);
  return result.value;
};
