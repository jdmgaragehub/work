'use strict';
/**
 * Mode 5 — Social Sim ("Mohalla"). Binds the pure social-psychology models (src/psych/socialmodels.js) to the
 * instanced crowd so students can watch them play out on the street. All outputs are labelled "Simulated":
 * parameters are exposed and adjustable; these are teaching models, not data.
 *
 *   const social = createSocialSim(sim, crowd, { stage: {x, z}, timeScale })
 *   social.models                      // { conformity|bystander|cooperation: { title, label, params, describe } }
 *   social.run('bystander', { n: 5 })  // → results (+ stages agents on the street); emits 'study:run' {paradigm, n}
 *   social.update(dt, t)               // advance the staging (call every frame while in mode 5)
 *   social.stop() ; social.dispose()
 * Bus: 'study:run' {paradigm, n}; 'social:result' {model, results}; 'social:help' {agent, t} when a helper arrives.
 */
const SM = require('../psych/socialmodels.js');

const MODELS = {
  conformity: {
    title: 'Conformity (Asch-style line judgement)',
    label: 'Simulated',
    params: Object.assign({}, SM.CONFORMITY_DEFAULTS),
    describe: 'Naive agents answer after a unanimous majority gives a wrong answer. Each agent has a conformity trait; pressure rises with majority size and plateaus after about 3-4. A single dissenter breaks unanimity.',
    source: 'Asch (1951, 1955, 1956); Bond & Smith (1996) meta-analysis',
  },
  bystander: {
    title: 'Bystander intervention (diffusion of responsibility)',
    label: 'Simulated',
    params: Object.assign({}, SM.BYSTANDER_DEFAULTS),
    describe: 'An emergency happens in the street. Each onlooker\'s chance of helping per second falls as more people are present, so the more onlookers, the less likely and the later anyone helps.',
    source: 'Darley & Latané (1968); Fischer et al. (2011) meta-analysis (effect weaker in dangerous emergencies)',
  },
  cooperation: {
    title: 'Cooperation (iterated prisoner\'s dilemma)',
    label: 'Simulated',
    params: Object.assign({}, SM.COOPERATION_DEFAULTS),
    describe: 'Agents play repeated prisoner\'s dilemma games with everyone else. Strategies: Tit-for-Tat, Always Defect, Always Cooperate, Random and Grudger. Nice, retaliatory and forgiving strategies tend to score well in mixed populations.',
    source: 'Axelrod & Hamilton (1981); Axelrod (1984)',
  },
};

const STRAT_COLOURS = { TFT: '#22c55e', AllD: '#ef4444', AllC: '#60a5fa', Random: '#eab308', Grudger: '#a855f7' };

