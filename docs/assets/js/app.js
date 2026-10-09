/* ==========================================================================
   app.js: shared behaviour for every page

   Classic script on purpose: ES modules are blocked when pages are opened
   from file://, and each page must open on its own.

   Sections
     1. Config            brand, network, navigation (single source)
     2. ProtoState        simulated state + preview scenarios (see README)
     3. Chrome            header, footer, proto bar (rendered once from here)
     4. UI primitives     modal, toast, tooltip, mobile menu, scenario switcher
     5. Environment       ambient tone per section, in-view flags

   Migration notes
     - ProtoState is a stand-in. Replace each field with real data
       (wagmi/viem hooks, contract reads) and keep the same value names.
     - Everything simulated is labelled as such in the UI.
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------------ 1. Config */
  var CONFIG = {
    brand: { name: "Project Name" }, // placeholder until branding is final; change here only
    network: {
      name: "GIWA Sepolia",
      kind: "Testnet",
      chainId: 91342,
      explorer: "https://sepolia-explorer.giwa.io",
    },
    nav: [
      { key: "home", label: "Home", href: "01-home.html" },
      { key: "dojang", label: "Dojang", href: "02-dojang.html" },
      { key: "bojagi", label: "Bojagi", href: "03-bojagi.html" },
      { key: "vault", label: "Vault", href: "04-vault.html" },
      { key: "contracts", label: "Contracts", href: "05-contracts.html" },
      { key: "docs", label: "Docs", href: "06-docs.html" },
    ],
    external: [
      { label: "GIWA", href: "https://giwa.io" },
      { label: "GIWA documentation", href: "https://docs.giwa.io/giwa-chain/en/giwa-ecosystem/dojang" },
      { label: "GIWA Sepolia explorer", href: "https://sepolia-explorer.giwa.io" },
    ],
  };

  /* ------------------------------------------------------------ 2. ProtoState */
  // State names and labels follow the master brief, section 10 (UI behaviour contract).
  var LABELS = {
    wallet: {
      disconnected: "Disconnected",
      connecting: "Connecting",
      connected: "Connected",
      "wrong-network": "Wrong Network",
    },
    dojang: {
      idle: "Not checked",
      checking: "Checking",
      "official-verified": "Official Verified",
      "no-official-credential": "No Official Credential",
      expired: "Expired",
      revoked: "Revoked",
      "read-error": "Read Error",
    },
    demo: { true: "Demo Credential Ready", false: "No Demo Credential" },
    proof: {
      "credential-required": "Credential Required",
      "ready-to-prove": "Ready to Prove",
      generating: "Generating Proof",
      generated: "Proof Generated",
      invalid: "Proof Invalid",
      "ready-to-submit": "Ready to Submit",
    },
    tx: {
      idle: "No transaction",
      "awaiting-signature": "Awaiting Signature",
      submitted: "Submitted",
      confirming: "Confirming",
      confirmed: "Confirmed",
      reverted: "Reverted",
      rejected: "Rejected",
      "rpc-error": "RPC Error",
    },
    vault: {
      locked: "Locked",
      eligible: "Eligible",
      "access-granted": "Access Granted",
      "previously-granted": "Previously Granted",
    },
  };

  var TONES = {
    wallet: { disconnected: "neutral", connecting: "pending", connected: "valid", "wrong-network": "warn" },
    dojang: {
      idle: "neutral",
      checking: "pending",
      "official-verified": "valid",
      "no-official-credential": "neutral",
      expired: "warn",
      revoked: "invalid",
      "read-error": "invalid",
    },
    demo: { true: "demo", false: "neutral" },
    proof: {
      "credential-required": "neutral",
      "ready-to-prove": "neutral",
      generating: "pending",
      generated: "valid",
      invalid: "invalid",
      "ready-to-submit": "valid",
    },
    tx: {
      idle: "neutral",
      "awaiting-signature": "pending",
      submitted: "pending",
      confirming: "pending",
      confirmed: "valid",
      reverted: "invalid",
      rejected: "warn",
      "rpc-error": "invalid",
    },
    vault: { locked: "neutral", eligible: "valid", "access-granted": "valid", "previously-granted": "valid" },
  };

  var BASE = {
    wallet: "connected",
    dojang: "official-verified",
    demoCredential: true,
    proof: "ready-to-prove",
    tx: "idle",
    vault: "locked",
  };
  function mk(over) {
    var s = {};
    for (var k in BASE) s[k] = BASE[k];
    for (var j in over) s[j] = over[j];
    return s;
  }

  // The eight previews requested in the frontend brief. Each is a demonstration, not live data.
  var SCENARIOS = [
    {
      id: "disconnected",
      label: "Disconnected",
      state: mk({ wallet: "disconnected", dojang: "idle", demoCredential: false, proof: "credential-required" }),
    },
    { id: "verified", label: "Verified", state: mk({}) },
    {
      id: "unverified",
      label: "Unverified",
      state: mk({ dojang: "no-official-credential", demoCredential: false, proof: "credential-required" }),
    },
    { id: "proof-pending", label: "Proof pending", state: mk({ proof: "generating" }) },
    { id: "proof-valid", label: "Proof valid", state: mk({ proof: "ready-to-submit", vault: "eligible" }) },
    { id: "proof-invalid", label: "Proof invalid", state: mk({ proof: "invalid" }) },
    {
      id: "vault-locked",
      label: "Vault locked",
      state: mk({ dojang: "no-official-credential", proof: "ready-to-prove", vault: "locked" }),
    },
    {
      id: "vault-granted",
      label: "Vault access granted",
      state: mk({ proof: "generated", tx: "confirmed", vault: "access-granted" }),
    },
  ];

  var STORE_KEY = "proto.scenario";
  var listeners = [];
  var current = { scenarioId: "disconnected", state: copy(SCENARIOS[0].state) };
  var loadingTimer = null;

  function copy(o) {
    return JSON.parse(JSON.stringify(o));
  }
  function find(id) {
    for (var i = 0; i < SCENARIOS.length; i++) if (SCENARIOS[i].id === id) return SCENARIOS[i];
    return null;
  }
  function readStore() {
    try {
      var raw = window.sessionStorage.getItem(STORE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (saved && saved.state && saved.state.wallet) current = saved;
    } catch (e) {
      /* storage can be unavailable (private mode, file://); the prototype still works */
    }
  }
  function writeStore() {
    try {
      window.sessionStorage.setItem(STORE_KEY, JSON.stringify(current));
    } catch (e) {}
  }
  function emit(meta) {
    for (var i = 0; i < listeners.length; i++) listeners[i](current.state, meta || {});
  }
  function setLoading(ms) {
    var root = document.documentElement;
    root.setAttribute("data-proto-loading", "true");
    clearTimeout(loadingTimer);
    loadingTimer = setTimeout(function () {
      root.removeAttribute("data-proto-loading");
      emit({ loaded: true });
    }, reducedMotion() ? 0 : ms);
  }

  var ProtoState = {
    get: function () {
      return current.state;
    },
    scenarioId: function () {
      return current.scenarioId;
    },
    scenarios: SCENARIOS,
    subscribe: function (fn) {
      listeners.push(fn);
      fn(current.state, { initial: true });
      return function () {
        listeners = listeners.filter(function (l) {
          return l !== fn;
        });
      };
    },
    apply: function (id, opts) {
      var s = find(id);
      if (!s) return;
      current = { scenarioId: id, state: copy(s.state) };
      writeStore();
      // Loading flag goes up before the first emit so components can render skeletons
      if (!opts || opts.loading !== false) setLoading(650);
      emit({ scenario: id });
    },
    patch: function (partial, opts) {
      var next = copy(current.state);
      for (var k in partial) next[k] = partial[k];
      current = { scenarioId: null, state: next };
      writeStore();
      emit({ patched: true });
      if (opts && opts.loading) setLoading(opts.loading);
    },
    isLoading: function () {
      return document.documentElement.hasAttribute("data-proto-loading");
    },
    label: function (kind, value) {
      var map = LABELS[kind];
      return (map && map[String(value)]) || String(value);
    },
    tone: function (kind, value) {
      var map = TONES[kind];
      return (map && map[String(value)]) || "neutral";
    },
    chip: function (kind, value, labelOverride) {
      return (
        '<span class="status" data-state="' +
        ProtoState.tone(kind, value) +
        '"><i class="status__dot" aria-hidden="true"></i>' +
        esc(labelOverride || ProtoState.label(kind, value)) +
        "</span>"
      );
    },
  };

  /* ------------------------------------------------------------------ helpers */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }
  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  /* --------------------------------------------------------------- 3. Chrome */
  function brandMark(id) {
    return (
      '<svg class="brand__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">' +
      '<defs><clipPath id="' + id + '"><rect x="2" y="2" width="28" height="28" rx="4"/></clipPath></defs>' +
      '<g clip-path="url(#' + id + ')">' +
      '<rect x="2" y="2" width="13" height="17" fill="#86d6bd" fill-opacity=".9"/>' +
      '<rect x="15" y="2" width="15" height="11" fill="#9aa5ff" fill-opacity=".9"/>' +
      '<rect x="15" y="13" width="15" height="17" fill="#e6c36e" fill-opacity=".92"/>' +
      '<rect x="2" y="19" width="13" height="11" fill="#9aa5ff" fill-opacity=".45"/>' +
      '<path d="M15 2v28M2 19h13M15 13h15" stroke="#0a0e1f" stroke-width="1.2" stroke-dasharray="2 2"/>' +
      "</g>" +
      '<rect x="2.5" y="2.5" width="27" height="27" rx="3.5" fill="none" stroke="#eeebe1" stroke-opacity=".45"/>' +
      "</svg>"
    );
  }

  function netPill() {
    var n = CONFIG.network;
    return (
      '<span class="net-pill" title="' + esc(n.name + " " + n.kind + ", chain ID " + n.chainId) + '">' +
      '<i class="net-pill__dot" aria-hidden="true"></i><b>' + esc(n.name) + "</b><i>" + esc(n.kind) + "</i></span>"
    );
  }

  function renderProtoBar(el) {
    el.className = "proto-bar";
    el.innerHTML =
      '<div class="container proto-bar__inner">' +
      "<span><strong>Prototype.</strong> Wallet, credentials, proofs and transactions here are simulated and labelled as such.</span>" +
      '<button type="button" data-open-scenarios>Preview scenarios</button>' +
      "</div>";
  }

  function renderHeader(el) {
    var active = el.getAttribute("data-active");
    var links = CONFIG.nav
      .map(function (n) {
        return (
          '<li><a class="nav__link" href="' + n.href + '"' +
          (n.key === active ? ' aria-current="page"' : "") + ">" + n.label + "</a></li>"
        );
      })
      .join("");
    var mobile = CONFIG.nav
      .map(function (n) {
        return (
          '<li><a href="' + n.href + '"' + (n.key === active ? ' aria-current="page"' : "") +
          "><span>" + n.label + "</span></a></li>"
        );
      })
      .join("");

    el.innerHTML =
      '<div class="container site-header__inner">' +
      '<a class="brand" href="01-home.html" aria-label="' + esc(CONFIG.brand.name) + ', home">' +
      brandMark("bm-header") + '<span class="brand__name">' + esc(CONFIG.brand.name) + "</span></a>" +
      '<nav class="nav" aria-label="Primary"><ul class="nav__list">' + links + "</ul></nav>" +
      '<div class="site-header__actions">' +
      '<span class="site-header__net">' + netPill() + "</span>" +
      '<button type="button" class="btn btn--secondary btn--sm btn--wallet" data-wallet-button data-wallet="disconnected">' +
      '<span class="btn__dot" aria-hidden="true"></span><span data-wallet-label><span class="wl-full">Connect Wallet</span><span class="wl-short" aria-hidden="true">Connect</span></span></button>' +
      '<button type="button" class="menu-toggle" aria-expanded="false" aria-controls="mobile-nav" aria-label="Open menu">' +
      '<span class="menu-toggle__bars"></span></button>' +
      "</div></div>" +
      '<div class="mobile-nav" id="mobile-nav" hidden><nav aria-label="Primary mobile"><ul>' + mobile +
      '</ul></nav><div class="mobile-nav__net">' + netPill() + "</div></div>";

    var toggle = qs(".menu-toggle", el);
    var panel = qs("#mobile-nav", el);
    function setMenu(open) {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      panel.hidden = !open;
    }
    toggle.addEventListener("click", function () {
      setMenu(panel.hidden);
    });
    qsa("a", panel).forEach(function (a) {
      a.addEventListener("click", function () {
        setMenu(false);
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) {
        setMenu(false);
        toggle.focus();
      }
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth >= 960) setMenu(false);
    });

    var walletBtn = qs("[data-wallet-button]", el);
    walletBtn.addEventListener("click", openWalletModal);

    ProtoState.subscribe(function (s) {
      var label = {
        disconnected: ["Connect Wallet", "Connect"],
        connecting: ["Connecting", "Connecting"],
        connected: ["Demo wallet", "Demo"],
        "wrong-network": ["Wrong Network", "Switch"],
      }[s.wallet];
      walletBtn.setAttribute("data-wallet", s.wallet);
      /* Narrow screens show the short form; the full label stays as the accessible name */
      walletBtn.setAttribute("aria-label", label[0]);
      qs("[data-wallet-label]", walletBtn).innerHTML =
        '<span class="wl-full">' + label[0] + '</span><span class="wl-short" aria-hidden="true">' + label[1] + "</span>";
    });
  }

  function renderFooter(el) {
    var n = CONFIG.network;
    var product = CONFIG.nav
      .slice(0, 4)
      .map(function (i) {
        return '<li><a href="' + i.href + '">' + i.label + "</a></li>";
      })
      .join("");
    var resources =
      '<li><a href="05-contracts.html">Contracts</a></li><li><a href="06-docs.html">Docs</a></li>';
    var ext = CONFIG.external
      .map(function (i) {
        return (
          '<li><a href="' + i.href + '" target="_blank" rel="noopener noreferrer">' + esc(i.label) +
          '<span class="visually-hidden"> (opens in a new tab)</span></a></li>'
        );
      })
      .join("");

    el.className = "site-footer";
    el.innerHTML =
      '<div class="container">' +
      '<div class="site-footer__grid">' +
      '<div class="site-footer__brand"><a class="brand" href="01-home.html" aria-label="' + esc(CONFIG.brand.name) + ', home">' +
      brandMark("bm-footer") + '<span class="brand__name">' + esc(CONFIG.brand.name) + "</span></a>" +
      "<p>Prove more. Reveal less. Verify trusted state, prove eligibility privately and unlock an <span class=\"nowrap\">on-chain</span> action.</p></div>" +
      '<div><h2>Protocol</h2><ul>' + product + "</ul></div>" +
      '<div><h2>Resources</h2><ul>' + resources + "</ul></div>" +
      '<div><h2>Reference</h2><ul>' + ext + "</ul></div>" +
      "</div>" +
      '<div class="site-footer__legal">' +
      '<div>' + netPill() + "</div>" +
      "<p>Testnet demonstration on " + esc(n.name) + " (chain ID " + n.chainId + "). Not audited. Not a financial product. No funds are held.</p>" +
      "<p>Independent project. GIWA, Dojang and Bojagi are names of GIWA technologies that inspire this work; this site is not GIWA's native Bojagi private-transfer system.</p>" +
      "</div></div>";
  }

  /* --------------------------------------------------------- 4. UI primitives */
  var dialog;
  var lastTrigger = null;
  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.className = "modal";
    dialog.setAttribute("aria-labelledby", "modal-title");
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", function () {
      if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
    });
    document.body.appendChild(dialog);
    return dialog;
  }
  /** opts: { title, body (html), actions: [{label, variant, onClick, close}] } */
  function openModal(opts) {
    var d = ensureDialog();
    lastTrigger = document.activeElement;
    d.innerHTML =
      '<div class="modal__head"><h2 class="modal__title" id="modal-title">' + esc(opts.title) + "</h2>" +
      '<button type="button" class="modal__close" aria-label="Close dialog" data-close>' +
      '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.6" fill="none"/></svg></button></div>' +
      '<div class="modal__body">' + (opts.body || "") + '<div class="modal__actions"></div></div>';
    var actions = qs(".modal__actions", d);
    (opts.actions || []).forEach(function (a) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn " + (a.variant === "primary" ? "btn--primary" : a.variant === "ghost" ? "btn--ghost" : "btn--secondary");
      b.textContent = a.label;
      b.addEventListener("click", function () {
        if (a.onClick) a.onClick();
        if (a.close !== false) d.close();
      });
      actions.appendChild(b);
    });
    qs("[data-close]", d).addEventListener("click", function () {
      d.close();
    });
    if (typeof d.showModal === "function") d.showModal();
    else d.setAttribute("open", "");
  }

  var toastHost;
  function toast(message, tone) {
    if (!toastHost) {
      toastHost = document.createElement("div");
      toastHost.className = "toasts";
      toastHost.setAttribute("role", "status");
      toastHost.setAttribute("aria-live", "polite");
      document.body.appendChild(toastHost);
    }
    var t = document.createElement("div");
    t.className = "toast";
    t.setAttribute("data-tone", tone || "pending");
    t.innerHTML = '<i class="toast__dot" aria-hidden="true"></i><span>' + esc(message) + "</span>";
    toastHost.appendChild(t);
    setTimeout(function () {
      t.setAttribute("data-leaving", "true");
      setTimeout(function () {
        t.remove();
      }, 320);
    }, 4600);
  }

  function openWalletModal() {
    var s = ProtoState.get();
    var demoNote =
      '<div class="callout callout--demo"><div><strong>Prototype only.</strong> No wallet is contacted and nothing is signed. ' +
      "The production app will use a standard EVM wallet connector.</div></div>";

    if (s.wallet === "disconnected" || s.wallet === "connecting") {
      openModal({
        title: "Connect a wallet",
        body: demoNote + '<p class="muted small">Choose a simulated outcome to preview how the interface responds.</p>',
        actions: [
          {
            label: "Preview: connected on " + CONFIG.network.name,
            variant: "primary",
            onClick: function () {
              ProtoState.apply("unverified");
              toast("Simulated wallet connected. No real wallet involved.", "valid");
            },
          },
          {
            label: "Preview: connected on another network",
            onClick: function () {
              ProtoState.patch({ wallet: "wrong-network", dojang: "idle", demoCredential: false, proof: "credential-required", vault: "locked", tx: "idle" });
              toast("Simulated wrong network. Writes would be blocked.", "warn");
            },
          },
          { label: "Cancel", variant: "ghost" },
        ],
      });
      return;
    }

    var wrong = s.wallet === "wrong-network";
    openModal({
      title: "Simulated wallet",
      body:
        demoNote +
        '<dl class="kv"><div class="kv__row"><dt>Status</dt><dd>' + ProtoState.chip("wallet", s.wallet) + "</dd></div>" +
        '<div class="kv__row"><dt>Expected network</dt><dd>' + esc(CONFIG.network.name) + " (" + CONFIG.network.chainId + ")</dd></div></dl>",
      actions: [].concat(
        wrong
          ? [
              {
                label: "Switch to " + CONFIG.network.name,
                variant: "primary",
                onClick: function () {
                  ProtoState.apply("unverified");
                  toast("Simulated network switch.", "valid");
                },
              },
            ]
          : [],
        [
          {
            label: "Disconnect",
            onClick: function () {
              ProtoState.apply("disconnected");
              toast("Simulated wallet disconnected.", "pending");
            },
          },
          { label: "Close", variant: "ghost" },
        ]
      ),
    });
  }

  /* Tooltips for glossary terms: <button class="term" data-tip="..."> */
  function initTooltips() {
    var tip = document.createElement("div");
    tip.className = "tooltip";
    tip.id = "proto-tooltip";
    tip.setAttribute("role", "tooltip");
    document.body.appendChild(tip);
    var owner = null;

    function show(el) {
      owner = el;
      tip.textContent = el.getAttribute("data-tip");
      tip.setAttribute("data-open", "true");
      el.setAttribute("aria-describedby", tip.id);
      var r = el.getBoundingClientRect();
      var tw = tip.offsetWidth;
      var th = tip.offsetHeight;
      var left = Math.max(12, Math.min(window.innerWidth - tw - 12, r.left + r.width / 2 - tw / 2));
      var top = r.top - th - 10;
      if (top < 12) top = r.bottom + 10;
      tip.style.left = left + "px";
      tip.style.top = top + "px";
    }
    function hide() {
      if (owner) owner.removeAttribute("aria-describedby");
      owner = null;
      tip.removeAttribute("data-open");
    }
    document.addEventListener("pointerover", function (e) {
      var t = e.target.closest && e.target.closest(".term[data-tip]");
      if (t) show(t);
    });
    document.addEventListener("pointerout", function (e) {
      if (e.target.closest && e.target.closest(".term[data-tip]")) hide();
    });
    document.addEventListener("focusin", function (e) {
      var t = e.target.closest && e.target.closest(".term[data-tip]");
      if (t) show(t);
    });
    document.addEventListener("focusout", hide);
    document.addEventListener("click", function (e) {
      var t = e.target.closest && e.target.closest(".term[data-tip]");
      if (t) (owner === t ? hide : show)(t); // tap support on touch
      else hide();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") hide();
    });
    window.addEventListener("scroll", hide, { passive: true });
  }

  /* Scenario switcher (development-only) */
  function renderScenarioSwitcher() {
    var host = document.createElement("div");
    host.className = "scenarios";
    host.innerHTML =
      '<div class="scenarios__panel" id="scenario-panel" hidden role="group" aria-labelledby="scenario-title">' +
      '<div class="scenarios__title" id="scenario-title">Prototype scenarios</div>' +
      '<p class="scenarios__note">Preview how pages respond to each state. These are demonstrations, not live data.</p>' +
      '<div class="scenarios__grid"></div>' +
      '<div class="scenarios__readout" aria-live="polite"></div></div>' +
      '<button type="button" class="scenarios__toggle" aria-expanded="false" aria-controls="scenario-panel">' +
      '<i aria-hidden="true"></i>Scenarios <span data-scenario-name></span></button>';
    document.body.appendChild(host);

    var toggle = qs(".scenarios__toggle", host);
    var panel = qs(".scenarios__panel", host);
    var grid = qs(".scenarios__grid", host);
    var readout = qs(".scenarios__readout", host);

    SCENARIOS.forEach(function (sc) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "scenarios__btn";
      b.setAttribute("data-id", sc.id);
      b.setAttribute("aria-pressed", "false");
      b.textContent = sc.label;
      b.addEventListener("click", function () {
        ProtoState.apply(sc.id);
      });
      grid.appendChild(b);
    });

    function setOpen(open) {
      panel.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
    }
    toggle.addEventListener("click", function () {
      setOpen(panel.hidden);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) {
        setOpen(false);
        toggle.focus();
      }
    });
    document.addEventListener("click", function (e) {
      if (!panel.hidden && !host.contains(e.target) && !e.target.closest("[data-open-scenarios]")) setOpen(false);
      if (e.target.closest && e.target.closest("[data-open-scenarios]")) {
        setOpen(true);
        qs(".scenarios__btn", host).focus();
      }
    });

    ProtoState.subscribe(function (s) {
      var id = ProtoState.scenarioId();
      qsa(".scenarios__btn", host).forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.getAttribute("data-id") === id));
      });
      var sc = find(id);
      qs("[data-scenario-name]", host).textContent = sc ? "(" + sc.label + ")" : "(custom)";
      readout.innerHTML =
        ProtoState.chip("wallet", s.wallet) +
        ProtoState.chip("dojang", s.dojang) +
        ProtoState.chip("demo", s.demoCredential) +
        ProtoState.chip("proof", s.proof) +
        ProtoState.chip("vault", s.vault);
    });
  }

  /* ---------------------------------------------------------- 5. Environment */
  // The page is one continuous environment: the ambient glow takes the tone of the section in view.
  function initTone() {
    var sections = qsa("[data-tone]").filter(function (n) {
      return n !== document.body;
    });
    if (!sections.length || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) document.body.setAttribute("data-tone", e.target.getAttribute("data-tone"));
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );
    sections.forEach(function (s) {
      io.observe(s);
    });
  }

  // [data-inview] gets .is-inview once, for CSS-driven draw-in of diagrams
  function initInView() {
    var els = qsa("[data-inview]");
    if (!els.length) return;
    if (!("IntersectionObserver" in window) || reducedMotion()) {
      els.forEach(function (e) {
        e.classList.add("is-inview");
      });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("is-inview");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.2 }
    );
    els.forEach(function (e) {
      io.observe(e);
    });
  }

  /* Past the first screen the header draws itself in: the navigation collapses
     into a floating pill so it sits over content without a heavy bar. */
  function initHeaderScroll() {
    var header = qs(".site-header");
    if (!header) return;
    var raf = 0;
    var on = false;
    function check() {
      raf = 0;
      var next = window.scrollY > 40;
      if (next !== on) {
        on = next;
        header.setAttribute("data-scrolled", String(on));
      }
    }
    window.addEventListener(
      "scroll",
      function () {
        if (!raf) raf = requestAnimationFrame(check);
      },
      { passive: true }
    );
    check();
  }

  /* -------------------------------------------------------------------- boot */
  function boot() {
    readStore();
    qsa('[data-component="proto-bar"]').forEach(renderProtoBar);
    qsa('[data-component="site-header"]').forEach(renderHeader);
    qsa('[data-component="site-footer"]').forEach(renderFooter);
    renderScenarioSwitcher();
    initTooltips();
    initTone();
    initInView();
    initHeaderScroll();
  }

  window.Proto = {
    config: CONFIG,
    state: ProtoState,
    modal: { open: openModal },
    toast: toast,
    reducedMotion: reducedMotion,
    esc: esc,
    qs: qs,
    qsa: qsa,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
