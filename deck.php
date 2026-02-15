<?php
require_once __DIR__ . '/db.php';
$pdo = db();
$player = $pdo->query("SELECT * FROM players LIMIT 1")->fetch();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $slots = [
      1 => (int)($_POST['slot1'] ?? 0),
      2 => (int)($_POST['slot2'] ?? 0),
      3 => (int)($_POST['slot3'] ?? 0),
    ];

    // Validation : 3 cartes non nulles + distinctes
    if (in_array(0, $slots, true) || count(array_unique($slots)) < 3) {
        $error = "Choisis 3 cartes différentes.";
    } else {
        // vérifier possession
        $ok = true;
        $check = $pdo->prepare("SELECT quantity FROM player_cards WHERE player_id=? AND card_id=?");
        foreach ($slots as $cid) {
            $check->execute([$player['id'], $cid]);
            $row = $check->fetch();
            if (!$row || (int)$row['quantity'] <= 0) { $ok = false; break; }
        }

        if (!$ok) {
            $error = "Tu dois posséder les cartes choisies.";
        } else {
            $pdo->beginTransaction();
            try {
                $pdo->prepare("DELETE FROM player_deck WHERE player_id=?")->execute([$player['id']]);
                $ins = $pdo->prepare("INSERT INTO player_deck(player_id, slot_num, card_id) VALUES (?,?,?)");
                foreach ($slots as $slotNum => $cid) {
                    $ins->execute([$player['id'], $slotNum, $cid]);
                }
                $pdo->commit();
                $success = "Deck sauvegardé.";
            } catch(Throwable $e) {
                $pdo->rollBack();
                $error = $e->getMessage();
            }
        }
    }
}

$owned = $pdo->prepare("
    SELECT c.id, c.name, c.type, c.rarity, c.hp, pc.quantity
    FROM player_cards pc
    JOIN cards c ON c.id = pc.card_id
    WHERE pc.player_id=? AND pc.quantity > 0
    ORDER BY FIELD(c.rarity,'Legendaire','SuperRare','Rare','Commun'), c.name
");
$owned->execute([$player['id']]);
$cards = $owned->fetchAll();

$deckQ = $pdo->prepare("
    SELECT slot_num, card_id FROM player_deck WHERE player_id=? ORDER BY slot_num
");
$deckQ->execute([$player['id']]);
$deckRows = $deckQ->fetchAll();
$deck = [1=>0,2=>0,3=>0];
foreach($deckRows as $d) $deck[(int)$d['slot_num']] = (int)$d['card_id'];
?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Deck Builder - Rubber Rumble</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="rr-bg text-light">
<div class="container py-4">
  <a href="index.php" class="btn btn-outline-light mb-3">← Retour</a>
  <h2>🧩 Deck Builder (3 cartes)</h2>

  <?php if (!empty($error)): ?><div class="alert alert-danger"><?= htmlspecialchars($error) ?></div><?php endif; ?>
  <?php if (!empty($success)): ?><div class="alert alert-success"><?= htmlspecialchars($success) ?></div><?php endif; ?>

  <form method="post" class="glass p-3 rounded">
    <?php for($i=1;$i<=3;$i++): ?>
      <label class="form-label">Slot <?= $i ?></label>
      <select class="form-select mb-3" name="slot<?= $i ?>">
        <option value="0">-- Choisir --</option>
        <?php foreach($cards as $c): ?>
          <option value="<?= (int)$c['id'] ?>" <?= $deck[$i]==$c['id']?'selected':'' ?>>
            <?= htmlspecialchars($c['name']) ?> (<?= htmlspecialchars($c['type']) ?>, <?= htmlspecialchars($c['rarity']) ?>, x<?= (int)$c['quantity'] ?>)
          </option>
        <?php endforeach; ?>
      </select>
    <?php endfor; ?>
    <button class="btn btn-warning">Sauvegarder le deck</button>
  </form>
</div>
</body>
</html>
