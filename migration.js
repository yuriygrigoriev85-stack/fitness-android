"use strict";

function csvRecords(text) {
  const records = [];
  let row = [], field = "", quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[i + 1] === '"') { field += '"'; i++; }
      else quoted = false;
    } else if (char === '"' && !field) quoted = true;
    else if (char === ";") { row.push(field); field = ""; }
    else if (char === "\r" || char === "\n") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some(Boolean)) records.push(row);
      row = []; field = "";
    } else field += char;
  }
  if (quoted) throw new Error("Незакрытая кавычка в CSV");
  row.push(field);
  if (row.some(Boolean)) records.push(row);
  return records;
}

function validDate(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const time = Date.parse(date + "T00:00:00Z");
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date;
}

function readHistoryCsv(text) {
  const [header, ...rows] = csvRecords(text);
  const expected = ["Дата", "Код", "Упражнение", ...Array.from({length: 8}, (_, i) => "Подход " + (i + 1))];
  if (JSON.stringify(header) !== JSON.stringify(expected) || !rows.length) {
    throw new Error("Ожидается CSV дневника с датой, кодом и восемью колонками подходов");
  }
  const workouts = Object.create(null), catalog = new Map();
  for (const [index, row] of rows.entries()) {
    const [shortDate, code, name, ...sets] = row;
    const match = /^(\d{2})\.(\d{2})\.(\d{2}|\d{4})$/.exec(shortDate);
    const date = match && [(match[3].length === 2 ? "20" : "") + match[3], match[2], match[1]].join("-");
    if (!validDate(date) || !code || row.length < 3 || sets.length > 8) {
      throw new Error("Некорректная строка CSV №" + (index + 2));
    }
    const id = "csv:" + date;
    workouts[id] ??= {date, entries: [], source: "csv-date"};
    workouts[id].entries.push({code, name, sets});
    if (name) catalog.set(code, {code, name});
  }
  return {schemaVersion: 1, workouts, codes: [...catalog.values()]};
}

function readHistoryJson(text) {
  const data = JSON.parse(text.replace(/^\uFEFF/, ""));
  if (!data || (data.schemaVersion != null && data.schemaVersion !== 1) ||
      !data.workouts || typeof data.workouts !== "object" || Array.isArray(data.workouts) ||
      !Array.isArray(data.codes)) throw new Error("Неподдерживаемый формат JSON дневника");
  for (const [id, w] of Object.entries(data.workouts)) {
    if (!id || Object.hasOwn(Object.prototype, id) || !w || !validDate(w.date) ||
        !Array.isArray(w.entries) || !w.entries.every(e => e && typeof e.code === "string" &&
          e.code && Array.isArray(e.sets) && e.sets.length <= 8 && e.sets.every(s => typeof s === "string"))) {
      throw new Error("Некорректная запись в JSON");
    }
  }
  if (!data.codes.every(c => c && typeof c.code === "string" && c.code && typeof c.name === "string")) {
    throw new Error("Некорректный справочник кодов в JSON");
  }
  return data;
}

function mergeHistory(localWorkouts, localCodes, data) {
  const workouts = {...localWorkouts};
  const catalog = new Map(localCodes.map(code => [code.code, code]));
  let added = 0, conflicts = 0, newCodes = 0;
  for (const [id, incoming] of Object.entries(data.workouts)) {
    const old = Object.hasOwn(workouts, id) ? workouts[id] : null;
    if (!old) { workouts[id] = incoming; added++; continue; }
    if (JSON.stringify(old) === JSON.stringify(incoming)) continue;
    const previousTime = Date.parse(old.updatedAt);
    const incomingTime = Date.parse(incoming.updatedAt);
    if (Number.isFinite(previousTime) && incomingTime > previousTime) {
      workouts[id] = incoming; added++;
    } else conflicts++;
  }
  for (const code of data.codes) {
    if (!catalog.has(code.code)) { catalog.set(code.code, code); newCodes++; }
  }
  return {workouts, codes: [...catalog.values()], added, conflicts, newCodes};
}
