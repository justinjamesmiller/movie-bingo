import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
import MovieIdentityModal from './MovieIdentityModal.jsx';

describe('MovieIdentityModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.available.mockReturnValue(false);
  });

  it('accepts a manual title without a poster', () => {
    const onConfirm = vi.fn();
    render(<MovieIdentityModal currentMovie={null} onConfirm={onConfirm} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Manual title'), { target: { value: 'A private screening' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use manual title' }));

    expect(onConfirm).toHaveBeenCalledWith({ title: 'A private screening', poster: null });
  });

  it('starts manual entry empty and disables confirmation until non-whitespace text is entered', () => {
    render(
      <MovieIdentityModal currentMovie={{ title: 'Previously picked movie' }} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByLabelText('Manual title')).toHaveValue('');
    const button = screen.getByRole('button', { name: 'Use manual title' });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Manual title'), { target: { value: '   ' } });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Manual title'), { target: { value: 'A new title' } });
    expect(button).toBeEnabled();
  });

  it('includes selected title genres for automatic theming', async () => {
    const onConfirm = vi.fn();
    mocks.available.mockReturnValue(true);
    mocks.searchMovies.mockResolvedValue([{ imdbID: 'tt1', title: 'Example', year: '2024', poster: null }]);
    mocks.getMovieDetails.mockResolvedValue({
      title: 'Example',
      year: '2024',
      type: 'series',
      poster: null,
      genres: ['drama', 'tv'],
    });
    mocks.getSuggestedSubgenres.mockResolvedValue([
      { genre: 'drama', subgenre: 'family-drama' },
      { genre: 'horror', subgenre: 'slasher' },
    ]);
    render(<MovieIdentityModal currentMovie={null} onConfirm={onConfirm} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Search IMDb'), { target: { value: 'Example' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    fireEvent.click(await screen.findByRole('button', { name: /Example/ }));

    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith({
        title: 'Example',
        imdbID: 'tt1',
        year: '2024',
        type: 'series',
        poster: null,
        genres: ['drama', 'tv'],
        subgenreSelections: [{ genre: 'drama', subgenre: 'family-drama' }],
      }),
    );
  });

  it.each([false, true])('shows saved IMDb details without a lookup (read-only: %s)', (readOnly) => {
    mocks.available.mockReturnValue(true);
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <MovieIdentityModal
        readOnly={readOnly}
        currentMovie={{
          title: 'Cached Movie',
          year: '2024',
          type: 'movie',
          poster: 'https://example.com/poster.jpg',
          imdbID: 'tt1234',
          director: 'A Director',
          actors: 'An Actor',
          genres: ['horror'],
          subgenreSelections: [{ genre: 'horror', subgenre: 'slasher' }],
        }}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByAltText('Cached Movie poster')).toHaveAttribute('src', 'https://example.com/poster.jpg');
    expect(screen.getByText('Directed by A Director')).toBeInTheDocument();
    expect(screen.getByText('Starring An Actor')).toBeInTheDocument();
    expect(screen.getByText('Genres: Horror')).toBeInTheDocument();
    expect(screen.getByText('Suggested sub-genres: Slasher')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View on IMDb' })).toHaveAttribute(
      'href',
      'https://www.imdb.com/title/tt1234/',
    );
    expect(mocks.getMovieDetails).not.toHaveBeenCalled();
    expect(mocks.searchMovies).not.toHaveBeenCalled();
    if (readOnly) {
      expect(screen.queryByLabelText('Manual title')).toBeNull();
      expect(screen.queryByLabelText('Search IMDb')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Use manual title' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    } else {
      expect(screen.getByLabelText('Manual title')).toHaveValue('');
      expect(screen.getByRole('button', { name: 'Use manual title' })).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    }
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('falls back to a title icon when the cached poster cannot load', () => {
    render(
      <MovieIdentityModal
        currentMovie={{ title: 'Cached Movie', poster: 'https://example.com/broken.jpg' }}
        readOnly
        onCancel={vi.fn()}
      />,
    );
    fireEvent.error(screen.getByAltText('Cached Movie poster'));
    expect(screen.queryByAltText('Cached Movie poster')).toBeNull();
    expect(screen.getByText('🎬')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cached Movie' })).toBeInTheDocument();
  });

  it('shows a manual or older saved title read-only without requiring IMDb metadata', () => {
    render(
      <MovieIdentityModal currentMovie={{ title: 'Private screening', poster: null }} readOnly onCancel={vi.fn()} />,
    );
    expect(screen.getByRole('heading', { name: 'Private screening' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View on IMDb' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});
