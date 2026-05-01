// Centralized error reporting and exit codes for agent-friendly behavior.
// `--json` (or MESSAGES_OUTPUT=json) switches stderr to a structured shape:
//   { "error": { "code": "<machine-code>", "message": "<human>", ... } }

import { red, symbols } from "./style";

export const EXIT_OK = 0;
export const EXIT_GENERIC = 1;
export const EXIT_USAGE = 2;
export const EXIT_NOT_AUTHENTICATED = 3;
export const EXIT_NOT_FOUND = 4;
export const EXIT_VALIDATION = 5;

export type ErrorCode =
  | "generic"
  | "usage"
  | "not_authenticated"
  | "not_found"
  | "validation"
  | "network";

const CODE_TO_EXIT: Record<ErrorCode, number> = {
  generic: EXIT_GENERIC,
  usage: EXIT_USAGE,
  not_authenticated: EXIT_NOT_AUTHENTICATED,
  not_found: EXIT_NOT_FOUND,
  validation: EXIT_VALIDATION,
  network: EXIT_GENERIC,
};

export function jsonMode(args: { json?: unknown } = {}): boolean {
  if (args.json) return true;
  const env = process.env.MESSAGES_OUTPUT;
  return env === "json";
}

export function fail(
  code: ErrorCode,
  message: string,
  opts: { json?: boolean; details?: Record<string, unknown> } = {},
): never {
  const useJson = opts.json ?? jsonMode();
  if (useJson) {
    const payload = { error: { code, message, ...(opts.details ?? {}) } };
    process.stderr.write(JSON.stringify(payload) + "\n");
  } else {
    // Prefix with a red ✗ on TTY stderr so the failure is visually distinct
    // from normal status text. style.ts strips color when stderr isn't a TTY.
    process.stderr.write(`${red(symbols.cross)} ${message}\n`);
  }
  process.exit(CODE_TO_EXIT[code]);
}

/**
 * Extract a useful message from an unknown thrown value (Error, string, or
 * object with a `message` field). Used to turn SDK / fetch errors into a
 * one-liner before passing to `fail`.
 */
export function toMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}
