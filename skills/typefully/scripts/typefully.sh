#!/bin/bash
#
# Typefully CLI - Manage social media posts via the Typefully API
# https://typefully.com/docs/api
#

set -euo pipefail

API_BASE="https://api.typefully.com/v2"

# Check for required tools
command -v curl >/dev/null 2>&1 || { echo '{"error": "curl is required but not installed"}'; exit 1; }
command -v jq >/dev/null 2>&1 || { echo '{"error": "jq is required but not installed"}'; exit 1; }
command -v perl >/dev/null 2>&1 || { echo '{"error": "perl is required but not installed"}'; exit 1; }

# Check for API key (allow help without it)
check_api_key() {
  if [[ -z "${TYPEFULLY_API_KEY:-}" ]]; then
    echo '{"error": "TYPEFULLY_API_KEY environment variable is not set. Get your key at https://typefully.com/settings/api"}'
    exit 1
  fi
}

# Helper function for API requests
api_request() {
  check_api_key
  local method="$1"
  local endpoint="$2"
  local data="${3:-}"

  local args=(
    -s
    -X "$method"
    -H "Authorization: Bearer $TYPEFULLY_API_KEY"
    -H "Content-Type: application/json"
  )

  if [[ -n "$data" ]]; then
    args+=(-d "$data")
  fi

  local response
  local http_code

  response=$(curl "${args[@]}" -w "\n%{http_code}" "$API_BASE$endpoint")
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  if [[ "$http_code" -ge 400 ]]; then
    echo "{\"error\": \"HTTP $http_code\", \"response\": $body}" | jq .
    exit 1
  fi

  echo "$body" | jq .
}

# Show help
show_help() {
  cat << 'EOF'
Typefully CLI - Manage social media posts via the Typefully API

USAGE:
  typefully.sh <command> [arguments]

COMMANDS:
  me                                    Get authenticated user info
  accounts                              List all social sets (accounts)
  account <social_set_id>                  Get account details with platforms

  drafts <social_set_id> [options]         List drafts
    --status <status>                   Filter by: draft, scheduled, published, error, publishing
    --tag <tag_slug>                    Filter by tag slug
    --limit <n>                         Max results (default: 10, max: 50)

  draft <social_set_id> <draft_id>         Get a specific draft

  create <social_set_id> [options]         Create a new draft
    --platform <platforms>              Comma-separated: x,linkedin,threads,bluesky,mastodon
    --text <text>                       Post content (use --- on its own line for threads)
    --file, -f <path>                   Read content from file instead of --text
    --title <title>                     Draft title (internal only)
    --schedule <time>                   "now", "next-free-slot", or ISO datetime
    --tags <tag_slugs>                  Comma-separated tag slugs
    --reply-to <url>                    URL of X post to reply to
    --community <id>                    X community ID to post to
    --share                             Generate a public share URL for the draft

  update <social_set_id> <draft_id> [options]  Update a draft
    --platform <platforms>              Comma-separated platforms (default: x)
    --text <text>                       New post content
    --file, -f <path>                   Read content from file instead of --text
    --append, -a                        Append to existing thread instead of replacing
    --title <title>                     New draft title
    --schedule <time>                   "now", "next-free-slot", or ISO datetime

  delete <social_set_id> <draft_id>        Delete a draft

  schedule <social_set_id> <draft_id> [options]  Schedule a draft
    --time <time>                       "next-free-slot" or ISO datetime (required)

  publish <social_set_id> <draft_id>       Publish a draft immediately

  tags <social_set_id>                     List all tags
  tag:create <social_set_id> --name <name> Create a new tag

  media:upload <social_set_id> <file>      Upload media file (returns media_id)
  media:status <social_set_id> <media_id>  Check media upload status

EXAMPLES:
  # Get your user info
  ./typefully.sh me

  # List all accounts
  ./typefully.sh accounts

  # Create a tweet
  ./typefully.sh create 123 --platform x --text "Hello world!"

  # Create a cross-platform post
  ./typefully.sh create 123 --platform x,linkedin --text "Big announcement!"

  # Create a thread (use --- on its own line to separate posts)
  ./typefully.sh create 123 --platform x --text $'First tweet\n---\nSecond tweet\n---\nThird tweet'

  # Create from file
  ./typefully.sh create 123 --platform x --file ./thread.txt

  # Schedule for next available slot
  ./typefully.sh create 123 --platform x --text "Scheduled post" --schedule next-free-slot

  # Schedule for specific time
  ./typefully.sh create 123 --platform x --text "Timed post" --schedule "2025-01-20T14:00:00Z"

  # List scheduled drafts
  ./typefully.sh drafts 123 --status scheduled

  # Publish a draft immediately
  ./typefully.sh publish 123 456

  # Append to existing thread
  ./typefully.sh update 123 456 --append --text "New tweet at the end"

  # Reply to an existing tweet
  ./typefully.sh create 123 --platform x --text "Great thread!" --reply-to "https://x.com/user/status/123456"

  # Post to an X community
  ./typefully.sh create 123 --platform x --text "Community post" --community 1493446837214187523

  # Create draft with share URL
  ./typefully.sh create 123 --platform x --text "Check this out" --share

SETUP:
  1. Get your API key from https://typefully.com/settings/api
  2. Export it: export TYPEFULLY_API_KEY=your_key_here
EOF
}

