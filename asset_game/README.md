# 耳が飾りになるまで — 外部アセット版

## 遊ぶ
`耳が飾りになるまで_外部アセット版_完全HTML.html` または `index.html` を Chrome / Edge で直接開きます。ネット接続が必要です。
アプリ内ファイルビューアは外部通信が無効なため動きません。ライブプレビューを別タブで開くかダウンロードしてください。

初期GLBはSponza（約53MB）。欧州のアトリウム・回廊で、日本の古民家ではありません。自動生成の箱の建築は使っていません。内装付きの古民家GLBはドラッグ＆ドロップで差し替えてください。

## ローカル差し替え
- GLB: 1ファイルをドロップ。
- GLTF: GLTF・BIN・画像を含むフォルダごとドロップ。ファイル選択で全ファイルをまとめて選んでも可。
- GLTF単体では外部BINや画像が欠落していると動作しません。
- ファイルはアップロードされず、Blob URLでローカルに読み込みます。
- Draco / Meshopt / KTX2 対応。ただしDraco decoderとBasis transcoderはCDNから取得。

## マップに必要な条件
Y-upの静的建築、実体のある床と壁、床面上に約1.8mの空間が必要。最大水平寸法42mへ正規化。上下階の自動配置は一つの歩行可能な連結領域に限定。閉じた扉を自動で開閉可能にはしません。外観のみのGLBに内装を作ることはありません。アニメーションするメッシュは静止状態でのコリジョンになります。
床は法線・レイキャストで検出。頭上と半径方向のクリアランス、隣接ノードの経路を確認し、低層かつ囲まれた領域を優先して選択。屋根や屋外を誤選択する可能性は任意モデルで完全には排除できません。

## PBR
Poly Havenのold_wood_floor / tatami_mat / clay_plasterの各2K BaseColor・Roughness・OpenGL Normalを取得。
材質名と平面法線の簡易判定で古木と塗壁を割当、手記の目印として畳を配置。原作者のPBRは未判定面に保持。
誤判定はEscの設定から原作材質へ戻し、対象マテリアルを手動で割当できます。和紙専用素材は未使用で原作材質を維持します。

## 操作
WASD移動 / マウス視点 / Shift早足 / F懐中電灯 / Eまたは左クリックで拾う / Q長押しで方向 / Esc解除。
開始1クリックでPointer Lock。ドラッグ操作はありません。Pointer Lockが拒否される埋込画面では別タブ・直接HTMLで開いてください。
手記3枚→鍵→入口に戻ってE。人形のAIはこの刷新版には含めません。PC向けです。

## 性能
BVHによる床・壁のレイキャスト加速、Three.jsの視錐台カリング、1024の影1灯、DPR最大1.5。設定で影なし・DPR1へ軽量化可能。
本格的なGPU Occlusion Cullingは実装していません。外部アセットの描画負荷自体を自動でリダクションしないため60fpsは保証しません。

## 編集と再ビルド
- main.js: 編集用エンジン全コード（CONFIG.modelURLで初期URL変更）
- template.html: 編集用UI・CSS
- engine.bundle.js: 依存を内包するビルド結果
- index.html: 完全な実行用HTML
- build.py: HTML組立

```
npm ci
python3 build.py
```
Node.jsとPython 3が必要です。Three.js r170、three-mesh-bvh 0.8.3、esbuild 0.24.2をバージョン固定しています。

## 出典・利用条件
初期GLB: https://raw.githubusercontent.com/Breush/lava-assets/master/models/sponza.glb
出典: Frank Meinl / Crytek, Marko Dabrovic; PBR textures Alexandre Pestana。
https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/Sponza/README.md
Sponzaは配信先・変換版でライセンス表記に相違があるため、製品化前に適用条件を必ず確認し、利用権を確認済みのモデルへ差し替えてください。公開URLは再配布・商用利用の許諾を意味しません。このZIPにはモデル自体を再配布していません。
Poly Haven textures: CC0。Three.jsとthree-mesh-bvh: MIT、通知をHTMLに同梱。

## 確認済み
Chromiumで実際の公開GLB・PBR9画像の取得、Pointer Lock、手記3枚・鍵・脱出の進行を検証（進行テストの移動はデバッグ用テレポート）。
関連BINと画像を外出ししたGLTFをDataTransferでドロップして読込できることを確認。
任意の市販モデル、全ブラウザ、全経路の手動通しプレイ・60fpsは保証していません。
