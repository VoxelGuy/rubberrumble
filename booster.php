<?php
require_once __DIR__ . '/db.php';
$pdo = db();

$player = $pdo->query("SELECT * FROM players LIMIT 1")->fetch();
$message = "";
$pulled = [];

function pickRarity() {
    $r = mt_rand(1, 100);
    // distribution globale booster
    // Commun 65%, Rare 25%, SuperRare 9%, Legendaire 1%
    if ($r <= 65) return 'Commun';
    if ($r <= 90) return 'Rare';
    if ($r <= 99) return 'SuperRare';
    return 'Legendaire';
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($player['coins'] < 100) {
        $message = "Pas assez de pièces.";
    } else {
        $pdo->beginTransaction();
        try {
            $pdo->prepare("UPDATE players SET coins = coins - 100 WHERE id = ?")->execute([$player['id']]);

            for ($i = 0; $i < 5; $i++) {
                $rarity = pickRarity();

                // Pour éviter d’avoir trop de légendaire si unique, on fallback sur SuperRare si déjà trop
                $stmt = $pdo->prepare("SELECT * FROM cards WHERE rarity = ? ORDER BY RAND() LIMIT 1");
                $stmt->execute([$rarity]);
                $card = $stmt->fetch();

                if (!$card) {
                    $stmt = $pdo->prepare("SELECT * FROM cards WHERE rarity = 'SuperRare' ORDER BY RAND() LIMIT 1");
                    $stmt->execute();
                    $card = $stmt->fetch();
                }

                $pulled[] = $card;

                $upsert = $pdo->prepare("
                    INSERT INTO player_cards(player_id, card_id, quantity)
                    VALUES (?, ?, 1)
                    ON DUPLICATE KEY UPDATE quantity = quantity + 1
                ");
                $upsert->execute([$player['id'], $card['id']]);
            }

            $pdo->commit();
            $message = "Booster ouvert !";
            $player = $pdo->query("SELECT * FROM players LIMIT 1")->fetch();
        } catch (Throwable $e) {
            $pdo->rollBack();
            $message = "Erreur: " . $e->getMessage();
        }
    }
}
?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Booster</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="assets/css/style.css" rel="stylesheet">
</head>
<body class="bg-dark text-light">
<div class="container py-4">
  <a href="index.php" class="btn btn-outline-light mb-3">← Retour</a>
  <h2>🎁 Booster</h2>
  <div class="mb-3">Pièces: <span class="badge text-bg-warning"><?= (int)$player['coins'] ?></span></div>

  <form method="post">
    <button class="btn btn-primary">Ouvrir (100 pièces)</button>
  </form>

  <?php if ($message): ?>
    <div class="alert alert-info mt-3"><?= htmlspecialchars($message) ?></div>
  <?php endif; ?>

  <?php if ($pulled): ?>
    <div class="row g-3 mt-1">
      <?php foreach ($pulled as $c): ?>
        <div class="col-md-4 col-lg-3">
          <div class="tcg-card type-<?= strtolower($c['type']) ?>">
            <div class="tcg-header">
              <span><?= htmlspecialchars($c['name']) ?></span>
              <span>PV <?= (int)$c['hp'] ?></span>
            </div>
            <div class="tcg-image">
              <?php if (!empty($c['image_path'])): ?>
                <img src="<?= htmlspecialchars($c['image_path']) ?>" alt="">
              <?php else: ?>
                <div class="fallback-label"><?= htmlspecialchars($c['type']) ?></div>
              <?php endif; ?>
            </div>
            <div class="tcg-body">
              <div class="small">⭐ <?= htmlspecialchars($c['rarity']) ?></div>
              <div><?= htmlspecialchars($c['attack_name_1']) ?> — <?= (int)$c['attack_damage_1'] ?> dmg (<?= (int)$c['attack_success_1'] ?>%)</div>
              <div><?= htmlspecialchars($c['attack_name_2']) ?> — <?= (int)$c['attack_damage_2'] ?> dmg (<?= (int)$c['attack_success_2'] ?>%)</div>
            </div>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>
</div>
</body>
</html>
