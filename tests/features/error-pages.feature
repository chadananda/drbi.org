Feature: Error Pages
  As a visitor
  I want to see helpful error pages
  So that I know when content is not found

  Background:
    Given the website is running

  @smoke
  Scenario: 404 page for unknown routes
    When I visit "/this-page-does-not-exist"
    Then I should see a 404 error indication
    And I should see navigation to return home

  Scenario: 404 page has proper structure
    When I visit "/nonexistent-page-xyz"
    Then I should see the main navigation
    And I should see the footer section
