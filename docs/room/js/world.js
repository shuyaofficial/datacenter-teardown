// 描画の土台: 焼いた glb（MeshBasicMaterial）、床の映り込み、360° 写真の球、流れ用の深度。
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {yawDir} from './data.js';

export const GLB_LAYER = 2;          // 深度だけを描く下書き用
const PANO_R = 40;

const FloorReflectShader = {
  name: 'FloorReflect',
  uniforms: {
    color: {value: null}, tDiffuse: {value: null}, textureMatrix: {value: null},
    strength: {value: 0.16}, blur: {value: 0.006},
  },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix;
    varying vec4 vUv; varying vec3 vWorld;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float strength; uniform float blur;
    varying vec4 vUv; varying vec3 vWorld;
    void main() {
      vec2 uv = vUv.xy / vUv.w;
      // 磨いたコンクリートのぼやけた映り込み（13 タップ）
      vec3 acc = texture2D(tDiffuse, uv).rgb; float n = 1.0;
      for (int i = 0; i < 12; i++) {
        float a = float(i) * 2.39996; float r = blur * sqrt(float(i + 1) / 12.0);
        acc += texture2D(tDiffuse, uv + r * vec2(cos(a), sin(a))).rgb; n += 1.0;
      }
      vec3 v = normalize(cameraPosition - vWorld);
      // 奥の床（視線が床すれすれ）で強くなりすぎないよう、上限を抑えて 3 m 先から薄める
      float fres = 0.3 + 0.45 * pow(1.0 - clamp(v.y, 0.0, 1.0), 5.0);
      float fade = 1.0 - smoothstep(3.0, 10.0, distance(cameraPosition.xz, vWorld.xz));
      gl_FragColor = vec4(acc / n, strength * fres * fade);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

function makeRenderer(dpr) {
  const r = new THREE.WebGLRenderer({antialias: true, powerPreference: 'high-performance'});
  r.setPixelRatio(dpr);
  r.setSize(innerWidth, innerHeight);
  r.toneMapping = THREE.AgXToneMapping;
  r.outputColorSpace = THREE.SRGBColorSpace;
  document.body.prepend(r.domElement);
  return r;
}

async function loadGlb(url, scale) {
  // デコーダの場所は importmap の three/addons/ から取る（開発とサイトで置き場所が違うため）
  let dracoPath = '../vendor/three/examples/jsm/libs/draco/';
  try { dracoPath = new URL('libs/draco/', import.meta.resolve('three/addons/')).href; } catch { /* 古いブラウザは既定の場所 */ }
  const draco = new DRACOLoader().setDecoderPath(dracoPath);
  const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync(url);
  const k = 1 / scale;
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const map = o.material.map;
    if (map) { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; }
    o.material = new THREE.MeshBasicMaterial({map, color: new THREE.Color(k, k, k), name: o.material.name});
    o.layers.enable(GLB_LAYER);
  });
  gltf.scene.updateMatrixWorld(true);
  draco.dispose();
  return gltf.scene;
}

// 名前 floor_reflect、無ければ床の高さにある一番広い水平面
export function findFloor(root) {
  let named = null, best = null, bestArea = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name === 'floor_reflect' || o.material.name === 'floor_reflect') named = o;
    const b = new THREE.Box3().setFromObject(o);
    const flat = b.max.y - b.min.y < 0.05 && b.max.y < 0.2;
    const area = (b.max.x - b.min.x) * (b.max.z - b.min.z);
    if (flat && area > bestArea) { best = o; bestArea = area; }
  });
  return named ?? best;
}

function makeReflector(floor, renderer, hide) {
  const b = new THREE.Box3().setFromObject(floor);
  const size = b.getSize(new THREE.Vector3());
  const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
  const ref = new Reflector(new THREE.PlaneGeometry(size.x, size.z), {
    shader: FloorReflectShader, clipBias: 0.003, multisample: 0,
    textureWidth: Math.round(buf.x / 2), textureHeight: Math.round(buf.y / 2),
  });
  ref.material.transparent = true;
  ref.material.depthWrite = false;
  ref.rotation.x = -Math.PI / 2;
  ref.position.set((b.min.x + b.max.x) / 2, b.max.y + 0.002, (b.min.z + b.max.z) / 2);
  ref.renderOrder = 1;
  const base = ref.onBeforeRender;
  ref.onBeforeRender = function (r, s, c) {
    const shown = hide.map((o) => o.visible);
    hide.forEach((o) => { o.visible = false; });
    base.call(this, r, s, c);
    hide.forEach((o, i) => { o.visible = shown[i]; });
  };
  return ref;
}

