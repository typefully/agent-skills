# Typefully Skills

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)]()
[![Typefully API](https://img.shields.io/badge/Typefully-API-3B9AF8)](https://typefully.com/docs/api)

AI agent skills for drafting, scheduling, and managing social media posts across X, LinkedIn, Threads, Bluesky, and Mastodon. Give your AI agent the ability to manage your social media scheduling directly from your IDE or terminal.

Built on the [Typefully API](https://typefully.com/docs/api). [Typefully](https://typefully.com) is a writing and scheduling app used by 200k+ top creators and teams to grow on X, LinkedIn, Threads, and Bluesky.

## What Are Skills?

Skills are markdown files that give AI agents specialized knowledge and workflows for specific tasks. Add this to your project and your AI agent will be able to create, schedule, and publish social media content.

## Installation

> [!NOTE]
> Requires a Typefully API key. Get yours at https://typefully.com/settings/api and set it as an environment variable:
>
> ```bash
> export TYPEFULLY_API_KEY=your_key_here
> ```

> [!TIP]
> To avoid being asked which account to use every time, add your default `social_set_id` to your project's `CLAUDE.md` or `AGENTS.md`:
> ```markdown
> ## Typefully
> Default social_set_id: 12345
> ```
> Find your social_set_id by running `./scripts/typefully.sh accounts` after setting your API key.

### CLI (Recommended)

Works with Claude Code, Cursor, Windsurf, and many other agents.

```bash
npx skills add typefully/agent-skills
```

### Claude Code Plugin

```
/plugin marketplace add typefully/agent-skills
```

Then:

```
/plugin install typefully@typefully-skills
```

### Cursor

1. Open Settings (Cmd+Shift+J)
2. Go to "Rules & Command" → "Project Rules"
3. Click "Add Rule" → "Remote Rule (GitHub)"
4. Enter: `https://github.com/typefully/agent-skills.git`

### Manual

Clone this repository and copy `skills/typefully/` to your project's `.cursor/skills/` or `.claude/skills/` directory.

## Usage Examples

After installing, ask your AI agent:

- "Draft a tweet about [topic]"
- "Create a LinkedIn post announcing [news]"
- "Schedule my draft for tomorrow morning"
- "Show my scheduled posts"
- "Create a thread about [topic]"
- "Post this to X and LinkedIn"

## Supported Platforms

- X (formerly Twitter)
- LinkedIn
- Threads
- Bluesky
- Mastodon

## Troubleshooting

### "TYPEFULLY_API_KEY environment variable is not set"

Make sure you've exported your API key:

```bash
export TYPEFULLY_API_KEY=your_key_here
```

To persist across sessions, add it to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.).

### "curl is required but not installed" / "jq is required but not installed"

Install the missing dependencies:

```bash
# macOS
brew install curl jq

# Ubuntu/Debian
sudo apt-get install curl jq
```

### API errors (401, 403)

- Verify your API key is correct
- Check that your key has the required permissions at https://typefully.com/settings/api

### Drafts not appearing

- Make sure you're using the correct `social_set_id` (run `./scripts/typefully.sh accounts` to list them)
- Check the draft status with `./scripts/typefully.sh drafts <social_set_id>`

## Alternative: MCP Server

For deeper integration with Claude Code, you can also use the Typefully MCP Server which provides native tool access:

https://support.typefully.com/en/articles/13128440-typefully-mcp-server

## Links

- [Typefully](https://typefully.com)
- [API Documentation](https://typefully.com/docs/api)
- [Skills Leaderboard](https://skills.sh)

## License

MIT
