import ModalShell from './ModalShell.jsx';
import { formatPlayerName } from '../utils/playerName.js';

export default function SuperlativeModal({ award, playerName, playerAvatar, onClose }) {
  return (
    <ModalShell onClose={onClose}>
      <div className="modal-content superlative-modal">
        <span className="superlative-modal-kicker">PLAYER DISTINCTION</span>
        <h3>{award.name}</h3>
        <p className="superlative-player">{formatPlayerName({ name: playerName, avatar: playerAvatar })}</p>
        <p className="hint">{award.description}</p>
        <button className="btn modal-footer" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalShell>
  );
}
