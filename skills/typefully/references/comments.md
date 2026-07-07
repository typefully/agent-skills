# Comments on Drafts

> Script paths are relative to the skill root (where `SKILL.md` lives). For X Article comment specifics, see `references/platforms/x-articles.md`.

Drafts can have comment threads anchored to a selected span or to a whole paragraph. `drafts:get` returns `posts[*].text` (and X Article `content_markdown`) with inline `<typ:comment-thread>` anchors by default so you can preserve them during edits.

## Core rules

1. **Preserve every comment anchor when patching draft text.** Span anchors wrap selected text; self-closing anchors at the start of a paragraph are live comments on the whole following paragraph (not empty/resolved). When rewriting, move each anchor to the most semantically equivalent span or paragraph — never silently strip or drop anchors.
2. **Do not resolve or delete comments without explicit user instruction.** After editing text that may address feedback, ask whether to resolve the specific thread(s). "Clean up" / "tidy" / "looks addressed" never means resolve or delete.
3. **Talk about comments in plain English, not marker syntax** — e.g. "comment on the word 'constraint'". Only mention marker syntax when explaining a marker-related API error or when the user asks how anchors work.

## Default edit flow

1. `drafts:get` with anchors enabled (default).
2. Rewrite while preserving/repositioning every anchor.
3. Patch with `drafts:update --text ...` (posts) or `drafts:update --platform x_article --content-markdown ...` (X Articles), without force flags.
4. Ask whether to resolve any addressed comments.

Use `comments:list <draft_id> --status all` when you need thread ids, comment bodies, authors, or resolved status. Use `drafts:get --exclude-comment-markers` only for display, LLM context, export, or preview text that will **not** be patched back.

When the user asks to accept/apply/address a comment: fetch with anchors, edit only that anchor's text (or the paragraph after a self-closing paragraph anchor), preserve every other anchor and unrelated text, then `drafts:update` without force flags. Ask before resolving. If feedback is open-ended, propose wording or ask — don't invent silently. For "accept all comments", batch only changes whose anchors can all be preserved.

## Force overwrite (destructive)

`--force-overwrite-comments` resolves and strips **every** unresolved thread whose anchor is missing from the submitted text, including unrelated threads. Default: **do not use it.** If a PATCH fails because anchors don't match, re-fetch with anchors, preserve every `<typ:comment-thread>`, and patch again without force.

Only use it when anchors truly cannot be preserved (a user-requested wholesale rewrite, or an anchor with no reasonable new location). Before using it:

1. Run `comments:list <draft_id> --status unresolved`.
2. Tell the user which threads will be resolved and stripped (selected text + top comment).
3. State that this cannot be undone via the API.
4. Wait for an explicit "yes, proceed" — do not confirm and PATCH in the same turn.

## Commands

| Command | Purpose |
|---------|---------|
| `comments:list <draft_id>` | List threads. Filters: `--platform`, `--status` (`unresolved` default / `resolved` / `all`), `--limit`, `--offset` |
| `comments:create <draft_id> --post-index <n> --selected-text "..." --text "..."` | Create a thread anchored on exact post text. Optional: `--platform`, `--occurrence` |
| `comments:create <draft_id> --platform x_article --selected-text "..." --text "..."` | Create a thread on visible X Article text; omit `--post-index` |
| `comments:reply <draft_id> <thread_id> --text "..."` | Add a reply |
| `comments:resolve <draft_id> <thread_id>` | Resolve a thread — only after explicit user confirmation |
| `comments:update <draft_id> <thread_id> <comment_id> --text "..."` | Edit a comment's text (comment-author only) |
| `comments:delete <draft_id> <thread_id> [comment_id]` | Delete a thread or one comment — only after explicit user instruction |

`comments:create` requires `selected_text` to exactly match the post text (or visible X Article text with `--platform x_article`). If it repeats, pass zero-based `--occurrence`. Pass `--platform` when the draft has multiple commentable platforms or when commenting on an X Article. For LinkedIn mentions, select the entire `@[Name](urn:li:...)` substring or stay outside it.
