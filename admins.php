<?php
/* =========================================================
   จัดการแอดมิน (เฉพาะซุปเปอร์แอดมิน)
   GET                                                   → รายชื่อแอดมินทั้งหมด (ไม่ส่งรหัสผ่าน)
   POST { action: "add",    display_name, username, password }
   POST { action: "update", id, display_name, password? }  → แก้ชื่อ / ตั้งรหัสใหม่ให้แอดมินทั่วไป
   POST { action: "delete", id }
   POST { action: "me",     display_name?, old_password?, new_password? } → แก้บัญชีตัวเอง
   แอดมินทั่วไปเปลี่ยนชื่อ/รหัสเองไม่ได้ ต้องให้ซุปเปอร์แอดมินแก้ให้
   ========================================================= */

require __DIR__ . '/common.php';

$me = require_super();
$b = body();
$action = $b['action'] ?? '';
$pdo = db();

function find_admin(PDO $pdo, int $id): array
{
    $q = $pdo->prepare('SELECT * FROM admins WHERE id = ?');
    $q->execute([$id]);
    return $q->fetch() ?: out(['error' => 'not_found'], 404);
}

if ($action === 'add') {
    $name = text($b, 'display_name', 100);
    $user = strtolower(text($b, 'username', 50));
    $pass = (string) ($b['password'] ?? '');
    if ($name === '' || mb_strlen($pass) < 4) out(['error' => 'missing_fields'], 400);
    if (!preg_match('/^[a-z0-9_.-]{3,20}$/', $user)) out(['error' => 'bad_username'], 400);
    try {
        $pdo->prepare("INSERT INTO admins (username, password_hash, display_name, role) VALUES (?, ?, ?, 'admin')")
            ->execute([$user, password_hash($pass, PASSWORD_DEFAULT), $name]);
    } catch (PDOException $e) {
        out(['error' => 'username_taken'], 409);
    }
    out(['ok' => true]);
}

if ($action === 'update') {
    $target = find_admin($pdo, (int) ($b['id'] ?? 0));
    if ($target['role'] === 'super') out(['error' => 'forbidden'], 403);
    $name = text($b, 'display_name', 100);
    $pass = (string) ($b['password'] ?? '');
    if ($name === '') out(['error' => 'missing_fields'], 400);
    if ($pass !== '' && mb_strlen($pass) < 4) out(['error' => 'short_password'], 400);
    $pdo->prepare('UPDATE admins SET display_name = ? WHERE id = ?')->execute([$name, $target['id']]);
    if ($pass !== '') {
        $pdo->prepare('UPDATE admins SET password_hash = ? WHERE id = ?')
            ->execute([password_hash($pass, PASSWORD_DEFAULT), $target['id']]);
    }
    out(['ok' => true]);
}

if ($action === 'delete') {
    $target = find_admin($pdo, (int) ($b['id'] ?? 0));
    if ($target['role'] === 'super') out(['error' => 'forbidden'], 403);
    $pdo->prepare('DELETE FROM admins WHERE id = ?')->execute([$target['id']]);
    out(['ok' => true]);
}

if ($action === 'me') {
    $mine = find_admin($pdo, (int) $me['id']);
    if (isset($b['display_name'])) {
        $name = text($b, 'display_name', 100);
        if ($name === '') out(['error' => 'missing_fields'], 400);
        $pdo->prepare('UPDATE admins SET display_name = ? WHERE id = ?')->execute([$name, $mine['id']]);
    }
    if (isset($b['new_password'])) {
        if (!password_verify((string) ($b['old_password'] ?? ''), $mine['password_hash'])) out(['error' => 'wrong_password'], 400);
        if (mb_strlen((string) $b['new_password']) < 4) out(['error' => 'short_password'], 400);
        $pdo->prepare('UPDATE admins SET password_hash = ? WHERE id = ?')
            ->execute([password_hash((string) $b['new_password'], PASSWORD_DEFAULT), $mine['id']]);
    }
    out(['user' => me()]);
}

$rows = $pdo->query("SELECT id, username, display_name, role, created_at FROM admins ORDER BY role = 'super' DESC, id")->fetchAll();
out(['items' => $rows]);
