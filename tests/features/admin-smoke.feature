@admin @smoke
Feature: Admin Panel Smoke Tests
  As an authenticated admin
  I want to verify all admin sections load correctly
  So that regressions are caught before deploying

  Background:
    Given the website is running
    And I am logged in as an admin

  Scenario: Admin dashboard loads
    When I visit "/admin"
    Then the admin page loads without error
    And the admin page body contains "Admin"

  Scenario: Admin articles page loads
    When I visit "/admin/articles"
    Then the admin page loads without error
    And the admin page body contains "Articles"

  Scenario: Admin events page loads
    When I visit "/admin/events"
    Then the admin page loads without error
    And the admin page body contains "Event"

  Scenario: Admin team page loads
    When I visit "/admin/team"
    Then the admin page loads without error
    And the admin page body contains "Admin"

  Scenario: Admin users page loads
    When I visit "/admin/users"
    Then the admin page loads without error
    And the admin page body contains "User"

  Scenario: Admin comments page loads
    When I visit "/admin/comments"
    Then the admin page loads without error
    And the admin page body contains "Admin"

  Scenario: Admin categories page loads
    When I visit "/admin/categories/index"
    Then the admin page loads without error
    And the admin page body contains "Admin"

  Scenario: Admin topics page loads
    When I visit "/admin/topics"
    Then the admin page loads without error
    And the admin page body contains "Admin"

  Scenario: Admin media page loads
    When I visit "/admin/media"
    Then the admin page loads without error
    And the admin page body contains "Admin"

  Scenario: Admin settings page loads
    When I visit "/admin/settings"
    Then the admin page loads without error
    And the admin page body contains "Admin"
