export const formatError = (error: unknown): { message: string; stack?: string; rawError?: unknown } => {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: "Unknown error occurred",
    rawError: error,
  };
};
