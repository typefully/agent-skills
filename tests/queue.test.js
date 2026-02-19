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

describe('queue:get', () => {
  it('sends start_date and end_date query params', withCliHarness(async ({ server, apiKey, run }) => {
    server.expect('GET', '/v2/social-sets/9/queue', {
      assert: (req) => {
        authAssertFactory(apiKey)(req);
        const q = queryParams(req);
        assert.equal(q.get('start_date'), '2026-02-01');
        assert.equal(q.get('end_date'), '2026-02-29');
      },
      json: { social_set_id: 9, start_date: '2026-02-01', end_date: '2026-02-29', days: [] },
    });

    const result = await run(['queue:get', '9', '--start-date', '2026-02-01', '--end-date', '2026-02-29']);
    expectCliOk(result, { social_set_id: 9, start_date: '2026-02-01', end_date: '2026-02-29', days: [] });
  }));

  it('supports --start_date/--end_date and default social set', withCliHarness(async ({ server, apiKey, run, writeLocalConfig }) => {
    await writeLocalConfig({ defaultSocialSetId: '9' });

    server.expect('GET', '/v2/social-sets/9/queue', {
      assert: (req) => {
        authAssertFactory(apiKey)(req);
        const q = queryParams(req);
        assert.equal(q.get('start_date'), '2026-02-10');
        assert.equal(q.get('end_date'), '2026-02-11');
      },
      json: { social_set_id: 9, start_date: '2026-02-10', end_date: '2026-02-11', days: [] },
    });

    const result = await run(['queue:get', '--start_date', '2026-02-10', '--end_date', '2026-02-11']);
    expectCliOk(result);
  }));

  it('validates missing date args before making requests', withCliHarness(async ({ server, run }) => {
    const result = await run(['queue:get', '9', '--start-date', '2026-02-01']);

    expectCliError(result, { error: '--end-date (or --end_date) is required' });
    assert.equal(server.requests.length, 0);
  }));
});

describe('queue:schedule:get', () => {
  it('hits /queue/schedule', withCliHarness(async ({ server, apiKey, run }) => {
    server.expect('GET', '/v2/social-sets/9/queue/schedule', {
      assert: authAssertFactory(apiKey),
      json: {
        social_set_id: 9,
        timezone: 'America/New_York',
        rules: [{ h: 12, m: 0, days: ['mon', 'tue', 'wed', 'thu', 'fri'] }],
      },
    });

    const result = await run(['queue:schedule:get', '9']);
    expectCliOk(result, {
      social_set_id: 9,
      timezone: 'America/New_York',
      rules: [{ h: 12, m: 0, days: ['mon', 'tue', 'wed', 'thu', 'fri'] }],
    });
  }));
});

describe('queue:schedule:put', () => {
  it('sends parsed rules payload', withCliHarness(async ({ server, apiKey, run }) => {
    const rules = [{ h: 9, m: 30, days: ['mon', 'wed', 'fri'] }];

    server.expect('PUT', '/v2/social-sets/9/queue/schedule', {
      assert: (req) => {
        authAssertFactory(apiKey)(req);
        assert.deepEqual(req.bodyJson, { rules });
      },
      json: { social_set_id: 9, timezone: 'America/New_York', rules },
    });

    const result = await run(['queue:schedule:put', '9', '--rules', JSON.stringify(rules)]);
    expectCliOk(result, { social_set_id: 9, timezone: 'America/New_York', rules });
  }));

  [
    {
      name: 'invalid JSON',
      input: 'not-json',
      expectedError: '--rules must be valid JSON',
    },
    {
      name: 'non-array JSON',
      input: '{"h":9,"m":30,"days":["mon"]}',
      expectedError: '--rules must be a JSON array',
    },
  ].forEach(({ name, input, expectedError }) => {
    it(`returns an error for ${name}`, withCliHarness(async ({ server, run }) => {
      const result = await run(['queue:schedule:put', '9', '--rules', input]);
      expectCliError(result, { error: expectedError });
      assert.equal(server.requests.length, 0);
    }));
  });
});
