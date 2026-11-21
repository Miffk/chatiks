// Разбор экспорта Telegram Desktop (HTML или JSON) прямо в браузере.
// Каждое сообщение: { t, from, text, media?, emoji?, dur?, fwd? }
// t — «наивное» время в мс: часы и дата как в экспорте, читать через getUTC*.

const MEDIA = {
  media_photo: "photo", media_video: "video", media_voice_message: "voice",
  media_audio_file: "audio", media_file: "file", media_location: "location",
  media_contact: "contact", media_call: "call", media_poll: "poll", media_game: "game",
};
const WRAP = { photo_wrap: "photo", sticker_wrap: "sticker", video_file_wrap: "video", animated_wrap: "gif", media_voice_message: "voice" };

const clean = s => (s || "").replace(/[ \t\r\f\v]+/g, " ").trim();

function htmlOrder(name) {
  const m = /^messages(\d*)\.html$/i.exec(name);
  return m ? (+m[1] || 1) : 0;
}

function parseTitleDate(s) {
  // "08.03.2022 12:34:56 UTC+03:00"
  const m = /^(\d\d)\.(\d\d)\.(\d{4}) (\d\d):(\d\d):(\d\d)/.exec(s || "");
  return m ? Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]) : null;
}

function parseIsoDate(s) {
  // "2022-03-08T12:34:56"
  const m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)/.exec(s || "");
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
}

function parseHtmlDoc(doc, out, sender) {
  for (const m of doc.querySelectorAll("div.message.default")) {
    const body = m.querySelector(":scope > div.body");
    if (!body) continue;
    const fn = body.querySelector(":scope > div.from_name");
    if (fn) sender = clean(fn.textContent);
    const d = body.querySelector(":scope > .date");
    const t = parseTitleDate(d && d.getAttribute("title"));
    if (t == null || !sender) continue;
    const fwd = body.querySelector(":scope > div.forwarded.body");
    const content = fwd || body;
    const tx = content.querySelector(":scope > div.text");
    const rec = { t, from: sender, text: tx ? clean(tx.textContent) : "" };

    const media = content.querySelector(".media");
    if (media) {
      const cls = media.classList;
      let kind = null;
      for (const k in MEDIA) if (cls.contains(k)) { kind = MEDIA[k]; break; }
      if (kind) {
        const title = clean((media.querySelector(".title") || {}).textContent);
        if (kind === "photo" && title === "Sticker") kind = "sticker";
        else if (kind === "video" && /^video message/i.test(title)) kind = "round";
        else if (kind === "photo" && /^animation/i.test(title)) kind = "gif";
        const st = clean((media.querySelector(".status") || {}).textContent);
        if (kind === "sticker" && st) rec.emoji = st.split(",")[0].trim();
        const mm = /(\d+):(\d+)/.exec(st);
        if (mm && ["voice", "round", "video", "audio"].includes(kind)) rec.dur = +mm[1] * 60 + +mm[2];
        rec.media = kind;
      }
    } else {
      for (const k in WRAP) if (content.querySelector(":scope ." + k)) { rec.media = WRAP[k]; break; }
    }
    if (fwd) rec.fwd = true;
    out.push(rec);
  }
  return sender;
}

function jsonText(t) {
  if (typeof t === "string") return t;
  if (Array.isArray(t)) return t.map(x => (typeof x === "string" ? x : (x && x.text) || "")).join("");
  return "";
}

const JSON_MEDIA = { sticker: "sticker", voice_message: "voice", video_message: "round", animation: "gif", video_file: "video", audio_file: "audio" };

function parseJson(j) {
  let list = j && j.messages;
  if (!list && j && j.chats && j.chats.list) {
    throw new Error("Это экспорт всего аккаунта. Нужен экспорт одного чата: откройте чат → ⋮ → «Экспорт истории чата».");
  }
  if (!Array.isArray(list)) throw new Error("В JSON не нашлось сообщений.");
  const out = [];
  for (const m of list) {
    if (m.type !== "message") continue;
    const t = parseIsoDate(m.date);
    const from = clean(m.from || "");
    if (t == null || !from) continue;
    const rec = { t, from, text: clean(jsonText(m.text)) };
    if (m.media_type && JSON_MEDIA[m.media_type]) rec.media = JSON_MEDIA[m.media_type];
    else if (m.photo) rec.media = "photo";
    else if (m.file) rec.media = "file";
    if (rec.media === "sticker" && m.sticker_emoji) rec.emoji = m.sticker_emoji;
    if (m.duration_seconds) rec.dur = +m.duration_seconds;
    if (m.forwarded_from) rec.fwd = true;
    out.push(rec);
  }
  return out;
}

export async function parseFiles(files, onProgress) {
  files = [...files];
  const json = files.find(f => /^result\.json$/i.test(f.name)) || files.find(f => /\.json$/i.test(f.name));
  const html = files.filter(f => htmlOrder(f.name)).sort((a, b) => htmlOrder(a.name) - htmlOrder(b.name));
  let msgs;
  if (html.length) {
    msgs = []; let sender = null;
    const dp = new DOMParser();
    for (let i = 0; i < html.length; i++) {
      const doc = dp.parseFromString(await html[i].text(), "text/html");
      sender = parseHtmlDoc(doc, msgs, sender);
      onProgress && onProgress(i + 1, html.length);
      await new Promise(r => setTimeout(r, 0));
    }
  } else if (json) {
    onProgress && onProgress(0, 1);
    msgs = parseJson(JSON.parse(await json.text()));
    onProgress && onProgress(1, 1);
  } else {
    throw new Error("Не нашлось файлов messages.html или result.json. Выберите папку экспорта Telegram целиком.");
  }
  msgs.sort((a, b) => a.t - b.t);
  return msgs;
}
