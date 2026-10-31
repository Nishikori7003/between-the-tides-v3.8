(function () {
  'use strict';
  const $ = id => document.getElementById(id), key = 'tides-guide-enabled';
  let enabled = true, seen = new Set(), cache = new Map(), current = null;
  try { enabled = localStorage.getItem(key) !== 'false'; } catch (_) { /* file browsers may block storage */ }
  function sync() { $('guide-start').checked = enabled; $('guide-toggle').checked = enabled; }
  function render(s) {
    current = s;
    $('guide-panel').hidden = true;
    if (!enabled) return;
    const stage = `${s.round}:${s.phase}`;
    if (!cache.has(stage)) {
      const tips = [], claim = (id, text) => { if (!seen.has(id)) { seen.add(id); tips.push(text); } };
      let clues = false;
      if (s.phase === 'secret') {
        if (!seen.has('guess')) { clues = true; claim('guess', 'Before choosing: where might your opponent want to go? Consider their score, the bird’s preferred food, and previous choices.'); }
        else claim('tide-' + s.tide, s.tide === 'High tide' ? 'At high tide, choose A or Wait. Only when both sides Wait does ecology recover without counting an effective round.' : s.tide === 'Mid tide' ? 'At mid tide, A and B are open; Wait is unavailable. Their base values are 1 and 3 points per token.' : 'At low tide, A, B and C are open; Wait is unavailable. Outer areas offer more points but may attract your opponent too.');
      } else if (s.phase === 'amount') {
        claim('amount', 'Both areas are locked. The human now chooses: light harvest draws 1 token; heavy harvest draws 2 and costs 1 ecology.');
      } else {
        const h = s.history.at(-1);
        if (s.result) claim('result', 'Shared failure overrides scores. After 5 safe effective rounds, each side needs 17 points to succeed.');
        else if (h?.empty) claim('wait', 'When both sides Wait, ecology recovers by 1 (maximum 3). No effective round is counted and no resources are replenished.');
        else if (h) {
          if (h.birdAction === h.humanAction) claim('collision', 'Entering the same area costs 1 ecology. The bird loses no energy from the collision.');
          if (!tips.length && h.amount === 2) claim('large', 'Heavy harvesting draws an extra token and costs 1 ecology. This stacks with the cost of a collision.');
          if (!tips.length && h.draws.some(d => d.side === 'bird' && d.foodIndex === window.Tides.BIRDS[s.bird].food)) claim('preference', 'The bird earns +2 above the area’s base value for preferred food. The human receives no preference bonus.');
          if (!tips.length) claim('resource', 'Drawn tokens are permanently removed. Drawing the last token from any area immediately defeats both sides.');
        }
      }
      cache.set(stage, { text: tips.join(' '), clues });
    }
    const tip = cache.get(stage);
    $('guide-panel').hidden = !tip.text;
    $('guide-message').textContent = tip.text;
    $('guide-clues').hidden = !tip.clues;
    if (!tip.clues) $('guide-clues').open = false;
  }
  for (const id of ['guide-start', 'guide-toggle']) $(id).addEventListener('change', e => {
    enabled = e.target.checked; try { localStorage.setItem(key, String(enabled)); } catch (_) {}
    sync(); if (current) render(current);
  });
  sync();
  window.TideGuide = { render, reset() { seen = new Set(); cache = new Map(); current = null; $('guide-clues').open = false; } };
})();
