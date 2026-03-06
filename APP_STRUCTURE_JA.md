# HR-CRM アプリ構造仕様（AI連携用）

この文書は、現在のアプリの**機能構造**と**UI構造**を、別のAI/開発者が短時間で理解できるように整理したものです。

## 1. システム概要
- 目的: 人材紹介/新卒支援向けCRM。学生管理、イベント管理、面談ログ管理、リードタイム/KPI可視化を行う。
- 構成:
  - フロント: Vue 3 + TypeScript + Vite
  - バックエンド: Express + TypeScript
  - DB: PostgreSQL（Supabase接続前提）
  - 認証: JWT
- デプロイ:
  - フロント: Vercel
  - API: Render（またはVercel Serverless構成も準備済み）

## 2. 主要ディレクトリ
- `/Users/maekawahiroyuki/hr-crm/frontend`: Vueアプリ
- `/Users/maekawahiroyuki/hr-crm/backend`: APIサーバー
- `/Users/maekawahiroyuki/hr-crm/vercel.json`: APIをVercelに載せる場合のルーティング設定

## 3. 認証・権限モデル
- ログイン: `POST /api/auth/login`（JWT発行）
- JWTの保持: フロントの `localStorage.token`
- 役割:
  - `admin`: 全学生・全機能
  - `staff`: 自分担当学生中心（API側で `staff_id` フィルタ）
- 招待登録:
  - 管理者が招待URL発行
  - 招待トークンで担当者が自分でパスワード設定

## 4. 画面構造（Vueルーティング）
ルーター: `/Users/maekawahiroyuki/hr-crm/frontend/src/router/index.ts`

- `/login`: ログイン
- `/register`: 招待登録
- `/dashboard`: 全体ダッシュボード（ヨミ表、面談・流入KPI）
- `/students`: 学生一覧（フィルタ、CSV入出力、一括運用）
- `/students/:id`: 学生詳細（基本情報、面談スケジュール、ログ、タスク、イベント紐付け）
- `/events`: イベント一覧（カード、カレンダー、新規作成/編集）
- `/events/:id`: イベント詳細（参加学生、担当者、A/B/C/XAステータス管理）
- `/lead-time`: リードタイム専用ビュー
- `/event-kpi`: イベントKPI逆算ビュー
- `/settings`: 流入経路カテゴリ等の設定

## 5. UIの主要設計
- 共通レイアウト: 左サイドバー + 上部ヘッダー + メインコンテンツ
- レスポンシブ:
  - モバイル/タブレットでフィルタやテーブルをカード/折りたたみで運用
  - サイドバーは開閉対応
- 学生一覧:
  - 主カラム例: 流入経路、氏名、大学、文理、卒業年度、担当、ステータス、進捗、次回面談日、タスク履行日など
  - CSV入出力、フィルタ複数条件、即時編集（ステータス・進捗・担当等）
- 学生詳細:
  - 基本情報カード（編集可）
  - 面談スケジュール（流入日/面談/リスケ、日付、実施管理）
  - ログ（時系列、追加/削除）
  - タスク（日付+内容、完了で非表示）
  - イベントエントリー管理（A/B/C/XA）
- イベント:
  - イベントカード + カレンダー表示
  - 複数開催日対応
  - LPリンク、単価、目標人数、各ステータス人数、不足数を表示
  - 詳細で参加者検索・担当者表示・ステータス更新
- ダッシュボード:
  - 面談KPI（設定数、初回面談数、2回目面談数、実施率、リードタイム）
  - 流入経路別/担当者別比較
  - ヨミ表（A/B/C/XAをイベントごとに可視化）

## 6. バックエンドAPI構造
ルート定義:
- `/Users/maekawahiroyuki/hr-crm/backend/src/routes/authRoutes.ts`
- `/Users/maekawahiroyuki/hr-crm/backend/src/routes/studentRoutes.ts`
- `/Users/maekawahiroyuki/hr-crm/backend/src/routes/eventRoutes.ts`

主要エンドポイント（抜粋）:
- 認証:
  - `POST /api/auth/login`
  - `POST /api/auth/register-invite`
  - `POST /api/auth/invite`（管理者）
  - `GET /api/auth/users`
- 学生:
  - `GET /api/students`
  - `POST /api/students`
  - `GET /api/students/:id`
  - `PUT /api/students/:id`（基本情報）
  - `PUT /api/students/:id/meta`（ステータス/進捗/次回面談/ネクストアクション等）
  - `PUT /api/students/:id/staff`
  - `DELETE /api/students/:id`
  - `POST /api/students/import`（CSV取込）
  - `GET /api/students/metrics/interviews`
  - 面談スケジュール: 作成/更新/削除
  - タスク: 追加/完了/削除
  - 流入経路カテゴリ: 取得/作成/削除
- イベント:
  - `GET /api/events`
  - `POST /api/events`
  - `PUT /api/events/:id`
  - `GET /api/events/:id`
  - `PUT /api/events/:id/participants/:studentId`
  - `DELETE /api/events/:id`

## 7. DB構造（主要テーブル）
- `users`: ログインユーザー（admin/staff）
- `invites`: 招待トークン
- `students`: 学生本体（流入経路、大学、文理、進捗、担当、面談日など）
- `student_tasks`: 学生タスク（期限・内容・完了フラグ）
- `interview_logs`: 学生ログ（面談/エントリー等）
- `interview_schedules`: 面談スケジュール（round_no, scheduled_at, actual_at, status, reschedule_count）
- `events`: イベント本体（目標値、売上、単価、LP、KPI比率）
- `event_dates`: イベント複数開催日
- `student_events`: 学生×イベント参加状態
- `source_categories`: 流入経路マスタ

## 8. ドメイン値（代表）
- 学生ステータス（紹介ステータス）:
  - `キーマン`, `出そう`, `ほぼ無理ワンチャン`, `無理`, `不明`
- 進捗:
  - `面談調整中`, `初回面談`, `2回目面談`, `顧客化`, `トビ`
- 面談理由:
  - `企業相談`, `就活相談`, `面接対策`
- イベント参加ステータス:
  - `A_ENTRY`（エントリー）
  - `B_WAITING`（回答待ち）
  - `C_WAITING`（回答待ち）
  - `XA_CANCEL`（エントリーキャンセル）

## 9. CSV運用仕様（概要）
- 学生CSVインポートは重複回避あり（キーは実装に依存）
- 一括更新用途にも対応（既存学生を更新）
- 取込時に面談日・進捗・担当などを更新可能
- インポート処理はトランザクションで実行（失敗時ロールバック）

## 10. KPI・リードタイム算出の考え方
- 初回面談リードタイム:
  - 流入/設定基準日から初回面談実施日までの日数
- 初回面談実施率:
  - 面談設定済み母数に対する実施完了数
- 2回目以降:
  - 前回実施日時との差分で算出
- イベントKPI:
  - 着座目標/エントリー目標/面談数/流入数を率から逆算可能

## 11. CORS/環境変数（重要）
- CORSは `ALLOWED_ORIGINS`（カンマ区切り）を参照
- ログイン系は互換対応で許可を広げる構成
- 代表的な環境変数:
  - `PORT`
  - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
  - `JWT_SECRET`
  - `ALLOWED_ORIGINS`
  - `APP_URL`

## 12. 現在の設計意図
- 実運用重視で、CSV一括運用・担当者運用・イベントごとの売上/見込み可視化を優先
- UIは現場オペレーション速度優先（一覧で編集、詳細で深掘り）
- DBはSupabase前提だが、PostgreSQL互換のため将来の自社移行を想定
