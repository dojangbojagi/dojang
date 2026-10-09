/* ==========================================================================
   stub.js: small helpers for the in-progress pages (02 to 06).
   - renders the planned state labels as real status chips
   - shows a live readout of the simulated state, driven by the scenario switcher
   Classic script. Needs app.js (window.Proto).
   ========================================================================== */
(function () {
  "use strict";
  var P = window.Proto;
  if (!P) return;

  var GROUP_TITLES = {
    wallet: "Wallet",
    dojang: "Dojang",
    demo: "Demo credential",
    proof: "Proof",
    tx: "Transaction",
    vault: "Vault",
  };
  var FIELD = { demo: "demoCredential" };

  function renderPlanned(host) {
    var spec = host.getAttribute("data-stub-states") || "";
    var out = "";
    spec.split(";").forEach(function (part) {
      var bits = part.split(":");
      if (bits.length < 2) return;
      var kind = bits[0].trim();
      var chips = bits[1]
        .split("|")
        .map(function (v) {
          return P.state.chip(kind, v.trim());
        })
        .join("");
      out +=
        '<div class="stub__group"><h3 class="stub__grouplabel">' +
        P.esc(GROUP_TITLES[kind] || kind) +
        '</h3><div class="stub__chips">' +
        chips +
        "</div></div>";
    });
    host.innerHTML = out;
  }

  function renderLive(host) {
    var kinds = (host.getAttribute("data-stub-live") || "").split(",").map(function (k) {
      return k.trim();
    }).filter(Boolean);
    P.state.subscribe(function (s) {
      var loading = P.state.isLoading();
      host.innerHTML =
        '<dl class="kv">' +
        kinds
          .map(function (kind) {
            var value = s[FIELD[kind] || kind];
            return (
              '<div class="kv__row"><dt>' +
              P.esc(GROUP_TITLES[kind] || kind) +
              "</dt><dd>" +
              (loading ? '<span class="skeleton" aria-label="Updating">Updating</span>' : P.state.chip(kind, value)) +
              "</dd></div>"
            );
          })
          .join("") +
        "</dl>";
    });
  }

  function init() {
    P.qsa("[data-stub-states]").forEach(renderPlanned);
    P.qsa("[data-stub-live]").forEach(renderLive);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
