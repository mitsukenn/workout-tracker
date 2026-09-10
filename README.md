# 筋トレ記録アプリ (Workout Tracker)

日々のトレーニング記録や、ジム外での活動（スクワット等）を記録・管理するためのWebアプリケーションです。
React + Vite + Tailwind CSS を使用して構築されています。

## プロジェクト構成

このプロジェクトの主要なフォルダ構成は以下の通りです。

```text
my-workout-app/
├── public/          # 静的ファイル（画像、アイコンなど）
├── src/             # ソースコード（Reactコンポーネント、スタイル、ロジック）
├── dist/            # ビルド生成物（npm run build で生成される公開用ファイル）
├── node_modules/    # ライブラリ依存関係（npm install で生成）
├── .github/         # GitHub設定（Actionsワークフローなど）
└── README.md        # プロジェクト説明書（このファイル）
```

## 開発の始め方

1. 依存関係のインストール
   ```bash
   npm install
   ```

2. 開発サーバーの起動
   ```bash
   npm run dev
   ```

3. ビルド（公開用ファイルの作成）
   ```bash
   npm run build
   ```

## データの保存について（重要）

記録は **Supabase（クラウド）が正**、localStorage はオフライン用のキャッシュです。
localStorage は iOS が7日程度で勝手に消すため、単体では保管場所になりません。

### 初回セットアップ

1. https://supabase.com でプロジェクトを作成する
2. SQL Editor で `supabase/schema.sql` を貼り付けて実行する
3. Project Settings → API から `Project URL` と `anon / publishable key` をコピーする
4. ローカル用：`.env.example` を `.env.local` にコピーして貼り付ける
5. **公開版用：GitHub の Settings → Secrets and variables → Actions に登録する**

| Secret 名 | 用途 |
|---|---|
| `VITE_SUPABASE_URL` | 公開版のビルドに埋め込む接続先 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 公開版のビルドに埋め込む公開キー |
| `SUPABASE_URL` | 毎日のバックアップ・週次LINE通知用 |
| `SUPABASE_SERVICE_ROLE_KEY` | 同上（Project Settings → API の service_role） |
| `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_USER_ID` | 週次LINE通知用 |

5番を忘れると、**公開版だけがクラウド保存なしになって記録が消えます**。
これを防ぐため、ビルド時に Secrets の有無とバンドルへの埋め込みを検証し、
足りなければデプロイを中止するようにしてあります。

### データを失わないための仕組み

- **読み込みに成功するまでクラウドへ書き込まない** — 圏外で開いても記録が消えない
- **全削除＋全挿入をやめた** — upsert と差分削除のみ。通信が途切れても消えない
- **1回の同期で50件を超える削除は中止する** — 想定外の全消しを止める安全装置
- **同期状態を画面に常時表示** — 「⚠ クラウド未保存」が出たら保存できていない
- **毎日バックアップ** — `.github/workflows/daily-backup.yml` が全テーブルをJSONで保存し、
  Actions のアーティファクトに90日間残す。同時に Supabase 無料枠の自動停止も防ぐ
- **手動バックアップ** — 設定画面からJSONの書き出し・取り込みができる
