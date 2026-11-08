# AI データホール（GB200 / GB300 NVL72 世代）3D教材の一次資料メモ

調査日: 2026-11-08。各行の書式は「事実（数値） — 出典URL — 区分（一次／報道／推測）」。
- **一次**: メーカー公式の文書・公式ブログ・リファレンスアーキテクチャ・製品データシート。
- **一次(ベンダー)**: 部品メーカーの自社製品資料。NVIDIA 以外の会社の主張なので、他社と数値が合わないことがある。
- **報道**: 一次資料が見つからなかった分だけ。
- **推測**: 一次資料から計算・解釈したもの。根拠も書いた。
- PDF は WebFetch で閲覧したときにツールが自動でキャッシュした分だけを読んだ。こちらから明示的にダウンロードしたファイルは無い。

---

## 1. 部屋の構成（GB200 / GB300 NVL72 世代）

### 1-1. SU（Scalable Unit）とラック
- 1 SU は DGX GB200 ラック8本（72 GPU × 8 = 576 GPU）。 — https://docs.nvidia.com/dgx-superpod/reference-architecture-scalable-infrastructure-gb200/latest/dgx-superpod-architecture.html — 一次
- 1 SU の TDP は 1.2 MW。建物は Uptime Tier 3（または TIA-942-B Rated 3 / EN50600 Class 3）以上、同時保守可能で単一障害点なし。 — 同上 — 一次
- GB300 版の SuperPOD RA も「1 SU = DGX GB300 8本、1 SU の TDP 1.2 MW」で同じ。計算ファブリックは Quantum-X800（XDR 800 Gb/s）InfiniBand。 — https://docs.nvidia.com/pdf/dgx-spod-gb300-ra.pdf — 一次
- 拡張の上限は 128 ラック・9,216 GPU。4 SU 以上は NVIDIA に個別相談。 — 同上 — 一次
- **1列のラック配置（GB200 RA の図 2.1「Complete Rack Layout in One Row」）**: 左から [端の箱] [高性能ストレージ] [ネットワークスイッチ] [GB200 NVL72 ×8] [ネットワークスイッチ] [管理ノード] [端の箱]。計算ラック8本を、ネットワークラックが両側から挟む並び。 — https://docs.nvidia.com/dgx-superpod/reference-architecture-scalable-infrastructure-gb200/latest/_downloads/238ab33ee345a7241fc2f15eedc2ff6c/RA11338001-DSPGB200-ReferenceArch.pdf（p.4 の図） — 一次（図）
  - 両端にある、画面と丸いボタンが付いた箱は、列の端に置いた CDU か封じ込めの扉と読める。図にラベルは無い。 — 推測
  - 図ではストレージ／ネットワーク／管理ラックがそれぞれ2〜3本に見える。本数は図の目視で、本文には書かれていない。 — 推測
- **GB300 RA の図1「Sample Design」（レンダリング）**: 1列は「計算4本＋中央の2本（中身が細かい横スリットで、スイッチの見た目）＋計算4本」。同じ列が何列も奥に続き、列の上には屋根状の枠（ホットアイル封じ込めかケーブル支持）が載る。黒い床に照り返しがあり、計算ラックのトレイ前面はシャンパンゴールドに光る。 — https://docs.nvidia.com/pdf/dgx-spod-gb300-ra.pdf（p.5） — 一次（図）／中央2本をネットワークラックと読むのは推測
- ラック1本の中身（上から）: 管理用 ToR Ethernet スイッチ2台 → 電源棚4台 → 計算トレイ10台 → NVLink スイッチトレイ9台 → 計算トレイ8台 → 電源棚4台 → 最下部に耐震ブレース（seismic bracing）。 — GB200 RA PDF p.6 図3.1 — 一次（図）
- 計算トレイ18台（1U・1台に GPU 4基＋Grace CPU 2基）、NVLink スイッチトレイ9台（1U）、電源棚8台（1台 33 kW = 5.5 kW PSU ×6）。ラック全体の消費はおよそ 120 kW（GB200）。 — https://docs.nvidia.com/dgx/dgxgb200-user-guide/hardware.html — 一次
- GB300 NVL72 は「フルラックで最大 142 kW」「33 kW 電源棚 ×8」「ToR は SN2201 ×2（DC バスバー給電）」「トレイ単位とラック単位の漏液検知を内蔵」。 — https://docs.nvidia.com/enterprise-reference-architectures/nvl72-ai-factory-with-gb300-nvl72-dual-plane-networking-architecture.pdf（p.6） — 一次
- GB300 の電源棚は前世代よりエネルギー貯蔵が大きく、施設側のピーク負荷を下げる。 — GB300 SuperPOD RA PDF — 一次
- 計算トレイのネットワークポートはすべてラック前面にあり、意図的にコールドアイル側に向けている（GB300 版は「cold (or hot) aisle」）。トレイ背面には温水出口・冷水入口・DC 電源コネクタ・NVLink コネクタが並ぶ。 — GB200 RA PDF p.6 / GB300 RA PDF（図4のラベル） — 一次
- NVLink はラック背面のケーブルカートリッジ（銅ケーブル）にブラインドメイトで刺さる。GB200 ラックの背面には縦向きのカートリッジが4本あり、銅ケーブルは5,000本超。 — https://developer.nvidia.com/blog/nvidia-contributes-nvidia-gb200-nvl72-designs-to-open-compute-project/ — 一次
- ラック寸法: 幅 600 × 奥行 1068 × 高さ 2236 mm（キャスター込み 2286 mm）。19インチ機器、44OU/48RU、本体 180 kg、静荷重 1,600 kg、色は黒（RAL9005）。 — Vertiv Open Rack for NVIDIA MGX データシート https://www.vertiv.com/4a5d30/globalassets/shared/vertiv-mgxrack_data-sheet_emea_english_sl-80496_rev0426.pdf — 一次(ベンダー)
- 機器を載せた重量はおよそ 1.36〜1.47 t（HPE は 3,245 lb と記載）。 — HPE の資料を検索結果で見ただけ（https://www.hpe.com/il/en/collaterals/collateral.a50009224enw.html） — 報道相当（未開封）
- 1 SU 1.2 MW ÷ 8本 = 150 kW/本。ネットワーク・管理分を含めた平均値と読める。 — 推測（計算）

