const storageKey = "moodDiaryEntries";
const themeStorageKey = "moodDiaryTheme";

let entries = loadEntries();
let visibleEntries = [...entries];

const entryForm = document.querySelector("#entry-form");
const dateInput = document.querySelector("#date");
const noteInput = document.querySelector("#note");
const noteCount = document.querySelector("#note-count");
const message = document.querySelector("#message");
const startDateInput = document.querySelector("#start-date");
const endDateInput = document.querySelector("#end-date");
const searchDateInput = document.querySelector("#search-date");
const showPeriodButton = document.querySelector("#show-period");
const resetPeriodButton = document.querySelector("#reset-period");
const clearDataButton = document.querySelector("#clear-data");
const history = document.querySelector("#history");
const historyCount = document.querySelector("#history-count");
const chartPeriod = document.querySelector("#chart-period");
const chartRangeSelect = document.querySelector("#chart-range");
const chart = document.querySelector("#mood-chart");
const chartSummary = document.querySelector("#chart-summary");
const todayScore = document.querySelector("#today-score");
const todayNote = document.querySelector("#today-note");
const avgMood = document.querySelector("#avg-mood");
const bestMood = document.querySelector("#best-mood");
const worstMood = document.querySelector("#worst-mood");
const entryCount = document.querySelector("#entry-count");
const themeToggle = document.querySelector("#theme-toggle");
const clearModal = document.querySelector("#clear-modal");
const cancelClearButton = document.querySelector("#cancel-clear");
const confirmClearButton = document.querySelector("#confirm-clear");

let lastFocusedElement = null;

applyTheme(getInitialTheme());
dateInput.value = getToday();
render();

entryForm.addEventListener("submit", event => {
  event.preventDefault();

  const moodInput = document.querySelector("input[name='mood']:checked");
  const entry = {
    date: dateInput.value,
    mood: Number(moodInput?.value),
    note: noteInput.value.trim()
  };

  const error = validateEntry(entry);

  if (error) {
    setMessage(error, true);
    return;
  }

  const previousEntries = [...entries];

  addEntry(entry);
  if (!saveEntries()) {
    entries = previousEntries;
    setMessage("Не удалось сохранить данные", true);
    return;
  }

  visibleEntries = getFilteredEntries();
  entryForm.reset();
  dateInput.value = getToday();
  noteCount.textContent = "0/200";
  setMessage("Запись сохранена", false);
  render();
});

noteInput.addEventListener("input", () => {
  if (noteInput.value.length > 200) {
    noteInput.value = noteInput.value.slice(0, 200);
  }

  noteCount.textContent = `${noteInput.value.length}/200`;
});

showPeriodButton.addEventListener("click", () => {
  const error = validatePeriod();

  if (error) {
    setMessage(error, true);
    return;
  }

  visibleEntries = getFilteredEntries();
  setMessage("Период обновлен", false);
  render();
});

resetPeriodButton.addEventListener("click", () => {
  startDateInput.value = "";
  endDateInput.value = "";
  searchDateInput.value = "";
  visibleEntries = [...entries];
  setMessage("Показаны все записи", false);
  render();
});

clearDataButton.addEventListener("click", () => {
  if (!entries.length) return;

  openClearModal();
});

cancelClearButton.addEventListener("click", closeClearModal);

confirmClearButton.addEventListener("click", () => {
  closeClearModal();
  clearEntries();
});

clearModal.addEventListener("click", event => {
  if (event.target === clearModal) closeClearModal();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !clearModal.hidden) closeClearModal();
});

themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(themeStorageKey, nextTheme);
  } catch {}

  applyTheme(nextTheme);
  drawChart();
});

chartRangeSelect.addEventListener("change", () => {
  drawChart();
  renderPeriodLabel();
});

function openClearModal() {
  lastFocusedElement = document.activeElement;
  clearModal.hidden = false;
  confirmClearButton.focus();
}

function closeClearModal() {
  clearModal.hidden = true;
  lastFocusedElement?.focus();
}

function clearEntries() {
  const previousEntries = [...entries];

  entries = [];
  visibleEntries = [];
  if (!saveEntries()) {
    entries = previousEntries;
    visibleEntries = [...entries];
    setMessage("Не удалось очистить данные", true);
    return;
  }

  setMessage("Данные очищены", false);
  render();
}

