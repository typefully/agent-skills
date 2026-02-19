const { test, assert, http, spawn, fs, path, os, mkdtemp, makeSandbox, runCli, parseJsonOrNull, createMockServer, authAssertFactory } = require('./typefully-cli.test-helpers');

test('queue:get hits /queue with start_date and end_date query params', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  server.expect('GET', '/v2/social-sets/9/queue', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      const q = new URL('http://x' + req.path + req.search).searchParams;
      assert.equal(q.get('start_date'), '2026-02-01');
      assert.equal(q.get('end_date'), '2026-02-29');
    },
    json: { social_set_id: 9, start_date: '2026-02-01', end_date: '2026-02-29', days: [] },
  });

  try {
    const result = await runCli(
      ['queue:get', '9', '--start-date', '2026-02-01', '--end-date', '2026-02-29'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), {
      social_set_id: 9,
      start_date: '2026-02-01',
      end_date: '2026-02-29',
      days: [],
    });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('queue:get supports --start_date/--end_date and default social set', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  const cfgDir = path.join(sandbox.cwd, '.typefully');
  await fs.mkdir(cfgDir, { recursive: true });
  await fs.writeFile(path.join(cfgDir, 'config.json'), JSON.stringify({ defaultSocialSetId: '9' }, null, 2));

  server.expect('GET', '/v2/social-sets/9/queue', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      const q = new URL('http://x' + req.path + req.search).searchParams;
      assert.equal(q.get('start_date'), '2026-02-10');
      assert.equal(q.get('end_date'), '2026-02-11');
    },
    json: { social_set_id: 9, start_date: '2026-02-10', end_date: '2026-02-11', days: [] },
  });

  try {
    const result = await runCli(
      ['queue:get', '--start_date', '2026-02-10', '--end_date', '2026-02-11'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('queue:get validates missing date args before making requests', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();

  try {
    const result = await runCli(
      ['queue:get', '9', '--start-date', '2026-02-01'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: 'typ_test_key' } }
    );
    assert.equal(result.code, 1);
    assert.deepEqual(parseJsonOrNull(result.stdout), { error: '--end-date (or --end_date) is required' });
    assert.equal(server.requests.length, 0);
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('queue:schedule:get hits /queue/schedule', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  server.expect('GET', '/v2/social-sets/9/queue/schedule', {
    assert: authAssertFactory(apiKey),
    json: {
      social_set_id: 9,
      timezone: 'America/New_York',
      rules: [{ h: 12, m: 0, days: ['mon', 'tue', 'wed', 'thu', 'fri'] }],
    },
  });

  try {
    const result = await runCli(
      ['queue:schedule:get', '9'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), {
      social_set_id: 9,
      timezone: 'America/New_York',
      rules: [{ h: 12, m: 0, days: ['mon', 'tue', 'wed', 'thu', 'fri'] }],
    });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('queue:schedule:put sends parsed rules payload', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';
  const rules = [{ h: 9, m: 30, days: ['mon', 'wed', 'fri'] }];

  server.expect('PUT', '/v2/social-sets/9/queue/schedule', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.deepEqual(req.bodyJson, { rules });
    },
    json: {
      social_set_id: 9,
      timezone: 'America/New_York',
      rules,
    },
  });

  try {
    const result = await runCli(
      ['queue:schedule:put', '9', '--rules', JSON.stringify(rules)],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), {
      social_set_id: 9,
      timezone: 'America/New_York',
      rules,
    });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('queue:schedule:put validates JSON input', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();

  try {
    const badJsonResult = await runCli(
      ['queue:schedule:put', '9', '--rules', 'not-json'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: 'typ_test_key' } }
    );
    assert.equal(badJsonResult.code, 1);
    assert.deepEqual(parseJsonOrNull(badJsonResult.stdout), { error: '--rules must be valid JSON' });

    const nonArrayResult = await runCli(
      ['queue:schedule:put', '9', '--rules', '{"h":9,"m":30,"days":["mon"]}'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: 'typ_test_key' } }
    );
    assert.equal(nonArrayResult.code, 1);
    assert.deepEqual(parseJsonOrNull(nonArrayResult.stdout), { error: '--rules must be a JSON array' });
    assert.equal(server.requests.length, 0);
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});
