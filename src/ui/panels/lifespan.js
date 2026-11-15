'use strict';
/**
 * Lifespan rail (A6b): Development, Motivation & Emotion, Health & Stress, Personality, Psychometrics.
 * Contract: docs/PANEL_API.md. Original teaching text; study numbers only via api.factLine(id);
 * generated data labelled; IPIP "for learning only, not a diagnosis"; no real inkblots or TAT cards.
 */
const { kit, newRng } = require('./thinking.js');

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (v, dp = 2) => (Number.isFinite(v) ? v.toFixed(dp) : '—');
const noLead = (v, dp = 2) => (Number.isFinite(v) ? (v < 0 ? '−' : '') + Math.abs(v).toFixed(dp).replace(/^0\./, '.') : '—');
let timers = [];
const stopTimers = () => { timers.forEach((t) => clearInterval(t)); timers = []; };

// ================================================================== 19 DEVELOPMENT
const SS_INFANTS = [
  { name: 'Infant “Ayan” (simulated)', key: { ps: 6, cm: 5, res: 2, av: 1 }, cls: 'B',
    text: 'Ayan explores the toys freely while his mother sits nearby, glancing back at her now and then. When she leaves he stops playing, calls out and cries a little; the stranger’s attempts to comfort him only partly work. When his mother returns he crawls straight to her with arms raised, is picked up, holds on briefly, calms within a minute and then wriggles down to play again. The second reunion is similar, with a slightly longer cuddle.' },
  { name: 'Infant “Mahnoor” (simulated)', key: { ps: 2, cm: 1, res: 1, av: 6 }, cls: 'A',
    text: 'Mahnoor plays busily with the blocks and rarely looks at her father. When he leaves she shows little visible upset and keeps playing; she accepts the stranger about as readily as her father. When he returns she glances up, then turns away and moves toward the toy shelf. When he picks her up she leans away and does not cling; put down, she continues playing. In the second reunion she looks away and crawls past him.' },
  { name: 'Infant “Zain” (simulated)', key: { ps: 6, cm: 6, res: 6, av: 1 }, cls: 'C',
    text: 'Zain stays close to his mother and explores very little even before any separation. When she leaves he cries hard and cannot be settled by the stranger. When his mother returns he reaches for her and wants to be held, but also arches his back, kicks and pushes the toy she offers away. He keeps crying in her arms for several minutes and does not return to play. The second reunion shows the same mix of clinging and angry resistance.' },
];
const KOHL = [
  { s: 1, t: 'She must not look, because if the university catches her she will be expelled and her family will punish her.' },
  { s: 2, t: 'She should look. Everyone else will, and she needs the marks for her scholarship — she has to look after her own interests.' },
  { s: 3, t: 'She should report it. A good student and a good daughter would, and her teachers and parents would be disappointed in her otherwise.' },
  { s: 4, t: 'She should report it. Exam rules exist so that degrees mean something; if everyone ignored them whenever it suited them, the whole system would break down.' },
  { s: 5, t: 'Students and the university have an agreement that exams are fair to everyone. When that agreement is broken, the right thing is to restore equal conditions, even at a personal cost.' },
  { s: 6, t: 'Every student has an equal right to be judged by a fair standard. Hina should act as she would want anyone in her position to act, whatever the rules or the consequences for her.' },
];
const STAGE_NAMES = { 1: '1 Obedience & punishment', 2: '2 Individualism & exchange', 3: '3 Good interpersonal relationships', 4: '4 Maintaining social order', 5: '5 Social contract & individual rights', 6: '6 Universal ethical principles' };

