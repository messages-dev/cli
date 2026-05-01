#!/usr/bin/env bun
import { defineCommand, runCli } from "./cli";

import { handleHelpAndVersion } from "./help";

import login from "./commands/login";
import logout from "./commands/logout";
import send from "./commands/send";
import react from "./commands/react";
import typing from "./commands/typing";
import read from "./commands/read";
import lines from "./commands/lines";
import chats from "./commands/chats";
import messages from "./commands/messages";
import reactions from "./commands/reactions";
import receipts from "./commands/receipts";
import outbox from "./commands/outbox";
import files from "./commands/files";
import webhooks from "./commands/webhooks";
import listen from "./commands/listen";

// Bypass citty's auto-help so we can render in the agent-browser style.
// `handleHelpAndVersion` returns true when it printed help/version, in which
// case we exit before runMain ever sees the args.
const argv = process.argv.slice(2);
if (handleHelpAndVersion(argv)) {
  process.exit(0);
}

const main = defineCommand({
  subCommands: {
    login,
    logout,
    send,
    react,
    typing,
    read,
    lines,
    chats,
    messages,
    reactions,
    receipts,
    outbox,
    files,
    webhooks,
    listen,
  },
});

await runCli(main, argv);
