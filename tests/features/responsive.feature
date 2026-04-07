Feature: Responsive Design
  As a mobile user
  I want the site to work on all screen sizes
  So that I can browse from any device

  Background:
    Given the website is running

  @mobile
  Scenario: Homepage is responsive
    Given I am using a mobile viewport
    When I visit the homepage
    Then I should see a mobile menu toggle
    And the page content should not overflow horizontally

  @mobile
  Scenario: Events page is responsive
    Given I am using a mobile viewport
    When I visit "/events"
    Then the page content should not overflow horizontally

  @mobile
  Scenario: Contact form is responsive
    Given I am using a mobile viewport
    When I visit "/contact-us"
    Then the contact form should be usable
    And inputs should be full width

  @tablet
  Scenario: Homepage on tablet
    Given I am using a tablet viewport
    When I visit the homepage
    Then the layout should adapt to tablet width
