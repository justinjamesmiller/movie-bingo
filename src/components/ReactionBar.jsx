const REACTIONS = ['👏', '😂', '😱', '🔥', '❤️'];

// Small always-visible bar of quick emoji reactions, sent as ephemeral
// broadcasts (not part of replicated game state).
export default function ReactionBar({ onReact }) {
  return (
    <div className="reaction-bar">
      {REACTIONS.map((emoji) => (
        <button key={emoji} className="btn reaction-btn" onClick={() => onReact(emoji)}>
          {emoji}
        </button>
      ))}
    </div>
  );
}
