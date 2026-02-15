<?php
require_once __DIR__ . '/db.php';
$pdo = db();
$player = $pdo->query("SELECT * FROM players LIMIT 1")->fetch();

$sql = "
SELECT c.*, pc.quantity
FROM player_cards pc
JOIN cards c ON c.id = pc.card_id
WHERE pc.player_id = ? AND pc.quantity > 0
ORDER BY c.rarity DESC, c.hp DESC
";
$stmt = $pdo->prepare($sql);
$stmt->execute([$player['id']]);
$myCards = $stmt->fetchAll();

$enemy = $pdo->query("SELECT * FROM cards ORDER BY RAND() LIMIT 1")->fetch();
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
<body class="bg-dark text-light">
<div class="container py-4">
  <a href="index.php" class="btn btn-outline-light mb-3">← Retour</a>
  <h2>⚔️ Combat</h2>

  <?php if (!$myCards): ?>
    <div class="alert alert-warning">Tu n'as pas de carte. Ouvre d'abord un booster.</div>
  <?php else: ?>
    <div class="row g-3 battle-cards-row">
      <div class="col-md-5">
        <label class="form-label">Ta carte</label>
        <div id="myCardPreview"></div>
      </div>

      <div class="col-md-2 d-flex align-items-center justify-content-center battle-vs-col">
        <h3 class="battle-vs-title mb-0">VS</h3>
      </div>

      <div class="col-md-5">
        <label class="form-label">Adversaire</label>
        <div id="enemyCard" data-enemy='<?= json_encode($enemy, JSON_HEX_APOS|JSON_HEX_QUOT) ?>'></div>
      </div>
    </div>

    <div class="mt-3">
      <label class="form-label" for="myCardSelect">Choisir ma carte</label>
      <select id="myCardSelect" class="form-select">
        <?php foreach($myCards as $c): ?>
          <option value='<?= json_encode($c, JSON_HEX_APOS|JSON_HEX_QUOT) ?>'>
            <?= htmlspecialchars($c['name']) ?> (<?= htmlspecialchars($c['type']) ?>, PV <?= (int)$c['hp'] ?>)
          </option>
        <?php endforeach; ?>
      </select>
    </div>

    <div class="mt-4">
      <div class="d-flex gap-2 flex-wrap">
        <button class="btn btn-success attack-btn" data-slot="1">Attaque 1 (safe)</button>
        <button class="btn btn-danger attack-btn" data-slot="2">Attaque 2 (risquée)</button>
        <button id="newBattleBtn" class="btn btn-outline-light d-none">Nouveau combat</button>
      </div>

      <div class="roulette-wheel-wrap mt-3">
        <div id="rouletteWheel" class="roulette-wheel">
          <div id="rouletteNeedle" class="roulette-needle"></div>
          <div class="roulette-center"></div>
        </div>
      </div>
      <div id="rouletteText" class="small mt-2"></div>

      <div class="mt-3 p-3 glass rounded" id="battleLog" style="min-height:120px;"></div>
    </div>
  <?php endif; ?>
</div>

<script src="assets/js/battle.js"></script>
</body>
</html>
