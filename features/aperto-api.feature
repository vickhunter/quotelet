# H-01 Quotelet Aperto, API side (owner: AI Engineer). Runs the /api/aperto handler in-process with
# APERTUS_MOCK=1 (recorded answers, no key, no network). The browser scenario @aperto is UI/UX's.
@aperto-api
Feature: Aperto API turns a price list into a validated calculator

  Scenario: The Lugano mover text becomes a valid config with deterministic prices
    Given the Aperto API runs with recorded Apertus answers
    When the owner posts the "mover-lugano" example price list in "de" to the Aperto API
    Then the Aperto API answers ok with a valid config of 4 fields in "CHF" after 1 attempt
    And core quotes "volumen=20, etage_auszug=3, ohne_lift=true" on that config as 86000 to 106000 cents

  Scenario: A price list without numbers is rejected after exactly one repair
    Given the Aperto API runs with recorded Apertus answers
    When the owner posts the "broken-sundays" example price list in "en" to the Aperto API
    Then the Aperto API answers not ok after 2 attempts and asks for a concrete number

  Scenario: The customer message keeps core's amounts in every language
    Given the Aperto API runs with recorded Apertus answers
    When the owner posts the "mover-lugano" example price list in "de" to the Aperto API
    Then the Aperto message for "volumen=20, etage_auszug=3, ohne_lift=true" in it, de, fr and en contains only core's formatted amounts
