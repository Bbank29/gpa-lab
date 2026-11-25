-- =========================================================
--  ฐานข้อมูล: โปรแกรมทดลองคำนวณเกรดเฉลี่ยสะสม (GPA)
--  เวอร์ชัน MySQL / MariaDB (สำรองไว้ ระบบตอนนี้ใช้ SQLite: database/schema.sqlite.sql)
--  ถ้าจะย้ายไป MySQL ต้องแก้การเชื่อมต่อใน api/common.php ด้วย
--
--  มี 2 ตาราง
--    1. admins    = บัญชีผู้ดูแลระบบ
--    2. feedback  = แบบประเมิน (ดาว + ความคิดเห็น + วันเวลา รวมในตารางเดียว)
--
--  วิธีใช้: เลือกฐานข้อมูลของคุณก่อน แล้วรันไฟล์นี้ทั้งไฟล์
--  (phpMyAdmin → เลือกฐานข้อมูล → แท็บ Import หรือ SQL → วางแล้วกด Go)
-- =========================================================

SET NAMES utf8mb4;


-- ---------------------------------------------------------
-- 1. admins : บัญชีผู้ดูแลระบบ
-- ---------------------------------------------------------
-- role
--   'super' = ซุปเปอร์แอดมิน: เพิ่ม/ลบ/แก้ชื่อและตั้งรหัสใหม่ให้แอดมินทั่วไปได้
--   'admin' = แอดมินทั่วไป: ดูแดชบอร์ดและความคิดเห็นได้อย่างเดียว
--
-- password_hash
--   เก็บรหัสผ่านแบบเข้ารหัสทางเดียว (bcrypt) ไม่เก็บรหัสจริง
--   ตอนเข้าสู่ระบบให้ตรวจด้วย password_verify() ของ PHP
--   ตอนตั้งรหัสใหม่ให้สร้างด้วย password_hash($รหัส, PASSWORD_DEFAULT)

CREATE TABLE IF NOT EXISTS admins (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  username       VARCHAR(50)   NOT NULL,                   -- ชื่อผู้ใช้สำหรับเข้าสู่ระบบ (ห้ามซ้ำ)
  password_hash  VARCHAR(255)  NOT NULL,                   -- รหัสผ่านที่เข้ารหัสแล้ว
  display_name   VARCHAR(100)  NOT NULL,                   -- ชื่อที่แสดง
  role           ENUM('super', 'admin') NOT NULL DEFAULT 'admin',   -- ระดับ
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- วันเวลาที่สร้างบัญชี
  PRIMARY KEY (id),
  UNIQUE KEY uq_admins_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------
-- 2. feedback : แบบประเมินความพึงพอใจ
-- ---------------------------------------------------------
-- 1 แถว = การกดส่งแบบประเมิน 1 ครั้ง
-- ไม่เก็บชื่อหรือข้อมูลส่วนตัวของคนประเมิน และไม่เก็บเกรดที่กรอก

CREATE TABLE IF NOT EXISTS feedback (
  id          INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  stars       TINYINT UNSIGNED  NOT NULL,                  -- จำนวนดาว 1–5
  comment     TEXT              NULL,                      -- ข้อเสนอแนะ (ไม่บังคับ ไม่เกิน 300 ตัวอักษร)
  created_at  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- วันและเวลาที่ส่ง (เก็บรวมช่องเดียว)
  PRIMARY KEY (id),
  KEY idx_feedback_created_at (created_at),
  CONSTRAINT chk_feedback_stars CHECK (stars BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



-- =========================================================
--  คำสั่งสำหรับดูข้อมูล (คัดลอกไปรันทีละคำสั่งได้)
-- =========================================================

-- ดูโครงสร้างตาราง (มีช่องอะไรบ้าง)
-- DESCRIBE admins;
-- DESCRIBE feedback;

-- ดูรายชื่อแอดมินทั้งหมด (ไม่แสดงรหัส)
-- SELECT id, username, display_name, role, created_at FROM admins ORDER BY role DESC, id;

-- ดูแบบประเมินทั้งหมด ล่าสุดอยู่บน
-- SELECT id, stars, comment, created_at FROM feedback ORDER BY created_at DESC;

-- ดูเฉพาะที่มีความคิดเห็น
-- SELECT stars, comment, created_at FROM feedback WHERE comment IS NOT NULL AND comment <> '' ORDER BY created_at DESC;

-- คะแนนเฉลี่ยและจำนวนผู้ประเมิน (ใช้บนแดชบอร์ด)
-- SELECT ROUND(AVG(stars), 1) AS avg_stars, COUNT(*) AS total FROM feedback;

-- จำนวนคนที่ให้แต่ละระดับดาว (ใช้ทำกราฟแท่ง)
-- SELECT stars, COUNT(*) AS total FROM feedback GROUP BY stars ORDER BY stars DESC;
