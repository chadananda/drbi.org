Feature: All pages reachable within 2 links from homepage
  As a visitor
  I want every page within 2 clicks of the homepage to load
  So that the site has no broken routes or crashing pages

  Background:
    Given the website is running

  Scenario Outline: Page loads and shows footer
    When I visit "<path>"
    Then the page should have a title
    And the page should not show an error
    And I should see the footer section

    Examples:
      | path                            |
      | /                               |
      | /events                         |
      | /arts                           |
      | /agriculture                    |
      | /working-with-us                |
      | /facilities-and-rentals         |
      | /radio                          |
      | /memorial                       |
      | /contact-us                     |
      | /about-us                       |
      | /history                        |
      | /the-bahai-faith                |
      | /contribute                     |
      | /news                           |
      | /terms                          |
      | /privacy                        |
      | /how-to-purchase-a-plot         |
      | /authors                        |
      | /categories                     |
      | /topics                         |
      | /arts/duffy-awarded             |
      | /arts/i-am-human                |
      | /arts/write-life                |
      | /agriculture/greening-sonora    |
      | /history/william-sears          |
      | /history/marguerite-sears       |
      | /history/eleanor-hadden         |
      | /history/david-hadden           |
      | /history/shuallah-alai          |
      | /history/duffy-jeanne-sheridan  |
