# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This repository contains AI agent skills for Typefully - markdown files that give AI agents specialized workflows for drafting, scheduling, and managing social media posts across X, LinkedIn, Threads, Bluesky, and Mastodon.

## Repository Structure

- `skills/typefully/SKILL.md` - The main skill definition file with frontmatter metadata and usage instructions
- `skills/typefully/scripts/typefully.js` - JavaScript CLI for the Typefully API v2 (zero dependencies, Node.js 18+)
- `.claude-plugin/marketplace.json` - Claude Code plugin marketplace configuration

## The Skill System

Skills are markdown files with YAML frontmatter that define:

- `name` - Skill identifier
- `description` - What the skill does
- `allowed-tools` - Tools the skill can use (e.g., `Bash(./scripts/typefully.js:*)`)

The SKILL.md file documents the workflow and commands that AI agents should follow when using the skill.

## CLI Script

The `typefully.js` script is a self-contained JavaScript CLI that wraps the Typefully API:

- **Requirements**: Node.js 18+ (for built-in fetch API)
- **Dependencies**: None (uses only Node.js built-in modules)
- **Authentication**: Priority order:
  1. `TYPEFULLY_API_KEY` environment variable
  2. `./.typefully/config.json` (project-local)
  3. `~/.config/typefully/config.json` (user-global)
- **API Base**: `https://api.typefully.com/v2`

Key commands: `setup`, `me:get`, `social-sets:list`, `social-sets:get`, `drafts:list`, `drafts:get`, `drafts:create`, `drafts:update`, `drafts:delete`, `drafts:schedule`, `drafts:publish`, `tags:list`, `tags:create`, `media:upload`, `media:status`, `config:show`

All commands output JSON.

## Testing the CLI

```bash
# Interactive setup (recommended)
./skills/typefully/scripts/typefully.js setup

# Or use environment variable
export TYPEFULLY_API_KEY=your_key

# Test commands
./skills/typefully/scripts/typefully.js social-sets:list
./skills/typefully/scripts/typefully.js drafts:create <social_set_id> --text "Test post"
```

## Installation Methods

Skills can be installed via:

1. CLI: `npx skills add typefully/agent-skills`
2. Claude Code plugin: `/plugin marketplace add typefully/agent-skills`
3. Cursor: Add as remote GitHub rule
4. Manual: Copy `skills/typefully/` to `.cursor/skills/` or `.claude/skills/`

## Updating the Skill

When making changes to the CLI (`typefully.js`) or the skill definition (`SKILL.md`), always update the `last-updated` date in the SKILL.md frontmatter to the current date. This date is used for freshness checks to warn users if the skill may be outdated.

## Commit & Pull Request Guidelines

- NEVER add "Co-authored with Claude" or that kind of AI-assistant plugin to commit messages or PR descriptions.
