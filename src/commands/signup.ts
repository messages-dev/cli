import { defineCommand } from "../cli";
import { runLogin } from "../auth/login";
import { resolveCreds } from "../auth/creds";
import { fail, jsonMode, toMessage } from "../errors";
import { bold, dim } from "../style";
import { BIN } from "../meta";
import { activateInteractively } from "./sandbox";

const ONBOARD_HINT =
  "Your account isn't fully set up yet. Finish onboarding at https://app.messages.dev (it takes ~30s), then re-run `messages-dev signup`.";

export default defineCommand({
  meta: {
    name: "signup",
    description: "Sign in (or sign up) and walk through sandbox activation in one go.",
  },
  args: {
    org: {
      type: "string",
      description:
        "Organization ID to use without prompting (skips the picker on multi-org accounts).",
    },
    json: { type: "boolean", description: "Emit JSON" },
  },
  async run({ args }) {
    const json = jsonMode(args);

    const existing = await resolveCreds();
    if (existing) {
      if (!json) {
        const who = existing.profile?.email ?? "your account";
        const orgId = existing.profile?.orgId ?? "—";
        console.log(`${dim("Already signed in as")} ${bold(who)} ${dim(`(${orgId}). Skipping login.`)}`);
      }
    } else {
      try {
        const result = await runLogin({
          ...(args.org ? { orgId: args.org as string } : {}),
        });
        if (!json) {
          const who = result.email ?? "your account";
          console.log(`Signed in as ${bold(who)} ${dim(`(${result.orgId})`)}.`);
          console.log("");
        }
      } catch (err) {
        const message = toMessage(err);
        if (message.includes("no_active_organization") || message.includes("no_active_org")) {
          fail("generic", ONBOARD_HINT, { json });
        }
        fail("generic", message === "cancelled" ? "Signup cancelled." : message, { json });
      }
    }

    try {
      const final = await activateInteractively(json);
      if (!final) process.exit(1);
    } catch (err) {
      fail("generic", toMessage(err), { json });
    }
  },
});
