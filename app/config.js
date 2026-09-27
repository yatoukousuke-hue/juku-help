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
  // 中学校（学校ごとに教科書の範囲が違うため依頼に持たせる。最後の「その他」は自由入力）
  SCHOOLS: ["水谷", "本郷", "富士見東", "志木", "宗岡"],
  SCHOOL_OTHER: "その他",
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

  // --- 範囲の入力欄（教科ごとに言い方を変える。default は英語以外） ---
  // required: true なら必ず書かせる（プリント・質問とも）
  RANGE_FIELDS: {
    "英語":    { label: "教科書のユニット", placeholder: "例: Unit 3（分かれば p.28〜31 も）", required: true },
    "default": { label: "教科書のページ",   placeholder: "例: p.32〜35（ワークなら「ワーク p.12」）", required: true },
  },

  // --- 講師側「プリント指示書」の文面テンプレート ---
  // {} の中は自動で置き換わります: date, grade, name, school, subject, purpose, unit, range,
  //   difficulty, amount, content, checks, reason, teacher, score, target, level, texts
  PRINT_SLIP_TEMPLATE:
"【プリント作成依頼】{date}\n" +
"{grade} {name}さん（{school}）　{subject}\n" +
"目的：{purpose}\n" +
"単元：{unit}\n" +
"範囲：{range}\n" +
"難易度：{difficulty}　／　量：{amount}\n" +
"事前チェック：{checks}{reason}\n" +
"本人の補足：{content}\n" +
"直近の点数：{score}　目標：{target}　→ おすすめレベル：{level}\n" +
"テキスト候補：{texts}\n" +
"\n" +
"上記の範囲から、{difficulty}レベルの「{purpose}」プリントを{amount}で作ってください。\n" +
"・教科書の該当範囲（{range}）で扱う内容だけを使う\n" +
"・問題番号を付け、最後に解答をまとめて付ける\n" +
"・つまずきやすいポイントを1〜2行で添える",

  // --- おすすめテキストのレベル判定（講師画面。点数と目標から 基礎/標準/応用 を決める） ---
  // 直近の点数: 〜49 → 基礎、50〜74 → 標準、75〜 → 応用
  SCORE_BANDS: { standard: 50, advanced: 75 },
  // 目標点: これ以上なら「標準以上」を勧め、これ未満なら「基礎から」を勧める
  TARGET_HIGH: 85,
  TARGET_LOW: 60,
  // 直近プリント履歴を見る日数
  RECENT_PRINT_DAYS: 14,

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
