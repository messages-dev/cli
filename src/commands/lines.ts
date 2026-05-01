import { defineCommand } from "../cli";
import { getAuthedClient } from "../client";
import { emit } from "../output";
import { fail, jsonMode, toMessage } from "../errors";

const list = defineCommand({
  meta: { name: "list", description: "List your phone lines." },
  args: { json: { type: "boolean" } },
  async run({ args }) {
    const json = jsonMode(args);
    const { client } = await getAuthedClient(args);
    try {
      const res = await client.listLines();
      emit(
        json
          ? res
          : res.data.map((l) => ({
              id: l.id,
              handle: l.handle,
              label: l.label ?? "—",
              service: l.service,
              active: l.isActive,
            })),
        json,
      );
    } catch (err) {
      fail("generic", toMessage(err), { json });
    }
  },
});

export default defineCommand({
  meta: { name: "lines", description: "List your phone lines." },
  subCommands: { list, ls: list },
});
