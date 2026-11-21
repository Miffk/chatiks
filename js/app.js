import { parseFiles } from "./parse.js";
import { analyze, buildExcerpts } from "./analyze.js";
import { renderReport, renderAI, h, fmt } from "./report.js";
import { buildUserPrompt, validate, askAI } from "./ai.js";
import { CONFIG } from "../config.js";

const $ = id => document.getElementById(id);
const store = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, val) => { try { localStorage.setItem(k, val); } catch (e) {} },
};

let drawAll = () => {};
let state = null;

// ---------- тема ----------
const saved = store.get("chatiks-theme");
if (saved) document.documentElement.dataset.theme = saved;
$("themeBtn").addEventListener("click", () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = dark ? "light" : "dark";
  store.set("chatiks-theme", root.dataset.theme);
  drawAll();
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => drawAll());
let rt;
window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => drawAll(), 120); });

// ---------- загрузка ----------
const drop = $("drop");
$("pickDir").addEventListener("click", () => $("dirInput").click());
$("pickFiles").addEventListener("click", () => $("fileInput").click());
$("dirInput").addEventListener("change", e => handleFiles([...e.target.files]));
$("fileInput").addEventListener("change", e => handleFiles([...e.target.files]));
["dragenter", "dragover"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach(t => drop.addEventListener(t, () => drop.classList.remove("over")));
drop.addEventListener("drop", async e => {
  e.preventDefault();
  const files = await filesFromDrop(e.dataTransfer);
  handleFiles(files);
});

// Папку, брошенную мышкой, приходится обходить вручную.
async function filesFromDrop(dt) {
  const entries = [...dt.items].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
  if (!entries.length) return [...dt.files];
  const out = [];
  const walk = async (entry, depth) => {
    if (entry.isFile) {
      if (/^messages\d*\.html$|\.json$/i.test(entry.name)) out.push(await new Promise((res, rej) => entry.file(res, rej)));
    } else if (entry.isDirectory && depth < 2) {
      const reader = entry.createReader();
      let batch;
      do {
        batch = await new Promise((res, rej) => reader.readEntries(res, rej));
        for (const c of batch) await walk(c, depth + 1);
      } while (batch.length);
    }
  };
  for (const e of entries) await walk(e, 0);
  return out;
}

function setProgress(text, frac) {
  $("progress").classList.add("show");
  $("progressText").textContent = text;
  $("progressBar").style.width = Math.round(frac * 100) + "%";
}

export async function handleFiles(files) {
  $("err").textContent = "";
  if (!files || !files.length) return;
  try {
    setProgress("Читаю переписку…", 0);
    const msgs = await parseFiles(files, (i, n) => setProgress(`Читаю файл ${i} из ${n}…`, n ? i / n : 1));
    if (msgs.length < 50) throw new Error(`Нашлось всего ${msgs.length} сообщений — для разбора маловато.`);
    setProgress(`Считаю ${fmt(msgs.length)} сообщений…`, 1);
    await new Promise(r => setTimeout(r, 30));
    const a = analyze(msgs);
    state = { msgs, a };
    const hasAI = !!CONFIG.workerUrl;
    const root = $("report");
    drawAll = renderReport(root, a, hasAI, rename);
    $("start").hidden = true;
    $("reportWrap").hidden = false;
    document.title = `${a.names[0]} и ${a.names[1]} · Чатики`;
    if (hasAI) renderAIPanel();
    window.scrollTo(0, 0);
    drawAll();
  } catch (e) {
    console.error(e);
    $("progress").classList.remove("show");
    $("err").textContent = e.message || "Не получилось разобрать файлы.";
  }
}

function rename(names) {
  const { a } = state;
  if (names[0] === names[1]) names[1] += " (2)";
  a.names = names;
  drawAll = renderReport($("report"), a, !!CONFIG.workerUrl, rename);
  if (CONFIG.workerUrl) {
    if (state.ai) renderAI($("report"), a, state.ai, state.model);
    else renderAIPanel();
  }
  document.title = `${names[0]} и ${names[1]} · Чатики`;
  drawAll();
}

// ---------- ИИ ----------
function renderAIPanel() {
  const { msgs, a } = state;
  const ex = buildExcerpts(msgs, a.people, a.names);
  state.ex = ex;
  const panel = $("aiPanel");
  const pass = h("input", { class: "field", type: "password", placeholder: "Пароль от владельца сайта", autocomplete: "off", "aria-label": "Пароль" });
  pass.value = store.get("chatiks-pass") || "";
  const btn = h("button", { class: "btn primary", type: "button" }, "Включить ИИ-блоки");
  const status = h("p", { role: "status" });
  panel.replaceChildren(h("div", { class: "ai-panel" },
    h("h2", null, "Блоки с оценками ИИ"),
    h("p", null, "Как устроены ссоры, кто как в них себя ведёт, главный вопрос пары, флаги, таро, сплетни и идеальное свидание."),
    h("p", null, `Для этого около ${fmt(ex.count)} сообщений из ${fmt(a.total)} (самые напряжённые и тёплые дни, разговоры о чувствах, последние две недели) уйдут через сервер сайта в ${CONFIG.providerNote} Остальная переписка останется у вас.`),
    h("div", { class: "ai-row" }, pass, btn),
    status));
  const run = async () => {
    btn.disabled = true;
    status.replaceChildren(h("span", { class: "spin" }), "Нейронка читает отрывки. Обычно это занимает до минуты…");
    try {
      const data = await askAI(pass.value.trim(), buildUserPrompt(a, ex));
      store.set("chatiks-pass", pass.value.trim());
      const ai = validate(data.result, a, ex);
      state.ai = ai; state.model = data.model;
      renderAI($("report"), a, ai, data.model);
      panel.replaceChildren();
    } catch (e) {
      status.textContent = e.message;
      btn.disabled = false;
    }
  };
  btn.addEventListener("click", run);
  pass.addEventListener("keydown", e => { if (e.key === "Enter") run(); });
}

// ---------- кнопки внизу ----------
$("printBtn").addEventListener("click", () => {
  document.querySelectorAll(".win, .tcard").forEach(c => c.classList.add("open"));
  document.querySelectorAll(".gs").forEach(c => c.classList.add("torn"));
  window.print();
});
$("againBtn").addEventListener("click", () => location.reload());

// Для локальной проверки: window.__chatiks.handleFiles(files)
window.__chatiks = { handleFiles, get state() { return state; } };
