import { test, expect } from '@playwright/test';

test.describe('Admin Authentication', () => {
  test('should redirect to login when accessing admin without auth', async ({ page }) => {
    await page.goto('/admin');

    // Should be redirected to login
    await expect(page.url()).toContain('/login');
  });

  test('should display login form', async ({ page }) => {
    await page.goto('/login');

    // Check for login form elements
    const form = page.locator('form');
    await expect(form).toBeVisible();

    // Username/email field
    const usernameField = page.locator('input[type="text"], input[type="email"], input[name*="user"], input[name*="email"]');
    await expect(usernameField.first()).toBeVisible();

    // Password field
    const passwordField = page.locator('input[type="password"]');
    await expect(passwordField).toBeVisible();

    // Submit button
    const submitButton = page.locator('button[type="submit"], input[type="submit"]');
    await expect(submitButton.first()).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill in invalid credentials
    const usernameField = page.locator('input[type="text"], input[type="email"], input[name*="user"], input[name*="email"]').first();
    const passwordField = page.locator('input[type="password"]');

    await usernameField.fill('invalid@test.com');
    await passwordField.fill('wrongpassword');

    // Submit form
    const submitButton = page.locator('button[type="submit"], input[type="submit"]').first();
    await submitButton.click();

    // Should show error or remain on login page
    await page.waitForTimeout(1000);

    // Either error message appears or we stay on login page
    const errorMessage = page.locator('[class*="error"], [class*="alert"], [role="alert"]');
    const onLoginPage = page.url().includes('/login');

    const hasError = await errorMessage.count() > 0;
    expect(hasError || onLoginPage).toBeTruthy();
  });

  test('login page should be accessible directly', async ({ page }) => {
    const response = await page.goto('/login');
    expect(response.status()).toBeLessThan(400);
  });
});

test.describe('Admin Logout', () => {
  // This test requires authentication fixture - placeholder for when auth is configured
  test.skip('should have logout functionality', async ({ page }) => {
    // This would require a logged-in state
    // Implement with auth fixture when test credentials are available
  });
});