# Commands
cmd_me() {
  api_request GET "/me"
}

cmd_accounts() {
  api_request GET "/social-sets?limit=50"
}

cmd_account() {
  local social_set_id="${1:-}"
  if [[ -z "$social_set_id" ]]; then
    echo '{"error": "social_set_id is required"}'
    exit 1
  fi
  api_request GET "/social-sets/$social_set_id"
}

cmd_drafts() {
  local social_set_id="${1:-}"
  shift || true

  if [[ -z "$social_set_id" ]]; then
    echo '{"error": "social_set_id is required"}'
    exit 1
  fi

  local status=""
  local tag=""
  local limit="10"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --status) status="$2"; shift 2 ;;
      --tag) tag="$2"; shift 2 ;;
      --limit) limit="$2"; shift 2 ;;
      *) echo "{\"error\": \"Unknown option: $1\"}"; exit 1 ;;
    esac
  done

  local query="limit=$limit"
  [[ -n "$status" ]] && query="$query&status=$status"
  [[ -n "$tag" ]] && query="$query&tag=$tag"

  api_request GET "/social-sets/$social_set_id/drafts?$query"
}

cmd_draft() {
  local social_set_id="${1:-}"
  local draft_id="${2:-}"

  if [[ -z "$social_set_id" || -z "$draft_id" ]]; then
    echo '{"error": "social_set_id and draft_id are required"}'
    exit 1
  fi

  api_request GET "/social-sets/$social_set_id/drafts/$draft_id"
}

