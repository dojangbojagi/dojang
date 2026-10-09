/* ==========================================================================
   home.js: behaviour for 01-home.html

   Components (each maps to a future React component)
     CoverReveal        phase 1 opens into phase 2            -> CoverReveal
     DataField          character field + cloth under pointer -> DataField
     ProofPath          two-lane diagram with travelling payload -> ProtocolHero / ProtocolArchitecture
     HowItWorks         step tabs driving the architecture SVG -> ProtocolArchitecture
     EligibilityDemo    private vs public illustration         -> EligibilityPolicySelector (illustration)
     VaultGate          gate that mirrors the vault state      -> VaultAccessPanel (preview)

   Nothing here talks to a blockchain. All status shown is derived from
   Proto.state, the simulated scenario store in app.js.
   ========================================================================== */
(function () {
  "use strict";
  var P = window.Proto;
  if (!P) return;
  var qs = P.qs;
  var qsa = P.qsa;
  var esc = P.esc;
  var NS = "http://www.w3.org/2000/svg";

  function chip(tone, label) {
    return '<span class="status" data-state="' + tone + '"><i class="status__dot" aria-hidden="true"></i>' + esc(label) + "</span>";
  }
  function skeleton(label) {
    return '<span class="skeleton" aria-label="Checking">' + esc(label || "Checking") + "</span>";
  }

  /* ------------------------------------------------------------ CoverReveal */
  /* Phase 1 to phase 2. The square sitting in the sentence is the opening;
     scrolling widens it until it fills the screen. Everything the CSS animates
     reads from --p (0 to 1) and the four clip insets written here.
     Skipped entirely under reduced motion, where the two phases just stack. */
  function initCover() {
    var cover = qs("[data-cover]");
    if (!cover || P.reducedMotion()) return;
    var stage = qs("[data-cover-stage]", cover);
    var slot = qs("[data-cover-slot]", cover);
    if (!stage || !slot) return;
    if (!window.CSS || !CSS.supports || !CSS.supports("clip-path", "inset(1px round 1px)")) return;

    cover.setAttribute("data-cover-on", "");

    var geo = null;
    var raf = 0;
    var last = -1;

    /* offsetLeft and offsetTop are layout values, so the transforms on the
       neighbouring words can never skew the measurement. */
    function measure() {
      geo = {
        sw: stage.clientWidth,
        sh: stage.clientHeight,
        x: slot.offsetLeft,
        y: slot.offsetTop,
        w: slot.offsetWidth,
        h: slot.offsetHeight,
      };
      last = -1;
    }

    function ease(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function paint() {
      raf = 0;
      if (!geo || !geo.sw || !geo.sh) measure();
      if (!geo.sh) return;

      var r = cover.getBoundingClientRect();
      var run = r.height - geo.sh;
      var p = run > 0 ? -r.top / run : 1;
      p = p < 0 ? 0 : p > 1 ? 1 : p;
      if (Math.abs(p - last) < 0.0008) return;
      last = p;

      var e = ease(p);
      var k = 1 - e;
      var l = geo.x * k;
      var t = geo.y * k;
      var ri = (geo.sw - geo.x - geo.w) * k;
      var b = (geo.sh - geo.y - geo.h) * k;
      var st = stage.style;
      st.setProperty("--p", p.toFixed(4));
      st.setProperty("--ct", t.toFixed(1) + "px");
      st.setProperty("--cr", ri.toFixed(1) + "px");
      st.setProperty("--cb", b.toFixed(1) + "px");
      st.setProperty("--cl", l.toFixed(1) + "px");
      st.setProperty("--crad", (5 * k).toFixed(2) + "px");
      st.setProperty("--bx", l.toFixed(1) + "px");
      st.setProperty("--by", t.toFixed(1) + "px");
      st.setProperty("--bw", (geo.sw - l - ri).toFixed(1) + "px");
      st.setProperty("--bh", (geo.sh - t - b).toFixed(1) + "px");
      /* keeps the hero's links out of the tab order until they are visible */
      stage.setAttribute("data-reveal", p > 0.5 ? "1" : "0");
    }

    function schedule() {
      if (!raf) raf = requestAnimationFrame(paint);
    }

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", function () {
      measure();
      schedule();
    });
    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        measure();
        schedule();
      }).observe(stage);
    }
    measure();
    paint();
  }

  /* -------------------------------------------------------------- DataField */
  /* The hero background: a field of public characters, and a patch of bojagi
     cloth that follows the pointer and covers them. It is the product in one
     gesture: the data is there, you simply do not have to show it.
     Decorative only, and marked aria-hidden in the markup. */
  var CLOTH = [
    [154, 165, 255],
    [134, 214, 189],
    [230, 195, 110],
    [150, 96, 112],
    [92, 107, 208],
  ];

  function initField() {
    var cv = qs("[data-field]");
    var hero = qs("[data-hero]");
    if (!cv || !hero || !cv.getContext) return;
    var ctx = cv.getContext("2d");
    if (!ctx) return;

    var off = document.createElement("canvas");
    var octx = off.getContext("2d");
    if (!octx) return;

    var GLYPHS = "0123456789abcdef";
    var still = P.reducedMotion();
    var auto = !still && window.matchMedia("(hover: hover)").matches === false;

    var dpr = 1;
    var cw = 0;
    var chh = 0;
    var cols = 0;
    var rows = 0;
    var cellW = 14;
    var cellH = 18;
    var cov = null;
    var tint = null;
    var ptr = { x: -9999, y: -9999, on: false };
    var raf = 0;
    var inView = true;
    var t0 = Date.now();

    /* One stable pseudo-random value per cell, so the field never reshuffles */
    function rnd(i) {
      var x = Math.sin(i * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    }

    function build() {
      var r = hero.getBoundingClientRect();
      cw = Math.max(320, Math.round(r.width));
      chh = Math.max(360, Math.round(r.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cellW = cw < 760 ? 11 : 14;
      cellH = Math.round(cellW * 1.3);
      cols = Math.ceil(cw / cellW);
      rows = Math.ceil(chh / cellH);

      cv.width = off.width = Math.round(cw * dpr);
      cv.height = off.height = Math.round(chh * dpr);
      cov = new Float32Array(cols * rows);
      tint = new Uint8Array(cols * rows);

      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      octx.clearRect(0, 0, cw, chh);
      octx.font = cellW - 3 + 'px "JetBrains Mono", ui-monospace, monospace';
      octx.textBaseline = "middle";

      /* A square of denser characters, echoing the opening from phase 1 */
      var half = (Math.min(cw, chh) * 0.86) / 2;
      var scx = cw * 0.58;
      var scy = chh * 0.46;

      for (var y = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++) {
          var i = y * cols + x;
          tint[i] = Math.floor(rnd(i + 313) * CLOTH.length);

          var px = x * cellW + cellW / 2;
          var py = y * cellH + cellH / 2;
          var d = Math.max(Math.abs(px - scx), Math.abs(py - scy)) / half;
          var inside = d <= 1;
          var density = inside ? 0.86 : Math.max(0, 0.4 - (d - 1) * 0.55);
          var r1 = rnd(i);
          if (r1 > density) continue;

          var r2 = rnd(i + 7777);
          var seam = inside && d > 0.94;
          var a = inside ? (seam ? 0.46 : 0.13 + r2 * 0.14) : 0.07 + r2 * 0.06;
          var col = "238,235,225";
          if (r2 > 0.955) col = "134,214,189";
          else if (r2 > 0.915) col = "230,195,110";
          else if (r2 > 0.82) col = "154,165,255";

          octx.fillStyle = "rgba(" + col + "," + a.toFixed(3) + ")";
          octx.fillText(GLYPHS.charAt(Math.floor(rnd(i + 99) * 16)), x * cellW + 1, py);
        }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint();
    }

    function paint() {
      raf = 0;
      ctx.clearRect(0, 0, cw, chh);
      ctx.drawImage(off, 0, 0, cw, chh);

      if (still) return;

      if (auto) {
        var tt = (Date.now() - t0) / 1000;
        ptr.on = true;
        ptr.x = cw * (0.52 + 0.3 * Math.sin(tt * 0.31));
        ptr.y = chh * (0.5 + 0.24 * Math.sin(tt * 0.19 + 1.3));
      }

      var rad = cw < 760 ? 86 : 132;
      var alive = 0;

      for (var y = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++) {
          var i = y * cols + x;
          var c = cov[i];
          var target = 0;
          if (ptr.on) {
            var dx = x * cellW + cellW / 2 - ptr.x;
            var dy = y * cellH + cellH / 2 - ptr.y;
            var dd = Math.sqrt(dx * dx + dy * dy) / rad;
            if (dd < 1) target = 1 - dd * dd;
          }
          /* Cloth settles quickly and lifts slowly */
          c += (target - c) * (target > c ? 0.3 : 0.045);
          if (c < 0.005) {
            cov[i] = 0;
            continue;
          }
          cov[i] = c;
          alive++;

          var gx = x * cellW;
          var gy = y * cellH;
          var t = CLOTH[tint[i]];
          ctx.fillStyle = "rgba(10,14,31," + (c * 0.84).toFixed(3) + ")";
          ctx.fillRect(gx, gy, cellW - 1, cellH - 1);
          ctx.fillStyle = "rgba(" + t[0] + "," + t[1] + "," + t[2] + "," + (c * 0.3).toFixed(3) + ")";
          ctx.fillRect(gx, gy, cellW - 1, cellH - 1);
        }
      }

      if (inView && (alive > 0 || ptr.on)) schedule();
    }

    function schedule() {
      if (!raf && inView) raf = requestAnimationFrame(paint);
    }

    if (!still && window.matchMedia("(pointer: fine)").matches) {
      hero.addEventListener("pointermove", function (e) {
        var r = hero.getBoundingClientRect();
        ptr.x = e.clientX - r.left;
        ptr.y = e.clientY - r.top;
        ptr.on = true;
        /* the faint light behind the copy follows the same point */
        hero.style.setProperty("--mx", ptr.x + "px");
        hero.style.setProperty("--my", ptr.y + "px");
        schedule();
      });
      hero.addEventListener("pointerleave", function () {
        ptr.on = false;
        schedule();
      });
    }

    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        if (inView) schedule();
      }).observe(hero);
    }

    var rt = 0;
    function onResize() {
      clearTimeout(rt);
      rt = setTimeout(build, 180);
    }
    window.addEventListener("resize", onResize);
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(hero);

    build();
    if (auto) schedule();
    /* the field is drawn with the mono face, so redraw once it has loaded */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(build).catch(function () {});
  }

  /* --------------------------------------------------------------- ProofPath */
  var STAGES = [
    {
      id: 1,
      name: "Trusted state",
      lines: ["An issuer vouches for", "a fact about your wallet"],
      where: "On your device",
      text: "A trusted issuer vouches for a fact about your wallet. You receive the private details and they stay with you.",
      pub: ["Your wallet address"],
      priv: ["The value and a random salt", "Known to you and the issuer only"],
    },
    {
      id: 2,
      name: "Attestation",
      lines: ["A sealed fingerprint is", "registered on-chain"],
      where: "On-chain",
      text: "The issuer registers a sealed fingerprint of the fact, called a commitment. The value itself is never published.",
      pub: ["The commitment", "The wallet it is bound to", "Expiry and revocation status"],
      priv: ["The value", "The salt"],
    },
    {
      id: 3,
      name: "Private proof",
      lines: ["Your device proves the", "fact meets the rule"],
      where: "On your device",
      text: "Your device proves that the sealed fact meets the policy and matches the on-chain commitment, without sending the value anywhere.",
      pub: ["The policy and its threshold", "The proof itself"],
      priv: ["The value", "The salt"],
    },
    {
      id: 4,
      name: "Verified execution",
      lines: ["A contract checks the", "proof and records access"],
      where: "On-chain",
      text: "The vault contract checks the sender, the commitment, the policy and the proof in one transaction, then records access.",
      pub: ["The proof and public inputs", "Your wallet address", "The access result and transaction"],
      priv: ["The value stays unpublished"],
    },
  ];

  var COLORS = ["#86d6bd", "#86d6bd", "#9aa5ff", "#e6c36e"];

  // What the travelling payload carries, per phase of the loop
  var TIMELINE = [
    { type: "dwell", node: 0, dur: 1400, pill: "value and salt stay here" },
    { type: "move", seg: 0, dur: 1800, pill: "commitment only" },
    { type: "dwell", node: 1, dur: 1300, pill: "commitment on-chain" },
    { type: "move", seg: 1, dur: 1800, pill: "commitment read back" },
    { type: "dwell", node: 2, dur: 1300, pill: "proof built locally" },
    { type: "move", seg: 2, dur: 1800, pill: "proof, never the value" },
    { type: "dwell", node: 3, dur: 2200, pill: "access recorded" },
  ];

  var GLYPHS = {
    1:
      '<g class="pp-glyph"><rect class="soft" x="-21" y="-3" width="34" height="22" rx="2.5"/><rect class="soft" x="-17" y="-11" width="34" height="22" rx="2.5"/>' +
      '<rect class="paper" x="-13" y="-19" width="34" height="22" rx="2.5"/><path d="M-6 -11h20M-6 -5h13"/></g>',
    2:
      '<g class="pp-glyph"><rect x="-21" y="-21" width="42" height="42" rx="3"/>' +
      '<path class="solid" d="M-13 -13h11v15h-11zM2 -13h11v7H2zM2 -2h11v15H2zM-13 6h11v7h-11z"/></g>',
    3:
      '<g class="pp-glyph"><rect class="soft" x="-22" y="-22" width="44" height="44" rx="3"/>' +
      '<path d="M-22 -5H3M3 -22V9M-5 9H22M-5 9V22M-22 8H-5"/>' +
      '<rect class="paper dashed" x="-10" y="-10" width="20" height="20" rx="1.5"/><path d="M-4 -4.5l8 3.5-8 3.5M-4 6h8"/></g>',
    4:
      '<g class="pp-glyph"><path d="M-21 23V-3a21 21 0 0 1 42 0V23"/><path class="soft" d="M-13 23V-2a13 13 0 0 1 13-13V23z"/>' +
      '<path class="soft" d="M13 23V-2a13 13 0 0 0-13-13V23z" transform="translate(3 0)"/><path class="solid" d="M-5 -29h10l3 7h-16z"/></g>',
  };

  var LAYOUTS = {
    wide: {
      vb: [1200, 508],
      nodes: [
        { x: 200, y: 348 },
        { x: 470, y: 92 },
        { x: 750, y: 348 },
        { x: 1030, y: 92 },
      ],
      curve: "h",
      lanes: [
        { cls: "pp-lane--public", x: 0, y: 0, w: 1200, h: 214 },
        { cls: "pp-lane--private", x: 0, y: 226, w: 1200, h: 282 },
      ],
      boundary: "M0 220H1200",
      laneLabels: [
        { x: 10, y: 24, t: "Public: on GIWA Sepolia", anchor: "start" },
        { x: 10, y: 500, t: "Private: stays on your device", anchor: "start" },
      ],
      crossLabels: [
        { dx: 16, dy: 24, t: "commitment only" },
        { dx: 16, dy: -12, t: "commitment read back" },
        { dx: 16, dy: 24, t: "proof, not the value" },
      ],
    },
    tall: {
      vb: [360, 906],
      nodes: [
        { x: 74, y: 118 },
        { x: 286, y: 332 },
        { x: 74, y: 546 },
        { x: 286, y: 760 },
      ],
      curve: "v",
      lanes: [
        { cls: "pp-lane--private", x: 0, y: 0, w: 174, h: 906 },
        { cls: "pp-lane--public", x: 186, y: 0, w: 174, h: 906 },
      ],
      boundary: "M180 0V906",
      laneLabels: [
        { x: 6, y: 20, t: "Private: your device", anchor: "start" },
        { x: 354, y: 20, t: "Public: GIWA Sepolia", anchor: "end" },
      ],
      crossLabels: [
        { dx: 14, dy: -14, t: "commitment only" },
        { dx: 14, dy: 36, t: "commitment read back" },
        { dx: 14, dy: -14, t: "proof, not the value" },
      ],
    },
  };

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function hexToRgb(h) {
    var n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mixColor(a, b, t) {
    var A = hexToRgb(a);
    var B = hexToRgb(b);
    return "rgb(" + Math.round(lerp(A[0], B[0], t)) + "," + Math.round(lerp(A[1], B[1], t)) + "," + Math.round(lerp(A[2], B[2], t)) + ")";
  }
  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function segmentPath(a, b, mode) {
    if (mode === "h") {
      var xm = (a.x + b.x) / 2;
      return "M" + a.x + " " + a.y + " C" + xm + " " + a.y + " " + xm + " " + b.y + " " + b.x + " " + b.y;
    }
    /* Stacked layout: leave each node toward the lower corner so the curve clears the stage text underneath */
    var s = b.x > a.x ? 1 : -1;
    var dx = 110;
    var dy = 60;
    return "M" + a.x + " " + a.y + " C" + (a.x + s * dx) + " " + (a.y + dy) + " " + (b.x - s * dx) + " " + (b.y - dy) + " " + b.x + " " + b.y;
  }

  function ProofPath(root) {
    var canvas = qs("[data-pp-canvas]", root);
    var detail = qs("[data-pp-detail]", root);
    var toggle = qs("[data-pp-toggle]", root);
    var mq = window.matchMedia("(min-width: 900px)");

    var svg, layout, segEls, nodeEls, packet, pill, pillRect, pillText, segLens, total;
    var selected = 1;
    var playing = !P.reducedMotion();
    var inView = true;
    var raf = 0;
    var t0 = null;
    var offset = 0;
    var lastHit = -1;

    function build() {
      stop();
      var orient = mq.matches ? "wide" : "tall";
      layout = LAYOUTS[orient];
      canvas.setAttribute("data-orient", orient);
      var vb = layout.vb;
      var n = layout.nodes;
      var out = "";

      out += '<svg viewBox="0 0 ' + vb[0] + " " + vb[1] + '" role="group" aria-label="Proof path: four stages from trusted state to verified execution. Select a stage for details.">';
      out += "<defs>";
      for (var g = 0; g < 3; g++) {
        out +=
          '<linearGradient id="ppg-' + orient + g + '" gradientUnits="userSpaceOnUse" x1="' + n[g].x + '" y1="' + n[g].y + '" x2="' + n[g + 1].x + '" y2="' + n[g + 1].y + '">' +
          '<stop offset="0" stop-color="' + COLORS[g] + '"/><stop offset="1" stop-color="' + COLORS[g + 1] + '"/></linearGradient>';
      }
      out += "</defs>";

      layout.lanes.forEach(function (l) {
        out += '<rect class="pp-lane ' + l.cls + '" x="' + l.x + '" y="' + l.y + '" width="' + l.w + '" height="' + l.h + '"/>';
      });
      out += '<path class="pp-boundary" d="' + layout.boundary + '"/>';
      layout.laneLabels.forEach(function (l) {
        out += '<text class="pp-lanelabel" x="' + l.x + '" y="' + l.y + '" text-anchor="' + l.anchor + '">' + esc(l.t) + "</text>";
      });

      var paths = [];
      for (var s = 0; s < 3; s++) paths.push(segmentPath(n[s], n[s + 1], layout.curve));
      paths.forEach(function (d, i) {
        out += '<path class="pp-seg" data-seg="' + i + '" style="--i:' + i + '" d="' + d + '" stroke="url(#ppg-' + orient + i + ')"/>';
      });

      // boundary crossings: the midpoint of each segment sits on the boundary line
      for (var c = 0; c < 3; c++) {
        var cx = (n[c].x + n[c + 1].x) / 2;
        var cy = (n[c].y + n[c + 1].y) / 2;
        var cl = layout.crossLabels[c];
        out += '<rect class="pp-cross" x="-5" y="-5" width="10" height="10" transform="translate(' + cx + " " + cy + ') rotate(45)"/>';
        out += '<text class="pp-crosslabel" x="' + (cx + cl.dx) + '" y="' + (cy + cl.dy) + '">' + esc(cl.t) + "</text>";
      }

      STAGES.forEach(function (st, i) {
        var p = n[i];
        out +=
          '<g class="pp-node" data-stage="' + st.id + '" role="button" tabindex="0" aria-pressed="false" ' +
          'aria-label="Stage ' + st.id + ": " + esc(st.name) + '. Select for details." transform="translate(' + p.x + " " + p.y + ')">' +
          '<circle class="pp-ping" r="46"/><circle class="pp-ring" r="50"/><circle class="pp-disc" r="43"/>' +
          GLYPHS[st.id] +
          '<circle class="pp-status" r="7" cx="35" cy="-35" data-state="neutral"/>' +
          '<text class="pp-title" y="78" text-anchor="middle">' + esc(st.name) + "</text>" +
          '<text class="pp-sub" y="99" text-anchor="middle">' + esc(st.lines[0]) + "</text>" +
          '<text class="pp-sub" y="116" text-anchor="middle">' + esc(st.lines[1]) + "</text></g>";
      });

      out +=
        '<g class="pp-packet" aria-hidden="true"><circle class="pp-halo" r="13"/><circle class="pp-core" r="5.5"/></g>' +
        '<g class="pp-pill" aria-hidden="true"><rect height="26" rx="13"/><text text-anchor="middle" dominant-baseline="central" y="13"></text></g>';
      out += "</svg>";

      canvas.innerHTML = out;
      svg = qs("svg", canvas);
      segEls = qsa(".pp-seg", svg);
      nodeEls = qsa(".pp-node", svg);
      packet = qs(".pp-packet", svg);
      pill = qs(".pp-pill", svg);
      pillRect = qs("rect", pill);
      pillText = qs("text", pill);

      segLens = segEls.map(function (el) {
        var len = el.getTotalLength();
        el.style.setProperty("--len", String(Math.ceil(len)));
        return len;
      });
      total = TIMELINE.reduce(function (a, p) {
        return a + p.dur;
      }, 0);

      nodeEls.forEach(function (el) {
        var id = Number(el.getAttribute("data-stage"));
        el.addEventListener("click", function () {
          select(id, true);
        });
        el.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            select(id, true);
          }
        });
      });

      applySelection();
      renderStatus();
      requestAnimationFrame(function () {
        svg.classList.add("pp-built");
      });
      svg.classList.toggle("pp-built", false);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (svg) svg.classList.add("pp-built");
        });
      });

      if (playing) start();
      else renderAt(phaseStart(0) + 200);
      syncToggle();
    }

    /* timeline helpers */
    function phaseStart(index) {
      var s = 0;
      for (var i = 0; i < index; i++) s += TIMELINE[i].dur;
      return s;
    }
    function dwellIndexFor(node) {
      for (var i = 0; i < TIMELINE.length; i++) if (TIMELINE[i].type === "dwell" && TIMELINE[i].node === node) return i;
      return 0;
    }

    function renderAt(el) {
      var acc = 0;
      var phase = TIMELINE[0];
      var local = 0;
      for (var i = 0; i < TIMELINE.length; i++) {
        if (el < acc + TIMELINE[i].dur) {
          phase = TIMELINE[i];
          local = el - acc;
          break;
        }
        acc += TIMELINE[i].dur;
        phase = TIMELINE[i];
        local = TIMELINE[i].dur;
      }

      var x, y, color, dw;
      var n = layout.nodes;
      if (phase.type === "dwell") {
        x = n[phase.node].x;
        y = n[phase.node].y;
        color = COLORS[phase.node];
        dw = 1;
        if (lastHit !== phase.node) {
          lastHit = phase.node;
          var nodeEl = nodeEls[phase.node];
          nodeEl.classList.remove("is-hit");
          void nodeEl.getBoundingClientRect();
          nodeEl.classList.add("is-hit");
        }
      } else {
        var t = easeInOut(local / phase.dur);
        var seg = segEls[phase.seg];
        var pt = seg.getPointAtLength(segLens[phase.seg] * t);
        x = pt.x;
        y = pt.y;
        color = mixColor(COLORS[phase.seg], COLORS[phase.seg + 1], t);
        var raw = local / phase.dur;
        dw = 1 - Math.min(1, Math.min(raw, 1 - raw) * 5);
        if (raw > 0.5) lastHit = -1;
      }

      var alpha = 1;
      if (el < 250) alpha = el / 250;
      if (el > total - 350) alpha = Math.max(0, (total - el) / 350);

      packet.setAttribute("transform", "translate(" + x.toFixed(1) + " " + y.toFixed(1) + ")");
      packet.style.setProperty("--pc", color);
      packet.style.opacity = String(alpha);

      if (pillText.textContent !== phase.pill) {
        pillText.textContent = phase.pill;
        var w = pillText.getComputedTextLength() + 26;
        pillRect.setAttribute("width", w.toFixed(1));
        pillText.setAttribute("x", (w / 2).toFixed(1));
        pill.setAttribute("data-w", w.toFixed(1));
      }
      var pw = Number(pill.getAttribute("data-w")) || 120;
      var off = 36 + 32 * dw;
      var px = Math.max(6, Math.min(layout.vb[0] - pw - 6, x - pw / 2));
      var py = Math.max(4, y - off - 13);
      pill.setAttribute("transform", "translate(" + px.toFixed(1) + " " + py.toFixed(1) + ")");
      pill.style.setProperty("--pc", color);
      pill.style.opacity = String(alpha);
    }

    function frame(now) {
      raf = 0;
      if (!playing || !inView) return;
      if (t0 === null) t0 = now - offset;
      var el = (now - t0) % total;
      renderAt(el);
      raf = requestAnimationFrame(frame);
    }
    function start() {
      if (raf || !inView) return;
      t0 = null;
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    function setPlaying(next) {
      if (next === playing) return;
      if (next) {
        playing = true;
        start();
      } else {
        // freeze at the current position
        if (t0 !== null) offset = (performance.now() - t0) % total;
        playing = false;
        stop();
      }
      syncToggle();
    }
    function syncToggle() {
      toggle.textContent = playing ? "Pause animation" : "Play animation";
    }

    function select(id, fromUser) {
      selected = id;
      applySelection();
      renderDetail();
      if (fromUser) {
        setPlaying(false);
        var idx = dwellIndexFor(id - 1);
        offset = phaseStart(idx) + 300;
        lastHit = id - 1;
        renderAt(offset);
      }
    }
    function applySelection() {
      nodeEls.forEach(function (el) {
        el.setAttribute("aria-pressed", String(Number(el.getAttribute("data-stage")) === selected));
      });
    }

    /* status and detail, driven by the simulated scenario state */
    function stageStatus(i, s) {
      if (i === 1) {
        if (s.demoCredential) return { tone: "demo", label: "Demo credential ready" };
        if (s.dojang === "official-verified") return { tone: "valid", label: "Official credential found" };
        if (s.wallet === "disconnected") return { tone: "neutral", label: "Connect a wallet to start" };
        if (s.wallet === "wrong-network") return { tone: "warn", label: "Switch to GIWA Sepolia" };
        return { tone: "neutral", label: "No credential yet" };
      }
      if (i === 2) {
        return s.demoCredential
          ? { tone: "demo", label: "Commitment registered by demo issuer" }
          : { tone: "neutral", label: "Nothing registered" };
      }
      if (i === 3) return { tone: P.state.tone("proof", s.proof), label: P.state.label("proof", s.proof) };
      return { tone: P.state.tone("vault", s.vault), label: P.state.label("vault", s.vault) };
    }

    function renderStatus() {
      if (!svg) return;
      var s = P.state.get();
      nodeEls.forEach(function (el, idx) {
        var st = stageStatus(idx + 1, s);
        qs(".pp-status", el).setAttribute("data-state", st.tone);
      });
    }

    function renderDetail() {
      var st = STAGES[selected - 1];
      var s = P.state.get();
      var status = stageStatus(selected, s);
      var statusHtml = P.state.isLoading() ? skeleton("Checking credentials") : chip(status.tone, status.label);
      detail.innerHTML =
        "<div>" +
        '<h3 class="pp-detail__title">' + esc(st.name) + "</h3>" +
        '<p class="pp-detail__text">' + esc(st.text) + "</p>" +
        '<div class="pp-detail__meta">' + statusHtml + '<span class="pp-detail__where">' + esc(st.where) + "</span></div>" +
        '<p class="pp-detail__note">Status comes from the selected prototype scenario. It is simulated.</p>' +
        "</div>" +
        '<div class="pp-cols">' +
        '<div><h4>Public</h4><ul class="pp-list pp-list--public">' + st.pub.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul></div>" +
        '<div><h4>Private</h4><ul class="pp-list pp-list--private">' + st.priv.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul></div>" +
        "</div>";
    }

    toggle.addEventListener("click", function () {
      setPlaying(!playing);
    });
    mq.addEventListener("change", build);

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        function (entries) {
          inView = entries[0].isIntersecting;
          if (inView && playing) start();
          if (!inView) {
            if (t0 !== null && playing) offset = (performance.now() - t0) % total;
            stop();
          }
        },
        { threshold: 0.05 }
      ).observe(root);
    }

    P.state.subscribe(function () {
      renderStatus();
      renderDetail();
    });

    build();
    renderDetail();
  }

  /* -------------------------------------------------------------- HowItWorks */
  var HOW = [
    {
      title: "Connect",
      text: "Connect an EVM wallet and switch to GIWA Sepolia (chain ID 91342). Nothing is written yet. This step only establishes who is asking and on which network.",
      you: "Approve the connection and switch network if asked.",
      system: "Blocks writes on any other network.",
    },
    {
      title: "Verify",
      text: "The app reads your Verified Address from official Dojang. “No credential found” is a valid answer, because official issuance is not available to arbitrary wallets. A separate, labelled demo credential supports the testnet path.",
      you: "Review what was found and who issued it.",
      system: "Reads attestations and the credential registry. A network error is shown as an error, never as “not verified”.",
    },
    {
      title: "Prove",
      text: "Choose a policy. Your device builds a proof that your sealed value meets the threshold and matches the commitment registered on-chain.",
      you: "Load your issuer-provided credential and generate the proof.",
      system: "Keeps the value on your device. Only the proof and public inputs leave it.",
    },
    {
      title: "Execute",
      text: "Submit the proof in one transaction. The vault checks the sender, the commitment, the policy and the verifier before it records access.",
      you: "Sign the transaction.",
      system: "Reverts if any check fails. Access is shown only after a confirmed receipt.",
    },
  ];

  function initHow() {
    var root = qs("[data-how]");
    if (!root) return;
    var tabs = qsa('[role="tab"]', root);
    var panel = qs("[data-how-panel]", root);
    var diagram = qs("[data-how-diagram]", root);

    function show(step, focus) {
      tabs.forEach(function (t, i) {
        var on = i + 1 === step;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        if (on) {
          panel.setAttribute("aria-labelledby", t.id);
          if (focus) t.focus();
        }
      });
      var h = HOW[step - 1];
      panel.innerHTML =
        "<h3>" + esc(h.title) + "</h3><p>" + esc(h.text) + "</p>" +
        '<dl class="how__roles"><div><dt>You</dt><dd>' + esc(h.you) + "</dd></div>" +
        "<div><dt>The system</dt><dd>" + esc(h.system) + "</dd></div></dl>";
      diagram.setAttribute("data-step", String(step));
    }

    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () {
        show(i + 1, false);
      });
      t.addEventListener("keydown", function (e) {
        var next = null;
        if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (i + 1) % tabs.length;
        if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
        if (e.key === "Home") next = 0;
        if (e.key === "End") next = tabs.length - 1;
        if (next !== null) {
          e.preventDefault();
          show(next + 1, true);
        }
      });
    });
    show(1, false);
  }

  /* --------------------------------------------------------- EligibilityDemo */
  function initDemo() {
    var root = qs("[data-showcase]");
    if (!root) return;
    var radios = qsa('[role="radio"]', root);
    var run = qs("[data-sc-run]", root);
    var valueEl = qs("[data-sc-value]", root);
    var elig = qs("[data-sc-eligibility]", root);
    var note = qs("[data-sc-note]", root);
    var phaseEls = qsa("[data-phase-id]", root);
    var timers = [];

    var VALUES = { meets: "1,240", below: "640" };
    var ORDER = ["witness", "proof", "verify", "result"];

    function clear() {
      timers.forEach(clearTimeout);
      timers = [];
    }

    function paint() {
      var phase = root.getAttribute("data-phase");
      var value = root.getAttribute("data-value");
      valueEl.textContent = VALUES[value];

      // phase chips
      var idx = ORDER.indexOf(phase);
      phaseEls.forEach(function (el, i) {
        var state = "";
        if (phase === "blocked") state = i === 0 ? "done" : i === 1 ? "blocked" : "";
        else if (phase !== "idle") state = i < idx ? "done" : i === idx ? (phase === "result" ? "done" : "active") : "";
        if (state) el.setAttribute("data-state", state);
        else el.removeAttribute("data-state");
      });

      var e = { tone: "neutral", label: "Not checked yet" };
      var n = "Choose a case, then run the illustration.";
      if (phase === "witness") { e = { tone: "pending", label: "Pending" }; n = "The holder's device loads the sealed credential. Nothing has left the device."; }
      if (phase === "proof") { e = { tone: "pending", label: "Pending" }; n = "The device builds a proof. Only the proof leaves the device, never the value."; }
      if (phase === "verify") { e = { tone: "pending", label: "Checking" }; n = "A contract would check the proof against the commitment registered on-chain."; }
      if (phase === "result") { e = { tone: "valid", label: "Satisfied" }; n = "The chain learns one thing: the holder meets the minimum. The exact value stays private."; }
      if (phase === "blocked") { e = { tone: "warn", label: "No proof possible" }; n = "The value is below the threshold, so no valid proof can be produced and nothing is submitted. The value is still not revealed."; }
      elig.innerHTML = chip(e.tone, e.label);
      note.textContent = n;
    }

    function set(phase) {
      root.setAttribute("data-phase", phase);
      paint();
    }

    function setValue(v) {
      clear();
      radios.forEach(function (r) {
        var on = r.getAttribute("data-value") === v;
        r.setAttribute("aria-checked", String(on));
        r.tabIndex = on ? 0 : -1;
      });
      root.setAttribute("data-value", v);
      set("idle");
      run.disabled = false;
    }

    radios.forEach(function (r, i) {
      r.addEventListener("click", function () {
        setValue(r.getAttribute("data-value"));
      });
      r.addEventListener("keydown", function (e) {
        var k = e.key;
        if (k === "ArrowRight" || k === "ArrowDown" || k === "ArrowLeft" || k === "ArrowUp") {
          e.preventDefault();
          var j = (i + (k === "ArrowRight" || k === "ArrowDown" ? 1 : -1) + radios.length) % radios.length;
          radios[j].focus();
          setValue(radios[j].getAttribute("data-value"));
        }
      });
    });

    run.addEventListener("click", function () {
      clear();
      var meets = root.getAttribute("data-value") === "meets";
      if (P.reducedMotion()) {
        set(meets ? "result" : "blocked");
        return;
      }
      run.disabled = true;
      set("witness");
      if (meets) {
        timers.push(setTimeout(function () { set("proof"); }, 1000));
        timers.push(setTimeout(function () { set("verify"); }, 2300));
        timers.push(setTimeout(function () { set("result"); run.disabled = false; }, 3500));
      } else {
        timers.push(setTimeout(function () { set("blocked"); run.disabled = false; }, 1200));
      }
    });

    setValue("meets");
  }

  /* --------------------------------------------------------------- VaultGate */
  function initGate() {
    var gate = qs("[data-vault-gate]");
    var systems = qs("[data-sys-dojang-status]");
    P.state.subscribe(function (s) {
      if (gate) {
        var g = s.vault === "access-granted" || s.vault === "previously-granted" ? "granted" : s.vault === "eligible" ? "eligible" : "locked";
        gate.setAttribute("data-gate", g);
        var c = qs("[data-gate-chip]", gate);
        if (c) c.innerHTML = P.state.isLoading() ? skeleton("Updating") : P.state.chip("vault", s.vault);
      }
      if (systems) {
        systems.innerHTML = P.state.isLoading() ? skeleton("Checking") : P.state.chip("dojang", s.dojang);
      }
    });
  }

  /* -------------------------------------------------------------------- boot */
  function boot() {
    initCover();
    initField();
    var pp = qs("[data-proofpath]");
    if (pp) ProofPath(pp);
    initHow();
    initDemo();
    initGate();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
