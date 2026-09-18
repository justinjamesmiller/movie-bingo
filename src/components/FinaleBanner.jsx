const FINALE_MARKS = ['✦', '✧', '✦', '◈', '✧', '✦', '◈', '✧', '✦', '◈', '✧', '✦'];

export default function FinaleBanner({ visible, onDismiss }) {
  if (!visible) return null;

  return (
    <div
      className="finale-banner"
      role="status"
      aria-live="polite"
      onClick={(event) => {
        if (!event.target.closest('.finale-banner-text')) onDismiss?.();
      }}
    >
      <div className="finale-rays" aria-hidden="true" />
      {FINALE_MARKS.map((mark, index) => (
        <span
          key={index}
          className="finale-mark"
          style={{
            '--finale-angle': `${index * 30}deg`,
            animationDelay: `${(index % 4) * 0.12}s`,
          }}
        >
          {mark}
        </span>
      ))}
      <div className="finale-banner-text">
        <span className="finale-kicker">CURTAIN CALL</span>
        <strong>That&apos;s a wrap!</strong>
        <span>The final reel is in.</span>
      </div>
    </div>
  );
}
