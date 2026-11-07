'use strict';

const { spawn } = require('node:child_process');
const dotslash = require('fb-dotslash');

const FORWARDED = ['SIGTERM', 'SIGHUP', 'SIGQUIT'];
const DELIVERED_TO_GROUP = ['SIGINT'];

function runPinned(pin, args) {
  const child = spawn(dotslash, [pin, ...args], { stdio: 'inherit' });
  const forward = (signal) => child.kill(signal);
  const ignore = () => {};
  FORWARDED.forEach((signal) => process.on(signal, forward));
  DELIVERED_TO_GROUP.forEach((signal) => process.on(signal, ignore));
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      FORWARDED.forEach((s) => process.off(s, forward));
      DELIVERED_TO_GROUP.forEach((s) => process.off(s, ignore));
      resolve(code === null ? { signal } : { code });
    });
  });
}

module.exports = { runPinned };
