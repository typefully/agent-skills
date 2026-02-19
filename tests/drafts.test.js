const {
  describe,
  it,
  assert,
  fs,
  path,
  runCli,
  parseJsonOrNull,
  authAssertFactory,
  withCliHarness,
} = require('./typefully-cli.test-helpers');

describe('drafts', () => {
  it('drafts:update with only --tags does not touch content (no platforms payload)', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey 
  }) => {
  server.expect('PATCH', '/v2/social-sets/100813/drafts/d1', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.deepEqual(req.bodyJson, { tags: ['owner/me'] });
    },
    json: { id: 'd1', ok: true },
  });
    const result = await runCli(
      ['drafts:update', 'd1', '--tags', 'owner/me', '--social-set-id', '100813'],
      {
        cwd: sandbox.cwd,
        env: {
          HOME: sandbox.home,
          TYPEFULLY_API_BASE: baseUrl,
          TYPEFULLY_API_KEY: apiKey,
        },
      }
    );

    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1', ok: true });
    server.assertNoPendingExpectations();
    assert.equal(server.requests.length, 1);
  }));

  it('update-draft alias: tag-only update works and does not crash', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey 
  }) => {
  server.expect('PATCH', '/v2/social-sets/100813/drafts/d1', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.deepEqual(req.bodyJson, { tags: ['owner/me'] });
    },
    json: { id: 'd1', ok: true },
  });
    const result = await runCli(
      ['update-draft', 'd1', '--tags', 'owner/me', '--social-set-id', '100813'],
      {
        cwd: sandbox.cwd,
        env: {
          HOME: sandbox.home,
          TYPEFULLY_API_BASE: baseUrl,
          TYPEFULLY_API_KEY: apiKey,
        },
      }
    );

    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1', ok: true });
    server.assertNoPendingExpectations();
    assert.equal(server.requests.length, 1);
  }));

  it('create-draft alias: positional text forwards correctly to drafts:create', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey 
  }) => {
  server.expect('POST', '/v2/social-sets/100812/drafts', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.deepEqual(req.bodyJson, {
        platforms: {
          x: {
            enabled: true,
            posts: [{ text: 'Test content' }],
          },
        },
        tags: ['owner/me'],
      });
    },
    json: { id: 'new-draft' },
  });
    const result = await runCli(
      ['create-draft', 'Test content', '--social-set-id', '100812', '--platform', 'x', '--tags', 'owner/me'],
      {
        cwd: sandbox.cwd,
        env: {
          HOME: sandbox.home,
          TYPEFULLY_API_BASE: baseUrl,
          TYPEFULLY_API_KEY: apiKey,
        },
      }
    );

    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'new-draft' });
    server.assertNoPendingExpectations();
    assert.equal(server.requests.length, 1);
  }));

  it('draft target safety: drafts:get single arg with default social set requires --use-default', withCliHarness(async ({
    sandbox, server, baseUrl 
  }) => {
  // Create local config with a default social set.
  const cfgDir = path.join(sandbox.cwd, '.typefully');
  await fs.mkdir(cfgDir, { recursive: true });
  await fs.writeFile(path.join(cfgDir, 'config.json'), JSON.stringify({ defaultSocialSetId: '111' }, null, 2));
    const result = await runCli(
      ['drafts:get', 'd99'],
      {
        cwd: sandbox.cwd,
        env: {
          HOME: sandbox.home,
          TYPEFULLY_API_BASE: baseUrl,
          TYPEFULLY_API_KEY: 'typ_test_key',
        },
      }
    );

    assert.equal(result.code, 1);
    const out = parseJsonOrNull(result.stdout);
    assert.ok(out?.error?.includes('Ambiguous arguments for drafts:get'));
    assert.equal(server.requests.length, 0);
  }));

  it('drafts:get with --use-default uses configured default social set', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey 
  }) => {
  const cfgDir = path.join(sandbox.cwd, '.typefully');
  await fs.mkdir(cfgDir, { recursive: true });
  await fs.writeFile(path.join(cfgDir, 'config.json'), JSON.stringify({ defaultSocialSetId: '111' }, null, 2));

  server.expect('GET', '/v2/social-sets/111/drafts/d99', {
    assert: authAssertFactory(apiKey),
    json: { id: 'd99' },
  });
    const result = await runCli(
      ['drafts:get', 'd99', '--use-default'],
      {
        cwd: sandbox.cwd,
        env: {
          HOME: sandbox.home,
          TYPEFULLY_API_BASE: baseUrl,
          TYPEFULLY_API_KEY: apiKey,
        },
      }
    );

    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd99' });
    server.assertNoPendingExpectations();
  }));

  it('drafts:create chooses first connected platform when --platform omitted', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey 
  }) => {
  server.expect('GET', '/v2/social-sets/55', {
    assert: authAssertFactory(apiKey),
    json: { id: '55', platforms: { x: {}, linkedin: {} } },
  });

  server.expect('POST', '/v2/social-sets/55/drafts', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.equal(Object.keys(req.bodyJson.platforms).join(','), 'x');
      assert.equal(req.bodyJson.platforms.x.posts[0].text, 'Hello');
    },
    json: { id: 'd1' },
  });
    const result = await runCli(
      ['drafts:create', '55', '--text', 'Hello'],
      {
        cwd: sandbox.cwd,
        env: {
          HOME: sandbox.home,
          TYPEFULLY_API_BASE: baseUrl,
          TYPEFULLY_API_KEY: apiKey,
        },
      }
    );

    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1' });
    server.assertNoPendingExpectations();
  }));

  it('drafts:create --all targets all connected platforms', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey 
  }) => {
  server.expect('GET', '/v2/social-sets/55', {
    assert: authAssertFactory(apiKey),
    json: { id: '55', platforms: { linkedin: {}, x: {}, threads: {} } },
  });

  server.expect('POST', '/v2/social-sets/55/drafts', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.deepEqual(Object.keys(req.bodyJson.platforms), ['x', 'linkedin', 'threads']);
    },
    json: { id: 'd1' },
  });
    const result = await runCli(
      ['drafts:create', '55', '--all', '--text', 'Hello'],
      {
        cwd: sandbox.cwd,
        env: {
          HOME: sandbox.home,
          TYPEFULLY_API_BASE: baseUrl,
          TYPEFULLY_API_KEY: apiKey,
        },
      }
    );

    assert.equal(result.code, 0);
    server.assertNoPendingExpectations();
  }));

  it('drafts:schedule sends publish_at payload', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey 
  }) => {
  server.expect('PATCH', '/v2/social-sets/9/drafts/d1', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.deepEqual(req.bodyJson, { publish_at: 'next-free-slot' });
    },
    json: { id: 'd1', scheduled: true },
  });
    const result = await runCli(
      ['drafts:schedule', '9', 'd1', '--time', 'next-free-slot'],
      {
        cwd: sandbox.cwd,
        env: {
          HOME: sandbox.home,
          TYPEFULLY_API_BASE: baseUrl,
          TYPEFULLY_API_KEY: apiKey,
        },
      }
    );

    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1', scheduled: true });
    server.assertNoPendingExpectations();
  }));

  it('drafts:list builds query params (status/tag/sort/limit)', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey 
  }) => {
  server.expect('GET', '/v2/social-sets/9/drafts', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      const q = new URL('http://x' + req.path + req.search).searchParams;
      assert.equal(q.get('limit'), '3');
      assert.equal(q.get('status'), 'scheduled');
      assert.equal(q.get('tag'), 'owner/me');
      assert.equal(q.get('order_by'), '-created_at');
    },
    json: { results: [{ id: 'd1' }] },
  });
    const result = await runCli(
      ['drafts:list', '9', '--limit', '3', '--status', 'scheduled', '--tag', 'owner/me', '--sort', '-created_at'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { results: [{ id: 'd1' }] });
    server.assertNoPendingExpectations();
  }));

  it('drafts:publish sends publish_at=now', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey 
  }) => {
  server.expect('PATCH', '/v2/social-sets/9/drafts/d1', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.deepEqual(req.bodyJson, { publish_at: 'now' });
    },
    json: { id: 'd1', published: true },
  });
    const result = await runCli(
      ['drafts:publish', '9', 'd1'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1', published: true });
    server.assertNoPendingExpectations();
  }));

  it('drafts:delete uses DELETE and returns success payload', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey 
  }) => {
  server.expect('DELETE', '/v2/social-sets/9/drafts/d1', {
    assert: authAssertFactory(apiKey),
    json: {},
  });
    const result = await runCli(
      ['drafts:delete', '9', 'd1'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { success: true, message: 'Draft deleted' });
    server.assertNoPendingExpectations();
  }));

  it('drafts:update with no update fields errors (message mentions --tags)', withCliHarness(async ({
    sandbox, server, baseUrl 
  }) => {
  const result = await runCli(
      ['drafts:update', '9', 'd1'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: 'typ_test_key' } }
    );
    assert.equal(result.code, 1);
    assert.deepEqual(parseJsonOrNull(result.stdout), {
      error: 'At least one of --text, --file, --title, --schedule, --share, --notes, or --tags is required',
    });
    assert.equal(server.requests.length, 0);
  }));

  it('drafts:update can clear tags with --tags \"\" (sends empty array)', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey 
  }) => {
  server.expect('PATCH', '/v2/social-sets/9/drafts/d1', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.deepEqual(req.bodyJson, { tags: [] });
    },
    json: { id: 'd1', ok: true },
  });
    const result = await runCli(
      ['drafts:update', '9', 'd1', '--tags', ''],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1', ok: true });
    server.assertNoPendingExpectations();
  }));

  it('drafts:create splits threads on --- and attaches media only to first post', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey 
  }) => {
  server.expect('POST', '/v2/social-sets/9/drafts', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      const posts = req.bodyJson.platforms.x.posts;
      assert.equal(posts.length, 2);
      assert.deepEqual(posts[0], { text: 'First', media_ids: ['m1', 'm2'] });
      assert.deepEqual(posts[1], { text: 'Second' });
    },
    json: { id: 'd1' },
  });
    const threadText = 'First\n---\nSecond';
    const result = await runCli(
      ['drafts:create', '9', '--platform', 'x', '--text', threadText, '--media', 'm1,m2'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1' });
    server.assertNoPendingExpectations();
  }));

  it('drafts:create thread splitting supports CRLF (\\r\\n)', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey 
  }) => {
  server.expect('POST', '/v2/social-sets/9/drafts', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      const posts = req.bodyJson.platforms.x.posts;
      assert.equal(posts.length, 2);
      assert.deepEqual(posts[0], { text: 'First', media_ids: ['m1', 'm2'] });
      assert.deepEqual(posts[1], { text: 'Second' });
    },
    json: { id: 'd1' },
  });
    const threadText = 'First\r\n---\r\nSecond';
    const result = await runCli(
      ['drafts:create', '9', '--platform', 'x', '--text', threadText, '--media', 'm1,m2'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1' });
    server.assertNoPendingExpectations();
  }));

  it('drafts:update --append fetches existing draft and appends a new post', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey 
  }) => {
  server.expect('GET', '/v2/social-sets/9/drafts/d1', {
    assert: authAssertFactory(apiKey),
    json: {
      id: 'd1',
      platforms: {
        x: {
          enabled: true,
          posts: [{ text: 'Old' }],
        },
      },
    },
  });

  server.expect('PATCH', '/v2/social-sets/9/drafts/d1', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.deepEqual(req.bodyJson, {
        platforms: {
          x: {
            enabled: true,
            posts: [{ text: 'Old' }, { text: 'New', media_ids: ['m1'] }],
          },
        },
      });
    },
    json: { id: 'd1', ok: true },
  });
    const result = await runCli(
      ['drafts:update', '9', 'd1', '--append', '--text', 'New', '--media', 'm1'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1', ok: true });
    server.assertNoPendingExpectations();
  }));

  it('drafts:update replaces posts and attaches media only to first post', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey 
  }) => {
  server.expect('GET', '/v2/social-sets/9/drafts/d1', {
    assert: authAssertFactory(apiKey),
    json: {
      id: 'd1',
      platforms: {
        x: { enabled: true, posts: [{ text: 'Old' }] },
      },
    },
  });

  server.expect('PATCH', '/v2/social-sets/9/drafts/d1', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      const posts = req.bodyJson.platforms.x.posts;
      assert.deepEqual(posts, [
        { text: 'First', media_ids: ['m1'] },
        { text: 'Second' },
      ]);
    },
    json: { id: 'd1', ok: true },
  });
    const result = await runCli(
      ['drafts:update', '9', 'd1', '--text', 'First\n---\nSecond', '--media', 'm1'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1', ok: true });
    server.assertNoPendingExpectations();
  }));

  it('drafts:create supports title/schedule/share/notes/tags/reply-to/community', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey 
  }) => {
  server.expect('POST', '/v2/social-sets/9/drafts', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.deepEqual(req.bodyJson, {
        platforms: {
          x: {
            enabled: true,
            posts: [{ text: 'Hello' }],
            settings: {
              reply_to_url: 'https://x.com/user/status/123',
              community_id: '999',
            },
          },
        },
        draft_title: 'Title',
        publish_at: 'now',
        tags: ['a', 'b'],
        share: true,
        scratchpad_text: 'Some notes',
      });
    },
    json: { id: 'd1' },
  });
    const result = await runCli(
      [
        'drafts:create',
        '9',
        '--platform',
        'x',
        '--text',
        'Hello',
        '--title',
        'Title',
        '--schedule',
        'now',
        '--tags',
        'a,b',
        '--share',
        '--scratchpad',
        'Some notes',
        '--reply-to',
        'https://x.com/user/status/123',
        '--community',
        '999',
      ],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1' });
    server.assertNoPendingExpectations();
  }));

  it('drafts:create reads from file via -f', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey 
  }) => {
  const filePath = path.join(sandbox.cwd, 'post.txt');
  await fs.writeFile(filePath, 'From file');

  server.expect('POST', '/v2/social-sets/9/drafts', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.equal(req.bodyJson.platforms.x.posts[0].text, 'From file');
    },
    json: { id: 'd1' },
  });
    const result = await runCli(
      ['drafts:create', '9', '--platform', 'x', '-f', filePath],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    server.assertNoPendingExpectations();
  }));

  it('drafts:create errors when both --all and --platform are provided', withCliHarness(async ({
    sandbox 
  }) => {
    const result = await runCli(
      ['drafts:create', '9', '--all', '--platform', 'x', '--text', 'Hello'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_KEY: 'typ_test_key' } }
    );
    assert.equal(result.code, 1);
    assert.deepEqual(parseJsonOrNull(result.stdout), { error: 'Cannot use both --all and --platform flags' });
  }));

  it('drafts:create errors when neither --text nor --file are provided', withCliHarness(async ({
    sandbox 
  }) => {
    const result = await runCli(
      ['drafts:create', '9', '--platform', 'x'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_KEY: 'typ_test_key' } }
    );
    assert.equal(result.code, 1);
    assert.deepEqual(parseJsonOrNull(result.stdout), { error: '--text or --file is required' });
  }));

  it('drafts:update supports title/schedule/share/notes without fetching existing draft', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey 
  }) => {
  server.expect('PATCH', '/v2/social-sets/9/drafts/d1', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.deepEqual(req.bodyJson, {
        draft_title: 'Title',
        publish_at: 'now',
        share: true,
        scratchpad_text: 'Notes',
        tags: ['t1'],
      });
    },
    json: { id: 'd1', ok: true },
  });
    const result = await runCli(
      ['drafts:update', '9', 'd1', '--title', 'Title', '--schedule', 'now', '--share', '--notes', 'Notes', '--tags', 't1'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.equal(server.requests.length, 1);
    server.assertNoPendingExpectations();
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1', ok: true });
  }));

  it('drafts:update reads from file via -f and can target multiple platforms', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey 
  }) => {
  const filePath = path.join(sandbox.cwd, 'thread.txt');
  await fs.writeFile(filePath, 'First\n---\nSecond');

  server.expect('GET', '/v2/social-sets/9/drafts/d1', {
    assert: authAssertFactory(apiKey),
    json: { id: 'd1', platforms: { x: { enabled: true, posts: [{ text: 'Old' }] } } },
  });

  server.expect('PATCH', '/v2/social-sets/9/drafts/d1', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.deepEqual(req.bodyJson, {
        platforms: {
          x: {
            enabled: true,
            posts: [{ text: 'First', media_ids: ['m1'] }, { text: 'Second' }],
          },
          linkedin: {
            enabled: true,
            posts: [{ text: 'First', media_ids: ['m1'] }, { text: 'Second' }],
          },
        },
      });
    },
    json: { id: 'd1', ok: true },
  });
    const result = await runCli(
      ['drafts:update', '9', 'd1', '--platform', 'x,linkedin', '-f', filePath, '--media', 'm1'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    server.assertNoPendingExpectations();
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1', ok: true });
  }));

  it('drafts:update supports -a shorthand for --append', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey 
  }) => {
  server.expect('GET', '/v2/social-sets/9/drafts/d1', {
    assert: authAssertFactory(apiKey),
    json: {
      id: 'd1',
      platforms: {
        x: { enabled: true, posts: [{ text: 'Old' }] },
      },
    },
  });

  server.expect('PATCH', '/v2/social-sets/9/drafts/d1', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.deepEqual(req.bodyJson, {
        platforms: {
          x: { enabled: true, posts: [{ text: 'Old' }, { text: 'New' }] },
        },
      });
    },
    json: { id: 'd1', ok: true },
  });
    const result = await runCli(
      ['drafts:update', '9', 'd1', '-a', '--text', 'New'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    server.assertNoPendingExpectations();
  }));

  it('default social set safety: drafts:update/delete/schedule/publish require --use-default with a single arg', withCliHarness(async ({
    sandbox 
  }) => {
  const cfgDir = path.join(sandbox.cwd, '.typefully');
  await fs.mkdir(cfgDir, { recursive: true });
  await fs.writeFile(path.join(cfgDir, 'config.json'), JSON.stringify({ defaultSocialSetId: '9' }, null, 2));
    for (const args of [
      ['drafts:update', 'd1', '--title', 'T'],
      ['drafts:delete', 'd1'],
      ['drafts:schedule', 'd1', '--time', 'next-free-slot'],
      ['drafts:publish', 'd1'],
    ]) {
      const result = await runCli(args, {
        cwd: sandbox.cwd,
        env: { HOME: sandbox.home, TYPEFULLY_API_KEY: 'typ_test_key' },
      });
      assert.equal(result.code, 1);
      const out = parseJsonOrNull(result.stdout);
      assert.ok(out?.error?.includes('Ambiguous arguments'));
    }
  }));

  it('drafts:schedule/delete/publish work with --use-default and configured default social set', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey 
  }) => {
  const cfgDir = path.join(sandbox.cwd, '.typefully');
  await fs.mkdir(cfgDir, { recursive: true });
  await fs.writeFile(path.join(cfgDir, 'config.json'), JSON.stringify({ defaultSocialSetId: '9' }, null, 2));

  server.expect('PATCH', '/v2/social-sets/9/drafts/d1', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.deepEqual(req.bodyJson, { publish_at: 'next-free-slot' });
    },
    json: { id: 'd1', scheduled: true },
  });

  server.expect('PATCH', '/v2/social-sets/9/drafts/d1', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.deepEqual(req.bodyJson, { publish_at: 'now' });
    },
    json: { id: 'd1', published: true },
  });

  server.expect('DELETE', '/v2/social-sets/9/drafts/d1', {
    assert: authAssertFactory(apiKey),
    json: {},
  });
    const sched = await runCli(['drafts:schedule', 'd1', '--time', 'next-free-slot', '--use-default'], {
      cwd: sandbox.cwd,
      env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey },
    });
    assert.equal(sched.code, 0);

    const pub = await runCli(['drafts:publish', 'd1', '--use-default'], {
      cwd: sandbox.cwd,
      env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey },
    });
    assert.equal(pub.code, 0);

    const del = await runCli(['drafts:delete', 'd1', '--use-default'], {
      cwd: sandbox.cwd,
      env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey },
    });
    assert.equal(del.code, 0);

    server.assertNoPendingExpectations();
  }));

  it('drafts:list accepts --social_set_id (snake_case)', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey 
  }) => {
  server.expect('GET', '/v2/social-sets/9/drafts', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.equal(req.search, '?limit=1');
    },
    json: { results: [] },
  });
    const result = await runCli(['drafts:list', '--social_set_id', '9', '--limit', '1'], {
      cwd: sandbox.cwd,
      env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey },
    });
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { results: [] });
    server.assertNoPendingExpectations();
  }));

  it('drafts:create reads from file via --file (long form)', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey 
  }) => {
  const filePath = path.join(sandbox.cwd, 'post.txt');
  await fs.writeFile(filePath, 'Hello from file', 'utf8');

  server.expect('POST', '/v2/social-sets/9/drafts', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.equal(req.bodyJson.platforms.x.posts[0].text, 'Hello from file');
    },
    json: { id: 'd1' },
  });
    const result = await runCli(
      ['drafts:create', '9', '--platform', 'x', '--file', filePath],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1' });
    server.assertNoPendingExpectations();
  }));

  it('drafts:update reads from file via --file (long form)', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey 
  }) => {
  const filePath = path.join(sandbox.cwd, 'post.txt');
  await fs.writeFile(filePath, 'Updated from file', 'utf8');

  server.expect('GET', '/v2/social-sets/9/drafts/d1', {
    assert: authAssertFactory(apiKey),
    json: { id: 'd1', platforms: { x: { enabled: true, posts: [{ text: 'Old' }] } } },
  });

  server.expect('PATCH', '/v2/social-sets/9/drafts/d1', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.equal(req.bodyJson.platforms.x.posts[0].text, 'Updated from file');
    },
    json: { id: 'd1', ok: true },
  });
    const result = await runCli(
      ['drafts:update', '9', 'd1', '--platform', 'x', '--file', filePath],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1', ok: true });
    server.assertNoPendingExpectations();
  }));

  it('drafts:schedule errors when --time is missing', withCliHarness(async ({
    sandbox, server, baseUrl 
  }) => {
  const result = await runCli(
      ['drafts:schedule', '9', 'd1'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: 'typ_test_key' } }
    );
    assert.equal(result.code, 1);
    assert.deepEqual(parseJsonOrNull(result.stdout), {
      error: '--time is required (use "next-free-slot" or ISO datetime)',
    });
    assert.equal(server.requests.length, 0);
  }));

  it('global flag: drafts:list accepts --social-set-id (kebab-case)', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey 
  }) => {
  server.expect('GET', '/v2/social-sets/9/drafts', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.equal(req.search, '?limit=10');
    },
    json: { results: [] },
  });
    const result = await runCli(
      ['drafts:list', '--social-set-id', '9'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { results: [] });
    server.assertNoPendingExpectations();
  }));

  it('global flag: drafts:create accepts --social-set-id (kebab-case) with no positional social set', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey 
  }) => {
  server.expect('POST', '/v2/social-sets/9/drafts', {
    assert: (req) => {
      authAssertFactory(apiKey)(req);
      assert.equal(req.bodyJson.platforms.x.posts[0].text, 'Hello');
    },
    json: { id: 'd1' },
  });
    const result = await runCli(
      ['drafts:create', '--social-set-id', '9', '--platform', 'x', '--text', 'Hello'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'd1' });
    server.assertNoPendingExpectations();
  }));
});
