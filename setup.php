<?php
/* =========================================================
   ติดตั้งระบบครั้งแรก / ตั้งรหัสซุปเปอร์แอดมินใหม่ (กรณีลืมรหัส)
   รันในเครื่องเซิร์ฟเวอร์เท่านั้น:  php setup.php
   รันซ้ำได้ ไม่ลบข้อมูลเดิม
   ========================================================= */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {   // เปิดผ่านเว็บไม่ได้
    http_response_code(404);
    exit;
}

function fail(string $msg): never
{
    fwrite(STDERR, "ไม่ผ่าน: $msg\n");
    exit(1);
}

function ask(string $label, bool $hidden = false): string
{
    echo $label;
    static $isTty = null;   // ตรวจครั้งเดียวก่อนเริ่มอ่าน
    $isTty ??= DIRECTORY_SEPARATOR === '/' && stream_isatty(STDIN);
    $tty = $hidden && $isTty;   // ไม่โชว์รหัสตอนพิมพ์ (Mac / Linux)
    if ($tty) shell_exec('stty -echo < /dev/tty');
    $line = fgets(STDIN);
    if ($tty) {
        shell_exec('stty echo < /dev/tty');
        echo "\n";
    }
    if ($line === false) fail('ไม่ได้รับข้อมูล');
    return rtrim($line, "\r\n");
}

// 1. ตรวจเครื่อง
if (PHP_VERSION_ID < 80100) fail('ต้องใช้ PHP 8.1 ขึ้นไป (เครื่องนี้ ' . PHP_VERSION . ')');
foreach (['pdo_sqlite', 'mbstring', 'session', 'json'] as $ext) {
    if (!extension_loaded($ext)) fail("ยังไม่ได้เปิดส่วนเสริม PHP: $ext");
}
$dir = __DIR__ . '/data';
if (!is_dir($dir)) fail('ไม่พบโฟลเดอร์ data');
if (!is_writable($dir)) fail('เขียนโฟลเดอร์ data ไม่ได้ ตรวจสิทธิ์ของโฟลเดอร์');
echo 'ตรวจเครื่องผ่าน (PHP ' . PHP_VERSION . ")\n";

// 2. สร้างฐานข้อมูล + ตาราง (มีอยู่แล้วใช้ของเดิม)
$pdo = new PDO("sqlite:$dir/gpa_lab.db");
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->exec(file_get_contents(__DIR__ . '/database/schema.sqlite.sql'));
echo "ฐานข้อมูลพร้อม: data/gpa_lab.db\n";

// 3. บัญชีซุปเปอร์แอดมิน
$row = $pdo->query("SELECT id, username FROM admins WHERE role = 'super' ORDER BY id LIMIT 1")->fetch(PDO::FETCH_ASSOC);
if ($row) {
    echo "มีซุปเปอร์แอดมินแล้ว: {$row['username']}\n";
    if (strtolower(trim(ask('ตั้งรหัสใหม่ให้บัญชีนี้ไหม (y/n): '))) !== 'y') exit("ไม่ได้เปลี่ยนอะไร\n");
    $user = $row['username'];
} else {
    $user = strtolower(trim(ask('ชื่อผู้ใช้ซุปเปอร์แอดมิน [superadmin]: '))) ?: 'superadmin';
    if (!preg_match('/^[a-z0-9_.-]{3,20}$/', $user)) fail('ชื่อผู้ใช้ใช้ a-z 0-9 _ . - ได้ 3-20 ตัว');
}

$pass = ask('รหัสผ่าน (อย่างน้อย 8 ตัว): ', true);
if (mb_strlen($pass) < 8) fail('รหัสผ่านต้องมีอย่างน้อย 8 ตัว');
if (ask('ยืนยันรหัสผ่าน: ', true) !== $pass) fail('รหัสผ่านไม่ตรงกัน');
$hash = password_hash($pass, PASSWORD_DEFAULT);

if ($row) {
    $pdo->prepare('UPDATE admins SET password_hash = ? WHERE id = ?')->execute([$hash, $row['id']]);
    echo "ตั้งรหัสใหม่แล้ว\n";
} else {
    $pdo->prepare("INSERT INTO admins (username, password_hash, display_name, role) VALUES (?, ?, 'ผู้ดูแลหลัก', 'super')")
        ->execute([$user, $hash]);
    echo "สร้างบัญชี $user แล้ว\n";
}
echo "เสร็จแล้ว\n";
