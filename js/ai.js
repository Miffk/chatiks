// Запрос к нейронке через Cloudflare Worker и проверка ответа.
import { CONFIG } from "../config.js";

export const SYSTEM = `Ты пишешь игровой, но честный разбор переписки двух людей — для них самих. Тебе дают имена, посчитанные цифры и отрывки переписки.

Правила:
- Пиши по-русски, просто и тепло, короткими предложениями. Без психологических терминов и диагнозов.
- Опирайся только на отрывки и цифры. Ничего не выдумывай. Если для вывода нет оснований, так и напиши.
- Цитаты копируй из отрывков дословно, символ в символ, не длиннее 120 символов. Поле date — дата отрывка в формате ГГГГ-ММ-ДД.
- Имена пиши ровно так, как они даны. Род каждого определяй по тому, как человек пишет о себе («я пришла» / «я пришёл»).
- Никаких процентов совместимости и «вероятностей влюбиться».
- Не пересказывай адреса, телефоны, интимные подробности и чужие секреты.
- Ответь ТОЛЬКО одним JSON-объектом по схеме ниже. Без пояснений, без markdown.

Схема:
{
  "attachment": {
    "who": "имя того, кто сильнее привязан, или \\"поровну\\"",
    "verdict": "2–3 предложения: кто как проявляет привязанность",
    "surprise": { "title": "неочевидный признак привязанности второго человека, до 60 символов", "text": "1–2 предложения", "quote": {"who": "имя", "text": "цитата", "date": "ГГГГ-ММ-ДД"} }
  },
  "conflict_steps": [ {"title": "шаг типичной ссоры, до 60 символов", "text": "1–2 предложения"} ],
  "fight_roles": [
    {"q": "Кто первым мирится", "answer": "имя | Оба | Никто", "text": "1–2 предложения", "quotes": [{"who": "", "text": "", "date": ""}]},
    {"q": "Кто вспоминает прошлое", "answer": "", "text": "", "quotes": []},
    {"q": "Кто переходит на личности", "answer": "", "text": "", "quotes": []},
    {"q": "Кто обесценивает", "answer": "", "text": "", "quotes": []}
  ],
  "main_question": {"title": "главный невысказанный или открытый вопрос этой пары, до 70 символов", "text": "2–3 предложения", "quote": {"who": "", "text": "", "date": ""}},
  "flags": {"green": ["4 пункта"], "red": ["4 пункта, бережно"]},
  "tarot": [
    {"pos": "Прошлое", "card": "название карты таро", "text": "2 предложения по мотивам переписки"},
    {"pos": "Настоящее", "card": "", "text": ""},
    {"pos": "Будущее", "card": "", "text": ""}
  ],
  "gossip": ["4 смешные, но правдивые «сплетни» по переписке, каждая начинается со слова «Говорят,»"],
  "date": {"where": "", "before": "", "after": "", "finale": "", "dress": ""}
}
conflict_steps — ровно 3 шага. Если ссор в отрывках почти нет, так и напиши в шагах. main_question может быть null, если такого вопроса нет. date — идеальное свидание, собранное из того, что эти двое обсуждали, хотели или любят.`;

export function buildUserPrompt(a, ex) {
  const [A, Bn] = a.names;
  const p = a.per;
  const d = t => new Date(t).toISOString().slice(0, 10);
  const stick = i => a.stickerTop[i].map(([e, n]) => `${e} ${n}`).join(", ") || "нет";
  const lines = [
    `Имена: ${A} и ${Bn}.`,
    `Переписка с ${d(a.firstT)} по ${d(a.lastT)}, всего ${a.total} сообщений, ${a.daysActive} дней на связи.`,
    `Сообщений: ${A} ${p[0].msgs}, ${Bn} ${p[1].msgs}.`,
    `Начинает разговор после паузы больше 6 часов: ${A} ${a.init[0]}, ${Bn} ${a.init[1]}.`,
    `Первым пишет «доброе утро» (дней): ${A} ${a.firstMorning[0]}, ${Bn} ${a.firstMorning[1]}.`,
    `Первым желает спокойной ночи (дней): ${A} ${a.firstNight[0]}, ${Bn} ${a.firstNight[1]}.`,
    `Нежные слова: ${A} ${p[0].love}, ${Bn} ${p[1].love}. Извинения: ${A} ${p[0].sorry}, ${Bn} ${p[1].sorry}. Благодарности: ${A} ${p[0].thanks}, ${Bn} ${p[1].thanks}.`,
    `Слова обиды: ${A} ${p[0].hurt}, ${Bn} ${p[1].hurt}. Смех: ${A} ${a.laughTotal[0]}, ${Bn} ${a.laughTotal[1]}.`,
    `Голосовые и кружочки, минут: ${A} ${Math.round(p[0].voiceSec / 60)}, ${Bn} ${Math.round(p[1].voiceSec / 60)}.`,
    `Любимые стикеры: ${A}: ${stick(0)}; ${Bn}: ${stick(1)}.`,
    "",
    "Отрывки переписки (время, имя, текст):",
    ex.text,
  ];
  return lines.join("\n");
}

