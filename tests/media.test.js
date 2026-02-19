const {
  describe,
  it,
  assert,
  fs,
  path,
  withCliHarness,
  authAssertFactory,
  expectCliOk,
} = require('./typefully-cli.test-helpers');

async function writeMediaFixture(cwd, name = 'img.jpg') {
  const mediaFilePath = path.join(cwd, name);
  await fs.writeFile(mediaFilePath, Buffer.from('fake'));
  return mediaFilePath;
}

function uploadResponse(baseUrl) {
  return {
    upload_url: `${baseUrl.replace('/v2', '')}/upload/m1`,
    media_id: 'm1',
  };
}

describe('media:upload', () => {
  it('uses presigned URL and does not set Content-Type on PUT', withCliHarness(async ({ sandbox, server, apiKey, run, baseUrl }) => {
    const mediaFilePath = await writeMediaFixture(sandbox.cwd);

    server.expect('POST', '/v2/social-sets/9/media/upload', {
      assert: authAssertFactory(apiKey),
      json: uploadResponse(baseUrl),
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
      json: { id: 'm1', status: 'ready' },
    });

    const result = await run(['media:upload', '9', mediaFilePath]);
    expectCliOk(result, {
      media_id: 'm1',
      status: 'ready',
      message: 'Media uploaded and ready to use',
    });
  }));

  it('accepts --social-set-id when only a file arg is provided', withCliHarness(async ({ sandbox, server, apiKey, run, baseUrl }) => {
    const mediaFilePath = await writeMediaFixture(sandbox.cwd);

    server.expect('POST', '/v2/social-sets/9/media/upload', {
      assert: authAssertFactory(apiKey),
      json: uploadResponse(baseUrl),
    });

    server.expect('PUT', '/upload/m1', {
      assert: (req) => {
        assert.equal(req.headers['content-type'], undefined);
        assert.equal(req.bodyText, 'fake');
      },
      json: { ok: true },
    });

    const result = await run(['media:upload', mediaFilePath, '--social-set-id', '9', '--no-wait']);
    expectCliOk(result);
  }));

  it('polls status and supports fast poll interval override', withCliHarness(async ({ sandbox, server, apiKey, run, baseUrl }) => {
    const mediaFilePath = await writeMediaFixture(sandbox.cwd);

    server.expect('POST', '/v2/social-sets/9/media/upload', {
      assert: authAssertFactory(apiKey),
      json: uploadResponse(baseUrl),
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

    const result = await run(['media:upload', '9', mediaFilePath, '--timeout', '1'], {
      env: { TYPEFULLY_MEDIA_POLL_INTERVAL_MS: '10' },
      timeoutMs: 5000,
    });
    expectCliOk(result, {
      media_id: 'm1',
      status: 'ready',
      message: 'Media uploaded and ready to use',
    });
  }));

  it('uses configured default social set when only file arg is provided', withCliHarness(async ({ sandbox, server, apiKey, run, baseUrl, writeLocalConfig }) => {
    await writeLocalConfig({ defaultSocialSetId: '9' });
    const mediaFilePath = await writeMediaFixture(sandbox.cwd);

    server.expect('POST', '/v2/social-sets/9/media/upload', {
      assert: authAssertFactory(apiKey),
      json: uploadResponse(baseUrl),
    });

    server.expect('PUT', '/upload/m1', {
      assert: (req) => {
        assert.equal(req.headers['content-type'], undefined);
        assert.equal(req.bodyText, 'fake');
      },
      json: { ok: true },
    });

    const result = await run(['media:upload', mediaFilePath, '--no-wait']);
    expectCliOk(result, {
      media_id: 'm1',
      message: 'Upload complete. Use media:status to check processing.',
    });
  }));
});

describe('media:status', () => {
  it('hits /media/<id> with default social set when omitted', withCliHarness(async ({ server, apiKey, run, writeLocalConfig }) => {
    await writeLocalConfig({ defaultSocialSetId: '9' });

    server.expect('GET', '/v2/social-sets/9/media/m1', {
      assert: authAssertFactory(apiKey),
      json: { id: 'm1', status: 'ready' },
    });

    const result = await run(['media:status', 'm1']);
    expectCliOk(result, { id: 'm1', status: 'ready' });
  }));
});
