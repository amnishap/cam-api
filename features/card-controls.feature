Feature: Card lock and unlock controls
  As a cardholder
  I want to lock and unlock my card
  So that I can prevent unauthorised use without closing the card

  Background:
    Given I have an active account with a virtual card

  Scenario: Lock an active card
    When I lock my card
    Then the card should be locked
    And the card status should still be "ACTIVE"

  Scenario: Unlock a locked card
    When I lock my card
    And I unlock my card
    Then the card should not be locked
    And the card status should still be "ACTIVE"

  Scenario: Cannot lock a card that is already locked
    When I lock my card
    And I try to lock my card again
    Then the response status should be 409

  Scenario: Cannot unlock a card that is not locked
    When I try to unlock my card
    Then the response status should be 409

  Scenario: Deactivate and reactivate a card
    When I deactivate my card
    Then the card status should be "INACTIVE"
    When I reactivate my card
    Then the card status should be "ACTIVE"

  Scenario: Suspend and reactivate a card
    When I suspend my card
    Then the card status should be "SUSPENDED"
    When I reactivate my card
    Then the card status should be "ACTIVE"

  Scenario: Close a card — terminal state
    When I close my card
    Then the card status should be "CLOSED"

  Scenario: Cannot lock a closed card
    When I close my card
    And I try to lock my card
    Then the response status should be 422
    And the error code should be "CARD_CLOSED"
