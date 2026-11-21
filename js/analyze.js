// Все цифры отчёта: считаются в браузере по списку сообщений.

const L = "\\p{L}";
const B = `(?<![${L}])`, E = `(?![${L}])`;
const rx = p => new RegExp(B + "(?:" + p + ")" + E, "iu");

export const CATS = {
  laugh: new RegExp(B + "(?:а?(?:ха){2,}\\p{L}*|(?:ах){2,}\\p{L}*|хех\\p{L}*|лол|ору+|ржу|ржака)" + E + "|😂|🤣|\\){2,}", "iu"),
  love: new RegExp(B + "(?:люблю|любимая|любимый|скучаю|соскучил\\p{L}*|обожаю|милый|милая|зай|зайка|зайчик|зая|солнышко|котик|котёнок|родн(?:ой|ая)|целую|обнимаю|малыш\\p{L}*|красотка|красавица)" + E + "|❤|💕|😘|🥰|😍|💖|♥|💗|💞|💘", "iu"),
  sorry: rx("прост(?:и|ите)|извин\\p{L}*|сорян|сорри|виноват\\p{L}*|моя вина"),
  thanks: rx("спасибо|спс|благодарю|пасиб\\p{L}*"),
  goodMorning: rx("доброе утро|доброе|утречко|с добрым утром"),
  goodNight: rx("спокойной ночи|споки|сладких снов|мягких снов|доброй ночи|спокойной"),
  care: rx("ты поел\\p{L}*|покушал\\p{L}*|как ты|как себя чувствуешь|доехал\\p{L}*|дошл\\p{L}*|оденься|выспал\\p{L}*|как спал\\p{L}*|ты как"),
  hurt: rx("обид\\p{L}*|обижен\\p{L}*|бесишь|бесит|достал\\p{L}*|надоел\\p{L}*|задолбал\\p{L}*|не пиши|отвали|ну и ладно|как хочешь|мне вс[её] равно|игнор\\p{L}*|опять ты|ты всегда|ты никогда"),
  swear: new RegExp(`(?<![а-яё])(?:бля\\p{L}*|хуй\\p{L}*|ху[её]\\p{L}*|пизд\\p{L}*|еба\\p{L}*|ебл\\p{L}*|заеб\\p{L}*|наху\\p{L}*|похуй\\p{L}*|сука)`, "iu"),
};
const LOVE_FIRST = rx("люблю тебя|я тебя люблю");
const NICK = rx("зай|зайка|зайчик|зая|котик|котёнок|солнышко|малыш|пупсик");
const MISS = rx("скучаю|соскучил\\p{L}*");
const ANGRY = new Set(["😡", "😤", "🤬", "😠"]);
const SAD = new Set(["😡", "😤", "😔", "😢", "😭", "💔", "🤬", "😠"]);

const STOP = new Set(("и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только ее мне было вот от меня еще нет о из ему теперь когда даже ну вдруг ли если уже или ни быть был него до вас нибудь опять уж вам ведь там потом себя ничего ей может они тут где есть надо ней для мы тебя их чем была сам чтоб без будто чего раз тоже себе под будет ж тогда кто этот того потому этого какой совсем ним здесь этом один почти мой тем чтобы нее сейчас были куда зачем всех никогда можно при наконец два об другой хоть после над больше тот через эти нас про всего них какая много разве три эту моя впрочем хорошо свою этой перед иногда лучше чуть том нельзя такой им более всегда конечно всю между это просто че чё щас ща тебе типо типа вообще мб ещё ага угу ладно понял поняла знаю хочу почему очень давай тоже сегодня завтра надо было есть будет меня тебя мне тебе тут там вот так как что это его она они http https www com").split(" "));

const REFRAIN_SKIP = new Set("доброе утро утра спокойной ночи снов сладких мягких спасибо привет пока сейчас потом точно может можно нужно надо тогда когда только вообще короче кстати".split(" "));
const DAY = 86400000;
export const dayOf = t => Math.floor(t / DAY);
const iso = t => new Date(t).toISOString().slice(0, 10);
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const inc = (m, k, n = 1) => m.set(k, (m.get(k) || 0) + n);
const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
const textOf = m => (m.fwd ? "" : m.text || "");