cmd_create() {
  local social_set_id="${1:-}"
  shift || true

  if [[ -z "$social_set_id" ]]; then
    echo '{"error": "social_set_id is required"}'
    exit 1
  fi

  local platforms=""
  local text=""
  local title=""
  local schedule=""
  local tags=""
  local file=""
  local reply_to=""
  local community=""
  local share="false"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --platform) platforms="$2"; shift 2 ;;
      --text) text="$2"; shift 2 ;;
      --title) title="$2"; shift 2 ;;
      --schedule) schedule="$2"; shift 2 ;;
      --tags) tags="$2"; shift 2 ;;
      --reply-to) reply_to="$2"; shift 2 ;;
      --community) community="$2"; shift 2 ;;
      --share) share="true"; shift ;;
      --file|-f)
        if [[ -f "$2" ]]; then
          file="$2"
        else
          echo "{\"error\": \"File not found: $2\"}"
          exit 1
        fi
        shift 2 ;;
      *) echo "{\"error\": \"Unknown option: $1\"}"; exit 1 ;;
    esac
  done

  # Read text from file if --file was provided
  if [[ -n "$file" ]]; then
    text=$(cat "$file")
  fi

  if [[ -z "$platforms" || -z "$text" ]]; then
    echo '{"error": "--platform and (--text or --file) are required"}'
    exit 1
  fi

  # Split text into posts array (thread support via --- delimiter on its own line)
  local posts_json="["
  local first_post=true

  while IFS= read -r -d '' post_text; do
    [[ -z "$post_text" ]] && continue

    local escaped_post
    escaped_post=$(printf '%s' "$post_text" | jq -Rs '.')

    if [[ "$first_post" == "true" ]]; then
      first_post=false
    else
      posts_json+=","
    fi
    posts_json+="{\"text\": $escaped_post}"
  done < <(printf '%s\0' "$text" | perl -0777 -pe 's/\n---\n/\0/g')

  posts_json+="]"

  # Build platforms JSON
  local platforms_json="{"
  local first=true

  IFS=',' read -ra PLATFORM_ARRAY <<< "$platforms"
  for platform in "${PLATFORM_ARRAY[@]}"; do
    platform=$(echo "$platform" | xargs) # trim whitespace
    if [[ "$first" == "true" ]]; then
      first=false
    else
      platforms_json+=","
    fi

    # Add X-specific settings if reply_to or community is set
    if [[ "$platform" == "x" && ( -n "$reply_to" || -n "$community" ) ]]; then
      local settings_json="{"
      local first_setting=true
      if [[ -n "$reply_to" ]]; then
        settings_json+="\"reply_to_url\": \"$reply_to\""
        first_setting=false
      fi
      if [[ -n "$community" ]]; then
        [[ "$first_setting" == "false" ]] && settings_json+=","
        settings_json+="\"community_id\": \"$community\""
      fi
      settings_json+="}"
      platforms_json+="\"$platform\": {\"enabled\": true, \"posts\": $posts_json, \"settings\": $settings_json}"
    else
      platforms_json+="\"$platform\": {\"enabled\": true, \"posts\": $posts_json}"
    fi
  done
  platforms_json+="}"

  # Build full request
  local request="{\"platforms\": $platforms_json"

  if [[ -n "$title" ]]; then
    local escaped_title
    escaped_title=$(echo -n "$title" | jq -Rs '.')
    request+=", \"draft_title\": $escaped_title"
  fi

  if [[ -n "$schedule" ]]; then
    if [[ "$schedule" == "now" || "$schedule" == "next-free-slot" ]]; then
      request+=", \"publish_at\": \"$schedule\""
    else
      request+=", \"publish_at\": \"$schedule\""
    fi
  fi

  if [[ -n "$tags" ]]; then
    local tags_json="["
    local first_tag=true
    IFS=',' read -ra TAG_ARRAY <<< "$tags"
    for tag in "${TAG_ARRAY[@]}"; do
      tag=$(echo "$tag" | xargs)
      if [[ "$first_tag" == "true" ]]; then
        first_tag=false
      else
        tags_json+=","
      fi
      tags_json+="\"$tag\""
    done
    tags_json+="]"
    request+=", \"tags\": $tags_json"
  fi

  if [[ "$share" == "true" ]]; then
    request+=", \"share\": true"
  fi

  request+="}"

  api_request POST "/social-sets/$social_set_id/drafts" "$request"
}

