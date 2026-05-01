import { defineCommand } from "../cli";
import { getAuthedClient } from "../client";
import { emit } from "../output";
import { fail, jsonMode, toMessage } from "../errors";

const list = defineCommand({
  meta: { name: "list", description: "List reactions on a message." },
  args: {
    message: {
      type: "string",
      description: "Message id (msg_…) — required",
      required: true,
      hint: "Find one with `messages-dev messages list --line <handle> --chat <recipient>`.",
    },
    json: { type: "boolean", description: "Emit JSON" },
  },
  async run({ args }) {
    const json = jsonMode(args);
    const { client } = await getAuthedClient(args);
    try {
      const res = await client.listReactions({ messageId: args.message as string });
      emit(json ? res : res.data, json);
    } catch (err) {
      fail("generic", toMessage(err), { json });
    }
  },
});

export default defineCommand({
  meta: { name: "reactions", description: "List reactions on a message." },
  subCommands: { list, ls: list },
});
