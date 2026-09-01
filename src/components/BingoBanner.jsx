// Celebratory overlay shown when a player completes a new bingo line --
// purely a local visual/audio flourish, no protocol involved.
const CONFETTI = ['🎉', '🎊', '✨', '🍿', '🎬'];

export default function BingoBanner({ message }) {
  if (!message) return null;

  return (
    <div className="bingo-banner">
      {Array.from({ length: 14 }, (_, i) => (
        <span
          key={i}
          className="bingo-confetti"
          style={{
            left: `${(i * 7.3) % 100}%`,
            animationDelay: `${(i % 5) * 0.15}s`,
          }}
        >
          {CONFETTI[i % CONFETTI.length]}
        </span>
      ))}
      <div className="bingo-banner-text">{message}</div>
    </div>
  );
}
