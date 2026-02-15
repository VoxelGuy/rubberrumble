function cardHtml(c) {
  const typeClass = `type-${(c.type || '').toLowerCase()}`;
  const img = c.image_path
    ? `<img src="${c.image_path}" alt="">`
    : `<div class="fallback-label">${c.type}</div>`;

  return `
    <div class="tcg-card ${typeClass}">
      <div class="tcg-header">
        <span>${c.name}</span><span>PV <span class="hp">${c.hp}</span></span>
      </div>
      <div class="tcg-image">${img}</div>
      <div class="tcg-body">
        <div class="small">⭐ ${c.rarity || ''}</div>
        <div>1) ${c.attack_name_1} — ${c.attack_damage_1} (${c.attack_success_1}%)</div>
        <div>2) ${c.attack_name_2} — ${c.attack_damage_2} (${c.attack_success_2}%)</div>
      </div>
    </div>`;
}

const mySelect = document.getElementById('myCardSelect');
const myPreview = document.getElementById('myCardPreview');
const enemyWrap = document.getElementById('enemyCard');
const logEl = document.getElementById('battleLog');
const rouletteBar = document.getElementById('rouletteBar');
const rouletteText = document.getElementById('rouletteText');
const attackBtns = document.querySelectorAll('.attack-btn');

if (mySelect && enemyWrap) {
  let myCard = JSON.parse(mySelect.value);
  let enemy = JSON.parse(enemyWrap.dataset.enemy);

  let myHp = parseInt(myCard.hp, 10);
  let enemyHp = parseInt(enemy.hp, 10);

  function render() {
    myCard.hp = myHp;
    enemy.hp = enemyHp;
    myPreview.innerHTML = cardHtml(myCard);
    enemyWrap.innerHTML = cardHtml(enemy);
  }

  function log(msg) {
    logEl.innerHTML = `<div>${msg}</div>` + logEl.innerHTML;
  }

  function roulette(successChance) {
    return new Promise((resolve) => {
      rouletteBar.classList.remove('success', 'fail');
      rouletteBar.style.width = '0%';
      rouletteText.textContent = "Lancement...";
      let t = 0;
      const duration = 600;
      const interval = 25;
      const timer = setInterval(() => {
        t += interval;
        let p = Math.min(100, Math.floor((t / duration) * 100));
        rouletteBar.style.width = p + '%';
        if (t >= duration) {
          clearInterval(timer);
          const roll = Math.floor(Math.random() * 100) + 1;
          const ok = roll <= successChance;
          rouletteBar.classList.add(ok ? 'success' : 'fail');
          rouletteText.textContent = ok
            ? `✅ Réussi (${roll} <= ${successChance})`
            : `❌ Raté (${roll} > ${successChance})`;
          resolve(ok);
        }
      }, interval);
    });
  }

  async function doAttack(slot) {
    if (myHp <= 0 || enemyHp <= 0) return;

    const dmg = parseInt(myCard[`attack_damage_${slot}`], 10);
    const succ = parseInt(myCard[`attack_success_${slot}`], 10);
    const name = myCard[`attack_name_${slot}`];

    const ok = await roulette(succ);
    if (ok) {
      enemyHp = Math.max(0, enemyHp - dmg);
      log(`🟢 ${myCard.name} utilise ${name} et inflige ${dmg} dégâts.`);
    } else {
      log(`🔴 ${myCard.name} rate ${name}.`);
    }

    render();
    if (enemyHp <= 0) return endBattle(true);

    // Tour IA simple : 70% attaque 1, 30% attaque 2
    const aiSlot = Math.random() < 0.7 ? 1 : 2;
    const aiDmg = parseInt(enemy[`attack_damage_${aiSlot}`], 10);
    const aiSucc = parseInt(enemy[`attack_success_${aiSlot}`], 10);
    const aiName = enemy[`attack_name_${aiSlot}`];

    const aiRoll = Math.floor(Math.random() * 100) + 1;
    if (aiRoll <= aiSucc) {
      myHp = Math.max(0, myHp - aiDmg);
      log(`🔥 IA: ${enemy.name} touche avec ${aiName} (${aiDmg}).`);
    } else {
      log(`💨 IA: ${enemy.name} rate ${aiName}.`);
    }

    render();
    if (myHp <= 0) endBattle(false);
  }

  async function endBattle(win) {
    attackBtns.forEach(b => b.disabled = true);
    log(win ? "🏆 Victoire !" : "💀 Défaite...");

    try {
      const res = await fetch('save_battle.php', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({result: win ? 'WIN' : 'LOSE'})
      });
      const data = await res.json();
      if (data.ok) {
        log(`🪙 Récompense: +${data.delta} pièces`);
      }
    } catch (e) {
      log("Erreur sauvegarde combat.");
    }
  }

  mySelect.addEventListener('change', () => {
    myCard = JSON.parse(mySelect.value);
    myHp = parseInt(myCard.hp, 10);
    enemy = JSON.parse(enemyWrap.dataset.enemy);
    enemyHp = parseInt(enemy.hp, 10);
    attackBtns.forEach(b => b.disabled = false);
    logEl.innerHTML = "";
    rouletteText.textContent = "";
    rouletteBar.style.width = '0%';
    render();
  });

  attackBtns.forEach(btn => {
    btn.addEventListener('click', () => doAttack(btn.dataset.slot));
  });

  render();
}
