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
        'Commun' => ['stars' => 1, 'class' => 'rarity-commun'],
        'Rare' => ['stars' => 2, 'class' => 'rarity-rare'],
        'SuperRare' => ['stars' => 3, 'class' => 'rarity-superrare'],
        'Legendaire' => ['stars' => 4, 'class' => 'rarity-legendaire'],
        default => ['stars' => 1, 'class' => 'rarity-commun'],
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
  <a href="index.php" class="btn btn-outline-light mb-3">← Retour</a>
  <h2>📚 Collection</h2>

  <div class="row g-3">
    <?php foreach ($cards as $c): ?>
      <div class="col-md-4 col-lg-3">
        <div class="tcg-card type-<?= strtolower($c['type']) ?> <?= ((int)$c['qty'] === 0 ? 'locked' : '') ?>">
          <div class="tcg-header">
            <span><?= htmlspecialchars($c['name']) ?></span>
            <span>x<?= (int)$c['qty'] ?></span>
          </div>
          <div class="tcg-image">
            <?php if (!empty($c['image_path'])): ?>
              <img src="<?= htmlspecialchars($c['image_path']) ?>" alt="">
            <?php else: ?>
              <div class="fallback-label"><?= htmlspecialchars($c['type']) ?></div>
            <?php endif; ?>
          </div>
          <div class="tcg-body">
            <?php $rarity = rarityMeta($c['rarity']); ?>
            <div class="small"><span class="rarity-label <?= $rarity['class'] ?>"><?= str_repeat('⭐', (int)$rarity['stars']) ?> <?= htmlspecialchars($c['rarity']) ?></span> | PV <?= (int)$c['hp'] ?></div>
            <div><?= htmlspecialchars($c['attack_name_1']) ?> — <?= (int)$c['attack_damage_1'] ?> (<?= (int)$c['attack_success_1'] ?>%)</div>
            <div><?= htmlspecialchars($c['attack_name_2']) ?> — <?= (int)$c['attack_damage_2'] ?> (<?= (int)$c['attack_success_2'] ?>%)</div>
          </div>
        </div>
      </div>
    <?php endforeach; ?>
  </div>
</div>
</body>
</html>
