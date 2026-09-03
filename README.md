# Movie/TV Trope Bingo

Jackbox-style multiplayer bingo for movie & TV tropes, spanning Horror, Comedy, Action, Sci-Fi,
Fantasy, Thriller/Crime, Romance, Drama, and Documentary (a game can mix multiple genres/sub-genres
at once). No database and no custom backend to maintain — players connect using a 4-character
game code, and
[Supabase Realtime](https://supabase.com/docs/guides/realtime) is used purely as an ephemeral
broadcast relay (no tables, nothing persisted). The whole app is a static React site deployable for
free on GitHub Pages.

## How it works

- The first player **hosts** a game, picks one or more genres/sub-genres, and gets a 4-character code.
- Others **join** with that code. Everyone gets a random 5x5 board of movie/TV tropes, all spaces
  drawn from the same host-configured trope pool.
- Before starting, each player picks up to 5 **wagered** spaces (tropes they think are extra likely).
  Tapping a trope shows its description first, then lets the player add/remove the wager.
- During the game, tapping a space shows the trope description, then lets the player claim that trope happened; other players vote to confirm.
  A majority is required to mark it — and it marks that same trope on every board that has it.
- Players can view accepted tropes, the full trope pool, and everyone's wagers; most trope list items open the same description window and can be used to propose swapping a trope out.
- Mid-game changes such as custom trope submissions, wager changes, and whole-board swaps go through the same majority-vote flow.
- Bingos are detected automatically. Everyone sees the celebration banner, and the player list/final recap show each player's bingo count.
- Everyone subscribes to the same Supabase Realtime channel (named after the game code) and
  broadcasts messages to it; Supabase relays messages to everyone else on the channel. If the host
  disconnects, authority automatically passes to the next-longest-connected player.

## Player features

- **Reconnect / seat reclaim:** returning players can use the Reconnect card, or join with the code and reclaim a disconnected seat.
- **Invite sharing:** the in-game menu can copy the code or a join link with the code pre-filled.
- **Activity feed:** approved marks, swaps, wager changes, resets, and other notable events are logged for anyone who looked away.
- **Reactions:** quick emoji reactions broadcast briefly to everyone without starting a vote.
- **Recap:** the host can end the game to show everyone final marked counts, bingo counts, and wager hits.
- **PWA support:** the site includes a web app manifest and service worker so it can be installed via "Add to Home Screen" / browser install prompts. The app still needs network access for live multiplayer relay traffic.

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

## Movie/TV lookup (optional)

Hosting a game lets you search for a movie or TV show by title and auto-select its genres, using the
[OMDb API](https://www.omdbapi.com/) (which sources its data from IMDb). This is entirely optional —
without it, genres/sub-genres are just picked manually via checkboxes.

1. Get a free API key at <https://www.omdbapi.com/apikey.aspx>.
2. Add it to `.env` as `VITE_OMDB_API_KEY` (local dev) and as a `OMDB_API_KEY` repository secret for
   the GitHub Pages deploy workflow. If unset, the movie-lookup UI simply doesn't appear.

Note: OMDb only reports broad genres (e.g. "Horror, Comedy"), not this app's finer sub-genres — see
below for how those get suggested automatically.

### Sub-genre suggestions via Wikidata (automatic, no setup needed)

[Wikidata](https://www.wikidata.org/) tags films with a "genre" property that's often much more
specific than OMDb's broad genres (e.g. "slasher film", "zombie film", "heist film"). Whenever you
pick a movie, its Wikidata genre tags are matched against a hand-picked list to suggest (and
pre-check) specific sub-genres — this is inherently best-effort, since Wikidata's genre labels are
free text, not a fixed list, and not every film has this data. No API key, signup, or configuration
is required for this — it just works as long as `VITE_OMDB_API_KEY` is set (see above).

## Development

```
npm install
npm run dev
```

Open the printed local URL in multiple browser tabs/devices (or over the internet) to test
multiplayer — everyone just needs to reach the same Supabase project.

Useful checks before shipping changes:

```
npm run format
npm run test
npm run lint
npm run build
```

`npm run coverage` prints the Vitest coverage report.

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
- Game state is held by connected browsers, not a database. At least one current/recent player needs
  enough local state to keep or restore the game.
- The original host's browser tab normally acts as the rendezvous point for the game code, but host
  authority migrates automatically if the current host disconnects.
- Mobile browsers and installed web apps can suspend realtime connections when backgrounded. The app
  attempts to reconnect and surfaces connection failures, but a live game still depends on Supabase
  Realtime being reachable.
- Requires a free Supabase account (see setup above) — this is the one external dependency this
  app has, since some relay point is unavoidable for a code-based multiplayer join flow.
- Supabase's free tier includes generous Realtime limits (concurrent connections and messages/month)
  more than sufficient for casual game nights; check current limits on their pricing page if you
  expect heavy use.
