var K_ITEMS="srs_items", K_SETTINGS="srs_settings", K_SENTENCES="srs_sentences";

function safeGet(key, fallback){
  try{ var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch(e){ return fallback; }
}
function safeSet(key, val){
  try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){ console.error("storage error", e); }
}

function loadItems(){ return safeGet(K_ITEMS, []); }
function saveItems(v){ safeSet(K_ITEMS, v); }
function loadSettings(){ return safeGet(K_SETTINGS, {n:[1,3,7,14]}); }
function saveSettings(v){ safeSet(K_SETTINGS, v); }
function loadSentences(){
  var list = safeGet(K_SENTENCES, []);
  var changed = false;
  list.forEach(function(s){
    if(!s.registeredDate){ s.registeredDate = todayStr(); changed = true; }
    if(!s.completedTurns){ s.completedTurns = []; changed = true; }
  });
  if(changed) saveSentences(list);
  return list;
}
function saveSentences(v){ safeSet(K_SENTENCES, v); }

function todayStr(){
  var d = new Date();
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function addDays(dateStr, n){
  var d = new Date(dateStr+"T00:00:00");
  d.setDate(d.getDate()+n);
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function getToday(){
  var v = document.getElementById("today-date-input").value;
  return v || todayStr();
}
function getRegDate(){
  var v = document.getElementById("reg-date-input").value;
  return v || todayStr();
}
function dueTurn(entity, settings, today){
  var n = settings.n;
  for(var t=1; t<=4; t++){
    if(entity.completedTurns && entity.completedTurns.indexOf(t) !== -1) continue;
    var sched = addDays(entity.registeredDate, n[t-1] || 0);
    if(sched <= today) return t;
    return null;
  }
  return null;
}

var revealState = {};
var doneThisSession = {};    // id -> true （OKしたがグレー表示で残す：一問一答用）
var currentDueList = [];     // [{id, turn}] 一問一答：本日分として固定されたリスト
var selectedId = null;

var dueSentenceList = [];    // [{id, turn}] 英文：本日分として固定されたリスト

function computeDueList(items, settings, today){
  var list = [];
  items.forEach(function(it){
    var t = dueTurn(it, settings, today);
    if(t){ list.push({id:it.id, turn:t}); }
  });
  list.sort(function(a,b){ return a.turn - b.turn; });
  return list;
}

function refreshDueList(){
  var settings = loadSettings();
  var today = getToday();

  currentDueList = computeDueList(loadItems(), settings, today);
  doneThisSession = {};
  revealState = {};
  selectedId = currentDueList.length ? currentDueList[0].id : null;

  dueSentenceList = computeDueList(loadSentences(), settings, today);
}

function showLoading(id, on){
  document.getElementById(id).classList.toggle("active", on);
}

function doRefresh(){
  showLoading("qa-loading", true);
  showLoading("reading-loading", true);
  setTimeout(function(){
    refreshDueList();
    render();
    showLoading("qa-loading", false);
    showLoading("reading-loading", false);
  }, 500);
}

function findItem(id, items){
  return (items || loadItems()).find(function(x){ return x.id === id; });
}

function render(){
  var items = loadItems();
  var tbody = document.getElementById("qa-tbody");
  tbody.innerHTML = "";
  document.getElementById("qa-empty").style.display = currentDueList.length ? "none" : "block";

  currentDueList.forEach(function(entry){
    var it = findItem(entry.id, items);
    if(!it) return;
    var done = !!doneThisSession[entry.id];
    var tr = document.createElement("tr");
    tr.className = "qa-row turn-color-" + entry.turn + (done ? " qa-row-done" : "") + (entry.id===selectedId ? " selected" : "");
    tr.dataset.id = entry.id;
    tr.addEventListener("click", function(){ selectedId = entry.id; render(); });

    var tdTurn = document.createElement("td");
    tdTurn.className = "qa-cell qa-cell-turn";
    tdTurn.textContent = entry.turn ;
    tr.appendChild(tdTurn);

    var tdQ = document.createElement("td");
    tdQ.className = "qa-cell qa-cell-question";
    tdQ.textContent = it.question;
    tr.appendChild(tdQ);

    var revealed = !!revealState[entry.id];
    var tdA = document.createElement("td");
    tdA.className = "qa-cell qa-cell-answer";
    var ansSpan = document.createElement("span");
    ansSpan.className = revealed ? "answer-visible" : "answer-hidden";
    ansSpan.textContent = revealed ? it.answer : it.answer.replace(/./gs, "＝");
    ansSpan.addEventListener("click", function(e){ e.stopPropagation(); selectedId = entry.id; toggleReveal(entry.id); });
    tdA.appendChild(ansSpan);
    tr.appendChild(tdA);

    var tdNote = document.createElement("td");
    tdNote.className = "qa-cell qa-cell-note";
    tdNote.textContent = revealed ? (it.note || "") : "";
    tr.appendChild(tdNote);

    tbody.appendChild(tr);
  });

  renderReading();
}

function renderReading(){
  var sentences = loadSentences();
  var tbody = document.getElementById("reading-tbody");
  tbody.innerHTML = "";
  document.getElementById("reading-empty").style.display = dueSentenceList.length ? "none" : "block";

  dueSentenceList.forEach(function(entry){
    var s = sentences.find(function(x){ return x.id === entry.id; });
    if(!s) return;
    var tr = document.createElement("tr");
    tr.className = "qa-row turn-color-" + entry.turn;

    var tdTurn = document.createElement("td");
    tdTurn.className = "qa-cell qa-cell-turn";
    tdTurn.textContent = entry.turn ;
    tr.appendChild(tdTurn);

    var tdText = document.createElement("td");
    tdText.className = "qa-cell qa-cell-sentence";
    tdText.textContent = s.text;
    tr.appendChild(tdText);

    tbody.appendChild(tr);
  });
}

function toggleReveal(id){
  revealState[id] = !revealState[id];
  render();
}


function markOk(id){
  var entry = currentDueList.find(function(x){ return x.id === id; });
  if(!entry) return;
  var items = loadItems();
  var it = findItem(id, items);
  if(!it) return;
  if(!it.completedTurns) it.completedTurns = [];
  var idx = it.completedTurns.indexOf(entry.turn);
  if(idx === -1){
    it.completedTurns.push(entry.turn);
    doneThisSession[id] = true;
  } else {
    it.completedTurns.splice(idx, 1);
    delete doneThisSession[id];
  }
  saveItems(items);
  render();
}


function moveSelection(delta){
  if(!currentDueList.length) return;
  var idx = currentDueList.findIndex(function(d){ return d.id === selectedId; });
  if(idx === -1) idx = 0;
  idx = Math.max(0, Math.min(currentDueList.length - 1, idx + delta));
  selectedId = currentDueList[idx].id;
  render();
}

// ---- 日付フィールド ----
document.getElementById("reg-date-input").value = todayStr();
document.getElementById("today-date-input").value = todayStr();
document.getElementById("today-date-input").addEventListener("change", function(){
  doRefresh();
});

// ---- 一問一答 登録 ----
document.getElementById("add-qa-btn").addEventListener("click", function(){
  var q = document.getElementById("input-question").value.trim();
  var a = document.getElementById("input-answer").value.trim();
  var note = document.getElementById("input-note").value.trim();
  if(!q || !a){ return; }
  var btn = this;
  var original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "登録中…";
  setTimeout(function(){
    var items = loadItems();
    items.push({
      id: "id_" + Date.now() + "_" + Math.random().toString(36).slice(2,8),
      question: q, answer: a, note: note,
      registeredDate: getRegDate(), completedTurns: []
    });
    saveItems(items);
    document.getElementById("input-question").value = "";
    document.getElementById("input-answer").value = "";
    document.getElementById("input-note").value = "";
    btn.textContent = original;
    btn.disabled = false;
    doRefresh();
  }, 200);
});

// ---- 英文 登録 ----
document.getElementById("add-sentence-btn").addEventListener("click", function(){
  var input = document.getElementById("new-sentence-input");
  var text = input.value.trim();
  if(!text) return;
  var btn = this;
  var original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "登録中…";
  setTimeout(function(){
    var list = loadSentences();
    list.push({ id:"s_"+Date.now(), text:text, registeredDate:getRegDate(), completedTurns:[] });
    saveSentences(list);
    input.value = "";
    btn.textContent = original;
    btn.disabled = false;
    doRefresh();
  }, 200);
});

// ---- 設定 ----
function loadSettingsToForm(){
  var s = loadSettings();
  document.getElementById("n1").value = s.n[0];
  document.getElementById("n2").value = s.n[1];
  document.getElementById("n3").value = s.n[2];
  document.getElementById("n4").value = s.n[3];
}
document.getElementById("save-settings-btn").addEventListener("click", function(){
  var n = [
    parseInt(document.getElementById("n1").value,10) || 0,
    parseInt(document.getElementById("n2").value,10) || 0,
    parseInt(document.getElementById("n3").value,10) || 0,
    parseInt(document.getElementById("n4").value,10) || 0
  ];
  saveSettings({n:n});
  doRefresh();
});
loadSettingsToForm();

// ---- バックアップ ----
document.getElementById("export-btn").addEventListener("click", function(){
  var data = { items: loadItems(), settings: loadSettings(), sentences: loadSentences() };
  document.getElementById("backup-area").value = JSON.stringify(data, null, 2);
});
document.getElementById("import-btn").addEventListener("click", function(){
  var raw = document.getElementById("backup-area").value.trim();
  if(!raw) return;
  try{
    var data = JSON.parse(raw);
    if(data.items) saveItems(data.items);
    if(data.settings) saveSettings(data.settings);
    if(data.sentences) saveSentences(data.sentences);
    loadSettingsToForm();
    doRefresh();
  }catch(e){
    alert("JSONの読み込みに失敗しました：" + e.message);
  }
});

// ---- モバイル操作ボタン ----
document.getElementById("m-up").addEventListener("click", function(){ moveSelection(-1); });
document.getElementById("m-down").addEventListener("click", function(){ moveSelection(1); });
document.getElementById("m-show").addEventListener("click", function(){ if(selectedId) toggleReveal(selectedId); });
document.getElementById("m-ok").addEventListener("click", function(){ if(selectedId) markOk(selectedId); });

// ---- キーボード操作 ----
document.addEventListener("keydown", function(e){
  if(e.key === "Escape"){ e.preventDefault();  document.activeElement.blur()}

  var tag = document.activeElement.tagName;
  if(tag === "INPUT" || tag === "TEXTAREA") return;
  if(!currentDueList.length) return;

  console.log(e.key);
  if(e.key === "j"){ e.preventDefault(); moveSelection(1); }
  else if(e.key === "k"){ e.preventDefault(); moveSelection(-1); }
  else if(e.key === "Enter"){ e.preventDefault(); if(selectedId) toggleReveal(selectedId); }
  else if(e.key === "c" || e.key === "C"){ e.preventDefault(); if(selectedId) markOk(selectedId); }
});

refreshDueList();
render();
