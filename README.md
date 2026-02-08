# HR-CRM（新卒向け）

## 概要
新卒向けの人材CRMです。主な機能：
- JWTログイン
- 学生管理（CA担当割り当て）
- イベント管理（カード表示・目標/実績売上）
- 面談ログ（エントリー時にイベント紐付け）
- CA自己登録（招待URL）

## 起動方法（ローカル）
### バックエンド
```bash
cd /Users/maekawahiroyuki/hr-crm/backend
npm run dev
```

### フロントエンド
```bash
cd /Users/maekawahiroyuki/hr-crm/frontend
npm run dev
```

ブラウザ：
- http://localhost:5173/login

## 環境変数（バックエンド）
ファイル：`/Users/maekawahiroyuki/hr-crm/backend/.env`

Supabase Pooler の例：
```
DB_HOST=aws-1-ap-southeast-2.pooler.supabase.com
DB_USER=postgres.gpehiglyidgrwgmgllur
DB_PASSWORD=YOUR_DB_PASSWORD
DB_NAME=postgres
DB_PORT=6543
JWT_SECRET=dev_secret_change_me
```

## DB作成（Supabase）
### スキーマ
Supabase SQL Editorで実行：
- `/Users/maekawahiroyuki/hr-crm/backend/schema.sql`

### 学生データ投入
Supabase SQL Editorで実行：
- `/Users/maekawahiroyuki/hr-crm/student_seed.sql`

## 管理者ログイン
- username: `admin`
- password: `password`

## CA登録（招待URL）
1. 管理者でログイン
2. ダッシュボードで「招待URL発行」
3. CAへURL共有
4. CAが `/register` で自己登録

## 学生管理
- 学生一覧：`/students`
- 管理者は一覧からCAを割り当て可能
- CAが新規登録した学生は自動で紐付け

## イベント管理
- 一覧：`/events`
- カードに表示される内容：
  - イベント名
  - 目標着座人数
  - エントリー数
  - 目標売上 / 実績売上
  - エントリー者一覧

## 学生詳細
- 左：基本情報カード + 既存ログ
- 右：ログ種別プルダウン + メモ入力
- エントリーの場合はイベントを選択可能
