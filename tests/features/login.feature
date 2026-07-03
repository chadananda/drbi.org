Feature: Login Page
  As an admin
  I want to authenticate
  So that I can manage content

  Background:
    Given the website is running

  @smoke @critical
  Scenario: Sign-in popover renders correctly
    When I visit "/?signin=1"
    Then I should see an email input field
    And I should see a password input field
    And I should see the break-glass "Sign In" button

  Scenario: Sign-in popover has proper form attributes
    When I visit "/?signin=1"
    Then the email field should have type "email" or "text"
    And the password field should have type "password"
    And the form should have a POST method
