# Changelog (Typefully Skill)

All notable user-facing changes to the Typefully skill and its CLI are documented here.

The format is based on Keep a Changelog.

## [Unreleased]

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
