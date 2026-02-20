<?php
require_once __DIR__ . '/db.php';
$pdo = db();

$player = $pdo->query("SELECT * FROM players LIMIT 1")->fetch();
$totalOwned = (int)$pdo->query("SELECT COALESCE(SUM(quantity),0) c FROM player_cards WHERE player_id=".$player['id'])->fetch()['c'];
$uniqueOwned = (int)$pdo->query("SELECT COUNT(*) c FROM player_cards WHERE player_id=".$player['id']." AND quantity > 0")->fetch()['c'];

function formatEuros(int $centimes): string {
    return number_format($centimes / 100, 2, ',', ' ') . ' €';
}
?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Rubber Rumble</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="assets/css/style.css" rel="stylesheet">
</head>
<body class="bg-dark text-light">
<div class="container py-4">
  <div class="d-flex justify-content-between align-items-center mb-4">
    <h1 class="mb-0">⚔️ Rubber Rumble</h1>
    <div class="badge text-bg-warning fs-6">💶 <?= formatEuros((int)$player['coins']) ?></div>
  </div>

  <div class="row g-3">
    <div class="col-md-4">
      <div class="card glass h-100">
        <div class="card-body">
          <h5>Booster</h5>
          <p>Ouvre un booster (0,10 €).<br>4 cartes tirées avec raretés.</p>
          <a class="btn btn-primary w-100" href="booster.php">Ouvrir un booster</a>
        </div>
      </div>
    </div>

    <div class="col-md-4">
      <div class="card glass h-100">
        <div class="card-body">
          <h5>Collection</h5>
          <p>Cartes uniques: <strong><?= $uniqueOwned ?>/31</strong><br>Total cartes: <strong><?= $totalOwned ?></strong></p>
          <a class="btn btn-success w-100" href="collection.php">Voir la collection</a>
        </div>
      </div>
    </div>

    <div class="col-md-4">
      <div class="card glass h-100">
        <div class="card-body">
          <h5>Combat</h5>
          <p>Choisis une carte, affronte une IA simple, gagne du crédit en euros.</p>
          <a class="btn btn-danger w-100" href="battle.php">Lancer un combat</a>
        </div>
      </div>
    </div>
  </div>
</div>
</body>
</html>