cmd_update() {
  local social_set_id="${1:-}"
  local draft_id="${2:-}"
  shift 2 || true

  if [[ -z "$social_set_id" || -z "$draft_id" ]]; then
    echo '{"error": "social_set_id and draft_id are required"}'
    exit 1
  fi

  local platforms=""
  local text=""
  local title=""
  local schedule=""
  local file=""
  local append="false"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --platform) platforms="$2"; shift 2 ;;
      --text) text="$2"; shift 2 ;;
      --title) title="$2"; shift 2 ;;
      --schedule) schedule="$2"; shift 2 ;;
      --file|-f)
        if [[ -f "$2" ]]; then
          file="$2"
        else
          echo "{\"error\": \"File not found: $2\"}"
          exit 1
        fi
        shift 2 ;;
      --append|-a) append="true"; shift ;;
      *) echo "{\"error\": \"Unknown option: $1\"}"; exit 1 ;;
    esac
  done

  # Read text from file if --file was provided
  if [[ -n "$file" ]]; then
    text=$(cat "$file")
  fi

  local request="{"
  local first=true

  if [[ -n "$text" ]]; then
    # Use specified platforms, or default to x if not provided
    local target_platforms="${platforms:-x}"

    local posts_json

    if [[ "$append" == "true" ]]; then
      # Fetch existing draft to get current posts
      local existing
      existing=$(api_request GET "/social-sets/$social_set_id/drafts/$draft_id" 2>/dev/null)

      # Extract posts from the first enabled platform
      local existing_posts
      existing_posts=$(echo "$existing" | jq -c '[.platforms | to_entries[] | select(.value.enabled == true) | .value.posts][0] // []')

      # Escape new text and append
      local escaped_text
      escaped_text=$(printf '%s' "$text" | jq -Rs '.')

      # Append new post to existing posts array
      posts_json=$(printf '%s' "$existing_posts" | jq -c ". + [{\"text\": $escaped_text}]")
    else
      # Split text into posts array (thread support via --- delimiter on its own line)
      posts_json="["
      local first_post=true

      while IFS= read -r -d '' post_text; do
        [[ -z "$post_text" ]] && continue

        local escaped_post
        escaped_post=$(printf '%s' "$post_text" | jq -Rs '.')

        if [[ "$first_post" == "true" ]]; then
          first_post=false
        else
          posts_json+=","
        fi
        posts_json+="{\"text\": $escaped_post}"
      done < <(printf '%s\0' "$text" | perl -0777 -pe 's/\n---\n/\0/g')

      posts_json+="]"
    fi

    # Build platforms JSON
    local platforms_json="{"
    local first_platform=true

    IFS=',' read -ra PLATFORM_ARRAY <<< "$target_platforms"
    for platform in "${PLATFORM_ARRAY[@]}"; do
      platform=$(echo "$platform" | xargs) # trim whitespace
      if [[ "$first_platform" == "true" ]]; then
        first_platform=false
      else
        platforms_json+=","
      fi
      platforms_json+="\"$platform\": {\"enabled\": true, \"posts\": $posts_json}"
    done
    platforms_json+="}"

    request+="\"platforms\": $platforms_json"
    first=false
  fi

  if [[ -n "$title" ]]; then
    local escaped_title
    escaped_title=$(echo -n "$title" | jq -Rs '.')
    [[ "$first" == "false" ]] && request+=","
    request+="\"draft_title\": $escaped_title"
    first=false
  fi

  if [[ -n "$schedule" ]]; then
    [[ "$first" == "false" ]] && request+=","
    request+="\"publish_at\": \"$schedule\""
    first=false
  fi

  request+="}"

  if [[ "$request" == "{}" ]]; then
    echo '{"error": "At least one of --text, --file, --title, or --schedule is required"}'
    exit 1
  fi

  api_request PATCH "/social-sets/$social_set_id/drafts/$draft_id" "$request"
}

cmd_delete() {
  local social_set_id="${1:-}"
  local draft_id="${2:-}"

  if [[ -z "$social_set_id" || -z "$draft_id" ]]; then
    echo '{"error": "social_set_id and draft_id are required"}'
    exit 1
  fi

  api_request DELETE "/social-sets/$social_set_id/drafts/$draft_id"
  echo '{"success": true, "message": "Draft deleted"}'
}

cmd_schedule() {
  local social_set_id="${1:-}"
  local draft_id="${2:-}"
  shift 2 || true

  if [[ -z "$social_set_id" || -z "$draft_id" ]]; then
    echo '{"error": "social_set_id and draft_id are required"}'
    exit 1
  fi

  local time=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --time) time="$2"; shift 2 ;;
      *) echo "{\"error\": \"Unknown option: $1\"}"; exit 1 ;;
    esac
  done

  if [[ -z "$time" ]]; then
    echo '{"error": "--time is required (use \"next-free-slot\" or ISO datetime)"}'
    exit 1
  fi

  local request="{\"publish_at\": \"$time\"}"
  api_request PATCH "/social-sets/$social_set_id/drafts/$draft_id" "$request"
}

cmd_publish() {
  local social_set_id="${1:-}"
  local draft_id="${2:-}"

  if [[ -z "$social_set_id" || -z "$draft_id" ]]; then
    echo '{"error": "social_set_id and draft_id are required"}'
    exit 1
  fi

  local request='{"publish_at": "now"}'
  api_request PATCH "/social-sets/$social_set_id/drafts/$draft_id" "$request"
}

