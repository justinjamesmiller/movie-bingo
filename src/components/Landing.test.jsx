import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Landing from './Landing.jsx';

function renderLanding(overrides = {}) {
  return render(
    <Landing
      onHost={vi.fn()}
      onJoin={vi.fn()}
      error=""
      busy={false}
      loadingMessage=""
      onCancelLoading={vi.fn()}
      savedSession={null}
      onRejoin={vi.fn()}
      {...overrides}
    />,
  );
}

describe('Landing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('scrolls to the top when the join/host page loads', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    renderLanding();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' });
  });

  it('shows the reconnect option near the top when a saved session exists', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    renderLanding({ savedSession: { code: 'ABCD', name: 'Sidney' } });
    expect(screen.getByRole('heading', { name: 'Reconnect' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reconnect to ABCD' })).toBeInTheDocument();
  });

  it('defaults to the simple host setup', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    renderLanding();

    expect(screen.getByRole('button', { name: 'Choose Sub-genres' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Advanced Host Setup' })).toBeInTheDocument();
    expect(screen.queryByText("Sub-genres (optional, layered on top of each genre's general pool)")).toBeNull();
    expect(screen.queryByLabelText('Total unique tropes in play')).toBeNull();
  });

  it('places Host Game immediately after the host name field', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    renderLanding();

    const hostName = screen.getByPlaceholderText('e.g. Ashley');
    expect(hostName.nextElementSibling).toHaveTextContent('Host Game');
  });

  it('shows an accessible loader for a pending landing operation', () => {
    const onCancelLoading = vi.fn();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    renderLanding({ busy: true, loadingMessage: 'Joining game...', onCancelLoading });

    expect(screen.getByRole('status')).toHaveTextContent('Joining game...');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancelLoading).toHaveBeenCalledTimes(1);
  });

  it('allows the host to clear all genres but blocks hosting until one is selected', () => {
    const onHost = vi.fn();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    renderLanding({ onHost });

    fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Horror' }));
    fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));

    expect(screen.getByRole('heading', { name: 'Before You Host' })).toBeInTheDocument();
    expect(screen.getByText('Choose at least one genre before hosting a game.')).toBeInTheDocument();
    expect(document.querySelector('#modal-host-name')).toBeNull();
    expect(onHost).not.toHaveBeenCalled();
  });

  it('lets a host supply their missing name in the setup modal', () => {
    const onHost = vi.fn();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    renderLanding({ onHost });

    fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));
    fireEvent.change(document.querySelector('#modal-host-name'), { target: { value: 'Ashley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.queryByRole('heading', { name: 'Before You Host' })).toBeNull();
    expect(onHost).toHaveBeenCalledWith(
      'Ashley',
      ['horror'],
      [],
      false,
      { horror: 50 },
      40,
      [],
      { horror: 100 },
      { horror: { general: 100 } },
    );
  });

  it('asks for only the missing join fields and submits them', () => {
    const onJoin = vi.fn();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    renderLanding({ onJoin });

    fireEvent.click(screen.getByRole('button', { name: 'Join Game' }));
    expect(screen.getByRole('heading', { name: 'Before You Join' })).toBeInTheDocument();
    expect(document.querySelector('#modal-join-name')).toBeInTheDocument();
    expect(document.querySelector('#modal-join-code')).toBeInTheDocument();

    fireEvent.change(document.querySelector('#modal-join-name'), { target: { value: 'Sidney' } });
    fireEvent.change(document.querySelector('#modal-join-code'), { target: { value: 'abcd' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Join Game' }).at(-1));
    expect(onJoin).toHaveBeenCalledWith('Sidney', 'ABCD');
  });

  it('shows only the name field when a join code is already provided', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    renderLanding();

    fireEvent.change(screen.getByPlaceholderText('ABCD'), { target: { value: 'ABCD' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join Game' }));
    expect(document.querySelector('#modal-join-name')).toBeInTheDocument();
    expect(document.querySelector('#modal-join-code')).toBeNull();
  });

  it('shows only the game-code field when a join name is already provided', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    renderLanding();

    fireEvent.change(screen.getByPlaceholderText('e.g. Sidney'), { target: { value: 'Sidney' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join Game' }));
    expect(document.querySelector('#modal-join-name')).toBeNull();
    expect(document.querySelector('#modal-join-code')).toBeInTheDocument();
  });
});
