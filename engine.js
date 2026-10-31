/* Between the Tides · Playtest rules and agreed rulings. Fully offline. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Tides = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const FOODS = ['Shellfish', 'Worms', 'Crabs'];
  const BIRDS = [
    { name: 'Oystercatcher', english: 'Oystercatcher', food: 0 },
    { name: 'Curlew', english: 'Curlew', food: 1 },
    { name: 'Redshank', english: 'Redshank', food: 2 }
  ];
  const INITIAL = { A: [3, 4, 5], B: [4, 5, 3], C: [5, 3, 4] };
  const BASE = { A: 1, B: 3, C: 5 };
  const TIDES = ['High tide', 'High tide', 'Mid tide', 'Mid tide', 'Low tide', 'Low tide'];
  const clone = value => JSON.parse(JSON.stringify(value));
  const total = resources => resources.reduce((a, b) => a + b, 0);
  function random() {
    if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
      const n = new Uint32Array(1);
      globalThis.crypto.getRandomValues(n);
      return n[0] / 4294967296;
    }
    return Math.random();
  }
  function pick(n, rng) {
    const r = rng();
    if (!Number.isFinite(r) || r < 0 || r >= 1) throw new Error('Random source must return a number in [0, 1).');
    return Math.floor(r * n);
  }
  function legal(tide) {
    if (tide === 'High tide') return ['A', 'Wait'];
    if (tide === 'Mid tide') return ['A', 'B'];
    if (tide === 'Low tide') return ['A', 'B', 'C'];
    throw new Error('Unknown tide.');
  }
  function initialState(playerRole, bird) {
    if (!['bird', 'human'].includes(playerRole) || !Number.isInteger(bird) || !BIRDS[bird]) throw new Error('Invalid role.');
    return { playerRole, bird, score: { bird: 0, human: 0 }, eco: 3, effective: 0,
      round: 0, tide: null, pools: clone(INITIAL), phase: 'ready', revealed: null,
      history: [], result: null };
  }
  function resultFor(s, reason) {
    const collapse = !!reason;
    const bird = !collapse && s.score.bird >= 17;
    const human = !collapse && s.score.human >= 17;
    return { bird, human, title: bird && human ? 'Both sides succeed' : bird ? 'Bird succeeds / Human fails' : human ? 'Human succeeds / Bird fails' : 'Both sides fail',
      reason: reason || (bird && human ? 'Five effective rounds completed. Both sides reached 17 points, with ecology and all resource pools safe.' : bird ? 'Five effective rounds completed. The bird reached 17 points; the human did not.' : human ? 'Five effective rounds completed. The human reached 17 points; the bird did not.' : 'Five effective rounds completed. Neither side reached 17 points, although ecology and resources remain safe.'),
      kind: collapse ? 'collapse' : 'five-rounds' };
  }
  // Pure transition: never mutate the input. All draws precede score commitment.
  function settle(input, birdAction, humanAction, amount, drawRng = random) {
    if (input.result || !['secret', 'amount'].includes(input.phase)) throw new Error('Cannot resolve at this stage.');
    if (!legal(input.tide).includes(birdAction) || !legal(input.tide).includes(humanAction)) throw new Error('Illegal area choice.');
    if (humanAction === 'Wait' ? amount !== 0 : ![1, 2].includes(amount)) throw new Error('Illegal harvest amount.');
    const s = clone(input);
    const before = { score: clone(s.score), eco: s.eco, effective: s.effective, pools: clone(s.pools) };
    const record = { round: s.round, tide: s.tide, bird: s.bird, birdAction, humanAction, amount,
      empty: birdAction === 'Wait' && humanAction === 'Wait', before, draws: [],
      pending: { bird: 0, human: 0 }, credited: { bird: 0, human: 0 }, events: [], interrupted: false };
    s.revealed = { bird: birdAction, human: humanAction, amount };
    const finish = () => {
      record.after = { score: clone(s.score), eco: s.eco, effective: s.effective, pools: clone(s.pools) };
      record.result = clone(s.result);
      s.history.push(record);
      s.phase = s.result ? 'ended' : 'resolved';
      return s;
    };
    if (record.empty) {
      s.eco = Math.min(3, s.eco + 1);
      record.events.push(`Both sides Wait: Rest round, Ecological health ${before.eco} → ${s.eco}, does not count as an effective round; no resources are replenished.`);
      return finish();
    }
    for (const [side, zone, count] of [['bird', birdAction, birdAction === 'Wait' ? 0 : 1], ['human', humanAction, amount]]) {
      if (side === 'human' && count > 0) record.events.push(`Human in ${humanAction} : began ${amount === 2 ? 'heavy' : 'light'} harvest.`);
      for (let i = 0; i < count; i++) {
        const pool = s.pools[zone];
        if (total(pool) < 1) throw new Error('Cannot draw from an empty resource pool.');
        let ticket = pick(total(pool), drawRng);
        let food = 0;
        while (ticket >= pool[food]) { ticket -= pool[food]; food++; }
        pool[food]--;
        const points = BASE[zone] + (side === 'bird' && BIRDS[s.bird].food === food ? 2 : 0);
        record.pending[side] += points;
        record.draws.push({ side, zone, food: FOODS[food], foodIndex: food, points, remaining: total(pool) });
        record.events.push(`${side === 'bird' ? 'Bird' : 'Human'} in ${zone} area drew ${FOODS[food]}, pending: ${points} points.`);
        if (total(pool) === 0) {
          record.interrupted = true;
          s.result = resultFor(s, `${zone} was emptied by the last draw. Both sides immediately fail. Pending points this round are not credited; all further draws and resolution stop.`);
          record.events.push(s.result.reason);
          return finish();
        }
      }
    }
    record.credited = clone(record.pending);
    for (const side of ['bird', 'human']) s.score[side] += record.credited[side];
    record.events.push(`Points credited this round: Bird +${record.credited.bird}, Human +${record.credited.human}.`);
    if (birdAction === humanAction) { s.eco--; record.events.push('Both sides entered the same area: ecology -1.'); }
    if (amount === 2) { s.eco--; record.events.push('Heavy harvesting: ecology -1 more.'); }
    s.eco = Math.max(0, s.eco);
    // A collapse interrupts completion of this round. Its number remains in history.
    if (s.eco === 0) {
      s.result = resultFor(s, 'Collision and harvesting reduced ecology to 0. Both sides immediately fail.');
      record.interrupted = true;
      record.events.push(s.result.reason);
      return finish();
    }
    s.effective++;
    if (s.effective === 5) s.result = resultFor(s);
    return finish();
  }

  // AI receives a hand-built public snapshot only: no engine, UI, pending input or draw RNG.
  function publicInfo(s) {
    return clone({ score: s.score, eco: s.eco, effective: s.effective, tide: s.tide,
      pools: s.pools, bird: s.bird, history: s.history.map(h => ({ tide: h.tide,
        birdAction: h.birdAction, humanAction: h.humanAction, amount: h.amount,
        ecoBefore: h.before.eco,
        totalsBefore: Object.fromEntries(Object.entries(h.before.pools).map(([z, p]) => [z, total(p)])) })) });
  }
  function expected(s, side, zone, amount = 1) {
    if (zone === 'Wait') return 0;
    return side === 'bird' ? BASE[zone] + 2 * s.pools[zone][BIRDS[s.bird].food] / Math.max(1, total(s.pools[zone])) : BASE[zone] * amount;
  }
  function softmax(items, temperature) {
    const max = Math.max(...items.map(x => x.value));
    const weights = items.map(x => Math.exp((x.value - max) / temperature));
    const sum = total(weights);
    return items.map((x, i) => ({ ...x, probability: weights[i] / sum }));
  }
  function opponentDistribution(s, side) {
    const actions = legal(s.tide);
    const key = side === 'bird' ? 'birdAction' : 'humanAction';
    const recent = s.history.slice(-6);
    return softmax(actions.map(zone => {
      const visits = recent.filter(h => h[key] === zone).length;
      const need = Math.max(0, 17 - s.score[side]);
      const gain = expected(s, side, zone);
      let value = Math.min(gain, need) * (need ? 1 : 0.1) + visits * 0.45;
      if (zone === 'Wait') value += (3 - s.eco) * 2.3 + (need === 0 ? 1.5 : 0);
      else {
        const n = total(s.pools[zone]);
        value -= n <= 1 ? 100 : n <= 3 ? 3 : 0;
        if (s.tide === 'High tide') value -= (3 - s.eco) * 1.2;
      }
      return { zone, value };
    }), 2.2);
  }
  // Publicly revealed bird/human regions are legitimate inputs for amount selection.
  function evaluate(s, side, birdZone, humanZone, amount) {
    const empty = birdZone === 'Wait' && humanZone === 'Wait';
    const collision = birdZone === humanZone && !empty;
    const cost = (collision ? 1 : 0) + (amount === 2 ? 1 : 0);
    const pools = clone(s.pools);
    const used = { A: 0, B: 0, C: 0 };
    if (birdZone !== 'Wait') used[birdZone]++;
    if (humanZone !== 'Wait') used[humanZone] += amount;
    const exhausted = Object.keys(used).some(z => total(pools[z]) - used[z] <= 0);
    if (exhausted || s.eco - cost <= 0) return { risk: 1, value: -10000 };
    const eco = empty ? Math.min(3, s.eco + 1) : s.eco - cost;
    const left = 5 - s.effective;
    const gains = { bird: expected(s, 'bird', birdZone), human: expected(s, 'human', humanZone, amount) };
    const ownNeed = Math.max(0, 17 - s.score[side]);
    const other = side === 'bird' ? 'human' : 'bird';
    const otherNeed = Math.max(0, 17 - s.score[other]);
    let value = Math.min(ownNeed, gains[side]) * (1.1 + 1 / left);
    value += Math.min(otherNeed, gains[other]) * 0.28;
    if (ownNeed > 0 && gains[side] >= ownNeed) value += 5;
    if (otherNeed > 0 && gains[other] >= otherNeed) value += 1.5;
    value += (eco - s.eco) * (left > 1 ? 2.8 : 0.2);
    if (eco === 1 && left > 1) value -= 3.5;
    for (const z of Object.keys(used)) {
      const remain = total(pools[z]) - used[z];
      if (used[z] && left > 1) value -= remain <= 2 ? 4 : remain <= 4 ? 1.5 : 0;
    }
    if (!empty && left > 1 && ownNeed > gains[side]) {
      // Conservative tempo estimate, using accessible future average opportunities.
      const pace = (ownNeed - gains[side]) / (left - 1);
      value -= Math.max(0, pace - (side === 'bird' ? 4.5 : 5.5)) * 2;
    }
    if (!empty && left === 1) {
      value += s.score[side] + gains[side] >= 17 ? 35 : -35;
      value += s.score[other] + gains[other] >= 17 ? 5 : 0;
    }
    if (empty) value += ownNeed === 0 ? 1 : -0.8;
    return { risk: 0, value };
  }
  function chooseAmount(s, birdZone, humanZone, rng = random) {
    if (humanZone === 'Wait') return 0;
    const small = evaluate(s, 'human', birdZone, humanZone, 1);
    const large = evaluate(s, 'human', birdZone, humanZone, 2);
    if (small.risk !== large.risk) return small.risk < large.risk ? 1 : 2;
    const difference = large.value - small.value;
    if (Math.abs(difference) > 1.2) return difference > 0 ? 2 : 1;
    return rng() < 1 / (1 + Math.exp(-difference / 0.5)) ? 2 : 1;
  }
  function chooseRegion(s, side, rng = random) {
    if (side === 'bird') return chooseBirdRegion(s, rng);
    const other = side === 'bird' ? 'human' : 'bird';
    const predictions = opponentDistribution(s, other);
    const candidates = legal(s.tide).map(zone => {
      let risk = 0, value = 0;
      for (const p of predictions) {
        const bz = side === 'bird' ? zone : p.zone;
        const hz = side === 'human' ? zone : p.zone;
        const bestAmount = chooseAmount(s, bz, hz, () => 0.5);
        const amounts = [{ amount: bestAmount, weight: 1 }];
        // A human opponent may choose a different amount; estimate from public history.
        if (side === 'bird' && hz !== 'Wait') {
          const recent = s.history.slice(-6).filter(h => h.humanAction !== 'Wait');
          const largeRate = (1 + recent.filter(h => h.amount === 2).length) / (2 + recent.length);
          amounts[0].weight = 0.75;
          amounts.push({ amount: 1, weight: 0.25 * (1 - largeRate) }, { amount: 2, weight: 0.25 * largeRate });
        }
        for (const a of amounts) {
          const e = evaluate(s, side, bz, hz, a.amount);
          risk += p.probability * a.weight * e.risk;
          value += p.probability * a.weight * e.value;
        }
      }
      return { zone, risk, value };
    });
    // First minimize estimated immediate joint-failure risk. Randomness only breaks close choices.
    const minRisk = Math.min(...candidates.map(c => c.risk));
    const safe = candidates.filter(c => c.risk <= minRisk + 1e-9);
    const best = Math.max(...safe.map(c => c.value));
    const close = softmax(safe.filter(c => c.value >= best - 1.2), 0.5);
    let roll = rng();
    for (const c of close) { roll -= c.probability; if (roll < 0) return c.zone; }
    return close[close.length - 1].zone;
  }

  // Forecasts a human response to HYPOTHETICAL revealed regions. Never reads actual secret choices.
  function humanAmountDistribution(s, birdZone, humanZone) {
    if (humanZone === 'Wait') return [{ amount: 0, weight: 1 }];
    const small = evaluate(s, 'human', birdZone, humanZone, 1);
    const large = evaluate(s, 'human', birdZone, humanZone, 2);
    const recent = s.history.slice(-6).filter(h => h.humanAction !== 'Wait');
    const largeRate = (1 + recent.filter(h => h.amount === 2).length) / (2 + recent.length);
    const fatalChoices = recent.filter(h => {
      if (h.amount !== 2 || h.ecoBefore === undefined || !h.totalsBefore) return false;
      const collision = h.birdAction === h.humanAction;
      return h.ecoBefore <= (collision ? 2 : 1) || h.totalsBefore[h.humanAction] <= (collision ? 3 : 2);
    }).length;
    // Small, nonzero mistake prior; past dangerous choices increase it.
    const mistake = Math.min(0.35, (0.2 + fatalChoices) / (10 + recent.length));
    let probability;
    if (small.risk !== large.risk) probability = large.risk ? mistake : 1 - mistake;
    else if (small.risk) probability = largeRate;
    else {
      const delta = large.value - small.value;
      const rational = Math.abs(delta) > 1.2 ? (delta > 0 ? 1 : 0) : 1 / (1 + Math.exp(-delta / 0.5));
      probability = (2 * rational + recent.length * largeRate) / (2 + recent.length);
    }
    return [{ amount: 1, weight: 1 - probability }, { amount: 2, weight: probability }];
  }
  function chooseBirdRegion(s, rng) {
    const predictions = opponentDistribution(s, 'human');
    const candidates = legal(s.tide).map(zone => {
      let risk = 0, value = 0;
      for (const p of predictions) {
        for (const a of humanAmountDistribution(s, zone, p.zone)) {
          const e = evaluate(s, 'bird', zone, p.zone, a.amount);
          const weight = p.probability * a.weight;
          risk += weight * e.risk;
          // A finite, substantial loss penalty permits small risk/reward trade-offs.
          // This changes strategy only, not the game's score or failure conditions.
          const ecoAfter = s.eco - (zone === p.zone && zone !== 'Wait' ? 1 : 0) - (a.amount === 2 ? 1 : 0);
          // Preserve an ecological buffer while more effective rounds remain.
          const bufferCost = s.effective < 4 && zone !== 'Wait' && ecoAfter === 1 ? 48 : 0;
          value += weight * (e.risk ? -200 : e.value - bufferCost);
        }
      }
      return { zone, risk, value };
    });
    const survivable = candidates.filter(c => c.risk < 1 - 1e-9);
    const eligible = survivable.length ? survivable : candidates;
    const best = Math.max(...eligible.map(c => c.value));
    const close = softmax(eligible.filter(c => c.value >= best - 1.2), 0.5);
    let roll = rng();
    for (const c of close) { roll -= c.probability; if (roll < 0) return c.zone; }
    return close[close.length - 1].zone;
  }

  class Game {
    #s; #aiAction; #nature; #policy;
    constructor(playerRole, bird, options = {}) {
      // Separate random channels; the policy never receives nature's RNG.
      this.#nature = options.nature || random;
      this.#policy = options.policy || random;
      this.#s = initialState(playerRole, bird);
      this.#aiAction = null;
    }
    view() { return clone(this.#s); }
    nextRound() {
      if (!['ready', 'resolved'].includes(this.#s.phase) || this.#s.result) throw new Error('Cannot begin the next round.');
      this.#s.round++;
      this.#s.tide = TIDES[pick(6, this.#nature)];
      this.#s.revealed = null;
      this.#s.phase = 'secret';
      this.#aiAction = chooseRegion(publicInfo(this.#s), this.#s.playerRole === 'bird' ? 'human' : 'bird', this.#policy);
      return this.view();
    }
    reveal(action) {
      if (this.#s.phase !== 'secret' || !legal(this.#s.tide).includes(action)) throw new Error('Illegal action or actions already revealed.');
      this.#s.revealed = { bird: this.#s.playerRole === 'bird' ? action : this.#aiAction,
        human: this.#s.playerRole === 'human' ? action : this.#aiAction, amount: null };
      this.#s.phase = 'amount';
      return this.view();
    }
    resolve(amount) {
      if (this.#s.phase !== 'amount') throw new Error('Reveal both areas first.');
      const a = this.#s.revealed;
      if (a.human === 'Wait') amount = 0;
      else if (this.#s.playerRole === 'bird') amount = chooseAmount(publicInfo(this.#s), a.bird, a.human, this.#policy);
      this.#s = settle(this.#s, a.bird, a.human, amount, this.#nature);
      this.#aiAction = null;
      return this.view();
    }
  }
  return { FOODS, BIRDS, INITIAL, BASE, TIDES, total, legal, initialState, settle,
    publicInfo, expected, evaluate, chooseRegion, chooseAmount, humanAmountDistribution, Game, random };
});
