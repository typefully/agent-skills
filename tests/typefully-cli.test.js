const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const CLI_PATH = path.resolve(__dirname, '..', 'skills', 'typefully', 'scripts', 'typefully.js');

async function mkdtemp(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function makeSandbox() {
  const root = await mkdtemp('agent-skills-test-');
  const cwd = path.join(root, 'cwd');
  const home = path.join(root, 'home');
  await fs.mkdir(cwd, { recursive: true });
  await fs.mkdir(home, { recursive: true });
  return {
    root,
    cwd,
    home,
    async cleanup() {
      await fs.rm(root, { recursive: true, force: true });
    },
  };
}

function runCli(args, { cwd, env, timeoutMs = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_PATH, ...args], {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`CLI timeout after ${timeoutMs}ms: ${args.join(' ')}`));
    }, timeoutMs);

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr });
    });
  });
}

function parseJsonOrNull(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function createMockServer() {
  const requests = [];
  const expectations = [];

  async function readBody(req) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    return Buffer.concat(chunks);
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const bodyBuf = await readBody(req);
    const bodyText = bodyBuf.toString('utf8');
    const bodyJson = parseJsonOrNull(bodyText);

    const record = {
      method: req.method,
      path: url.pathname,
      search: url.search,
      headers: req.headers,
      bodyText,
      bodyJson,
    };
    requests.push(record);

    const exp = expectations.shift();
    if (!exp) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unexpected request', request: record }));
      return;
    }

    try {
      assert.equal(record.method, exp.method, 'HTTP method mismatch');
      assert.equal(record.path, exp.path, 'HTTP path mismatch');
      if (exp.assert) exp.assert(record);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Expectation failed', message: e.message, request: record }));
      return;
    }

    const status = exp.status ?? 200;
    const json = exp.json ?? {};
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(json));
  });

  return {
    requests,
    expect(method, path, { assert, status, json } = {}) {
      expectations.push({ method, path, assert, status, json });
    },
    async listen() {
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const addr = server.address();
      const baseUrl = `http://127.0.0.1:${addr.port}/v2`;
      return { baseUrl };
    },
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
    assertNoPendingExpectations() {
      assert.equal(expectations.length, 0, `Unconsumed expectations: ${expectations.length}`);
    },
  };
}

function authAssertFactory(expectedKey) {
  return (req) => {
    assert.equal(req.headers.authorization, `Bearer ${expectedKey}`);
  };
}

