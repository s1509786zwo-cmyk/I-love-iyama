# De Haar Castle・原解像度版

## 完成配布物
- `GRAND_ATLAS_DeHaar_原解像度_完全版.html`：全アプリinline・完全可読HTML、84,278 bytes。
- `GRAND_ATLAS_DeHaar_原解像度_配信一式.zip`：完全HTML、README、無改変 `assets/dehaar.glb`、25,836,354 bytes。
- 最新ライブプレビューは8082。`preview_server.py` は新ZIP内のGLBを直接配信し、永続ファイルの巨大な重複を避ける。

## 変更
博物館Hintze Hallを維持し、その次のLébioles外マップだけをDe Haar Castleに置換。既存の中庭・大回廊・図書館・自室・休憩室・セラー・ハルヴィル宮殿と3連結経路を維持。`maps.js` は変更なし。

経路は `hub → Hintze → DeHaar → hub`。De Haarの元モデルのアーチ門から、中庭でドア2へ入ったときの位置・向きを復元する。Hintzeの入口から中庭への従来帰還も維持。`returnTo:'hub'` が該当フレームまでスタックを解消する。

原本は32,290,368 bytes、526,868三角形、4096² JPEG×3。SHA256 `ab30453bf313e4ce758d206c51d3ac81b1e9aaf9384e2c5e6d5a1ac24866c295`。GLB・画像・三角形は無改変。HTTP200でも欠損していたCatbox版は不使用。

全体BBoxに基づく均一scale=1、床基準sourceY=1.8、目線1.65。元のアーチ門point=[-11.7,3.5,59]、normal=[.70710678,0,.70710678]。入口立ち位置は最大2.5mの安全な床を探索し、城が見えるようlookAt=[22,12,5]。帰還の照準距離は2.8m以内。

## 画質制限撤廃
GLB事前解析による1024/2048/4096への画像縮小、software GPU用LOD、端末RAMに基づく制限、quality低DPR、adaptive DPRを全廃。`min(devicePixelRatio,2.0)` の初期値とresize時だけを使用する。影on/offはDPR・原画像を変更しない。

全textureにGPU最大anisotropy、mipmaps、LinearMipmapLinearFilter、LinearFilterを設定。GPU最大サイズを原画像が超える場合は、縮小せずエラー。De HaarはGPUアップロードが済んだImageBitmapのCPU側重複だけをcloseする。共有画像は全textureの転送が完了してから解放し、GPU4096²とmipmapを維持する。context lost後は描画を停止し、再読込を案内する。

## 検証の区別
### 実GPU描画（mockなし）
`browser_checks/dehaar-clean-final.log`、`dehaar-dpr2-final.log`、`dehaar-zip-final.log`。
- De Haar原4096²×3をGLTFLoader→GPU→draw。
- DPR1：CSS640×400。DPR2：CSS320×200、実描画640×400。
- anisotropy16、mipmap、フィルタ、scale1、eye1.65、native return照準PASS。
- upload後 `gpuUploaded:[4096,4096]`、CPU width0、cpuBitmapReleased=true。
- 配信ZIPからのHTTP応答のSHA256が原本と一致。
- DPR2/CSS640×400（実1280×800）はSwiftShaderのメモリ制限でクラッシュ。画像やDPRを下げる本番処理は一切追加していない。
- 60fps、実機高解像度、博物館8Kの実GPU描画は保証・検証していない。

### 経路・当たり判定回帰
`browser_checks/dehaar-route-final.log`：原8192² Hintze → 原4096² DeHaar → hub、正確なposition/quaternion、スタック解消、503時の元pose安全復帰、再試行、影切替でDPR不変、JS例外0。

`browser_checks/dehaar-existing-regression.log`：既存3連結、従来全室、元pose往復、階段下降、移動/ジャンプ/ライト/感度PASS。

上記経路回帰だけは、8K原画像がサンドボックスのsoftware GPUメモリを超えるため、テストスクリプト側でGPU転送とdrawを無効化した。実モデル解析・BVH・非描画native判定は実行。本番HTML/main.jsにはこのmockは含まれない。経路回帰を8K実描画確認とは扱わない。

## 留意
元スキャンの近距離ぼけ、壁・水面・裏面の欠損はそのまま。原画像以上の細部は復元しない。新造の床・扉・壁で埋め合わせていない。HTTP配信とネット接続が必要。利用権未確認のユーザー提供モデルとセラーは、公開・再配布前に権利確認が必要。
