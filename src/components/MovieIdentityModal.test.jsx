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
    mocks.available.mockReturnValue(false);
  });

  it('accepts a manual title without a poster', () => {
    const onConfirm = vi.fn();
    render(<MovieIdentityModal currentMovie={null} onConfirm={onConfirm} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Manual title'), { target: { value: 'A private screening' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use manual title' }));

    expect(onConfirm).toHaveBeenCalledWith({ title: 'A private screening', poster: null });
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
        year: '2024',
        type: 'series',
        poster: null,
        genres: ['drama', 'tv'],
        subgenreSelections: [{ genre: 'drama', subgenre: 'family-drama' }],
      }),
    );
  });
});
