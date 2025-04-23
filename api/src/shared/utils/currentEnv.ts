export const currentEnv = process.env.NODE_ENV === "test" ? "development" : (process.env.NODE_ENV ?? "development");