const development = {
  id: 'development',
  render(body, api) {
    const K = kit(api);
    const { h, btn, P, H3, note, out, card, row } = K;
    body.appendChild(P('Developmental psychology studies how people change — and stay the same — from conception to old age. Classic debates are <b>nature and nurture</b> (now framed as continual interaction, including epigenetics), <b>continuity versus stages</b>, and <b>universality versus cultural specificity</b>. Researchers use cross-sectional, longitudinal and cohort-sequential designs, each with trade-offs between speed, cohort effects and attrition.'));
    body.appendChild(K.gloss('Object permanence', 'Conservation', 'Egocentrism', 'Theory of mind', 'Attachment', 'Zone of proximal development'));

    body.appendChild(H3('Piaget’s stages'));
    body.appendChild(P('Piaget saw children as active scientists who build <b>schemas</b> through <b>assimilation</b> (fitting new experience into existing schemas) and <b>accommodation</b> (changing schemas to fit). He proposed four qualitatively different stages, always in the same order; the ages he gave are approximate and later research often found earlier competence when tasks were simplified.'));
    body.appendChild(api.table(['Stage', 'Key achievements', 'Signature task', 'Later critique'], [
      ['Sensorimotor', 'Learning through senses and action; object permanence; first symbols', 'Hide a toy under a cloth; A-not-B search', 'Looking-time studies suggest infants expect objects to persist earlier than search tasks show'],
      ['Preoperational', 'Language and pretend play; egocentrism; centration', 'Conservation of liquid, number, mass', 'Task wording and social cues matter (see the “naughty teddy” fact below)'],
      ['Concrete operational', 'Conservation, reversibility, classification, seriation with concrete objects', 'Pour liquid back to show reversibility', 'Schooling and culture affect timing'],
      ['Formal operational', 'Abstract, hypothetical and systematic reasoning', 'Pendulum problem; “what if” reasoning', 'Many adults do not use formal reasoning consistently; domain expertise matters'],
    ]));
    body.appendChild(K.facts('F-PIAGET', 'F-MCGARRIGLE'));

    // conservation demo
    const cons = { poured: false };
    const consCanvas = h('canvas', { width: 320, height: 170, 'aria-label': 'Two glasses of liquid for a conservation demonstration' });
    const consOut = out();
    const drawCons = () => {
      const ctx = consCanvas.getContext && consCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, 320, 170);
        const glass = (x, w, hgt, fillH) => { ctx.fillStyle = '#56B4E9'; ctx.fillRect(x, 160 - fillH, w, fillH); ctx.strokeStyle = '#334155'; ctx.lineWidth = 2; ctx.strokeRect(x, 160 - hgt, w, hgt); };
        glass(40, 80, 90, 50);
        if (cons.poured) glass(210, 40, 150, 100); else glass(200, 80, 90, 50);
        ctx.fillStyle = '#111'; ctx.font = '13px system-ui'; ctx.textAlign = 'center'; ctx.fillText('Glass A', 80, 14); ctx.fillText(cons.poured ? 'Tall glass B' : 'Glass B', 240, 14);
      }
      consOut.textContent = cons.poured
        ? 'The same liquid from B now sits in a tall, thin glass. A typical preoperational answer: “B has more — it’s higher” (centration on height). A conserving child: “Same — you only poured it; you could pour it back” (reversibility), or “it’s taller but thinner” (compensation).'
        : 'Two identical glasses, equal amounts. The child agrees they are the same. Now pour B into a tall, thin glass.';
    };
    body.appendChild(card('Conservation of liquid (demonstration)', consCanvas, row(btn('Pour B into a tall glass', () => { cons.poured = true; drawCons(); }, 'primary'), btn('Reset', () => { cons.poured = false; drawCons(); }, 'ghost'), K.run('conservation')), consOut));
    drawCons();

    // A-not-B sim
    body.appendChild(P('<b>Object permanence and the A-not-B error.</b> After finding a toy several times at location A, an infant who watches it being hidden at B often still searches at A. Explanations include immature memory for the new location, difficulty inhibiting a practised reach, and the pull of motor habit — the error grows with more A trials and a longer delay before reaching.'));
    const anb = { aTrials: 4, delay: 3, maturity: 0.4 };
    const anbOut = out();
    const anbChart = h('div');
    const runANB = (user) => {
      const rng = newRng(api, 'anb');
      let errA = 0;
      const N = 20;
      for (let i = 0; i < N; i++) {
        const z = 1.1 * Math.log(anb.aTrials + 0.5) + 0.35 * anb.delay - 4.2 * anb.maturity - 0.8 + rng.normal(0, 0.6);
        if (rng.random() < 1 / (1 + Math.exp(-z))) errA++;
      }
      anbChart.innerHTML = '';
      anbChart.appendChild(api.charts.bar([{ name: 'searched A (error)', value: errA }, { name: 'searched B (correct)', value: N - errA }], { label: 'A-not-B: where 20 simulated infants searched on the B trial', yl: 'infants', colors: ['#D55E00', '#009E73'] }));
      anbChart.appendChild(api.simLabel('Simulated infants — illustrative model'));
      anbOut.textContent = `${errA}/${N} simulated infants searched at A. More A trials and longer delays raise the error; greater memory/inhibitory maturity lowers it.`;
      if (user) api.emit('study:run', { paradigm: 'conservation', n: N });
    };
    body.appendChild(card('A-not-B simulator', h('div', { class: 'grid2' },
      api.slider('Successful A trials', { min: 1, max: 8, step: 1, value: anb.aTrials, onInput: (v) => { anb.aTrials = v; } }),
      api.slider('Delay before reaching (s)', { min: 0, max: 10, step: 1, value: anb.delay, onInput: (v) => { anb.delay = v; } }),
      api.slider('Memory & inhibition maturity', { min: 0, max: 1, step: 0.05, value: anb.maturity, onInput: (v) => { anb.maturity = v; } })),
    row(btn('Run 20 simulated infants', () => runANB(true), 'primary')), anbChart, anbOut));
    runANB(false);

    // ToM
    body.appendChild(H3('Theory of mind: a false-belief story (original characters)'));
    body.appendChild(P('Theory of mind is understanding that other people have beliefs, desires and knowledge that can differ from your own — and from reality. The test is whether a child predicts behaviour from someone’s <i>false</i> belief.'));
    body.appendChild(card(null, h('p', null, 'Bilal puts his mango in the blue basket and goes out to play cricket. While he is away, his sister Zara moves the mango into the tiffin box and closes the lid. Bilal comes back, hungry. '), h('p', null, h('b', null, 'Where will Bilal look for his mango first?')),
      (() => { const o = out(); return h('div', null, row(
        btn('In the blue basket', () => { o.textContent = 'Correct — Bilal did not see the move, so he still believes the mango is in the basket. Passing requires holding his belief separate from what you know.'; }, 'primary'),
        btn('In the tiffin box', () => { o.textContent = 'This is the typical answer of younger children: they answer from reality (where the mango is) rather than from Bilal’s belief. Control questions (“Where did Bilal put it?”, “Where is it really?”) check that memory is not the problem.'; })), o); })()));
    body.appendChild(K.facts('F-BARON'));
    body.appendChild(row(K.run('false_belief'), K.zone('childdev')));

    // Erikson
    body.appendChild(H3('Erikson’s psychosocial stages'));
    body.appendChild(P('Erikson extended development across the whole lifespan. Each stage poses a psychosocial tension; working it through well yields a lasting strength (“virtue”). Stages are best read as typical emphases rather than strict gates.'));
    body.appendChild(api.table(['Life period', 'Tension', 'Strength if resolved', 'Example'], [
      ['Infancy', 'Trust vs mistrust', 'Hope', 'Reliable, responsive care'],
      ['Early childhood', 'Autonomy vs shame and doubt', 'Will', 'Feeding oneself, toilet learning'],
      ['Preschool years', 'Initiative vs guilt', 'Purpose', 'Starting games, asking questions'],
      ['School years', 'Industry vs inferiority', 'Competence', 'Mastering school and practical skills'],
      ['Adolescence', 'Identity vs role confusion', 'Fidelity', 'Exploring values, career, belonging'],
      ['Young adulthood', 'Intimacy vs isolation', 'Love', 'Close friendships, marriage or partnership'],
      ['Middle adulthood', 'Generativity vs stagnation', 'Care', 'Raising children, mentoring, community work'],
      ['Late adulthood', 'Ego integrity vs despair', 'Wisdom', 'Reviewing one’s life with acceptance'],
    ]));
    body.appendChild(note('Critique: the stages are hard to test, were built mainly from Western clinical observation, and identity work in collectivist families (for example in joint families in Pakistan) may be negotiated with others rather than individually.'));

    // Kohlberg
    body.appendChild(H3('Kohlberg: coding moral reasoning (original dilemma)'));
    body.appendChild(P('Kohlberg scored the <i>reasoning</i> behind a moral decision, not the decision itself. Pre-conventional reasoning centres on consequences to oneself (stages 1–2), conventional on approval and social order (3–4), and post-conventional on agreed rights and universal principles (5–6). Critics note that the scheme may undervalue an ethic of care and relationships (Gilligan), privileges Western individualist philosophy, and that reasoning predicts behaviour only modestly.'));
    body.appendChild(card('The dilemma', h('p', null, 'Hina is a scholarship student. The night before her final exam, the full question paper is leaked into her class WhatsApp group. If she reports it, the exam will be cancelled and rescheduled — on the day of her cousin’s wedding — and her classmates will be angry with her. Her scholarship depends on a high grade. What should Hina do, and why?')));
    const kOrder = newRng(api, 'kohl').shuffle(KOHL.map((_, i) => i));
    const kSel = {};
    const kOut = out();
    const kRows = kOrder.map((i, n) => [String(n + 1), api.esc(KOHL[i].t), api.select('Stage', [{ value: '', label: '— code —' }].concat([1, 2, 3, 4, 5, 6].map((s) => ({ value: s, label: STAGE_NAMES[s] }))), '', (v) => { kSel[i] = +v; })]);
    body.appendChild(card('Code each justification', api.table(['#', 'Justification', 'Your code'], kRows),
      row(btn('Check against the key', () => {
        let right = 0, done = 0;
        const lines = kOrder.map((i, n) => { if (kSel[i]) done++; const ok = kSel[i] === KOHL[i].s; if (ok) right++; return `#${n + 1}: you ${kSel[i] || '—'}, key ${KOHL[i].s}${ok ? ' ✓' : kSel[i] && Math.abs(kSel[i] - KOHL[i].s) === 1 ? ' (adjacent — close)' : ''}`; });
        kOut.textContent = `${right}/6 exact (${done} coded).\n` + lines.join('\n') + '\nNote: the same decision (report it) appears at several stages — the reasoning is what is coded.';
      }, 'primary')), kOut));

    // Attachment
    body.appendChild(H3('Attachment: Strange Situation coding exercise'));
    body.appendChild(P('Bowlby proposed that infants are biologically prepared to seek closeness to caregivers, who serve as a <b>safe haven</b> in distress and a <b>secure base</b> for exploration. Ainsworth’s Strange Situation is a laboratory sequence of brief separations and reunions; coders rate interactive behaviour in the <b>reunion</b> episodes on 1–7 scales and then assign a pattern: secure (B), insecure-avoidant (A), insecure-resistant/ambivalent (C), later supplemented by disorganised (D).'));
    body.appendChild(note('Content note: describes simulated infant distress during brief separations. Real infants in this procedure are never left distressed for long — episodes are cut short.'));
    body.appendChild(K.facts('F-AIN', 'F-AIN-XC', 'F-AIN-MAIN', 'F-HARLOW'));
    const ss = { idx: 0, r: { ps: 4, cm: 4, res: 4, av: 4 }, cls: '' };
    const ssBox = h('div');
    const ssOut = out();
    const ssChart = h('div');
    const SCALES = [['ps', 'Proximity seeking'], ['cm', 'Contact maintaining'], ['res', 'Resistance'], ['av', 'Avoidance']];
    const drawSS = () => {
      const inf = SS_INFANTS[ss.idx];
      ssBox.innerHTML = '';
      ssBox.appendChild(h('h4', null, inf.name + ' — reunion episodes'));
      ssBox.appendChild(h('p', null, inf.text));
      ssBox.appendChild(api.simLabel('Simulated episode'));
      ssBox.appendChild(h('div', { class: 'grid2' }, SCALES.map(([k, lab]) => api.slider(lab + ' (1–7)', { min: 1, max: 7, step: 1, value: ss.r[k], onInput: (v) => { ss.r[k] = v; } }))));
      ssBox.appendChild(api.select('Your classification', [{ value: '', label: '— choose —' }, { value: 'A', label: 'A Insecure-avoidant' }, { value: 'B', label: 'B Secure' }, { value: 'C', label: 'C Insecure-resistant' }, { value: 'D', label: 'D Disorganised' }], ss.cls, (v) => { ss.cls = v; }));
    };
    const compareSS = () => {
      const inf = SS_INFANTS[ss.idx];
      const diffs = SCALES.map(([k]) => Math.abs(ss.r[k] - inf.key[k]));
      const within1 = diffs.filter((d) => d <= 1).length;
      ssChart.innerHTML = '';
      const bars = [];
      SCALES.forEach(([k, lab]) => { bars.push({ name: lab.split(' ')[0].slice(0, 6) + ' you', value: ss.r[k] }); bars.push({ name: lab.split(' ')[0].slice(0, 6) + ' key', value: inf.key[k] }); });
      ssChart.appendChild(api.charts.bar(bars, { label: 'Your ratings vs the coding key', yl: 'rating (1–7)', yr: [0, 7.5], colors: ['#56B4E9', '#E69F00', '#56B4E9', '#E69F00', '#56B4E9', '#E69F00', '#56B4E9', '#E69F00'] }));
      ssOut.textContent = `Ratings within ±1 of the key: ${within1}/4 (mean absolute difference ${(diffs.reduce((a, b) => a + b, 0) / 4).toFixed(2)}).\nKey: proximity ${inf.key.ps}, contact ${inf.key.cm}, resistance ${inf.key.res}, avoidance ${inf.key.av} → pattern ${inf.cls}.` +
        `\nYour classification: ${ss.cls || '—'} ${ss.cls === inf.cls ? '✓' : ss.cls ? '✗' : ''}.\nRemember: patterns describe a relationship in one setting, not a fixed trait of the child, and base rates differ across cultures.`;
    };
    body.appendChild(card(null, row(...SS_INFANTS.map((inf, i) => btn(inf.name.split('(')[0].trim(), () => { ss.idx = i; ss.r = { ps: 4, cm: 4, res: 4, av: 4 }; ss.cls = ''; ssOut.textContent = ''; ssChart.innerHTML = ''; drawSS(); }, 'ghost'))),
      ssBox, row(btn('Compare with the key', compareSS, 'primary'), K.panel('cases', 'Case: Strange Situation across cultures')), ssChart, ssOut));
    drawSS();

    body.appendChild(H3('Your own runs'));
    body.appendChild(K.ownResults('conservation'));
    body.appendChild(K.ownResults('false_belief'));
    body.appendChild(row(K.zone('childdev'), K.panel('crosscultural', 'Cross-cultural development'), K.panel('methods', 'Longitudinal vs cross-sectional designs')));
  },
};

