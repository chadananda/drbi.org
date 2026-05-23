@smoke @critical
Feature: All pages load successfully
  Every public route should return a page with a title and no crash

  Background:
    Given the website is running

  Scenario: Homepage loads
    When I visit "/"
    Then the page should have a title
    And the page should not show an error

  Scenario: About page loads
    When I visit "/about-us"
    Then the page should have a title

  Scenario: Events page loads
    When I visit "/events"
    Then the page should have a title

  Scenario: Contact page loads
    When I visit "/contact-us"
    Then the page should have a title

  Scenario: Working With Us page loads
    When I visit "/working-with-us"
    Then the page should have a title

  Scenario: Memorial listing loads
    When I visit "/memorial"
    Then the page should have a title

  Scenario: News listing loads
    When I visit "/news"
    Then the page should have a title

  Scenario: Authors listing loads
    When I visit "/authors"
    Then the page should have a title

  Scenario: Categories listing loads
    When I visit "/categories"
    Then the page should have a title

  Scenario: Topics listing loads
    When I visit "/topics"
    Then the page should have a title

  Scenario: Agriculture section loads
    When I visit "/agriculture"
    Then the page should have a title

  Scenario: Arts section loads
    When I visit "/arts"
    Then the page should have a title

  Scenario: History section loads
    When I visit "/history"
    Then the page should have a title

  Scenario: Learning section loads
    When I visit "/learning"
    Then the page should have a title

  Scenario: Radio section loads
    When I visit "/radio"
    Then the page should have a title

  Scenario: Facilities page loads
    When I visit "/facilities-and-rentals"
    Then the page should have a title

  Scenario: Contribute page loads
    When I visit "/contribute"
    Then the page should have a title

  Scenario: Bahai faith page loads
    When I visit "/the-bahai-faith"
    Then the page should have a title

  Scenario: Cemetery plot purchase page loads
    When I visit "/how-to-purchase-a-plot"
    Then the page should have a title

  Scenario: Privacy policy loads
    When I visit "/privacy"
    Then the page should have a title

  Scenario: Terms of service loads
    When I visit "/terms"
    Then the page should have a title

  Scenario: 404 page loads for unknown route
    When I visit "/this-page-does-not-exist"
    Then the page should show a 404 message
