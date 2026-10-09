import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { getPlayerAwards } from '../src/utils/superlatives.js';
import { readRelayPayload, validateRelayPayload, RelayPayloadError } from '../supabase/functions/game-relay/payload.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = process.env.BROWSER_TEST_OUTPUT || root + '/test-results/browser';
mkdirSync(output, { recursive: true });
const report = {
  mode: 'Ten real Chromium contexts; isolated fake Supabase backend; no production access',
  checks: [],
  errors: [],
};
const sdk = `
const channels = new Map();
const identity = localStorage.getItem('bingo-test-identity') || crypto.randomUUID();
localStorage.setItem('bingo-test-identity', identity);
const pageKey = crypto.randomUUID();
let stream;
async function rpc(operation, values = {}) {
  const response = await fetch('/__ten/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity, pageKey, operation, ...values }) });
  return response.json();
}
function connectStream() {
  if (!stream) stream = new Promise((resolve, reject) => {
    const events = new EventSource('/__ten/events?identity=' + identity + '&pageKey=' + pageKey);
    events.onopen = () => resolve(events);
    events.onerror = () => reject(new Error('Local test event stream failed'));
    events.onmessage = ({ data }) => {
      const event = JSON.parse(data);
      const channel = channels.get(event.channelId);
      if (!channel) return;
      if (event.presence) channel.presence = event.presence;
      for (const handler of channel.handlers[event.kind] || []) handler(event.payload);
    };
  });
  return stream;
}
export function createClient() {
  return {
    auth: { getSession: () => rpc('session'), signInAnonymously: () => rpc('sign-in') },
    functions: { invoke: (name, { body }) => rpc('invoke', { name, body }) },
    channel(name, config) {
      const channel = { id: crypto.randomUUID(), state: 'closed', name, config, handlers: {}, presence: {},
        on(type, filter, callback) {
          const kind = type === 'broadcast' ? 'broadcast' : filter.event;
          (this.handlers[kind] ||= []).push(callback);
          return this;
        },
        subscribe(callback) {
          channels.set(this.id, this);
          connectStream().then(() => rpc('subscribe', { channelId: this.id, name, config })).then((result) => {
            this.state = result.status === 'SUBSCRIBED' ? 'joined' : 'closed';
            this.presence = result.presence || {};
            callback(result.status);
          }).catch((error) => callback('CHANNEL_ERROR', error));
          return this;
        },
        track() {},
        presenceState() { return this.presence; },
        send() { return Promise.resolve('error'); },
      };
      return channel;
    },
    removeChannel(channel) {
      channel.state = 'closed';
      channels.delete(channel.id);
      return rpc('remove', { channelId: channel.id });
    },
  };
}
`;

