import { defineCommand } from "../cli";
import { getAuthedClient } from "../client";
import { success } from "../output";
import { fail, jsonMode, toMessage } from "../errors";

export default defineCommand({
  meta: {
    name: "read",
    description: "Send a read receipt.",
  },
  args: {
    to: { type: "positional", description: "Recipient phone, Apple ID, or chat id", required: false },
    from: { type: "string", description: "Sending line handle (defaults to the only active line)" },
    json: { type: "boolean", description: "Emit JSON" },
  },
  async run({ args }) {
    const json = jsonMode(args);
    if (!args.to) {
      fail("usage", "Usage: messages-dev read <to> [options]", { json });
    }
    const { client } = await getAuthedClient(args);

    let from = args.from as string | undefined;
    if (!from) {
      const linesRes = await client.listLines();
      const active = linesRes.data.filter((l) => l.isActive);
      if (active.length === 0) {
        fail(
          "validation",
          "No active lines found. Pass --from <handle>. Run `messages-dev lines list` to see your lines.",
          { json },
        );
      }
      if (active.length > 1) {
        const handles = active.map((l) => l.handle);
        const example = handles[0]!;
        fail(
          "validation",
          `Multiple active lines (${handles.join(", ")}). Pick one with --from <handle> (e.g. --from ${example}).`,
          { json, details: { active_lines: handles } },
        );
      }
      from = active[0]!.handle;
    }

    try {
      const result = await client.sendReadReceipt({ from, to: args.to as string });
      success(`Sent read receipt to ${args.to} via ${from}`, result, json);
    } catch (err) {
      fail("generic", toMessage(err), { json });
    }
  },
});
