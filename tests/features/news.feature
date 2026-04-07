Feature: News Page
  As a visitor
  I want to read desert rose news
  So that I can stay informed about DRBI activities

  Background:
    Given the website is running

  @smoke
  Scenario: View news index
    When I visit "/news"
    Then I should see the page title containing "News"
    And I should see news article thumbnails

  Scenario: News articles have required metadata
    When I visit "/news"
    Then each article thumbnail should have a title
    And each article thumbnail should have a date
