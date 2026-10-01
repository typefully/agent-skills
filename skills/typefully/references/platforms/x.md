# X (Twitter)

> Script paths are relative to the skill root (where `SKILL.md` lives). All `[social_set_id]` args fall back to the configured default when omitted. Character limit: 280 per post; split threads with `---` on its own line.

X-only features: replies, communities, and content-disclosure labels. These flags apply only to X posts, even in a multi-platform draft. Quote posts work on several platforms: see [`quotes.md`](../quotes.md).

## Replies and communities

| Flag | Purpose |
|------|---------|
| `--reply-to <url>` | Reply to an existing X post |
| `--community <id>` | Post to an X community |

```bash
./scripts/typefully.js drafts:create --platform x --text "Great thread!" --reply-to "https://x.com/user/status/123456"
./scripts/typefully.js drafts:create --platform x --text "Community update" --community 1493446837214187523
```

## Content disclosure labels

`--paid-partnership` and `--made-with-ai` are X-only and apply only to X posts. Usable on `drafts:create` and `drafts:update`.

```bash
./scripts/typefully.js drafts:create --platform x --text "Sponsored AI-assisted update" --paid-partnership --made-with-ai
./scripts/typefully.js drafts:update 456 --made-with-ai --use-default
```
