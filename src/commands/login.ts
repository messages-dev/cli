import { defineCommand } from "../cli";
import { runLogin } from "../auth/login";
import { fail, jsonMode, toMessage } from "../errors";

export default defineCommand({
  meta: {
    name: "login",
    description: "Sign in via Clerk OAuth + PKCE; stores an sk_live_* key locally.",
  },
  args: {
    org: {
      type: "string",
      description:
        "Organization ID to use without prompting. Skip the interactive picker (useful for scripts).",
    },
    json: { type: "boolean", description: "Emit JSON" },
  },
  async run({ args }) {
    const json = jsonMode(args);
    try {
      const result = await runLogin({
        ...(args.org ? { orgId: args.org as string } : {}),
      });
      if (json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        const who = result.email ?? "your account";
        console.log(`Logged in as ${who} (org ${result.orgId}).`);
        console.log(`Key: ${result.prefix}…`);
      }
    } catch (err) {
      const message = toMessage(err);
      fail("generic", message === "cancelled" ? "Login cancelled." : message, { json });
    }
  },
});
