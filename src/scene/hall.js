import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { panelCanvas, carpetCanvas, bandCanvas } from '../ornament.js';
import { createFilmMaterial } from '../film.js';

// Строит любой зал по данным из БД: кресла (pos_x/y/z), экран (центр screen_x/y, z=0),
// габариты комнаты и раскладку колонок speaker_layout.

const C = { brass: '#c9a04a', seatBase: '#17141d', arm: '#241a17' };

function tex(canvas, repeat = [1, 1]) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  return t;
}
function placed(geo, { x = 0, y = 0, z = 0, rx = 0, sx = 1 } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (sx !== 1) g.scale(sx, 1, 1);
  if (rx) g.rotateX(rx);
  g.translate(x, y, z);
  return g;
}

// Геометрии кресел по типу. Кресло смотрит на экран (в сторону -z).
function reclinerGeo(sx) {
  return mergeGeometries([
    placed(new RoundedBoxGeometry(0.6, 0.16, 0.66, 3, 0.06), { y: 0.46, sx }),
    placed(new RoundedBoxGeometry(0.6, 0.8, 0.2, 3, 0.08), { y: 0.9, z: 0.4, rx: 0.16, sx }),
    placed(new RoundedBoxGeometry(0.48, 0.2, 0.12, 3, 0.05), { y: 1.25, z: 0.38, rx: 0.16, sx }),
    placed(new RoundedBoxGeometry(0.56, 0.1, 0.22, 2, 0.04), { y: 0.36, z: -0.38, rx: -0.5, sx }),
  ]);
}
function chairGeo() {
  return mergeGeometries([
    placed(new RoundedBoxGeometry(0.46, 0.1, 0.44, 3, 0.04), { y: 0.43 }),
    placed(new RoundedBoxGeometry(0.48, 0.62, 0.09, 3, 0.04), { y: 0.8, z: 0.22, rx: 0.14 }),
  ]);
}
function sofaGeo() {
  return mergeGeometries([
    placed(new RoundedBoxGeometry(0.74, 0.18, 0.62, 3, 0.07), { y: 0.42 }),
    placed(new RoundedBoxGeometry(0.74, 0.62, 0.22, 3, 0.09), { y: 0.82, z: 0.32, rx: 0.12 }),
  ]);
}
function accessibleGeo() {
  // площадка для коляски: плоская плитка с бортиком, выбирается как место
  return mergeGeometries([
    placed(new RoundedBoxGeometry(0.62, 0.04, 0.7, 2, 0.015), { y: 0.02 }),
    placed(new RoundedBoxGeometry(0.62, 0.5, 0.06, 2, 0.02), { y: 0.25, z: 0.36 }),
  ]);
}

function wheelchairTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#2f6fd6'; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineWidth = 9; x.lineCap = 'round';
  x.beginPath(); x.arc(64, 26, 10, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.moveTo(60, 42); x.lineTo(58, 74); x.lineTo(86, 74); x.lineTo(96, 100); x.stroke();
  x.beginPath(); x.arc(58, 86, 24, 0.9, 5.2); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildHall(hall, seats) {
  const root = new THREE.Group();
  const disposables = [];
  const keep = (o) => { disposables.push(o); return o; };
  const vip = hall.category === 'vip';
  const sphera = hall.hall_number === 6;
  const W = Number(hall.room_width_m) || 16;
  const halfW = W / 2;
  const backZ = Number(hall.room_depth_m) || 18;
  const H = Number(hall.room_height_m) || 9;
  const frontZ = -0.9;
  const len = backZ - frontZ;
  const SCREEN = { w: Number(hall.screen_width_m), h: Number(hall.screen_height_m), cx: Number(hall.screen_x) || 0, cy: Number(hall.screen_y), z: Number(hall.screen_z) || 0 };

  // ---------- ступени амфитеатра ----------
  const rows = [];
  const byRow = new Map();
  seats.forEach((s) => { if (!byRow.has(s.row)) byRow.set(s.row, []); byRow.get(s.row).push(s); });
  [...byRow.keys()].sort((a, b) => a - b).forEach((r) => {
    const list = byRow.get(r);
    rows.push({ row: r, y: Math.min(...list.map((s) => s.y)), z: list.reduce((a, s) => a + s.z, 0) / list.length, seats: list });
  });
  const pitch = rows.length > 1 ? rows[1].z - rows[0].z : 1.2;

  const carpetMat = keep(new THREE.MeshStandardMaterial({ map: keep(tex(carpetCanvas(vip ? {} : { bg: '#1d1830', fg: '#2a2342' }), [W / 2.2, 1])), roughness: 0.95 }));
  const riserMat = keep(new THREE.MeshStandardMaterial({ color: '#101225', roughness: 0.9 }));
  const floorLen = rows[0].z - pitch / 2 - frontZ;
  const frontFloor = new THREE.Mesh(keep(new THREE.PlaneGeometry(W, floorLen)),
    keep(new THREE.MeshStandardMaterial({ map: keep(tex(carpetCanvas(), [W / 2.2, floorLen / 2.2])), roughness: 0.95 })));
  frontFloor.rotation.x = -Math.PI / 2;
  frontFloor.position.set(0, 0, frontZ + floorLen / 2);
  root.add(frontFloor);

  const nosingMat = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb25a').multiplyScalar(2.2) }));
  rows.forEach((r, i) => {
    const z0 = i === 0 ? r.z - pitch / 2 : (rows[i - 1].z + r.z) / 2;
    const z1 = i === rows.length - 1 ? backZ : (rows[i + 1].z + r.z) / 2;
    const h = r.y + 0.3;
    const box = new THREE.Mesh(keep(new THREE.BoxGeometry(W, h, z1 - z0)), [riserMat, riserMat, carpetMat, riserMat, riserMat, riserMat]);
    box.position.set(0, r.y - h / 2, (z0 + z1) / 2);
    root.add(box);
    if (i > 0 && r.y > rows[i - 1].y) {
      [-1, 1].forEach((s) => {
        const strip = new THREE.Mesh(keep(new THREE.BoxGeometry(1.2, 0.025, 0.03)), nosingMat);
        strip.position.set(s * (halfW - 0.8), r.y - 0.06, z0 - 0.005);
        root.add(strip);
      });
    }
  });

  // ---------- стены, потолок ----------
  const wallMat = keep(new THREE.MeshStandardMaterial({ color: vip ? '#1c2040' : '#221d38', roughness: 0.92 }));
  [-1, 1].forEach((s) => {
    const wall = new THREE.Mesh(keep(new THREE.PlaneGeometry(len, H + 1)), wallMat);
    wall.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;
    wall.position.set(s * halfW, H / 2 - 0.5, (frontZ + backZ) / 2);
    root.add(wall);
  });
  const backWall = new THREE.Mesh(keep(new THREE.PlaneGeometry(W, H + 1)), wallMat);
  backWall.rotation.y = Math.PI;
  backWall.position.set(0, H / 2 - 0.5, backZ);
  root.add(backWall);
  const frontWall = new THREE.Mesh(keep(new THREE.PlaneGeometry(W, H + 1)), keep(new THREE.MeshStandardMaterial({ color: '#08080d', roughness: 1 })));
  frontWall.position.set(0, H / 2 - 0.5, frontZ);
  root.add(frontWall);
  const ceiling = new THREE.Mesh(keep(new THREE.PlaneGeometry(W, len)), keep(new THREE.MeshStandardMaterial({ color: '#14172e', roughness: 1 })));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, H, (frontZ + backZ) / 2);
  root.add(ceiling);

  let stars = null;
  if (vip) {
    const n = Math.round(W * len * 1.6);
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      p[i * 3] = (Math.random() * 2 - 1) * (halfW - 0.3);
      p[i * 3 + 1] = H - 0.03;
      p[i * 3 + 2] = frontZ + 1 + Math.random() * (len - 1.5);
    }
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    stars = new THREE.Points(g, keep(new THREE.PointsMaterial({ color: new THREE.Color('#ffe6b8').multiplyScalar(1.6), size: 0.06 })));
    root.add(stars);
  }

  // ---------- панели с орнаментом, бра, LED ----------
  const panelMat = keep(new THREE.MeshStandardMaterial({ map: keep(tex(panelCanvas(vip ? {} : { bg: '#2b1a3a', accent: '#7a2a5a' }))), roughness: 0.85 }));
  const frameMat = keep(new THREE.MeshStandardMaterial({ color: C.brass, metalness: 0.8, roughness: 0.35 }));
  const sconceMat = keep(new THREE.MeshStandardMaterial({ color: '#2a2018', emissive: new THREE.Color('#ffc27a'), emissiveIntensity: 2.5 }));
  const ledLeft = keep(new THREE.MeshBasicMaterial({ color: 0x223355 }));
  const ledRight = keep(new THREE.MeshBasicMaterial({ color: 0x223355 }));
  const sconceLights = [];
  const panelH = Math.min(4.6, H * 0.45);
  const panelY = Math.max(panelH / 2 + 1.6, H * 0.52);
  const count = Math.max(2, Math.floor((backZ - 2) / 4.2));
  const step = (backZ - 2) / count;
  [-1, 1].forEach((s) => {
    const ledMat = s < 0 ? ledLeft : ledRight;
    for (let i = 0; i < count; i++) {
      const pz = 1.5 + step * (i + 0.5);
      const g = new THREE.Group();
      const panel = new THREE.Mesh(keep(new THREE.PlaneGeometry(panelH / 2, panelH)), panelMat);
      const frame = new THREE.Mesh(keep(new THREE.BoxGeometry(panelH / 2 + 0.16, panelH + 0.16, 0.06)), frameMat);
      frame.position.z = -0.04;
      const sconce = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.16, 0.08, 0.32, 16)), sconceMat);
      sconce.position.set(0, panelH / 2 + 0.45, 0.18);
      g.add(frame, panel, sconce);
      g.position.set(s * (halfW - 0.05), panelY, pz);
      g.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;
      root.add(g);
      if (i % 2 === 0 && sconceLights.length < 6) {
        const pl = new THREE.PointLight('#ffc27a', 9, 14, 1.6);
        pl.position.set(s * (halfW - 0.6), Math.min(H - 0.5, panelY + panelH / 2 + 0.6), pz + 1.5);
        root.add(pl);
        sconceLights.push(pl);
      }
      if (vip) {
        const led = new THREE.Mesh(keep(new THREE.BoxGeometry(0.05, panelH * 1.5, 0.12)), ledMat);
        led.position.set(s * (halfW - 0.04), panelY - 0.3, pz + step / 2);
        root.add(led);
      }
    }
    if (vip) {
      const line = new THREE.Mesh(keep(new THREE.BoxGeometry(0.05, 0.08, len - 1)), ledMat);
      line.position.set(s * (halfW - 0.04), Math.min(H - 0.6, panelY + panelH / 2 + 1.1), (frontZ + backZ) / 2 + 0.3);
      root.add(line);
    }
  });

  // ---------- экран ----------
  const filmMat = createFilmMaterial();
  keep(filmMat);
  const screen = new THREE.Mesh(keep(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h)), filmMat);
  screen.position.set(SCREEN.cx, SCREEN.cy, SCREEN.z);
  root.add(screen);
  const mask = new THREE.Mesh(keep(new THREE.BoxGeometry(SCREEN.w + 0.8, SCREEN.h + 0.8, 0.2)), keep(new THREE.MeshStandardMaterial({ color: '#050507', roughness: 1 })));
  mask.position.set(SCREEN.cx, SCREEN.cy, SCREEN.z - 0.12);
  root.add(mask);
  const band = keep(tex(bandCanvas(), [Math.max(1, Math.round(W / 6)), 1]));
  const stage = new THREE.Mesh(keep(new THREE.BoxGeometry(W, 0.55, 0.9)), [
    riserMat, riserMat, riserMat, riserMat,
    keep(new THREE.MeshStandardMaterial({ map: band, roughness: 0.6, emissive: '#ffffff', emissiveMap: band, emissiveIntensity: 0.25 })),
    riserMat,
  ]);
  stage.position.set(0, 0.275, SCREEN.z + 0.05);
  root.add(stage);
  const screenLight = new THREE.RectAreaLight('#ffffff', 0, SCREEN.w, SCREEN.h);
  screenLight.position.set(SCREEN.cx, SCREEN.cy, SCREEN.z + 0.05);
  screenLight.lookAt(SCREEN.cx, SCREEN.cy, 20);
  root.add(screenLight);

  // ---------- проектор и луч ----------
  const projPos = new THREE.Vector3(0, H - 0.6, backZ - 0.05);
  const win = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.8, 0.45)), keep(new THREE.MeshBasicMaterial({ color: new THREE.Color('#cfe0ff').multiplyScalar(2.5) })));
  win.position.copy(projPos); win.rotation.y = Math.PI;
  root.add(win);
  const target = new THREE.Vector3(SCREEN.cx, SCREEN.cy, SCREEN.z);
  const beamLen = projPos.distanceTo(target);
  const beamGeo = keep(new THREE.ConeGeometry(SCREEN.h * 0.72, beamLen, 4, 1, true));
  beamGeo.rotateY(Math.PI / 4);
  beamGeo.scale(SCREEN.w / SCREEN.h, 1, 1);
  beamGeo.translate(0, -beamLen / 2, 0);
  const beamMat = keep(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uOn: { value: 0 }, uColor: { value: new THREE.Color('#9fb8ff') } },
    vertexShader: `varying float vH; void main(){ vH = -position.y / ${beamLen.toFixed(3)}; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying float vH; uniform float uOn; uniform vec3 uColor; void main(){ float a = uOn * .045 * mix(1.4, .25, vH); gl_FragColor = vec4(uColor * a, 1.); }`,
  }));
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.copy(projPos);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), target.clone().sub(projPos).normalize());
  root.add(beam);

  // ---------- колонки ----------
  const speakers = [];
  const spkBody = keep(new THREE.MeshStandardMaterial({ color: '#15151c', roughness: 0.6 }));
  (hall.speaker_layout || []).forEach((sp) => {
    const glowMat = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffcf7a'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    const g = new THREE.Group();
    const pos = new THREE.Vector3(Number(sp.x), Number(sp.y), Number(sp.z));
    if (sp.z < 0 && sp.channel !== 'LFE') {
      // за экраном: виден только отсвет на полотне
      const glow = new THREE.Mesh(keep(new THREE.CircleGeometry(0.9, 32)), glowMat);
      glow.position.set(pos.x, pos.y, SCREEN.z + 0.03);
      g.add(glow);
    } else if (sp.channel === 'LFE') {
      const box = new THREE.Mesh(keep(new RoundedBoxGeometry(1.4, 0.8, 0.7, 2, 0.06)), spkBody);
      box.position.set(pos.x, 0.95, SCREEN.z + 0.85);
      const cone = new THREE.Mesh(keep(new THREE.CircleGeometry(0.28, 32)), glowMat);
      cone.position.set(pos.x, 0.95, SCREEN.z + 1.21);
      g.add(box, cone);
    } else {
      const top = pos.y > H - 0.6;
      const box = new THREE.Mesh(keep(new RoundedBoxGeometry(top ? 0.5 : 0.36, top ? 0.12 : 0.55, top ? 0.5 : 0.28, 2, 0.04)), spkBody);
      box.position.copy(pos);
      const face = new THREE.Mesh(keep(new THREE.CircleGeometry(0.13, 24)), glowMat);
      face.position.copy(pos);
      if (top) { face.rotation.x = Math.PI / 2; face.position.y -= 0.07; }
      else if (Math.abs(pos.x) > halfW - 0.5) { face.rotation.y = pos.x < 0 ? Math.PI / 2 : -Math.PI / 2; face.position.x += pos.x < 0 ? 0.15 : -0.15; }
      else { face.rotation.y = Math.PI; face.position.z -= 0.15; }
      g.add(box, face);
    }
    root.add(g);
    speakers.push({ ...sp, pos, glowMat });
  });

  // ---------- кресла ----------
  const pickGeo = keep(new THREE.BoxGeometry(1, 1.15, 0.8));
  pickGeo.translate(0, 0.58, 0.05);
  const pickMesh = new THREE.InstancedMesh(pickGeo, keep(new THREE.MeshBasicMaterial({ visible: false })), seats.length);
  const seatW = rows.length ? Math.min(...rows.map((r) => {
    const xs = r.seats.map((s) => s.x).sort((a, b) => a - b);
    let m = 9; for (let i = 1; i < xs.length; i++) m = Math.min(m, xs[i] - xs[i - 1]);
    return m;
  })) : 0.6;
  const uphMat = keep(new THREE.MeshPhysicalMaterial({ roughness: 0.78, sheen: 0.8, sheenRoughness: 0.45, sheenColor: new THREE.Color('#ffd7d7') }));
  const typeGeo = {
    premium: vip ? keep(reclinerGeo(Math.min(1.5, Math.max(0.9, seatW / 0.74)))) : keep(chairGeo()),
    standard: keep(chairGeo()),
    sofa: keep(sofaGeo()),
    accessible: keep(accessibleGeo()),
  };
  const groups = {};
  seats.forEach((s, i) => { (groups[s.type] ||= []).push(i); });
  const seatMeshes = {};
  const slot = new Array(seats.length);
  const m = new THREE.Matrix4();
  Object.entries(groups).forEach(([type, idx]) => {
    const mat = type === 'accessible' ? keep(new THREE.MeshStandardMaterial({ map: keep(wheelchairTexture()), roughness: 0.6 })) : uphMat;
    const mesh = new THREE.InstancedMesh(typeGeo[type] || typeGeo.standard, mat, idx.length);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(idx.length * 3).fill(1), 3);
    idx.forEach((si, k) => {
      const s = seats[si];
      m.makeTranslation(s.x, s.y, s.z);
      mesh.setMatrixAt(k, m);
      slot[si] = { mesh, k };
    });
    root.add(mesh);
    seatMeshes[type] = mesh;
  });
  seats.forEach((s, i) => {
    m.makeScale(Math.max(0.5, seatW * 0.95), 1, 1).setPosition(s.x, s.y, s.z);
    pickMesh.setMatrixAt(i, m);
  });
  root.add(pickMesh);

  // основания и подлокотники (не у диванов и мест для колясок)
  const chairIdx = seats.map((s, i) => i).filter((i) => seats[i].type === 'premium' || seats[i].type === 'standard');
  const baseMesh = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(vip ? 0.56 : 0.42, vip ? 0.36 : 0.32, vip ? 0.7 : 0.44)), keep(new THREE.MeshStandardMaterial({ color: C.seatBase, roughness: 0.6 })), Math.max(1, chairIdx.length));
  chairIdx.forEach((i, k) => { const s = seats[i]; m.makeTranslation(s.x, s.y + (vip ? 0.18 : 0.16), s.z + 0.04); baseMesh.setMatrixAt(k, m); });
  baseMesh.count = chairIdx.length;
  root.add(baseMesh);
  const arms = [];
  rows.forEach((r) => {
    const list = r.seats.filter((s) => s.type === 'premium' || s.type === 'standard').sort((a, b) => a.x - b.x);
    list.forEach((s, i) => {
      arms.push([s.x - seatW / 2, s.y, s.z]);
      const next = list[i + 1];
      if (!next || next.x - s.x > seatW * 1.3) arms.push([s.x + seatW / 2, s.y, s.z]);
    });
  });
  const armH = vip ? 0.6 : 0.56;
  const armMesh = new THREE.InstancedMesh(keep(new RoundedBoxGeometry(vip ? 0.13 : 0.07, vip ? 0.24 : 0.06, vip ? 0.8 : 0.46, 2, 0.03)), keep(new THREE.MeshStandardMaterial({ color: C.arm, roughness: 0.45 })), Math.max(1, arms.length));
  const cupMesh = new THREE.InstancedMesh(keep(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 16)), keep(new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9f45').multiplyScalar(2) })), Math.max(1, arms.length));
  arms.forEach(([x, y, z], i) => {
    m.makeTranslation(x, y + armH, z + 0.06); armMesh.setMatrixAt(i, m);
    m.makeTranslation(x, y + armH + (vip ? 0.125 : 0.035), z - 0.18); cupMesh.setMatrixAt(i, m);
  });
  armMesh.count = cupMesh.count = arms.length;
  root.add(armMesh, cupMesh);

  // ---------- зрители ----------
  const personGeo = keep(mergeGeometries([
    placed(new THREE.SphereGeometry(0.105, 18, 14), { y: vip ? 1.2 : 1.17, z: vip ? 0.24 : 0.14 }),
    placed(new RoundedBoxGeometry(0.42, 0.52, 0.24, 3, 0.1), { y: vip ? 0.82 : 0.78, z: vip ? 0.26 : 0.16, rx: 0.18 }),
  ]));
  const peopleMesh = new THREE.InstancedMesh(personGeo, keep(new THREE.MeshStandardMaterial({ color: '#1a1b26', roughness: 0.7 })), seats.length);
  peopleMesh.count = 0;
  root.add(peopleMesh);

  // ---------- маркеры выбранных мест ----------
  const markerGeo = keep(new THREE.OctahedronGeometry(0.16, 0));
  markerGeo.scale(1, 1.5, 0.35);
  const markerMat = keep(new THREE.MeshStandardMaterial({ color: C.brass, emissive: '#f0c060', emissiveIntensity: 1.6, metalness: 0.6, roughness: 0.3 }));
  const markers = Array.from({ length: 8 }, () => { const mk = new THREE.Mesh(markerGeo, markerMat); mk.visible = false; root.add(mk); return mk; });

  const hemi = new THREE.HemisphereLight('#4a5390', '#1b0f12', 0.5);
  const top = new THREE.DirectionalLight('#ffe2bd', 1);
  top.position.set(2, H + 10, backZ + 6);
  top.target.position.set(0, 0, backZ * 0.55);
  root.add(hemi, top, top.target);

  // точки обзора
  const midZ = backZ * 0.55;
  const overview = {
    pos: new THREE.Vector3(0, H + Math.max(3, backZ * 0.08), backZ + Math.max(6, backZ * 0.25)),
    target: new THREE.Vector3(0, rows.length ? rows[Math.floor(rows.length / 2)].y : 0, midZ),
  };

  return {
    root, SCREEN, room: { W, H, backZ, frontZ }, rows, overview,
    seatMeshes, slot, pickMesh, peopleMesh, markers, speakers,
    filmMat, screenLight, beamMat, stars, ledLeft, ledRight, ledReactive: sphera,
    sconceLights, sconceMat, hemi, top, vip,
    dispose() {
      disposables.forEach((d) => d.dispose?.());
      Object.values(seatMeshes).forEach((x) => x.dispose());
      [pickMesh, peopleMesh, baseMesh, armMesh, cupMesh].forEach((x) => x.dispose());
    },
  };
}
