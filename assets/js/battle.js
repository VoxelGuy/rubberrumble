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

function typeNameClass(type) {
  const key = (type || '').toLowerCase();
  if (key === 'plante') return 'name-type-plante';
  if (key === 'feu') return 'name-type-feu';
  if (key === 'eau') return 'name-type-eau';
  return 'name-type-speciale';
}

function cardHtml(c, defeated = false, maxHp = null) {
  const typeClass = `type-${(c.type || '').toLowerCase()}`;
  const nameClass = typeNameClass(c.type);
  const defeatedClass = defeated ? ' defeated-card' : '';
  const img = c.image_path
    ? `<img src="${c.image_path}" alt="">`
    : `<div class="fallback-label">${c.type}</div>`;

  const maxValue = Number(maxHp || c.hp || 1);
  const hpValue = Math.max(0, Number(c.hp || 0));
  const hpPct = Math.max(0, Math.min(100, Math.round((hpValue / maxValue) * 100)));

  return `
    <div class="tcg-card ${typeClass}${defeatedClass}">
      <div class="tcg-header battle-hp-header">
        <div class="battle-hp-top">
          <span class="monster-name ${nameClass}">${c.name}</span>
          <span class="hp-text">PV ${hpValue}/${maxValue}</span>
        </div>
        <div class="hp-track"><div class="hp-fill" style="width:${hpPct}%"></div></div>
      </div>
      <div class="tcg-image">${img}</div>
      <div class="tcg-body">
        <div class="small">${rarityHtml(c.rarity)}</div>
        <div>⚡ Vitesse: ${c.speed || 50}</div>
        <div>1) ${c.attack_name_1} — ${c.attack_damage_1} (${c.attack_success_1}%)</div>
        <div>2) ${c.attack_name_2} — ${c.attack_damage_2} (${c.attack_success_2}%)</div>
      </div>
    </div>`;
}

function cloneCard(c) {
  return { ...c, hp: Number(c.hp), maxHp: Number(c.hp), speed: Number(c.speed || 50), dead: false };
}

function aliveCards(team) {
  return team.filter((c) => !c.dead);
}

function randomAliveIndex(team) {
  const idx = [];
  team.forEach((c, i) => { if (!c.dead) idx.push(i); });
  if (!idx.length) return -1;
  return idx[Math.floor(Math.random() * idx.length)];
}

function runWheel(needleEl, textEl, wheelEl, successChance) {
  return new Promise((resolve) => {
    const roll = Math.floor(Math.random() * 100) + 1;
    const ok = roll <= successChance;

    if (!needleEl || !textEl || !wheelEl) {
      resolve(ok);
      return;
    }

    wheelEl.style.setProperty('--success', `${successChance}%`);
    textEl.textContent = 'Lancement...';

    const resultAngle = (roll / 100) * 360;
    const spins = 360 * (4 + Math.floor(Math.random() * 3));
    const finalAngle = spins + resultAngle;

    needleEl.style.transition = 'none';
    needleEl.style.transform = 'translateX(-50%) rotate(0deg)';

    requestAnimationFrame(() => {
      needleEl.style.transition = 'transform 1.6s cubic-bezier(0.2, 0.8, 0.2, 1)';
      needleEl.style.transform = `translateX(-50%) rotate(${finalAngle}deg)`;
    });

    setTimeout(() => {
      textEl.textContent = ok
        ? `✅ Réussi (${roll} <= ${successChance})`
        : `❌ Raté (${roll} > ${successChance})`;
      resolve(ok);
    }, 1700);
  });
}

