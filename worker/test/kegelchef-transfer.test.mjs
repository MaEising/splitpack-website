import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../src/index.js';

test('creates and resolves KegelChef transfer links', async () => {
  const env = createEnv();
  const payload = createCompactPayload([3, [['Ben', 0]], [[0, 0, 3]]]);
  const createResponse = await worker.fetch(
    new Request('https://links.splitpack.de/api/kegelchef/transfers', {
      body: JSON.stringify({ payload }),
      headers: {
        'CF-Connecting-IP': '198.51.100.1',
        'Content-Type': 'application/json',
      },
      method: 'POST',
    }),
    env
  );

  assert.equal(createResponse.status, 201);
  const createBody = await createResponse.json();
  assert.match(createBody.url, /^https:\/\/links\.splitpack\.de\/kc\/[a-f0-9]{40}$/);

  const resolveResponse = await worker.fetch(
    new Request(
      createBody.url.replace(
        'https://links.splitpack.de/kc/',
        'https://links.splitpack.de/api/kegelchef/transfers/'
      ),
      {
        headers: { 'CF-Connecting-IP': '198.51.100.2' },
      }
    ),
    env
  );

  assert.equal(resolveResponse.status, 200);
  assert.deepEqual(await resolveResponse.json(), { payload });
});

test('rejects payload pollution and malformed compact payloads', async () => {
  const env = createEnv();
  const response = await worker.fetch(
    new Request('https://links.splitpack.de/api/kegelchef/transfers', {
      body: JSON.stringify({
        payload: createCompactPayload([3, [{ name: 'Ben', premium: true }], []]),
      }),
      headers: {
        'CF-Connecting-IP': '198.51.100.3',
        'Content-Type': 'application/json',
      },
      method: 'POST',
    }),
    env
  );

  assert.equal(response.status, 400);
});

test('rate-limits transfer creation by client ip', async () => {
  const env = createEnv();
  const payload = createCompactPayload([3, [], []]);

  for (let index = 0; index < 20; index += 1) {
    const response = await worker.fetch(
      new Request('https://links.splitpack.de/api/kegelchef/transfers', {
        body: JSON.stringify({ payload }),
        headers: {
          'CF-Connecting-IP': '198.51.100.4',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
      env
    );
    assert.equal(response.status, 201);
  }

  const limitedResponse = await worker.fetch(
    new Request('https://links.splitpack.de/api/kegelchef/transfers', {
      body: JSON.stringify({ payload }),
      headers: {
        'CF-Connecting-IP': '198.51.100.4',
        'Content-Type': 'application/json',
      },
      method: 'POST',
    }),
    env
  );

  assert.equal(limitedResponse.status, 429);
});

function createCompactPayload(value) {
  return `KC3.${Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')}`;
}

function createEnv() {
  const values = new Map();

  return {
    CONFIG_TRANSFERS: {
      async get(key, type) {
        const value = values.get(key) ?? null;
        return type === 'json' && value ? JSON.parse(value) : value;
      },
      async put(key, value) {
        values.set(key, value);
      },
    },
  };
}
