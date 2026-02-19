const { describe, it, withCliHarness, authAssertFactory, expectCliOk } = require('./typefully-cli.test-helpers');

describe('me:get', () => {
  it('hits /me', withCliHarness(async ({ server, apiKey, run }) => {
    server.expect('GET', '/v2/me', {
      assert: authAssertFactory(apiKey),
      json: { id: 'u1', email: 'test@example.com' },
    });

    const result = await run(['me:get']);
    expectCliOk(result, { id: 'u1', email: 'test@example.com' });
  }));
});
