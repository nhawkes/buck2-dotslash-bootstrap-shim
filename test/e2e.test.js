'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');

const SHIM = path.join(__dirname, '..', 'bin', 'buck2.js');
const FAKE_BUCK2 = `#!${process.execPath}
const behaviour = JSON.parse(process.env.FAKE_BUCK2);
process.stdout.write(JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }));
if ('exit' in behaviour) {
  process.exitCode = behaviour.exit;
} else if ('raise' in behaviour) {
  process.kill(process.pid, behaviour.raise);
} else {
  const timer = setInterval(() => {}, 1000);
  process.on(behaviour.trap, () => {
    clearInterval(timer);
    process.exitCode = behaviour.trapped;
  });
}
`;

const PLATFORMS = ['linux-x86_64', 'linux-aarch64', 'macos-x86_64', 'macos-aarch64'];

function serve(body) {
  const server = http.createServer((request, response) => response.end(body));
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function project(url) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'buck2-dotslash-e2e-'));
  const artifact = {
    size: Buffer.byteLength(FAKE_BUCK2),
    hash: 'sha256',
    digest: crypto.createHash('sha256').update(FAKE_BUCK2).digest('hex'),
    path: 'buck2',
    providers: [{ url }],
  };
  const platforms = Object.fromEntries(PLATFORMS.map((platform) => [platform, artifact]));
  fs.mkdirSync(path.join(root, 'tools'));
  fs.mkdirSync(path.join(root, 'sub', 'dir'), { recursive: true });
  fs.writeFileSync(path.join(root, 'tools', 'buck2'), `#!/usr/bin/env dotslash\n\n${JSON.stringify({ name: 'buck2', platforms }, null, 2)}\n`);
  fs.writeFileSync(path.join(root, '.buckconfig'), '[buck2_dotslash]\nfile = tools/buck2\n');
  return root;
}

function shim(cwd, args, behaviour, whileRunning) {
  const env = {
    ...process.env,
    DOTSLASH_CACHE: fs.mkdtempSync(path.join(os.tmpdir(), 'buck2-dotslash-cache-')),
    NO_PROXY: '127.0.0.1',
    no_proxy: '127.0.0.1',
    FAKE_BUCK2: JSON.stringify(behaviour),
  };
  return new Promise((resolve) => {
    const child = execFile(process.execPath, [SHIM, ...args], { cwd, env, encoding: 'utf8' }, (error, stdout, stderr) =>
      resolve({ status: child.exitCode, signal: child.signalCode, stdout, stderr }),
    );
    child.stdout.once('data', () => whileRunning(child));
  });
}

async function withProject(body) {
  const server = await serve(FAKE_BUCK2);
  try {
    const root = project(`http://127.0.0.1:${server.address().port}/buck2`);
    await body(root);
  } finally {
    server.close();
  }
}

const unix = { skip: process.platform === 'win32' };

test('runs the pinned buck2 from a subdirectory with arguments and exit code intact', unix, () =>
  withProject(async (root) => {
    const cwd = path.join(root, 'sub', 'dir');
    const args = ['build', '//a:b', 'two words', '', '"quoted"', "it's", 'ünïcödé', '--', '$HOME'];
    const result = await shim(cwd, args, { exit: 3 }, () => {});
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout), { args, cwd: fs.realpathSync(cwd) });
    assert.equal(result.status, 3);
  }));

test('a buck2 killed by a signal kills the shim with the same signal', unix, () =>
  withProject(async (root) => {
    const result = await shim(root, [], { raise: 'SIGABRT' }, () => {});
    assert.equal(result.signal, 'SIGABRT');
  }));

test('SIGTERM sent to the shim reaches buck2, whose exit the shim reports', unix, () =>
  withProject(async (root) => {
    const result = await shim(root, [], { trap: 'SIGTERM', trapped: 7 }, (child) => child.kill('SIGTERM'));
    assert.equal(result.status, 7);
  }));
