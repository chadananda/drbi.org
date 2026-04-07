Feature: SEO
  As a search engine
  I want proper metadata on every page
  So that the site can be properly indexed

  Background:
    Given the website is running

  @smoke @critical
  Scenario Outline: Pages have proper titles
    When I visit "<path>"
    Then the page title should not contain "undefined"
    And the page title should contain "drbi.org"

    Examples:
      | path                      |
      | /                         |
      | /about-us                 |
      | /events                   |
      | /topics                   |
      | /categories               |
      | /authors                  |
      | /contact-us               |
      | /memorial                 |
      | /news                     |
      | /working-with-us          |
      | /how-to-purchase-a-plot   |
      | /login                    |

  Scenario: Homepage has meta description
    When I visit the homepage
    Then the page should have a meta description
    And the meta description should not be empty

  Scenario: Pages have canonical URLs
    When I visit the homepage
    Then the page should have a canonical URL
