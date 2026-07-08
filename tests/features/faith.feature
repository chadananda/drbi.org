Feature: The Bahai Faith Page
  As a visitor
  I want to learn about the Bahai Faith
  So that I can understand the spiritual foundation of DRBI

  Background:
    Given the website is running

  @smoke
  Scenario: Bahai Faith page loads with title and navigation
    When I visit "/the-bahai-faith"
    Then I should see the page title containing "Faith"
    And I should see the main navigation
    And I should see the footer section

  Scenario: Bahai Faith page shows a heading
    When I visit "/the-bahai-faith"
    Then I should see a heading containing "Faith"

  Scenario: Bahai Faith page does not crash
    When I visit "/the-bahai-faith"
    Then the page should not show an error
    And the page should have a meta description
