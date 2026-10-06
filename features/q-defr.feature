@H-01-q-defr
Feature: German and French /q page chrome (H-01 follow-up)
  After fix 8b, a de-CH or fr-CH share link shows page chrome in that language.
  The no-English check scans visible text, aria-label, title, placeholder and alt,
  inside the page and inside the widget's shadow DOM, plus the document title.
  Swiss wording: ss never sharp s; Offerte/offre, MWST/TVA where relevant.

  Scenario Outline: de-CH and fr-CH share pages have no English chrome
    Given a "<locale>" share calculator
    When a visitor opens the share link on a <width>x<height> screen
    Then the share page is in "<lang>" with no English text

    Examples:
      | locale | lang | width | height |
      | de-CH  | de   | 375   | 812    |
      | de-CH  | de   | 1440  | 900    |
      | fr-CH  | fr   | 375   | 812    |
      | fr-CH  | fr   | 1440  | 900    |