function laughLen(t) {
  const s = t.replace(/\s/g, "");
  if (s.length < 8 || !/^[А-Яа-яЁё]+$/.test(s)) return 0;
  const lc = s.toLowerCase();
  let hit = 0; for (const c of lc) if ("ахпзфывщъэж".includes(c)) hit++;
  if (hit / s.length < 0.85) return 0;
  if (!/ах|ха|хп|пх|хв|вх|зф|фх/.test(lc)) return 0;
  return s.length;
}

// Род по самоописаниям: «я пришла» против «я пришёл».
function guessGender(texts) {
  let f = 0, m = 0;
  const reF = /(?<!\p{L})я\s+(?:не\s+)?\p{L}{2,}ла(?:сь)?(?!\p{L})/giu;
  const reM = /(?<!\p{L})я\s+(?:не\s+)?\p{L}{2,}(?:л|лся|ёл|шёл)(?!\p{L})/giu;
  for (const t of texts) {
    if (t.length > 300) continue;
    f += (t.match(reF) || []).length;
    m += (t.match(reM) || []).length;
  }
  if (f + m < 8) return null;
  if (f > m * 1.6) return "f";
  if (m > f * 1.6) return "m";
  return null;
}

export function analyze(all) {
  const counts = new Map();
  for (const m of all) inc(counts, m.from);
  const ranked = top(counts, 10);
  if (ranked.length < 2) throw new Error("В чате только один собеседник — для разбора нужны двое.");
  const people = ranked.slice(0, 2).map(x => x[0]);
  const others = ranked.slice(2).reduce((s, x) => s + x[1], 0);
  const msgs = all.filter(m => m.from === people[0] || m.from === people[1]);
  const P = m => (m.from === people[0] ? 0 : 1);

  const per = [0, 1].map(() => ({ msgs: 0, text: 0, len: 0, voiceSec: 0, stickers: 0, media: 0, questions: 0, caps: 0, love: 0, sorry: 0, thanks: 0, laugh: 0, hurt: 0, swear: 0, care: 0, goodMorning: 0, goodNight: 0 }));
  const stickerEmoji = [new Map(), new Map()];
  const words = [new Map(), new Map()];
  const selfTexts = [[], []];
  const hours = [Array(24).fill(0), Array(24).fill(0)];
  const months = new Map();
  const days = new Map();
  const heatTot = new Map(), heatLove = new Map(), hourTot = new Map(), hourLove = new Map(), hourLoveBy = new Map();

  for (const m of msgs) {
    const p = P(m), r = per[p], d = new Date(m.t);
    const t = textOf(m);
    r.msgs++;
    const ym = m.t ? iso(m.t).slice(0, 7) : "";
    if (!months.has(ym)) months.set(ym, [0, 0]);
    months.get(ym)[p]++;
    inc(days, dayOf(m.t));
    hours[p][d.getUTCHours()]++;
    if (m.media) {
      r.media++;
      if (m.media === "voice" || m.media === "round") r.voiceSec += m.dur || 0;
      if (m.media === "sticker") { r.stickers++; if (m.emoji) inc(stickerEmoji[p], m.emoji); }
    }
    const wd = (d.getUTCDay() + 6) % 7, part = [3, 0, 1, 2][Math.floor(d.getUTCHours() / 6)];
    const hk = wd * 4 + part, hh = wd * 24 + d.getUTCHours();
    inc(heatTot, hk); inc(hourTot, hh);
    if (CATS.love.test(t + (m.emoji || ""))) { inc(heatLove, hk); inc(hourLove, hh); inc(hourLoveBy, hh * 2 + p); }
    if (!t) continue;
    r.text++; r.len += t.length;
    for (const k in CATS) if (CATS[k].test(t)) r[k]++;
    if (t.includes("?")) r.questions++;
    const letters = t.replace(/[^A-Za-zА-Яа-яЁё]/g, "");
    if (letters.length >= 6 && letters === letters.toUpperCase()) r.caps++;
    for (const w of t.toLowerCase().match(/[а-яё]{3,}/g) || []) inc(words[p], w);
    if (/(?<!\p{L})я\s/iu.test(t)) selfTexts[p].push(t);
  }

  // Разговоры: пауза больше 6 часов начинает новый.
  const GAP = 6 * 3600e3;
  const init = [0, 0], lastWord = [0, 0], resp = [[], []];
  let prev = null, longestGap = null;
  for (const m of msgs) {
    const p = P(m);
    if (!prev || m.t - prev.t > GAP) {
      init[p]++;
      if (prev) {
        lastWord[P(prev)]++;
        if (!longestGap || m.t - prev.t > longestGap.ms) longestGap = { ms: m.t - prev.t, from: prev.t, to: m.t };
      }
    } else if (P(prev) !== p) resp[p].push((m.t - prev.t) / 1000);
    prev = m;
  }

  // Кто первым желает доброго утра и спокойной ночи.
  const gm = new Map(), gn = new Map();
  for (const m of msgs) {
    const t = textOf(m); if (!t) continue;
    const h = new Date(m.t).getUTCHours();
    if (h < 15 && CATS.goodMorning.test(t) && !gm.has(dayOf(m.t))) gm.set(dayOf(m.t), P(m));
    if (CATS.goodNight.test(t)) {
      const k = h >= 12 ? dayOf(m.t) : dayOf(m.t) - 1;
      if (!gn.has(k)) gn.set(k, P(m));
    }
  }
  const firstMorning = [0, 0], firstNight = [0, 0];
  gm.forEach(p => firstMorning[p]++); gn.forEach(p => firstNight[p]++);

  // Дни и серии.
  const dayList = [...days.keys()].sort((a, b) => a - b);
  let best = 1, cur = 1, bestEnd = dayList[0];
  for (let i = 1; i < dayList.length; i++) {
    cur = dayList[i] - dayList[i - 1] === 1 ? cur + 1 : 1;
    if (cur > best) { best = cur; bestEnd = dayList[i]; }
  }
  const [recDay, recN] = top(days, 1)[0];
  const angry = new Map();
  for (const m of msgs) if (m.emoji && ANGRY.has(m.emoji)) inc(angry, dayOf(m.t));
  const angriest = angry.size ? top(angry, 1)[0] : null;

  // Месяцы подряд, без пропусков.
  const mkeys = [...months.keys()].sort();
  const monthSeries = [];
  if (mkeys.length) {
    let [y, mo] = mkeys[0].split("-").map(Number);
    const [ly, lm] = mkeys[mkeys.length - 1].split("-").map(Number);
    while (y < ly || (y === ly && mo <= lm)) {
      const k = `${y}-${String(mo).padStart(2, "0")}`;
      const v = months.get(k) || [0, 0];
      monthSeries.push([k, v[0], v[1]]);
      mo++; if (mo > 12) { mo = 1; y++; }
    }
  }

  // Нежность по дням недели и частям суток (утро, день, вечер, ночь).
  const heat = [...Array(7)].map((_, d) => [0, 1, 2, 3].map(b => {
    const k = d * 4 + b; return Math.round(((heatLove.get(k) || 0) / Math.max(1, heatTot.get(k) || 0)) * 10000) / 10;
  }));
  const minHour = Math.max(30, msgs.length * 0.0015);
  let tender = null;
  for (const [k, n] of hourTot) {
    if (n < minHour) continue;
    const v = (hourLove.get(k) || 0) / n;
    if (!tender || v > tender.v) tender = { v, k, n: hourLove.get(k) || 0 };
  }
  if (tender) {
    const a = hourLoveBy.get(tender.k * 2) || 0, b = hourLoveBy.get(tender.k * 2 + 1) || 0;
    tender = { weekday: Math.floor(tender.k / 24), hour: tender.k % 24, per1000: Math.round(tender.v * 10000) / 10, n: tender.n, by: [a, b] };
  }

  // Самый громкий смех.
  const ctx = (i, n = 4) => {
    const res = [];
    for (let j = i - 1; j >= 0 && res.length < n; j--) {
      const x = msgs[j];
      if (msgs[i].t - x.t > 1800e3) break;
      if (textOf(x)) res.unshift({ p: P(x), t: textOf(x).slice(0, 140) });
    }
    return res;
  };
  const laughs = [];
  msgs.forEach((m, i) => { const n = laughLen(textOf(m)); if (n) laughs.push([n, i]); });
  laughs.sort((a, b) => b[0] - a[0]);
  const topLaughs = [], seenDay = new Set();
  for (const [n, i] of laughs) {
    const m = msgs[i], d = dayOf(m.t);
    if (seenDay.has(d)) continue;
    seenDay.add(d);
    topLaughs.push({ len: n, p: P(m), t: textOf(m).slice(0, 80), date: iso(m.t), ctx: ctx(i) });
    if (topLaughs.length >= 4) break;
  }

  // Слова, которые пишет только один. Имена друг друга не считаем.
  const stems = people.map(n => (n.toLowerCase().match(/[а-яё]{3,}/) || [""])[0].slice(0, 3)).filter(Boolean);
  const isName = w => stems.some(st => w.startsWith(st));
  const minW = Math.max(6, Math.round(msgs.length / 7000));
  const uniq = [0, 1].map(p => {
    const q = 1 - p, res = [];
    for (const [w, c] of words[p]) {
      if (c < minW || (words[q].get(w) || 0) > c * 0.06 || STOP.has(w) || isName(w) || /^пид/.test(w)) continue;
      // «думал» против «думала» — это просто род, а не любимое слово.
      const pair = w.endsWith("ла") ? w.slice(0, -1) : w.endsWith("л") ? w + "а" : w.endsWith("ен") ? w.slice(0, -2) + "на" : w.endsWith("на") ? w.slice(0, -2) + "ен" : null;
      if (pair && (words[q].get(pair) || 0) >= c * 0.3) continue;
      res.push([w, c, words[q].get(w) || 0]);
    }
    return res.sort((a, b) => b[1] - a[1]).slice(0, 10);
  });
  // Общее любимое слово.
  let refrain = null;
  for (const [w, a] of words[0]) {
    if (w.length < 4 || STOP.has(w) || REFRAIN_SKIP.has(w) || isName(w) || CATS.swear.test(w)) continue;
    const b = words[1].get(w) || 0, s = Math.min(a, b);
    if (s >= 10 && (!refrain || s > refrain.s)) refrain = { w, a, b, s };
  }

  // Слова года.
  const yw = new Map(), yn = new Map();
  for (const m of msgs) {
    const y = new Date(m.t).getUTCFullYear();
    inc(yn, y);
    if (!yw.has(y)) yw.set(y, new Map());
    const c = yw.get(y);
    for (const w of new Set(textOf(m).toLowerCase().match(/[а-яё]{4,}/g) || [])) inc(c, w);
  }
  const totW = new Map(); yw.forEach(c => c.forEach((n, w) => inc(totW, w, n)));
  const allN = msgs.length;
  const years = [];
  for (const [y, c] of [...yw.entries()].sort((a, b) => a[0] - b[0])) {
    const n = yn.get(y);
    if (n < 300) continue;
    const minC = Math.max(6, n / 1500);
    const sc = [];
    for (const [w, k] of c) {
      if (k < minC || STOP.has(w)) continue;
      const rest = (totW.get(w) - k + 5) / Math.max(1, allN - n);
      sc.push([(k / n) / rest * Math.log(k), w]);
    }
    sc.sort((a, b) => b[0] - a[0]);
    const ym = monthSeries.filter(x => x[0].startsWith(y + "-")).sort((a, b) => (b[1] + b[2]) - (a[1] + a[2]))[0];
    years.push({ y, n, words: yw.size > 1 ? sc.slice(0, 4).map(x => x[1]) : [], topMonth: ym ? ym[0] : null });
  }

  // Календарь первых раз и рекордов.
  const first = (re, extra) => {
    for (const m of msgs) { const t = textOf(m); if (t && re.test(t) && (!extra || extra(m))) return { date: iso(m.t), t: m.t, p: P(m), text: t.slice(0, 160) }; }
    return null;
  };
  const firstVoice = msgs.find(m => m.media === "voice");
  const calendar = [];
  const add = (kind, o) => o && calendar.push({ kind, ...o });
  add("first", { date: iso(msgs[0].t), t: msgs[0].t, p: P(msgs[0]), text: (textOf(msgs[0]) || "").slice(0, 160) });
  add("sorry", first(CATS.sorry));
  add("night", first(CATS.goodNight));
  add("miss", first(MISS));
  add("love", first(LOVE_FIRST));
  add("nick", first(NICK));
  if (firstVoice) add("voice", { date: iso(firstVoice.t), t: firstVoice.t, p: P(firstVoice), dur: firstVoice.dur || 0 });
  if (best >= 14) add("streak", { date: iso((bestEnd - best + 1) * DAY), t: (bestEnd - best + 1) * DAY, days: best, end: iso(bestEnd * DAY) });
  if (angriest && angriest[1] >= 10) {
    const day = angriest[0];
    const by = [0, 0]; for (const m of msgs) if (dayOf(m.t) === day && m.emoji && ANGRY.has(m.emoji)) by[P(m)]++;
    add("angry", { date: iso(day * DAY), t: day * DAY, n: angriest[1], p: by[0] >= by[1] ? 0 : 1 });
  }
  add("record", { date: iso(recDay * DAY), t: recDay * DAY, n: recN });
  calendar.sort((a, b) => a.t - b.t);

  const lenAvg = per.map(r => (r.text ? Math.round(r.len / r.text) : 0));
  return {
    people, names: people.map(n => n.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "").trim() || n), others, total: msgs.length, rawTotal: all.length,
    firstT: msgs[0].t, lastT: msgs[msgs.length - 1].t,
    daysActive: days.size, span: dayOf(msgs[msgs.length - 1].t) - dayOf(msgs[0].t) + 1,
    per, lenAvg, init, lastWord,
    replyMedianSec: resp.map(median),
    firstMorning, firstNight,
    stickerTop: stickerEmoji.map(m => top(m, 5)),
    gender: selfTexts.map(guessGender),
    hours, months: monthSeries, heat, tender,
    laughs: topLaughs, laughTotal: [0, 1].map(p => laughs.filter(([, i]) => P(msgs[i]) === p).length),
    uniq, refrain, years, calendar,
    streak: { days: best, end: iso(bestEnd * DAY) },
    longestGap: longestGap && { days: Math.round(longestGap.ms / DAY), from: iso(longestGap.from), to: iso(longestGap.to) },
    recordDay: { date: iso(recDay * DAY), n: recN },
  };
}

