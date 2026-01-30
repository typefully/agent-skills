# Typefully Skills

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)]()
[![Typefully API](https://img.shields.io/badge/Typefully-API-3B9AF8)](https://typefully.com/docs/api)

AI agent skills for drafting, scheduling, and managing social media posts across X, LinkedIn, Threads, Bluesky, and Mastodon. Give your AI agent the ability to manage your social media scheduling directly from your IDE or terminal.

Built on the [Typefully API](https://typefully.com/docs/api). [Typefully](https://typefully.com) is a writing and scheduling app used by 200k+ top creators and teams to grow on X, LinkedIn, Threads, and Bluesky.

## What Are Skills?

Skills are markdown files that give AI agents specialized knowledge and workflows for specific tasks. Add this to your project and your AI agent will be able to create, schedule, and publish social media content.

## Setup

### 1. Install the skill

**CLI** (works with Claude Code, Cursor, Windsurf, and many other agents):

```bash
npx skills add typefully/agent-skills
```

<details>
<summary>Other installation methods</summary>

**Claude Code Plugin:**

```
/plugin marketplace add typefully/agent-skills
```

Then:

```
/plugin install typefully@typefully-skills
```

**Cursor:**

1. Open Settings (Cmd+Shift+J)
2. Go to "Rules & Command" → "Project Rules"
3. Click "Add Rule" → "Remote Rule (GitHub)"
4. Enter: `https://github.com/typefully/agent-skills.git`

**Manual:**

Clone this repository and copy `skills/typefully/` to your project's `.cursor/skills/` or `.claude/skills/` directory.

</details>

### 2. Copy your API Key

You'll need a Typefully API key for the setup command. Copy an existing key or create a new one at https://typefully.com/?settings=api

### 3. Run the setup command

This configures your API key and default social set:

```bash
./scripts/typefully.js setup
```

> [!TIP]
> The path depends on how you installed the skill, but you can ask your agent "Help me set up the Typefully skill" to get the correct path.
>
> You can also set the API key as an environment variable instead: `export TYPEFULLY_API_KEY=your_key_here`

### 4. Start using it

Ask your AI agent things like:

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

Run the setup command:

```bash
./scripts/typefully.js setup
```

Or set the environment variable manually:

```bash
export TYPEFULLY_API_KEY=your_key_here
```

To persist the environment variable across sessions, add it to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.).

### "Node.js is required"

The CLI is a zero-dependency Node.js script and requires Node.js 18+ (for built-in `fetch`).
Install a recent Node.js version, then retry your command.

### API errors (401, 403)

- Verify your API key is correct
- Check that your key has the required permissions at https://typefully.com/?settings=api

### Drafts not appearing

- Make sure you're using the correct `social_set_id` (run `./scripts/typefully.js social-sets:list` to list them)
- Check the draft status with `./scripts/typefully.js drafts:list <social_set_id>`

## Alternative: MCP Server

For deeper integration with Claude Code, you can also use the Typefully MCP Server which provides native tool access:

https://support.typefully.com/en/articles/13128440-typefully-mcp-server

## Links

- [Typefully](https://typefully.com)
- [API Documentation](https://typefully.com/docs/api)
- [Skills Leaderboard](https://skills.sh)

## License

MIT
