// Cloudflare Worker: хранит ключ нейронки и пускает только по общему паролю.
//
// Переменные (Settings → Variables and Secrets):
//   API_KEY          секрет: ключ OpenRouter (или другого OpenAI-совместимого сервиса)
//   ACCESS_PASSWORD  секрет: пароль, который вы дадите друзьям
//   ALLOWED_ORIGIN   адрес сайта, например https://miffk.github.io (можно несколько через запятую)
//   MODEL            необязательно. Одна или несколько моделей через запятую:
//                    OpenRouter пробует их по очереди. По умолчанию — DEFAULT_MODELS ниже.
//   API_URL          необязательно, по умолчанию https://openrouter.ai/api/v1/chat/completions

const MAX_BODY = 400_000; // символов в запросе
const ATTEMPTS = 3;            // сколько моделей пробовать за один запрос
const CALL_TIMEOUT = 120_000;  // мс на одну модель
const TOTAL_BUDGET = 170_000;  // мс на весь запрос: дольше пользователь ждать не станет
// Бесплатные модели, которые хорошо пишут по-русски и умеют режим JSON.
const DEFAULT_MODELS = "nvidia/nemotron-3.5-super-vl:free,google/gemma-4-31b-it:free,baidu/ernie-5.5-flash-preview:free,inclusionai/ling-3.2-flash:free";

