# buck2-dotslash-bootstrap-shim

A `buck2` on your PATH that runs whichever buck2 the current checkout pins with a [DotSlash](https://dotslash-cli.com/) file. DotSlash comes with the package as a dependency, so nothing else needs installing.

```sh
npm install -g buck2-dotslash-bootstrap-shim
```

## Setting up a repository

Check in a DotSlash file for buck2, and name it in the root `.buckconfig`:

```ini
[buck2_dotslash]
file = toolchains/buck2
```

The path is relative to the project root. There is no default: a `.buckconfig` without the key is an error.

## What it does

From the current directory it finds the project root as buck2 does: the nearest directory holding a `.buckroot`, otherwise the outermost one holding a `.buckconfig`. It then runs the named DotSlash file, which fetches buck2 once, checks its hash and caches it. Arguments pass through untouched, and buck2's exit code or fatal signal becomes the shim's own.

Outside a buck2 project there is nothing to run, so the shim reports that and exits with 1.
