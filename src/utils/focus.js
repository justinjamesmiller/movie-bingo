export function blurActiveTextField() {
  const activeElement = document.activeElement;
  if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') activeElement.blur();
}
