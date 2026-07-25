/**
 * Hat Tiling — Fractal Boundary Explorer
 *
 * The main Game-of-Life app builds its "hat" grid by growing one huge
 * recursively-substituted supertile to whatever level is big enough to
 * cover the requested width/height, then cropping it with a plain
 * axis-aligned box test. Substitution supertiles have self-similar,
 * non-convex outlines (a hallmark of substitution/rep-tile systems) — so
 * whenever the crop edge lands in one of those notches instead of the
 * solid interior, the result is a jagged, fractal-looking "missing tile"
 * region. This tool exposes level, crop size, and crop center directly as
 * playable controls so that mechanism can be explored and pushed on.
 */

// ---- Geometry (ported from the main app's hat construction) ----

const SQRT3 = Math.sqrt(3);
const HAT_HR3 = SQRT3 / 2;
const HAT_IDENT = [1, 0, 0, 0, 1, 0];

function hatHexPt(x, y) { return [x + 0.5 * y, HAT_HR3 * y]; }
function hatAdd2(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
function hatSub2(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
function hatScl2(a, s) { return [a[0] * s, a[1] * s]; }
function hatIntersect(p1, q1, p2, q2) {
    const d = (q2[1] - p2[1]) * (q1[0] - p1[0]) - (q2[0] - p2[0]) * (q1[1] - p1[1]);
    const uA = ((q2[0] - p2[0]) * (p1[1] - p2[1]) - (q2[1] - p2[1]) * (p1[0] - p2[0])) / d;
    return [p1[0] + uA * (q1[0] - p1[0]), p1[1] + uA * (q1[1] - p1[1])];
}
function hatInv(T) {
    const det = T[0] * T[4] - T[1] * T[3];
    return [T[4] / det, -T[1] / det, (T[1] * T[5] - T[2] * T[4]) / det,
            -T[3] / det, T[0] / det, (T[2] * T[3] - T[0] * T[5]) / det];
}
function hatMul(A, B) {
    return [
        A[0] * B[0] + A[1] * B[3], A[0] * B[1] + A[1] * B[4], A[0] * B[2] + A[1] * B[5] + A[2],
        A[3] * B[0] + A[4] * B[3], A[3] * B[1] + A[4] * B[4], A[3] * B[2] + A[4] * B[5] + A[5]
    ];
}
function hatTrot(a) { return [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0]; }
function hatTtrans(p) { return [1, 0, p[0], 0, 1, p[1]]; }
function hatRotAbout(p, ang) { return hatMul(hatTtrans(p), hatMul(hatTrot(ang), hatTtrans([-p[0], -p[1]]))); }
function hatTransPt(M, P) { return [M[0] * P[0] + M[1] * P[1] + M[2], M[3] * P[0] + M[4] * P[1] + M[5]]; }
function hatMatchSeg(p, q) { return [q[0] - p[0], p[1] - q[1], p[0], q[1] - p[1], q[0] - p[0], p[1]]; }
function hatMatchTwo(p1, q1, p2, q2) { return hatMul(hatMatchSeg(p2, q2), hatInv(hatMatchSeg(p1, q1))); }

class HatGeom {
    constructor(shape) { this.shape = shape; this.width = 1; this.children = []; }
    addChild(T, geom) { this.children.push({ T, geom }); }
    evalChild(n, i) { return hatTransPt(this.children[n].T, this.children[n].geom.shape[i]); }
    recentre() {
        let tr = [0, 0];
        this.shape.forEach(p => { tr = hatAdd2(tr, p); });
        tr = hatScl2(tr, -1 / this.shape.length);
        this.shape = this.shape.map(p => hatAdd2(p, tr));
        const M = hatTtrans(tr);
        for (const ch of this.children) ch.T = hatMul(M, ch.T);
    }
}

const HAT_OUTLINE = [
    hatHexPt(0, 0), hatHexPt(-1, -1), hatHexPt(0, -2), hatHexPt(2, -2),
    hatHexPt(2, -1), hatHexPt(4, -2), hatHexPt(5, -1), hatHexPt(4, 0),
    hatHexPt(3, 0), hatHexPt(2, 2), hatHexPt(0, 3), hatHexPt(0, 2),
    hatHexPt(-1, 2)
];
const H1_HAT = new HatGeom(HAT_OUTLINE);
const H_HAT = new HatGeom(HAT_OUTLINE);
const T_HAT = new HatGeom(HAT_OUTLINE);
const P_HAT = new HatGeom(HAT_OUTLINE);
const F_HAT = new HatGeom(HAT_OUTLINE);

const HAT_H_INIT = (function () {
    const outline = [[0, 0], [4, 0], [4.5, HAT_HR3], [2.5, 5 * HAT_HR3], [1.5, 5 * HAT_HR3], [-0.5, HAT_HR3]];
    const meta = new HatGeom(outline); meta.width = 2;
    meta.addChild(hatMatchTwo(HAT_OUTLINE[5], HAT_OUTLINE[7], outline[5], outline[0]), H_HAT);
    meta.addChild(hatMatchTwo(HAT_OUTLINE[9], HAT_OUTLINE[11], outline[1], outline[2]), H_HAT);
    meta.addChild(hatMatchTwo(HAT_OUTLINE[5], HAT_OUTLINE[7], outline[3], outline[4]), H_HAT);
    meta.addChild(hatMul(hatTtrans([2.5, HAT_HR3]), hatMul([-0.5, -HAT_HR3, 0, HAT_HR3, -0.5, 0], [0.5, 0, 0, 0, -0.5, 0])), H1_HAT);
    return meta;
}());
const HAT_T_INIT = (function () {
    const outline = [[0, 0], [3, 0], [1.5, 3 * HAT_HR3]];
    const meta = new HatGeom(outline); meta.width = 2;
    meta.addChild([0.5, 0, 0.5, 0, 0.5, HAT_HR3], T_HAT);
    return meta;
}());
const HAT_P_INIT = (function () {
    const outline = [[0, 0], [4, 0], [3, 2 * HAT_HR3], [-1, 2 * HAT_HR3]];
    const meta = new HatGeom(outline); meta.width = 2;
    meta.addChild([0.5, 0, 1.5, 0, 0.5, HAT_HR3], P_HAT);
    meta.addChild(hatMul(hatTtrans([0, 2 * HAT_HR3]), hatMul([0.5, HAT_HR3, 0, -HAT_HR3, 0.5, 0], [0.5, 0, 0, 0, 0.5, 0])), P_HAT);
    return meta;
}());
const HAT_F_INIT = (function () {
    const outline = [[0, 0], [3, 0], [3.5, HAT_HR3], [3, 2 * HAT_HR3], [-1, 2 * HAT_HR3]];
    const meta = new HatGeom(outline); meta.width = 2;
    meta.addChild([0.5, 0, 1.5, 0, 0.5, HAT_HR3], F_HAT);
    meta.addChild(hatMul(hatTtrans([0, 2 * HAT_HR3]), hatMul([0.5, HAT_HR3, 0, -HAT_HR3, 0.5, 0], [0.5, 0, 0, 0, 0.5, 0])), F_HAT);
    return meta;
}());

function hatConstructPatch(H, T, P, F) {
    const rules = [
        ['H'],
        [0, 0, 'P', 2], [1, 0, 'H', 2], [2, 0, 'P', 2], [3, 0, 'H', 2], [4, 4, 'P', 2],
        [0, 4, 'F', 3], [2, 4, 'F', 3], [4, 1, 3, 2, 'F', 0], [8, 3, 'H', 0], [9, 2, 'P', 0],
        [10, 2, 'H', 0], [11, 4, 'P', 2], [12, 0, 'H', 2], [13, 0, 'F', 3], [14, 2, 'F', 1],
        [15, 3, 'H', 4], [8, 2, 'F', 1], [17, 3, 'H', 0], [18, 2, 'P', 0], [19, 2, 'H', 2],
        [20, 4, 'F', 3], [20, 0, 'P', 2], [22, 0, 'H', 2], [23, 4, 'F', 3], [23, 0, 'F', 3],
        [16, 0, 'P', 2], [9, 4, 0, 2, 'T', 2], [4, 0, 'F', 3]
    ];
    const ret = new HatGeom([]);
    ret.width = H.width;
    const shapes = { H, T, P, F };
    for (const r of rules) {
        if (r.length === 1) {
            ret.addChild(HAT_IDENT, shapes[r[0]]);
        } else if (r.length === 4) {
            const poly = ret.children[r[0]].geom.shape;
            const RT = ret.children[r[0]].T;
            const P0 = hatTransPt(RT, poly[(r[1] + 1) % poly.length]);
            const Q0 = hatTransPt(RT, poly[r[1]]);
            const nshp = shapes[r[2]], npoly = nshp.shape;
            ret.addChild(hatMatchTwo(npoly[r[3]], npoly[(r[3] + 1) % npoly.length], P0, Q0), nshp);
        } else {
            const chP = ret.children[r[0]], chQ = ret.children[r[2]];
            const P0 = hatTransPt(chQ.T, chQ.geom.shape[r[3]]);
            const Q0 = hatTransPt(chP.T, chP.geom.shape[r[1]]);
            const nshp = shapes[r[4]], npoly = nshp.shape;
            ret.addChild(hatMatchTwo(npoly[r[5]], npoly[(r[5] + 1) % npoly.length], P0, Q0), nshp);
        }
    }
    return ret;
}

function hatConstructMetatiles(patch) {
    const bps1 = patch.evalChild(8, 2);
    const bps2 = patch.evalChild(21, 2);
    const rbps = hatTransPt(hatRotAbout(bps1, -2.0 * Math.PI / 3.0), bps2);
    const p72 = patch.evalChild(7, 2);
    const p252 = patch.evalChild(25, 2);
    const llc = hatIntersect(bps1, rbps, patch.evalChild(6, 2), p72);
    let w = hatSub2(patch.evalChild(6, 2), llc);

    const newHOutline = [llc, bps1];
    w = hatTransPt(hatTrot(-Math.PI / 3), w);
    newHOutline.push(hatAdd2(newHOutline[1], w));
    newHOutline.push(patch.evalChild(14, 2));
    w = hatTransPt(hatTrot(-Math.PI / 3), w);
    newHOutline.push(hatSub2(newHOutline[3], w));
    newHOutline.push(patch.evalChild(6, 2));
    const newH = new HatGeom(newHOutline); newH.width = patch.width * 2;
    for (const ch of [0, 9, 16, 27, 26, 6, 1, 8, 10, 15]) newH.addChild(patch.children[ch].T, patch.children[ch].geom);

    const newPOutline = [p72, hatAdd2(p72, hatSub2(bps1, llc)), bps1, llc];
    const newP = new HatGeom(newPOutline); newP.width = patch.width * 2;
    for (const ch of [7, 2, 3, 4, 28]) newP.addChild(patch.children[ch].T, patch.children[ch].geom);

    const newFOutline = [bps2, patch.evalChild(24, 2), patch.evalChild(25, 0), p252, hatAdd2(p252, hatSub2(llc, bps1))];
    const newF = new HatGeom(newFOutline); newF.width = patch.width * 2;
    for (const ch of [21, 20, 22, 23, 24, 25]) newF.addChild(patch.children[ch].T, patch.children[ch].geom);

    const AAA = newHOutline[2];
    const BBB = hatAdd2(newHOutline[1], hatSub2(newHOutline[4], newHOutline[5]));
    const CCC = hatTransPt(hatRotAbout(BBB, -Math.PI / 3), AAA);
    const newT = new HatGeom([BBB, CCC, AAA]); newT.width = patch.width * 2;
    newT.addChild(patch.children[11].T, patch.children[11].geom);

    newH.recentre(); newP.recentre(); newF.recentre(); newT.recentre();
    return [newH, newT, newP, newF];
}

// Builds the full decomposition of one top-level "H" supertile down to
// individual hats, tagging each with which of the supertile's own (fixed,
// always-10) top-level children it descended from — this reveals the
// recursive substitution structure directly as a categorical color map.
function buildHatTiling(levels, scale) {
    let tiles = [HAT_H_INIT, HAT_T_INIT, HAT_P_INIT, HAT_F_INIT];
    for (let i = 0; i < levels; i++) {
        const patch = hatConstructPatch(...tiles);
        tiles = hatConstructMetatiles(patch);
    }
    const out = [];
    const stack = [{ T: [scale, 0, 0, 0, scale, 0], geom: tiles[0], level: levels, tag: -1 }];
    while (stack.length) {
        const t = stack.pop();
        if (t.level >= 0) {
            t.geom.children.forEach((g, idx) => {
                const tag = (t.level === levels) ? idx : t.tag;
                stack.push({ T: hatMul(t.T, g.T), geom: g.geom, level: t.level - 1, tag });
            });
        } else {
            const points = t.geom.shape.map(p => { const q = hatTransPt(t.T, p); return { x: q[0], y: q[1] }; });
            let cx = 0, cy = 0;
            for (const p of points) { cx += p.x; cy += p.y; }
            cx /= points.length; cy /= points.length;
            out.push({ points, tag: t.tag, cx, cy });
        }
    }
    return out;
}

// ---- App state ----

const SCALE = 20;
const LEVEL_HAT_COUNTS = { 1: 25, 2: 169, 3: 1156, 4: 7921, 5: 54289, 6: 372100, 7: 2550409 };
const LINEAGE_COLORS = [
    '#38bdf8', '#f472b6', '#facc15', '#4ade80', '#a78bfa',
    '#fb923c', '#2dd4bf', '#f87171', '#818cf8', '#c084fc'
];

const state = {
    level: 6,
    width: 1194, height: 1194,
    lockAspect: true,
    centerX: 0, centerY: 0,
    colorMode: 'lineage',
    fastMode: false,
    zoom: 1, pan: { x: 0, y: 0 },
    sweep: { playing: false, timer: null, direction: 1 },
    levelBBoxCache: {}, // level -> { minX, maxX, minY, maxY, cx, cy, minDim, nMax, count }
    currentLevelHats: null, // {level, hats}
    visibleHats: [],
};

function buildLevel(level) {
    if (state.currentLevelHats && state.currentLevelHats.level === level) return;
    const t0 = performance.now();
    const hats = buildHatTiling(level, SCALE);
    const buildMs = performance.now() - t0;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const h of hats) for (const p of h.points) {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const minDim = Math.min(maxX - minX, maxY - minY);
    state.levelBBoxCache[level] = {
        minX, maxX, minY, maxY, cx, cy, minDim,
        nMax: Math.floor(minDim / (1.35 * SCALE)), count: hats.length, buildMs
    };
    state.currentLevelHats = { level, hats };
}

function recomputeCrop() {
    const bbox = state.levelBBoxCache[state.level];
    const hats = state.currentLevelHats.hats;
    const halfW = state.width * SCALE / 2, halfH = state.height * SCALE / 2;
    const originX = bbox.cx + state.centerX * SCALE, originY = bbox.cy + state.centerY * SCALE;
    const visible = [];
    for (const h of hats) {
        const x = h.cx - originX, y = h.cy - originY;
        if (Math.abs(x) < halfW && Math.abs(y) < halfH) visible.push(h);
    }
    state.visibleHats = visible;
}

// ---- DOM ----

const canvas = document.getElementById('viewport');
const ctx = canvas.getContext('2d', { alpha: false });
const viewportContainer = document.getElementById('viewport-container');
const statusBar = document.getElementById('status-bar');
const diagnosticsEl = document.getElementById('diagnostics');
const levelButtonsEl = document.getElementById('level-buttons');
const levelReadoutEl = document.getElementById('level-readout');

const inputWidth = document.getElementById('input-width'), inputWidthNum = document.getElementById('input-width-num');
const inputHeight = document.getElementById('input-height'), inputHeightNum = document.getElementById('input-height-num');
const inputLockAspect = document.getElementById('input-lock-aspect');
const inputCx = document.getElementById('input-cx'), inputCxNum = document.getElementById('input-cx-num');
const inputCy = document.getElementById('input-cy'), inputCyNum = document.getElementById('input-cy-num');
const btnJumpEdge = document.getElementById('btn-jump-edge');
const btnCenterReset = document.getElementById('btn-center-reset');
const btnPlay = document.getElementById('btn-play'), btnPause = document.getElementById('btn-pause');
const inputSweepMin = document.getElementById('input-sweep-min'), inputSweepMax = document.getElementById('input-sweep-max');
const inputSweepStep = document.getElementById('input-sweep-step'), sweepStepValue = document.getElementById('sweep-step-value');
const inputSweepSpeed = document.getElementById('input-sweep-speed'), sweepSpeedValue = document.getElementById('sweep-speed-value');
const selectColorMode = document.getElementById('select-color-mode');
const inputFastMode = document.getElementById('input-fast-mode');
const btnFit = document.getElementById('btn-fit');

function resizeCanvas() {
    canvas.width = viewportContainer.clientWidth;
    canvas.height = viewportContainer.clientHeight;
    scheduleRender();
}

function fitView() {
    const margin = 0.92;
    const spanPx = Math.max(state.width, state.height) * SCALE;
    state.zoom = (Math.min(canvas.width, canvas.height) * margin) / spanPx;
    state.pan = { x: 0, y: 0 };
    scheduleRender();
}

let renderScheduled = false;
function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => { renderScheduled = false; render(); });
}

