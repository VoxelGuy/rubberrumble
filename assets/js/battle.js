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

function cloneCard(c) {
  return { ...c, hp: Number(c.hp), maxHp: Number(c.hp), speed: Number(c.speed || 50), dead: false };
}

function getTypeMultiplier(attackType, defendType) {
  const atk = (attackType || '').toLowerCase();
  const def = (defendType || '').toLowerCase();
  if (atk === 'speciale' || def === 'speciale') return 1;
  if (atk === 'eau' && def === 'feu') return 2;
  if (atk === 'feu' && def === 'plante') return 2;
  if (atk === 'plante' && def === 'eau') return 2;
  if (atk === 'feu' && def === 'eau') return 0.5;
  if (atk === 'plante' && def === 'feu') return 0.5;
  if (atk === 'eau' && def === 'plante') return 0.5;
  return 1;
}

function aliveCards(team) {
  return team.filter((c) => !c.dead);
}

function randomAliveIndex(team) {
  const alive = [];
  team.forEach((c, i) => { if (!c.dead) alive.push(i); });
  if (!alive.length) return -1;
  return alive[Math.floor(Math.random() * alive.length)];
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cardHtml(c, opts = {}) {
  const {
    defeated = false,
    selectable = false,
    selected = false,
    showAttackButtons = false,
    bench = false,
    hideAttacks = false,
  } = opts;

  const typeClass = `type-${(c.type || '').toLowerCase()}`;
  const nameClass = typeNameClass(c.type);
  const defeatedClass = defeated ? ' defeated-card' : '';
  const selectableClass = selectable ? ' selectable-card' : '';
  const selectedClass = selected ? ' selected-card' : '';
  const benchClass = bench ? ' bench-card' : '';

  const img = c.image_path
    ? `<img src="${c.image_path}" alt="">`
    : `<div class="fallback-label">${c.type}</div>`;

  const hpValue = Math.max(0, Number(c.hp || 0));
  const maxValue = Math.max(1, Number(c.maxHp || c.hp || 1));
  const hpPct = Math.max(0, Math.min(100, Math.round((hpValue / maxValue) * 100)));

  const attacks = hideAttacks
    ? ''
    : showAttackButtons
    ? `
      <button class="btn btn-sm btn-outline-light card-attack-btn" data-slot="1">
        <strong>${c.attack_name_1}</strong><br><span>${c.attack_damage_1} dmg • ${c.attack_success_1}%</span>
      </button>
      <button class="btn btn-sm btn-outline-light card-attack-btn" data-slot="2">
        <strong>${c.attack_name_2}</strong><br><span>${c.attack_damage_2} dmg • ${c.attack_success_2}%</span>
      </button>
    `
    : `
      <div>1) ${c.attack_name_1} — ${c.attack_damage_1} (${c.attack_success_1}%)</div>
      <div>2) ${c.attack_name_2} — ${c.attack_damage_2} (${c.attack_success_2}%)</div>
    `;

  return `
    <div class="tcg-card ${typeClass}${defeatedClass}${selectableClass}${selectedClass}${benchClass}">
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
        <div class="card-attacks">${attacks}</div>
      </div>
    </div>`;
}

const app = document.getElementById('battleApp');
if (app) {
  const myPool = JSON.parse(app.dataset.myPool || '[]').map(cloneCard);
  const enemyTeam = JSON.parse(app.dataset.enemyTeam || '[]').map(cloneCard);

  let myTeam = [];
  let selectedIds = new Set();
  let myActiveIdx = -1;
  let enemyActiveIdx = 0;
  let battleStarted = false;
  let battleEnded = false;
  let turnLocked = false;

  app.innerHTML = `
    <div id="enemyTeamPanel" class="battle-top-panel enemy-team-panel glass p-2 rounded mb-2">
      <h6 class="mb-2 text-center">Équipe adverse</h6>
      <div id="enemyTopTeam" class="battle-team-grid"></div>
    </div>

    <div id="pickTeamPanel" class="battle-top-panel glass p-2 rounded mb-2">
      <h6 class="mb-2 text-center">Choisissez 3 parmi 5 de vos cartes</h6>
      <div id="mySelectTeam" class="battle-team-grid"></div>
      <div id="pickHint" class="small mt-2"></div>
    </div>

    <div id="battleField" class="d-none">
    <div id="enemyReserve" class="reserve-strip reserve-top"></div>
    <div class="battle-cards-wrap mx-auto">
      <div class="row g-3 battle-cards-row">
        <div class="col-5">
          <label class="form-label">Ta carte active</label>
          <div id="myActiveCard"></div>
        </div>
        <div class="col-2 d-flex align-items-center justify-content-center battle-vs-col">
          <h3 class="battle-vs-title mb-0">VS</h3>
        </div>
        <div class="col-5">
          <label class="form-label">Carte active adverse</label>
          <div id="enemyActiveCard"></div>
        </div>
      </div>
    </div>

    <div id="myBench" class="battle-bench reserve-strip reserve-bottom"></div>

    <div id="rouletteText" class="small mt-2"></div>
    <div class="mt-2 p-2 glass rounded" id="battleLog" style="min-height:110px;"></div>

    </div>

    <div id="battleResult" class="glass p-4 rounded text-center d-none mt-3">
      <h2 id="battleResultTitle" class="mb-2"></h2>
      <p id="battleResultText" class="mb-0"></p>
    </div>

    <button id="newBattleBtn" class="btn btn-outline-light d-none mt-3">Nouveau combat</button>

    <div id="battleRollOverlay" class="battle-roll-overlay d-none" aria-hidden="true">
      <div id="rouletteWheel" class="roulette-wheel">
        <div id="rouletteNeedle" class="roulette-needle"></div>
        <div class="roulette-center"></div>
      </div>
    </div>
  `;

  const enemyTopTeamEl = document.getElementById('enemyTopTeam');
  const enemyTeamPanel = document.getElementById('enemyTeamPanel');
  const pickTeamPanel = document.getElementById('pickTeamPanel');
  const battleField = document.getElementById('battleField');
  const battleResult = document.getElementById('battleResult');
  const battleResultTitle = document.getElementById('battleResultTitle');
  const battleResultText = document.getElementById('battleResultText');
  const mySelectTeamEl = document.getElementById('mySelectTeam');
  const pickHintEl = document.getElementById('pickHint');
  const myActiveCardEl = document.getElementById('myActiveCard');
  const enemyActiveCardEl = document.getElementById('enemyActiveCard');
  const myBenchEl = document.getElementById('myBench');
  const rouletteText = document.getElementById('rouletteText');
  const logEl = document.getElementById('battleLog');
  const newBattleBtn = document.getElementById('newBattleBtn');
  const battleRollOverlay = document.getElementById('battleRollOverlay');
  const rouletteWheel = document.getElementById('rouletteWheel');
  const rouletteNeedle = document.getElementById('rouletteNeedle');
  const enemyReserveEl = document.getElementById('enemyReserve');

  function log(msg) {
    logEl.innerHTML = `<div>${msg}</div>` + logEl.innerHTML;
  }

  function renderEnemyTop() {
    enemyTopTeamEl.innerHTML = enemyTeam
      .map((c) => `<div>${cardHtml(c, { defeated: c.dead, hideAttacks: true })}</div>`)
      .join('');
  }

  function renderEnemyReserve() {
    if (!battleStarted || enemyActiveIdx < 0) {
      enemyReserveEl.innerHTML = '';
      return;
    }
    enemyReserveEl.innerHTML = enemyTeam
      .map((c, idx) => ({ c, idx }))
      .filter(({ idx }) => idx !== enemyActiveIdx)
      .map(({ c }) => `<div class="reserve-slot enemy-reserve${c.dead ? ' dead' : ''}">${cardHtml(c, { defeated: c.dead, bench: true, hideAttacks: true })}</div>`)
      .join('');
  }

  function renderSelection() {
    mySelectTeamEl.innerHTML = myPool.map((c) => {
      const selected = selectedIds.has(c.id);
      return `<div class="pick-slot" data-card-id="${c.id}">${cardHtml(c, { selectable: true, selected })}</div>`;
    }).join('');

    const left = 3 - selectedIds.size;
    if (!battleStarted) {
      pickHintEl.textContent = left > 0
        ? `Sélectionne encore ${left} carte(s).`
        : 'Équipe prête. Combat lancé !';
    }

    mySelectTeamEl.querySelectorAll('.pick-slot').forEach((slot) => {
      slot.addEventListener('click', () => {
        if (battleStarted) return;
        const id = Number(slot.dataset.cardId);
        if (selectedIds.has(id)) {
          selectedIds.delete(id);
        } else if (selectedIds.size < 3) {
          selectedIds.add(id);
        }
        renderSelection();
        if (selectedIds.size === 3) {
          startBattle();
        }
      });
    });
  }

  function getMyActiveIndex() {
    if (myActiveIdx >= 0 && myTeam[myActiveIdx] && !myTeam[myActiveIdx].dead) return myActiveIdx;
    myActiveIdx = randomAliveIndex(myTeam);
    return myActiveIdx;
  }

  function checkAndAdvanceEnemy() {
    if (enemyActiveIdx >= 0 && enemyTeam[enemyActiveIdx] && !enemyTeam[enemyActiveIdx].dead) return;
    enemyActiveIdx = enemyTeam.findIndex((c) => !c.dead);
  }

  function battleOver() {
    return aliveCards(myTeam).length === 0 || aliveCards(enemyTeam).length === 0;
  }

  function bindAttackButtons() {
    myActiveCardEl.querySelectorAll('.card-attack-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slot = Number(btn.dataset.slot);
        onAttack(slot);
      });
    });
  }

  function renderBench() {
    if (!battleStarted) {
      myBenchEl.innerHTML = '';
      return;
    }

    myBenchEl.innerHTML = myTeam
      .map((c, idx) => ({ c, idx }))
      .filter(({ idx }) => idx !== myActiveIdx)
      .map(({ c, idx }) => {
        const deadClass = c.dead ? ' dead' : '';
        return `<div class="bench-slot${deadClass}" data-idx="${idx}">${cardHtml(c, { defeated: c.dead, bench: true, hideAttacks: true })}</div>`;
      })
      .join('');

    myBenchEl.querySelectorAll('.bench-slot').forEach((el) => {
      el.addEventListener('click', () => {
        if (!battleStarted || battleEnded || turnLocked) return;
        const idx = Number(el.dataset.idx);
        if (!Number.isNaN(idx) && myTeam[idx] && !myTeam[idx].dead) {
          myActiveIdx = idx;
          renderBattlefield();
        }
      });
    });
  }

  function renderBattlefield() {
    if (!battleStarted) {
      myActiveCardEl.innerHTML = '<div class="glass p-3 rounded small">Sélectionne 3 cartes pour commencer.</div>';
      enemyActiveCardEl.innerHTML = '<div class="glass p-3 rounded small">En attente du début du combat.</div>';
      renderBench();
      return;
    }

    const myIdx = getMyActiveIndex();
    const my = myTeam[myIdx];

    if (my) {
      myActiveCardEl.innerHTML = cardHtml(my, {
        defeated: my.dead,
        showAttackButtons: !my.dead && !battleEnded && !turnLocked,
      });
      bindAttackButtons();
    }

    checkAndAdvanceEnemy();
    if (enemyActiveIdx >= 0 && enemyTeam[enemyActiveIdx]) {
      const enemy = enemyTeam[enemyActiveIdx];
      enemyActiveCardEl.innerHTML = cardHtml(enemy, { defeated: enemy.dead, hideAttacks: true });
    } else {
      enemyActiveCardEl.innerHTML = '<div class="glass p-3 rounded small">Plus de carte adverse.</div>';
    }

    renderBench();
    renderEnemyTop();
    renderEnemyReserve();
  }

  function wheelAtCard(cardEl, successChance) {
    return new Promise((resolve) => {
      const roll = Math.floor(Math.random() * 100) + 1;
      const ok = roll <= successChance;

      if (!cardEl || !rouletteNeedle || !rouletteWheel || !battleRollOverlay) {
        resolve(ok);
        return;
      }

      rouletteText.textContent = 'Lancement...';
      rouletteWheel.style.setProperty('--success', `${successChance}%`);

      const rect = cardEl.getBoundingClientRect();
      battleRollOverlay.classList.remove('d-none');
      battleRollOverlay.style.left = `${rect.left + rect.width / 2}px`;
      battleRollOverlay.style.top = `${rect.top + rect.height / 2}px`;

      cardEl.classList.add('is-acting');

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
        battleRollOverlay.classList.add('d-none');
        cardEl.classList.remove('is-acting');
        rouletteText.textContent = ok
          ? `✅ Réussi (${roll} <= ${successChance})`
          : `❌ Raté (${roll} > ${successChance})`;
        resolve(ok);
      }, 1700);
    });
  }

  async function performAttack(attacker, defender, slot, ownerLabel, owner) {
    const success = Number(attacker[`attack_success_${slot}`]);
    const damage = Number(attacker[`attack_damage_${slot}`]);
    const attackName = attacker[`attack_name_${slot}`];

    const cardEl = owner === 'my'
      ? myActiveCardEl.querySelector('.tcg-card')
      : enemyActiveCardEl.querySelector('.tcg-card');

    const ok = await wheelAtCard(cardEl, success);
    if (!ok) {
      if (cardEl) {
        cardEl.classList.add('attack-miss');
        await wait(320);
        cardEl.classList.remove('attack-miss');
      }
      log(`🔴 ${ownerLabel} ${attacker.name} rate ${attackName}.`);
      return;
    }

    if (cardEl) {
      cardEl.classList.add('attack-lunge');
      await wait(220);
      cardEl.classList.remove('attack-lunge');
    }

    const multiplier = getTypeMultiplier(attacker.type, defender.type);
    const finalDamage = Math.max(1, Math.round(damage * multiplier));

    if (cardEl && multiplier > 1) {
      cardEl.classList.add('attack-super-effective');
      await wait(480);
      cardEl.classList.remove('attack-super-effective');
    }
    if (cardEl && multiplier < 1) {
      cardEl.classList.add('attack-not-effective');
      await wait(420);
      cardEl.classList.remove('attack-not-effective');
    }

    defender.hp = Math.max(0, defender.hp - finalDamage);
    const effectMsg = multiplier > 1 ? ' (Très efficace x2)' : multiplier < 1 ? ' (Pas très efficace x0,5)' : '';
    log(`🟢 ${ownerLabel} ${attacker.name} utilise ${attackName} et inflige ${finalDamage} dégâts.${effectMsg}`);

    renderBattlefield();

    if (defender.hp <= 0) {
      defender.dead = true;
      log(`☠️ ${defender.name} est K.O.`);
      renderBattlefield();
    }
  }

  async function onAttack(slot) {
    if (!battleStarted || battleEnded || turnLocked) return;

    const myIdx = getMyActiveIndex();
    if (myIdx < 0 || enemyActiveIdx < 0) return;

    turnLocked = true;
    renderBattlefield();

    const me = myTeam[myIdx];
    const foe = enemyTeam[enemyActiveIdx];
    const myFirst = Number(me.speed) >= Number(foe.speed);

    if (myFirst) {
      await performAttack(me, foe, slot, 'Toi:', 'my');
      const enemyWasKo = foe.dead;
      checkAndAdvanceEnemy();
      renderBattlefield();

      if (!enemyWasKo && !battleOver()) {
        const aiSlot = Math.random() < 0.65 ? 1 : 2;
        const myCurrentIdx = getMyActiveIndex();
        if (myCurrentIdx >= 0 && enemyActiveIdx >= 0) {
          await performAttack(enemyTeam[enemyActiveIdx], myTeam[myCurrentIdx], aiSlot, 'IA:', 'enemy');
        }
      }
    } else {
      const aiSlot = Math.random() < 0.65 ? 1 : 2;
      await performAttack(foe, me, aiSlot, 'IA:', 'enemy');
      const meWasKo = me.dead;

      if (!meWasKo && !battleOver()) {
        const myCurrentIdx = getMyActiveIndex();
        if (myCurrentIdx >= 0 && enemyActiveIdx >= 0) {
          await performAttack(myTeam[myCurrentIdx], enemyTeam[enemyActiveIdx], slot, 'Toi:', 'my');
        }
      }
    }

    checkAndAdvanceEnemy();
    renderBattlefield();

    if (battleOver()) {
      await endBattle(aliveCards(myTeam).length > 0);
      return;
    }

    turnLocked = false;
    renderBattlefield();
  }

  async function endBattle(win) {
    battleEnded = true;
    turnLocked = false;
    newBattleBtn.classList.remove('d-none');

    log(win ? '🏆 Victoire ! Tu as battu les 3 cartes adverses.' : '💀 Défaite... Tes 3 cartes sont K.O.');

    let resultDetail = win
      ? 'Victoire ! Tu as battu les 3 cartes adverses.'
      : 'Défaite... Tes 3 cartes sont K.O.';

    try {
      const payload = { result: win ? 'WIN' : 'LOSE', team_card_ids: myTeam.map((c) => c.id) };
      const res = await fetch('save_battle.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        if (win) {
          const gain = data.delta_label || data.delta;
          log(`💶 Récompense: +${gain}`);
          resultDetail = `Victoire ! Tu as gagné ${gain}.`;
        } else if (data.removed_card_name) {
          log(`🧨 Défaite: ${data.removed_card_name} a été retirée de ta collection.`);
          resultDetail = `Défaite... Carte perdue : ${data.removed_card_name}.`;
        }
      }
    } catch (e) {
      log('Erreur sauvegarde combat.');
    }

    battleField.classList.add('d-none');
    battleResult.classList.remove('d-none');
    battleResultTitle.textContent = win ? 'Gagné' : 'Perdu';
    battleResultTitle.className = win ? 'mb-2 text-success' : 'mb-2 text-danger';
    battleResultText.textContent = resultDetail;

    renderBattlefield();
  }

  async function startBattle() {
    if (battleStarted || selectedIds.size !== 3) return;
    myTeam = myPool.filter((c) => selectedIds.has(c.id)).map(cloneCard);
    battleStarted = true;
    myActiveIdx = randomAliveIndex(myTeam);
    enemyActiveIdx = enemyTeam.findIndex((c) => !c.dead);
    app.classList.add('battle-transitioning');
    await wait(650);
    enemyTeamPanel.classList.add('d-none');
    pickTeamPanel.classList.add('d-none');
    battleField.classList.remove('d-none');
    app.classList.remove('battle-transitioning');
    app.classList.add('battle-live');
    pickHintEl.textContent = 'Combat en cours !';
    renderSelection();
    renderBattlefield();
    log('🎯 Combat lancé ! Clique sur le nom d’une attaque sur ta carte active.');
  }

  newBattleBtn.addEventListener('click', () => window.location.reload());

  renderEnemyTop();
  renderSelection();
  renderBattlefield();
}
