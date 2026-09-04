import ModalShell from './ModalShell.jsx';

export default function JoinChoiceModal({ name, options, allowNew, busy, onClaimSeat, onJoinAsNew, onCancel }) {
  return (
    <ModalShell onClose={busy ? undefined : onCancel}>
      <div className="modal-content list-modal">
        <h3>Reconnect as an existing player?</h3>
        <p className="hint">
          This game has disconnected players. If one of these is you, pick your name below to take back your board (with
          your marks and wagers intact) as "{name}".
        </p>
        <div className="modal-scroll-area">
          <ul className="challenge-list">
            {options.map((opt) => (
              <li key={opt.id}>
                <button className="btn challenge-item" disabled={busy} onClick={() => onClaimSeat(opt.id)}>
                  {opt.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
        {allowNew && (
          <button className="btn primary" disabled={busy} onClick={onJoinAsNew}>
            None of these are me — join as a new player
          </button>
        )}
        <button className="btn modal-footer" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </ModalShell>
  );
}