test('drafts:update with only --tags does not touch content (no platforms payload)', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  server.expect('PATCH', '/v2/social-sets/100813/drafts/d1', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.deepEqual(req.bodyJson, { tags: ['owner/me'] });
    },
    json: { id: 'd1', ok: true },
  });

  try {
    const result = await runCli(
      ['drafts:update', 'd1', '--tags', 'owner/me', '--social-set-id', '100813'],
      {
        cwd: sandbox.cwd,
        env: {
          HOME: sandbox.home,
          TYPEFULLY_API_BASE: baseUrl,
          TYPEFULLY_API_KEY: apiKey,
        },
      }
    );

    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1', ok: true });
    server.assertNoPendingExpectations();
    assert.equal(server.requests.length, 1);
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('update-draft alias: tag-only update works and does not crash', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  server.expect('PATCH', '/v2/social-sets/100813/drafts/d1', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.deepEqual(req.bodyJson, { tags: ['owner/me'] });
    },
    json: { id: 'd1', ok: true },
  });

  try {
    const result = await runCli(
      ['update-draft', 'd1', '--tags', 'owner/me', '--social-set-id', '100813'],
      {
        cwd: sandbox.cwd,
        env: {
          HOME: sandbox.home,
          TYPEFULLY_API_BASE: baseUrl,
          TYPEFULLY_API_KEY: apiKey,
        },
      }
    );

    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1', ok: true });
    server.assertNoPendingExpectations();
    assert.equal(server.requests.length, 1);
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('create-draft alias: positional text forwards correctly to drafts:create', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  server.expect('POST', '/v2/social-sets/100812/drafts', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.deepEqual(req.bodyJson, {
        platforms: {
          x: {
            enabled: true,
            posts: [{ text: 'Test content' }],
          },
        },
        tags: ['owner/me'],
      });
    },
    json: { id: 'new-draft' },
  });

  try {
    const result = await runCli(
      ['create-draft', 'Test content', '--social-set-id', '100812', '--platform', 'x', '--tags', 'owner/me'],
      {
        cwd: sandbox.cwd,
        env: {
          HOME: sandbox.home,
          TYPEFULLY_API_BASE: baseUrl,
          TYPEFULLY_API_KEY: apiKey,
        },
      }
    );

    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'new-draft' });
    server.assertNoPendingExpectations();
    assert.equal(server.requests.length, 1);
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('aliases: missing value for a value-taking flag errors cleanly (no TypeError)', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();

  try {
    const result = await runCli(
      ['create-draft', 'hi', '--social-set-id', '123', '--tags', '--share'],
      {
        cwd: sandbox.cwd,
        env: {
          HOME: sandbox.home,
          TYPEFULLY_API_BASE: baseUrl,
          TYPEFULLY_API_KEY: 'typ_test_key',
        },
      }
    );

    assert.equal(result.code, 1);
    assert.deepEqual(parseJsonOrNull(result.stdout), { error: '--tags requires a value' });
    assert.equal(server.requests.length, 0);
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('flag parsing: --social-set-id without value errors cleanly', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();

  try {
    const result = await runCli(
      ['drafts:list', '--social-set-id'],
      {
        cwd: sandbox.cwd,
        env: {
          HOME: sandbox.home,
          TYPEFULLY_API_BASE: baseUrl,
          TYPEFULLY_API_KEY: 'typ_test_key',
        },
      }
    );

    assert.equal(result.code, 1);
    assert.deepEqual(parseJsonOrNull(result.stdout), { error: '--social-set-id (or --social_set_id) requires a value' });
    assert.equal(server.requests.length, 0);
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('draft target safety: drafts:get single arg with default social set requires --use-default', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();

  // Create local config with a default social set.
  const cfgDir = path.join(sandbox.cwd, '.typefully');
  await fs.mkdir(cfgDir, { recursive: true });
  await fs.writeFile(path.join(cfgDir, 'config.json'), JSON.stringify({ defaultSocialSetId: '111' }, null, 2));

  try {
    const result = await runCli(
      ['drafts:get', 'd99'],
      {
        cwd: sandbox.cwd,
        env: {
          HOME: sandbox.home,
          TYPEFULLY_API_BASE: baseUrl,
          TYPEFULLY_API_KEY: 'typ_test_key',
        },
      }
    );

    assert.equal(result.code, 1);
    const out = parseJsonOrNull(result.stdout);
    assert.ok(out?.error?.includes('Ambiguous arguments for drafts:get'));
    assert.equal(server.requests.length, 0);
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('drafts:get with --use-default uses configured default social set', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  const cfgDir = path.join(sandbox.cwd, '.typefully');
  await fs.mkdir(cfgDir, { recursive: true });
  await fs.writeFile(path.join(cfgDir, 'config.json'), JSON.stringify({ defaultSocialSetId: '111' }, null, 2));

  server.expect('GET', '/v2/social-sets/111/drafts/d99', {
    assert: authAssertFactory(apiKey),
    json: { id: 'd99' },
  });

  try {
    const result = await runCli(
      ['drafts:get', 'd99', '--use-default'],
      {
        cwd: sandbox.cwd,
        env: {
          HOME: sandbox.home,
          TYPEFULLY_API_BASE: baseUrl,
          TYPEFULLY_API_KEY: apiKey,
        },
      }
    );

    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd99' });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('conflicts: positional social_set_id conflicts with --social-set-id', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();

  try {
    const result = await runCli(
      ['drafts:list', '111', '--social-set-id', '222'],
      {
        cwd: sandbox.cwd,
        env: {
          HOME: sandbox.home,
          TYPEFULLY_API_BASE: baseUrl,
          TYPEFULLY_API_KEY: 'typ_test_key',
        },
      }
    );

    assert.equal(result.code, 1);
    assert.deepEqual(parseJsonOrNull(result.stdout), {
      error: 'Conflicting social_set_id values',
      positional: '111',
      flag: '222',
    });
    assert.equal(server.requests.length, 0);
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('config:set-default accepts --social-set-id and writes local config', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  server.expect('GET', '/v2/social-sets/123', {
    assert: authAssertFactory(apiKey),
    json: { id: '123', platforms: { x: {} } },
  });

  try {
    const result = await runCli(
      ['config:set-default', '--social-set-id', '123', '--location', 'local'],
      {
        cwd: sandbox.cwd,
        env: {
          HOME: sandbox.home,
          TYPEFULLY_API_BASE: baseUrl,
          TYPEFULLY_API_KEY: apiKey,
        },
      }
    );

    assert.equal(result.code, 0);
    const out = parseJsonOrNull(result.stdout);
    assert.equal(out?.success, true);
    assert.equal(out?.default_social_set_id, '123');

    const cfg = JSON.parse(await fs.readFile(path.join(sandbox.cwd, '.typefully', 'config.json'), 'utf8'));
    assert.equal(cfg.defaultSocialSetId, '123');
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('drafts:create chooses first connected platform when --platform omitted', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  server.expect('GET', '/v2/social-sets/55', {
    assert: authAssertFactory(apiKey),
    json: { id: '55', platforms: { x: {}, linkedin: {} } },
  });

  server.expect('POST', '/v2/social-sets/55/drafts', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.equal(Object.keys(req.bodyJson.platforms).join(','), 'x');
      assert.equal(req.bodyJson.platforms.x.posts[0].text, 'Hello');
    },
    json: { id: 'd1' },
  });

  try {
    const result = await runCli(
      ['drafts:create', '55', '--text', 'Hello'],
      {
        cwd: sandbox.cwd,
        env: {
          HOME: sandbox.home,
          TYPEFULLY_API_BASE: baseUrl,
          TYPEFULLY_API_KEY: apiKey,
        },
      }
    );

    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1' });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('drafts:create --all targets all connected platforms', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  server.expect('GET', '/v2/social-sets/55', {
    assert: authAssertFactory(apiKey),
    json: { id: '55', platforms: { linkedin: {}, x: {}, threads: {} } },
  });

  server.expect('POST', '/v2/social-sets/55/drafts', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.deepEqual(Object.keys(req.bodyJson.platforms), ['x', 'linkedin', 'threads']);
    },
    json: { id: 'd1' },
  });

  try {
    const result = await runCli(
      ['drafts:create', '55', '--all', '--text', 'Hello'],
      {
        cwd: sandbox.cwd,
        env: {
          HOME: sandbox.home,
          TYPEFULLY_API_BASE: baseUrl,
          TYPEFULLY_API_KEY: apiKey,
        },
      }
    );

    assert.equal(result.code, 0);
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('drafts:schedule sends publish_at payload', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  server.expect('PATCH', '/v2/social-sets/9/drafts/d1', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.deepEqual(req.bodyJson, { publish_at: 'next-free-slot' });
    },
    json: { id: 'd1', scheduled: true },
  });

  try {
    const result = await runCli(
      ['drafts:schedule', '9', 'd1', '--time', 'next-free-slot'],
      {
        cwd: sandbox.cwd,
        env: {
          HOME: sandbox.home,
          TYPEFULLY_API_BASE: baseUrl,
          TYPEFULLY_API_KEY: apiKey,
        },
      }
    );

    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1', scheduled: true });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('tags:list + tags:create hit expected endpoints', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  server.expect('GET', '/v2/social-sets/9/tags', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.equal(req.search, '?limit=50');
    },
    json: { results: [{ id: 't1', name: 'owner/me' }] },
  });

  server.expect('POST', '/v2/social-sets/9/tags', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.deepEqual(req.bodyJson, { name: 'New Tag' });
    },
    json: { id: 't2', name: 'New Tag' },
  });

  try {
    const listRes = await runCli(['tags:list', '9'], {
      cwd: sandbox.cwd,
      env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey },
    });
    assert.equal(listRes.code, 0);
    assert.deepEqual(parseJsonOrNull(listRes.stdout), { results: [{ id: 't1', name: 'owner/me' }] });

    const createRes = await runCli(['tags:create', '9', '--name', 'New Tag'], {
      cwd: sandbox.cwd,
      env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey },
    });
    assert.equal(createRes.code, 0);
    assert.deepEqual(parseJsonOrNull(createRes.stdout), { id: 't2', name: 'New Tag' });

    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('media:upload uses presigned URL and does not set Content-Type on PUT', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  const mediaFilePath = path.join(sandbox.cwd, 'img.jpg');
  await fs.writeFile(mediaFilePath, Buffer.from('fake'));

  // 1) Request presigned URL
  server.expect('POST', '/v2/social-sets/9/media/upload', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.equal(req.bodyJson.file_name, 'img.jpg');
    },
    json: {
      upload_url: baseUrl.replace('/v2', '') + '/upload/m1',
      media_id: 'm1',
    },
  });

  // 2) Upload PUT (no JSON response expected)
  server.expect('PUT', '/upload/m1', {
    assert: (req) => {
      // This is the bug we previously fixed: do not set Content-Type for presigned uploads.
      assert.equal(req.headers['content-type'], undefined);
      assert.equal(req.bodyText, 'fake');
    },
    json: { ok: true },
  });

  try {
    const result = await runCli(
      ['media:upload', '9', mediaFilePath, '--no-wait'],
      {
        cwd: sandbox.cwd,
        env: {
          HOME: sandbox.home,
          TYPEFULLY_API_BASE: baseUrl,
          TYPEFULLY_API_KEY: apiKey,
        },
      }
    );

    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), {
      media_id: 'm1',
      message: 'Upload complete. Use media:status to check processing.',
    });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('me:get hits /me', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  server.expect('GET', '/v2/me', {
    assert: authAssertFactory(apiKey),
    json: { id: 'u1', email: 'test@example.com' },
  });

  try {
    const result = await runCli(['me:get'], {
      cwd: sandbox.cwd,
      env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey },
    });
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'u1', email: 'test@example.com' });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('social-sets:list hits /social-sets?limit=50', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  server.expect('GET', '/v2/social-sets', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.equal(req.search, '?limit=50');
    },
    json: { results: [{ id: 's1', name: 'Main' }] },
  });

  try {
    const result = await runCli(['social-sets:list'], {
      cwd: sandbox.cwd,
      env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey },
    });
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { results: [{ id: 's1', name: 'Main' }] });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('social-sets:get can use default social set from local config', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  // Default social set configured locally.
  const cfgDir = path.join(sandbox.cwd, '.typefully');
  await fs.mkdir(cfgDir, { recursive: true });
  await fs.writeFile(path.join(cfgDir, 'config.json'), JSON.stringify({ defaultSocialSetId: '222' }, null, 2));

  server.expect('GET', '/v2/social-sets/222', {
    assert: authAssertFactory(apiKey),
    json: { id: '222', platforms: { x: {} } },
  });

  try {
    const result = await runCli(['social-sets:get'], {
      cwd: sandbox.cwd,
      env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey },
    });
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: '222', platforms: { x: {} } });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('drafts:list builds query params (status/tag/sort/limit)', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  server.expect('GET', '/v2/social-sets/9/drafts', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      const q = new URL('http://x' + req.path + req.search).searchParams;
      assert.equal(q.get('limit'), '3');
      assert.equal(q.get('status'), 'scheduled');
      assert.equal(q.get('tag'), 'owner/me');
      assert.equal(q.get('order_by'), '-created_at');
    },
    json: { results: [{ id: 'd1' }] },
  });

  try {
    const result = await runCli(
      ['drafts:list', '9', '--limit', '3', '--status', 'scheduled', '--tag', 'owner/me', '--sort', '-created_at'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { results: [{ id: 'd1' }] });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('drafts:publish sends publish_at=now', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  server.expect('PATCH', '/v2/social-sets/9/drafts/d1', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.deepEqual(req.bodyJson, { publish_at: 'now' });
    },
    json: { id: 'd1', published: true },
  });

  try {
    const result = await runCli(
      ['drafts:publish', '9', 'd1'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1', published: true });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('drafts:delete uses DELETE and returns success payload', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  server.expect('DELETE', '/v2/social-sets/9/drafts/d1', {
    assert: authAssertFactory(apiKey),
    json: {},
  });

  try {
    const result = await runCli(
      ['drafts:delete', '9', 'd1'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { success: true, message: 'Draft deleted' });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('media:status hits /media/<id> with default social set when omitted', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  // Default social set configured locally.
  const cfgDir = path.join(sandbox.cwd, '.typefully');
  await fs.mkdir(cfgDir, { recursive: true });
  await fs.writeFile(path.join(cfgDir, 'config.json'), JSON.stringify({ defaultSocialSetId: '9' }, null, 2));

  server.expect('GET', '/v2/social-sets/9/media/m1', {
    assert: authAssertFactory(apiKey),
    json: { id: 'm1', status: 'ready' },
  });

  try {
    const result = await runCli(
      ['media:status', 'm1'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'm1', status: 'ready' });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('setup (non-interactive) writes local config and validates default social set', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();

  server.expect('GET', '/v2/social-sets/123', {
    assert: authAssertFactory('typ_setup_key'),
    json: { id: '123', platforms: { x: {} } },
  });

  try {
    const result = await runCli(
      ['setup', '--key', 'typ_setup_key', '--location', 'local', '--default-social-set', '123'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl } }
    );

    assert.equal(result.code, 0);
    const out = parseJsonOrNull(result.stdout);
    assert.equal(out?.success, true);

    const cfg = JSON.parse(await fs.readFile(path.join(sandbox.cwd, '.typefully', 'config.json'), 'utf8'));
    assert.equal(cfg.apiKey, 'typ_setup_key');
    assert.equal(cfg.defaultSocialSetId, '123');

    const gitignore = await fs.readFile(path.join(sandbox.cwd, '.gitignore'), 'utf8');
    assert.ok(gitignore.includes('.typefully/'));

    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('drafts:update with no update fields errors (message mentions --tags)', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();

  try {
    const result = await runCli(
      ['drafts:update', '9', 'd1'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: 'typ_test_key' } }
    );
    assert.equal(result.code, 1);
    assert.deepEqual(parseJsonOrNull(result.stdout), {
      error: 'At least one of --text, --file, --title, --schedule, --share, --notes, or --tags is required',
    });
    assert.equal(server.requests.length, 0);
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('drafts:update can clear tags with --tags \"\" (sends empty array)', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  server.expect('PATCH', '/v2/social-sets/9/drafts/d1', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.deepEqual(req.bodyJson, { tags: [] });
    },
    json: { id: 'd1', ok: true },
  });

  try {
    const result = await runCli(
      ['drafts:update', '9', 'd1', '--tags', ''],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1', ok: true });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('drafts:create splits threads on --- and attaches media only to first post', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  server.expect('POST', '/v2/social-sets/9/drafts', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      const posts = req.bodyJson.platforms.x.posts;
      assert.equal(posts.length, 2);
      assert.deepEqual(posts[0], { text: 'First', media_ids: ['m1', 'm2'] });
      assert.deepEqual(posts[1], { text: 'Second' });
    },
    json: { id: 'd1' },
  });

  try {
    const threadText = 'First\n---\nSecond';
    const result = await runCli(
      ['drafts:create', '9', '--platform', 'x', '--text', threadText, '--media', 'm1,m2'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1' });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('drafts:create thread splitting supports CRLF (\\r\\n)', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  server.expect('POST', '/v2/social-sets/9/drafts', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      const posts = req.bodyJson.platforms.x.posts;
      assert.equal(posts.length, 2);
      assert.deepEqual(posts[0], { text: 'First', media_ids: ['m1', 'm2'] });
      assert.deepEqual(posts[1], { text: 'Second' });
    },
    json: { id: 'd1' },
  });

  try {
    const threadText = 'First\r\n---\r\nSecond';
    const result = await runCli(
      ['drafts:create', '9', '--platform', 'x', '--text', threadText, '--media', 'm1,m2'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1' });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('drafts:update --append fetches existing draft and appends a new post', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  server.expect('GET', '/v2/social-sets/9/drafts/d1', {
    assert: authAssertFactory(apiKey),
    json: {
      id: 'd1',
      platforms: {
        x: {
          enabled: true,
          posts: [{ text: 'Old' }],
        },
      },
    },
  });

  server.expect('PATCH', '/v2/social-sets/9/drafts/d1', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.deepEqual(req.bodyJson, {
        platforms: {
          x: {
            enabled: true,
            posts: [{ text: 'Old' }, { text: 'New', media_ids: ['m1'] }],
          },
        },
      });
    },
    json: { id: 'd1', ok: true },
  });

  try {
    const result = await runCli(
      ['drafts:update', '9', 'd1', '--append', '--text', 'New', '--media', 'm1'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1', ok: true });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('drafts:update replaces posts and attaches media only to first post', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  server.expect('GET', '/v2/social-sets/9/drafts/d1', {
    assert: authAssertFactory(apiKey),
    json: {
      id: 'd1',
      platforms: {
        x: { enabled: true, posts: [{ text: 'Old' }] },
      },
    },
  });

  server.expect('PATCH', '/v2/social-sets/9/drafts/d1', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      const posts = req.bodyJson.platforms.x.posts;
      assert.deepEqual(posts, [
        { text: 'First', media_ids: ['m1'] },
        { text: 'Second' },
      ]);
    },
    json: { id: 'd1', ok: true },
  });

  try {
    const result = await runCli(
      ['drafts:update', '9', 'd1', '--text', 'First\n---\nSecond', '--media', 'm1'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1', ok: true });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('help command prints usage and exits 0', async () => {
  const sandbox = await makeSandbox();
  try {
    const result = await runCli(['help'], {
      cwd: sandbox.cwd,
      env: { HOME: sandbox.home, TYPEFULLY_API_KEY: '' },
    });
    assert.equal(result.code, 0);
    assert.ok(result.stdout.includes('Typefully CLI - Manage social media posts'));
    assert.ok(result.stdout.includes('USAGE:'));
  } finally {
    await sandbox.cleanup();
  }
});

test('config:show returns configured=false when no API key configured', async () => {
  const sandbox = await makeSandbox();
  try {
    const result = await runCli(['config:show'], {
      cwd: sandbox.cwd,
      env: { HOME: sandbox.home, TYPEFULLY_API_KEY: '' },
    });
    assert.equal(result.code, 0);
    const out = parseJsonOrNull(result.stdout);
    assert.deepEqual(out, {
      configured: false,
      hint: 'Run: typefully.js setup',
      api_key_url: 'https://typefully.com/?settings=api',
    });
  } finally {
    await sandbox.cleanup();
  }
});

test('config:show reads local config and reports default social set source', async () => {
  const sandbox = await makeSandbox();
  try {
    const cfgDir = path.join(sandbox.cwd, '.typefully');
    await fs.mkdir(cfgDir, { recursive: true });
    await fs.writeFile(
      path.join(cfgDir, 'config.json'),
      JSON.stringify({ apiKey: 'typ_local_key', defaultSocialSetId: '123' }, null, 2)
    );

    const result = await runCli(['config:show'], {
      cwd: sandbox.cwd,
      env: { HOME: sandbox.home, TYPEFULLY_API_KEY: '' },
    });

    assert.equal(result.code, 0);
    const out = parseJsonOrNull(result.stdout);
    assert.equal(out.configured, true);
    assert.ok(out.active_source.endsWith(path.join('.typefully', 'config.json')));
    assert.equal(out.api_key_preview, 'typ_loca...');
    assert.equal(out.default_social_set.id, '123');
    assert.ok(out.default_social_set.source.endsWith(path.join('.typefully', 'config.json')));
    // macOS can surface temp paths as /var/... or /private/var/..., so compare realpaths.
    assert.equal(
      await fs.realpath(out.default_social_set.source),
      await fs.realpath(path.join(cfgDir, 'config.json'))
    );
    assert.equal(out.config_files.local.has_key, true);
    assert.equal(out.config_files.local.has_default_social_set, true);
  } finally {
    await sandbox.cleanup();
  }
});

test('setup --no-default (non-interactive) writes local config without calling API', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();

  try {
    const result = await runCli(
      ['setup', '--key', 'typ_setup_key', '--location', 'local', '--no-default'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl } }
    );
    assert.equal(result.code, 0);
    const out = parseJsonOrNull(result.stdout);
    assert.equal(out.success, true);
    assert.equal(out.default_social_set_id, null);

    const cfg = JSON.parse(await fs.readFile(path.join(sandbox.cwd, '.typefully', 'config.json'), 'utf8'));
    assert.equal(cfg.apiKey, 'typ_setup_key');
    assert.equal(cfg.defaultSocialSetId, undefined);
    assert.equal(server.requests.length, 0);
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('drafts:create supports title/schedule/share/notes/tags/reply-to/community', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  server.expect('POST', '/v2/social-sets/9/drafts', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.deepEqual(req.bodyJson, {
        platforms: {
          x: {
            enabled: true,
            posts: [{ text: 'Hello' }],
            settings: {
              reply_to_url: 'https://x.com/user/status/123',
              community_id: '999',
            },
          },
        },
        draft_title: 'Title',
        publish_at: 'now',
        tags: ['a', 'b'],
        share: true,
        scratchpad_text: 'Some notes',
      });
    },
    json: { id: 'd1' },
  });

  try {
    const result = await runCli(
      [
        'drafts:create',
        '9',
        '--platform',
        'x',
        '--text',
        'Hello',
        '--title',
        'Title',
        '--schedule',
        'now',
        '--tags',
        'a,b',
        '--share',
        '--scratchpad',
        'Some notes',
        '--reply-to',
        'https://x.com/user/status/123',
        '--community',
        '999',
      ],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1' });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('drafts:create reads from file via -f', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  const filePath = path.join(sandbox.cwd, 'post.txt');
  await fs.writeFile(filePath, 'From file');

  server.expect('POST', '/v2/social-sets/9/drafts', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.equal(req.bodyJson.platforms.x.posts[0].text, 'From file');
    },
    json: { id: 'd1' },
  });

  try {
    const result = await runCli(
      ['drafts:create', '9', '--platform', 'x', '-f', filePath],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('drafts:create errors when both --all and --platform are provided', async () => {
  const sandbox = await makeSandbox();
  try {
    const result = await runCli(
      ['drafts:create', '9', '--all', '--platform', 'x', '--text', 'Hello'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_KEY: 'typ_test_key' } }
    );
    assert.equal(result.code, 1);
    assert.deepEqual(parseJsonOrNull(result.stdout), { error: 'Cannot use both --all and --platform flags' });
  } finally {
    await sandbox.cleanup();
  }
});

test('drafts:create errors when neither --text nor --file are provided', async () => {
  const sandbox = await makeSandbox();
  try {
    const result = await runCli(
      ['drafts:create', '9', '--platform', 'x'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_KEY: 'typ_test_key' } }
    );
    assert.equal(result.code, 1);
    assert.deepEqual(parseJsonOrNull(result.stdout), { error: '--text or --file is required' });
  } finally {
    await sandbox.cleanup();
  }
});

test('drafts:update supports title/schedule/share/notes without fetching existing draft', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  server.expect('PATCH', '/v2/social-sets/9/drafts/d1', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.deepEqual(req.bodyJson, {
        draft_title: 'Title',
        publish_at: 'now',
        share: true,
        scratchpad_text: 'Notes',
        tags: ['t1'],
      });
    },
    json: { id: 'd1', ok: true },
  });

  try {
    const result = await runCli(
      ['drafts:update', '9', 'd1', '--title', 'Title', '--schedule', 'now', '--share', '--notes', 'Notes', '--tags', 't1'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.equal(server.requests.length, 1);
    server.assertNoPendingExpectations();
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1', ok: true });
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('drafts:update reads from file via -f and can target multiple platforms', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  const filePath = path.join(sandbox.cwd, 'thread.txt');
  await fs.writeFile(filePath, 'First\n---\nSecond');

  server.expect('GET', '/v2/social-sets/9/drafts/d1', {
    assert: authAssertFactory(apiKey),
    json: { id: 'd1', platforms: { x: { enabled: true, posts: [{ text: 'Old' }] } } },
  });

  server.expect('PATCH', '/v2/social-sets/9/drafts/d1', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.deepEqual(req.bodyJson, {
        platforms: {
          x: {
            enabled: true,
            posts: [{ text: 'First', media_ids: ['m1'] }, { text: 'Second' }],
          },
          linkedin: {
            enabled: true,
            posts: [{ text: 'First', media_ids: ['m1'] }, { text: 'Second' }],
          },
        },
      });
    },
    json: { id: 'd1', ok: true },
  });

  try {
    const result = await runCli(
      ['drafts:update', '9', 'd1', '--platform', 'x,linkedin', '-f', filePath, '--media', 'm1'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    server.assertNoPendingExpectations();
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1', ok: true });
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('drafts:update supports -a shorthand for --append', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  server.expect('GET', '/v2/social-sets/9/drafts/d1', {
    assert: authAssertFactory(apiKey),
    json: {
      id: 'd1',
      platforms: {
        x: { enabled: true, posts: [{ text: 'Old' }] },
      },
    },
  });

  server.expect('PATCH', '/v2/social-sets/9/drafts/d1', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.deepEqual(req.bodyJson, {
        platforms: {
          x: { enabled: true, posts: [{ text: 'Old' }, { text: 'New' }] },
        },
      });
    },
    json: { id: 'd1', ok: true },
  });

  try {
    const result = await runCli(
      ['drafts:update', '9', 'd1', '-a', '--text', 'New'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('default social set safety: drafts:update/delete/schedule/publish require --use-default with a single arg', async () => {
  const sandbox = await makeSandbox();

  const cfgDir = path.join(sandbox.cwd, '.typefully');
  await fs.mkdir(cfgDir, { recursive: true });
  await fs.writeFile(path.join(cfgDir, 'config.json'), JSON.stringify({ defaultSocialSetId: '9' }, null, 2));

  try {
    for (const args of [
      ['drafts:update', 'd1', '--title', 'T'],
      ['drafts:delete', 'd1'],
      ['drafts:schedule', 'd1', '--time', 'next-free-slot'],
      ['drafts:publish', 'd1'],
    ]) {
      const result = await runCli(args, {
        cwd: sandbox.cwd,
        env: { HOME: sandbox.home, TYPEFULLY_API_KEY: 'typ_test_key' },
      });
      assert.equal(result.code, 1);
      const out = parseJsonOrNull(result.stdout);
      assert.ok(out?.error?.includes('Ambiguous arguments'));
    }
  } finally {
    await sandbox.cleanup();
  }
});

test('drafts:schedule/delete/publish work with --use-default and configured default social set', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  const cfgDir = path.join(sandbox.cwd, '.typefully');
  await fs.mkdir(cfgDir, { recursive: true });
  await fs.writeFile(path.join(cfgDir, 'config.json'), JSON.stringify({ defaultSocialSetId: '9' }, null, 2));

  server.expect('PATCH', '/v2/social-sets/9/drafts/d1', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.deepEqual(req.bodyJson, { publish_at: 'next-free-slot' });
    },
    json: { id: 'd1', scheduled: true },
  });

  server.expect('PATCH', '/v2/social-sets/9/drafts/d1', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.deepEqual(req.bodyJson, { publish_at: 'now' });
    },
    json: { id: 'd1', published: true },
  });

  server.expect('DELETE', '/v2/social-sets/9/drafts/d1', {
    assert: authAssertFactory(apiKey),
    json: {},
  });

  try {
    const sched = await runCli(['drafts:schedule', 'd1', '--time', 'next-free-slot', '--use-default'], {
      cwd: sandbox.cwd,
      env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey },
    });
    assert.equal(sched.code, 0);

    const pub = await runCli(['drafts:publish', 'd1', '--use-default'], {
      cwd: sandbox.cwd,
      env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey },
    });
    assert.equal(pub.code, 0);

    const del = await runCli(['drafts:delete', 'd1', '--use-default'], {
      cwd: sandbox.cwd,
      env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey },
    });
    assert.equal(del.code, 0);

    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('drafts:list accepts --social_set_id (snake_case)', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  server.expect('GET', '/v2/social-sets/9/drafts', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.equal(req.search, '?limit=1');
    },
    json: { results: [] },
  });

  try {
    const result = await runCli(['drafts:list', '--social_set_id', '9', '--limit', '1'], {
      cwd: sandbox.cwd,
      env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey },
    });
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { results: [] });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('media:upload can use --social-set-id when only a file arg is provided', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  const mediaFilePath = path.join(sandbox.cwd, 'img.jpg');
  await fs.writeFile(mediaFilePath, Buffer.from('fake'));

  server.expect('POST', '/v2/social-sets/9/media/upload', {
    assert: authAssertFactory(apiKey),
    json: {
      upload_url: baseUrl.replace('/v2', '') + '/upload/m1',
      media_id: 'm1',
    },
  });

  server.expect('PUT', '/upload/m1', {
    assert: (req) => {
      assert.equal(req.headers['content-type'], undefined);
      assert.equal(req.bodyText, 'fake');
    },
    json: { ok: true },
  });

  try {
    const result = await runCli(
      ['media:upload', mediaFilePath, '--social-set-id', '9', '--no-wait'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('media:upload polling path works (uses --timeout and fast poll interval override)', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  const mediaFilePath = path.join(sandbox.cwd, 'img.jpg');
  await fs.writeFile(mediaFilePath, Buffer.from('fake'));

  server.expect('POST', '/v2/social-sets/9/media/upload', {
    assert: authAssertFactory(apiKey),
    json: {
      upload_url: baseUrl.replace('/v2', '') + '/upload/m1',
      media_id: 'm1',
    },
  });

  server.expect('PUT', '/upload/m1', {
    assert: (req) => {
      assert.equal(req.headers['content-type'], undefined);
      assert.equal(req.bodyText, 'fake');
    },
    json: { ok: true },
  });

  server.expect('GET', '/v2/social-sets/9/media/m1', {
    assert: authAssertFactory(apiKey),
    json: { id: 'm1', status: 'processing' },
  });

  server.expect('GET', '/v2/social-sets/9/media/m1', {
    assert: authAssertFactory(apiKey),
    json: { id: 'm1', status: 'ready' },
  });

  try {
    const result = await runCli(
      ['media:upload', '9', mediaFilePath, '--timeout', '1'],
      {
        cwd: sandbox.cwd,
        env: {
          HOME: sandbox.home,
          TYPEFULLY_API_BASE: baseUrl,
          TYPEFULLY_API_KEY: apiKey,
          TYPEFULLY_MEDIA_POLL_INTERVAL_MS: '10',
        },
        timeoutMs: 5000,
      }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), {
      media_id: 'm1',
      status: 'ready',
      message: 'Media uploaded and ready to use',
    });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('help aliases: --help and -h print usage', async () => {
  const sandbox = await makeSandbox();
  try {
    const res1 = await runCli(['--help'], { cwd: sandbox.cwd, env: { HOME: sandbox.home } });
    assert.equal(res1.code, 0);
    assert.ok(res1.stdout.includes('Typefully CLI'));

    const res2 = await runCli(['-h'], { cwd: sandbox.cwd, env: { HOME: sandbox.home } });
    assert.equal(res2.code, 0);
    assert.ok(res2.stdout.includes('Typefully CLI'));
  } finally {
    await sandbox.cleanup();
  }
});

test('setup supports --scope as alias for --location (non-interactive)', async () => {
  const sandbox = await makeSandbox();
  try {
    const result = await runCli(
      ['setup', '--key', 'typ_setup_key', '--scope', 'local', '--no-default'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home } }
    );

    assert.equal(result.code, 0);
    const out = parseJsonOrNull(result.stdout);
    assert.equal(out?.success, true);
    assert.equal(out?.scope, 'local');

    const cfg = JSON.parse(await fs.readFile(path.join(sandbox.cwd, '.typefully', 'config.json'), 'utf8'));
    assert.equal(cfg.apiKey, 'typ_setup_key');
    assert.ok((await fs.readFile(path.join(sandbox.cwd, '.gitignore'), 'utf8')).includes('.typefully/'));
  } finally {
    await sandbox.cleanup();
  }
});

test('config:set-default supports --social_set_id and --scope', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  server.expect('GET', '/v2/social-sets/123', {
    assert: authAssertFactory(apiKey),
    json: { id: '123', platforms: { x: {} } },
  });

  try {
    const result = await runCli(
      ['config:set-default', '--social_set_id', '123', '--scope', 'local'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );

    assert.equal(result.code, 0);
    const out = parseJsonOrNull(result.stdout);
    assert.equal(out?.success, true);
    assert.equal(out?.default_social_set_id, '123');

    const cfg = JSON.parse(await fs.readFile(path.join(sandbox.cwd, '.typefully', 'config.json'), 'utf8'));
    assert.equal(cfg.defaultSocialSetId, '123');

    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('drafts:create reads from file via --file (long form)', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  const filePath = path.join(sandbox.cwd, 'post.txt');
  await fs.writeFile(filePath, 'Hello from file', 'utf8');

  server.expect('POST', '/v2/social-sets/9/drafts', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.equal(req.bodyJson.platforms.x.posts[0].text, 'Hello from file');
    },
    json: { id: 'd1' },
  });

  try {
    const result = await runCli(
      ['drafts:create', '9', '--platform', 'x', '--file', filePath],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1' });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('drafts:update reads from file via --file (long form)', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  const filePath = path.join(sandbox.cwd, 'post.txt');
  await fs.writeFile(filePath, 'Updated from file', 'utf8');

  server.expect('GET', '/v2/social-sets/9/drafts/d1', {
    assert: authAssertFactory(apiKey),
    json: { id: 'd1', platforms: { x: { enabled: true, posts: [{ text: 'Old' }] } } },
  });

  server.expect('PATCH', '/v2/social-sets/9/drafts/d1', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.equal(req.bodyJson.platforms.x.posts[0].text, 'Updated from file');
    },
    json: { id: 'd1', ok: true },
  });

  try {
    const result = await runCli(
      ['drafts:update', '9', 'd1', '--platform', 'x', '--file', filePath],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1', ok: true });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('media:upload uses configured default social set when only file arg is provided', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  // Default social set configured locally.
  const cfgDir = path.join(sandbox.cwd, '.typefully');
  await fs.mkdir(cfgDir, { recursive: true });
  await fs.writeFile(path.join(cfgDir, 'config.json'), JSON.stringify({ defaultSocialSetId: '9' }, null, 2));

  const mediaFilePath = path.join(sandbox.cwd, 'img.jpg');
  await fs.writeFile(mediaFilePath, Buffer.from('fake'));

  server.expect('POST', '/v2/social-sets/9/media/upload', {
    assert: authAssertFactory(apiKey),
    json: {
      upload_url: baseUrl.replace('/v2', '') + '/upload/m1',
      media_id: 'm1',
    },
  });

  server.expect('PUT', '/upload/m1', {
    assert: (req) => {
      assert.equal(req.headers['content-type'], undefined);
      assert.equal(req.bodyText, 'fake');
    },
    json: { ok: true },
  });

  try {
    const result = await runCli(
      ['media:upload', mediaFilePath, '--no-wait'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), {
      media_id: 'm1',
      message: 'Upload complete. Use media:status to check processing.',
    });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('drafts:schedule errors when --time is missing', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();

  try {
    const result = await runCli(
      ['drafts:schedule', '9', 'd1'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: 'typ_test_key' } }
    );
    assert.equal(result.code, 1);
    assert.deepEqual(parseJsonOrNull(result.stdout), {
      error: '--time is required (use "next-free-slot" or ISO datetime)',
    });
    assert.equal(server.requests.length, 0);
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('global flag: drafts:list accepts --social-set-id (kebab-case)', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  server.expect('GET', '/v2/social-sets/9/drafts', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.equal(req.search, '?limit=10');
    },
    json: { results: [] },
  });

  try {
    const result = await runCli(
      ['drafts:list', '--social-set-id', '9'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { results: [] });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('global flag: drafts:create accepts --social-set-id (kebab-case) with no positional social set', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  server.expect('POST', '/v2/social-sets/9/drafts', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.equal(req.bodyJson.platforms.x.posts[0].text, 'Hello');
    },
    json: { id: 'd1' },
  });

  try {
    const result = await runCli(
      ['drafts:create', '--social-set-id', '9', '--platform', 'x', '--text', 'Hello'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1' });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('global flag: tags:list accepts --social-set-id (kebab-case) with no positional social set', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  server.expect('GET', '/v2/social-sets/9/tags', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.equal(req.search, '?limit=50');
    },
    json: { results: [] },
  });

  try {
    const result = await runCli(
      ['tags:list', '--social-set-id', '9'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { results: [] });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});