function render() {
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const bbox = state.levelBBoxCache[state.level];
    if (!bbox) return; // first level build hasn't landed yet

    ctx.save();
    ctx.translate(canvas.width / 2 + state.pan.x, canvas.height / 2 + state.pan.y);
    ctx.scale(state.zoom, state.zoom);

    const originX = bbox.cx + state.centerX * SCALE, originY = bbox.cy + state.centerY * SCALE;

    for (const h of state.visibleHats) {
        ctx.fillStyle = colorFor(h);
        const x = h.cx - originX, y = h.cy - originY;
        if (state.fastMode) {
            ctx.fillRect(x - SCALE * 0.28, y - SCALE * 0.28, SCALE * 0.56, SCALE * 0.56);
        } else {
            ctx.beginPath();
            const pts = h.points;
            ctx.moveTo(pts[0].x - originX, pts[0].y - originY);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x - originX, pts[i].y - originY);
            ctx.closePath();
            ctx.fill();
        }
    }

    // crop-window outline, in world space
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.lineWidth = 1.5 / state.zoom;
    ctx.strokeRect(-state.width * SCALE / 2, -state.height * SCALE / 2, state.width * SCALE, state.height * SCALE);

    ctx.restore();
    updateStatusBar();
}

function colorFor(h) {
    if (state.colorMode === 'solid') return '#38bdf8';
    if (state.colorMode === 'lineage') return LINEAGE_COLORS[h.tag % LINEAGE_COLORS.length] || '#38bdf8';
    // radial: distance from crop center -> hue gradient
    const bbox = state.levelBBoxCache[state.level];
    const originX = bbox.cx + state.centerX * SCALE, originY = bbox.cy + state.centerY * SCALE;
    const dx = h.cx - originX, dy = h.cy - originY;
    const dist = Math.hypot(dx, dy);
    const maxDist = Math.hypot(state.width * SCALE / 2, state.height * SCALE / 2);
    const t = Math.min(1, dist / maxDist);
    const hue = 200 - t * 200; // cyan (center) -> red (edge)
    return `hsl(${hue}, 85%, ${55 - t * 15}%)`;
}

