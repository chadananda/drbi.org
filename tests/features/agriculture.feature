Feature: Agriculture Section
  As a visitor
  I want to learn about DRBI agriculture programs
  So that I can understand sustainable farming initiatives

  Background:
    Given the website is running

  @smoke
  Scenario: Agriculture index loads with title and navigation
    When I visit "/agriculture"
    Then I should see the page title containing "Agriculture"
    And I should see the main navigation
    And I should see the footer section

  Scenario: Agriculture index shows a heading
    When I visit "/agriculture"
    Then I should see a heading containing "Agriculture"

  Scenario: Agriculture article - Greening Sonora page loads
    When I visit "/agriculture/greening-sonora"
    Then the page should have a title
    And the page should not show an error
    And I should see the footer section
