// The HTTP client: URLs, conditional requests, errors. No network: a fake fetch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChmiError, createChmiClient, utcDay } from '../src/chmi/client.js';
import { createFakeChmi } from './helpers/fakeChmi.js';

test('utcDay: the UTC date of the file names', () => {
  assert.equal(utcDay(Date.parse('2026-11-20T23:30:00+01:00')), '20261120');
  assert.equal(utcDay(Date.parse('2026-11-21T00:30:00+01:00')), '20261120');
});

test('observations: the file of the station and day, then a 304 with its ETag', async () => {
  const fake = createFakeChmi();
  const client = createChmiClient({ fetch: fake.fetch });
  const first = await client.observations('0-203-0-11514', '20261117');
  assert.equal(
    fake.requests[0].url.href,
    'https://opendata.chmi.cz/meteorology/climate/now/data/10m-0-203-0-11514-20261117.json',
  );
  assert.ok(first.json.data.data.values.length > 0);
  assert.match(first.etag, /^".+"$/);
  const second = await client.observations('0-203-0-11514', '20261117', first.etag);
  assert.equal(fake.requests[1].headers['if-none-match'], first.etag);
  assert.equal(second.json, undefined, 'unchanged: no body');
  assert.ok(fake.requests.every((r) => /^gladys-chmi/.test(r.headers['user-agent'])));
});

test('errors: HTTP status, network failure, timeout, not JSON', async () => {
  const fake = createFakeChmi();
  const client = createChmiClient({ fetch: fake.fetch, timeoutMs: 1000 });
  await assert.rejects(client.observations('0-203-0-99999', '20261117'), (err) => {
    assert.ok(err instanceof ChmiError);
    assert.equal(err.status, 404);
    assert.match(err.message, /10m-0-203-0-99999-20261117\.json answered HTTP 404/);
    return true;
  });
  fake.state.fail.listing = new TypeError('fetch failed');
  await assert.rejects(client.capListing(), /opendata\.chmi\.cz unreachable \(fetch failed\)/);

  const slow = createChmiClient({
    fetch: () => Promise.reject(Object.assign(new Error('aborted'), { name: 'TimeoutError' })),
    timeoutMs: 1000,
  });
  await assert.rejects(slow.capListing(), /no answer within 1 s/);

  const html = createChmiClient({ fetch: async () => new Response('<html>', { status: 200 }) });
  await assert.rejects(html.metadata('20261117'), /not JSON/);
});

test('the CAP index and files are plain text', async () => {
  const fake = createFakeChmi();
  const client = createChmiClient({ fetch: fake.fetch });
  assert.match(await client.capListing(), /alert_cap_50_171002\.xml/);
  assert.match(await client.capFile('alert_cap_50_171002.xml'), /^<\?xml/);
});
