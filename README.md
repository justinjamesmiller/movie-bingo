# Movie Trope Bingo — Horror Edition

Jackbox-style multiplayer bingo for horror movie tropes. No database and no custom backend to
maintain — players connect using a 4-character game code, and [Supabase Realtime](https://supabase.com/docs/guides/realtime)
is used purely as an ephemeral broadcast relay (no tables, nothing persisted). The whole app is a
static React site deployable for free on GitHub Pages.

## How it works

- The first player **hosts** a game and gets a 4-character code.
- Others **join** with that code. Everyone gets a random 5x5 board of horror tropes, all 25 spaces
  drawn randomly from the same trope pool (including "Jump Scare", which is just a regular trope
  now, not forced into the center).
- Before starting, each player picks up to 5 **wagered** spaces (tropes they think are extra likely).
  Wagers lock once the host starts the game.
- During the game, clicking a space claims that trope happened; other players vote to confirm.
  A majority is required to mark it — and it marks that same trope on every board that has it.
- Everyone subscribes to the same Supabase Realtime channel (named after the game code) and
  broadcasts messages to it; Supabase relays messages to everyone else on the channel. If the host
  disconnects, authority automatically passes to the next-longest-connected player.

## Supabase setup (required)

1. Create a free project at <https://supabase.com/dashboard> (no credit card required).
2. In your project's **Settings → API**, copy the **Project URL** and the **anon public key**
   (this key is designed to be public/embedded in client-side code — that's expected here).
3. For local dev: copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
4. For the GitHub Pages deploy: add two **repository secrets** (Settings → Secrets and variables →
   Actions) named `SUPABASE_URL` and `SUPABASE_ANON_KEY` — the deploy workflow passes them through
   as build-time env vars automatically.

Realtime is enabled by default on new Supabase projects and needs no database tables for this app
(only ephemeral broadcast + presence are used).

## Development

```
npm install
npm run dev
```

Open the printed local URL in multiple browser tabs/devices (or over the internet) to test
multiplayer — everyone just needs to reach the same Supabase project.

## Build & deploy (GitHub Pages)

```
npm run build
```

This outputs a static site to `dist/`. Since `vite.config.js` uses relative asset paths
(`base: './'`), the built site works when hosted from any subpath, including a GitHub Pages
project site (`https://<user>.github.io/<repo>/`). Push the contents of `dist/` to your `gh-pages`
branch (or configure a GitHub Actions workflow to build and deploy automatically) to publish it.

## Notes & limitations

- No peer-to-peer networking, so no NAT/firewall connectivity issues — everyone just needs a normal
  internet connection to reach Supabase.
- The original host's browser tab must stay open for new players to join; once a game has started,
  host authority migrates automatically if the current host disconnects.
- Requires a free Supabase account (see setup above) — this is the one external dependency this
  app has, since some relay point is unavoidable for a code-based multiplayer join flow.
- Supabase's free tier includes generous Realtime limits (concurrent connections and messages/month)
  more than sufficient for casual game nights; check current limits on their pricing page if you
  expect heavy use.