// ================================================================== 20 EMOTION
const THEORIES = {
  jl: { name: 'James–Lange', steps: ['Event (a dog runs at you)', 'Bodily response (heart races, you run)', 'You perceive the bodily change', 'Emotion: “I am afraid”'], note: 'Emotion is the experience of bodily change; different emotions should have distinct bodily signatures.', crit: 'Bodily patterns overlap across emotions; people with reduced bodily feedback still report emotions (though often less intense).' },
  cb: { name: 'Cannon–Bard', steps: ['Event', 'Brain (thalamus) processes it', 'Arousal AND emotional experience occur together, independently'], note: 'Arousal and feeling arise in parallel from the brain; the body is too slow and undifferentiated to cause emotion.', crit: 'Brain circuits for emotion are far wider than the thalamus; bodily feedback does modulate feelings.' },
  ss: { name: 'Schachter–Singer (two-factor)', steps: ['Event', 'General physiological arousal', 'Cognitive label from the context (“others are angry — so am I”)', 'Emotion = arousal + label'], note: 'Arousal supplies intensity; the situation supplies the label. Misattribution of arousal is possible.', crit: 'Key findings have been hard to replicate fully; emotions can occur without prior labelling of arousal.' },
  ap: { name: 'Cognitive appraisal (Lazarus)', steps: ['Event', 'Primary appraisal: does this matter to me?', 'Secondary appraisal: can I cope?', 'Emotion and bodily response follow the appraisal'], note: 'The meaning you give an event shapes which emotion follows; appraisal can be fast and unconscious.', crit: 'Some emotional responses seem to precede any appraisal (fast threat responses); the boundary between appraisal and emotion is debated.' },
};

