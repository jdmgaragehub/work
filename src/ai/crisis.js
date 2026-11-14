'use strict';
/**
 * Crisis detector (A7, §7 rail 3; docs/ETHICS_SAFETY.md §8.4). PURE — no DOM.
 *
 *   detect(text) → { crisis: boolean, category: 'suicide'|'self-harm'|'abuse'|'harm-others'|null, matched: string|null }
 *
 * Offline regex set for English, romanised Urdu and Urdu script. Design rule: a false
 * negative is far worse than a false positive (G14 requires 0 false negatives), so:
 *  - STRONG patterns (first-person or unmistakable phrasing) always fire.
 *  - WEAK patterns (a bare topic word such as "suicide" or "abuse") fire unless the text is
 *    clearly academic/game context AND contains no first-person reference.
 *  - Negation only removes a small whitelist of explicit reassurances ("I'm not suicidal"),
 *    and never when the text also contains a hedge ("but", "sometimes", "anymore", "lekin"…),
 *    and never when any other pattern still matches.
 *  - Game/idiom contexts that the patterns could otherwise catch ("kill the process",
 *    "this neuron dies", "dying to know") are stripped before matching.
 */

// ---------------------------------------------------------------- normalisation
function normalise(text) {
  return String(text == null ? '' : text)
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g, '') // zero-width / bidi marks
    .replace(/[\u2018\u2019\u02bc\u0060\u00b4]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u0643]/g, '\u06a9') // Arabic kaf → Urdu keheh
    .replace(/[\u064a]/g, '\u06cc') // Arabic yeh → Farsi yeh
    .replace(/[\u064b-\u065f\u0670]/g, '') // Arabic diacritics
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Second spelling variant: simple leetspeak and stretched letters ("k1ll mys3lf", "dieeee"). */
function variant(t) {
  return t.replace(/[0-9@$]/g, (c) => ({ 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' }[c] || c))
    .replace(/([a-z])\1{2,}/g, '$1$1');
}

// Shared fragments (source strings, case already lower)
const I_AM = "(?:i'?m|i am|im|i feel|i'?ve been|i have been|i keep)";
const DONT = "(?:don'?t|dont|do not|no longer|never)";
const MYSELF = '(?:my\\s*self|mysef|myslef|meself)';
const ANYMORE = '(?:any ?more|any longer|no more)';
const FAMILY = '(?:father|dad|abbu|abba|mother|mom|mum|ammi|amma|husband|wife|uncle|chacha|mamu|mamoo|brother|bhai|sister|teacher|sir|boss|partner|boyfriend|girlfriend|step\\w*|cousin|in-?laws?|saas|susar|family|parents?|guardian|coach|neighbou?r)';
const PERSON = `(?:him|her|them|someone|somebody|everyone|everybody|people|you|u|that (?:guy|girl|man|woman|boy|person|teacher)|my ${FAMILY}|my (?:classmates?|roommate|friend|ex)|the (?:teacher|class|school))`;

// ---------------------------------------------------------------- strong patterns
const STRONG = {
  suicide: [
    // English: explicit intent
    '\\bsuicidal\\b',
    '\\b(?:commit(?:ting)?|attempt(?:ed|ing)?|thinking (?:of|about)|thought (?:of|about)|plan(?:ning|ned)?|consider(?:ing|ed)?|contemplat(?:e|ing)|going to|gonna|want to|wanna|might|will) (?:commit )?suicide\\b',
    `\\b(?:kill(?:ing)?|end(?:ing)?|take|taking|took) (?:${MYSELF}|my (?:own )?li(?:fe|ves))\\b`,
    `\\bkms\\b|\\bunalive ${MYSELF}\\b|\\bunaliv(?:e|ing)\\b`,
    '\\bend (?:it|everything|this) all\\b|\\bend it (?:now|tonight|today)\\b',
    "\\b(?:want|wanna|wish|wishing|ready|going|gonna|deserve|need) (?:to )?(?:just )?die+\\b",
    '\\bi (?:should|could|might|will|would rather|just want to|want to) (?:just )?die+\\b',
    '\\bwish (?:i (?:was|were|had)|to be) (?:dead|never born|gone|not alive|not here)\\b',
    '\\bwish i (?:could )?(?:disappear|sleep) (?:forever|and never wake up)\\b',
    '\\b(?:sleep|go to sleep) and never wake up\\b',
    '\\bbetter off (?:dead|without me|if i (?:was|were)n?\'?t (?:here|around|alive))\\b',
    "\\b(?:everyone|everybody|they|world|family) (?:would|will) be (?:better|happier) (?:off )?(?:without me|if i (?:was|were) gone|if i died)\\b",
    `\\b${DONT} (?:want|wanna|wish) to (?:live|be alive|exist|wake up|go on|continue living|be here ${ANYMORE}|be around ${ANYMORE}|be in this world)\\b`,
    `\\b${DONT} want to be (?:here|alive|around) ${ANYMORE}\\b`,
    `\\b(?:can'?t|cant|cannot) (?:go on|keep going|do this|take (?:it|this|life)|cope|live like this|handle (?:it|life)) ${ANYMORE}\\b`,
    '\\b(?:can\'?t|cant|cannot) go on\\b',
    '\\bno (?:reason|point|purpose) (?:to|in|for) (?:live|living|life|go(?:ing)? on|being alive|wake up|waking up)\\b',
    '\\b(?:life|living) (?:is|isn\'?t) (?:not )?worth (?:it|living)\\b|\\bnot worth living\\b|\\blife (?:is )?not worth\\b',
    "\\b(?:nobody|no one|no-one) (?:would|will) (?:miss|care|notice) (?:me|if i)\\b",
    "\\bi'?m (?:just )?a burden\\b|\\bburden (?:to|on) (?:everyone|everybody|my family|them)\\b",
    '\\b(?:hang|hanging|shoot|shooting|drown|drowning|poison|poisoning|starve) (?:my\\s*self|myself)\\b',
    '\\bjump(?:ing)? (?:off|from|in front of) (?:a|the|this) (?:bridge|building|roof|cliff|train|bus|balcony|tower)\\b',
    '\\b(?:suicide|goodbye|farewell|last) (?:note|letter|message)\\b',
    '\\bthis is (?:my )?goodbye\\b|\\bgoodbye forever\\b|\\bsay(?:ing)? goodbye (?:to everyone|forever)\\b',
    '\\b(?:painless|easiest|quickest|best) way to (?:die|end (?:it|my life))\\b|\\bhow (?:to|do i|can i) (?:kill myself|end my life|die painlessly|commit suicide)\\b',
    '\\bhow many (?:pills|tablets|sleeping pills|panadol)\\b.{0,30}\\b(?:die|kill|lethal|overdose|enough)\\b',
    '\\boverdos(?:e|ed|ing)\\b',
    '\\b(?:too many|whole (?:bottle|strip|pack) of|bunch of|all (?:my|the|of my)) (?:pills|tablets|sleeping pills|medicine|meds)\\b',
    '\\b(?:swallow(?:ed)?|took|take|taking)\\b.{0,15}\\b(?:all|lots of|a lot of|handful of)\\b.{0,12}\\b(?:pills|tablets|meds)\\b',
    `\\b${I_AM} (?:so |completely |totally |really )?(?:hopeless|worthless|empty and alone)\\b`,
    '\\b(?:feel|feeling) (?:so |completely |totally |really )?hopeless\\b',
    '\\bthoughts? (?:of|about) (?:death|dying|suicide|ending (?:it|my life)|killing myself)\\b',
    '\\bsuicidal (?:thoughts?|ideation|feelings?)\\b',
    `\\b(?:disappear|vanish) forever\\b|\\bnot (?:be|being) here tomorrow\\b|\\bwon'?t be (?:here|around) (?:tomorrow|much longer|for long)\\b`,
    '\\btired of (?:living|life|being alive|existing)\\b|\\bdone with (?:life|living)\\b',
    // romanised Urdu
    '\\bkhud\\s?-?\\s?k[ua]shi\\b|\\bkhudkashi\\b|\\bkhud\\s?kushee\\b',
    '\\bmar\\s?(?:jana|jaana|jaun|jaoon|jaon|jaoun|jau|jaye|jaoun?ga|jaungi|jaunga|jaoongi|jaon?gi)\\b',
    '\\bmarna\\s?(?:chaht[ai]|chahta|chahti|chahty|hai|hay)\\b|\\bmarne\\s?(?:ka|ko)\\s?(?:dil|mann?|jee|ji)\\b',
    '\\bmar\\s?jana\\s?chaht[ai]\\b',
    '\\b(?:jee?na|jeena|jina|zinda rehna|zinda rahna)\\s?(?:nahi|nahin|nai|ni)\\b',
    '\\bjeene?\\s?(?:ka|ki)\\s?(?:dil|mann?|wajah|koi wajah)\\s?(?:nahi|nahin|nai|ni)\\b',
    '\\bzindagi\\s?(?:khatam|khtm|se tang|se thak|bekar|ka koi faida nahi|ka koi fayda nahi)\\b',
    '\\b(?:apni|apne)\\s?jaan\\s?(?:le|lena|loon|lun|lu|de|dena|doon|dun|du)\\b|\\bjaan\\s?(?:de|le)\\s?(?:dun|doon|lun|loon|du|lu)(?:ga|gi)?\\b',
    '\\b(?:khud|apne\\s?aap)\\s?(?:ko)?\\s?(?:maar|mar|khatam)\\s?(?:dun|doon|du|lun|loon|dena|lena|deta|deti|dalun|daloon|dalna)\\b',
    '\\b(?:khud|apne\\s?aap)\\s?ko\\s?(?:maar|mar|khatam)\\b',
    '\\bmout\\s?(?:chahi?ye|chahta|chahti|aa jaye|aajaye)\\b|\\bmaut\\s?(?:chahi?ye|aa jaye|aajaye)\\b',
    '\\bphansi\\s?(?:laga|lagana|le)\\b|\\bpankh[ey]\\s?se\\s?latak\\b',
    // Urdu script (no \b: JS word boundaries are ASCII-only)
    'خود\\s?کشی|خودکشی',
    'مر\\s?جا(?:نا|ؤں|وں|ئوں|ؤ|ے)',
    'مرنا\\s?چاہ',
    'مرنے\\s?کو\\s?دل',
    'جی(?:نا|ے)\\s?(?:نہیں|نہ)\\s?چاہ',
    'زندہ\\s?(?:نہیں|نہ)\\s?رہنا',
    'زندگی\\s?(?:ختم|سے\\s?تنگ|بیکار)',
    'اپنی\\s?جان\\s?(?:لے|دے)',
    '(?:خود|اپنے\\s?آپ)\\s?کو\\s?(?:مار|ختم)',
    'موت\\s?(?:چاہ|آ\\s?جائے)',
  ],
  'self-harm': [
    `\\b(?:cut|cutting|cuts|hurt|hurting|harm|harming|burn|burning|punish(?:ing)?|scratch(?:ing)?|hit(?:ting)?|bite|biting|bang(?:ing)? my head|starv(?:e|ing)|injur(?:e|ing)) ${MYSELF}\\b`,
    `\\b(?:cut|cutting|cuts|slit|slitting) (?:my )?(?:wrists?|arms?|thighs?|legs?|skin)\\b`,
    `\\b(?:i|i'?ve|i have) (?:been )?(?:self[- ]?harm(?:ed|ing)?|cutting again|relapsed)\\b`,
    '\\bself[- ]?harm(?:ing)? (?:again|urges?|scars?)\\b',
    '\\bi\\b.{0,25}\\bself[- ]?harm',
    '\\burges? to (?:cut|hurt|harm|burn)\\b',
    '\\b(?:razor|blade)s?\\b.{0,30}\\b(?:my (?:arm|wrist|skin|leg)|on myself)\\b',
    '\\b(?:make|making) myself bleed\\b|\\bbleed(?:ing)? on purpose\\b',
    // romanised Urdu
    '\\b(?:khud|apne\\s?aap)\\s?(?:ko)?\\s?(?:nuqsan|nuksan|nuqsaan|nuksaan|zakhmi|takleef|chot|kaat|kat)\\b',
    '\\b(?:hath|haath|kalai|bazu|baazu)\\s?(?:kaat|kat|kaata|kata)\\b',
    // Urdu script
    '(?:خود|اپنے\\s?آپ)\\s?کو\\s?(?:نقصان|زخمی|تکلیف|کاٹ|چوٹ)',
    '(?:ہاتھ|کلائی|بازو)\\s?کا(?:ٹ|ٹا)',
  ],
  abuse: [
    `\\b(?:he|she|they|someone|somebody|my (?:\\w+ ){0,2}${FAMILY})\\s+(?:always |often |keeps? |still |sometimes |regularly )?(?:hits?|beats?|beat|abuses?|abused|hurts?|hurt|touch(?:es|ed)?|threatens?|threatened|rapes?|raped|molests?|molested|chokes?|choked|kicks?|kicked|slaps?|slapped|burns?|burned|locks?|locked|forces?|forced|harass(?:es|ed)?|blackmails?|blackmailed)\\s+me\\b`,
    `\\b(?:${I_AM}|i was|i got|i'?ve been|being|was|been|got|getting)\\s+(?:sexually |physically |emotionally |verbally )?(?:abused|molested|raped|assaulted|beaten|beaten up|harassed|groomed|trafficked|hit by)\\b`,
    '\\b(?:not|don\'?t feel|never feel|dont feel) safe (?:at home|with (?:him|her|them|my \\w+)|in my (?:house|home))\\b',
    `\\bafraid (?:of|to go) (?:home|going home|my ${FAMILY}|him|her)\\b|\\bscared (?:of|to go) (?:home|going home|my ${FAMILY})\\b`,
    '\\b(?:touch(?:es|ed|ing)?|touched) me (?:inappropriately|there|without (?:my )?consent)\\b|\\binappropriate(?:ly)? touch',
    '\\b(?:domestic (?:violence|abuse))\\b.{0,30}\\b(?:me|my|home|i)\\b|\\b(?:me|my|i)\\b.{0,30}\\bdomestic (?:violence|abuse)\\b',
    '\\bforced (?:me )?(?:to have sex|into sex|marriage|to marry)\\b|\\bforced to marry\\b',
    '\\bsexual(?:ly)? (?:abuse|assault|harass)\\w*\\b.{0,25}\\b(?:me|my|i)\\b|\\b(?:me|my|i)\\b.{0,25}\\bsexual(?:ly)? (?:abuse|assault|harass)',
    '\\bhe (?:touched|touches|tried to touch) me\\b',
    // romanised Urdu
    '\\b(?:mujhe|mujhay|mujhko|humein|hamein)\\s?(?:\\w+\\s?){0,3}(?:maar|mar|peet|pit)(?:ta|ti|te|tay)\\s?(?:hai|hain|hay|thay|tha|thi)\\b',
    '\\bmaar\\s?peet\\b|\\bmar\\s?peet\\b|\\bmaara\\s?peeta\\b',
    '\\b(?:zabardasti|zabardasti ki|ziyadti|zyadti|ziadti|jinsi ziyadti|tashaddud|tashadud)\\b',
    '\\b(?:ghar|gher)\\s?(?:mein|me|main)\\s?(?:mehfooz|mahfooz|safe)\\s?(?:nahi|nahin|nai)\\b',
    '\\b(?:galat|ghalat|buri)\\s?(?:tarah|jagah)\\s?(?:chhua|chhuta|chhoota|haath lagaya|hath lagata)\\b',
    // Urdu script
    'مجھے\\s?(?:\\S+\\s?){0,3}مار(?:تا|تی|تے)',
    'مار\\s?پیٹ|تشدد|زیادتی|زبردستی|ہراساں|جنسی',
    'گھر\\s?میں\\s?محفوظ\\s?نہیں',
  ],
  'harm-others': [
    `\\b(?:i|i'?ll|i will|i'?m going to|im going to|i'?m gonna|im gonna|gonna|going to|want to|wanna|i want to|i could|i might|planning to|plan to)\\s+(?:\\w+\\s+)?(?:kill|murder|stab|shoot|strangle|poison|hurt|attack|beat up|burn)\\s+${PERSON}\\b`,
    '\\b(?:shoot|bomb|attack)\\s+(?:up\\s+)?(?:the|my|our)\\s+(?:school|class|university|campus|office|mosque|masjid)\\b',
    '\\b(?:bring|brought|take|taking)\\s+(?:a|my|the)\\s+(?:gun|knife|pistol|weapon)\\s+to\\s+(?:school|class|university|campus|work)\\b',
    '\\b(?:make|making) (?:him|her|them) (?:pay|suffer|bleed)\\b',
    '\\bkys\\b|\\bkill yourself\\b|\\bgo die\\b',
    // romanised Urdu
    '\\b(?:usay|use|usko|us ko|unhe|unko|tumhe|tujhe|isko|is ko)\\s?(?:jaan\\s?se\\s?)?(?:maar|mar|qatl kar|khatam kar)\\s?(?:dun|doon|du|dunga|doonga|dungi|doongi|daloon|dalunga|dalun)\\b',
    '\\bqatl\\s?(?:kar\\s?)?(?:dun|doon|dunga|doonga|dungi|karna chahta|karunga|karungi)\\b',
    '\\bjaan\\s?se\\s?maar\\s?(?:dun|doon|dunga|doonga|dungi|dena)\\b',
    // Urdu script
    '(?:اسے|اس\\s?کو|انہیں|تمہیں|تجھے)\\s?(?:جان\\s?سے\\s?)?مار\\s?(?:دوں|ڈالوں|دوں\\s?گا)',
    'قتل\\s?کر\\s?(?:دوں|دوں\\s?گا|ڈالوں)',
  ],
};

// ---------------------------------------------------------------- weak (topic) patterns
const WEAK = {
  suicide: ['\\bsuicid\\w*', '\\bwant(?:ed|ing)? to die\\b', '\\bending (?:it|my life)\\b', 'khudkushi'],
  'self-harm': ['\\bself[- ]?(?:harm|injur|mutilat)\\w*', '\\bcutting\\b'],
  abuse: ['\\babus(?:e|ed|ive|er)\\b', '\\brap(?:e|ed|ist)\\b', '\\bmolest\\w*', '\\bincest\\b', '\\bgroom(?:ed|ing)\\b.{0,15}\\b(?:child|me|online)\\b'],
  'harm-others': [],
};

// Academic / game context markers (only ever suppress WEAK matches, never STRONG ones)
const ACADEMIC = /\b(?:research|study|studies|theory|theories|durkheim|statistic\w*|rates?|prevalence|prevention|ethic\w*|define|definition|what is|what are|explain|module|case (?:study|card)|content warning|history|epidemiolog\w*|literature|paper|article|lecture|exam|quiz|essay|assignment|irb|risk factors?|protective factors?|simulated|client|textbook|chapter|week|substance|drug|alcohol|child abuse research|bandura|bobo|reporting|helpline|card|warning|safeguard\w*|policy|who|apa|journal|grooming behaviour|cutting[- ]edge|cutting (?:the|a|an|it|this|that|down|back|corners|out|across|board|paper|cake|onion|hair|line|edge))\b/;
const FIRST_PERSON = /\b(?:i|i'm|im|i've|i'll|i'd|me|my|myself|mine|main|mein|mujhe|mujh|mera|meri|mere|hum|humein|hamein)\b|میں|مجھے|میرا|میری|میرے/;

// Game/idiom stripping (applied before matching; patterns here are deliberately narrow)
const BENIGN = [
  /\bkill(?:ing|ed|s)? (?:the|this|that|a|an|my|all) (?:process(?:es)?|task|tab|app|program|server|music|sound|audio|lights?|engine|timer|game|run|thread|job|script|switch|bug|noise|mood|vibe|buzz|power|notifications?|enemy|enemies|monster|boss|zombies?|time|weeds|germs|bacteria)\b/g,
  /\bkill(?:ing)? it\b/g, /\bkill time\b/g, /\bkill two birds\b/g,
  /\b(?:dying|die) to (?:know|see|try|hear|meet|go|play|read|find out)\b/g,
  /\b(?:the )?(?:neuron|cell|cells|neurons|battery|phone|laptop|plant|plants|fish|rat|rats|pigeon|mouse|mice|signal|connection|server|game|character|avatar|npc|engine|bulb|fire|flame|music|trend|light)s? (?:die|dies|died|dying|is dying|was killed|got killed)\b/g,
  /\b(?:cell|neuronal|programmed cell|apoptotic) death\b/g,
  /\bdead ?(?:line|lines|lock|end|weight|zone|pixel|pixels|link|code|key|band|time|reckoning|heat)\b/g,
  /\bshoot(?:ing)? (?:a |the |some )?(?:photo|photos|picture|pictures|video|scene|film|screenshot|footage|shot)\b/g,
  /\b(?:hit|beat|beats) (?:the )?(?:record|deadline|high score|target|ball|key|button|space ?bar|enter|level|boss|game)\b/g,
  /\b(?:cut|cutting) (?:the )?(?:data|outliers?|trials?|rts?|reaction times?|paper|cake|scene|clip|budget|costs?|corners)\b/g,
  /\bburn(?:ing)? (?:the )?(?:calories|cd|dvd|disk|rubber|midnight oil)\b/g,
];

// Explicit reassurances that may be removed (only when no hedge word is present)
const REASSURE = [
  /\b(?:i'?m|i am|im) not (?:suicidal|going to (?:kill|hurt|harm) myself|thinking (?:of|about) (?:suicide|killing myself))\b/g,
  /\bi (?:would|will|could) never (?:kill|hurt|harm) myself\b/g,
  /\bi have never (?:been suicidal|self[- ]?harmed|tried to kill myself)\b/g,
];
const HEDGE = /\b(?:but|though|although|however|sometimes|still|anymore|any more|lately|recently|again|tonight|maybe|kabhi|lekin|magar|phir bhi)\b|لیکن|مگر|کبھی/;

const ORDER = ['suicide', 'self-harm', 'abuse', 'harm-others'];
const compile = (list) => list.map((s) => new RegExp(s, 'u'));
const STRONG_RE = {}; const WEAK_RE = {};
for (const c of ORDER) { STRONG_RE[c] = compile(STRONG[c]); WEAK_RE[c] = compile(WEAK[c]); }

function firstMatch(text, table) {
  for (const c of ORDER) for (const re of table[c]) { const m = re.exec(text); if (m) return { category: c, matched: m[0].trim() || m[0] }; }
  return null;
}

function scan(t) {
  // 1) strong patterns on the raw normalised text — never weakened by any context rule
  const raw = firstMatch(t, STRONG_RE);
  // 2) strip benign idioms/game contexts, then re-check strong + weak
  let s = t;
  for (const re of BENIGN) s = s.replace(re, ' ');
  // reassurance removal only when nothing hedges it
  let reassured = s;
  if (!HEDGE.test(s)) for (const re of REASSURE) reassured = reassured.replace(re, ' ');
  const strong = firstMatch(reassured, STRONG_RE);
  if (strong) return strong;
  if (raw) {
    // The raw hit vanished only through stripping. Keep it unless the stripped span fully
    // explains it (benign idiom) or it was an explicit, unhedged reassurance.
    const explainedByBenign = !firstMatch(s, STRONG_RE);
    const explainedByReassure = reassured !== s;
    if (!(explainedByBenign && BENIGN.some((re) => { re.lastIndex = 0; return re.test(t); })) && !explainedByReassure) return raw;
    if (explainedByReassure && !explainedByBenign) { /* reassurance-only: suppressed */ }
  }
  const weak = firstMatch(reassured, WEAK_RE);
  if (weak) {
    const academic = ACADEMIC.test(reassured) && !FIRST_PERSON.test(reassured);
    if (!academic) return weak;
  }
  return null;
}

/** detect(text) → {crisis, category, matched}. Pure, synchronous, offline. */
function detect(text) {
  const t = normalise(text);
  if (!t) return { crisis: false, category: null, matched: null };
  const hit = scan(t) || (variant(t) !== t ? scan(variant(t)) : null);
  return hit ? { crisis: true, category: hit.category, matched: hit.matched } : { crisis: false, category: null, matched: null };
}

const counts = () => ({ strong: ORDER.reduce((n, c) => n + STRONG[c].length, 0), weak: ORDER.reduce((n, c) => n + WEAK[c].length, 0) });

module.exports = { detect, normalise, CATEGORIES: ORDER.slice(), counts };
