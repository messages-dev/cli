// Minimal CLI parser + dispatcher. Replaces citty so its auto-help and
// auto-error output never leak through. Help is rendered exclusively by
// `./help.ts`; this file only does argv → run() dispatch.

import { red, symbols } from "./style";

export type ArgDef =
  | {
      type: "positional";
      description?: string;
      required?: boolean;
      // Appended to the "Missing required" error when this positional is
      // omitted. Use it to point the caller at a discovery command, e.g.
      // "Run `messages-dev lines list` to see options."
      hint?: string;
    }
  | {
      type: "string";
      description?: string;
      required?: boolean;
      alias?: string | string[];
      hint?: string;
    }
  | {
      type: "boolean";
      description?: string;
      alias?: string | string[];
    };

export type CommandSchema = Record<string, ArgDef>;

export type Command = {
  meta?: { name?: string; description?: string };
  args?: CommandSchema;
  run?: (ctx: { args: Record<string, unknown> }) => unknown | Promise<unknown>;
  subCommands?: Record<string, Command>;
};

export function defineCommand<T extends Command>(c: T): T {
  return c;
}

export async function runCli(root: Command, argv: string[]): Promise<void> {
  // Walk subcommands greedily until we hit a flag or an unrecognized token.
  let cmd = root;
  let i = 0;
  while (i < argv.length) {
    const tok = argv[i]!;
    if (tok.startsWith("-")) break;
    const sub = cmd.subCommands?.[tok];
    if (!sub) break;
    cmd = sub;
    i++;
  }
  const rest = argv.slice(i);

  if (!cmd.run) {
    // Parent without a leaf run() and no recognized subcommand. The help
    // interceptor in src/index.ts catches the common cases; if we get here,
    // the user passed something the interceptor didn't catch.
    process.stderr.write(
      `Unknown command. Run \`messages-dev --help\` to see options.\n`,
    );
    process.exit(2);
  }

  const parsed = parseArgs(cmd.args ?? {}, rest);
  if (parsed.error) {
    // Match the structured-error contract from errors.ts so agents see a
    // consistent shape. Inline the red ✗ to avoid pulling style.ts into the
    // hot path; on non-TTY stderr the ANSI codes are stripped by the consumer.
    const useJson = process.env.MESSAGES_OUTPUT === "json";
    if (useJson) {
      process.stderr.write(
        JSON.stringify({ error: { code: "usage", message: parsed.error } }) + "\n",
      );
    } else {
      process.stderr.write(`${red(symbols.cross)} ${parsed.error}\n`);
    }
    process.exit(2);
  }

  await cmd.run({ args: parsed.values! });
}

type ParseResult =
  | { values: Record<string, unknown>; error?: undefined }
  | { error: string; values?: undefined };

export function parseArgs(schema: CommandSchema, argv: string[]): ParseResult {
  const values: Record<string, unknown> = {};
  const positionals: string[] = [];
  const positionalNames: string[] = [];

  for (const [name, def] of Object.entries(schema)) {
    if (def.type === "positional") positionalNames.push(name);
  }

  // Short-flag → canonical name.
  const aliases: Record<string, string> = {};
  for (const [name, def] of Object.entries(schema)) {
    if (def.type === "positional") continue;
    const a = (def as { alias?: string | string[] }).alias;
    if (typeof a === "string") aliases[a] = name;
    else if (Array.isArray(a)) for (const x of a) aliases[x] = name;
  }

  const setFlag = (name: string, value: string | boolean) => {
    const existing = values[name];
    if (existing === undefined) {
      values[name] = value;
    } else if (Array.isArray(existing)) {
      (existing as Array<string | boolean>).push(value);
    } else {
      values[name] = [existing, value];
    }
  };

  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i]!;
    if (tok === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (tok.startsWith("--")) {
      const eq = tok.indexOf("=");
      const flag = eq === -1 ? tok.slice(2) : tok.slice(2, eq);
      const def = schema[flag];
      if (!def || def.type === "positional") {
        return { error: `Unknown flag: --${flag}` };
      }
      if (def.type === "boolean") {
        if (eq !== -1) return { error: `--${flag} does not take a value` };
        setFlag(flag, true);
      } else {
        const value = eq === -1 ? argv[++i] : tok.slice(eq + 1);
        if (value === undefined) return { error: `--${flag} requires a value` };
        setFlag(flag, value);
      }
    } else if (tok.startsWith("-") && tok.length > 1) {
      const eq = tok.indexOf("=");
      const short = eq === -1 ? tok.slice(1) : tok.slice(1, eq);
      const flag = aliases[short];
      if (!flag) return { error: `Unknown flag: -${short}` };
      const def = schema[flag]!;
      if (def.type === "boolean") {
        if (eq !== -1) return { error: `-${short} does not take a value` };
        setFlag(flag, true);
      } else {
        const value = eq === -1 ? argv[++i] : tok.slice(eq + 1);
        if (value === undefined) return { error: `-${short} requires a value` };
        setFlag(flag, value);
      }
    } else {
      positionals.push(tok);
    }
  }

  for (let i = 0; i < positionalNames.length; i++) {
    if (positionals[i] !== undefined) values[positionalNames[i]!] = positionals[i];
  }
  // Anything past the named positionals is currently dropped; commands don't
  // declare variadic positionals today. Add support if/when one does.

  for (const [name, def] of Object.entries(schema)) {
    if (
      def.type !== "positional" &&
      (def as { required?: boolean }).required &&
      values[name] === undefined
    ) {
      const hint = (def as { hint?: string }).hint;
      const base = `Missing required: --${name}`;
      return { error: hint ? `${base}. ${hint}` : base };
    }
  }

  return { values };
}
