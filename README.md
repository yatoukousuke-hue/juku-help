# プリント依頼・質問ヘルプ アプリ

塾（中学生向け）の教室で、生徒が「プリントがほしい」「質問したい」をその場で送り、講師が一覧で順番に対応するためのアプリです。依頼と対応の記録はすべて残り、保護者報告のもとになる文章や CSV を出せます。

## 公開中の URL

- 生徒画面：https://yatoukousuke-hue.github.io/juku-help/
- 講師画面：https://yatoukousuke-hue.github.io/juku-help/teacher.html
- 掲示用QR：https://yatoukousuke-hue.github.io/juku-help/qr.html

現在の状態と更新のしかたは [docs/04_公開情報（現在の状態）.md](docs/04_公開情報（現在の状態）.md) を参照。

## まず読むもの

1. [docs/04_公開情報（現在の状態）.md](docs/04_公開情報（現在の状態）.md) … URL・残作業・更新方法
2. [docs/03_運用ガイド.md](docs/03_運用ガイド.md) … 毎日の使い方・設定の変え方
3. [docs/01_構成案と画面イメージ.md](docs/01_構成案と画面イメージ.md) … 仕組みと画面の説明
4. [docs/02_セットアップ手順.md](docs/02_セットアップ手順.md) … 最初から作り直す場合の手順（Supabase の準備は完了済み）

## すぐ試す

`app/index.html` をブラウザで開くと「お試しモード」で動きます（データはそのブラウザ内だけ）。
講師画面は `app/teacher.html`、合言葉は `sensei`。名簿にはサンプルの生徒が入っています。

## 構成

- 画面：ただの HTML/JS（`app/`）。Netlify にドラッグ＆ドロップで公開
- データ：Supabase（無料）。`supabase/schema.sql` を 1 回実行
- 設定：`app/config.js` に集約（教室・教科・定型メモ・更新間隔など）

## 開発用（運用には不要）

`dev/test_schema.mjs` は `schema.sql` を WASM 版 Postgres で実行して動作確認するテストです。

```bash
node dev/test_schema.mjs
```
