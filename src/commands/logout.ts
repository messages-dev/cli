import { defineCommand } from "../cli";
import { clearConfig, configPath } from "../auth/creds";

export default defineCommand({
  meta: {
    name: "logout",
    description: "Wipe stored credentials.",
  },
  args: {},
  async run() {
    const removed = await clearConfig();
    if (removed) {
      console.log(`Removed ${configPath()}`);
    } else {
      console.log("No stored credentials to remove.");
    }
    if (process.env.MESSAGES_API_KEY) {
      console.log("Note: MESSAGES_API_KEY is still set in your environment.");
    }
  },
});
