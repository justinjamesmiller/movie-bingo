# Movie/TV Trope Bingo

Jackbox-style multiplayer bingo for movie & TV tropes, spanning Horror, Comedy, Action, Sci-Fi,
Fantasy, Thriller/Crime, Romance, Drama, Documentary, Adventure, Animation, Biography, Family,
History, Music, Musical, Sport, War, Western, and TV/Unscripted formats (a game can mix multiple
genres/sub-genres at once). The frontend is a static React site deployable for free on GitHub Pages.
Multiplayer uses Supabase anonymous Auth, private Realtime channels, a small room/membership database,
and an Edge Function that authenticates and authorizes every state/action relay.

## How it works

- The first player **hosts** a game, picks one or more genres, and gets a 4-character code. Sub-genres and other
  settings are available through optional setup controls.
- Others **join** with that code. Everyone gets a random 5x5 board of movie/TV tropes, all spaces
  drawn from the same host-configured trope pool.
- Before starting, each player can optionally enable **wagers** and pick up to 5 spaces they think are extra likely.
  Tapping a trope always shows its description; opting in also adds an action to add or remove that wager.
- During the game, tapping a space shows the trope description, then lets the player claim that trope happened; other players vote to confirm.
  A majority is required to mark it — and it marks that same trope on every board that has it.
  Submitting counts as your approval. Solo submissions resolve immediately; with two players, the other player's
  approval completes the majority.
- Advanced Options → Explore & Stats exposes accepted tropes, the claim queue, the full trope pool, everyone's wagers,
  activity history, game stats, and marathon history. My Tools contains Accessibility, wager management, custom
  submissions, whole-board swaps, and Board Focus. Unaccepted trope list items open the same
  description window and can be used to propose swapping a trope out.
- Mid-game changes such as custom trope submissions, wager changes, and whole-board swaps go through the same
  majority-vote flow.
- Bingos are detected automatically. Everyone sees the celebration banner, and the player list/final recap show each player's bingo count.
- Players subscribe to an authenticated private Realtime channel named after the game code. An Edge
  Function binds every message to its Supabase Auth membership and executes ordinary player actions against
  the stored room snapshot with transactional revision checks. Claims, votes, calls, and player tools continue
  if every host disconnects; host-only controls and approval of new mid-game players still require a host.

## Player features

- **Claim queue:** trope claims, challenges, swaps, and custom submissions wait in order while another vote or
  replacement choice is active. Matching proposals merge and co-proposers automatically agree when their vote starts.
  The proposal/voting dialog's Advanced options button reveals Queue another trope and View waiting proposals.
  That reveal button disappears after selection; each new proposal starts collapsed again.
  Open Advanced Options → Explore & Stats → Claim Queue, or expand those options in a vote, to withdraw your own participation. Limits are
  30 waiting entries per game and five new waiting entries per player. Disconnected proposals wait for a proposer to
  return; obsolete proposals are skipped. Ending or resetting clears the queue.
- **Scene context:** optionally add a note (240 characters) and a free-form movie timestamp (up to 120 characters) to a
  trope proposal. Context appears with the vote and is retained in its activity entry and recap history. Accepted trope
  details show the original proposal's context as read-only.
- **Trope search:** All Tropes and Accepted Tropes support case-insensitive search combined with filters for accepted
  status, your board, your wagers, and active or successful calls.
- **Accessibility:** Advanced Options → My Tools → Accessibility offers larger text, a readable single-column board, visible space-state labels, and
  reduced animations. Board spaces support Enter/Space. These preferences stay on your device in
  `bingo-accessibility` localStorage and do not change other players' views.
- **Optional trope presets:** Advanced Host Setup and Reset Game include checkboxes in the custom-trope editor for
  visual-effects judgments, filming marvels, continuity/period errors, implausible explosions, heavy foreshadowing,
  product placement, substance use, and language-sensitive dialogue including slurs. These documented tropes retain
  genre tags but are excluded from automatic game
  and replacement draws. Selecting a preset adds it through the existing custom pool and respects its 20-entry cap.
