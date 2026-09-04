import { QRCodeSVG } from 'qrcode.react';
import ModalShell from './ModalShell.jsx';

export default function InviteQrModal({ inviteUrl, onClose }) {
  return (
    <ModalShell onClose={onClose}>
      <div className="modal-content invite-qr-modal">
        <h3>Join This Game</h3>
        <div className="invite-qr-code">
          <QRCodeSVG value={inviteUrl} size={240} level="M" includeMargin />
        </div>
        <p className="hint">Scan this code to open the invite link with this game&apos;s code filled in.</p>
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalShell>
  );
}
