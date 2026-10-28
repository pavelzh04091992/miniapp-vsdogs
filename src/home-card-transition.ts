export type HomeCardRoute = 'seasonal' | 'fitness';
export type HomeCardTransitionTarget = HomeCardRoute | 'home';

export interface HomeCardLaunch {
  route: HomeCardRoute;
  card: HTMLButtonElement;
  rect: DOMRect;
  clipInsets: readonly [number, number, number, number];
  borderRadius: string;
}

export interface ActiveHomeCardTransition {
  route: HomeCardRoute;
  target: HomeCardTransitionTarget;
  token: number;
}

const OPEN_DURATION = 360;
const CLOSE_DURATION = 350;
const OPEN_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
const CLOSE_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

let transitionToken = 0;
let activeTransition: ActiveHomeCardTransition | null = null;
let activeAnimations: Animation[] = [];
let activeNodes: HTMLElement[] = [];
let hiddenReturnCard: { element: HTMLElement; visibility: string } | null = null;
let activeResizeObserver: ResizeObserver | null = null;
let activeResizeHandler: (() => void) | null = null;

export function getActiveHomeCardTransition(): ActiveHomeCardTransition | null {
  return activeTransition;
}

export function beginHomeCardLaunch(card: HTMLButtonElement, route: HomeCardRoute): HomeCardLaunch | null {
  cancelHomeCardTransition();
  const rect = card.getBoundingClientRect();
  const root = document.querySelector<HTMLElement>('#app');
  const carousel = card.closest<HTMLElement>('.useful-grid');
  if (!root || !carousel || rect.width < 1 || rect.height < 1) return null;

  const rootRect = root.getBoundingClientRect();
  const carouselRect = carousel.getBoundingClientRect();
  const clipLeft = Math.max(0, carouselRect.left - rect.left, rootRect.left - rect.left);
  const clipRight = Math.max(0, rect.right - carouselRect.right, rect.right - rootRect.right);
  const clipTop = Math.max(0, rootRect.top - rect.top);
  const clipBottom = Math.max(0, rect.bottom - carouselRect.bottom, rect.bottom - rootRect.bottom);
  const styles = window.getComputedStyle(card);
  const launch: HomeCardLaunch = {
    route,
    card,
    rect,
    clipInsets: [clipTop, clipRight, clipBottom, clipLeft],
    borderRadius: styles.borderTopLeftRadius,
  };

  return launch;
}

