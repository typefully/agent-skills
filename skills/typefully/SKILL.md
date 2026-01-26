---
name: typefully
description: >
  Create, schedule, and manage social media posts via Typefully. ALWAYS use this
  skill when asked to draft, schedule, post, or check tweets, posts, threads, or
  social media content for Twitter/X, LinkedIn, Threads, Bluesky, or Mastodon.
allowed-tools: Bash(./scripts/typefully.sh:*)
---

# Typefully Skill

Create, schedule, and publish social media content across multiple platforms using [Typefully](https://typefully.com).

## Setup

Before using this skill, ensure:

1. **API Key**: Set the `TYPEFULLY_API_KEY` environment variable
   - Get your key at https://typefully.com/settings/api
   - Export it: `export TYPEFULLY_API_KEY=your_key`

2. **Dependencies**: `curl`, `jq`, and `perl` must be installed (perl is pre-installed on macOS and most Linux systems)

## Account Selection

When determining which account to use:

1. **Check project context first** - Look for account configuration in project files like `CLAUDE.md` or `AGENTS.md`

2. **Reuse previously resolved account** - If the account was determined earlier in the session, use it without asking again

3. **Ask only when ambiguous** - If multiple accounts exist and no default is configured, ask the user which account to use

4. **Single account shortcut** - If the user only has one account, use it automatically

## Common Actions

| User says... | Action |
|--------------|--------|
| "Draft a tweet about X" | `create <social_set_id> --platform x --text "..."` |
| "Post this to LinkedIn" | `create <social_set_id> --platform linkedin --text "..."` |
| "What's scheduled?" | `drafts <social_set_id> --status scheduled` |
| "Show my recent posts" | `drafts <social_set_id> --status published` |
| "Schedule this for tomorrow" | `create ... --schedule "2025-01-21T09:00:00Z"` |
| "Post this now" | `create ... --schedule now` or `publish <social_set_id> <draft_id>` |

## Workflow

Always follow this workflow when creating posts:

1. **List accounts first** to get the `social_set_id`:
   ```bash
   ./scripts/typefully.sh accounts
   ```

2. **Create drafts** using the social_set_id from step 1:
   ```bash
   ./scripts/typefully.sh create <social_set_id> --platform x --text "Your post"
   ```

3. **Schedule or publish** as needed

## Commands Reference

### User & Accounts

| Command | Description |
|---------|-------------|
| `me` | Get authenticated user info |
| `accounts` | List all social sets (accounts) you can access |
| `account <id>` | Get account details including connected platforms |

### Drafts

| Command | Description |
|---------|-------------|
| `drafts <social_set_id>` | List drafts (add `--status scheduled` to filter) |
| `draft <social_set_id> <draft_id>` | Get a specific draft with full content |
| `create <social_set_id> --platform x --text "..."` | Create a new draft |
| `create <social_set_id> --platform x --file <path>` | Create draft from file content |
| `create ... --reply-to <url>` | Reply to an existing X post |
| `create ... --community <id>` | Post to an X community |
| `create ... --share` | Generate a public share URL for the draft |
| `update <social_set_id> <draft_id> --text "..."` | Update an existing draft |
| `update <social_set_id> <draft_id> --append --text "..."` | Append to existing thread |
| `delete <social_set_id> <draft_id>` | Delete a draft |

### Scheduling & Publishing

| Command | Description |
|---------|-------------|
| `schedule <social_set_id> <draft_id> --time next-free-slot` | Schedule to next available slot |
| `schedule <social_set_id> <draft_id> --time "2025-01-20T14:00:00Z"` | Schedule for specific time |
| `publish <social_set_id> <draft_id>` | Publish immediately |

### Tags

| Command | Description |
|---------|-------------|
| `tags <social_set_id>` | List all tags |
| `tag:create <social_set_id> --name "Tag Name"` | Create a new tag |

### Media

| Command | Description |
|---------|-------------|
| `media:upload <social_set_id> <file_path>` | Upload image/video, returns media_id |
| `media:status <social_set_id> <media_id>` | Check if media is processed |

## Examples

### Create a tweet
```bash
./scripts/typefully.sh create 123 --platform x --text "Hello, world!"
```

### Create a cross-platform post
```bash
./scripts/typefully.sh create 123 --platform x,linkedin,threads --text "Big announcement!"
```

### Create and schedule for next slot
```bash
./scripts/typefully.sh create 123 --platform x --text "Scheduled post" --schedule next-free-slot
```

### Create with tags
```bash
./scripts/typefully.sh create 123 --platform x --text "Marketing post" --tags marketing,product
```

### List scheduled posts
```bash
./scripts/typefully.sh drafts 123 --status scheduled
```

### Reply to a tweet
```bash
./scripts/typefully.sh create 123 --platform x --text "Great thread!" --reply-to "https://x.com/user/status/123456"
```

### Post to an X community
```bash
./scripts/typefully.sh create 123 --platform x --text "Community update" --community 1493446837214187523
```

### Create draft with share URL
```bash
./scripts/typefully.sh create 123 --platform x --text "Check this out" --share
```

### Upload media and create post with it
```bash
# Upload the image
./scripts/typefully.sh media:upload 123 ./image.jpg
# Returns: {"media_id": "abc-123", ...}

# Wait for processing
./scripts/typefully.sh media:status 123 abc-123

# Create post with media (requires manual JSON for now)
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

## Automation Guidelines

When automating posts, especially on X, follow these rules to keep accounts in good standing:

- **No duplicate content** across multiple accounts
- **No unsolicited automated replies** - only reply when explicitly requested by the user
- **No trending manipulation** - don't mass-post about trending topics
- **No fake engagement** - don't automate likes, reposts, or follows
- **Respect rate limits** - the API has rate limits, don't spam requests
- **Drafts are private** - content stays private until published or explicitly shared

When in doubt, create drafts for user review rather than publishing directly.

## Tips

- **Default to X/Twitter** unless another platform is specified
- **Character limits**: X (280), LinkedIn (3000), Threads (500), Bluesky (300), Mastodon (500)
- **Thread creation**: Use `---` on its own line to split into multiple posts (thread)
- **Scheduling**: Use `next-free-slot` to let Typefully pick the optimal time
- **Cross-posting**: List multiple platforms separated by commas: `--platform x,linkedin`
- **Draft titles**: Use `--title` for internal organization (not posted to social media)
- **Read from file**: Use `--file ./post.txt` instead of `--text` to read content from a file
