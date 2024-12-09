export const removeUndefined = <T>(
  obj: T,
): {
  [K in keyof T]: undefined extends T[K] ? T[K] : Exclude<T[K], undefined>;
} => {
  return Object.fromEntries(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Object.entries(obj).filter(([_, value]) => value !== undefined),
  ) as any;
};
