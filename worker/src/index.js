const SHORT_LINK_PREFIX = 'https://links.splitpack.de/kc/';
const TRANSFER_TTL_SECONDS = 48 * 60 * 60;
const MAX_REQUEST_BYTES = 30_000;
const MAX_TOKEN_LENGTH = 50_000;
const MAX_ITEMS = 250;
const MAX_MEMBER_NAME_LENGTH = 50;
const MAX_EXPLANATION_LENGTH = 500;
const DEFAULT_PENALTY_COUNT = 12;
const AVATAR_COUNT = 24;
const ICON_COUNT = 15;
const COMPACT_PREFIX = 'KC3.';
const TOKEN_PATTERN = /^[a-f0-9]{40}$/;
const BASE64_URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const RATE_LIMITS = {
  create: { limit: 20, windowSeconds: 60 },
  resolve: { limit: 120, windowSeconds: 60 },
};

const securityHeaders = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      if (error instanceof RequestError) {
        return jsonResponse({ error: error.message }, error.status);
      }

      console.error(error);
      return jsonResponse({ error: 'internal_error' }, 500);
    }
  },
};

export async function handleRequest(request, env) {
  const url = new URL(request.url);

  if (!env.CONFIG_TRANSFERS) {
    return jsonResponse({ error: 'service_not_configured' }, 500);
  }

  if (url.pathname === '/api/kegelchef/transfers' && request.method === 'POST') {
    return createTransfer(request, env);
  }

  if (url.pathname.startsWith('/api/kegelchef/transfers/') && request.method === 'GET') {
    const token = url.pathname.slice('/api/kegelchef/transfers/'.length);
    return resolveTransfer(token, request, env);
  }

  if (url.pathname.startsWith('/kc/') && request.method === 'GET') {
    const token = url.pathname.slice('/kc/'.length);
    return renderKegelChefFallback(token);
  }

  return jsonResponse({ error: 'not_found' }, 404);
}

async function createTransfer(request, env) {
  if (await isRateLimited(env, request, 'create', RATE_LIMITS.create)) {
    return jsonResponse({ error: 'rate_limited' }, 429);
  }

  if (!isJsonRequest(request)) {
    return jsonResponse({ error: 'unsupported_media_type' }, 415);
  }

  const rawBody = await readLimitedRequestBody(request);
  const body = parseJsonObject(rawBody);

  if (!body || Object.keys(body).length !== 1 || typeof body.payload !== 'string') {
    return jsonResponse({ error: 'invalid_request' }, 400);
  }

  validateCompactPayload(body.payload);

  const token = createRandomToken();
  const storageKey = await toStorageKey(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TRANSFER_TTL_SECONDS * 1000).toISOString();

  await env.CONFIG_TRANSFERS.put(
    storageKey,
    JSON.stringify({
      createdAt: now.toISOString(),
      expiresAt,
      payload: body.payload,
    }),
    { expirationTtl: TRANSFER_TTL_SECONDS }
  );

  return jsonResponse(
    {
      expiresAt,
      url: `${SHORT_LINK_PREFIX}${token}`,
    },
    201
  );
}

async function resolveTransfer(token, request, env) {
  if (!TOKEN_PATTERN.test(token)) {
    return jsonResponse({ error: 'not_found' }, 404);
  }

  if (await isRateLimited(env, request, 'resolve', RATE_LIMITS.resolve)) {
    return jsonResponse({ error: 'rate_limited' }, 429);
  }

  const storedTransfer = await env.CONFIG_TRANSFERS.get(await toStorageKey(token), 'json');

  if (!storedTransfer || typeof storedTransfer.payload !== 'string') {
    return jsonResponse({ error: 'not_found' }, 404);
  }

  validateCompactPayload(storedTransfer.payload);

  return jsonResponse({ payload: storedTransfer.payload }, 200);
}

