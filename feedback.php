<?php
/* =========================================================
   แบบประเมิน (ดาว + ความคิดเห็น)
   GET                → สรุปคะแนน { total, avg, counts: {1..5} } (ทุกคนดูได้)
   GET ?list=1        → รายการทั้งหมด ล่าสุดอยู่บน (เฉพาะแอดมิน)
   POST { stars, comment }  → บันทึกแบบประเมิน 1 ครั้ง (ทุกคนส่งได้)
   ========================================================= */

require __DIR__ . '/common.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $b = body();
    $stars = (int) ($b['stars'] ?? 0);
    if ($stars < 1 || $stars > 5) out(['error' => 'bad_stars'], 400);
    $comment = text($b, 'comment', 300);
    db()->prepare('INSERT INTO feedback (stars, comment) VALUES (?, ?)')
        ->execute([$stars, $comment === '' ? null : $comment]);
    out(['ok' => true]);
}

if (isset($_GET['list'])) {
    require_admin();
    $rows = db()->query('SELECT id, stars, comment, created_at FROM feedback ORDER BY created_at DESC, id DESC')->fetchAll();
    out(['items' => $rows]);
}

$counts = [1 => 0, 2 => 0, 3 => 0, 4 => 0, 5 => 0];
foreach (db()->query('SELECT stars, COUNT(*) AS n FROM feedback GROUP BY stars') as $r) {
    $counts[(int) $r['stars']] = (int) $r['n'];
}
$total = array_sum($counts);
$sum = 0;
foreach ($counts as $s => $n) $sum += $s * $n;
out(['total' => $total, 'avg' => $total ? round($sum / $total, 1) : null, 'counts' => $counts]);
