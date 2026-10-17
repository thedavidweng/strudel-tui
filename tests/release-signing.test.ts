import { afterEach, expect, test } from 'bun:test';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = join(import.meta.dir, '../scripts/sign-and-notarize.sh');
const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true }); });

function run(options: { os?: string; identity?: string; failure?: string; status?: string; team?: string; missingKey?: boolean; finalFailure?: boolean } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'strudel-signing-'));
  directories.push(directory);
  const log = join(directory, 'commands');
  writeFileSync(log, '');
  for (const command of ['codesign', 'ditto', 'xcrun']) {
    const path = join(directory, command);
    writeFileSync(path, `#!/bin/bash
set -eu
printf '%s\\n' "${command} $*" >> "$COMMAND_LOG"
if [[ "$FAILURE" == "${command}" ]]; then exit 42; fi
${command === 'codesign' ? 'if [[ "$FINAL_FAILURE" == "yes" && "$*" == *"-R=notarized"* ]]; then exit 43; fi' : ''}
${command === 'codesign' ? 'if [[ "$1" == "--display" ]]; then echo "TeamIdentifier=$SIGNING_TEAM" >&2; fi' : ''}
${command === 'xcrun' ? 'printf \'{"status":"%s"}\\n\' "$NOTARY_STATUS"' : ''}
`);
    chmodSync(path, 0o755);
  }
  const result = Bun.spawnSync(['bash', script, options.os ?? 'darwin', join(directory, 'binary with spaces')], {
    env: {
      ...process.env, PATH: `${directory}:${process.env.PATH}`, COMMAND_LOG: log,
      APPLE_SIGNING_IDENTITY: options.identity ?? 'Developer ID Application: Test (TESTTEAM)',
      APPLE_SIGNING_KEYCHAIN: '/temporary/keychain', APPLE_TEAM_ID: 'TESTTEAM',
      APPLE_API_KEY_PATH: '/temporary/notary.p8', APPLE_API_KEY_ID: options.missingKey ? '' : 'KEY', APPLE_API_ISSUER: 'ISSUER',
      SIGNING_TEAM: options.team ?? 'TESTTEAM', FINAL_FAILURE: options.finalFailure ? 'yes' : 'no',
      FAILURE: options.failure ?? '', NOTARY_STATUS: options.status ?? 'Accepted',
    },
  });
  return { result, commands: readFileSync(log, 'utf8') };
}

test('macOS verifies Developer ID, accepts notarization and checks the Homebrew requirement', () => {
  const { result, commands } = run();
  expect(result.exitCode).toBe(0);
  expect(commands).toContain('--options runtime');
  expect(commands).toContain('--entitlements');
  expect(commands).toContain('notarytool submit');
  expect(commands).toContain('--wait --timeout 30m');
  expect(commands).toContain('codesign --verify -R=notarized --check-notarization');
  expect(commands).not.toContain('stapler');
  expect(commands.indexOf('notarytool submit')).toBeLessThan(commands.indexOf('-R=notarized'));
});

test('rejects development identities before invoking any signing tools', () => {
  const { result, commands } = run({ identity: 'Apple Development: Test' });
  expect(result.exitCode).not.toBe(0);
  expect(commands).toBe('');
});

for (const failure of ['codesign', 'ditto', 'xcrun']) {
  test(`${failure} failure stops the release before notarization verification`, () => {
    const { result, commands } = run({ failure });
    expect(result.exitCode).toBe(42);
    expect(commands).not.toContain('-R=notarized');
  });
}

test('a rejected notarization does not reach the final verification', () => {
  const { result, commands } = run({ status: 'Invalid' });
  expect(result.exitCode).not.toBe(0);
  expect(commands).not.toContain('-R=notarized');
});

for (const os of ['linux', 'windows']) {
  test(`${os} artifacts retain their existing unsigned packaging path`, () => {
    const { result, commands } = run({ os });
    expect(result.exitCode).toBe(0);
    expect(commands).toBe('');
  });
}

test('rejects a certificate from a different team before submitting to Apple', () => {
  const { result, commands } = run({ team: 'OTHERTEAM' });
  expect(result.exitCode).not.toBe(0);
  expect(commands).not.toContain('notarytool');
});

test('missing notarization credentials block signing', () => {
  const { result, commands } = run({ missingKey: true });
  expect(result.exitCode).not.toBe(0);
  expect(commands).toBe('');
});

test('an accepted submission cannot mask a failing Homebrew requirement', () => {
  const { result, commands } = run({ finalFailure: true });
  expect(result.exitCode).toBe(43);
  expect(commands).toContain('-R=notarized');
});