// Достаём JSON из ответа модели и чиним типичные поломки:
// обёртку ```json, текст вокруг, запятые перед скобкой, оборванный конец.
export function extractJson(s) {
  if (!s) return null;
  s = s.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```(?:json)?/gi, "");
  const a = s.indexOf("{");
  if (a < 0) return null;
  const b = s.lastIndexOf("}");
  const tries = [];
  if (b > a) tries.push(s.slice(a, b + 1));
  tries.push(closeJson(s.slice(a)));
  for (const t of tries) {
    for (const fix of [x => x, x => x.replace(/,\s*([}\]])/g, "$1")]) {
      try {
        const v = JSON.parse(fix(t));
        if (v && typeof v === "object") return v;
      } catch (e) {}
    }
  }
  return null;
}

// Закрывает оборванный JSON: отрезает недописанный хвост и добавляет нужные скобки.
export function closeJson(t) {
  const stack = [];
  let inStr = false, esc = false, lastSafe = 0;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') { inStr = false; lastSafe = i + 1; }
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") stack.push(c);
    else if (c === "}" || c === "]") { stack.pop(); lastSafe = i + 1; if (!stack.length) return t.slice(0, i + 1); }
    else if (c === ",") lastSafe = i;
  }
  // Обрываем на последнем целом значении и закрываем открытые скобки.
  let head = t.slice(0, lastSafe).replace(/[,:]\s*$/, "").replace(/,\s*"[^"]*"\s*$/, "").replace(/\{\s*"[^"]*"\s*$/, "{");
  const st = [];
  inStr = false; esc = false;
  for (const c of head) {
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") st.push(c);
    else if (c === "}" || c === "]") st.pop();
  }
  if (inStr) head += '"';
  while (st.length) head += st.pop() === "{" ? "}" : "]";
  return head;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGIN || "").split(",").map(s => s.trim().replace(/\/$/, "")).filter(Boolean);
    const cors = {
      "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : (allowed[0] || "*"),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };
    const reply = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return reply({ error: "Нужен POST-запрос." }, 405);
    if (allowed.length && !allowed.includes(origin)) return reply({ error: "Этот сайт не может пользоваться сервером." }, 403);
    if (!env.API_KEY || !env.ACCESS_PASSWORD) return reply({ error: "Сервер не настроен: нет API_KEY или ACCESS_PASSWORD." }, 500);

    const raw = await request.text();
    if (raw.length > MAX_BODY) return reply({ error: "Слишком большой запрос." }, 413);
    let body;
    try { body = JSON.parse(raw); } catch (e) { return reply({ error: "Запрос не похож на JSON." }, 400); }
    if (body.password !== env.ACCESS_PASSWORD) return reply({ error: "Неверный пароль." }, 401);
    if (typeof body.system !== "string" || typeof body.user !== "string") return reply({ error: "В запросе нет текста." }, 400);

    const url = env.API_URL || "https://openrouter.ai/api/v1/chat/completions";
    // Сайт может попросить конкретную модель, но только бесплатную.
    const asked = typeof body.model === "string" && /^[\w.\/-]+:free$|^openrouter\/free$/.test(body.model) ? body.model : null;
    const models = (asked || env.MODEL || DEFAULT_MODELS).split(",").map(s => s.trim()).filter(Boolean);
    const where = request.cf ? ` [Cloudflare ${request.cf.colo || "?"}, ${request.cf.country || "?"}]` : "";

    // Ждём промис не дольше ms; по истечении — ошибка с текстом msg.
    const within = (promise, ms, msg) => new Promise((ok, fail) => {
      const t = setTimeout(() => fail(Object.assign(new Error(msg), { status: 504, timeout: true })), Math.max(1, ms));
      promise.then(v => { clearTimeout(t); ok(v); }, e => { clearTimeout(t); fail(e); });
    });
    const deadline = Date.now() + TOTAL_BUDGET;

    // Один запрос к одной модели в потоковом режиме. Время ограничено целиком.
    // Если время вышло, а модель не дописала, возвращаем то, что успело прийти: extractJson его починит.
    const call = async (model, messages) => {
      const left = deadline - Date.now();
      if (left < 5000) throw Object.assign(new Error("Время на ответ вышло."), { status: 504, timeout: true });
      const until = Date.now() + Math.min(CALL_TIMEOUT, left);
      const ctl = new AbortController();
      const payload = { model, messages, stream: true, temperature: 0.5, max_tokens: 6000, response_format: { type: "json_object" }, reasoning: { effort: "low" } };
      let r;
      try {
        r = await within(fetch(url, {
          signal: ctl.signal,
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": allowed[0] || "https://github.com",
            "X-Title": "chatiks",
          },
          body: JSON.stringify(payload),
        }), until - Date.now(), `${model} не начала отвечать вовремя`);
      } catch (e) {
        ctl.abort();
        throw Object.assign(new Error(e.timeout ? e.message : `${model}: сеть — ${e.message}`), { status: 504 });
      }
      const fail = (code, e) => {
        e = e || {};
        const meta = e.metadata || {};
        let msg = (typeof e === "string" ? e : e.message) || `ошибка ${code}`;
        if (meta.provider_name) msg += `; провайдер ${meta.provider_name}`;
        if (meta.raw) msg += `; ${String(typeof meta.raw === "string" ? meta.raw : JSON.stringify(meta.raw)).slice(0, 160)}`;
        return Object.assign(new Error(`${model} (${code}): ${msg}`), { status: code === 429 ? 429 : 502, code });
      };
      if (!r.ok) {
        let data = {};
        try { data = JSON.parse(await within(r.text(), 10000, "")); } catch (e) {}
        ctl.abort();
        throw fail(r.status, data.error);
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "", content = "", reasoning = "", finish = "", got = model, partial = false;
      outer: while (true) {
        let chunk;
        try {
          chunk = await within(reader.read(), until - Date.now(), "timeout");
        } catch (e) {
          partial = true;
          break;
        }
        if (chunk.done) break;
        buf += dec.decode(chunk.value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith("data:")) continue; // комментарии вида ": OPENROUTER PROCESSING"
          const d = line.slice(5).trim();
          if (d === "[DONE]") break outer;
          let obj;
          try { obj = JSON.parse(d); } catch (e) { continue; }
          if (obj.error) { ctl.abort(); throw fail(obj.error.code || 502, obj.error); }
          if (obj.model) got = obj.model;
          const ch = (obj.choices && obj.choices[0]) || {};
          const delta = ch.delta || {};
          if (typeof delta.content === "string") content += delta.content;
          if (typeof delta.reasoning === "string") reasoning += delta.reasoning;
          if (ch.finish_reason) finish = ch.finish_reason;
        }
      }
      ctl.abort();
      return { text: content.trim() ? content : reasoning, model: got, finish: partial ? "время вышло" : finish, partial };
    };

    const messages = [{ role: "system", content: body.system }, { role: "user", content: body.user }];
    // Пробуем модели по очереди: если одна перегружена (429), отказала или ответила не JSON,
    // сразу берём следующую. Список прокручиваем по кругу, пока не кончатся попытки или время.
    const problems = [];
    for (let i = 0; i < Math.max(ATTEMPTS, models.length) && Date.now() < deadline - 5000; i++) {
      const model = models[i % models.length];
      try {
        const out = await call(model, messages);
        const result = extractJson(out.text);
        if (result && Object.keys(result).length) return reply({ result, model: out.model, partial: out.partial || undefined });
        problems.push(`${out.model}: ответ не JSON${out.finish ? " (" + out.finish + ")" : ""}, начало «${out.text.replace(/\s+/g, " ").slice(0, 60)}»`);
      } catch (e) {
        problems.push(e.message);
        if (e.code === 401 || e.code === 402) break; // ключ не работает или нет кредитов — дальше пробовать бессмысленно
      }
    }
    const all429 = problems.length && problems.every(p => /\(429\)/.test(p));
    const head = all429
      ? "Бесплатные нейронки сейчас перегружены или дневной лимит исчерпан. Попробуйте через несколько минут."
      : "Не получилось получить ответ от нейронки. Попробуйте ещё раз через минуту.";
    return reply({ error: `${head} Подробности: ${problems.join(" | ").slice(0, 700)}${where}` }, all429 ? 429 : 502);
  },
};
