// Отрисовка отчёта. Всё через textContent, чтобы текст из переписки не стал разметкой.

const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTHS_NOM = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
const MONTHS_PREP = ["январе", "феврале", "марте", "апреле", "мае", "июне", "июле", "августе", "сентябре", "октябре", "ноябре", "декабре"];
const WEEK = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"];
const WEEK_SHORT = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
const PARTS = ["утро", "день", "вечер", "ночь"];

export const fmt = n => Math.round(n).toLocaleString("ru-RU");
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const NS = "http://www.w3.org/2000/svg";
const pl = (n, a, b, c) => { const m = Math.abs(n) % 100, k = m % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k >= 2 && k <= 4 ? b : c; };
const pct = (a, b) => (a + b ? Math.round((a / (a + b)) * 100) : 0);
export const dateRu = s => { const [y, m, d] = s.split("-").map(Number); return `${d} ${MONTHS_GEN[m - 1]} ${y}`; };
const monthYear = ym => { const [y, m] = ym.split("-").map(Number); return `${MONTHS_NOM[m - 1]} ${y}`; };
const monthLabel = ym => { const [y, m] = ym.split("-").map(Number); return `${MONTHS[m - 1]} ${y}`; };
const hourRu = h => (h === 0 ? "полночь" : h === 12 ? "полдень" : `${h > 12 ? h - 12 : h} ${h < 5 ? "ночи" : h < 12 ? "утра" : h < 17 ? "дня" : "вечера"}`);

