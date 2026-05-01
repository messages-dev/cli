import { defineCommand } from "../cli";
import { getAuthedClient } from "../client";
import { success } from "../output";
import { fail, jsonMode, toMessage } from "../errors";

export default defineCommand({
  meta: {
    name: "react",
    description: "Send a tapback reaction.",
  },
  args: {
    messageId: {
      type: "positional",
      description: "Message ID (msg_…) or imsgGuid",
      required: false,
    },
    type: {
      type: "positional",
      description: "Reaction type (love, like, dislike, laugh, emphasize, question, or literal emoji)",
      required: false,
    },
    from: { type: "string", description: "Sending line handle (defaults to the only active line)" },
    to: { type: "string", description: "Recipient handle or chat id (required)" },
    json: { type: "boolean", description: "Emit JSON" },
  },
  async run({ args }) {
    const json = jsonMode(args);
    if (!args.messageId || !args.type) {
      fail("usage", "Usage: messages-dev react <message-id> <emoji> [options]", { json });
    }
    const { client } = await getAuthedClient(args);

    let from = args.from as string | undefined;
    if (!from) {
      const list = await client.listLines();
      const active = list.data.filter((l) => l.isActive);
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

    if (!args.to) {
      fail("usage", "--to is required (recipient handle or chat id).", { json });
    }

    try {
      const result = await client.sendReaction({
        from,
        to: args.to as string,
        messageId: args.messageId as string,
        type: args.type as string,
      });
      success(`Reacted ${args.type} to ${args.messageId}`, result, json);
    } catch (err) {
      fail("generic", toMessage(err), { json });
    }
  },
});
