Feature: DRBI History Section
  As a visitor
  I want to learn about the history of Desert Rose Bahai Institute
  So that I can understand its founding and key figures

  Background:
    Given the website is running

  @smoke
  Scenario: History index loads with title and navigation
    When I visit "/history"
    Then I should see the page title containing "History"
    And I should see the main navigation
    And I should see the footer section

  Scenario: History index shows a heading
    When I visit "/history"
    Then I should see a heading containing "History"

  Scenario: William Sears biography page loads
    When I visit "/history/william-sears"
    Then the page should have a title
    And the page should not show an error
    And I should see the footer section

  Scenario: Marguerite Sears biography page loads
    When I visit "/history/marguerite-sears"
    Then the page should have a title
    And the page should not show an error
    And I should see the footer section

  Scenario: Eleanor Hadden biography page loads
    When I visit "/history/eleanor-hadden"
    Then the page should have a title
    And the page should not show an error
    And I should see the footer section

  Scenario: David Hadden biography page loads
    When I visit "/history/david-hadden"
    Then the page should have a title
    And the page should not show an error
    And I should see the footer section

  Scenario: Shuallah Alai biography page loads
    When I visit "/history/shuallah-alai"
    Then the page should have a title
    And the page should not show an error
    And I should see the footer section

  Scenario: Duffy Jeanne Sheridan biography page loads
    When I visit "/history/duffy-jeanne-sheridan"
    Then the page should have a title
    And the page should not show an error
    And I should see the footer section
