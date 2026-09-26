// =====================================================================
//  設定ファイル  ― あとで変えたくなる項目はここにまとめてあります
//  変更して GitHub の main に push（または GitHub 上で編集して Commit）すると 1〜2 分で反映されます
// =====================================================================
window.APP_CONFIG = {

  // --- Supabase の接続先 ---
  // 空欄のままだと「お試しモード」（このブラウザの中だけに保存）で動きます
  SUPABASE_URL: "https://lwrjktjccutdhticabsi.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_eDlgtQQ5lt9zHmmZELZ_LA_P50PFTYW",

  // --- 表示名 ---
  APP_NAME: "質問・プリント",
  JUKU_NAME: "",                 // 例: "○○塾 △△校"（空でもOK。トップに小さく表示）

  // --- 選択肢 ---
  CLASSROOMS: ["3階大教室", "個別部屋", "2階中教室"],
  GRADES: ["中1", "中2", "中3"],
  SUBJECTS: ["英語", "数学", "国語", "理科", "社会", "その他"],

  // --- プリントの目的（生徒が選ぶ。上から優先度が高い） ---
  // key は記録に保存される値。label は画面表示。needsCheck: true のものは下のチェック項目を先に確認させる
  PRINT_PURPOSES: [
    { key: "point",    label: "苦手だからポイント確認から", needsCheck: false },
    { key: "practice", label: "類題演習用",                 needsCheck: true },
    { key: "weak",     label: "弱点補強用",                 needsCheck: true },
    { key: "test",     label: "テスト形式",                 needsCheck: true },
  ],
  // プリントを頼む前のチェック項目（needsCheck の目的のときに聞く）
  PRINT_CHECKS: [
    { key: "work",  label: "ワークはやった？" },
    { key: "test",  label: "テスト形式はやった？" },
    { key: "range", label: "範囲表は確認した？" },
  ],
  // 量と難易度
  PRINT_AMOUNTS:      [{ key: "S", label: "少なめ" }, { key: "M", label: "ふつう" }, { key: "L", label: "多め" }],
  PRINT_DIFFICULTIES: [{ key: "basic", label: "基礎" }, { key: "standard", label: "標準" }, { key: "advanced", label: "応用" }],

  // --- 質問の急ぎ度の表示 ---
  URGENCY_LABELS: { now: "早めに来てほしい", later: "あとででOK" },
  // 質問の前の確認（「まだ」を選ぶと質問に進めない）
  THINKING_CHECK: { question: "シンキングした？（自分で考えてみた？）", yes: "した", no: "まだ",
                    nudge: "まずは自分で5分考えてみよう。ノートに途中まで書いてみて、それでも分からなければ質問OK！" },

  // --- 完了メモの定型文（講師画面のボタンになる） ---
  MEMO_TEMPLATES: ["理解できた", "要フォロー", "類題を渡した", "宿題にした", "次回に持ち越し", "保護者に連絡希望"],
  // 集計で「要フォロー件数」として数える定型文
  FOLLOW_TAG: "要フォロー",

  // --- 自動更新の間隔（秒） ---
  REFRESH_SEC_TEACHER: 5,
  REFRESH_SEC_STUDENT: 10,

  // --- 「早めに来てほしい」の待ち時間がこの分数を超えたら講師画面で強調・再アラート ---
  URGENT_ALERT_MIN: 5,

  // --- 共有端末で入力を放置したら自動でホームに戻す秒数 ---
  SHARED_IDLE_SEC: 180,

  // --- 席番号（使わないので非表示） ---
  SEAT_ENABLED: false,
  SEAT_INPUT: "number",
  SEAT_REQUIRED: false,
};