function updateStatusBar() {
    statusBar.textContent = `level ${state.level} — visible ${state.visibleHats.length.toLocaleString()} tiles — zoom ${state.zoom.toFixed(2)}x`;
}

// Estimates "solid interior" tile density from a small sample box at the
// crop center, rather than count/rawBoundingBoxArea — the raw supertile is
// itself a non-convex blob that never fills its own bounding box, even in
// fully solid regions, so that simpler baseline reads >100% everywhere and
// can't distinguish solid interior from notch.
function computeLocalDensity() {
    const bbox = state.levelBBoxCache[state.level];
    const originX = bbox.cx + state.centerX * SCALE, originY = bbox.cy + state.centerY * SCALE;
    const halfW = state.width * SCALE / 2, halfH = state.height * SCALE / 2;
    const sampleHalf = Math.max(2 * SCALE, Math.min(halfW, halfH) * 0.08);
    let count = 0;
    for (const h of state.currentLevelHats.hats) {
        const x = h.cx - originX, y = h.cy - originY;
        if (Math.abs(x) < sampleHalf && Math.abs(y) < sampleHalf) count++;
    }
    return { density: count / ((2 * sampleHalf) * (2 * sampleHalf)), sampleHalf };
}

function updateDiagnostics() {
    const bbox = state.levelBBoxCache[state.level];
    const halfW = state.width * SCALE / 2, halfH = state.height * SCALE / 2;
    const { density, sampleHalf } = computeLocalDensity();
    const naiveExpected = (2 * halfW) * (2 * halfH) * density;
    const actual = state.visibleHats.length;
    const coverage = actual / naiveExpected;
    diagnosticsEl.textContent =
`level:            ${state.level}
raw hat count:    ${bbox.count.toLocaleString()}
raw bbox (w x h): ${bbox.maxX - bbox.minX | 0} x ${bbox.maxY - bbox.minY | 0} px
raw minDim:       ${bbox.minDim.toFixed(1)} px
level Nmax:       ${bbox.nMax}  (edge of this level's usable range)
build time:       ${bbox.buildMs.toFixed(0)} ms

crop width/height: ${state.width} x ${state.height} tiles
crop half-extent:  ${halfW.toFixed(0)} x ${halfH.toFixed(0)} px
center offset:     (${state.centerX}, ${state.centerY}) tiles

visible tiles:     ${actual.toLocaleString()}
core-density est*: ${naiveExpected.toFixed(0)}
coverage ratio:    ${(coverage * 100).toFixed(1)}%  (< 100% = notch clipping)

* estimated from tile density in a ${(sampleHalf * 2 / SCALE).toFixed(0)}-tile
  sample box at the crop center (assumed solid); coverage well under
  100% means the crop window is clipping through the supertile's
  non-convex (notched) boundary somewhere within it.`;
}