function createSocialSim(sim, crowd, opts = {}) {
  const bus = sim && sim.bus;
  const timeScale = opts.timeScale || 1 / 15; // staged seconds per simulated second
  let stage = null; // { model, roles: Map(i → {spot:{x,z}, face:{x,z}, after?, mark}), timers: [], t }
  let last = null;

  const centre = () => {
    if (opts.stage) return { x: opts.stage.x, z: opts.stage.z };
    const b = crowd && crowd.bounds; return b ? { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 } : { x: 0, z: 0 };
  };
  const nearest = (c, k, exclude = new Set()) => {
    if (!crowd) return [];
    return crowd.agents.filter((a) => !exclude.has(a.i)).map((a) => ({ a, d: Math.hypot(a.pos.x - c.x, a.pos.z - c.z) })).sort((p, q) => p.d - q.d).slice(0, k).map((p) => p.a);
  };

  function behaviour(i, a, dt) {
    if (!stage) return false;
    const r = stage.roles.get(i);
    if (!r) return false;
    if (r.after != null && stage.t < r.after) { a.state = 'idle'; a.vel.set(0, 0, 0); a.faceTo = r.face; return true; }
    const spot = r.after != null && r.go ? r.go : r.spot;
    const dx = spot.x - a.pos.x, dz = spot.z - a.pos.z, d = Math.hypot(dx, dz);
    if (d > 0.25) {
      a.state = 'walk';
      const sp = (r.run ? 1.8 : 1) * a.baseSpeed;
      a.vel.set((dx / d) * sp, 0, (dz / d) * sp);
    } else {
      a.vel.set(0, 0, 0); a.faceTo = r.face;
      a.state = r.talk ? 'talk' : 'idle';
      if (r.go && !r.arrived) { r.arrived = true; if (bus) bus.emit('social:help', { agent: i, t: stage.t / timeScale }); }
    }
    return true;
  }

  function clearStage() {
    if (!crowd) return;
    if (stage) for (const i of stage.roles.keys()) { crowd.setMark(i, null); const a = crowd.agents[i]; if (a) { a.faceTo = null; a.state = 'walk'; } }
    stage = null;
    crowd.setBehaviour(null);
  }

  function ring(c, k, radius, startAngle = 0, arc = Math.PI * 2) {
    const out = [];
    for (let j = 0; j < k; j++) { const a = startAngle + (arc * (j + 0.5)) / k; out.push({ x: c.x + Math.sin(a) * radius, z: c.z + Math.cos(a) * radius }); }
    return out;
  }

  function stageConformity(res) {
    const c = centre();
    const majority = Math.min(res.params.majority, 15);
    const naive = Math.min(res.params.n, 8);
    const ag = nearest(c, majority + naive);
    const spots = ring(c, ag.length, 2.2 + ag.length * 0.06);
    const roles = new Map();
    ag.forEach((a, j) => {
      const isMaj = j < majority;
      const conformed = !isMaj && res.choices[j - majority] === 1;
      roles.set(a.i, { spot: spots[j], face: c, talk: isMaj, mark: isMaj ? '#f97316' : conformed ? '#ef4444' : '#22c55e' });
    });
    return { roles };
  }
  function stageBystander(res) {
    const c = centre();
    const n = Math.min(res.params.n, 14);
    const ag = nearest(c, n + 1);
    const roles = new Map();
    if (!ag.length) return { roles };
    const victim = ag[0];
    roles.set(victim.i, { spot: { x: c.x, z: c.z }, face: { x: c.x, z: c.z + 1 }, mark: '#f8fafc' });
    const spots = ring(c, ag.length - 1, 3 + n * 0.08);
    const helpedTimes = res.times.filter((t) => t != null);
    const tHelp = helpedTimes.length ? helpedTimes[0] : null;
    ag.slice(1).forEach((a, j) => {
      const r = { spot: spots[j], face: c, mark: '#94a3b8' };
      if (j === 0 && tHelp != null) Object.assign(r, { after: 2 + tHelp * timeScale, go: { x: c.x + 0.6, z: c.z + 0.2 }, run: true, mark: '#22c55e' });
      roles.set(a.i, r);
    });
    return { roles };
  }
  function stageCooperation(res) {
    const c = centre();
    const ag = nearest(c, Math.min(res.agents.length, 20));
    const roles = new Map();
    const spots = ring(c, Math.ceil(ag.length / 2), 3.2);
    ag.forEach((a, j) => {
      const s = spots[j >> 1]; const ang = Math.atan2(s.x - c.x, s.z - c.z) + Math.PI / 2;
      const off = (j % 2 ? 0.45 : -0.45);
      const spot = { x: s.x + Math.sin(ang) * off, z: s.z + Math.cos(ang) * off };
      const partner = { x: s.x - Math.sin(ang) * off, z: s.z - Math.cos(ang) * off };
      const strat = res.agents[j % res.agents.length].strategy;
      roles.set(a.i, { spot, face: partner, talk: true, mark: STRAT_COLOURS[strat] || '#ffffff', strategy: strat });
    });
    return { roles };
  }

  const social = {
    models: MODELS,
    label: 'Simulated',
    get last() { return last; },
    run(model, params = {}) {
      let res;
      if (model === 'conformity') res = SM.conformity(params);
      else if (model === 'bystander') res = SM.bystander(params);
      else if (model === 'cooperation') res = SM.cooperation(params);
      else throw new Error('Unknown social model ' + model);
      if (model === 'conformity') res.curve = SM.conformityCurve(Object.assign({}, params, { n: Math.min(res.params.n, 80) }), 10);
      if (model === 'bystander') res.curve = SM.bystanderCurve(Object.assign({}, params, { trials: Math.min(res.params.trials, 300) }));
      res.title = MODELS[model].title; res.source = MODELS[model].source;
      const n = model === 'cooperation' ? res.agents.length : model === 'bystander' ? res.params.n * res.params.trials : res.params.n;
      last = { model, results: res };
      if (crowd) {
        clearStage();
        const s = model === 'conformity' ? stageConformity(res) : model === 'bystander' ? stageBystander(res) : stageCooperation(res);
        stage = { model, roles: s.roles, t: 0 };
        for (const [i, r] of s.roles) crowd.setMark(i, r.mark, 0.55);
        crowd.setBehaviour(behaviour);
      }
      if (bus) { bus.emit('study:run', { paradigm: model, n }); bus.emit('social:result', { model, results: res }); }
      return res;
    },
    update(dt) { if (stage) stage.t += Math.min(0.1, dt || 0); },
    stop() { clearStage(); },
    dispose() { clearStage(); last = null; },
  };
  return social;
}

module.exports = { createSocialSim, MODELS, STRAT_COLOURS };