### 1-2. 網の分け方（5セグメント・4物理ファブリック）
- セグメントは NVLink 5、Compute、Storage、In-band 管理、Out-of-band 管理の5つ。物理ファブリックは Multi-node NVLink、Compute InfiniBand、Storage＋In-band Ethernet、OOB の4つ。 — GB300 SuperPOD RA PDF「Network Fabrics」 — 一次
- **NVLink（ラック内）**: 9トレイ × NVSwitch 2基 = 18チップ。GPU は1基あたり 18 本の NVL5 リンクを持ち、全 72 GPU がフルメッシュでつながる。GPU あたり 1.8 TB/s。 — 同上 — 一次
- **Compute（ラック間・GB300）**: Q3400-RD Quantum-X800（144ポート）。1 SU のリーフは8台（4レール × 2台）。2層ファブリックで最大 16 SU（約9k GPU）。表3の台数: 2 SU = リーフ16／スパイン8、4 SU = 32／18、8 SU = 64／36、16 SU = 128／72。 — 同上 — 一次
- **Compute（GB200）**: QM9700（NDR 400G）。レール最適化・ノンブロッキングのファットツリー。計算トレイ1台に CX-7 ×4。 — https://docs.nvidia.com/dgx-superpod/reference-architecture-scalable-infrastructure-gb200/latest/dgx-superpod-components.html — 一次
  - GB200 のネットワークページには「1 SU に SLG 4つ × リーフ8＋スパイン6」とあるが、ポート数から計算すると合わない。ページ記載をそのまま引くにとどめる。 — https://docs.nvidia.com/dgx-superpod/reference-architecture-scalable-infrastructure-gb200/latest/network-fabrics.html — 一次（要確認）
- **Storage＋In-band（Ethernet）**: SN5600 / SN5600D（Spectrum-4、800G ×64ポート）。1 SU に計算リーフ4台。ストレージリーフは2台から増減できる。管理リーフ1対と OOB スパイン1対もある。計算リーフの上りは 400G × 24本で 1:3 ブロッキング。ストレージリーフは 400G × 72本でノンブロッキング。トレイ側は BlueField-3 B3240（2×400G）で、ストレージに 400G を1ポート、In-band に 200G 以上を別ポートで割り当てる。 — GB300 SuperPOD RA PDF「Ethernet Fabric」表4 — 一次
- **OOB（帯域外管理）**: SN2201（1G ×48）。BMC、BlueField の BMC、NVSwitch の COMe、ラック PDU などの管理ポートをつなぐ。GB300 版では OOB 専用のアグリゲーション・スパインを追加し、物理的に独立した網にした。 — 同上 — 一次
- 外部（お客様網）への接続は最低 2×100GbE の単一モード DR1 で、eBGP でつなぐ。建物管理システム（BMS）の電力・冷却テレメトリもこの上りを通る。 — 同上 — 一次
- Spectrum-X 版（Enterprise RA, GB300）: 1 SU = 1ラック。8ラック構成では1ラックあたり SN2201 ×2（合計16台）。1台のリーフは3ラック分を収容できるが、ソフトの要件で2ラック分に抑える。デュアルプレーン（CX-8 の 800G を 400G ×2 に分け、各プレーンへ）。 — Enterprise RA PDF p.24-30 — 一次
- 管理ノード: x86 / ARM の制御ノードを12台想定。UFM アプライアンス（IB 管理）と NMX-M（NVLink 管理）も置く。 — 同上 / GB300 SuperPOD RA 表1 — 一次

---

## 2. 液冷の実物

