import { test, expect } from "bun:test";
import { renderRootHelp, renderCommandHelp, renderVersion } from "../src/help";

test("root help has agent-browser-style sections", () => {
  const out = renderRootHelp();
  expect(out).toContain("messages-dev - send and receive iMessages");
  expect(out).toContain("Usage: messages-dev <command> [args] [options]");
  expect(out).toContain("Core Commands:");
  expect(out).toContain("Messaging:");
  expect(out).toContain("Resources:");
  expect(out).toContain("Developer:");
  // sub-namespace headers double as the usage prefix
  expect(out).toContain("Files:  messages-dev files <action>");
  expect(out).toContain("Webhooks:  messages-dev webhooks <action>");
  // dropped commands should NOT appear
  expect(out).not.toContain("whoami");
  expect(out).not.toContain("doctor");
  expect(out).not.toContain("completion");
  expect(out).not.toContain("keys");
});

test("send command help", () => {
  const out = renderCommandHelp(["send"]);
  expect(out).not.toBeNull();
  expect(out).toContain("messages-dev send - send a text");
  expect(out).toContain("--reply-to <id>");
  expect(out).toContain("--audio <path>");
  expect(out).toContain("read from stdin when piped");
  // examples make the command pattern obvious to first-time agents
  expect(out).toContain("Examples:");
  expect(out).toContain("messages-dev send +14155551234");
});

test("nested command help (files upload) resolves longest match", () => {
  const out = renderCommandHelp(["files", "upload"]);
  expect(out).not.toBeNull();
  expect(out).toContain("messages-dev files upload");
  expect(out).toContain("Use `-` to read bytes from stdin");
});

test("root help advertises the agent contract", () => {
  const out = renderRootHelp();
  expect(out).toContain("Authentication:");
  expect(out).toContain("MESSAGES_API_KEY");
  expect(out).toContain("Output:");
  expect(out).toContain("Exit codes:");
  expect(out).toContain("not_authenticated");
});

test("unknown command path returns null", () => {
  expect(renderCommandHelp(["nope"])).toBeNull();
});

test("version string", () => {
  expect(renderVersion()).toMatch(/^messages-dev \d+\.\d+\.\d+$/);
});
