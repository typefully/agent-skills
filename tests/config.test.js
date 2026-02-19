const {
  describe,
  it,
  assert,
  fs,
  path,
  withCliHarness,
  parseJsonOrNull,
  authAssertFactory,
  expectCliOk,
} = require('./typefully-cli.test-helpers');

async function readLocalConfig(cwd) {
  return JSON.parse(await fs.readFile(path.join(cwd, '.typefully', 'config.json'), 'utf8'));
}

describe('config:set-default', () => {
  it('accepts --social-set-id and writes local config', withCliHarness(async ({ sandbox, server, apiKey, run }) => {
    server.expect('GET', '/v2/social-sets/123', {
      assert: authAssertFactory(apiKey),
      json: { id: '123', platforms: { x: {} } },
    });

    const result = await run(['config:set-default', '--social-set-id', '123', '--location', 'local']);
    expectCliOk(result);

    const out = parseJsonOrNull(result.stdout);
    assert.equal(out?.success, true);
    assert.equal(out?.default_social_set_id, '123');

    const cfg = await readLocalConfig(sandbox.cwd);
    assert.equal(cfg.defaultSocialSetId, '123');
  }));

  it('supports --social_set_id and --scope aliases', withCliHarness(async ({ sandbox, server, apiKey, run }) => {
    server.expect('GET', '/v2/social-sets/123', {
      assert: authAssertFactory(apiKey),
      json: { id: '123', platforms: { x: {} } },
    });

    const result = await run(['config:set-default', '--social_set_id', '123', '--scope', 'local']);
    expectCliOk(result);

    const out = parseJsonOrNull(result.stdout);
    assert.equal(out?.success, true);
    assert.equal(out?.default_social_set_id, '123');

    const cfg = await readLocalConfig(sandbox.cwd);
    assert.equal(cfg.defaultSocialSetId, '123');
  }));
});

describe('setup', () => {
  it('writes local config and validates default social set in non-interactive mode', withCliHarness(async ({ sandbox, server, run }) => {
    server.expect('GET', '/v2/social-sets/123', {
      assert: authAssertFactory('typ_setup_key'),
      json: { id: '123', platforms: { x: {} } },
    });

    const result = await run(
      ['setup', '--key', 'typ_setup_key', '--location', 'local', '--default-social-set', '123'],
      { env: { TYPEFULLY_API_KEY: '' } }
    );
    expectCliOk(result);

    const out = parseJsonOrNull(result.stdout);
    assert.equal(out?.success, true);

    const cfg = await readLocalConfig(sandbox.cwd);
    assert.equal(cfg.apiKey, 'typ_setup_key');
    assert.equal(cfg.defaultSocialSetId, '123');

    const gitignore = await fs.readFile(path.join(sandbox.cwd, '.gitignore'), 'utf8');
    assert.ok(gitignore.includes('.typefully/'));
  }));

  it('supports --no-default and avoids API calls', withCliHarness(async ({ sandbox, server, run }) => {
    const result = await run(
      ['setup', '--key', 'typ_setup_key', '--location', 'local', '--no-default'],
      { env: { TYPEFULLY_API_KEY: '' } }
    );
    expectCliOk(result);

    const out = parseJsonOrNull(result.stdout);
    assert.equal(out.success, true);
    assert.equal(out.default_social_set_id, null);

    const cfg = await readLocalConfig(sandbox.cwd);
    assert.equal(cfg.apiKey, 'typ_setup_key');
    assert.equal(cfg.defaultSocialSetId, undefined);
    assert.equal(server.requests.length, 0);
  }));

  it('supports --scope alias for --location in non-interactive mode', withCliHarness(async ({ sandbox, run }) => {
    const result = await run(
      ['setup', '--key', 'typ_setup_key', '--scope', 'local', '--no-default'],
      { env: { TYPEFULLY_API_KEY: '' } }
    );
    expectCliOk(result);

    const out = parseJsonOrNull(result.stdout);
    assert.equal(out?.success, true);
    assert.equal(out?.scope, 'local');

    const cfg = await readLocalConfig(sandbox.cwd);
    assert.equal(cfg.apiKey, 'typ_setup_key');

    const gitignore = await fs.readFile(path.join(sandbox.cwd, '.gitignore'), 'utf8');
    assert.ok(gitignore.includes('.typefully/'));
  }));
});

describe('config:show', () => {
  it('returns configured=false when no API key is configured', withCliHarness(async ({ run }) => {
    const result = await run(['config:show'], { env: { TYPEFULLY_API_KEY: '' } });
    expectCliOk(result, {
      configured: false,
      hint: 'Run: typefully.js setup',
      api_key_url: 'https://typefully.com/?settings=api',
    });
  }));

  it('reads local config and reports default social set source', withCliHarness(async ({ sandbox, run, writeLocalConfig }) => {
    await writeLocalConfig({ apiKey: 'typ_local_key', defaultSocialSetId: '123' });

    const result = await run(['config:show'], { env: { TYPEFULLY_API_KEY: '' } });
    expectCliOk(result);

    const out = parseJsonOrNull(result.stdout);
    assert.equal(out.configured, true);
    assert.ok(out.active_source.endsWith(path.join('.typefully', 'config.json')));
    assert.equal(out.api_key_preview, 'typ_loca...');
    assert.equal(out.default_social_set.id, '123');
    assert.ok(out.default_social_set.source.endsWith(path.join('.typefully', 'config.json')));

    assert.equal(
      await fs.realpath(out.default_social_set.source),
      await fs.realpath(path.join(sandbox.cwd, '.typefully', 'config.json'))
    );
    assert.equal(out.config_files.local.has_key, true);
    assert.equal(out.config_files.local.has_default_social_set, true);
  }));
});
