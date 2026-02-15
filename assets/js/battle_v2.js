const app = document.getElementById('battleApp');

function mult(atkType, defType) {
  if (atkType === 'Speciale' || defType === 'Speciale') return 1.0;
  if (atkType === 'Plante' && defType === 'Eau') return 1.25;
  if (atkType === 'Eau' && defType === 'Feu') return 1.25;
  if (atkType === 'Feu' && defType === 'Plante') return 1.25;

  if (defType === 'Plante' && atkType === 'Eau') return 0.8;
  if (defType === 'Eau' && atkType === 'Feu') return 0.8;
  if (defType === 'Feu' && atkType === 'Plante') return 0.8;
  return 1.0;
}

function roll(pct){ return (Math.floor(Math.random()*100)+1) <= pct; }

function aiChooseSlot(enemy, myHp) {
  // IA simple intelligente:
  // si elle peut finir avec atk2 probable, prend atk2 sinon atk1
  const d1 = enemy.attack_damage_1, s1 = enemy.attack_success_1;
  const d2 = enemy.attack_damage_2, s2 = enemy.attack_success_2;
  const expected1 = d1 * (s1/100);
  const expected2 = d2 * (s2/100);
  if (myHp <= d2 && s2 >= 45) return 2;
  return expected2 > expected1*1.15 ? 2 : 1;
}

function card(c){
  const t = (c.type||'').toLowerCase();
  return `
  <div class="tcg-card tcg-tall type-${t}">
    <div class="tcg-rarity rarity-${c.rarity}">${c.rarity}</div>
    <div class="tcg-header"><span>${c.name}</span><span>PV ${c.hp}</span></div>
    <div class="tcg-image">${c.image_path ? `<img src="${c.image_path}">` : `<div class="fallback-label">${c.type}</div>`}</div>
    <div class="tcg-body">
      <div>1) ${c.attack_name_1} — ${c.attack_damage_1} (${c.attack_success_1}%)</div>
      <div>2) ${c.attack_name_2} — ${c.attack_damage_2} (${c.attack_success_2}%)</div>
    </div>
  </div>`;
}

if (app) {
  const myDeck = JSON.parse(app.dataset.mydeck);
  const enemyDeck = JSON.parse(app.dataset.enemydeck);

  let round = 0, myWins = 0, enemyWins = 0;
  let myHp = 0, enemyHp = 0;
  let myCard = null, enemyCard = null;

  app.innerHTML = `
    <div class="glass p-3 rounded mb-3">
      <div id="score">Round 1/3 — Toi 0 : 0 IA</div>
    </div>
    <div class="row g-3">
      <div class="col-md-5"><div id="myZone"></div></div>
      <div class="col-md-2 d-flex align-items-center justify-content-center"><h3>VS</h3></div>
      <div class="col-md-5"><div id="enemyZone"></div></div>
    </div>
    <div class="mt-3 d-flex gap-2">
      <button class="btn btn-success" id="atk1">Attaque 1</button>
      <button class="btn btn-danger" id="atk2">Attaque 2</button>
    </div>
    <div class="roulette-wrap mt-3"><div id="rouletteBar"></div></div>
    <div id="rouletteText" class="small mt-1"></div>
    <div id="log" class="glass p-3 rounded mt-3" style="min-height:140px;"></div>
  `;

  const score = document.getElementById('score');
  const myZone = document.getElementById('myZone');
  const enemyZone = document.getElementById('enemyZone');
  const log = document.getElementById('log');
  const bar = document.getElementById('rouletteBar');
  const rt = document.getElementById('rouletteText');
  const atk1 = document.getElementById('atk1');
  const atk2 = document.getElementById('atk2');

  function push(m){ log.innerHTML = `<div>${m}</div>` + log.innerHTML; }

  function render(){
    myCard.hp = myHp; enemyCard.hp = enemyHp;
    myZone.innerHTML = card(myCard);
    enemyZone.innerHTML = card(enemyCard);
    score.textContent = `Round ${round+1}/3 — Toi ${myWins} : ${enemyWins} IA`;
  }

  function newRound(){
    myCard = {...myDeck[round]};
    enemyCard = {...enemyDeck[round]};
    myHp = parseInt(myCard.hp,10);
    enemyHp = parseInt(enemyCard.hp,10);
    render();
    push(`🎯 Nouveau round: ${myCard.name} vs ${enemyCard.name}`);
  }

  function animateRoll(successPct){
    return new Promise((resolve)=>{
      bar.classList.remove('success','fail');
      bar.style.width='0%';
      let t=0, dur=500, step=20;
      const it = setInterval(()=>{
        t+=step; bar.style.width = Math.min(100, (t/dur)*100)+'%';
        if(t>=dur){
          clearInterval(it);
          const ok = roll(successPct);
          bar.classList.add(ok?'success':'fail');
          rt.textContent = ok ? '✅ Réussi' : '❌ Raté';
          resolve(ok);
        }
      }, step);
    });
  }

  async function playerTurn(slot){
    atk1.disabled = atk2.disabled = true;
    const dmgRaw = parseInt(myCard[`attack_damage_${slot}`],10);
    const succ = parseInt(myCard[`attack_success_${slot}`],10);
    const name = myCard[`attack_name_${slot}`];
    const m = mult(myCard.type, enemyCard.type);
    const dmg = Math.max(1, Math.round(dmgRaw * m));

    const ok = await animateRoll(succ);
    if(ok){
      enemyHp = Math.max(0, enemyHp - dmg);
      push(`🟢 ${myCard.name} utilise ${name} (${m.toFixed(2)}x) et inflige ${dmg}.`);
    } else push(`🔴 ${myCard.name} rate ${name}.`);

    render();
    if(enemyHp<=0) return finishRound(true);

    // IA turn
    const aiSlot = aiChooseSlot(enemyCard, myHp);
    const aiDmgRaw = parseInt(enemyCard[`attack_damage_${aiSlot}`],10);
    const aiSucc = parseInt(enemyCard[`attack_success_${aiSlot}`],10);
    const aiName = enemyCard[`attack_name_${aiSlot}`];
    const aiM = mult(enemyCard.type, myCard.type);
    const aiDmg = Math.max(1, Math.round(aiDmgRaw * aiM));

    if(roll(aiSucc)){
      myHp = Math.max(0, myHp - aiDmg);
      push(`🔥 IA touche avec ${aiName} (${aiM.toFixed(2)}x) pour ${aiDmg}.`);
    } else push(`💨 IA rate ${aiName}.`);

    render();
    if(myHp<=0) return finishRound(false);

    atk1.disabled = atk2.disabled = false;
  }

  async function finishRound(playerWon){
    if(playerWon){ myWins++; push('🏁 Round gagné !'); }
    else { enemyWins++; push('💥 Round perdu.'); }

    round++;
    if(round >= 3){
      const finalWin = myWins > enemyWins;
      push(finalWin ? '🏆 BO3 remporté !' : '☠️ BO3 perdu.');
      try{
        const r = await fetch('save_battle.php',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({result: finalWin ? 'WIN':'LOSE', rounds_won: myWins})
        });
        const data = await r.json();
        if(data.ok) push(`💶 Récompense: +${data.delta_label}`);
      } catch(e){ push('Erreur sauvegarde récompense.'); }
      atk1.disabled = atk2.disabled = true;
      return;
    }
    newRound();
    atk1.disabled = atk2.disabled = false;
  }

  atk1.onclick = ()=>playerTurn(1);
  atk2.onclick = ()=>playerTurn(2);

  newRound();
}
