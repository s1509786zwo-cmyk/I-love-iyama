# GRAND ATLAS — GitHub / Vercel 配信版

**このZIPの中身をGitHubリポジトリの最上位へ入れてください。ZIPファイル自体や、ZIPを囲む親フォルダをアップロードする形ではありません。**

デ・ハール城の32MB GLBを8MiB以下の4ファイルに分割しました。ブラウザで元のGLBへバイト単位で結合し、SHA-256一致を確認してからGLTFLoaderで読み込みます。画質の縮小・画像再圧縮・メッシュ簡略化はしていません。`dehaar.glb`単体は不要です。

## 1. GitHubへ入れる

1. ZIPを展開する。
2. リポジトリの **Add file → Upload files** を開く。
3. 次のファイルとフォルダを、**中身を省かず**リポジトリ最上位へアップロードしてCommitする。

```text
index.html
vercel.json
package.json
assets/
  dehaar.manifest.json
  dehaar.001.31b61a92f65a.bin
  dehaar.002.c2d80ffc01ac.bin
  dehaar.003.07fc32f9aabd.bin
  dehaar.004.cdd55dae7c72.bin
scripts/
  verify-assets.mjs
```

`.nojekyll`、`.gitattributes`、`.gitignore`、`.github`も同梱しています。通常のGit管理用ファイルです。assetsは4つのbinが必須で、manifestだけでは動きません。ZIPだけを置いてもブラウザは展開しません。index.htmlはこの配布版で必ず上書きしてください。旧HTMLは`assets/dehaar.glb`を要求するので新しい分割ファイルを読み込めません。

## 2. Vercelで公開する（現在のサイトを更新する場合）

- 対象のGitHubリポジトリをVercelプロジェクトに接続する。
- **Root Directory：リポジトリ最上位（空欄／`.`）**。`assets`や`public`を指定しない。
- **Framework Preset：Other**。このプロジェクトはNext.js/Viteではありません。
- 設定は同梱`vercel.json`が指定。Build Commandは`node scripts/verify-assets.mjs`、Output Directoryは`.`。
- 以前の独自設定・全パスをindex.htmlへ転送するrewriteがある場合は、この配布版の設定に置き換える。
- デプロイ後のビルドログに `PASS: exact original GLB` が出ていることを確認。
- ページを再読み込みする。古いタブが残っていると旧HTMLを使い続けます。

必要ファイルが欠けている、Git LFSポインタに置き換わっている、破損している場合は、ビルドを失敗させて公開前に検出します。GitHubへのCommitだけでは、リポジトリに接続されていない既存Vercelサイトは更新されません。

## 3. GitHub Pagesで公開する場合

GitHubに置くだけでPagesが自動で有効になるわけではありません。
**Settings → Pages → Deploy from a branch → main（実際のブランチ）→ /(root) → Save**。
表示されたPages URLを使ってください。`github.com/.../blob/.../index.html`はゲームの実行URLではありません。

`https://ユーザー.github.io/リポジトリ名/`のようなサブフォルダ公開にも対応した相対URLです。Vercel用のビルド設定はGitHub Pagesでは無視されます。

## 確認するURL

公開サイトの`assets/dehaar.manifest.json`がJSONで開けることを確認してください。4つのbinも同じassetsフォルダにあります。**`assets/dehaar.glb`はこの方式では配置しないため、404でも正常です。アプリはこのURLを取得しません。**

読み込みに失敗した場合は、暗転より手前に実際のエラー理由を表示します。ファイル名・HTTPステータス・サイズ・SHA-256で原因を区別できます。

## 維持した内容・注意

- 全アプリ実装をindex.html内へinline。別のapp.jsやmaps.jsは不要。
- Sponza、既存全室、既存3連結、Hintze Hallを維持。最後の外マップだけDe Haar Castle。
- 元4096×4096 JPEG×3、526,868三角形、GLB32,290,368 bytesを無改変。
- SHA256：`ab30453bf313e4ce758d206c51d3ac81b1e9aaf9384e2c5e6d5a1ac24866c295`。
- 目線1.65m、元メッシュの床・壁Raycast/BVH、門から中庭へ元pose帰還。
- DPR=min(devicePixelRatio,2)。強制縮小・adaptive DPRなし。
- 1クリックFPS操作、感度、Spaceジャンプ、F/Lライトを維持。
- GitHubへ入れるための分割であり、VRAM消費やGPU負荷を減らす処理ではありません。弱いGPUのメモリ不足、元スキャンのぼけ・欠損、外部サービスの通信障害は別問題として残ります。60fpsは保証しません。
- 既存モデル・Hintze Hall・three.js・素材には外部通信が必要。完全オフライン版ではありません。
- file://の直開きではなくHTTPSの公開サイトかlocalhostのHTTPで起動してください。
- ユーザー提供GLB・セラーの権利条件は未確認。公開・再配布・商用利用前に確認が必要です。

## ローカル確認（任意）

```sh
node scripts/verify-assets.mjs
python3 -m http.server 8080
```

`http://localhost:8080/`を開きます。Python不要の本番Vercel/GitHub Pagesでも同じ静的ファイルで動きます。npm installは不要です。
