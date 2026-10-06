// Host-page instrumentation for tests (NOT part of the widget). Records quotelet:* events, errors,
// dialogs and window.open calls so BDD steps and sims can assert on them.
(function () {
  var ql = (window.__ql = { events: [], errors: [], dialogs: [], opened: [], hostAlive: false });
  window.addEventListener("error", function (e) { ql.errors.push(String(e.message || e)); });
  window.addEventListener("unhandledrejection", function (e) { ql.errors.push("unhandledrejection: " + String(e.reason)); });
  ["alert", "confirm", "prompt"].forEach(function (k) {
    var orig = window[k];
    window[k] = function (m) { ql.dialogs.push(k + ":" + m); return orig.apply(window, arguments); };
  });
  // Intercept the lead handoff navigation: record the URL instead of leaving the page.
  window.open = function (url, target, features) { ql.opened.push({ url: String(url), target: target, features: features }); return null; };
  ["quotelet:ready", "quotelet:quote", "quotelet:lead", "quotelet:error"].forEach(function (t) {
    document.addEventListener(t, function (e) {
      ql.events.push({ type: t, host: e.target && e.target.id, t: performance.now(), detail: JSON.parse(JSON.stringify(e.detail)) });
    }, true);
  });
})();
