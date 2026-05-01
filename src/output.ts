/**
 * Output helpers. Default is human-readable; --json switches to a single
 * JSON dump (or NDJSON for streaming commands). Human mode adds color when
 * stdout is a TTY — see ./style.ts.
 */

import {
  bold,
  cyan,
  dim,
  gray,
  green,
  padEnd,
  styleScalar,
  symbols,
  truncate,
  visualWidth,
} from "./style";

export function emit(data: unknown, asJson: boolean): void {
  if (asJson) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  console.log(formatHuman(data));
}

/**
 * Render a successful mutation: a green ✓ headline followed by an indented,
 * dim-keyed block of the result fields. JSON mode is unchanged.
 *
 *   ✓ Queued to +14155551234
 *       id      obx_abc123
 *       status  pending
 *
 * Pass `data` as the full result object — the helper picks readable fields
 * automatically. Drop noisy fields (e.g. `requestId`) by listing them in
 * `hideFields`.
 */
export function success(
  summary: string,
  data: unknown,
  asJson: boolean,
  opts: { hideFields?: string[] } = {},
): void {
  if (asJson) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  console.log(`${green(symbols.check)} ${bold(summary)}`);
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const hide = new Set(opts.hideFields ?? ["requestId", "request_id"]);
    const entries = Object.entries(data as Record<string, unknown>).filter(
      ([k, v]) => !hide.has(k) && v !== undefined && v !== null,
    );
    if (entries.length) {
      const labels = entries.map(([k]) => humanKey(k));
      const width = Math.max(...labels.map((l) => l.length));
      for (let i = 0; i < entries.length; i++) {
        const value = formatValue(entries[i]![0], entries[i]![1]);
        console.log(`    ${dim(padEnd(labels[i]!, width))}  ${value}`);
      }
    }
  }
}

function formatHuman(data: unknown): string {
  if (data === null || data === undefined) return "";
  if (typeof data === "string") return data;
  if (Array.isArray(data)) {
    if (data.length === 0) return dim("(no results)");
    if (typeof data[0] === "object" && data[0] !== null) {
      return tableFromObjects(data as Record<string, unknown>[]);
    }
    return data.map((d) => String(d)).join("\n");
  }
  if (typeof data === "object") {
    return formatObject(data as Record<string, unknown>);
  }
  return String(data);
}

/** Single-object renderer: pad-aligned, dim keys, scalar coloring on values. */
function formatObject(obj: Record<string, unknown>): string {
  const entries = Object.entries(obj).filter(([_, v]) => v !== undefined);
  if (entries.length === 0) return "";
  const labels = entries.map(([k]) => humanKey(k));
  const width = Math.max(...labels.map((l) => l.length));
  return entries
    .map(
      ([k, v], i) =>
        `${dim(padEnd(labels[i]!, width))}  ${formatValue(k, v)}`,
    )
    .join("\n");
}

function tableFromObjects(rows: Record<string, unknown>[]): string {
  const cols = Array.from(
    rows.reduce<Set<string>>((set, row) => {
      for (const k of Object.keys(row)) set.add(k);
      return set;
    }, new Set()),
  );

  const headers = cols.map(humanKey);
  const cells = rows.map((row) => cols.map((c) => formatValue(c, row[c])));

  const colWidth = (i: number) =>
    Math.max(
      visualWidth(headers[i] ?? ""),
      ...cells.map((row) => visualWidth(row[i] ?? "")),
    );

  // Cap any column at the terminal width / N so a single sprawling URL
  // doesn't push the rest off-screen. Falls through to no cap when
  // process.stdout.columns is undefined.
  const termW = process.stdout.columns ?? 0;
  const colMax = termW > 40 ? Math.max(20, Math.floor(termW / cols.length)) : Infinity;

  const widths = cols.map((_, i) => Math.min(colWidth(i), colMax));

  const headerRow = headers
    .map((h, i) => bold(padEnd(truncate(h, widths[i]!), widths[i]!)))
    .join("  ");
  const body = cells
    .map((row) =>
      row.map((v, i) => padEnd(truncate(v, widths[i]!), widths[i]!)).join("  "),
    )
    .join("\n");

  return body.length ? `${headerRow}\n${body}` : headerRow;
}

/**
 * Field-aware scalar formatter. Knows about a few timestamp-shaped fields and
 * truncates long text bodies; falls back to styleScalar.
 */
function formatValue(key: string, v: unknown): string {
  if (v === null || v === undefined) return dim("—");
  // Likely-timestamp keys with millisecond epoch values render as dim ISO.
  if (
    typeof v === "number" &&
    /(_at|At)$/.test(key) &&
    v > 10_000_000_000 // unix ms
  ) {
    return gray(new Date(v).toISOString());
  }
  if (typeof v === "string" && (key === "text" || key === "body") && v.length > 80) {
    return v.slice(0, 79) + "…";
  }
  return styleScalar(v);
}

/** snake_case / camelCase → "Title case" for human-facing column headers. */
function humanKey(k: string): string {
  // Split on underscores and camelCase boundaries.
  const parts = k
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return k;
  parts[0] = parts[0]!.charAt(0).toUpperCase() + parts[0]!.slice(1);
  return parts.join(" ");
}

// Unused export kept for callers that previously imported it.
export { cyan };
