Feature: Thematic section pages
  Each thematic section should render with proper structure

  Background:
    Given the website is running

  Scenario: Agriculture section has content
    When I visit "/agriculture"
    Then I should see a heading containing "Agriculture"
    And the page should have a meta description

  Scenario: Arts section has content
    When I visit "/arts"
    Then I should see a heading containing "Arts"
    And the page should have a meta description

  Scenario: History section has content
    When I visit "/history"
    Then I should see a heading containing "History"
    And the page should have a meta description

  Scenario: Learning section has content
    When I visit "/learning"
    Then I should see a heading containing "Learning"
    And the page should have a meta description

  Scenario: Radio section has content
    When I visit "/radio"
    Then I should see a heading containing "Radio"
    And the page should have a meta description
