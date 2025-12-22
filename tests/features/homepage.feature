Feature: Homepage
  As a visitor
  I want to see the homepage with upcoming events
  So that I can learn about DRBI and its activities

  Background:
    Given the website is running

  @smoke @critical
  Scenario: View homepage
    When I visit the homepage
    Then I should see the page title containing "Desert Rose"
    And I should see the hero section
    And I should see the categories section
    And I should see the video player
    And I should see the "Upcoming DRBI Events" section

  Scenario: Events display correctly
    When I visit the homepage
    Then I should see the events calendar
    And visible events should be displayed
    And hidden events should not be displayed

  Scenario: Newsletter signup link
    When I visit the homepage
    Then I should see a newsletter signup link
    And the newsletter link should open in a new tab
