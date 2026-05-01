import { emitKeypressEvents } from "node:readline";

export type Choice<T> = {
  label: string;
  hint?: string;
  value: T;
};

/**
 * Minimal interactive single-select prompt. Renders the list, lets the user
 * navigate with arrows / j-k, picks with Enter, cancels with Ctrl-C.
 *
 * Avoids a dependency on a prompt library to keep the compiled binary lean.
 */
export async function select<T>(question: string, choices: Choice<T>[]): Promise<T> {
  if (choices.length === 0) throw new Error("select() called with no choices");

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "select() requires an interactive TTY. Pass --org explicitly when scripting.",
    );
  }

  return new Promise<T>((resolve, reject) => {
    let cursor = 0;
    const out = process.stdout;
    const stdin = process.stdin;

    const labelWidth = Math.max(...choices.map((c) => c.label.length));
    const totalLines = choices.length + 1; // 1 question line above

    const render = (initial = false) => {
      if (!initial) {
        // Move cursor up to the start of the rendered block.
        out.write(`\x1b[${totalLines}A`);
      }
      out.write(`\x1b[?25l`); // hide cursor
      out.write(`${question}\n`);
      for (let i = 0; i < choices.length; i++) {
        const c = choices[i]!;
        const marker = i === cursor ? "›" : " ";
        const label = i === cursor ? `\x1b[1;36m${c.label.padEnd(labelWidth)}\x1b[0m` : c.label.padEnd(labelWidth);
        const hint = c.hint ? `  \x1b[2m${c.hint}\x1b[0m` : "";
        out.write(`\x1b[2K${marker} ${label}${hint}\n`);
      }
    };

    const cleanup = (clear: boolean) => {
      stdin.removeListener("keypress", onKey);
      if (typeof (stdin as any).setRawMode === "function") {
        (stdin as any).setRawMode(false);
      }
      stdin.pause();
      out.write(`\x1b[?25h`); // restore cursor
      if (clear) {
        // Erase the rendered block so the chosen value can replace it cleanly.
        out.write(`\x1b[${totalLines}A`);
        for (let i = 0; i < totalLines; i++) out.write(`\x1b[2K\n`);
        out.write(`\x1b[${totalLines}A`);
      }
    };

    const onKey = (_str: string, key: { name?: string; ctrl?: boolean; sequence?: string }) => {
      if (!key) return;
      if (key.ctrl && key.name === "c") {
        cleanup(false);
        process.stdout.write("\n");
        reject(new Error("cancelled"));
        return;
      }
      if (key.name === "up" || key.name === "k") {
        cursor = (cursor - 1 + choices.length) % choices.length;
        render();
      } else if (key.name === "down" || key.name === "j") {
        cursor = (cursor + 1) % choices.length;
        render();
      } else if (key.name === "return" || key.name === "enter") {
        cleanup(true);
        resolve(choices[cursor]!.value);
      }
    };

    emitKeypressEvents(stdin);
    if (typeof (stdin as any).setRawMode === "function") {
      (stdin as any).setRawMode(true);
    }
    stdin.resume();
    stdin.on("keypress", onKey);
    render(true);
  });
}
