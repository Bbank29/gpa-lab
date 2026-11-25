-- =========================================================
--  ฐานข้อมูล SQLite: โปรแกรมทดลองคำนวณเกรดเฉลี่ยสะสม (GPA)
--  ไฟล์ฐานข้อมูลจริงคือ data/gpa_lab.db (สร้างเองอัตโนมัติตอนเว็บทำงานครั้งแรก)
--  เปิดดูได้ด้วย DB Browser for SQLite
-- =========================================================

-- 1. admins : บัญชีผู้ดูแลระบบ
--    role = 'super' (ซุปเปอร์แอดมิน) หรือ 'admin' (แอดมินทั่วไป)
--    password_hash = รหัสผ่านที่เข้ารหัสทางเดียวด้วย bcrypt (ไม่เก็บรหัสจริง)
CREATE TABLE IF NOT EXISTS admins (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  username       TEXT    NOT NULL UNIQUE,
  password_hash  TEXT    NOT NULL,
  display_name   TEXT    NOT NULL,
  role           TEXT    NOT NULL DEFAULT 'admin' CHECK (role IN ('super', 'admin')),
  created_at     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 2. feedback : แบบประเมิน (ดาว + ความคิดเห็น + วันเวลา รวมในตารางเดียว)
--    1 แถว = การกดส่งแบบประเมิน 1 ครั้ง / ไม่เก็บชื่อคนประเมินและไม่เก็บเกรดที่กรอก
CREATE TABLE IF NOT EXISTS feedback (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  stars       INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback (created_at);