const app = document.getElementById('battleApp');
if (app) {
  const myPool = JSON.parse(app.dataset.myPool || '[]').map(cloneCard);
  const enemyTeam = JSON.parse(app.dataset.enemyTeam || '[]').map(cloneCard);

  let myTeam = [];
  let selectedIds = new Set();
  let battleStarted = false;
  let battleEnded = false;
  let enemyActiveIdx = 0;
  let myActiveIdx = -1;

  app.innerHTML = `
    <div class="battle-cards-wrap mx-auto">
      <div class="row g-3 battle-cards-row">
        <div class="col-md-5">
          <label class="form-label">Ta carte active</label>
          <div id="myActiveCard"></div>
        </div>
        <div class="col-md-2 d-flex align-items-center justify-content-center battle-vs-col">
          <h3 class="battle-vs-title mb-0">VS</h3>
        </div>
        <div class="col-md-5">
          <label class="form-label">Carte active adverse</label>
          <div id="enemyActiveCard"></div>
        </div>
      </div>
    </div>

    <div class="battle-controls-column">
      <div class="glass p-3 rounded mb-3">
        <h5 class="mb-2">Équipe adverse (3)</h5>
        <div id="enemyTeamPreview" class="small"></div>
      </div>

      <div class="glass p-3 rounded mb-3">
        <h5 class="mb-2">Tes 5 cartes (choisir 3)</h5>
        <div id="myPoolPick" class="small"></div>
        <button id="startBattleBtn" class="btn btn-primary btn-sm mt-2" disabled>Démarrer le combat</button>
      </div>

      <label class="form-label" for="activeCardSelect">Changer de carte active</label>
      <select id="activeCardSelect" class="form-select mb-3" disabled></select>

      <div class="d-flex gap-2 flex-wrap">
        <button class="btn btn-success attack-btn" data-slot="1" disabled>Attaque 1</button>
        <button class="btn btn-danger attack-btn" data-slot="2" disabled>Attaque 2</button>
        <button id="newBattleBtn" class="btn btn-outline-light d-none">Nouveau combat</button>
      </div>

      <div class="roulette-wheel-wrap mt-3">
        <div id="rouletteWheel" class="roulette-wheel">
          <div id="rouletteNeedle" class="roulette-needle"></div>
          <div class="roulette-center"></div>
        </div>
      </div>
      <div id="rouletteText" class="small mt-2"></div>

      <div class="mt-3 p-3 glass rounded" id="battleLog" style="min-height:160px;"></div>
    </div>
  `;

  const myActiveCardEl = document.getElementById('myActiveCard');
  const enemyActiveCardEl = document.getElementById('enemyActiveCard');
  const enemyTeamPreview = document.getElementById('enemyTeamPreview');
  const myPoolPick = document.getElementById('myPoolPick');
  const startBattleBtn = document.getElementById('startBattleBtn');
  const activeCardSelect = document.getElementById('activeCardSelect');
  const attackBtns = document.querySelectorAll('.attack-btn');
  const newBattleBtn = document.getElementById('newBattleBtn');
  const rouletteWheel = document.getElementById('rouletteWheel');
  const rouletteNeedle = document.getElementById('rouletteNeedle');
  const rouletteText = document.getElementById('rouletteText');
  const logEl = document.getElementById('battleLog');

  function log(msg) {
    logEl.innerHTML = `<div>${msg}</div>` + logEl.innerHTML;
  }

  function getMyActiveIndex() {
    if (myActiveIdx >= 0 && myTeam[myActiveIdx] && !myTeam[myActiveIdx].dead) {
      return myActiveIdx;
    }
    myActiveIdx = randomAliveIndex(myTeam);
    return myActiveIdx;
  }

  function refreshEnemyPreview() {
    enemyTeamPreview.innerHTML = enemyTeam
      .map((c, idx) => `<div>${idx + 1}. ${c.name} (${c.rarity}, ⚡${c.speed})</div>`)
      .join('');
  }

  function refreshPickUI() {
    myPoolPick.innerHTML = myPool.map((c) => {
      const checked = selectedIds.has(c.id) ? 'checked' : '';
      const disabled = (!selectedIds.has(c.id) && selectedIds.size >= 3) ? 'disabled' : '';
      return `<label class="d-block"><input type="checkbox" data-card-id="${c.id}" ${checked} ${disabled}> ${c.name} (${c.rarity}, ⚡${c.speed})</label>`;
    }).join('');

    myPoolPick.querySelectorAll('input[type="checkbox"]').forEach((el) => {
      el.addEventListener('change', () => {
        const id = Number(el.dataset.cardId);
        if (el.checked) selectedIds.add(id); else selectedIds.delete(id);
        refreshPickUI();
        startBattleBtn.disabled = selectedIds.size !== 3;
      });
    });

    startBattleBtn.disabled = selectedIds.size !== 3;
  }

  function refreshSelect() {
    const previous = myActiveIdx;
    activeCardSelect.innerHTML = myTeam.map((c, idx) => {
      const dead = c.dead ? '☠️ ' : '';
      const disabled = c.dead ? 'disabled' : '';
      return `<option value="${idx}" ${disabled}>${dead}${c.name} (PV ${c.hp}/${c.maxHp}, ⚡${c.speed})</option>`;
    }).join('');

    if (previous >= 0 && myTeam[previous] && !myTeam[previous].dead) {
      myActiveIdx = previous;
    } else {
      myActiveIdx = randomAliveIndex(myTeam);
    }

    if (myActiveIdx >= 0) {
      activeCardSelect.value = String(myActiveIdx);
    }
  }

  function renderActiveCards() {
    const myIdx = getMyActiveIndex();
    if (myIdx >= 0) {
      const my = myTeam[myIdx];
      myActiveCardEl.innerHTML = cardHtml(my, my.dead, my.maxHp);
    }

    if (enemyActiveIdx >= 0 && enemyTeam[enemyActiveIdx]) {
      const enemy = enemyTeam[enemyActiveIdx];
      enemyActiveCardEl.innerHTML = cardHtml(enemy, enemy.dead, enemy.maxHp);
    }
  }

  function checkAndAdvanceEnemy() {
    if (enemyActiveIdx >= 0 && enemyTeam[enemyActiveIdx] && !enemyTeam[enemyActiveIdx].dead) return;
    enemyActiveIdx = enemyTeam.findIndex((c) => !c.dead);
  }

  function battleOver() {
    return aliveCards(myTeam).length === 0 || aliveCards(enemyTeam).length === 0;
  }

  async function performAttack(attacker, defender, slot, label) {
    const success = Number(attacker[`attack_success_${slot}`]);
    const damage = Number(attacker[`attack_damage_${slot}`]);
    const attackName = attacker[`attack_name_${slot}`];

    const ok = await runWheel(rouletteNeedle, rouletteText, rouletteWheel, success);
    if (!ok) {
      log(`🔴 ${label} ${attacker.name} rate ${attackName}.`);
      return;
    }

    defender.hp = Math.max(0, defender.hp - damage);
    log(`🟢 ${label} ${attacker.name} utilise ${attackName} et inflige ${damage} dégâts.`);
    if (defender.hp <= 0) {
      defender.dead = true;
      log(`☠️ ${defender.name} est K.O.`);
    }
  }

  async function onAttack(slot) {
    if (!battleStarted || battleEnded) return;

    const myIdx = getMyActiveIndex();
    if (myIdx < 0 || enemyActiveIdx < 0) return;

    const me = myTeam[myIdx];
    const foe = enemyTeam[enemyActiveIdx];

    attackBtns.forEach((b) => { b.disabled = true; });
    activeCardSelect.disabled = true;

    const myFirst = Number(me.speed) >= Number(foe.speed);
    if (myFirst) {
      await performAttack(me, foe, slot, 'Toi:');
      const enemyWasKo = foe.dead;
      checkAndAdvanceEnemy();
      refreshSelect();
      renderActiveCards();
      if (!enemyWasKo && !battleOver()) {
        const aiSlot = Math.random() < 0.65 ? 1 : 2;
        const myCurrentIdx = getMyActiveIndex();
        if (myCurrentIdx >= 0 && enemyActiveIdx >= 0) {
          await performAttack(enemyTeam[enemyActiveIdx], myTeam[myCurrentIdx], aiSlot, 'IA:');
        }
      }
    } else {
      const aiSlot = Math.random() < 0.65 ? 1 : 2;
      await performAttack(foe, me, aiSlot, 'IA:');
      const meWasKo = me.dead;
      if (!meWasKo && !battleOver()) {
        const myCurrentIdx = getMyActiveIndex();
        if (myCurrentIdx >= 0 && enemyActiveIdx >= 0) {
          await performAttack(myTeam[myCurrentIdx], enemyTeam[enemyActiveIdx], slot, 'Toi:');
        }
      }
    }

    checkAndAdvanceEnemy();
    refreshSelect();
    renderActiveCards();

    if (battleOver()) {
      return endBattle(aliveCards(myTeam).length > 0);
    }

    attackBtns.forEach((b) => { b.disabled = false; });
    activeCardSelect.disabled = false;
  }

  async function endBattle(win) {
    battleEnded = true;
    attackBtns.forEach((b) => { b.disabled = true; });
    activeCardSelect.disabled = true;
    newBattleBtn.classList.remove('d-none');

    log(win ? '🏆 Victoire ! Tu as battu les 3 cartes adverses.' : '💀 Défaite... Tes 3 cartes sont K.O.');

    try {
      const payload = {
        result: win ? 'WIN' : 'LOSE',
        team_card_ids: myTeam.map((c) => c.id)
      };
      const res = await fetch('save_battle.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.ok) {
        if (win) {
          log(`💶 Récompense: +${data.delta_label || data.delta}`);
        } else if (data.removed_card_name) {
          log(`🧨 Défaite: ${data.removed_card_name} a été retirée de ta collection.`);
        }
      }
    } catch (e) {
      log('Erreur sauvegarde combat.');
    }
  }

  startBattleBtn.addEventListener('click', () => {
    myTeam = myPool.filter((c) => selectedIds.has(c.id)).map(cloneCard);
    if (myTeam.length !== 3) return;

    battleStarted = true;
    startBattleBtn.disabled = true;
    myPoolPick.querySelectorAll('input').forEach((el) => { el.disabled = true; });

    activeCardSelect.disabled = false;
    attackBtns.forEach((b) => { b.disabled = false; });

    enemyActiveIdx = enemyTeam.findIndex((c) => !c.dead);
    myActiveIdx = randomAliveIndex(myTeam);
    refreshSelect();
    renderActiveCards();

    log('🎯 Combat lancé ! Choisis ta carte active et ton attaque à chaque tour.');
  });

  attackBtns.forEach((btn) => {
    btn.addEventListener('click', () => onAttack(Number(btn.dataset.slot)));
  });

  activeCardSelect.addEventListener('change', () => {
    const next = Number(activeCardSelect.value);
    if (!Number.isNaN(next) && myTeam[next] && !myTeam[next].dead) {
      myActiveIdx = next;
      renderActiveCards();
    }
  });

  newBattleBtn.addEventListener('click', () => window.location.reload());

  refreshEnemyPreview();
  refreshPickUI();
}
