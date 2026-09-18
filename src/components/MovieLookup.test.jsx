import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  available: vi.fn(),
  searchMovies: vi.fn(),
  getMovieDetails: vi.fn(),
  getSuggestedSubgenres: vi.fn(),
}));

vi.mock('../net/movieLookup.js', () => ({
  isMovieLookupAvailable: mocks.available,
  searchMovies: mocks.searchMovies,
  getMovieDetails: mocks.getMovieDetails,
}));

vi.mock('../net/wikidataLookup.js', () => ({ getSuggestedSubgenres: mocks.getSuggestedSubgenres }));

import MovieLookup from './MovieLookup.jsx';

describe('MovieLookup', () => {
  beforeEach(() => {
    mocks.available.mockReturnValue(true);
    mocks.searchMovies.mockReset();
    mocks.getMovieDetails.mockReset();
    mocks.getSuggestedSubgenres.mockReset();
  });

  it('stays hidden when movie lookup is not configured', () => {
    mocks.available.mockReturnValue(false);
    const { container } = render(<MovieLookup onFound={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('searches, selects a title, and applies compatible genre suggestions', async () => {
    const onFound = vi.fn();
    const onMovieSelected = vi.fn();
    mocks.searchMovies.mockResolvedValue([
      { imdbID: 'tt1', title: 'Example Show', year: '2024', type: 'series', poster: null },
    ]);
    mocks.getMovieDetails.mockResolvedValue({
      title: 'Example Show',
      year: '2024',
      type: 'series',
      poster: null,
      director: 'A Director',
      actors: 'An Actor',
      genres: ['horror'],
      unmapped: [],
    });
    mocks.getSuggestedSubgenres.mockResolvedValue([
      { genre: 'horror', subgenre: 'slasher' },
      { genre: 'comedy', subgenre: 'rom-com' },
    ]);
    render(<MovieLookup onFound={onFound} onMovieSelected={onMovieSelected} />);

    fireEvent.change(screen.getByLabelText(/Look up a movie/i), { target: { value: 'Example' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    fireEvent.click(await screen.findByRole('button', { name: /Example Show/ }));

    expect(await screen.findByText(/Picked "Example Show"/)).toBeInTheDocument();
    expect(onFound).toHaveBeenCalledWith(['horror'], [{ genre: 'horror', subgenre: 'slasher' }]);
    expect(onMovieSelected).toHaveBeenCalledWith({ title: 'Example Show', year: '2024', type: 'series', poster: null });
    expect(screen.getByText(/Slasher/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Search a different title' }));
    expect(screen.queryByText(/Picked "Example Show"/)).toBeNull();
  });

  it('shows a lookup error and allows another search', async () => {
    mocks.searchMovies.mockRejectedValue(new Error('Nothing found.'));
    render(<MovieLookup onFound={vi.fn()} />);

    const input = screen.getByLabelText(/Look up a movie/i);
    fireEvent.change(input, { target: { value: 'Unknown' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByText('Nothing found.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search' })).toBeEnabled();
  });
});
