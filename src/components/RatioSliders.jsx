import { GENERAL_PERCENT_OPTIONS } from '../data/tropes.js';
import { ratioTotal } from '../utils/ratios.js';

export default function RatioSliders({ title, entries, values, onChange }) {
  const total = ratioTotal(
    values,
    entries.map((entry) => entry.id),
  );
  return (
    <fieldset className="ratio-sliders">
      <legend>{title}</legend>
      {entries.map((entry) => {
        const inputId = `ratio-${entry.id}`;
        const value = values[entry.id] ?? 0;
        return (
          <div key={entry.id}>
            <label htmlFor={inputId}>
              {entry.label}: {value}%
            </label>
            <input
              id={inputId}
              type="range"
              min={0}
              max={100}
              step={10}
              list="ratio-percent-ticks"
              value={value}
              onChange={(event) => onChange(entry.id, Number(event.target.value))}
            />
          </div>
        );
      })}
      {entries.length > 2 && total !== 100 && <p className="ratio-warning">Total: {total}% (aim for 100%).</p>}
      <datalist id="ratio-percent-ticks">
        {GENERAL_PERCENT_OPTIONS.map((percent) => (
          <option key={percent} value={percent} />
        ))}
      </datalist>
    </fieldset>
  );
}
