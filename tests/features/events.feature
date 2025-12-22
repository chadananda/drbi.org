Feature: Events Page
  As a visitor
  I want to view upcoming events
  So that I can plan my attendance at DRBI activities

  Background:
    Given the website is running

  @smoke @critical
  Scenario: View all events page
    When I visit the events page
    Then I should see the page title containing "Events"
    And I should see a list of events
    And each event should have a title
    And each event should have a date

  Scenario: View single event details
    Given there is at least one visible event
    When I visit the events page
    And I click on the first event
    Then I should see the event details page
    And I should see the event title
    And I should see the event description

  Scenario: Events are sorted by date
    When I visit the events page
    Then events should be displayed in chronological order
