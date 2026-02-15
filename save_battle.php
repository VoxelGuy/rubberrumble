<?php
require_once __DIR__ . '/db.php';
header('Content-Type: application/json');
$pdo = db();

$input = json_decode(file_get_contents('php://input'), true);
$result = $input['result'] ?? '';

$player = $pdo->query("SELECT * FROM players LIMIT 1")->fetch();
if (!$player) {
    echo json_encode(['ok'=>false, 'msg'=>'No player']);
    exit;
}

$delta = 0;
if ($result === 'WIN') $delta = 120;
if ($result === 'LOSE') $delta = 40; // consolation

$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare("INSERT INTO battles(player_id,result,coins_delta) VALUES (?,?,?)");
    $stmt->execute([$player['id'], $result, $delta]);

    $stmt2 = $pdo->prepare("UPDATE players SET coins = coins + ? WHERE id = ?");
    $stmt2->execute([$delta, $player['id']]);

    $pdo->commit();
    echo json_encode(['ok'=>true, 'delta'=>$delta]);
} catch(Throwable $e) {
    $pdo->rollBack();
    echo json_encode(['ok'=>false, 'msg'=>$e->getMessage()]);
}