// Отрывки переписки для ИИ: самые напряжённые и самые тёплые дни, признания и последние две недели.
const WARM = rx("люблю|скучаю|соскучил\\p{L}*|обожаю|солнышко|котик|родн(?:ой|ая)|целую|обнимаю|малыш|красавица|ты лучш\\p{L}*|спасибо тебе|благодар\\p{L}*");
const CONFESS = rx("нравишься|люблю тебя|я тебя люблю|влюб\\p{L}*|кто мы друг другу|что между нами|встречаться");

export function buildExcerpts(all, people, names = people, budget = 70000) {
  const msgs = all.filter(m => m.from === people[0] || m.from === people[1]);
  const byDay = new Map();
  msgs.forEach((m, i) => { const d = dayOf(m.t); if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(i); });
  const line = m => {
    const d = new Date(m.t);
    let t = m.text || "";
    if (m.fwd) t = "[переслано] " + t;
    if (m.media === "sticker") t = `[стикер ${m.emoji || ""}] ` + t;
    else if (m.media === "voice" || m.media === "round") t = `[голосовое ${m.dur || 0} с] ` + t;
    else if (m.media) t = `[${m.media}] ` + t;
    return `${d.toISOString().slice(11, 16)} ${names[m.from === people[0] ? 0 : 1]}: ${t.slice(0, 220)}`.trim();
  };
  const score = (re, stick) => {
    const sc = new Map();
    msgs.forEach(m => {
      const d = dayOf(m.t);
      if (re.test(m.fwd ? "" : m.text || "")) inc(sc, d, 2);
      if (m.emoji && stick.has(m.emoji)) inc(sc, d, 1);
    });
    return sc;
  };
  const pickDays = (sc, perYear, max) => {
    const picked = [], py = new Map();
    for (const [d, s] of [...sc.entries()].sort((a, b) => b[1] - a[1])) {
      if (s < 4) break;
      const y = new Date(d * DAY).getUTCFullYear();
      if ((py.get(y) || 0) >= perYear) continue;
      picked.push(d); inc(py, y);
      if (picked.length >= max) break;
    }
    return picked.sort((a, b) => a - b);
  };
  const window_ = (d, re, size) => {
    const idx = byDay.get(d);
    let bestI = 0, bestS = -1;
    for (let k = 0; k < idx.length; k += 5) {
      let s = 0;
      for (let j = Math.max(0, k - size / 2); j < Math.min(idx.length, k + size / 2); j++) if (re.test(msgs[idx[j]].text || "")) s++;
      if (s > bestS) { bestS = s; bestI = k; }
    }
    const from = Math.max(0, bestI - size / 2);
    return idx.slice(from, from + size).map(i => line(msgs[i]));
  };

  const parts = [];
  for (const d of pickDays(score(CATS.hurt, SAD), 2, 8)) parts.push({ title: `Напряжённый день ${iso(d * DAY)}`, lines: window_(d, CATS.hurt, 60) });
  for (const d of pickDays(score(WARM, new Set(["❤️", "🥰", "😍", "💕", "😘"])), 1, 4)) parts.push({ title: `Тёплый день ${iso(d * DAY)}`, lines: window_(d, WARM, 40) });

  const conf = [];
  msgs.forEach((m, i) => { if (!m.fwd && CONFESS.test(m.text || "")) conf.push(i); });
  const confLines = [];
  for (const i of conf.slice(0, 40)) {
    const d = iso(msgs[i].t);
    confLines.push(`— ${d}`);
    for (let j = Math.max(0, i - 3); j <= Math.min(msgs.length - 1, i + 3); j++) confLines.push(line(msgs[j]));
    if (confLines.length > 200) break;
  }
  if (confLines.length) parts.push({ title: "Разговоры о чувствах", lines: confLines });

  const end = msgs[msgs.length - 1].t;
  const recent = msgs.filter(m => m.t > end - 14 * DAY && m.media !== "sticker").slice(-160);
  if (recent.length) parts.push({ title: `Последние две недели (до ${iso(end)})`, lines: recent.map(m => iso(m.t).slice(5) + " " + line(m)) });

  // Общий фон: случайные короткие куски по всей истории.
  const rnd = [];
  const step = Math.max(1, Math.floor(msgs.length / 12));
  for (let i = step; i < msgs.length; i += step) {
    rnd.push(`— ${iso(msgs[i].t)}`);
    for (let j = i; j < Math.min(msgs.length, i + 12); j++) rnd.push(line(msgs[j]));
  }
  parts.push({ title: "Обычные дни из разных лет", lines: rnd });

  // Укладываемся в бюджет символов: режем каждый кусок пропорционально.
  let text = "";
  const total = parts.reduce((s, p) => s + p.lines.join("\n").length, 0);
  const k = Math.min(1, budget / Math.max(1, total));
  let sent = 0;
  for (const p of parts) {
    const keep = Math.max(10, Math.floor(p.lines.length * k));
    const ls = p.lines.slice(0, keep);
    sent += ls.filter(l => !l.startsWith("—")).length;
    text += `\n### ${p.title}\n` + ls.join("\n") + "\n";
  }
  return { text: text.slice(0, budget + 4000), count: sent };
}
