// Host-only prompt for a brand-new player trying to join after the game has
// already started -- unlike claims/wagers this is the host's sole call, not
// a group vote, since it's about who gets access to the game at all.
export default function JoinRequestModal({ name, onApprove, onDeny, onDenyAndRotate }) {
  return (
    <div className="modal">
      <div className="modal-content">
        <h3>🙋 Join request</h3>
        <p className="hint">
          <strong>{name}</strong> wants to join this already-started game as a new player.
        </p>
        <div className="claim-vote-buttons">
          <button className="btn agree" onClick={onApprove}>
            ✅ Approve
          </button>
          <button className="btn disagree" onClick={onDeny}>
            ❌ Deny
          </button>
        </div>
        <button className="btn disagree cancel-claim-btn" onClick={onDenyAndRotate}>
          ❌ Deny &amp; Rotate Game Code
        </button>
        <p className="hint">
          Rotating the code disconnects no one else, but requires anyone who's not already connected to get the new code
          before they can join or reconnect.
        </p>
      </div>
    </div>
  );
}