- **Guided tutorial:** a spotlight overlay starts after hosting, joining, or reconnecting, adapting to host/player
  role and pre-game/live play. It covers browsing trope explanations, optional wagers, approval votes, sound
  notifications, and the light/dark-mode toggle. Calls are covered in the optional advanced-tools branch.
  Its actions open real controls, and it yields to
  votes, modals, menus, and bingo/game-ending celebrations. Pause with the close control or Escape; skip disables
  automatic guidance on that device
  (`bingo-tutorial-enabled` in localStorage). Menu's Start tutorial re-enables it. Sound is only enabled explicitly.
- **Reconnect:** use the Reconnect card in the tab that has the saved session to restore that player ID with its
  authenticated identity. The Join Game form always requests a new seat, even if another tab shares the same browser
  Auth identity; after play starts, the host must approve it. The home-page card appears only while the server confirms
  that the room and seat are still active; it is hidden after expiry or game end. It is unavailable after a player
  deliberately leaves.
- **Host recovery password:** the original host can optionally enter a password of at least 2 characters during game
  setup, or set/replace it later in Menu → Advanced Options → Host Settings. On a new device, join with the game code
  and password to restore the original host seat, board, and permissions. If the old device still appears connected,
  wait up to about a minute after its last heartbeat and retry.
  Only a PBKDF2 verifier is stored; recovery attempts are rate-limited. A successful recovery replaces the old
  device's Auth membership.
- **Recover a player after changing devices:** have the player join as a new player and approve any pending join.
  The host opens the receiving player's options → Recover player from and selects the old non-host seat, whether
  or not it still appears connected. Choose Immediate, 10 seconds, 30 seconds, or 5 minutes and confirm. Timed
  recovery shows the same deadline-based countdown to the host and challenged player; "I'm still playing" or the
  host's Cancel recovery stops it. On expiry, the receiving session inherits the old name, avatar, board, marks,
  wagers, calls, stats, and marathon history; its temporary progress is replaced and the old seat is retired.
  Immediate skips the prompt. Finish votes/replacements/queued claims first; board-changing proposals pause during
  the check. The receiving session retains its own authenticated identity; the retired membership can no longer
  perform relay actions or reconnect. A live non-cooperative test confirmed that an already-open Realtime
  subscription can still receive broadcasts until it sends a new JWT or its current JWT expires. The linked project
  uses a 300-second JWT lifetime for newly issued tokens; tokens already issued keep their original expiry. Immediate
  server-side revocation is not guaranteed. Host seats remain protected and use the host recovery password path.
- **Invite sharing:** the in-game menu can copy a join link with the code pre-filled or show the same link as a QR
  code. Both reflect the current code after a rotation.
- **Movie details:** any player can tap the selected title to view its saved poster, year, director, cast, genres,
  and IMDb link. Details from IMDb selection are shared with the game and saved in reconnect snapshots. Hosts can
  edit the selection; manual entry starts empty and requires a nonblank title before confirmation. During host
  setup, Manual title → Use manual title sets the title before game creation, even when lookup is unavailable.
- **Activity feed:** approved marks, swaps, wager changes, resets, and unaccepted trope proposals are logged for anyone who looked away. Unaccepted trope proposals include anonymous decline reason totals, or state that no reasons were provided. Player names include their avatars, preserved as they appeared when the event was logged.
- **Reactions:** quick emoji reactions broadcast briefly to everyone without starting a vote.
- **Recap:** the host can end the game to show everyone final marked counts, bingo counts, and wager hits. Leader markers
  are shown only for untied, nonzero totals. Highlights include successful callers, recorded multi-line bingo moments,
  and the latest ten debated outcomes with optional scene context and anonymous reason totals. The watch retains up to
  100 trope-vote outcomes; older snapshots cannot reconstruct highlights that were not recorded.
- **Stats:** Advanced Options includes a shared current-game dashboard. Players can tap another player's name to
  view their current metrics; hosts get the same read-only view from player management. Tapping your own name opens
  player options with Badge Progress, View Stats, and Edit Name & Avatar, available to hosts and non-hosts alike.