function renderKegelChefFallback(token) {
  if (!TOKEN_PATTERN.test(token)) {
    return htmlResponse(renderNotFoundPage(), 404);
  }

  const nonce = createNonce();
  const deepLink = `kegelchef://import-token/${token}`;
  return htmlResponse(`<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>KegelChef Konfiguration</title>
    <style nonce="${nonce}">
      :root { color-scheme: light; --bg: #fffaf4; --card: #fff; --ink: #172033; --muted: #64748b; --line: #fed7aa; --accent: #f97316; --accent-dark: #c2410c; }
      * { box-sizing: border-box; }
      body { min-height: 100vh; margin: 0; background: var(--bg); color: var(--ink); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { display: grid; min-height: 100vh; place-items: center; padding: 32px 20px; }
      .panel { width: min(100%, 420px); border: 1px solid var(--line); border-radius: 18px; background: var(--card); padding: 32px; text-align: center; }
      h1 { margin: 0; font-size: clamp(2rem, 9vw, 3rem); line-height: 1; letter-spacing: 0; }
      p { margin: 16px auto 0; color: var(--muted); font-size: 1.05rem; line-height: 1.55; }
      .button { display: inline-flex; min-height: 56px; align-items: center; justify-content: center; margin-top: 28px; border-radius: 14px; background: var(--accent); color: #fff; font-weight: 800; padding: 0 28px; text-decoration: none; }
      .button:hover { background: var(--accent-dark); }
      .secondary { display: inline-flex; margin-top: 18px; color: var(--accent-dark); font-size: 0.95rem; font-weight: 700; text-decoration: none; }
    </style>
  </head>
  <body>
    <main>
      <section class="panel" aria-labelledby="title">
        <h1 id="title">KegelChef</h1>
        <p>Tippe auf den Button, um die geteilte Konfiguration in KegelChef zu laden.</p>
        <a class="button" href="${deepLink}">In KegelChef öffnen</a>
        <a class="secondary" href="https://apps.apple.com/de/app/kegelchef/id6770973979">KegelChef installieren</a>
      </section>
    </main>
    <script nonce="${nonce}">
      window.setTimeout(function () {
        window.location.href = ${JSON.stringify(deepLink)};
      }, 650);
    </script>
  </body>
</html>`, 200, nonce);
}

function renderNotFoundPage() {
  return '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>KegelChef</title></head><body><main><h1>KegelChef</h1><p>Dieser Link ist nicht gültig oder abgelaufen.</p></main></body></html>';
}

async function isRateLimited(env, request, namespace, settings) {
  const ipAddress = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipHash = await sha256Hex(ipAddress);
  const windowId = Math.floor(Date.now() / 1000 / settings.windowSeconds);
  const key = `rl:${namespace}:${ipHash}:${windowId}`;
  const currentValue = Number.parseInt((await env.CONFIG_TRANSFERS.get(key)) || '0', 10);

  if (Number.isFinite(currentValue) && currentValue >= settings.limit) {
    return true;
  }

  await env.CONFIG_TRANSFERS.put(key, String((Number.isFinite(currentValue) ? currentValue : 0) + 1), {
    expirationTtl: settings.windowSeconds * 2,
  });

  return false;
}

function isJsonRequest(request) {
  const contentType = request.headers.get('Content-Type') || '';
  return contentType.toLowerCase().split(';')[0].trim() === 'application/json';
}

async function readLimitedRequestBody(request) {
  const contentLength = request.headers.get('Content-Length');

  if (contentLength && Number.parseInt(contentLength, 10) > MAX_REQUEST_BYTES) {
    throw new RequestError('request_too_large', 413);
  }

  const body = await request.text();

  if (body.length > MAX_REQUEST_BYTES) {
    throw new RequestError('request_too_large', 413);
  }

  return body;
}

