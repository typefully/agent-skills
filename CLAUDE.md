# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This repository contains AI agent skills for Typefully - markdown files that give AI agents specialized workflows for drafting, scheduling, and managing social media posts across X, LinkedIn, Threads, Bluesky, and Mastodon.

## Repository Structure

- `skills/typefully/SKILL.md` - The main skill definition file with frontmatter metadata and usage instructions
- `skills/typefully/scripts/typefully.sh` - Bash CLI wrapper for the Typefully API v2
- `.claude-plugin/marketplace.json` - Claude Code plugin marketplace configuration

## The Skill System

Skills are markdown files with YAML frontmatter that define:

- `name` - Skill identifier
- `description` - What the skill does
- `allowed-tools` - Tools the skill can use (e.g., `Bash(./scripts/typefully.sh:*)`)

The SKILL.md file documents the workflow and commands that AI agents should follow when using the skill.

## CLI Script

The `typefully.sh` script is a self-contained Bash CLI that wraps the Typefully API:

- **Dependencies**: `curl` and `jq`
- **Authentication**: Requires `TYPEFULLY_API_KEY` environment variable
- **API Base**: `https://api.typefully.com/v2`

Key commands: `me`, `accounts`, `account`, `drafts`, `draft`, `create`, `update`, `delete`, `schedule`, `publish`, `tags`, `tag:create`, `media:upload`, `media:status`

All commands output JSON. The script uses strict mode (`set -euo pipefail`).

## Testing the CLI

```bash
export TYPEFULLY_API_KEY=your_key
./skills/typefully/scripts/typefully.sh accounts
./skills/typefully/scripts/typefully.sh create <social_set_id> --platform x --text "Test post"
```

## Installation Methods

Skills can be installed via:

1. CLI: `npx skills add typefully/agent-skills`
2. Claude Code plugin: `/plugin marketplace add typefully/agent-skills`
3. Cursor: Add as remote GitHub rule
4. Manual: Copy `skills/typefully/` to `.cursor/skills/` or `.claude/skills/`

## Commit & Pull Request Guidelines

- NEVER add "Co-authored with Claude" or that kind of AI-assistant plugin to commit messages or PR descriptions.
