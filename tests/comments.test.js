const {
  describe,
  it,
  assert,
  runCli,
  parseJsonOrNull,
  authAssertFactory,
  withCliHarness,
} = require('./typefully-cli.test-helpers');

describe('comments', () => {
  it('comments:list sends GET with default limit and no filters', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey,
  }) => {
    server.expect('GET', '/v2/social-sets/9/drafts/d1/comment-threads', {
      assert: (req) => {
        authAssertFactory(apiKey)(req);
        assert.equal(req.search, '?limit=10');
      },
      json: { results: [] },
    });
    const result = await runCli(
      ['comments:list', 'd1', '--social-set-id', '9'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } },
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { results: [] });
    server.assertNoPendingExpectations();
  }));

  it('comments:list forwards platform/status/limit/offset query params', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey,
  }) => {
    server.expect('GET', '/v2/social-sets/9/drafts/d1/comment-threads', {
      assert: (req) => {
        authAssertFactory(apiKey)(req);
        const q = new URL('http://x' + req.path + req.search).searchParams;
        assert.equal(q.get('platform'), 'x');
        assert.equal(q.get('status'), 'open');
        assert.equal(q.get('limit'), '5');
        assert.equal(q.get('offset'), '20');
      },
      json: { results: [{ id: 't1' }] },
    });
    const result = await runCli(
      ['comments:list', 'd1', '--social-set-id', '9', '--platform', 'x', '--status', 'open', '--limit', '5', '--offset', '20'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } },
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { results: [{ id: 't1' }] });
    server.assertNoPendingExpectations();
  }));

  it('comments:list errors when draft_id positional is missing', withCliHarness(async ({
    sandbox, server, baseUrl,
  }) => {
    const result = await runCli(
      ['comments:list', '--social-set-id', '9'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: 'typ_test_key' } },
    );
    assert.equal(result.code, 1);
    const out = parseJsonOrNull(result.stdout);
    assert.equal(out?.error, 'draft_id is required');
    assert.ok(out?.hint?.includes('comments:list'));
    assert.equal(server.requests.length, 0);
  }));

  it('comments:create posts required fields and optional platform/occurrence', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey,
  }) => {
    server.expect('POST', '/v2/social-sets/9/drafts/d1/comment-threads', {
      assert: (req) => {
        authAssertFactory(apiKey)(req);
        assert.deepEqual(req.bodyJson, {
          post_index: 0,
          selected_text: 'exciting news',
          text: 'Tighten this — passive.',
          platform: 'x',
          occurrence: 1,
        });
      },
      json: { id: 'thread1' },
    });
    const result = await runCli(
      [
        'comments:create', 'd1',
        '--social-set-id', '9',
        '--post-index', '0',
        '--selected-text', 'exciting news',
        '--text', 'Tighten this — passive.',
        '--platform', 'x',
        '--occurrence', '1',
      ],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } },
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'thread1' });
    server.assertNoPendingExpectations();
  }));

  it('comments:create omits platform/occurrence when not provided', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey,
  }) => {
    server.expect('POST', '/v2/social-sets/9/drafts/d1/comment-threads', {
      assert: (req) => {
        authAssertFactory(apiKey)(req);
        assert.deepEqual(req.bodyJson, {
          post_index: 2,
          selected_text: 'pick',
          text: 'Why this word?',
        });
      },
      json: { id: 'thread2' },
    });
    const result = await runCli(
      [
        'comments:create', 'd1',
        '--social-set-id', '9',
        '--post-index', '2',
        '--selected-text', 'pick',
        '--text', 'Why this word?',
      ],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } },
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'thread2' });
    server.assertNoPendingExpectations();
  }));

  it('comments:create errors when --text is missing', withCliHarness(async ({
    sandbox, server, baseUrl,
  }) => {
    const result = await runCli(
      ['comments:create', 'd1', '--social-set-id', '9', '--post-index', '0', '--selected-text', 'foo'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: 'typ_test_key' } },
    );
    assert.equal(result.code, 1);
    const out = parseJsonOrNull(result.stdout);
    assert.equal(out?.error, '--text is required');
    assert.equal(server.requests.length, 0);
  }));

  it('comments:create errors when --post-index is not a non-negative integer', withCliHarness(async ({
    sandbox, server, baseUrl,
  }) => {
    const result = await runCli(
      ['comments:create', 'd1', '--social-set-id', '9', '--text', 'hi', '--selected-text', 'foo', '--post-index', '-1'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: 'typ_test_key' } },
    );
    assert.equal(result.code, 1);
    assert.deepEqual(parseJsonOrNull(result.stdout), {
      error: '--post-index must be a non-negative integer',
    });
    assert.equal(server.requests.length, 0);
  }));

  it('comments:reply posts a reply to the thread', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey,
  }) => {
    server.expect('POST', '/v2/social-sets/9/drafts/d1/comment-threads/t1/comments', {
      assert: (req) => {
        authAssertFactory(apiKey)(req);
        assert.deepEqual(req.bodyJson, { text: 'Agreed, will revise.' });
      },
      json: { id: 'c2' },
    });
    const result = await runCli(
      ['comments:reply', 'd1', 't1', '--social-set-id', '9', '--text', 'Agreed, will revise.'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } },
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'c2' });
    server.assertNoPendingExpectations();
  }));

  it('comments:reply errors when thread_id is missing', withCliHarness(async ({
    sandbox, server, baseUrl,
  }) => {
    const result = await runCli(
      ['comments:reply', 'd1', '--social-set-id', '9', '--text', 'hi'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: 'typ_test_key' } },
    );
    assert.equal(result.code, 1);
    const out = parseJsonOrNull(result.stdout);
    assert.equal(out?.error, 'draft_id and thread_id are required');
    assert.ok(out?.hint?.includes('comments:reply'));
    assert.equal(server.requests.length, 0);
  }));

  it('comments:resolve posts to the resolve endpoint with no body', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey,
  }) => {
    server.expect('POST', '/v2/social-sets/9/drafts/d1/comment-threads/t1/resolve', {
      assert: (req) => {
        authAssertFactory(apiKey)(req);
        assert.equal(req.bodyText, '');
      },
      json: { id: 't1', status: 'resolved' },
    });
    const result = await runCli(
      ['comments:resolve', 'd1', 't1', '--social-set-id', '9'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } },
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 't1', status: 'resolved' });
    server.assertNoPendingExpectations();
  }));

  it('comments:update sends PATCH with new text', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey,
  }) => {
    server.expect('PATCH', '/v2/social-sets/9/drafts/d1/comment-threads/t1/comments/c1', {
      assert: (req) => {
        authAssertFactory(apiKey)(req);
        assert.deepEqual(req.bodyJson, { text: 'Updated comment body' });
      },
      json: { id: 'c1', text: 'Updated comment body' },
    });
    const result = await runCli(
      ['comments:update', 'd1', 't1', 'c1', '--social-set-id', '9', '--text', 'Updated comment body'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } },
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'c1', text: 'Updated comment body' });
    server.assertNoPendingExpectations();
  }));

  it('comments:update errors when comment_id positional is missing', withCliHarness(async ({
    sandbox, server, baseUrl,
  }) => {
    const result = await runCli(
      ['comments:update', 'd1', 't1', '--social-set-id', '9', '--text', 'hi'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: 'typ_test_key' } },
    );
    assert.equal(result.code, 1);
    const out = parseJsonOrNull(result.stdout);
    assert.equal(out?.error, 'draft_id, thread_id, and comment_id are required');
    assert.ok(out?.hint?.includes('comments:update'));
    assert.equal(server.requests.length, 0);
  }));

  it('comments:delete deletes the entire thread when no comment_id is given', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey,
  }) => {
    server.expect('DELETE', '/v2/social-sets/9/drafts/d1/comment-threads/t1', {
      assert: authAssertFactory(apiKey),
      json: {},
    });
    const result = await runCli(
      ['comments:delete', 'd1', 't1', '--social-set-id', '9'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } },
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { success: true, message: 'Comment thread deleted' });
    server.assertNoPendingExpectations();
  }));

  it('comments:delete deletes a single comment when comment_id is given', withCliHarness(async ({
    sandbox, server, baseUrl, apiKey,
  }) => {
    server.expect('DELETE', '/v2/social-sets/9/drafts/d1/comment-threads/t1/comments/c1', {
      assert: authAssertFactory(apiKey),
      json: {},
    });
    const result = await runCli(
      ['comments:delete', 'd1', 't1', 'c1', '--social-set-id', '9'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } },
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { success: true, message: 'Comment deleted' });
    server.assertNoPendingExpectations();
  }));

  it('comments:delete errors when thread_id is missing', withCliHarness(async ({
    sandbox, server, baseUrl,
  }) => {
    const result = await runCli(
      ['comments:delete', 'd1', '--social-set-id', '9'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: 'typ_test_key' } },
    );
    assert.equal(result.code, 1);
    const out = parseJsonOrNull(result.stdout);
    assert.equal(out?.error, 'draft_id and thread_id are required');
    assert.ok(out?.hint?.includes('comments:delete'));
    assert.equal(server.requests.length, 0);
  }));
});
