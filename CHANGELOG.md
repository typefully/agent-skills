# Changelog

All notable changes to this repository will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased] - 2026-02-10

### Added

- `create-draft` and `update-draft` alias commands for more ergonomic draft creation/updates.
- Hermetic CLI test suite using Node's built-in `node:test` (mock HTTP server + isolated temp HOME/cwd).
- GitHub Actions CI workflow running tests on Node 18.x, 20.x, and 22.x.
- `TYPEFULLY_API_BASE` environment variable to override the API base URL (useful for tests/mocks).
- `TYPEFULLY_MEDIA_POLL_INTERVAL_MS` environment variable to control media polling interval (useful for tests).

### Fixed

- Prevent `update-draft` alias from overwriting draft content when only flags are provided (e.g. `--tags` only).
- `drafts:update` now supports `--tags` for tag-only updates without modifying draft content.
- Clean CLI errors when a value-taking flag is missing its value (avoid `TypeError` crash paths).
- `config:set-default` now honors `--social-set-id` / `--social_set_id` (in addition to positional `social_set_id`).
- Thread splitting on `---` supports both LF and CRLF line endings.

### Changed

- Updated `skills/typefully/SKILL.md` docs and `last-updated` date to reflect the current CLI behavior.

