/* UI only. Secret player selections never enter the AI snapshot. */
(function () {
  'use strict';
  const T = window.Tides, R = window.TideRecords;
  const $ = id => document.getElementById(id);
  let game = null, selected = null, selectedAmount = null, historyOpen = false;
  let busy = false;
  const names = { A: 'Upper shore', B: 'Middle shore', C: 'Lower shore' };
  const el = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  function button(text, className, handler, disabled = false) {
    const b = el('button', text, className); b.disabled = disabled; b.addEventListener('click', handler); return b;
  }
  function show(screen) {
    for (const id of ['start', 'bird-select', 'play']) $(id).hidden = id !== screen;
    window.scrollTo({ top: 0, behavior: 'instant' });
    requestAnimationFrame(() => { const first = screen === 'play' ? $('action-buttons').querySelector('button') : $(screen).querySelector('button:not(:disabled),a,input'); if (first) first.focus({preventScroll:true}); });
  }
  function begin(role, bird) {
    window.TideExtras.start(role, bird);
    game = new T.Game(role, bird); selected = null; selectedAmount = null; historyOpen = false;
    $('export-status').textContent = ''; busy = false;
    window.TideGuide.reset(); game.nextRound(); window.TideExtras.wave(); show('play'); render();
  }
  function perform(fn) {
    if (busy) return;
    busy = true;
    try { fn(); render(); const next = $('action-buttons').querySelector('button') || $('primary-controls').querySelector('button'); next?.focus({preventScroll:true}); }
    catch (error) { $('export-status').textContent = `Action failed: ${error.message}`; }
    finally { busy = false; }
  }
  function render() {
    const s = game.view(), bird = T.BIRDS[s.bird], options = T.legal(s.tide);
    $('player-label').textContent = `You: ${s.playerRole === 'bird' ? 'Bird' : 'Human'} · Opponent: local AI`;
    $('tide').textContent = s.tide;
    $('open-zones').textContent = `Open ${options.filter(z => z !== 'Wait').join(' / ')} area${s.tide === 'High tide' ? ' · Wait allowed' : ' · No Wait'}`;
    $('eco').textContent = `${'●'.repeat(s.eco)}${'○'.repeat(3 - s.eco)}  ${s.eco}/3`;
    $('eco').style.color = s.eco <= 1 ? 'var(--danger)' : 'var(--teal)';
    $('effective').textContent = `${s.effective} / 5`;
    $('actual-round').textContent = `Round ${s.round}  · Rest rounds do not count`;
    for (const side of ['bird', 'human']) {
      $(side + '-score').replaceChildren(document.createTextNode(String(s.score[side])), el('small', ' / 17'));
      $(side + '-progress').value = Math.min(17, s.score[side]);
      $(side + '-owner').textContent = s.playerRole === side ? '· You' : '· AI';
    }
    $('bird-info').textContent = `${bird.english} · Preferred food: ${T.FOODS[bird.food]} +2`;
    $('zones').replaceChildren();
    for (const z of ['A', 'B', 'C']) {
      const open = options.includes(z), n = T.total(s.pools[z]);
      const card = el('section', undefined, 'zone' + (open ? '' : ' closed'));
      const head = el('div', undefined, 'zone-head'), title = el('h3');
      title.append(el('span', z, 'zone-letter'), document.createTextNode(names[z]));
      head.append(title, el('span', open ? 'Open' : 'Submerged', 'badge'));
      const meta = el('div', undefined, 'zone-meta');
      meta.append(el('span', `Base ${T.BASE[z]} points / tokens`), el('strong', `Initially ${T.total(T.INITIAL[z])} tokens`));
      card.append(head, meta);
      card.append(el('p', 'Starting resources', 'abundance-label'));
      T.FOODS.forEach((food, i) => { const row = el('div', undefined, 'food-row'); row.append(el('span', food), el('strong', `${T.INITIAL[z][i]} tokens`)); card.append(row); });
      card.append(el('p', 'Fixed starting quantities; these numbers do not change. Remaining quantities are hidden.', 'abundance-note'));
      $('zones').append(card);
    }
    $('result').hidden = !s.result;
    if (s.result) {
      $('result').className = 'result' + (!s.result.bird && !s.result.human ? ' failure' : '');
      $('result').replaceChildren(el('h2', s.result.title), el('p', s.result.reason),
        el('p', `Bird ${s.score.bird} points · Human ${s.score.human} points · Ecology ${s.eco}/3 · Effective rounds completed ${s.effective}/5 · Area resources A ${T.total(s.pools.A)} / B ${T.total(s.pools.B)} / C ${T.total(s.pools.C)}`, 'result-summary'));
    }
    $('action-buttons').replaceChildren(); $('primary-controls').replaceChildren();
    $('risk-note').hidden = true;
    $('reveal').hidden = !s.revealed;
    if (s.revealed) {
      const b = el('div'), h = el('div');
      b.append(el('small', 'Bird’s revealed action'), el('strong', R.action(s.revealed.bird)));
      h.append(el('small', 'Human’s revealed action'), el('strong', `${R.action(s.revealed.human)} · ${s.revealed.human === 'Wait' ? 'No harvest' : R.amountName(s.revealed.amount)}`));
      $('reveal').replaceChildren(b, h);
    }
    if (s.phase === 'secret') {
      $('phase-tag').textContent = '01 / Secret choice'; $('action-heading').textContent = 'Choose your area';
      $('action-help').textContent = 'The AI has independently locked its area. Ring the Decision Bell to lock yours and reveal both choices; the human then chooses how much to harvest.';
      for (const z of options) {
        const b = button(z === 'Wait' ? 'Wait Waiting [4 / W]' : `${z} area [${{A:1,B:2,C:3}[z]} / ${z}]`, 'choice' + (selected === z ? ' selected' : ''), () => { selected = z; render(); document.querySelector(`[data-action="${z}"]`)?.focus({preventScroll:true}); });
        b.setAttribute('aria-pressed', selected === z ? 'true' : 'false'); b.dataset.action = z;
        b.append(el('small', z === 'Wait' ? 'No resources drawn' : `Base ${T.BASE[z]} points / tokens`));
        $('action-buttons').append(b);
      }
      $('primary-controls').append(button('Ring Decision Bell · Lock & reveal', 'primary', () => perform(() => { window.TideExtras.bell(); game.reveal(selected); selectedAmount = null; }), !selected));
    } else if (s.phase === 'amount') {
      const humanWait = s.revealed.human === 'Wait';
      $('phase-tag').textContent = '02 / Areas revealed';
      $('action-heading').textContent = humanWait ? 'Both areas revealed — ready to resolve' : s.playerRole === 'human' ? 'Choose how much to harvest' : 'The human AI chooses its harvest';
      $('action-help').textContent = humanWait ? 'The human is waiting. If both sides Wait, ecology recovers and no effective round is counted.' : 'Areas cannot be changed. After the harvest is confirmed, the bird draws first, then the human draws one token at a time.';
      if (!humanWait && s.playerRole === 'human') {
        for (const n of [1, 2]) {
          const b = button(n === 1 ? 'Light harvest [1]' : 'Heavy harvest [2]', 'choice' + (selectedAmount === n ? ' selected' : ''), () => { selectedAmount = n; render(); document.querySelector(`[data-amount="${n}"]`)?.focus({preventScroll:true}); });
          b.dataset.amount = String(n); b.setAttribute('aria-pressed', selectedAmount === n ? 'true' : 'false');
          b.append(el('small', n === 1 ? 'Draw 1 · No harvest ecology cost' : 'Draw 2 · Ecology -1'));
          $('action-buttons').append(b);
        }
        if (selectedAmount) {
          const cost = (s.revealed.bird === s.revealed.human ? 1 : 0) + (selectedAmount === 2 ? 1 : 0);
          const used = selectedAmount + (s.revealed.bird === s.revealed.human ? 1 : 0);
          const dead = s.eco <= cost;
          if (dead) { $('risk-note').hidden = false; $('risk-note').textContent = 'Warning: this collision and harvest will reduce ecology to zero. Both sides will fail. You may still confirm.'; }
        }
      }
      const blocked = !humanWait && s.playerRole === 'human' && !selectedAmount;
      $('primary-controls').append(button(!humanWait && s.playerRole === 'bird' ? 'AI chooses harvest & resolves' : 'Confirm & resolve', 'primary', () => perform(() => game.resolve(selectedAmount)), blocked));
    } else {
      $('phase-tag').textContent = s.result ? 'Game over' : '03 / Resolved';
      $('action-heading').textContent = s.result ? 'The complete game record is available below' : 'Round resolved';
      $('action-help').textContent = s.result ? 'Copy or export both sides’ history. Refreshing clears this game’s detailed record.' : 'Review the outcome, then start the next round with a new random tide draw.';
      $('primary-controls').append(s.result ? button('Play again', 'primary', restart) : button('Next round · Draw tide', 'primary', () => perform(() => { selected = null; selectedAmount = null; game.nextRound(); window.TideExtras.wave(); })));
    }
    const last = s.history[s.history.length - 1];
    $('round-report').hidden = !last || !['resolved', 'ended'].includes(s.phase);
    if (last) {
      $('round-report').replaceChildren(el('h2', `Round ${last.round}  · ${last.empty ? 'Rest and recovery' : last.interrupted ? 'Resolution interrupted' : 'Round report'}`));
      const catches = el('div', undefined, 'reveal catch-summary');
      for (const side of ['bird', 'human']) {
        const title = side === 'bird' ? 'Bird' : 'Human';
        const zone = last[side + 'Action'];
        const draws = last.draws.filter(d => d.side === side);
        const card = el('div');
        card.append(el('strong', `${title} · ${zone === 'Wait' ? 'Waiting' : zone + ' area'}`));
        if (zone === 'Wait') card.append(el('p', 'Wait: no resources drawn this round.'));
        else if (!draws.length) card.append(el('p', 'Resource exhaustion ended resolution before this side could draw.'));
        else {
          const counts = new Map();
          draws.forEach(d => counts.set(d.food, (counts.get(d.food) || 0) + 1));
          card.append(el('p', 'Drawn: ' + [...counts].map(([food, n]) => `${food} × ${n}`).join(', ')));
          const scoring = draws.map(d => `${d.food} ${d.points} points`).join(' + ');
          card.append(el('p', `${scoring}; Credited this round:  ${last.credited[side]} points.`));
          if (last.interrupted && draws.some(d => d.remaining === 0)) card.append(el('p', 'Drawing the final token caused shared failure. This round’s pending points are not credited.'));
          else if (last.pending[side] !== last.credited[side]) card.append(el('p', 'An area was exhausted. This round’s pending points are not credited.'));
          if (side === 'human' && draws.length < last.amount) card.append(el('p', `Planned draws:  ${last.amount} tokens; An area was exhausted; remaining draws were cancelled.`));
        }
        catches.append(card);
      }
      $('round-report').append(catches);
      last.events.forEach((event, i) => { const p = el('p', event); p.style.animationDelay = `${i * 60}ms`; $('round-report').append(p); });
    }
    window.TideExtras.render(s);
    window.TideGuide.render(s);
    renderHistory(s);
  }
  function renderHistory(s) {
    $('history-toggle').textContent = `${historyOpen ? 'Hide ' : 'Show '}Both sides’ history (${s.history.length})`;
    $('history-toggle').setAttribute('aria-expanded', String(historyOpen)); $('history-content').hidden = !historyOpen;
    $('history-content').replaceChildren();
    if (!s.history.length) $('history-content').append(el('p', 'No rounds resolved yet. Secret choices are not recorded before the reveal.', 'muted'));
    for (const h of s.history) {
      const details = el('details', undefined, 'history-item');
      details.append(el('summary', `Round ${h.round}  · ${h.tide} · Bird ${h.birdAction} / Human ${h.humanAction} ${R.amountName(h.amount)} · ${h.empty ? 'Rest round' : h.interrupted ? 'Interrupted' : `Effective rounds ${h.after.effective}/5`}`));
      const p = el('p', R.roundText(h)); p.style.whiteSpace = 'pre-wrap'; details.append(p); $('history-content').append(details);
    }
  }
  function restart() {
    if (game && !window.confirm('Returning to the start clears this game’s detailed record. Copy or export anything you want to keep. Start again?')) return;
    window.TideExtras.abandon(); game = null; selected = null; show('start');
  }
  function download(format) {
    if (!game) return;
    const s = game.view();
    const payload = format === 'json' ? JSON.stringify(R.data(s), null, 2) : R.csv(s);
    const blob = new Blob([payload], { type: format === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `Between the Tides_History_${new Date().toISOString().replace(/[:.]/g, '-')}.${format}`;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('export-status').textContent = `Exported ${format.toUpperCase()} history, including full resource quantities by type for analysis.`;
  }
  async function copy() {
    if (!game) return;
    const payload = R.text(game.view());
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Unavailable');
      await navigator.clipboard.writeText(payload); $('export-status').textContent = 'Complete history copied.';
    } catch (_) {
      $('copy-text').value = payload; $('copy-dialog').showModal(); $('copy-text').focus(); $('copy-text').select();
      $('export-status').textContent = 'Automatic copying is unavailable. The text is ready for manual copying.';
    }
  }

  // Shortcuts only apply to the visible game; dialogs and text fields keep native keys.
  document.addEventListener('keydown', event => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || document.querySelector('dialog[open]')) return;
    if (event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
    const key = event.key.toLowerCase();
    if (!$('play').hidden && game) {
      const s = game.view();
      if (s.phase === 'secret' && ['1','2','3','4','a','b','c','w'].includes(key)) {
        const zone = ({'1':'A','2':'B','3':'C','4':'Wait',w:'Wait'})[key] || key.toUpperCase();
        const target = document.querySelector(`[data-action="${zone}"]`);
        if (target) { event.preventDefault(); target.click(); }
      } else if (s.phase === 'amount' && ['1','2'].includes(key)) {
        const target = document.querySelector(`[data-amount="${key}"]`);
        if (target) { event.preventDefault(); target.click(); }
      } else if ((key === 'enter' || key === ' ')) {
        const focused = document.activeElement;
        // Let Enter activate unrelated focused controls (history, settings, restart).
        if (focused !== document.body && !focused.closest('#action-buttons,#primary-controls')) return;
        const target = $('primary-controls').querySelector('button');
        event.preventDefault(); if (target && !target.disabled) target.click();
      }
    }
  });
  $('role-bird').addEventListener('click', () => show('bird-select'));
  $('role-human').addEventListener('click', () => begin('human', Math.floor(T.random() * T.BIRDS.length)));
  $('back-start').addEventListener('click', () => show('start'));
  T.BIRDS.forEach((bird, index) => {
    const b = button('', 'bird-card', () => begin('bird', index));
    b.dataset.bird = String(index); b.append(el('span', `0${index + 1}`, 'bird-number'), el('strong', bird.name), el('small', 'Bird species'), el('span', `Preferred food: ${T.FOODS[bird.food]} +2`, 'food-pref'));
    $('bird-options').append(b);
  });
  $('history-toggle').addEventListener('click', () => { historyOpen = !historyOpen; renderHistory(game.view()); });
  $('copy-history').addEventListener('click', copy);
  $('export-json').addEventListener('click', () => download('json'));
  $('export-csv').addEventListener('click', () => download('csv'));
  $('restart').addEventListener('click', restart);
  $('rules-open').addEventListener('click', () => $('rules-dialog').showModal());
  $('rules-close').addEventListener('click', () => $('rules-dialog').close());
  $('copy-close').addEventListener('click', () => $('copy-dialog').close());
  $('select-copy').addEventListener('click', () => { $('copy-text').focus(); $('copy-text').select(); });
})();
