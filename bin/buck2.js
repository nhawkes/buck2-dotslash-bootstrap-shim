#!/usr/bin/env node
'use strict';

const { projectRoot, pinnedBuck2 } = require('../lib/project');
const { runPinned } = require('../lib/run');

async function main() {
  const pin = pinnedBuck2(projectRoot(process.cwd()));
  const exit = await runPinned(pin, process.argv.slice(2));
  if ('signal' in exit) {
    process.kill(process.pid, exit.signal);
  } else {
    process.exitCode = exit.code;
  }
}

main().catch((error) => {
  process.stderr.write(`buck2-dotslash-bootstrap-shim: ${error.message}\n`);
  process.exitCode = 1;
});