### 2-1. 2系統: TCS と FWS
- CDU が「施設の水（FWS: facility water system）」と「IT 側の冷却液（SFN: secondary fluid network ＝ TCS: technology cooling system）」を液対液の熱交換器で分ける。列マニホールドは TCS の一部で、CDU とラック／コールドプレートをつなぐ。 — https://www.vertiv.com/en-anz/insights/articles/educational-articles/row-based-manifolds-the-backbone-of-liquid-cooling-in-modern-data-centers/ — 一次(ベンダー)
- NVIDIA の説明では、熱は「technology loop → CDU（液対液熱交換器）→ facility loop」の順に運ばれる。 — https://blogs.nvidia.com/blog/blackwell-platform-water-efficiency-liquid-cooling-data-centers-ai-factories/ — 一次

### 2-2. 実際の温度（リファレンスデザインの実数値）
- **Schneider RD109（GB200 NVL72 想定、7,392 kW）**: TCS は供給 104°F（40.0℃）／戻り 129°F（53.9℃）。CDU に入る FWS は 99°F（37.2℃）／117°F（47.2℃）。空調用の冷水は 73°F（22.8℃）／91°F（32.8℃）、ファンウォールの吹出しは 82°F（27.8℃）。 — https://download.se.com/files?p_Doc_Ref=RD109DSR0_EN&p_enDocType=Reference+design&p_File_Name=RD109DSR13-GB200.pdf — 一次(ベンダー)
- 同 RD109: 液冷ラックの熱は **87% が液、13% が空気**。 — 同上 — 一次(ベンダー)
- 同 RD109: 液冷用の高温水ループは屋外のフルードクーラー（断熱補助つき）で放熱し、空調用の低温ループはチラーで作る。2系統に分けている。蓄熱タンクで停電時に5分間冷却を続け、CDU と施設ポンプは UPS につなぐ。 — 同上 — 一次(ベンダー)
- Lenovo GB300 NVL72 データシート: 温水運転 18〜45℃、冷却液は PG25 または純水、チラー水は不要。 — https://lenovopress.lenovo.com/ds0207 — 一次(ベンダー)
- ASHRAE の液冷クラス（第5版）は W17 / W27 / W32 / W40 / W45 / W+ で、数字が施設水温度の上限（℃）。旧 W1〜W5 から改名し、W40 を新設した。 — https://www.upsite.com/blog/major-changes-to-ashraes-fifth-edition-of-thermal-guidelines-part-3-liquid-cooling-chapter-updates/ — 報道（ASHRAE 原典は有料で未確認）
- Vertiv CoolChip CDU は「ASHRAE W45 に対応」し、2次側の温度を ±1℃ で制御する。 — https://www.vertiv.com/49dab6/globalassets/shared/vertiv-coolchip-cdu-2300kw-data-sheet-sl-80005.pdf — 一次(ベンダー)
- **NVIDIA が公式に書いた入口温度**: GB200/GB300 の数値は公開文書に見当たらない（データセンター設計ガイドは https://apps.nvidia.com/pid/contentlibraries/detail?id=1119226 にあり、パートナーのログインが必要）。次世代の Rubin は「冷却液の供給は最大 45℃、チップを通ると約 55℃」で、100% 液冷・ファンなし。冷却液は水75%＋プロピレングリコール25%。 — https://blogs.nvidia.com/blog/liquid-cooling-ai-factories/ — 一次（Rubin の値。GB200/GB300 には当てない）

### 2-3. CDU の置き場所・容量・何ラック分か
- **Schneider RD109**: 床置きの液対液 CDU（Motivair MCDU）を1ポッド（AI ラック16本＋ネットワークラック16本）に3台、N+1 で置く。図では CDU がファンウォールの近く、ポッドの端（列の外側）に並ぶ。 — RD109 PDF「IT Space」 — 一次(ベンダー)／図からの位置の読みは推測
- **Google**: 「in-row CDU」を使い、ラックのループと施設ループを分ける。ポンプと熱交換器は冗長で、UPS つき。可用性は約 99.999%。 — https://cloud.google.com/blog/topics/systems/enabling-1-mw-it-racks-and-liquid-cooling-at-ocp-emea-summit — 一次
- **Vertiv CoolChip CDU（列の中にも部屋の周囲にも置ける）**: 下表。 — Vertiv データシート SL-80005 — 一次(ベンダー)

| 機種 | 容量（ATD 4℃） | 寸法 H×W×D mm | 満水重量 | 配管口（上下どちらか） | 消費電力 |
|---|---|---|---|---|---|
| 600kW | 600 kW | 2000×600×1200 | 550 kg | 2.5インチ サニタリフランジ | 9.0 kW |
| 1350kW | 1,350 kW | 2122×900×1243 | 1,086 kg | 4インチ | 20.5 kW |
| 2300kW | 2,300 kW | 2400×1200×1200 | 1,793 kg | 6インチ | 47.8 kW |

  - 3機種共通: 冗長ポンプ、ユニット内の漏液検知（スポット検知はオプション）、7インチのタッチパネル、2次側フィルタ 25/50µ。保守は前後から。 — 同上 — 一次(ベンダー)
- **CoolIT CHx2000（列型）**: 2,000 kW（ATD 5℃）、2,125 LPM、GB300 NVL72 なら12ラック分。最大20台をグループ制御し、240ラック超に対応。FWS/TCS とも4インチのトリクランプ、配管はステンレス。 — https://www.coolitsystems.com/cdu-product/chx2000/ — 一次(ベンダー)
  - 設置面積 750×1200 mm。 — 報道（StorageReview など）