function setLevel(level, opts = {}) {
    const doIt = () => {
        statusBar.textContent = `Building level ${level}...`;
        // setTimeout, not requestAnimationFrame: rAF is suspended indefinitely
        // in backgrounded/non-visible tabs, which would leave the build (and
        // this status message) stuck forever if the tab loses focus.
        setTimeout(() => setTimeout(() => {
            buildLevel(level);
            state.level = level;
            if (opts.jumpToEdge) {
                const n = state.levelBBoxCache[level].nMax;
                state.width = n; state.height = n;
                inputWidth.value = n; inputWidthNum.value = n;
                inputHeight.value = n; inputHeightNum.value = n;
                inputWidth.max = Math.max(4000, n * 1.2);
                inputHeight.max = Math.max(4000, n * 1.2);
            }
            recomputeCrop();
            refreshLevelButtons();
            fitView();
            updateDiagnostics();
        }));
    };
    if (level === 7 && !state.levelBBoxCache[7]) {
        if (!confirm('Level 7 builds ~2.55 million tiles and may take several seconds and significant memory. Continue?')) return;
    }
    doIt();
}

function refreshLevelButtons() {
    [...levelButtonsEl.children].forEach(btn => {
        btn.classList.toggle('active', Number(btn.dataset.level) === state.level);
    });
    const b = state.levelBBoxCache[state.level];
    levelReadoutEl.textContent = b ? `this level's edge (Nmax) = ${b.nMax} tile-units — ${b.count.toLocaleString()} hats` : '—';
}

