# messages-dev

Official CLI for [messages.dev](https://www.messages.dev). Send and receive
iMessages, manage lines, and stream events live, all from your terminal.

## Install

```sh
curl -fsSL https://www.messages.dev/install.sh | sh
```

Or via npm:

```sh
npm install -g @messages-dev/cli
```

The curl install drops a single self-contained binary in `~/.messages/bin/`
and prints the PATH line you need. The npm install requires Node 20+.

## Authenticate

```sh
messages-dev login
```

For headless use, set `MESSAGES_API_KEY=sk_live_…` and skip `login`.

## Send a message

```sh
messages-dev lines list
messages-dev send +14155551234 "hi from the terminal"
```

## More

```sh
messages-dev --help
messages-dev <command> --help
```

Full reference: [www.messages.dev/docs/cli](https://www.messages.dev/docs/cli)

## License

MIT — see [LICENSE](./LICENSE).