- **ラック内 CDU**: CoreWeave の GB300 NVL72 は Vertiv CoolChip CDU で冷やし、液対液 121 kW。写真ではラック最下部にタッチパネル付きのユニットが見える。 — https://www.vertiv.com/en-ca/insights/articles/blog-posts/how-vertiv-and-coreweave-are-orchestrating-ai-innovation/ — 一次(ベンダー)／写真の最下部ユニットを CDU と読むのは推測
- xAI Colossus（前世代 H100 だが実物の写真が多い）: CDU はラック最下部。ポンプと電源は冗長で、ホットスワップできる。 — https://supermicro.com/CaseStudies/Success_Story_xAI_Colossus_Cluster.pdf — 一次（Supermicro 公開の ServeTheHome 記事）
- 1台で何ラック分か: Vertiv 2300kW ÷（132 kW × 液の分 87% ≈ 115 kW）≈ 20本、600kW なら約5本。 — 推測（計算）

### 2-4. 流量・配管・マニホールド・クイックディスコネクト・漏液検知
- 流量の目安: CHx2000 は 2,125 LPM ÷ 2,000 kW ≈ 1.06 LPM/kW（ページ値からの計算）。GB300 1本（液 120 kW 前後）なら毎分 130 L 前後。 — CoolIT 製品ページ — 一次(ベンダー)／ラック1本の値は推測
- Vertiv 600kW の流量は最大 900 L/min（ポンプ2台を同時に回したとき。1台では最大 450 L/min。cdu/refs.md）。 — Vertiv パンフレット（検索結果で確認） — 一次(ベンダー)だが未開封
- 列マニホールドは 304L ステンレスでトリクランプ継手。工場で圧力試験と洗浄を済ませて届く。床上（天井吊り）にも床下にも組める。温度・圧力・流量のセンサーと、湿り検知＋差圧監視の漏液検知が付く。 — Vertiv 列マニホールド記事 — 一次(ベンダー)
- NVIDIA GB200 の液冷マニホールドはブラインドメイト式。トレイ側のコネクタがわずかに動いて位置を合わせ、液のクイックディスコネクトを確実にかみ合わせる。 — NVIDIA OCP 寄稿ブログ — 一次
- Colossus: ラック側面に3相 PDU とラックマニホールドがあり、1U の前面マニホールドからサーバーへ配る。継手は **赤＝温、青＝冷** で色分け。 — Supermicro Colossus PDF — 一次
- Vertiv SmartRun: 天井側の工場組み立てユニットに、バスウェイ・液冷配管（ステンレス、分岐ごとに遮断弁）・ネットワークケーブル・ホットアイル封じ込めをまとめて吊る。漏液検知は構成による。 — https://www.vertiv.com/en-us/products-catalog/facilities-enclosures-and-racks/integrated-solutions/vertiv-smartrun/ — 一次(ベンダー)
- Schneider RD109: プレハブのポッド構造に「6 ft（1.83 m）幅のダクト付きホットアイル封じ込め＋バスウェイとケーブル支持＋TCS 配管」をまとめる（＝ラックの上、天井側）。 — RD109 PDF — 一次(ベンダー)
- 天井配管か床下配管か: 上の2社の AI 向け既製品はどちらも頭上配管で組んでいる。床下でも組めるとは書いてある（Vertiv）。 — 推測（2社の構成からの傾向）

### 2-5. 残る空冷分の処理
- GB200/GB300: GPU と CPU は液冷、それ以外（NIC・電源・ドライブなど）はファンで空冷。 — GB200 ユーザーガイド hardware / GB300 SuperPOD RA — 一次
- 空冷分の割合は 13%（Schneider RD109）。 — 一次(ベンダー)
- 処理の仕方① **ファンウォール＋ダクト付きホットアイル**: Schneider RD109 は冷水ファンウォール6台（N+1）。ホットアイルとダクト、共通の天井プレナムで熱気をファンウォールへ戻す。CRAH に置き換えてもよい。 — RD109 PDF — 一次(ベンダー)
- 処理の仕方② **リアドア熱交換器（RDHx）**: Colossus は排気をラック背面の扉の熱交換器に通し、ラックを「ホールに熱を出さない（cooling neutral）」状態にした。扉は通常は青く光り、異常時は赤など。ストレージ・CPU・ネットワークラックの熱もこれで取る。 — Supermicro Colossus PDF — 一次
  - Vertiv CoolLoop RDHx: 公称 35〜80 kW、最大 90 kW。幅 600/800 mm、高さ 2000/2200 mm。受動型（サーバーのファンで通風）と能動型（扉にファンを内蔵）がある。 — https://www.vertiv.com/en-us/insights/articles/educational-articles/how-rear-door-heat-exchangers-rdhx-support-high-density-rack-cooling/ と同社データシート — 一次(ベンダー)（数値は検索結果経由）