function getInitialTheme() {
  let saved = "";

  try {
    saved = localStorage.getItem(themeStorageKey);
  } catch {}

  if (saved === "light" || saved === "dark") return saved;

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  const isDark = theme === "dark";

  document.documentElement.dataset.theme = theme;
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeToggle.setAttribute("aria-label", isDark ? "Включить светлую тему" : "Включить темную тему");
}

function loadEntries() {
  try {
    // localstorage может содержать старый или вручную испорченный json
    const saved = JSON.parse(localStorage.getItem(storageKey)) || [];
    const cleaned = saved
      .filter(item => item && item.date && Number.isInteger(Number(item.mood)) && typeof item.note === "string")
      .map(item => ({ date: item.date, mood: Number(item.mood), note: item.note }))
      .filter(item => validateEntry(item) === "")
      .sort((a, b) => a.date.localeCompare(b.date));

    try {
      localStorage.setItem(storageKey, JSON.stringify(cleaned));
    } catch {}

    return cleaned;
  } catch {
    return [];
  }
}

function saveEntries() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

function addEntry(entry) {
  // одна дата хранит одну итоговую запись за день
  const existing = entries.findIndex(item => item.date === entry.date);

  if (existing >= 0) {
    entries[existing] = entry;
  } else {
    entries.push(entry);
  }

  entries.sort((a, b) => a.date.localeCompare(b.date));
}

function validateEntry(entry) {
  if (!entry.date) return "Укажите дату";
  if (!isValidDate(entry.date)) return "Дата должна быть в формате yyyy-mm-dd";
  if (!Number.isInteger(entry.mood) || entry.mood < 1 || entry.mood > 5) return "Выберите настроение от 1 до 5";
  if (entry.note.length > 200) return "Заметка должна быть до 200 символов";
  return "";
}

function validatePeriod() {
  const start = startDateInput.value;
  const end = endDateInput.value;
  const search = searchDateInput.value;

  if (start && !isValidDate(start)) return "Дата начала должна быть в формате yyyy-mm-dd";
  if (end && !isValidDate(end)) return "Дата конца должна быть в формате yyyy-mm-dd";
  if (search && !isValidDate(search)) return "Дата поиска должна быть в формате yyyy-mm-dd";
  if (start && end && start > end) return "Дата начала не может быть позже даты конца";
  return "";
}

function getFilteredEntries() {
  const start = startDateInput.value;
  const end = endDateInput.value;
  const search = searchDateInput.value;

  // точная дата и период применяются к одной и той же выборке
  return entries.filter(entry => {
    if (search && entry.date !== search) return false;
    if (start && entry.date < start) return false;
    if (end && entry.date > end) return false;
    return true;
  });
}

function getStats(list) {
  if (!list.length) return { average: "-", best: "-", worst: "-", count: 0 };

  // статистика считается по тем записям, которые сейчас видит пользователь
  const moods = list.map(entry => entry.mood);
  const sum = moods.reduce((total, mood) => total + mood, 0);

  return {
    average: (sum / moods.length).toFixed(1),
    best: Math.max(...moods),
    worst: Math.min(...moods),
    count: list.length
  };
}

function render() {
  visibleEntries.sort((a, b) => a.date.localeCompare(b.date));
  renderToday();
  renderStats();
  renderHistory();
  drawChart();
  renderPeriodLabel();
}

function renderToday() {
  const today = entries.find(entry => entry.date === getToday());
  todayScore.textContent = today ? today.mood : "-";
  todayNote.textContent = today ? today.note || "Без заметки" : "Записи пока нет";
}

function renderStats() {
  const stats = getStats(visibleEntries);
  avgMood.textContent = stats.average;
  bestMood.textContent = stats.best;
  worstMood.textContent = stats.worst;
  entryCount.textContent = stats.count;
}

function renderHistory() {
  const list = [...visibleEntries].sort((a, b) => b.date.localeCompare(a.date));
  historyCount.textContent = `${list.length} ${getPlural(list.length, "запись", "записи", "записей")}`;

  if (!list.length) {
    history.innerHTML = `<div class="empty">Записей нет</div>`;
    return;
  }

  history.innerHTML = list.map(entry => `
    <article class="entry">
      <div class="entry-top">
        <time datetime="${entry.date}">${formatDate(entry.date)}</time>
        <span class="badge mood-${entry.mood}">${entry.mood}/5</span>
      </div>
      <p>${escapeHtml(entry.note || "Без заметки")}</p>
    </article>
  `).join("");
}

