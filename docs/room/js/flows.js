// 流れの重ね: flows.path に沿った半透明の管と流れる粒。
// glb の深度（world.depthRT）と比べ、物の向こう側に回った所は隠す。配管の中を通る線は見えるよう少し余裕を持たせる。
import * as THREE from 'three';

export const CHAPTERS = Object.freeze({
  data: {label: 'データ', kinds: ['data']},
  power: {label: '電気', kinds: ['power']},
  heat: {label: '熱', kinds: ['liquid-cold', 'liquid-warm']},
});
const STYLE = Object.freeze({
  'liquid-cold': {color: '#7fcdd2', r: 0.06},
  'liquid-warm': {color: '#0b6f75', r: 0.06},
  data: {color: '#0f9fa8', r: 0.035},
  power: {color: '#0f9fa8', r: 0.045},
});
const SPEED = 0.55, GAP = 0.32, TOL = 0.25;

const depthChunk = /* glsl */`
  #include <packing>
  uniform sampler2D depthTex; uniform vec2 resolution; uniform float cNear; uniform float cFar; uniform float tol;
  varying float vViewZ;
  bool hidden() {
    float d = texture2D(depthTex, gl_FragCoord.xy / resolution).x;
    if (d >= 1.0) return false;
    float sceneZ = perspectiveDepthToViewZ(d, cNear, cFar);
    return -vViewZ > -sceneZ + tol;
  }`;

function uniformsFor(world, color, opacity) {
  return {
    color: {value: new THREE.Color(color)}, opacity: {value: opacity},
    depthTex: {value: world.depthRT.depthTexture}, resolution: {value: new THREE.Vector2(1, 1)},
    cNear: {value: world.camera.near}, cFar: {value: world.camera.far}, tol: {value: TOL},
  };
}

function tubeMaterial(world, color) {
  return new THREE.ShaderMaterial({
    uniforms: uniformsFor(world, color, 0.5),
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: /* glsl */`
      varying float vViewZ; varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewZ = mv.z; vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 color; uniform float opacity; varying vec3 vN; varying vec3 vV;
      ${depthChunk}
      void main() {
        if (hidden()) discard;
        float rim = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        gl_FragColor = vec4(color, opacity * mix(0.55, 1.0, rim));
        #include <colorspace_fragment>
      }`,
  });
}

function dotMaterial(world, color) {
  return new THREE.ShaderMaterial({
    uniforms: {...uniformsFor(world, color, 0.95), size: {value: 0.07}},
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: /* glsl */`
      uniform float size; uniform vec2 resolution; varying float vViewZ;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewZ = mv.z;
        gl_Position = projectionMatrix * mv;
        gl_PointSize = size * projectionMatrix[1][1] * resolution.y * 0.5 / -mv.z;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 color; uniform float opacity;
      ${depthChunk}
      void main() {
        vec2 c = gl_PointCoord - 0.5; float r = length(c);
        if (r > 0.5 || hidden()) discard;
        float edge = 1.0 - smoothstep(0.32, 0.5, r);
        vec3 col = mix(vec3(1.0), color, smoothstep(0.0, 0.3, r));   // 芯を少し白く
        gl_FragColor = vec4(col, opacity * edge);
        #include <colorspace_fragment>
      }`,
  });
}

// 折れ線の角を小さく丸めた曲線
function polyCurve(points, round = 0.15) {
  const path = new THREE.CurvePath();
  let start = points[0].clone();
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (i === points.length - 1) { path.add(new THREE.LineCurve3(start, p.clone())); break; }
    const n = points[i + 1];
    const r = Math.min(round, p.distanceTo(start) / 2, p.distanceTo(n) / 2);
    const a = p.clone().add(start.clone().sub(p).setLength(r));
    const b = p.clone().add(n.clone().sub(p).setLength(r));
    if (a.distanceTo(start) > 1e-4) path.add(new THREE.LineCurve3(start, a));
    path.add(new THREE.QuadraticBezierCurve3(a, p.clone(), b));
    start = b;
  }
  return path;
}

function makeFlow(world, flow) {
  const st = STYLE[flow.kind] ?? STYLE.data;
  const curve = polyCurve(flow.points);
  const len = curve.getLength();
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(16, Math.ceil(len * 24)), st.r, 16, false),
    tubeMaterial(world, st.color));
  tube.renderOrder = 20;
  const n = Math.max(2, Math.floor(len / GAP));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const dots = new THREE.Points(geo, dotMaterial(world, st.color));
  dots.renderOrder = 21;
  dots.frustumCulled = false;
  const group = new THREE.Group();
  group.add(tube, dots);
  group.visible = false;
  group.userData = {kind: flow.kind, id: flow.id};
  const tmp = new THREE.Vector3();
  const place = (t) => {
    const arr = geo.attributes.position.array;
    for (let i = 0; i < n; i++) {
      const u = (((i * GAP + t * SPEED) % len) + len) % len / len;
      curve.getPointAt(u, tmp);
      arr[i * 3] = tmp.x; arr[i * 3 + 1] = tmp.y; arr[i * 3 + 2] = tmp.z;
    }
    geo.attributes.position.needsUpdate = true;
  };
  place(0);
  return {group, place, mats: [tube.material, dots.material]};
}

export function createFlows(world, data, {reduced}) {
  const items = data.flows.map((f) => makeFlowSafe(world, f)).filter(Boolean);
  items.forEach((it) => world.overlay.add(it.group));
  let chapter = null, t = 0;
  const res = new THREE.Vector2();
  return {
    get chapter() { return chapter; },
    get visible() { return chapter !== null && items.some((it) => it.group.visible); },
    setChapter(ch) {
      chapter = ch && CHAPTERS[ch] ? ch : null;
      const kinds = chapter ? CHAPTERS[chapter].kinds : [];
      items.forEach((it) => { it.group.visible = kinds.includes(it.group.userData.kind); });
    },
    update(dt) {
      if (chapter === null) return;
      world.renderer.getDrawingBufferSize(res);
      if (!reduced) t += dt;
      items.forEach((it) => {
        if (!it.group.visible) return;
        it.place(t);
        it.mats.forEach((m) => { m.uniforms.resolution.value.copy(res); });
      });
    },
  };
}

function makeFlowSafe(world, f) {
  try { return makeFlow(world, f); } catch (e) { console.error(`流れ ${f.id} を作れません`, e); return null; }
}
