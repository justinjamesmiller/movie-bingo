import { useEffect, useId, useRef, useState } from 'react';

function tutorialSteps(isHost, started) {
  return [
    {
      id: 'sound',
      target: 'sound',
      title: 'Keep the group in earshot',
      body: 'Sound helps you notice when another player needs your approval for a claim, swap, or wager change. Keep device volume on too; you can still play muted.',
      action: 'sound',
      label: 'Turn sound on',
    },
    {
      id: 'board',
      target: 'board',
      title: 'Explore your board',
      body: 'Tap a trope to see what it means and an example. Everyone has their own board, so take a look around.',
      action: 'browse',
      label: 'Browse a trope',
    },
    ...(started
      ? [
          {
            id: 'claim',
            target: 'board',
            title: 'Spot it, then claim it',
            body: 'When a trope happens on screen, tap its space and submit it. Submitting counts as your approval; playing alone, the trope is accepted immediately. Accepted tropes turn green, and completed lines celebrate automatically.',
            action: 'browse',
            label: 'Open a trope',
          },
          {
            id: 'votes',
            target: 'board',
            title: 'Your vote matters',
            body: 'When someone proposes a trope or a swap, a prompt asks you to agree or disagree. The proposer already counts as an approval. You can add an anonymous reason when disagreeing. Advanced options reveals queue controls, then disappears until the next proposal.',
          },
        ]
      : [
          {
            id: 'wagers',
            target: 'wagers',
            title: 'Add a little friendly suspense',
            body: 'Wagers are optional: pick up to five tropes you think will happen. Choose Optional Wagers, then Add Wagers. Your picks lock when the host starts; skipping wagers is just as valid.',
            action: 'wagers',
            label: 'Explore optional wagers',
          },
          ...(isHost
            ? [
                {
                  id: 'invite',
                  target: 'menu',
                  title: 'Bring everyone in',
                  body: 'Share the game code, or use Menu to copy an invite link or show a QR code. Players inherit your movie and setup; they do not need to select genres themselves.',
                  action: 'menu',
                  label: 'Open Menu',
                },
                {
                  id: 'start',
                  target: 'start',
                  title: 'Start when everyone is ready',
                  body: 'Start Game begins play and locks the optional wager picks. You do not need advanced settings to have a complete game. The guide will switch to playing tips when you start.',
                },
              ]
            : [
                {
                  id: 'ready',
                  target: 'players',
                  title: 'Ready for movie night',
                  body: 'The host starts the game when everyone is ready. Tap your own name for stats or to change your name and avatar. Playing tips will appear when the game starts.',
                },
              ]),
        ]),
    {
      id: 'theme',
      target: 'theme',
      title: 'Choose light or dark',
      body: "The sun or moon button switches between light and dark mode. Your choice stays on this device and does not change anyone else's view.",
      action: 'theme',
      label: 'Toggle light/dark mode',
    },
    {
      id: 'menu',
      target: 'menu',
      title: isHost ? 'Your host essentials' : 'Keep useful tools close',
      body: isHost
        ? 'Menu keeps sharing and watch controls together. Accepted Tropes and Claim Queue live in Advanced Options → Explore & Stats; Accessibility is in My Tools. Your name opens badge progress, stats, and profile options. Original hosts can set a recovery password during host setup or change it later in Advanced Options → Host Settings.'
        : 'Advanced Options → Explore & Stats lets you review accepted tropes and queued proposals. My Tools includes Accessibility. Your name opens badge progress, stats, and profile options. You can reopen this tutorial from Menu anytime.',
      action: 'menu',
      label: 'Open Menu',
    },
  ];
}

