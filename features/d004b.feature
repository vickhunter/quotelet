@D-004b
Feature: Site hygiene (D-004b): working dev snippet, real 404s, robots/sitemap, security headers, waitlist ref

  Scenario: Every URL in the landing developer snippet resolves, and the snippet works on another site
    When a developer reads the snippet on the landing page
    Then every URL in the snippet answers 200
    And the snippet pasted on a third-party page shows a working calculator

  Scenario: Unknown paths are real 404s; robots.txt and sitemap.xml are real files
    Then "/nope" answers 404 with the not-found page
    And "/robots.txt" answers 200 as "text/plain" containing "Sitemap: https://quotelet.vercel.app/sitemap.xml"
    And "/sitemap.xml" answers 200 as "xml" containing "<loc>https://quotelet.vercel.app/build</loc>"
    And "/painting.json" answers 200 as "json" containing "painting-en"
    And the app routes "/", "/build", "/q", "/aperto", "/it/quanto-costa-imbiancare" answer 200

  Scenario: Security headers are set and the app runs without CSP violations
    Then "/" carries a CSP with frame-ancestors 'none', nosniff and strict-origin-when-cross-origin
    And "/quotelet.js" and "/painting.json" carry no CSP and no frame-ancestors
    And the pages "/", "/build?template=imbianchino-it", "/aperto", "/it/quanto-costa-imbiancare" load without CSP violations
    And a share link from the builder opens without CSP violations
    And the landing waitlist still submits under the CSP

  Scenario: Waitlist forms keep the page's ref
    When a visitor opens "/?ref=launch-hn" and joins the waitlist
    Then the hidden ref field holds "launch-hn" and the signup carries ref "launch-hn"
    When a visitor opens "/it/quanto-costa-imbiancare?ref=wa-marco" and joins the waitlist
    Then the hidden ref field holds "wa-marco" and the signup carries ref "wa-marco"
