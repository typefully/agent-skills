const {
  describe,
  it,
  assert,
  withCliHarness,
  authAssertFactory,
  expectCliOk,
} = require('./typefully-cli.test-helpers');

describe('social-sets:list', () => {
  it('hits /social-sets?limit=50', withCliHarness(async ({ server, apiKey, run }) => {
    server.expect('GET', '/v2/social-sets', {
      assert: (req) => {
        authAssertFactory(apiKey)(req);
        assert.equal(req.search, '?limit=50');
      },
      json: { results: [{ id: 's1', name: 'Main' }] },
    });

    const result = await run(['social-sets:list']);
    expectCliOk(result, { results: [{ id: 's1', name: 'Main' }] });
  }));
});

describe('social-sets:get', () => {
  it('uses default social set from local config when ID is omitted', withCliHarness(async ({ server, apiKey, run, writeLocalConfig }) => {
    await writeLocalConfig({ defaultSocialSetId: '222' });

    server.expect('GET', '/v2/social-sets/222', {
      assert: authAssertFactory(apiKey),
      json: { id: '222', platforms: { x: {} } },
    });

    const result = await run(['social-sets:get']);
    expectCliOk(result, { id: '222', platforms: { x: {} } });
  }));
});
