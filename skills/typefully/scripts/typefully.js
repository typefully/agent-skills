#!/usr/bin/env node

/**
 * Typefully CLI - Manage social media posts via the Typefully API
 * https://typefully.com/docs/api
 *
 * Zero dependencies - uses only Node.js built-in modules
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const API_BASE = 'https://api.typefully.com/v2';
const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.config', 'typefully');
const GLOBAL_CONFIG_FILE = path.join(GLOBAL_CONFIG_DIR, 'config.json');
const LOCAL_CONFIG_DIR = '.typefully';
const LOCAL_CONFIG_FILE = path.join(LOCAL_CONFIG_DIR, 'config.json');
const API_KEY_URL = 'https://typefully.com/?settings=api';

// Content-type mapping for media uploads
const CONTENT_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  pdf: 'application/pdf',
};

// ============================================================================
// Utilities
// ============================================================================

function output(data) {
  console.log(JSON.stringify(data, null, 2));
}

function error(message, details = {}) {
  output({ error: message, ...details });
  process.exit(1);
}

function readConfigFile(configPath) {
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    }
  } catch {
    // Invalid JSON or read error - ignore
  }
  return null;
}

function getApiKey() {
  // Priority 1: Environment variable
  if (process.env.TYPEFULLY_API_KEY) {
    return { source: 'environment variable', key: process.env.TYPEFULLY_API_KEY };
  }

  // Priority 2: Project-local config (./.typefully/config.json)
  const localConfigPath = path.join(process.cwd(), LOCAL_CONFIG_FILE);
  const localConfig = readConfigFile(localConfigPath);
  if (localConfig?.apiKey) {
    return { source: localConfigPath, key: localConfig.apiKey };
  }

  // Priority 3: User-global config (~/.config/typefully/config.json)
  const globalConfig = readConfigFile(GLOBAL_CONFIG_FILE);
  if (globalConfig?.apiKey) {
    return { source: GLOBAL_CONFIG_FILE, key: globalConfig.apiKey };
  }

  return null;
}

function requireApiKey() {
  const result = getApiKey();
  if (!result) {
    error(`API key not found. Get your key at ${API_KEY_URL}`, {
      hint: 'Run: typefully.js setup'
    });
  }
  return result.key;
}

async function apiRequest(method, endpoint, body = null) {
  const apiKey = requireApiKey();

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, options);

  let data;
  const text = await response.text();
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    error(`HTTP ${response.status}`, { response: data });
  }

  return data;
}

function parseArgs(args, spec = {}) {
  const result = { _positional: [] };
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (spec[key] === 'boolean') {
        result[key] = true;
        i++;
      } else if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        result[key] = args[i + 1];
        i += 2;
      } else {
        result[key] = true;
        i++;
      }
    } else if (arg === '-f') {
      // Shorthand for --file
      if (i + 1 < args.length) {
        result.file = args[i + 1];
        i += 2;
      } else {
        i++;
      }
    } else if (arg === '-a') {
      // Shorthand for --append
      result.append = true;
      i++;
    } else if (arg === '--scratchpad') {
      // Alias for --notes
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        result.notes = args[i + 1];
        i += 2;
      } else {
        i++;
      }
    } else {
      result._positional.push(arg);
      i++;
    }
  }

  return result;
}

function splitThreadText(text) {
  // Split on --- that appears on its own line
  return text.split(/\n---\n/).filter(t => t.trim());
}

function getContentType(filename) {
  const ext = path.extname(filename).slice(1).toLowerCase();
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sanitizeFilename(filename) {
  // API pattern: (?i)^[a-zA-Z0-9_.()\\-]+\\.(jpg|jpeg|png|webp|gif|mp4|mov|pdf)$
  // Extract extension
  const ext = path.extname(filename).toLowerCase();
  const basename = path.basename(filename, path.extname(filename));

  // Replace invalid characters with underscores
  // Valid: letters, numbers, underscores, dots, parentheses, hyphens
  const sanitized = basename
    .replace(/[^a-zA-Z0-9_.()-]/g, '_')  // Replace invalid chars with underscore
    .replace(/_+/g, '_')                  // Collapse multiple underscores
    .replace(/^_|_$/g, '');               // Trim leading/trailing underscores

  // Ensure we have a valid name
  const finalName = sanitized || 'upload';

  return finalName + ext;
}

// ============================================================================
// Commands
// ============================================================================

async function cmdMeGet() {
  const data = await apiRequest('GET', '/me');
  output(data);
}

async function cmdSocialSetsList() {
  const data = await apiRequest('GET', '/social-sets?limit=50');
  output(data);
}

async function cmdSocialSetsGet(args) {
  const parsed = parseArgs(args);
  const socialSetId = parsed._positional[0];

  if (!socialSetId) {
    error('social_set_id is required');
  }

  const data = await apiRequest('GET', `/social-sets/${socialSetId}`);
  output(data);
}

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr, // Use stderr so JSON output stays clean on stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function writeConfig(configPath, config) {
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
}

async function cmdSetup(args) {
  const parsed = parseArgs(args);

  // Check if running in non-interactive mode (key provided as argument)
  let apiKey = parsed._positional[0] || parsed.key;
  let location = parsed.location || parsed.scope;

  // If key provided via argument, skip interactive prompt
  if (!apiKey) {
    console.error('Typefully CLI Setup');
    console.error('');
    console.error(`Get your API key at: ${API_KEY_URL}`);
    console.error('');
    apiKey = await prompt('Enter your Typefully API key: ');
  }

  if (!apiKey) {
    error('API key is required');
  }

  // Determine location
  if (!location) {
    console.error('');
    console.error('Where should the API key be stored?');
    console.error('  1. Global (~/.config/typefully/config.json) - Available to all projects');
    console.error('  2. Local (./.typefully/config.json) - Only this project, overrides global');
    console.error('');
    const choice = await prompt('Choose location [1/2] (default: 1): ');
    location = choice === '2' ? 'local' : 'global';
  }

  const isLocal = location === 'local' || location === '2';
  const configPath = isLocal
    ? path.join(process.cwd(), LOCAL_CONFIG_FILE)
    : GLOBAL_CONFIG_FILE;

  // Read existing config to preserve other settings
  const existingConfig = readConfigFile(configPath) || {};
  const newConfig = { ...existingConfig, apiKey };

  writeConfig(configPath, newConfig);

  // Offer to add .typefully/ to .gitignore for local config
  if (isLocal) {
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
      if (!gitignore.includes('.typefully/') && !gitignore.includes('.typefully\n')) {
        console.error('');
        const addToGitignore = await prompt('Add .typefully/ to .gitignore? [Y/n]: ');
        if (addToGitignore.toLowerCase() !== 'n') {
          fs.appendFileSync(gitignorePath, '\n# Typefully config (contains API key)\n.typefully/\n');
          console.error('✓ Added .typefully/ to .gitignore');
        }
      }
    }
  }

  console.error('');
  console.error(`✓ API key saved to ${configPath}`);

  output({
    success: true,
    message: 'Setup complete',
    config_path: configPath,
    scope: isLocal ? 'local' : 'global',
  });
}

async function cmdConfigShow() {
  const result = getApiKey();

  if (!result) {
    output({
      configured: false,
      hint: 'Run: typefully.js setup',
      api_key_url: API_KEY_URL,
    });
    return;
  }

  // Also show what config files exist
  const localConfigPath = path.join(process.cwd(), LOCAL_CONFIG_FILE);
  const localConfig = readConfigFile(localConfigPath);
  const globalConfig = readConfigFile(GLOBAL_CONFIG_FILE);

  output({
    configured: true,
    active_source: result.source,
    api_key_preview: result.key.slice(0, 8) + '...',
    config_files: {
      local: localConfig ? { path: localConfigPath, has_key: !!localConfig.apiKey } : null,
      global: globalConfig ? { path: GLOBAL_CONFIG_FILE, has_key: !!globalConfig.apiKey } : null,
    },
  });
}

async function cmdDraftsList(args) {
  const parsed = parseArgs(args);
  const socialSetId = parsed._positional[0];

  if (!socialSetId) {
    error('social_set_id is required');
  }

  const params = new URLSearchParams();
  params.set('limit', parsed.limit || '10');
  if (parsed.status) params.set('status', parsed.status);
  if (parsed.tag) params.set('tag', parsed.tag);
  if (parsed.sort) params.set('order_by', parsed.sort);

  const data = await apiRequest('GET', `/social-sets/${socialSetId}/drafts?${params}`);
  output(data);
}

async function cmdDraftsGet(args) {
  const parsed = parseArgs(args);
  const [socialSetId, draftId] = parsed._positional;

  if (!socialSetId || !draftId) {
    error('social_set_id and draft_id are required');
  }

  const data = await apiRequest('GET', `/social-sets/${socialSetId}/drafts/${draftId}`);
  output(data);
}

async function getFirstConnectedPlatform(socialSetId) {
  const socialSet = await apiRequest('GET', `/social-sets/${socialSetId}`);

  // Check each platform for connection
  // The API returns platforms as an object where each key exists if that platform is connected
  const platformOrder = ['x', 'linkedin', 'threads', 'bluesky', 'mastodon'];
  const platforms = socialSet.platforms || {};

  for (const platform of platformOrder) {
    if (platforms[platform]) {
      return platform;
    }
  }

  return null;
}

async function getAllConnectedPlatforms(socialSetId) {
  const socialSet = await apiRequest('GET', `/social-sets/${socialSetId}`);
  const platformOrder = ['x', 'linkedin', 'threads', 'bluesky', 'mastodon'];
  const platforms = socialSet.platforms || {};
  const connected = [];

  for (const platform of platformOrder) {
    if (platforms[platform]) {
      connected.push(platform);
    }
  }

  return connected;
}

async function cmdDraftsCreate(args) {
  const parsed = parseArgs(args, { share: 'boolean', all: 'boolean' });
  const socialSetId = parsed._positional[0];

  if (!socialSetId) {
    error('social_set_id is required');
  }

  // Get text content
  let text = parsed.text;
  if (parsed.file) {
    if (!fs.existsSync(parsed.file)) {
      error(`File not found: ${parsed.file}`);
    }
    text = fs.readFileSync(parsed.file, 'utf-8');
  }

  if (!text) {
    error('--text or --file is required');
  }

  // Determine platform(s)
  let platforms = parsed.platform;

  if (parsed.all && parsed.platform) {
    error('Cannot use both --all and --platform flags');
  }

  if (parsed.all) {
    // Get all connected platforms
    const allPlatforms = await getAllConnectedPlatforms(socialSetId);
    if (allPlatforms.length === 0) {
      error('No connected platforms found. Connect a platform at typefully.com');
    }
    platforms = allPlatforms.join(',');
  } else if (!platforms) {
    // Smart default: get first connected platform
    const defaultPlatform = await getFirstConnectedPlatform(socialSetId);
    if (!defaultPlatform) {
      error('No connected platforms found. Connect a platform at typefully.com or specify --platform');
    }
    platforms = defaultPlatform;
  }

  const platformList = platforms.split(',').map(p => p.trim());

  // Split text into posts (thread support)
  const posts = splitThreadText(text);

  // Parse media IDs
  const mediaIds = parsed.media ? parsed.media.split(',').map(m => m.trim()) : [];

  // Build posts array
  const postsArray = posts.map((postText, index) => {
    const post = { text: postText };
    // Attach media only to first post
    if (index === 0 && mediaIds.length > 0) {
      post.media_ids = mediaIds;
    }
    return post;
  });

  // Build platforms object
  const platformsObj = {};
  for (const platform of platformList) {
    const platformConfig = {
      enabled: true,
      posts: postsArray,
    };

    // X-specific settings
    if (platform === 'x' && (parsed['reply-to'] || parsed.community)) {
      platformConfig.settings = {};
      if (parsed['reply-to']) {
        platformConfig.settings.reply_to_url = parsed['reply-to'];
      }
      if (parsed.community) {
        platformConfig.settings.community_id = parsed.community;
      }
    }

    platformsObj[platform] = platformConfig;
  }

  // Build request body
  const body = { platforms: platformsObj };

  if (parsed.title) {
    body.draft_title = parsed.title;
  }

  if (parsed.schedule) {
    body.publish_at = parsed.schedule;
  }

  if (parsed.tags) {
    body.tags = parsed.tags.split(',').map(t => t.trim());
  }

  if (parsed.share) {
    body.share = true;
  }

  if (parsed.notes) {
    body.scratchpad_text = parsed.notes;
  }

  const data = await apiRequest('POST', `/social-sets/${socialSetId}/drafts`, body);
  output(data);
}

async function cmdDraftsUpdate(args) {
  const parsed = parseArgs(args, { append: 'boolean', share: 'boolean' });
  const [socialSetId, draftId] = parsed._positional;

  if (!socialSetId || !draftId) {
    error('social_set_id and draft_id are required');
  }

  // Get text content
  let text = parsed.text;
  if (parsed.file) {
    if (!fs.existsSync(parsed.file)) {
      error(`File not found: ${parsed.file}`);
    }
    text = fs.readFileSync(parsed.file, 'utf-8');
  }

  const body = {};

  if (text) {
    const platform = parsed.platform || 'x';
    const platformList = platform.split(',').map(p => p.trim());

    // Parse media IDs
    const mediaIds = parsed.media ? parsed.media.split(',').map(m => m.trim()) : [];

    let postsArray;

    if (parsed.append) {
      // Fetch existing draft to get current posts
      const existing = await apiRequest('GET', `/social-sets/${socialSetId}/drafts/${draftId}`);

      // Extract posts from the first enabled platform
      let existingPosts = [];
      for (const [, config] of Object.entries(existing.platforms || {})) {
        if (config.enabled && config.posts) {
          existingPosts = config.posts;
          break;
        }
      }

      // Append new post
      const newPost = { text };
      if (mediaIds.length > 0) {
        newPost.media_ids = mediaIds;
      }
      postsArray = [...existingPosts, newPost];
    } else {
      // Replace with new posts
      const posts = splitThreadText(text);
      postsArray = posts.map((postText, index) => {
        const post = { text: postText };
        if (index === 0 && mediaIds.length > 0) {
          post.media_ids = mediaIds;
        }
        return post;
      });
    }

    // Build platforms object
    const platformsObj = {};
    for (const p of platformList) {
      platformsObj[p] = {
        enabled: true,
        posts: postsArray,
      };
    }
    body.platforms = platformsObj;
  }

  if (parsed.title) {
    body.draft_title = parsed.title;
  }

  if (parsed.schedule) {
    body.publish_at = parsed.schedule;
  }

  if (parsed.share) {
    body.share = true;
  }

  if (parsed.notes) {
    body.scratchpad_text = parsed.notes;
  }

  if (Object.keys(body).length === 0) {
    error('At least one of --text, --file, --title, --schedule, --share, or --notes is required');
  }

  const data = await apiRequest('PATCH', `/social-sets/${socialSetId}/drafts/${draftId}`, body);
  output(data);
}

async function cmdDraftsDelete(args) {
  const parsed = parseArgs(args);
  const [socialSetId, draftId] = parsed._positional;

  if (!socialSetId || !draftId) {
    error('social_set_id and draft_id are required');
  }

  await apiRequest('DELETE', `/social-sets/${socialSetId}/drafts/${draftId}`);
  output({ success: true, message: 'Draft deleted' });
}

async function cmdDraftsSchedule(args) {
  const parsed = parseArgs(args);
  const [socialSetId, draftId] = parsed._positional;

  if (!socialSetId || !draftId) {
    error('social_set_id and draft_id are required');
  }

  if (!parsed.time) {
    error('--time is required (use "next-free-slot" or ISO datetime)');
  }

  const data = await apiRequest('PATCH', `/social-sets/${socialSetId}/drafts/${draftId}`, {
    publish_at: parsed.time,
  });
  output(data);
}

async function cmdDraftsPublish(args) {
  const parsed = parseArgs(args);
  const [socialSetId, draftId] = parsed._positional;

  if (!socialSetId || !draftId) {
    error('social_set_id and draft_id are required');
  }

  const data = await apiRequest('PATCH', `/social-sets/${socialSetId}/drafts/${draftId}`, {
    publish_at: 'now',
  });
  output(data);
}

async function cmdTagsList(args) {
  const parsed = parseArgs(args);
  const socialSetId = parsed._positional[0];

  if (!socialSetId) {
    error('social_set_id is required');
  }

  const data = await apiRequest('GET', `/social-sets/${socialSetId}/tags?limit=50`);
  output(data);
}

async function cmdTagsCreate(args) {
  const parsed = parseArgs(args);
  const socialSetId = parsed._positional[0];

  if (!socialSetId) {
    error('social_set_id is required');
  }

  if (!parsed.name) {
    error('--name is required');
  }

  const data = await apiRequest('POST', `/social-sets/${socialSetId}/tags`, {
    name: parsed.name,
  });
  output(data);
}

async function cmdMediaUpload(args) {
  const parsed = parseArgs(args, { 'no-wait': 'boolean' });
  const [socialSetId, filePath] = parsed._positional;

  if (!socialSetId || !filePath) {
    error('social_set_id and file path are required');
  }

  if (!fs.existsSync(filePath)) {
    error(`File not found: ${filePath}`);
  }

  const rawFilename = path.basename(filePath);
  const filename = sanitizeFilename(rawFilename);
  const timeout = parseInt(parsed.timeout || '60', 10) * 1000;

  // Step 1: Get presigned URL from API
  const presignedResponse = await apiRequest('POST', `/social-sets/${socialSetId}/media/upload`, {
    file_name: filename,
  });

  const { upload_url: uploadUrl, media_id: mediaId } = presignedResponse;

  if (!uploadUrl) {
    error('Failed to get presigned URL', { response: presignedResponse });
  }

  // Step 2: Upload file to S3 (WITHOUT Content-Type header - this was the bug!)
  const fileBuffer = fs.readFileSync(filePath);

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    body: fileBuffer,
    // Note: Do NOT set Content-Type header - S3 presigned URLs have it encoded
  });

  if (!uploadResponse.ok) {
    error('Failed to upload file to S3', {
      http_code: uploadResponse.status,
      status_text: uploadResponse.statusText,
    });
  }

  // Step 3: Poll for processing status (unless --no-wait)
  if (parsed['no-wait']) {
    output({
      media_id: mediaId,
      message: 'Upload complete. Use media:status to check processing.',
    });
    return;
  }

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const statusResponse = await apiRequest('GET', `/social-sets/${socialSetId}/media/${mediaId}`);

    if (statusResponse.status === 'ready') {
      output({
        media_id: mediaId,
        status: statusResponse.status,
        message: 'Media uploaded and ready to use',
      });
      return;
    }

    if (statusResponse.status === 'error' || statusResponse.status === 'failed') {
      error('Media processing failed', { status: statusResponse });
    }

    // Wait 2 seconds before polling again
    await sleep(2000);
  }

  // Timeout reached
  output({
    media_id: mediaId,
    status: 'processing',
    message: 'Upload complete but still processing. Use media:status to check.',
    hint: 'Increase timeout with --timeout <seconds>',
  });
}

async function cmdMediaStatus(args) {
  const parsed = parseArgs(args);
  const [socialSetId, mediaId] = parsed._positional;

  if (!socialSetId || !mediaId) {
    error('social_set_id and media_id are required');
  }

  const data = await apiRequest('GET', `/social-sets/${socialSetId}/media/${mediaId}`);
  output(data);
}

function showHelp() {
  console.log(`Typefully CLI - Manage social media posts via the Typefully API

USAGE:
  typefully.js <command> [arguments]

SETUP:
  setup                                      Interactive setup - saves API key securely
    --key <api_key>                          Provide key non-interactively
    --location <global|local>                Choose config location non-interactively
                                             global: ~/.config/typefully/config.json
                                             local: ./.typefully/config.json (project-specific)

  config:show                                Show current config and API key source

COMMANDS:
  me:get                                     Get authenticated user info

  social-sets:list                           List all social sets
  social-sets:get <social_set_id>            Get social set details with platforms

  drafts:list <social_set_id> [options]      List drafts
    --status <status>                        Filter by: draft, scheduled, published, error, publishing
    --tag <tag_slug>                         Filter by tag slug
    --sort <order>                           Sort by: created_at, -created_at, updated_at, -updated_at,
                                             scheduled_date, -scheduled_date, published_at, -published_at
    --limit <n>                              Max results (default: 10, max: 50)

  drafts:get <social_set_id> <draft_id>      Get a specific draft

  drafts:create <social_set_id> [options]    Create a new draft
    --platform <platforms>                   Comma-separated: x,linkedin,threads,bluesky,mastodon
                                             (auto-selects first connected platform if omitted)
    --all                                    Post to all connected platforms
    --text <text>                            Post content (use --- on its own line for threads)
    --file, -f <path>                        Read content from file instead of --text
    --media <media_ids>                      Comma-separated media IDs to attach
    --title <title>                          Draft title (internal only)
    --schedule <time>                        "now", "next-free-slot", or ISO datetime
    --tags <tag_slugs>                       Comma-separated tag slugs
    --reply-to <url>                         URL of X post to reply to
    --community <id>                         X community ID to post to
    --share                                  Generate a public share URL for the draft
    --notes, --scratchpad <text>             Internal notes/scratchpad for the draft

  drafts:update <social_set_id> <draft_id> [options]  Update a draft
    --platform <platforms>                   Comma-separated platforms (default: x)
    --text <text>                            New post content
    --file, -f <path>                        Read content from file instead of --text
    --media <media_ids>                      Comma-separated media IDs to attach
    --append, -a                             Append to existing thread instead of replacing
    --title <title>                          New draft title
    --schedule <time>                        "now", "next-free-slot", or ISO datetime
    --share                                  Generate a public share URL for the draft
    --notes, --scratchpad <text>             Internal notes/scratchpad for the draft

  drafts:delete <social_set_id> <draft_id>   Delete a draft

  drafts:schedule <social_set_id> <draft_id> [options]  Schedule a draft
    --time <time>                            "next-free-slot" or ISO datetime (required)

  drafts:publish <social_set_id> <draft_id>  Publish a draft immediately

  tags:list <social_set_id>                  List all tags
  tags:create <social_set_id> --name <name>  Create a new tag

  media:upload <social_set_id> <file>        Upload media file (handles upload + polling)
    --no-wait                                Return immediately after upload (don't poll)
    --timeout <seconds>                      Max wait for processing (default: 60)
  media:status <social_set_id> <media_id>    Check media upload status

EXAMPLES:
  # First time setup (interactive)
  ./typefully.js setup

  # Non-interactive setup (for scripts/CI)
  ./typefully.js setup --key typ_xxx --location global

  # Check current configuration
  ./typefully.js config:show

  # Get your user info
  ./typefully.js me:get

  # List all social sets
  ./typefully.js social-sets:list

  # Create a tweet (auto-selects platform if only one connected)
  ./typefully.js drafts:create 123 --text "Hello world!"

  # Create a cross-platform post (specific platforms)
  ./typefully.js drafts:create 123 --platform x,linkedin --text "Big announcement!"

  # Create a post on all connected platforms
  ./typefully.js drafts:create 123 --all --text "Posting everywhere!"

  # Create a thread (use --- on its own line to separate posts)
  ./typefully.js drafts:create 123 --platform x --text $'First tweet\\n---\\nSecond tweet\\n---\\nThird tweet'

  # Create from file
  ./typefully.js drafts:create 123 --platform x --file ./thread.txt

  # Schedule for next available slot
  ./typefully.js drafts:create 123 --platform x --text "Scheduled post" --schedule next-free-slot

  # Schedule for specific time
  ./typefully.js drafts:create 123 --platform x --text "Timed post" --schedule "2025-01-20T14:00:00Z"

  # List scheduled drafts sorted by date
  ./typefully.js drafts:list 123 --status scheduled --sort scheduled_date

  # Publish a draft immediately
  ./typefully.js drafts:publish 123 456

  # Append to existing thread
  ./typefully.js drafts:update 123 456 --append --text "New tweet at the end"

  # Reply to an existing tweet
  ./typefully.js drafts:create 123 --platform x --text "Great thread!" --reply-to "https://x.com/user/status/123456"

  # Post to an X community
  ./typefully.js drafts:create 123 --platform x --text "Community post" --community 1493446837214187523

  # Create draft with share URL
  ./typefully.js drafts:create 123 --platform x --text "Check this out" --share

  # Upload media and create post with it
  ./typefully.js media:upload 123 ./image.jpg
  # Returns: {"media_id": "abc-123", "status": "ready", "message": "Media uploaded and ready to use"}
  ./typefully.js drafts:create 123 --platform x --text "Check out this image!" --media abc-123

CONFIG PRIORITY:
  1. TYPEFULLY_API_KEY environment variable (highest)
  2. ./.typefully/config.json (project-local)
  3. ~/.config/typefully/config.json (user-global, lowest)

GET YOUR API KEY:
  ${API_KEY_URL}
`);
}

// ============================================================================
// Main Router
// ============================================================================

const COMMANDS = {
  'setup': cmdSetup,
  'me:get': cmdMeGet,
  'social-sets:list': cmdSocialSetsList,
  'social-sets:get': cmdSocialSetsGet,
  'drafts:list': cmdDraftsList,
  'drafts:get': cmdDraftsGet,
  'drafts:create': cmdDraftsCreate,
  'drafts:update': cmdDraftsUpdate,
  'drafts:delete': cmdDraftsDelete,
  'drafts:schedule': cmdDraftsSchedule,
  'drafts:publish': cmdDraftsPublish,
  'tags:list': cmdTagsList,
  'tags:create': cmdTagsCreate,
  'media:upload': cmdMediaUpload,
  'media:status': cmdMediaStatus,
  'config:show': cmdConfigShow,
  'help': showHelp,
  '--help': showHelp,
  '-h': showHelp,
};

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const commandArgs = args.slice(1);

  const handler = COMMANDS[command];

  if (!handler) {
    error(`Unknown command: ${command}`, { hint: 'Use --help for usage.' });
  }

  try {
    await handler(commandArgs);
  } catch (err) {
    if (err.code === 'ENOENT') {
      error(`File not found: ${err.path}`);
    }
    error(err.message, { stack: err.stack });
  }
}

main();
