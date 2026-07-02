Feature: Memorial Page
  As a visitor
  I want to view the memorial section
  So that I can learn about those interred at DRBI

  Background:
    Given the website is running

  @smoke
  Scenario: Memorial page title loads
    When I visit "/memorial"
    Then I should see the page title containing "Desert Rose Memorial Cemetery"

  @known-bug
  Scenario: View memorial entries
    When I visit "/memorial"
    Then I should see the page title containing "Desert Rose Memorial Cemetery"
    And I should see memorial entries
    And each entry should have a name and image

  Scenario: Memorial page has links to belief articles
    When I visit "/memorial"
    Then I should see links about Bahá'í beliefs on death
