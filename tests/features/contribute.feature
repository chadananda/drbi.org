Feature: Contribute Page
  As a supporter
  I want to learn how to contribute to DRBI
  So that I can donate, volunteer, or sponsor programs

  Background:
    Given the website is running

  @smoke
  Scenario: Contribute page loads with title and navigation
    When I visit "/contribute"
    Then I should see the page title containing "Contribute"
    And I should see the main navigation
    And I should see the footer section

  Scenario: Contribute page shows a heading
    When I visit "/contribute"
    Then I should see a heading containing "Contribute"

  Scenario: Contribute page does not crash
    When I visit "/contribute"
    Then the page should not show an error
    And the page should have a meta description
