const {
  describe,
  it,
  assert,
  withCliHarness,
  authAssertFactory,
  expectCliOk,
} = require('./typefully-cli.test-helpers');

describe('tags:list', () => {
  it('hits /tags?limit=50', withCliHarness(async ({ server, apiKey, run }) => {
    server.expect('GET', '/v2/social-sets/9/tags', {
      assert: (req) => {
        authAssertFactory(apiKey)(req);
        assert.equal(req.search, '?limit=50');
      },
      json: { results: [{ id: 't1', name: 'owner/me' }] },
    });

    const result = await run(['tags:list', '9']);
    expectCliOk(result, { results: [{ id: 't1', name: 'owner/me' }] });
  }));
});

describe('tags:create', () => {
  it('sends tag name payload', withCliHarness(async ({ server, apiKey, run }) => {
    server.expect('POST', '/v2/social-sets/9/tags', {
      assert: (req) => {
        authAssertFactory(apiKey)(req);
        assert.deepEqual(req.bodyJson, { name: 'New Tag' });
      },
      json: { id: 't2', name: 'New Tag' },
    });

    const result = await run(['tags:create', '9', '--name', 'New Tag']);
    expectCliOk(result, { id: 't2', name: 'New Tag' });
  }));
});