- 処理の仕方③ **列の中の液対空熱交換器**: AWS の In-Row Heat Exchanger（IRHX）は、高密度 AI 機器の熱をラックで直接取る。水を使う冷却が動く回数を減らす。 — https://aws.amazon.com/sustainability/data-centers/ — 一次
  - 構成はポンプユニット、配水キャビネット、ファンコイル。既存の空冷ホールに置ける。 — 報道（Benzinga, Cloud Wars など）
- Microsoft Fairwater（ウィスコンシン）: 容量の 90% 超が閉ループ液冷で、残り約10%は外気（猛暑日だけ水）。 — https://blogs.microsoft.com/blog/2025/09/18/inside-the-worlds-most-powerful-ai-datacenter/ — 一次（建物全体の割合で、ラックの液／空気の比率ではない）

---

## 3. 電源

- ラック内: 電源棚8台が AC を 50〜51 V DC に変え、背面のバスバーで各トレイへ配る。 — GB200 ユーザーガイド hardware — 一次
- GB200 ラックのバスバーは 1,400 A（従来の約2倍）。幅は ORv3 と同じで、奥行きが深い。 — NVIDIA OCP 寄稿ブログ — 一次
- ラックごとに、ラック全体の電源を切れる主遮断手段が必要。 — https://docs.nvidia.com/dgx/dgxgb200-user-guide/safety.html — 一次
- **Schneider RD109 の電源経路（建物）**: 3 MW のパワートレイン4本（3+1）。各トレインは 4000 A の主配電盤 → 1,500 kW の Galaxy VX UPS ×2（5分）→ 配電盤。その先は「1.3 MVA の PDU（480 V→415/240 V）」→「2×800 A の RPP」→ ラックへ。AI ラック1本には 60 A の給電が8本（電源棚1台に1本）入り、A/B/C/D の4系統から受ける。ネットワークラック（22 kW）は 60 A ×2 の 2N。UPS の過負荷耐量で NVL72 の電気設計点（EDP）のピークを受ける。冷却系は別に 1.5 MW ×2（2N）で、CDU とポンプには 200 kW の UPS。 — RD109 PDF — 一次(ベンダー)
  - UPS と主配電盤は電気室（ホールの外）。PDU/RPP は列単位の給電盤で、ホール内の列端かすぐ外に置く。 — 推測（RD109 の「Each row is powered by…」からの読み）
- **天井バスウェイ**: Vertiv PowerBar Track は 2000 A（UL 857）／2500 A（IEC）で、2段積みもできる。通電したままタップオフボックスを増設・移設できる。列の上に吊る。 — https://www.vertiv.com/en-us/about/news-and-insights/corporate-news/2026/vertiv-announces-scalable-high-capacity-double-stack-busway-system-that-preserves-white-space-for-growing-ai-data-center-demands/ — 一次(ベンダー)
- Microsoft Fairwater Atlanta: GPU 群には、敷地内発電・UPS・二重給電を使わない。系統電力の信頼性（4×9）と、ソフト・GPU の電力上限・敷地内蓄電で電力の揺れを吸収する。 — https://blogs.microsoft.com/blog/2025/11/12/infinite-scale-the-architecture-behind-the-azure-ai-superfactory/ — 一次（教材の「標準形」とは違う例として触れる程度）
- Microsoft Fairwater ウィスコンシン: 地下の中圧ケーブル 120マイル、機械配管 72.6マイル。 — 同社 2025-09-18 ブログ — 一次
- **次の世代（触れる程度）**: 800 VDC。13.8 kV AC を敷地の端で直接 800 VDC に整流し、列は 800 V バスウェイ、ラックは2線の 800 V を受けてラック内で DC/DC 変換する。2027年の Kyber 世代で本格化。今の 54 VDC のまま MW 級にすると、電源棚がラックの空間を食い尽くす。 — https://developer.nvidia.com/blog/nvidia-800-v-hvdc-architecture-will-power-the-next-generation-of-ai-factories/ — 一次
- Google は ±400 VDC とサイドカー電源ラック（電源を IT ラックの外に出す）で、ラック1本 1 MW を目指す。 — Google Cloud ブログ（上掲） — 一次

---

## 4. ケーブル

