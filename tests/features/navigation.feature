Feature: Site Navigation
  As a visitor
  I want to navigate through the website
  So that I can find the content I'm looking for

  Background:
    Given the website is running

  @smoke @critical
  Scenario: Main navigation is visible
    When I visit the homepage
    Then I should see the main navigation
    And the navigation should contain essential links

  @navigation
  Scenario: Navigate to events page
    When I visit the homepage
    And I click on the events link in navigation
    Then I should be on the events page

  @navigation
  Scenario: Navigate to about page
    When I visit the homepage
    And I click on the about link in navigation
    Then I should be on the about page

  @smoke
  Scenario: Footer is present
    When I visit the homepage
    Then I should see the footer section
    And the footer should contain contact information

  @mobile
  Scenario: Mobile navigation works
    Given I am using a mobile viewport
    When I visit the homepage
    Then I should see a mobile menu toggle
    When I click the mobile menu toggle
    Then the mobile navigation menu should appear
