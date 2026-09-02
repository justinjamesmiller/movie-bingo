export default function HelpModal({ onClose }) {
  return (
    <div className="modal">
      <div className="modal-content help-modal-content">
        <h3>❓ How to Play</h3>

        <h4>🎯 Objective</h4>
        <p className="hint">
          Everyone gets a 5x5 board of movie/TV tropes. When a trope happens on screen, mark it. Get 5 in a row (any
          direction) for a bingo! Completing a line is detected automatically — you'll get a celebration banner, a
          sound, and a glowing highlight around the winning line.
        </p>

        <h4>🎬 Hosting &amp; Joining</h4>
        <p className="hint">
          The host picks genre(s)/sub-genre(s) (or looks up a real movie or TV show to auto-fill them — search results
          show 🎬/📺 so you can tell them apart), an optional free center space, and how many unique tropes are in play,
          then shares the 4-character game code. Everyone else just enters their name and that code to join — or use the
          menu's "Copy Invite Link" once hosting, which pre-fills the code for whoever opens it.
        </p>

        <h4>💰 Wagering (before the game starts)</h4>
        <p className="hint">
          Click up to 5 spaces you think are extra likely to happen. Click again to un-wager. Once the host starts the
          game, wagers lock in.
        </p>

        <h4>👆 Tapping a space (once the game has started)</h4>
        <ul className="help-list">
          <li>
            Tapping a space shows what the trope means, with an example, then lets you{' '}
            <strong>claim it just happened</strong>. Everyone votes 👍/👎; majority wins.
          </li>
          <li>
            The same window has a <strong>🔁 Propose swapping this trope out</strong> button — you pick which
            genre/sub-genre the replacement comes from. Also needs majority approval.
          </li>
        </ul>

        <h4>📋 Accepted Tropes &amp; 📖 All Tropes lists</h4>
        <ul className="help-list">
          <li>
            <strong>Accepted Tropes</strong> button shows everything approved so far. Tap one to challenge/undo it, or
            to propose replacing it.
          </li>
          <li>
            <strong>All Tropes</strong> button shows the entire pool for this game. Tap one to propose it happened (even
            if it&apos;s not on your own board), or to propose replacing it.
          </li>
        </ul>

        <h4>🎯 Managing wagers mid-game</h4>
        <p className="hint">
          The menu's "Manage Wagers" option lets you remove existing wagers and/or add new ones — stage as many changes
          as you like, then submit them all together as a single group vote.
        </p>

        <h4>🔀 Swapping your whole board</h4>
        <p className="hint">
          Stuck with a board you can't do anything with? The menu's "Swap My Whole Board" option asks the group for a
          completely fresh set of 25 spaces. If the majority agrees, your board is re-dealt from the same trope pool —
          anything the group has already accepted stays marked, and your wagers are cleared so you can re-place them.
        </p>

        <h4>🎯 All Wagers</h4>
        <p className="hint">
          See every player's wagered tropes in one place. Anything the group has already accepted is outlined in green.
        </p>

        <h4>📜 Activity Feed</h4>
        <p className="hint">
          A running log of everything that's been approved so far (marks, swaps, wager changes) with timestamps — handy
          for catching up if you looked away from the app for a bit.
        </p>

        <h4>🏁 Ending the game &amp; recap</h4>
        <p className="hint">
          The host can hit "End Game" anytime from the menu. Everyone gets a recap showing each player's tropes marked
          and wagers hit, with 🏆 for the most tropes marked and 🎯 for the most wagers hit. You can reopen the recap
          later from the menu's "View Recap" option.
        </p>

        <h4>🧑‍🎤 Avatars</h4>
        <p className="hint">
          Pick an emoji avatar from "Change Name and Avatar" — it shows up next to your name in the Players list, claim
          prompts, and the final recap so everyone can tell you apart at a glance.
        </p>

        <h4>🎉 Quick Reactions</h4>
        <p className="hint">
          A row of emoji buttons (👏😂😱🔥❤️) lets you react instantly without starting a vote — your reaction briefly
          floats up on everyone's screen with your name attached.
        </p>

        <h4>📝 Custom Trope Submissions</h4>
        <p className="hint">
          When hosting or resetting, you can type in your own custom trope(s) to mix into the pool. Mid-game, use the
          menu's "Submit Custom Trope" to propose a brand-new one on the spot — it goes through the same majority vote
          as any other claim, and joins the pool if approved.
        </p>

        <h4>🔊 Sound, 📳 Vibration &amp; 🔌 Connection</h4>
        <p className="hint">
          The speaker and vibration icons in the header independently mute/unmute notification sounds and mobile
          vibration (new claims, approvals, bingos) — these settings persist even through a game reset or leaving to
          join a new game. If your connection drops, a red banner appears at the top of the screen so you know to check
          your network.
        </p>

        <h4>🧰 Other buttons</h4>
        <ul className="help-list">
          <li>
            🔍 <strong>Board Focus</strong> — collapse everything down to just your board.
          </li>
          <li>
            ✏️ <strong>Change Name and Avatar</strong> — rename and re-pick your avatar anytime.
          </li>
          <li>
            📋 <strong>Copy Code</strong> / 🔗 <strong>Copy Invite Link</strong> — share the game with others.
          </li>
          <li>
            🚪 <strong>Leave Game</strong> — asks you to confirm, then heads back to the home screen.
          </li>
        </ul>

        <h4>👑 Host-only</h4>
        <ul className="help-list">
          <li>
            <strong>Start Game</strong> — locks in wagers and begins play.
          </li>
          <li>
            <strong>End Game</strong> — ends play and shows the recap to everyone.
          </li>
          <li>
            <strong>Reset Game</strong> — deals fresh boards, lets you re-pick genres/settings.
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

        <h4>📲 Install as an app</h4>
        <p className="hint">
          Most browsers let you "Add to Home Screen" or "Install" this page for a more app-like experience on movie
          night — look for that option in your browser's menu.
        </p>

        <h4>🔌 Disconnects</h4>
        <p className="hint">
          If you get disconnected (including the host), reopening the app will offer a "Reconnect" option to resume your
          same board and progress. If that's not available, joining again with your name and the code will let you pick
          your old seat back up.
        </p>

        <button className="btn cancel-claim-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
