// ===================================================================
// Lenati scale descent ("the body as the Mandelbrot set")
// Every structure opens into the next smaller world that makes sense
// for it, and stops where its own detail stops. A red blood cell ends at
// haemoglobin, the nose ends at an odour receptor, a nucleated cell goes
// on to chromatin, nucleosomes, histones and DNA.
// Worlds are procedural 3D scenes built from published dimensions.
// ===================================================================

SYSTEMS.cell = {name: 'Cell biology', layer: 'organ', color: 0x6fc2b0};
SYSTEMS.molecule = {name: 'Molecular biology', layer: 'organ', color: 0x9b8be0};

// The scale ladder shown at the bottom of the screen
const LEVELS = [
  ['body', 'Body', '1.7 m'], ['organ', 'Organ', '10 cm'], ['tissue', 'Tissue', '1 mm'], ['cell', 'Cell', '20 µm'],
  ['organelle', 'Organelle', '2–6 µm'], ['chromatin', 'Chromatin', '30 nm'], ['nucleosome', 'Nucleosome', '11 nm'], ['molecule', 'Molecule', '2–10 nm']];
const LEVEL_IX = Object.fromEntries(LEVELS.map((l, i) => [l[0], i]));

// ---------- small geometry kit ----------
const MG = {sph: new THREE.SphereGeometry(1, 28, 18), sphLo: new THREE.SphereGeometry(1, 12, 8),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 18, 1), cylLo: new THREE.CylinderGeometry(1, 1, 1, 7, 1),
  box: new THREE.BoxGeometry(1, 1, 1), tor: new THREE.TorusGeometry(1, 0.32, 10, 28)};
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
function tubeG(pts, r, seg, rad, closed) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => p.isVector3 ? p : V3(p)), !!closed, 'centripetal'), seg || 64, r, rad || 8, !!closed); }
function mm(color, o = {}) {
  const op = o.op === undefined ? 1 : o.op;
  const m = new THREE.MeshPhysicalMaterial({color: new THREE.Color(color).convertSRGBToLinear(), roughness: o.r === undefined ? 0.45 : o.r, metalness: 0,
    clearcoat: o.cc === undefined ? 0.3 : o.cc, clearcoatRoughness: 0.45, transparent: op < 1, opacity: op, depthWrite: op >= 0.6,
    side: o.ds ? THREE.DoubleSide : THREE.FrontSide, emissive: new THREE.Color(o.em || 0x000000), emissiveIntensity: o.ei || 1});
  m.userData.baseEm = m.emissive.clone(); return m; }