const identities = new Map();
const streams = new Map();
const subscriptions = new Map();
let fake;
function send(identity, event) {
  for (const response of streams.get(identity) || []) response.write('data: ' + JSON.stringify(event) + '\n\n');
}
const server = await createServer({
  root,
  configFile: false,
  server: { host: '127.0.0.1', port: 0 },
  cacheDir: root + '/node_modules/.vite-browser-regression',
  optimizeDeps: { exclude: ['@supabase/supabase-js'] },
  ssr: { noExternal: ['@supabase/supabase-js'] },
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://local.test'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('local-test'),
  },
  plugins: [
    {
      name: 'ten-player-test-backend',
      enforce: 'pre',
      resolveId(id) {
        if (id === '@supabase/supabase-js') return '\0ten-player-sdk';
      },
      load(id, options) {
        if (id === '\0ten-player-sdk')
          return options?.ssr ? "export { createClient } from '/src/test/fakeSupabase.js';" : sdk;
      },
      configureServer(vite) {
        vite.middlewares.use(async (request, response, next) => {
          if (!request.url.startsWith('/__ten/')) return next();
          const url = new URL(request.url, 'http://localhost');
          if (url.pathname === '/__ten/events') {
            const identity = url.searchParams.get('identity');
            const pageKey = url.searchParams.get('pageKey');
            response.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
            });
            response.write(': connected\n\n');
            if (!streams.has(identity)) streams.set(identity, new Set());
            streams.get(identity).add(response);
            response.on('close', () => {
              streams.get(identity)?.delete(response);
              for (const [id, subscription] of subscriptions) {
                if (subscription.pageKey !== pageKey) continue;
                subscription.client.removeChannel(subscription.channel);
                subscriptions.delete(id);
              }
            });
            return;
          }
          try {
            let raw = '';
            for await (const chunk of request) raw += chunk;
            const body = JSON.parse(raw);
            if (!identities.has(body.identity)) identities.set(body.identity, fake.createClient());
            const client = identities.get(body.identity);
            let result;
            if (body.operation === 'gameplay-mode') {
              fake.setFakeServerGameplayEnabled(body.enabled);
              result = { ok: true };
            } else if (body.operation === 'session') result = await client.auth.getSession();
            else if (body.operation === 'sign-in') result = await client.auth.signInAnonymously();
            else if (body.operation === 'view') {
              const entry = [...subscriptions.values()].find(
                (subscription) => subscription.client === client && subscription.channel.state === 'joined',
              );
              if (!entry) throw new Error('No active browser subscription');
              result = await client.functions.invoke('game-relay', {
                body: {
                  operation: 'join',
                  code: entry.channel.name.slice('bingo-'.length),
                  requestedPlayerId: entry.channel.presenceKey,
                  newSeat: false,
                },
              });
            } else if (body.operation === 'invoke') {
              if (body.name === 'movie-lookup') {
                const movie = {
                  title: 'Local Test Film',
                  year: '2026',
                  type: 'movie',
                  imdbID: 'tt9999999',
                  poster: null,
                  director: 'Test Director',
                  actors: 'Test Cast',
                  genres: ['horror'],
                  unmapped: [],
                };
                result = { data: body.body.mode === 'search' ? { results: [movie] } : { movie }, error: null };
              } else {
                const parsed = await readRelayPayload(
                  new Request('http://local.test/game-relay', { method: 'POST', body: JSON.stringify(body.body) }),
                );
                const validated = validateRelayPayload(parsed);
                result = await client.functions.invoke(body.name, { body: validated });
              }
            } else if (body.operation === 'subscribe') {
              const channel = client.channel(body.name, body.config);
              subscriptions.set(body.channelId, { client, channel, pageKey: body.pageKey });
              channel.on('broadcast', { event: 'msg' }, (payload) =>
                send(body.identity, {
                  channelId: body.channelId,
                  kind: 'broadcast',
                  payload,
                  presence: channel.presenceState(),
                }),
              );
              channel.on('presence', { event: 'leave' }, (payload) =>
                send(body.identity, {
                  channelId: body.channelId,
                  kind: 'leave',
                  payload,
                  presence: channel.presenceState(),
                }),
              );
              result = await new Promise((resolve) =>
                channel.subscribe((status) => resolve({ status, presence: channel.presenceState() })),
              );
            } else if (body.operation === 'remove') {
              const entry = subscriptions.get(body.channelId);
              if (entry) entry.client.removeChannel(entry.channel);
              subscriptions.delete(body.channelId);
              result = { ok: true };
            } else if (body.operation === 'age') {
              fake.setFakePlayerLastSeen(body.code, body.playerId, Date.now() - 120_001);
              result = { ok: true };
            } else throw new Error('Unsupported test request');
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(result));
          } catch (error) {
            if (error instanceof RelayPayloadError) {
              report.payloadErrors ||= [];
              report.payloadErrors.push(error.message);
            }
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: { message: error.message } }));
          }
        });
      },
    },
  ],
});
fake = await server.ssrLoadModule('/src/test/fakeSupabase.js');
await server.listen();
const base = 'http://127.0.0.1:' + server.httpServer.address().port;
const browser = await chromium.launch({ headless: true });
const pages = [];
async function check(name, operation) {
  await operation();
  report.checks.push({ name, outcome: 'PASS' });
  console.log('PASS ' + name);
}
async function menu(page, name, section) {
  if (!(await page.locator('.game-menu-panel').isVisible()))
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const panel = page.locator('.game-menu-panel');
  if (section) {
    const advanced = panel.locator('.menu-expander');
    if ((await advanced.getAttribute('aria-expanded')) !== 'true') await advanced.click();
    const group = panel.locator('.menu-section-toggle').filter({ hasText: section });
    if ((await group.getAttribute('aria-expanded')) !== 'true') await group.click();
  }
  await panel.getByRole('button', { name, exact: true }).click();
  if (!/Board Focus|tutorial|Resume Game|Copy Invite/i.test(String(name))) await waitForTool(page);
}
async function waitForTool(page) {
  await page.locator('.modal').last().waitFor({ state: 'visible' });
  await page.locator('.modal [role="status"]').filter({ hasText: 'Loading...' }).waitFor({ state: 'hidden' });
}
async function closeModal(page) {
  const close = page
    .locator('.modal')
    .last()
    .getByRole('button', { name: /^(Close|Close recap|Cancel|Never mind|Back to game|Done|Not now)$/i })
    .last();
  await close.click();
}
async function waitForGame(page) {
  await page.waitForFunction(
    () =>
      document.querySelector('.hamburger-btn') ||
      [...document.querySelectorAll('.modal h3')].some((heading) => heading.textContent === 'Something Went Wrong'),
    null,
    { timeout: 30_000 },
  );
  const error = page.getByRole('heading', { name: 'Something Went Wrong', exact: true });
  if (await error.isVisible()) throw new Error('Game startup failed: ' + (await error.locator('..').innerText()));
  await page.getByRole('button', { name: 'Menu', exact: true }).waitFor();
}
async function state(page) {
  return page.evaluate(async () => {
    const response = await fetch('/__ten/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: localStorage.getItem('bingo-test-identity'), operation: 'view' }),
    });
    return (await response.json()).data.state;
  });
}
async function feature(name, operation) {
  try {
    await check(name, operation);
  } catch (error) {
    report.checks.push({ name, outcome: 'FAIL', error: error.message });
    console.error('FAIL ' + name + ': ' + error.message.split('\n')[0]);
    for (const page of pages.filter((entry) => !entry.isClosed())) {
      if (await page.locator('.game-menu-overlay').isVisible())
        await page.locator('.game-menu-overlay').dispatchEvent('click');
      for (let count = 0; count < 3 && (await page.locator('.modal').last().isVisible()); count++)
        await closeModal(page).catch(() => {});
      if (await page.getByRole('button', { name: /Unfocus/ }).isVisible())
        await page.getByRole('button', { name: /Unfocus/ }).click();
    }
  }
}
try {
  for (let index = 0; index < 10; index++) {
    const context = await browser.newContext({ viewport: { width: index % 2 ? 390 : 1280, height: 900 } });
    await context.addInitScript(() => {
      localStorage.setItem('bingo-tutorial-enabled', 'false');
      localStorage.setItem('bingo-sound-muted', 'true');
    });
    await context.route('https://query.wikidata.org/**', (route) =>
      route.fulfill({ json: { results: { bindings: [] } } }),
    );
    const page = await context.newPage();
    page.setDefaultTimeout(process.env.CI ? 30_000 : 10_000);
    page.setDefaultNavigationTimeout(process.env.CI ? 60_000 : 30_000);
    if (Number(process.env.BROWSER_CPU_THROTTLE) > 1 && index < 2) {
      const session = await context.newCDPSession(page);
      await session.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.BROWSER_CPU_THROTTLE) });
    }
    page.on('pageerror', (error) => report.errors.push(error.message));
    pages.push(page);
  }
  await Promise.all(pages.map((page) => page.goto(base, { waitUntil: 'domcontentloaded' })));
  const setGameplayMode = async (enabled) =>
    fetch(base + '/__ten/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: 'test-controller', operation: 'gameplay-mode', enabled }),
    });
  const freshPage = async (page) => {
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
  };
  await setGameplayMode(false);
  const legacyHost = pages[0];
  const legacyGuest = pages[1];
  await check('older relay: solo Submit accepts immediately', async () => {
    await legacyHost.getByPlaceholder('e.g. Ashley').fill('Solo regression');
    await legacyHost.getByRole('button', { name: 'Host Game', exact: true }).click();
    await legacyHost.getByRole('button', { name: 'Start Game', exact: true }).click();
    await legacyHost.locator('.reaction-bar').waitFor();
    const text = await legacyHost.locator('.bingo-cell').first().innerText();
    await legacyHost.locator('.bingo-cell').first().click();
    await legacyHost
      .locator('.modal')
      .getByRole('button', { name: /Submit/ })
      .click();
    await legacyHost.locator('.bingo-cell.marked').first().waitFor();
    const saved = await state(legacyHost);
    assert(saved.acceptedTropes.includes(text));
    assert.equal(saved.pendingClaim, null);
  });
  await freshPage(legacyHost);
  await check('older relay: proposer auto-approves; the other player resolves the claim', async () => {
    await legacyHost.getByPlaceholder('e.g. Ashley').fill('Two-player host');
    await legacyHost.getByRole('button', { name: 'Host Game', exact: true }).click();
    await legacyHost.getByRole('button', { name: 'Start Game', exact: true }).waitFor();
    const saved = await legacyHost.evaluate(() => JSON.parse(sessionStorage.getItem('movie-bingo-session')));
    await legacyGuest.getByPlaceholder('e.g. Sidney').fill('Two-player guest');
    await legacyGuest.getByPlaceholder('ABCD').fill(saved.code);
    await legacyGuest.getByRole('button', { name: 'Join Game', exact: true }).click();
    await legacyGuest.getByRole('button', { name: 'Menu', exact: true }).waitFor();
    await legacyHost.getByRole('button', { name: 'Start Game', exact: true }).click();
    await legacyGuest.locator('.reaction-bar').waitFor();
    for (const [proposer, voter] of [
      [legacyHost, legacyGuest],
      [legacyGuest, legacyHost],
    ]) {
      const accepted = (await state(legacyHost)).acceptedTropes;
      const cells = proposer.locator('.bingo-cell');
      let chosen = 0;
      while (accepted.includes(await cells.nth(chosen).innerText())) chosen += 1;
      const text = await cells.nth(chosen).innerText();
      await cells.nth(chosen).click();
      await proposer.getByRole('button', { name: /Submit to the group/ }).click();
      await voter.getByRole('button', { name: /Agree, it happened/ }).waitFor();
      for (const page of [proposer, voter]) {
        const advanced = page.getByRole('button', { name: 'Advanced options', exact: true });
        assert.equal(await advanced.getAttribute('aria-expanded'), 'false');
        assert.equal(await page.getByRole('button', { name: 'Queue another trope', exact: true }).count(), 0);
        assert.equal(await page.getByRole('button', { name: 'View waiting proposals', exact: true }).count(), 0);
        const label = page === legacyHost ? 'desktop' : 'mobile';
        await page.screenshot({ path: output + '/' + label + '-proposal-simple.png', fullPage: true });
        await advanced.click();
        assert.equal(await advanced.count(), 0);
        await page.getByRole('button', { name: 'Queue another trope', exact: true }).waitFor();
        await page.getByRole('button', { name: 'View waiting proposals', exact: true }).waitFor();
        await page.screenshot({ path: output + '/' + label + '-proposal-advanced.png', fullPage: true });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.equal(await page.getByRole('button', { name: 'Queue another trope', exact: true }).count(), 1);
      }
      const pending = (await state(legacyHost)).pendingClaim;
      const identity = await proposer.evaluate(() => JSON.parse(sessionStorage.getItem('movie-bingo-session')).myId);
      assert.deepEqual(pending.votes, { [identity]: true });
      assert.equal(pending.totalPlayers, 2);
      await voter.getByRole('button', { name: /Agree, it happened/ }).click();
      await proposer.locator('.modal').waitFor({ state: 'hidden' });
      await voter.locator('.modal').waitFor({ state: 'hidden' });
      assert((await state(legacyHost)).acceptedTropes.includes(text));
    }
  });
  await freshPage(legacyHost);
  await freshPage(legacyGuest);
  await setGameplayMode(true);
  const host = pages[0];
  await host.getByPlaceholder('e.g. Ashley').fill('Browser 1');
  await host.getByLabel('Manual title', { exact: true }).fill('Ten-player screening');
  await host.getByRole('button', { name: 'Use manual title' }).click();
  await host.getByLabel('Host recovery password (optional)').fill('xy');
  await host.getByRole('button', { name: 'Host Game', exact: true }).click();
  await waitForGame(host);
  const session = await host.evaluate(() => JSON.parse(sessionStorage.getItem('movie-bingo-session')));
  await check('ten concurrent browser players join one game', async () => {
    await Promise.all(
      pages.slice(1).map(async (page, index) => {
        await page.getByPlaceholder('e.g. Sidney').fill('Browser ' + (index + 2));
        await page.getByPlaceholder('ABCD').fill(session.code);
        await page.getByRole('button', { name: 'Join Game', exact: true }).click();
        await waitForGame(page);
      }),
    );
    for (const page of pages) await page.getByText('Browser 10', { exact: false }).first().waitFor();
    const counts = await Promise.all(pages.map((page) => page.locator('.player-row').count()));
    assert(
      counts.every((count) => count === 10),
      JSON.stringify(counts),
    );
  });
  await check('ten boards and mobile/desktop layouts render without overflow', async () => {
    for (const page of pages) {
      assert.equal(await page.locator('.bingo-cell').count(), 25);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await pages[0].screenshot({ path: output + '/desktop-ten-players.png', fullPage: true });
    await pages[1].screenshot({ path: output + '/mobile-ten-players.png', fullPage: true });
  });
  await check('host starts play and all ten pages update', async () => {
    await host.getByRole('button', { name: /Start Game/ }).click();
    for (const page of pages) {
      await page.getByRole('button', { name: /Optional Wagers/ }).waitFor({ state: 'hidden' });
      await page.locator('.reaction-bar').waitFor({ state: 'visible' });
    }
  });
  await feature('secondary menu tools are grouped under Advanced Options on desktop and mobile', async () => {
    for (const [page, label] of [
      [host, 'desktop'],
      [pages[1], 'mobile'],
    ]) {
      await page.getByRole('button', { name: 'Menu', exact: true }).click();
      const panel = page.locator('.game-menu-panel');
      const expander = panel.locator('.menu-expander');
      if ((await expander.getAttribute('aria-expanded')) === 'true') await expander.click();
      assert.equal(await panel.getByRole('button', { name: 'Badge Progress', exact: true }).count(), 0);
      assert.equal(await panel.getByRole('button', { name: 'Accessibility', exact: true }).count(), 0);
      assert.equal(await panel.getByRole('button', { name: /Accepted Tropes|Claim Queue/ }).count(), 0);
      await page.screenshot({ path: output + '/' + label + '-simple-menu.png', fullPage: true });
      await expander.click();
      await panel.locator('.menu-section-toggle').filter({ hasText: 'Explore & Stats' }).click();
      await panel.getByRole('button', { name: 'Accepted Tropes (0)', exact: true }).waitFor();
      await panel.getByRole('button', { name: 'Claim Queue (0)', exact: true }).waitFor();
      await page.screenshot({ path: output + '/' + label + '-explore-menu.png', fullPage: true });
      await panel.locator('.menu-section-toggle').filter({ hasText: 'My Tools' }).click();
      await panel.getByRole('button', { name: 'Accessibility', exact: true }).waitFor();
      assert.equal(await panel.getByRole('button', { name: /Accepted Tropes|Claim Queue/ }).count(), 0);
      await page.screenshot({ path: output + '/' + label + '-personal-menu.png', fullPage: true });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.locator('.game-menu-overlay').dispatchEvent('click');
    }
  });
  await feature('badge progress is available before earning a badge on desktop and mobile', async () => {
    for (const [page, label] of [
      [host, 'desktop'],
      [pages[5], 'mobile'],
    ]) {
      await page.getByRole('button', { name: 'Your player options', exact: true }).click();
      await page.getByRole('button', { name: 'Badge Progress', exact: true }).click();
      await page.getByRole('heading', { name: 'Badge Progress', exact: true }).waitFor();
      assert.equal(await page.getByRole('progressbar').count(), 3);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: output + '/' + label + '-badge-progress.png', fullPage: true });
      await closeModal(page);
    }
    for (const page of pages)
      await page.evaluate(() => {
        window.__badgeNotices = [];
        let previous = '';
        new MutationObserver(() => {
          const text = document.querySelector('.badge-announcement')?.textContent || '';
          if (text && text !== previous && !window.__badgeNotices.includes(text)) window.__badgeNotices.push(text);
          previous = text;
        }).observe(document.body, { childList: true, subtree: true, characterData: true });
      });
  });
  await feature('six-vote majority and accepted trope propagate to ten UIs', async () => {
    const cell = host.locator('.bingo-cell').first();
    const text = await cell.innerText();
    await cell.click();
    await host.getByRole('button', { name: /Submit to the group/ }).click();
    await Promise.all(
      pages.slice(1, 5).map((page) => page.getByRole('button', { name: /Agree, it happened/ }).click()),
    );
    assert((await state(host)).pendingClaim);
    await pages[5].getByRole('button', { name: /Agree, it happened/ }).click();
    for (const page of pages) {
      await page.locator('.modal').waitFor({ state: 'hidden' });
      await menu(page, /Accepted Tropes \(1\)/, 'Explore & Stats');
      assert((await page.locator('.modal').innerText()).includes(text));
      await closeModal(page);
    }
  });
  await feature('shared trope search, activity feed, wagers, stats and marathon views', async () => {
    const helper = pages[5].locator('.players-list > li').filter({ hasText: /Browser 6\b/ });
    await helper.getByRole('button', { name: /Team Player/ }).waitFor();
    await helper.getByRole('button', { name: /Team Player/ }).click();
    await pages[5].getByRole('heading', { name: 'Team Player', exact: true }).waitFor();
    assert.equal(
      await pages[5].getByRole('progressbar', { name: 'Consensus Builder progress' }).getAttribute('value'),
      '1',
    );
    await closeModal(pages[5]);
    for (let round = 0; round < 2; round++) {
      const accepted = (await state(host)).acceptedTropes;
      const cells = host.locator('.bingo-cell');
      let chosen = 0;
      while (accepted.includes(await cells.nth(chosen).innerText())) chosen += 1;
      await cells.nth(chosen).click();
      await host.getByRole('button', { name: /Submit to the group/ }).click();
      await Promise.all(
        pages.slice(1, 6).map((page) => page.getByRole('button', { name: /Agree, it happened/ }).click()),
      );
      for (const page of pages) await page.locator('.modal').waitFor({ state: 'hidden' });
    }
    for (const page of pages) {
      const row = page.locator('.players-list > li').filter({ hasText: /Browser 6\b/ });
      await row.getByRole('button', { name: /Consensus Builder/ }).waitFor();
      assert.equal(await row.getByRole('button', { name: /Team Player/ }).count(), 0);
    }
    await helper.getByRole('button', { name: /Consensus Builder/ }).click();
    await pages[5].getByRole('heading', { name: 'Consensus Builder', exact: true }).waitFor();
    assert((await pages[5].locator('.modal').innerText()).includes('at least three'));
    assert.equal(
      await pages[5].getByRole('progressbar', { name: 'Watch Party MVP progress' }).getAttribute('value'),
      '3',
    );
    await closeModal(pages[5]);
    const evidence = await state(host);
    const expectedAwards = getPlayerAwards(Object.values(evidence.players), evidence)[session.myId];
    const hostAwards = [...expectedAwards.superlatives, ...expectedAwards.badges];
    assert(hostAwards.length > 0);
    report.hostAwards = {
      superlatives: expectedAwards.superlatives.map((award) => award.name),
      badges: expectedAwards.badges.map((award) => award.name),
      stats: evidence.superlativeStats[session.myId],
    };
    const hostRow = host
      .locator('.players-list > li')
      .filter({ has: host.getByRole('button', { name: 'Your player options', exact: true }) });
    for (const award of hostAwards) {
      await hostRow
        .getByRole('button', {
          name: `${award.kind === 'badge' ? 'Badge' : 'Superlative'}: ${award.name}`,
          exact: true,
        })
        .waitFor();
    }
    await pages[5].screenshot({ path: output + '/mobile-badge-upgrade.png', fullPage: true });
    await host.screenshot({ path: output + '/desktop-badge-upgrade.png', fullPage: true });
    report.checks.push({
      name: 'Team Player upgrades to Consensus Builder while all earned badges and superlatives remain visible',
      outcome: 'PASS',
    });
    await Promise.all(
      pages.map((page) =>
        page.waitForFunction(() => window.__badgeNotices.some((text) => text.includes('Consensus Builder')), null, {
          timeout: 45_000,
        }),
      ),
    );
    const announcements = await Promise.all(pages.map((page) => page.evaluate(() => window.__badgeNotices)));
    for (const notices of announcements)
      assert.equal(notices.filter((text) => text.includes('Consensus Builder')).length, 1);
    report.badgeAnnouncements = announcements;
    await pages[5].screenshot({ path: output + '/mobile-badge-announcement.png', fullPage: true });
    await host.screenshot({ path: output + '/desktop-badge-announcement.png', fullPage: true });
    report.checks.push({
      name: 'queued badge upgrade announcements reach all ten viewers exactly once',
      outcome: 'PASS',
    });
    await menu(pages[1], /All Tropes/, 'Explore & Stats');
    const search = pages[1].locator('.modal input[type="search"], .modal input[type="text"]').first();
    if (await search.count()) {
      await search.fill('nonexistent trope xyz');
      assert((await pages[1].locator('.modal').innerText()).match(/No|0|matching/i));
    }
    await closeModal(pages[1]);
    for (const name of [/All Wagers/, /Activity Feed/, /Game Stats/, /Marathon History/]) {
      await menu(pages[1], name, 'Explore & Stats');
      await pages[1].locator('.modal').waitFor();
      assert((await pages[1].locator('.modal').innerText()).length > 10);
      await closeModal(pages[1]);
    }
  });
  await feature('personal tools open correctly for an ordinary player', async () => {
    for (const name of [/Manage Wagers/, /Submit Custom Trope/, /Swap My Whole Board/]) {
      await menu(pages[2], name, 'My Tools');
      await pages[2].locator('.modal').waitFor();
      await closeModal(pages[2]);
    }
    await menu(pages[2], /Board Focus/, 'My Tools');
    await pages[2].getByRole('button', { name: /Unfocus/ }).click();
  });
  await feature('self stats and profile editor, read-only movie details and Help', async () => {
    await pages[3].getByRole('button', { name: 'Your player options' }).click();
    await pages[3].getByRole('button', { name: /View Stats/ }).click();
    await closeModal(pages[3]);
    await pages[3].getByRole('button', { name: 'Your player options' }).click();
    await pages[3].getByRole('button', { name: /Edit Name & Avatar/ }).click();
    assert((await pages[3].locator('.modal input[type="text"]').count()) > 0);
    await closeModal(pages[3]);
    await pages[3].getByRole('button', { name: /Ten-player screening/ }).click();
    await waitForTool(pages[3]);
    assert.equal(await pages[3].getByRole('button', { name: 'Use manual title' }).count(), 0);
    await closeModal(pages[3]);
    await pages[3].getByRole('button', { name: 'Help', exact: true }).click();
    await waitForTool(pages[3]);
    for (const summary of await pages[3].locator('.modal summary').all()) await summary.click();
    assert((await pages[3].locator('.modal').innerText()).includes('Disconnects'));
    await closeModal(pages[3]);
  });
  await feature('accessibility controls, theme, sound, tutorial and invite QR', async () => {
    await menu(pages[4], 'Accessibility', 'My Tools');
    const boxes = pages[4].locator('.modal').getByRole('checkbox');
    assert((await boxes.count()) >= 3);
    for (let index = 0; index < (await boxes.count()); index++) await boxes.nth(index).check();
    await closeModal(pages[4]);
    assert(await pages[4].evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await pages[4].getByRole('button', { name: /Toggle .* mode/ }).click();
    await pages[4].getByRole('button', { name: /Unmute sound/ }).click();
    await pages[4].getByRole('button', { name: /Mute sound/ }).click();
    await menu(pages[4], /Start tutorial/);
    const pause = pages[4].getByRole('button', { name: /Pause tutorial/ });
    if (await pause.count()) await pause.click();
    else {
      await pages[4].keyboard.press('Escape');
    }
    await menu(pages[4], 'QR Code');
    await pages[4].locator('.modal').waitFor();
    assert((await pages[4].locator('.modal canvas, .modal svg, .modal img').count()) > 0);
    await closeModal(pages[4]);
  });
  await feature('host recovery password and session lifetime controls', async () => {
    for (const name of [/Host recovery password/, /Session Lifetime/]) {
      await menu(host, name, 'Host Settings');
      await host.locator('.modal').waitFor();
      await closeModal(host);
    }
  });
  await feature('host and old player see matching recovery countdowns; confirmation keeps the old seat', async () => {
    const source = pages[7];
    const sourceSession = await source.evaluate(() => JSON.parse(sessionStorage.getItem('movie-bingo-session')));
    await host.getByRole('button', { name: /Browser 7/, exact: false }).click();
    await host.getByLabel('Recover player from').selectOption(sourceSession.myId);
    await host.getByLabel('Response time').selectOption('300');
    await host.getByRole('button', { name: 'Recover player', exact: true }).click();
    await host.getByRole('button', { name: 'Send recovery prompt', exact: true }).click();
    await host.getByRole('heading', { name: 'Waiting for player response' }).waitFor();
    await source.getByRole('heading', { name: 'Are you still playing?' }).waitFor();
    const countdown = async (page) => {
      const text = await page.getByRole('timer', { name: 'Recovery countdown' }).innerText();
      const [minutes, seconds] = text.split(':').map(Number);
      return minutes * 60 + seconds;
    };
    const first = await countdown(host);
    assert(first >= 295 && first <= 300);
    assert(Math.abs(first - (await countdown(source))) <= 1);
    await host.screenshot({ path: output + '/host-recovery-countdown.png', fullPage: true });
    await source.screenshot({ path: output + '/player-recovery-countdown.png', fullPage: true });
    await host.waitForFunction(() => document.querySelector('.recovery-countdown')?.textContent !== '5:00');
    assert((await countdown(host)) < 300);
    await source.getByRole('button', { name: "I'm still playing", exact: true }).click();
    await host.getByRole('timer').waitFor({ state: 'hidden' });
    await source.getByRole('timer').waitFor({ state: 'hidden' });
    assert.equal((await state(host)).pendingBoardRecovery, null);
    assert.equal(Object.keys((await state(host)).players).length, 10);
  });
  await feature('ten-second recovery transfers identity and progress after the old tab disappears', async () => {
    const source = pages[7];
    const receiving = pages[6];
    const sourceSession = await source.evaluate(() => JSON.parse(sessionStorage.getItem('movie-bingo-session')));
    const receivingSession = await receiving.evaluate(() => JSON.parse(sessionStorage.getItem('movie-bingo-session')));
    const original = (await state(host)).players[sourceSession.myId];
    await host.getByRole('button', { name: /Browser 7/, exact: false }).click();
    await host.getByLabel('Recover player from').selectOption(sourceSession.myId);
    await host.getByLabel('Response time').selectOption('10');
    await host.getByRole('button', { name: 'Recover player', exact: true }).click();
    await host.getByRole('button', { name: 'Send recovery prompt', exact: true }).click();
    await source.getByRole('timer').waitFor();
    await source.close();
    pages.splice(7, 1);
    await host.getByRole('timer').waitFor({ state: 'hidden', timeout: 25_000 });
    const recovered = await state(receiving);
    assert.equal(recovered.players[sourceSession.myId], undefined);
    const seat = recovered.players[receivingSession.myId];
    assert.equal(seat.name, original.name);
    assert.equal(seat.avatar, original.avatar);
    assert.deepEqual(seat.board, original.board);
    assert.deepEqual(seat.marked, original.marked);
    assert.deepEqual(seat.wagered, original.wagered);
    assert(
      (await receiving.getByRole('button', { name: 'Your player options', exact: true }).innerText()).includes(
        original.name,
      ),
    );
    const saved = await receiving.evaluate(() => JSON.parse(sessionStorage.getItem('movie-bingo-session')));
    assert.equal(saved.myId, receivingSession.myId);
    assert.equal(saved.name, original.name);
    assert.equal(Object.keys(recovered.players).length, 9);
  });
  await feature('end-game recap reaches ten players and resume preserves the watch', async () => {
    await menu(host, /End Game/);
    await host
      .locator('.modal')
      .getByRole('button', { name: /End Game/ })
      .click();
    for (const page of pages) {
      await waitForTool(page);
      assert((await page.locator('.modal').innerText()).includes('Browser 10'));
      await closeModal(page);
    }
    await menu(host, /Resume Game/);
    await host.waitForFunction(async () => {
      const response = await fetch('/__ten/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: localStorage.getItem('bingo-test-identity'), operation: 'view' }),
      });
      return (await response.json()).data?.state?.gameOver === false;
    });
    for (const page of pages) await page.getByText(/now watching/i).waitFor();
    assert.equal((await state(host)).acceptedTropes.length, 3);
  });
  await feature('play continues in nine browsers after the only host disconnects', async () => {
    await fetch(base + '/__ten/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: 'test-controller',
        operation: 'age',
        code: session.code,
        playerId: session.myId,
      }),
    });
    await host.close();
    const player = pages[1];
    const existing = (await state(player)).acceptedTropes;
    const cells = player.locator('.bingo-cell');
    let chosen = 0;
    while (existing.includes(await cells.nth(chosen).innerText())) chosen += 1;
    await cells.nth(chosen).click();
    await player.getByRole('button', { name: /Submit to the group/ }).click();
    await Promise.all(
      pages.slice(2, 6).map((page) => page.getByRole('button', { name: /Agree, it happened/ }).click()),
    );
    for (const page of pages.slice(1)) await page.locator('.modal').waitFor({ state: 'hidden' });
    const saved = await state(player);
    assert.equal(saved.acceptedTropes.length, 4);
    assert.equal(saved.players[session.myId].connected, false);
    assert.deepEqual(saved.hostIds, [session.myId]);
  });
  assert.equal(report.errors.length, 0, report.errors.join('\n'));
  assert.equal(report.payloadErrors?.length || 0, 0, 'Legitimate browser traffic was rejected by payload validation');
  assert.equal(report.checks.filter((entry) => entry.outcome === 'FAIL').length, 0, 'Some feature checks failed');
  report.completed = true;
} catch (error) {
  report.failure = error.stack;
  console.error(error.message);
  for (let index = 0; index < Math.min(2, pages.length); index++) {
    report['page' + index] = await pages[index]
      .locator('body')
      .innerText()
      .catch(() => 'unavailable');
    await pages[index].screenshot({ path: output + '/failure-' + index + '.png', fullPage: true }).catch(() => {});
  }
  process.exitCode = 1;
} finally {
  writeFileSync(output + '/report.json', JSON.stringify(report, null, 2));
  await browser.close();
  for (const responses of streams.values()) for (const response of responses) response.end();
  await server.close();
}
