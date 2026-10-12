import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { getRequiredEnv, loadDotEnv, parseEnvBoolean } from './env.mjs';

test('loads a dotenv file without overriding existing environment values', () => {
  const directory = mkdtempSync(join(tmpdir(), 'miniapp-env-'));
  const path = join(directory, '.env');
  const env = { EXISTING: 'keep' };
  writeFileSync(path, 'EXISTING=replace\nPLAIN=value\nQUOTED="hello world"\nINVALID-KEY=nope\n');

  try {
    loadDotEnv({ path, env });
    assert.deepEqual(env, {
      EXISTING: 'keep',
      PLAIN: 'value',
      QUOTED: 'hello world',
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('validates required strings and boolean environment values', () => {
  assert.equal(getRequiredEnv('VALUE', { VALUE: ' ready ' }), 'ready');
  assert.throws(() => getRequiredEnv('VALUE', { VALUE: ' ' }), /Missing required/);
  assert.equal(parseEnvBoolean('YES'), true);
  assert.equal(parseEnvBoolean('off', true), false);
  assert.equal(parseEnvBoolean(undefined, true), true);
  assert.throws(() => parseEnvBoolean('sometimes'), /Invalid boolean/);
});
