// 英語疑問文100本ノック - クライアントのみで動作
// 機能：問題読み込み、タグフィルタ、音声合成、前後移動、ランダム

const state = {
  questions: [],
  filtered: [],
  index: 0,
  voice: null,
};

const els = {
  mode: document.getElementById('mode'),
  voiceSelect: document.getElementById('voiceSelect'),
  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),
  shuffleBtn: document.getElementById('shuffleBtn'),
  showAnswerBtn: document.getElementById('showAnswerBtn'),
  playQuestionBtn: document.getElementById('playQuestionBtn'),
  playAnswerBtn: document.getElementById('playAnswerBtn'),
  resetBtn: document.getElementById('resetBtn'),
  autoPlay: document.getElementById('autoPlay'),
  counter: document.getElementById('counter'),
  tags: document.getElementById('tags'),
  question: document.getElementById('question'),
  answer: document.getElementById('answer'),
  hintText: document.getElementById('hintText')
};

// Load questions.json
// ★ loadQuestions を見える化＋キャッシュ回避＋フォールバック付きに差し替え
async function loadQuestions() {
  try {
    // まずは questions.json を取りに行き、ダメなら questions_final.json も試す
    const candidates = [
      'questions.json?v=20251101a',      // キャッシュ回避クエリ付き
      'questions_final.json?v=20251101a' // 予備：この名前で置いている場合
    ];

    let data = null, lastErr = null;

    for (const url of candidates) {
      try {
        console.log('[loadQuestions] fetching:', url);
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

        const json = await res.json();
        if (!Array.isArray(json)) {
          throw new Error(`Non-array JSON from ${url}`);
        }
        if (json.length === 0) {
          throw new Error(`Empty array from ${url}`);
        }

        console.log(`[loadQuestions] OK: loaded ${json.length} items from`, url);
        data = json;
        break; // 成功したので打ち切り
      } catch (e) {
        lastErr = e;
        console.warn('[loadQuestions] Failed:', e.message);
      }
    }

    if (!data) throw lastErr || new Error('No JSON loaded');

    state.questions = data;
  } catch (err) {
    console.error('[loadQuestions] ERROR:', err);
    // フェイルセーフ：1問だけ入れてUIが空にならないようにする
    state.questions = [
      { q: "Are you ready?", a: "Yes, I am.", tags: ["be","level-1"], hint: "準備はできていますか？→ はい、できています。" }
    ];
    alert(
      "問題ファイルを読み込めませんでした。\n" +
      "・ファイル名：'questions.json'（または 'questions_final.json'）で配置\n" +
      "・GitHub Pagesの反映/キャッシュ（?v=の数字を更新）\n" +
      "・JSONが配列＆コメント無し\n" +
      "を確認してください。詳細は F12→Console/Network を参照。"
    );
  }
  applyFilter(); // ← ここは従来どおり最後に呼びます
}

function applyFilter() {
  const mode = els.mode.value;
  state.filtered = state.questions.filter(q => {
    if (mode === 'all') return true;
    return q.tags && q.tags.includes(mode);
  });
  state.index = 0;
  render();
}

function render() {
  if (state.filtered.length === 0) {
    els.question.textContent = '該当する問題がありません。モードを変更してください。';
    els.answer.classList.add('hidden');
    els.answer.setAttribute('aria-hidden', 'true');
    els.counter.textContent = '0 / 0';
    els.tags.innerHTML = '';
    els.playAnswerBtn.disabled = true;
    return;
  }
  const q = state.filtered[state.index];
  els.question.textContent = q.q;
  els.answer.textContent = q.a;
  els.hintText.textContent = q.hint || '';
  els.answer.classList.add('hidden');
  els.answer.setAttribute('aria-hidden', 'true');
  els.playAnswerBtn.disabled = true;
  els.counter.textContent = `${state.index + 1} / ${state.filtered.length}`;
  els.tags.innerHTML = (q.tags || []).map(t => `<span class="tag">${t}</span>`).join('');
}

function speak(text, opts = {}) {
  const utter = new SpeechSynthesisUtterance(text);
  // 既知のユーザー好み：UK英語 Sonia を優先（存在しない場合は en-GB → en-US の順にフォールバック）
  const voices = window.speechSynthesis.getVoices();
  let voice = state.voice;
  if (!voice) {
    voice = (
      voices.find(v => /Sonia/i.test(v.name)) ||
      voices.find(v => /en-GB/i.test(v.lang)) ||
      voices.find(v => /en_US|en-US/i.test(v.lang)) ||
      voices[0]
    );
  }
  if (voice) utter.voice = voice;
  utter.rate = opts.rate ?? 0.95; // 少し遅め
  utter.pitch = opts.pitch ?? 1.0;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

function populateVoices() {
  const voices = window.speechSynthesis.getVoices();
  // 表示用に UK → US → others の順に並べる
  const sorted = voices.sort((a, b) => {
    const rank = lang => (lang.startsWith('en-GB') ? 0 : lang.startsWith('en-US') ? 1 : 2);
    const ra = rank(a.lang || '');
    const rb = rank(b.lang || '');
    if (ra !== rb) return ra - rb;
    return (a.name || '').localeCompare(b.name || '');
  });
  els.voiceSelect.innerHTML = sorted.map(v => `<option value="${v.name}">${v.name} (${v.lang})</option>`).join('');
  // 既定選択：Sonia → en-GB → en-US
  const preferred = sorted.find(v => /Sonia/i.test(v.name)) || sorted.find(v => /en-GB/i.test(v.lang)) || sorted.find(v => /en-US/i.test(v.lang)) || sorted[0];
  if (preferred) {
    els.voiceSelect.value = preferred.name;
    state.voice = preferred;
  }
}

// Event bindings
els.mode.addEventListener('change', applyFilter);

els.prevBtn.addEventListener('click', () => {
  if (state.filtered.length === 0) return;
  state.index = (state.index - 1 + state.filtered.length) % state.filtered.length;
  render();
});

els.nextBtn.addEventListener('click', () => {
  if (state.filtered.length === 0) return;
  state.index = (state.index + 1) % state.filtered.length;
  render();
});

els.shuffleBtn.addEventListener('click', () => {
  if (state.filtered.length === 0) return;
  state.index = Math.floor(Math.random() * state.filtered.length);
  render();
});

els.showAnswerBtn.addEventListener('click', () => {
  els.answer.classList.remove('hidden');
  els.answer.setAttribute('aria-hidden', 'false');
  els.playAnswerBtn.disabled = false;
  if (els.autoPlay.checked) speak(els.answer.textContent);
});

els.playQuestionBtn.addEventListener('click', () => {
  speak(els.question.textContent);
});

els.playAnswerBtn.addEventListener('click', () => {
  speak(els.answer.textContent);
});

els.resetBtn.addEventListener('click', () => {
  state.index = 0;
  render();
});

// voice selection
els.voiceSelect.addEventListener('change', () => {
  const name = els.voiceSelect.value;
  const v = window.speechSynthesis.getVoices().find(x => x.name === name);
  state.voice = v || null;
});

// iOS/Safariなどで voices が遅延ロードされる対策
if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => populateVoices();
  populateVoices();
}

// Initialize
loadQuestions();

``
