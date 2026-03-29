<?php
require_once __DIR__ . '/db.php';
$pdo = db();
$player = $pdo->query("SELECT * FROM players LIMIT 1")->fetch();

$sql = "
SELECT c.*, COALESCE(pc.quantity,0) qty
FROM cards c
LEFT JOIN player_cards pc ON pc.card_id = c.id AND pc.player_id = ?
ORDER BY FIELD(c.type,'Plante','Feu','Eau','Speciale'),
         FIELD(c.rarity,'Commun','Rare','SuperRare','Legendaire'),
         c.name
";
$stmt = $pdo->prepare($sql);
$stmt->execute([$player['id']]);
$cards = $stmt->fetchAll();

function rarityMeta(string $rarity): array {
    return match ($rarity) {
        'Commun' => ['stars' => 1, 'class' => 'rarity-commun', 'label' => 'Commun'],
        'Rare' => ['stars' => 2, 'class' => 'rarity-rare', 'label' => 'Rare'],
        'SuperRare' => ['stars' => 3, 'class' => 'rarity-superrare', 'label' => 'Super Rare'],
        'Legendaire' => ['stars' => 4, 'class' => 'rarity-legendaire', 'label' => 'Légendaire'],
        default => ['stars' => 1, 'class' => 'rarity-commun', 'label' => 'Commun'],
    };
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
?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Collection</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="assets/css/style.css" rel="stylesheet">
</head>
<body class="bg-dark text-light">
<div class="container py-4">
  <div class="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
    <a href="index.php" class="btn btn-outline-light">← Retour</a>
    <h2 class="mb-0">Collection</h2>
  </div>

  <div class="row g-4">
    <?php foreach ($cards as $c): ?>
      <?php $rarity = rarityMeta($c['rarity']); ?>
      <div class="col-sm-6 col-lg-3">
        <article class="tcg-card-v2 card3d-v2 <?= ((int)$c['qty'] === 0 ? 'locked' : '') ?>" data-tilt-v2>
          <div class="tcg-card-v2-inner type-<?= strtolower($c['type']) ?>">
            <?php if (!empty($c['image_path'])): ?>
              <img class="card-v2-bg" src="<?= htmlspecialchars($c['image_path']) ?>" alt="<?= htmlspecialchars($c['name']) ?>">
            <?php endif; ?>

            <div class="card-v2-top">
              <div class="card-chip card-name"><?= htmlspecialchars($c['name']) ?></div>
              <div class="card-chip card-stats">PV <?= (int)$c['hp'] ?> <span class="type-bubble" title="<?= htmlspecialchars($c['type']) ?>"><?= typeEmoji($c['type']) ?></span></div>
            </div>

            <div class="card-v2-bottom">
              <div class="card-v2-meta-row">
                <div class="card-chip <?= $rarity['class'] ?>"><?= str_repeat('⭐', (int)$rarity['stars']) ?> <?= htmlspecialchars($rarity['label']) ?></div>
                <div class="card-chip">⚡ <?= (int)($c['speed'] ?? 50) ?></div>
              </div>
              <div class="card-v2-attacks">
                <div class="card-attack-v2"><?= htmlspecialchars($c['attack_name_1']) ?> <span><?= (int)$c['attack_damage_1'] ?> • <?= (int)$c['attack_success_1'] ?>%</span></div>
                <div class="card-attack-v2"><?= htmlspecialchars($c['attack_name_2']) ?> <span><?= (int)$c['attack_damage_2'] ?> • <?= (int)$c['attack_success_2'] ?>%</span></div>
              </div>
            </div>

            <div class="card-v2-qty">x<?= (int)$c['qty'] ?></div>
          </div>
        </article>
      </div>
    <?php endforeach; ?>
  </div>
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

      const dx = (px - 0.5) * 2;
      const dy = (py - 0.5) * 2;

      const rx = clamp((-dy * MAX_TILT), -MAX_TILT, MAX_TILT);
      const ry = clamp((dx * MAX_TILT), -MAX_TILT, MAX_TILT);

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
