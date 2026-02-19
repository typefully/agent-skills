const { test, assert, http, spawn, fs, path, os, mkdtemp, makeSandbox, runCli, parseJsonOrNull, createMockServer, authAssertFactory } = require('./typefully-cli.test-helpers');

test('media:upload uses presigned URL and does not set Content-Type on PUT', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  const mediaFilePath = path.join(sandbox.cwd, 'img.jpg');
  await fs.writeFile(mediaFilePath, Buffer.from('fake'));

  // 1) Request presigned URL from Typefully API
  server.expect('POST', '/v2/social-sets/9/media/upload', {
    assert: authAssertFactory(apiKey),
    json: {
      upload_url: baseUrl.replace('/v2', '') + '/upload/m1',
      media_id: 'm1',
    },
  });

  // 2) Upload binary to presigned URL without Content-Type
  server.expect('PUT', '/upload/m1', {
    assert: (req) => {
      assert.equal(req.headers['content-type'], undefined);
      assert.equal(req.bodyText, 'fake');
    },
    json: { ok: true },
  });

  // 3) Poll media status until ready
  server.expect('GET', '/v2/social-sets/9/media/m1', {
    assert: authAssertFactory(apiKey),
    json: { id: 'm1', status: 'ready' },
  });

  try {
    const result = await runCli(
      ['media:upload', '9', mediaFilePath],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), {
      media_id: 'm1',
      status: 'ready',
      message: 'Media uploaded and ready to use',
    });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('media:status hits /media/<id> with default social set when omitted', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  // Default social set configured locally.
  const cfgDir = path.join(sandbox.cwd, '.typefully');
  await fs.mkdir(cfgDir, { recursive: true });
  await fs.writeFile(path.join(cfgDir, 'config.json'), JSON.stringify({ defaultSocialSetId: '9' }, null, 2));

  server.expect('GET', '/v2/social-sets/9/media/m1', {
    assert: authAssertFactory(apiKey),
    json: { id: 'm1', status: 'ready' },
  });

  try {
    const result = await runCli(
      ['media:status', 'm1'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), { id: 'm1', status: 'ready' });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('media:upload can use --social-set-id when only a file arg is provided', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  const mediaFilePath = path.join(sandbox.cwd, 'img.jpg');
  await fs.writeFile(mediaFilePath, Buffer.from('fake'));

  server.expect('POST', '/v2/social-sets/9/media/upload', {
    assert: authAssertFactory(apiKey),
    json: {
      upload_url: baseUrl.replace('/v2', '') + '/upload/m1',
      media_id: 'm1',
    },
  });

  server.expect('PUT', '/upload/m1', {
    assert: (req) => {
      assert.equal(req.headers['content-type'], undefined);
      assert.equal(req.bodyText, 'fake');
    },
    json: { ok: true },
  });

  try {
    const result = await runCli(
      ['media:upload', mediaFilePath, '--social-set-id', '9', '--no-wait'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('media:upload polling path works (uses --timeout and fast poll interval override)', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  const mediaFilePath = path.join(sandbox.cwd, 'img.jpg');
  await fs.writeFile(mediaFilePath, Buffer.from('fake'));

  server.expect('POST', '/v2/social-sets/9/media/upload', {
    assert: authAssertFactory(apiKey),
    json: {
      upload_url: baseUrl.replace('/v2', '') + '/upload/m1',
      media_id: 'm1',
    },
  });

  server.expect('PUT', '/upload/m1', {
    assert: (req) => {
      assert.equal(req.headers['content-type'], undefined);
      assert.equal(req.bodyText, 'fake');
    },
    json: { ok: true },
  });

  server.expect('GET', '/v2/social-sets/9/media/m1', {
    assert: authAssertFactory(apiKey),
    json: { id: 'm1', status: 'processing' },
  });

  server.expect('GET', '/v2/social-sets/9/media/m1', {
    assert: authAssertFactory(apiKey),
    json: { id: 'm1', status: 'ready' },
  });

  try {
    const result = await runCli(
      ['media:upload', '9', mediaFilePath, '--timeout', '1'],
      {
        cwd: sandbox.cwd,
        env: {
          HOME: sandbox.home,
          TYPEFULLY_API_BASE: baseUrl,
          TYPEFULLY_API_KEY: apiKey,
          TYPEFULLY_MEDIA_POLL_INTERVAL_MS: '10',
        },
        timeoutMs: 5000,
      }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), {
      media_id: 'm1',
      status: 'ready',
      message: 'Media uploaded and ready to use',
    });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});

test('media:upload uses configured default social set when only file arg is provided', async () => {
  const sandbox = await makeSandbox();
  const server = createMockServer();
  const { baseUrl } = await server.listen();
  const apiKey = 'typ_test_key';

  // Default social set configured locally.
  const cfgDir = path.join(sandbox.cwd, '.typefully');
  await fs.mkdir(cfgDir, { recursive: true });
  await fs.writeFile(path.join(cfgDir, 'config.json'), JSON.stringify({ defaultSocialSetId: '9' }, null, 2));

  const mediaFilePath = path.join(sandbox.cwd, 'img.jpg');
  await fs.writeFile(mediaFilePath, Buffer.from('fake'));

  server.expect('POST', '/v2/social-sets/9/media/upload', {
    assert: authAssertFactory(apiKey),
    json: {
      upload_url: baseUrl.replace('/v2', '') + '/upload/m1',
      media_id: 'm1',
    },
  });

  server.expect('PUT', '/upload/m1', {
    assert: (req) => {
      assert.equal(req.headers['content-type'], undefined);
      assert.equal(req.bodyText, 'fake');
    },
    json: { ok: true },
  });

  try {
    const result = await runCli(
      ['media:upload', mediaFilePath, '--no-wait'],
      { cwd: sandbox.cwd, env: { HOME: sandbox.home, TYPEFULLY_API_BASE: baseUrl, TYPEFULLY_API_KEY: apiKey } }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(parseJsonOrNull(result.stdout), {
      media_id: 'm1',
      message: 'Upload complete. Use media:status to check processing.',
    });
    server.assertNoPendingExpectations();
  } finally {
    await server.close();
    await sandbox.cleanup();
  }
});
