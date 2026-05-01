/**
 * Terminal styling helpers. ANSI color codes go through `wrap` so they're
 * stripped on non-TTY stdout (pipes, redirects) and when NO_COLOR is set —
 * preserving `messages-dev … | grep` and `… > out.txt` workflows.
 *
 * No external dependency: codes are inlined to keep the bundled binary lean.
 */

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

const enabled = (() => {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return true;
  return Boolean(process.stdout.isTTY);
})();

function wrap(code: string): (s: string) => string {
  return (s) => (enabled ? `${code}${s}${ANSI.reset}` : s);
}

export const bold = wrap(ANSI.bold);
export const dim = wrap(ANSI.dim);
export const red = wrap(ANSI.red);
export const green = wrap(ANSI.green);
export const yellow = wrap(ANSI.yellow);
export const blue = wrap(ANSI.blue);
export const magenta = wrap(ANSI.magenta);
export const cyan = wrap(ANSI.cyan);
export const gray = wrap(ANSI.gray);

export const colorEnabled = enabled;

// Use unicode glyphs unconditionally — every terminal we target renders them.
// Falling back to ASCII would create two visual styles for the same CLI.
export const symbols = {
  check: "✓",
  cross: "✗",
  dot: "•",
  arrow: "→",
  bullet: "·",
};

const ANSI_RE = /\x1b\[[0-9;]*m/g;

/** Length of `s` ignoring ANSI escape sequences. Use for column padding. */
export function visualWidth(s: string): number {
  return s.replace(ANSI_RE, "").length;
}

/** Pad `s` on the right to `target` columns of visible width. */
export function padEnd(s: string, target: number): string {
  const w = visualWidth(s);
  return w >= target ? s : s + " ".repeat(target - w);
}

/** Truncate to `max` visible columns, appending `…` when clipped. */
export function truncate(s: string, max: number): string {
  if (max <= 0) return "";
  const plain = s.replace(ANSI_RE, "");
  if (plain.length <= max) return s;
  // Bail on naive slice when ANSI codes are present — preserving partial
  // codes is fiddly and these strings don't carry mid-cell color today.
  if (plain !== s) return plain.slice(0, Math.max(0, max - 1)) + "…";
  return s.slice(0, Math.max(0, max - 1)) + "…";
}

const ID_PREFIXES = [
  "msg_",
  "obx_",
  "wh_",
  "file_",
  "ln_",
  "cht_",
  "sk_live_",
  "sk_test_",
  "rct_",
  "org_",
  "dlv_",
];

/** Heuristic: does this look like one of our typed IDs? */
export function looksLikeId(s: string): boolean {
  return ID_PREFIXES.some((p) => s.startsWith(p));
}

/** Render a scalar with type-appropriate color. Null/undefined render as a dim em-dash. */
export function styleScalar(v: unknown): string {
  if (v === null || v === undefined) return dim("—");
  if (typeof v === "boolean") return v ? green(symbols.check) : dim(symbols.cross);
  if (typeof v === "number") return String(v);
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  if (looksLikeId(s)) return cyan(s);
  return s;
}
