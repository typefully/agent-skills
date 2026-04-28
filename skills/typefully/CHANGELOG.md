# Changelog (Typefully Skill)

All notable user-facing changes to the Typefully skill and its CLI are documented here.

The format is based on Keep a Changelog.

## [Unreleased]

### Added

- `drafts:create` and `drafts:update` now support LinkedIn reshares/reposts with `--linkedin-reshare-target <url_or_urn>`.
- LinkedIn reshare aliases: `--linkedin_reshare_target`, `--linkedin-reshare-url`, `--linkedin-repost-url`, `--reshare-url`, and `--repost-url`.
- Skill docs now explain LinkedIn reshare/repost workflows, including plain reshares without commentary.
- `analytics:posts:list` now supports `--include-replies` (alias: `--include_replies`) to opt in to X reply posts.

### Changed

- `analytics:posts:list` now matches the backend analytics default: replies are excluded unless you explicitly pass `--include-replies`.
- Analytics docs and examples now explain the non-reply default and the explicit reply-inclusion workflow.

## [2026-03-17]

### Added

- `analytics:posts:list [social_set_id] --start-date <YYYY-MM-DD> --end-date <YYYY-MM-DD>` to fetch X post analytics for an inclusive date range.
- `analytics:posts:list` supports `--limit` / `--offset` pagination and `--start_date` / `--end_date` aliases.
- Typefully skill docs now cover the X analytics workflow, command reference, examples, and metrics returned by the API.

### Changed

- `analytics:posts:list` now defaults `--platform` to `x` and returns a clear CLI error if another platform is requested, matching current API support.

## [2026-02-26]

### Added

- `--quote-post-url <url>` (alias: `--quote-url`) for:
  - `drafts:create`
  - `drafts:update`
- X quote-post payload support in draft create/update (`platforms.x.posts[].quote_post_url`).
- CLI help/usage examples for creating and updating quote posts on X.
- LinkedIn mention resolver command:
  - `linkedin:organizations:resolve [social_set_id] --organization-url <linkedin_company_or_school_url>`
  - Also accepts `--organization_url` and `--url` aliases.
  - Returns mention metadata including `mention_text` (for example `@[Typefully](urn:li:organization:86779668)`).
- LinkedIn mention workflow documentation in `SKILL.md`, including mention syntax and resolver-to-draft examples.

### Changed

- Quote URLs are now pre-validated as X-only in the CLI:
  - clear client-side error when quote flags are used without targeting X.
  - unchanged behavior for non-quote draft create/update flows.
- API `400 VALIDATION_ERROR` responses are surfaced as explicit validation messages in CLI output.

## [2026-02-19]

### Added

- Queue commands:
  - `queue:get [social_set_id] --start-date <YYYY-MM-DD> --end-date <YYYY-MM-DD>`
  - `queue:schedule:get [social_set_id]`
  - `queue:schedule:put [social_set_id] --rules '<json-array>'`
- `queue:get` accepts both kebab-case and snake_case date flags (`--start-date/--end-date` and `--start_date/--end_date`).
- LinkedIn mention resolver command:
  - `linkedin:organizations:resolve [social_set_id] --organization-url <linkedin_company_or_school_url>`
  - Also accepts `--organization_url` and `--url` aliases.
  - Returns mention metadata including `mention_text` (for example `@[Typefully](urn:li:organization:86779668)`).
- LinkedIn mention workflow documentation in `SKILL.md`, including mention syntax and resolver-to-draft examples.

### Fixed

- Queue command validation now returns clear CLI errors for missing required date flags and invalid `--rules` JSON input.
- Clarified queue docs in `SKILL.md` to explain that queue data is scoped per social set and includes that social set's scheduled drafts/posts.

## [2026-02-10]

### Added

- `create-draft` and `update-draft` alias commands to create/update drafts with simpler arguments.
- `--tags` support for `drafts:update` (tag-only updates keep existing draft content unchanged).
- `--social-set-id` / `--social_set_id` flag support as an alternative to positional `social_set_id` for commands that take a social set.

### Fixed

- `update-draft` no longer overwrites draft content when you run it with only flags (for example, adding tags).
- Clear CLI errors when a value-taking flag is provided without a value (instead of crashing).
- Thread splitting on `---` now works with both LF and CRLF line endings.
