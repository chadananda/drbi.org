Feature: KURE Radio Section
  As a visitor
  I want to learn about KURE 106.1 FM
  So that I can tune in or learn about the community radio station

  Background:
    Given the website is running

  @smoke
  Scenario: Radio page loads with title and navigation
    When I visit "/radio"
    Then I should see the page title containing "KURE"
    And I should see the main navigation
    And I should see the footer section

  Scenario: Radio page shows a heading
    When I visit "/radio"
    Then I should see a heading containing "KURE"

  Scenario: Radio page does not crash
    When I visit "/radio"
    Then the page should not show an error
    And the page should have a meta description
