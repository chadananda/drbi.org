Feature: About Us Page
  As a visitor
  I want to learn about Desert Rose Bahá'í Institute
  So that I understand the organization's mission

  Background:
    Given the website is running

  @smoke
  Scenario: View about page
    When I visit "/about-us"
    Then I should see the page title containing "About Desert Rose"
    And I should see a heading "Vision & Mission"
    And I should see the footer section

  Scenario: About page has board section
    When I visit "/about-us"
    Then I should see a heading "Board of Directors"
    And I should see board member profiles

  Scenario: About page has team section
    When I visit "/about-us"
    Then I should see team member information
