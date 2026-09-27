// =====================================================================
//  教材カタログ ― 講師画面の「おすすめテキスト」の元データ
//  元: 伊藤先生「教材まとめ」（2026-09）を、教科 × レベル × 用途 に整理したもの
//  ここを書き換えれば、おすすめの表示が変わります（push で反映）
//
//  level : basic=基礎 / standard=標準 / advanced=応用  （複数可）
//  uses  : point=ポイント確認 / practice=類題演習 / weak=弱点補強 / test=テスト形式  （複数可）
//  self  : true なら解説があり自学向き
//  note  : 特徴（伊藤先生のコメントを要約）
// =====================================================================
window.MATERIALS = {
  "英語": [
    { name: "フォレスタ ホライズン（無印）", level: ["standard"], uses: ["practice", "point"], note: "Unitに沿った文法＋教科書本文問題。解説なし（Point→Warm-up→Try→Exercise）" },
    { name: "フォレスタ ステップ", level: ["basic", "standard"], uses: ["weak", "point"], note: "プレステップ(復習)＋チェックテスト(苦手把握)＋単元別演習" },
    { name: "フォレスタ ゴール", level: ["advanced"], uses: ["test", "practice"], note: "チェックテスト＋単元別演習＋入試形式（並べ替え・長文など）。解説あり" },
    { name: "iワーク テキスト", level: ["standard"], uses: ["practice"], note: "教科書に沿った文法演習（数少ない）。説明少なめで扱いにくい" },
    { name: "iワーク プラス（白）", level: ["standard", "advanced"], uses: ["practice", "test"], note: "文法メインのまとめ問題・基礎側" },
    { name: "iワーク プラス（黒）", level: ["advanced"], uses: ["practice", "test"], note: "文法メインのまとめ問題・発展側" },
    { name: "新演習", level: ["standard", "advanced"], uses: ["practice", "weak"], note: "文法が並び、リーディングあり。付属の確認テストは文法の確認テストに◎" },
    { name: "Keyワーク", level: ["basic", "standard"], uses: ["practice", "test"], note: "教科書に沿っている。テスト対策ページ◎" },
    { name: "定期テスト対策ワーク", level: ["standard"], uses: ["test", "practice"], note: "ちょい難しい。必修とwimpassの中間。付属チェック＆トライ（チェック＝文法、トライ＝教科書内容）" },
    { name: "sirius", level: ["advanced"], uses: ["practice"], note: "文法演習、難易度高い" },
    { name: "新ワーク", level: ["standard"], uses: ["practice"], note: "難易度が微妙で刺さりにくい（優先度低）" },
  ],
  "数学": [
    { name: "フォレスタ（無印）", level: ["standard"], uses: ["practice", "point"], note: "単元別演習＋Key words（用語確認）。解説なし" },
    { name: "フォレスタ ドリル", level: ["basic", "standard"], uses: ["practice", "weak"], note: "無印のExerciseが大量にある演習用" },
    { name: "フォレスタ ステップ", level: ["basic"], uses: ["weak", "point"], note: "プレステップ(復習)＋チェックテスト＋単元別演習" },
    { name: "フォレスタ ゴール", level: ["advanced"], uses: ["test"], note: "チェックテスト＋学年ごと単元復習＋入試レベル（埼玉と対応なし）" },
    { name: "iワーク テキスト", level: ["basic", "standard", "advanced"], uses: ["point", "weak", "practice"], self: true, note: "細かくポイントで分かれて扱いやすい。復習・用語確認・難しめのまとめ問題もあり幅広い" },
    { name: "iワーク プラス（白／黒）", level: ["advanced"], uses: ["practice", "test"], note: "白も黒もまあまあ難易度高いので注意" },
    { name: "新演習", level: ["standard", "advanced"], uses: ["practice"], note: "説明ほぼなし、多パターン演習向き。付属確認テストは類題演習に" },
    { name: "Keyワーク", level: ["basic"], uses: ["practice", "test"], note: "難易度低めの演習として。例外は扱いにくい。対策ページ◎" },
    { name: "オンリーワン", level: ["standard"], uses: ["practice"], note: "演習教材としてよい" },
    { name: "必修テキスト", level: ["basic", "standard", "advanced"], uses: ["point", "practice"], note: "iワークっぽい。難易度が細かく分かれているので生徒に合わせて。付属サポートブックは類題演習的" },
    { name: "wimpass", level: ["standard", "advanced"], uses: ["practice", "test"], note: "よく出る問題が多くて良い。難しめ" },
    { name: "スマートワーク", level: ["standard"], uses: ["point", "practice"], self: true, note: "例題に解説あり。他はフォレスタっぽい。付属確認テストは満遍なく" },
    { name: "ワーク（付属確認テスト A/B）", level: ["standard", "advanced"], uses: ["practice", "test"], note: "ちょい難しい。確認テストはA/Bで難易度分け" },
    { name: "定期テスト対策ワーク", level: ["standard"], uses: ["practice", "test"], note: "いい具合の演習問題。付属チェック＆トライは易しめ・少なめ" },
    { name: "sirius", level: ["advanced"], uses: ["practice"], note: "よく出るやつを含んだ演習" },
    { name: "教科書ガイド", level: ["basic"], uses: ["point"], self: true, note: "自学教材として◎（解説豊富、問題数はない）" },
  ],
  "国語": [
    { name: "フォレスタ ステップ／ゴール", level: ["standard"], uses: ["practice"], note: "読解のやり方が載っているが埼玉対応なしで扱いにくい" },
    { name: "iワーク テキスト", level: ["standard"], uses: ["practice", "test"], note: "教科書内容、必修に似ているがアウトプット寄り" },
    { name: "iワーク プラス", level: ["advanced"], uses: ["practice"], note: "難易度高く時間がかかる。印刷の仕方に工夫" },
    { name: "必修テキスト", level: ["standard", "advanced"], uses: ["point"], note: "教科書内容。詳しいが難しい所あり。生徒に合わせて伝えるポイントを絞る。サポートブックは漢字学習◎" },
    { name: "定期テスト対策ワーク", level: ["basic", "standard"], uses: ["point", "practice", "test"], self: true, note: "インプットにも使える。易しめ。付属チェック＆トライはテスト的で扱いやすい" },
    { name: "Keyワーク", level: ["standard", "advanced"], uses: ["test"], note: "難しめ。定期テスト対策ページは直前確認に" },
    { name: "wimpass", level: ["standard"], uses: ["practice"], self: true, note: "読解演習。siriusより易しく解説が丁寧" },
    { name: "sirius", level: ["advanced"], uses: ["practice"], note: "読解演習、結構難しい" },
  ],
  "理科": [
    { name: "フォレスタ（無印）", level: ["standard"], uses: ["practice", "point"], note: "単元ごと復習。解説なし" },
    { name: "フォレスタ ステップ", level: ["basic"], uses: ["weak", "point"], note: "チェックテスト＋細かめの学年またぎ単元復習" },
    { name: "フォレスタ ゴール", level: ["advanced"], uses: ["test"], note: "チェックテスト＋広い範囲の単元復習＋入試問題" },
    { name: "iワーク テキスト", level: ["standard", "advanced"], uses: ["weak", "practice", "test"], note: "ポイント→確認→基本→標準の順。自学は難しいが深める学習・苦手克服に。語句／基本／総まとめはテストにも" },
    { name: "iワーク プラス（白）", level: ["standard"], uses: ["test"], note: "一問一答" },
    { name: "iワーク プラス（黒）", level: ["advanced"], uses: ["test", "practice"], note: "記述もあり難易度高い" },
    { name: "wimpass", level: ["standard", "advanced"], uses: ["practice", "test"], note: "定期テストによく出る問題がまとまっていてすごくいい。多パターン演習に" },
    { name: "定期テスト対策ワーク", level: ["basic", "standard"], uses: ["weak", "practice"], note: "広く浅い。苦手単元の導入に。付属チェック＆トライは類題演習に良い" },
    { name: "ワーク（付属確認テスト）", level: ["basic", "standard"], uses: ["test", "practice"], note: "一問一答、チェックテスト的。確認テストは類題演習向け" },
    { name: "sirius", level: ["advanced"], uses: ["practice", "weak"], note: "単語系・図形系もあり難易度高めだが良い教材。付属単元確認テストは苦手把握に（少なめ）" },
    { name: "必修テキスト", level: ["standard"], uses: ["point", "weak"], note: "幅広く扱いやすい。計算問題は少ないのでiワークで補う。サポートブックは苦手把握に" },
    { name: "Keyワーク", level: ["standard"], uses: ["test"], note: "定期テスト対策ページが結構よい。問題数は少ない" },
  ],
  "社会": [
    { name: "フォレスタ（無印）", level: ["standard"], uses: ["practice", "point"], note: "単元ごと復習。解説なし" },
    { name: "フォレスタ ステップ", level: ["basic"], uses: ["weak", "point"], note: "チェックテスト＋細かめの学年またぎ単元復習" },
    { name: "フォレスタ ゴール", level: ["advanced"], uses: ["test"], note: "チェックテスト＋広い範囲の単元復習＋入試問題" },
    { name: "iワーク テキスト", level: ["standard", "advanced"], uses: ["practice", "test"], note: "要点整理→確認→標準。アウトプット教材として" },
    { name: "iワーク プラス（白／黒）", level: ["standard", "advanced"], uses: ["test"], note: "白は一問一答、黒は記述あり" },
    { name: "Sirius", level: ["standard", "advanced"], uses: ["test", "practice"], note: "wimpassより扱いやすく難易度も適切。テスト前の確認テスト的に" },
    { name: "wimpass", level: ["advanced"], uses: ["practice"], note: "結構難しくわかりにくい部分も。高得点を狙う生徒の多パターン演習向け" },
    { name: "定期テスト対策ワーク", level: ["basic", "standard"], uses: ["practice", "test"], note: "ほぼ一問一答（フォレスタっぽい）。付属チェック＆トライも一問一答" },
    { name: "必修テキスト", level: ["basic", "standard"], uses: ["point", "weak"], note: "単語確認がメイン。図が多く、そういう問題の対策に。サポートブックは苦手単元を見つける用（網羅性低い）" },
  ],
  "その他": [],
};
