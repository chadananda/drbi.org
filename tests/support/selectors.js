/**
 * Centralized selectors for Cucumber tests
 * Uses data-testid where available, falls back to semantic selectors
 */
export const selectors = {
  // Navigation
  navbar: 'nav, [role="navigation"]',
  mobileMenuToggle: '#astronav-menu, button[aria-label="Toggle Menu"], [data-testid="mobile-menu-toggle"]',
  mobileNav: '[data-testid="mobile-nav"], .astronav-items, [class*="mobile-nav"]',
  navLinks: 'nav a, [role="navigation"] a',

  // Homepage sections
  heroSection: '[data-testid="hero"], #superhero, .superhero',
  categoriesSection: '[data-testid="categories"], #programs, #drbicategories, .drbicategories, .category-card, .event-calendar',
  videoPlayer: '[data-testid="video-player"], video, iframe[src*="youtube"], .video-player-thumbnail',
  eventsSection: '[data-testid="events-section"], .event-calendar',
  newsletterLink: 'a[href*="eepurl"], a[href*="newsletter"]',

  // Events
  eventsCalendar: '[data-testid="events-calendar"], .event-calendar',
  eventCard: '[data-testid="event-card"], [data-event-start], .event-card',
  eventTitle: '[data-testid="event-title"], .event-title, h3',
  eventDate: '[data-testid="event-date"], time, .event-date, [class*="date"]',
  eventLink: 'a[href*="/events/"]',

  // Admin - Auth (navbar popover — click #account-btn to reveal #account-menu)
  accountButton: '#account-btn',
  accountMenu: '#account-menu',
  loginForm: '#nav-magic-form, #account-menu form',
  usernameField: '#nav-magic-email, #account-menu input[type="email"]',
  passwordField: '#nav-pass-form input[type="password"], #account-menu input[type="password"]',
  submitButton: '#account-menu button[type="submit"]',
  errorMessage: '#nav-auth-msg, [role="alert"]',
  logoutButton: '#signout-btn, a[href*="logout"]',
  // Break-glass password form (inside popover <details>)
  breakGlassSummary: '#account-menu details summary',
  breakGlassEmailField: '#nav-pass-form input[name="email"]',
  breakGlassPasswordField: '#nav-pass-form input[name="password"]',
  breakGlassSubmit: '#nav-pass-form button[type="submit"]',

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
