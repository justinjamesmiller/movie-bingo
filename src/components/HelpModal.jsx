import ModalShell from './ModalShell.jsx';

export default function HelpModal({ onClose }) {
  return (
    <ModalShell onClose={onClose}>
      <div className="modal-content help-modal-content">
        <h3>❓ How to Play</h3>

        <details className="help-section">
          <summary>Getting Started</summary>
          <h4>📖 Guided tutorial</h4>
          <p className="hint">
            A guided overlay starts when you enter a game, with different tips for hosts and players. It covers your
            board, optional wagers, sound notifications, light/dark mode, and live play. The optional advanced branch
            includes Call it next. Pause it with the close button or Escape, or choose Skip tutorial on this device to
            turn automatic guidance off. Menu's Start tutorial turns it back on. Guidance pauses for votes, modals,
            menus, and celebrations.
          </p>
          <h4>🎯 Objective</h4>
          <p className="hint">
            Everyone gets a 5x5 board of movie/TV tropes. When a trope happens on screen, mark it. Get 5 in a row (any
            direction) for a bingo! Completing a line is detected automatically — you'll get a celebration banner, a
            sound, and a glowing highlight around the winning line.
          </p>

          <h4>🎬 Hosting &amp; Joining</h4>
          <p className="hint">
            The host starts with genres only, then can choose sub-genres or open Advanced Host Setup for more options.
            Looking up a real movie or TV show can auto-fill genres — search results show 🎬/📺 so you can tell them
            apart. Everyone else just enters their name and the 4-character game code to join — or uses the menu's
            invite link or QR code.
          </p>
          <p className="hint">
            The original host can set a unique recovery password of at least 12 characters in Advanced Options → Host
            Settings. On a new device, enter it with the game code to restore that host seat after the old device has
            disconnected. If it still appears connected, wait up to about a minute and try again.
          </p>
          <p className="hint">
            The menu begins with simple details. Tap Genres to view selected sub-genres and their general mix, or use
            Advanced Options to reveal the less-common game controls.
          </p>
          <p className="hint">
            Hosts can update the movie or TV show by tapping its title during a game. An IMDb-selected title refreshes
            the visual theme and poster treatment, while the current board and trope pool stay unchanged. Everyone can
            tap the title to see its saved poster and IMDb details; only hosts can search for a different title or enter
            a new manual title.
          </p>

          <h4>💰 Wagering (before the game starts)</h4>
          <p className="hint">
            Wagers are optional. Before the game starts, choose Optional Wagers to pick up to 5 tropes you feel
            especially confident will happen. They lock once the host starts the game.
          </p>
        </details>

        <details className="help-section">
          <summary>Claiming Tropes &amp; Voting</summary>
          <h4>👆 Tapping a space (once the game has started)</h4>
          <ul className="help-list">
            <li>
              Tapping a space shows what the trope means, with an example, then lets you{' '}
              <strong>claim it just happened</strong>. Everyone votes 👍/👎; majority wins.
            </li>
            <li>
              During play, open <strong>⋯ Advanced actions</strong>, then choose{' '}
              <strong>🔁 Propose swapping it out</strong>. Pick the replacement genre/sub-genre; the group votes on the
              proposal. Before play starts, the trope description offers the swap action directly.
            </li>
            <li>
              <strong>⋯ Advanced actions</strong> keeps the window tidy while offering a personal{' '}
              <strong>📣 Call it next</strong>
              prediction or a trope-swap proposal. Every player can use it during a game. A call can be withdrawn and is
              tracked as correct only if that trope is later accepted. If a different trope is accepted first, you can
              keep your call or drop it. Caller avatars appear on matching spaces for everyone, with "..." for extra
              callers. Tap the space, then any caller avatar below the buttons to see every caller's name. Accepted
              spaces get a short green ring. A called trope that is accepted gets a distinct gold celebration and keeps
              a small target marker and inset outline. Its saved caller avatars show who called it correctly. Call
              scores appear only after a player makes a call. Tap the score in the player list or recap for an
              explanation: correct calls / calls made, including changed or withdrawn predictions. The same window lists
              the player's predictions and labels which scored, are waiting, were changed or withdrawn, or had their
              trope replaced. After the watch ends, a waiting call is shown as not scored.
            </li>
          </ul>

          <h4>📋 Accepted Tropes &amp; 📖 All Tropes lists</h4>
          <p className="hint">
            Search either list by trope name and combine it with filters for your board, wagers, or calls. All Tropes
            also filters accepted and unaccepted spaces.
          </p>
          <ul className="help-list">
            <li>
              <strong>Accepted Tropes</strong> button shows everything approved so far. Tap one to challenge/undo it.
            </li>
            <li>
              <strong>All Tropes</strong> button shows the entire pool for this game. Tap one to propose it happened
              (even if it&apos;s not on your own board), or to propose replacing it while it has not been accepted.
            </li>
          </ul>

          <h4>👎 Vote Reasons</h4>
          <p className="hint">
            If another vote is open, Queue another trope lets you submit without interrupting it. Claim Queue in the
            menu, or View waiting proposals in a vote, shows waiting proposals and lets you withdraw your own. Matching
            proposals merge; connected proposers vote automatically when their turn starts. Replacement choices finish
            before the next vote. A game allows 30 waiting entries, with five new entries per player. You can optionally
            add a scene note and a movie timestamp such as 12:34 or 1:12:34 to a trope proposal.
          </p>
          <p className="hint">
            After choosing Disagree, you can optionally say whether the trope was not on screen, not clear enough, or
            needs more context. Reasons are anonymous and shown to everyone as group totals in the declined-claim toast
            and the Activity Feed.
          </p>
        </details>

        <details className="help-section">
          <summary>Advanced Tools &amp; Stats</summary>
          <h4>⚙️ Advanced Options</h4>
          <p className="hint">
            The menu begins in Simple Options mode. Open Advanced Options when you want access to tools such as all
            tropes, wager management, activity history, board swapping, and session lifetime. Those tools are grouped
            into Explore &amp; Stats, My Tools, and Host Settings so only one group is open at a time.
          </p>

          <h4>🎯 Managing wagers mid-game</h4>
          <p className="hint">
            The menu's "Manage Wagers" option lets you remove existing wagers and/or add new ones — stage as many
            changes as you like, then submit them all together as a single group vote.
          </p>

          <h4>🔀 Swapping your whole board</h4>
          <p className="hint">
            Stuck with a board you can't do anything with? The menu's "Swap My Whole Board" option asks the group for a
            completely fresh set of 25 spaces. If the majority agrees, your board is re-dealt from the same trope pool —
            anything the group has already accepted stays marked, and your wagers are cleared so you can re-place them.
          </p>

          <h4>🎯 All Wagers</h4>
          <p className="hint">
            See every player's wagered tropes in one place. Anything the group has already accepted is outlined in
            green.
          </p>

          <h4>📜 Activity Feed</h4>
          <p className="hint">
            A running log of approved marks, swaps, wager changes, and trope proposals that were not accepted, with
            timestamps. Unaccepted proposals include anonymous decline reason totals, or say when no reasons were
            provided — handy for catching up if you looked away from the app for a bit.
          </p>

          <h4>📊 Player &amp; Game Stats</h4>
          <p className="hint">
            In Advanced Options, Game Stats summarizes the current watch for everyone. Tap another player's name to see
            their current tropes, bingos, and wager hits without adding extra numbers to the player list. Tap your own
            name for player options and choose View Stats to see your own record. Player distinctions use shared
            activity and board data, so everyone sees the same badges. "Most" and exclusive "first" distinctions require
            an untied lead; other badges describe recorded achievements. Badges appear individually when earned, not
            automatically after the first acceptance. Filling five wagers can earn Full House before play; exploring
            three different tropes can earn Board Cartographer. Trophy Hunter needs three bingos. Later achievements
            take precedence over lighter early badges, and a player may have no badge yet. Genuine shared achievements
            can be earned by more than one player.
          </p>

          <h4>🎬 Marathon History</h4>
          <p className="hint">
            Marathon tracking is always on. Whenever the host resets after a started watch, that watch's tropes, bingos,
            and wager hits are saved in Marathon History, so a multi-movie night just works with Reset Game between
            movies. It keeps shared totals without assigning points or declaring a winner.
          </p>
        </details>

        <details className="help-section">
          <summary>Ending &amp; Resuming a Game</summary>
          <h4>🏁 Ending the game &amp; recap</h4>
          <p className="hint">
            Once the game has started, the host can hit "End Game" from the menu. Everyone gets a recap showing each
            player's tropes marked, bingos, and wagers hit, with 🏆 for the most tropes marked, 🎉 for the most bingos,
            and 🎯 for the most wagers hit. These markers appear only for a sole leader, not tied totals. You can reopen
            the recap later from the menu's "View Recap" option. If an after-credits scene adds more tropes, the host
            can use "Resume Game" to reopen play. Ending a game clears reconnect data until it is resumed.
          </p>
          <p className="hint">
            Highlights also show successful callers, multi-line bingo moments, and the latest ten debated outcomes,
            including scene context and anonymous reason totals. Ending or resetting clears waiting proposals.
          </p>
        </details>

        <details className="help-section">
          <summary>Personal Tools &amp; Reactions</summary>
          <h4>🧑‍🎤 Avatars</h4>
          <p className="hint">
            Menu's Accessibility options include larger text, a readable list instead of the grid, visible space-state
            labels, and reduced animations. Settings are saved only on your device. Focus a board space and press Enter
            or Space to open it.
          </p>
          <p className="hint">
            Tap your own name in the Players list to open player options, then choose Edit Name &amp; Avatar. Your
            avatar shows up in claim prompts and the final recap so everyone can tell you apart at a glance.
          </p>

          <h4>🎉 Quick Reactions</h4>
          <p className="hint">
            A row of emoji buttons (👏😂😱🔥❤️) lets you react instantly without starting a vote — your reaction briefly
            floats up on everyone's screen with your name attached.
          </p>

          <h4>📝 Custom Trope Submissions</h4>
          <p className="hint">
            When hosting or resetting, you can type in your own custom trope(s) to mix into the pool. Use the optional
            trope presets in Advanced Host Setup or Reset Game to include subjective judgments, product placement,
            substance use, or language-sensitive tropes explicitly; they are never drawn automatically. Mid-game, use
            the menu's "Submit Custom Trope" to propose a brand-new one on the spot — it goes through the same majority
            vote as any other claim, and joins the pool if approved.
          </p>

          <h4>🧰 Other buttons</h4>
          <ul className="help-list">
            <li>
              🔍 <strong>Board Focus</strong> — collapse everything down to just your board.
            </li>
            <li>
              ✏️ <strong>Your name in the Players list</strong> — view your stats or edit your name and avatar.
            </li>
            <li>
              🎬 <strong>Marathon History</strong> — view totals from every completed watch in this session.
            </li>
            <li>
              🔗 <strong>Copy Invite Link</strong> / <strong>QR Code</strong> — share the game with others.
            </li>
            <li>
              🚪 <strong>Leave Game</strong> — asks you to confirm, then heads back to the home screen. A host leaving
              while others are connected can add a host first.
            </li>
          </ul>
          <p className="hint">Most pop-up windows can also be closed by tapping outside the window.</p>
        </details>

        <details className="help-section">
          <summary>Host Controls</summary>
          <h4>👑 Host-only</h4>
          <ul className="help-list">
            <li>
              <strong>Start Game</strong> — locks in wagers and begins play.
            </li>
            <li>
              <strong>End Game</strong> — ends play and shows the recap to everyone.
            </li>
            <li>
              <strong>Resume Game</strong> — reopens an ended game for extra late tropes.
            </li>
            <li>
              <strong>Reset Game</strong> — deals fresh boards, lets you re-pick genres/settings.
            </li>
            <li>
              <strong>Add Host</strong> — give another connected player host permissions while you remain in the game.
              They receive a notice explaining their new controls. Hosts have the same controls, can add more hosts, and
              can resign as host once another host remains.
            </li>
            <li>
              <strong>Manage a player</strong> — click another player&apos;s name or avatar to add them as a host or
              propose a new name and avatar. They must accept a profile proposal before it takes effect. During a watch,
              a host can also select a disconnected non-host seat and restore its board, marks, wagers, and call history
              onto a connected player who joined from a new device; the abandoned seat is removed. Finish any active
              vote, replacement, or queued proposals first.
            </li>
            <li>
              <strong>Remove</strong> (in the Players list) — kicks a player and rotates the game code for security.
              Connected players stay connected automatically.
            </li>
            <li>
              <strong>Join requests</strong> — new players CAN still join after the game has started, but you'll get a
              prompt to approve them first. Denying one also offers the option to rotate the game code.
            </li>
          </ul>
        </details>

        <details className="help-section">
          <summary>App, Sound &amp; Connection</summary>
          <h4>🔊 Sound &amp; 🔌 Connection</h4>
          <p className="hint">
            The speaker icon in the header mutes/unmutes notification sounds. A visible prompt and browser-tab alert
            also appear when the group needs your answer; iPhone and iPad browsers do not reliably support webpage
            vibration. If your connection drops, a red banner appears at the top of the screen so you know to check your
            network.
          </p>

          <h4>📲 Install as an app</h4>
          <p className="hint">
            Most browsers let you "Add to Home Screen" or "Install" this page for a more app-like experience on movie
            night — look for that option in your browser's menu.
          </p>

          <h4>🔌 Disconnects</h4>
          <p className="hint">
            If you get disconnected (including the host), reopening the app offers a "Reconnect" option to resume your
            same board and progress from its saved player seat. The "Join Game" form always creates a new seat; if play
            has started, the host must approve that join. The home-page option appears only while the server confirms
            the saved game and seat are active; it disappears after expiry or game end. Reconnect is unavailable after
            deliberately leaving a game. If you change devices as a guest, join as a new player and ask the host to
            restore your old board; original hosts can recover with their recovery password.
          </p>
        </details>

        <button className="btn cancel-claim-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalShell>
  );
}
