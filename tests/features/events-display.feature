@critical
Feature: Events display and filtering
  Events should show only future events and update dynamically

  Background:
    Given the website is running

  Scenario: Homepage shows upcoming events only
    When I visit "/"
    Then I should see the events section
    And all displayed events should have future dates

  Scenario: Events page shows upcoming events
    When I visit "/events"
    Then I should see the events section
    And all displayed events should have future dates

  Scenario: Events API returns events sorted by date
    When I make a GET request to "/api/events"
    Then the response status should be 200
    And the events response should contain an array
    And the events response should be sorted by date ascending
