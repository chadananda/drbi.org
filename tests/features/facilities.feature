Feature: Facilities and Rentals Page
  As a visitor
  I want to learn about DRBI facilities available for rent
  So that I can plan events or retreats at the property

  Background:
    Given the website is running

  @smoke
  Scenario: Facilities page loads with title and navigation
    When I visit "/facilities-and-rentals"
    Then I should see the page title containing "Facilit"
    And I should see the main navigation
    And I should see the footer section

  Scenario: Facilities page shows a heading
    When I visit "/facilities-and-rentals"
    Then I should see a heading containing "Facilit"

  Scenario: Facilities page does not crash
    When I visit "/facilities-and-rentals"
    Then the page should not show an error
    And the page should have a meta description