- **Player distinctions:** explanation opens, trope proposals, outcomes, approval votes, and first-event milestones
  are tracked in replicated game state. All players see the same evidence-based awards: 40 shareable badges and 11
  exclusive superlatives. Multiple players can earn a badge such as Blackout Bound or Pattern Hunter at once, and
  badges from different tracks can coexist on one player. Within a badge progression, only the highest earned tier
  is shown, such as Team Player → Consensus Builder → Watch Party MVP → Consensus Captain or Bingo Buddy → Double
  Feature → Trophy Hunter. Wager Architect and Pattern Hunter can still appear alongside those awards.
  Superlatives such as First Trope Accepted have at most one holder for the watch; simultaneous firsts are not
  singled out. Competitive superlatives such as Most Thoughtful or Most Almost-Bingos require a sole leader and can
  change holders as evidence changes. Ties have no holder. There is no blanket first-acceptance unlock or
  participation fallback; every award requires its own evidence. Full House can appear after five wagers during setup;
  reading awards count distinct tropes, and end-of-watch badges wait until the watch ends. Successful calls can earn
  Right on Cue, Prediction Pro, and Crystal Ball; failed or merely attempted predictions do not count. Your own name
  → Badge Progress is available before earning a badge and shows up to three upcoming badge milestones with live
  evidence counts. Clicking an award shows its details and badge progress. Newly earned badges and changed
  superlatives are announced to every connected viewer in grouped, queued notifications that wait behind menus,
  modals, toasts, tutorials, and celebrations. Initial/reconnected snapshots are silent; repeated snapshots and
  previously earned badges do not replay announcements. Resetting a watch clears old notifications and starts fresh
  achievement tracking.
- **Calls:** during a game, a trope's `Advanced actions` menu lets any player call one trope they expect next. A
  player's score appears only after making a call. Live player-list and final recap scores are clickable, explaining
  correct calls / calls made (including changed or withdrawn predictions) and how to make a call from a board trope.
  The score popup also lists that player's individual predictions and whether each scored, is still waiting, was
  changed/withdrawn, or had its trope replaced. Call history is shared, saved for reconnects, and cleared on reset.
  Older watches show only recoverable active/successful calls with a notice for unrecorded history.
  The called space is outlined on their own board, while caller avatars appear on matching spaces for everyone. Narrow spaces
  show fewer avatars and `...` for additional callers. Tap a space to see caller avatars below its buttons, then tap
  any avatar to reveal all caller names. Each newly opened trope starts with avatars only. If a different trope is
  accepted first, each affected caller is asked whether to keep or drop their call. Accepted calls are tracked as a
  metric, and a call can also be withdrawn through Advanced actions.
  Accepted spaces celebrate briefly with a green ring; called hits use a distinct gold pulse/spark and retain a small
  target marker and inset outline. Successful callers are shared and saved for reconnects, and their avatars/names
  remain available from the trope details. Undoing acceptance, replacing the trope, or resetting clears the marker.
  Reduced-motion preferences disable the animated effects while preserving the success marking.
- **Vote reasons:** choosing Disagree opens an optional, anonymous set of preset reasons. The group sees only the
  aggregate reasons, never which player selected one. Reasons for unaccepted trope proposals are retained in the activity feed.
- **Marathon history:** always on — whenever the host resets a started game, that watch's metrics are retained. The
  Marathon History view tracks each player's completed watches, accepted tropes, bingos, and wager hits without
  assigning points or a winner.
- **Co-hosts:** a host can add other connected players as hosts. Every host has the same host controls, can add more
  hosts, and can resign once another host remains, except that recovery-password configuration is exclusive to the
  original host.
- **PWA support:** the site includes a web app manifest and service worker so it can be installed via "Add to Home Screen" / browser install prompts. The app still needs network access for live multiplayer relay traffic.
- **Notifications:** sound alerts can be muted from the header. iPhone/iPad browsers do not provide reliable webpage
  vibration support, so the app also uses visible vote prompts and a tab-title alert when an answer is needed.

## Testing

`npm test` runs unit/component tests, real Edge entrypoint tests with a mocked SDK/Deno boundary, and PGlite
tests that execute the database migrations. `npm run coverage` includes frontend and Supabase function code;
untested entrypoint lines stay visible instead of being excluded from the headline percentage.

For browser regression, install Chromium once and run:

```sh
npx playwright install chromium
npm run test:browser
```