// stripes along a local axis (sarcomeres, lamellae)
function striate(m, period, axis, depth) {
  const d = depth || 0.25;
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP=position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float zl=fract(vOP.${axis}/${period.toFixed(5)}); float band=smoothstep(.08,.0,abs(zl-.5)-.38);
        float a=smoothstep(.15,.35,zl)*smoothstep(.85,.65,zl);
        diffuseColor.rgb*= (1.-${d.toFixed(2)})+${d.toFixed(2)}*a; diffuseColor.rgb*=1.-.45*band;`); };
  return m; }
function inst(geo, mat, list) {
  const im = new THREE.InstancedMesh(geo, mat, list.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3();
  list.forEach((t, i) => {
    if (t.q) q.copy(t.q); else q.setFromEuler(e.set(...(t.r || [0, 0, 0])));
    if (typeof t.s === 'number') s.set(t.s, t.s, t.s); else if (t.s) s.fromArray(t.s); else s.set(1, 1, 1);
    m4.compose(V3(t.p), q, s); im.setMatrixAt(i, m4); });
  im.instanceMatrix.needsUpdate = true; return im; }
function segT(a, b, r) { // instance transform for a unit cylinder from a to b
  const A = V3(a), B = V3(b), d = B.clone().sub(A), L = d.length();
  return {p: A.clone().add(B).multiplyScalar(0.5).toArray(), q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), s: [r, L, r]}; }
function mesh(geo, mat, p, s, r) { const m = new THREE.Mesh(geo, mat); if (p) m.position.fromArray(p); if (s !== undefined) { if (typeof s === 'number') m.scale.setScalar(s); else m.scale.fromArray(s); } if (r) m.rotation.set(...r); return m; }
// random walk curve, handy for fibres, tails and capillaries
function walk(r, start, n, step, bias) { const pts = [V3(start)], d = new THREE.Vector3(...(bias || [1, 0, 0])).normalize();
  for (let i = 0; i < n; i++) { d.add(new THREE.Vector3(r() - .5, r() - .5, r() - .5).multiplyScalar(0.9)).normalize(); pts.push(pts[pts.length - 1].clone().addScaledVector(d, step)); }
  return pts; }
// branching tree (dendrites, capillary beds): returns list of [a,b,r] segments
function branch(r, a, dir, len, rad, depth, out, spread) {
  const b = V3(a).addScaledVector(V3(dir).normalize(), len); out.push([V3(a), b, rad]);
  if (depth <= 0) return out;
  const n = depth > 2 ? 2 : (r() < .5 ? 2 : 3);
  for (let i = 0; i < n; i++) { const d = V3(dir).normalize().add(new THREE.Vector3(r() - .5, r() - .5, r() - .5).multiplyScalar(spread || 1.3)).normalize();
    branch(r, b, d.toArray(), len * (0.62 + r() * 0.2), rad * 0.72, depth - 1, out, spread); }
  return out; }
function segsMesh(segs, mat, lo) { return inst(lo ? MG.cylLo : MG.cyl, mat, segs.map(([a, b, rr]) => segT(a.toArray(), b.toArray(), rr))); }
function jointsMesh(segs, mat) { return inst(MG.sphLo, mat, segs.map(([a, b, rr]) => ({p: b.toArray(), s: rr}))); }

// ---------- shared card text ----------
const T = {
  membrane: ['Plasma membrane', '', 'A lipid bilayer about 7–10 nm thick, packed with proteins and cholesterol.', 'Decides what enters and leaves, and carries the receptors and channels the cell uses to sense and signal.', '7–10 nm thick'],
  nucleus: ['Nucleus', '', 'The largest organelle, wrapped in a double membrane and holding the cell\'s 46 chromosomes.', 'Stores the DNA and controls which genes are read.', 'about 6 µm across'],
  mito: ['Mitochondria', '', 'Bean-shaped organelles 0.5–1 µm wide with a folded inner membrane and their own small genome.', 'Make most of the cell\'s ATP by burning fuel with oxygen.', '0.5–1 µm wide, 1–2 µm long'],
  rer: ['Rough endoplasmic reticulum', 'Rough ER', 'Flattened membrane sacs studded with ribosomes, continuous with the outer nuclear membrane.', 'Builds and folds proteins destined for membranes or for secretion.', ''],
  golgi: ['Golgi apparatus', '', 'A stack of 4–8 flattened sacs (cisternae) beside the nucleus.', 'Trims, tags and sorts proteins and lipids, then ships them out in vesicles.', 'about 1–3 µm across'],
  ribo: ['Ribosomes', '', 'Particles of RNA and protein about 25–30 nm across, free in the cytoplasm or bound to the ER.', 'Read messenger RNA and join amino acids into proteins, a few per second.', '25–30 nm'],
  lyso: ['Lysosomes', '', 'Small vesicles kept acidic (about pH 4.5–5) and filled with around 60 digestive enzymes.', 'Break down worn-out parts, engulfed material and large molecules for recycling.', '0.1–1 µm'],
  cyto: ['Microtubules', 'Cytoskeleton', 'Hollow protein tubes 25 nm wide radiating from the centrosome, working with actin and intermediate filaments.', 'Give the cell its shape and act as tracks for motor proteins carrying cargo.', '25 nm wide'],
  centro: ['Centrosome', '', 'A pair of centrioles at right angles, surrounded by protein matrix, next to the nucleus.', 'Organises microtubules, and builds the spindle when the cell divides.', 'centrioles about 0.5 µm long'],
};
const BIO = 'Alberts et al., Molecular Biology of the Cell, 7th ed. (2022)';
const HISTO = 'Ross & Pawlina, Histology: A Text and Atlas, 8th ed. (2020)';

// ---------- the worlds ----------
// Each world: id, level, name, unit (metres per scene unit), c (Julia constant), cam, comps (card data), build(ctx)
const WORLDS = {};
const W = def => { WORLDS[def.id] = def; return def; };
const C = (name, common, what, does, o) => Object.assign({name, common, what, does}, o || {});
const fromT = (k, o) => C(T[k][0], T[k][1], T[k][2], T[k][3], Object.assign({size: T[k][4]}, o || {}));

// ----- standard organelles inside a cell world -----
function organelles(ctx, r, o) {
  // o: {R: cell radius-ish box [x,y,z], nuc: [pos, scale], skip:{}}
  const [hx, hy, hz] = o.half;
  const inside = (m) => { let p; do { p = [(r() * 2 - 1) * hx * m, (r() * 2 - 1) * hy * m, (r() * 2 - 1) * hz * m]; } while (o.nuc && V3(p).sub(V3(o.nuc[0])).length() < Math.max(...o.nuc[1]) * 1.25); return p; };
  if (!o.skip || !o.skip.mito) {
    const n = o.mito || 18, list = [];
    for (let i = 0; i < n; i++) list.push({p: inside(o.mitoSpread || 0.78), r: [r() * 3, r() * 3, r() * 3], s: [0.38, 0.95 + r() * 0.5, 0.38]});
    ctx.add('mito', inst(MG.sph, striate(mm(0xc96f4a, {r: .5}), 0.22, 'y', .35), list)); }
  // rough ER: curved sheets hugging the nucleus
  if (!o.skip || !o.skip.rer) { const g = new THREE.Group(), mat = mm(0x5f86c9, {op: .85, ds: true, r: .6});
    const [np, ns] = o.nuc || [[0, 0, 0], [2, 2, 2]];
    for (let k = 0; k < 5; k++) { const R = Math.max(...ns) * (1.35 + k * 0.18), geo = new THREE.SphereGeometry(R, 32, 10, r() * 6, 1.6 + r() * .6, 0.9 + r() * .4, 0.8);
      const m = new THREE.Mesh(geo, mat); m.position.fromArray(np); m.scale.set(ns[0] / Math.max(...ns), ns[1] / Math.max(...ns), ns[2] / Math.max(...ns)); g.add(m); }
    ctx.add('rer', g); }
  { const rib = []; for (let i = 0; i < (o.ribo || 260); i++) rib.push({p: inside(0.85), s: 0.06});
    ctx.add('ribo', inst(MG.sphLo, mm(0x2f3a63, {r: .7}), rib)); }
  if (!o.skip || !o.skip.golgi) { const g = new THREE.Group(), mat = mm(0xd4a648, {op: .9, ds: true});
    const gp = o.golgi || [o.nuc[0][0] + Math.max(...o.nuc[1]) * 1.5, o.nuc[0][1] + 0.4, o.nuc[0][2]];
    for (let k = 0; k < 6; k++) { const geo = new THREE.SphereGeometry(1.1 - k * 0.04, 24, 6, 0, Math.PI * 2, 0.5, 0.65); const m = new THREE.Mesh(geo, mat);
      m.position.set(gp[0] + k * 0.12, gp[1], gp[2]); m.rotation.z = Math.PI / 2; m.scale.set(1, 0.35, 1); g.add(m); }
    const ves = []; for (let i = 0; i < 14; i++) ves.push({p: [gp[0] + 0.9 + r() * .6, gp[1] + (r() - .5) * 1.6, gp[2] + (r() - .5) * 1.6], s: 0.1});
    g.add(inst(MG.sphLo, mat, ves)); ctx.add('golgi', g); }
  if (!o.skip || !o.skip.lyso) { const l = []; for (let i = 0; i < (o.lyso || 8); i++) l.push({p: inside(0.7), s: 0.18 + r() * 0.12});
    ctx.add('lyso', inst(MG.sph, mm(0x7d5aa6, {r: .35}), l)); }
  if (!o.skip || !o.skip.cyto) { const cp = o.centro || [o.nuc[0][0] - Math.max(...o.nuc[1]) * 1.3, o.nuc[0][1], o.nuc[0][2] + 0.5];
    const segs = []; for (let i = 0; i < 46; i++) { const d = new THREE.Vector3(r() - .5, r() - .5, r() - .5).normalize(); const b = V3(cp).add(new THREE.Vector3(d.x * hx * .9, d.y * hy * .9, d.z * hz * .9)); segs.push([V3(cp), b, 0.03]); }
    ctx.add('cyto', segsMesh(segs, mm(0x9fd8c8, {op: .7, r: .3}), true));
    const c = new THREE.Group(), cm = mm(0xe9e2c4, {r: .4}); c.add(mesh(MG.cyl, cm, cp, [0.1, 0.5, 0.1])); c.add(mesh(MG.cyl, cm, [cp[0] + .2, cp[1], cp[2]], [0.1, 0.5, 0.1], [0, 0, Math.PI / 2]));
    ctx.add('centro', c); }
}
function cellComps(extra, nucWhat) {
  return Object.assign({
    membrane: fromT('membrane'), nucleus: fromT('nucleus', {deeper: 'nucleus', what: nucWhat || T.nucleus[2]}), mito: fromT('mito', {deeper: 'mitochondrion'}),
    rer: fromT('rer'), golgi: fromT('golgi'), ribo: fromT('ribo'), lyso: fromT('lyso'), cyto: fromT('cyto'), centro: fromT('centro')}, extra || {}); }
function nucleusMesh(ctx, p, s, col) {
  const g = new THREE.Group(); g.add(mesh(MG.sph, mm(col || 0x5b4a9e, {r: .5, cc: .5}), p, s));
  g.add(mesh(MG.sph, mm(0x2b2050, {r: .6}), [p[0] + s[0] * .25, p[1] + s[1] * .2, p[2] + s[2] * .55], [s[0] * .28, s[1] * .28, s[2] * .28]));
  ctx.add('nucleus', g); }

// =================== TISSUES ===================
W({id: 'cardiac', level: 'tissue', name: 'Heart muscle tissue', common: 'Myocardium', sys: 'cardio', unit: 1e-5, c: [-0.745, 0.113], cam: [9, 7, 16], R: 14,
  what: 'Branching striated muscle cells joined end to end by intercalated discs, packed between dense capillaries.',
  does: 'Contracts as a single unit, because electrical signals pass from cell to cell through gap junctions in the discs.', size: 'Each cell about 100 µm long', src: [HISTO, 'Bergmann et al., Science 324:98 (2009)'],
  comps: {
    myocyte: C('Cardiomyocytes', 'Heart muscle cells', 'Heart muscle cells about 100 µm long and 10–25 µm wide, with branched ends and one or two central nuclei.', 'Shorten with every beat. Up to about a third of each cell is mitochondria, so the heart runs almost entirely on oxygen.', {size: '100 × 10–25 µm', deeper: 'cell-cardiomyocyte'}),
    disc: C('Intercalated discs', '', 'Step-shaped junctions where neighbouring cells meet end to end.', 'Hold cells together with desmosomes and pass electrical current through gap junctions (connexin 43), so the wave of contraction spreads.'),
    nuclei: C('Nuclei', '', 'One or two oval nuclei in the centre of each cell.', 'Hold the DNA. Adult heart muscle cells rarely divide: roughly 1% are renewed a year in young adults, falling with age.', {deeper: 'nucleus'}),
    cap: C('Capillaries', '', 'Vessels 5–10 µm across, roughly one alongside every muscle cell.', 'Deliver oxygen. At rest the heart already extracts about 70–75% of the oxygen in its blood, so it can only get more by raising flow.'),
    rbc: C('Red blood cells', 'Erythrocytes', 'Biconcave discs about 7.5 µm across with no nucleus, packed with haemoglobin.', 'Carry oxygen, squeezing through capillaries in single file. The flow shown here is schematic.', {size: '7.5 × 2 µm', deeper: 'hemoglobin'}),
    endo: C('Endomysium', '', 'A fine sheath of collagen around each muscle cell.', 'Keeps cells aligned and carries the capillaries. It thickens and stiffens with fibrosis.'),
    fibro: C('Fibroblasts', '', 'Spindle-shaped cells between the muscle cells.', 'Make and remodel the collagen framework, and form the scar after a heart attack.')},
  build(ctx) {
    const r = rng(11), cells = [], discs = [], nuc = [];
    for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) for (let k = 0; k < 2; k++) {
      const y = (row - 1.5) * 2.4, z = (col - 1) * 2.6, x0 = -12 + k * 10.6 + (row % 2) * 5.3 + (r() - .5);
      cells.push({p: [x0 + 5, y, z], r: [0, 0, Math.PI / 2], s: [1, 1, 0.82]});
      discs.push({p: [x0, y, z], r: [0, 0, Math.PI / 2], s: [1.02, 0.07, 0.85]});
      nuc.push({p: [x0 + 5 + (r() - .5), y, z], s: [1.5, 0.48, 0.42]}); }
    const body = capsuleGeo(1, 9.6);
    ctx.add('myocyte', inst(body, striate(mm(0xb5464a, {r: .5, op: .93}), 0.2, 'y', .3), cells));
    // short branches joining rows, the hallmark of cardiac muscle
    const br = []; for (let i = 0; i < 10; i++) { const x = -10 + r() * 20, y = (Math.floor(r() * 3) - 1) * 2.4, z = (Math.floor(r() * 3) - 1) * 2.6; br.push(segT([x, y, z], [x + 2.2, y + 2.4, z], 0.62)); }
    ctx.add('myocyte', inst(MG.cyl, striate(mm(0xb5464a, {r: .5}), 0.2, 'y', .3), br));
    ctx.add('disc', inst(MG.cyl, mm(0x3a1520, {r: .7}), discs));
    ctx.add('nuclei', inst(MG.sph, mm(0x5b4a9e, {cc: .5}), nuc));
    const caps = [];
    for (let row = 0; row < 3; row++) for (let col = 0; col < 2; col++) caps.push({y: (row - 1) * 2.4, z: (col - .5) * 2.6});
    const capMat = mm(0xe07f7f, {op: .38, r: .2}); this._caps = [];
    caps.forEach(c => { const pts = [[-15, c.y, c.z], [-5, c.y + .3, c.z - .2], [5, c.y - .2, c.z + .2], [15, c.y, c.z]];
      ctx.add('cap', new THREE.Mesh(tubeG(pts, 0.42, 60, 12), capMat)); this._caps.push(new THREE.CatmullRomCurve3(pts.map(V3))); });
    // red cells travel along each capillary
    const n = this._caps.length * 7; this._rbc = ctx.add('rbc', new THREE.InstancedMesh(new THREE.TorusGeometry(0.26, 0.15, 10, 20), mm(0xc0262c, {r: .35}), n));
    this._rbcT = Array.from({length: n}, (_, i) => (i % 7) / 7 + r() * .05);
    const endo = []; for (let i = 0; i < 40; i++) endo.push(walk(r, [(r() - .5) * 26, (r() - .5) * 9, (r() - .5) * 7], 8, 1.2));
    endo.forEach(p => ctx.add('endo', new THREE.Mesh(tubeG(p, 0.04, 30, 4), mm(0xe8e0cf, {op: .55}))));
    const fb = []; for (let i = 0; i < 5; i++) fb.push({p: [(r() - .5) * 22, (r() - .5) * 8, (r() > .5 ? 1 : -1) * 3.9], r: [0, 0, Math.PI / 2 + (r() - .5) * .4], s: [0.35, 2.2, 0.3]});
    ctx.add('fibro', inst(MG.sph, mm(0xd8c28f), fb)); },
  tick(t, dt) { const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
    this._rbcT.forEach((u, i) => { u = (u + dt * 0.035) % 1; this._rbcT[i] = u; const c = this._caps[Math.floor(i / 7)], p = c.getPointAt(u), tan = c.getTangentAt(u);
      q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan); m4.compose(p, q, s); this._rbc.setMatrixAt(i, m4); });
    this._rbc.instanceMatrix.needsUpdate = true; }
});

W({id: 'alveoli', level: 'tissue', name: 'Alveoli', common: 'Air sacs', sys: 'resp', unit: 2e-5, c: [-0.4, 0.6], cam: [6, 9, 20], R: 16,
  what: 'The gas-exchange zone: thin-walled air sacs clustered around alveolar ducts, each wrapped in a net of capillaries.',
  does: 'About 480 million alveoli give roughly 70 m² of surface for oxygen to enter the blood and carbon dioxide to leave.', size: 'Each alveolus about 200 µm across', src: ['West, Respiratory Physiology: The Essentials, 11th ed. (2021)', 'Ochs et al., Am J Respir Crit Care Med 169:120 (2004)', HISTO],
  comps: {
    wall: C('Alveolar wall', 'Type I cells', 'Cup-shaped air spaces lined mostly by very flat type I cells, which cover about 95% of the surface.', 'Form the air–blood barrier, as thin as 0.2–0.6 µm, so gases cross by diffusion.', {size: 'about 200 µm across'}),
    duct: C('Alveolar duct', '', 'The air passage the alveoli open from, continuing on from a respiratory bronchiole.', 'Brings air in. Its rim is ringed by elastic fibres and a little smooth muscle.'),
    t2: C('Type II cells', 'Type II pneumocytes', 'Rounded cells about 10 µm across tucked into alveolar corners. They cover only about 5% of the surface.', 'Make surfactant, which lowers surface tension so alveoli do not collapse, and divide to replace damaged type I cells.', {size: 'about 10 µm', deeper: 'cell-pneumocyte'}),
    mac: C('Alveolar macrophages', 'Dust cells', 'Wandering immune cells that crawl over the inner surface.', 'Engulf dust, microbes and debris, then leave by the airways or the lymph.'),
    cap: C('Capillary network', '', 'A dense sheet of capillaries spread over every alveolus.', 'At rest each red cell spends about 0.75 s here and is fully loaded with oxygen in about the first third of that time.'),
    elastic: C('Elastic fibres', '', 'Elastin fibres in the walls and around the mouths of the alveoli.', 'Stretch as you breathe in and recoil to push air out. Their destruction causes emphysema.')},
  build(ctx) {
    const r = rng(7), wall = mm(0xe9a3a3, {op: .55, ds: true, r: .55}), cent = [];
    ctx.add('duct', new THREE.Mesh(tubeG([[-18, 0, 0], [-6, 1, 0], [6, -1, 0], [18, 0, 0]], 2.6, 60, 20), mm(0xd98888, {op: .35, ds: true})));
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2 * 2.3, x = -14 + i * 2.2, R = 4 + r() * .8;
      const c = [x, Math.cos(a) * 6.2, Math.sin(a) * 6.2]; cent.push([c, R]);
      const g = new THREE.SphereGeometry(R, 36, 24, 0, Math.PI * 2, 0, Math.PI * 0.82); const m = new THREE.Mesh(g, wall); m.position.fromArray(c);
      m.lookAt(new THREE.Vector3(c[0], c[1] * 3, c[2] * 3)); m.rotateX(Math.PI / 2); ctx.add('wall', m);
      ctx.add('elastic', mesh(new THREE.TorusGeometry(R * 0.55, 0.08, 6, 40), mm(0xf0d873), V3(c).multiplyScalar(1).lerp(new THREE.Vector3(c[0], 0, 0), 0.62).toArray(), 1));
      const segs = []; for (let k = 0; k < 9; k++) { const th = r() * Math.PI * 2, ph = .3 + r() * 1.9; const pts = [];
        for (let s = 0; s < 8; s++) { const t2 = th + s * 0.28, p2 = ph + Math.sin(s + k) * .25; pts.push(new THREE.Vector3(Math.sin(p2) * Math.cos(t2), Math.cos(p2), Math.sin(p2) * Math.sin(t2)).multiplyScalar(R + 0.15).add(V3(c))); }
        ctx.add('cap', new THREE.Mesh(tubeG(pts, 0.17, 30, 6), mm(k % 2 ? 0xc63b3b : 0x6a4fa8, {r: .35}))); } }
    const t2 = [], mac = [];
    cent.forEach(([c, R], i) => { const d = V3(c).normalize(); t2.push({p: V3(c).addScaledVector(new THREE.Vector3(c[0], 0, 0).sub(V3(c)).normalize(), R * .8).toArray(), s: [0.55, 0.42, 0.5]});
      if (i % 4 === 1) mac.push({p: V3(c).add(new THREE.Vector3(r() - .5, r() - .5, r() - .5).multiplyScalar(R * .9)).toArray(), s: [0.9, 0.55, 0.75], r: [r(), r(), r()]}); });
    ctx.add('t2', inst(MG.sph, mm(0xf3c7b5, {r: .5}), t2)); ctx.add('mac', inst(MG.sph, mm(0xb59a6a, {r: .6}), mac)); }
});

W({id: 'villi', level: 'tissue', name: 'Small intestine lining', common: 'Villi and crypts', sys: 'digest', unit: 5e-5, c: [0.285, 0.01], cam: [32, 22, 38], R: 22,
  what: 'The mucosa: finger-like villi 0.5–1 mm tall, with crypts between them, resting on a thin muscle layer.',
  does: 'Folds, villi and microvilli together give an absorptive surface of about 30 m², roughly half a badminton court.', size: 'Villi 0.5–1 mm tall', src: ['Helander & Fändriks, Scand J Gastroenterol 49:681 (2014)', HISTO],
  comps: {
    villus: C('Villi and enterocytes', 'Absorptive lining', 'Each villus is covered in tall absorptive cells (enterocytes) topped with a brush border of microvilli.', 'Take up sugars, amino acids, fats, vitamins and water. The whole lining is replaced every 3–5 days.', {deeper: 'cell-enterocyte'}),
    goblet: C('Goblet cells', '', 'Cup-shaped cells scattered among the enterocytes.', 'Release mucus that lubricates and shields the lining.'),
    lacteal: C('Lacteals', '', 'A blind-ended lymph vessel in the core of each villus.', 'Absorb fats packed as chylomicrons, which reach the blood through the thoracic duct.'),
    cap: C('Capillary loops', '', 'An arteriole and venule joined by a capillary net inside each villus.', 'Carry absorbed sugars and amino acids to the portal vein and on to the liver.'),
    crypt: C('Crypts of Lieberkühn', 'Intestinal glands', 'Pits opening between the villi.', 'Stem cells at their base make every lining cell; Paneth cells there release antimicrobial proteins.'),
    mm: C('Muscularis mucosae', '', 'A thin sheet of smooth muscle under the mucosa.', 'Ripples the lining to stir contents next to the absorbing surface.'),
    sub: C('Submucosa', '', 'Loose connective tissue carrying larger vessels, lymphatics and the submucosal nerve plexus.', 'Supplies the mucosa and controls local secretion.')},
  build(ctx) {
    const r = rng(5), vill = [], gob = [], crypts = [];
    const vg = capsuleGeo(1, 10); vg.translate(0, 5, 0);
    for (let i = -3; i <= 3; i++) for (let j = -2; j <= 2; j++) { const x = i * 4.2 + (j % 2) * 2.1, z = j * 4, h = 0.8 + r() * .35;
      vill.push({p: [x, 0, z], s: [1.15, h, 0.95], r: [(r() - .5) * .12, 0, (r() - .5) * .12]});
      for (let g = 0; g < 4; g++) { const a = r() * 6.28, yy = 1 + r() * 8 * h; gob.push({p: [x + Math.cos(a) * 1.08, yy, z + Math.sin(a) * .9], s: 0.22}); }
      crypts.push({p: [x + 2.1, -1.6, z + 2], s: [0.7, 3.2, 0.7]}); }
    const vm = mm(0xe2a081, {r: .4, op: .72}); vm.side = THREE.DoubleSide;
    ctx.add('villus', inst(vg, vm, vill));
    ctx.add('goblet', inst(MG.sphLo, mm(0xf4efe6, {r: .3}), gob));
    // core of each villus: lacteal and capillary loop
    const lac = [], capA = [], capV = [];
    vill.forEach(v => { const [x, , z] = v.p, h = v.s[1]; lac.push({p: [x, 5 * h, z], s: [0.22, 4.4 * h, 0.22]});
      capA.push(segT([x - .5, 0, z], [x - .45, 9 * h, z], .1)); capV.push(segT([x + .5, 0, z], [x + .45, 9 * h, z], .1)); });
    ctx.add('lacteal', inst(MG.cyl, mm(0xf6eed2, {op: .9}), lac));
    ctx.add('cap', inst(MG.cylLo, mm(0xc0303a), capA)); ctx.add('cap', inst(MG.cylLo, mm(0x4c64c0), capV));
    ctx.add('crypt', inst(MG.cyl, mm(0x6b2e2a, {r: .8}), crypts));
    ctx.add('mm', mesh(MG.box, mm(0xa8484a, {r: .6}), [0, -3.6, 0], [34, 0.8, 24]));
    ctx.add('mm', mesh(MG.box, mm(0xd99a86, {r: .7}), [0, -1.6, 0], [34, 3.2, 24]));
    ctx.add('sub', mesh(MG.box, mm(0xf0d6c2, {r: .8}), [0, -6.5, 0], [34, 5, 24]));
    for (let k = 0; k < 4; k++) ctx.add('sub', new THREE.Mesh(tubeG(walk(r, [-17, -6 - r() * 2, (r() - .5) * 20], 10, 3.6), 0.35, 40, 8), mm(k % 2 ? 0xb3303a : 0x4e62bc))); }
});

W({id: 'cortex', level: 'tissue', name: 'Cerebral cortex tissue', common: 'Grey matter', sys: 'nerve', unit: 2e-5, c: [-0.70176, -0.3842], cam: [14, 8, 36], R: 18,
  what: 'Grey matter 2–4 mm thick, arranged in six layers of neurons, glial cells and capillaries.',
  does: 'Processes sensation, movement, language and thought. The human cerebral cortex holds about 16 billion neurons.', src: ['Azevedo et al., J Comp Neurol 513:532 (2009), doi:10.1002/cne.21974', 'Kandel et al., Principles of Neural Science, 6th ed. (2021)'],
  comps: {
    neuron: C('Pyramidal neurons', '', 'The main excitatory neurons of the cortex, with a triangular cell body from about 10 µm to over 50 µm.', 'Add up thousands of inputs and send a single output along their axon, using glutamate.', {deeper: 'cell-neuron'}),
    dend: C('Dendrites and spines', '', 'Branching input fibres covered in tiny spines; one pyramidal neuron can carry about 10,000 of them.', 'Each spine usually holds one excitatory synapse, and spines grow, shrink and appear as you learn.'),
    axon: C('Axon and myelin', '', 'A single output fibre wrapped in segments of myelin, with gaps called nodes of Ranvier.', 'Myelin lets the impulse jump from node to node, reaching up to about 100 m/s in the largest fibres.'),
    astro: C('Astrocytes', '', 'Star-shaped glial cells whose end-feet wrap blood vessels and synapses.', 'Recycle neurotransmitter, mop up potassium and help maintain the blood–brain barrier.'),
    oligo: C('Oligodendrocytes', '', 'Glial cells that each myelinate segments of up to about 50 axons.', 'Make the myelin of the brain and spinal cord. Their loss causes the damage in multiple sclerosis.'),
    micro: C('Microglia', '', 'Small branched immune cells resident in the brain.', 'Constantly survey the tissue, clear debris and prune unused synapses.'),
    cap: C('Brain capillaries', '', 'Capillaries sealed by tight junctions, together running for hundreds of kilometres.', 'Form the blood–brain barrier, which keeps most blood-borne molecules and microbes out.'),
    syn: C('Synapses', '', 'Junctions where an axon terminal meets another neuron across a gap about 20 nm wide.', 'Convert an electrical signal into a chemical one and back. The neocortex has roughly 150 trillion of them.')},
  build(ctx) {
    const r = rng(3), somaM = mm(0xd9b2a0, {r: .45}), dM = mm(0xd9b2a0, {r: .45});
    const somas = [], dsegs = [], spines = [], syn = [], axons = [];
    for (let i = 0; i < 6; i++) { const p = [(i - 2.5) * 6 + (r() - .5) * 2, -4 + (r() - .5) * 5, (r() - .5) * 8];
      somas.push({p, s: [1.1, 1.8, 1.1]});
      branch(r, [p[0], p[1] + 1.6, p[2]], [0, 1, 0], 4.5, 0.32, 4, dsegs, 0.7);
      for (let b = 0; b < 4; b++) branch(r, p, [r() - .5, -0.6 - r() * .3, r() - .5], 2.2, 0.2, 2, dsegs, 1.2);
      axons.push([V3(p).add(new THREE.Vector3(0, -1.4, 0)), V3(p).add(new THREE.Vector3((r() - .5) * 3, -14, (r() - .5) * 3))]); }
    const somaG = new THREE.ConeGeometry(1, 1.6, 18); somaG.translate(0, 0.3, 0);
    ctx.add('neuron', inst(somaG, somaM, somas));
    ctx.add('dend', segsMesh(dsegs, dM)); ctx.add('dend', jointsMesh(dsegs, dM));
    dsegs.forEach(([a, b, rr]) => { for (let k = 0; k < 3; k++) { const t2 = r(), p = a.clone().lerp(b, t2), off = new THREE.Vector3(r() - .5, r() - .5, r() - .5).normalize().multiplyScalar(rr + 0.08);
      spines.push({p: p.add(off).toArray(), s: 0.07}); if (r() < .18) syn.push({p: p.toArray(), s: 0.13}); } });
    ctx.add('dend', inst(MG.sphLo, dM, spines));
    ctx.add('syn', inst(MG.sph, mm(0xf2c14e, {em: 0x6a4a00, ei: 1}), syn));
    const myM = mm(0xf4f0e6, {r: .25, cc: .6}), axM = mm(0xd9b2a0); const my = [], ax = [];
    axons.forEach(([a, b]) => { ax.push(segT(a.toArray(), b.toArray(), 0.1)); for (let k = 0; k < 6; k++) { const t0 = 0.08 + k * 0.15; my.push(segT(a.clone().lerp(b, t0).toArray(), a.clone().lerp(b, t0 + 0.12).toArray(), 0.28)); } });
    ctx.add('axon', inst(MG.cylLo, axM, ax)); ctx.add('axon', inst(MG.cyl, myM, my));
    const capPts = [[-20, 2, -3], [-8, 3, 1], [4, 1, -2], [20, 2.5, 2]]; ctx.add('cap', new THREE.Mesh(tubeG(capPts, 0.45, 60, 12), mm(0xc8434a, {op: .8})));
    const capC = new THREE.CatmullRomCurve3(capPts.map(V3));
    const astro = [], aseg = [];
    for (let i = 0; i < 4; i++) { const p = [(i - 1.5) * 9, 6 + r() * 3, (r() - .5) * 6]; astro.push({p, s: 0.7});
      for (let k = 0; k < 9; k++) { const end = k < 2 ? capC.getPointAt(Math.min(.98, Math.max(.02, (p[0] + 20) / 40 + (r() - .5) * .1))) : V3(p).add(new THREE.Vector3(r() - .5, r() - .5, r() - .5).normalize().multiplyScalar(2 + r() * 2));
        aseg.push([V3(p), end, 0.08]); } }
    const aM = mm(0x7cc6a8, {r: .5}); ctx.add('astro', inst(MG.sph, aM, astro)); ctx.add('astro', segsMesh(aseg, aM, true));
    const oM = mm(0x9d8fd6, {r: .5}); ctx.add('oligo', inst(MG.sph, oM, [{p: [3, -10, 4], s: 0.75}, {p: [-9, -12, -3], s: 0.75}]));
    ctx.add('oligo', segsMesh([[V3([3, -10, 4]), axons[3][0].clone().lerp(axons[3][1], 0.6), .06], [V3([-9, -12, -3]), axons[1][0].clone().lerp(axons[1][1], 0.7), .06]], oM, true));
    const mic = [], ms = []; for (let i = 0; i < 3; i++) { const p = [(r() - .5) * 26, (r() - .5) * 10, (r() - .5) * 8]; mic.push({p, s: 0.45}); branch(r, p, [r() - .5, r() - .5, r() - .5], 1.4, 0.06, 2, ms, 1.6); }
    const miM = mm(0xb98fbf); ctx.add('micro', inst(MG.sph, miM, mic)); ctx.add('micro', segsMesh(ms, miM, true)); }
});

W({id: 'bone', level: 'tissue', name: 'Compact bone tissue', common: 'Cortical bone', sys: 'bone', unit: 5e-5, c: [-0.835, -0.2321], cam: [30, 26, 36], R: 22,
  what: 'Dense outer bone built from cylindrical units called osteons, each about 0.2 mm across, running along the length of the bone.',
  does: 'Bears load. The mineral (hydroxyapatite) resists squashing while collagen resists bending; about two thirds of bone\'s dry weight is mineral.', src: ['Buenzli & Sims, Bone 75:144 (2015)', HISTO],
  comps: {
    osteon: C('Osteons', 'Haversian systems', 'Columns of 4–20 concentric lamellae around a central canal, about 0.2 mm wide.', 'Carry blood and nerves along the bone. They are rebuilt constantly; the adult skeleton renews about 10% of itself each year.', {size: 'about 200 µm wide'}),
    lam: C('Lamellae', '', 'Layers of mineralised collagen 3–7 µm thick whose fibres change direction from one layer to the next.', 'Like plywood, the alternating fibre angle resists twisting and stops cracks spreading.', {deeper: 'collagen'}),
    canal: C('Central canals', 'Haversian canals', 'Channels about 50 µm across holding small blood vessels and nerves.', 'Supply the bone cells buried in the mineral.'),
    ocy: C('Osteocytes', 'Bone cells', 'Former bone-forming cells sealed into small cavities (lacunae) in the mineral. There are about 42 billion in the human skeleton.', 'Sense strain and signal where bone should be added or removed.', {deeper: 'cell-osteocyte'}),
    cana: C('Canaliculi', '', 'Channels about 0.2–0.5 µm wide connecting the lacunae to each other and to the central canal.', 'Let osteocytes touch through long processes and let nutrients seep through solid bone.'),
    volk: C('Volkmann canals', 'Perforating canals', 'Channels running across the bone, at right angles to the osteons.', 'Join the central canals to each other and to vessels on the bone surface.')},
  build(ctx) {
    const r = rng(9), H = 18, lamA = mm(0xeadfc4, {r: .7, op: .97}), lamB = mm(0xd6c7a5, {r: .7, op: .97});
    const cents = [[-6, 0], [0, -5], [6, 0], [0, 5], [-6, 9], [6, -9], [-11, -4], [11, 4]];
    const ocy = [], can = [];
    cents.forEach(([x, z], i) => { const R = 2.6 + r() * .6;
      for (let k = 0; k < 6; k++) { const rr = R * (1 - k * 0.14); ctx.add(k === 0 ? 'osteon' : 'lam', mesh(new THREE.CylinderGeometry(rr, rr, H, 40, 1, true), k % 2 ? lamB : lamA, [x, 0, z])); }
      ctx.add('lam', mesh(new THREE.RingGeometry(0.62, R, 40), lamA, [x, H / 2, z], 1, [-Math.PI / 2, 0, 0]));
      ctx.add('canal', mesh(MG.cyl, mm(0x3a2a24, {r: .8}), [x, 0, z], [0.6, H + .02, 0.6]));
      ctx.add('canal', mesh(MG.cyl, mm(0xc0303a), [x - .2, 0, z], [0.14, H + .05, 0.14])); ctx.add('canal', mesh(MG.cyl, mm(0x4c64c0), [x + .2, 0, z], [0.16, H + .05, 0.16]));
      for (let k = 1; k < 5; k++) for (let a = 0; a < 7 + k * 2; a++) { const th = a / (7 + k * 2) * 6.283 + k, rr = 0.6 + k * (R - 0.6) / 5;
        const p = [x + Math.cos(th) * rr, H / 2 + 0.02, z + Math.sin(th) * rr]; ocy.push({p, s: [0.22, 0.05, 0.12], r: [0, -th, 0]});
        can.push(segT(p, [x + Math.cos(th) * (rr - .7), H / 2 + .02, z + Math.sin(th) * (rr - .7)], 0.02)); } });
    ctx.add('ocy', inst(MG.sph, mm(0x5a3b2c, {r: .6}), ocy)); ctx.add('cana', inst(MG.cylLo, mm(0x6e4c3a), can));
    ctx.add('volk', mesh(MG.cyl, mm(0x3a2a24), [0, 2, 0], [0.45, 13, 0.45], [0, 0, Math.PI / 2]));
    ctx.add('volk', mesh(MG.cyl, mm(0x3a2a24), [0, -4, 2], [0.45, 12, 0.45], [Math.PI / 2, 0, 0]));
    ctx.add('lam', mesh(MG.box, mm(0xe2d5b6, {r: .8, op: .35}), [0, 0, 0], [30, H - .2, 26])); }
});

W({id: 'skmuscle', level: 'tissue', name: 'Skeletal muscle tissue', common: 'Muscle fibres', sys: 'muscle', unit: 2e-5, c: [0.355, 0.355], cam: [26, 16, 32], R: 20,
  what: 'Long, multinucleate fibres bundled into fascicles, each layer wrapped in its own connective tissue.',
  does: 'Moves the skeleton under voluntary control. Skeletal muscle makes up roughly a third to two fifths of adult body mass.', src: [HISTO, 'Frontera & Ochala, Calcif Tissue Int 96:183 (2015)'],
  comps: {
    fibre: C('Muscle fibres', 'Muscle cells', 'Single cells 10–100 µm wide and up to many centimetres long, formed when precursor cells fuse.', 'Contract when their motor neuron fires. The stripes are repeating sarcomeres about 2–2.5 µm long.', {deeper: 'cell-myofiber'}),
    nuc: C('Nuclei', '', 'Hundreds of nuclei per fibre, pressed flat against the edge just under the membrane.', 'Each looks after its own stretch of the fibre.', {deeper: 'nucleus'}),
    peri: C('Perimysium', '', 'Connective tissue wrapping each bundle (fascicle) of fibres.', 'Carries larger vessels and nerves and passes force to the tendon.'),
    cap: C('Capillaries', '', 'Several capillaries running alongside every fibre.', 'Supply oxygen; endurance training increases their number.'),
    nmj: C('Motor nerve and end plate', 'Neuromuscular junction', 'A motor axon ending on the fibre at a specialised synapse.', 'Releases acetylcholine to trigger contraction. One motor neuron and all the fibres it controls form a motor unit.'),
    sat: C('Satellite cells', 'Muscle stem cells', 'Small flattened cells tucked between a fibre and its outer coat.', 'Wake after injury or exercise to repair and enlarge fibres.')},
  build(ctx) {
    const r = rng(21), fib = [], nuc = [], caps = [], sat = [];
    for (let i = 0; i < 19; i++) { const a = i * 2.4, rr = i ? 1.6 * Math.sqrt(i) : 0, y = Math.cos(a) * rr, z = Math.sin(a) * rr, R = 0.75 + r() * .25;
      fib.push({p: [0, y, z], r: [0, 0, Math.PI / 2], s: [R, 30, R]});
      for (let k = 0; k < 6; k++) { const th = r() * 6.28; nuc.push({p: [-13 + k * 5 + r() * 2, y + Math.cos(th) * R * .95, z + Math.sin(th) * R * .95], s: [0.9, 0.12, 0.25], r: [th, 0, 0]}); }
      if (i % 2) caps.push(segT([-15, y + R + .2, z], [15, y + R + .25, z + .3], 0.15));
      if (i % 5 === 2) sat.push({p: [(r() - .5) * 20, y - R * .95, z], s: [0.7, 0.12, 0.3]}); }
    ctx.add('fibre', inst(MG.cyl, striate(mm(0xb03e3a, {r: .5}), 0.25, 'y', .35), fib));
    ctx.add('nuc', inst(MG.sph, mm(0x5b4a9e), nuc)); ctx.add('cap', inst(MG.cylLo, mm(0xd0444a), caps)); ctx.add('sat', inst(MG.sph, mm(0xe8d27a), sat));
    ctx.add('peri', mesh(new THREE.CylinderGeometry(8.6, 8.6, 30, 48, 1, true), mm(0xeee6d8, {op: .22, ds: true}), [0, 0, 0], 1, [0, 0, Math.PI / 2]));
    const nerve = [[-6, 12, 2], [-4, 10, 1.6], [-2, 8.2, 1.2]]; ctx.add('nmj', new THREE.Mesh(tubeG(nerve, 0.22, 20, 8), mm(0xe8c45a)));
    ctx.add('nmj', mesh(MG.sph, mm(0xe8c45a, {em: 0x553300}), [-2, 7.9, 1.1], [1.1, 0.25, 0.8])); }
});

W({id: 'skin', level: 'tissue', name: 'Skin layers', common: 'Epidermis, dermis, hypodermis', sys: 'skin', unit: 1e-4, c: [-0.162, 1.04], cam: [30, 16, 34], R: 20,
  what: 'The epidermis on top, the dermis beneath it, then the fatty hypodermis. The epidermis is about 0.1 mm thick on most of the body and up to 1.5 mm on the soles.',
  does: 'Blocks water loss, microbes and UV light, controls temperature and senses touch, pain and heat.', src: [HISTO, 'Kandel et al., Principles of Neural Science, 6th ed. (2021)'],
  comps: {
    epi: C('Epidermis', 'Keratinocytes', 'Stacked layers of keratinocytes: basal, spiny, granular and the dead outer layer.', 'Cells born at the base rise and die over about four weeks, becoming the outer barrier.', {deeper: 'cell-keratinocyte'}),
    corn: C('Stratum corneum', 'Dead outer layer', '15–20 layers of flattened dead cells full of keratin, sealed with lipids.', 'The main waterproof barrier. About 40,000 of these cells flake off every minute.'),
    mel: C('Melanocytes', 'Pigment cells', 'Pigment cells in the basal layer, roughly one for every 4–10 basal cells.', 'Pass melanin granules to keratinocytes. Skin colour depends mainly on how much and which kind of melanin they make, not on how many melanocytes there are.'),
    pap: C('Dermal papillae', '', 'Fingers of dermis pushing up into the epidermis.', 'Lock the layers together and bring capillaries close to the surface. On the fingertips they form fingerprint ridges.'),
    derm: C('Dermis', '', 'Dense connective tissue of collagen and elastin, 1–4 mm thick.', 'Gives skin its strength and stretch and holds the vessels, nerves, glands and follicles.', {deeper: 'collagen'}),
    hair: C('Hair follicle and hair', '', 'A tube of epithelium reaching into the dermis, with a bulb at its base wrapped around a papilla of dermis.', 'Grows hair in cycles. Scalp hair grows about 1 cm a month.'),
    seb: C('Sebaceous gland', 'Oil gland', 'A lobed gland opening into the hair follicle.', 'Releases sebum, an oily film that keeps hair and skin supple.'),
    arr: C('Arrector pili', '', 'A tiny band of smooth muscle from the follicle to the upper dermis.', 'Raises the hair and makes goosebumps when you are cold or frightened.'),
    sweat: C('Sweat gland', 'Eccrine gland', 'A coiled tube deep in the dermis with a spiral duct up to a pore. There are 2–4 million over the body.', 'Cools the body by evaporation, releasing over a litre an hour during hard exercise in heat.'),
    vess: C('Blood vessels', '', 'Two flat networks, one deep in the dermis and one under the papillae, joined by vertical vessels.', 'Supply the skin and shed heat when they widen, which is why you flush when hot.'),
    meiss: C('Meissner corpuscles', '', 'Small encapsulated nerve endings in the dermal papillae, densest in fingertips and lips.', 'Sense light touch and slow vibration.'),
    pac: C('Pacinian corpuscles', '', 'Onion-like nerve endings about 1 mm long deep in the dermis and hypodermis.', 'Sense deep pressure and fast vibration, best at around 250 Hz.'),
    fat: C('Hypodermis', 'Subcutaneous fat', 'Lobules of fat cells divided by thin connective tissue walls.', 'Insulates, cushions and stores energy.')},
  build(ctx) {
    const r = rng(17), Wd = 30, D = 22;
    const layers = [['corn', 0xf0dccb, 9.6, .5], ['epi', 0xd9a07c, 8.8, 1.2], ['epi', 0xc4825c, 7.9, .6]];
    layers.forEach(([id, col, y, h]) => ctx.add(id, mesh(MG.box, mm(col, {r: .7}), [0, y, 0], [Wd, h, D])));
    const mel = []; for (let i = 0; i < 26; i++) mel.push({p: [(r() - .5) * Wd * .95, 7.55, (r() - .5) * D * .95], s: [0.25, 0.12, 0.25]});
    ctx.add('mel', inst(MG.sph, mm(0x3d2316), mel));
    const pap = []; for (let i = -6; i <= 6; i++) for (let j = -4; j <= 4; j++) pap.push({p: [i * 2.2 + (j % 2), 7.6, j * 2.3], s: [0.55, 0.9, 0.55]});
    ctx.add('pap', inst(MG.sph, mm(0xeab9a2, {r: .7}), pap));
    ctx.add('derm', mesh(MG.box, mm(0xf0cbb6, {r: .8, op: .55}), [0, 2.5, 0], [Wd, 10, D]));
    ctx.add('fat', mesh(MG.box, mm(0xf3df9e, {r: .8, op: .3}), [0, -6, 0], [Wd, 7, D]));
    const fat = []; for (let i = 0; i < 160; i++) fat.push({p: [(r() - .5) * Wd * .95, -6 + (r() - .5) * 6, (r() - .5) * D * .95], s: 0.85 + r() * .3});
    ctx.add('fat', inst(MG.sphLo, mm(0xf5d980, {r: .35}), fat));
    // hair follicles with sebaceous gland and arrector pili
    [[-7, -3], [5, 4], [9, -6]].forEach(([x, z]) => {
      ctx.add('hair', mesh(MG.cyl, mm(0xd9a07c, {op: .8}), [x, 1.5, z], [0.75, 13, 0.75], [0, 0, 0.35]));
      ctx.add('hair', mesh(MG.cyl, mm(0x2b1a12), [x - 1.3, 9.5, z], [0.18, 22, 0.18], [0, 0, 0.35]));
      ctx.add('hair', mesh(MG.sph, mm(0xb06a48), [x + 1.9, -4.6, z], [1.1, 1.3, 1.1]));
      ctx.add('seb', mesh(MG.sph, mm(0xf2e3a6), [x + 1.4, 4.3, z + .4], [1.2, 0.9, 0.9]));
      ctx.add('arr', new THREE.Mesh(tubeG([[x + 1.2, 1.2, z], [x + 3, 4, z], [x + 4.6, 7, z]], 0.16, 16, 6), mm(0xb84a48))); });
    const coil = []; for (let i = 0; i < 60; i++) { const t2 = i / 60 * 6.28 * 4; coil.push([-1 + Math.cos(t2) * 1.1, -2.6 + Math.sin(t2 * .5) * .6, 6 + Math.sin(t2) * 1.1]); }
    ctx.add('sweat', new THREE.Mesh(tubeG(coil, 0.25, 200, 6), mm(0x9fd0d8)));
    const duct = []; for (let i = 0; i < 40; i++) { const t2 = i / 39; duct.push([-1 + Math.cos(t2 * 30) * .5 * (t2 > .6 ? 1 : .2), -2 + t2 * 12.2, 6 + Math.sin(t2 * 30) * .5 * (t2 > .6 ? 1 : .2)]); }
    ctx.add('sweat', new THREE.Mesh(tubeG(duct, 0.18, 120, 6), mm(0x9fd0d8)));
    for (const [y, col] of [[-1.8, 0xc0303a], [-1.4, 0x4c64c0], [6.6, 0xc0303a], [6.9, 0x4c64c0]]) ctx.add('vess', new THREE.Mesh(tubeG(walk(r, [-15, y, (r() - .5) * 16], 9, 3.6), 0.22, 40, 8), mm(col)));
    const meiss = []; for (let i = 0; i < 8; i++) meiss.push({p: [(r() - .5) * 24, 7.7, (r() - .5) * 18], s: [0.28, 0.5, 0.28]});
    ctx.add('meiss', inst(MG.sph, mm(0xe8c45a), meiss));
    const pac = new THREE.Group(); for (let k = 0; k < 5; k++) pac.add(mesh(MG.sph, mm(0xf3eccf, {op: 0.35 + k * 0.12, ds: true}), [-9, -5.5, 5], [1.0 - k * .17, 1.9 - k * .32, 1.0 - k * .17], [0, 0, 1.2]));
    ctx.add('pac', pac); }
});

W({id: 'olfactory', level: 'tissue', name: 'Olfactory epithelium', common: 'Smell lining', sys: 'nerve', unit: 1e-5, c: [0.3, 0.5], cam: [16, 10, 26], R: 14,
  what: 'A patch of lining about 5 cm² in total, high in the roof of each nasal cavity, holding the nerve cells of smell.',
  does: 'Catches odour molecules dissolved in its mucus. Humans have around 400 working odour-receptor genes, which together can tell apart a very large number of smells.', src: ['Buck & Axel, Cell 65:175 (1991)', 'Kandel et al., Principles of Neural Science, 6th ed. (2021)'],
  hist: [['1991', 'Linda Buck and Richard Axel discover the odour-receptor gene family (Nobel Prize 2004).']],
  comps: {
    orn: C('Olfactory receptor neurons', 'Smell neurons', 'Nerve cells whose tips reach the surface. Each one makes just one type of odour receptor.', 'Fire when an odour binds their receptors. They are among the few neurons replaced throughout life, roughly every 1–2 months.', {deeper: 'cell-olfactory'}),
    cilia: C('Olfactory cilia', '', 'Long non-moving hairs spreading from each neuron\'s tip into the mucus.', 'Carry the odour receptors, giving each neuron a large surface to catch molecules.'),
    sus: C('Supporting cells', 'Sustentacular cells', 'Tall cells between the neurons.', 'Insulate the neurons and break down odour molecules and toxins.'),
    basal: C('Basal cells', '', 'Stem cells along the base of the lining.', 'Divide to replace smell neurons and supporting cells.'),
    bowman: C('Bowman\'s glands', '', 'Glands under the lining whose ducts open at the surface.', 'Make the mucus that odour molecules must dissolve in.'),
    nerve: C('Olfactory nerve bundles', 'Cranial nerve I', 'Axons gathered into bundles that pass up through the holes of the cribriform plate.', 'Carry smell straight to the olfactory bulb, with no stop in the thalamus.'),
    mucus: C('Mucus layer', '', 'A thin watery layer covering the surface.', 'Dissolves odour molecules and holds odour-binding proteins.')},
  build(ctx) {
    const r = rng(31), neur = [], sus = [], bas = [], cil = [], axs = [];
    for (let i = -5; i <= 5; i++) for (let j = -3; j <= 3; j++) { const x = i * 1.6 + (j % 2) * .8, z = j * 1.6;
      sus.push({p: [x + .8, 1, z], s: [0.6, 3.6, 0.6]}); bas.push({p: [x + .4, -2.5, z + .5], s: [0.5, 0.35, 0.5]});
      if ((i + j) % 2 === 0) { neur.push({p: [x, -.5, z], s: [0.55, 0.8, 0.55]}); axs.push(segT([x, -1, z], [x * .6, -7, z * .6], 0.06));
        for (let k = 0; k < 7; k++) cil.push(walk(r, [x, 4.7, z], 6, 0.55, [Math.cos(k), 0.25, Math.sin(k)])); } }
    ctx.add('sus', inst(MG.sph, mm(0xe5b9a2, {r: .6, op: .55}), sus)); ctx.add('basal', inst(MG.sph, mm(0xc89a86), bas));
    ctx.add('orn', inst(MG.sph, mm(0xe6c56a, {r: .4}), neur));
    ctx.add('orn', inst(MG.cylLo, mm(0xe6c56a), neur.map(n => segT([n.p[0], n.p[1], n.p[2]], [n.p[0], 4.7, n.p[2]], 0.12))));
    cil.forEach(p => ctx.add('cilia', new THREE.Mesh(tubeG(p, 0.03, 16, 4), mm(0xf2dc8a))));
    ctx.add('mucus', mesh(MG.box, mm(0xbfe3ec, {op: .25, r: .1}), [0, 5.6, 0], [20, 1.8, 13]));
    ctx.add('nerve', inst(MG.cylLo, mm(0xe6c56a), axs)); ctx.add('nerve', mesh(MG.cyl, mm(0xe6c56a), [0, -8, 0], [1.4, 3, 1.4]));
    ctx.add('bowman', mesh(MG.sph, mm(0xc7dfe6), [6, -4.5, 3], [1.5, 1.2, 1.2])); ctx.add('bowman', mesh(MG.cyl, mm(0xc7dfe6), [6, 0.5, 3], [0.2, 9, 0.2])); }
});

// =================== CELLS ===================
function cellWorld(id, name, common, sys, c, what, does, opts) {
  return W({id, level: 'cell', name, common, sys, unit: 1e-6, c, cam: opts.cam || [10, 8, 18], R: opts.R || 14, what, does, size: opts.size, src: [BIO, HISTO].concat(opts.src || []),
    comps: (() => { const c = cellComps(opts.extra, opts.nucWhat); (opts.drop || []).forEach(k => delete c[k]); return c; })(), build: opts.build}); }

cellWorld('cell-cardiomyocyte', 'Cardiomyocyte', 'Heart muscle cell', 'cardio', [-0.75, 0.11],
  'A heart muscle cell packed with contractile myofibrils and mitochondria, with a central nucleus.', 'Contracts about once a second for a lifetime, roughly 3 billion beats, without ever resting.', {size: 'about 100 × 20 µm (shown shortened)',
  extra: {myofib: C('Myofibrils', '', 'Bundles of actin and myosin filaments arranged in repeating sarcomeres about 2 µm long.', 'Slide past one another when calcium rises, shortening the whole cell.', {size: 'about 1 µm wide'}),
    ttub: C('T-tubules', 'Transverse tubules', 'Fingers of the cell membrane reaching inward at each Z line.', 'Carry the electrical signal deep into the cell so calcium is released everywhere at once.'),
    sr: C('Sarcoplasmic reticulum', '', 'A network of membrane tubes wrapped around the myofibrils.', 'Stores calcium, releases it through ryanodine receptors at each beat, then pumps it back so the cell relaxes.')},
  build(ctx) { const r = rng(41), L = 26, R = 6;
    ctx.add('membrane', mesh(capsuleGeo(R, L), mm(0xe9b0b0, {op: .16, ds: true}), [0, 0, 0], 1, [0, 0, Math.PI / 2]));
    const fib = []; for (let i = 0; i < 14; i++) { const a = i * 2.4, rr = 1.4 * Math.sqrt(i); if (rr > 4.6) continue; fib.push({p: [0, Math.cos(a) * rr, Math.sin(a) * rr], r: [0, 0, Math.PI / 2], s: [0.55, L, 0.55]}); }
    ctx.add('myofib', inst(MG.cyl, striate(mm(0xb5464a, {r: .5}), 1, 'y', .45), fib));
    const tt = []; for (let x = -12; x <= 12; x += 2) tt.push({p: [x, 0, 0], r: [0, 0, 0], s: [0.06, 11, 0.06]});
    ctx.add('ttub', inst(MG.cylLo, mm(0x8bc7d4), tt));
    const sr = []; for (let x = -12; x <= 12; x += 2) sr.push({p: [x, 0, 0], r: [0, Math.PI / 2, 0], s: [4.9, 4.9, 0.6]});
    ctx.add('sr', inst(new THREE.TorusGeometry(4.7, 0.1, 6, 48), mm(0x5f86c9, {op: .8}), sr.map(s => ({p: s.p, r: [0, Math.PI / 2, 0], s: 1}))));
    nucleusMesh(ctx, [0, 0, 0], [4.5, 2, 2]);
    organelles(ctx, r, {half: [12, 4.5, 4.5], nuc: [[0, 0, 0], [4.5, 2, 2]], mito: 70, mitoSpread: .95, ribo: 120, golgi: [6, 2.6, 0], skip: {rer: false}}); }});

cellWorld('cell-pneumocyte', 'Type II pneumocyte', 'Surfactant cell', 'resp', [-0.4, 0.6],
  'A rounded cell in the corner of an alveolus, crowned with microvilli and full of layered surfactant granules.', 'Makes and recycles surfactant, and acts as a stem cell for the alveolar lining.', {size: 'about 10 µm across',
  extra: {lam: C('Lamellar bodies', '', 'Granules about 1 µm across made of tightly stacked membrane layers.', 'Store surfactant, a mix of phospholipids (mostly dipalmitoyl-phosphatidylcholine) and proteins, then release it onto the alveolar surface.', {size: 'about 1 µm'}),
    mv: C('Microvilli', '', 'Short finger-like projections on the cell surface facing the air.', 'Increase surface area for taking surfactant back in.')},
  build(ctx) { const r = rng(43);
    ctx.add('membrane', mesh(MG.sph, mm(0xf3c7b5, {op: .16, ds: true}), [0, 0, 0], [7, 5.5, 6]));
    nucleusMesh(ctx, [0, -1.2, 0], [2.4, 2, 2.2]);
    const lam = new THREE.Group(); for (let i = 0; i < 9; i++) { const p = [(r() - .5) * 8, 1.5 + r() * 2.5, (r() - .5) * 7]; for (let k = 0; k < 4; k++) lam.add(mesh(MG.sph, mm(0xf6ead0, {op: .3 + k * .15, ds: true}), p, 0.75 - k * .16)); }
    ctx.add('lam', lam);
    const mv = []; for (let i = 0; i < 90; i++) { const th = r() * 6.28, ph = r() * .9; const n = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)); const b = n.clone().multiply(new THREE.Vector3(7, 5.5, 6));
      mv.push(segT(b.toArray(), b.clone().addScaledVector(n, 0.9).toArray(), 0.09)); }
    ctx.add('mv', inst(MG.cylLo, mm(0xf3c7b5), mv));
    organelles(ctx, r, {half: [5.5, 4, 4.5], nuc: [[0, -1.2, 0], [2.4, 2, 2.2]], mito: 16}); }});

cellWorld('cell-enterocyte', 'Enterocyte', 'Absorptive intestinal cell', 'digest', [0.285, 0.01],
  'A tall column-shaped cell with a dense brush border of microvilli on top and the nucleus near its base.', 'Absorbs nutrients from the gut into the blood and lymph. Each one lives only about 3–5 days.', {size: 'about 20 × 5 µm',
  extra: {bb: C('Brush border', 'Microvilli', 'Thousands of microvilli about 1 µm tall packed on the top surface.', 'Multiply the absorbing area and carry digestive enzymes such as lactase and sucrase-isomaltase.', {size: 'about 1 × 0.1 µm each'}),
    tj: C('Tight junctions', '', 'A sealing band where neighbouring cells meet just below the brush border.', 'Stop gut contents leaking between cells, so absorption has to go through them.'),
    chylo: C('Chylomicrons', '', 'Fat droplets packaged with protein in the Golgi.', 'Carry absorbed fats out of the cell into the lacteal.')},
  build(ctx) { const r = rng(47), H = 22, Wd = 6;
    ctx.add('membrane', mesh(MG.box, mm(0xe2a081, {op: .15, ds: true}), [0, 0, 0], [Wd, H, Wd]));
    const mv = []; for (let i = -9; i <= 9; i++) for (let j = -9; j <= 9; j++) mv.push({p: [i * .31, H / 2 + .55, j * .31], s: [0.07, 1.1, 0.07]});
    ctx.add('bb', inst(MG.cylLo, mm(0xf0c0a0), mv));
    ctx.add('tj', mesh(new THREE.BoxGeometry(Wd + .15, .45, Wd + .15), mm(0x8a4f70, {op: .9}), [0, H / 2 - 1, 0]));
    nucleusMesh(ctx, [0, -6, 0], [2.1, 3.3, 2.1]);
    const ch = []; for (let i = 0; i < 14; i++) ch.push({p: [(r() - .5) * 4.5, -1 + r() * 6, (r() - .5) * 4.5], s: 0.22 + r() * .12});
    ctx.add('chylo', inst(MG.sph, mm(0xf6e7a0, {r: .2}), ch));
    organelles(ctx, r, {half: [2.6, 9, 2.6], nuc: [[0, -6, 0], [2.1, 3.3, 2.1]], mito: 24, golgi: [0, 0.5, 0], centro: [0, 6, 0]}); }});

cellWorld('cell-neuron', 'Pyramidal neuron', 'Cortical nerve cell', 'nerve', [-0.70176, -0.3842],
  'The cell body of a cortical neuron, with its large nucleus, prominent nucleolus and the stumps of its dendrites and axon.', 'Keeps a nerve cell alive and supplied: most proteins for dendrites and axon up to a metre long are made here.', {size: 'cell body about 20 µm', cam: [12, 6, 20], R: 16, drop: ['rer'],
  nucWhat: 'A large round nucleus with a prominent nucleolus, a sign of heavy protein production. Neurons stop dividing, so this nucleus must last a lifetime.',
  extra: {nissl: C('Nissl bodies', '', 'Dense stacks of rough ER and ribosomes that stain dark blue in the microscope.', 'Make the proteins the neuron ships down its long dendrites and axon.'),
    dstump: C('Dendrite trunks', '', 'The thick starts of the apical and basal dendrites.', 'Carry incoming signals from thousands of synapses toward the cell body.'),
    hill: C('Axon hillock and initial segment', '', 'The cone where the axon leaves the cell body, crowded with sodium channels.', 'Where the action potential is usually triggered once inputs add up past threshold.'),
    bout: C('Synaptic boutons', '', 'Axon terminals from other neurons ending on the cell body.', 'Many release GABA, so inputs on the cell body are often inhibitory and strongly control firing.')},
  build(ctx) { const r = rng(53);
    const soma = new THREE.ConeGeometry(7, 13, 32, 1, false); soma.translate(0, 1.5, 0);
    ctx.add('membrane', mesh(soma, mm(0xd9b2a0, {op: .17, ds: true})));
    ctx.add('dstump', mesh(MG.cyl, mm(0xd9b2a0, {op: .85}), [0, 11, 0], [1.2, 6, 1.2]));
    for (let k = 0; k < 4; k++) { const a = k * 1.57 + .3; ctx.add('dstump', mesh(MG.cyl, mm(0xd9b2a0, {op: .85}), [Math.cos(a) * 6, -4.5, Math.sin(a) * 6], [0.8, 5, 0.8], [Math.sin(a) * .9, 0, -Math.cos(a) * .9])); }
    ctx.add('hill', mesh(new THREE.ConeGeometry(1.4, 3, 16), mm(0xe2c49b, {op: .9}), [0, -6.5, 0], 1, [Math.PI, 0, 0]));
    ctx.add('hill', mesh(MG.cyl, mm(0xe2c49b), [0, -10, 0], [0.4, 5, 0.4]));
    nucleusMesh(ctx, [0, 0, 0], [3.2, 3.2, 3.2]);
    const ni = []; for (let i = 0; i < 40; i++) { const d = new THREE.Vector3(r() - .5, r() - .5, r() - .5).normalize().multiplyScalar(4 + r() * 1.6); ni.push({p: d.toArray(), s: [0.7, 0.18, 0.5], r: [r() * 3, r() * 3, r() * 3]}); }
    ctx.add('nissl', inst(MG.sph, mm(0x34418a, {r: .6}), ni));
    const bo = []; for (let i = 0; i < 16; i++) { const y = -4 + r() * 9, rr = 7 * (1 - (y + 5) / 13) + .3, a = r() * 6.28; bo.push({p: [Math.cos(a) * rr, y, Math.sin(a) * rr], s: 0.45}); }
    ctx.add('bout', inst(MG.sph, mm(0xf2c14e, {em: 0x553a00}), bo));
    organelles(ctx, r, {half: [4, 4, 4], nuc: [[0, 0, 0], [3.2, 3.2, 3.2]], mito: 22, skip: {rer: true}, golgi: [0, 4.6, 0], centro: [2.5, 3.8, 2]}); }});

cellWorld('cell-osteocyte', 'Osteocyte', 'Bone cell', 'bone', [-0.835, -0.2321],
  'A bone cell sealed in its lacuna, reaching out through dozens of thin processes.', 'Senses fluid flow and strain in the bone and directs remodelling through signals such as sclerostin and RANKL. Osteocytes can live for decades.', {size: 'cell body about 10 × 5 µm',
  extra: {proc: C('Dendritic processes', '', 'Dozens of thin processes running through canaliculi to neighbouring cells and the bone surface.', 'Form a network that senses load and passes signals and nutrients.'),
    lac: C('Lacuna', '', 'The small cavity in the mineralised matrix that holds the cell.', 'Lets fluid flow around the cell; that flow is how bone senses load.', {deeper: 'collagen'})},
  build(ctx) { const r = rng(59);
    ctx.add('lac', mesh(MG.sph, mm(0xe2d5b6, {op: .2, ds: true}), [0, 0, 0], [8, 4.4, 5.5]));
    ctx.add('membrane', mesh(MG.sph, mm(0xa87a5a, {op: .4, ds: true}), [0, 0, 0], [6.6, 3.4, 4.4]));
    nucleusMesh(ctx, [0, 0, 0], [3.2, 2, 2.4]);
    const segs = []; for (let i = 0; i < 40; i++) branch(r, new THREE.Vector3(r() - .5, r() - .5, r() - .5).normalize().multiply(new THREE.Vector3(6.4, 3.3, 4.3)).toArray(), [r() - .5, r() - .5, r() - .5], 3, 0.12, 1, segs, 0.8);
    ctx.add('proc', segsMesh(segs, mm(0xa87a5a), true));
    organelles(ctx, r, {half: [4.5, 2.2, 3], nuc: [[0, 0, 0], [3.2, 2, 2.4]], mito: 8, lyso: 5, ribo: 80}); }});

cellWorld('cell-myofiber', 'Skeletal muscle fibre', 'Muscle cell', 'muscle', [0.355, 0.355],
  'A short stretch of one muscle fibre: myofibrils, mitochondria, and nuclei pressed against the edge.', 'Turns a nerve signal into force. A fibre can shorten by about a third of its length.', {size: '10–100 µm wide (a 30 µm stretch shown)', drop: ['rer', 'golgi'],
  nucWhat: 'One of hundreds of nuclei in this single cell, sitting just under the membrane.',
  extra: {myofib: C('Myofibrils', '', 'Bundles of actin and myosin in sarcomeres about 2–2.5 µm long, lined up across the fibre.', 'Slide to shorten the fibre when calcium is released.'),
    ttub: C('Triads', 'T-tubules and terminal cisternae', 'A T-tubule flanked by two sacs of sarcoplasmic reticulum, at each junction of the A and I bands.', 'Link the electrical signal to calcium release in a few milliseconds.'),
    sr: C('Sarcoplasmic reticulum', '', 'A sleeve of membrane around each myofibril.', 'Stores calcium and pumps it back after each contraction.')},
  build(ctx) { const r = rng(61), L = 30, R = 7;
    ctx.add('membrane', mesh(MG.cyl, mm(0xd27a72, {op: .15, ds: true}), [0, 0, 0], [R, L, R], [0, 0, Math.PI / 2]));
    const fib = []; for (let i = 0; i < 30; i++) { const a = i * 2.4, rr = 1.15 * Math.sqrt(i); if (rr > 6) continue; fib.push({p: [0, Math.cos(a) * rr, Math.sin(a) * rr], r: [0, 0, Math.PI / 2], s: [0.5, L, 0.5]}); }
    ctx.add('myofib', inst(MG.cyl, striate(mm(0xb03e3a, {r: .5}), 2.3, 'y', .5), fib));
    const tr = []; for (let x = -14; x <= 14; x += 2.3) tr.push({p: [x, 0, 0], r: [0, Math.PI / 2, 0], s: [6.6, 6.6, 0.18]});
    ctx.add('ttub', inst(new THREE.TorusGeometry(6.6, 0.09, 6, 48), mm(0x8bc7d4), tr.map(t => ({p: t.p, r: t.r, s: 1}))));
    ctx.add('sr', mesh(MG.cyl, mm(0x5f86c9, {op: .12, ds: true}), [0, 0, 0], [6.3, L, 6.3], [0, 0, Math.PI / 2]));
    [[-8, 6.6, 1], [5, -2, 6.5], [11, -6.2, -2]].forEach((p, i) => { if (i === 0) nucleusMesh(ctx, p, [3, 0.8, 1.3], 0x5b4a9e); else ctx.add('nucleus', mesh(MG.sph, mm(0x5b4a9e), p, [3, 0.8, 1.3], [Math.atan2(p[2], p[1]), 0, 0])); });
    organelles(ctx, r, {half: [13, 5.5, 5.5], nuc: [[-8, 6.6, 1], [3, .8, 1.3]], mito: 50, mitoSpread: .95, skip: {rer: true, golgi: true}, centro: [-4, 5.5, 2]}); }});

cellWorld('cell-keratinocyte', 'Keratinocyte', 'Skin cell', 'skin', [-0.162, 1.04],
  'A cell of the spiny layer of the epidermis, laced with keratin filaments and riveted to its neighbours.', 'Builds the skin barrier. As it rises it fills with keratin, flattens and dies to become part of the outer layer.', {size: 'about 10–15 µm',
  extra: {ker: C('Keratin filaments', '', 'Intermediate filaments about 10 nm thick running in bundles across the cell.', 'Give the cell its toughness. Mutations in keratin genes cause blistering diseases such as epidermolysis bullosa simplex.'),
    desmo: C('Desmosomes', '', 'Spot welds on the cell surface where keratin bundles from neighbouring cells anchor.', 'Resist shearing. In pemphigus, antibodies attack them and the skin blisters.'),
    melcap: C('Melanin cap', 'Supranuclear cap', 'Melanin granules clustered over the top of the nucleus like an umbrella.', 'Shield the DNA from ultraviolet light.')},
  build(ctx) { const r = rng(67);
    ctx.add('membrane', mesh(new THREE.DodecahedronGeometry(7, 1), mm(0xd9a07c, {op: .15, ds: true})));
    nucleusMesh(ctx, [0, 0, 0], [2.8, 2.5, 2.6]);
    const mc = []; for (let i = 0; i < 40; i++) { const th = r() * 6.28, ph = r() * .8; mc.push({p: [Math.sin(ph) * Math.cos(th) * 3.3, 2.8 + Math.cos(ph) * .8, Math.sin(ph) * Math.sin(th) * 3.3], s: 0.22}); }
    ctx.add('melcap', inst(MG.sph, mm(0x3d2316), mc));
    const ds = [], kseg = []; for (let i = 0; i < 18; i++) { const d = new THREE.Vector3(r() - .5, r() - .5, r() - .5).normalize().multiplyScalar(6.6); ds.push({p: d.toArray(), q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()), s: [0.6, 0.15, 0.6]});
      const mid = new THREE.Vector3(r() - .5, r() - .5, r() - .5).multiplyScalar(5); kseg.push([d.clone().multiplyScalar(.97), mid, 0.06]); }
    ctx.add('desmo', inst(MG.cyl, mm(0xe8d27a), ds)); ctx.add('ker', segsMesh(kseg, mm(0xc9a77a), true));
    organelles(ctx, r, {half: [4.5, 4.5, 4.5], nuc: [[0, 0, 0], [2.8, 2.5, 2.6]], mito: 14}); }});

cellWorld('cell-olfactory', 'Olfactory receptor neuron', 'Smell neuron', 'nerve', [0.3, 0.5],
  'A bipolar nerve cell: a slender dendrite up to the surface ending in a knob of cilia, and an axon down to the brain.', 'Each neuron expresses just one of about 400 odour receptor types, and all neurons with the same receptor send their axons to the same spot in the olfactory bulb.', {size: 'cell body about 5–8 µm', cam: [8, 4, 22], R: 16,
  extra: {knob: C('Dendritic knob', '', 'The swollen tip of the dendrite at the surface of the lining.', 'Anchors the cilia that hold the receptors.'),
    cilia: C('Cilia', '', 'Long hair-like extensions spreading through the mucus.', 'Carry the odour receptors and the signalling machinery that turns binding into an electrical signal.', {deeper: 'odorant-receptor'}),
    axon: C('Axon', '', 'A thin unmyelinated axon running up through the cribriform plate.', 'Carries the signal to a glomerulus in the olfactory bulb.')},
  build(ctx) { const r = rng(71);
    ctx.add('membrane', mesh(MG.sph, mm(0xe6c56a, {op: .18, ds: true}), [0, -3, 0], [3.2, 4, 3.2]));
    nucleusMesh(ctx, [0, -3, 0], [2, 2.5, 2], 0x5b4a9e);
    ctx.add('membrane', mesh(MG.cyl, mm(0xe6c56a, {op: .5}), [0, 5, 0], [0.6, 12, 0.6]));
    ctx.add('knob', mesh(MG.sph, mm(0xe6c56a), [0, 11.5, 0], 1.2));
    for (let k = 0; k < 14; k++) ctx.add('cilia', new THREE.Mesh(tubeG(walk(r, [0, 12, 0], 10, 0.9, [Math.cos(k * .45), .3, Math.sin(k * .45)]), 0.08, 30, 5), mm(0xf2dc8a)));
    ctx.add('axon', mesh(MG.cyl, mm(0xe6c56a), [0, -12, 0], [0.25, 14, 0.25]));
    organelles(ctx, r, {half: [2.2, 3, 2.2], nuc: [[0, -3, 0], [2, 2.5, 2]], mito: 9, lyso: 3, ribo: 60, golgi: [0, 1, 0], centro: [0, 2.5, 1]}); }});

// =================== ORGANELLES ===================
W({id: 'nucleus', level: 'organelle', name: 'Nucleus', common: '', sys: 'cell', unit: 1e-7, c: [-0.54, 0.54], cam: [44, 30, 76], R: 40,
  what: 'A sphere about 6 µm across, wrapped in a double membrane, holding about 2 metres of DNA in 46 chromosomes.', does: 'Stores the genome and decides which genes are read at any moment.', size: 'about 6 µm across', src: [BIO],
  hist: [['1831', 'Robert Brown names the nucleus in orchid cells.'], ['1882', 'Walther Flemming describes chromatin and chromosomes in dividing cells.']],
  comps: {
    outer: C('Outer nuclear membrane', '', 'The outer layer of the envelope, continuous with the rough ER and dotted with ribosomes.', 'Joins the nucleus to the cell\'s protein-making network.'),
    inner: C('Inner membrane and lamina', 'Nuclear lamina', 'The inner layer of the envelope, lined by a meshwork of lamin filaments.', 'Gives the nucleus its shape and anchors silent chromatin. Lamin A mutations cause progeria, a premature-ageing disease.'),
    pores: C('Nuclear pores', '', 'Large protein channels about 120 nm across, built from about 30 kinds of nucleoporin. A typical nucleus has a few thousand.', 'Let small molecules pass freely and actively carry proteins in and RNA out.', {size: 'about 120 nm across'}),
    nucleolus: C('Nucleolus', '', 'A dense region with no membrane, about 1–3 µm across, formed around the ribosomal RNA genes.', 'Makes ribosomal RNA and assembles ribosome subunits.'),
    hetero: C('Heterochromatin', 'Packed chromatin', 'Tightly packed, mostly silent chromatin, gathered at the nuclear edge and around the nucleolus.', 'Keeps repeats and unused genes switched off.', {deeper: 'chromatin'}),
    eu: C('Euchromatin', 'Open chromatin', 'Looser chromatin filling the interior.', 'Holds the active genes being read.', {deeper: 'chromatin'}),
    terr: C('Chromosome territories', '', 'Between divisions each chromosome occupies its own region rather than tangling with the others.', 'Gene-rich chromosomes tend to sit toward the centre and gene-poor ones near the edge.')},
  build(ctx) { const r = rng(73), R = 30;
    ctx.add('outer', new THREE.Mesh(new THREE.SphereGeometry(R, 64, 40, 0.6, Math.PI * 1.55), mm(0x8f7fc8, {op: .5, ds: true, r: .5})));
    ctx.add('inner', new THREE.Mesh(new THREE.SphereGeometry(R - 1.4, 64, 40, 0.6, Math.PI * 1.55), mm(0x6b5aa8, {op: .55, ds: true})));
    const pores = []; for (let i = 0; i < 260; i++) { const th = 0.6 + r() * Math.PI * 1.55, ph = Math.acos(2 * r() - 1); const n = new THREE.Vector3(Math.sin(ph) * Math.sin(th), Math.cos(ph), Math.sin(ph) * Math.cos(th));
      pores.push({p: n.clone().multiplyScalar(R - .7).toArray(), q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n), s: [0.5, 0.5, 0.9]}); }
    ctx.add('pores', inst(new THREE.TorusGeometry(1, 0.45, 8, 16), mm(0xe8d27a, {r: .4}), pores));
    const nl = new THREE.Group(); for (let i = 0; i < 9; i++) nl.add(mesh(MG.sph, mm(0x3a2a70, {r: .6}), [-6 + (r() - .5) * 6, 4 + (r() - .5) * 6, -4 + (r() - .5) * 6], 3 + r() * 1.5));
    ctx.add('nucleolus', nl);
    const het = []; for (let i = 0; i < 220; i++) { const d = new THREE.Vector3(r() - .5, r() - .5, r() - .5).normalize(); const th = Math.atan2(d.x, d.z); if (th > 0.6 - Math.PI && th < 0.6 - Math.PI + .1) continue;
      het.push({p: d.multiplyScalar(R - 2.4 - r() * 1.2).toArray(), q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()), s: [1.1 + r() * .6, 0.35 + r() * .2, 1.0 + r() * .6]}); }
    for (let i = 0; i < 24; i++) het.push({p: [-6 + (r() - .5) * 13, 4 + (r() - .5) * 13, -4 + (r() - .5) * 13], s: 0.5 + r() * .4, r: [r(), r(), r()]});
    ctx.add('hetero', inst(MG.sph, mm(0x4a2f86, {r: .55}), het));
    const cols = [0x6fc2b0, 0xe8a87c, 0x9bb8e8, 0xd88ac0, 0xc2d07a, 0xe8d27a];
    for (let k = 0; k < 6; k++) { const c = new THREE.Vector3(r() - .5, r() - .5, r() - .5).normalize().multiplyScalar(12 + r() * 6);
      ctx.add('terr', mesh(MG.sph, mm(cols[k], {op: .12, r: .9}), c.toArray(), [7, 6, 6.5]));
      for (let f = 0; f < 3; f++) ctx.add('eu', new THREE.Mesh(tubeG(walk(r, c.toArray(), 26, 1.1), 0.22, 120, 5), mm(cols[k], {r: .5}))); } }
});

W({id: 'mitochondrion', level: 'organelle', name: 'Mitochondrion', common: 'Power plant of the cell', sys: 'cell', unit: 1e-8, c: [-0.8, 0.156], cam: [80, 55, 160], R: 90,
  what: 'An organelle about 0.5–1 µm wide with two membranes: a smooth outer one and an inner one folded into cristae.', does: 'Burns fuel with oxygen to pump protons, then uses that gradient to make ATP. The body turns over roughly its own weight in ATP every day.', size: 'about 0.5–1 × 1–2 µm', src: [BIO, 'Mitchell, Nature 191:144 (1961)'],
  hist: [['1898', 'Carl Benda names the mitochondrion.'], ['1961', 'Peter Mitchell proposes the chemiosmotic theory (Nobel Prize 1978).'], ['1981', 'The complete human mitochondrial genome is sequenced (the Cambridge reference sequence).']],
  comps: {
    outer: C('Outer membrane', '', 'A smooth membrane full of porin channels.', 'Lets small molecules up to about 5 kDa pass freely.'),
    cristae: C('Inner membrane and cristae', '', 'A heavily folded inner membrane carrying the electron transport chain.', 'Pumps protons out to build a voltage of about 150–180 mV across itself.'),
    atp: C('ATP synthase', '', 'A rotary motor protein about 10 nm across with its head facing the matrix.', 'Turns as protons flow back through it, making about three ATP per full turn.', {deeper: 'atp-synthase'}),
    matrix: C('Matrix', '', 'The dense interior holding enzymes, ribosomes and DNA.', 'Runs the citric acid cycle and fatty acid breakdown.'),
    mtdna: C('Mitochondrial DNA', 'mtDNA', 'Small circles of DNA, 16,569 base pairs with 37 genes, several copies per mitochondrion.', 'Codes 13 proteins of the respiratory chain plus its own RNAs. It is inherited from the mother.'),
    mribo: C('Mitochondrial ribosomes', '', 'Ribosomes inside the matrix, distinct from those in the cytoplasm.', 'Make the 13 proteins coded by mtDNA.')},
  build(ctx) { const r = rng(79), L = 130, R = 32;
    ctx.add('outer', mesh(capsuleGeo(R, L - 2 * R), mm(0xc96f4a, {op: .25, ds: true}), [0, 0, 0], 1, [0, 0, Math.PI / 2]));
    ctx.add('matrix', mesh(capsuleGeo(R - 4, L - 2 * R), mm(0x8a3a28, {op: .18, ds: true}), [0, 0, 0], 1, [0, 0, Math.PI / 2]));
    const crM = mm(0xe2915e, {op: .85, ds: true}), atp = [];
    for (let x = -50; x <= 50; x += 9) { const pl = mesh(MG.box, crM, [x, (r() - .5) * 10, 0], [1.6, 44, 44 - Math.abs(x) * .15]); ctx.add('cristae', pl);
      for (let k = 0; k < 18; k++) atp.push({p: [x + 1.6, (r() - .5) * 40, (r() - .5) * 38], r: [0, 0, -Math.PI / 2], s: 1}); }
    const ag = new THREE.SphereGeometry(1.6, 10, 8); ag.translate(0, 2.4, 0); ctx.add('atp', inst(ag, mm(0xf2c14e, {em: 0x332200}), atp));
    for (let i = 0; i < 4; i++) ctx.add('mtdna', mesh(new THREE.TorusGeometry(3, 0.3, 6, 40), mm(0x6fc2b0), [-40 + i * 25, 18 - r() * 6, 10], 1, [r() * 3, r() * 3, 0]));
    const rb = []; for (let i = 0; i < 40; i++) rb.push({p: [(r() - .5) * 100, (r() - .5) * 40, (r() - .5) * 40], s: 1.2}); ctx.add('mribo', inst(MG.sphLo, mm(0x2f3a63), rb)); }
});

// =================== CHROMATIN AND BELOW ===================
// B-DNA double helix along a curve: returns {group, basePairs:[{p,q,len,type}]}
function dnaAlong(curve, nbp, o) {
  const g = new THREE.Group(), rise = 0.34, twist = 2 * Math.PI / 10.4, rad = o.rad || 1.0, minor = o.minor || 2.4;
  const len = curve.getLength(), s1 = [], s2 = [], bps = [];
  const up = new THREE.Vector3(0, 1, 0), N = new THREE.Vector3(), B = new THREE.Vector3();
  for (let i = 0; i <= nbp; i++) { const u = Math.min(1, i * rise / len), p = curve.getPointAt(u), t = curve.getTangentAt(u);
    N.copy(Math.abs(t.y) > .9 ? new THREE.Vector3(1, 0, 0) : up).cross(t).normalize(); B.copy(t).cross(N).normalize();
    const a = i * twist, d1 = N.clone().multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a)), d2 = N.clone().multiplyScalar(Math.cos(a + minor)).addScaledVector(B, Math.sin(a + minor));
    s1.push(p.clone().addScaledVector(d1, rad)); s2.push(p.clone().addScaledVector(d2, rad)); bps.push([s1[i], s2[i]]); }
  const bm = o.backbone || mm(0xd8d2c0, {r: .35});
  g.add(new THREE.Mesh(tubeG(s1, rad * 0.18, nbp * 4, 6), bm)); g.add(new THREE.Mesh(tubeG(s2, rad * 0.18, nbp * 4, 6), bm));
  return {group: g, bps}; }
function rungs(bps, mat, rr) { return inst(MG.cylLo, mat, bps.map(([a, b]) => segT(a.toArray(), b.toArray(), rr || 0.12))); }

W({id: 'chromatin', level: 'chromatin', name: 'Chromatin fibre', common: 'Beads on a string', sys: 'molecule', unit: 1e-9, c: [-0.123, 0.745], cam: [0, 22, 80], R: 70,
  what: 'DNA wrapped around histone spools (nucleosomes) about every 200 base pairs. Open stretches on the left, tightly packed chromatin on the right.',
  does: 'Packs 2 metres of DNA into the nucleus while controlling which genes can be reached. Whether a regular 30 nm fibre exists in living cells is still debated; most chromatin looks irregular.', src: [BIO, 'Olins & Olins, Nat Rev Mol Cell Biol 4:809 (2003)'],
  hist: [['1974', 'Roger Kornberg proposes the nucleosome as the repeating unit of chromatin; Ada and Donald Olins see the "beads on a string" in the electron microscope.']],
  comps: {
    nuc: C('Nucleosomes', '', 'Spools of 147 base pairs of DNA wrapped around eight histone proteins. A human cell has about 30 million of them.', 'The first level of DNA packing. Their spacing and chemical marks decide which genes can be read.', {deeper: 'nucleosome', size: '11 nm wide'}),
    linker: C('Linker DNA', '', 'Stretches of about 20–80 base pairs joining one nucleosome to the next.', 'Gives the fibre flexibility and is where many regulatory proteins bind.', {deeper: 'dna'}),
    h1: C('Linker histone H1', '', 'A histone that binds where DNA enters and leaves the nucleosome.', 'Locks the DNA in place and helps fold the fibre more tightly.'),
    compact: C('Compacted chromatin', 'Heterochromatin', 'Nucleosomes stacked closely in a zigzag.', 'Typical of silent regions; the transcription machinery has trouble reaching the DNA.', {deeper: 'nucleosome'}),
    pol2: C('RNA polymerase II', '', 'A 12-subunit enzyme of about 550 kDa, shown copying an open gene with its RNA trailing behind.', 'Transcribes genes into messenger RNA at roughly 2–4 kilobases per minute.')},
  build(ctx) { const r = rng(83);
    const core = new THREE.CylinderGeometry(3.2, 3.2, 5.6, 28); const coreM = mm(0x8f7fc8, {r: .5}), compM = mm(0x6b5aa8, {r: .5});
    const pts = [], cores = [], comp = [], h1 = [];
    for (let i = 0; i < 7; i++) { const x = -60 + i * 9.5, y = Math.sin(i * 1.3) * 3; pts.push([x, y, Math.cos(i * 1.1) * 3]); cores.push({p: [x, y, Math.cos(i * 1.1) * 3], r: [r() * 3, r() * 3, r() * 3]}); h1.push({p: [x + 2, y + 4, Math.cos(i * 1.1) * 3], s: 1.1}); }
    ctx.add('nuc', inst(core, coreM, cores));
    ctx.add('h1', inst(MG.sph, mm(0xd88ac0), h1));
    for (let i = 0; i < pts.length - 1; i++) { const a = V3(pts[i]), b = V3(pts[i + 1]); const curve = new THREE.CatmullRomCurve3([a.clone().add(new THREE.Vector3(4.6, 0, 0)), a.clone().lerp(b, .5).add(new THREE.Vector3(0, 2, 0)), b.clone().add(new THREE.Vector3(-4.6, 0, 0))]);
      const d = dnaAlong(curve, 18, {rad: 1}); ctx.add('linker', d.group); }
    // DNA wrapped around each open nucleosome
    cores.forEach(c => { const p = V3(c.p); const ring = []; for (let k = 0; k <= 40; k++) { const a = k / 40 * Math.PI * 2 * 1.65; ring.push(new THREE.Vector3(Math.cos(a) * 4.3, (k / 40 - .5) * 2.4, Math.sin(a) * 4.3)); }
      const m = new THREE.Mesh(tubeG(ring, 1, 80, 8), mm(0xd8d2c0, {r: .35})); m.position.copy(p); m.rotation.set(c.r[0], c.r[1], c.r[2]); ctx.add('nuc', m); });
    // compact zigzag on the right
    for (let i = 0; i < 26; i++) { const t2 = i * 0.9, x = 10 + i * 2.1, side = i % 2 ? 1 : -1; comp.push({p: [x, Math.cos(t2) * 6 * side, Math.sin(t2) * 6], r: [t2, 0, Math.PI / 2]}); }
    ctx.add('compact', inst(core, compM, comp));
    ctx.add('compact', inst(new THREE.TorusGeometry(4.3, 0.9, 6, 24), mm(0xc9c2ae), comp.map(c => ({p: c.p, r: [c.r[0] + Math.PI / 2, 0, Math.PI / 2]}))));
    ctx.add('pol2', mesh(MG.sph, mm(0x6fc2b0, {r: .5}), [-27, 6, 3], [6, 5, 5.5]));
    ctx.add('pol2', new THREE.Mesh(tubeG(walk(r, [-27, 11, 3], 18, 2.2, [0, 1, 0]), 0.45, 80, 6), mm(0xf2c14e))); }
});

const HCOL = {H3: 0x5aa8e0, H4: 0x7fcf8a, H2A: 0xf0b860, H2B: 0xe07a8a};
W({id: 'nucleosome', level: 'nucleosome', name: 'Nucleosome', common: 'Nucleosome core particle', sys: 'molecule', unit: 1e-9, c: [-0.391, -0.587], cam: [8, 6, 22], R: 18,
  what: '147 base pairs of DNA wrapped 1.65 times, in a left-handed coil, around an octamer of eight histones: two each of H2A, H2B, H3 and H4.',
  does: 'Packs DNA about sevenfold and is the main place genes are switched on or off by chemical marks on the histones.', size: 'about 11 nm wide and 5.5 nm high', src: ['Luger et al., Nature 389:251 (1997), doi:10.1038/38444', BIO],
  hist: [['1974', 'Roger Kornberg proposes the nucleosome model.'], ['1984', 'Richmond, Klug and colleagues produce the first low-resolution crystal structure.'], ['1997', 'Karolin Luger, Timothy Richmond and colleagues solve the structure at 2.8 Å.']],
  comps: {
    h3: C('Histone H3 (×2)', '', 'Two copies of H3, 135 amino acids each, at the centre of the octamer, paired with H4.', 'Its tail carries many of the best-known gene-control marks.', {deeper: 'histone-h3', size: 'about 15 kDa'}),
    h4: C('Histone H4 (×2)', '', 'Two copies of H4, 102 amino acids each, one of the most conserved proteins known.', 'With H3 forms the central tetramer; its tail decides how tightly neighbouring nucleosomes stack.', {deeper: 'histone-h4', size: 'about 11 kDa'}),
    h2a: C('Histone H2A (×2)', '', 'Two copies of H2A, about 129 amino acids, each paired with H2B on the faces of the disc.', 'Variants such as H2A.Z and H2A.X change how the nucleosome behaves; H2A.X is marked at DNA breaks.', {deeper: 'histone-h2a', size: 'about 14 kDa'}),
    h2b: C('Histone H2B (×2)', '', 'Two copies of H2B, about 125 amino acids, paired with H2A.', 'Forms part of the acidic patch that many proteins grab onto; marked during gene transcription.', {deeper: 'histone-h2b', size: 'about 14 kDa'}),
    dna: C('Wrapped DNA', '', '147 base pairs in 1.65 left-handed turns with a radius of about 4.2 nm.', 'Touches the histones about every 10 base pairs, wherever its minor groove faces inward.', {deeper: 'dna'}),
    tails: C('Histone tails', '', 'Flexible, unfolded ends of the histones, mostly the N-terminal ends, poking out between the DNA coils.', 'Carry chemical marks (acetyl, methyl, phosphate, ubiquitin) that other proteins read to open or close chromatin.')},
  build(ctx) { const r = rng(89);
    // octamer: H3-H4 tetramer in the middle, H2A-H2B dimers above and below
    const place = (id, col, a, z) => { const g = new THREE.Group(), m = mm(col, {r: .45, cc: .4});
      for (let k = 0; k < 4; k++) g.add(mesh(MG.sph, m, [Math.cos(a + k * .28) * (1.9 + (k % 2) * .5), z + (r() - .5) * .5, Math.sin(a + k * .28) * (1.9 + (k % 2) * .5)], [1.0, 0.85, 1.0]));
      ctx.add(id, g); };
    place('h3', HCOL.H3, 0.2, 0.7); place('h3', HCOL.H3, Math.PI + .2, -0.7); place('h4', HCOL.H4, 1.4, 0.8); place('h4', HCOL.H4, Math.PI + 1.4, -0.8);
    place('h2a', HCOL.H2A, 2.5, 1.5); place('h2a', HCOL.H2A, Math.PI + 2.5, -1.5); place('h2b', HCOL.H2B, 3.6, 1.6); place('h2b', HCOL.H2B, Math.PI + 3.6, -1.6);
    const sup = []; for (let k = 0; k <= 160; k++) { const a = k / 160 * Math.PI * 2 * 1.65 - 0.4; sup.push(new THREE.Vector3(Math.cos(a) * 4.2, (k / 160 - .5) * 2.6 * 1.65 / 1.65 * 1.2, Math.sin(a) * 4.2)); }
    const first = sup[0], last = sup[sup.length - 1];
    const path = [first.clone().add(new THREE.Vector3(-6, -1, 2)), ...sup, last.clone().add(new THREE.Vector3(6, 1, 2))];
    const curve = new THREE.CatmullRomCurve3(path);
    const d = dnaAlong(curve, 190, {rad: 1}); ctx.add('dna', d.group);
    const bpm = [mm(0x5cb85c), mm(0xe05555), mm(0xf0c040), mm(0x4a7fd8)];
    const sets = [[], [], [], []]; d.bps.forEach((b, i) => sets[(i * 7 + (i >> 2)) % 4].push(b));
    sets.forEach((s, i) => ctx.add('dna', rungs(s, bpm[i], 0.16)));
    const tailCols = [HCOL.H3, HCOL.H3, HCOL.H4, HCOL.H4, HCOL.H2A, HCOL.H2A, HCOL.H2B, HCOL.H2B];
    tailCols.forEach((col, i) => { const a = i * 0.8, st = [Math.cos(a) * 2.6, (i % 2 ? -1 : 1) * 1.2, Math.sin(a) * 2.6];
      const dir = [Math.cos(a), (i % 2 ? -1 : 1) * 0.6, Math.sin(a)]; ctx.add('tails', new THREE.Mesh(tubeG(walk(r, st, 9, 0.9, dir), 0.18, 40, 6), mm(col, {r: .5}))); }); }
});

// one histone in detail: the histone fold (three helices), its tail and the marks on it
function helixPath(a, b, turns) { const A = V3(a), B = V3(b), d = B.clone().sub(A), L = d.length(); d.normalize();
  const n = Math.abs(d.y) < .9 ? new THREE.Vector3(0, 1, 0).cross(d).normalize() : new THREE.Vector3(1, 0, 0); const m = d.clone().cross(n);
  const pts = []; const N = Math.round(turns * 12); for (let i = 0; i <= N; i++) { const t = i / N, ang = t * turns * Math.PI * 2; pts.push(A.clone().addScaledVector(d, t * L).addScaledVector(n, Math.cos(ang) * .46).addScaledVector(m, Math.sin(ang) * .46)); }
  return pts; }
const MARK = {
  me3: ['Trimethylation', 0x6fc2b0], me: ['Methylation', 0x6fc2b0], ac: ['Acetylation', 0xf2c14e], ph: ['Phosphorylation', 0xe8823c], ub: ['Ubiquitination', 0xd88ac0]};
function histoneWorld(key, aa, kda, tailLen, marks, extra) {
  const id = 'histone-' + key.toLowerCase(), comps = {
    fold: C('Histone fold', '', 'Three alpha helices (α1, a long α2, α3) joined by two loops. Every core histone shares this fold.', 'Two folds lock together in a "handshake" to form each histone pair (H3 with H4, H2A with H2B).'),
    loops: C('Loops L1 and L2', '', 'Short loops between the helices.', 'Where the two partners\' loops meet, they grip the DNA minor groove.'),
    tail: C(key + ' tail', '', `The flexible ${extra.tailEnd || 'N-terminal'} tail, about ${tailLen} amino acids, rich in lysine and arginine.`, 'Its positive charges grab DNA and neighbouring nucleosomes; chemical marks on it change those contacts and recruit reader proteins.'),
    partner: C(extra.partner + ' (partner)', '', `The histone that pairs with ${key} through the handshake motif.`, 'Shown faintly to show how the pair interlocks.')};
  marks.forEach(([site, type, text, does]) => { comps['m-' + site] = C(key + site + (type === 'me3' ? 'me3' : type), MARK[type][0] + ` of ${site.replace(/^[KS]/, m => m === 'K' ? 'lysine ' : 'serine ')}`, text, does); });
  return W({id, level: 'molecule', name: 'Histone ' + key, common: `${aa} amino acids, about ${kda} kDa`, sys: 'molecule', unit: 5e-10, c: extra.c, cam: [6, 4, 24], R: 18,
    what: extra.what, does: extra.does, size: `${aa} amino acids, about ${kda} kDa`, src: ['Luger et al., Nature 389:251 (1997), doi:10.1038/38444', BIO, 'Bannister & Kouzarides, Cell Res 21:381 (2011)'], comps,
    build(ctx) { const r = rng(97 + aa), col = extra.col, hm = mm(col, {r: .4, cc: .5});
      const a1 = helixPath([-6, -2, 0], [-2, 0, 0], 3), a2 = helixPath([-1, 1, 0], [9, -1, 0], 8), a3 = helixPath([9.6, 0.4, 0], [12, 3, 1], 2.5);
      [a1, a2, a3].forEach(p => ctx.add('fold', new THREE.Mesh(tubeG(p, 0.32, p.length * 3, 8), hm)));
      ctx.add('loops', new THREE.Mesh(tubeG([a1[a1.length - 1], V3([-1.6, 1.8, .8]), a2[0]], 0.22, 20, 6), mm(col, {op: .8})));
      ctx.add('loops', new THREE.Mesh(tubeG([a2[a2.length - 1], V3([9.6, -1.2, .6]), a3[0]], 0.22, 20, 6), mm(col, {op: .8})));
      // partner fold, crossed in the handshake
      const pm = mm(extra.pcol, {op: .35});
      [helixPath([10, -3, -1], [6, -1, -1], 3), helixPath([5, 1.4, -1.2], [-5, -1.6, -1.2], 8), helixPath([-5.6, -0.4, -1], [-8, 2.6, 0], 2.5)].forEach(p => ctx.add('partner', new THREE.Mesh(tubeG(p, 0.3, p.length * 3, 8), pm)));
      // tail with residues; lysines highlighted where marked
      const tailPts = extra.tailEnd === 'C-terminal' ? walk(r, [12, 3, 1], 14, 1.0, [1, .2, .3]) : walk(r, [-6, -2, 0], 14, 1.0, [-1, -.3, .4]);
      const tc = new THREE.CatmullRomCurve3(tailPts); ctx.add('tail', new THREE.Mesh(tubeG(tailPts, 0.16, 80, 6), mm(col, {op: .9})));
      const res = []; for (let i = 0; i < tailLen; i++) res.push({p: tc.getPointAt(i / (tailLen - 1)).toArray(), s: 0.24}); ctx.add('tail', inst(MG.sphLo, mm(col, {r: .6}), res));
      marks.forEach(([site, type]) => { const n = parseInt(site.slice(1)), pos = tc.getPointAt(Math.min(1, (extra.tailEnd === 'C-terminal' ? (n - (aa - tailLen)) : n) / tailLen));
        const g = new THREE.Group(), mc = mm(MARK[type][1], {em: MARK[type][1], ei: .25});
        g.add(mesh(MG.sph, mm(0xf4efe6), pos.toArray(), 0.42));
        if (type === 'ub') g.add(mesh(MG.sph, mc, pos.clone().add(new THREE.Vector3(0, 1.4, 0)).toArray(), 1.1));
        else { const k = type === 'me3' ? 3 : 1; for (let j = 0; j < k; j++) g.add(mesh(MG.sph, mc, pos.clone().add(new THREE.Vector3(Math.cos(j * 2.1) * .5, .65, Math.sin(j * 2.1) * .5)).toArray(), 0.28)); }
        ctx.add('m-' + site, g); }); } }); }

histoneWorld('H3', 135, 15, 40, [
  ['K4', 'me3', 'Three methyl groups on lysine 4, added by SET1/MLL (COMPASS) enzymes.', 'Marks the start (promoter) of active genes and recruits the transcription machinery.'],
  ['K9', 'me3', 'Three methyl groups on lysine 9, added by SUV39H1/2 and SETDB1.', 'A hallmark of permanently silent heterochromatin, such as around centromeres; read by HP1, which compacts chromatin.'],
  ['S10', 'ph', 'A phosphate on serine 10, added by Aurora B kinase.', 'Rises sharply as chromosomes condense in mitosis.'],
  ['K27', 'me3', 'Three methyl groups on lysine 27, added by the Polycomb complex PRC2 (EZH2).', 'Keeps developmental genes switched off in cells that do not need them.'],
  ['K36', 'me3', 'Three methyl groups on lysine 36, added by SETD2 as RNA polymerase II passes.', 'Covers the bodies of genes being read and blocks transcription starting in the wrong place.']],
  {c: [-0.75, 0.05], col: HCOL.H3, pcol: HCOL.H4, partner: 'Histone H4', what: 'The fold and tail of histone H3. The tail (residues 1–40 or so) is where most studied marks sit.', does: 'Its marks form a code read by other proteins: the same lysine can mean "on" or "off" depending on the mark.'});
histoneWorld('H4', 102, 11, 24, [
  ['K5', 'ac', 'An acetyl group on lysine 5, added together with K12 acetylation by HAT1 to newly made H4.', 'Tags new histones as they are loaded onto freshly copied DNA.'],
  ['K12', 'ac', 'An acetyl group on lysine 12 of new H4.', 'Removed again a few hours after the histone is loaded onto chromatin.'],
  ['K16', 'ac', 'An acetyl group on lysine 16, added by MOF (KAT8).', 'Stops the H4 tail gripping the next nucleosome, loosening the fibre.'],
  ['K20', 'me3', 'Three methyl groups on lysine 20, added by SUV4-20H enzymes.', 'Found in silent heterochromatin.']],
  {c: [-0.75, 0.15], col: HCOL.H4, pcol: HCOL.H3, partner: 'Histone H3', what: 'The fold and tail of histone H4, almost identical in peas and cows.', does: 'Its tail reaches over to the acidic patch on the neighbouring nucleosome, helping chromatin fold.'});
histoneWorld('H2A', 129, 14, 14, [
  ['K119', 'ub', 'A single ubiquitin (a 76-amino-acid protein) on lysine 119, added by PRC1 (RING1B).', 'Works with H3K27me3 to keep Polycomb target genes silent.']],
  {c: [-0.7, 0.3], col: HCOL.H2A, pcol: HCOL.H2B, partner: 'Histone H2B', tailEnd: 'C-terminal', what: 'The fold of histone H2A and its C-terminal tail, which lies near where DNA enters the nucleosome.', does: 'With H2B forms the acidic patch. The variant H2A.X is phosphorylated at serine 139 (γH2AX) within minutes of a DNA break.'});
histoneWorld('H2B', 125, 14, 10, [
  ['K120', 'ub', 'A single ubiquitin on lysine 120, added by RNF20/RNF40.', 'Accompanies RNA polymerase II through genes and is needed for H3K79 methylation by DOT1L.']],
  {c: [-0.68, 0.36], col: HCOL.H2B, pcol: HCOL.H2A, partner: 'Histone H2A', tailEnd: 'C-terminal', what: 'The fold of histone H2B and its C-terminal region near lysine 120.', does: 'Pairs with H2A; its ubiquitination is one of the clearest links between chromatin and active transcription.'});

W({id: 'dna', level: 'molecule', name: 'DNA double helix', common: 'B-DNA', sys: 'molecule', unit: 1e-10, c: [0.37, 0.1], cam: [0, 0, 70], R: 60,
  what: 'Two antiparallel strands coiled into a right-handed helix 2 nm wide, with 10.5 base pairs per turn, 0.34 nm apart.',
  does: 'Stores genetic information in the order of its four bases. A human cell holds about 6.4 billion base pairs.', size: '2 nm wide, 3.4 nm per turn', src: ['Watson & Crick, Nature 171:737 (1953)', 'Franklin & Gosling, Nature 171:740 (1953)', BIO],
  hist: [['1869', 'Friedrich Miescher isolates "nuclein" from white blood cells.'], ['1952', 'Rosalind Franklin and Raymond Gosling record Photo 51.'], ['1953', 'Watson and Crick publish the double helix, built on Franklin\'s and Wilkins\'s X-ray data.']],
  comps: {
    bb: C('Sugar-phosphate backbone', '', 'Alternating deoxyribose sugars and phosphate groups linked by phosphodiester bonds; the two strands run in opposite directions.', 'Its negative phosphates are what positively charged histones and many proteins hold on to.'),
    A: C('Adenine (A)', '', 'A purine base, the larger kind of base with two rings.', 'Pairs with thymine through two hydrogen bonds.'),
    T: C('Thymine (T)', '', 'A pyrimidine base with one ring. RNA uses uracil in its place.', 'Pairs with adenine.'),
    G: C('Guanine (G)', '', 'A purine base.', 'Pairs with cytosine through three hydrogen bonds, so G–C pairs hold more tightly.'),
    Cy: C('Cytosine (C)', '', 'A pyrimidine base, often methylated when followed by G (CpG).', 'Pairs with guanine. 5-methylcytosine at promoters helps silence genes.'),
    hb: C('Hydrogen bonds', '', 'Weak bonds between the paired bases across the middle of the helix.', 'Hold the strands together but let them unzip for copying and reading.'),
    major: C('Major groove', '', 'The wider groove, about 2.2 nm across.', 'Where most sequence-reading proteins, such as transcription factors, recognise their sites.'),
    minor: C('Minor groove', '', 'The narrower groove, about 1.2 nm across.', 'Faces the histone core every 10 base pairs in a nucleosome.')},
  build(ctx) { const r = rng(101), N = 32, rise = 3.4, tw = 2 * Math.PI / 10.5, R = 10, off = 2.4;
    const s1 = [], s2 = [], seq = 'ATGCGTACCGATTGCAGTCCATGACGTTAGCC';
    for (let i = 0; i < N; i++) { const y = (i - N / 2) * rise, a = i * tw; s1.push(new THREE.Vector3(Math.cos(a) * R, y, Math.sin(a) * R)); s2.push(new THREE.Vector3(Math.cos(a + off) * R, y, Math.sin(a + off) * R)); }
    const bm = mm(0xd8d2c0, {r: .35}); ctx.add('bb', new THREE.Mesh(tubeG(s1, 1, N * 6, 8), bm)); ctx.add('bb', new THREE.Mesh(tubeG(s2, 1, N * 6, 8), bm));
    ctx.add('bb', inst(MG.sph, mm(0xe8823c), [...s1, ...s2].map(p => ({p: p.toArray(), s: 1.35}))));
    const comp = {A: 'T', T: 'A', G: 'C', C: 'G'}, cols = {A: 0x5cb85c, T: 0xe05555, G: 0xf0c040, C: 0x4a7fd8}, sets = {A: [], T: [], G: [], C: []}, hb = [];
    for (let i = 0; i < N; i++) { const b1 = seq[i], b2 = comp[b1], a = s1[i], b = s2[i], mid = a.clone().lerp(b, b1 === 'A' || b1 === 'G' ? .55 : .45);
      sets[b1].push(segT(a.toArray(), mid.clone().lerp(a, .08).toArray(), 0.9)); sets[b2].push(segT(b.toArray(), mid.clone().lerp(b, .08).toArray(), 0.9));
      const n = (b1 === 'G' || b1 === 'C') ? 3 : 2; for (let k = 0; k < n; k++) hb.push({p: mid.toArray(), s: 0.32}); }
    Object.entries(sets).forEach(([k, v]) => ctx.add(k === 'C' ? 'Cy' : k, inst(MG.cyl, mm(cols[k], {r: .4}), v)));
    ctx.add('hb', inst(MG.sphLo, mm(0xf4efe6, {em: 0x444444}), hb));
    const gm = (id, phase, w, col) => { const pts = []; for (let i = 0; i < N; i++) { const a = i * tw + phase; pts.push(new THREE.Vector3(Math.cos(a) * (R + 1), (i - N / 2) * rise, Math.sin(a) * (R + 1))); }
      ctx.add(id, new THREE.Mesh(tubeG(pts, w, N * 6, 6), mm(col, {op: .18}))); };
    gm('minor', off / 2, 1.5, 0x9b8be0); gm('major', off / 2 + Math.PI, 2.6, 0x6fc2b0); }
});

W({id: 'hemoglobin', level: 'molecule', name: 'Haemoglobin', common: 'Oxygen-carrying protein', sys: 'molecule', unit: 5e-10, c: [-0.8, 0.156], cam: [12, 9, 34], R: 20,
  what: 'A protein of four chains, two alpha and two beta, each holding an iron-containing haem group. A red blood cell carries about 270 million of them.',
  does: 'Each molecule binds up to four oxygen molecules. Binding one makes the next easier (cooperativity), which gives the S-shaped oxygen curve.', size: 'about 64.5 kDa, 6.5 nm across', src: ['Perutz et al., Nature 185:416 (1960)', BIO],
  hist: [['1959', 'Max Perutz solves the structure of haemoglobin by X-ray crystallography (Nobel Prize 1962).']],
  comps: {
    alpha: C('Alpha chains (×2)', '', 'Two chains of 141 amino acids each.', 'Hold two of the four haem groups.'),
    beta: C('Beta chains (×2)', '', 'Two chains of 146 amino acids each. A single change at position 6 (glutamate to valine) causes sickle cell disease.', 'Hold the other two haem groups and bind 2,3-BPG, which helps release oxygen to tissues.'),
    heme: C('Haem groups', 'Heme', 'A flat porphyrin ring with an iron atom at its centre, tucked into a pocket of each chain.', 'The iron binds oxygen. Carbon monoxide binds about 200 times more tightly, which is why it is poisonous.'),
    o2: C('Oxygen', 'O₂', 'Oxygen molecules bound to the haem iron.', 'Picked up in the lungs and released in tissues where oxygen is low and acidity is high.')},
  build(ctx) { const r = rng(103);
    const chain = (id, col, c) => { const g = new THREE.Group(), m = mm(col, {r: .45, cc: .4, op: .5}); for (let k = 0; k < 7; k++) g.add(mesh(MG.sph, m, V3(c).add(new THREE.Vector3((r() - .5) * 4, (r() - .5) * 4, (r() - .5) * 4)).toArray(), 2.2 + r() * .8)); ctx.add(id, g); };
    const pos = [[-3.4, 3, 2], [3.4, -3, 2], [3.4, 3, -2], [-3.4, -3, -2]];
    chain('alpha', 0xe07a8a, pos[0]); chain('alpha', 0xe07a8a, pos[1]); chain('beta', 0x5aa8e0, pos[2]); chain('beta', 0x5aa8e0, pos[3]);
    pos.forEach(p => { const h = V3(p).multiplyScalar(1.35); ctx.add('heme', mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.25, 6), mm(0xb02a2a, {r: .3}), h.toArray(), 1, [r() * 3, r() * 3, 0]));
      ctx.add('heme', mesh(MG.sph, mm(0xd8762a, {em: 0x442200}), h.toArray(), 0.4));
      const o = h.clone().add(new THREE.Vector3(0, 1.2, 0)); ctx.add('o2', mesh(MG.sph, mm(0xe84a4a), o.toArray(), 0.45)); ctx.add('o2', mesh(MG.sph, mm(0xe84a4a), o.clone().add(new THREE.Vector3(.6, .4, 0)).toArray(), 0.45)); }); }
});

W({id: 'odorant-receptor', level: 'molecule', name: 'Odour receptor', common: 'Olfactory receptor protein', sys: 'molecule', unit: 5e-10, c: [0.3, 0.5], cam: [12, 8, 42], R: 22,
  what: 'A G-protein-coupled receptor: one protein chain crossing the cilium membrane seven times, with a pocket for odour molecules between its helices.',
  does: 'When an odour fits the pocket, the receptor changes shape and switches on the G protein Golf, which raises cAMP and opens ion channels. This is the end of the smell branch: the next step down is single atoms.', size: 'about 310 amino acids', src: ['Buck & Axel, Cell 65:175 (1991)', 'Billesbølle et al., Nature 615:742 (2023)'],
  hist: [['1991', 'Buck and Axel discover the odour receptor genes.'], ['2023', 'The first structure of a human odour receptor (OR51E2) bound to its odour is solved by cryo-electron microscopy.']],
  comps: {
    tm: C('Seven transmembrane helices', '', 'Seven alpha helices, each about 20–25 amino acids, crossing the membrane in a ring.', 'Shift relative to each other when an odour binds, passing the signal inside.'),
    pocket: C('Odour-binding pocket', '', 'A cavity between the helices on the outer side.', 'Each receptor fits a range of odours, and each odour activates a set of receptors; the brain reads the combination.'),
    odor: C('Odour molecule', '', 'A small volatile molecule, shown here as a generic ligand.', 'Binding it switches the receptor on.'),
    gprot: C('G protein (Golf)', '', 'A three-part protein on the inner face of the membrane.', 'Activated by the receptor; turns on adenylyl cyclase III to make cAMP.'),
    mem: C('Cilium membrane', '', 'The lipid bilayer of the olfactory cilium.', 'Holds the receptor and the downstream channels.')},
  build(ctx) { const r = rng(107), hm = mm(0xe6c56a, {r: .4, cc: .5});
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, x = Math.cos(a) * 4.2, z = Math.sin(a) * 4.2; ctx.add('tm', new THREE.Mesh(tubeG(helixPath([x, -7, z], [x + (r() - .5), 7, z + (r() - .5)], 6), 0.4, 80, 8), hm)); }
    ctx.add('mem', mesh(MG.box, mm(0x9fd0d8, {op: .2}), [0, 0, 0], [30, 10, 30]));
    ctx.add('pocket', mesh(MG.sph, mm(0x6fc2b0, {op: .25}), [0, 4, 0], 2.2));
    ctx.add('odor', mesh(MG.sph, mm(0xd88ac0, {em: 0x442244}), [0, 4, 0], [1, .7, .7]));
    ctx.add('gprot', mesh(MG.sph, mm(0x9b8be0), [0, -10, 1], [4, 2.5, 3.5])); ctx.add('gprot', mesh(MG.sph, mm(0x7a6ac8), [3.5, -12, -1], 2)); }
});

W({id: 'atp-synthase', level: 'molecule', name: 'ATP synthase', common: 'Complex V', sys: 'molecule', unit: 5e-10, c: [-0.8, 0.156], cam: [10, 4, 34], R: 24,
  what: 'A rotary motor of about 30 protein subunits: a ring (Fo) in the membrane and a head (F1) in the matrix, joined by a central stalk.',
  does: 'Protons flowing through the ring spin it and the stalk; the turning stalk squeezes the three catalytic sites in the head, each making ATP from ADP and phosphate.', size: 'about 600 kDa, head about 10 nm wide', src: ['Abrahams et al., Nature 370:621 (1994)', 'Noji et al., Nature 386:299 (1997)'],
  hist: [['1994', 'John Walker\'s group solves the structure of the F1 head (Nobel Prize 1997, shared with Paul Boyer).'], ['1997', 'Noji and colleagues film the head rotating under a microscope.']],
  comps: {
    f1: C('F1 head', 'α3β3', 'Three alpha and three beta subunits arranged like orange segments.', 'The three beta subunits take turns binding ADP, making ATP and releasing it.'),
    stalk: C('Central stalk', 'γ subunit', 'An off-centre shaft running up into the head.', 'Rotates about 100 times a second at full speed, deforming each beta subunit in turn.'),
    ring: C('c-ring', 'Fo rotor', 'A ring of 8 c-subunits in the inner membrane in animals.', 'Each proton passing through turns it one step; 8 protons make one full turn and three ATP.'),
    stator: C('Peripheral stalk', 'Stator', 'A side arm holding the head still.', 'Stops the head spinning with the rotor, so the rotation does work.'),
    mem: C('Inner membrane', '', 'The cristae membrane the motor sits in.', 'Holds the proton gradient that drives the motor.')},
  build(ctx) { const r = rng(109);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ctx.add('f1', mesh(MG.sph, mm(i % 2 ? 0xe07a8a : 0x5aa8e0, {r: .4}), [Math.cos(a) * 3.2, 8, Math.sin(a) * 3.2], [2.2, 3.4, 2.2])); }
    ctx.add('stalk', mesh(MG.cyl, mm(0xf2c14e), [0.6, 2, 0], [0.9, 12, 0.9]));
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ctx.add('ring', mesh(MG.cyl, mm(0x7fcf8a), [Math.cos(a) * 3, -5, Math.sin(a) * 3], [0.9, 6, 0.9])); }
    ctx.add('stator', mesh(MG.cyl, mm(0x9b8be0), [6.5, 2, 0], [0.6, 15, 0.6])); ctx.add('stator', mesh(MG.sph, mm(0x9b8be0), [5.5, -5, 0], [1.6, 3, 1.6]));
    ctx.add('mem', mesh(MG.box, mm(0x9fd0d8, {op: .2}), [0, -5, 0], [26, 5, 26])); },
  tick(t, dt) { (this._ctx.comps.ring.objs.concat(this._ctx.comps.stalk.objs)).forEach(o => { if (!o.userData.base) o.userData.base = o.position.clone(); const b = o.userData.base, a = t * 1.2;
    o.position.set(b.x * Math.cos(a) - b.z * Math.sin(a), b.y, b.x * Math.sin(a) + b.z * Math.cos(a)); }); }
});

W({id: 'collagen', level: 'molecule', name: 'Collagen', common: 'Type I collagen', sys: 'molecule', unit: 1e-9, c: [-0.835, -0.2321], cam: [0, 6, 46], R: 36,
  what: 'The most abundant protein in the body: three chains twisted into a rope-like triple helix about 1.5 nm wide and 300 nm long, packed into banded fibrils.',
  does: 'Gives bone, skin, tendon and dermis their tensile strength. In bone, crystals of hydroxyapatite fill the gaps between molecules. This is the end of the connective-tissue branch.', size: '1.5 × 300 nm per molecule', src: ['Shoulders & Raines, Annu Rev Biochem 78:929 (2009)', BIO],
  hist: [['1954', 'G. N. Ramachandran and Gopinath Kartha propose the triple-helix structure.']],
  comps: {
    triple: C('Triple helix', 'Tropocollagen', 'Three chains, each with the repeating pattern glycine-X-Y (often proline and hydroxyproline), wound around each other.', 'Glycine every third position is small enough to fit in the centre. Faulty collagen I causes brittle bone disease (osteogenesis imperfecta).'),
    fibril: C('Collagen fibril', '', 'Molecules staggered side by side, giving a band pattern every 67 nm.', 'Bundles into fibres that resist stretching.'),
    gap: C('Gap zones', '', 'Regular gaps between the ends of molecules in a fibril.', 'In bone, this is where the first hydroxyapatite mineral crystals form.'),
    hap: C('Hydroxyapatite', 'Bone mineral', 'Plate-like calcium phosphate crystals, Ca₁₀(PO₄)₆(OH)₂, a few nanometres thick.', 'Makes bone hard and stores about 99% of the body\'s calcium.')},
  build(ctx) { const r = rng(113), cols = [0xe07a8a, 0xe8a87c, 0xd8d2c0];
    for (let c = 0; c < 3; c++) { const pts = []; for (let i = 0; i <= 120; i++) { const y = -30 + i * .5, a = i * 0.32 + c * 2.094; pts.push(new THREE.Vector3(Math.cos(a) * 1.1, y, Math.sin(a) * 1.1)); }
      ctx.add('triple', new THREE.Mesh(tubeG(pts, 0.45, 360, 6), mm(cols[c], {r: .4}))); }
    const fm = mm(0xe8dcc0, {r: .6}); for (let k = 0; k < 7; k++) { const x = 8 + k * 2.4, off = (k % 5) * 13.4;
      for (let s = -2; s <= 2; s++) { const y0 = s * 67 / 1.9 + off - 30, L = 30; if (y0 > 34 || y0 + L < -34) continue;
        ctx.add('fibril', mesh(MG.cyl, fm, [x, Math.max(-34, Math.min(34, y0 + L / 2)), 0], [0.8, Math.min(L, 68), 0.8])); } }
    const gaps = []; for (let k = 0; k < 7; k++) for (let y = -30; y < 30; y += 67 / 1.9) gaps.push({p: [8 + k * 2.4, y + (k % 5) * 3, 0], s: [1.1, 2.2, 1.1]});
    ctx.add('gap', inst(MG.sphLo, mm(0x6b5a48, {op: .7}), gaps));
    const hap = []; for (let i = 0; i < 14; i++) hap.push({p: [8 + r() * 15, (r() - .5) * 56, 1.6], s: [1.6, 3, 0.25], r: [0, 0, (r() - .5) * .3]});
    ctx.add('hap', inst(MG.box, mm(0xf4efe6, {r: .2, cc: .8}), hap)); }
});

// ---------- which body structures open which world ----------
const MICRO_ENTRY = {heart: 'cardiac', 'heart-wall': 'cardiac', 'papillary-muscles': 'cardiac',
  'lung-left': 'alveoli', 'lung-right': 'alveoli', 'lung-left-upper': 'alveoli', 'lung-left-lower': 'alveoli', 'lung-right-upper': 'alveoli', 'lung-right-middle': 'alveoli', 'lung-right-lower': 'alveoli', bronchi: 'alveoli',
  'small-intestine': 'villi', jejunum: 'villi', ileum: 'villi', duodenum: 'villi',
  brain: 'cortex', 'frontal-lobe': 'cortex', 'parietal-lobe': 'cortex', 'temporal-lobe-left': 'cortex', 'temporal-lobe-right': 'cortex', 'occipital-lobe': 'cortex', 'limbic-system': 'cortex', 'insula-lobes': 'cortex',
  'nasal-cavity': 'olfactory', 'scalp-hair': 'skin', 'pubic-hair': 'skin'};
const NO_MICRO = new Set(['heart-valves', 'ventricles', 'white-matter', 'optic-pathway', 'pituitary', 'deep-brain', 'teeth', 'outer-ears', 'eyes']);
function microFor(nd) {
  if (NO_MICRO.has(nd.id)) return null;
  if (MICRO_ENTRY[nd.id]) return MICRO_ENTRY[nd.id];
  // children inherit their organ's tissue when they are the same kind of tissue
  for (let a = nd.parent; a; a = a.parent) { if (NO_MICRO.has(a.id)) return null; if (MICRO_ENTRY[a.id] && a.sys === nd.sys) return MICRO_ENTRY[a.id]; }
  if (nd.sys === 'bone') return 'bone';
  if (nd.sys === 'muscle') return 'skmuscle';
  if (nd.sys === 'ligament') return 'collagen';     // tendons, ligaments and cartilage are mostly collagen
  if (nd.sys === 'skin' && nd.own && !nd.attach) return 'skin';
  return null; }
LIST.forEach(nd => { const w = microFor(nd); if (w && nd.depth > 0) nd.micro = w; });

// ---------- world nodes and component nodes (exist before any world is built, so search finds them) ----------
const MNODES = {}, MLIST = [];
Object.values(WORLDS).forEach(Wd => {
  Wd.node = {id: 'w:' + Wd.id, name: Wd.name, common: Wd.common || '', sys: Wd.sys, what: Wd.what, does: Wd.does, size: Wd.size, src: Wd.src, hist: Wd.hist, kids: [], conn: [],
    isMicro: true, isWorld: true, world: Wd.id, depth: 99, target: 0};
  MNODES[Wd.node.id] = Wd.node; MLIST.push(Wd.node);
  Object.entries(Wd.comps).forEach(([cid, d]) => { const nd = Object.assign({id: Wd.id + '/' + cid, cid, sys: d.sys || Wd.sys, kids: [], conn: [], isMicro: true, world: Wd.id, depth: 99, target: 0, parent: Wd.node, micro: d.deeper || null, src: Wd.src}, d);
    Wd.node.kids.push(nd); MNODES[nd.id] = nd; MLIST.push(nd); }); });
// default way into each world, used when jumping from search
const HOME = {};
Object.values(WORLDS).forEach(Wd => Wd.node.kids.forEach(k => { if (k.micro && !HOME[k.micro]) HOME[k.micro] = Wd.id; }));
LIST.forEach(nd => { if (nd.micro && !HOME[nd.micro]) HOME[nd.micro] = nd.id; });
HOME.bone = 'femur-left'; HOME.skmuscle = NODES['quadriceps-left'] ? 'quadriceps-left' : HOME.skmuscle; HOME.skin = 'thorax'; HOME.collagen = 'bone'; HOME.olfactory = 'nasal-cavity';

// ---------- micro scene ----------
const mscene = new THREE.Scene(); mscene.environment = scene.environment;
mscene.add(new THREE.HemisphereLight(0xf4ecff, 0x22181e, 0.55));
const mkey = new THREE.DirectionalLight(0xfff0e0, 1.1); mkey.position.set(2, 3, 2.5); mscene.add(mkey);
const mrim = new THREE.DirectionalLight(0x9fdcd6, 0.6); mrim.position.set(-2, 1, -2.5); mscene.add(mrim);
let curW = null; const mstack = []; let bodyCam = null, bodyEntry = null;

function buildWorld(Wd) {
  if (Wd.group) return;
  const ctx = {group: new THREE.Group(), pick: [], comps: {}};
  Object.keys(Wd.comps).forEach(cid => { ctx.comps[cid] = MNODES[Wd.id + '/' + cid]; ctx.comps[cid].objs = []; ctx.comps[cid].mats = []; });
  ctx.add = (cid, obj) => { const nd = ctx.comps[cid]; if (!nd) { console.warn('no comp', Wd.id, cid); return obj; }
    obj.traverse(o => { if (o.isMesh) { o.userData.node = nd; if (!nd.mats.includes(o.material)) nd.mats.push(o.material); ctx.pick.push(o); } });
    ctx.group.add(obj); nd.objs.push(obj); return obj; };
  Wd._ctx = ctx; Wd.build.call(Wd, ctx); Wd.group = ctx.group; Wd.pick = ctx.pick; mscene.add(ctx.group);
  // label anchors: centre of each component
  Object.values(ctx.comps).forEach(nd => { const pts = [];
    nd.objs.forEach(o => { o.updateMatrixWorld(true);
      if (o.isInstancedMesh) { const m4 = new THREE.Matrix4(), v = new THREE.Vector3(); const n = Math.min(o.count, 40); for (let i = 0; i < n; i++) { o.getMatrixAt(Math.floor(i * o.count / n), m4); pts.push(v.setFromMatrixPosition(m4).clone()); } }
      else { const b = new THREE.Box3().setFromObject(o); if (!b.isEmpty()) pts.push(b.getCenter(new THREE.Vector3())); } });
    if (!pts.length) { nd.anchor = null; nd.mcenter = null; return; }
    const c = new THREE.Vector3(); pts.forEach(p => c.add(p)); c.divideScalar(pts.length);
    // nudge the anchor to the point of the component nearest that centre, so labels sit on the part
    // pick a real point on the part, nearest its centroid, so labels sit on the thing they name
    let best = null, bd = Infinity; const v = new THREE.Vector3();
    nd.objs.forEach(o => o.traverse(x => { if (!x.isMesh) return;
      if (x.isInstancedMesh) { const m4 = new THREE.Matrix4(), step = Math.max(1, Math.floor(x.count / 60)); for (let i = 0; i < x.count; i += step) { x.getMatrixAt(i, m4); v.setFromMatrixPosition(m4).applyMatrix4(x.matrixWorld); const d = v.distanceToSquared(c); if (d < bd) { bd = d; best = v.clone(); } } }
      else { const pa = x.geometry.attributes.position, step = Math.max(1, Math.floor(pa.count / 80)); for (let i = 0; i < pa.count; i += step) { v.fromBufferAttribute(pa, i).applyMatrix4(x.matrixWorld); const d = v.distanceToSquared(c); if (d < bd) { bd = d; best = v.clone(); } } } }));
    nd.anchor = best || c; nd.mcenter = (best || c).clone(); }); }

function showWorld(Wd, parentNode, opts) {
  buildWorld(Wd);
  Object.values(WORLDS).forEach(w => { if (w.group) w.group.visible = (w === Wd); });
  Wd.node.parent = parentNode; curW = Wd;
  const R = Wd.R || 15; controls.minDistance = R * 0.02; controls.maxDistance = R * 6;
  const camT = new THREE.Vector3(...(Wd.target || [0, 0, 0])), camP = V3(Wd.cam);
  if (opts && opts.instant) { camera.position.copy(camP); controls.target.copy(camT); }
  else { camera.position.copy(camT.clone().lerp(camP, 0.35)); controls.target.copy(camT);
    flight = {t: 0, dur: RM ? 0.01 : 1.1, fromP: camera.position.clone(), fromT: camT.clone(), toT: camT.clone(), toP: camP}; }
  bgU.uC.value.set(...Wd.c);
  document.body.classList.add('in-micro');
  select(Wd.node, false); openCard(); updateLadder(); }

// enter from the body (bodyNode has .micro) or from a component in the current world
function goDeeper(nd, focusPoint) {
  const Wd = WORLDS[nd.micro]; if (!Wd) return;
  const focus = focusPoint || (nd.isMicro ? (nd.mcenter || controls.target) : nd.center.clone().add(nd.off));
  closeFlower();
  zoomTransition(focus, () => {
    if (state.mode !== 'micro') { bodyCam = {p: camera.position.clone(), t: controls.target.clone(), min: controls.minDistance, max: controls.maxDistance}; bodyEntry = nd; mstack.length = 0;
      state.mode = 'micro'; showWorld(Wd, nd); }
    else showWorld(Wd, curW.node);
    mstack.push(Wd.id); }, 1); }
function goUp() {
  if (state.mode !== 'micro') return;
  if (mstack.length > 1) { mstack.pop(); const prev = WORLDS[mstack[mstack.length - 1]]; zoomTransition(null, () => showWorld(prev, prev.node.parent, {instant: true}), -1); }
  else exitMicro(bodyEntry); }
function exitMicro(target) {
  zoomTransition(null, () => { state.mode = 'body'; document.body.classList.remove('in-micro'); mstack.length = 0; curW = null;
    Object.values(WORLDS).forEach(w => { if (w.group) w.group.visible = false; });
    if (bodyCam) { camera.position.copy(bodyCam.p); controls.target.copy(bodyCam.t); controls.minDistance = bodyCam.min; controls.maxDistance = bodyCam.max; }
    const t = target && !target.isMicro ? target : bodyEntry || BODY; for (let a = t.parent; a && a.depth > 0; a = a.parent) a.target = 1; refreshLineage();
    select(t, false); openCard(); updateLadder(); }, -1); }
// jump straight to a world from search or a crumb, rebuilding the chain of worlds above it
function jumpToWorld(wid, thenSelect) {
  const chain = []; let w = wid, guard = 0; while (w && WORLDS[w] && guard++ < 12) { chain.unshift(w); w = HOME[w]; }
  const entry = NODES[w] || NODES[HOME[chain[0]]] || BODY;
  if (state.mode === 'tunnel') exitTunnel(true);
  if (state.mode !== 'micro') { bodyCam = {p: camera.position.clone(), t: controls.target.clone(), min: controls.minDistance, max: controls.maxDistance}; bodyEntry = entry; state.mode = 'micro'; }
  mstack.length = 0; let parent = entry;
  chain.forEach((id, i) => { mstack.push(id); if (i < chain.length - 1) { WORLDS[id].node.parent = parent; parent = WORLDS[id].node; } });
  zoomTransition(null, () => { showWorld(WORLDS[wid], parent); if (thenSelect) { select(thenSelect, false); openCard(); } }, 1); }
function revealMicro(nd) { if (curW && curW.id === nd.world) { select(nd, false); flyMicro(nd); openCard(); } else jumpToWorld(nd.world, nd.isWorld ? null : nd); }
function flyMicro(nd) { if (!nd.mcenter && !nd.isWorld) return; const Wd = WORLDS[nd.world];
  if (nd.isWorld) { flight = {t: 0, dur: RM ? .01 : .8, fromP: camera.position.clone(), fromT: controls.target.clone(), toT: V3(Wd.target || [0, 0, 0]), toP: V3(Wd.cam)}; return; }
  const dir = camera.position.clone().sub(controls.target).normalize(), d = Math.max(Wd.R * 0.35, camera.position.distanceTo(controls.target) * 0.7);
  flight = {t: 0, dur: RM ? .01 : .8, fromP: camera.position.clone(), fromT: controls.target.clone(), toT: nd.mcenter.clone(), toP: nd.mcenter.clone().addScaledVector(dir, Math.min(d, Wd.R * 1.2))}; }

// ---------- the fractal zoom curtain ----------
const zU = {uRes: bgU.uRes, uA: {value: 0}, uZ: {value: 0}, uC: {value: new THREE.Vector2(-0.745, 0.113)}, uDir: {value: 1}};
const zScene = new THREE.Scene();
zScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({uniforms: zU, transparent: true, depthTest: false, depthWrite: false,
  vertexShader: 'void main(){gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader: `precision highp float;uniform vec2 uRes;uniform float uA,uZ,uDir;uniform vec2 uC;
  void main(){vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y; float z=exp(-uZ*7.);
    vec2 c=uC+uv*2.6*z; vec2 w=vec2(0.); float n=0.; bool e=false;
    for(int i=0;i<180;i++){ w=vec2(w.x*w.x-w.y*w.y,2.*w.x*w.y)+c; if(dot(w,w)>64.){e=true;break;} n+=1.; }
    vec3 bg=vec3(.035,.038,.07), col=bg;
    if(e){ float s=n-log2(log2(dot(w,w))); float t=sqrt(s/180.); col=bg+mix(vec3(.18,.55,.6),vec3(.9,.68,.42),.5+.5*sin(t*10.+uZ*6.))*pow(t,1.2)*1.4; }
    float vig=1.-.6*dot(uv,uv); gl_FragColor=vec4(col*vig,uA);}`})));
let trans = null;
function zoomTransition(focus, cb, dir) {
  if (RM) { cb(); return; }
  closeCard();
  trans = {t: 0, dur: 1.25, cb, done: false, dir: dir || 1, fromP: camera.position.clone(), fromT: controls.target.clone(), focus: focus ? focus.clone() : null};
  controls.enabled = false; }
function stepTransition(dt) {
  if (!trans) return; trans.t += dt / trans.dur; const t = Math.min(1, trans.t);
  if (!trans.done) { const e = Math.min(1, t / 0.5), k = e * e * (3 - 2 * e);
    if (trans.dir > 0 && trans.focus) { camera.position.lerpVectors(trans.fromP, trans.focus, k * 0.9); controls.target.lerpVectors(trans.fromT, trans.focus, k); }
    else if (trans.dir < 0) { const away = trans.fromP.clone().sub(trans.fromT).multiplyScalar(1 + k * 2.5); camera.position.copy(trans.fromT).add(away); } }
  if (t >= 0.5 && !trans.done) { trans.done = true; trans.cb(); }
  const s = (a, b, x) => { const y = Math.min(1, Math.max(0, (x - a) / (b - a))); return y * y * (3 - 2 * y); };
  zU.uA.value = t < 0.5 ? s(0.12, 0.48, t) : 1 - s(0.55, 0.98, t);
  zU.uZ.value = trans.dir > 0 ? t : 1 - t;
  if (t >= 1) { trans = null; controls.enabled = true; } }

// ---------- per-frame for micro worlds ----------
const SEL_EM = new THREE.Color(0xe7ad6c).convertSRGBToLinear();
function stepMicro(dt) {
  if (flight) { flight.t += dt / flight.dur; const e = flight.t >= 1 ? 1 : 1 - Math.pow(1 - flight.t, 3);
    camera.position.lerpVectors(flight.fromP, flight.toP, e); controls.target.lerpVectors(flight.fromT, flight.toT, e); if (flight.t >= 1) flight = null; }
  controls.update();
  const dist = camera.position.distanceTo(controls.target); camera.near = Math.max(0.001, dist * 0.01); camera.far = Math.max(200, dist * 80); camera.updateProjectionMatrix();
  const Wd = curW; if (!Wd) return;
  if (Wd.tick) Wd.tick(time, dt);
  const sel = state.selected, hov = state.hover;
  Object.values(Wd._ctx.comps).forEach(nd => { let em = 0, tint = 0;
    if (sel === nd) { tint = 0.55 + 0.12 * Math.sin(time * 3); } else if (hov === nd) em = 0.18;
    nd.mats.forEach(m => { m.emissive.copy(m.userData.baseEm || new THREE.Color(0)); if (em) m.emissive.add(m.color.clone().multiplyScalar(em)); if (tint) m.emissive.add(SEL_EM.clone().multiplyScalar(tint)); }); });
  bgU.uInt.value += (fractalTarget * 0.45 - bgU.uInt.value) * Math.min(1, dt * 3);
  bgU.uMix.value += (1 - bgU.uMix.value) * Math.min(1, dt * 2); bgU.uC.value.x += (Wd.c[0] - bgU.uC.value.x) * Math.min(1, dt * 2); bgU.uC.value.y += (Wd.c[1] - bgU.uC.value.y) * Math.min(1, dt * 2);
  renderer.clear(); renderer.render(bgScene, bgCam); renderer.clearDepth(); renderer.render(mscene, camera);
  // labels for every component, decluttered
  const want = new Set();
  if (!(state.study && state.study.hideLabels)) Object.values(Wd._ctx.comps).forEach(nd => { if (!nd.anchor) return; tmpV.copy(nd.anchor).project(camera); if (tmpV.z > 1 || Math.abs(tmpV.x) > 1.05 || Math.abs(tmpV.y) > 1.05) return;
    const el = labelFor(nd); want.add(nd.id); el.hidden = false; el.classList.toggle('deeper', !!nd.micro); el._x = (tmpV.x * .5 + .5) * canvas.clientWidth; el._y = (-tmpV.y * .5 + .5) * canvas.clientHeight; });
  placeLabels(want);
  updateScaleBar(Wd.unit);
  if (bodyEntry && bodyEntry.center) { mmDot.setAttribute('cx', bodyEntry.center.x); mmDot.setAttribute('cy', -bodyEntry.center.y); mmSel.style.opacity = 0; } }
function placeLabels(want) {
  const placed = []; [...want].map(id => labelEls[id]).sort((a, b) => a._y - b._y).forEach(el => {
    const w = el.offsetWidth || 90, hh = (el.offsetHeight || 22) + 3; let y = el._y - hh;
    for (let n = 0; n < 12; n++) { const hit = placed.find(r => Math.abs(r.x - el._x) < (r.w + w) / 2 + 4 && Math.abs(r.y - y) < hh); if (!hit) break; y = hit.y + hh; }
    placed.push({x: el._x, y, w}); el.style.transform = `translate(${el._x}px,${y}px) translate(-50%,0)`; });
  Object.entries(labelEls).forEach(([id, el]) => { if (!want.has(id)) el.hidden = true; }); }

// ---------- the ladder and the scale bar ----------
const ladder = $('#ladder'), sbar = $('#scalebar');
LEVELS.forEach(([k, name, size]) => { const b = document.createElement('button'); b.className = 'rung'; b.dataset.level = k; b.innerHTML = `<span class="rung-name">${name}</span><span class="rung-size">${size}</span>`;
  b.onclick = () => ladderClick(k); ladder.appendChild(b); });
const deeperBtn = $('#btn-deeper'), upBtn = $('#btn-up');
deeperBtn.onclick = () => { const s = state.selected; if (s && s.micro) goDeeper(s); };
upBtn.onclick = () => goUp();
$('#btn-exit-micro').onclick = () => exitMicro(bodyEntry);
function curLevel() { if (state.mode === 'micro' && curW) return curW.level; return state.selected && state.selected.depth > 0 ? 'organ' : 'body'; }
function updateLadder() {
  const L = curLevel(), li = LEVEL_IX[L], s = state.selected;
  ladder.querySelectorAll('.rung').forEach(b => { const i = LEVEL_IX[b.dataset.level]; b.classList.toggle('here', i === li); b.classList.toggle('above', i < li);
    b.disabled = !(i < li || (i === li)); });
  const nextW = s && s.micro ? WORLDS[s.micro] : null;
  deeperBtn.disabled = !nextW; deeperBtn.querySelector('span').textContent = nextW ? 'Zoom into ' + nextW.name : (state.mode === 'micro' && s && !s.isWorld ? 'This is as deep as this part goes' : (s && s.depth > 0 && s.depth < 99 ? 'No deeper view for this part yet' : 'Select a part to zoom into'));
  upBtn.hidden = state.mode !== 'micro'; $('#btn-exit-micro').hidden = state.mode !== 'micro'; }
function ladderClick(level) {
  const li = LEVEL_IX[level];
  if (level === 'body') { if (state.mode === 'micro') exitMicro(BODY); else collapseAll(); return; }
  if (level === 'organ') { if (state.mode === 'micro') exitMicro(bodyEntry); return; }
  if (state.mode !== 'micro') return;
  // walk back up the stack to the deepest world at that level
  for (let i = mstack.length - 1; i >= 0; i--) if (LEVEL_IX[WORLDS[mstack[i]].level] <= li) { if (i === mstack.length - 1) { select(curW.node, false); flyMicro(curW.node); return; }
    mstack.length = i + 1; const w = WORLDS[mstack[i]]; zoomTransition(null, () => showWorld(w, w.node.parent, {instant: true}), -1); return; } }
function fmtLen(m) { if (m >= 1) return +m.toPrecision(2) + ' m'; if (m >= 1e-2) return +(m * 100).toPrecision(2) + ' cm'; if (m >= 1e-3) return +(m * 1e3).toPrecision(2) + ' mm';
  if (m >= 1e-6) return +(m * 1e6).toPrecision(2) + ' µm'; return +(m * 1e9).toPrecision(2) + ' nm'; }
function updateScaleBar(unit) {
  const d = camera.position.distanceTo(controls.target), visH = 2 * d * Math.tan(camera.fov * Math.PI / 360), pxPerUnit = canvas.clientHeight / visH;
  const target = 110 / pxPerUnit * unit, p = Math.pow(10, Math.floor(Math.log10(target))), n = target / p; const nice = (n >= 5 ? 5 : n >= 2 ? 2 : 1) * p;
  sbar.querySelector('.bar').style.width = Math.round(nice / unit * pxPerUnit) + 'px'; sbar.querySelector('.len').textContent = fmtLen(nice); }