- xAI Colossus: 頭上に黄色いワイヤーメッシュのケーブルトレイがあり、黄色（単一モード）と水色（マルチモード）の光ファイバが大量に走る。1本ずつ長さに合わせて切って端末処理し、ラベルを貼ってある。管理系の低速網は別系統。GPU サーバー1台につき 400GbE が9本（GPU 用8本＋CPU 用1本）。 — Supermicro Colossus PDF（写真「Overhead Cabling」「Fiber Runs」「Single Mode And Multi Mode Fiber」） — 一次
- Microsoft Fairwater Atlanta の写真「Two-story networking architecture」: 黄色い光ファイバの太い束が柱に沿って床から天井へ立ち上がる（上下階をつなぐ）。GPU ラックの上端にも黄色いファイバが密に並ぶ。 — https://blogs.microsoft.com/blog/2025/11/12/infinite-scale-the-architecture-behind-the-azure-ai-superfactory/ — 一次（写真の観察）
- Microsoft ウィスコンシンの写真: ラック上端に水色のファイバが並ぶ。 — 2025-09-18 ブログ — 一次（写真の観察）
- 光ファイバの量: Corning は「生成 AI の網は従来のデータセンターの10倍のファイバが要る」としている。 — https://www.corning.com/optical-communications/worldwide/en/home/the-signal-network-blog/ai-data-center-design-strategies.html（検索結果で確認） — 一次(ベンダー)
- ラック間の量感: 8ラック SU（Spectrum-X）で、GPU 計算網の上り 400G が 1 SU あたり 144本、CPU 網が36本、顧客網へ 100/200G が144本、ストレージが72本。 — Enterprise RA PDF p.29 — 一次
- ラック1本の計算網ポートは、18トレイ × CX-8 ×4 = 72ポート（800G）。デュアルプレーンでは 400G ×2 に分けるので、片プレーンあたり72本、ラックからは144本出る。 — Enterprise RA — 一次（掛け算は推測）
- ラック内の NVLink は光ではなく銅（背面カートリッジ、5,000本超）。 — NVIDIA OCP 寄稿ブログ — 一次
- STH/Supermicro の観察: スイッチの光トランシーバーの発熱が大きく、液冷スイッチや CPO（光電融合）が求められている。 — Supermicro Colossus PDF — 一次

---

## 5. 見た目（公式写真のあるページ。画像はダウンロードしていない）

| ページ | 何が写っているか（1行） | 区分 |
|---|---|---|
| https://docs.nvidia.com/pdf/dgx-spod-gb300-ra.pdf（p.5 図1） | NVIDIA のレンダリング。黒い床に照り返し、黒いラック、トレイ前面はシャンパンゴールドに光る。列は「計算4＋スイッチ2＋計算4」で、上に屋根状の枠 | 一次（CG） |
| GB200 RA PDF（p.6 図3.1） | 黒いラック4本の正面。最上部に ToR、上下に電源棚の丸い穴の列、中央に金色の NVLink スイッチ、最下部に耐震ブレース | 一次（CG） |
| https://blogs.microsoft.com/blog/2025/09/18/inside-the-worlds-most-powerful-ai-datacenter/ | 白いラックの列。ラック上端に水色のファイバ。磨いたグレーのコンクリート床（上げ床ではない）に黄色の床ライン。天井は暗い | 一次（写真） |
| https://blogs.microsoft.com/blog/2025/11/12/infinite-scale-the-architecture-behind-the-azure-ai-superfactory/ ①「Rack level direct liquid cooling」 | 白いラックの背面に、黒い液冷ホースが房のように垂れ下がる | 一次（写真） |
| 同 ②「Two-story networking architecture」 | 白いラック、グレーのスラブ床、黄色い保護柵、柱沿いに上下階を貫く黄色いファイバ束、白い LED の天井灯 | 一次（写真） |
| 同 ③「Densely populated GPU racks…」 | 白い枠のラック正面に、黄色いファイバと金属色のトレイが密集。天井は配管・トレイ・ケーブルで埋まる | 一次（写真） |
| https://supermicro.com/CaseStudies/Success_Story_xAI_Colossus_Cluster.pdf | 明るい白いホール、白いラック、明るい床。リアドア熱交換器が青く光る。頭上に黄色いケーブルトレイと黄色のファイバ。屋外には黒い断熱の大径水配管と Tesla Megapack（H100 世代） | 一次（写真） |
| https://www.vertiv.com/en-ca/insights/articles/blog-posts/how-vertiv-and-coreweave-are-orchestrating-ai-innovation/ | CoreWeave の GB300 NVL72 正面（写真は Switch 提供）。黒いラックに黄色いファイバ、最下部にタッチパネル付きの CDU ユニット | 一次（写真） |
| https://coreweave.com/blog/coreweave-leads-the-way-with-first-nvidia-gb300-nvl72-deployment | GB300 NVL72 の導入写真（Switch 提供）。本文に画像の説明は無い | 一次（未目視） |
| https://engineering.fb.com/2024/10/15/data-infrastructure/metas-open-ai-hardware-vision/ | Meta Catalina（GB200、ORv3 HPR 最大 140 kW）の前面と背面 | 一次（未目視） |
| https://cloud.google.com/blog/topics/systems/enabling-1-mw-it-racks-and-liquid-cooling-at-ocp-emea-summit | Project Deschutes CDU（第4世代）と ±400 VDC サイドカー電源ラック | 一次（未目視） |
| https://developer.nvidia.com/blog/nvidia-contributes-nvidia-gb200-nvl72-designs-to-open-compute-project/ | GB200 ラックの背面（NVLink 銅ケーブルのカートリッジ）、ブラインドメイトの液冷マニホールド | 一次（未目視） |

