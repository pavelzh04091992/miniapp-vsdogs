import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadDotEnv(options = {}) {
  const env = options.env ?? process.env;
  const envPath = options.path ?? resolve(options.cwd ?? process.cwd(), '.env');

  try {
    const content = readFileSync(envPath, 'utf8');

    for (const line of content.split(/\r?\n/)) {
      const parsed = parseDotEnvLine(line);

      if (parsed && env[parsed.key] === undefined) {
        env[parsed.key] = parsed.value;
      }
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }

  return env;
}

export function getRequiredEnv(name, env = process.env) {
  const value = env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function parseEnvBoolean(value, fallback = false) {
  if (value === undefined || value === '') {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  throw new Error(`Invalid boolean environment value: ${value}`);
}

function parseDotEnvLine(line) {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const separator = trimmed.indexOf('=');

  if (separator <= 0) {
    return null;
  }

  const key = trimmed.slice(0, separator).trim();

  if (!/^[A-Za-z_][A-Za-z\d_]*$/.test(key)) {
    return null;
  }

  const rawValue = trimmed.slice(separator + 1).trim();
  const isQuoted =
    rawValue.length >= 2 &&
    ((rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'")));

  return {
    key,
    value: isQuoted ? rawValue.slice(1, -1) : rawValue,
  };
}
