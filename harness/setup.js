// Wires harness widget hosts from the query string / fragment before the deferred widget script runs.
// ?config=/fixtures/x.json (data-config-url) · ?config2=... for the second host · #c=<base64url> (data-config)
(function () {
  var q = new URLSearchParams(location.search);
  var allowed = function (p) { return typeof p === "string" && /^\/(fixtures|templates)\/[a-z0-9_.-]+\.json$/i.test(p); };
  var hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  [["w1", "config", "enc"], ["w2", "config2", "enc2"]].forEach(function (s) {
    var el = document.getElementById(s[0]);
    if (!el) return;
    var url = q.get(s[1]);
    var enc = q.get(s[2]) || (s[0] === "w1" ? hash.get("c") : null);
    if (enc) el.setAttribute("data-config", enc);
    else if (allowed(url)) el.setAttribute("data-config-url", url);
    else if (s[0] === "w2") el.remove();
  });
})();
