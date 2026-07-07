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
