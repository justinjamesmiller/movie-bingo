export default function ThemeToggle({ theme, onToggle }) {
  return (
    <label className="accessibility-choice" data-tutorial="theme">
      <input type="checkbox" checked={theme === 'light'} onChange={onToggle} />
      <span>Light mode</span>
    </label>
  );
}
