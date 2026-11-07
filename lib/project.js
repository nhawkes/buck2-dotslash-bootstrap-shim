'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ini = require('ini');

const SECTION = 'buck2_dotslash';
const KEY = 'file';

class NotInProject extends Error {
  constructor(cwd) {
    super(`no .buckconfig or .buckroot in ${cwd} or any parent directory`);
    this.cwd = cwd;
  }
}

class PinNotConfigured extends Error {
  constructor(buckconfig) {
    super(`${buckconfig} has no [${SECTION}] ${KEY} = <path to the DotSlash file that pins buck2>`);
    this.buckconfig = buckconfig;
  }
}

class PinMissing extends Error {
  constructor(buckconfig, pin) {
    super(`${buckconfig} names ${pin} as the buck2 DotSlash file, but it does not exist`);
    this.buckconfig = buckconfig;
    this.pin = pin;
  }
}

function ancestors(dir) {
  const parent = path.dirname(dir);
  return parent === dir ? [dir] : [dir, ...ancestors(parent)];
}

function projectRoot(cwd) {
  const dirs = ancestors(path.resolve(cwd));
  const marked = dirs.find((dir) => fs.existsSync(path.join(dir, '.buckroot')));
  if (marked !== undefined) {
    return marked;
  }
  const configured = dirs.filter((dir) => fs.existsSync(path.join(dir, '.buckconfig')));
  if (configured.length === 0) {
    throw new NotInProject(cwd);
  }
  return configured[configured.length - 1];
}

function pinnedBuck2(root) {
  const buckconfig = path.join(root, '.buckconfig');
  const section = ini.parse(fs.readFileSync(buckconfig, 'utf8'))[SECTION];
  const relative = section === undefined ? undefined : section[KEY];
  if (typeof relative !== 'string') {
    throw new PinNotConfigured(buckconfig);
  }
  const pin = path.resolve(root, relative);
  if (!fs.statSync(pin, { throwIfNoEntry: false })?.isFile()) {
    throw new PinMissing(buckconfig, pin);
  }
  return pin;
}

module.exports = { projectRoot, pinnedBuck2, NotInProject, PinNotConfigured, PinMissing };