function parseJsonObject(value) {
  try {
    const parsedValue = JSON.parse(value);
    return isPlainObject(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

function validateCompactPayload(token) {
  if (typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH || !token.startsWith(COMPACT_PREFIX)) {
    throw new RequestError('invalid_payload', 400);
  }

  const encodedPayload = token.slice(COMPACT_PREFIX.length);

  if (!BASE64_URL_PATTERN.test(encodedPayload) || encodedPayload.length % 4 === 1) {
    throw new RequestError('invalid_payload', 400);
  }

  let payload;

  try {
    payload = JSON.parse(base64UrlDecodeUtf8(encodedPayload));
  } catch {
    throw new RequestError('invalid_payload', 400);
  }

  validateCompactStructure(payload);
}

function validateCompactStructure(value) {
  if (!Array.isArray(value) || value.length !== 3 || value[0] !== 3) {
    throw new RequestError('invalid_payload', 400);
  }

  const [, members, penalties] = value;

  if (!Array.isArray(members) || members.length > MAX_ITEMS) {
    throw new RequestError('invalid_payload', 400);
  }

  if (!Array.isArray(penalties) || penalties.length > MAX_ITEMS) {
    throw new RequestError('invalid_payload', 400);
  }

  members.forEach(validateMember);
  penalties.forEach(validatePenalty);
}

function validateMember(value) {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new RequestError('invalid_payload', 400);
  }

  const [name, avatarCode] = value;

  if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > MAX_MEMBER_NAME_LENGTH) {
    throw new RequestError('invalid_payload', 400);
  }

  if (!Number.isInteger(avatarCode) || avatarCode < 0 || avatarCode >= AVATAR_COUNT) {
    throw new RequestError('invalid_payload', 400);
  }
}

function validatePenalty(value) {
  if (!Array.isArray(value) || (value[0] !== 0 && value[0] !== 1)) {
    throw new RequestError('invalid_payload', 400);
  }

  if (value[0] === 0) {
    validateDefaultPenalty(value);
    return;
  }

  validateCustomPenalty(value);
}

function validateDefaultPenalty(value) {
  if (value.length !== 3) {
    throw new RequestError('invalid_payload', 400);
  }

  const [, defaultPenaltyCode, flags] = value;

  if (!Number.isInteger(defaultPenaltyCode) || defaultPenaltyCode < 0 || defaultPenaltyCode >= DEFAULT_PENALTY_COUNT) {
    throw new RequestError('invalid_payload', 400);
  }

  validateFlags(flags);
}

function validateCustomPenalty(value) {
  if (value.length !== 7) {
    throw new RequestError('invalid_payload', 400);
  }

  const [, name, amountCents, penaltyModeCode, iconCode, explanation, flags] = value;

  if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > MAX_MEMBER_NAME_LENGTH) {
    throw new RequestError('invalid_payload', 400);
  }

  if (amountCents !== null && (!Number.isInteger(amountCents) || amountCents < 0 || amountCents > Number.MAX_SAFE_INTEGER)) {
    throw new RequestError('invalid_payload', 400);
  }

  if (!Number.isInteger(penaltyModeCode) || penaltyModeCode < 0 || penaltyModeCode > 2) {
    throw new RequestError('invalid_payload', 400);
  }

  if (!Number.isInteger(iconCode) || iconCode < 0 || iconCode >= ICON_COUNT) {
    throw new RequestError('invalid_payload', 400);
  }

  if (explanation !== null && (typeof explanation !== 'string' || explanation.trim().length > MAX_EXPLANATION_LENGTH)) {
    throw new RequestError('invalid_payload', 400);
  }

  validateFlags(flags);
}

function validateFlags(value) {
  if (value !== 0 && value !== 1 && value !== 2 && value !== 3) {
    throw new RequestError('invalid_payload', 400);
  }
}

function createRandomToken() {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function toStorageKey(token) {
  return `transfer:${await sha256Hex(token)}`;
}

async function sha256Hex(value) {
  const input = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function base64UrlDecodeUtf8(value) {
  const paddedValue = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`;
  const binaryValue = atob(paddedValue.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(binaryValue, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...securityHeaders,
      'Content-Type': 'application/json; charset=utf-8',
    },
    status,
  });
}

function htmlResponse(body, status = 200, nonce = '') {
  const inlinePolicy = nonce
    ? `script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}';`
    : "script-src 'none'; style-src 'none';";

  return new Response(body, {
    headers: {
      ...securityHeaders,
      'Content-Security-Policy': `default-src 'none'; ${inlinePolicy} base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
      'Content-Type': 'text/html; charset=utf-8',
    },
    status,
  });
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

class RequestError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