見た目を作るときの観察ポイント:
- **ラックの色は2系統**: NVIDIA の CG と MGX ラック（Vertiv は RAL9005）は黒。実際の Microsoft・xAI のホールは白いラックが多い。教材は NVIDIA 純正に寄せて黒＋金色の前面でよいが、実例として白もあり得る、と注記するのがよい。 — 上記ページの観察
- **床**: 実写真はどれも明るいグレーの密閉コンクリート（スラブ床）に黄色の床ライン。上げ床（フリーアクセス）ではなく、ラックは耐震ブレースで床に固定する。 — Microsoft 写真＋GB200 RA 図3.1／スラブ床を一般化するのは推測
- **照明**: 実物は白い LED で明るい。NVIDIA の CG は暗いホールにトレイの金色が光る演出。 — 観察
- **天井**: 配管・バスウェイ・黄色いケーブルトレイ・封じ込めの枠が層になって吊られる（SmartRun、RD109、Microsoft 写真）。 — 一次＋観察
- **通路幅**: ホットアイルは 6 ft（1.83 m）（RD109）。コールドアイルは、ラック奥行 1068 mm の機器を前から引き出すので 1.2 m 以上。 — RD109 一次／コールドアイル幅は推測
- **色分けの約束**: 液冷の継手は赤（温）と青（冷）。ファイバは黄色（単一モード）と水色（マルチモード）。 — Colossus PDF — 一次

---

## 6. ブランドの配色（公式サイトの実測。2026-11-08 にブラウザで計算スタイルを取得）

| 会社・ページ | 配色とトーン | 区分 |
|---|---|---|
| NVIDIA GB300 NVL72 https://www.nvidia.com/en-us/data-center/gb300-nvl72/ | 上部のヒーローは黒（#000）で、本文に入ると白／#F7F7F7。ボタンは緑 #76B900 だけ。「暗い背景＋緑1色」の代表 | 観察 |
| Vertiv AI Hub https://www.vertiv.com/en-us/solutions/ai-hub/ | 白と濃いグレー（#373737）、濃紺黒（#081119）の帯。ボタンはオレンジ #FE5B1A。ロゴは黒 | 観察 |
| Supermicro AI SuperCluster https://www.supermicro.com/en/solutions/ai-supercluster | ヒーローは青く光るラックの写真（シアン #16B3EA 系）。ボタンは暗赤 #961919、文字は紺 #003A70、ロゴは緑 | 観察 |
| CoreWeave https://www.coreweave.com/ | 白基調に、鮮やかな青 #0541E9 の1色を強調に使う。文字はほぼ黒 #02030B | 観察 |
| Equinix https://www.equinix.com/ | 黒〜濃紺 #131925 の全面写真に白文字。ボタンは黒か淡い紫 #E9DBFF、ロゴは赤 | 観察 |
| Schneider Electric https://www.se.com/ww/en/ | 明るいグレー／白。ボタンは緑 #008A16（404 ページの帯はブランドの明るい緑 #3DCD58） | 観察 |

まとめ: 純粋に「暗い背景＋1色」なのは NVIDIA（黒＋緑）と Equinix（濃紺＋淡紫）。設備メーカー（Vertiv・Schneider・Supermicro）は白基調で、強調色1色（オレンジ・緑・暗赤）を使う。 — 観察

**NVIDIA の緑を第三者の教材で使うこと**（https://www.nvidia.com/en-us/about-nvidia/legal-info/logo-brand-usage/ — 一次）:
- ページに #76B900 の数値や「ブランドカラーの第三者利用」の規定は無い。緑への言及は "NVIDIA green background"（ロゴの1色版を使う背景）だけ。
- ロゴや「branded elements」は書面の許可なく使えない。"may not be used in any manner that isn't expressly authorized in writing by NVIDIA"
- 承認済みの用途の一例に「NVIDIA の技術を使う教育・研究用途」がある。ただし、提携や推奨を匂わせる使い方は禁止。
- 第三者サイトの、NVIDIA ブランドを含むアートワークを使うことも禁止。
- → 教材としての判断: ロゴを置かず、#76B900 を部屋全体のテーマ色にもしない。NVIDIA 製の機器（トレイ前面のロゴ位置など）を示す控えめな色にとどめ、「NVIDIA は商標」と表記する。 — 推測（法的判断ではない）

---

## 3Dの部屋に入れるべき物の一覧（24行）

寸法は 幅×奥行×高さ（mm）。「推」は推測値。