The browser command starts the real app with an isolated local backend, uses ten independent Chromium contexts,
and exercises desktop/mobile gameplay, menus, voting, badges, reconnect-related behavior, and recovery. It requires
no cloud credentials and does not access production Supabase. Reports/screenshots go to `test-results/browser`
(override with `BROWSER_TEST_OUTPUT`). CI and Pages builds run this command and upload its results even on failure.
These tests complement, rather than replace, the separately authorized live Supabase smoke/revocation checks.

For a representative slow-device profile, run `CI=true BROWSER_CPU_THROTTLE=4 npm run test:browser`.
This throttles the first desktop and mobile sessions while the other eight participants run normally; it is not
a ten-device throttling benchmark or a measurement of production network latency.

## Supabase setup (required)

1. Create a free project at <https://supabase.com/dashboard> (no credit card required).
2. In your project's **Settings → API**, copy the **Project URL** and the **anon public key**
   (this key is designed to be public/embedded in client-side code — that's expected here).
3. In **Authentication → Sign In / Providers**, enable **Anonymous Sign-Ins**. The browser uses anonymous Auth so
   Realtime and the relay function can bind requests to a stable user identity.
4. In **Realtime Settings**, disable **Allow public access**. Room channels must remain private.
5. For local dev: copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
6. For the GitHub Pages deploy: add two **repository secrets** (Settings → Secrets and variables →
   Actions) named `SUPABASE_URL` and `SUPABASE_ANON_KEY` — the deploy workflow passes them through
   as build-time env vars automatically.

### Secure relay deployment

The Edge Function service key must stay in Supabase and must never be added to `.env`, GitHub Pages
secrets, or browser code. Supabase provides `SUPABASE_SERVICE_ROLE_KEY` to deployed Edge Functions.

1. Install/use the Supabase CLI and link this repository to your project:

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
```

2. Apply the private room/membership schema and Realtime RLS policies, then deploy the authenticated relay:

```sh
npx supabase db push
npx supabase functions deploy game-relay
```

Publish the updated GitHub Pages frontend before applying the transactional room-revision migration and
deploying the revised relay. The frontend sends a server revision with each full-state publish; the Edge
Function commits state and membership changes atomically and rejects stale snapshots. After deploying the
function, ask players with an already-open tab or installed app to reload so it uses the revision-aware
protocol. The migration stores authoritative room snapshots and Auth-bound memberships with an expiry.
Realtime read access is limited to active members; direct client broadcast writes are not allowed. Pending
mid-game joiners remain off the room channel until the host approves them.

### Relay Abuse Limits and Payload Validation

Authenticated relay requests use database-backed counters shared across function instances. Defaults:

| Scope                                            | Limit                                     |
| ------------------------------------------------ | ----------------------------------------- |
| Per user, all relay requests                     | 600 per minute                            |
| Per user, room creation attempts                 | 6 per 10 minutes                          |
| Per user, joins                                  | 20 per minute                             |
| Per user, host recovery/password configuration   | 10 per 15 minutes                         |
| Per user, gameplay/state publishes               | 480 per minute                            |
| Per user, status polling and heartbeats combined | 180 per minute                            |
| Per user, other/control requests                 | 30 per minute                             |
| Project, all relay requests                      | 6,000 per minute and 120,000 per 24 hours |
| Project, room creation attempts                  | 500 per 24 hours                          |

Join-form recovery passwords use the recovery bucket; the existing per-room five-attempt lockout remains.
Denied operation attempts still consume aggregate allowances. Project-wide caps also bound rotating-identity
traffic, but can stop service for all users when exhausted; they do not replace Auth signup protections.
Expired user counters are cleaned after two days. Browser roles cannot read or alter counters or invoke their RPC.
Exhausted budgets return HTTP 429 with `Retry-After` and `retryAfterSeconds`; budget failures return HTTP 503
without executing an operation.

Bodies are read through a bounded stream before JSON parsing: at most 1,100,000 bytes, regardless of claimed
Content-Length. Malformed JSON, excessive nesting/complexity, prototype-like keys, unknown operations/messages/
actions, and invalid field sizes/types are rejected. Zod schemas validate indexes, votes, identity envelopes,
board shapes, pending claims/recovery, and snapshot roster/revision consistency. Invalid requests return HTTP 400;
oversized bodies return HTTP 413. Rejected authenticated payloads still count toward abuse budgets. Sender identity
remains server-derived and role checks still apply after validation; this is not a redesign of host privileges.

Apply `202610080002_relay_abuse_limits.sql` with the other pending migrations **before deploying the revised
game-relay function**. The function fails closed if its budget RPC is missing. Room codes, password length,
admission rules, and gameplay behavior are unchanged by these safeguards.

### Live Security Smoke Test

The relay also bounds body-read time to eight seconds, preserves saved-action acknowledgements after broadcast
failure, and supports replay-safe UUID action IDs through atomic receipts retained for 24 hours. Seat reclamation
uses a single database transaction. Apply `202610080003_reliable_game_actions.sql` after the earlier migrations
before deploying this function revision. Updated clients reuse IDs for uncertain retries; older clients without
IDs remain compatible but do not receive deduplication. See [Security Operations](docs/security-operations.md)
for privacy-safe log events, quota/signup monitoring, and the confirmed non-cooperative revocation limitation.

After deployment, run `node scripts/supabase-smoke.js` from the repository root. It uses local Supabase
configuration and your deployment login (macOS CLI keychain, or `SUPABASE_ACCESS_TOKEN` on other systems).
Credentials are used only in memory and are not printed. This is a live test: it creates temporary anonymous
users and a room, checks private Realtime access, forged identity/state denial, membership permissions,
pending joins, active/expired reconnect status, no-op receipt replay, concurrent co-host snapshot conflicts, code
rotation, and password lockout/recovery, then deletes its own room and users. It also tests stale Realtime
subscriptions; the known continued-delivery behavior is reported as a security failure, not a passing revocation.
It also verifies the authenticated movie lookup proxy with a real search and IMDb detail request.

The test requires a deployment account with access to project API keys for cleanup. Run it only against
the project you intend to test; it does not deploy the static frontend.

## Movie/TV lookup (optional)

Hosting a game lets you search for a movie or TV show by title and auto-select its genres, using the
[OMDb API](https://www.omdbapi.com/) (which sources its data from IMDb). This is entirely optional —
without it, genres/sub-genres are just picked manually via checkboxes.

1. Get a free API key at <https://www.omdbapi.com/apikey.aspx>.
2. Store it as the **`OMDB_API_KEY` Supabase Edge Function secret**, not a `VITE_` variable or GitHub Pages build secret.
3. Apply migrations (`npx supabase db push`) and deploy `movie-lookup` (`npx supabase functions deploy movie-lookup`).

The browser sends authenticated search requests to the proxy; only the server contacts OMDb with the key.
The proxy accepts title searches, exact-title lookups, and IMDb details only. Database-backed limits are 30
requests per authenticated user per minute and 900 across the project per UTC day. If the secret is absent,
lookup reports that it is not configured and manual genre selection remains available. Keys previously
embedded in public browser builds should be rotated through OMDb, then updated in Supabase secrets.

Note: OMDb reports broad genres (e.g. "Horror, Comedy", "Animation", "Western", "Reality-TV"), not
this app's finer sub-genres — see below for how those get suggested automatically.

### Sub-genre suggestions via Wikidata (automatic, no setup needed)

[Wikidata](https://www.wikidata.org/) tags films with a "genre" property that's often much more
specific than OMDb's broad genres (e.g. "slasher film", "zombie film", "heist film"). Whenever you
pick a movie, its Wikidata genre tags are matched against a hand-picked list to suggest (and
pre-check) specific sub-genres, including TV formats such as Cooking, Dating, Game Show, Medical,
Talk Show, News Magazine, Home Renovation, Talent Competition, Travel, Lifestyle, and Docuseries.
This is inherently best-effort, since Wikidata's genre labels are free text, not a fixed list, and not
every film/show has this data. No API key, signup, or configuration is required for this — it just
works alongside the configured movie lookup proxy (see above).

## Development

Use Node.js 22.12 or newer and npm; this matches the Vite and Vitest engine requirements.

```sh
npm install
npm run dev
```

Open the printed local URL in multiple browser tabs/devices (or over the internet) to test
multiplayer — everyone just needs to reach the same Supabase project.

Useful checks before shipping changes:

```sh
npm run format:check
npm run test
npm run test:browser
npm run lint
npm audit --audit-level=high
npm run build
```

Use `npm run format` to apply formatting before `npm run format:check` if needed.

`npm run coverage` reports frontend and backend coverage. Install Chromium before the first browser run with
`npx playwright install chromium`; generated browser results are ignored by Git and formatting checks.

## Build & deploy (GitHub Pages)

```sh
npm run build
```

This outputs a static site to `dist/`. Since `vite.config.js` uses relative asset paths
(`base: './'`), the built site works when hosted from any subpath, including a GitHub Pages
project site (`https://<user>.github.io/<repo>/`). This repository's `Deploy to GitHub Pages`
workflow builds and publishes automatically whenever changes are pushed to `main`.

## Versions & official releases

The home and game headers display the version from `package.json`. Release Please updates that file,
`package-lock.json`, `.release-please-manifest.json`, and `CHANGELOG.md` together in a reviewable release PR.
Normal feature commits do not directly change the displayed version; merging the release PR does.
The generated changelog is excluded from Prettier checks because Release Please owns its formatting; source,
configuration, and handwritten documentation remain checked normally.

### One-time GitHub setup

Enable GitHub Actions for this repository. Under **Settings → Secrets and variables → Actions**, configure the
same repository secrets used by Pages: `SUPABASE_URL` and `SUPABASE_ANON_KEY` are required; `OMDB_API_KEY` is
not a GitHub Actions secret. Store it only as a Supabase Edge Function secret. Only use Supabase's public
client/anon key in frontend build configuration, never a service-role key: frontend configuration is included
in the downloadable app.

Under **Settings → Actions → General → Workflow permissions**, enable **Allow GitHub Actions to create and approve
pull requests** if repository/organization policy permits it. The workflow grants Release Please scoped
`contents: write`, `issues: write`, and `pull-requests: write` permissions. It creates PRs, but does not approve or
merge them for you. If policy prevents enabling that setting, configure a fine-grained token with repository
`contents`, `issues`, and `pull requests` write access as the `RELEASE_PLEASE_TOKEN` Actions secret; Release Please
uses it instead of `GITHUB_TOKEN`. Otherwise, no personal token or local GitHub CLI is required.

### How automatic versioning works

Pushes to `main` first run formatting, lint, tests, and a configured production build. If those succeed, Release
Please examines Conventional Commits and creates or updates a release PR. Review and merge that PR when you want
an official release. On the merge's push to `main`, Release Please creates the matching `v...` tag and GitHub
Release using its generated changelog notes.

Use Conventional Commit messages for changes merged into `main` (when squash-merging, use this style for the PR
title/squash commit):

| Commit                                                                 | Version effect after the first release                 |
| ---------------------------------------------------------------------- | ------------------------------------------------------ |
| `fix: restore double-bingo celebrations`                               | Patch, e.g. `0.1.0` → `0.1.1`                          |
| `feat: add tutorial overlays`                                          | Minor, e.g. `0.1.0` → `0.2.0`                          |
| `feat!: change the game-state protocol` or a `BREAKING CHANGE:` footer | Minor while below `1.0.0`; major once at/above `1.0.0` |
| `docs:`, `chore:`, or `test:` without a breaking change                | Does not normally cause a release by itself            |

The pre-1.0 policy is explicit in `release-please-config.json`: features retain minor bumps, and breaking changes
use minor bumps while the app is still evolving. Moving to `1.0.0` is a deliberate release decision; after that,
breaking changes use major bumps. Do not manually bump package versions or create release tags as part of the
normal managed process, and do not move/reuse published tags.

### First managed release

The configuration starts the first official release at `0.1.0`. The empty manifest is intentional: it does not
pretend that `0.1.0` has already been released. Release Please fills it in through the first release PR, and owns
its updates thereafter. If a genuine release already exists when setup is pushed, Release Please can use that
release history instead.

1. Review/stage the intended app changes and these release files, run `npm run format:check`, `npm run lint`,
   `npm run test`, `npm run test:browser`, and `npm run build`, then commit using a meaningful `feat:` or `fix:` message and push to `main`.
   No staged/uncommitted work is included in a release until you commit and push it.
2. Watch **Actions → Release Please**. If no release PR appears, check that there is an eligible Conventional Commit
   and that the repository permits the bot to create PRs. The workflow can also be run manually on `main`.
3. Review the release PR's package/lock versions, manifest, and changelog. Merge it only after reviewing/testing it.
4. Watch the subsequent **Release Please** run: its `publish-asset` job checks out the exact new tag, validates the
   tag/package/lock agreement, checks/tests/builds that code, and attaches `movie-tv-trope-bingo-v0.1.0.zip` to the
   GitHub Release. Later releases use their own version in the filename.
5. Review the notes and artifact at <https://github.com/justinjamesmiller/movie-bingo/releases>. To try the ZIP,
   extract it and serve the contents with a local/static web server rather than opening its HTML through `file://`.

### Bot-token checks and artifact recovery

GitHub's default `GITHUB_TOKEN` does not trigger other workflows for bot-created PRs or tags. That is why the ZIP
build/upload is in this same workflow, rather than depending on a separate tag event. Release Please PRs also do
not automatically start the usual PR CI checks: run **Actions → CI → Run workflow**, selecting the release PR's
branch, before merging. This is especially important if branch protection requires the `verify` check. An
approved GitHub App token or suitable fine-grained token can be configured later if you want automatic PR events;
it is not required for the current process.

The GitHub Release may appear before its ZIP finishes building. If `publish-asset` fails, use **Re-run failed jobs**
so the successful Release Please job's tag output is retained; **Re-run all jobs** may find the release already
created and skip the asset job. The packaged ZIP is also retained as an Actions artifact before upload, so it can
be attached manually from the release page if needed. Existing release assets are never overwritten.

Pages still deploys pushes to `main` as before; the generated release tag does not drive Pages deployment.
The displayed version and the downloadable release build both follow the committed package version.

## Notes & limitations

- Secondary tools are loaded on demand with a cancellable loading state; board rendering and claim/vote controls
  remain eager. Server-mode explanation views batch for up to 300 ms and piggyback on the next action, with deduped
  batch IDs preserving shared badge evidence. State/outcome broadcasts share a private acknowledged subscription
  within each request. No-op actions retain retry receipts without advancing the room revision or broadcasting.
  Apply `202610090001_noop_action_receipts.sql` after the earlier action-receipt migration before deploying this
  optimized relay. Local bundle/CPU-throttled tests do not establish production latency improvements.
- Browsers already keep a live local copy of game state for rendering. Reactions and result notifications do not
  block the ordered gameplay/state-save queue. The server reuses a room snapshot only within its current request,
  overlaps independent room/membership reads, and reloads after revision conflicts. Membership and expiry checks
  remain active; cached client state is not a substitute for an authoritative Supabase save.
- The frontend negotiates server gameplay from the relay's `gameplayMode: 'server'` response. Older relay deployments
  that do not advertise it retain host-coordinated gameplay, including immediate solo acceptance and the proposer's
  automatic approval. Hostless play requires the updated relay and migrations; an older relay still needs a host.
- No peer-to-peer networking, so no NAT/firewall connectivity issues — everyone just needs a normal
  internet connection to reach Supabase.
- Supabase stores the authoritative room snapshot and memberships until the room expires; connected browsers also
  hold a live copy. Ordinary player actions continue without a connected host. The server enforces vote deadlines;
  connected clients request settlement at the deadline and on periodic heartbeats. If everyone disconnects, due
  votes settle on the next authenticated request. Presence retains a short grace period for backgrounded phones.
- Host permissions can be held by multiple players. Ordinary players do not become hosts when all designated hosts
  disconnect. A host who deliberately leaves while others remain can add a host before departing.
- Ending a game clears its reconnect data. Deliberately leaving also clears that player's reconnect data, so a game
  cannot be restored after every player has chosen Leave Game.
- Mobile browsers and installed web apps can suspend realtime connections when backgrounded. The app
  attempts to reconnect and surfaces connection failures, but a live game still depends on Supabase
  Realtime being reachable.
- Multiplayer requires a Supabase project (see setup above). Optional movie lookup uses the OMDb proxy, and optional
  sub-genre suggestions query Wikidata.
- Supabase quotas depend on the current plan and workload. Review Realtime connections/messages, database storage,
  Edge invocations, and anonymous Auth growth on the dashboard and current pricing page; local ten-player tests do
  not establish production capacity or guarantee the free tier is sufficient.
