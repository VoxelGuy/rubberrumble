<?php
require_once __DIR__ . '/db.php';
$pdo = db();

function ensurePlayer(PDO $pdo) {
    $stmt = $pdo->query("SELECT id FROM players LIMIT 1");
    $player = $stmt->fetch();
    if (!$player) {
        $pdo->exec("INSERT INTO players(name, coins) VALUES ('Guillaume', 1200)");
    }
}

function buildCard($name, $type, $rarity, $hp, $a1n, $a1d, $a1s, $a2n, $a2d, $a2s) {
    return [
        'name' => $name,
        'type' => $type,
        'rarity' => $rarity,
        'hp' => $hp,
        'a1n' => $a1n, 'a1d' => $a1d, 'a1s' => $a1s,
        'a2n' => $a2n, 'a2d' => $a2d, 'a2s' => $a2s
    ];
}

function generateTypeCards($type, $prefixNames, $attackNamesA, $attackNamesB) {
    // Distribution par type : 6 Commun, 3 Rare, 1 SuperRare
    $rarities = ['Commun','Commun','Commun','Commun','Commun','Commun','Rare','Rare','Rare','SuperRare'];
    $cards = [];

    for ($i = 0; $i < 10; $i++) {
        $rarity = $rarities[$i];
        $baseHp = 60;
        $hp = match($rarity) {
            'Commun' => $baseHp + rand(0, 10),     // 60-70
            'Rare' => $baseHp + rand(15, 25),      // 75-85
            'SuperRare' => $baseHp + rand(30, 40), // 90-100
            default => 70
        };

        // Attaque 1 : safe (forte réussite, dégâts modérés)
        $a1s = rand(75, 90);
        $a1d = (int) round((100 - $a1s) * 0.9 + rand(8, 14)); // corrélation inverse

        // Attaque 2 : gamble (faible réussite, gros dégâts)
        $a2s = rand(35, 60);
        $a2d = (int) round((100 - $a2s) * 1.4 + rand(14, 22));

        // Bonus rareté
        if ($rarity === 'Rare') {
            $a1d += 4; $a2d += 7;
        } elseif ($rarity === 'SuperRare') {
            $a1d += 8; $a2d += 14;
        }

        $name = $prefixNames[$i];
        $cards[] = buildCard(
            $name, $type, $rarity, $hp,
            $attackNamesA[$i % count($attackNamesA)], $a1d, $a1s,
            $attackNamesB[$i % count($attackNamesB)], $a2d, $a2s
        );
    }

    return $cards;
}

function seedCards(PDO $pdo) {
    $count = (int)$pdo->query("SELECT COUNT(*) c FROM cards")->fetch()['c'];
    if ($count > 0) return;

    $planteNames = ["Lianor","Moussif","Roncépine","Florâme","Verdor","Bourgraine","Sylvion","Sporex","Chlorune","Arbrox"];
    $feuNames    = ["Brandok","Pyros","Flamire","Cendrix","Ignor","Volcar","Furion","Brasael","Ardentis","Magmator"];
    $eauNames    = ["Ondil","Maréon","Aqualis","Nébul'eau","Rivor","Hydrune","Coralix","Brumare","Torrentis","Abyssor"];

    $planteA = ["Fouet Vigne","Racine Vive","Pollen Protecteur","Feuille Tranchante"];
    $planteB = ["Tempête de Ronce","Spore Chaos","Liane Titan","Floraison Brutale"];

    $feuA = ["Flamme Vive","Tison Rapide","Étincelle","Morsure Chaude"];
    $feuB = ["Colère Magma","Explosion Cendre","Braise Infernale","Tornade de Feu"];

    $eauA = ["Jet d'Eau","Vague Fine","Pluie Vive","Écume Agile"];
    $eauB = ["Déluge Brutal","Typhon Marin","Abysses","Raz-de-Marée"];

    $cards = array_merge(
        generateTypeCards('Plante', $planteNames, $planteA, $planteB),
        generateTypeCards('Feu', $feuNames, $feuA, $feuB),
        generateTypeCards('Eau', $eauNames, $eauA, $eauB)
    );

    // 1 spéciale légendaire (style mewtwo)
    $cards[] = buildCard(
        "Aetherion", "Speciale", "Legendaire", 135,
        "Onde Psycho", 28, 82,
        "Singularité", 65, 42
    );

    $stmt = $pdo->prepare("
        INSERT INTO cards
        (name,type,rarity,hp,attack_name_1,attack_damage_1,attack_success_1,attack_name_2,attack_damage_2,attack_success_2,image_path)
        VALUES
        (:name,:type,:rarity,:hp,:a1n,:a1d,:a1s,:a2n,:a2d,:a2s,NULL)
    ");

    foreach ($cards as $c) {
        $stmt->execute($c);
    }
}

ensurePlayer($pdo);
seedCards($pdo);

echo "Init OK : joueur + cartes générés.";
