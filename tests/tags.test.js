const { test, assert, http, spawn, fs, path, os, mkdtemp, makeSandbox, runCli, parseJsonOrNull, createMockServer, authAssertFactory } = require('./typefully-cli.test-helpers');

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
