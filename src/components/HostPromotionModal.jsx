import ModalShell from './ModalShell.jsx';

export default function HostPromotionModal({ promotedBy, promotedByAvatar, onClose }) {
  return (
    <ModalShell onClose={onClose}>
      <div className="modal-content">
        <h3>You Are Now a Host</h3>
        <p className="hint">
          {promotedByAvatar ? `${promotedByAvatar} ` : ''}
          {promotedBy || 'A host'} made you a host.
        </p>
        <p className="hint">
          You can start or reset the game, approve or deny join requests, end the game when it is finished, manage
          players, and add other hosts. You can also resign as host once another host remains.
        </p>
        <div className="claim-vote-buttons cancel-claim-btn">
          <button className="btn agree" onClick={onClose}>
            Got It
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
