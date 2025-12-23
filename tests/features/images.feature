Feature: Images Load Correctly
  As a visitor
  I want all images to load properly
  So that I can see the visual content on the site

  Background:
    Given the website is running

  @smoke @images
  Scenario: Homepage video thumbnail loads
    When I visit the homepage
    Then the video thumbnail image should load successfully

  @images
  Scenario: Memorial page images load
    When I visit the memorial page
    Then the hero image should load successfully
    And the memorial profile images should load successfully

  @images
  Scenario: Events page hero image loads
    When I visit the events page
    Then the hero image should load successfully

  @images
  Scenario: Facilities page hero image loads
    When I visit the facilities page
    Then the hero image should load successfully

  @images
  Scenario: Contribute page hero image loads
    When I visit the contribute page
    Then the hero image should load successfully

  @images @s3
  Scenario: S3-hosted memorial images load correctly
    When I visit the memorial page
    Then S3-hosted images should return 200 status
    And no images should return 403 or 404 errors

  @images @s3
  Scenario: Burial article image loads
    When I visit the burial article page
    Then the article hero image should load successfully
    And the image URL should contain ".png" or ".jpg" extension
