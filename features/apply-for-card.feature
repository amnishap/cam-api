Feature: Apply for a credit card
  As a new customer
  I want to apply for a credit card
  So that I can start making purchases

  Background:
    Given I am a new customer with a $5000 credit limit

  Scenario: Apply for a virtual card — active immediately
    When I verify my KYC
    And I activate my account
    And I request a "VIRTUAL" card on network "VISA"
    Then the card status should be "ACTIVE"
    And the card type should be "VIRTUAL"
    And the card network should be "VISA"
    And the card should not be locked

  Scenario: Apply for a physical card — requires activation
    When I verify my KYC
    And I activate my account
    And I request a "PHYSICAL" card with shipping address
    Then the card status should be "PENDING_ACTIVATION"
    And the card type should be "PHYSICAL"

  Scenario: Activate a physical card after it is issued
    When I verify my KYC
    And I activate my account
    And I request a "PHYSICAL" card with shipping address
    And I activate the card
    Then the card status should be "ACTIVE"

  Scenario: Cannot issue a card before KYC is verified
    When I request a "VIRTUAL" card on an inactive account
    Then the response status should be 422
    And the error code should be "ACCOUNT_NOT_ACTIVE"

  Scenario: Cannot issue a card on an inactive account
    When I request a "VIRTUAL" card on an inactive account
    Then the response status should be 422
    And the error code should be "ACCOUNT_NOT_ACTIVE"
