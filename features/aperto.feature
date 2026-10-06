# H-01 Quotelet Aperto, browser side (owner: UI/UX). Runs against the local build:
# `bun run build && APERTUS_MOCK=1 bun run serve` (127.0.0.1:4173, recorded Apertus answers), or QL_BASE.
@aperto
Feature: Aperto turns a plain price list into a calculator, a share link and a message in the customer's language

  Scenario: Lugano mover goes from plain German to a calculator and an Italian WhatsApp message
    Given the owner opens the Aperto page
    When the owner picks the "mover-lugano" example
    And the owner asks for a calculator
    Then the validator shows "4 fields, formula OK"
    And the live preview shows a price range in "CHF"
    And the owner can copy a share link and an embed snippet
    When the customer opens the share link on a phone
    And the customer sets "volumen=20, etage_auszug=3, ohne_lift=true"
    Then the customer sees a range from 86000 to 106000 cents with VAT
    When the customer switches the message language to "it"
    Then the message preview is the Italian text with the calculator's amounts
    And the WhatsApp link carries the same amounts as the calculator

  Scenario: A vague price list is rejected and the errors are shown
    Given the owner opens the Aperto page
    When the owner types "Gardening: 50 per hour, a bit more on Sundays" in "en"
    And the owner asks for a calculator
    Then the validator shows errors
    And one error asks for a concrete number
    And no share link is offered

  Scenario: The draft survives a refresh on a phone, with no horizontal scroll
    Given the owner opens the Aperto page on a 375x812 screen
    When the owner types "Imbiancatura: 8 € al m², minimo 200 €" in "it"
    And the owner reloads the page
    Then the draft "Imbiancatura: 8 € al m², minimo 200 €" and language "it" are still there
    And the page has no horizontal overflow