const norm = s => (s || "").toLowerCase().replace(/ё/g, "е").replace(/[«»"„“”'`]/g, "").replace(/\s+/g, " ").trim();

// Оставляем только цитаты, которые действительно есть в отрывках.
export function validate(res, a, ex) {
  const hay = norm(ex.text);
  const names = new Set(a.names);
  const okQuote = q => q && typeof q.text === "string" && q.text.trim().length >= 3 && hay.includes(norm(q.text).replace(/[.…]+$/, ""));
  const str = (s, n = 400) => (typeof s === "string" ? s.trim().slice(0, n) : "");
  const quote = q => (okQuote(q) ? { who: names.has(q.who) ? q.who : "", text: str(q.text, 160), date: str(q.date, 10) } : null);
  const out = {};
  const at = res.attachment || {};
  out.attachment = {
    who: str(at.who, 60), verdict: str(at.verdict, 600),
    surprise: at.surprise ? { title: str(at.surprise.title, 90), text: str(at.surprise.text, 400), quote: quote(at.surprise.quote) } : null,
  };
  out.conflict_steps = (Array.isArray(res.conflict_steps) ? res.conflict_steps : []).slice(0, 3).map(s => ({ title: str(s.title, 90), text: str(s.text, 400) })).filter(s => s.title);
  out.fight_roles = (Array.isArray(res.fight_roles) ? res.fight_roles : []).slice(0, 4).map(r => ({
    q: str(r.q, 60), answer: str(r.answer, 40), text: str(r.text, 400),
    quotes: (Array.isArray(r.quotes) ? r.quotes : []).map(quote).filter(Boolean).slice(0, 2),
  })).filter(r => r.q);
  const mq = res.main_question;
  out.main_question = mq && mq.title ? { title: str(mq.title, 100), text: str(mq.text, 600), quote: quote(mq.quote) } : null;
  const fl = res.flags || {};
  out.flags = { green: (fl.green || []).map(x => str(x, 220)).filter(Boolean).slice(0, 5), red: (fl.red || []).map(x => str(x, 220)).filter(Boolean).slice(0, 5) };
  out.tarot = (Array.isArray(res.tarot) ? res.tarot : []).slice(0, 3).map(t => ({ pos: str(t.pos, 20), card: str(t.card, 60), text: str(t.text, 400) })).filter(t => t.card);
  out.gossip = (Array.isArray(res.gossip) ? res.gossip : []).map(x => str(x, 300)).filter(Boolean).slice(0, 4);
  const dt = res.date || {};
  out.date = ["where", "before", "after", "finale", "dress"].every(k => !dt[k]) ? null : Object.fromEntries(["where", "before", "after", "finale", "dress"].map(k => [k, str(dt[k], 300)]));
  return out;
}

export async function askAI(password, user) {
  if (!CONFIG.workerUrl) throw new Error("Сервер для нейронки ещё не подключён: в config.js не указан адрес Worker.");
  let r;
  try {
    r = await fetch(CONFIG.workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, system: SYSTEM, user }),
    });
  } catch (e) {
    throw new Error("Не получилось достучаться до сервера. Проверьте интернет и попробуйте ещё раз.");
  }
  let data = {};
  try { data = await r.json(); } catch (e) {}
  if (r.status === 401) throw new Error("Неверный пароль.");
  if (!r.ok) throw new Error(data.error || `Сервер ответил ошибкой ${r.status}.`);
  if (!data.result) throw new Error("Нейронка вернула пустой ответ. Попробуйте ещё раз.");
  return data;
}
