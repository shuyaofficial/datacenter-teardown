# AI データホールの部屋ツアー — 実装の依頼書

数値の正本は `room/refs.md`。食い違ったら refs.md が勝つ。気づいたら直さずに報告する。
調べた資料: `room/research-hall.md`（部屋・液冷・電源・見た目）、`room/research-realism.md`（ブラウザで写真らしく見せる OSS）。

## 何を作るか（成功の定義）
AI データセンターに詳しくない人が、部屋を歩いて「中はこうなっていて、質問1回でデータ・電気・熱がこう流れる」と分かること。
**最優先は見た目のリアルさ**。イラスト感・3D感を出さない。写真にしか見えない絵を目標にする（本人の注文）。
合否は「同じ視点の Blender（Cycles）の絵」と並べて、本人が判定する。自分の採点で合格にしない。

## 全体の構成
1. **Blender で部屋を作る（正）**: `room-blender/build_room.py`（Python で形と質感を作る。画像素材は使わない。今は試作）。
2. **Blender から3つを書き出す**:
   - 焼き込み済みの glb（PC で歩く用）
   - 地点ごとの 360° 写真（スマホで歩く用・PC の停止時用）
   - 説明ページ用の静止画
3. **ブラウザ** `room-web/`: PC は3Dで歩き、地点で止まると同じ位置の 360° 写真へ切り替わる。スマホは 360° 写真で地点から地点へ歩く（傾けて見回せる）。

## 地点（6つ。名前は id）
| id | 場所 | 何を見せるか |
|---|---|---|
| `cold-in` | 冷たい通路の入口 | 部屋の全景。ラックの正面、天井の3段 |
| `cold-mid` | 冷たい通路の中ほど、NVL72 の前 | 計算トレイの前面と光ファイバ |
| `net` | ネットワークラックの前 | ラックとラックをつなぐスイッチ（Quantum-X800 など）。ラック最上段の管理用スイッチ |
| `hot` | 温かい通路の中（囲いの中） | ラックの背面: 液冷のマニホールドとホース、バスバー、銅ケーブルのカートリッジ |
| `cdu` | CDU の前（扉を開けた状態） | ポンプ・熱交換器・天井へ上がる配管 |
| `ceil` | 列の端で天井を見上げる | バスウェイ、トレイ、配管。壁の窓から電気室と屋外の冷却器が見える |

ツアーの筋書き（自動）: データ（`cold-in`→`cold-mid`→`net`）→ 電気（`ceil` のバスウェイ → `hot` のバスバー）→ 熱（`hot` のマニホールド → `cdu` → `ceil` の窓の外へ）。

## 2つの作業の受け渡し（契約）
Blender 側は `teardown-out/room/v2/` に次を書き出し、ブラウザ側はそれだけを読む。
```
teardown-out/room/v2/
  room.glb                 # 焼き込み済み。three.js は MeshBasicMaterial で貼る（値は 1/scale 倍で保存）
  pano/<id>.webp           # 地点ごとの 360° 写真（正距円筒 4096x2048、品質 80）
  stills/<name>.webp       # 説明ページ用の静止画（1600x900）
  stations.json            # 下の形
```
```json
{
  "scale": 0.5,
  "axes": "blender z-up (x 列に沿って, y 奥, z 上)。three では (x, z, -y)",
  "stations": [
    {"id": "cold-in", "pos": [x, y, 1.6], "yaw": 0, "pano": "pano/cold-in.webp",
     "next": ["cold-mid"], "title": "冷たい通路の入口", "text": "2〜3行の説明"}
  ],
  "tags": [
    {"id": "nvl72", "at": [x, y, z], "stations": ["cold-in", "cold-mid"], "title": "GPU ラック（NVL72）", "line": "72 GPU・約120 kW", "card": "3行の説明", "link": "nvl72-live.html"}
  ],
  "flows": [
    {"id": "tcs-supply", "kind": "liquid-cold", "path": [[x, y, z], ...]},
    {"id": "tcs-return", "kind": "liquid-warm", "path": [[x, y, z], ...]},
    {"id": "data", "kind": "data", "path": [...]},
    {"id": "power", "kind": "power", "path": [...]}
  ]
}
```
- `yaw` は 360° 写真の中央が向く方角（度。0 = +x）。写真の向きは全地点で同じ規則にする。
- `flows.path` は Blender の部屋の配管・ケーブルと同じ座標。ブラウザはこれを 3D と 360° 写真の両方に重ねる。
- 契約を変えたくなったら、勝手に変えずに報告する。

## 共通の決まり
- 画面の配色は refs.md の「画面の配色」。説明の重ね（流れ・札・カード）だけに強調色。光る演出・常時の点滅はしない。
- 3D の中の物の色は実物の色。ロゴ・社名・写真は使わない。
- `prefers-reduced-motion` では自動ツアーを始めない。
- 下端に注記「非公式の教材。NVIDIA GB200 NVL72 などを模した形で、NVIDIA・GB200・NVLink・Quantum は NVIDIA Corporation の商標。数値は refs.md の出典による」。
- `~/Library/Mobile Documents` 配下は開かない。git の操作はしない。`docs/`・`site/`・`tools/publish-pages.sh` は触らない（公開は親がやる）。