export function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  if (props) for (const k in props) {
    if (k === "class") e.className = props[k];
    else if (k === "style") e.style.cssText = props[k];
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), props[k]);
    else e.setAttribute(k, props[k]);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c instanceof Node ? c : String(c));
  return e;
}
function svg(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
const q = text => h("span", { class: "q" }, `«${text}»`);

export function makeCtx(a) {
  const N = a.names;
  const g = a.gender;
  // Глагол прошедшего времени в нужном роде; если род не понятен, «написал(а)».
  const v = (p, m, f, n) => (g[p] === "f" ? f : g[p] === "m" ? m : n != null ? n : `${m}(а)`);
  const who = (p, cls = "") => h("span", { class: `who s${p + 1} ${cls}` }, N[p]);
  return { N, v, who };
}

// Иллюстрации к разделам лежат в img/. Если картинки нет, она просто не показывается.
function art(name) {
  const img = h("img", { class: "sec-art", src: `img/${name}.webp`, alt: "", loading: "lazy" });
  img.addEventListener("error", () => img.remove());
  return img;
}
function section(title, lead, ...kids) {
  let name = null;
  if (typeof title === "object") { name = title.art; title = title.t; }
  const head = h("div", null, h("h2", null, title), lead ? h("p", { class: "lead" }, lead) : null);
  return h("section", null, name ? h("div", { class: "sec-head" }, head, art(name)) : head, ...kids);
}
function gameSection(tag, title, lead, name, ...kids) {
  const head = h("div", null, h("span", { class: "game-tag" }, tag), h("h2", null, title), h("p", { class: "lead" }, lead));
  return h("section", null, h("div", { class: "sec-head" }, head, art(name)), ...kids);
}

// Простые значки вместо эмодзи.
const ICONS = {
  sun: "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
  moon: "M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z",
  heart: "M12 20s-7-4.4-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.6-9 9-9 9z",
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3",
  wave: "M4 15c0-6 3-10 8-10s8 4 8 10M8 15a4 4 0 0 0 8 0M12 19v2",
  eye: "M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
};
function icon(name) {
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("width", "22"); s.setAttribute("height", "22"); s.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(NS, "path");
  p.setAttribute("d", ICONS[name] || ICONS.eye);
  p.setAttribute("fill", "none"); p.setAttribute("stroke", "currentColor"); p.setAttribute("stroke-width", "2"); p.setAttribute("stroke-linecap", "round"); p.setAttribute("stroke-linejoin", "round");
  s.append(p);
  return s;
}
function legend(N, kind = "line") {
  return h("div", { class: "legend" }, N.map((n, i) => h("span", null, h("i", { class: kind === "line" ? "key-line" : "key-rect", style: `background:var(--series-${i + 1})` }), n)));
}
function table(head, rows) {
  const t = h("table");
  t.append(h("tr", null, head.map((x, i) => h("th", i ? { class: "num" } : null, x))));
  rows.forEach(r => t.append(h("tr", null, r.map((c, i) => h("td", i ? { class: "num" } : null, typeof c === "number" ? fmt(c) : c)))));
  return h("details", null, h("summary", null, "Показать таблицей"), t);
}
function tipRows(tip, head, rows) {
  tip.replaceChildren(h("div", { class: "t-head" }, head));
  rows.forEach(([color, value, label]) => tip.append(h("div", { class: "t-row" }, h("span", { class: "key-line", style: `background:${color}` }), h("b", null, value), h("i", null, label))));
}
function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 4, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

// Двухсерийный линейный график с перекрестием и подсказкой.
function lineChart(host, N, xs, series, opts) {
  host.replaceChildren();
  const W = Math.max(320, host.clientWidth || 600), H = opts.height || 260;
  const m = { t: 12, r: 72, b: 28, l: 44 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const max = niceMax(Math.max(1, ...series.flat()));
  const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": opts.label }, host);
  const x = i => m.l + (xs.length === 1 ? iw / 2 : (i * iw) / (xs.length - 1));
  const y = val => m.t + ih - (val / max) * ih;
  for (let k = 0; k <= 4; k++) {
    const val = (max * k) / 4, yy = y(val);
    svg("line", { x1: m.l, x2: m.l + iw, y1: yy, y2: yy, stroke: k ? css("--grid") : css("--axis"), "stroke-width": 1 }, s);
    svg("text", { x: m.l - 8, y: yy + 4, "text-anchor": "end" }, s).textContent = max >= 10000 ? (val / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 1 }) + "K" : val.toLocaleString("ru-RU", { maximumFractionDigits: 1 });
  }
  (typeof opts.ticks === "function" ? opts.ticks(W) : opts.ticks).forEach(i => { svg("text", { x: x(i), y: H - 8, "text-anchor": "middle" }, s).textContent = opts.xLabel(i); });
  const colors = [css("--series-1"), css("--series-2")];
  series.forEach((ser, si) => {
    const d = ser.map((val, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(val).toFixed(1)).join(" ");
    svg("path", { d, fill: "none", stroke: colors[si], "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, s);
  });
  const ends = series.map((ser, si) => ({ si, y: y(ser[ser.length - 1]) }));
  if (Math.abs(ends[0].y - ends[1].y) < 14) { const mid = (ends[0].y + ends[1].y) / 2, up = ends[0].y <= ends[1].y ? 0 : 1; ends[up].y = mid - 8; ends[1 - up].y = mid + 8; }
  ends.forEach(e => {
    const ser = series[e.si];
    svg("circle", { cx: x(ser.length - 1), cy: y(ser[ser.length - 1]), r: 4, fill: colors[e.si], stroke: css("--surface-1"), "stroke-width": 2 }, s);
    const label = N[e.si].length > 9 ? N[e.si].slice(0, 8) + "…" : N[e.si];
    svg("text", { x: x(ser.length - 1) + 10, y: e.y + 4, class: "end-label" }, s).textContent = label;
  });
  const cross = svg("line", { y1: m.t, y2: m.t + ih, stroke: css("--axis"), "stroke-width": 1, opacity: 0 }, s);
  const dots = colors.map(c => svg("circle", { r: 4, fill: c, stroke: css("--surface-1"), "stroke-width": 2, opacity: 0 }, s));
  const tip = h("div", { class: "tip" }); host.appendChild(tip);
  const hit = svg("rect", { x: m.l, y: m.t, width: iw, height: ih, fill: "transparent", tabindex: 0 }, s);
  let cur = xs.length - 1;
  const show = i => {
    cur = i;
    const px = x(i);
    cross.setAttribute("x1", px); cross.setAttribute("x2", px); cross.setAttribute("opacity", 1);
    dots.forEach((d, si) => { d.setAttribute("cx", px); d.setAttribute("cy", y(series[si][i])); d.setAttribute("opacity", 1); });
    tipRows(tip, opts.tipHead(i), series.map((ser, si) => [colors[si], fmt(ser[i]), N[si]]));
    const sc = host.clientWidth / W;
    tip.style.left = Math.min(Math.max(px * sc, 80), host.clientWidth - 80) + "px";
    tip.style.top = Math.min(...series.map(ser => y(ser[i]))) * sc - 10 + "px";
    tip.classList.add("show");
  };
  const hide = () => { cross.setAttribute("opacity", 0); dots.forEach(d => d.setAttribute("opacity", 0)); tip.classList.remove("show"); };
  hit.addEventListener("pointermove", ev => {
    const r = s.getBoundingClientRect(), px = ((ev.clientX - r.left) * W) / r.width;
    show(Math.max(0, Math.min(xs.length - 1, Math.round(((px - m.l) / iw) * (xs.length - 1)))));
  });
  hit.addEventListener("pointerleave", hide);
  hit.addEventListener("focus", () => show(cur));
  hit.addEventListener("blur", hide);
  hit.addEventListener("keydown", ev => {
    if (ev.key === "ArrowRight") { show(Math.min(xs.length - 1, cur + 1)); ev.preventDefault(); }
    if (ev.key === "ArrowLeft") { show(Math.max(0, cur - 1)); ev.preventDefault(); }
  });
}

function hoverTip(box, target, head, rows) {
  const tip = box.querySelector(":scope > .tip");
  const showTip = () => {
    tipRows(tip, head, rows());
    const br = box.getBoundingClientRect(), r = target.getBoundingClientRect();
    tip.style.left = r.left - br.left + r.width / 2 + "px";
    tip.style.top = r.top - br.top - 6 + "px";
    tip.classList.add("show");
  };
  target.addEventListener("pointerenter", showTip); target.addEventListener("focus", showTip);
  target.addEventListener("pointerleave", () => tip.classList.remove("show"));
  target.addEventListener("blur", () => tip.classList.remove("show"));
}

function shareBars(N, rows) {
  const box = h("div", { class: "shares" }, h("div", { class: "tip" }));
  rows.forEach(([name, a, b]) => {
    const tot = a + b;
    const seg = h("div", { class: "seg", role: "img", "aria-label": `${name}: ${N[0]} ${fmt(a)} (${pct(a, b)}%), ${N[1]} ${fmt(b)} (${pct(b, a)}%)` });
    [[a, 0], [b, 1]].forEach(([val, si]) => {
      if (!val) return;
      const p = (val / tot) * 100;
      const d = h("div", { tabindex: 0, style: `flex:${val} 1 0;background:var(--series-${si + 1})` }, Math.round(p) + "%");
      if (p < 9) d.classList.add("narrow");
      hoverTip(box, d, name, () => [[css(`--series-${si + 1}`), fmt(val), `${N[si]} · ${Math.round(p)}%`]]);
      seg.append(d);
    });
    box.append(h("div", { class: "share-row" }, h("div", { class: "name" }, name), seg));
  });
  return box;
}

function heatmap(H) {
  const box = h("div", { class: "heat" }, h("div", { class: "tip" }));
  const flat = H.flat(), lo = Math.min(...flat), hi = Math.max(...flat);
  const col = val => `color-mix(in srgb, var(--series-1) ${Math.round(12 + ((val - lo) / Math.max(0.001, hi - lo)) * 88)}%, var(--surface-1))`;
  box.append(h("span"));
  PARTS.forEach(p => box.append(h("span", { class: "hl" }, p)));
  H.forEach((row, d) => {
    box.append(h("span", { class: "hl" }, WEEK_SHORT[d]));
    row.forEach((val, b) => {
      const c = h("div", { class: "cell", tabindex: 0, style: `background:${col(val)}`, "aria-label": `${WEEK_SHORT[d]}, ${PARTS[b]}: ${val} нежных сообщений на 1000` });
      hoverTip(box, c, `${WEEK_SHORT[d]}, ${PARTS[b]}`, () => [[css("--series-1"), String(val).replace(".", ","), "нежных на 1000 сообщений"]]);
      box.append(c);
    });
  });
  const ramp = h("div", { class: "ramp" }, h("span", null, "меньше"), h("i", { style: `background:linear-gradient(90deg, ${col(lo)}, ${col(hi)})` }), h("span", null, "больше нежности"));
  return [box, ramp];
}

function flipCard(cls, frontText, frontSmall, backKids, open) {
  const b = h("button", { type: "button", class: cls + (open ? " open" : ""), "aria-label": frontSmall },
    h("div", { class: "win-in" },
      h("div", { class: "win-front" }, frontText, h("small", null, frontSmall)),
      h("div", { class: "win-back" }, ...backKids)));
  b.addEventListener("click", () => b.classList.toggle("open"));
  return b;
}

function renameUI(a, onRename) {
  const btn = h("button", { type: "button", class: "linkbtn" }, "изменить имена");
  const wrap = h("span", null, btn);
  btn.addEventListener("click", () => {
    const i0 = h("input", { class: "field", value: a.names[0], "aria-label": "Первое имя", maxlength: 40 });
    const i1 = h("input", { class: "field", value: a.names[1], "aria-label": "Второе имя", maxlength: 40 });
    const ok = h("button", { type: "button", class: "btn primary" }, "Готово");
    const apply = () => onRename([i0.value.trim() || a.names[0], i1.value.trim() || a.names[1]]);
    ok.addEventListener("click", apply);
    [i0, i1].forEach(i => i.addEventListener("keydown", e => { if (e.key === "Enter") apply(); }));
    wrap.replaceWith(h("span", { class: "rename" }, i0, i1, ok));
    i0.focus();
  });
  return wrap;
}

// ---------- Посчитанные блоки ----------

export function renderReport(root, a, hasAI, onRename) {
  const { N, v, who } = makeCtx(a);
  const p = a.per;
  root.replaceChildren();
  const first = new Date(a.firstT).toISOString().slice(0, 7), last = new Date(a.lastT).toISOString().slice(0, 7);
  const redraw = [];

  root.append(h("header", { class: "rep-head" },
    h("h1", null, h("span", { class: "nm s1" }, N[0]), h("span", { class: "amp" }, "и"), h("span", { class: "nm s2" }, N[1])),
    h("p", null, `Разбор переписки в Telegram · ${monthYear(first)} — ${monthYear(last)} · `, renameUI(a, onRename)),
    a.others > a.total * 0.01 ? h("p", { class: "note" }, `В чате есть и другие участники. В разборе только двое самых активных, сообщений остальных: ${fmt(a.others)}.`) : null));

  // Плитки
  const initShare = pct(a.init[0], a.init[1]);
  const lead = initShare >= 50 ? 0 : 1;
  const rm = a.replyMedianSec.filter(x => x != null);
  const replyAll = rm.length ? rm.reduce((s, x) => s + x, 0) / rm.length : null;
  const replyText = replyAll == null ? "—" : replyAll < 90 ? "за секунды" : replyAll < 3600 ? `за ${Math.round(replyAll / 60)} мин` : `за ${Math.round(replyAll / 3600)} ч`;
  const tiles = [
    ["Сообщений", fmt(a.total), "за всё время"],
    ["Дней на связи", fmt(a.daysActive), "из " + fmt(a.span)],
    ["Начинает разговор", `${Math.max(initShare, 100 - initShare)}%`, `раз это ${N[lead]}`],
    ["Ответ приходит", replyText, "в среднем, медиана"],
  ];
  root.append(h("div", { class: "tiles" }, tiles.map(([l, val, s]) => h("div", { class: "tile" }, h("div", { class: "label" }, l), h("div", { class: "value" }, val), h("div", { class: "sub" }, s)))));

  root.append(h("div", { id: "aiPanel" }));

  // Кто привязался сильнее
  const signs = [];
  const fm = a.firstMorning, fn = a.firstNight;
  const close = (x, y) => Math.abs(x - y) <= Math.max(1, Math.max(x, y) * 0.1);
  const dd = n => `${fmt(n)} ${pl(n, "день", "дня", "дней")}`;
  if (fm[0] + fm[1] >= 5) {
    const w = fm[0] >= fm[1] ? 0 : 1;
    signs.push(close(fm[0], fm[1])
      ? ["sun", "Утро начинаете по очереди", `«Доброе утро» первым пишет то один, то другой: ${N[0]} — ${dd(fm[0])}, ${N[1]} — ${dd(fm[1])}.`]
      : ["sun", `Утро чаще начинает ${N[w]}`, `«Доброе утро» ${v(w, "первым", "первой", "первым")} пишет ${N[w]} в ${fmt(fm[w])} ${pl(fm[w], "дне", "днях", "днях")}, ${N[1 - w]} в ${fmt(fm[1 - w])}. Это ${pct(fm[w], fm[1 - w])}% утр.`]);
  }
  if (fn[0] + fn[1] >= 5) {
    const w = fn[0] >= fn[1] ? 0 : 1;
    signs.push(close(fn[0], fn[1])
      ? ["moon", "Спокойной ночи желаете поровну", `${N[0]} — ${dd(fn[0])}, ${N[1]} — ${dd(fn[1])}.`]
      : ["moon", `Спокойной ночи чаще желает ${N[w]}`, `${N[w]} ${v(w, "первым", "первой", "первым")} в ${fmt(fn[w])} ${pl(fn[w], "дне", "днях", "днях")}, ${N[1 - w]} в ${fmt(fn[1 - w])}.`]);
  }
  if (p[0].love + p[1].love >= 5) {
    const w = p[0].love >= p[1].love ? 0 : 1;
    signs.push(close(p[0].love, p[1].love)
      ? ["heart", "Нежности поровну", `«Люблю», «скучаю», «зай» и сердечки: ${N[0]} — ${fmt(p[0].love)}, ${N[1]} — ${fmt(p[1].love)}.`]
      : ["heart", `Нежные слова: ${fmt(p[w].love)} против ${fmt(p[1 - w].love)}`, `«Люблю», «скучаю», «зай» и сердечки чаще пишет ${N[w]}.`]);
  }
  const vm = [Math.round(p[0].voiceSec / 60), Math.round(p[1].voiceSec / 60)];
  if (vm[0] + vm[1] >= 10 && !close(vm[0], vm[1])) { const w = vm[0] >= vm[1] ? 0 : 1; signs.push(["mic", `Голосом больше говорит ${N[w]}`, `${N[w]}: ${fmt(vm[w])} мин голосовых и кружочков, ${N[1 - w]}: ${fmt(vm[1 - w])} мин.`]); }
  signs.push(["wave", `Разговор начинает ${N[lead]}`, `После паузы больше шести часов ${N[lead]} ${v(lead, "писал первым", "писала первой", "начинал(а)")} ${fmt(a.init[lead])} раз, ${N[1 - lead]} — ${fmt(a.init[1 - lead])}.`]);
  const signBox = h("div", { class: "grid2", id: "signs" }, signs.slice(0, 4).map(([ico, t, s]) => h("div", { class: "sign" }, h("div", { class: "ico" }, icon(ico)), h("h3", null, t), h("p", null, s))));
  let score = [0, 0];
  [fm, fn, [p[0].love, p[1].love], a.init].forEach(([x, y]) => { if (x + y) score[x >= y ? 0 : 1]++; });
  const w = score[0] >= score[1] ? 0 : 1;
  const verdictText = score[0] === score[1] ? "По цифрам внимание у вас распределено примерно поровну." : `По цифрам внимания больше проявляет ${N[w]}: в ${Math.max(...score)} признаках из 4.`;
  root.append(section({ t: "Кто привязался сильнее", art: "attach" }, hasAI ? "Признаки по цифрам. Самый интересный признак ищет нейронка." : "Признаки по цифрам переписки.", signBox,
    h("div", { class: "verdict", id: "attVerdict" }, h("div", { class: "tag" }, "Вывод"), h("p", null, verdictText))));

  // Месяцы
  if (a.months.length >= 2) {
    const peak = a.months.reduce((b, m) => (m[1] + m[2] > b[1] + b[2] ? m : b));
    const last3 = a.months.slice(-3), avg = last3.reduce((s, m) => s + m[1] + m[2], 0) / last3.length;
    let leadText = `Пик был в ${MONTHS_PREP[+peak[0].slice(5) - 1]} ${peak[0].slice(0, 4)}-го: ${fmt(peak[1] + peak[2])} сообщений на двоих. В последние три месяца — в среднем ${fmt(avg)} в месяц.`;
    if (a.longestGap && a.longestGap.days >= 3) leadText += ` Самая долгая пауза — ${a.longestGap.days} ${pl(a.longestGap.days, "день", "дня", "дней")}, с ${dateRu(a.longestGap.from)} по ${dateRu(a.longestGap.to)}.`;
    const chart = h("div", { class: "chart" });
    const xs = a.months.map(m => m[0]);
    const yearsN = new Set(xs.map(k => k.slice(0, 4))).size;
    const ticks = yearsN >= 2 ? xs.map((k, i) => (k.endsWith("-01") ? i : -1)).filter(i => i >= 0) : xs.map((_, i) => i).filter(i => i % Math.ceil(xs.length / 6) === 0);
    redraw.push(() => lineChart(chart, N, xs, [a.months.map(m => m[1]), a.months.map(m => m[2])], {
      label: "Сообщений в месяц", height: 280, ticks,
      xLabel: i => (yearsN >= 2 ? xs[i].slice(0, 4) : monthLabel(xs[i])), tipHead: i => monthLabel(xs[i]),
    }));
    root.append(section("Общение месяц за месяцем", leadText, h("div", { class: "card" }, legend(N), chart, table(["Месяц", N[0], N[1]], a.months.map(m => [monthLabel(m[0]), m[1], m[2]])))));
  }

  // Календарь
  const cal = calendarItems(a, N, v).slice(0, 9);
  if (cal.length >= 3) {
    root.append(section({ t: "Календарь вашей истории", art: "calendar" }, "Первые слова, рекорды и важные дни. Нажмите на окошко, чтобы открыть его.",
      h("div", { class: "advent" }, cal.map(([d, t, s], i) => flipCard("win", String(i + 1), "открыть", [h("div", { class: "d" }, d), h("div", { class: "h" }, t), h("p", null, s)], i === 0)))));
  }

  // Кто вкладывает больше
  const rows = [
    ["Начинает разговор", a.init[0], a.init[1]],
    ["Первым «доброе утро»", fm[0], fm[1]],
    ["Первым «спокойной ночи»", fn[0], fn[1]],
    ["Нежные слова", p[0].love, p[1].love],
    ["Извинения", p[0].sorry, p[1].sorry],
    ["Благодарности", p[0].thanks, p[1].thanks],
    ["Забота: «как ты», «поел?»", p[0].care, p[1].care],
    ["Голосовые, минуты", vm[0], vm[1]],
    ["Все сообщения", p[0].msgs, p[1].msgs],
  ].filter(r => r[1] + r[2] > 0);
  const lean = rows.filter(r => r[0] !== "Все сообщения").map(r => (r[1] > r[2] * 1.3 ? 0 : r[2] > r[1] * 1.3 ? 1 : -1));
  const moreA = lean.filter(x => x === 0).length, moreB = lean.filter(x => x === 1).length;
  const shareLead = moreA === moreB ? "Доля каждого в разных видах внимания. По большинству пунктов у вас примерно поровну." : `Доля каждого в разных видах внимания. ${N[moreA > moreB ? 0 : 1]} впереди в ${Math.max(moreA, moreB)} пунктах из ${lean.length}.`;
  root.append(section("Кто вкладывает больше", shareLead, h("div", { class: "card" }, legend(N, "rect"), shareBars(N, rows), table(["Показатель", N[0], N[1]], rows))));

  // Нежный час
  if (a.tender && a.tender.n >= 5) {
    const t = a.tender;
    const flat = a.heat.flatMap((row, d) => row.map((val, b) => [val, d, b])).sort((x, y) => y[0] - x[0])[0];
    const byText = t.by[0] + t.by[1] ? ` Из них ${N[0]}: ${t.by[0]}, ${N[1]}: ${t.by[1]}.` : "";
    const partText = ["утром", "днём", "вечером", "ночью"][flat[2]];
    const [box, ramp] = heatmap(a.heat);
    root.append(section({ art: "tender", t: `Самый нежный час: ${WEEK[t.weekday]}, ${hourRu(t.hour)}` },
      `В это время нежных слов и сердечек больше всего: ${String(t.per1000).replace(".", ",")} на тысячу сообщений.${byText} По частям суток нежнее всего ${partText}, ${["в понедельник", "во вторник", "в среду", "в четверг", "в пятницу", "в субботу", "в воскресенье"][flat[1]]}.`,
      h("div", { class: "card" }, box, ramp)));
  }

  // Часы
  const peakH = a.hours.map(hs => hs.indexOf(Math.max(...hs)));
  const tot = a.hours[0].map((x, i) => x + a.hours[1][i]);
  const quiet = tot.indexOf(Math.min(...tot));
  const hoursChart = h("div", { class: "chart" });
  redraw.push(() => lineChart(hoursChart, N, [...Array(24).keys()], a.hours, {
    label: "Сообщений по часам суток", height: 220, ticks: W => (W < 520 ? [0, 6, 12, 18, 23] : [0, 4, 8, 12, 16, 20, 23]), xLabel: i => i + ":00", tipHead: i => `${i}:00–${i}:59`,
  }));
  root.append(section("Когда вы на связи",
    (peakH[0] === peakH[1] ? `Ритм у вас совпадает: больше всего вы оба пишете около ${peakH[0]}:00.` : `Больше всего ${N[0]} пишет около ${peakH[0]}:00, ${N[1]} — около ${peakH[1]}:00.`) + ` Тише всего в чате в ${quiet}:00.`,
    h("div", { class: "card" }, legend(N), hoursChart, table(["Час", N[0], N[1]], a.hours[0].map((x, i) => [i + ":00", x, a.hours[1][i]])))));

  // Места для блоков ИИ про ссоры и главный вопрос
  root.append(h("div", { id: "aiConflicts" }));

  // Смех
  if (a.laughs.length) {
    const L0 = a.laughs[0];
    const lt = a.laughTotal;
    const lw = lt[0] >= lt[1] ? 0 : 1;
    const ratio = lt[1 - lw] ? (lt[lw] / lt[1 - lw]).toFixed(1).replace(".", ",") : null;
    root.append(section({ art: "laugh", t: `Самое длинное «АХАХАХ»: ${L0.len} ${pl(L0.len, "буква", "буквы", "букв")}` },
      `Моменты, когда вы смеялись громче всего. Громкость — это длина смеха в буквах. Вообще ${N[lw]} смеётся ${ratio && lt[lw] > lt[1 - lw] * 1.2 ? `в ${ratio} раза чаще` : "примерно так же часто"}: ${fmt(lt[lw])} раз против ${fmt(lt[1 - lw])}.`,
      h("div", { class: "laughs" }, a.laughs.map((l, i) => h("div", { class: "laugh" },
        h("div", { class: "laugh-head" }, h("b", null, `${i + 1} место · ${l.len} ${pl(l.len, "буква", "буквы", "букв")}`), h("span", null, dateRu(l.date))),
        l.ctx.map(c => h("div", { class: `bub s${c.p + 1}` }, c.t)),
        h("div", { class: `bub s${l.p + 1} big` }, l.t))))));
  }

  // Слова только для двоих
  if (a.uniq[0].length + a.uniq[1].length >= 4) {
    const col = i => h("div", { class: "sign" }, h("h3", null, h("span", { class: `who s${i + 1}` }, `Пишет только ${N[i]}`)),
      h("div", { class: "words" }, a.uniq[i].slice(0, 8).map(([w, c]) => h("span", null, w, h("small", null, fmt(c))))));
    const kids = [h("div", { class: "grid2" }, col(0), col(1))];
    if (a.refrain) kids.push(h("div", { class: "verdict" }, h("div", { class: "tag" }, "Общее любимое слово"), h("p", null, `«${a.refrain.w}» любите вы оба: ${N[0]} — ${fmt(a.refrain.a)} раз, ${N[1]} — ${fmt(a.refrain.b)}.`)));
    root.append(section({ t: "Слова только для двоих", art: "words" }, "Слова, которые пишет почти только один из вас. Число — сколько раз.", ...kids));
  }

  // Годы
  const yrs = a.years.filter(y => y.words.length);
  if (yrs.length >= 2) {
    root.append(section("Итоги по годам", "Слова, которыми каждый год отличался от остальных.",
      h("div", { class: "years" }, yrs.map(y => h("div", { class: "year" },
        h("div", { class: "y" }, y.y), h("div", { class: "w" }, y.words.map(w => `«${w}»`).join(", ")),
        h("div", { class: "s" }, `${fmt(y.n)} сообщ.${y.topMonth ? " · пик в " + MONTHS_PREP[+y.topMonth.slice(5) - 1] : ""}`))))));
  }

  root.append(h("div", { id: "aiGames" }));

  root.append(section("Что учитывать", null, h("ul", { class: "limits" },
    h("li", null, "Метрики считаются по спискам слов, поэтому цифры примерные."),
    h("li", null, "Голосовые, кружочки и фото не расшифровываются: учитывается только их количество и длина."),
    h("li", { id: "aiLimit" }, "Блоки с оценками ИИ не включены."),
    h("li", null, "Это взгляд со стороны, а не диагноз отношений.")),
    h("p", { class: "note", style: "margin-top:24px" }, "Переписка разбиралась в вашем браузере. Отчёт нигде не сохраняется: закроете вкладку — он исчезнет.")));

  const drawAll = () => redraw.forEach(f => f());
  return drawAll;
}

function calendarItems(a, N, v) {
  const out = [];
  for (const c of a.calendar) {
    const d = dateRu(c.date);
    const nm = c.p != null ? N[c.p] : "";
    const said = c.text ? `${nm}: «${c.text.length > 110 ? c.text.slice(0, 110) + "…" : c.text}»` : "";
    switch (c.kind) {
      case "first": out.push([d, "Первое сообщение", said || `${nm} ${v(c.p, "написал первым", "написала первой", "написал(а) первым")}.`]); break;
      case "sorry": out.push([d, "Первое «извини»", said]); break;
      case "night": out.push([d, "Первое «спокойной ночи»", said]); break;
      case "miss": out.push([d, "Первое «скучаю»", said]); break;
      case "love": { const t = new Date(c.t); out.push([`${d}, ${t.getUTCHours()}:${String(t.getUTCMinutes()).padStart(2, "0")}`, "Первое «люблю тебя»", said]); break; }
      case "nick": out.push([d, "Первое ласковое прозвище", said]); break;
      case "voice": out.push([d, "Первое голосовое", `${nm}, ${c.dur} ${pl(c.dur, "секунда", "секунды", "секунд")}.`]); break;
      case "streak": out.push([d, "Начало рекордной серии", `${fmt(c.days)} ${pl(c.days, "день", "дня", "дней")} подряд без единого дня молчания, до ${dateRu(c.end)}.`]); break;
      case "angry": out.push([d, "Самый злой день", `${fmt(c.n)} злых стикеров за день, чаще всего их ${v(c.p, "отправлял", "отправляла")} ${nm}.`]); break;
      case "record": out.push([d, "Рекорд", `${fmt(c.n)} ${pl(c.n, "сообщение", "сообщения", "сообщений")} за один день.`]); break;
    }
  }
  // Если окошек слишком много, сначала убираем менее интересные.
  while (out.length > 9) {
    const i = out.findIndex(x => x[1] === "Первое голосовое" || x[1] === "Первое «скучаю»");
    out.splice(i >= 0 ? i : out.length - 1, 1);
  }
  return out;
}

// ---------- Блоки ИИ ----------

function quoteLine(qt, N) {
  if (!qt) return null;
  return h("span", null, q(qt.text), qt.who || qt.date ? ` (${[qt.who, qt.date && /^\d{4}-\d\d-\d\d$/.test(qt.date) ? dateRu(qt.date) : ""].filter(Boolean).join(", ")})` : "");
}

export function renderAI(root, a, ai, model) {
  const { N } = makeCtx(a);
  const p = a.per;

  // Привязанность: сюрприз и вывод
  const at = ai.attachment;
  if (at && at.surprise && at.surprise.title) {
    const signs = root.querySelector("#signs");
    const card = h("div", { class: "sign surprise" }, h("div", { class: "ico" }, icon("eye")), h("h3", null, at.surprise.title),
      h("p", null, at.surprise.text, at.surprise.quote ? " " : "", quoteLine(at.surprise.quote, N)));
    if (signs.children.length >= 4) signs.lastElementChild.replaceWith(card); else signs.append(card);
  }
  if (at && at.verdict) root.querySelector("#attVerdict").replaceChildren(h("div", { class: "tag" }, "Вывод ИИ"), h("p", null, at.verdict));

  // Ссоры
  const cbox = root.querySelector("#aiConflicts");
  cbox.replaceChildren();
  if (ai.conflict_steps.length) {
    cbox.append(section({ t: "Как устроены ссоры", art: "fights" }, "Типичная схема конфликта по прочитанным отрывкам.",
      h("div", { class: "card" }, h("ol", { class: "steps" }, ai.conflict_steps.map(s => h("li", null, h("div", null, h("h3", null, s.title), h("p", null, s.text))))))));
  }
  if (ai.fight_roles.length) {
    cbox.append(section("Кто как ведёт себя в ссоре", "Это оценка ИИ, поэтому рядом с выводами стоят цитаты, на которых они держатся. Цитаты сверены с перепиской.",
      h("div", { class: "card" }, ai.fight_roles.map((r, i) => h("div", { class: "fight" },
        h("div", { class: "fight-head" }, h("h3", null, r.q), r.answer ? h("span", { class: "chip" }, r.answer) : null),
        i === 0 && p[0].sorry + p[1].sorry ? h("div", { class: "seg", role: "img", "aria-label": `Извинения: ${N[0]} ${p[0].sorry}, ${N[1]} ${p[1].sorry}` },
          h("div", { style: `flex:${p[0].sorry} 1 0;background:var(--series-1)` }), h("div", { style: `flex:${p[1].sorry} 1 0;background:var(--series-2)` })) : null,
        h("p", null, r.text, ...r.quotes.flatMap(qt => [" ", quoteLine(qt, N)])))))));
  }
  if (ai.main_question) {
    const mq = ai.main_question;
    cbox.append(section("Главный вопрос", null, h("h3", { class: "mq" }, mq.title), h("p", { class: "lead" }, mq.text),
      mq.quote ? h("blockquote", null, `«${mq.quote.text}»`, h("footer", null, [mq.quote.who, /^\d{4}-\d\d-\d\d$/.test(mq.quote.date) ? dateRu(mq.quote.date) : ""].filter(Boolean).join(", "))) : null));
  }

  // Флаги и игры
  const gbox = root.querySelector("#aiGames");
  gbox.replaceChildren();
  if (ai.flags.green.length || ai.flags.red.length) {
    gbox.append(section("Флаги", null, h("div", { class: "flags" },
      h("div", { class: "flag-col good" }, h("h3", null, h("i", { class: "dot" }), "Green flags"), h("ul", null, ai.flags.green.map(x => h("li", null, x)))),
      h("div", { class: "flag-col bad" }, h("h3", null, h("i", { class: "dot" }), "Red flags"), h("ul", null, ai.flags.red.map(x => h("li", null, x)))))));
  }
  if (ai.tarot.length) {
    gbox.append(gameSection("Игра, а не анализ", "Три карты таро", "Карты подобраны по мотивам переписки, но это развлечение. Нажмите на карту, чтобы перевернуть её.", "tarot",
      h("div", { class: "tarot" }, ai.tarot.map(t => flipCard("tcard", "✦", t.pos || "Карта", [h("div", { class: "d" }, t.pos), h("div", { class: "h" }, t.card), h("p", null, t.text)], false)))));
  }
  if (ai.gossip.length) {
    gbox.append(gameSection("Игра по мотивам чата", "Про вас ходят сплетни", "Сплетни сочинила нейронка по вашей переписке. Нажмите на полоску, чтобы сорвать её.", "gossip",
      h("div", { class: "gossip" }, ai.gossip.map((g, i) => {
        const el = h("div", { class: "gs" }, h("span", { class: "n" }, i + 1), h("p", null, g));
        el.append(h("button", { type: "button", onclick: () => el.classList.add("torn") }, "Сорви, чтобы узнать"));
        return el;
      }))));
  }
  if (ai.date) {
    const d = ai.date;
    const rows = [["Где", d.where], ["До", d.before], ["После", d.after], ["Финал", d.finale], ["Дресс-код", d.dress]].filter(r => r[1]);
    gbox.append(gameSection("Игра по мотивам чата", "Идеальное свидание", "Свидание, собранное из ваших же сообщений.", "date",
      h("div", { class: "ticket" }, h("div", { class: "ticket-top" }, h("div", { class: "k" }, "Билет на свидание"), h("div", { class: "t" }, "Один вечер на двоих")),
        rows.map(([k, val]) => h("div", { class: "ticket-row" }, h("div", { class: "k" }, k), h("div", null, val))))));
  }

  const lim = root.querySelector("#aiLimit");
  if (lim) lim.textContent = `Для блоков ИИ нейронка${model ? " (" + model + ")" : ""} прочитала только отрывки: самые напряжённые и тёплые дни, разговоры о чувствах и последние две недели. Цитаты, которых нет в переписке, отброшены.`;
}
