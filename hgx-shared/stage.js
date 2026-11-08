// The server's stage, from the rack's (nvl72-shared/stage.js): a pale warm studio, an environment of soft boxes, one
// sun with soft VSM shadows whose box follows the camera target, GTAO kept off the floor. The box is 0.444 m tall (the
// scene is in metres) but chapters 4-6 pull back to 9 boxes and a rack, so the shadow box grows with the view.
// frame(look, cam) poses the box, what stands around it and the overlays, and draws one frame.
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {C} from '../kit/ui.js';
import {buildChassis} from './chassis.js';
import {buildCluster} from './cluster.js';
import {buildOverlay} from './overlay.js';

const V3 = THREE.Vector3;
export const COL = {bg: C.bg, ground: '#e3e8eb', grid: '#cfd7dc', shadow: '#3f4f58'};

const GROUND_VERT = /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const GROUND_FRAG = /* glsl */ `uniform vec3 uG; uniform vec3 uM; uniform vec3 uBg; uniform vec3 uC; uniform float uR; varying vec3 vW;
  void main(){
    // a faint 600 mm grid (floor tiles) under the rack
    vec2 g = abs(fract(vW.xz / 0.6 + 0.5) - 0.5) * 0.6;
    float line = 1.0 - smoothstep(0.0, 0.004, min(g.x, g.y));
    vec3 col = mix(uG, uM, line * 0.35);
    float d = length(vW.xz - uC.xz);
    gl_FragColor = vec4(mix(col, uBg, smoothstep(uR * 0.4, uR, d)), 1.0);
  }`;

export function createStage({canvas}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.bg);
  scene.fog = new THREE.Fog(COL.bg, 20, 60);
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 120);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 8}));
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.65;
  gtao.updateGtaoMaterial({radius: 0.05, distanceExponent: 1.4, thickness: 0.12, scale: 1.0, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false});
  gtao.updatePdMaterial({lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16});
  class Toggle extends Pass {
    constructor(fn) {
      super();
      this.needsSwap = false;
      this.fn = fn;
    }
    render() {
      this.fn();
    }
  }
  const box = buildChassis();
  scene.add(box.root);
  const cluster = buildCluster(box.K, box.root);
  const over = buildOverlay(box);
  // the floor stays out of the AO
  const aoVis = (v) => () => {
    ground.visible = v;
    shade.visible = v;
  };
  composer.addPass(new Toggle(aoVis(false)));
  composer.addPass(gtao);
  composer.addPass(new Toggle(aoVis(true)));
  composer.addPass(new OutputPass());

  {
    const env = new THREE.Scene();
    env.background = new THREE.Color('#e6eaed');
    const box = (w, h, pos, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(1, 0.985, 0.96).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    box(24, 24, new V3(0, 28, 4), 2.3);
    box(6, 28, new V3(24, 8, 12), 3.0);
    box(6, 28, new V3(-24, 8, -8), 1.8);
    box(36, 4, new V3(0, 4, 28), 1.5);
    const g = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({color: '#cdd5da', side: THREE.DoubleSide}));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -2;
    env.add(g);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.02).texture;
    scene.environmentIntensity = 0.95;
    pm.dispose();
  }
  // the sun from the front-right and high: the box's shadow falls behind it, the lifted layers shade the trays
  const SUN_DIR = new V3(0.45, 0.82, 0.55).normalize();
  const sun = new THREE.DirectionalLight('#fbfcff', 2.1);
  sun.castShadow = true;
  let EXT = 2;
  const setExt = (e) => {
    EXT = e;
    Object.assign(sun.shadow.camera, {left: -e, right: e, top: e, bottom: -e, near: 0.1, far: 4 * e + 6});
    sun.shadow.camera.updateProjectionMatrix();
  };
  setExt(2);
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.radius = 6;
  sun.shadow.blurSamples = 16;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.002;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#f8fbfd', '#b9c4ca', 0.75));

  const groundMat = new THREE.ShaderMaterial({
    vertexShader: GROUND_VERT,
    fragmentShader: GROUND_FRAG,
    uniforms: {uG: {value: new THREE.Color(COL.ground)}, uM: {value: new THREE.Color(COL.grid)}, uBg: {value: new THREE.Color(COL.bg)}, uC: {value: new V3()}, uR: {value: 2}},
    toneMapped: false,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.0005;
  scene.add(ground);
  const shade = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.ShadowMaterial({color: COL.shadow, opacity: 0.22, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8}),
  );
  shade.rotation.x = -Math.PI / 2;
  shade.receiveShadow = true;
  scene.add(shade);

  const size = {w: 1600, h: 900};
  const resize = (w, h, pr) => {
    size.w = w;
    size.h = h;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const tmp = new V3();
  const right = new V3().crossVectors(new V3(0, 1, 0), SUN_DIR).normalize();
  const upL = new V3().crossVectors(SUN_DIR, right);
  let mapN = 4096;

  // look: box.update's {lifts, bezel, lidAway, ghost, hi, hiGpu, hiNvs}, cluster.update's {cluster, boxes, markers, nvK,
  // bars, rackK, rack} and overlay.update's {chapter, scene, sceneT, T, ...}; cam: {tx, ty, tz, az, el, d (radians,
  // metres), sx, sy} in world coordinates
  const frame = (look, cam) => {
    box.update(look);
    cluster.update(look);
    over.update(look);
    const {tx, ty, tz} = cam;
    camera.position.set(tx + cam.d * Math.cos(cam.el) * Math.sin(cam.az), ty + cam.d * Math.sin(cam.el), tz + cam.d * Math.cos(cam.el) * Math.cos(cam.az));
    camera.lookAt(tx, ty, tz);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    scene.fog.near = cam.d * 3;
    scene.fog.far = cam.d * 8;
    groundMat.uniforms.uC.value.set(tx, 0, tz);
    groundMat.uniforms.uR.value = Math.max(4, cam.d * 1.2);
    // the shadow box follows the target and grows with the view, snapped to its texels so it never shimmers
    const e = Math.min(3.6, Math.max(0.8, cam.d * 0.38));
    if (Math.abs(e - EXT) > 1e-6) setExt(e);
    const texel = (2 * EXT) / mapN;
    tmp.set(tx, ty, tz);
    const rr = Math.round(tmp.dot(right) / texel) * texel;
    const uu = Math.round(tmp.dot(upL) / texel) * texel;
    sun.target.position.copy(right).multiplyScalar(rr).addScaledVector(upL, uu).addScaledVector(SUN_DIR, tmp.dot(SUN_DIR));
    sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 2 * EXT + 3);
    sun.target.updateMatrixWorld();
    composer.render();
  };
  const pv = new V3();
  const project = (x, y, z) => {
    pv.set(x, y, z).project(camera);
    if (pv.z > 1) return null;
    return [(pv.x * 0.5 + 0.5) * size.w, (-pv.y * 0.5 + 0.5) * size.h];
  };
  const setQuality = ({samples, ao, shadow}) => {
    if (samples !== undefined)
      for (const t of [composer.renderTarget1, composer.renderTarget2]) {
        t.samples = samples;
        t.dispose();
      }
    if (ao !== undefined) gtao.enabled = ao;
    if (shadow !== undefined) {
      mapN = shadow;
      sun.shadow.mapSize.set(shadow, shadow);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
  };
  return {renderer, scene, camera, box, cluster, over, composer, gtao, sun, resize, frame, project, size, setQuality};
}
