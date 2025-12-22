/**
 * Centralized selectors for Cucumber tests
 * Uses data-testid where available, falls back to semantic selectors
 */
export const selectors = {
  // Navigation
  navbar: 'nav, [role="navigation"]',
  mobileMenuToggle: '[data-testid="mobile-menu-toggle"], button[aria-label*="menu"], .mobile-menu-toggle',
  mobileNav: '[data-testid="mobile-nav"], [class*="mobile-nav"], [class*="mobile-menu"]',
  navLinks: 'nav a, [role="navigation"] a',

  // Homepage sections
  heroSection: '[data-testid="hero"], #superhero, .superhero',
  categoriesSection: '[data-testid="categories"], #drbicategories, .drbicategories, .category-card',
  videoPlayer: '[data-testid="video-player"], video, iframe[src*="youtube"]',
  eventsSection: '[data-testid="events-section"], .event-calendar',
  newsletterLink: 'a[href*="eepurl"], a[href*="newsletter"]',

  // Events
  eventsCalendar: '[data-testid="events-calendar"], .event-calendar',
  eventCard: '[data-testid="event-card"], [data-event-start], .event-card',
  eventTitle: '[data-testid="event-title"], .event-title, h3',
  eventDate: '[data-testid="event-date"], time, .event-date, [class*="date"]',
  eventLink: 'a[href*="/events/"]',

  // Admin - Auth
  loginForm: '[data-testid="login-form"], form',
  usernameField: '[data-testid="username"], input[name="username"], input[type="text"], input[type="email"]',
  passwordField: '[data-testid="password"], input[name="password"], input[type="password"]',
  submitButton: '[data-testid="submit"], button[type="submit"]',
  errorMessage: '[data-testid="error"], [role="alert"], [class*="error"]',
  logoutButton: '[data-testid="logout"], a[href*="logout"], button:has-text("Logout")',

  // Admin - Events
  adminEventCard: '[data-testid="admin-event-card"], .event-card',
  toggleVisibility: '[data-testid="toggle-visibility"], .toggle-visibility, button:has-text("Hide"), button:has-text("Show")',
  editButton: '[data-testid="edit-button"], a:has-text("Edit"), .edit-button',
  deleteButton: '[data-testid="delete-button"], .delete-event, button:has-text("Delete")',
  visibilityCheckbox: '[data-testid="visibility-checkbox"], input[name="visible"], input[type="checkbox"]',
  hiddenEventCard: '.event-card.opacity-60, [class*="opacity-60"]',

  // Footer
  footer: 'footer',
};

export default selectors;
