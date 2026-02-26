const {
  describe,
  it,
  assert,
  withCliHarness,
  authAssertFactory,
  expectCliOk,
  expectCliError,
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

describe('linkedin:organizations:resolve', () => {
  it('resolves organization URL with explicit social set', withCliHarness(async ({ server, apiKey, run }) => {
    const organizationUrl = 'https://www.linkedin.com/company/typefullycom/';

    server.expect('GET', '/v2/social-sets/222/linkedin/organizations/resolve', {
      assert: (req) => {
        authAssertFactory(apiKey)(req);
        const q = new URL(`http://x${req.path}${req.search}`).searchParams;
        assert.equal(q.get('organization_url'), organizationUrl);
      },
      json: {
        id: '86779668',
        urn: 'urn:li:organization:86779668',
        mention_text: '@[Typefully](urn:li:organization:86779668)',
      },
    });

    const result = await run([
      'linkedin:organizations:resolve',
      '222',
      '--organization-url',
      organizationUrl,
    ]);
    expectCliOk(result, {
      id: '86779668',
      urn: 'urn:li:organization:86779668',
      mention_text: '@[Typefully](urn:li:organization:86779668)',
    });
  }));

  it('uses default social set and supports --url alias', withCliHarness(async ({ server, apiKey, run, writeLocalConfig }) => {
    const organizationUrl = 'https://www.linkedin.com/company/typefullycom/';
    await writeLocalConfig({ defaultSocialSetId: '333' });

    server.expect('GET', '/v2/social-sets/333/linkedin/organizations/resolve', {
      assert: (req) => {
        authAssertFactory(apiKey)(req);
        const q = new URL(`http://x${req.path}${req.search}`).searchParams;
        assert.equal(q.get('organization_url'), organizationUrl);
      },
      json: {
        id: '86779668',
        urn: 'urn:li:organization:86779668',
        mention_text: '@[Typefully](urn:li:organization:86779668)',
      },
    });

    const result = await run([
      'linkedin:organizations:resolve',
      '--url',
      organizationUrl,
    ]);
    expectCliOk(result);
  }));

  it('requires organization URL before making requests', withCliHarness(async ({ server, run }) => {
    const result = await run(['linkedin:organizations:resolve', '222']);
    expectCliError(result, {
      error: '--organization-url (or --organization_url, --url) is required',
    });
    assert.equal(server.requests.length, 0);
  }));
});
