<?php
require_once __DIR__ . '/db.php';
$pdo = db();

$player = $pdo->query("SELECT * FROM players LIMIT 1")->fetch();
$message = "";
$pulled = [];

function formatEuros(int $centimes): string {
    return number_format($centimes / 100, 2, ',', ' ') . ' €';
}

function rarityMeta(string $rarity): array {
    return match ($rarity) {
        'Commun' => ['stars' => 1, 'class' => 'rarity-commun'],
        'Rare' => ['stars' => 2, 'class' => 'rarity-rare'],
        'SuperRare' => ['stars' => 3, 'class' => 'rarity-superrare'],
        'Legendaire' => ['stars' => 4, 'class' => 'rarity-legendaire'],
        default => ['stars' => 1, 'class' => 'rarity-commun'],
    };
}

function pickRarity() {
    $r = mt_rand(1, 100);
    // distribution globale booster
    // Commun 65%, Rare 25%, SuperRare 9%, Legendaire 1%
    if ($r <= 65) return 'Commun';
    if ($r <= 90) return 'Rare';
    if ($r <= 99) return 'SuperRare';
    return 'Legendaire';
}


function typeEmoji(string $type): string {
    return match ($type) {
        'Plante' => '🌿',
        'Feu' => '🔥',
        'Eau' => '💧',
        'Speciale' => '✨',
        default => '❓',
    };
}
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($player['coins'] < 10) {
        $message = "Crédit insuffisant.";
    } else {
        $pdo->beginTransaction();
        try {
            $pdo->prepare("UPDATE players SET coins = coins - 10 WHERE id = ?")->execute([$player['id']]);

            for ($i = 0; $i < 4; $i++) {
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

                $ownedBeforeStmt = $pdo->prepare("SELECT quantity FROM player_cards WHERE player_id = ? AND card_id = ?");
                $ownedBeforeStmt->execute([$player['id'], $card['id']]);
                $ownedBefore = $ownedBeforeStmt->fetch();
                $isNew = !$ownedBefore || (int)$ownedBefore['quantity'] === 0;

                $card['_is_new'] = $isNew;
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
  <h2>Booster</h2>
  <div class="mb-3">Crédit: <span class="badge text-bg-warning"><?= formatEuros((int)$player['coins']) ?></span></div>

  <form method="post">
    <button class="btn btn-primary">Ouvrir (0,10 €)</button>
  </form>

  <?php if ($message): ?>
    <div class="alert alert-info mt-3"><?= htmlspecialchars($message) ?></div>
  <?php endif; ?>

  <?php if ($pulled): ?>
    <div class="row g-4 mt-1">
      <?php foreach ($pulled as $c): ?>
        <?php $rarity = rarityMeta($c['rarity']); ?>
        <div class="col-sm-6 col-lg-3">
          <article class="tcg-card-v2 card3d-v2" data-tilt-v2>
            <div class="tcg-card-v2-inner type-<?= strtolower($c['type']) ?>">
              <?php if (!empty($c['image_path'])): ?>
                <img class="card-v2-bg" src="<?= htmlspecialchars($c['image_path']) ?>" alt="<?= htmlspecialchars($c['name']) ?>">
              <?php endif; ?>

              <div class="card-v2-top">
                <div class="card-chip card-name">
                  <?= htmlspecialchars($c['name']) ?>
                  <?php if (!empty($c['_is_new'])): ?>
                    <span class="badge text-bg-success ms-1">Nouveau</span>
                  <?php endif; ?>
                </div>
                <div class="card-chip card-stats">PV <?= (int)$c['hp'] ?> <span class="type-bubble" title="<?= htmlspecialchars($c['type']) ?>"><?= typeEmoji($c['type']) ?></span></div>
              </div>

              <div class="card-v2-bottom">
                <div class="card-v2-meta-row">
                  <div class="card-chip <?= $rarity['class'] ?>"><?= str_repeat('⭐', (int)$rarity['stars']) ?> <?= htmlspecialchars($c['rarity']) ?></div>
                  <div class="card-chip">⚡ <?= (int)($c['speed'] ?? 50) ?></div>
                </div>
                <div class="card-v2-attacks">
                  <div class="card-attack-v2"><?= htmlspecialchars($c['attack_name_1']) ?> <span><?= (int)$c['attack_damage_1'] ?> • <?= (int)$c['attack_success_1'] ?>%</span></div>
                  <div class="card-attack-v2"><?= htmlspecialchars($c['attack_name_2']) ?> <span><?= (int)$c['attack_damage_2'] ?> • <?= (int)$c['attack_success_2'] ?>%</span></div>
                </div>
              </div>
            </div>
          </article>
        </div>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>
</div>
<script>
(() => {
  const MAX_TILT = 18;
  const cards = document.querySelectorAll('[data-tilt-v2]');
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  cards.forEach((card) => {
    const inner = card.querySelector('.tcg-card-v2-inner');
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const rx = clamp((-(py - 0.5) * 2 * MAX_TILT), -MAX_TILT, MAX_TILT);
      const ry = clamp((((px - 0.5) * 2) * MAX_TILT), -MAX_TILT, MAX_TILT);
      inner.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
      inner.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
      inner.style.setProperty('--sx', `${(px * 100).toFixed(1)}%`);
      inner.style.setProperty('--sy', `${(py * 100).toFixed(1)}%`);
    });
    card.addEventListener('mouseleave', () => {
      inner.style.setProperty('--rx', '0deg');
      inner.style.setProperty('--ry', '0deg');
      inner.style.setProperty('--sx', '50%');
      inner.style.setProperty('--sy', '50%');
    });
  });
})();
</script>
</body>
</html>
