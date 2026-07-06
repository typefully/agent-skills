# X Articles

Use this guide when creating, updating, scheduling, publishing, or commenting on X Article drafts through the Typefully CLI.

## Core Rules

- Always use `--platform x_article`.
- `x_article` is standalone. Do not combine it with `x`, LinkedIn, Threads, Bluesky, Mastodon, or `--all`.
- Use `--content-markdown <markdown>` for article content.
- Use `--cover-media-id <media_id>` to set a cover image.
- Use `--cover-media-id null` on update to remove a cover image.
- Do not use post-only flags with X Articles: `--text`, `--file`, `--media`, `--append`, `--reply-to`, `--community`, `--quote-post-url`, `--paid-partnership`, or `--made-with-ai`.

## Markdown Format

`content_markdown` is canonical X Article Markdown. Typefully validates and normalizes it server-side.

Required structure:

- The first non-empty block must be `# Title`; that heading sets the article title.
- Later blocks are the body.

Supported body blocks:

- Paragraphs
- Blockquotes
- Ordered lists
- Unordered lists
- `#` and `##` body headings
- Bold
- Italic
- Strikethrough
- Links

Supported block-only embeds, each alone on its own line:

```md
<typ:media media_id="550e8400-e29b-41d4-a716-446655440000" />
```

```md
<typ:x-post url="https://x.com/user/status/1234567890" />
```

Comprehensive supported markdown example:

```md
# Shipping Better Drafts

Great articles start with a clear promise, then use structure to make the idea easy to scan.

# Why structure matters

Use body headings when the piece shifts to a new major section. A paragraph can include **bold emphasis**, *italic emphasis*, ~~strikethrough edits~~, and [helpful links](https://typefully.com).

> A good article gives readers a path through the argument, not just a pile of notes.

## A practical checklist

- Lead with the core idea
- Support it with context
- Add examples only where they clarify the point

## Publishing sequence

1. Draft the title
2. Shape the main sections
3. Review the final flow

<typ:media media_id="550e8400-e29b-41d4-a716-446655440000" />

<typ:x-post url="https://x.com/user/status/1234567890" />

End with a concise takeaway that tells readers what to do next.
```

Comment anchors round-trip in article markdown:

```md
Inline <typ:comment-thread id="thread-id">selected text</typ:comment-thread> keeps the comment anchored.

<typ:comment-thread id="thread-id" />
Paragraph-level comments use a block marker before the commented block.
```

## Create Payloads

Minimal article draft:

```bash
ARTICLE_MARKDOWN='# Article Title

Long-form article body.'

./scripts/typefully.js drafts:create 123 \
  --platform x_article \
  --content-markdown "$ARTICLE_MARKDOWN"
```

API payload shape:

```json
{
  "platforms": {
    "x_article": {
      "content_markdown": "# Article Title\n\nLong-form article body."
    }
  }
}
```

Article draft with cover, title, tags, scratchpad, and sharing:

```bash
ARTICLE_MARKDOWN='# Product Notes

What changed, why it matters, and what comes next.'

./scripts/typefully.js drafts:create 123 \
  --platform x_article \
  --content-markdown "$ARTICLE_MARKDOWN" \
  --cover-media-id 550e8400-e29b-41d4-a716-446655440000 \
  --title "Product notes article" \
  --tags product,launch \
  --scratchpad "Review with product before scheduling." \
  --share
```

API payload shape:

```json
{
  "platforms": {
    "x_article": {
      "content_markdown": "# Product Notes\n\nWhat changed, why it matters, and what comes next.",
      "cover_media_id": "550e8400-e29b-41d4-a716-446655440000"
    }
  },
  "draft_title": "Product notes article",
  "tags": ["product", "launch"],
  "scratchpad_text": "Review with product before scheduling.",
  "share": true
}
```

Create and schedule:

```bash
./scripts/typefully.js drafts:create 123 \
  --platform x_article \
  --content-markdown "$ARTICLE_MARKDOWN" \
  --schedule "2026-07-20T14:00:00Z"
```

Immediate publish:

```bash
./scripts/typefully.js drafts:create 123 \
  --platform x_article \
  --content-markdown "$ARTICLE_MARKDOWN" \
  --schedule now
```

## Update Payloads

Update article markdown only:

```bash
./scripts/typefully.js drafts:update 123 456 \
  --platform x_article \
  --content-markdown "$ARTICLE_MARKDOWN"
```

API payload shape:

```json
{
  "platforms": {
    "x_article": {
      "content_markdown": "# Article Title\n\nUpdated body."
    }
  }
}
```

Set or replace cover:

```bash
./scripts/typefully.js drafts:update 123 456 \
  --platform x_article \
  --cover-media-id 550e8400-e29b-41d4-a716-446655440000
```

API payload shape:

```json
{
  "platforms": {
    "x_article": {
      "cover_media_id": "550e8400-e29b-41d4-a716-446655440000"
    }
  }
}
```

Remove cover:

```bash
./scripts/typefully.js drafts:update 123 456 \
  --platform x_article \
  --cover-media-id null
```

API payload shape:

```json
{
  "platforms": {
    "x_article": {
      "cover_media_id": null
    }
  }
}
```

Update content and cover together:

```bash
./scripts/typefully.js drafts:update 123 456 \
  --platform x_article \
  --content-markdown "$ARTICLE_MARKDOWN" \
  --cover-media-id 550e8400-e29b-41d4-a716-446655440000
```

Schedule or publish an existing article draft through the normal draft commands:

```bash
./scripts/typefully.js drafts:schedule 123 456 --time next-free-slot
./scripts/typefully.js drafts:publish 123 456
```

## Comments

Create article comments against visible article text, not markdown syntax or embed tags:

```bash
./scripts/typefully.js comments:create 456 \
  --social-set-id 123 \
  --platform x_article \
  --selected-text "article phrase" \
  --text "Clarify this section."
```

If the selected text appears multiple times, pass zero-based `--occurrence`:

```bash
./scripts/typefully.js comments:create 456 \
  --social-set-id 123 \
  --platform x_article \
  --selected-text "repeated phrase" \
  --occurrence 1 \
  --text "This second occurrence needs context."
```

Omit `--post-index` for X Article comments. If it is supplied, it must be `0`; the CLI omits it from the API request.

When editing article drafts that already have comments:

- Fetch the draft without `--exclude-comment-markers`.
- Preserve every `<typ:comment-thread>` anchor in `content_markdown`.
- Patch with `drafts:update --platform x_article --content-markdown ...`.
- Use `--force-overwrite-comments` only after explicit user confirmation, because missing anchors are resolved and stripped server-side.

## Media

Use `media:upload` first for cover images or embedded media:

```bash
./scripts/typefully.js media:upload 123 ./cover.png
```

Then use the returned ready `media_id` either as:

- `--cover-media-id <media_id>` for the article cover.
- `<typ:media media_id="..." />` inside `content_markdown` for an embedded media block.

Cover images must be ready, account-owned static images.
