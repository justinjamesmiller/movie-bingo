import ModalShell from './ModalShell.jsx';

export default function HelpModal({ onClose }) {
  return (
    <ModalShell onClose={onClose}>
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
          The host starts with genres only, then can choose sub-genres or open Advanced Host Setup for more options.
          Looking up a real movie or TV show can auto-fill genres — search results show 🎬/📺 so you can tell them
          apart. Everyone else just enters their name and the 4-character game code to join — or uses the menu's invite
          link or QR code.
        </p>
        <p className="hint">
          The menu begins with simple details. Use Advanced Details to view selected sub-genres and their general mix,
          or Advanced Gameplay to reveal the less-common game controls.
        </p>

        <h4>💰 Wagering (before the game starts)</h4>
        <p className="hint">
          Wagers are optional. Before the game starts, choose Optional Wagers to pick up to 5 tropes you feel especially
          confident will happen. They lock once the host starts the game.
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

        <h4>⚙️ Advanced gameplay</h4>
        <p className="hint">
          The menu begins in Simple Gameplay mode. Open Advanced Gameplay when you want access to tools such as all
          tropes, wager management, activity history, board swapping, and name or avatar changes.
        </p>

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
          Once the game has started, the host can hit "End Game" from the menu. Everyone gets a recap showing each
          player's tropes marked, bingos, and wagers hit, with 🏆 for the most tropes marked, 🎉 for the most bingos,
          and 🎯 for the most wagers hit. You can reopen the recap later from the menu's "View Recap" option. Ending a
          game clears reconnect data.
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

        <h4>🔊 Sound &amp; 🔌 Connection</h4>
        <p className="hint">
          The speaker icon in the header mutes/unmutes notification sounds. If your connection drops, a red banner
          appears at the top of the screen so you know to check your network.
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
            🔗 <strong>Copy Invite Link</strong> / <strong>QR Code</strong> — share the game with others.
          </li>
          <li>
            🚪 <strong>Leave Game</strong> — asks you to confirm, then heads back to the home screen. A host leaving
            while others are connected can add a host first.
          </li>
        </ul>
        <p className="hint">Most pop-up windows can also be closed by tapping outside the window.</p>

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
            <strong>Add Host</strong> — give another connected player host permissions while you remain in the game.
            They receive a notice explaining their new controls. Hosts have the same controls, can add more hosts, and
            can resign as host once another host remains.
          </li>
          <li>
            <strong>Manage a player</strong> — click another player&apos;s name or avatar to add them as a host or
            propose a new name and avatar. They must accept a profile proposal before it takes effect.
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
          If you get disconnected (including the host), reopening the app offers a "Reconnect" option to resume your
          same board and progress. This is unavailable after ending or deliberately leaving a game. If reconnect is
          available but you prefer a fresh tab, joining again with your name and the code lets you pick your old seat
          back up.
        </p>

        <button className="btn cancel-claim-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalShell>
  );
}
