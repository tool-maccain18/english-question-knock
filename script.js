// 英語疑問文100本ノック - 会話モード & ランダム出題対応版

const state = {
  questions: [],
  filtered: [],
  index: 0,
  voice: null,
  conversationMode: true,   // 既定ON：Q×2→A→表示
  randomMode: true,         // 既定ON：次へでランダム
  history: []               // ランダム時の戻る用
};

const els = {
  mode: document.getElementById('mode'),
  voiceSelect: document.getElementById('voiceSelect'),
  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),
  shuffleBtn: document.getElementById('shuffleBtn'),

  conversationMode: document.getElementById('conversationMode'),
  randomMode: document.getElementById('randomMode'),

  playQuestionX2Btn: document.getElementById('playQuestionX2Btn'),
  playQuestionBtn: document.getElementById('playQuestionBtn'),
  playAnswerBtn: document.getElementById('playAnswerBtn'),
  showAnswerBtn: document.getElementById('showAnswerBtn'),
  resetBtn: document.getElementById('resetBtn'),

  counter: document.getElementById('counter'),
  tags: document.getElementById('tags'),
  question: document.getElementById('question'),
  answer: document.getElementById('answer'),
  hintText: document.getElementById('hintText')
};

// ---------- 音声合成ユーティリティ ----------
function getPreferredVoice() {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find(v => /Sonia/i.test(v.name)) ||
    voices.find(v => /en-GB/i.test(v.lang)) ||
    voices.find(v => /en_US|en-US/i.test(v.lang)) ||
    voices[0] || null
  );
}

// Promiseで完了を待てる speak
function speakAsync(text, opts = {}) {
  return new Promise((resolve) => {
    const utter = new SpeechSynthesisUtterance(text);
    if (!state.voice) state.voice = getPreferredVoice();
    if (state.voice) utter.voice = state.voice;
    utter.rate = opts.rate ?? 0.95;
    utter.pitch = opts.pitch ?? 1.0;
    utter.onend = () => resolve();
    // 先行再生を止める
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  });
}

async function speakQuestionTwice() {
  const text = els.question.textContent;
  if (!text || text === 'Loading…') return;
  await speakAsync(text);
  // 少し間を空ける
  await new Promise(r => setTimeout(r, 350));
  await speakAsync(text);
}

// ---------- データ読み込み ----------
async function loadQuestions() {
  try {
    const candidates = [
      'questions.json?v=conv1',
      'questions_120.json?v=conv1' // 予備：拡張版を使うとき
    ];
    let data = null, lastErr = null;
    for (const url of candidates) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!Array.isArray(json) || json.length === 0) throw new Error('Invalid JSON');
        data = json;
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!data) throw lastErr || new Error('No JSON');
    state.questions = data;
    applyFilter(true); // 初回はランダムに
  } catch (err) {
    console.error('loadQuestions error:', err);
    // フェイルセーフ
    state.questions = [
      { q: "Are you ready?", a: "Yes, I am.", tags: ["be","level-1"], hint: "準備はできていますか？→ はい、できています。" }
    ];
    applyFilter(true);
  }
}

function applyFilter(isInitial = false) {
  const mode = els.mode.value;
  state.filtered = state.questions.filter(q => {
    if (mode === 'all') return true;
    return q.tags && q.tags.includes(mode);
  });

  // ランダム出題：初回/フィルタ変更時にランダムから始める
  if (state.randomMode && state.filtered.length > 0) {
    state.index = Math.floor(Math.random() * state.filtered.length);
    state.history = [];
  } else {
    state.index = 0;
    state.history = [];
  }
  render(isInitial);
}

// ---------- 表示と自動再生 ----------
let renderTimer = null;

function render(isInitial = false) {
  if (renderTimer) clearTimeout(renderTimer);

  if (state.filtered.length === 0) {
    els.question.textContent = '該当する問題がありません。モードを変更してください。';
    els.answer.classList.add('hidden');
    els.answer.setAttribute('aria-hidden', 'true');
    els.counter.textContent = '0 / 0';
    els.tags.innerHTML = '';
    return;
  }

  const q = state.filtered[state.index];
  els.question.textContent = q.q;
  els.answer.textContent = q.a;
  els.hintText.textContent = q.hint || '';
  els.answer.classList.add('hidden');
  els.answer.setAttribute('aria-hidden', 'true');

  els.counter.textContent = `${state.index + 1} / ${state.filtered.length}`;
  els.tags.innerHTML = (q.tags || []).map(t => `<span class="tag">${t}</span>`).join('');

  // 初回やカード切替時に会話モードならQ×2を自動再生
  if (state.conversationMode) {
    // paint後に実行
    renderTimer = setTimeout(async () => {
      await speakQuestionTwice();
    }, 150);
  }
}

