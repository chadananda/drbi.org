Feature: Contribute Page
  As a supporter
  I want to learn how to contribute to DRBI
  So that I can support the organization

  Background:
    Given the website is running

  @smoke
  Scenario: Contribute page exists and loads
    When I visit "/contribute"
    Then the page should load without errors
    And I should see the main navigation
    And I should see the footer section
