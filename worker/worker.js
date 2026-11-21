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
const ATTEMPTS = 2;       // сколько раз пробовать, если модель отказала или ответила не JSON
const CALL_TIMEOUT = 100_000; // мс на одну попытку
// Бесплатные модели, которые хорошо пишут по-русски и умеют режим JSON.
const DEFAULT_MODELS = "google/gemma-4-31b-it:free,google/gemma-4-26b-a4b-it:free,inclusionai/ling-3.2-flash:free";

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

    const call = async messages => {
      const payload = { messages, temperature: 0.5, max_tokens: 8000, response_format: { type: "json_object" }, reasoning: { effort: "low" } };
      if (models.length > 1) payload.models = models; else payload.model = models[0];
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), CALL_TIMEOUT);
      let r;
      try {
        r = await fetch(url, {
        signal: ctl.signal,
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": allowed[0] || "https://github.com",
          "X-Title": "chatiks",
        },
        body: JSON.stringify(payload),
        });
      } catch (e) {
        clearTimeout(timer);
        const err = new Error(`Нейронка не ответила за ${CALL_TIMEOUT / 1000} секунд.`);
        err.status = 504; err.retry = true;
        throw err;
      }
      const data = await r.json().catch(() => ({}));
      clearTimeout(timer);
      if (!r.ok) {
        const e = data.error || {};
        const meta = e.metadata || {};
        let msg = (typeof e === "string" ? e : e.message) || `ошибка ${r.status}`;
        if (meta.provider_name) msg += `; провайдер ${meta.provider_name}`;
        if (meta.raw) msg += `; ${String(typeof meta.raw === "string" ? meta.raw : JSON.stringify(meta.raw)).slice(0, 200)}`;
        const err = new Error(r.status === 429 ? "Лимит бесплатной нейронки на сегодня исчерпан или она перегружена. Попробуйте позже." : `Нейронка ответила (${r.status}): ${msg}`);
        err.status = r.status === 429 ? 429 : 502;
        err.retry = [403, 404, 408, 500, 502, 503].includes(r.status);
        throw err;
      }
      const ch = (data.choices && data.choices[0]) || {};
      const m = ch.message || {};
      const text = (typeof m.content === "string" && m.content.trim()) ? m.content : (typeof m.reasoning === "string" ? m.reasoning : "");
      return { text, model: data.model || models[0], finish: ch.finish_reason || ch.native_finish_reason || "" };
    };

    const messages = [{ role: "system", content: body.system }, { role: "user", content: body.user }];
    // openrouter/free каждый раз выбирает случайную бесплатную модель:
    // если одна отказала или ответила не JSON, следующая попытка обычно попадает на другую.
    let lastErr = null, lastBad = null;
    for (let i = 0; i < ATTEMPTS; i++) {
      try {
        const out = await call(messages);
        const result = extractJson(out.text);
        if (result) return reply({ result, model: out.model });
        lastBad = out;
      } catch (e) {
        lastErr = e;
        if (!e.retry) break;
      }
    }
    if (lastErr && !lastBad) return reply({ error: (lastErr.message || "Ошибка нейронки.") + where }, lastErr.status || 502);
    const why = lastBad
      ? ` Последняя модель: ${lastBad.model}${lastBad.finish ? ", окончание: " + lastBad.finish : ""}, ответ начинался с «${lastBad.text.replace(/\s+/g, " ").slice(0, 80)}».`
      : "";
    return reply({ error: `Нейронка ${ATTEMPTS} раза ответила не по формату. Попробуйте ещё раз через минуту.${why}${where}` }, 502);
  },
};
