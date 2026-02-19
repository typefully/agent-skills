const { test: nodeTest } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const CLI_PATH = path.resolve(__dirname, '..', 'skills', 'typefully', 'scripts', 'typefully.js');
const test = typeof globalThis.test === 'function' ? globalThis.test : nodeTest;
const describe = typeof globalThis.describe === 'function' ? globalThis.describe : test;
const it = typeof globalThis.it === 'function' ? globalThis.it : test;
const DEFAULT_API_KEY = 'typ_test_key';
let execaLoader;

async function mkdtemp(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function makeSandbox() {
  const root = await mkdtemp('agent-skills-test-');
  const cwd = path.join(root, 'cwd');
  const home = path.join(root, 'home');
  await fs.mkdir(cwd, { recursive: true });
  await fs.mkdir(home, { recursive: true });
  return {
    root,
    cwd,
    home,
    async cleanup() {
      await fs.rm(root, { recursive: true, force: true });
    },
  };
}

async function getExeca() {
  if (!execaLoader) {
    execaLoader = import('execa').then((mod) => mod.execa);
  }
  return execaLoader;
}

async function runCli(args, { cwd, env, timeoutMs = 5000 } = {}) {
  const execa = await getExeca();

  try {
    const result = await execa(process.execPath, [CLI_PATH, ...args], {
      cwd,
      env: { ...process.env, ...env },
      extendEnv: false,
      stdin: 'ignore',
      reject: false,
      timeout: timeoutMs,
    });

    return {
      code: result.exitCode,
      signal: result.signal ?? null,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
    };
  } catch (err) {
    if (err && err.timedOut) {
      throw new Error(`CLI timeout after ${timeoutMs}ms: ${args.join(' ')}`);
    }
    throw err;
  }
}

function buildCliEnv({ home, baseUrl, apiKey = DEFAULT_API_KEY, env = {} }) {
  return {
    HOME: home,
    TYPEFULLY_API_BASE: baseUrl,
    TYPEFULLY_API_KEY: apiKey,
    ...env,
  };
}

function parseJsonOrNull(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function createMockServer() {
  const requests = [];
  const expectations = [];

  async function readBody(req) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    return Buffer.concat(chunks);
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const bodyBuf = await readBody(req);
    const bodyText = bodyBuf.toString('utf8');
    const bodyJson = parseJsonOrNull(bodyText);

    const record = {
      method: req.method,
      path: url.pathname,
      search: url.search,
      headers: req.headers,
      bodyText,
      bodyJson,
    };
    requests.push(record);

    const exp = expectations.shift();
    if (!exp) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unexpected request', request: record }));
      return;
    }

    try {
      assert.equal(record.method, exp.method, 'HTTP method mismatch');
      assert.equal(record.path, exp.path, 'HTTP path mismatch');
      if (exp.assert) exp.assert(record);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Expectation failed', message: e.message, request: record }));
      return;
    }

    const status = exp.status ?? 200;
    const json = exp.json ?? {};
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(json));
  });

  return {
    requests,
    expect(method, path, { assert, status, json } = {}) {
      expectations.push({ method, path, assert, status, json });
    },
    async listen() {
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const addr = server.address();
      const baseUrl = `http://127.0.0.1:${addr.port}/v2`;
      return { baseUrl };
    },
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
    assertNoPendingExpectations() {
      assert.equal(expectations.length, 0, `Unconsumed expectations: ${expectations.length}`);
    },
  };
}

function authAssertFactory(expectedKey) {
  return (req) => {
    assert.equal(req.headers.authorization, `Bearer ${expectedKey}`);
  };
}

async function writeLocalConfig(sandbox, configObject) {
  const cfgDir = path.join(sandbox.cwd, '.typefully');
  await fs.mkdir(cfgDir, { recursive: true });
  await fs.writeFile(path.join(cfgDir, 'config.json'), JSON.stringify(configObject, null, 2));
}

function expectCliOk(result, expectedJson) {
  assert.equal(result.code, 0);
  if (expectedJson !== undefined) {
    assert.deepEqual(parseJsonOrNull(result.stdout), expectedJson);
  }
}

function expectCliError(result, expectedJson, expectedCode = 1) {
  assert.equal(result.code, expectedCode);
  if (expectedJson !== undefined) {
    assert.deepEqual(parseJsonOrNull(result.stdout), expectedJson);
  }
}

function withCliHarness(testFn, { apiKey = DEFAULT_API_KEY } = {}) {
  return async () => {
    const sandbox = await makeSandbox();
    const server = createMockServer();
    const { baseUrl } = await server.listen();
    let succeeded = false;

    const run = (args, { env = {}, timeoutMs } = {}) =>
      runCli(args, {
        cwd: sandbox.cwd,
        timeoutMs,
        env: buildCliEnv({ home: sandbox.home, baseUrl, apiKey, env }),
      });

    try {
      await testFn({
        sandbox,
        server,
        baseUrl,
        apiKey,
        run,
        writeLocalConfig: async (configObject) => writeLocalConfig(sandbox, configObject),
      });
      succeeded = true;
    } finally {
      try {
        if (succeeded) {
          server.assertNoPendingExpectations();
        }
      } finally {
        await server.close();
        await sandbox.cleanup();
      }
    }
  };
}

module.exports = {
  test,
  describe,
  it,
  assert,
  http,
  fs,
  path,
  os,
  DEFAULT_API_KEY,
  CLI_PATH,
  mkdtemp,
  makeSandbox,
  runCli,
  buildCliEnv,
  parseJsonOrNull,
  createMockServer,
  authAssertFactory,
  writeLocalConfig,
  expectCliOk,
  expectCliError,
  withCliHarness,
};
