import { blurActiveTextField } from '../utils/focus.js';

export default function ModalShell({ children, onClose }) {
  function handleBackdropClick(event) {
    if (event.target === event.currentTarget && onClose) {
      blurActiveTextField();
      onClose();
    }
  }

  function handleActionClick(event) {
    const button = event.target.closest('button');
    if (button && !button.disabled) blurActiveTextField();
  }

  return (
    <div className="modal" onMouseDown={handleBackdropClick} onClickCapture={handleActionClick}>
      {children}
    </div>
  );
}
