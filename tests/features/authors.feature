Feature: Authors
  As a visitor
  I want to see the content authors
  So that I can learn about who contributes

  Background:
    Given the website is running

  @smoke
  Scenario: View authors index
    When I visit "/authors"
    Then I should see the page title containing "Authors"
    And I should see author cards
    And each author card should have a name and image

  Scenario: Navigate to an author page
    When I visit "/authors"
    And I click on the first author card
    Then I should see the author's profile
    And I should see articles by that author
