Feature: Events Extended
  As a visitor
  I want to interact with events in detail
  So that I can register and learn about upcoming activities

  Background:
    Given the website is running

  Scenario: Events have registration links when available
    When I visit the events page
    Then events with registration URLs should have register buttons

  Scenario: Event cards show teacher images
    When I visit the events page
    Then event cards should display teacher or event images

  Scenario: Events page has proper SEO metadata
    When I visit the events page
    Then the page should have a meta description
    And the page title should contain "Events"

  Scenario: Past events are not shown by default
    When I visit the events page
    Then displayed events should have future or current dates
