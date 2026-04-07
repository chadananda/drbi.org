Feature: Login Page
  As an admin
  I want to authenticate
  So that I can manage content

  Background:
    Given the website is running

  @smoke @critical
  Scenario: Login page renders correctly
    When I visit "/login"
    Then I should see the page title containing "Login"
    And I should see an email input field
    And I should see a password input field
    And I should see a "Sign In" button

  Scenario: Login page has proper form attributes
    When I visit "/login"
    Then the email field should have type "email" or "text"
    And the password field should have type "password"
    And the form should have a POST method