cmd_tags() {
  local social_set_id="${1:-}"

  if [[ -z "$social_set_id" ]]; then
    echo '{"error": "social_set_id is required"}'
    exit 1
  fi

  api_request GET "/social-sets/$social_set_id/tags?limit=50"
}

cmd_tag_create() {
  local social_set_id="${1:-}"
  shift || true

  if [[ -z "$social_set_id" ]]; then
    echo '{"error": "social_set_id is required"}'
    exit 1
  fi

  local name=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --name) name="$2"; shift 2 ;;
      *) echo "{\"error\": \"Unknown option: $1\"}"; exit 1 ;;
    esac
  done

  if [[ -z "$name" ]]; then
    echo '{"error": "--name is required"}'
    exit 1
  fi

  local escaped_name
  escaped_name=$(echo -n "$name" | jq -Rs '.')
  local request="{\"name\": $escaped_name}"

  api_request POST "/social-sets/$social_set_id/tags" "$request"
}

cmd_media_upload() {
  local social_set_id="${1:-}"
  local file="${2:-}"

  if [[ -z "$social_set_id" || -z "$file" ]]; then
    echo '{"error": "social_set_id and file path are required"}'
    exit 1
  fi

  if [[ ! -f "$file" ]]; then
    echo "{\"error\": \"File not found: $file\"}"
    exit 1
  fi

  local filename
  filename=$(basename "$file")

  # Get presigned URL
  local request="{\"file_name\": \"$filename\"}"
  local response
  response=$(api_request POST "/social-sets/$social_set_id/media" "$request")

  local upload_url
  local media_id
  upload_url=$(echo "$response" | jq -r '.upload_url')
  media_id=$(echo "$response" | jq -r '.media_id')

  if [[ -z "$upload_url" || "$upload_url" == "null" ]]; then
    echo "$response"
    exit 1
  fi

  # Upload file to S3
  local content_type
  case "${filename##*.}" in
    jpg|jpeg) content_type="image/jpeg" ;;
    png) content_type="image/png" ;;
    gif) content_type="image/gif" ;;
    webp) content_type="image/webp" ;;
    mp4) content_type="video/mp4" ;;
    mov) content_type="video/quicktime" ;;
    pdf) content_type="application/pdf" ;;
    *) content_type="application/octet-stream" ;;
  esac

  local upload_response
  upload_response=$(curl -s -X PUT -H "Content-Type: $content_type" --data-binary "@$file" "$upload_url" -w "%{http_code}")

  if [[ "$upload_response" -ge 400 ]]; then
    echo "{\"error\": \"Failed to upload file to S3\", \"http_code\": $upload_response}"
    exit 1
  fi

  echo "{\"media_id\": \"$media_id\", \"message\": \"Upload complete. Use media:status to check processing.\"}"
}

cmd_media_status() {
  local social_set_id="${1:-}"
  local media_id="${2:-}"

  if [[ -z "$social_set_id" || -z "$media_id" ]]; then
    echo '{"error": "social_set_id and media_id are required"}'
    exit 1
  fi

  api_request GET "/social-sets/$social_set_id/media/$media_id"
}

# Main command router
main() {
  local command="${1:-help}"
  shift || true

  case "$command" in
    me) cmd_me ;;
    accounts) cmd_accounts ;;
    account) cmd_account "$@" ;;
    drafts) cmd_drafts "$@" ;;
    draft) cmd_draft "$@" ;;
    create) cmd_create "$@" ;;
    update) cmd_update "$@" ;;
    delete) cmd_delete "$@" ;;
    schedule) cmd_schedule "$@" ;;
    publish) cmd_publish "$@" ;;
    tags) cmd_tags "$@" ;;
    tag:create) cmd_tag_create "$@" ;;
    media:upload) cmd_media_upload "$@" ;;
    media:status) cmd_media_status "$@" ;;
    help|--help|-h) show_help ;;
    *) echo "{\"error\": \"Unknown command: $command. Use --help for usage.\"}"; exit 1 ;;
  esac
}

main "$@"
