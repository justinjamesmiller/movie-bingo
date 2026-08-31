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
- Only STUN is configured (no TURN relay), so no third-party account or self-hosted server is
  needed — but players on very restrictive networks (symmetric NAT, strict corporate firewalls)
  may occasionally fail to connect directly to each other.
