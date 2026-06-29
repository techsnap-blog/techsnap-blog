# TechSnap ブログ — Netlifyへのデプロイ手順

## フォルダ構成

```
blog/
├── index.html          ← トップページ
├── about.html          ← Aboutページ（任意で作成）
├── css/
│   ├── style.css       ← 共通スタイル
│   └── article.css     ← 記事ページ用スタイル
├── js/
│   └── main.js         ← カテゴリフィルターなど
└── articles/
    └── sample.html     ← 記事テンプレート
```

## Netlifyへのデプロイ手順

### 方法①：ドラッグ＆ドロップ（最も簡単）

1. https://app.netlify.com にアクセス（無料アカウント作成）
2. 「Sites」タブを開く
3. `blog` フォルダをブラウザ上にドラッグ＆ドロップ
4. 数秒でURLが発行される（例：`https://xxx.netlify.app`）

### 方法②：GitHubと連携（更新が楽になる）

1. GitHubに無料アカウントを作成
2. 新しいリポジトリを作成して `blog` フォルダの中身をアップロード
3. Netlifyで「Add new site → Import an existing project」
4. GitHubリポジトリを選択して連携
5. 以降はGitHubにファイルをアップするだけで自動デプロイされる

## 記事を追加する方法

1. `articles/sample.html` をコピーして `articles/新記事名.html` として保存
2. タイトル・本文・スコアを書き換える
3. `index.html` の記事一覧に新しいカードを追加する

## アフィリエイトリンクの設置場所

各記事ファイル内の `.affiliate-box` 内の `href="#"` を
実際のAmazonアソシエイト/楽天アフィリエイトのURLに置き換えてください。

```html
<a href="https://www.amazon.co.jp/dp/XXXXXXXXXX?tag=あなたのタグ" class="aff-btn amazon">
  Amazonで見る
</a>
```

## カスタムドメインの設定（任意）

Netlify管理画面 → Site settings → Domain management から
独自ドメインを無料で設定できます。
お名前.comなどでドメインを取得（年間1,000〜2,000円程度）し、
DNSをNetlifyに向けるだけです。
