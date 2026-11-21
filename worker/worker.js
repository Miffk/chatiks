// Cloudflare Worker: хранит ключ нейронки и пускает только по общему паролю.
//
// Переменные (Settings → Variables and Secrets):
//   API_KEY          секрет: ключ OpenRouter (или другого OpenAI-совместимого сервиса)
//   ACCESS_PASSWORD  секрет: пароль, который вы дадите друзьям
//   ALLOWED_ORIGIN   адрес сайта, например https://miffk.github.io (можно несколько через запятую)
//   MODEL            необязательно, по умолчанию openrouter/free
//   API_URL          необязательно, по умолчанию https://openrouter.ai/api/v1/chat/completions

const MAX_BODY = 400_000; // символов в запросе

function extractJson(s) {
  if (!s) return null;
  s = s.replace(/<think>[\s\S]*?<\/think>/g, "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
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
    const model = env.MODEL || "openrouter/free";
    const call = async messages => {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": allowed[0] || "https://github.com",
          "X-Title": "chatiks",
        },
        body: JSON.stringify({ model, messages, temperature: 0.6, max_tokens: 6000 }),
      });
      const data = await r.json().catch(() => ({}));
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
      const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      return { text: typeof text === "string" ? text : "", model: data.model || model };
    };

    const messages = [{ role: "system", content: body.system }, { role: "user", content: body.user }];
    const where = request.cf ? ` [Cloudflare ${request.cf.colo || "?"}, ${request.cf.country || "?"}]` : "";
    // openrouter/free каждый раз выбирает случайную бесплатную модель:
    // если одна отказала, следующая попытка обычно попадает на другую.
    const callRetry = async msgs => {
      let last;
      for (let i = 0; i < 3; i++) {
        try { return await call(msgs); } catch (e) { last = e; if (!e.retry) break; }
      }
      throw last;
    };
    try {
      let out = await callRetry(messages);
      let result = extractJson(out.text);
      if (!result) {
        // Одна повторная попытка, если модель ответила не JSON.
        out = await callRetry([...messages, { role: "assistant", content: out.text.slice(0, 4000) }, { role: "user", content: "Ответ должен быть одним JSON-объектом по схеме, без текста вокруг. Пришли только JSON." }]);
        result = extractJson(out.text);
      }
      if (!result) return reply({ error: "Нейронка ответила не по формату. Попробуйте ещё раз." }, 502);
      return reply({ result, model: out.model });
    } catch (e) {
      return reply({ error: (e.message || "Ошибка нейронки.") + where }, e.status || 502);
    }
  },
};
