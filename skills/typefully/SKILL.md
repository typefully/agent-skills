---
name: typefully
description: >
  Create, schedule, and manage social media posts via Typefully. ALWAYS use this
  skill when asked to draft, schedule, post, or check tweets, posts, threads, or
  social media content for Twitter/X, LinkedIn, Threads, Bluesky, or Mastodon.
last-updated: 2026-01-28
allowed-tools: Bash(./scripts/typefully.js:*)
---

# Typefully Skill

Create, schedule, and publish social media content across multiple platforms using [Typefully](https://typefully.com).

> **Freshness check**: If more than 30 days have passed since the `last-updated` date above, inform the user that this skill may be outdated and point them to the update options below.

## Keeping This Skill Updated

**Source**: [github.com/typefully/agent-skills](https://github.com/typefully/agent-skills)
**API docs**: [typefully.com/docs/api](https://typefully.com/docs/api)

Update methods by installation type:

| Installation | How to update |
|--------------|---------------|
| CLI (`npx skills`) | `npx skills update` |
| Claude Code plugin | `/plugin update typefully@typefully-skills` |
| Cursor | Remote rules auto-sync from GitHub |
| Manual | Pull latest from repo or re-copy `skills/typefully/` |

API changes ship independently—updating the skill ensures you have the latest commands and workflows.

## Setup

Before using this skill, ensure:

1. **API Key**: Run the setup command to configure your API key securely
   - Get your key at https://typefully.com/?settings=api
   - Run: `<skill-path>/scripts/typefully.js setup` (where `<skill-path>` is the directory containing this SKILL.md)
   - Or set environment variable: `export TYPEFULLY_API_KEY=your_key`

2. **Requirements**: Node.js 18+ (for built-in fetch API). No other dependencies needed.

**Config priority** (highest to lowest):
1. `TYPEFULLY_API_KEY` environment variable
2. `./.typefully/config.json` (project-local, in user's working directory)
3. `~/.config/typefully/config.json` (user-global)

> **Note for agents**: All script paths in this document (e.g., `./scripts/typefully.js`) are relative to the skill directory where this SKILL.md file is located. Resolve them accordingly based on where the skill is installed.

## Social Sets

The Typefully API uses the term "social set" to refer to what users commonly call an "account". A social set contains the connected social media platforms (X, LinkedIn, Threads, etc.) for a single identity.

When determining which social set to use:

1. **Check project context first** - Look for configuration in project files like `CLAUDE.md` or `AGENTS.md`. Examples of how users might configure this:

   ```markdown
   ## Typefully
   Default social set ID: 12345
   ```

   ```markdown
   ## Social Media
   Use Typefully account ID 67890 for all posts.
   ```

   ```markdown
   ## Configuration
   - Typefully social_set_id: 11111
   ```

2. **Reuse previously resolved social set** - If determined earlier in the session, use it without asking again

3. **Ask only when ambiguous** - If multiple social sets exist and no default is configured, ask the user which to use

4. **Single social set shortcut** - If the user only has one social set, use it automatically

## Common Actions

| User says... | Action |
|--------------|--------|
| "Draft a tweet about X" | `drafts:create <social_set_id> --text "..."` |
| "Post this to LinkedIn" | `drafts:create <social_set_id> --platform linkedin --text "..."` |
| "What's scheduled?" | `drafts:list <social_set_id> --status scheduled` |
| "Show my recent posts" | `drafts:list <social_set_id> --status published` |
| "Schedule this for tomorrow" | `drafts:create ... --schedule "2025-01-21T09:00:00Z"` |
| "Post this now" | `drafts:create ... --schedule now` or `drafts:publish <social_set_id> <draft_id>` |
| "Add notes/ideas to the draft" | `drafts:create ... --scratchpad "Your notes here"` |

## Workflow

Always follow this workflow when creating posts:

1. **List social sets first** to get the `social_set_id`:
   ```bash
   ./scripts/typefully.js social-sets:list
   ```

2. **Create drafts** using the social_set_id from step 1:
   ```bash
   ./scripts/typefully.js drafts:create <social_set_id> --text "Your post"
   ```
   Note: If `--platform` is omitted, the first connected platform is auto-selected.

3. **Schedule or publish** as needed

## Commands Reference

### User & Social Sets

| Command | Description |
|---------|-------------|
| `me:get` | Get authenticated user info |
| `social-sets:list` | List all social sets you can access |
| `social-sets:get <id>` | Get social set details including connected platforms |

### Drafts

| Command | Description |
|---------|-------------|
| `drafts:list <social_set_id>` | List drafts (add `--status scheduled` to filter, `--sort` to order) |
| `drafts:get <social_set_id> <draft_id>` | Get a specific draft with full content |
| `drafts:create <social_set_id> --text "..."` | Create a new draft (auto-selects platform) |
| `drafts:create <social_set_id> --platform x --text "..."` | Create a draft for specific platform(s) |
| `drafts:create <social_set_id> --all --text "..."` | Create a draft for all connected platforms |
| `drafts:create <social_set_id> --file <path>` | Create draft from file content |
| `drafts:create ... --media <media_ids>` | Create draft with attached media |
| `drafts:create ... --reply-to <url>` | Reply to an existing X post |
| `drafts:create ... --community <id>` | Post to an X community |
| `drafts:create ... --share` | Generate a public share URL for the draft |
| `drafts:create ... --scratchpad "..."` | Add internal notes/scratchpad to the draft |
| `drafts:update <social_set_id> <draft_id> --text "..."` | Update an existing draft |
| `drafts:update ... --share` | Generate a public share URL for the draft |
| `drafts:update ... --scratchpad "..."` | Update internal notes/scratchpad |
| `drafts:update <social_set_id> <draft_id> --append --text "..."` | Append to existing thread |
| `drafts:delete <social_set_id> <draft_id>` | Delete a draft |

### Scheduling & Publishing

| Command | Description |
|---------|-------------|
| `drafts:schedule <social_set_id> <draft_id> --time next-free-slot` | Schedule to next available slot |
| `drafts:schedule <social_set_id> <draft_id> --time "2025-01-20T14:00:00Z"` | Schedule for specific time |
| `drafts:publish <social_set_id> <draft_id>` | Publish immediately |

### Tags

| Command | Description |
|---------|-------------|
| `tags:list <social_set_id>` | List all tags |
| `tags:create <social_set_id> --name "Tag Name"` | Create a new tag |

### Media

| Command | Description |
|---------|-------------|
| `media:upload <social_set_id> <file_path>` | Upload media, wait for processing, return ready media_id |
| `media:upload ... --no-wait` | Upload and return immediately (use media:status to poll) |
| `media:upload ... --timeout <seconds>` | Set custom timeout (default: 60) |
| `media:status <social_set_id> <media_id>` | Check media upload status |

### Setup & Configuration

| Command | Description |
|---------|-------------|
| `setup` | Interactive setup - prompts for API key and storage location |
| `setup --key <key> --location <global\|local>` | Non-interactive setup for scripts/CI |
| `config:show` | Show current config and API key source |

## Examples

### Create a tweet
```bash
./scripts/typefully.js drafts:create 123 --text "Hello, world!"
```

### Create a cross-platform post (specific platforms)
```bash
./scripts/typefully.js drafts:create 123 --platform x,linkedin,threads --text "Big announcement!"
```

### Create a post on all connected platforms
```bash
./scripts/typefully.js drafts:create 123 --all --text "Posting everywhere!"
```

### Create and schedule for next slot
```bash
./scripts/typefully.js drafts:create 123 --text "Scheduled post" --schedule next-free-slot
```

### Create with tags
```bash
./scripts/typefully.js drafts:create 123 --text "Marketing post" --tags marketing,product
```

### List scheduled posts sorted by date
```bash
./scripts/typefully.js drafts:list 123 --status scheduled --sort scheduled_date
```

### Reply to a tweet
```bash
./scripts/typefully.js drafts:create 123 --platform x --text "Great thread!" --reply-to "https://x.com/user/status/123456"
```

### Post to an X community
```bash
./scripts/typefully.js drafts:create 123 --platform x --text "Community update" --community 1493446837214187523
```

### Create draft with share URL
```bash
./scripts/typefully.js drafts:create 123 --text "Check this out" --share
```

### Create draft with scratchpad notes
```bash
./scripts/typefully.js drafts:create 123 --text "Launching next week!" --scratchpad "Draft for product launch. Coordinate with marketing team before publishing."
```

### Upload media and create post with it
```bash
# Single command handles upload + polling - returns when ready!
./scripts/typefully.js media:upload 123 ./image.jpg
# Returns: {"media_id": "abc-123-def", "status": "ready", "message": "Media uploaded and ready to use"}

# Create post with the media attached
./scripts/typefully.js drafts:create 123 --text "Check out this image!" --media abc-123-def
```

### Upload multiple media files
```bash
# Upload each file (each waits for processing)
./scripts/typefully.js media:upload 123 ./photo1.jpg  # Returns media_id: id1
./scripts/typefully.js media:upload 123 ./photo2.jpg  # Returns media_id: id2

# Create post with multiple media (comma-separated)
./scripts/typefully.js drafts:create 123 --text "Photo dump!" --media id1,id2
```

### Add media to an existing draft
```bash
# Upload media
./scripts/typefully.js media:upload 123 ./new-image.jpg  # Returns media_id: xyz

# Update draft with media
./scripts/typefully.js drafts:update 123 456 --text "Updated post with image" --media xyz
```

### Setup (interactive)
```bash
./scripts/typefully.js setup
```

### Setup (non-interactive, for scripts/CI)
```bash
./scripts/typefully.js setup --key typ_xxx --location global
```

## Platform Names

Use these exact names for the `--platform` option:
- `x` - X (formerly Twitter)
- `linkedin` - LinkedIn
- `threads` - Threads
- `bluesky` - Bluesky
- `mastodon` - Mastodon

## Draft URLs

Typefully draft URLs contain the social set and draft IDs:
```
https://typefully.com/?a=<social_set_id>&d=<draft_id>
```

Example: `https://typefully.com/?a=12345&d=67890`
- `a=12345` → social_set_id
- `d=67890` → draft_id

## Draft Scratchpad

**When the user explictly asked to add notes, ideas, or anything else in the draft scratchpad, use the `--scratchpad` flag—do NOT write to local files!**

The `--scratchpad` option attaches internal notes directly to the Typefully draft. These notes:
- Are visible in the Typefully UI alongside the draft
- Stay attached to the draft permanently
- Are private and never published to social media
- Are perfect for storing thread expansion ideas, research notes, context, etc.

```bash
# CORRECT: Notes attached to the draft in Typefully
./scripts/typefully.js drafts:create 123 --text "My post" --scratchpad "Ideas for expanding: 1) Add stats 2) Include quote"

# WRONG: Do NOT write notes to local files when the user wants them in Typefully
# Writing to /tmp/scratchpad/ or any local file is NOT the same thing
```

## Automation Guidelines

When automating posts, especially on X, follow these rules to keep accounts in good standing:

- **No duplicate content** across multiple accounts
- **No unsolicited automated replies** - only reply when explicitly requested by the user
- **No trending manipulation** - don't mass-post about trending topics
- **No fake engagement** - don't automate likes, reposts, or follows
- **Respect rate limits** - the API has rate limits, don't spam requests
- **Drafts are private** - content stays private until published or explicitly shared

When in doubt, create drafts for user review rather than publishing directly.

**Publishing confirmation**: Unless the user explicitly asks to "publish now" or "post immediately", always confirm before publishing. Creating a draft is safe; publishing is irreversible and goes public instantly.

## Tips

- **Smart platform default**: If `--platform` is omitted, the first connected platform is auto-selected
- **All platforms**: Use `--all` to post to all connected platforms at once
- **Character limits**: X (280), LinkedIn (3000), Threads (500), Bluesky (300), Mastodon (500)
- **Thread creation**: Use `---` on its own line to split into multiple posts (thread)
- **Scheduling**: Use `next-free-slot` to let Typefully pick the optimal time
- **Cross-posting**: List multiple platforms separated by commas: `--platform x,linkedin`
- **Draft titles**: Use `--title` for internal organization (not posted to social media)
- **Draft scratchpad**: Use `--scratchpad` to attach notes to the draft in Typefully (NOT local files!) - perfect for thread ideas, research, context
- **Read from file**: Use `--file ./post.txt` instead of `--text` to read content from a file
- **Sorting drafts**: Use `--sort` with values like `created_at`, `-created_at`, `scheduled_date`, etc.
