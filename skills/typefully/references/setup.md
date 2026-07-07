# Setup & Configuration

> Script paths here are relative to the skill root (where `SKILL.md` lives), e.g. `./scripts/typefully.js`.

## API Key

1. Get a key at https://typefully.com/?settings=api
2. Run interactive setup: `./scripts/typefully.js setup`
3. Or set an environment variable: `export TYPEFULLY_API_KEY=your_key`

Requirements: Node.js 18+ (built-in fetch). No other dependencies.

**Config priority** (highest to lowest):

1. `TYPEFULLY_API_KEY` environment variable
2. `./.typefully/config.json` (project-local)
3. `~/.config/typefully/config.json` (user-global)

Development only: pass `--api-base-url <url>` to target another API base; `/v2` is appended when omitted. If a local server's TLS certificate isn't trusted (`fetch failed` / `UNABLE_TO_VERIFY_LEAF_SIGNATURE`), see [`local-development.md`](local-development.md).

## Handling "API key not found" errors

When the CLI returns "API key not found":

1. **Tell the user to run `./scripts/typefully.js setup`** themselves — it is interactive, so you cannot run it for them.
2. **Stop and wait.** No API operation works without a key. Do not draft or prepare content until setup is confirmed.
3. **Do not** search Keychain, `.env` files, config directories, Trash, or construct commands to find credentials.

Trust the CLI's error messages and follow them.

## Setup commands

| Command | Description |
|---------|-------------|
| `setup` | Interactive setup — prompts for API key, storage location, and default social set |
| `setup --key <key> --location <global\|local>` | Non-interactive setup (auto-selects default if only one social set) |
| `setup --key <key> --default-social-set <id>` | Non-interactive setup with explicit default social set |
| `setup --key <key> --no-default` | Non-interactive setup, skip default social set selection |
| `config:show` | Show current config, API key source, and default social set |
| `config:set-default [social_set_id]` | Set default social set (interactive if ID omitted) |

```bash
# Interactive
./scripts/typefully.js setup

# Non-interactive (CI) — auto-selects default if only one social set
./scripts/typefully.js setup --key typ_xxx --location global

# With explicit default social set
./scripts/typefully.js setup --key typ_xxx --location global --default-social-set 123

# Set default later
./scripts/typefully.js config:set-default 123 --location global
```

## Keeping the skill updated

**Source**: [github.com/typefully/agent-skills](https://github.com/typefully/agent-skills) · **API docs**: [typefully.com/docs/api](https://typefully.com/docs/api)

When the freshness check in `SKILL.md` flags the skill as stale, point the user to an update method:

| Installation | How to update |
|--------------|---------------|
| CLI (`npx skills`) | `npx skills update` |
| Claude Code plugin | `/plugin update typefully@typefully-skills` |
| Cursor | Remote rules auto-sync from GitHub |
| Manual | Pull latest from repo or re-copy `skills/typefully/` |

API changes ship independently of the skill.
