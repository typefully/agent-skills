---
name: typefully
description: >
  Create, schedule, and manage social media posts via Typefully. ALWAYS use this
  skill when asked to draft, schedule, post, or check tweets, posts, threads, or
  social media content for Twitter/X, LinkedIn, Threads, Bluesky, or Mastodon.
last-updated: 2026-07-08
allowed-tools: Bash(./scripts/typefully.js:*)
---

# Typefully Skill

Create, schedule, and publish social media content across X, LinkedIn, Threads, Bluesky, and Mastodon using [Typefully](https://typefully.com). Run everything through `./scripts/typefully.js` (Node.js 18+, no dependencies). All commands output JSON.

> **Script paths** below are relative to this skill's directory. Resolve them based on where the skill is installed.
>
> **Freshness check**: If more than 30 days have passed since the `last-updated` date above, tell the user the skill may be outdated and point them to the update methods in [`references/setup.md`](references/setup.md).
>
> **Authentication failures**: If the CLI returns **"API key not found"**, **"Authentication failed"**, **"HTTP 401"**, or any invalid/expired-key message, tell the user to run `./scripts/typefully.js setup` or update `TYPEFULLY_API_KEY`, then stop. Do not hunt for credentials or fall back to the Typefully web UI, browser scraping, or a localhost dev server. See [`references/setup.md`](references/setup.md).

## Reference guides

Load these only when the task needs them:

| Guide | Use when you need to... |
|-------|-------------------------|
| [`references/setup.md`](references/setup.md) | Configure the API key, fix an "API key not found" error, set up CI, or check whether the skill is up to date |
| [`references/comments.md`](references/comments.md) | Add, reply to, resolve, or delete comments on a draft, or edit a draft that already has comments |
| [`references/platforms/x.md`](references/platforms/x.md) | Pull X (formerly Twitter) analytics, quote or reply to a post, post to a community, or add disclosure labels |
| [`references/platforms/linkedin.md`](references/platforms/linkedin.md) | Mention a company or person on LinkedIn |
| [`references/platforms/x-articles.md`](references/platforms/x-articles.md) | Write or edit a long-form X Article (standalone platform) |

---

## 1. Choose a social set

A "social set" is what users call an "account" — the connected platforms for one identity. Most commands work without a `social_set_id` once a default is configured. Pass it positionally (`drafts:list 123`) or as `--social-set-id 123`.

To decide which social set to use:

1. Run `config:show`. If `default_social_set` is set, the CLI uses it automatically — proceed.
2. Otherwise run `social-sets:list`. If only one exists, use it.
3. If multiple exist with no default, ask the user, then offer to save it: `config:set-default`.
4. Reuse a social set already resolved earlier in the session without asking again.

---

## 2. Create drafts

```bash
./scripts/typefully.js drafts:create --text "Your post"
```

- If `--platform` is omitted, the first connected platform is auto-selected. Named platforms: `x`, `linkedin`, `threads`, `bluesky`, `mastodon`, `x_article`.
- Split a thread with `---` on its own line.
- Attach media with `--media`, tags with `--tags`, internal notes with `--scratchpad`, an internal name with `--title`.
- Read content from a file with `--file ./post.txt` instead of `--text`.

### One draft per post — always

For the same content on several platforms, pass multiple platforms to a **single** draft:

```bash
./scripts/typefully.js drafts:create --platform x,linkedin --text "Big announcement!"
./scripts/typefully.js drafts:create --all --text "Posting everywhere!"   # all connected platforms
```

When content should differ per platform (e.g. an X thread plus a tailored LinkedIn post), **still use one draft** — create with the first platform, then `drafts:update` to add another with different content:

```bash
./scripts/typefully.js drafts:create --platform linkedin --text "Excited to share..."   # -> id draft-123
./scripts/typefully.js drafts:update draft-123 --platform x --text "🧵 Thread time!" --use-default
```

Never create multiple drafts unless the user explicitly wants separate drafts per platform.

> `--all` excludes `x_article`. X Articles are standalone and cannot be combined with any other platform — see [`references/platforms/x-articles.md`](references/platforms/x-articles.md).

### Scratchpad notes

When the user asks to add notes, ideas, or context to a draft, use `--scratchpad` — **do NOT write to local files.** Scratchpad notes attach to the draft in Typefully, are visible in the UI, stay private, and are never published.

```bash
./scripts/typefully.js drafts:create --text "My post" --scratchpad "Ideas: 1) Add stats 2) Include quote"
```

---

## 3. Schedule & publish

```bash
./scripts/typefully.js drafts:create --text "..." --schedule next-free-slot   # or an ISO time, or "now"
./scripts/typefully.js drafts:schedule <draft_id> --time next-free-slot --use-default
./scripts/typefully.js drafts:publish <draft_id> --use-default
```

- `next-free-slot` lets Typefully pick the optimal time.
- **Publishing is irreversible and public** — unless the user says "publish now" / "post immediately", confirm first. Creating a draft is safe.
- Single-arg commands require `--use-default` when a default social set is configured (see the [safety note](#commands) below).

---

## Common actions

| User says... | Action |
|--------------|--------|
| "Draft a tweet about X" | `drafts:create --text "..."` |
| "Post this to LinkedIn" | `drafts:create --platform linkedin --text "..."` |
| "Post to X and LinkedIn" (same content) | `drafts:create --platform x,linkedin --text "..."` |
| "X thread + tailored LinkedIn post" | One draft, then `drafts:update` to add the platform |
| "What's scheduled?" / "Recent posts?" | `drafts:list --status scheduled` / `--status published` |
| "Schedule this for tomorrow" | `drafts:create --text "..." --schedule "<ISO time>"` |
| "Post this now" | `drafts:create --text "..." --schedule now` or `drafts:publish <id> --use-default` |
| "Check available tags" | `tags:list` |
| "Check my publishing quota" | `social-sets:get` → `publishing_quota` |
| "Draft an X Article" | See [`references/platforms/x-articles.md`](references/platforms/x-articles.md) |
| "Mention a company on LinkedIn" | See [`references/platforms/linkedin.md`](references/platforms/linkedin.md) |
| "Show my X analytics / followers" | See [`references/platforms/x.md`](references/platforms/x.md) |
| "Comment on / resolve a comment" | See [`references/comments.md`](references/comments.md) |

---

## Commands

All commands output JSON. Every `[social_set_id]` is optional and falls back to the configured default.

> **Safety note**: `drafts:get`, `drafts:update`, `drafts:delete`, `drafts:schedule`, and `drafts:publish` require `--use-default` when you pass a single argument (the draft_id) while a default social set is configured.

Platform- and workflow-specific commands live in their guides: [`platforms/x.md`](references/platforms/x.md) (analytics, quotes, replies, communities, disclosures), [`platforms/linkedin.md`](references/platforms/linkedin.md) (mentions), [`platforms/x-articles.md`](references/platforms/x-articles.md), [`comments.md`](references/comments.md), and [`setup.md`](references/setup.md).

### User & social sets

| Command | Description |
|---------|-------------|
| `me:get` | Get authenticated user info |
| `social-sets:list` | List all social sets you can access |
| `social-sets:get <id>` | Social set details including connected platforms and `publishing_quota` |

`social-sets:get` returns a `publishing_quota` object when available: `used`, `remaining` (or `"unlimited"`), and `resets_at`. Check it before publishing/scheduling when the user asks about capacity or when a publish/schedule fails with quota copy.

### Drafts

Every draft command accepts an optional leading `[social_set_id]` that falls back to the configured default. The four base commands:

| Command | Description |
|---------|-------------|
| `drafts:list [social_set_id]` | List drafts. Filter with `--status scheduled\|published\|...`, order with `--sort` |
| `drafts:get [social_set_id] <draft_id>` | Get a draft with full content. Add `--exclude-comment-markers` to render `posts[*].text` without comment anchors (display only) |
| `drafts:create [social_set_id] --text "<post text>"` | Create a draft (auto-selects platform if `--platform` omitted) |
| `drafts:update [social_set_id] <draft_id> --text "<post text>"` | Replace a draft's content |

Add any of these flags to a `drafts:create` or `drafts:update` command. The **Applies to** column shows where each is valid:

| Flag | Effect | Applies to |
|------|--------|-----------|
| `--platform x,linkedin` | Target specific platform(s), comma-separated | create, update |
| `--all` | All connected platforms (excludes `x_article`) | create |
| `--file <path>` | Read content from a file instead of `--text` | create, update |
| `--append --text "<text>"` | Append to an existing thread | update |
| `--media <media_ids>` | Attach media (comma-separated) | create, update |
| `--tags "tag1,tag2"` | Set tags (content stays unchanged if this is the only change on update) | create, update |
| `--title "<internal title>"` | Internal draft title (not posted) | create, update |
| `--scratchpad "<notes>"` | Attach internal notes (see [Scratchpad notes](#scratchpad-notes)) | create, update |
| `--share` | Generate a public share URL | create, update |
| `--schedule <iso\|next-free-slot\|now>` | Schedule or reschedule the draft | create, update |
| `--exclude-comment-markers` | Render response without anchors (display only; validation still applies) | update |
| `--force-overwrite-comments` | Destructive last resort — see [`comments.md`](references/comments.md) | update |

For example, combine the base command with flags like this:

```bash
./scripts/typefully.js drafts:create --text "Launch day!" --platform x,linkedin --tags product --schedule next-free-slot
./scripts/typefully.js drafts:update 456 --text "Revised copy" --media abc-123 --use-default
```

> X-only draft flags (`--reply-to`, `--quote-post-url`, `--community`, `--paid-partnership`, `--made-with-ai`): see [`platforms/x.md`](references/platforms/x.md). X Article flags (`--content-markdown`, `--cover-media-id`): see [`platforms/x-articles.md`](references/platforms/x-articles.md).

### Scheduling & publishing

Single-arg forms require `--use-default` when a default social set is configured.

| Command | Description |
|---------|-------------|
| `drafts:schedule <social_set_id> <draft_id> --time <iso\|next-free-slot>` | Schedule to a time or the next available slot |
| `drafts:publish <social_set_id> <draft_id>` | Publish immediately |
| `drafts:delete <social_set_id> <draft_id>` | Delete a draft |

### Queue

The queue is a **social-set-specific timeline**: free queue slots (from the social set's queue schedule) plus scheduled drafts/posts for that same social set. Use `queue:get` when the user asks what is scheduled or free for an account in a date range.

| Command | Description |
|---------|-------------|
| `queue:get [social_set_id] --start-date <YYYY-MM-DD> --end-date <YYYY-MM-DD>` | Queue timeline: free slots + scheduled drafts/posts in a date range |
| `queue:schedule:get [social_set_id]` | Get queue schedule rules |
| `queue:schedule:put [social_set_id] --rules '[{"h":9,"m":30,"days":["mon","wed","fri"]}]'` | Replace queue schedule rules (full replacement) |

Snake-case date aliases (`--start_date`, `--end_date`) are accepted.

### Tags

Tags are scoped per social set — a tag in one social set doesn't appear in another. Check existing tags before creating.

| Command | Description |
|---------|-------------|
| `tags:list [social_set_id]` | List all tags |
| `tags:create [social_set_id] --name "Tag Name"` | Create a new tag |

### Media

| Command | Description |
|---------|-------------|
| `media:upload [social_set_id] <file_path>` | Upload media, wait for processing, return ready `media_id` |
| `media:upload ... --no-wait` | Upload and return immediately (poll with `media:status`) |
| `media:upload ... --timeout <seconds>` | Custom processing timeout (default 60) |
| `media:status [social_set_id] <media_id>` | Check upload status |

### Examples

```bash
# Create a tweet (default social set)
./scripts/typefully.js drafts:create --text "Hello, world!"

# Explicit social_set_id
./scripts/typefully.js drafts:create 123 --text "Hello, world!"

# Cross-platform, same content
./scripts/typefully.js drafts:create --platform x,linkedin,threads --text "Big announcement!"
./scripts/typefully.js drafts:create --all --text "Posting everywhere!"

# Create and schedule for the next slot
./scripts/typefully.js drafts:create --text "Scheduled post" --schedule next-free-slot

# Create with tags
./scripts/typefully.js drafts:create --text "Marketing post" --tags marketing,product

# List scheduled posts, newest scheduled first
./scripts/typefully.js drafts:list --status scheduled --sort scheduled_date

# Queue view for a date range
./scripts/typefully.js queue:get --start-date 2026-02-01 --end-date 2026-02-29

# Replace queue schedule rules
./scripts/typefully.js queue:schedule:put --rules '[{"h":9,"m":30,"days":["mon","wed","fri"]}]'

# Draft with scratchpad notes
./scripts/typefully.js drafts:create --text "Launching next week!" --scratchpad "Coordinate with marketing before publishing."

# Upload media, then attach it
./scripts/typefully.js media:upload ./image.jpg          # -> {"media_id": "abc-123", "status": "ready"}
./scripts/typefully.js drafts:create --text "Check out this image!" --media abc-123

# Add media to an existing draft
./scripts/typefully.js drafts:update 456 --text "Updated post with image" --media xyz --use-default
```

---

## Reference

### Character limits

X 280 · LinkedIn 3000 · Threads 500 · Bluesky 300 · Mastodon 500.

### Draft URLs

Typefully draft URLs encode the social set and draft IDs: `https://typefully.com/?a=<social_set_id>&d=<draft_id>` (e.g. `a=12345` → social_set_id, `d=67890` → draft_id).

### Automation guidelines

To keep accounts in good standing, especially on X:

- No duplicate content across accounts.
- No unsolicited automated replies — only reply when the user explicitly requests it.
- No trending manipulation, no fake engagement (likes/reposts/follows).
- Respect rate limits; drafts stay private until published or explicitly shared.

When in doubt, create drafts for user review rather than publishing directly.
