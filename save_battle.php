<?php
require_once __DIR__ . '/db.php';
header('Content-Type: application/json');
$pdo = db();

$input = json_decode(file_get_contents('php://input'), true);
$result = $input['result'] ?? '';
$teamCardIds = $input['team_card_ids'] ?? [];

$player = $pdo->query("SELECT * FROM players LIMIT 1")->fetch();

function formatEurosLabel(int $centimes): string {
    return number_format($centimes / 100, 2, ',', ' ') . ' €';
}

if (!$player) {
    echo json_encode(['ok'=>false, 'msg'=>'No player']);
    exit;
}

$delta = 0;
if ($result === 'WIN') $delta = 6;
if ($result === 'LOSE') $delta = 0;

$removedCardName = null;

$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare("INSERT INTO battles(player_id,result,coins_delta) VALUES (?,?,?)");
    $stmt->execute([$player['id'], $result, $delta]);

    $stmt2 = $pdo->prepare("UPDATE players SET coins = coins + ? WHERE id = ?");
    $stmt2->execute([$delta, $player['id']]);

    if ($result === 'LOSE' && is_array($teamCardIds) && count($teamCardIds) > 0) {
        $teamCardIds = array_values(array_unique(array_map('intval', $teamCardIds)));
        $placeholders = implode(',', array_fill(0, count($teamCardIds), '?'));

        $params = array_merge([$player['id']], $teamCardIds);
        $pickStmt = $pdo->prepare("\n            SELECT pc.card_id, c.name\n            FROM player_cards pc\n            JOIN cards c ON c.id = pc.card_id\n            WHERE pc.player_id = ?\n              AND pc.quantity > 0\n              AND pc.card_id IN ($placeholders)\n            ORDER BY RAND()\n            LIMIT 1\n        ");
        $pickStmt->execute($params);
        $picked = $pickStmt->fetch();

        if ($picked) {
            $removeStmt = $pdo->prepare("\n                UPDATE player_cards\n                SET quantity = GREATEST(quantity - 1, 0)\n                WHERE player_id = ? AND card_id = ?\n            ");
            $removeStmt->execute([$player['id'], (int)$picked['card_id']]);
            $removedCardName = $picked['name'];
        }
    }

    $pdo->commit();
    echo json_encode([
        'ok' => true,
        'delta' => $delta,
        'delta_label' => formatEurosLabel($delta),
        'removed_card_name' => $removedCardName,
    ]);
} catch(Throwable $e) {
    $pdo->rollBack();
    echo json_encode(['ok'=>false, 'msg'=>$e->getMessage()]);
}
