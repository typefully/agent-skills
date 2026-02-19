const { test, assert, http, spawn, fs, path, os, mkdtemp, makeSandbox, runCli, parseJsonOrNull, createMockServer, authAssertFactory } = require('./typefully-cli.test-helpers');

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