// ---------- ナビゲーション ----------
function goPrev() {
  if (state.filtered.length === 0) return;
  if (state.randomMode && state.history.length > 0) {
    const prevIndex = state.history.pop();
    state.index = prevIndex;
  } else {
    state.index = (state.index - 1 + state.filtered.length) % state.filtered.length;
  }
  render();
}

function goNext() {
  if (state.filtered.length === 0) return;
  if (state.randomMode) {
    state.history.push(state.index);
    let next = state.index;
    if (state.filtered.length > 1) {
      while (next === state.index) next = Math.floor(Math.random() * state.filtered.length);
    }
    state.index = next;
  } else {
    state.index = (state.index + 1) % state.filtered.length;
  }
  render();
}

// ---------- イベント ----------
els.mode.addEventListener('change', () => applyFilter());
els.randomMode.addEventListener('change', () => {
  state.randomMode = els.randomMode.checked;
});
els.conversationMode.addEventListener('change', () => {
  state.conversationMode = els.conversationMode.checked;
});

els.prevBtn.addEventListener('click', goPrev);
els.nextBtn.addEventListener('click', goNext);
els.shuffleBtn.addEventListener('click', () => {
  if (state.filtered.length === 0) return;
  state.index = Math.floor(Math.random() * state.filtered.length);
  render();
});

// Q×2 / Q×1 再生ボタン
els.playQuestionX2Btn.addEventListener('click', async () => {
  await speakQuestionTwice();
});
els.playQuestionBtn.addEventListener('click', async () => {
  const text = els.question.textContent;
  if (!text || text === 'Loading…') return;
  await speakAsync(text);
});

// Aを音声 →（会話モード時）終わってから表示
els.playAnswerBtn.addEventListener('click', async () => {
  const text = els.answer.textContent;
  if (!text) return;
  await speakAsync(text);
  if (state.conversationMode) {
    els.answer.classList.remove('hidden');
    els.answer.setAttribute('aria-hidden', 'false');
  }
});

// 「答えを見る」：会話モードなら A→表示、OFFなら即表示＋任意で音声
els.showAnswerBtn.addEventListener('click', async () => {
  const text = els.answer.textContent;
  if (state.conversationMode && text) {
    await speakAsync(text);
  }
  els.answer.classList.remove('hidden');
  els.answer.setAttribute('aria-hidden', 'false');
});

els.resetBtn.addEventListener('click', () => {
  state.history = [];
  applyFilter(true);
});

// 音声選択
function populateVoices() {
  const voices = window.speechSynthesis.getVoices();
  // UK → US → others
  const sorted = voices.sort((a, b) => {
    const rank = lang => (String(lang).startsWith('en-GB') ? 0 : String(lang).startsWith('en-US') ? 1 : 2);
    const ra = rank(a.lang), rb = rank(b.lang);
    if (ra !== rb) return ra - rb;
    return (a.name || '').localeCompare(b.name || '');
  });
  els.voiceSelect.innerHTML = sorted.map(v => `<option value="${v.name}">${v.name} (${v.lang})</option>`).join('');
  const preferred = sorted.find(v => /Sonia/i.test(v.name)) || sorted.find(v => /en-GB/i.test(v.lang)) || sorted.find(v => /en-US/i.test(v.lang)) || sorted[0];
  if (preferred) {
    els.voiceSelect.value = preferred.name;
    state.voice = preferred;
  }
}
els.voiceSelect.addEventListener('change', () => {
  const name = els.voiceSelect.value;
  const v = window.speechSynthesis.getVoices().find(x => x.name === name);
  state.voice = v || null;
});

// iOS/Safari対策
if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => populateVoices();
  populateVoices();
}

// 初期化
loadQuestions();