const emotion = {
  id: 'emotion',
  onClose() { stopTimers(); },
  render(body, api) {
    stopTimers();
    const K = kit(api);
    const { h, btn, P, H3, note, out, card, row } = K;
    const F = api.face2d;
    body.appendChild(P('<b>Motivation</b> is what energises and directs behaviour. Drive-reduction theory explains behaviour that restores bodily balance (hunger, thirst); arousal theory adds that we also seek an optimal level of stimulation; incentive theories stress the pull of rewards. <b>Self-determination theory</b> distinguishes intrinsic from extrinsic motivation and proposes three basic needs — autonomy, competence and relatedness. Maslow’s hierarchy is widely taught but its strict ordering has weak empirical support.'));
    body.appendChild(P('<b>Emotions</b> are short-lived, multi-component responses: subjective feeling, physiological change, expression and action tendency. Facial expression is studied with the Facial Action Coding System, which describes faces as combinations of anatomically based <b>action units (AUs)</b> rather than emotion labels.'));
    body.appendChild(K.facts('F-EKMAN'));
    body.appendChild(K.gloss('Emotion', 'Facial feedback hypothesis', 'Intrinsic motivation', 'Self-determination theory', 'Arousal'));

    // ---- FACS face lab
    body.appendChild(H3('FACS Face Lab'));
    const fl = { aus: {}, gaze: { x: 0, y: 0 }, skin: 2 };
    const canvas = h('canvas', { width: 240, height: 290, 'aria-label': 'Procedural face controlled by action-unit sliders' });
    const code = out();
    const drawFL = () => {
      const ctx = canvas.getContext && canvas.getContext('2d');
      if (ctx) { ctx.fillStyle = '#e2e8f0'; ctx.fillRect(0, 0, 240, 290); F.drawFace(ctx, 120, 115, 200, fl.aus, { gaze: fl.gaze, skin: F.SKIN[fl.skin] }); }
      const active = Object.keys(fl.aus).filter((k) => /^\d+$/.test(k) && fl.aus[k] > 0.05).map(Number).sort((a, b) => a - b);
      code.textContent = active.length ? 'Active: ' + active.map((a) => `AU${a}${fl.aus.unilateral && a === 14 ? ' (unilateral)' : ''} ${F.AU_NAMES[a] || ''} ${(fl.aus[a] * 100).toFixed(0)}%`).join('; ') + '\nFACS code: ' + active.map((a) => 'AU' + a).join('+') : 'Neutral face — no action units active.';
    };
    const sliderBox = h('div', { class: 'grid2' });
    const drawSliders = () => {
      sliderBox.innerHTML = '';
      for (const au of F.AUS) sliderBox.appendChild(api.slider(`AU${au} ${F.AU_NAMES[au]}`, { min: 0, max: 1, step: 0.05, value: fl.aus[au] || 0, fmt: (v) => (v * 100).toFixed(0) + '%', onInput: (v) => { fl.aus[au] = v; drawFL(); api.emit('face:au', { au }); } }));
      sliderBox.appendChild(api.slider('Gaze left–right', { min: -1, max: 1, step: 0.1, value: fl.gaze.x, onInput: (v) => { fl.gaze.x = v; drawFL(); api.emit('face:au', { au: 'gaze' }); } }));
      sliderBox.appendChild(api.slider('Gaze up–down', { min: -1, max: 1, step: 0.1, value: fl.gaze.y, onInput: (v) => { fl.gaze.y = v; drawFL(); api.emit('face:au', { au: 'gaze' }); } }));
    };
    const preset = (name) => { fl.aus = Object.assign({}, F.EMOTIONS[name]); drawSliders(); drawFL(); api.emit('face:au', { au: 'preset:' + name }); };
    body.appendChild(card(null, h('div', { class: 'row', style: { alignItems: 'flex-start' } }, canvas, h('div', { style: { flex: 1, minWidth: '200px' } },
      note('Prototype presets (intensities illustrative):'),
      row(...Object.keys(F.EMOTIONS).map((e) => btn(e, () => preset(e), e === 'neutral' ? 'ghost' : ''))),
      api.select('Skin tone', F.SKIN.map((c, i) => ({ value: i, label: 'Tone ' + (i + 1) })), fl.skin, (v) => { fl.skin = +v; drawFL(); }),
      code)), sliderBox));
    drawSliders(); drawFL();
    body.appendChild(note('Prototypes are teaching approximations. Real expressions vary by person, culture and context, and a face alone is an unreliable guide to what someone feels.'));

    // guess game
    const gm = { target: null, rng: newRng(api, 'faceq'), right: 0, n: 0 };
    const gCanvas = h('canvas', { width: 180, height: 220, 'aria-label': 'Mystery facial expression' });
    const gOut = out();
    const newFace = () => {
      const names = Object.keys(F.EMOTIONS).filter((e) => e !== 'neutral');
      gm.target = gm.rng.pick(names);
      const aus = {};
      const proto = F.EMOTIONS[gm.target];
      const k = gm.rng.uniform(0.55, 1);
      for (const a of Object.keys(proto)) aus[a] = a === 'unilateral' ? proto[a] : proto[a] * k;
      const ctx = gCanvas.getContext && gCanvas.getContext('2d');
      if (ctx) { ctx.fillStyle = '#e2e8f0'; ctx.fillRect(0, 0, 180, 220); F.drawFace(ctx, 90, 88, 150, aus, Object.assign({}, F.look(gm.rng.int(0, 20)), { gaze: { x: gm.rng.uniform(-0.3, 0.3), y: 0 } })); }
      gOut.textContent = 'Which prototype is this?';
    };
    body.appendChild(card('Read the face', h('div', { class: 'row', style: { alignItems: 'flex-start' } }, gCanvas, h('div', { style: { flex: 1 } },
      row(...Object.keys(F.EMOTIONS).filter((e) => e !== 'neutral').map((e) => btn(e, () => {
        if (!gm.target) return newFace();
        gm.n++; const ok = e === gm.target; if (ok) gm.right++;
        const proto = F.EMOTIONS[gm.target];
        gOut.textContent = `${ok ? 'Correct' : 'It was ' + gm.target}. Key AUs: ${Object.keys(proto).filter((a) => /^\d+$/.test(a)).map((a) => 'AU' + a).join('+')}. Score ${gm.right}/${gm.n}.`;
        api.emit('face:au', { au: 'quiz' });
      }))), row(btn('New face', newFace, 'primary'), K.run('face_recognition')), gOut))));
    newFace();

    // ---- theories comparator
    body.appendChild(H3('Emotion theories comparator'));
    const thBox = h('div');
    let thKey = 'jl';
    const showTheory = (key, animate) => {
      stopTimers();
      thKey = key;
      const t = THEORIES[key];
      const render = (upto) => {
        thBox.innerHTML = '';
        thBox.appendChild(h('h4', null, t.name));
        thBox.appendChild(h('div', { class: 'row', role: 'list', 'aria-label': t.name + ' sequence' }, t.steps.map((s, i) => [
          i ? h('span', { 'aria-hidden': 'true' }, '→') : null,
          h('span', { class: 'pill', role: 'listitem', style: { opacity: i <= upto ? 1 : 0.25, outline: i === upto ? '2px solid #F59E0B' : 'none' } }, `${i + 1}. ${s}`)])));
        thBox.appendChild(h('p', null, t.note));
        thBox.appendChild(note('Critique: ' + t.crit));
      };
      if (!animate || api.sim.settings.reducedMotion) { render(t.steps.length - 1); return; }
      let i = 0; render(0);
      const id = setInterval(() => { i++; if (i >= t.steps.length || !thBox.isConnected) { clearInterval(id); return; } render(i); }, 900);
      timers.push(id);
    };
    body.appendChild(card(null, row(...Object.keys(THEORIES).map((k) => btn(THEORIES[k].name, () => showTheory(k, true)))), thBox, row(btn('Replay timeline', () => showTheory(thKey, true), 'ghost'))));
    showTheory('jl', false);

    // ---- Yerkes–Dodson
    body.appendChild(H3('Arousal and performance: the inverted-U'));
    body.appendChild(P('The popular “Yerkes–Dodson law” says performance rises with arousal up to an optimum and then falls, with a lower optimum for difficult tasks. The curve below is an <b>ILLUSTRATIVE</b> sketch of that idea, not data: the original experiment used a different variable (shock strength in mice), and modern evidence for a single universal curve is mixed.'));
    body.appendChild(K.facts('F-YD'));
    const yd = { diff: 0.5, now: 0.5 };
    const ydChart = h('div');
    const drawYD = () => {
      const opt = 0.75 - 0.45 * yd.diff;
      const pts = Array.from({ length: 51 }, (_, i) => { const x = i / 50; return { x, y: Math.exp(-((x - opt) ** 2) / (2 * 0.22 ** 2)) }; });
      const yNow = Math.exp(-((yd.now - opt) ** 2) / (2 * 0.22 ** 2));
      ydChart.innerHTML = '';
      ydChart.appendChild(api.charts.line([{ name: 'performance (illustrative)', points: pts }, { name: 'your arousal level', points: [{ x: yd.now, y: 0 }, { x: yd.now, y: yNow }], dash: true }], { label: `ILLUSTRATIVE inverted-U: optimum arousal ${opt.toFixed(2)} for task difficulty ${yd.diff.toFixed(2)}`, xl: 'arousal (low → high)', yl: 'performance (relative)', yr: [0, 1.05], xr: [0, 1] }));
      ydChart.appendChild(h('span', { class: 'sim-label' }, 'ILLUSTRATIVE — not data'));
    };
    body.appendChild(card(null, h('div', { class: 'grid2' },
      api.slider('Task difficulty', { min: 0, max: 1, step: 0.05, value: yd.diff, onInput: (v) => { yd.diff = v; drawYD(); } }),
      api.slider('Current arousal', { min: 0, max: 1, step: 0.05, value: yd.now, onInput: (v) => { yd.now = v; drawYD(); } })), ydChart));
    drawYD();

    body.appendChild(H3('Replication check: body → feeling?'));
    body.appendChild(P('Two famous claims that bodily states change feelings have had difficult replication histories. Read the badges before you repeat either in an assignment.'));
    body.appendChild(K.facts('F-FACEFB', 'F-FACEFB2', 'F-POWERPOSE'));
    body.appendChild(row(K.panel('replication', 'Replication & Open Science'), K.panel('cases', 'Cases: power posing, facial feedback'), K.zone('clinic')));
    body.appendChild(K.ownResults('face_recognition'));
  },
};

// ================================================================== 21 HEALTH
const COPING = [
  ['Make a revision timetable for the next two weeks', 'problem'],
  ['Phone a cousin to talk about how stressed you feel', 'emotion'],
  ['Ask the teacher to explain the assignment criteria', 'problem'],
  ['Pray or recite to calm yourself before the exam', 'emotion'],
  ['Scroll your phone for hours to avoid thinking about results', 'avoidant'],
  ['Reflect on what a failed exam taught you about your goals', 'meaning'],
  ['Slow breathing for two minutes when panic starts', 'emotion'],
  ['Split a big project into small, dated steps', 'problem'],
];
const COPE_NAMES = { problem: 'Problem-focused', emotion: 'Emotion-focused', meaning: 'Meaning-focused', avoidant: 'Avoidant' };
const BPS_ROWS = ['Predisposing', 'Precipitating', 'Perpetuating', 'Protective'];
const BPS_COLS = ['Biological', 'Psychological', 'Social'];
const BPS_EXAMPLE = {
  'Predisposing|Biological': 'Family history of migraine; light sleeper', 'Predisposing|Psychological': 'Perfectionist standards; tends to worry', 'Predisposing|Social': 'First in family at university; high family expectations',
  'Precipitating|Biological': 'Two weeks of poor sleep before exams', 'Precipitating|Psychological': 'Failed a mid-term; thinks “I will lose my scholarship”', 'Precipitating|Social': 'Long commute after hostel place was lost',
  'Perpetuating|Biological': 'Late-night tea and energy drinks', 'Perpetuating|Psychological': 'Avoids starting work, then panics', 'Perpetuating|Social': 'Withdraws from study group',
  'Protective|Biological': 'Plays cricket at weekends', 'Protective|Psychological': 'Good problem-solving when calm; faith as a source of meaning', 'Protective|Social': 'Supportive elder sister; friendly teacher',
};

const health = {
  id: 'health',
  render(body, api) {
    const K = kit(api);
    const { h, btn, P, H3, note, out, card, row } = K;
    body.appendChild(P('Health psychology studies how behaviour, thoughts, emotions and social conditions influence physical health and illness. <b>Stress</b> arises when demands are appraised as exceeding resources. The body answers through two linked systems: the fast <b>sympathetic–adrenal–medullary</b> pathway (adrenaline, the “fight-or-flight” surge) and the slower <b>hypothalamic–pituitary–adrenal (HPA) axis</b>, which releases cortisol to mobilise energy and regulate inflammation.'));
    body.appendChild(P('Short bursts of stress are adaptive. Problems arise with <b>chronic</b> activation — the accumulated wear sometimes called allostatic load — linked to poorer sleep, immune changes, cardiovascular risk and low mood. Coping, social support and a sense of control buffer these effects.'));
    body.appendChild(K.facts('F-HPA'));
    body.appendChild(K.gloss('Stress', 'Cortisol', 'HPA axis', 'Coping', 'Biopsychosocial model', 'General adaptation syndrome'));

    // ---- HPA simulator
    body.appendChild(H3('HPA-axis simulator (illustrative model)'));
    body.appendChild(P('Stressor → hypothalamus releases <b>CRH</b> → anterior pituitary releases <b>ACTH</b> → adrenal cortex releases <b>cortisol</b>. Cortisol feeds back on the hypothalamus and pituitary to switch the cascade off (<b>negative feedback</b>). Weaken the feedback or repeat the stressor and watch cortisol stay high. Units are arbitrary; the model shows the logic of feedback, not real hormone levels.'));
    const hp = { intensity: 1, dur: 20, fb: 1, chronic: false };
    const hpChart = h('div');
    const hpOut = out();
    const simHPA = () => {
      let crh = 0, acth = 0, cort = 0;
      // settle to baseline
      const step = (S) => {
        const dC = 0.2 * S + 0.02 - 0.15 * hp.fb * cort - 0.1 * crh;
        crh = Math.max(0, crh + dC);
        acth = Math.max(0, acth + 0.15 * crh - 0.08 * acth);
        cort = Math.max(0, cort + 0.06 * acth - 0.03 * cort);
      };
      for (let i = 0; i < 600; i++) step(0);
      const base = cort;
      const T = 300;
      const pts = { S: [], CRH: [], ACTH: [], C: [] };
      let peak = 0, tPeak = 0, back = null;
      for (let t = 0; t <= T; t++) {
        const inPulse = hp.chronic ? (t % 100) >= 10 && (t % 100) < 10 + hp.dur : t >= 10 && t < 10 + hp.dur;
        const S = inPulse ? hp.intensity : 0;
        step(S);
        if (t % 2 === 0) { pts.S.push({ x: t, y: S }); pts.CRH.push({ x: t, y: crh }); pts.ACTH.push({ x: t, y: acth }); pts.C.push({ x: t, y: cort }); }
        if (cort > peak) { peak = cort; tPeak = t; }
        if (!hp.chronic && t > tPeak && back == null && peak > base * 1.2 && cort <= base + 0.1 * (peak - base)) back = t;
      }
      hpChart.innerHTML = '';
      hpChart.appendChild(api.charts.line([{ name: 'stressor', points: pts.S, dash: true }, { name: 'CRH', points: pts.CRH }, { name: 'ACTH', points: pts.ACTH }, { name: 'cortisol', points: pts.C }], { label: 'Illustrative HPA-axis model: hormone levels over time (arbitrary units)', xl: 'time (model minutes)', yl: 'level (arbitrary units)' }));
      hpChart.appendChild(api.simLabel('Illustrative model — not physiological data'));
      hpOut.textContent = `Baseline cortisol ${base.toFixed(2)}; peak ${peak.toFixed(2)} at t = ${tPeak}.` + (hp.chronic ? '\nRepeated stressors: cortisol has little time to return to baseline between episodes.' : back != null ? `\nReturned to within 10% of baseline by t = ${back}.` : '\nCortisol had not returned to baseline by the end of the window.') + (hp.fb < 0.4 ? '\nWeak feedback: the cascade keeps running — one proposed route to chronic HPA over-activity.' : '');
    };
    const chronicBox = h('input', { type: 'checkbox', 'aria-label': 'Repeat the stressor each cycle (chronic)', onchange: () => { hp.chronic = chronicBox.checked; simHPA(); } });
    body.appendChild(card(null, h('div', { class: 'grid2' },
      api.slider('Stressor intensity', { min: 0, max: 2, step: 0.1, value: hp.intensity, onInput: (v) => { hp.intensity = v; simHPA(); } }),
      api.slider('Stressor duration', { min: 2, max: 80, step: 1, value: hp.dur, onInput: (v) => { hp.dur = v; simHPA(); } }),
      api.slider('Negative-feedback strength', { min: 0, max: 2, step: 0.1, value: hp.fb, onInput: (v) => { hp.fb = v; simHPA(); } }),
      h('label', { class: 'pill' }, chronicBox, ' Chronic: repeat the stressor every 100 minutes')), hpChart, hpOut));
    simHPA();

    // ---- coping
    body.appendChild(H3('Coping strategies'));
    body.appendChild(P('<b>Problem-focused</b> coping changes the situation; <b>emotion-focused</b> coping regulates the feelings (including support-seeking, relaxation and religious coping); <b>meaning-focused</b> coping draws on values and goals to reframe what happened; <b>avoidant</b> coping helps briefly but tends to keep problems going. No strategy is always best — the key is fit: problem-focused coping suits controllable stressors, emotion-focused coping suits uncontrollable ones. In Pakistan, faith and family are common, often helpful coping resources.'));
    const cSel = {};
    const cOut = out();
    body.appendChild(card('Sort the strategies', api.table(['Strategy', 'Your category'], COPING.map(([s], i) => [api.esc(s), api.select('Category', [{ value: '', label: '— choose —' }].concat(Object.keys(COPE_NAMES).map((k) => ({ value: k, label: COPE_NAMES[k] }))), '', (v) => { cSel[i] = v; })])),
      row(btn('Check my sorting', () => {
        let r = 0;
        const lines = COPING.map(([s, k], i) => { const ok = cSel[i] === k; if (ok) r++; return `${ok ? '✓' : '✗'} ${s} → ${COPE_NAMES[k]}`; });
        cOut.textContent = `${r}/${COPING.length} matched the key.\n` + lines.join('\n') + '\nSome strategies straddle categories (prayer can also be meaning-focused) — discuss your reasons.';
      }, 'primary')), cOut));

    // ---- biopsychosocial builder
    body.appendChild(H3('Biopsychosocial model builder'));
    body.appendChild(P('The biopsychosocial model (Engel) treats health and illness as the joint product of biological, psychological and social factors. Clinicians often cross these with the “4 Ps”: what made a person vulnerable (predisposing), what triggered the problem now (precipitating), what keeps it going (perpetuating), and what helps (protective).'));
    const cells = {};
    const grid = api.table(['', ...BPS_COLS], BPS_ROWS.map((r) => [r, ...BPS_COLS.map((c) => { const ta = h('textarea', { rows: 2, 'aria-label': `${r} ${c} factors`, style: { width: '100%' } }); cells[r + '|' + c] = ta; return ta; })]));
    const bOut = out();
    const collect = () => { const o = {}; for (const k of Object.keys(cells)) o[k] = cells[k].value.trim(); return o; };
    body.appendChild(card(null, grid, row(
      btn('Load example (simulated student)', () => { for (const k of Object.keys(cells)) cells[k].value = BPS_EXAMPLE[k] || ''; bOut.textContent = 'Example loaded: a simulated second-year student with exam-related headaches and worry.'; }, 'ghost'),
      btn('Summarise my model', () => {
        const o = collect();
        const filled = Object.values(o).filter(Boolean).length;
        const by = BPS_COLS.map((c) => `${c}: ${BPS_ROWS.filter((r) => o[r + '|' + c]).length}/4`).join(', ');
        bOut.textContent = `${filled}/12 cells filled (${by}).` + (BPS_COLS.some((c) => !BPS_ROWS.some((r) => o[r + '|' + c])) ? '\nOne whole domain is empty — a biopsychosocial formulation needs all three.' : '') + (!BPS_ROWS.slice(3).some((r) => BPS_COLS.some((c) => o[r + '|' + c])) ? '\nAdd protective factors: strengths guide intervention.' : '');
      }, 'primary'),
      btn('Download as JSON', () => { api.download('zehn_biopsychosocial_model.json', JSON.stringify({ model: 'biopsychosocial-4P', note: 'Learning exercise — simulated case', cells: collect() }, null, 2), 'application/json'); api.emit('export:done', { kind: 'json' }); api.toast('Model downloaded.'); })), bOut));

    body.appendChild(H3('Help-seeking and support'));
    body.appendChild(P('Knowing about stress is not the same as having support. If stress is affecting your own sleep, study or safety, talk to someone you trust or a counselling service.'));
    body.appendChild(K.facts('F-PK-ACCESS'));
    body.appendChild(row(btn('Support & helplines', () => { const ui = api.service('ui'); if (ui && ui.showCrisis) ui.showCrisis(); else api.openPanel('settings'); }, 'primary'), K.panel('positive', 'Positive Psychology'), K.panel('therapy', 'Therapies & Counselling'), K.zone('clinic'), K.zone('sleep')));
  },
};

// ================================================================== 22 PERSONALITY
const personality = {
  id: 'personality',
  render(body, api) {
    const K = kit(api);
    const { h, btn, P, H3, note, out, card, row } = K;
    body.appendChild(P('Personality refers to a person’s characteristic patterns of thinking, feeling and behaving, and the processes behind them. Four broad traditions ask different questions and use different methods:'));
    body.appendChild(api.table(['Perspective', 'Core idea', 'Typical method', 'Strength', 'Criticism'], [
      ['Trait (Big Five / Five-Factor)', 'Stable dimensions — extraversion, agreeableness, conscientiousness, neuroticism, openness — describe individual differences', 'Self- and observer-report questionnaires; factor analysis', 'Replicable structure; predicts health, work and relationships', 'Describes more than it explains; behaviour also varies with situations'],
      ['Social-cognitive (Bandura, Mischel)', 'Person, behaviour and environment influence each other (reciprocal determinism); self-efficacy and if…then situation profiles', 'Experiments, diary and experience sampling', 'Explains why behaviour changes across contexts', 'Can underplay biology and emotion'],
      ['Humanistic (Rogers, Maslow)', 'People strive for growth; congruence between self-concept and experience; unconditional positive regard', 'Case study, interview, Q-sort', 'Shaped counselling practice (core conditions)', 'Concepts like self-actualisation are hard to test'],
      ['Psychodynamic (Freud and successors)', 'Unconscious conflicts, early relationships and defence mechanisms shape adult personality', 'Clinical case material, projective methods', 'Highlights unconscious processes and relationships; modern versions are more testable', 'Classic claims are hard to falsify; projective tests have reliability and validity problems'],
    ]));
    body.appendChild(K.gloss('Personality', 'Big Five', 'Self-efficacy', 'Reciprocal determinism', 'Defense mechanism', 'Projective test'));

    // ---- person-situation simulator
    body.appendChild(H3('Person–situation debate: how consistent is behaviour?'));
    body.appendChild(P('If behaviour depended only on traits, a person’s rank in one situation would match their rank in another. Mischel argued that single behaviours are only modestly consistent across situations; trait theorists replied that <b>aggregated</b> behaviour over many occasions is far more consistent. Explore with simulated people whose behaviour mixes a stable trait, situation effects and noise.'));
    const psim = { w: 0.5, agg: 1 };
    const psChart = h('div');
    const psOut = out();
    const runPS = (user) => {
      const rng = newRng(api, 'ps');
      const n = 80, xs = [], ys = [];
      for (let i = 0; i < n; i++) {
        const trait = rng.normal(0, 1);
        const beh = () => { let s = 0; for (let k = 0; k < psim.agg; k++) s += Math.sqrt(psim.w) * trait + Math.sqrt(1 - psim.w) * rng.normal(0, 1); return s / psim.agg; };
        xs.push(beh()); ys.push(beh());
      }
      const r = api.stats.pearson(xs, ys);
      psChart.innerHTML = '';
      psChart.appendChild(api.charts.scatter(xs, ys, { label: `Behaviour in situation 1 vs situation 2 (simulated, r = ${r.r.toFixed(2)})`, xl: 'situation 1 (z)', yl: 'situation 2 (z)' }));
      psChart.appendChild(api.simLabel());
      psOut.textContent = `Cross-situational consistency: r(${n - 2}) = ${noLead(r.r)} with trait weight ${psim.w.toFixed(2)} and ${psim.agg} occasion(s) averaged.`;
      if (user) api.emit('stats:test', { test: 'corr' });
    };
    body.appendChild(card(null, h('div', { class: 'grid2' },
      api.slider('Weight of the stable trait', { min: 0.05, max: 0.95, step: 0.05, value: psim.w, onInput: (v) => { psim.w = v; } }),
      api.slider('Occasions averaged per situation', { min: 1, max: 20, step: 1, value: psim.agg, onInput: (v) => { psim.agg = v; } })),
    row(btn('Simulate 80 people', () => runPS(true), 'primary')), psChart, psOut));
    runPS(false);

    // ---- IPIP
    body.appendChild(H3('IPIP Big Five questionnaire'));
    body.appendChild(h('p', { class: 'note' }, h('b', null, 'For learning only, not a diagnosis. '), 'The International Personality Item Pool is public domain. Your answers stay on this device. Scores describe how you answered today, compared with nobody — there are no norms here — and they say nothing about mental health.'));
    body.appendChild(K.facts('F-IPIP', 'F-IPIP50'));
    const ipip = api.sim.data.ipip;
    const ipBox = h('div');
    const drawIP = () => {
      ipBox.innerHTML = '';
      const rs = K.rows('ipip_big5').map((r) => +r.response).filter((v) => Number.isInteger(v) && v >= 1 && v <= 5);
      if (!ipip || !ipip.items || rs.length < ipip.items.length) { ipBox.appendChild(note('Run the questionnaire to see your own learning profile here.')); return; }
      const resp = rs.slice(-ipip.items.length);
      const sc = api.psychometrics.scoreIPIP(ipip.items, resp);
      const keys = (ipip.scales || Object.keys(sc)).filter((k) => sc[k]);
      ipBox.appendChild(api.charts.bar(keys.map((k) => ({ name: k, value: +sc[k].mean.toFixed(2) })), { label: 'Your IPIP scale means (1–5), latest run — for learning only, not a diagnosis', yl: 'mean item score', yr: [0, 5.5] }));
      ipBox.appendChild(api.table(['Scale', 'Mean (1–5)', 'Items'], keys.map((k) => [api.esc((ipip.scaleNames && ipip.scaleNames[k]) || k), sc[k].mean.toFixed(2), sc[k].n])));
      ipBox.appendChild(h('span', { class: 'tag' }, 'Your own data — for learning only, not a diagnosis'));
    };
    body.appendChild(card(null, row(btn('▶ Take the IPIP Big Five (learning only)', () => K.runP('ipip_big5', drawIP), 'primary'), K.panel('psychometrics', 'Check its reliability (α)')), ipBox));
    drawIP();

    // ---- projective critique
    body.appendChild(H3('Projective tests: a critical look'));
    body.appendChild(P('Projective techniques present ambiguous material and assume people “project” inner concerns into their responses. Critics point to four problems: <b>scoring reliability</b> (different examiners may code the same answers differently), <b>norms</b> (some reference samples have over-pathologised ordinary people), <b>validity</b> (many interpretive claims lack support, though some coded variables fare better), and <b>incremental validity</b> (they often add little beyond questionnaires and interviews). Real test plates are protected materials and are never shown in ZEHN.'));
    const blot = { rng: newRng(api, 'blot') };
    const blotCanvas = h('canvas', { width: 280, height: 200, 'aria-label': 'Randomly generated symmetric ink blot — original simulation, not a Rorschach plate' });
    const blotOut = out();
    const drawBlot = () => {
      const ctx = blotCanvas.getContext && blotCanvas.getContext('2d');
      if (!ctx) return;
      const r = blot.rng;
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, 280, 200);
      const shapes = [];
      for (let i = 0; i < 14; i++) shapes.push({ x: r.uniform(4, 120), y: r.uniform(25, 175), rx: r.uniform(6, 34), ry: r.uniform(5, 30), rot: r.uniform(0, Math.PI) });
      for (const side of [1, -1]) {
        ctx.save(); ctx.translate(140, 0); ctx.scale(side, 1);
        ctx.fillStyle = 'rgba(17,17,17,0.85)';
        for (const s of shapes) { ctx.beginPath(); ctx.ellipse(s.x, s.y, s.rx, s.ry, s.rot, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      }
    };
    const seeIn = h('input', { type: 'text', 'aria-label': 'What do you see?', placeholder: 'e.g. two birds facing each other' });
    body.appendChild(card('Blot generator', h('span', { class: 'tag' }, 'original simulation, not a Rorschach plate'), blotCanvas,
      row(btn('Generate a new blot', () => { drawBlot(); api.toast('New original symmetric blot generated (original simulation, not a Rorschach plate).'); }, 'primary'), h('label', { class: 'f' }, 'What do you see?', seeIn), btn('Reflect', () => {
        const s = seeIn.value.trim();
        blotOut.textContent = (s ? `You saw: “${s}”. ` : 'You did not write anything — that is also a response. ') + 'ZEHN does not score this, deliberately. Ask: would two trained coders agree on how to code your answer? Is there evidence that this kind of answer predicts anything important better than simply asking you? Without reliable coding, representative norms and incremental validity, an interpretation is just a guess.';
      })), blotOut));
    drawBlot();
    body.appendChild(row(K.zone('library'), K.panel('therapy', 'Humanistic & CBT therapies'), K.panel('cases', 'Case: Bobo doll (social-cognitive)')));
  },
};

// ================================================================== 23 PSYCHOMETRICS
const psychometrics = {
  id: 'psychometrics',
  render(body, api) {
    const K = kit(api);
    const { h, btn, P, H3, note, out, card, row } = K;
    const PS = api.psychometrics;
    body.appendChild(P('Psychometrics is the science of measuring psychological attributes. Classical test theory models an observed score as <b>true score + error</b>. <b>Reliability</b> is the proportion of observed-score variance that is true-score variance — how consistent the measurement is. <b>Validity</b> is whether the evidence supports the intended interpretation and use of the scores. A test can be reliable without being valid, but not usefully valid without being reliable.'));
    body.appendChild(api.table(['Reliability type', 'Question', 'Statistic'], [
      ['Test–retest', 'Same people, same test, two occasions — stable scores?', 'Pearson r between occasions'],
      ['Internal consistency', 'Do the items hang together as one scale?', 'Cronbach’s α; split-half with Spearman–Brown'],
      ['Inter-rater', 'Do two coders agree on categories?', 'Cohen’s κ (chance-corrected agreement)'],
      ['Parallel forms', 'Do two equivalent versions give the same scores?', 'Correlation between forms'],
    ]));
    body.appendChild(K.gloss('Reliability', 'Test–retest reliability', 'Split-half reliability', "Cronbach's alpha", 'Inter-rater reliability', 'Validity'));

    // ---- test-retest
    body.appendChild(H3('Test–retest simulator'));
    const tr = { rel: 0.8 };
    const trChart = h('div');
    const trOut = out();
    const runTR = (user) => {
      const rng = newRng(api, 'tr');
      const xs = [], ys = [];
      for (let i = 0; i < 60; i++) { const t = rng.normal(0, 1); xs.push(100 + 15 * (Math.sqrt(tr.rel) * t + Math.sqrt(1 - tr.rel) * rng.normal(0, 1))); ys.push(100 + 15 * (Math.sqrt(tr.rel) * t + Math.sqrt(1 - tr.rel) * rng.normal(0, 1))); }
      const r = api.stats.pearson(xs, ys);
      const reg = api.stats.regression(xs, ys);
      trChart.innerHTML = '';
      trChart.appendChild(api.charts.scatter(xs, ys, { label: `Test vs retest scores (simulated), r = ${r.r.toFixed(2)}`, xl: 'occasion 1', yl: 'occasion 2', line: { a: reg.a, b: reg.b } }));
      trChart.appendChild(api.simLabel());
      trOut.innerHTML = api.format.italicise(api.apa.r({ r: r.r, df: 58, p: r.p })) + ` — true reliability set to ${noLead(tr.rel)}; sample r varies around it.`;
      if (user) api.emit('stats:test', { test: 'corr' });
    };
    body.appendChild(card(null, api.slider('True reliability', { min: 0.1, max: 0.99, step: 0.01, value: tr.rel, onInput: (v) => { tr.rel = v; } }), row(btn('Simulate 60 people tested twice', () => runTR(true), 'primary')), trChart, trOut));
    runTR(false);

    // ---- alpha editor
    body.appendChild(H3('Cronbach’s α item-matrix editor'));
    body.appendChild(P('α rises when items correlate with each other and with the number of items. Use <b>alpha-if-item-deleted</b> and the <b>corrected item–rest correlation</b> to find weak items. A negative item–rest correlation usually means a reverse-keyed item was not reversed. Very high α (close to 1) can signal redundant, near-duplicate items rather than a better scale. Edit any cell (1–5) and recompute.'));
    const al = { M: [], k: 6, n: 10, miskey: true };
    const genAlpha = () => {
      const rng = newRng(api, 'alpha');
      al.M = [];
      for (let i = 0; i < al.n; i++) {
        const t = rng.normal(0, 1);
        al.M.push(Array.from({ length: al.k }, (_, j) => { let v = 3 + 1.1 * t + rng.normal(0, 0.8); if (al.miskey && j === al.k - 2) v = 6 - v; return clamp(Math.round(v), 1, 5); }));
      }
    };
    const mBox = h('div', { style: { overflowX: 'auto' } });
    const aOut = out();
    const aChart = h('div');
    const drawMatrix = () => {
      mBox.innerHTML = '';
      mBox.appendChild(api.table(['Resp.', ...Array.from({ length: al.k }, (_, j) => 'Item ' + (j + 1)), 'Total'], al.M.map((rowv, i) => ['R' + (i + 1), ...rowv.map((v, j) => h('input', { type: 'number', min: 1, max: 5, step: 1, value: String(v), style: { width: '3.2em' }, 'aria-label': `Respondent ${i + 1} item ${j + 1}`, onchange: (e) => { const x = clamp(Math.round(+e.target.value || 1), 1, 5); al.M[i][j] = x; } })), String(rowv.reduce((a, b) => a + b, 0))])));
      mBox.appendChild(api.simLabel());
    };
    const computeAlpha = (user) => {
      try {
        const a = PS.cronbachAlpha(al.M);
        const ia = PS.itemAnalysis(al.M);
        const sh = PS.splitHalf(al.M);
        aOut.innerHTML = `<b>${api.esc(api.apa.alpha(a))}</b> (k = ${al.k} items, n = ${al.M.length})<br>Split-half (odd/even) r = ${noLead(sh.rHalf)}; Spearman–Brown corrected = ${noLead(sh.rSB)}<br>` + (a < 0.7 ? 'Below the common rule-of-thumb of .70 for research scales — inspect the weak items.' : 'Acceptable internal consistency for a short research scale.');
        aChart.innerHTML = '';
        aChart.appendChild(api.table(['Item', 'Mean', 'SD', 'Item–rest r', 'α if deleted'], ia.map((x) => [`Item ${x.item + 1}`, fmt(x.mean), fmt(x.sd), noLead(x.rItemRest) + (x.rItemRest < 0 ? ' ⚠ reverse-keyed?' : x.rItemRest < 0.3 ? ' (weak)' : ''), noLead(x.alphaIfDeleted) + (x.alphaIfDeleted > a ? ' ↑' : '')])));
        aChart.appendChild(api.charts.bar(ia.map((x) => ({ name: 'Item ' + (x.item + 1), value: +x.alphaIfDeleted.toFixed(3) })), { label: `Alpha if item deleted (current α = ${a.toFixed(2)}; bars above it flag items that lower α)`, yl: 'α if deleted' }));
        if (user) api.emit('stats:test', { test: 'alpha' });
      } catch (e) { aOut.textContent = 'Cannot compute: ' + e.message + ' (check that items vary).'; }
    };
    body.appendChild(card(null, mBox, row(
      btn('Compute α and item analysis', () => { drawMatrix(); computeAlpha(true); }, 'primary'),
      btn('New simulated data', () => { genAlpha(); drawMatrix(); computeAlpha(true); }),
      btn('Reverse-score item ' + (al.k - 1), () => { const j = al.k - 2; al.M = al.M.map((r) => r.map((v, i) => (i === j ? 6 - v : v))); drawMatrix(); computeAlpha(true); api.toast('Item ' + (j + 1) + ' reverse-scored (6 − x).'); }, 'ghost'),
      btn('Add respondent', () => { const rng = newRng(api, 'add'); al.M.push(Array.from({ length: al.k }, () => rng.int(1, 5))); drawMatrix(); computeAlpha(true); api.toast('Random respondent added — watch α.'); }, 'ghost')), aOut, aChart));
    genAlpha(); drawMatrix(); computeAlpha(false);

    // ---- kappa
    body.appendChild(H3('Cohen’s κ calculator'));
    body.appendChild(P('Two coders often agree partly by chance. κ = (<i>p</i><sub>o</sub> − <i>p</i><sub>e</sub>) / (1 − <i>p</i><sub>e</sub>), where <i>p</i><sub>o</sub> is observed agreement and <i>p</i><sub>e</sub> is the agreement expected from each coder’s base rates. Enter counts: rows are Coder 1’s categories, columns Coder 2’s; the diagonal holds agreements.'));
    const kp = { size: 2, T: [[20, 5], [4, 21]] };
    const kBox = h('div');
    const kOut = out();
    const drawK = () => {
      kBox.innerHTML = '';
      const cats = kp.size === 2 ? ['Yes', 'No'] : ['Secure', 'Avoidant', 'Resistant'];
      kBox.appendChild(api.table(['Coder 1 ↓ / Coder 2 →', ...cats], kp.T.map((r, i) => [cats[i], ...r.map((v, j) => h('input', { type: 'number', min: 0, step: 1, value: String(v), style: { width: '4em' }, 'aria-label': `Coder 1 ${cats[i]}, Coder 2 ${cats[j]}`, onchange: (e) => { kp.T[i][j] = Math.max(0, Math.round(+e.target.value || 0)); } }))])));
    };
    const computeK = () => {
      const N = kp.T.flat().reduce((a, b) => a + b, 0);
      if (!N) { kOut.textContent = 'Enter some counts first.'; return; }
      const r = PS.kappaFromTable(kp.T);
      const lab = r.kappa < 0 ? 'less than chance' : r.kappa < 0.2 ? 'slight' : r.kappa < 0.4 ? 'fair' : r.kappa < 0.6 ? 'moderate' : r.kappa < 0.8 ? 'substantial' : 'almost perfect';
      kOut.innerHTML = `N = ${N}; <i>p</i><sub>o</sub> = ${noLead(r.po, 3)}; <i>p</i><sub>e</sub> = ${noLead(r.pe, 3)}; <b>κ = ${noLead(r.kappa, 3)}</b> (${lab} by one common convention — labels are rough guides, not rules).`;
      api.emit('stats:test', { test: 'kappa' });
    };
    body.appendChild(card(null, row(btn('2 × 2 table', () => { kp.size = 2; kp.T = [[20, 5], [4, 21]]; drawK(); kOut.textContent = ''; }, 'ghost'), btn('3 × 3 table (attachment codes)', () => { kp.size = 3; kp.T = [[14, 2, 1], [3, 9, 1], [1, 1, 8]]; drawK(); kOut.textContent = ''; }, 'ghost')), kBox, row(btn('Compute κ', computeK, 'primary')), kOut));
    drawK();

    // ---- Spearman-Brown
    body.appendChild(H3('Spearman–Brown: test length and reliability'));
    body.appendChild(P('Lengthening a test with parallel items raises reliability: <i>r</i>′ = <i>k</i>·<i>r</i> / [1 + (<i>k</i> − 1)·<i>r</i>], where <i>k</i> is the length factor. It also lets you correct a split-half correlation (<i>k</i> = 2) and estimate how long a test must be to reach a target.'));
    const sb = { r: 0.6, k: 2, target: 0.85 };
    const sbOut = out();
    const sbChart = h('div');
    const drawSB = () => {
      const rp = PS.spearmanBrown(sb.r, sb.k);
      const kNeed = PS.spearmanBrownK(sb.r, sb.target);
      sbOut.textContent = `r = ${noLead(sb.r)}, length × ${sb.k} → r′ = ${noLead(rp)}.\nTo reach ${noLead(sb.target)} the test must be ${kNeed.toFixed(2)} × its current length.`;
      sbChart.innerHTML = '';
      sbChart.appendChild(api.charts.line([{ name: 'predicted reliability', points: Array.from({ length: 24 }, (_, i) => { const k = 0.25 + i * 0.25; return { x: k, y: PS.spearmanBrown(sb.r, k) }; }) }, { name: 'target', points: [{ x: 0.25, y: sb.target }, { x: 6, y: sb.target }], dash: true }], { label: 'Spearman–Brown prophecy: reliability vs length factor', xl: 'length factor k', yl: 'reliability', yr: [0, 1] }));
    };
    body.appendChild(card(null, h('div', { class: 'grid2' },
      api.slider('Current reliability r', { min: 0.1, max: 0.95, step: 0.01, value: sb.r, onInput: (v) => { sb.r = v; drawSB(); } }),
      api.slider('Length factor k', { min: 0.25, max: 6, step: 0.25, value: sb.k, onInput: (v) => { sb.k = v; drawSB(); } }),
      api.slider('Target reliability', { min: 0.5, max: 0.97, step: 0.01, value: sb.target, onInput: (v) => { sb.target = v; drawSB(); } })), sbChart, sbOut));
    drawSB();

    // ---- SEM band
    body.appendChild(H3('Standard error of measurement and score bands'));
    body.appendChild(P('No observed score is exact. The <b>SEM</b> = SD·√(1 − <i>r</i><sub>xx</sub>) estimates the spread of observed scores around a person’s true score; a 95% band is roughly the score ± 1.96 SEM. Report bands, not single numbers, especially for high-stakes decisions — and notice how fast the band widens as reliability drops.'));
    const sm = { sd: 15, rxx: 0.9, x: 112 };
    const smOut = out();
    const smChart = h('div');
    const drawSEM = () => {
      const ci = api.stats.ciScore(sm.x, sm.sd, sm.rxx, 0.95);
      smOut.textContent = `SEM = ${sm.sd} × √(1 − ${sm.rxx.toFixed(2)}) = ${ci.sem.toFixed(2)}.\n95% band for an observed score of ${sm.x}: ${ci.lo.toFixed(1)} to ${ci.hi.toFixed(1)}.`;
      const rs = Array.from({ length: 50 }, (_, i) => 0.5 + i * 0.01);
      smChart.innerHTML = '';
      smChart.appendChild(api.charts.line([
        { name: 'upper 95% limit', points: rs.map((r) => ({ x: r, y: api.stats.ciScore(sm.x, sm.sd, r).hi })) },
        { name: 'observed score', points: rs.map((r) => ({ x: r, y: sm.x })), dash: true },
        { name: 'lower 95% limit', points: rs.map((r) => ({ x: r, y: api.stats.ciScore(sm.x, sm.sd, r).lo })) },
        { name: 'current reliability', points: [{ x: sm.rxx, y: ci.lo }, { x: sm.rxx, y: ci.hi }], dots: true }], { label: `95% score band around ${sm.x} as reliability changes (SD ${sm.sd})`, xl: 'reliability rxx', yl: 'score' }));
    };
    body.appendChild(card(null, h('div', { class: 'grid2' },
      api.slider('Test SD', { min: 1, max: 20, step: 1, value: sm.sd, onInput: (v) => { sm.sd = v; drawSEM(); } }),
      api.slider('Reliability rxx', { min: 0.5, max: 0.99, step: 0.01, value: sm.rxx, onInput: (v) => { sm.rxx = v; drawSEM(); } }),
      api.slider('Observed score', { min: 55, max: 145, step: 1, value: sm.x, onInput: (v) => { sm.x = v; drawSEM(); } })), smChart, smOut));
    drawSEM();

    // ---- validity & norms
    body.appendChild(H3('Validity evidence'));
    body.appendChild(api.table(['Type of evidence', 'Question', 'Example (simulated exam-anxiety scale)'], [
      ['Content', 'Do the items cover the construct and nothing else?', 'Experts check items span worry, bodily tension and avoidance'],
      ['Criterion — concurrent', 'Do scores relate to a criterion measured at the same time?', 'Correlation with counsellor ratings this week'],
      ['Criterion — predictive', 'Do scores forecast a later criterion?', 'Scores in week 1 predict exam-day performance'],
      ['Construct — convergent', 'Does it correlate with measures of similar constructs?', 'Moderate correlation with a general anxiety scale'],
      ['Construct — discriminant', 'Is it distinct from different constructs?', 'Low correlation with extraversion'],
      ['Face', 'Does it look relevant to test-takers?', 'Students see the items as about exams (helps engagement, not proof of validity)'],
      ['Consequential', 'What are the effects of using the scores?', 'Does flagging students lead to help or to stigma?'],
    ]));
    body.appendChild(H3('Norms and percentiles'));
    body.appendChild(P('A raw score means little until compared with a <b>norm group</b>: a large, representative sample tested under standard conditions. Norm-referenced scores (percentile ranks, z, T, deviation IQ, stanines) express a person’s standing in that group; criterion-referenced scores compare against a fixed standard (mastery). Norms from another country, era or language group can mislead — one reason Pakistani adaptations need local standardisation samples. Convert between scales in the Intelligence panel.'));
    body.appendChild(row(K.panel('intelligence', 'Score converter & normal curve'), K.panel('personality', 'IPIP Big Five'), K.panel('stats', 'Statistics Workbench'), K.run('ipip_big5', '▶ Run IPIP Big Five (learning only)'), K.zone('library')));
  },
};

module.exports = [development, emotion, health, personality, psychometrics];
