<?php
require_once __DIR__ . '/db.php';
$pdo = db();
$player = $pdo->query("SELECT * FROM players LIMIT 1")->fetch();

$hasSpeed = (bool)$pdo->query("SHOW COLUMNS FROM cards LIKE 'speed'")->fetch();
$speedSelect = $hasSpeed ? 'c.speed' : '50 AS speed';

$sqlOwned = "
SELECT c.*, pc.quantity, {$speedSelect}
FROM player_cards pc
JOIN cards c ON c.id = pc.card_id
WHERE pc.player_id = ? AND pc.quantity > 0
ORDER BY RAND()
";
$stmt = $pdo->prepare($sqlOwned);
$stmt->execute([$player['id']]);
$ownedCards = $stmt->fetchAll();

$canBattle = count($ownedCards) >= 5;
$myPool = $canBattle ? array_slice($ownedCards, 0, 5) : [];

$sqlEnemy = "SELECT c.*, " . ($hasSpeed ? "c.speed" : "50") . " AS speed FROM cards c ORDER BY RAND() LIMIT 3";
$enemyTeam = $canBattle ? $pdo->query($sqlEnemy)->fetchAll() : [];
?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Combat</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="assets/css/style.css" rel="stylesheet">
</head>
<body class="bg-dark text-light battle-page">
<div class="container py-4">
  <div class="battle-head d-flex align-items-center justify-content-between mb-3">
    <a href="index.php" class="btn btn-outline-light">← Retour</a>
    <h2 class="mb-0 text-center flex-grow-1">⚔️ Combat avancé</h2>
    <span style="width:110px;"></span>
  </div>

  <?php if (!$canBattle): ?>
    <div class="alert alert-warning">
      Tu dois avoir au moins <strong>5 cartes différentes</strong> dans ta collection pour combattre.
    </div>
  <?php else: ?>
    <div id="battleApp"
         data-my-pool='<?= json_encode($myPool, JSON_HEX_APOS|JSON_HEX_QUOT) ?>'
         data-enemy-team='<?= json_encode($enemyTeam, JSON_HEX_APOS|JSON_HEX_QUOT) ?>'>
    </div>
  <?php endif; ?>
</div>

<script src="assets/js/battle.js"></script>
</body>
</html>
