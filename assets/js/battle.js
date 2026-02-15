function rarityMeta(rarity) {
  const key = (rarity || '').toLowerCase();
  if (key === 'commun') return { stars: 1, className: 'rarity-commun' };
  if (key === 'rare') return { stars: 2, className: 'rarity-rare' };
  if (key === 'superrare') return { stars: 3, className: 'rarity-superrare' };
  if (key === 'legendaire') return { stars: 4, className: 'rarity-legendaire' };
  return { stars: 1, className: 'rarity-commun' };
}

function rarityHtml(rarity) {
  const meta = rarityMeta(rarity);
  return `<span class="rarity-label ${meta.className}">${'⭐'.repeat(meta.stars)} ${rarity || ''}</span>`;
}

function cardHtml(c, defeated = false) {
  const typeClass = `type-${(c.type || '').toLowerCase()}`;
  const defeatedClass = defeated ? ' defeated-card' : '';
  const img = c.image_path
    ? `<img src="${c.image_path}" alt="">`
    : `<div class="fallback-label">${c.type}</div>`;

  return `
    <div class="tcg-card ${typeClass}${defeatedClass}">
      <div class="tcg-header">
        <span>${c.name}</span><span>PV <span class="hp">${c.hp}</span></span>
      </div>
      <div class="tcg-image">${img}</div>
      <div class="tcg-body">
        <div class="small">${rarityHtml(c.rarity)}</div>
        <div>1) ${c.attack_name_1} — ${c.attack_damage_1} (${c.attack_success_1}%)</div>
        <div>2) ${c.attack_name_2} — ${c.attack_damage_2} (${c.attack_success_2}%)</div>
      </div>
    </div>`;
}

const mySelect = document.getElementById('myCardSelect');
const myPreview = document.getElementById('myCardPreview');
const enemyWrap = document.getElementById('enemyCard');
const logEl = document.getElementById('battleLog');
const rouletteWheel = document.getElementById('rouletteWheel');
const rouletteNeedle = document.getElementById('rouletteNeedle');
const rouletteText = document.getElementById('rouletteText');
const attackBtns = document.querySelectorAll('.attack-btn');
const newBattleBtn = document.getElementById('newBattleBtn');

if (mySelect && enemyWrap && myPreview && logEl) {
  let myCard = JSON.parse(mySelect.value);
  let enemy = JSON.parse(enemyWrap.dataset.enemy);

  let myHp = parseInt(myCard.hp, 10);
  let enemyHp = parseInt(enemy.hp, 10);
  let myDefeated = false;
  let enemyDefeated = false;
  let battleFinished = false;

  function render() {
    myCard.hp = myHp;
    enemy.hp = enemyHp;
    myPreview.innerHTML = cardHtml(myCard, myDefeated);
    enemyWrap.innerHTML = cardHtml(enemy, enemyDefeated);
  }

  function log(msg) {
    logEl.innerHTML = `<div>${msg}</div>` + logEl.innerHTML;
  }

  function setWheelChance(successChance) {
    if (rouletteWheel) {
      rouletteWheel.style.setProperty('--success', `${successChance}%`);
    }
  }

  function roulette(successChance) {
    return new Promise((resolve) => {
      const roll = Math.floor(Math.random() * 100) + 1;
      const ok = roll <= successChance;

      if (!rouletteNeedle || !rouletteText) {
        resolve(ok);
        return;
      }

      rouletteText.textContent = 'Lancement...';
      setWheelChance(successChance);

      const resultAngle = (roll / 100) * 360;
      const spins = 360 * (4 + Math.floor(Math.random() * 3));
      const finalAngle = spins + resultAngle;

      rouletteNeedle.style.transition = 'none';
      rouletteNeedle.style.transform = 'translateX(-50%) rotate(0deg)';

      requestAnimationFrame(() => {
        rouletteNeedle.style.transition = 'transform 1.6s cubic-bezier(0.2, 0.8, 0.2, 1)';
        rouletteNeedle.style.transform = `translateX(-50%) rotate(${finalAngle}deg)`;
      });

      setTimeout(() => {
        rouletteText.textContent = ok
          ? `✅ Réussi (${roll} <= ${successChance})`
          : `❌ Raté (${roll} > ${successChance})`;
        resolve(ok);
      }, 1700);
    });
  }

  async function doAttack(slot) {
    if (battleFinished || myHp <= 0 || enemyHp <= 0) return;

    const dmg = parseInt(myCard[`attack_damage_${slot}`], 10);
    const succ = parseInt(myCard[`attack_success_${slot}`], 10);
    const name = myCard[`attack_name_${slot}`];

    attackBtns.forEach((b) => { b.disabled = true; });

    const ok = await roulette(succ);
    if (ok) {
      enemyHp = Math.max(0, enemyHp - dmg);
      log(`🟢 ${myCard.name} utilise ${name} et inflige ${dmg} dégâts.`);
    } else {
      log(`🔴 ${myCard.name} rate ${name}.`);
    }

    if (enemyHp <= 0) {
      enemyDefeated = true;
      render();
      return endBattle(true);
    }

    render();

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

    if (myHp <= 0) {
      myDefeated = true;
      render();
      return endBattle(false);
    }

    render();
    attackBtns.forEach((b) => { b.disabled = false; });
  }

  async function endBattle(win) {
    battleFinished = true;
    attackBtns.forEach((b) => { b.disabled = true; });
    mySelect.disabled = true;
    if (newBattleBtn) newBattleBtn.classList.remove('d-none');

    log(win ? '🏆 Victoire !' : '💀 Défaite...');

    try {
      const res = await fetch('save_battle.php', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({result: win ? 'WIN' : 'LOSE'})
      });
      const data = await res.json();
      if (data.ok) {
        log(`💶 Récompense: +${data.delta_label || data.delta}`);
      }
    } catch (e) {
      log('Erreur sauvegarde combat.');
    }
  }

  if (newBattleBtn) {
    newBattleBtn.addEventListener('click', () => {
      window.location.reload();
    });
  }

  mySelect.addEventListener('change', () => {
    if (battleFinished) return;

    myCard = JSON.parse(mySelect.value);
    myHp = parseInt(myCard.hp, 10);
    enemy = JSON.parse(enemyWrap.dataset.enemy);
    enemyHp = parseInt(enemy.hp, 10);
    myDefeated = false;
    enemyDefeated = false;

    attackBtns.forEach((b) => { b.disabled = false; });
    logEl.innerHTML = '';
    if (rouletteText) rouletteText.textContent = '';
    if (rouletteNeedle) {
      rouletteNeedle.style.transition = 'none';
      rouletteNeedle.style.transform = 'translateX(-50%) rotate(0deg)';
    }
    setWheelChance(parseInt(myCard.attack_success_1, 10));
    render();
  });

  attackBtns.forEach((btn) => {
    btn.addEventListener('click', () => doAttack(btn.dataset.slot));
  });

  setWheelChance(parseInt(myCard.attack_success_1, 10));
  render();
}
