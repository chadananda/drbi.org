// Shared auth-popover helpers. Sign-in lives in a navbar popover (#account-menu), not a page.
import { expect } from '@playwright/test';

// Reveal the sign-in popover: click #account-btn if #account-menu is still hidden.
export async function openAccountMenu(page) {
  const menu = page.locator('#account-menu');
  const btn = page.locator('#account-btn');
  await btn.first().waitFor({ timeout: 10000 });
  // Open if the menu is absent from layout or still carries the `hidden` class.
  const isHidden = await menu.first().evaluate(el => el.classList.contains('hidden')).catch(() => true);
  if (isHidden || !(await menu.first().isVisible().catch(() => false))) {
    await btn.first().click();
  }
  await expect(menu.first()).toBeVisible({ timeout: 5000 });
}

// Open the break-glass (superadmin password) <details> inside the popover.
export async function openBreakGlass(page) {
  const summary = page.locator('#account-menu details summary');
  if (await summary.count() > 0) {
    const isOpen = await summary.first().evaluate(el => el.parentElement.open).catch(() => false);
    if (!isOpen) await summary.first().click();
  }
}