function buildLevelButtons() {
    for (let l = 1; l <= 7; l++) {
        const btn = document.createElement('button');
        btn.textContent = 'L' + l + (LEVEL_HAT_COUNTS[l] >= 1000000 ? ' ⚠' : '');
        btn.dataset.level = l;
        btn.title = `${LEVEL_HAT_COUNTS[l].toLocaleString()} hats`;
        btn.onclick = () => setLevel(l);
        levelButtonsEl.appendChild(btn);
    }
}

function syncWidthHeight(newWidth, newHeight, fromWidth) {
    if (state.lockAspect) {
        const v = fromWidth ? newWidth : newHeight;
        newWidth = v; newHeight = v;
    }
    state.width = Math.max(1, newWidth);
    state.height = Math.max(1, newHeight);
    inputWidth.value = state.width; inputWidthNum.value = state.width;
    inputHeight.value = state.height; inputHeightNum.value = state.height;
    recomputeCrop();
    scheduleRender();
    updateDiagnostics();
}

function setupEvents() {
    window.addEventListener('resize', resizeCanvas);

    inputWidth.oninput = () => syncWidthHeight(Number(inputWidth.value), Number(inputHeight.value), true);
    inputWidthNum.onchange = () => { inputWidth.max = Math.max(inputWidth.max, inputWidthNum.value); syncWidthHeight(Number(inputWidthNum.value), Number(inputHeight.value), true); };
    inputHeight.oninput = () => syncWidthHeight(Number(inputWidth.value), Number(inputHeight.value), false);
    inputHeightNum.onchange = () => { inputHeight.max = Math.max(inputHeight.max, inputHeightNum.value); syncWidthHeight(Number(inputWidth.value), Number(inputHeightNum.value), false); };
    inputLockAspect.onchange = () => { state.lockAspect = inputLockAspect.checked; };

    const syncCenter = () => {
        state.centerX = Number(inputCxNum.value);
        state.centerY = Number(inputCyNum.value);
        inputCx.value = state.centerX; inputCy.value = state.centerY;
        recomputeCrop(); scheduleRender(); updateDiagnostics();
    };
    inputCx.oninput = () => { inputCxNum.value = inputCx.value; syncCenter(); };
    inputCxNum.onchange = syncCenter;
    inputCy.oninput = () => { inputCyNum.value = inputCy.value; syncCenter(); };
    inputCyNum.onchange = syncCenter;

    btnJumpEdge.onclick = () => setLevel(state.level, { jumpToEdge: true });
    btnCenterReset.onclick = () => { inputCxNum.value = 0; inputCyNum.value = 0; syncCenter(); };

    selectColorMode.onchange = () => { state.colorMode = selectColorMode.value; scheduleRender(); };
    inputFastMode.onchange = () => { state.fastMode = inputFastMode.checked; scheduleRender(); };
    btnFit.onclick = fitView;

    inputSweepStep.oninput = () => sweepStepValue.textContent = inputSweepStep.value;
    inputSweepSpeed.oninput = () => sweepSpeedValue.textContent = inputSweepSpeed.value + 'ms';
    btnPlay.onclick = startSweep;
    btnPause.onclick = stopSweep;

    let dragging = false, lastPos = { x: 0, y: 0 };
    canvas.addEventListener('mousedown', e => { dragging = true; lastPos = { x: e.clientX, y: e.clientY }; });
    window.addEventListener('mousemove', e => {
        if (!dragging) return;
        state.pan.x += e.clientX - lastPos.x;
        state.pan.y += e.clientY - lastPos.y;
        lastPos = { x: e.clientX, y: e.clientY };
        scheduleRender();
    });
    window.addEventListener('mouseup', () => { dragging = false; });
    viewportContainer.addEventListener('wheel', e => {
        e.preventDefault();
        state.zoom *= e.deltaY > 0 ? 0.9 : 1.1;
        scheduleRender();
    }, { passive: false });
}

function startSweep() {
    if (state.sweep.playing) return;
    state.sweep.playing = true;
    btnPlay.disabled = true; btnPause.disabled = false;
    const tick = () => {
        const min = Number(inputSweepMin.value), max = Number(inputSweepMax.value);
        const step = Number(inputSweepStep.value) * state.sweep.direction;
        let next = state.width + step;
        if (next >= max) { next = max; state.sweep.direction = -1; }
        else if (next <= min) { next = min; state.sweep.direction = 1; }
        syncWidthHeight(next, next, true);
        state.sweep.timer = setTimeout(tick, Number(inputSweepSpeed.value));
    };
    tick();
}

function stopSweep() {
    state.sweep.playing = false;
    btnPlay.disabled = false; btnPause.disabled = true;
    if (state.sweep.timer) clearTimeout(state.sweep.timer);
}

function init() {
    buildLevelButtons();
    setupEvents();
    resizeCanvas();
    setLevel(state.level);
}

init();
