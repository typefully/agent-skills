const { test, assert, http, spawn, fs, path, os, mkdtemp, makeSandbox, runCli, parseJsonOrNull, createMockServer, authAssertFactory } = require('./typefully-cli.test-helpers');

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