export async function animateHomeCardOpen(options: {
  root: HTMLElement;
  sourceShell: HTMLElement;
  targetShell: HTMLElement;
  launch: HomeCardLaunch;
  reducedMotion: boolean;
}): Promise<void> {
  const token = ++transitionToken;
  activeTransition = { route: options.launch.route, target: options.launch.route, token };
  const { root, sourceShell, targetShell, launch } = options;
  const rootRect = root.getBoundingClientRect();
  const sourceRect = launch.rect;
  const targetRect = targetShell.getBoundingClientRect();
  const targetStyle = window.getComputedStyle(targetShell);
  const pageTarget = rectInsideRoot(targetRect, rootRect);

  targetShell.classList.add('home-card-route-screen--entering');
  targetShell.style.opacity = '0';
  activeNodes.push(targetShell);
  sourceShell.remove();

  if (options.reducedMotion || typeof launch.card.animate !== 'function') {
    if (options.reducedMotion && typeof targetShell.animate === 'function') {
      await animate(targetShell, [{ opacity: 0.86 }, { opacity: 1 }], {
        duration: 120,
        easing: 'ease-out',
        fill: 'forwards',
      });
    }
    targetShell.style.opacity = '';
    targetShell.classList.remove('home-card-route-screen--entering');
    finish(token);
    return;
  }

  const surface = createCardSurface(launch, rootRect);
  surface.append(createFill({
    backgroundColor: targetStyle.backgroundColor,
    backgroundImage: targetStyle.backgroundImage,
  }));
  surface.style.clipPath = insetsToClipPath(launch.clipInsets);
  root.append(surface);
  activeNodes.push(surface);
  const completeOpen = (): void => {
    if (!isCurrent(token)) return;
    surface.remove();
    targetShell.style.opacity = '';
    targetShell.classList.remove('home-card-route-screen--entering');
    finish(token);
  };
  watchGeometry(root, completeOpen);

  if (!options.reducedMotion) {
    surface.style.transformOrigin = 'center';
    await animate(surface, [
      { transform: 'scale(1)' },
      { transform: 'scale(0.97)', offset: 0.5 },
      { transform: 'scale(1)' },
    ], { duration: 70, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'forwards' });
  }
  if (!isCurrent(token)) return;
  surface.style.transformOrigin = 'top left';

  const dx = pageTarget.left - (sourceRect.left - rootRect.left);
  const dy = pageTarget.top - (sourceRect.top - rootRect.top);
  const sx = pageTarget.width / sourceRect.width;
  const sy = pageTarget.height / sourceRect.height;
  const morph = animate(surface, [
    { transform: 'translate(0px, 0px) scale(1, 1)', borderRadius: launch.borderRadius },
    { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, borderRadius: '0px' },
  ], { duration: OPEN_DURATION, easing: OPEN_EASING, fill: 'forwards' });
  const unclipping = animate(surface, [
    { clipPath: insetsToClipPath(launch.clipInsets) },
    { clipPath: 'inset(0px)' },
  ], { duration: 180, easing: OPEN_EASING, fill: 'forwards' });
  const revealDestinationBackground = animate(surface.querySelector('.home-card-transition-fill')!, [
    { opacity: 0 },
    { opacity: 1 },
  ], { duration: 210, delay: 130, easing: 'ease-out', fill: 'forwards' });
  const revealDestination = animate(targetShell, [{ opacity: 0 }, { opacity: 1 }], {
    duration: 220,
    delay: 180,
    easing: OPEN_EASING,
    fill: 'forwards',
  });
  const revealScreenParts = [...targetShell.querySelectorAll<HTMLElement>('.subpage-header, .screen-content, .bottom-nav')]
    .map((element) => animate(element, [
      { opacity: 0, transform: 'translateY(10px)' },
      { opacity: 1, transform: 'translateY(0px)' },
    ], { duration: 210, delay: 180, easing: OPEN_EASING, fill: 'both' }));
  const dissolveSurface = animate(surface, [{ opacity: 1 }, { opacity: 0 }], {
    duration: 130,
    delay: 230,
    easing: 'ease-out',
    fill: 'forwards',
  });
  await Promise.allSettled([
    morph,
    unclipping,
    revealDestinationBackground,
    revealDestination,
    dissolveSurface,

    ...revealScreenParts,
  ]);
  if (!isCurrent(token)) return;
  completeOpen();
}

