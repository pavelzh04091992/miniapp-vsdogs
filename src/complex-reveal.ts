import './complex-reveal.css';

export type ComplexRevealOrigin = { x: number; y: number; scale: number };

export function animateComplexRevealTransition(
  root: HTMLElement,
  markup: string,
  isTimed: boolean,
  origin: ComplexRevealOrigin | null,
  renderFallback: (markup: string) => void,
  onComplete: () => void,
): void {
  const currentShell = root.querySelector<HTMLElement>(':scope > .app-shell');
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  const nextShell = template.content.querySelector<HTMLElement>('.app-shell');

  if (!currentShell || !nextShell) {
    renderFallback(markup);
    onComplete();
    return;
  }

  let completed = false;
  const completeTransition = (): void => {
    if (completed) {
      return;
    }

    completed = true;
    currentShell.remove();
    nextShell.classList.remove('app-shell--complex-levels-transition-enter');
    onComplete();
  };

  currentShell.classList.add(
    'app-shell--complex-levels-transition-exit',
    isTimed
      ? 'app-shell--complex-levels-transition-exit--timed'
      : 'app-shell--complex-levels-transition-exit--self-check',
  );

  if (origin) {
    currentShell.style.setProperty('--complex-fill-origin-x', `${origin.x}px`);
    currentShell.style.setProperty('--complex-fill-origin-y', `${origin.y}px`);
    currentShell.style.setProperty('--complex-fill-scale', origin.scale.toFixed(3));
  }

  nextShell.classList.add('app-shell--complex-levels-transition-enter');
  root.append(nextShell);

  nextShell.addEventListener('animationend', (event) => {
    if (event.target === nextShell) {
      completeTransition();
    }
  });

  window.setTimeout(completeTransition, 820);
}

export function getComplexRevealOrigin(
  routeButton: HTMLElement,
  event: MouseEvent,
): ComplexRevealOrigin | null {
  const shell = routeButton.closest<HTMLElement>('.app-shell');

  if (!shell) {
    return null;
  }

  const shellRect = shell.getBoundingClientRect();
  const hasPointerCoordinates = event.detail > 0;
  const isTimedArea = routeButton.dataset.route === 'complex-levels:timed';
  const clientX = hasPointerCoordinates
    ? event.clientX
    : shellRect.left + shellRect.width * (isTimedArea ? 0.3 : 0.7);
  const clientY = hasPointerCoordinates
    ? event.clientY
    : shellRect.top + shellRect.height * (isTimedArea ? 0.7 : 0.3);
  const x = Math.min(shellRect.width, Math.max(0, clientX - shellRect.left));
  const y = Math.min(shellRect.height, Math.max(0, clientY - shellRect.top));
  const farthestCorner = Math.max(
    Math.hypot(x, y),
    Math.hypot(shellRect.width - x, y),
    Math.hypot(x, shellRect.height - y),
    Math.hypot(shellRect.width - x, shellRect.height - y),
  );
  const sourceRadius = Math.max(shellRect.width, shellRect.height) * 0.09;

  return {
    x,
    y,
    scale: sourceRadius > 0 ? (farthestCorner / sourceRadius) * 1.08 : 20,
  };
}
