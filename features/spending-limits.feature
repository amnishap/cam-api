Feature: Spending limit management
  As an account manager
  I want to set spending limits on accounts and cards
  So that I can control expenditure

  Scenario: Set account-level spending limits
    Given I have an active account
    When I set account limits: monthly $2000, daily $500, per-transaction $200
    Then the account limits should include a monthly limit of $2000
    And the account limits should include a daily limit of $500
    And the account limits should include a per-transaction limit of $200

  Scenario: Set card-level spending limits on a virtual card
    Given I have an active account with a virtual card
    When I set card limits: monthly $1000, daily $200, per-transaction $100
    Then the card limits should include a monthly limit of $1000
    And the card limits should include a daily limit of $200
    And the card limits should include a per-transaction limit of $100

  Scenario: Card limit cannot exceed account credit limit
    Given I have an active account with a $500 credit limit and a virtual card
    When I try to set a card daily limit of $1000
    Then the response status should be 422
    And the error code should be "LIMIT_EXCEEDS_CREDIT_LIMIT"

  Scenario: Per-transaction limit cannot exceed daily limit
    Given I have an active account with a virtual card
    When I try to set card limits: daily $100, per-transaction $200
    Then the response status should be 422
    And the error code should be "TRANSACTION_LIMIT_EXCEEDS_DAILY_LIMIT"

  Scenario: Block an MCC code at the account level
    Given I have an active account
    When I block MCC "7995" on the account
    Then the account MCC block list should contain "7995"

  Scenario: Block an MCC code at the card level
    Given I have an active account with a virtual card
    When I block MCC "5812" on the card
    Then the card MCC block list should contain "5812"

  Scenario: Block multiple MCC codes on a card
    Given I have an active account with a virtual card
    When I block MCC "7995" on the card
    And I block MCC "5944" on the card
    Then the card MCC block list should contain "7995"
    And the card MCC block list should contain "5944"