export async function animateHomeCardClose(options: {
  root: HTMLElement;
  route: HomeCardRoute;
  currentShell: HTMLElement;
  homeShell: HTMLElement;
  homeScrollTop: number;
  usefulScrollLeft: number;
  targetCard: HTMLButtonElement;
  reducedMotion: boolean;
  onComplete: () => void;
}): Promise<boolean> {
  cancelHomeCardTransition();
  const token = ++transitionToken;
  activeTransition = { route: options.route, target: 'home', token };
  const { root, currentShell, homeShell, targetCard } = options;
  const rootRect = root.getBoundingClientRect();

  homeShell.classList.add('home-card-transition-underlay');
  currentShell.classList.add('home-card-transition-current');
  root.append(homeShell);
  const homeContent = homeShell.querySelector<HTMLElement>('.screen-content');
  const usefulCarousel = homeShell.querySelector<HTMLElement>('.useful-grid');
  if (homeContent) homeContent.scrollTop = options.homeScrollTop;
  if (usefulCarousel) usefulCarousel.scrollLeft = options.usefulScrollLeft;
  void homeShell.getBoundingClientRect();
  const visibleRect = getFullyVisibleCardRect(root, targetCard);
  activeNodes.push(homeShell, currentShell);

  if (!visibleRect || options.reducedMotion || typeof targetCard.animate !== 'function') {
    const fadeOut = animate(currentShell, [{ opacity: 1 }, { opacity: 0 }], {
      duration: options.reducedMotion ? 120 : 170,
      easing: 'ease-out',
      fill: 'forwards',
    });
    const fadeIn = animate(homeShell, [{ opacity: 0 }, { opacity: 1 }], {
      duration: options.reducedMotion ? 120 : 170,
      easing: 'ease-out',
      fill: 'forwards',
    });
    await Promise.allSettled([fadeOut, fadeIn]);
    if (!isCurrent(token)) return true;
    currentShell.remove();
    homeShell.classList.remove('home-card-transition-underlay');
    currentShell.classList.remove('home-card-transition-current');
    options.onComplete();
    finish(token);
    return true;
  }

  const cardRect = visibleRect;
  const targetStyles = window.getComputedStyle(targetCard);
  hiddenReturnCard = { element: targetCard, visibility: targetCard.style.visibility };
  targetCard.style.visibility = 'hidden';

  const panel = document.createElement('div');
  panel.className = 'home-card-transition-layer home-card-transition-layer--closing';
  const startRect = rectInsideRoot(currentShell.getBoundingClientRect(), rootRect);
  const endRect = rectInsideRoot(cardRect, rootRect);
  positionLayer(panel, startRect);
  panel.style.borderRadius = '0px';
  const screenFill = createFill({
    backgroundColor: window.getComputedStyle(currentShell).backgroundColor,
    backgroundImage: window.getComputedStyle(currentShell).backgroundImage,
  });
  const cardFill = createFill({
    backgroundColor: targetStyles.backgroundColor,
    backgroundImage: targetStyles.backgroundImage,
  });
  cardFill.classList.add('home-card-transition-fill--card');
  panel.append(screenFill, cardFill);

  const cardReplica = targetCard.cloneNode(true) as HTMLButtonElement;
  sanitizeCardReplica(cardReplica);
  cardReplica.classList.add('home-card-transition-card-replica');
  positionLayer(cardReplica, endRect);
  cardReplica.style.borderRadius = targetStyles.borderTopLeftRadius;
  cardReplica.style.opacity = '0';
  root.append(panel, cardReplica);
  activeNodes.push(panel, cardReplica);

  const completeClose = (): void => {
    if (!isCurrent(token)) return;
    currentShell.remove();
    panel.remove();
    cardReplica.remove();
    targetCard.style.visibility = hiddenReturnCard?.visibility ?? '';
    hiddenReturnCard = null;
    homeShell.classList.remove('home-card-transition-underlay');
    currentShell.classList.remove('home-card-transition-current');
    options.onComplete();
    finish(token);
  };
  watchGeometry(root, completeClose);

  const dx = endRect.left - startRect.left;
  const dy = endRect.top - startRect.top;
  const sx = endRect.width / startRect.width;
  const sy = endRect.height / startRect.height;
  const shrink = animate(panel, [
    { transform: 'translate(0px, 0px) scale(1, 1)', borderRadius: '0px' },
    { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, borderRadius: targetStyles.borderTopLeftRadius },
  ], { duration: CLOSE_DURATION, easing: CLOSE_EASING, fill: 'forwards' });
  const coverScreen = animate(screenFill, [{ opacity: 0 }, { opacity: 1 }], {
    duration: 130,
    easing: 'ease-out',
    fill: 'forwards',
  });
  const transitionToCardBackground = animate(cardFill, [{ opacity: 0 }, { opacity: 1 }], {
    duration: 120,
    delay: 205,
    easing: 'ease-out',
    fill: 'forwards',
  });
  const fadeScreenContents = animate(currentShell, [{ opacity: 1 }, { opacity: 0 }], {
    duration: 130,
    easing: 'ease-out',
    fill: 'forwards',
  });
  const revealCard = animate(cardReplica, [{ opacity: 0 }, { opacity: 1 }], {
    duration: 100,
    delay: 250,
    easing: 'ease-out',
    fill: 'forwards',
  });
  await Promise.allSettled([shrink, coverScreen, transitionToCardBackground, fadeScreenContents, revealCard]);
  if (!isCurrent(token)) return true;
  completeClose();
  return true;
}

export function cancelHomeCardTransition(): void {
  transitionToken += 1;
  stopWatchingGeometry();
  for (const animation of activeAnimations) animation.cancel();
  activeAnimations = [];
  for (const node of activeNodes) {
    if (node.classList.contains('home-card-transition-underlay')) {
      node.classList.remove('home-card-transition-underlay');
      node.remove();
    }
    node.classList.remove('home-card-transition-current');
    if (node.classList.contains('home-card-route-screen--entering')) {
      node.classList.remove('home-card-route-screen--entering');
      node.style.opacity = '';
    }
    if (node.classList.contains('home-card-transition-layer') || node.classList.contains('home-card-transition-card-replica')) {
      node.remove();
    }
  }
  activeNodes = [];
  if (hiddenReturnCard) {
    hiddenReturnCard.element.style.visibility = hiddenReturnCard.visibility;
    hiddenReturnCard = null;
  }
  activeTransition = null;
}

