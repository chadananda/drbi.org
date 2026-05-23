Feature: Accessibility
  As a user with accessibility needs
  I want the site to follow accessibility best practices
  So that I can navigate and use the site effectively

  Background:
    Given the website is running

  @a11y @critical
  Scenario: All pages have skip navigation link
    When I visit the homepage
    Then the page should have a skip-to-content link or proper heading hierarchy

  @a11y
  Scenario: Images have alt text on homepage
    When I visit the homepage
    Then all images should have alt attributes

  @a11y
  Scenario: Forms have labels on contact page
    When I visit "/contact-us"
    Then all form inputs should have associated labels or placeholders

  @a11y
  Scenario: Color contrast is sufficient on login page
    When I visit "/login"
    Then form labels should be readable

  @a11y
  Scenario: Navigation is keyboard accessible
    When I visit the homepage
    Then the navigation links should be focusable
