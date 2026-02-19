const { test, assert, http, spawn, fs, path, os, mkdtemp, makeSandbox, runCli, parseJsonOrNull, createMockServer, authAssertFactory } = require('./typefully-cli.test-helpers');

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
