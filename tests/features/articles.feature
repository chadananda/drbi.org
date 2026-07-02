Feature: Article Pages
  As a reader
  I want to read full articles with rich content
  So that I can learn about DRBI topics

  Background:
    Given the website is running

  @smoke @critical @known-bug
  Scenario: Article page has proper structure
    Given there is at least one published article
    When I navigate to the first article
    Then I should see the article title as a heading
    And I should see the article content
    And I should see the author information
    And I should see the publication date

  Scenario: Article page has navigation elements
    Given there is at least one published article
    When I navigate to the first article
    Then I should see the main navigation
    And I should see the footer section

  @known-issue
  Scenario: Article page has meta tags
    Given there is at least one published article
    When I navigate to the first article
    Then the page title should not contain "undefined"
    And the article layout should have a meta description

  Scenario: Related articles section displays
    Given there is at least one published article
    When I navigate to the first article
    Then I should see a related articles section or translations section
