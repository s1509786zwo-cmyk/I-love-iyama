GRAND ATLAS — De Haar Castle・原解像度版

起動
1. ZIPを展開し、index.html と assets/dehaar.glb の相対位置を維持。
2. そのフォルダで python3 -m http.server 8080 を実行。
3. Chrome/Edgeで http://localhost:8080/ を開く。
   file://直開き・通信禁止の埋込プレビューでは動作しません。
   three.js/BVH/DRACO、既存モデル・素材、博物館はネット接続が必要です。

変更範囲
・博物館Hintze Hallの次の外マップLébiolesだけをDe Haar Castleへ置換。
・中庭、大回廊、大図書館、自室、休憩室、ワインセラー、宮殿大広間と
  既存3連結マップ、博物館を維持。Villageはありません。
・ドア1→大回廊→従来の各室。
・ライオン位置の黒い石アーチ→33qxzs→pt7rsw→wth21z。
・ドア2→Hintze Hall→De Haar Castle。
・博物館の本物の入口からは中庭へ帰還。
・De Haarでは入場地点の本物のアーチ門を照準＋Eで調べると、中庭へ直接帰還。
  ドア2へ入ったときの中庭の位置・向きを復元し、経路スタックを解消します。

原画質
・De Haar原本32,290,368 bytes、526,868三角形、4096² JPEG×3を無改変同梱。
・SHA256 ab30453bf313e4ce758d206c51d3ac81b1e9aaf9384e2c5e6d5a1ac24866c295
・原画像をGLTFLoaderからGPUへ直接転送。GLB再圧縮、画像再エンコード、
  強制縮小、ソフトウェアGPU専用LOD、メモリ理由の縮小、adaptive DPRはありません。
・DPR=min(devicePixelRatio,2.0)。影on/offも画像・DPRを変更しません。
・最大異方性フィルタ、mipmap、LinearMipmapLinear/Linearを設定。
・GPUアップロード完了後、De HaarのCPU側重複ImageBitmapだけを解放。
  GPU上の4096²画像・mipmapは維持。GPU喪失時には再読込してください。
・元スキャンの欠損・近接時のぼけは残ります。原画像にない細部は復元しません。
・博物館8192²も原解像度のため大量のGPUメモリが必要です。
  GPU上限超過時は縮小せずエラー。メモリ不足・context lostは通知します。
  60fpsは目標であり、全端末での動作や滑らかさを保証するものではありません。

操作・物理
WASD移動 / Shift走る / マウス視点 / Space接地ジャンプ / E本物の扉
FまたはLライト / Esc解除 / 感度0.2〜3即時反映 / リセットで各室入口
歩行2.7m/s、走行6.6m/s、足元から目線1.65m、単一ジャンプ、段差0.4m。
元の床・壁のRaycast/BVH。均一スケール。追加外マップに自作床・扉はありません。
新モデルは元寸法scale=1。本物の門の非描画照準判定と元メッシュの遮蔽判定。
約1秒fade、通信120秒/解析60秒timeout、ロード失敗時の位置・向き復帰。
FOV70、near0.2、far300、logDepthなし、懐中電灯1灯の影1024²。

検証の範囲と制限
・De Haarは実GLTFLoader→元4096²×3GPU転送→実描画を確認。
  DPR1(640×400 CSS)、DPR2(320×200 CSS=640×400描画)を確認。
  最大異方性16、scale1、目線1.65、本物の門の照準判定を確認。
・1280×800描画のDPR2テストはサンドボックスのSwiftShaderがクラッシュ。
  対策として本番のDPRや画像を下げていません。実機の高解像度fpsは未測定。
・博物館8Kを含む全経路回帰は、テスト側だけGPU転送・drawを無効化して
  実データ解析・BVH・native門・経路・元pose復元・503復帰と再試行を確認。
  これを8K実GPU描画確認とは扱っていません。
・既存全室と既存3連結、階段・移動・ジャンプ・感度・ライトの回帰PASS。
  maps.jsは変更していません。GPU抑制は本番HTML・アプリにはありません。

ファイル
index.html: 全アプリをinlineした完全可読HTML。別のapp.js/maps.jsは不要。
assets/dehaar.glb: 正常SwissTransfer原本。期限付きURLには実行時依存しません。
HTTP200でも欠損していたCatbox lxn50x版は使用していません。

利用条件
Sponza: Frank Meinl/Crytek, Marko Dabrovic, PBR Alexandre Pestana。
SheenChair: Khronos glTF Sample Assets。Poly Haven素材・樽: CC0。
three.js / three-mesh-bvh: MIT。
ユーザー提供GLB・セラーの原作者/再利用ライセンスは未確認です。
公開・再配布・商用利用前に権利確認をお願いします。