function drawChart() {
  const list = [...visibleEntries].sort((a, b) => a.date.localeCompare(b.date));
  const chartList = getChartEntries(list);
  chartSummary.textContent = list.length
    ? `График: ${getChartRangeText(list.length).toLowerCase()}: ${chartList.map(entry => `${formatDate(entry.date)} - ${entry.mood} из 5`).join("; ")}.`
    : "График пока без данных.";

  drawChartFrame(chartList, getChartColors());
}

function getChartEntries(list) {
  // длинная история не должна превращать график в набор точек
  if (chartRangeSelect.value === "all") return list;

  return list.slice(-Number(chartRangeSelect.value));
}

function getChartRangeText(total) {
  if (!total) return "Все записи";
  if (chartRangeSelect.value === "all") return "Все выбранные записи";

  const limit = Number(chartRangeSelect.value);
  return total > limit ? `Последние ${limit} из ${total}` : "Все выбранные записи";
}

function drawChartFrame(list, theme) {
  const ctx = chart.getContext("2d");

  if (!ctx) return;

  const width = chart.width;
  const height = chart.height;
  const padding = 44;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 1;
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillStyle = theme.text;

  for (let mood = 1; mood <= 5; mood += 1) {
    const y = height - padding - ((mood - 1) / 4) * (height - padding * 2);
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
    ctx.fillText(String(mood), 16, y + 5);
  }

  if (!list.length) {
    ctx.fillStyle = theme.muted;
    ctx.textAlign = "center";
    ctx.fillText("Нет данных для графика", width / 2, height / 2);
    ctx.textAlign = "left";
    return;
  }

  const points = list.map((entry, index) => {
    const x = list.length === 1 ? width / 2 : padding + (index / (list.length - 1)) * (width - padding * 2);
    const y = height - padding - ((entry.mood - 1) / 4) * (height - padding * 2);
    return { x, y, entry };
  });

  ctx.strokeStyle = theme.line;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));

  ctx.stroke();

  points.forEach(point => {
    ctx.fillStyle = getMoodColor(point.entry.mood);
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = theme.label;
    ctx.textAlign = "center";
    ctx.fillText(point.entry.mood, point.x, point.y - 14);
  });

  ctx.fillStyle = theme.muted;
  ctx.textAlign = "center";
  points.forEach((point, index) => {
    if (list.length <= 8 || index % Math.ceil(list.length / 8) === 0) {
      ctx.fillText(point.entry.date.slice(5), point.x, height - 16);
    }
  });
  ctx.textAlign = "left";
}

function getMoodColor(mood) {
  return {
    1: "#b84a4a",
    2: "#c8783c",
    3: "#b99a31",
    4: "#5f8b64",
    5: "#34785a"
  }[mood] || "#d99b6c";
}

function getChartColors() {
  return {
    background: getCssVar("--chart-bg"),
    grid: getCssVar("--chart-grid"),
    text: getCssVar("--muted"),
    line: getCssVar("--chart-line"),
    label: getCssVar("--ink"),
    muted: getCssVar("--muted")
  };
}

function getCssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function renderPeriodLabel() {
  const start = startDateInput.value;
  const end = endDateInput.value;
  const search = searchDateInput.value;
  const range = getChartRangeText(visibleEntries.length);
  let period = "Все записи";

  if (search) {
    period = `Дата ${formatDate(search)}`;
  } else if (start || end) {
    period = `${start ? formatDate(start) : "Начало"} - ${end ? formatDate(end) : "Сегодня"}`;
  }

  chartPeriod.textContent = range === "Все выбранные записи" ? period : `${period} · ${range.toLowerCase()}`;
}

function setMessage(text, isError) {
  message.setAttribute("role", isError ? "alert" : "status");
  message.setAttribute("aria-live", isError ? "assertive" : "polite");
  message.textContent = text;
  message.style.color = isError ? "var(--danger)" : "var(--accent-dark)";
}

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function formatDate(date) {
  return date.split("-").reverse().join(".");
}

function getPlural(number, one, few, many) {
  const mod10 = number % 10;
  const mod100 = number % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function escapeHtml(text) {
  // заметка выводится как текст, а не как html-разметка
  return text.replace(/[&<>"]/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;"
  })[char]);
}
