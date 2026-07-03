@smoke
Feature: Authentication Coverage
  As a security-conscious developer
  I want to verify authentication boundaries are enforced
  So that unauthorized access is blocked and auth APIs behave correctly

  Background:
    Given the website is running

  @critical
  Scenario: Unauthenticated admin access redirects to login
    When I visit "/admin"
    Then I should be redirected to the login page

  @critical
  Scenario: Sign-in popover shows email magic-link form
    When I visit "/?signin=1"
    Then the magic-link email form is visible

  Scenario: Sign-in popover shows Google sign-in option
    When I visit "/?signin=1"
    Then the Google sign-in widget or button is present

  @critical
  Scenario: Magic-link request endpoint returns ok
    When I POST to "/api/auth/request-link" with email "test@example.com"
    Then the auth API response is ok

  @critical
  Scenario: Google auth endpoint rejects invalid credentials
    When I POST to "/api/auth/google" with a bad credential
    Then the auth API response status is 401
