# Movie Trope Bingo — Horror Edition

Serverless, Jackbox-style multiplayer bingo for horror movie tropes. No backend, no database —
players connect directly to each other over WebRTC (via [PeerJS](https://peerjs.com)) using a
4-character game code, so the whole app is a static React site deployable for free on GitHub Pages.

## How it works

- The first player **hosts** a game and gets a 4-character code.
- Others **join** with that code. Everyone gets a random 5x5 board of horror tropes; the center
  square is always "Jump Scare".
- Before starting, each player picks up to 5 **wagered** spaces (tropes they think are extra likely).
  Wagers lock once the host starts the game.
- During the game, clicking a space claims that trope happened; other players vote to confirm.
  A majority is required to mark it — and it marks that same trope on every board that has it.
- Players connect in a full mesh (everyone to everyone). If the host disconnects, authority
  automatically passes to the next-longest-connected player — no central server required.

## TURN relay setup (recommended)

Direct WebRTC connections don't always work — players behind restrictive NATs/firewalls (common on
corporate networks, some mobile carriers) may fail to connect with just STUN. To fix that, this app
can use a free TURN relay from [Metered](https://www.metered.ca/tools/openrelay/):

1. Sign up free at <https://dashboard.metered.ca/signup?tool=turnserver> (20 GB/month free).
2. From your dashboard, note your TURN domain (looks like `yourappname.metered.live`) and API key.
3. For local dev: copy `.env.example` to `.env` and fill in `VITE_METERED_DOMAIN` / `VITE_METERED_API_KEY`.
4. For the GitHub Pages deploy: add two **repository secrets** (Settings → Secrets and variables →
   Actions) named `METERED_DOMAIN` and `METERED_API_KEY` — the deploy workflow passes them through
   as build-time env vars automatically.

Without these configured, the app falls back to STUN-only, which works on many but not all networks.

## Development

```
npm install
npm run dev
```

Open the printed local URL in multiple browser tabs/devices on the same network (or over the
internet — PeerJS's free public signaling broker handles connecting players) to test multiplayer.

## Build & deploy (GitHub Pages)

```
npm run build
```

This outputs a static site to `dist/`. Since `vite.config.js` uses relative asset paths
(`base: './'`), the built site works when hosted from any subpath, including a GitHub Pages
project site (`https://<user>.github.io/<repo>/`). Push the contents of `dist/` to your `gh-pages`
branch (or configure a GitHub Actions workflow to build and deploy automatically) to publish it.

## Notes & limitations

- Relies on PeerJS's free public cloud broker only for initial signaling (finding peers) — no game
  data passes through it, and no server of ours needs to run or be paid for.
- The original host's browser tab must stay open for new players to join; once a game has started,
  host authority migrates automatically if the current host disconnects.
- TURN credentials fetched from Metered are exposed in the built client bundle since this is a
  static site with no backend to hide them behind — this is expected/supported for their free tier,
  but be aware the API key is technically public if someone inspects your deployed site.
