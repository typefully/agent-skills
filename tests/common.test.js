const {
  describe,
  it,
  assert,
  withCliHarness,
  authAssertFactory,
  expectCliOk,
  expectCliError,
} = require('./typefully-cli.test-helpers');

describe('argument parsing', () => {
  it('errors cleanly when a value-taking alias is missing its value', withCliHarness(async ({ server, run }) => {
    const result = await run(['create-draft', 'hi', '--social-set-id', '123', '--tags', '--share']);

    expectCliError(result, { error: '--tags requires a value' });
    assert.equal(server.requests.length, 0);
  }));

  it('errors cleanly when --social-set-id is missing a value', withCliHarness(async ({ server, run }) => {
    const result = await run(['drafts:list', '--social-set-id']);

    expectCliError(result, { error: '--social-set-id (or --social_set_id) requires a value' });
    assert.equal(server.requests.length, 0);
  }));

  it('errors when positional social_set_id conflicts with --social-set-id', withCliHarness(async ({ server, run }) => {
    const result = await run(['drafts:list', '111', '--social-set-id', '222']);

    expectCliError(result, {
      error: 'Conflicting social_set_id values',
      positional: '111',
      flag: '222',
    });
    assert.equal(server.requests.length, 0);
  }));
});

describe('help', () => {
  it('prints usage for help command', withCliHarness(async ({ run }) => {
    const result = await run(['help'], { env: { TYPEFULLY_API_KEY: '' } });

    expectCliOk(result);
    assert.ok(result.stdout.includes('Typefully CLI - Manage social media posts'));
    assert.ok(result.stdout.includes('USAGE:'));
  }));

  it('supports --help and -h aliases', withCliHarness(async ({ run }) => {
    const longResult = await run(['--help']);
    expectCliOk(longResult);
    assert.ok(longResult.stdout.includes('Typefully CLI'));

    const shortResult = await run(['-h']);
    expectCliOk(shortResult);
    assert.ok(shortResult.stdout.includes('Typefully CLI'));
  }));
});

describe('global flag behavior', () => {
  it('allows tags:list with --social-set-id and no positional social set', withCliHarness(async ({ server, apiKey, run }) => {
    server.expect('GET', '/v2/social-sets/9/tags', {
      assert: (req) => {
        authAssertFactory(apiKey)(req);
        assert.equal(req.search, '?limit=50');
      },
      json: { results: [] },
    });

    const result = await run(['tags:list', '--social-set-id', '9']);
    expectCliOk(result, { results: [] });
  }));
});
