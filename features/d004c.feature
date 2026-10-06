@D-004c
Feature: Italian builder for painters (D-004c)
  An Italian painter builds a quote calculator and shares it without meeting English text.
  The "no English" check scans visible text, aria-label, title, placeholder and alt,
  inside the page and inside the widget's shadow DOM, plus the document title.

  Scenario: Italian painter on a phone builds, hits errors, shares and opens the link
    Given the painter uses a 390x844 screen
    When the painter opens "/build?template=imbianchino-it"
    Then the builder is in Italian with no English text
    When the painter types the WhatsApp number "333"
    Then the WhatsApp error reads "Troppo corto"
    And the painter sees no English text
    When the painter writes the formula "mq * prezzo_inesistente"
    Then the formula error reads "Nome sconosciuto" and names "prezzo_inesistente"
    And the painter cannot copy the share link yet
    And the painter sees no English text
    When the painter restores the template formula
    And the painter enters business "Rossi Tinteggiature" and WhatsApp "+39 333 123 4567"
    Then the painter copies a working share link
    And the painter sees no English text
    When the painter reopens "/build" without parameters
    Then the builder is in Italian with no English text
    When a customer opens the painter's share link on a 390x844 screen
    Then the share page is in Italian with no English text

  Scenario: Desktop lang=it entry, then switching back to English keeps EN unchanged
    Given the painter uses a 1440x900 screen
    When the painter opens "/build?lang=it"
    Then the builder is in Italian with no English text
    And only Italian templates are offered
    When the painter picks the template "pulizie-it"
    Then the painter sees no English text
    When the painter switches the builder to "en"
    Then the builder heading reads "Build your calculator"
    When the painter reopens "/build" without parameters
    Then the builder heading reads "Build your calculator"
