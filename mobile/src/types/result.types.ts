export type AppError = {
  code: string;
  message: string;
  userMessage?: string;
  cause?: unknown;
};

export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };
