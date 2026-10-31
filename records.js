(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.TideRecords = factory(root.Tides);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (T) {
  'use strict';
  const action = zone => zone === 'Wait' ? 'Wait (Waiting)' : `${zone} area`;
  const amountName = amount => amount === 2 ? 'Heavy harvest' : amount === 1 ? 'Light harvest' : amount === 0 ? 'No harvest' : 'Not chosen yet';
  const poolText = pools => Object.entries(pools).map(([z, counts]) => `${z}: ${T.FOODS.map((food, i) => `${food} ${counts[i]}`).join(' / ')} (total ${T.total(counts)})`).join('\n');
  function abundance(zone) {
    const groups = new Map();
    T.INITIAL[zone].forEach((count, i) => {
      if (!groups.has(count)) groups.set(count, []);
      groups.get(count).push(T.FOODS[i]);
    });
    return [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([, foods]) => foods.join(' = ')).join(' > ');
  }
  function roundText(h) {
    return [`Round ${h.round}  | ${h.tide} | ${h.empty ? 'Rest round' : h.interrupted ? 'Interrupted round' : 'Effective rounds'} | Completed ${h.after.effective}/5`,
      `Bird: ${action(h.birdAction)}; Human: ${action(h.humanAction)}, ${amountName(h.amount)}`,
      ...h.events,
      `Pending points: Bird ${h.pending.bird}, Human ${h.pending.human}; Credited: Bird ${h.credited.bird}, Human ${h.credited.human}`,
      `Total: Bird ${h.before.score.bird} → ${h.after.score.bird}, Human ${h.before.score.human} → ${h.after.score.human}`,
      `Ecology: ${h.before.eco} → ${h.after.eco}`,
      `Resources before\n${poolText(h.before.pools)}`, `Resources after\n${poolText(h.after.pools)}`,
      h.result ? `Result: ${h.result.title}. ${h.result.reason}` : 'The game continues.'].join('\n');
  }
  function data(s) {
    const output = { format: 'between-the-tides-history', version: 3, rules: '3.8 web edition, based on 3.75 playtest rules and agreed rulings',
      playerRole: s.playerRole, bird: T.BIRDS[s.bird], foodsOrder: T.FOODS,
      initial: { score: { bird: 0, human: 0 }, eco: 3, pools: T.INITIAL },
      current: { round: s.round, effective: s.effective, tide: s.tide, phase: s.phase,
        score: s.score, eco: s.eco, pools: s.pools,
        revealedActions: s.phase === 'amount' ? s.revealed : null },
      history: s.history, result: s.result };
    const copy = JSON.parse(JSON.stringify(output));
    copy.resourceDisclosure = 'Analysis records always include full quantities by resource type.';
    copy.initialAbundance = Object.fromEntries(['A', 'B', 'C'].map(z => [z, abundance(z)]));
    return copy;
  }
  function text(s) {
    const bird = T.BIRDS[s.bird];
    const lines = ['Between the Tides · Complete history',
      'Rules: playtest rules; choose harvest amount after the reveal; bird draws first; no points credited this round if an area is exhausted.',
      `Player: ${s.playerRole === 'bird' ? 'Bird' : 'Human'}; Opponent: local AI`,
      `Bird: ${bird.english}; Preferred food: ${T.FOODS[bird.food]}`,
      'Start: both scores 0, ecology 3, effective rounds 0/5', poolText(T.INITIAL), '',
      ...s.history.map(roundText), '',
      `Current: Round ${s.round}, Effective rounds completed ${s.effective}/5; Bird ${s.score.bird} points, Human ${s.score.human} points, Ecology ${s.eco}`];
    if (s.phase === 'secret') lines.push(`This round’s tide: ${s.tide}; Both choices are still secret.`);
    if (s.phase === 'amount') lines.push(`This round’s tide: ${s.tide}; Revealed: Bird ${action(s.revealed.bird)}, Human ${action(s.revealed.human)}; Not yet resolved.`);
    if (s.result) lines.push(`${s.result.title}: ${s.result.reason}`);
    return lines.join('\n\n');
  }
  function csv(s) {
    const headers = ['Round number','Tide','Bird species','Player role','Bird action','Human action','Human harvest amount','Rest round','Interrupted round','Effective rounds before','Effective rounds after','Bird pending','Human pending','Bird credited','Human credited','Bird total before','Bird total after','Human total before','Human total after','Ecology before','Ecology after','Draw order and resources','Resolution events','Result','Reason'];
    for (const when of ['before','after']) for (const zone of ['A','B','C']) for (const food of T.FOODS) headers.push(`${zone}_${food}_${when}`);
    const rows = s.history.map(h => {
      const row = [h.round,h.tide,T.BIRDS[s.bird].name,s.playerRole,h.birdAction,h.humanAction,h.amount,h.empty,h.interrupted,h.before.effective,h.after.effective,
        h.pending.bird,h.pending.human,h.credited.bird,h.credited.human,h.before.score.bird,h.after.score.bird,h.before.score.human,h.after.score.human,h.before.eco,h.after.eco,
        h.draws.map(d => `${d.side === 'bird' ? 'Bird' : 'Human'}:${d.zone}:${d.food}:Pending: ${d.points}:Remaining: ${d.remaining}`).join('; '),h.events.join('; '),h.result?.title || '',h.result?.reason || ''];
      for (const when of ['before','after']) for (const zone of ['A','B','C']) row.push(...h[when].pools[zone]);
      return row;
    });
    const quote = x => '"' + String(x).replace(/"/g, '""') + '"';
    return '\uFEFF' + [headers, ...rows].map(row => row.map(quote).join(',')).join('\r\n');
  }
  return { action, amountName, poolText, abundance, roundText, data, text, csv };
});
