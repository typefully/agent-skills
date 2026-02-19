const { test, assert, http, spawn, fs, path, os, mkdtemp, makeSandbox, runCli, parseJsonOrNull, createMockServer, authAssertFactory } = require('./typefully-cli.test-helpers');

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
