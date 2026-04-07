Feature: Contact Page
  As a visitor
  I want to contact DRBI
  So that I can get in touch with the organization

  Background:
    Given the website is running

  @smoke @critical
  Scenario: View contact page
    When I visit "/contact-us"
    Then I should see the page title containing "Contact"
    And I should see a contact form
    And the form should have name, email, and message fields
    And I should see a "Send Message" button

  Scenario: Contact info is displayed
    When I visit "/contact-us"
    Then I should see the address "1950 W. William Sears Dr"
    And I should see the phone number "(520) 466-7961"
    And I should see the email "info@drbi.org"

  Scenario: Form requires fields
    When I visit "/contact-us"
    And I click the send button without filling the form
    Then the form should show validation errors
