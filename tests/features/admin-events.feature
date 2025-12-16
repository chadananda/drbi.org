Feature: Admin Event Management
  As an administrator
  I want to manage events in the admin panel
  So that I can control what events are shown to visitors

  Background:
    Given the website is running
    And I am logged in as an admin

  Scenario: View events list in admin
    When I visit the admin events page
    Then I should see a list of all events
    And each event should show its visibility status
    And I should see edit buttons for each event
    And I should see hide/show buttons for each event

  Scenario: Hidden events are visually distinct
    Given there is a hidden event
    When I visit the admin events page
    Then hidden events should have reduced opacity
    And hidden events should have an orange border
    And hidden events should show "Show" button instead of "Hide"

  Scenario: Toggle event visibility via button
    Given there is a visible event
    When I visit the admin events page
    And I click the hide button for an event
    Then the event should become hidden
    And the button should change to "Show"
    And the event card should update its visual state

  Scenario: Edit event visibility via form
    Given there is an event
    When I visit the admin events page
    And I click the edit button for an event
    Then I should see the event edit form
    And I should see a visibility checkbox
    When I uncheck the visibility checkbox
    And I save the event
    Then the event visibility should be updated to hidden

  Scenario: Event visibility reflects on homepage
    Given there is a visible event
    When I toggle the event to hidden in admin
    And I visit the homepage
    Then the hidden event should not be displayed

  Scenario: Create new event
    When I visit the admin events page
    And I click the create new event button
    Then I should see the event creation form
    And the form should have required fields

  Scenario: Delete event
    Given there is an event
    When I visit the admin events page
    And I click the delete button for an event
    And I confirm the deletion
    Then the event should be removed from the list
