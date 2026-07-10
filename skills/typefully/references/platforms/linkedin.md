# LinkedIn

> Script paths are relative to the skill root (where `SKILL.md` lives). Character limit: 3000.

## Mentions

LinkedIn mentions use text syntax inside post content:

```text
@[Company Name](urn:li:organization:123456)
```

Resolve a public LinkedIn organization/school URL into ready-to-paste mention syntax with `linkedin:organizations:resolve`:

```bash
./scripts/typefully.js linkedin:organizations:resolve --organization-url "https://www.linkedin.com/company/typefullycom/"
# Returns mention_text like: @[Typefully](urn:li:organization:86779668)
```

Then include the returned `mention_text` in the draft:

```bash
./scripts/typefully.js drafts:create --platform linkedin --text "Thanks @[Typefully](urn:li:organization:86779668) for the support."
```

`linkedin:organizations:resolve [social_set_id] --organization-url <url>` returns `mention_text` and `urn`.

> When commenting on text that contains a mention, select the entire `@[Name](urn:li:...)` substring or stay fully outside it.

## First comment

Post a comment right after the LinkedIn post is published — the common "link in the first comment" pattern:

```bash
./scripts/typefully.js drafts:create --platform linkedin --text "Big launch today!" --linkedin-first-comment "Full details: https://example.com/launch"
```

On `drafts:update`, the flag sets or replaces the comment; a literal `null` removes it; omitting the flag keeps the current comment:

```bash
./scripts/typefully.js drafts:update 123 d456 --linkedin-first-comment "Link here: https://example.com"
./scripts/typefully.js drafts:update 123 d456 --linkedin-first-comment null
```

- Plain text only: newlines are preserved and LinkedIn renders URLs as links, but mention syntax is **not** supported inside comments.
- Aliases: `--linkedin_first_comment`, `--first-comment`, `--first_comment`.
- Draft responses expose it as `platforms.linkedin.settings.first_comment`.