function createCardSurface(launch: HomeCardLaunch, rootRect: DOMRect): HTMLDivElement {
  const surface = document.createElement('div');
  surface.className = 'home-card-transition-layer home-card-transition-layer--opening';
  surface.setAttribute('aria-hidden', 'true');
  positionLayer(surface, {
    left: launch.rect.left - rootRect.left,
    top: launch.rect.top - rootRect.top,
    width: launch.rect.width,
    height: launch.rect.height,
  });
  surface.style.borderRadius = launch.borderRadius;
  surface.style.backgroundColor = '#ffffff';
  surface.style.backgroundImage = 'none';
  return surface;
}
function sanitizeCardReplica(card: HTMLButtonElement): void {
  card.removeAttribute('id');
  card.removeAttribute('data-route');
  card.removeAttribute('aria-current');
  card.removeAttribute('aria-pressed');
  card.setAttribute('aria-hidden', 'true');
  card.tabIndex = -1;
  card.disabled = true;
  card.style.width = '100%';
  card.style.height = '100%';
  card.style.minHeight = '0';
  card.style.maxHeight = 'none';
  card.style.aspectRatio = 'auto';
  card.style.margin = '0';
  card.style.pointerEvents = 'none';
  card.style.animation = 'none';
}

function createFill(background: { backgroundColor: string; backgroundImage: string }): HTMLDivElement {
  const fill = document.createElement('div');
  fill.className = 'home-card-transition-fill';
  fill.style.backgroundColor = background.backgroundColor;
  fill.style.backgroundImage = background.backgroundImage;
  fill.style.opacity = '0';
  return fill;
}

function positionLayer(element: HTMLElement, rect: { left: number; top: number; width: number; height: number }): void {
  element.style.left = `${rect.left}px`;
  element.style.top = `${rect.top}px`;
  element.style.width = `${rect.width}px`;
  element.style.height = `${rect.height}px`;
}

function rectInsideRoot(rect: DOMRect, rootRect: DOMRect): DOMRect {
  return new DOMRect(rect.left - rootRect.left, rect.top - rootRect.top, rect.width, rect.height);
}

function insetsToClipPath(insets: readonly [number, number, number, number]): string {
  return `inset(${insets[0]}px ${insets[1]}px ${insets[2]}px ${insets[3]}px)`;
}

function getFullyVisibleCardRect(root: HTMLElement, card: HTMLElement): DOMRect | null {
  const rootRect = root.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const carousel = card.closest<HTMLElement>('.useful-grid');
  const clipRect = carousel?.getBoundingClientRect();
  if (!clipRect || cardRect.width < 1 || cardRect.height < 1) return null;

  const left = Math.max(rootRect.left, clipRect.left);
  const right = Math.min(rootRect.right, clipRect.right);
  const top = Math.max(rootRect.top, clipRect.top);
  const bottom = Math.min(rootRect.bottom, clipRect.bottom);
  const visibleLeft = Math.max(cardRect.left, left);
  const visibleRight = Math.min(cardRect.right, right);
  const visibleTop = Math.max(cardRect.top, top);
  const visibleBottom = Math.min(cardRect.bottom, bottom);
  const visibleArea = Math.max(0, visibleRight - visibleLeft) * Math.max(0, visibleBottom - visibleTop);
  const cardArea = cardRect.width * cardRect.height;

  if (visibleArea < cardArea * 0.96) return null;
  return cardRect;
}

function animate(element: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions): Promise<void> {
  if (typeof (element as HTMLElement).animate !== 'function') return Promise.resolve();
  const animation = (element as HTMLElement).animate(keyframes, options);
  activeAnimations.push(animation);
  return animation.finished.then(() => undefined, () => undefined);
}



function isCurrent(token: number): boolean {
  return activeTransition?.token === token;
}

function watchGeometry(root: HTMLElement, onChange: () => void): void {
  stopWatchingGeometry();
  const initialWidth = root.clientWidth;
  const initialHeight = root.clientHeight;
  activeResizeHandler = onChange;
  window.addEventListener('resize', onChange, { passive: true, once: true });
  if (typeof ResizeObserver !== 'undefined') {
    activeResizeObserver = new ResizeObserver((entries) => {
      const size = entries[0]?.contentRect;
      if (!size) return;
      if (Math.abs(size.width - initialWidth) > 1 || Math.abs(size.height - initialHeight) > 1) onChange();
    });
    activeResizeObserver.observe(root);
  }
}

function stopWatchingGeometry(): void {
  if (activeResizeHandler) window.removeEventListener('resize', activeResizeHandler);
  activeResizeHandler = null;
  activeResizeObserver?.disconnect();
  activeResizeObserver = null;
}

function finish(token: number): void {
  if (!isCurrent(token)) return;
  stopWatchingGeometry();
  activeTransition = null;
  for (const animation of activeAnimations) animation.cancel();
  activeAnimations = [];
  activeNodes = [];
}
