export default function ThemeToggle({ theme, onToggle }) {
  return (
    <button
      className="theme-toggle"
      onClick={onToggle}
      aria-label="Toggle dark mode"
      title="Toggle light/dark mode"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
