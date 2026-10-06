Feature: Instant quote with WhatsApp handoff

  @core @widget @D-003
  Scenario: Visitor sees a price range with VAT for the default painting job
    Given the widget is mounted with fixture "config-imbianchino.json"
    When the visitor keeps the default answers
    Then the low amount is 106000 cents and the high amount is 143000 cents
    And the VAT note says prices exclude VAT at 22%
    And the gross range is 129320 to 174460 cents
    And the disclaimer is visible

  @widget @D-003
  Scenario: Changing an answer updates the range live
    Given the widget is mounted with fixture "config-imbianchino.json"
    When the visitor sets "mq" to 100
    Then a "quotelet:quote" event fires within 200 ms
    And the high amount is greater than 143000 cents

  @core @D-003
  Scenario: The minimum price applies to tiny jobs
    Given the widget is mounted with fixture "config-imbianchino.json"
    When the visitor sets "mq" to 5 and turns "arredato" off
    Then the low amount is 13000 cents and the high amount is 18000 cents

  @widget @D-003
  Scenario: Lead goes to the owner's WhatsApp and nothing is stored
    Given the widget is mounted with fixture "config-imbianchino.json"
    And the visitor typed the name "Giulia"
    When the visitor taps the WhatsApp button
    Then the opened URL starts with "https://wa.me/393331234567?text="
    And the decoded text equals fixture "whatsapp-imbianchino.txt"
    And the page made no network request other than the script and the config
    And no cookie or localStorage key was written by the widget

  @core @D-003
  Scenario: A malicious formula is rejected before it can run
    Given the config fixture "config-invalid-formula.json"
    When the config is validated
    Then validation fails with an error at path "formula"
    And the widget shows the "ql-error" box instead of a calculator

  @widget @D-003
  Scenario: Hostile labels and host CSS cannot break the widget
    Given the harness page "hostile.html" with global CSS overrides
    And the widget is mounted with fixture "config-xss-label.json"
    Then the label is shown as literal text
    And no dialog or script execution happened
    And the host page's own script still runs after the widget errors or loads

  @cli @D-003
  Scenario: Developer gets a working share link from the CLI
    Given the file "fixtures/config-imbianchino.json"
    When I run "quotelet link fixtures/config-imbianchino.json"
    Then it prints a URL containing "/q#c="
    And decoding the fragment gives a config equal to the file

  @builder @D-004
  Scenario: Owner without a website builds a calculator and gets a share link
    Given I open "/build"
    When I pick the template "imbianchino-it"
    And I set the business name to "Rossi Tinteggiature" and WhatsApp to "+39 333 123 4567"
    And I change the "Bianco" price to 7
    Then the live preview high amount updates
    And I can copy a share link and an embed snippet
    And opening the share link in a fresh browser shows the same calculator with WhatsApp "393331234567"

  @builder @D-004
  Scenario: Builder blocks an invalid formula with a clear message
    Given I open "/build" with template "imbianchino-it"
    When I type the formula "mq * prezzo_inesistente"
    Then I see an error naming "prezzo_inesistente"
    And the share link button is disabled

  @landing @D-004
  Scenario: Mobile visitor uses the Italian demo page
    Given a 375x812 viewport
    When I open "/it/quanto-costa-imbiancare"
    Then the calculator shows a range without horizontal scrolling
    And the "Sei un imbianchino?" box links to "/build?template=imbianchino-it"
    And the waitlist form accepts an email
