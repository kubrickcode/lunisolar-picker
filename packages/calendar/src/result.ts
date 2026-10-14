export type Result<T, E> = { readonly isOk: true; readonly value: T } | { readonly isOk: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ isOk: true, value });

export const err = <E>(error: E): Result<never, E> => ({ isOk: false, error });
