Feature: Categories
  As a visitor
  I want to browse content by category
  So that I can find topics I'm interested in

  Background:
    Given the website is running

  @smoke
  Scenario: View categories index
    When I visit "/categories"
    Then I should see the page title containing "Categories"
    And I should see category cards
    And each category card should have a name

  Scenario: Navigate to a category page
    When I visit "/categories"
    And I click on the first category
    Then I should see articles filtered by that category
