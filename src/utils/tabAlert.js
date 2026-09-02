// Flashes the browser tab title while the group is waiting on this player.
// This is the cross-platform stand-in for a buzz: iOS Safari has no vibration
// API at all, and on any platform the tab is often not the one in focus.
const FLASH_INTERVAL_MS = 1000;

const baseTitle = typeof document === 'undefined' ? '' : document.title;
let timer = null;
let showingAlert = false;

export function setTabAlert(message) {
  if (typeof document === 'undefined' || !message) return;
  if (timer) clearInterval(timer);
  showingAlert = true;
  document.title = message;
  timer = setInterval(() => {
    showingAlert = !showingAlert;
    document.title = showingAlert ? message : baseTitle;
  }, FLASH_INTERVAL_MS);
}

export function clearTabAlert() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  showingAlert = false;
  if (typeof document !== 'undefined') document.title = baseTitle;
}
