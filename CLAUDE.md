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

- **Dependencies**: `curl`, `jq`, and `perl`
- **Authentication**: Requires `TYPEFULLY_API_KEY` environment variable
- **API Base**: `https://api.typefully.com/v2`

### Commands

#### User & Account Info
| Command | Description |
|---------|-------------|
| `me` | Get authenticated user info |
| `social-sets` | List all social sets (accounts) |
| `social-set <id>` | Get social set details with connected platforms |

#### Drafts
| Command | Description |
|---------|-------------|
| `draft:list <social_set_id>` | List drafts |
| `draft:get <social_set_id> <draft_id>` | Get a specific draft |
| `draft:create <social_set_id>` | Create a new draft |
| `draft:update <social_set_id> <draft_id>` | Update an existing draft |
| `draft:delete <social_set_id> <draft_id>` | Delete a draft |

#### Scheduling & Publishing
| Command | Description |
|---------|-------------|
| `schedule <social_set_id> <draft_id>` | Schedule a draft for later |
| `publish <social_set_id> <draft_id>` | Publish immediately |

#### Tags
| Command | Description |
|---------|-------------|
| `tag:list <social_set_id>` | List all tags |
| `tag:create <social_set_id>` | Create a new tag |

#### Media
| Command | Description |
|---------|-------------|
| `media:upload <social_set_id> <file>` | Upload image/video, returns media_id |
| `media:status <social_set_id> <media_id>` | Check if media is processed |

All commands output JSON. The script uses strict mode (`set -euo pipefail`).

## Testing the CLI

```bash
export TYPEFULLY_API_KEY=your_key
./skills/typefully/scripts/typefully.sh social-sets
./skills/typefully/scripts/typefully.sh draft:create <social_set_id> --platform x --text "Test post"
```

## Installation Methods

Skills can be installed via:

1. CLI: `npx skills add typefully/agent-skills`
2. Claude Code plugin: `/plugin marketplace add typefully/agent-skills`
3. Cursor: Add as remote GitHub rule
4. Manual: Copy `skills/typefully/` to `.cursor/skills/` or `.claude/skills/`

## Commit & Pull Request Guidelines

- NEVER add "Co-authored with Claude" or that kind of AI-assistant plugin to commit messages or PR descriptions.
