# Changelog (Typefully Skill)

All notable user-facing changes to the Typefully skill and its CLI are documented here.

The format is based on Keep a Changelog.

## [Unreleased]

## [2026-02-10]

### Added

- `create-draft` and `update-draft` alias commands to create/update drafts with simpler arguments.
- `--tags` support for `drafts:update` (tag-only updates keep existing draft content unchanged).
- `--social-set-id` / `--social_set_id` flag support as an alternative to positional `social_set_id` for commands that take a social set.

### Fixed

- `update-draft` no longer overwrites draft content when you run it with only flags (for example, adding tags).
- Clear CLI errors when a value-taking flag is provided without a value (instead of crashing).
- Thread splitting on `---` now works with both LF and CRLF line endings.
