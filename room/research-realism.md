# AI データホールを「写真にしか見えない」three.js で歩かせるための OSS 調査

調査日: 2026-11-08。スター数・最終更新は GitHub API（`gh api repos/...` の `stargazers_count` / `pushed_at`）の実測値。
three.js の最新リリースは **r187（2026-10-30）**。

> **ライセンス凡例**: 無印 = MIT / BSD / Apache-2.0 / CC0 / Zlib などの許容型。
> **⚠️ 印 = GPL・非商用・ライセンス無し・不明。配布物に混ぜる前に要確認。**

---

## 0. 先に結論（調べて分かった落とし穴 5 つ）

1. **three-gpu-pathtracer は WebGPU 専用になった。** v0.0.25（2026-09-28）で `WebGLPathTracer` は非推奨、「将来のリリースで削除」と CHANGELOG に明記。最新は v0.0.28（2026-11-02）で three.js r187 が必須。
2. **three.js の `lightMap` は「放射照度（irradiance）」として足し込まれ、拡散反射の計算で 1/π が掛かる**（`lights_fragment_maps` で `irradiance += lightMapTexel.rgb * lightMapIntensity`、`RE_IndirectDiffuse_Physical` で `irradiance * RECIPROCAL_PI * diffuseAlbedo`）。そのため Blender では **Combined ではなく Diffuse（Direct+Indirect、Color は切る）** で焼く。Combined だと色を二重に掛けてしまう。Blender と明るさを合わせるには `lightMapIntensity ≈ π` から始めて実測で詰める（この値は、上のシェーダーを読んで出した推論）。
3. **glTF に lightmap の標準拡張は無い。** Khronos の提案 PR #1017「Static lightmap textures」は 2019 年に close。後継の議論 #1658（FB_materials_modmap）は open のまま。Babylon.js の現行ローダーにも lightmap 拡張は無い（Extensions フォルダを確認）。ベンダー拡張の `NEEDLE_lightmaps` は Needle Engine 専用。
4. **gltf-transform の `optimize` は既定で `--prune-attributes true` `--simplify true` `--texture-size 2048` `--join true` `--palette true`。** lightmap を glTF の外から読み込む場合、どのテクスチャからも参照されない TEXCOORD_1 は消され、lightmap は 2048px に縮み、簡略化で UV1 が歪む。焼いたあとは `optimize` を使わず、個別コマンドを選ぶ。
5. **同じ形のラック 72 本をインスタンス化すると、ラックごとに違う lightmap を持てない。** 部屋の殻（床・壁・天井・トレイ・配管）は lightmap、ラックは「1 本分の AO テクスチャ（全ラック共有）＋ライトプローブ」で照らす、という分業が要る（ゲームエンジンで一般的な、静的物と繰り返し小物の分け方）。

---

## 1. Blender で照明を焼き込んで three.js に持っていく

### 1-1. 道具

| 名前 | URL | ライセンス | ★ | 最終更新 | 何に使えるか | 注意 |
|---|---|---|---|---|---|---|
| Blender 標準 Cycles Bake | https://docs.blender.org/manual/en/latest/render/cycles/baking.html （5.2 LTS マニュアル） | GPL（Blender 本体。焼いた画像には及ばない） | – | 5.2 LTS | 焼ける種類は Combined / AO / Shadow / Position / Normal / UV / Roughness / Emit / Environment / Diffuse / Glossy / Transmission。Diffuse には Direct・Indirect・Color の切り替えがある。出力先は「アクティブで選択中の Image Texture ノード」の画像。Margin は Extend / Adjacent Faces | 対象の Image Texture ノードがアクティブでない材質は焼かれない。どの UV を使うかはマニュアルに書いていない。焼く前に lightmap 用 UV をアクティブにし、1 オブジェクトで確かめてから全体を焼く。CLI では `blender -b scene.blend -P bake.py` で `bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT','INDIRECT'})` を回せる |
| ⚠️ **The Lightmapper**（Naxela） | https://github.com/Naxela/The_Lightmapper | ⚠️ **GPL-3.0**（LICENSE ファイル。ただし `__init__.py` の先頭には zlib 型の文言があり食い違う） | 822 | 2026-09-24 | Cycles で lightmap を自動で焼くアドオン。lightmap 用 UV の自動作成、オブジェクトごとの解像度、OIDN / OptiX でのデノイズ、32bit HDR 出力、OpenCV での後処理、バックグラウンド焼き。`bl_info` は Blender 5.1.0 / 0.7.0 | 道具なので、焼いた画像は GPL の対象にならない。ただしコードを改変して同梱・配布するなら GPL がかかる。README には「インストールは .zip から」とだけあり、wiki は COMING SOON。5.2 LTS での動作は未確認 |
| techinz/blender-batch-lightmap-baker | https://github.com/techinz/blender-batch-lightmap-baker | MIT | 27 | 2025-05-11 | 複数オブジェクトの lightmap を一括で焼く短いスクリプト（Combined / Diffuse / Glossy、UV の自動作成）。three.js 向けとうたっている | 小規模で 1 年以上更新なし。自前の `bake.py` を書くときの読み物として使う |
| glTF-Blender-IO（標準の glTF 出力） | https://github.com/KhronosGroup/glTF-Blender-IO | Apache-2.0 | 1,677 | 2026-11-05 | 出力オプション: **GPU Instances（`EXT_mesh_gpu_instancing`。同じメッシュデータを共有するオブジェクトが対象）**、Draco、**Meshopt**、画像の WebP・JPEG 化、**KTX2（Basis）画像の同時生成**、`KHR_texture_basisu`。焼いた AO は `glTF Material Output` ノードグループの `Occlusion` 入力につなぐと occlusionTexture として出る。UV の選択は UV Map ノードで指定する | lightmap の欄は無い。`EXT_mesh_gpu_instancing` の対象は「同じ親を持つ子で、子を持たないメッシュ」に限られ、材質を変えることはできない。上の機能一覧は main ブランチのドキュメントによる。5.2 LTS に同梱された版で同じかは要確認 |
| pmndrs/react-three-lightmap | https://github.com/pmndrs/react-three-lightmap | MIT | 158 | 2026-10-11 | ブラウザ内で lightmap / AO を焼く（R3F と素の three.js の両方に対応） | 品質は Cycles に及ばない。下見や確認用 |
| three.js `LightMapper` + `RayTracedRadiosity`（r187 の addon） | https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_lightmap_baking.html | MIT | – | r187 | ブラウザ内で three-mesh-bvh を使ったレイトレースでラジオシティを焼き、デノイズして UV アトラスに書き込む。`unwrapUVs()` で lightmap UV も作れる。スマホ向けに解像度の上限を下げる分岐がある | WebGPU 専用。焼いた結果を配布用ファイルとして固定する手順は自分で書く必要がある |

### 1-2. three.js 側で lightmap を読む作法（r187 のソースで確認）

- `GLTFLoader` は `TEXCOORD_1` を `uv1` 属性に入れ、テクスチャの `texCoord` を **`texture.channel`** に写す（GLTFLoader.js の `TEXCOORD_1: 'uv1'` と `texture.channel = mapDef.texCoord`）。
- `WebGLPrograms` は `lightMapUv` を `material.lightMap.channel` から決める。つまり **`lightMap.channel = 1` にすれば UV2 を使う**。昔の「`uv2` 属性を複製する」回避策はもう要らない。
- glTF で lightmap を運ぶ方法は 3 通りある。
  1. **emissive スロットを借りる（推奨）**: Blender で lightmap 画像を UV Map ノード（lightmap UV）経由で Emission につないで出力する。読み込み後に `m.lightMap = m.emissiveMap; m.emissiveMap = null; m.emissive.set(0)` と付け替える。`texCoord=1` は標準の glTF として運ばれるので、gltf-transform の prune でも消えない。
  2. **別ファイルで読む**: メッシュ名から lightmap のファイルを引き、`tex.flipY = false; tex.channel = 1;` を設定する（three.js フォーラムで定番の方法）。この場合、glTF 側では UV1 がどこからも参照されないので、gltf-transform に `--prune-attributes false` を付ける。
  3. **AO だけでよい場合**: `glTF Material Output` の `Occlusion` を使えば `aoMap` として標準で読める（R チャンネルのみ。lightmap の代わりにはならない）。
- HDR で持ちたいときは、three.js の `UltraHDRLoader`（JPEG ゲインマップ。軽い）か、`KTX2Loader` の Basis **UASTC HDR** に対応している（KTX2Loader.js に `UASTC_HDR` と `isBasisHDR` の分岐がある）。8bit で持つなら、露出を掛けて焼き、`lightMapIntensity` で戻す。
- three.js の公式サンプル `webgpu_materials_lightmap` は `lightMapIntensity` を GUI で動かすだけの最小例。

---

## 2. ブラウザでのパストレース（gkjohnson/three-gpu-pathtracer）

| 名前 | URL | ライセンス | ★ | 最終更新 | 何に使えるか | 注意 |
|---|---|---|---|---|---|---|
| three-gpu-pathtracer | https://github.com/gkjohnson/three-gpu-pathtracer | MIT | 2,033 | 2026-11-08（v0.0.28 は 2026-11-02） | `WebGPUPathTracer`（`three-gpu-pathtracer/webgpu`）で、カメラが止まっている間にサンプルを積んで写真品質に近づける。OIDN デノイザーと FSR アップスケーラーを同梱。`setSceneAsync` / `setBVHWorker` で BVH の構築をワーカーに逃がせる。`complete` / `progress` イベントで「完成」を UI に出せる | **WebGPU 必須**。`WebGLPathTracer` は非推奨で削除予定。材質は `MeshStandardMaterial` / `MeshPhysicalMaterial` のみ。Spot / Directional / Point ライトは MIS 有効時のみ。発光材質は MIS の対象外（LED 天井照明を発光面で作ると収束が遅い。RectAreaLight か「area light」で作る） |

**止まったら収束させ、動いている間は軽くする仕組み**（`src/webgpu/API.md` より）:
- `dynamicLowRes = true`（既定）で、カメラが動いている間は `lowResScale`（既定 0.1）の低解像度プレビューを出す。`adaptiveDynamicRes` は 1 フレームの予算（`frameBudget` / `targetFrameTime`）に合わせて解像度を自動で調整する。
- 止まると `renderDelay`（既定 16ms）待ってからフル解像度に切り替え、平均サンプル数が `minSamples` に達したら `fadeDuration`（既定 250ms）で切り替え表示する。`maxSamples` で打ち切ると `complete` が飛ぶ。
- **歩行中に通常のラスタ描画へ切り替える機能は内蔵されていない。** 歩くときは通常の `renderer.render()`（lightmap とポスト処理の絵）を出し、入力が N ms 止まったら `pathTracer.renderSample()` に切り替え、`fadeState` を使ってクロスフェードする。この部分は自前で書く。
- モバイル: WebGPU は iOS / iPadOS 26 の Safari と、Android 12 以上の Chrome 121 以降（Qualcomm / ARM の GPU）で使える（web.dev）。ただし、BVH・テクスチャアトラス・OIDN の重みを考えると、スマホでは既定で無効にし、デスクトップで WebGPU があるときだけ「写真モード」ボタンを出すのが安全。
- 関連サンプル: three.js 側の `webgpu_renderer_pathtracer`（ACES、Draco 付き glTF）。リポジトリ側にはデモ「Interior Scene w/ Equirect Rendering」がある。

---

## 3. 実時間の見た目を上げる後処理

| 名前 | URL | ライセンス | ★ | 最終更新 | 何に使えるか | 注意 |
|---|---|---|---|---|---|---|
| **three.js TSL ポスト処理ノード**（r187 の addon） | https://github.com/mrdoob/three.js/tree/dev/examples/jsm/tsl/display | MIT | 117,844 | 2026-11-07 | `ao()`（GTAONode）、`ssao()`、`ssr()`（SSRNode。サンプル `webgpu_postprocessing_ssr_denoise` あり）、`traa()`（TRAANode）、`ssgi()`（SSGINode）、`denoise()`、bloom、SMAA、TAAU アップスケール（`webgpu_upscaling_taau`） | `WebGPURenderer`（`three/webgpu`）が前提。WebGL2 フォールバック時にどこまで動くかはノードごとに実測が要る |
| three.js トーンマッピング | `webgl_tonemapping` / `webgpu_tonemapping` | MIT | – | r187 | `AgXToneMapping`、`NeutralToneMapping`、`ACESFilmicToneMapping`。公式サンプルは AO に Neutral、パストレースに ACES を使っている | 白い LED と黒いラックのように明暗差が大きい場面では、AgX のほうがハイライトが飛びにくい（一般的な傾向。実画で比較する） |
| pmndrs/postprocessing | https://github.com/pmndrs/postprocessing | Zlib（許容型） | 2,962 | 2026-11-01（v6.39.6） | WebGL 向けの EffectComposer。SMAA、SSAO、Bloom、ToneMapping（`AGX` と `NEUTRAL` のモードあり） | v6 系は保守中。peer は `three >=0.168 <0.188`。SSR と TAA は無い。v7 ブランチは開発中 |
| N8AO | https://github.com/N8python/n8ao | CC0-1.0 | 504 | 2026-08-10 | 時間方向に安定した SSAO。`N8AOPass`（three の Composer 用）と `N8AOPostPass`（pmndrs 用）がある。`setQualityMode` は Performance（モバイル向け）から Ultra、Neural まで。`halfRes` で 2〜4 倍速くなる | WebGL2 専用で、WebGPU は未対応（2.0 で予定）。r161 以上を推奨。AO を使うとハードウェア AA が効かないので SMAA を併用する |
| ⚠️（保守停止）realism-effects（0beqz） | https://github.com/0beqz/realism-effects | MIT | 1,747 | **2024-02-04** | SSGI、SSR、TRAA、モーションブラー、SSAO / HBAO | **最後の push が 2024-02、v2 ブランチも 2023-12 で停止。** README も「v2 を準備中」のまま。r187 での動作は未確認。新しく採用するのは避け、three.js 本体の TSL ノード（SSGI / SSR / TRAA）を使う |

**ライトプローブと反射（写真らしさに一番効く）**
- `LightProbeGrid`（WebGL 版と WebGPU 版がある。r187）: 照度ボリュームをブラウザ内で焼く（`probes.bake(renderer, scene, {...})`、バウンス数 0〜2）。サンプル `webgl_lightprobes_sponza` は FirstPersonControls で歩ける。インスタンス化したラックの間接光にちょうどよい。
- **ボックス投影キューブマップ（BPCEM）**: `webgpu_materials_envmaps_bpcem`。`pmremTexture(rt.texture, getParallaxCorrectNormal(reflectVector, size, pos))` で、室内の反射が部屋の形に沿う。磨いたコンクリート床や黒い鋼板が「部屋を映す」ようになる。キューブマップは Blender で焼いた等距円筒画像か、ページ読み込み時に CubeCamera で 1 回撮ったもの。
- ぼかした平面反射（`webgpu_reflection_blurred` / `webgpu_reflection_roughness`）: 床が 1 枚の平面なら SSR より安定する。

---

## 4. CC0 の素材

すべて **CC0**（Poly Haven・ambientCG とも）。下の ID は Poly Haven API（`api.polyhaven.com/assets`。テクスチャ 869 件中から抽出）と ambientCG API（`ambientcg.com/api/v2/full_json`）で実在を確認した。

| 用途 | 候補（URL） | メモ |
|---|---|---|
| 磨いた・きれいなコンクリート床 | Poly Haven **smooth_concrete_floor** https://polyhaven.com/a/smooth_concrete_floor ／ **garage_floor** https://polyhaven.com/a/garage_floor ／ **concrete_floor_worn_001** https://polyhaven.com/a/concrete_floor_worn_001 ／ **painted_concrete_02** https://polyhaven.com/a/painted_concrete_02 ／ ambientCG **Concrete016**（clean, light, smooth）https://ambientcg.com/a/Concrete016 ・**Concrete017**（clean, dark, smooth）・**Concrete042A**（smooth、AO あり）・**Concrete045**（industrial, modern） | 「磨き」の艶は素材集には無い。roughness を 0.15〜0.35 に下げ、ムラの roughness マップを掛け合わせて作る。実在の AI ホールはスラブ床（エポキシ・研磨コンクリート）が多い |
| 粉体塗装の黒い鋼板（ラック本体） | ambientCG **Metal027 / Metal028 / Metal029**（タグ: black, covered, painted, **powder**, steel）https://ambientcg.com/a/Metal027 | そのものの素材。metalness マップも付いている（粉体塗装は実際には非金属扱いが正しい。metalness は 0 寄りにする） |
| 穴あき扉（パンチングメタル） | ambientCG **SheetMetal001〜004**（perforated, stamped。**opacity マップ付き**）https://ambientcg.com/a/SheetMetal001 | 遠景は alpha テスト＋opacity マップで足りる。正面から近づく扉は、穴の向こうのサーバー前面（LED）が透けて見えることが写真らしさの決め手になる。扉は alphaTest（または alphaHash）にして、奥に機器の面を置く |
| ステンレス・アルミ配管 | ambientCG **Metal049A**（clean, silver, smooth）・**Metal009〜012**（brushed）・**Metal051A〜C**（aluminum, brushed）https://ambientcg.com/a/Metal049A | 円筒に UV を引き伸ばすとヘアラインの向きが出る |
| 黄色いワイヤーメッシュのケーブルトレイ | ambientCG **Fence006**（wiremesh、opacity 付き）https://ambientcg.com/a/Fence006 ・**MetalWalkway013**（grid、opacity 付き） | 近くから見るとテクスチャでは嘘が出る。**Blender で針金を Array モディファイアで本物の形にする**のが確実（トレイは 1 本作れば繰り返せる）。色は黄色の非金属で、AO を焼いておく |
| 縞鋼板・点検通路 | ambientCG **DiamondPlate001〜009**・**MetalWalkway001〜014** | 通路の端や機械室の扉まわりに |
| ゴム床・マット | ambientCG **Rubber001〜004**（black, floor）・Poly Haven **rubber_tiles** | 作業場所の目印に |
| 塗装鋼板（パネル） | Poly Haven **blue_metal_plate**（塗装、擦り傷）・**metal_plate**／ambientCG **PaintedMetal014**（grey）・**MetalPlates017A**（panels） | 壁の CRAH ユニットや分電盤の外装に |
| HDRI（反射の下地。屋内・人工照明） | Poly Haven **empty_warehouse_01**（fluorescent, concrete, industrial）https://polyhaven.com/a/empty_warehouse_01 ／ **bank_vault**（fluorescent, concrete）／ **unfinished_office_night**／ **small_empty_room_3**（led panel） | 閉じた部屋では HDRI は「つなぎ」にとどまる。最終的には、自分のホールを Blender で 360° レンダーした等距円筒画像を環境マップにするほうが反射が正しい |

---

## 5. 重さの対策

| 名前 | URL | ライセンス | ★ | 最終更新 | 何に使えるか | 注意 |
|---|---|---|---|---|---|---|
| glTF-Transform（CLI `gltf-transform`） | https://github.com/donmccurdy/glTF-Transform | MIT | 2,068 | 2026-10-20（v4.5.1） | `instance`（共有メッシュ → `EXT_mesh_gpu_instancing`）、`meshopt` / `draco`、`uastc` / `etc1s`（KTX2）、`webp` / `avif`、`resize`、`dedup`、`prune`、`weld`、`unwrap`（texcoord の生成）、`partition`（.bin の分割） | **`optimize` の既定値（prune-attributes・simplify・texture-size 2048・join・palette）が lightmap を壊す**。焼いたあとは `dedup → instance → meshopt → uastc（normal / ORM）→ etc1s（baseColor）` を個別に流す。KTX2 には KTX-Software（`toktx` / `ktx`）が別途必要 |
| meshoptimizer | https://github.com/zeux/meshoptimizer | MIT | 8,815 | 2026-10-14 | `EXT_meshopt_compression` のデコーダ（`MeshoptDecoder`）。three.js の GLTFLoader に `setMeshoptDecoder` で渡す | Draco よりデコードが速く、gzip / brotli と相性がよい |
| Draco | https://github.com/google/draco | Apache-2.0 | 7,546 | 2026-10-16 | 形状の圧縮率は高い | デコーダ（WASM）が重め。どちらか 1 つなら meshopt を推す |
| Basis Universal | https://github.com/BinomialLLC/basis_universal | Apache-2.0 | 3,141 | 2026-10-30 | KTX2 の ETC1S / UASTC / **UASTC HDR**。GPU メモリ上でも圧縮されたままなので、スマホのメモリ不足を防げる | 法線と lightmap は UASTC、色は ETC1S が目安 |
| KTX-Software | https://github.com/KhronosGroup/KTX-Software | ⚠️ NOASSERTION（主に Apache-2.0 だが、同梱物ごとにライセンスが混在） | 1,397 | 2026-11-07 | `toktx` / `ktx create` で KTX2 を作る | 道具として使うだけなら問題ないが、配布物に同梱するなら個別に確認 |

**ラック 72 本を軽くする**
- three.js の GLTFLoader は `EXT_mesh_gpu_instancing` を **`InstancedMesh`** にして返す（GLTFLoader.js の対応拡張一覧にある）。Blender の「GPU Instances」出力か、gltf-transform の `instance` で作る。72 本で描画呼び出し 1 回（材質ごとに 1 回）になる。
- ラックごとの違い（扉の開閉、LED の点滅位相、ケーブルの色）は、インスタンス属性（`InstancedBufferAttribute`）か `InstancedMesh.setColorAt` で付ける。形が違う種類が混ざるなら `BatchedMesh`（`webgl_instancing_performance` で比較できる）。
- lightmap とインスタンスは両立しない（落とし穴 5）。ラックは「共有の AO マップ＋`LightProbeGrid`＋床に焼いた影」で照らす。床の lightmap にはラックの影とラック間の照り返しが焼き込まれるので、見た目の大半は床が担う。

---

## 6. お手本（ソースが読めるもの）

| 名前 | URL | ライセンス | ★ / 更新 | 写真らしさの技法（1 行） |
|---|---|---|---|---|
| three.js `webgl_lightprobes_sponza` | https://threejs.org/examples/webgl_lightprobes_sponza.html | MIT | r187 | `LightProbeGrid` で照度ボリュームをブラウザ内で焼き、SunLight と Sky を合わせ、FirstPersonControls（WASD）で歩ける。間接光が付くだけで建物らしさが一気に出る見本 |
| three.js `webgpu_lightmap_baking` | https://threejs.org/examples/webgpu_lightmap_baking.html | MIT | r187 | three-mesh-bvh でラジオシティを焼き、デノイズして lightmap に書く。lightmap UV は `unwrapUVs()` で自動作成。ACES |
| three-gpu-pathtracer「Interior Scene」 | https://github.com/gkjohnson/three-gpu-pathtracer （examples） | MIT | ★2,033 / 2026-11 | 室内をパストレースで収束させ、デノイズとアップスケールで仕上げる。止まったときの「写真モード」の到達点を見る基準になる |
| ⚠️ Leonxlnx/casa-ocaso | https://github.com/Leonxlnx/casa-ocaso | ⚠️ NOASSERTION（ライセンス不明。読むだけにする） | ★32 / 2026-11-03 | r187 WebGPU の室内。VSM の柔らかい影＋**ビューごとに事前に焼いた LightProbeGrid（L2 SH・2 バウンス）**＋GTAO＋控えめな bloom＋ACES。参照画像と CIELAB で色を数値合わせし、動いている間は TAAU の動的解像度、止まるとフル解像度に戻す。`compare.py` で参照画像と並べて比較する作り方は、そのまま借りられる |
| ⚠️ brunosimon/my-room-in-3d | https://github.com/brunosimon/my-room-in-3d （live: https://my-room-in-3d.vercel.app） | ⚠️ **ライセンス無し**（GitHub 上 none。コードは読むだけ） | ★4,535 / 2023-09 | Blender で照明をすべて焼き込み、three.js では焼いた色をそのまま出す（照明計算なし）。軽くて綺麗だが、反射が動かないので金属には不向き。床とトレイの考え方の参考に |
| PlayCanvas engine examples | https://github.com/playcanvas/engine/tree/main/examples/src/examples （`lights-and-shadows/lights-baked`・`graphics/reflection-box`・`camera-frame/taa`・`camera-frame/ambient-occlusion`・`camera-frame/auto-exposure`・`camera/first-person`） | MIT | ★17,238 / 2026-11-08 | 実行時の lightmapper、ボックス投影の反射、TAA・SSAO・自動露出、一人称カメラが揃っている。three.js で同じ構成を組むときの設計の手本 |
| （参考）Babylon.js | https://github.com/BabylonJS/Babylon.js | Apache-2.0 | ★26,305 | PBR に `lightmapTexture` と `coordinatesIndex = 1` がある。glTF ローダーは `EXT_lights_area` / `EXT_lights_ies` / `EXT_lights_image_based` に対応している。lightmap 拡張は無い |
| ⚠️ Needle Engine（Blender / Unity → three.js） | https://github.com/needle-tools/needle-engine-support | ⚠️ **無料は非商用のみ。商用は有料の Pro が必要**（公式 FAQ） | ★609 / 2026-11-07 | Blender から lightmap を `NEEDLE_lightmaps` 拡張で出し、three.js で読む一式がある。仕組みの参考にはなるが、依存させると商用時に費用がかかる |

---

## 7. 一人称で歩く

| 名前 | URL | ライセンス | ★ | 最終更新 | 何に使えるか | 注意 |
|---|---|---|---|---|---|---|
| three.js `PointerLockControls` | https://threejs.org/examples/misc_controls_pointerlock.html | MIT | – | r187 | PC でマウスで視点を回し、WASD で歩く | Pointer Lock はタッチ端末で使えない前提で、スマホには別の入力を用意する |
| three.js `games_fps`（`Octree` + `Capsule`） | https://threejs.org/examples/games_fps.html | MIT | – | r187 | 当たり判定の最小構成（カプセルと八分木） | 大きな glb をそのまま Octree に入れると構築が重い。衝突用には簡単な代理メッシュを使う |
| three-mesh-bvh | https://github.com/gkjohnson/three-mesh-bvh | MIT | 3,558 | 2026-11-06（v0.9.18） | `characterMovement` / `objectbvh_characterMovement` のサンプルで、カプセルと BVH の衝突・坂・段差を扱う。床をタップした位置を `raycast` で取るのも速い | 衝突用は「床・ラック列の箱・柱・壁」だけの代理メッシュで十分（数百ポリゴン） |
| nipplejs | https://github.com/yoannmoinet/nipplejs | MIT | 1,953 | 2026-05-26 | スマホの仮想ジョイスティック（左手で移動、右側のドラッグで視点） | – |
| yomotsu/camera-controls | https://github.com/yomotsu/camera-controls | MIT | 2,448 | 2026-10-21 | タップした地点への滑らかな移動（`setLookAt(..., true)`）。スマホの「タップで移動」と相性がよい | 一人称の歩行そのものは自前で書く |
| pmndrs/ecctrl | https://github.com/pmndrs/ecctrl | MIT | 814 | 2026-09-06 | 物理ベースのキャラクター操作 | React Three Fiber と Rapier が前提。素の three.js には持ち込みにくい |

スマホの操作は「床をタップするとその地点へ歩く（camera-controls で補間し、three-mesh-bvh で床を判定）＋1 本指ドラッグで視点」が一番迷わない。慣れた人向けにジョイスティックを切り替えで出す。

---

## 8. 一段上の案（本人が挙げていない選択肢）

**Cycles の絵をそのまま 3D ガウシアンスプラットにする。** Blender のホールを Cycles で数百視点レンダーし、Brush（https://github.com/ArthurBrussee/brush 、Apache-2.0、★5,265、Mac で学習できる）か gsplat（https://github.com/nerfstudio-project/gsplat 、Apache-2.0、★5,872）で学習する。表示は Spark（https://github.com/sparkjsdev/spark 、MIT、★3,885、three.js に統合でき、低性能のスマホでも速いとうたっている）で行う。床や鋼板の映り込みまで Cycles と同じ見た目になり、「写真にしか見えない」に最短で届く。
弱点: 学習した視点の範囲の外では崩れる（歩ける範囲を通路に絞る）、当たり判定と LED の点滅は別のメッシュで重ねる、容量が数十 MB になる。⚠️ 元祖の graphdeco-inria/gaussian-splatting は研究用の非商用ライセンスなので使わない。
→ メッシュの本線（下）で作り、要所 1 か所（ホール入口の見せ場）だけスプラットを試す、という比較から入るのが安全。

---

## 推す作り方（パイプライン）

1. **Blender で実寸のモデルを作り、繰り返す物は共有メッシュにする。** ラック・トレイ・照明器具は「同じメッシュデータの複製（Alt+D）」にする。そうすると glTF の GPU Instances と gltf-transform の `instance` で、three.js の `InstancedMesh` にそのまま変わる。素材は ambientCG（Metal027–029、SheetMetal001–004、Concrete016/017）と Poly Haven（smooth_concrete_floor）の CC0 で揃える。
2. **照明は「殻＝lightmap、ラック＝AO＋プローブ」に分ける。** 床・壁・天井・トレイ・配管の殻にだけ UV2（lightmap UV）を引き、`blender -b -P bake.py` で Cycles の **Diffuse（Direct+Indirect、Color 切り）** を 32bit EXR に焼いて OIDN でデノイズする。three.js の lightMap は放射照度として扱われ、材質の色が後から掛かるため、Combined で焼くと色が二重になる。
3. **lightmap は emissive スロットに載せて glTF に出す。** 読み込み後に `lightMap` へ付け替え、`channel=1`・`lightMapIntensity≈π` から実測で合わせる。標準の拡張が無くても、`texCoord=1` が正規の glTF として運ばれ、gltf-transform に消されない。HDR は UltraHDR か KTX2 UASTC HDR にする。
4. **圧縮は `optimize` を使わず、個別コマンドで流す。** `dedup → instance → meshopt → uastc（法線・lightmap）→ etc1s（色）` とする。既定の prune / simplify / 2048px への縮小 / join が、lightmap の UV と解像度を壊すため。
5. **描画は three.js r187 の `WebGPURenderer`（WebGL2 フォールバックあり）に、`LightProbeGrid`（ラックの間接光）、ボックス投影キューブマップ（床と鋼板の映り込み。ホール自体を 360° レンダーした画像から作る）、TSL の `ao`（GTAO）+ `traa` + 控えめな bloom（LED）、AgX または Neutral のトーンマッピングを組み合わせる。** realism-effects は 2024-02 で止まっているので、本体のノードを使う。
6. **スマホ向けの段階を最初から決めておく。** DPR は 1.5 まで、SSR と SSGI は切り、GTAO は半解像度にする。見た目の大半を焼き込み（lightmap と AO）に持たせておけば、後処理を落としても「写真らしさ」が残る。
7. **止まったときだけ `WebGPUPathTracer` で「写真モード」に切り替える**（デスクトップかつ WebGPU があるときのみ。`dynamicLowRes` と `fadeDuration` で切り替え表示し、`complete` で完成表示）。歩いている間はラスタで描く。WebGL 版は削除予定なので WebGPU 前提で組む。
8. **合否は外の基準で決める。** 同じカメラ位置の Cycles レンダーを正解画像にし、ブラウザのスクリーンショットと並べて差を見る（casa-ocaso の `compare.py` 方式）。歩行は PC が PointerLockControls、スマホが「タップで移動＋ドラッグで視点」。当たり判定は three-mesh-bvh のカプセルと、数百ポリゴンの代理メッシュで取る。

---

### 未確認として残したもの
- Blender 5.2 LTS の Cycles Bake が、どの UV マップ（アクティブ / レンダー用）を使うか（マニュアルに記載なし。1 オブジェクトで実測する）。
- 5.2 LTS に同梱された glTF 出力が、main ブランチのドキュメントにある Meshopt と KTX2 の同時生成に対応しているか。
- TSL のポスト処理ノード（GTAO / SSR / TRAA / SSGI）が WebGL2 フォールバックで動くか。
- The Lightmapper が 5.2 LTS で動くか（`bl_info` は 5.1.0）。
- `lightMapIntensity ≈ π` はシェーダーを読んで出した推論。実画で合わせる。