function TutorialFlow({
  isHost,
  started,
  soundMuted,
  suspended = false,
  onEnableSound,
  onToggleTheme,
  onBrowse,
  onWagers,
  onMenu,
  onAdvanced,
  onPause,
  onDisable,
  onFinish,
}) {
  const [index, setIndex] = useState(0);
  const [advanced, setAdvanced] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const [position, setPosition] = useState({ left: 12, bottom: 12 });
  const [blocked, setBlocked] = useState(() => !!document.querySelector('.modal'));
  const cardRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const steps = tutorialSteps(isHost, started);
  if (advanced) {
    steps.push({
      id: 'advanced',
      target: 'menu',
      title: isHost ? 'Optional host controls' : 'Make the game your own',
      body: isHost
        ? 'Open Menu, choose Advanced Options, then Host Settings. Only the original host can set or replace the recovery password. For a lost player session, open the receiving player\'s options → Recover player from. Choose Immediate, 10 seconds, 30 seconds, or 5 minutes. Timed recovery shows a countdown to you and the old player, who can stop it with "I\'m still playing". You can cancel too. Reset Game starts a new watch.'
        : 'Advanced Options includes the whole trope pool, wager management, activity history, custom tropes, board swapping, and Board Focus. Proposals still go to the group for approval.',
      action: 'advanced',
      label: 'Open advanced tools',
    });
    steps.push({
      id: 'calls',
      target: 'board',
      title: 'Call the next moment',
      body: "During play, open an unaccepted trope on your board, choose Advanced actions, then Call it next. This is a prediction, not a claim. If another trope is accepted first, you can keep or drop your call. Tap a player's call score to learn what the numbers mean.",
      action: started ? 'browse' : undefined,
      label: 'Open a trope',
    });
  }
  const step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;

  useEffect(() => {
    const findTarget = () =>
      step.target === 'board'
        ? document.querySelector('[data-tutorial="board"] .bingo-cell:not(.free-space):not(.marked)') ||
          document.querySelector('[data-tutorial="board"] .bingo-cell:not(.free-space)')
        : step.target === 'players'
          ? document.querySelector('[data-tutorial="players"] [aria-label="Your player options"]') ||
            document.querySelector('[data-tutorial="players"]')
          : document.querySelector(`[data-tutorial="${step.target}"]`);
    const target = findTarget();
    const initialBounds = target?.getBoundingClientRect();
    if (initialBounds?.height && (initialBounds.top < 0 || initialBounds.bottom > window.innerHeight)) {
      target.scrollIntoView?.({ behavior: 'instant', block: 'center' });
    }
    function measure() {
      const modalOpen = suspended || !!document.querySelector('.modal, .game-menu-panel');
      setBlocked(modalOpen);
      const cardHeight = cardRef.current
        ? Math.max(cardRef.current.getBoundingClientRect().height, cardRef.current.scrollHeight + 2)
        : 260;
      let bounds = findTarget()?.getBoundingClientRect();
      if (
        !modalOpen &&
        bounds?.height &&
        bounds.top > 12 &&
        Math.max(bounds.top - 24, window.innerHeight - bounds.bottom - 24) <
          Math.min(cardHeight, window.innerHeight - 24)
      ) {
        window.scrollBy?.({ top: bounds.top - 12, behavior: 'instant' });
        bounds = findTarget()?.getBoundingClientRect();
      }
      const left = Math.max(4, bounds?.left || 0);
      const top = Math.max(4, bounds?.top || 0);
      const width = Math.min(bounds?.right || 0, window.innerWidth - 4) - left;
      const height = Math.min(bounds?.bottom || 0, window.innerHeight - 4) - top;
      const next = !modalOpen && width > 0 && height > 0 ? { left, top, width, height } : null;
      setAnchor((previous) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next));
      const cardWidth = Math.min(360, window.innerWidth - 24);
      const availableBelow = next ? Math.max(0, window.innerHeight - (next.top + next.height) - 24) : 0;
      const availableAbove = next ? Math.max(0, next.top - 24) : 0;
      const below = availableBelow >= cardHeight || availableBelow >= availableAbove;
      const maxHeight = next ? Math.max(1, below ? availableBelow : availableAbove) : window.innerHeight - 24;
      const cardTop = next
        ? below
          ? next.top + next.height + 12
          : next.top - Math.min(cardHeight, maxHeight) - 12
        : Math.max(12, window.innerHeight - Math.min(cardHeight, maxHeight) - 12);
      const nextPosition = {
        left: Math.max(12, Math.min(next?.left || 12, window.innerWidth - cardWidth - 12)),
        top: cardTop,
        maxHeight,
      };
      setPosition((previous) => (JSON.stringify(previous) === JSON.stringify(nextPosition) ? previous : nextPosition));
    }
    measure();
    const observer = new MutationObserver(measure);
    observer.observe(document.body, { childList: true, subtree: true });
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (cardRef.current) resizeObserver?.observe(cardRef.current);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      observer.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step.target, step.id, suspended, blocked]);

  useEffect(() => {
    if (!blocked) cardRef.current?.focus({ preventScroll: true });
  }, [step.id, blocked]);

  if (blocked || suspended) return null;
  const actions = {
    sound: onEnableSound,
    theme: onToggleTheme,
    browse: onBrowse,
    wagers: onWagers,
    menu: onMenu,
    advanced: onAdvanced,
  };
  const showAction = step.action && (step.action !== 'sound' || soundMuted);

  return (
    <div className="tutorial-overlay">
      {anchor && (
        <div
          className="tutorial-spotlight"
          aria-hidden="true"
          style={{ left: anchor.left, top: anchor.top, width: anchor.width, height: anchor.height }}
        />
      )}
      <section
        className="tutorial-card"
        style={position}
        role="dialog"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        ref={cardRef}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            onPause();
          }
        }}
      >
        <div className="tutorial-topline">
          <span>
            {isHost ? 'Host guide' : 'Player guide'} · {started ? 'Playing' : 'Getting ready'} · {index + 1} /{' '}
            {steps.length}
          </span>
          <button className="icon-btn" onClick={onPause} aria-label="Pause tutorial" title="Pause tutorial">
            ✕
          </button>
        </div>
        <h3 id={titleId}>{step.title}</h3>
        <p id={descriptionId}>{step.body}</p>
        {step.action === 'sound' && !soundMuted && <p className="tutorial-sound-status">Sound is on.</p>}
        {showAction && (
          <button className="btn tutorial-action" onClick={actions[step.action]}>
            {step.label}
          </button>
        )}
        <div className="tutorial-navigation">
          <button
            className="icon-btn"
            disabled={index === 0}
            onClick={() => setIndex((value) => value - 1)}
            aria-label="Previous tutorial step"
            title="Previous step"
          >
            ←
          </button>
          <button className="btn primary" onClick={() => (last ? onFinish() : setIndex((value) => value + 1))}>
            {last ? 'Finish guide' : 'Next'}
          </button>
        </div>
        {last && !advanced && (
          <button
            className="btn"
            onClick={() => {
              setAdvanced(true);
              setIndex(steps.length);
            }}
          >
            Explore advanced options
          </button>
        )}
        <button className="tutorial-skip" onClick={onDisable}>
          Skip tutorial on this device
        </button>
      </section>
    </div>
  );
}

export default function GuidedTutorial(props) {
  return <TutorialFlow key={`${props.isHost}:${props.started}`} {...props} />;
}
