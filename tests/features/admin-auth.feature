Feature: Admin Authentication
  As an administrator
  I want to log in to the admin panel
  So that I can manage events and content

  Background:
    Given the website is running

  Scenario: View login page
    When I visit the admin page
    Then I should be redirected to the login page
    And I should see a login form
    And I should see username and password fields
    And I should see a login button

  Scenario: Login with invalid credentials
    When I visit the login page
    And I enter invalid credentials
    And I submit the login form
    Then I should see an error message
    And I should remain on the login page

  Scenario: Login page is accessible
    When I visit the login page directly
    Then I should see the login form
    And the form should be functional

  Scenario: Logout functionality exists
    Given I am logged in as an admin
    When I click the logout button
    Then I should be logged out
    And I should be redirected to the login page
