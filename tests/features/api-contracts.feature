@critical
Feature: API endpoint contracts
  All API endpoints should return consistent, well-shaped responses

  Background:
    Given the website is running

  Scenario: Events API returns valid JSON array
    When I make a GET request to "/api/events"
    Then the response status should be 200
    And the response should be valid JSON
    And the events response should contain an array

  Scenario: CMS status API is healthy
    When I make a GET request to "/api/cms-status"
    Then the response status should be 200
    And the response should contain environment info

  @smoke
  Scenario: Validate API accepts POST
    When I make a POST request to "/api/validate" with sample content
    Then the response status should be 200
    And the response should contain a valid field

  Scenario: Unauthenticated access to admin API is rejected
    When I make a GET request to "/admin"
    Then I should be redirected to login
