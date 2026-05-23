Feature: Homepage Extended
  As a visitor
  I want to interact with all homepage sections
  So that I can fully explore DRBI offerings

  Background:
    Given the website is running

  Scenario: Donate button is visible
    When I visit the homepage
    Then I should see a donate button or contribute link

  Scenario: Category cards link to category pages
    When I visit the homepage
    And I scroll to the categories section
    Then each category should link to a valid page

  Scenario: Footer has essential links
    When I visit the homepage
    Then the footer should contain a link to "About"
    And the footer should contain a link to "Privacy"
    And the footer should contain a link to "Events"

  Scenario: Page loads without console errors
    When I visit the homepage
    Then there should be no JavaScript errors in the console

  Scenario: Mission and vision sections display
    When I visit the homepage
    Then I should see the mission statement
    And I should see the vision statement
