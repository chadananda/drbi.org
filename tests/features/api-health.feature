Feature: API Health
  As a developer
  I want API endpoints to respond correctly
  So that the application functions properly

  Background:
    Given the website is running

  @smoke @critical
  Scenario: Events API responds
    When I make a GET request to "/api/events"
    Then the response status should be 200
    And the response should be valid JSON

  Scenario: CMS status API responds
    When I make a GET request to "/api/cms-status"
    Then the response status should be 200
    And the response should contain environment info

  Scenario: Validate API responds to POST
    When I make a POST request to "/api/validate" with sample content
    Then the response status should be 200
    And the response should contain a valid field

  @smoke
  Scenario: Humanitix sync endpoint is live and requires authentication
    # 401 (not 403) also proves the JSON POST bypasses Astro's CSRF guard and reaches the handler
    When I make a POST request to "/api/cron/sync-events" with sample content
    Then the response status should be 401
    And the response should be valid JSON
