<?php
/* =========================================================
   ส่วนกลางของ API: เปิดฐานข้อมูล, เซสชันแอดมิน, ตอบกลับเป็น JSON
   ========================================================= */

declare(strict_types=1);

// ไฟล์ฐานข้อมูล SQLite (อยู่นอกโฟลเดอร์ api และกันไม่ให้ดาวน์โหลดผ่านเว็บด้วย data/.htaccess)
const DB_FILE = __DIR__ . '/../data/gpa_lab.db';
const SCHEMA_FILE = __DIR__ . '/../database/schema.sqlite.sql';

session_set_cookie_params(['httponly' => true, 'samesite' => 'Strict']);
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function db(): PDO
{
    static $pdo = null;
    if ($pdo) return $pdo;

    $dir = dirname(DB_FILE);
    if (!is_dir($dir)) mkdir($dir, 0775, true);

    $pdo = new PDO('sqlite:' . DB_FILE);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec(file_get_contents(SCHEMA_FILE));   // สร้างตารางถ้ายังไม่มี (บัญชีซุปเปอร์แอดมินสร้างด้วย php setup.php)
    return $pdo;
}

function out(array $data, int $code = 200): never
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// อ่านข้อมูลที่ส่งมาแบบ JSON (รับเฉพาะ application/json กันการส่งฟอร์มข้ามเว็บ)
function body(): array
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') return [];
    if (!str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'application/json')) out(['error' => 'bad_request'], 400);
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    return is_array($data) ? $data : [];
}

function me(): ?array
{
    if (empty($_SESSION['admin_id'])) return null;
    $q = db()->prepare('SELECT id, username, display_name, role FROM admins WHERE id = ?');
    $q->execute([$_SESSION['admin_id']]);
    return $q->fetch() ?: null;
}

function require_admin(): array
{
    return me() ?? out(['error' => 'unauthorized'], 401);
}

function require_super(): array
{
    $me = require_admin();
    if ($me['role'] !== 'super') out(['error' => 'forbidden'], 403);
    return $me;
}

function text(array $b, string $key, int $max): string
{
    return mb_substr(trim((string) ($b[$key] ?? '')), 0, $max);
}