function makePanoSphere(order) {
  const geo = new THREE.SphereGeometry(PANO_R, 96, 48);
  geo.scale(-1, 1, 1);
  const mat = new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = order;
  mesh.visible = false;
  mesh.frustumCulled = false;
  return mesh;
}

export async function createWorld({data, ev, dpr, photoOnly}) {
  const renderer = makeRenderer(dpr);
  renderer.toneMappingExposure = Math.pow(2, ev);
  if (data.tone?.glsl) {
    // Blender 5.2 の AgX は three の AgX と曲線が違う。stations.json の曲線で Cycles の絵に合わせる（露出は曲線に込み）
    THREE.ShaderChunk.tonemapping_pars_fragment = THREE.ShaderChunk.tonemapping_pars_fragment.replace(
      /vec3 CustomToneMapping\( vec3 color \) \{[^}]*\}/, data.tone.glsl);
    renderer.toneMapping = THREE.CustomToneMapping;
    renderer.toneMappingExposure = 1;
  }
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeef1f3);
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.05, 200);
  const overlay = new THREE.Group();            // 流れ・床の印（映り込みには入れない）
  const panos = [makePanoSphere(10), makePanoSphere(11)];
  scene.add(overlay, ...panos);

  const texCache = new Map();
  const loadTex = (url) => {
    if (!texCache.has(url)) {
      texCache.set(url, new THREE.TextureLoader().loadAsync(url).then((t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = renderer.capabilities.getMaxAnisotropy();
        renderer.initTexture(t);
        return t;
      }));
    }
    return texCache.get(url);
  };

  let glb = null, reflector = null;
  const ensureGlb = async () => {
    if (glb) return glb;
    glb = await loadGlb(data.glbUrl, data.scale);
    scene.add(glb);
    if (photoOnly) {
      glb.visible = false;   // 写真モードでは深度にしか使わない
    } else {
      const floor = findFloor(glb);
      if (floor) { reflector = makeReflector(floor, renderer, [overlay, ...panos]); scene.add(reflector); }
    }
    return glb;
  };

  // 流れを隠すための glb の深度（写真モードでも同じ視点で描く）
  const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
  const depthRT = new THREE.WebGLRenderTarget(buf.x, buf.y, {depthTexture: new THREE.DepthTexture(buf.x, buf.y)});
  const depthMat = new THREE.MeshBasicMaterial({colorWrite: false});
  const renderDepth = () => {
    if (!glb) return;
    const vis = glb.visible; glb.visible = true;
    const layers = camera.layers.mask;
    camera.layers.set(GLB_LAYER);
    scene.overrideMaterial = depthMat;
    const bg = scene.background; scene.background = null;
    renderer.setRenderTarget(depthRT); renderer.clear(); renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    scene.background = bg; scene.overrideMaterial = null;
    camera.layers.mask = layers; glb.visible = vis;
  };

  // 球を地点に置き、写真の中央がその地点の yaw を向くように回す
  const placePano = async (i, station) => {
    const tex = await loadTex(station.panoUrl);
    const m = panos[i];
    m.material.map = tex; m.material.needsUpdate = true;
    m.position.copy(station.v);
    m.rotation.set(0, THREE.MathUtils.degToRad(station.yaw + 180), 0);
    m.userData.station = station.id;
    return m;
  };
  const setPanoOpacity = (i, a) => {
    const m = panos[i];
    m.material.opacity = a;
    m.visible = a > 0.001;
  };

  const resize = () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    const b = renderer.getDrawingBufferSize(new THREE.Vector2());
    depthRT.setSize(b.x, b.y);
    reflector?.getRenderTarget().setSize(Math.round(b.x / 2), Math.round(b.y / 2));
  };
  addEventListener('resize', resize);

  const view = {yaw: 0, pitch: 0, quat: null};   // quat があれば（傾け操作）それが勝つ
  const applyView = () => {
    if (view.quat) { camera.quaternion.copy(view.quat); return; }
    const p = THREE.MathUtils.degToRad(view.pitch);
    const d = yawDir(view.yaw).multiplyScalar(Math.cos(p)); d.y = Math.sin(p);
    camera.up.set(0, 1, 0);
    camera.lookAt(camera.position.clone().add(d));
  };

  const render = (needDepth) => {
    applyView();
    camera.updateMatrixWorld();
    if (needDepth) renderDepth();
    renderer.render(scene, camera);
  };

  return {
    renderer, scene, camera, overlay, panos, view, depthRT,
    ensureGlb, get glb() { return glb; }, get reflector() { return reflector; },
    loadTex, placePano, setPanoOpacity, render,
  };
}
