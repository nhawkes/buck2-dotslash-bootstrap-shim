'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { projectRoot, pinnedBuck2, NotInProject, PinNotConfigured, PinMissing } = require('../lib/project');

function tree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'buck2-dotslash-'));
  Object.entries(files).forEach(([file, contents]) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), contents);
  });
  return root;
}

test('the outermost .buckconfig is the project root, as buck2 reads it', () => {
  const root = tree({ '.buckconfig': '', 'cell/.buckconfig': '', 'cell/deep/x': '' });
  assert.equal(projectRoot(path.join(root, 'cell', 'deep')), root);
});

test('the nearest .buckroot overrides every .buckconfig above it', () => {
  const root = tree({ '.buckconfig': '', 'inner/.buckroot': '', 'inner/.buckconfig': '', 'inner/a/x': '' });
  assert.equal(projectRoot(path.join(root, 'inner', 'a')), path.join(root, 'inner'));
});

test('outside any project is an error naming the directory', () => {
  const root = tree({ 'x': '' });
  assert.throws(() => projectRoot(root), NotInProject);
});

test('the pin is the DotSlash file .buckconfig names, relative to the root', () => {
  const root = tree({ '.buckconfig': '[cells]\nroot = .\n\n[buck2_dotslash]\nfile = toolchains/buck2\n', 'toolchains/buck2': '#!/usr/bin/env dotslash\n' });
  assert.equal(pinnedBuck2(root), path.join(root, 'toolchains', 'buck2'));
});

test('a .buckconfig without the key is an error, never a guessed path', () => {
  const root = tree({ '.buckconfig': '[cells]\nroot = .\n', 'toolchains/buck2': '' });
  assert.throws(() => pinnedBuck2(root), PinNotConfigured);
});

test('a key naming no file is an error', () => {
  const root = tree({ '.buckconfig': '[buck2_dotslash]\nfile = toolchains/buck2\n' });
  assert.throws(() => pinnedBuck2(root), PinMissing);
});

test('a key naming a directory is an error', () => {
  const root = tree({ '.buckconfig': '[buck2_dotslash]\nfile = toolchains\n', 'toolchains/x': '' });
  assert.throws(() => pinnedBuck2(root), PinMissing);
});
