import { useCallback, useEffect, useRef, useState } from 'react';

const TOAST_DURATION_MS = 3500;
const REACTION_DURATION_MS = 2600;

export function useTransientNotifications() {
  const [toast, setToast] = useState('');
  const [reactions, setReactions] = useState([]);
  const toastTimerRef = useRef(null);
  const reactionTimersRef = useRef(new Set());

  const dismissToast = useCallback(() => {
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = null;
    setToast('');
  }, []);

  const showToast = useCallback((message) => {
    clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => {
      toastTimerRef.current = null;
      setToast('');
    }, TOAST_DURATION_MS);
  }, []);

  const addReaction = useCallback((reaction) => {
    setReactions((current) => [...current, reaction]);
    const timer = setTimeout(() => {
      reactionTimersRef.current.delete(timer);
      setReactions((current) => current.filter((entry) => entry.id !== reaction.id));
    }, REACTION_DURATION_MS);
    reactionTimersRef.current.add(timer);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const dismissOutside = (event) => {
      if (!event.target.closest?.('.toast')) dismissToast();
    };
    document.addEventListener('pointerdown', dismissOutside);
    return () => document.removeEventListener('pointerdown', dismissOutside);
  }, [toast, dismissToast]);

  useEffect(
    () => () => {
      clearTimeout(toastTimerRef.current);
      reactionTimersRef.current.forEach(clearTimeout);
      reactionTimersRef.current.clear();
    },
    [],
  );

  return { toast, reactions, showToast, dismissToast, addReaction };
}
