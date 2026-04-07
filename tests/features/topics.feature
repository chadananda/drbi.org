Feature: Topics
  As a visitor
  I want to browse the big ideas
  So that I can explore DRBI's main themes

  Background:
    Given the website is running

  @smoke
  Scenario: View topics index
    When I visit "/topics"
    Then I should see the page title containing "Big Ideas"
    And I should see topic links
    And active topics should be styled differently from unused topics

  Scenario: Navigate to a topic page
    When I visit "/topics"
    And I click on an active topic link
    Then I should see articles about that topic
