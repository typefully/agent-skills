# Quote posts

> Script paths are relative to the skill root (where `SKILL.md` lives). All `[social_set_id]` args fall back to the configured default when omitted.

`--quote-post-url <url>` (alias `--quote-url`) on `drafts:create` or `drafts:update` turns a post into a native quote of another post, or a restack on Substack. The URL decides the platform, and the draft must include it: in a multi-platform draft, only that platform quotes, and the others publish without the quote. The quote goes on the first post of a thread, or on the new post with `--append`.

| Platform | Quote URL | Limits |
|----------|-----------|--------|
| X | `x.com` / `twitter.com` URL with `/status/<id>` | |
| Threads | `threads.net` / `threads.com` post URL | Only the connected account's own posts, for now |
| Bluesky | `bsky.app/profile/<handle>/post/<rkey>` | The author must allow quotes |
| Mastodon | A status URL on any instance | Your server must support quotes and be able to see the post |
| Substack | A note (`/note/c-<id>`) or post (`/p/<slug>`) URL, on any publication domain | Restack; Substack Notes take a single post |

LinkedIn has no quote. Mastodon is federated, so a URL from any other host counts as a Mastodon status when the draft includes Mastodon; otherwise it goes to the draft's only quote-capable platform.

Typefully looks up every non-X quote when the draft is saved, so a post it can't find or can't quote fails the command with a `VALIDATION_ERROR` explaining why.

```bash
./scripts/typefully.js drafts:create --platform x --text "My take on this" --quote-post-url "https://x.com/user/status/1234567890123456789"
./scripts/typefully.js drafts:create --platform bluesky,threads --text "Worth a read" --quote-post-url "https://bsky.app/profile/user.bsky.social/post/3kabc123"
./scripts/typefully.js drafts:update 456 --quote-post-url "https://mastodon.social/@user/113456789012345678" --use-default   # add a quote, keep the text
```

Replacing a draft's text with `--text` drops its quotes, because the API replaces posts wholesale: pass `--quote-post-url` again to keep one. `--append`, `--hide-link-preview`, and `--paid-partnership`/`--made-with-ai` keep existing quotes.
