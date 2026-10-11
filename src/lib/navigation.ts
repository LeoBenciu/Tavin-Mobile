import type { Href, ImperativeRouter } from 'expo-router';

/**
 * Close a screen and land on its natural parent: pops back to `parent` when
 * it's underneath, or replaces this screen with it when the screen was opened
 * directly (a notification tap or a link), where there is nothing to go back to.
 */
export function closeTo(router: ImperativeRouter, parent: Href): void {
  router.dismissTo(parent);
}
