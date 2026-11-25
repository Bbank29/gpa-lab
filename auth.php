<?php
/* =========================================================
   เข้าสู่ระบบ / ออกจากระบบแอดมิน
   GET                       → { user: ข้อมูลแอดมินที่เข้าสู่ระบบอยู่ หรือ null }
   POST { action: "login", username, password }
   POST { action: "logout" }
   ========================================================= */

require __DIR__ . '/common.php';

$b = body();
$action = $b['action'] ?? '';

if ($action === 'login') {
    $q = db()->prepare('SELECT * FROM admins WHERE username = ?');
    $q->execute([strtolower(text($b, 'username', 50))]);
    $row = $q->fetch();
    if (!$row || !password_verify((string) ($b['password'] ?? ''), $row['password_hash'])) {
        out(['error' => 'wrong_login'], 401);
    }
    session_regenerate_id(true);
    $_SESSION['admin_id'] = (int) $row['id'];
    out(['user' => me()]);
}

if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    out(['user' => null]);
}

out(['user' => me()]);
