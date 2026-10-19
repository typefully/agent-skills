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

A first comment is a comment Typefully posts from the user's LinkedIn account on the post right after it publishes. Use it for links or extra context the user wants under the post rather than in it. It is separate from draft review comments in [`comments.md`](../comments.md).

Set it with `--linkedin-first-comment` on `drafts:create` or `drafts:update`. The draft must target LinkedIn. The comment holds at most 1250 characters.

```bash
./scripts/typefully.js drafts:create --platform linkedin,x --text "We just shipped dark mode." --linkedin-first-comment "Full changelog: https://example.com/changelog"
./scripts/typefully.js drafts:update 456 --linkedin-first-comment "Updated link: https://example.com/v2" --use-default
./scripts/typefully.js drafts:update 456 --linkedin-first-comment null --use-default
```

- On `drafts:update`, the flag works alone and keeps the LinkedIn post text as it is. `null` or `""` removes the comment.
- Updates that omit the flag keep the existing first comment, including `--text` replacements.
- `drafts:get` shows the current comment at `platforms.linkedin.settings.first_comment`.
- A `MONETIZATION_ERROR` saying "You need to upgrade to use LinkedIn first comments" means the account's plan lacks the feature, as on a paused account. Tell the user instead of retrying.
