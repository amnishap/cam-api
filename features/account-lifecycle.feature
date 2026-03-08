Feature: Account lifecycle
  As a customer
  I want my account to follow a defined lifecycle
  So that the system enforces valid state transitions

  Scenario: Full account approval journey
    Given I am a new customer with a $5000 credit limit
    When I verify my KYC
    And I activate my account
    Then the account status should be "ACTIVE"
    And the account KYC status should be "VERIFIED"

  Scenario: Cannot activate account without KYC verification
    Given I am a new customer with a $5000 credit limit
    When I try to activate my account directly
    Then the response status should be 422
    And the error code should be "KYC_NOT_VERIFIED"

  Scenario: Suspend and unsuspend an account
    Given I have an active account
    When I suspend the account
    Then the account status should be "SUSPENDED"
    When I unsuspend the account
    Then the account status should be "ACTIVE"

  Scenario: Close an account — requires all cards closed and zero balance
    Given I have an active account with a virtual card
    When I close my card
    And I close the account
    Then the account status should be "CLOSED"

  Scenario: Cannot close account with open cards
    Given I have an active account with a virtual card
    When I try to close the account
    Then the response status should be 422
    And the error code should be "ACTIVE_CARDS_EXIST"

  Scenario: Update account credit limit
    Given I have an active account
    When I update the credit limit to $10000
    Then the account credit limit should be $10000
