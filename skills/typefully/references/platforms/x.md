# X (Twitter)

> Script paths are relative to the skill root (where `SKILL.md` lives). All `[social_set_id]` args fall back to the configured default when omitted. Character limit: 280 per post; split threads with `---` on its own line.

X-only features: analytics, quote posts, replies, communities, and content-disclosure labels. These flags apply only to X posts, even in a multi-platform draft.

## Analytics

The public API supports **X analytics only**. The CLI defaults `--platform` to `x`, so you can usually omit it. Replies are **excluded by default**; add `--include-replies` to include them.

Post analytics return per-post metrics for an inclusive date range: `impressions` plus engagement totals/breakdowns (`likes`, `comments`, `shares`, `quotes`, `saves`, `profile_clicks`, `link_clicks`). Follower analytics return `current_followers_count` plus daily `data` points (`date`, `followers_count`); omit dates for the API default range.

| Command | Description |
|---------|-------------|
| `analytics:posts:list [social_set_id] --start-date <YYYY-MM-DD> --end-date <YYYY-MM-DD>` | X posts with normalized metrics for an inclusive date range |
| `analytics:posts:list ... --include-replies` | Include X replies (excluded by default) |
| `analytics:posts:list ... --limit 100 --offset 25` | Paginate |
| `analytics:followers:get [social_set_id]` | X follower counts for the API default range |
| `analytics:followers:get ... --start-date <YYYY-MM-DD> --end-date <YYYY-MM-DD>` | X follower counts for an inclusive date range |

Snake-case date aliases (`--start_date`, `--end_date`, `--include_replies`) and explicit `--platform x` are also accepted.

```bash
./scripts/typefully.js analytics:posts:list --start-date 2026-03-01 --end-date 2026-03-07
./scripts/typefully.js analytics:posts:list --start-date 2026-03-01 --end-date 2026-03-07 --include-replies
./scripts/typefully.js analytics:posts:list --start-date 2026-03-01 --end-date 2026-03-31 --limit 100 --offset 100
./scripts/typefully.js analytics:followers:get --start-date 2026-03-01 --end-date 2026-03-31
```

## Replies, quotes, and communities

| Flag | Purpose |
|------|---------|
| `--reply-to <url>` | Reply to an existing X post |
| `--quote-post-url <url>` | Quote an existing X post (on `drafts:create` or `drafts:update`) |
| `--community <id>` | Post to an X community |

```bash
./scripts/typefully.js drafts:create --platform x --text "Great thread!" --reply-to "https://x.com/user/status/123456"
./scripts/typefully.js drafts:create --platform x --text "My take on this" --quote-post-url "https://x.com/user/status/1234567890123456789"
./scripts/typefully.js drafts:create --platform x --text "Community update" --community 1493446837214187523
./scripts/typefully.js drafts:update 456 --platform x --quote-post-url "https://x.com/user/status/1234567890123456789" --use-default
```

## Content disclosure labels

`--paid-partnership` and `--made-with-ai` are X-only and apply only to X posts. Usable on `drafts:create` and `drafts:update`.

```bash
./scripts/typefully.js drafts:create --platform x --text "Sponsored AI-assisted update" --paid-partnership --made-with-ai
./scripts/typefully.js drafts:update 456 --made-with-ai --use-default
```
