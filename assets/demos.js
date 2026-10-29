/* demos.js — the interactive figures of the Visual Sentinel site.
 * Plain script (no modules, no dependencies) so pages also work when opened from disk.
 * A demo is any element with data-demo="<name>"; it is filled in on load.
 * Conventions match vsim/geometry.py: world = ENU (x East, y North, z Up); heading is a
 * compass bearing (clockwise from North); pitch is the elevation of the optical axis. */
(function () {
  'use strict';
  var D2R = Math.PI / 180;
  var css = function (name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#333'; };
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gauss(rng) { var u = 0, v = 0; while (!u) u = rng(); while (!v) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function canvas(box, w, h) {
    var cv = el('canvas'), r = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = w * r; cv.height = h * r; cv.style.maxWidth = w + 'px'; cv.style.aspectRatio = w + ' / ' + h; cv._w = w; cv._h = h;
    box.appendChild(cv); var g = cv.getContext('2d'); g.scale(r, r); return [cv, g];
  }
  function pointerPos(cv, e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv._w / r.width, (e.clientY - r.top) * cv._h / r.height]; }
  function slider(box, label, o, onInput) {
    var id = 's' + Math.random().toString(36).slice(2, 8), row = el('div', 'slider-control');
    row.innerHTML = '<label class="slider-label" for="' + id + '">' + label + '</label><input class="slider" type="range" id="' + id + '" min="' + o.min + '" max="' + o.max + '" step="' + o.step + '" value="' + o.value + '"><output>' + o.fmt(o.value) + '</output>';
    box.appendChild(row);
    var inp = row.querySelector('input'), out = row.querySelector('output');
    inp.addEventListener('input', function () { out.textContent = o.fmt(+inp.value); onInput(+inp.value); });
    return function () { return +inp.value; };
  }
  function dragger(cv, items, onMove) {
    var active = null;
    cv.addEventListener('pointerdown', function (e) {
      var p = pointerPos(cv, e); active = null;
      for (var i = 0; i < items.length; i++) { var q = items[i].get(); if (Math.hypot(q[0] - p[0], q[1] - p[1]) < items[i].r) { active = items[i]; break; } }
      if (active) { cv.setPointerCapture(e.pointerId); e.preventDefault(); }
    });
    cv.addEventListener('pointermove', function (e) { if (!active) return; var p = pointerPos(cv, e); active.set(Math.max(0, Math.min(cv._w, p[0])), Math.max(0, Math.min(cv._h, p[1]))); onMove(); });
    cv.addEventListener('pointerup', function () { active = null; });
    cv.addEventListener('pointercancel', function () { active = null; });
    cv.style.cursor = 'grab';
  }
  function dot(g, x, y, r, color, stroke) { g.beginPath(); g.arc(x, y, r, 0, 2 * Math.PI); g.fillStyle = color; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1.5; g.stroke(); } }
  function text(g, s, x, y, o) { o = o || {}; g.font = (o.font || '12px') + ' "Lato", "Helvetica Neue", Arial, sans-serif'; g.fillStyle = o.color || '#333'; g.textAlign = o.align || 'left'; g.textBaseline = o.base || 'alphabetic'; g.fillText(s, x, y); }
  function line(g, x1, y1, x2, y2, color, width, dash) { g.beginPath(); g.setLineDash(dash || []); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokeStyle = color; g.lineWidth = width || 1; g.stroke(); g.setLineDash([]); }
  var f1 = function (v) { return v.toFixed(1); }, f2 = function (v) { return v.toFixed(2); };

  var VS = {};

  /* ---- 1. The pinhole camera: a world point lands on the image plane along a straight line ---- */
  VS.pinhole = function (box) {
    var cvg = canvas(box, 600, 330), cv = cvg[0], g = cvg[1], ctl = el('div', 'controls'), read = el('div', 'readout');
    box.appendChild(ctl); box.appendChild(read);
    var W = 1920, H = 1080, cx = (W - 1) / 2, f = 1600;
    var C = [70, 165], D = 125, s = 6.0;              // camera centre on screen, image-plane distance on screen, screen px per metre
    var P = [32, 7];                                  // the world point: depth Z (m), lateral X (m)
    var getF = slider(ctl, 'focal length f', { min: 400, max: 3200, step: 10, value: f, fmt: function (v) { return v + ' px'; } }, function (v) { f = v; draw(); });
    var toScreen = function (Z, X) { return [C[0] + Z * s, C[1] - X * s]; };
    function draw() {
      g.clearRect(0, 0, cv._w, cv._h);
      var halfH = D * (W / 2) / f, px = C[0] + D;
      // field of view wedge
      g.fillStyle = '#f3f6fb'; g.beginPath(); g.moveTo(C[0], C[1]);
      g.lineTo(C[0] + 560 , C[1] - 560 * halfH / D); g.lineTo(C[0] + 560, C[1] + 560 * halfH / D); g.closePath(); g.fill();
      line(g, C[0], C[1], cv._w - 10, C[1], '#bbb', 1, [4, 4]);
      text(g, 'optical axis (Z)', cv._w - 14, C[1] - 6, { align: 'right', color: '#888', font: '11px' });
      // image plane
      line(g, px, C[1] - halfH, px, C[1] + halfH, '#333', 2);
      text(g, 'image plane', px + 6, C[1] - halfH - 6, { font: '11px', color: '#555' });
      text(g, 'f', C[0] + D / 2, C[1] + 16, { align: 'center', color: '#555', font: 'italic 12px' });
      line(g, C[0], C[1] + 8, px, C[1] + 8, '#999', 1);
      // the point, its ray and where it crosses the plane
      var Z = P[0], X = P[1], sp = toScreen(Z, X), yHit = C[1] - D * X / Z, u = f * X / Z + cx, inView = Math.abs(u - cx) <= W / 2;
      line(g, C[0], C[1], sp[0], sp[1], inView ? css('--truth') : css('--est'), 1.5);
      dot(g, C[0], C[1], 5, '#222');
      text(g, 'camera centre', C[0] - 6, C[1] + 26, { font: '11px', color: '#555' });
      dot(g, sp[0], sp[1], 7, css('--truth'), '#fff');
      text(g, 'P = (' + f1(X) + ' m, ' + f1(Z) + ' m)', sp[0] + 10, sp[1] - 8, { font: '11px' });
      if (inView) { dot(g, px, yHit, 4, css('--est')); line(g, px, yHit, px + 90, yHit, '#ccc', 1, [2, 3]); }
      // the picture as the camera sees it
      var ix = 420, iy = 236, iw = 160, ih = 90;
      g.fillStyle = '#eaf0f8'; g.fillRect(ix, iy, iw, ih); g.strokeStyle = '#555'; g.lineWidth = 1; g.strokeRect(ix, iy, iw, ih);
      text(g, 'the image (1920 × 1080 px)', ix, iy - 5, { font: '11px', color: '#555' });
      if (inView) dot(g, ix + u / W * iw, iy + ih / 2, 4, css('--est'), '#fff'); else text(g, 'outside the frame', ix + iw / 2, iy + ih / 2 + 4, { align: 'center', color: css('--est'), font: '11px' });
      var gsd = Z / f, drone = f * 0.6 / Z;
      read.textContent = 'u = f · X / Z + cx = ' + f + ' · ' + f1(X) + ' / ' + f1(Z) + ' + ' + cx + ' = ' + (inView ? f1(u) + ' px' : f1(u) + ' px (off the sensor)') +
        '\nhorizontal field of view: ' + f1(2 * Math.atan(W / 2 / f) / D2R) + '°' +
        '\nat ' + f1(Z) + ' m one pixel covers ' + (gsd * 100).toFixed(1) + ' cm; a 0.6 m drone is ' + f1(drone) + ' px wide';
    }
    dragger(cv, [{ get: function () { return toScreen(P[0], P[1]); }, set: function (x, y) { P = [Math.max(3, (x - C[0]) / s), (C[1] - y) / s]; }, r: 16 }], draw);
    draw();
  };

  /* ---- 2. Triangulation sandbox: two stations, one target, sensor noise, a cloud of fixes ---- */
  VS.triangulate = function (box) {
    var cvg = canvas(box, 600, 440), cv = cvg[0], g = cvg[1], ctl = el('div', 'controls'), read = el('div', 'readout');
    box.appendChild(ctl); box.appendChild(read);
    var s = 4, ox = 300, oy = 405;                               // 4 screen px per metre, origin near the bottom
    var toS = function (p) { return [ox + p[0] * s, oy - p[1] * s]; }, toW = function (q) { return [(q[0] - ox) / s, (oy - q[1]) / s]; };
    var cams = [[-20, 0], [25, -5]], target = [0, 55], f = 1600, N = 300, seed = 1;
    var sH = 0.5, sPx = 2, sG = 0;
    var getH = slider(ctl, 'heading error σ', { min: 0, max: 3, step: 0.05, value: sH, fmt: function (v) { return f2(v) + '°'; } }, function (v) { sH = v; draw(); });
    var getP = slider(ctl, 'detection jitter σ', { min: 0, max: 6, step: 0.5, value: sPx, fmt: function (v) { return f1(v) + ' px'; } }, function (v) { sPx = v; draw(); });
    var getG = slider(ctl, 'GPS error σ', { min: 0, max: 3, step: 0.1, value: sG, fmt: function (v) { return f1(v) + ' m'; } }, function (v) { sG = v; draw(); });
    var row = el('div', 'btnrow'); var btn = el('button', null, 'Resample'); btn.onclick = function () { seed++; draw(); }; row.appendChild(btn);
    var lg = el('span', 'legend', '<i class="sw" style="background:' + css('--truth') + '"></i>true position <i class="sw" style="background:' + css('--est') + '"></i>one fix each <i class="sw" style="background:#222"></i>mean of the fixes'); row.appendChild(lg); ctl.appendChild(row);
    function intersect(p1, d1, p2, d2) {
      var den = d1[0] * d2[1] - d1[1] * d2[0]; if (Math.abs(den) < 1e-9) return null;
      var t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / den, u = ((p2[0] - p1[0]) * d1[1] - (p2[1] - p1[1]) * d1[0]) / den;
      if (t <= 0 || u <= 0) return null;
      return [p1[0] + t * d1[0], p1[1] + t * d1[1]];
    }
    function draw() {
      g.clearRect(0, 0, cv._w, cv._h);
      for (var m = -80; m <= 80; m += 10) { var q = toS([m, 0]); line(g, q[0], 0, q[0], cv._h, m ? '#f0f0f0' : '#ddd', 1); }
      for (var n = 0; n <= 110; n += 10) { var r = toS([0, n]); line(g, 0, r[1], cv._w, r[1], n ? '#f0f0f0' : '#ddd', 1); }
      text(g, '10 m grid · north is up', 8, 14, { font: '11px', color: '#999' });
      var rng = mulberry32(seed), fixes = [], sum = [0, 0];
      for (var k = 0; k < N; k++) {
        var rays = [];
        for (var i = 0; i < 2; i++) {
          var c = cams[i], dx = target[0] - c[0], dy = target[1] - c[1], ang = Math.atan2(dy, dx) + gauss(rng) * sH * D2R + gauss(rng) * sPx / f;
          var believed = [c[0] + (sG ? gauss(rng) * sG : 0), c[1] + (sG ? gauss(rng) * sG : 0)];
          rays.push([believed, [Math.cos(ang), Math.sin(ang)]]);
        }
        var X = intersect(rays[0][0], rays[0][1], rays[1][0], rays[1][1]);
        if (X && Math.hypot(X[0] - target[0], X[1] - target[1]) < 400) { fixes.push(X); sum[0] += X[0]; sum[1] += X[1]; }
      }
      var cols = [css('--cam1'), css('--cam2')];
      var mid = [(cams[0][0] + cams[1][0]) / 2, (cams[0][1] + cams[1][1]) / 2], view = [target[0] - mid[0], target[1] - mid[1]], Z = Math.hypot(view[0], view[1]);
      view = [view[0] / Z, view[1] / Z];
      var bl = [cams[1][0] - cams[0][0], cams[1][1] - cams[0][1]], B = Math.hypot(bl[0], bl[1]), Bperp = Math.abs(bl[0] * view[1] - bl[1] * view[0]);
      // stations, their fields of view and the ideal rays
      for (i = 0; i < 2; i++) {
        var cs = toS(cams[i]), a0 = Math.atan2(target[1] - cams[i][1], target[0] - cams[i][0]), half = Math.atan(960 / f);
        g.fillStyle = cols[i] + '18'; g.beginPath(); g.moveTo(cs[0], cs[1]);
        g.lineTo(cs[0] + 900 * Math.cos(a0 - half), cs[1] - 900 * Math.sin(a0 - half)); g.lineTo(cs[0] + 900 * Math.cos(a0 + half), cs[1] - 900 * Math.sin(a0 + half)); g.closePath(); g.fill();
        var ts = toS(target); line(g, cs[0], cs[1], ts[0], ts[1], cols[i], 1, [3, 3]);
      }
      var c1 = toS(cams[0]), c2 = toS(cams[1]); line(g, c1[0], c1[1], c2[0], c2[1], '#999', 1, [1, 3]);
      text(g, 'baseline ' + f1(B) + ' m', (c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2 + 16, { align: 'center', font: '11px', color: '#777' });
      // the cloud of fixes
      g.fillStyle = css('--est') + '66';
      for (k = 0; k < fixes.length; k++) { var fs = toS(fixes[k]); g.beginPath(); g.arc(fs[0], fs[1], 2, 0, 2 * Math.PI); g.fill(); }
      var ts2 = toS(target); dot(g, ts2[0], ts2[1], 6, css('--truth'), '#fff');
      if (fixes.length) { var mean = toS([sum[0] / fixes.length, sum[1] / fixes.length]); dot(g, mean[0], mean[1], 4, '#222', '#fff'); }
      for (i = 0; i < 2; i++) { var p = toS(cams[i]); g.fillStyle = cols[i]; g.fillRect(p[0] - 6, p[1] - 6, 12, 12); text(g, 'cam' + (i + 1), p[0] + 10, p[1] + 4, { font: 'bold 12px', color: cols[i] }); }
      text(g, 'drag the stations and the target', cv._w - 8, cv._h - 8, { align: 'right', font: '11px', color: '#999' });
      // statistics: along the line of sight and across it
      var along = 0, across = 0, tot = 0;
      for (k = 0; k < fixes.length; k++) { var ex = fixes[k][0] - target[0], ey = fixes[k][1] - target[1], a = ex * view[0] + ey * view[1], cr = -ex * view[1] + ey * view[0]; along += a * a; across += cr * cr; tot += ex * ex + ey * ey; }
      var nF = Math.max(1, fixes.length), rms = Math.sqrt(tot / nF), rmsA = Math.sqrt(along / nF), rmsC = Math.sqrt(across / nF);
      var sigRel = Math.sqrt(2 * Math.pow(sH * D2R, 2) + 2 * Math.pow(sPx / f, 2)), theory = Bperp > 0.01 ? Z * Z * sigRel / Bperp : Infinity;
      var angle = Math.acos(Math.max(-1, Math.min(1, ((target[0] - cams[0][0]) * (target[0] - cams[1][0]) + (target[1] - cams[0][1]) * (target[1] - cams[1][1])) / (Math.hypot(target[0] - cams[0][0], target[1] - cams[0][1]) * Math.hypot(target[0] - cams[1][0], target[1] - cams[1][1]))))) / D2R;
      read.textContent = 'range ' + f1(Z) + ' m   baseline ' + f1(B) + ' m (' + f1(Bperp) + ' m across the line of sight)   rays meet at ' + f1(angle) + '°' +
        '\n' + fixes.length + ' of ' + N + ' fixes valid   RMS error ' + f2(rms) + ' m   (along the line of sight ' + f2(rmsA) + ' m, across it ' + f2(rmsC) + ' m)' +
        '\nsmall-angle prediction for the range error:  Z²·σ/B = ' + (isFinite(theory) ? f2(theory) + ' m' : '∞ (baseline is along the line of sight)');
    }
    var items = [];
    [0, 1].forEach(function (i) { items.push({ get: function () { return toS(cams[i]); }, set: function (x, y) { cams[i] = toW([x, y]); }, r: 14 }); });
    items.push({ get: function () { return toS(target); }, set: function (x, y) { target = toW([x, y]); }, r: 14 });
    dragger(cv, items, draw);
    draw();
  };

  /* ---- 3. Error versus range: the small-angle law against the field measurements ---- */
  VS.errorcurve = function (box) {
    var cvg = canvas(box, 600, 360), cv = cvg[0], g = cvg[1], ctl = el('div', 'controls'), read = el('div', 'readout');
    box.appendChild(ctl); box.appendChild(read);
    var f = 3197;   // the calibrated 18 mm R10 focal length at 3840 px, as used in the field test
    var field = { 0.5: [[4, 3.8], [10, 8.9], [20, 15], [61, 47], [80, 62], [120, 80]], 1: [[4, 4.3], [10, 10.9], [20, 18], [61, 54], [80, 72], [120, 108]], 2: [[4, 4.3], [10, 10.5], [20, 23], [61, 59], [80, 84], [120, 116]] };
    var fcol = { 0.5: '#d97706', 1: '#7c3aed', 2: '#0e7490' };
    var B = 1, sH = 0.03, sPx = 2;
    var getB = slider(ctl, 'baseline B', { min: 0.5, max: 50, step: 0.5, value: B, fmt: function (v) { return f1(v) + ' m'; } }, function (v) { B = v; draw(); });
    var getH = slider(ctl, 'heading error σ', { min: 0, max: 1, step: 0.01, value: sH, fmt: function (v) { return f2(v) + '°'; } }, function (v) { sH = v; draw(); });
    var getP = slider(ctl, 'detection jitter σ', { min: 0, max: 6, step: 0.25, value: sPx, fmt: function (v) { return f2(v) + ' px'; } }, function (v) { sPx = v; draw(); });
    var lg = el('div', 'legend', 'field test, 18 mm lens (report Table 3): <i class="sw" style="background:#d97706"></i>0.5 m baseline <i class="sw" style="background:#7c3aed"></i>1 m <i class="sw" style="background:#0e7490"></i>2 m &nbsp;·&nbsp; curve: 1-σ range error predicted for the sliders'); ctl.appendChild(lg);
    var L = 46, R = 14, T = 14, Bm = 34, Zmax = 130, Emax = 45;
    var X = function (z) { return L + (cv._w - L - R) * z / Zmax; }, Y = function (e) { return T + (cv._h - T - Bm) * (1 - Math.min(e, Emax) / Emax); };
    function draw() {
      g.clearRect(0, 0, cv._w, cv._h);
      for (var e = 0; e <= Emax; e += 10) { line(g, L, Y(e), cv._w - R, Y(e), '#eee', 1); text(g, e + '', L - 6, Y(e) + 4, { align: 'right', font: '11px', color: '#777' }); }
      for (var z = 0; z <= Zmax; z += 20) { line(g, X(z), T, X(z), cv._h - Bm, '#eee', 1); text(g, z + '', X(z), cv._h - Bm + 14, { align: 'center', font: '11px', color: '#777' }); }
      text(g, 'range to the target, m', cv._w - R, cv._h - 6, { align: 'right', font: '11px', color: '#555' });
      text(g, 'range error, m', L + 4, T + 10, { font: '11px', color: '#555' });
      var sigRel = Math.sqrt(2 * Math.pow(sH * D2R, 2) + 2 * Math.pow(sPx / f, 2));
      g.beginPath(); g.strokeStyle = '#222'; g.lineWidth = 2;
      for (var zz = 1; zz <= Zmax; zz += 1) { var ee = zz * zz * sigRel / B, px = X(zz), py = Y(ee); if (zz === 1) g.moveTo(px, py); else g.lineTo(px, py); if (ee > Emax) break; }
      g.stroke();
      Object.keys(field).forEach(function (b) { field[b].forEach(function (p) { var err = Math.abs(p[1] - p[0]); dot(g, X(p[0]), Y(err), 4.5, fcol[b], '#fff'); }); });
      var at120 = 120 * 120 * sigRel / B;
      read.textContent = 'σ_rel = √2 · √(σ_heading² + (σ_px / f)²) = ' + (sigRel / D2R).toFixed(3) + '°   with f = ' + f + ' px' +
        '\npredicted 1-σ range error at 120 m with a ' + f1(B) + ' m baseline: ' + f1(at120) + ' m' +
        '\nhint: with the baseline set to 0.5, 1 or 2 m, a σ of about 0.03–0.08° runs through the matching field points';
    }
    draw();
  };

  /* ---- 4. Compass and tilt to a rotation matrix ---- */
  VS.frames = function (box) {
    var cvg = canvas(box, 600, 230), cv = cvg[0], g = cvg[1], ctl = el('div', 'controls'), read = el('div', 'readout');
    box.appendChild(ctl); box.appendChild(read);
    var h = 22, p = 17;
    slider(ctl, 'heading (compass)', { min: 0, max: 359, step: 1, value: h, fmt: function (v) { return v + '°'; } }, function (v) { h = v; draw(); });
    slider(ctl, 'pitch (tilt up)', { min: -30, max: 60, step: 1, value: p, fmt: function (v) { return v + '°'; } }, function (v) { p = v; draw(); });
    function R(hd, pt) {
      var H = hd * D2R, P = pt * D2R, fwd = [Math.sin(H) * Math.cos(P), Math.cos(H) * Math.cos(P), Math.sin(P)], right = [Math.cos(H), -Math.sin(H), 0];
      var down = [fwd[1] * right[2] - fwd[2] * right[1], fwd[2] * right[0] - fwd[0] * right[2], fwd[0] * right[1] - fwd[1] * right[0]];
      return { fwd: fwd, right: right, down: down };
    }
    function draw() {
      g.clearRect(0, 0, cv._w, cv._h);
      var r = R(h, p);
      // compass dial (top view)
      var cx = 120, cy = 118, rad = 85;
      g.beginPath(); g.arc(cx, cy, rad, 0, 2 * Math.PI); g.strokeStyle = '#999'; g.lineWidth = 1; g.stroke();
      [['N', 0], ['E', 90], ['S', 180], ['W', 270]].forEach(function (d) { var a = d[1] * D2R; text(g, d[0], cx + (rad + 14) * Math.sin(a), cy - (rad + 14) * Math.cos(a) + 4, { align: 'center', font: 'bold 12px', color: '#555' }); });
      var ax = cx + rad * 0.9 * Math.sin(h * D2R), ay = cy - rad * 0.9 * Math.cos(h * D2R);
      line(g, cx, cy, ax, ay, css('--cam1'), 3); dot(g, cx, cy, 4, '#222');
      text(g, 'top view: heading', cx, cy + rad + 32, { align: 'center', font: '11px', color: '#555' });
      // side view
      var sx = 330, sy = 150, len = 150;
      line(g, sx - 20, sy, sx + 230, sy, '#999', 1); text(g, 'horizon', sx + 232, sy + 4, { font: '11px', color: '#777' });
      line(g, sx, sy, sx + len * Math.cos(p * D2R), sy - len * Math.sin(p * D2R), css('--cam1'), 3); dot(g, sx, sy, 4, '#222');
      g.beginPath(); g.arc(sx, sy, 40, -p * D2R, 0, p < 0); g.strokeStyle = '#bbb'; g.stroke();
      text(g, 'pitch ' + p + '°', sx + 48, sy - 8 * Math.sign(p || 1), { font: '11px', color: '#555' });
      text(g, 'side view: tilt', sx + 100, sy + 60, { align: 'center', font: '11px', color: '#555' });
      var f3 = function (v) { return (v >= 0 ? ' ' : '') + v.toFixed(3); };
      read.textContent = 'forward (optical axis) in ENU = [' + f3(r.fwd[0]) + ', ' + f3(r.fwd[1]) + ', ' + f3(r.fwd[2]) + ']' +
        '\nR (camera → world), columns = image right, image down, forward:' +
        '\n  [' + f3(r.right[0]) + '  ' + f3(r.down[0]) + '  ' + f3(r.fwd[0]) + ' ]' +
        '\n  [' + f3(r.right[1]) + '  ' + f3(r.down[1]) + '  ' + f3(r.fwd[1]) + ' ]' +
        '\n  [' + f3(r.right[2]) + '  ' + f3(r.down[2]) + '  ' + f3(r.fwd[2]) + ' ]';
    }
    draw();
  };

  /* ---- 5. Rig explorer: the second-generation verged rig on the archive's design grid ---- */
  VS.rig = function (box) {
    var cvg = canvas(box, 600, 460), cv = cvg[0], g = cvg[1], ctl = el('div', 'controls'), read = el('div', 'readout');
    box.appendChild(ctl); box.appendChild(read);
    var FOCALS = [18, 45, 55, 100, 150, 210], SENSOR = 22.2, W = 1920, Hpx = 1080, DRONE = 0.35, N = 300, seed = 1;
    var B = 20, fi = 5, H = 75, D = 100, X = 0, sYawJ = 0.6, sPitchJ = 0.3, sBias = 1, sPx = 2, sBase = 0;
    slider(ctl, 'baseline B', { min: 2, max: 30, step: 1, value: B, fmt: function (v) { return v + ' m'; } }, function (v) { B = v; draw(); });
    slider(ctl, 'lens F', { min: 0, max: 5, step: 1, value: fi, fmt: function (v) { return FOCALS[v] + ' mm'; } }, function (v) { fi = v; draw(); });
    slider(ctl, 'depth D', { min: 5, max: 200, step: 5, value: D, fmt: function (v) { return v + ' m'; } }, function (v) { D = v; draw(); });
    slider(ctl, 'height H', { min: 5, max: 200, step: 5, value: H, fmt: function (v) { return v + ' m'; } }, function (v) { H = v; draw(); });
    slider(ctl, 'lateral X', { min: -30, max: 30, step: 1, value: X, fmt: function (v) { return v + ' m'; } }, function (v) { X = v; draw(); });
    slider(ctl, 'IMU yaw jitter σ', { min: 0, max: 3, step: 0.05, value: sYawJ, fmt: function (v) { return f2(v) + '°'; } }, function (v) { sYawJ = v; draw(); });
    slider(ctl, 'IMU pitch jitter σ', { min: 0, max: 3, step: 0.05, value: sPitchJ, fmt: function (v) { return f2(v) + '°'; } }, function (v) { sPitchJ = v; draw(); });
    slider(ctl, 'heading bias σ', { min: 0, max: 5, step: 0.1, value: sBias, fmt: function (v) { return f1(v) + '°'; } }, function (v) { sBias = v; draw(); });
    slider(ctl, 'detection jitter σ', { min: 0, max: 6, step: 0.5, value: sPx, fmt: function (v) { return f1(v) + ' px'; } }, function (v) { sPx = v; draw(); });
    slider(ctl, 'baseline error σ', { min: 0, max: 5, step: 0.1, value: sBase, fmt: function (v) { return f1(v) + ' %'; } }, function (v) { sBase = v; draw(); });
    var row = el('div', 'btnrow'); var btn = el('button', null, 'Resample'); btn.onclick = function () { seed++; draw(); }; row.appendChild(btn);
    row.appendChild(el('span', 'legend', '<i class="sw" style="background:' + css('--truth') + '"></i>drone <i class="sw" style="background:' + css('--est') + '"></i>angles + pixels <i class="sw" style="background:' + css('--cam2') + '"></i>angle-only IMU &nbsp;·&nbsp; dashed: a parallel rig\'s field of view'));
    ctl.appendChild(row);
    // 3D camera model, same conventions as the simulator (x lateral, y depth, z up)
    function rot(h, p) { var f = [Math.sin(h) * Math.cos(p), Math.cos(h) * Math.cos(p), Math.sin(p)], r = [Math.cos(h), -Math.sin(h), 0], d = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]]; return { f: f, r: r, d: d }; }
    function project(cam, P) { var v = [P[0] - cam.C[0], P[1] - cam.C[1], P[2] - cam.C[2]], x = v[0] * cam.R.r[0] + v[1] * cam.R.r[1] + v[2] * cam.R.r[2], y = v[0] * cam.R.d[0] + v[1] * cam.R.d[1] + v[2] * cam.R.d[2], z = v[0] * cam.R.f[0] + v[1] * cam.R.f[1] + v[2] * cam.R.f[2]; return z > 0 ? [cam.f * x / z + (W - 1) / 2, cam.f * y / z + (Hpx - 1) / 2, z] : null; }
    function rayOf(cam, uv) { var x = (uv[0] - (W - 1) / 2) / cam.f, y = (uv[1] - (Hpx - 1) / 2) / cam.f, d = [cam.R.r[0] * x + cam.R.d[0] * y + cam.R.f[0], cam.R.r[1] * x + cam.R.d[1] * y + cam.R.f[1], cam.R.r[2] * x + cam.R.d[2] * y + cam.R.f[2]], n = Math.hypot(d[0], d[1], d[2]); return [d[0] / n, d[1] / n, d[2] / n]; }
    function closest(o1, d1, o2, d2) { var w = [o1[0] - o2[0], o1[1] - o2[1], o1[2] - o2[2]], b = d1[0] * d2[0] + d1[1] * d2[1] + d1[2] * d2[2], dd = d1[0] * w[0] + d1[1] * w[1] + d1[2] * w[2], e = d2[0] * w[0] + d2[1] * w[1] + d2[2] * w[2], den = 1 - b * b; if (Math.abs(den) < 1e-12) return null; var t1 = (b * e - dd) / den, t2 = (e - b * dd) / den; if (t1 <= 0 || t2 <= 0) return null; return [(o1[0] + t1 * d1[0] + o2[0] + t2 * d2[0]) / 2, (o1[1] + t1 * d1[1] + o2[1] + t2 * d2[1]) / 2, (o1[2] + t1 * d1[2] + o2[2] + t2 * d2[2]) / 2]; }
    function makeCam(cx, fpx, aim, extraYaw, extraPitch) { var dx = aim[0] - cx, h = Math.atan2(dx, aim[1]) + (extraYaw || 0), p = Math.atan2(aim[2], Math.hypot(dx, aim[1])) + (extraPitch || 0); return { C: [cx, 0, 0], f: fpx, R: rot(h, p), yaw: h, pitch: p }; }
    function draw() {
      var F = FOCALS[fi], fpx = F / SENSOR * W, half = Math.atan(W / 2 / fpx), halfV = Math.atan(Hpx / 2 / fpx), P = [X, D, H];
      var camL = makeCam(-B / 2, fpx, P), camR = makeCam(B / 2, fpx, P);
      var rng = mulberry32(seed), errRay = [], errImu = [], errDisp = [], cloudRay = [], cloudImu = [], fails = 0;
      var uvT = [project(camL, P), project(camR, P)];
      for (var k = 0; k < N; k++) {
        var bias = sBias ? gauss(rng) * sBias * D2R : 0, bsc = sBase ? 1 + gauss(rng) * sBase / 100 : 1;
        var bl = makeCam(-B / 2 * bsc, fpx, P, bias / 2 + (sYawJ ? gauss(rng) * sYawJ * D2R : 0), sPitchJ ? gauss(rng) * sPitchJ * D2R : 0);
        var br = makeCam(B / 2 * bsc, fpx, P, -bias / 2 + (sYawJ ? gauss(rng) * sYawJ * D2R : 0), sPitchJ ? gauss(rng) * sPitchJ * D2R : 0);
        // the believed aim differs from the true aim by the errors; the pixels are what the true cameras saw
        var uvL = [uvT[0][0] + (sPx ? gauss(rng) * sPx : 0), uvT[0][1] + (sPx ? gauss(rng) * sPx : 0)], uvR = [uvT[1][0] + (sPx ? gauss(rng) * sPx : 0), uvT[1][1] + (sPx ? gauss(rng) * sPx : 0)];
        var Xr = closest(bl.C, rayOf(bl, uvL), br.C, rayOf(br, uvR));
        if (Xr) { errRay.push(Math.hypot(Xr[0] - P[0], Xr[1] - P[1], Xr[2] - P[2])); cloudRay.push(Xr); } else fails++;
        var tl = Math.tan(bl.yaw), tr = Math.tan(br.yaw), Bb = B * bsc;
        if (Math.abs(tl - tr) > 1e-9) { var Z = Bb / (tl - tr), Xi = Z * (tl + tr) / 2, Hi = 0.5 * (Math.tan(bl.pitch) * Math.hypot(Xi + Bb / 2, Z) + Math.tan(br.pitch) * Math.hypot(Xi - Bb / 2, Z)); if (Z > 0) { errImu.push(Math.hypot(Xi - P[0], Z - P[1], Hi - P[2])); cloudImu.push([Xi, Z, Hi]); } }
        var dpx = Math.abs(uvL[0] - uvR[0]); if (dpx > 1e-6) { var Zd = fpx * Bb / dpx; errDisp.push(Math.abs(Zd - D)); }
      }
      var med = function (a) { if (!a.length) return NaN; var s = a.slice().sort(function (p, q) { return p - q; }); return s[Math.floor(s.length / 2)]; };
      // ---- drawing: top view (upper) and side view (lower) ----
      g.clearRect(0, 0, cv._w, cv._h);
      var topH = 300, pad = 36, span = Math.max(D * 1.15, B * 1.4 + Math.abs(X) * 2 + 10, 30), s = Math.min((topH - pad - 20) / span, (cv._w - 2 * pad) / span), ox = cv._w / 2, oy = topH - pad;
      var T = function (x, y) { return [ox + x * s, oy - y * s]; };
      g.fillStyle = '#fbfbfb'; g.fillRect(0, 0, cv._w, topH); line(g, 0, topH, cv._w, topH, '#ddd', 1);
      text(g, 'top view', 8, 14, { font: '11px', color: '#999' }); text(g, 'side view', 8, topH + 14, { font: '11px', color: '#999' });
      var cols = [css('--cam1'), css('--cam2')];
      [camL, camR].forEach(function (c, i) {
        var p = T(c.C[0], 0), a = c.yaw, hz = Math.cos(c.pitch);   // horizontal footprint of the wedge
        g.fillStyle = cols[i] + '1a'; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[0] + 2000 * Math.sin(a - half), p[1] - 2000 * Math.cos(a - half)); g.lineTo(p[0] + 2000 * Math.sin(a + half), p[1] - 2000 * Math.cos(a + half)); g.closePath(); g.fill();
        line(g, p[0], p[1], p[0] + 2000 * Math.sin(-half), p[1] - 2000 * Math.cos(-half), '#bbb', 1, [4, 4]); line(g, p[0], p[1], p[0] + 2000 * Math.sin(half), p[1] - 2000 * Math.cos(half), '#bbb', 1, [4, 4]);
        var q = T(P[0], P[1]); line(g, p[0], p[1], q[0], q[1], cols[i], 1, [3, 3]);
        g.fillStyle = cols[i]; g.fillRect(p[0] - 5, p[1] - 5, 10, 10); text(g, i ? 'cam2' : 'cam1', p[0] + (i ? 8 : -8), p[1] + 18, { align: i ? 'left' : 'right', font: 'bold 11px', color: cols[i] });
      });
      g.fillStyle = css('--cam2') + '55'; cloudImu.forEach(function (c) { var q = T(c[0], c[1]); g.beginPath(); g.arc(q[0], q[1], 2, 0, 2 * Math.PI); g.fill(); });
      g.fillStyle = css('--est') + '66'; cloudRay.forEach(function (c) { var q = T(c[0], c[1]); g.beginPath(); g.arc(q[0], q[1], 2, 0, 2 * Math.PI); g.fill(); });
      var qd = T(P[0], P[1]); dot(g, qd[0], qd[1], 6, css('--truth'), '#fff');
      // side view
      var sH = cv._h - topH, sp = Math.min((sH - 30) / Math.max(H * 1.2, 10), (cv._w - 2 * pad) / Math.max(D * 1.1, 10)), sox = pad, soy = cv._h - 16;
      var Sv = function (d, h) { return [sox + d * sp, soy - h * sp]; };
      line(g, sox - 10, soy, cv._w - 10, soy, '#999', 1);
      var cs = Sv(0, 0), ds = Sv(D, H); line(g, cs[0], cs[1], ds[0], ds[1], css('--cam1'), 1, [3, 3]);
      var pr = camL.pitch; line(g, cs[0], cs[1], cs[0] + 2000 * Math.cos(pr - halfV), cs[1] - 2000 * Math.sin(pr - halfV), '#ccc', 1, [2, 3]); line(g, cs[0], cs[1], cs[0] + 2000 * Math.cos(pr + halfV), cs[1] - 2000 * Math.sin(pr + halfV), '#ccc', 1, [2, 3]);
      g.fillStyle = '#444'; g.fillRect(cs[0] - 4, cs[1] - 8, 8, 8); dot(g, ds[0], ds[1], 5, css('--truth'), '#fff');
      text(g, 'H = ' + H + ' m', ds[0] + 8, ds[1] + 4, { font: '11px' }); text(g, 'D = ' + D + ' m', (cs[0] + ds[0]) / 2, soy - 6, { align: 'center', font: '11px', color: '#777' });
      // ---- readout ----
      var inParallel = Math.abs(Math.atan2(P[0] + B / 2, P[1])) < half && Math.abs(Math.atan2(P[0] - B / 2, P[1])) < half;
      var range = Math.hypot(P[0], P[1], P[2]), span_px = fpx * DRONE / range, stereo = 2 * Math.atan(B / 2 / Math.hypot(D, H)) / D2R;
      var yawL = camL.yaw / D2R, yawR = camR.yaw / D2R, pitch = camL.pitch / D2R;
      read.textContent = 'B' + B + ' H' + H + ' D' + D + ' F' + F + '   f = ' + f1(fpx) + ' px   field of view ' + f1(2 * half / D2R) + '° × ' + f1(2 * halfV / D2R) + '°   drone spans ' + f1(span_px) + ' px   rays meet at ' + f2(stereo) + '°' +
        '\naim cam1: yaw ' + (yawL >= 0 ? '+' : '') + f2(yawL) + '°  pitch ' + f2(pitch) + '°   cam2: yaw ' + (yawR >= 0 ? '+' : '') + f2(yawR) + '°   ·   ' + (inParallel ? 'a parallel rig would also see it' : 'a parallel rig would NOT have the drone in both frames: the rig must verge') +
        '\nmedian 3D error  angles + pixels ' + (isFinite(med(errRay)) ? f2(med(errRay)) + ' m' : 'no fix') + (fails ? ' (' + Math.round(100 * fails / N) + '% no fix)' : '') +
        '   ·   angle-only IMU ' + (isFinite(med(errImu)) ? f2(med(errImu)) + ' m' : 'no fix') +
        '   ·   parallel disparity, depth error ' + (isFinite(med(errDisp)) ? (med(errDisp) > 1e4 ? (med(errDisp) / 1000).toFixed(0) + ' km' : f1(med(errDisp)) + ' m') : 'no fix');
    }
    draw();
  };

  function boot() {
    var nodes = document.querySelectorAll('[data-demo]');
    for (var i = 0; i < nodes.length; i++) { var name = nodes[i].getAttribute('data-demo'); if (VS[name]) { try { VS[name](nodes[i]); } catch (err) { nodes[i].appendChild(el('p', 'caption', 'This demo could not start: ' + err.message)); } } }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