| # | 名前 | 置き場所 | おおよその寸法 | 何を教えるか |
|---|---|---|---|---|
| 1 | GB300/GB200 NVL72 計算ラック ×8 | 列の中央、正面をコールドアイルへ | 600×1068×2236（実値） | 1本 120〜142 kW、GPU 72基で1つの NVLink 領域。SU = 8本 |
| 2 | 計算トレイ（ラック内18台） | ラック内、上段10台・下段8台 | 1U（44.45 mm）×19インチ | GPU 4基＋Grace 2基。前面にネットワークポート、背面に冷水の出入口 |
| 3 | NVLink スイッチトレイ（9台） | ラックの中央 | 1U | ラック内 72 GPU のフルメッシュ。ラック内は光でなく銅でつなぐ |
| 4 | NVLink 銅ケーブルのカートリッジ（4本） | ラック背面、縦向き | 推: 高さ約1,000、幅は細い | 銅ケーブル5,000本超。トレイはブラインドメイトで刺さる |
| 5 | 電源棚（8台） | ラックの上下に4台ずつ | 1U、33 kW | AC→50 V DC。背面のバスバー（1,400 A）でトレイへ配る |
| 6 | ToR 管理スイッチ SN2201（2台） | ラック最上部 | 1U | OOB 管理網（BMC・NVSwitch 管理）。DC バスバー給電 |
| 7 | 耐震ブレース | ラック最下部、床に固定 | ラック幅×約100（推） | スラブ床に固定する。ラックは約1.4 t |
| 8 | 計算網スイッチラック（Quantum-X800 Q3400 / QM9700） | 計算ラック列の両側（GB200 図）か中央（GB300 CG） | 600×1200×2200（推） | ラック間の GPU 網（レール最適化・ファットツリー）。1 SU にリーフ8台 |
| 9 | Ethernet スイッチラック（SN5600 / SN5600D） | 同上（ネットワーク列） | 600×1200×2200（推） | ストレージと In-band 管理の網。計算網とは物理的に別 |
| 10 | OOB 集約スイッチ（SN2201 スパイン） | 管理ラック内 | 1U | 管理用の網を物理的に分ける理由（利用者から隔離） |
| 11 | 管理ノードラック（制御ノード12台、UFM、NMX-M） | 列の端 | 600×1200×2200（推） | クラスタを動かす頭脳（Mission Control、Slurm/K8s） |
| 12 | 高性能ストレージラック | 列の反対側の端 | 600×1200×2200（推） | RoCE の並列ファイルシステム。チェックポイントの書き込み先 |
| 13 | CDU（液対液） | 列の端・ポッドの外周（in-row も可） | 600×1200×2000（600 kW 機）〜1200×1200×2400（2.3 MW 機） | TCS と FWS を分ける境目。冗長ポンプ・フィルタ・タッチパネル |
| 14 | 列マニホールド（TCS 供給・戻り） | 列の上、天井から吊る（床下も可） | 配管径 2.5〜6インチ（ステンレス） | CDU から各ラックへ冷却液を配る。供給 約40℃・戻り 約54℃（RD109） |
| 15 | ラックホースとクイックディスコネクト | ラック背面、マニホールドからラックへ | ホース径 約25（推） | 赤＝温・青＝冷。ドリップレスで抜き差しする |
| 16 | 漏液検知センサー（ロープ／スポット） | マニホールドの下、ラック底面、CDU 内 | 線状 | トレイ単位とラック単位の検知。止水弁と連動する |
| 17 | ホットアイル封じ込め（天井ダクト付き） | 2列の背面同士のあいだ | 通路幅 1,830（RD109）、高さ約3,000（推） | 空冷で残る約13%の熱を逃がさず回収する |
| 18 | ファンウォール／CRAH | ホールの壁際 | 推: 幅 2,000〜3,000 の壁面ユニット | 残りの空冷分を冷やす。冷水 約23℃／吹出し 約28℃ |
| 19 | リアドア熱交換器（選択肢として） | ネットワークラックやストレージラックの背面扉 | 600/800×約250×2000/2200 | 空冷機器の熱をラックの場で水に移す（Colossus 方式。青く光る） |
| 20 | 天井バスウェイとタップオフボックス | 列の真上 | 推: 断面 200×150、タップは 300×200 程度 | 通電したまま増設できる給電レール。A/B/C/D の4系統 |
| 21 | 列端の配電盤（PDU 1.3 MVA／RPP 2×800 A） | 列の端、ホールの壁際 | 推: 1,000×1,000×2,100 程度 | 電気室の UPS から来た電気を列とラックへ分ける。ラック1本に8回路 |
| 22 | 頭上ケーブルトレイ（黄色のワイヤーメッシュ）と光ファイバ | ラック列の上、配管より上の段 | 推: 幅 600 | 黄色＝単一モード、水色＝マルチモード。SU あたり数百本 |
| 23 | 部屋の外への窓・案内板（UPS／電気室、チラー／ドライクーラー） | 壁面に「この先」として示す | パネル | FWS は屋外のフルードクーラーへ。UPS は部屋の外。次は 800 VDC |
| 24 | スラブ床と黄色の床ライン、保護柵 | 床全体 | — | 上げ床ではなく、重いラックを床に直置きする実物の床 |

---

### 未確認・残り
- NVIDIA 自身による GB200/GB300 の冷却液入口温度・流量は、公開文書で見つけられなかった（パートナーポータルの設計ガイドはログインが必要）。温度は Schneider RD109 と Lenovo の値で代用した。
- ASHRAE の W クラス表の原典は有料で、二次資料（Upsite）で確認した。
- ネットワーク・ストレージ・管理ラックの寸法と、ファンウォール・バスウェイ・RPP の寸法は推測。
- GB200 RA のネットワークページにある IB スイッチ台数（SLG 4 × リーフ8＋スパイン6）は、ポート数の計算と合わない。原典の PDF 表で再確認が必要。
- AWS IRHX の構成の詳細と、HPE のラック重量は報道・検索結果ベース。
