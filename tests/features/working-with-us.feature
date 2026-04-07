Feature: Working With Us Page
  As a potential partner
  I want to learn about working with DRBI
  So that I can explore collaboration opportunities

  Background:
    Given the website is running

  @smoke
  Scenario: View working with us page
    When I visit "/working-with-us"
    Then I should see the page title containing "Working with Us"
    And I should see information about DRBI partnerships
    And I should see the footer section
