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
- **Authentication**: Uses `TYPEFULLY_API_KEY` from environment, local `.env`, or `~/.config/typefully/.env`
- **API Base**: `https://api.typefully.com/v2`

Key commands: `me:get`, `social-sets:list`, `social-sets:get`, `drafts:list`, `drafts:get`, `drafts:create`, `drafts:update`, `drafts:delete`, `drafts:schedule`, `drafts:publish`, `tags:list`, `tags:create`, `media:upload`, `media:status`, `config:set-key`, `config:show`

All commands output JSON.

## Testing the CLI

```bash
export TYPEFULLY_API_KEY=your_key
./skills/typefully/scripts/typefully.js social-sets:list
./skills/typefully/scripts/typefully.js drafts:create <social_set_id> --text "Test post"
```

## Installation Methods

Skills can be installed via:

1. CLI: `npx skills add typefully/agent-skills`
2. Claude Code plugin: `/plugin marketplace add typefully/agent-skills`
3. Cursor: Add as remote GitHub rule
4. Manual: Copy `skills/typefully/` to `.cursor/skills/` or `.claude/skills/`

## Commit & Pull Request Guidelines

- NEVER add "Co-authored with Claude" or that kind of AI-assistant plugin to commit messages or PR descriptions.
