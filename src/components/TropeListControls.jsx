import { useId } from 'react';

export function filterTropeTexts(
  texts,
  { query = '', filter = 'all', acceptedTropes = [], board = [], wageredTexts = [], calledTexts = [] },
) {
  const needle = query.trim().toLocaleLowerCase();
  return texts.filter(
    (text) =>
      text.toLocaleLowerCase().includes(needle) &&
      (filter === 'accepted'
        ? acceptedTropes.includes(text)
        : filter === 'unaccepted'
          ? !acceptedTropes.includes(text)
          : filter === 'board'
            ? board.includes(text)
            : filter === 'wagered'
              ? wageredTexts.includes(text)
              : filter === 'called'
                ? calledTexts.includes(text)
                : true),
  );
}

export default function TropeListControls({ query, filter, onQuery, onFilter, acceptedOnly = false }) {
  const id = useId();
  return (
    <div className="trope-list-controls">
      <div>
        <label htmlFor={`${id}-search`}>Search tropes</label>
        <input
          id={`${id}-search`}
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search by trope name"
        />
      </div>
      <div>
        <label htmlFor={`${id}-filter`}>Filter tropes</label>
        <select id={`${id}-filter`} value={filter} onChange={(event) => onFilter(event.target.value)}>
          <option value="all">All</option>
          {!acceptedOnly && (
            <>
              <option value="accepted">Accepted</option>
              <option value="unaccepted">Unaccepted</option>
            </>
          )}
          <option value="board">On my board</option>
          <option value="wagered">My wagers</option>
          <option value="called">Called (active or successful)</option>
        </select>
      </div>
    </div>
  );
}
