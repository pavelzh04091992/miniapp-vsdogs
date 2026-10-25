import type { AppRoute } from '../app';

export type AppHistoryState = Record<string, unknown>;

export function getNavigationDepth(historyState: AppHistoryState): number {
  const depth = historyState.appNavigationDepth;
  return Number.isSafeInteger(depth) && Number(depth) >= 0 ? Number(depth) : 0;
}

export function createForwardHistoryState(
  historyState: AppHistoryState,
  currentRoute: AppRoute,
  nextRoute: AppRoute,
): AppHistoryState {
  const currentDepth = historyState.appRoute === currentRoute
    ? getNavigationDepth(historyState)
    : 0;
  const nextState: AppHistoryState = {
    ...historyState,
    appRoute: nextRoute,
    appParentRoute: currentRoute,
    appNavigationDepth: currentDepth + 1,
  };

  delete nextState.feedbackModal;
  return nextState;
}

export function canUseBrowserBack(
  historyState: AppHistoryState,
  currentRoute: AppRoute,
  allowedParentRoutes: AppRoute | readonly AppRoute[],
): boolean {
  const parentRoutes: readonly AppRoute[] = Array.isArray(allowedParentRoutes)
    ? allowedParentRoutes
    : [allowedParentRoutes as AppRoute];

  return historyState.appRoute === currentRoute
    && parentRoutes.includes(historyState.appParentRoute as AppRoute)
    && getNavigationDepth(historyState) > 0;
}

export function createFallbackHistoryState(
  historyState: AppHistoryState,
  route: AppRoute,
): AppHistoryState {
  const nextState: AppHistoryState = {
    ...historyState,
    appRoute: route,
    appNavigationDepth: 0,
  };

  delete nextState.feedbackModal;
  delete nextState.appParentRoute;
  return nextState;
}

export function normalizeInitialHistoryState(
  historyState: AppHistoryState,
  currentRoute: AppRoute,
): AppHistoryState {
  if (
    historyState.appRoute === currentRoute
    && Number.isSafeInteger(historyState.appNavigationDepth)
    && Number(historyState.appNavigationDepth) >= 0
  ) {
    return historyState;
  }

  return createFallbackHistoryState(historyState, currentRoute);
}
