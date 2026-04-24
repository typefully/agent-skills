const {
  describe,
  it,
  assert,
  withCliHarness,
  authAssertFactory,
  expectCliOk,
  expectCliError,
} = require('./typefully-cli.test-helpers');

function queryParams(req) {
  return new URL(`http://x${req.path}${req.search}`).searchParams;
}

describe('analytics:followers:get', () => {
  it('fetches X follower analytics with optional date range', withCliHarness(async ({ server, apiKey, run }) => {
    server.expect('GET', '/v2/social-sets/9/analytics/x/followers', {
      assert: (req) => {
        authAssertFactory(apiKey)(req);
        const q = queryParams(req);
        assert.equal(q.get('start_date'), '2026-03-01');
        assert.equal(q.get('end_date'), '2026-03-31');
      },
      json: {
        platform: 'x',
        current_followers_count: 1500,
        data: [{ date: '2026-03-31', followers_count: 1500 }],
      },
    });

    const result = await run([
      'analytics:followers:get',
      '9',
      '--start-date',
      '2026-03-01',
      '--end-date',
      '2026-03-31',
    ]);

    expectCliOk(result, {
      platform: 'x',
      current_followers_count: 1500,
      data: [{ date: '2026-03-31', followers_count: 1500 }],
    });
  }));

  it('omits date query params when default range is requested', withCliHarness(async ({ server, apiKey, run }) => {
    server.expect('GET', '/v2/social-sets/9/analytics/x/followers', {
      assert: (req) => {
        authAssertFactory(apiKey)(req);
        assert.equal(req.search, '');
      },
      json: { platform: 'x', current_followers_count: null, data: [] },
    });

    const result = await run(['analytics:followers:get', '9']);
    expectCliOk(result, { platform: 'x', current_followers_count: null, data: [] });
  }));

  it('rejects unsupported analytics platforms before making requests', withCliHarness(async ({ server, run }) => {
    const result = await run(['analytics:followers:get', '9', '--platform', 'linkedin']);

    expectCliError(result, {
      error: 'Only X analytics are currently supported by the Typefully API',
      provided_platform: 'linkedin',
      hint: 'Use --platform x or omit the flag',
    });
    assert.equal(server.requests.length, 0);
  }));
});
