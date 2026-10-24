'use strict';

const MAX_ITEMS = 60;
const MAX_PRINTS = 120;
const MAX_STEPS = 500;
const MAX_TEXT = 2000;

const defaults = {
  for: { mode: 'number', start: '1', stop: '5', step: '1', text: 'Python' },
  while: { mode: 'number', initial: '1', operator: '<=', compare: '5', change: 'add', amount: '1', text: 'Python' },
  nested: { outerMode: 'number', outerStart: '1', outerStop: '3', outerStep: '1', outerText: 'AB', innerMode: 'string', innerStart: '1', innerStop: '3', innerStep: '1', innerText: 'AB' }
};
const configs = structuredClone(defaults);
const els = Object.fromEntries(['settings-fields','code','visual','output','step-description','status','status-text','workspace','play','pause','step','reset','speed'].map(id => [id, document.getElementById(id)]));
let tab = 'for';
let machine = null;
let iterator = null;
let playing = false;
let timer = null;
let stepNumber = 0;
let currentLine = -1;
let currentMessage = 'Pilih input, lalu jalankan simulasi.';
let status = 'ready';
let validation = { errors: {}, sources: {} };

function pyString(value) {
  return JSON.stringify(value).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
function shown(value, isString = false) {
  return isString ? pyString(value) : String(value);
}
function cardValue(value) {
  if (value === ' ') return '␠';
  if (value === '\n') return '↵';
  if (value === '\t') return '⇥';
  if (value === '\r') return '⏎';
  return String(value);
}
function safeNumber(raw) {
  const text = String(raw).trim();
  return /^-?\d+$/.test(text) && Number.isSafeInteger(Number(text)) && Math.abs(Number(text)) <= 1000000 ? Number(text) : null;
}
function codeNumber(raw) {
  const n = safeNumber(raw);
  return n === null ? '?' : String(n);
}
function rangeCode(start, stop, step) {
  const a = codeNumber(start), b = codeNumber(stop), c = codeNumber(step);
  return `range(${a}, ${b}${c === '1' ? '' : `, ${c}`})`;
}
function field(key, label, type = 'number', options = null, wide = false) {
  let control;
  if (type === 'select') control = `<select id="field-${key}" data-key="${key}">${options.map(([value, text]) => `<option value="${value}">${text}</option>`).join('')}</select>`;
  else if (type === 'textarea') control = `<textarea id="field-${key}" data-key="${key}" maxlength="${MAX_TEXT}" rows="2"></textarea>`;
  else control = `<input id="field-${key}" data-key="${key}" type="number" step="1" inputmode="numeric">`;
  return `<div class="field${wide ? ' wide' : ''}"><label for="field-${key}">${label}</label>${control}<p class="error" data-error="${key}" aria-live="polite"></p></div>`;
}
function sourceFields(prefix, mode, heading) {
  const key = prefix ? `${prefix}Mode` : 'mode';
  const start = prefix ? `${prefix}Start` : 'start';
  const stop = prefix ? `${prefix}Stop` : 'stop';
  const step = prefix ? `${prefix}Step` : 'step';
  const text = prefix ? `${prefix}Text` : 'text';
  const label = prefix === 'outer' ? 'outer' : prefix === 'inner' ? 'inner' : '';
  return `<div class="setting-group">${heading ? `<p class="group-title ${label}">${heading}</p>` : ''}<div class="settings-grid two">${field(key, 'Sumber', 'select', [['number','Angka: range()'],['string','String: karakter']])}</div>${mode === 'number' ? `<div class="settings-grid">${field(start, 'Start')}${field(stop, 'Stop')}${field(step, 'Step')}</div>` : `<div class="settings-grid">${field(text, 'Teks', 'textarea', null, true)}</div>`}</div>`;
}
function renderSettings() {
  const c = configs[tab];
  els['settings-fields'].className = tab === 'nested' ? 'nested-settings' : '';
  if (tab === 'for') els['settings-fields'].innerHTML = sourceFields('', c.mode, '');
  if (tab === 'while') els['settings-fields'].innerHTML = `<div class="settings-grid two">${field('mode','Mode','select',[['number','Kondisi angka'],['string','Penelusuran string']])}</div>${c.mode === 'number' ? `<div class="settings-grid two">${field('initial','Nilai awal i')}${field('operator','Kondisi','select',[['<','<'],['<=','<='],['>','>'],['>=','>=']])}${field('compare','Nilai pembanding')}${field('change','Operasi','select',[['add','Tambah (+)'],['subtract','Kurang (−)']])}${field('amount','Besar perubahan')}</div>` : `<div class="settings-grid">${field('text','Teks','textarea',null,true)}</div>`}`;
  if (tab === 'nested') els['settings-fields'].innerHTML = sourceFields('outer', c.outerMode, 'Loop luar · i') + sourceFields('inner', c.innerMode, 'Loop dalam · j');
  els['settings-fields'].querySelectorAll('[data-key]').forEach(input => { input.value = c[input.dataset.key]; });
}
function validateInteger(raw, key, errors, positive = false, nonzero = false) {
  const n = safeNumber(raw);
  if (n === null) errors[key] = 'Masukkan bilangan bulat antara −1.000.000 dan 1.000.000.';
  else if (positive && n <= 0) errors[key] = 'Harus bilangan bulat positif.';
  else if (nonzero && n === 0) errors[key] = 'Step tidak boleh nol.';
  return n;
}
function makeSource(c, prefix, errors) {
  const mode = c[prefix ? `${prefix}Mode` : 'mode'];
  if (mode === 'string') {
    const key = prefix ? `${prefix}Text` : 'text';
    const text = c[key];
    if (Array.from(text).length > MAX_TEXT) errors[key] = `Maksimal ${MAX_TEXT} karakter.`;
    const chars = Array.from(text);
    return { kind: 'string', values: chars.slice(0, MAX_ITEMS), truncated: chars.length > MAX_ITEMS, text };
  }
  const key = name => prefix ? `${prefix}${name[0].toUpperCase()}${name.slice(1)}` : name;
  const start = validateInteger(c[key('start')], key('start'), errors);
  const stop = validateInteger(c[key('stop')], key('stop'), errors);
  const step = validateInteger(c[key('step')], key('step'), errors, false, true);
  const values = [];
  let truncated = false;
  if (start !== null && stop !== null && step !== null && step !== 0) {
    for (let n = start; step > 0 ? n < stop : n > stop; n += step) {
      if (values.length === MAX_ITEMS) { truncated = true; break; }
      values.push(n);
    }
  }
  return { kind: 'number', values, truncated, start, stop, step };
}
function validate() {
  const errors = {}, sources = {}, c = configs[tab];
  if (tab === 'for') sources.main = makeSource(c, '', errors);
  if (tab === 'nested') { sources.outer = makeSource(c, 'outer', errors); sources.inner = makeSource(c, 'inner', errors); }
  if (tab === 'while' && c.mode === 'number') {
    validateInteger(c.initial, 'initial', errors);
    validateInteger(c.compare, 'compare', errors);
    validateInteger(c.amount, 'amount', errors, true);
  }
  if (tab === 'while' && c.mode === 'string' && Array.from(c.text).length > MAX_TEXT) errors.text = `Maksimal ${MAX_TEXT} karakter.`;
  return { errors, sources };
}
function renderErrors() {
  els['settings-fields'].querySelectorAll('[data-key]').forEach(input => {
    const error = validation.errors[input.dataset.key] || '';
    input.setAttribute('aria-invalid', error ? 'true' : 'false');
    const message = els['settings-fields'].querySelector(`[data-error="${input.dataset.key}"]`);
    if (message) message.textContent = error;
    input.setAttribute('aria-describedby', error ? `error-${input.dataset.key}` : '');
    if (message) message.id = `error-${input.dataset.key}`;
  });
}
function codeLines() {
  const c = configs[tab];
  if (tab === 'for') return c.mode === 'number' ? [`for i in ${rangeCode(c.start,c.stop,c.step)}:`, '    print(i)'] : [`for karakter in ${pyString(c.text)}:`, '    print(karakter)'];
  if (tab === 'while') return c.mode === 'number' ? [`i = ${codeNumber(c.initial)}`, `while i ${c.operator} ${codeNumber(c.compare)}:`, '    print(i)', `    i ${c.change === 'add' ? '+=' : '-='} ${codeNumber(c.amount)}`] : [`teks = ${pyString(c.text)}`, 'indeks = 0', 'while indeks < len(teks):', '    print(teks[indeks])', '    indeks += 1'];
  const sourceCode = prefix => c[`${prefix}Mode`] === 'string' ? pyString(c[`${prefix}Text`]) : rangeCode(c[`${prefix}Start`],c[`${prefix}Stop`],c[`${prefix}Step`]);
  return [`for i in ${sourceCode('outer')}:`, `    for j in ${sourceCode('inner')}:`, '        print(i, j)'];
}
function renderCode() {
  els.code.replaceChildren();
  codeLines().forEach((line,index) => {
    const row = document.createElement('div'); row.className = `code-line${index === currentLine ? ' active' : ''}`;
    const number = document.createElement('span'); number.className = 'line-number'; number.textContent = index + 1;
    const content = document.createElement('span'); content.textContent = line;
    row.append(number, content); els.code.append(row);
  });
}
function createMachine() {
  return { vars: {}, outputs: [], counters: { iter: 0, outer: 0, inner: 0, prints: 0 }, active: { main: null, outer: null, inner: null }, processed: { main: 0, outer: 0, inner: 0 }, condition: null, history: [] };
}
function outcome(line, message, terminal = null) { return { line, message, terminal }; }
function limitEvent(line) { return outcome(line, 'Batas simulasi tercapai. Perkecil input atau ubah kondisi agar alurnya dapat ditelusuri.', 'limited'); }
function formatValue(value, source) { return shown(value, source.kind === 'string'); }

function* forTrace(m, c, source) {
  const name = c.mode === 'string' ? 'karakter' : 'i';
  for (let index = 0; index < source.values.length; index++) {
    const value = source.values[index];
    m.vars[name] = value; m.active.main = index; m.processed.main = index; m.counters.iter++;
    yield outcome(0, `${name} mengambil ${formatValue(value, source)}. Iterasi ke-${m.counters.iter} dimulai.`);
    if (m.outputs.length >= MAX_PRINTS) { yield limitEvent(1); return; }
    m.outputs.push(String(value)); m.counters.prints++;
    yield outcome(1, `print(${name}) menambahkan ${formatValue(value, source)} ke output.`);
  }
  m.active.main = null; m.processed.main = source.values.length;
  if (source.truncated) yield limitEvent(0);
  else yield outcome(0, source.values.length === 0 ? 'Sumber data kosong. Tidak ada iterasi dan isi loop tidak dijalankan.' : `Sumber data habis. ${source.kind === 'number' ? `Stop ${source.stop} tidak ikut dihasilkan.` : 'Tidak ada karakter lagi.'}`, 'finished');
}
function testCondition(i, operator, compare) {
  if (operator === '<') return i < compare;
  if (operator === '<=') return i <= compare;
  if (operator === '>') return i > compare;
  return i >= compare;
}
function* whileNumberTrace(m, c) {
  const initial = safeNumber(c.initial), compare = safeNumber(c.compare), amount = safeNumber(c.amount);
  const delta = c.change === 'add' ? amount : -amount;
  m.vars.i = initial;
  yield outcome(0, `i diinisialisasi dengan nilai ${initial}.`);
  while (true) {
    const value = m.vars.i, result = testCondition(value, c.operator, compare);
    m.condition = { expression: `${value} ${c.operator} ${compare}`, result };
    m.history.push({ value, state: result ? 'active' : 'false' });
    if (result) m.counters.iter++;
    yield outcome(1, `${value} ${c.operator} ${compare} bernilai ${result ? 'True' : 'False'}.${result ? ` Isi loop dijalankan untuk iterasi ke-${m.counters.iter}.` : ' Isi loop dilewati.'}`, result ? null : 'finished');
    if (!result) return;
    if (m.outputs.length >= MAX_PRINTS) { yield limitEvent(2); return; }
    m.outputs.push(String(value)); m.counters.prints++;
    yield outcome(2, `print(i) mencetak ${value}.`);
    m.vars.i = value + delta;
    m.history[m.history.length - 1].state = 'done';
    yield outcome(3, `i ${c.change === 'add' ? 'bertambah' : 'berkurang'} ${amount}: dari ${value} menjadi ${m.vars.i}. Selanjutnya kondisi diperiksa lagi.`);
  }
}
function* whileStringTrace(m, c) {
  const chars = Array.from(c.text);
  m.vars.teks = c.text;
  yield outcome(0, `teks berisi ${pyString(c.text)}.`);
  m.vars.indeks = 0;
  yield outcome(1, `indeks dimulai dari 0. Panjang teks adalah ${chars.length}.`);
  while (true) {
    const index = m.vars.indeks, result = index < chars.length;
    m.condition = { expression: `${index} < ${chars.length}`, result };
    m.active.main = result ? index : null;
    if (result) m.counters.iter++;
    yield outcome(2, `indeks < len(teks) berarti ${index} < ${chars.length}: ${result ? 'True' : 'False'}.${result ? ` Karakter aktif ${shown(chars[index],true)}.` : ' Penelusuran selesai.'}`, result ? null : 'finished');
    if (!result) { m.processed.main = Math.min(index, chars.length); return; }
    if (m.outputs.length >= MAX_PRINTS) { yield limitEvent(3); return; }
    m.outputs.push(chars[index]); m.counters.prints++;
    yield outcome(3, `print(teks[${index}]) mencetak ${shown(chars[index],true)}.`);
    m.vars.indeks = index + 1; m.processed.main = index + 1; m.active.main = null;
    yield outcome(4, `indeks bertambah dari ${index} menjadi ${m.vars.indeks}. Kondisi akan diperiksa lagi.`);
    if (m.vars.indeks === MAX_ITEMS && chars.length > MAX_ITEMS) { yield limitEvent(2); return; }
  }
}
function* nestedTrace(m, outer, inner) {
  for (let oi = 0; oi < outer.values.length; oi++) {
    const i = outer.values[oi];
    m.vars.i = i; m.active.outer = oi; m.processed.outer = oi; m.active.inner = null; m.processed.inner = 0;
    m.counters.outer++; m.counters.inner = 0;
    yield outcome(0, `i mengambil ${formatValue(i,outer)}. Loop dalam dimulai lagi dari nilai pertama.`);
    for (let ji = 0; ji < inner.values.length; ji++) {
      const j = inner.values[ji], previous = ji > 0 ? inner.values[ji-1] : null;
      m.vars.j = j; m.active.inner = ji; m.processed.inner = ji; m.counters.inner++;
      yield outcome(1, previous === null ? `i tetap ${formatValue(i,outer)}, j mulai dari ${formatValue(j,inner)}.` : `i tetap ${formatValue(i,outer)}, j berpindah dari ${formatValue(previous,inner)} ke ${formatValue(j,inner)}.`);
      if (m.outputs.length >= MAX_PRINTS) { yield limitEvent(2); return; }
      m.outputs.push(`${String(i)} ${String(j)}`); m.counters.prints++;
      yield outcome(2, `print(i, j) mencetak ${formatValue(i,outer)} dan ${formatValue(j,inner)}.`);
    }
    m.active.inner = null; m.processed.inner = inner.values.length;
    if (inner.truncated) { yield limitEvent(1); return; }
    yield outcome(1, inner.values.length === 0 ? `Loop dalam kosong untuk i = ${formatValue(i,outer)}. Tidak ada print.` : `Loop dalam habis untuk i = ${formatValue(i,outer)}. Loop luar akan lanjut.`);
  }
  m.active.outer = null; m.processed.outer = outer.values.length;
  if (outer.truncated) yield limitEvent(0);
  else yield outcome(0, outer.values.length === 0 ? 'Sumber loop luar kosong. Loop dalam dan print tidak dijalankan.' : 'Sumber loop luar habis. Semua pasangan nilai yang tersedia sudah diproses.', 'finished');
}
function makeIterator() {
  const c = configs[tab], s = validation.sources;
  if (tab === 'for') return forTrace(machine, c, s.main);
  if (tab === 'while') return c.mode === 'number' ? whileNumberTrace(machine, c) : whileStringTrace(machine, c);
  return nestedTrace(machine, s.outer, s.inner);
}
function stopTimer() { playing = false; if (timer !== null) { clearTimeout(timer); timer = null; } }
function resetSimulation() {
  stopTimer(); stepNumber = 0; currentLine = -1;
  currentMessage = 'Pilih input, lalu jalankan simulasi.';
  validation = validate(); renderErrors(); machine = createMachine();
  iterator = Object.keys(validation.errors).length ? null : makeIterator();
  status = iterator ? 'ready' : 'invalid';
  if (!iterator) currentMessage = 'Perbaiki input yang ditandai untuk menjalankan simulasi.';
  renderAll();
}
function runStep() {
  if (!iterator || status === 'finished' || status === 'limited') return;
  if (stepNumber >= MAX_STEPS) { status = 'limited'; currentMessage = 'Batas simulasi tercapai. Terlalu banyak langkah eksekusi.'; currentLine = -1; stopTimer(); renderAll(); return; }
  const next = iterator.next();
  if (next.done) { status = 'finished'; stopTimer(); renderAll(); return; }
  stepNumber++; currentLine = next.value.line; currentMessage = next.value.message;
  if (next.value.terminal) { status = next.value.terminal; stopTimer(); }
  else status = playing ? 'playing' : 'paused';
  renderAll();
}
function schedule() {
  if (!playing) return;
  timer = setTimeout(() => { timer = null; runStep(); schedule(); }, Number(els.speed.value));
}
function play() {
  if (playing || !iterator || status === 'finished' || status === 'limited') return;
  playing = true; runStep(); schedule();
}
function pause() {
  if (!playing) return;
  stopTimer(); if (status === 'playing') status = 'paused'; renderAll();
}
function step() { if (playing) pause(); runStep(); }

function addText(parent, tag, text, className = '') {
  const element = document.createElement(tag); element.textContent = text; if (className) element.className = className; parent.append(element); return element;
}
function sourcePanel(source, key, title, active, processed) {
  const panel = document.createElement('div'); panel.className = `source-panel ${key}`;
  const head = addText(panel, 'div', '', 'source-head');
  addText(head, 'strong', title);
  addText(head, 'span', `${source.values.length}${source.truncated ? '+' : ''} nilai tersedia`);
  if (!source.values.length) addText(panel, 'div', 'Sumber kosong · 0 iterasi', 'empty-source');
  else {
    const cards = addText(panel, 'div', '', 'cards');
    source.values.forEach((value, index) => {
      const state = index === active ? 'active' : index < processed ? 'done' : 'pending';
      const card = addText(cards, 'div', '', `item-card ${state}`);
      if (source.indexed) addText(card, 'span', `indeks ${index}`, 'item-index');
      addText(card, 'span', cardValue(value), 'value');
      addText(card, 'span', state === 'active' ? 'Sedang aktif' : state === 'done' ? 'Selesai' : 'Menunggu', 'card-state');
    });
  }
  if (source.kind === 'number' && source.stop !== null) addText(panel, 'div', `Stop = ${source.stop} · batas berhenti, tidak ikut dihasilkan`, 'stop-marker');
  if (source.truncated) addText(panel, 'p', `Sumber lebih dari ${MAX_ITEMS} nilai. Simulasi berhenti pada batas.`, 'limit-note');
  return panel;
}
function renderVisual() {
  els.visual.replaceChildren();
  const c = configs[tab], s = validation.sources;
  if (tab === 'for') {
    els.visual.append(sourcePanel(s.main,'main',c.mode === 'string' ? 'Karakter dalam teks' : 'Nilai dari range()',machine.active.main,machine.processed.main));
  } else if (tab === 'nested') {
    els.visual.append(sourcePanel(s.outer,'outer','Loop luar · i',machine.active.outer,machine.processed.outer));
    els.visual.append(sourcePanel(s.inner,'inner','Loop dalam · j',machine.active.inner,machine.processed.inner));
  } else if (c.mode === 'string') {
    const source = { kind:'string',values:Array.from(c.text).slice(0,MAX_ITEMS),truncated:Array.from(c.text).length>MAX_ITEMS,indexed:true };
    els.visual.append(sourcePanel(source,'main','Karakter teks',machine.active.main,machine.processed.main));
  } else {
    const panel = document.createElement('div'); panel.className = 'source-panel main';
    addText(panel, 'strong', 'Nilai i yang diperiksa');
    if (!machine.history.length) addText(panel,'div','Belum ada pemeriksaan kondisi.','empty-source');
    else {
      const cards = addText(panel,'div','','cards');
      machine.history.forEach(entry => {
        const card = addText(cards,'div','',`item-card ${entry.state === 'false' ? 'done' : entry.state}`);
        addText(card,'span',String(entry.value),'value');
        addText(card,'span',entry.state === 'false' ? 'False · berhenti' : entry.state === 'done' ? 'Selesai' : 'Sedang aktif','card-state');
      });
    }
    els.visual.append(panel);
  }
  if (machine.condition) addText(els.visual, 'div', `${machine.condition.expression} → ${machine.condition.result ? 'True' : 'False'}`, `condition-box ${machine.condition.result ? 'true' : 'false'}`);
}
function renderOutput() {
  els.output.replaceChildren();
  if (!machine.outputs.length) addText(els.output,'div','Belum ada output.','output-empty');
  else machine.outputs.forEach((value,index) => {
    const row = addText(els.output,'div','','output-row'); addText(row,'span',String(index+1).padStart(2,'0'),'num'); addText(row,'span',value,'printed');
  });
  els.output.scrollTop = els.output.scrollHeight;
}
function renderStatus() {
  const labels = { ready:'Siap',playing:'Berjalan',paused:'Jeda',finished:'Pengulangan selesai',limited:'Batas simulasi tercapai',invalid:'Input perlu diperbaiki' };
  els.status.dataset.state = status; els['status-text'].textContent = labels[status];
  els['step-description'].textContent = currentMessage;
  els.play.disabled = playing || !iterator || status === 'finished' || status === 'limited';
  els.pause.disabled = !playing;
  els.step.disabled = !iterator || status === 'finished' || status === 'limited';
}
function renderAll() { renderCode(); renderVisual(); renderOutput(); renderStatus(); }
function updateTopic() {
  els.workspace.setAttribute('aria-labelledby',`tab-${tab}`);
  document.querySelectorAll('.tab').forEach(button => { const selected = button.dataset.tab === tab; button.classList.toggle('active',selected); button.setAttribute('aria-selected',String(selected)); button.tabIndex = selected ? 0 : -1; });
}
function selectTab(next) { if (next === tab) return; tab = next; updateTopic(); renderSettings(); resetSimulation(); }

els['settings-fields'].addEventListener('input', event => {
  const input = event.target.closest('[data-key]'); if (!input) return;
  configs[tab][input.dataset.key] = input.value;
  resetSimulation();
});
els['settings-fields'].addEventListener('change', event => {
  const input = event.target.closest('[data-key]'); if (!input) return;
  configs[tab][input.dataset.key] = input.value;
  if (input.dataset.key.toLowerCase().includes('mode')) renderSettings();
  resetSimulation();
});
document.querySelectorAll('.tab').forEach(button => button.addEventListener('click', () => selectTab(button.dataset.tab)));
document.querySelector('.tabs').addEventListener('keydown', event => {
  const buttons = [...document.querySelectorAll('.tab')]; const index = buttons.findIndex(button => button.dataset.tab === tab);
  let next = index;
  if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
  else if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = buttons.length - 1;
  else return;
  event.preventDefault(); selectTab(buttons[next].dataset.tab); buttons[next].focus();
});
els.play.addEventListener('click',play);
els.pause.addEventListener('click',pause);
els.step.addEventListener('click',step);
els.reset.addEventListener('click',resetSimulation);
els.speed.addEventListener('change',() => { if (playing) { if (timer !== null) clearTimeout(timer); timer = null; schedule(); } });
renderSettings(); resetSimulation();
