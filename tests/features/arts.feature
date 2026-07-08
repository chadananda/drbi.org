Feature: Arts Section
  As a visitor
  I want to explore fine arts content at DRBI
  So that I can learn about artistic programs and artists

  Background:
    Given the website is running

  @smoke
  Scenario: Arts index loads with title and navigation
    When I visit "/arts"
    Then I should see the page title containing "Arts"
    And I should see the main navigation
    And I should see the footer section

  Scenario: Arts index shows a heading
    When I visit "/arts"
    Then I should see a heading containing "Arts"

  Scenario: Arts article - Duffy Sheridan award page loads
    When I visit "/arts/duffy-awarded"
    Then the page should have a title
    And the page should not show an error
    And I should see the footer section

  Scenario: Arts article - iamHUMAN page loads
    When I visit "/arts/i-am-human"
    Then the page should have a title
    And the page should not show an error
    And I should see the footer section

  Scenario: Arts article - Write Life page loads
    When I visit "/arts/write-life"
    Then the page should have a title
    And the page should not show an error
    And I should see the footer section
