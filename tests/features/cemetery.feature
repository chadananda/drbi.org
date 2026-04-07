Feature: Cemetery Plot Purchase
  As a visitor
  I want to learn about purchasing a cemetery plot
  So that I can make arrangements

  Background:
    Given the website is running

  @smoke
  Scenario: View plot purchase page
    When I visit "/how-to-purchase-a-plot"
    Then I should see the page title containing "Purchase"
    And I should see pricing information or purchase details
    And I should see the footer section
