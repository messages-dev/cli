import { defineCommand } from "../cli";
import { getAuthedClient } from "../client";
import { emit } from "../output";
import { fail, jsonMode, toMessage } from "../errors";

const get = defineCommand({
  meta: { name: "get", description: "Look up an outbox item by ID." },
  args: {
    id: { type: "positional", description: "Outbox ID (obx_…)", required: false },
    json: { type: "boolean" },
  },
  async run({ args }) {
    const json = jsonMode(args);
    if (!args.id) {
      fail("usage", "Usage: messages-dev outbox get <id>", { json });
    }
    const { client } = await getAuthedClient(args);
    try {
      const item = await client.getOutboxItem({ id: args.id as string });
      emit(item, json);
    } catch (err) {
      fail("generic", toMessage(err), { json });
    }
  },
});

export default defineCommand({
  meta: { name: "outbox", description: "Inspect outbox items." },
  subCommands: { get },
});
