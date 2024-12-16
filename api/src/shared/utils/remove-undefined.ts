export const removeUndefined = <T extends object>(obj: T) => {
  type CleanType = { [K in keyof T]: Exclude<T[K], undefined> };
  return Object.fromEntries(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Object.entries(obj).filter(([_, value]) => value !== undefined),
  ) as CleanType;
};
