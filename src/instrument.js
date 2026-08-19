import './identity-logos.js';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as Sentry from '@sentry/node';

const SERVICE = 'communications-studio-backend';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SENSITIVE_KEY = /(authorization|cookie|password|secret|token|dsn|code_verifier|client_secret)/i;
const REDACTION_RULES = Object.freeze([
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]'],
  [/\bBasic\s+[A-Za-z0-9+/=]+/gi, 'Basic [REDACTED]'],
  [/\b(DISCORD_CLIENT_SECRET|DISCORD_BOT_TOKEN|ROBLOX_CLIENT_SECRET|SENTRY_DSN)\s*=\s*[^\s]+/gi, '$1=[REDACTED]'],
  [/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{20,}\b/g, '[REDACTED_TOKEN]']
]);

function redactString(value) {
  let output = String(value ?? '');
  for (const [pattern, replacement] of REDACTION_RULES) output = output.replace(pattern, replacement);
  return output;
}

function sanitize(value, seen = new WeakSet()) {
  if (typeof value === 'string') return redactString(value);
  if (value === null || value === undefined || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      stack: redactString(value.stack || '')
    };
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) return '[CIRCULAR]';
    seen.add(value);
    const result = value.map((entry) => sanitize(entry, seen));
    seen.delete(value);
    return result;
  }
  if (typeof value === 'object') {
    if (seen.has(value)) return '[CIRCULAR]';
    seen.add(value);
    const result = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : sanitize(entry, seen);
    }
    seen.delete(value);
    return result;
  }
  return redactString(value);
}

function sampleRate(value, fallback = 0.1) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

function sourceRelease() {
  try {
    const sha = execFileSync('/usr/bin/git', ['rev-parse', 'HEAD'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    return /^[0-9a-f]{40}$/i.test(sha) ? `${SERVICE}@${sha}` : undefined;
  } catch {
    return undefined;
  }
}

const dsn = String(process.env.SENTRY_DSN || '').trim();
export const sentryEnabled = Boolean(dsn);
export const sentryRelease = sourceRelease();

if (sentryEnabled) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'production',
    release: sentryRelease,
    sendDefaultPii: false,
    enableLogs: true,
    tracesSampleRate: sampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE, 0.1),
    beforeSend(event) {
      return sanitize(event);
    }
  });

  Sentry.setTag('service', SERVICE);
  Sentry.setTag('host', process.env.SENTRY_HOST || os.hostname());
  if (sentryRelease) Sentry.setTag('deployment_source', sentryRelease);

  const originalConsoleError = console.error.bind(console);
  let capturingConsoleError = false;
  console.error = (...args) => {
    originalConsoleError(...args);
    if (capturingConsoleError) return;
    capturingConsoleError = true;
    try {
      const error = args.find((entry) => entry instanceof Error)
        || new Error(redactString(args.map((entry) => typeof entry === 'string' ? entry : JSON.stringify(sanitize(entry))).join(' ')) || 'Communications Studio logged an error.');
      Sentry.withScope((scope) => {
        scope.setLevel('error');
        scope.setTag('service', SERVICE);
        scope.setContext('communications_studio', sanitize({ console_args: args }));
        Sentry.captureException(error);
      });
    } catch {
      // Observability must never be able to crash the application.
    } finally {
      capturingConsoleError = false;
    }
  };
}

export async function flushSentry(timeoutMs = 2000) {
  if (!sentryEnabled) return true;
  try {
    return await Sentry.flush(timeoutMs);
  } catch {
    return false;
  }
}

export { redactString, sanitize };
