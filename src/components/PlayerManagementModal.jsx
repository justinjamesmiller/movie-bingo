import ModalShell from './ModalShell.jsx';

export default function PlayerManagementModal({ player, isHost, onAddHost, onProposeProfile, onCancel }) {
  return (
    <ModalShell onClose={onCancel}>
      <div className="modal-content">
        <h3>Manage {player.name}</h3>
        <div className="claim-vote-buttons cancel-claim-btn">
          {!isHost && (
            <button className="btn agree" onClick={onAddHost}>
              👑 Add Host
            </button>
          )}
          <button className="btn" onClick={onProposeProfile}>
            Propose Name &amp; Avatar
          </button>
          <button className="btn disagree" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
