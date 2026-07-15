let vocabulary = [];
        let activeTab = 'list';
        let currentFlashcardIndex = 0;
        let isFlashcardFlipped = false;
        let isMenuCollapsed = false;
        
        let nyanyaDiary = {}; 

        // [냐냐 PATCH-수준맞춤] 매번 전체 기록을 보내는 대신, 작은 누적 요약만 유지.
        // 문제 풀 때마다 살짝씩만 갱신되고 크기가 거의 고정이라 토큰/속도에 거의 영향 없음.
        let learnerProfile = { totalAnswered: 0, totalCorrect: 0, wrongByPos: {}, wrongByGrammarType: {} };

        // [냐냐 PATCH] 질문에 답하기 코너용 - 내가 등록한 질문 목록
        let customQuestions = [];
        let currentQuestionForAnswer = null;
        let selectedQuestionTopics = []; // [] = 전체 주제. 랜덤 뽑기 주제 선택을 저장해서 유지
        let customGrammarTables = []; // [냐냐 PATCH] 사용자가 직접 만든 문법 표 (기본 표와 합쳐서 표시)

        // AI 꼬리대화 히스토리 및 힌트 상태 관리
        let aiChatHistory = [];
        let isAiHintVisible = false;

        // 실시간 입력 타이머
        // (실시간 입력 타이머는 더 이상 사용하지 않음 — AI 추천 버튼으로 대체됨)

        window.onload = async function() {
            // [냐냐 PATCH-진단] dictionary-data.js가 누락되면(업로드 안 됨) 여기서 멈춰서
            // 모든 버튼이 먹통처럼 보임 → 명확한 안내를 띄워서 원인을 알 수 있게 함
            if (typeof OFFLINE_DICT_DB === 'undefined' || typeof DEFAULT_VOCABULARY === 'undefined') {
                alert("필수 파일(dictionary-data.js)이 로드되지 않았어요!\n\nGitHub에 'js/dictionary-data.js' 파일이 업로드됐는지, 그리고 index.html에서 이 파일을 불러오는 줄이 있는지 확인해 주세요.");
                return;
            }
            await loadFromStorage();
            checkStatsReset(); // [냐냐 PATCH] 정답률 통계 월별 초기화 확인
            if (typeof updateEggProgress === 'function') updateEggProgress(); // [냐냐 PATCH] 알 상태 초기화/렌더
            if (typeof loadFilterPrefs === 'function') loadFilterPrefs(); // [냐냐 PATCH] 저장된 필터/정렬 복원
            if (typeof loadDisplayPrefs === 'function') loadDisplayPrefs(); // [냐냐 PATCH-6배치] 카드 표시 설정 복원
            if (typeof loadQuizMix === 'function') { loadQuizMix(); if (typeof renderQuizMix === 'function') renderQuizMix(); } // [냐냐 PATCH] 퀴즈 비율 슬라이더
            if (typeof loadGrammarFilterPrefs === 'function') loadGrammarFilterPrefs(); // [냐냐 PATCH] 문법표 필터/정렬 복원
            if (typeof loadGrammarEditorWidth === 'function') loadGrammarEditorWidth(); // [냐냐 PATCH] 문법 편집창 너비 복원
            renderWordList();
            updateStats();
            renderDiary();
            resetKoEsMissionState();
            updateApiKeyBadge();
            if (typeof updateMuteBadge === 'function') updateMuteBadge(); // [냐냐 PATCH-0배치] 음소거 배지

            // [냐냐 PATCH] 주관식 퀴즈: 제출 후 정답 확인 화면에서 엔터 한 번 더 치면 다음 문제로
            document.addEventListener('keydown', function(e) {
                if (e.key !== 'Enter') return;
                const quizTab = document.getElementById('tab-quiz');
                if (!quizTab || quizTab.classList.contains('hidden')) return; // 퀴즈 탭일 때만
                const reviewPanel = document.getElementById('quiz-review-panel');
                const nextBtn = document.getElementById('quiz-next-btn');
                // 정답 확인 패널이 열려있고(제출됨) 다음 버튼이 활성화됐을 때만
                if (reviewPanel && !reviewPanel.classList.contains('hidden') && nextBtn && !nextBtn.disabled) {
                    // 방금 제출한 엔터가 곧바로 다음 문제로 넘어가지 않도록 0.6초 가드
                    if (window._quizReviewShownAt && (Date.now() - window._quizReviewShownAt) < 600) return;
                    e.preventDefault();
                    nextQuizQuestion();
                }
            });

            if (!hasGeminiApiKey()) {
                setTimeout(() => {
                    showToast("AI 추천을 쓰려면 우측 상단 'AI 키 미등록' 배지를 눌러 Gemini API 키를 등록해 주세요!", "warning");
                }, 800);
            }

            if (!hasSyncPassword()) {
                setTimeout(() => {
                    showToast("기기 간 자동 동기화를 쓰려면 '동기화 비밀번호 설정하기' 배지를 눌러주세요!", "info");
                }, 1600);
            }
            
            if (window.innerWidth < 768) {
                collapseMobileMenu();
            }

            document.addEventListener('keydown', function(e) {
                if (activeTab === 'cards') {
                    if (e.key === 'ArrowRight') nextFlashcard();
                    if (e.key === 'ArrowLeft') prevFlashcard();
                    if (e.key === ' ') {
                        e.preventDefault();
                        flipFlashcard();
                    }
                }
            });

            // 드롭다운 외부 클릭 시 닫기
            document.addEventListener('click', function(e) {
                const suggs = document.getElementById('word-suggestions');
                const inp = document.getElementById('input-word');
                if (suggs && e.target !== inp && !suggs.contains(e.target)) {
                    suggs.classList.add('hidden');
                }

                // [냐냐 PATCH] 필터 패널도 바깥 클릭하면 닫힘 (버튼 클릭은 stopPropagation으로 여기까지 안 옴)
                const filterPanel = document.getElementById('filter-panel');
                if (filterPanel && !filterPanel.classList.contains('hidden') && !filterPanel.contains(e.target)) {
                    filterPanel.classList.add('hidden');
                }
                // [냐냐 PATCH-6배치] 표시 설정 패널도 동일
                const displayPanel = document.getElementById('display-panel');
                if (displayPanel && !displayPanel.classList.contains('hidden') && !displayPanel.contains(e.target)) {
                    displayPanel.classList.add('hidden');
                }
                // [냐냐 PATCH] 문법표 필터 패널도 바깥 클릭하면 닫힘
                const gFilterPanel = document.getElementById('grammar-filter-panel');
                if (gFilterPanel && !gFilterPanel.classList.contains('hidden') && !gFilterPanel.contains(e.target)) {
                    gFilterPanel.classList.add('hidden');
                }
            });
        };

        // ============================================================
        // [냐냐 PATCH-진짜 동기화] Firebase Realtime Database를 1순위로 사용.
        // 이 방식은 Claude 안이든 밖이든, 폰이든 PC든, 어떤 브라우저에서 열어도
        // 똑같이 동기화됨 (Claude에 의존하지 않는 진짜 서버 저장).
        // Firebase 연결이 안 될 때만 Claude 아티팩트 저장소 → 이 기기 로컬 저장소 순으로 대체.
        // ============================================================
        const FIREBASE_DB_URL = 'https://nyanya-vocab-default-rtdb.firebaseio.com';
        const SYNC_PASSWORD_KEY = 'nyanya_sync_password';

        // [냐냐 PATCH-비밀번호 동기화] 비밀번호 자체가 Firebase 안에서의 "내 데이터 경로"가 됨.
        // 이 비밀번호는 코드(GitHub)에는 절대 들어가지 않고 이 기기의 localStorage에만 저장됨.
        // Firebase 규칙에서 이 경로를 모르는 사람은 읽기/쓰기가 막히도록 설정해야 진짜 보안이 생김
        // (콘솔 → Realtime Database → 규칙에서 와일드카드 규칙으로 변경 필요).
        function getSyncPassword() {
            return (localStorage.getItem(SYNC_PASSWORD_KEY) || '').trim();
        }
        function hasSyncPassword() {
            return getSyncPassword().length > 0;
        }
        function getFirebaseDataPath() {
            const pw = getSyncPassword();
            if (!pw) return null;
            return `${FIREBASE_DB_URL}/vocab/${encodeURIComponent(pw)}.json`;
        }

        function openSyncPasswordModal() {
            document.getElementById('sync-password-input').value = getSyncPassword();
            document.getElementById('sync-password-modal').classList.remove('hidden');
        }
        function closeSyncPasswordModal() {
            document.getElementById('sync-password-modal').classList.add('hidden');
        }
        async function saveSyncPassword() {
            const value = document.getElementById('sync-password-input').value.trim();
            if (!value) {
                showToast("비밀번호를 입력해 주세요!", "error");
                return;
            }
            localStorage.setItem(SYNC_PASSWORD_KEY, value);
            closeSyncPasswordModal();
            showToast("비밀번호가 저장됐어요! 동기화를 다시 확인하는 중...", "info");
            await loadFromStorage();
            renderWordList();
            updateStats();
            renderDiary();
        }

        function hasServerStorage() {
            return typeof window !== 'undefined' && window.storage && typeof window.storage.get === 'function';
        }

        async function saveToStorage() {
            const payload = {
                vocabulary: vocabulary,
                nyanyaDiary: nyanyaDiary,
                learnerProfile: learnerProfile,
                customQuestions: customQuestions,
                selectedQuestionTopics: selectedQuestionTopics,
                customGrammarTables: customGrammarTables,
                pinnedGrammar: pinnedGrammar,
                hiddenDefaultGrammar: hiddenDefaultGrammar,
                masteredGrammar: masteredGrammar,
                hiddenQuestionTopics: hiddenQuestionTopics,
                grammarCellHighlights: grammarCellHighlights,
                grammarTopics: GRAMMAR_ICONS,
                eggState: eggState
            };
            const json = JSON.stringify(payload);

            // 항상 이 기기에도 백업 저장 (모든 동기화 방법이 실패해도 최소한 이 기기에서는 안전)
            try { localStorage.setItem('nyanya_data_v2', json); } catch (e) {}

            // 1순위: Firebase (어디서 열어도 동기화됨) — 비밀번호를 설정해야 사용 가능
            const firebasePath = getFirebaseDataPath();
            if (firebasePath) {
                try {
                    const res = await fetch(firebasePath, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: json
                    });
                    if (res.ok) {
                        updateSyncBadge(true);
                        return;
                    }
                } catch (e) {
                    console.warn("Firebase 저장 실패, 다른 저장소로 대체", e);
                }
            }

            // 2순위: Claude 아티팩트 저장소 (Claude 안에서만 동기화)
            if (hasServerStorage()) {
                try {
                    await window.storage.set('nyanya-vocab-data', json, false);
                    updateSyncBadge('claude-only');
                    return;
                } catch (e) {
                    console.warn("Claude 저장소도 실패, 이 기기에만 저장됨", e);
                }
            }

            updateSyncBadge(false);
        }

        async function loadFromStorage() {
            let payload = null;
            let firebaseReachable = false;

            // 1순위: Firebase에서 불러오기 — 비밀번호를 설정해야 사용 가능
            const firebasePath = getFirebaseDataPath();
            if (firebasePath) {
                try {
                    const res = await fetch(firebasePath);
                    if (res.ok) {
                        firebaseReachable = true;
                        const data = await res.json();
                        if (data) payload = data;
                    }
                } catch (e) {
                    console.warn("Firebase 연결 실패, 다른 저장소 확인", e);
                }
            }

            if (firebasePath && firebaseReachable) {
                updateSyncBadge(true);
            } else if (!firebasePath) {
                updateSyncBadge('no-password');
            } else if (hasServerStorage()) {
                // 2순위: Claude 아티팩트 저장소
                try {
                    const result = await window.storage.get('nyanya-vocab-data', false);
                    if (result && result.value) payload = JSON.parse(result.value);
                    updateSyncBadge('claude-only');
                } catch (e) {
                    updateSyncBadge(false);
                }
            } else {
                updateSyncBadge(false);
            }

            if (!payload) {
                // 3순위: 이 기기 로컬 백업 (통합 키)
                try {
                    const localV2 = localStorage.getItem('nyanya_data_v2');
                    if (localV2) payload = JSON.parse(localV2);
                } catch (e) {}
            }

            if (!payload) {
                // 4순위: 예전 버전(분리된 키)에 저장된 데이터가 있으면 마이그레이션
                const oldVocab = localStorage.getItem('nyanya_vocabulary');
                if (oldVocab) {
                    try {
                        payload = {
                            vocabulary: JSON.parse(oldVocab),
                            nyanyaDiary: JSON.parse(localStorage.getItem('nyanya_diary') || '{}')
                        };
                    } catch (e) {}
                }
            }

            if (payload) {
                vocabulary = payload.vocabulary || [...DEFAULT_VOCABULARY];
                nyanyaDiary = payload.nyanyaDiary || {};
                learnerProfile = payload.learnerProfile || { totalAnswered: 0, totalCorrect: 0, wrongByPos: {}, wrongByGrammarType: {} };
                if (!learnerProfile.wrongByGrammarType) learnerProfile.wrongByGrammarType = {}; // 예전 데이터 마이그레이션
                customQuestions = payload.customQuestions || [];
                selectedQuestionTopics = payload.selectedQuestionTopics || [];
                customGrammarTables = payload.customGrammarTables || [];
                pinnedGrammar = payload.pinnedGrammar || {};
                hiddenDefaultGrammar = payload.hiddenDefaultGrammar || [];
                masteredGrammar = payload.masteredGrammar || {};
                hiddenQuestionTopics = payload.hiddenQuestionTopics || [];
                grammarCellHighlights = payload.grammarCellHighlights || {};
                // [냐냐 PATCH] 저장된 주제(아이콘) 목록 복원 — 없으면 기본값 유지
                if (Array.isArray(payload.grammarTopics) && payload.grammarTopics.length) {
                    GRAMMAR_ICONS = payload.grammarTopics
                        .filter(t => t && (t.icon || '').trim())
                        .map(t => ({ icon: String(t.icon).trim(), label: (t.label ? String(t.label).trim() : String(t.icon).trim()) }));
                    if (GRAMMAR_ICONS.length === 0) GRAMMAR_ICONS = DEFAULT_GRAMMAR_ICONS.map(x => ({ ...x }));
                }
                eggState = Object.assign(defaultEggState(), payload.eggState || {});
                if (!Array.isArray(eggState.collection)) eggState.collection = [];
            } else {
                vocabulary = [...DEFAULT_VOCABULARY];
                nyanyaDiary = {};
                learnerProfile = { totalAnswered: 0, totalCorrect: 0, wrongByPos: {}, wrongByGrammarType: {} };
                customQuestions = [];
                selectedQuestionTopics = [];
                customGrammarTables = [];
                pinnedGrammar = {};
                hiddenDefaultGrammar = [];
                masteredGrammar = {};
                hiddenQuestionTopics = [];
                grammarCellHighlights = {};
                eggState = defaultEggState();
            }

            // [냐냐 PATCH-0배치] 통합 점수(score)로 1회 마이그레이션 (기존 약점/마스터 점수 합산)
            if (typeof migrateWordScores === 'function') migrateWordScores();

            // 첫 실행(Firebase가 비어있던 경우)이거나 로컬/예전 데이터로 복구한 경우,
            // 지금 상태를 다시 저장해서 다음부터는 모든 기기가 동기화되도록 함
            saveToStorage();
        }

        function updateSyncBadge(state) {
            const badge = document.getElementById('sync-status-badge');
            if (!badge) return;
            if (state === true) {
                badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span><span class="hidden sm:inline"> 모든 기기 동기화 중</span>`;
                badge.className = "flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 cursor-pointer";
            } else if (state === 'claude-only') {
                badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span><span class="hidden sm:inline"> Claude 안에서만 동기화</span>`;
                badge.className = "flex items-center gap-1.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 cursor-pointer";
            } else if (state === 'no-password') {
                badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-violet-500"></span><span class="hidden sm:inline"> 동기화 비밀번호 설정하기</span>`;
                badge.className = "flex items-center gap-1.5 text-[10px] font-bold text-violet-600 bg-violet-50 px-2.5 py-1 rounded-full border border-violet-200 cursor-pointer";
            } else {
                badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span><span class="hidden sm:inline"> 이 기기에만 저장됨</span>`;
                badge.className = "flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200 cursor-pointer";
            }
        }

        // 학습일지 로그 누적 기록 함수
        // [냐냐 PATCH-날짜버그수정] toISOString()은 UTC 기준이라 한국(UTC+9) 등에서는
        // 날짜가 하루 어긋날 수 있음(특히 자정~오전 9시, 그리고 차트의 날짜 범위 계산에서는
        // 항상 하루씩 밀림). 로컬(내 기기) 시간 기준으로 YYYY-MM-DD를 만드는 함수로 통일.
        // [냐냐 PATCH] 스페인어 여성 목소리 선택 + 공용 읽기 함수
        let _cachedEsVoice = null;
        function pickSpanishVoice() {
            if (_cachedEsVoice) return _cachedEsVoice;
            if (!('speechSynthesis' in window)) return null;
            const voices = window.speechSynthesis.getVoices() || [];
            const esVoices = voices.filter(v => (v.lang || '').toLowerCase().startsWith('es'));
            if (esVoices.length === 0) return null;
            // 여성 이름 힌트 (스페인어권 여성 음성들, 플랫폼별 다양)
            const femaleHints = ['mónica','monica','paulina','helena','laura','marisol','sabina','female','mujer','esperanza','lucia','lucía','conchita','penelope','penélope','elvira','sofia','sofía','ximena','dalia','estrella','camila','isabela','google español','eva','carmen'];
            // 남성 이름 힌트 (이건 피함)
            const maleHints = ['jorge','pablo','diego','carlos','male','hombre','juan','miguel','raul','raúl','enrique','javier','male'];
            const isFemale = (v) => femaleHints.some(h => (v.name || '').toLowerCase().includes(h));
            const isMale = (v) => maleHints.some(h => (v.name || '').toLowerCase().includes(h));
            // 1순위: 여성 이름 매칭 (중남미 es-419/es-MX 포함, 그다음 es-ES)
            let pick = esVoices.find(v => isFemale(v) && (v.lang||'').toLowerCase() === 'es-es')
                    || esVoices.find(v => isFemale(v));
            // 2순위: 남성으로 확인된 음성을 뺀 나머지 (여성일 확률 높음)
            if (!pick) pick = esVoices.find(v => !isMale(v) && (v.lang||'').toLowerCase() === 'es-es')
                            || esVoices.find(v => !isMale(v));
            // 3순위: 그래도 없으면 es-ES 또는 첫 음성
            if (!pick) pick = esVoices.find(v => (v.lang || '').toLowerCase() === 'es-es') || esVoices[0];
            // 음성 목록이 아직 안 불러와졌으면(0개) 캐시하지 않음 → 다음에 다시 시도
            if (esVoices.length === 0) return null;
            _cachedEsVoice = pick;
            return pick;
        }
        // 음성 목록은 비동기로 로드되므로 로드되면 캐시 초기화
        if ('speechSynthesis' in window) {
            window.speechSynthesis.onvoiceschanged = () => { _cachedEsVoice = null; pickSpanishVoice(); };
            try { window.speechSynthesis.getVoices(); } catch (e) {} // 미리 목록 로드 요청
        }
        function speakSpanishVoice(text, rate) {
            // [냐냐 PATCH-0배치] 전역 음소거 시 발음도 나가지 않음
            if (typeof isMuted === 'function' && isMuted()) return;
            if (!('speechSynthesis' in window)) {
                showToast("이 브라우저는 음성 합성을 지원하지 않아요.", "error");
                return;
            }
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'es-ES';
            u.rate = rate || 0.9;
            u.pitch = 1.15; // [냐냐 요청] 살짝 높은 톤 = 더 여성적인 음색
            let voice = pickSpanishVoice();
            // 음성 목록이 아직 로드 안 됐으면 한 번 깨워서 다시 시도
            if (!voice) { window.speechSynthesis.getVoices(); _cachedEsVoice = null; voice = pickSpanishVoice(); }
            if (voice) u.voice = voice;
            window.speechSynthesis.speak(u);
        }

        function getLocalDateString(date = new Date()) {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }

        // [냐냐 PATCH-수준맞춤] 누적된 작은 통계만으로 AI 프롬프트에 넣을 짧은 요약 문장 생성.
        // 전체 기록을 보내지 않고 이 요약 텍스트(보통 100토큰 이내)만 매번 같이 보냄.
        function buildLearnerProfileSummary() {
            const { totalAnswered, totalCorrect, wrongByPos, wrongByGrammarType } = learnerProfile;
            if (totalAnswered < 5) {
                return "학습 데이터가 아직 적어서 평균적인 초급자 기준으로 설명해 주세요.";
            }
            const accuracy = Math.round((totalCorrect / totalAnswered) * 100);
            let level = "초급";
            if (accuracy >= 85 && vocabulary.length >= 50) level = "중상급";
            else if (accuracy >= 70) level = "중급";

            const posNameKo = { noun: '명사', verb: '동사', adjective: '형용사', adverb: '부사', preposition: '전치사', conjunction: '접속사', pronoun: '대명사', phrase: '구문' };
            const weakPos = Object.entries(wrongByPos).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([pos]) => posNameKo[pos] || pos);
            const weakGrammar = Object.entries(wrongByGrammarType || {}).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([t]) => t);

            let summary = `학습자 수준: ${level} (정답률 ${accuracy}%, 총 ${totalAnswered}문제 풀이, 등록 단어 ${vocabulary.length}개).`;
            if (weakPos.length > 0) {
                summary += ` 자주 틀리는 품사: ${weakPos.join(', ')}.`;
            }
            if (weakGrammar.length > 0) {
                summary += ` 자유 작문에서 자주 틀리는 문법 유형: ${weakGrammar.join(', ')}.`;
            }
            summary += ` 이 수준에 맞게 문장 난이도와 설명의 깊이를 조절해 주세요 (초급이면 더 짧고 쉬운 표현, 중상급이면 더 자연스럽고 다양한 표현 사용). 자주 틀리는 문법 유형이 있다면 가능하면 그 부분을 다시 짚어주거나 비슷한 연습이 되도록 신경써 주세요.`;
            return summary;
        }

        function touchDiarySnapshot() {
            const today = getLocalDateString();
            if (!nyanyaDiary[today]) {
                nyanyaDiary[today] = { registeredTotal: 0, masteredTotal: 0, quizTotal: 0, quizCorrect: 0, aiSessions: 0, newWordsCount: 0, newMasteredCount: 0, reviewCount: 0, gameCount: 0, newGrammarCount: 0, newGrammarMasteredCount: 0 };
            }
            // 마이그레이션: 예전 데이터 구조(punches/quizzes/masters)가 남아있어도 안전하게 새 필드로 보강
            const d = nyanyaDiary[today];
            if (d.registeredTotal === undefined) d.registeredTotal = 0;
            if (d.masteredTotal === undefined) d.masteredTotal = 0;
            if (d.quizTotal === undefined) d.quizTotal = d.quizzes || 0;
            if (d.quizCorrect === undefined) d.quizCorrect = 0;
            if (d.aiSessions === undefined) d.aiSessions = 0;
            if (d.newWordsCount === undefined) d.newWordsCount = 0;
            if (d.newMasteredCount === undefined) d.newMasteredCount = 0;
            if (d.newPerfectCount === undefined) d.newPerfectCount = 0; // [냐냐 PATCH-0배치]

            d.registeredTotal = vocabulary.length;
            d.masteredTotal = vocabulary.filter(w => w.mastered).length;
            // [냐냐 PATCH-0배치] 등급별 총계 스냅샷 (단어장 성장 그래프의 비율용) — 오늘부터 쌓임
            d.perfectTotal = vocabulary.filter(w => typeof getWordGrade === 'function' && getWordGrade(w) === 'perfect').length;
            d.weakTotal = vocabulary.filter(w => typeof getWordGrade === 'function' && getWordGrade(w) === 'weak').length;
            d.criticalTotal = vocabulary.filter(w => typeof getWordGrade === 'function' && getWordGrade(w) === 'critical').length;
        }

        // ============================================================
        // [냐냐 PATCH] 연속 학습일(streak) 계산 — nyanyaDiary(날짜별 기록) 기반
        // ============================================================
        function calcStreak() {
            const dates = Object.keys(nyanyaDiary || {}).filter(d => {
                const log = nyanyaDiary[d];
                // 하루 총 활동(퀴즈 문제 + AI 첨삭 + 새 단어)이 5개 이상인 날만 "학습한 날"로 인정
                if (!log) return false;
                const total = (log.quizTotal || 0) + (log.aiSessions || 0) + (log.newWordsCount || 0);
                return total >= 5;
            }).sort(); // 오름차순
            if (dates.length === 0) return 0;

            const toDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const oneDay = 86400000;

            // 가장 최근 학습일이 오늘이거나 어제여야 streak 유효
            const last = toDate(dates[dates.length - 1]);
            const daysSinceLast = Math.round((today - last) / oneDay);
            if (daysSinceLast > 1) return 0; // 이틀 이상 공백이면 streak 끊김

            // 최근 학습일부터 거꾸로 연속된 날 세기
            let streak = 1;
            for (let i = dates.length - 1; i > 0; i--) {
                const cur = toDate(dates[i]);
                const prev = toDate(dates[i - 1]);
                const gap = Math.round((cur - prev) / oneDay);
                if (gap === 1) streak++;
                else break;
            }
            return streak;
        }

        // [냐냐 PATCH] 학습 히트맵 (깃허브 잔디 스타일) — 최근 약 17주
        // ============================================================
        // [냐냐 PATCH] 미스터리 알 키우기 🥚 — 학습하면 알이 자라고 부화해서 정체불명 생물이 나옴!
        // ============================================================
        let eggState = null;
        function defaultEggState() {
            return {
                progress: 0,        // 현재 알의 누적 학습 포인트
                collection: [],     // 부화시킨 생물들의 id 목록 (도감)
                totalHatched: 0,    // 총 부화 수
                lastCountedTotal: null // 학습량 델타 계산용 (총 학습 활동 수 스냅샷)
            };
        }

        // 부화에 필요한 포인트
        const EGG_HATCH_GOAL = 500;


        const RARITY_INFO = {
            common:    { label: '일반',   color: 'text-slate-500',  bg: 'bg-slate-100',   star: '⭐' },
            rare:      { label: '레어',   color: 'text-blue-600',   bg: 'bg-blue-50',     star: '⭐⭐' },
            epic:      { label: '에픽',   color: 'text-violet-600', bg: 'bg-violet-50',   star: '⭐⭐⭐' },
            legendary: { label: '전설',   color: 'text-amber-600',  bg: 'bg-amber-50',    star: '👑' },
        };

        // 총 학습 활동 수 (누적) — 알 성장의 기준
        function totalLearningActivity() {
            let sum = 0;
            for (const k in nyanyaDiary) {
                const d = nyanyaDiary[k];
                sum += (d.quizTotal || 0) + (d.aiSessions || 0) + (d.newWordsCount || 0) + (d.reviewCount || 0) + (d.gameCount || 0);
            }
            return sum;
        }

        // 학습할 때마다 호출 — 델타만큼 알 성장, 목표 도달 시 부화
        function updateEggProgress() {
            if (!eggState) eggState = defaultEggState();
            const total = totalLearningActivity();
            if (eggState.lastCountedTotal === null) {
                // 첫 실행: 기준점만 잡고 성장은 다음부터 (기존 학습량으로 갑자기 부화 방지)
                eggState.lastCountedTotal = total;
                renderEgg();
                return;
            }
            const delta = total - eggState.lastCountedTotal;
            if (delta > 0) {
                eggState.progress += delta;
                eggState.lastCountedTotal = total;
                // 부화 체크
                while (eggState.progress >= EGG_HATCH_GOAL) {
                    eggState.progress -= EGG_HATCH_GOAL;
                    hatchEgg();
                }
                saveToStorage();
            }
            renderEgg();
        }

        // 희귀도 뽑기 — 연속학습일/정답률이 높으면 희귀 확률 UP
        function rollRarity() {
            const streak = (typeof calcStreak === 'function') ? calcStreak() : 0;
            const acc = (learnerProfile && learnerProfile.totalAnswered >= 5)
                ? (learnerProfile.totalCorrect / learnerProfile.totalAnswered) : 0.5;
            // 보너스: 연속 7일+ 이거나 정답률 80%+ 이면 희귀 확률 상승
            let bonus = 0;
            if (streak >= 7) bonus += 0.08;
            if (streak >= 30) bonus += 0.07;
            if (acc >= 0.8) bonus += 0.08;

            const r = Math.random();
            // 기본 확률: legendary 2%, epic 8%, rare 25%, common 65% (+bonus는 상위 등급으로)
            if (r < 0.02 + bonus * 0.5) return 'legendary';
            if (r < 0.10 + bonus) return 'epic';
            if (r < 0.35 + bonus) return 'rare';
            return 'common';
        }

        function hatchEgg() {
            const rarity = rollRarity();
            const pool = CREATURES.filter(c => c.rarity === rarity);
            const creature = pool[Math.floor(Math.random() * pool.length)];
            eggState.collection.push(creature.id);
            eggState.totalHatched = (eggState.totalHatched || 0) + 1;
            // 부화 축하 팝업
            showHatchCelebration(creature);
        }

        function showHatchCelebration(creature) {
            const info = RARITY_INFO[creature.rarity];
            const isNew = eggState.collection.filter(id => id === creature.id).length === 1;
            if (typeof AudioFX !== 'undefined' && AudioFX.playSuccess) AudioFX.playSuccess();
            showConfirm(
                `🎉 부화 성공!`,
                `${creature.emoji} ${creature.name} (${info.label} ${info.star})\n\n${creature.desc}${isNew ? '\n\n✨ 도감에 새로 추가됐어요!' : '\n\n(이미 도감에 있어요)'}`,
                () => { changeTab('records'); setTimeout(renderEgg, 100); },
                { okLabel: '도감 보기', cancelLabel: '닫기', okStyle: 'primary' }
            );
        }

        // 알 성장 단계 (progress 비율에 따라)
        function eggStageVisual(ratio) {
            // [냐냐 PATCH] 부화 과정 세분화 (7단계)
            if (ratio < 0.14) return { emoji: '🥚', label: '갓 태어난 알이에요', anim: '' };
            if (ratio < 0.28) return { emoji: '🥚', label: '알이 따뜻해지고 있어요', anim: 'scale-105' };
            if (ratio < 0.43) return { emoji: '🥚', label: '알이 조금 커졌어요', anim: 'scale-105' };
            if (ratio < 0.57) return { emoji: '🥚', label: '알 속에서 뭔가 움직여요', anim: 'scale-110' };
            if (ratio < 0.71) return { emoji: '🥚', label: '알이 꿈틀거려요!', anim: 'scale-110 animate-pulse' };
            if (ratio < 0.85) return { emoji: '🐣', label: '작은 금이 생겼어요!', anim: 'scale-110 animate-pulse' };
            if (ratio < 0.95) return { emoji: '🐣', label: '쩍! 금이 크게 갔어요', anim: 'scale-125 animate-bounce' };
            return { emoji: '💥', label: '곧 부화해요!! 두근두근', anim: 'scale-125 animate-bounce' };
        }

        let eggCollectionOpen = false; // [냐냐 PATCH] 도감 접힘 상태 (기본 접힘)
        function renderEgg() {
            const container = document.getElementById('egg-widget');
            if (!eggState) eggState = defaultEggState();
            if (!Array.isArray(eggState.collection)) eggState.collection = [];
            const ratio = Math.min(1, eggState.progress / EGG_HATCH_GOAL);
            const stage = eggStageVisual(ratio);
            const pct = Math.round(ratio * 100);
            const remain = Math.max(0, EGG_HATCH_GOAL - eggState.progress);

            if (container) {
                container.innerHTML = `
                    <div class="flex items-center gap-2 mb-3">
                        <span class="text-lg">🥚</span>
                        <div>
                            <h3 class="text-sm font-black text-slate-800">미스터리 알 키우기</h3>
                            <p class="text-[11px] text-indigo-500">학습할수록 알이 자라요. 뭐가 나올진 부화해봐야!</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-4">
                        <div class="text-6xl shrink-0 transition-transform duration-500 ${stage.anim}">${stage.emoji}</div>
                        <div class="flex-1 min-w-0 space-y-2">
                            <p class="text-sm font-black text-slate-800">${stage.label}</p>
                            <div>
                                <div class="h-2.5 bg-white/70 rounded-full overflow-hidden">
                                    <div class="h-full bg-gradient-to-r from-indigo-400 to-violet-500 transition-all duration-500" style="width:${pct}%"></div>
                                </div>
                                <p class="text-[11px] text-slate-400 mt-1">부화까지 <b class="text-indigo-500">${remain}</b> 학습 남음 (${pct}%)</p>
                            </div>
                            <p class="text-[11px] text-slate-500">🐣 <b class="text-violet-600">${eggState.totalHatched || 0}마리</b> 부화 · 📖 도감 <b class="text-emerald-600">${new Set(eggState.collection).size}/${CREATURES.length}</b></p>
                        </div>
                    </div>
                `;
            }
            // 도감(별도 하단 섹션)도 같이 갱신
            renderEggCollectionSection();
        }

        // [냐냐 PATCH] 생물 도감 — 하단 별도 섹션 (접힘 기본)
        function renderEggCollectionSection() {
            const sec = document.getElementById('egg-collection-section');
            if (!sec) return;
            if (!eggState) eggState = defaultEggState();
            if (!Array.isArray(eggState.collection)) eggState.collection = [];
            const uniqueCount = new Set(eggState.collection).size;
            sec.innerHTML = `
                <button onclick="toggleEggCollection()" class="w-full flex items-center justify-between gap-2">
                    <span class="flex items-center gap-2 text-left">
                        <span class="text-sm">🗂️</span>
                        <span class="text-xs font-bold text-slate-700">생물 도감 <span class="font-normal text-slate-400">(${uniqueCount}/${CREATURES.length} 수집)</span></span>
                    </span>
                    <i class="fa-solid fa-chevron-up text-slate-400 text-xs transition-transform shrink-0 ${eggCollectionOpen ? '' : 'rotate-180'}"></i>
                </button>
                <div id="egg-collection-body" class="${eggCollectionOpen ? '' : 'hidden'}">
                    ${renderCollectionGrid()}
                </div>
            `;
        }

        function toggleEggCollection() {
            eggCollectionOpen = !eggCollectionOpen;
            renderEggCollectionSection();
        }

        // [냐냐 PATCH] 도감: 희귀도(모으기 힘든 순) 정렬 + '모은 것만 보기' 필터
        let eggCollectionOwnedOnly = false;
        const RARITY_ORDER = { legendary: 0, epic: 1, rare: 2, common: 3 }; // 힘든 순
        function toggleEggOwnedOnly() {
            eggCollectionOwnedOnly = !eggCollectionOwnedOnly;
            renderEggCollectionSection();
        }

        function renderCollectionGrid() {
            if (!eggState) eggState = defaultEggState();
            if (!Array.isArray(eggState.collection)) eggState.collection = [];
            const owned = new Set(eggState.collection);
            const counts = {};
            eggState.collection.forEach(id => counts[id] = (counts[id] || 0) + 1);

            // 희귀도 순 정렬 (전설 → 에픽 → 레어 → 일반), 같은 등급이면 원래 순서 유지
            let list = CREATURES.map((c, i) => ({ ...c, _i: i }))
                .sort((a, b) => (RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]) || (a._i - b._i));
            if (eggCollectionOwnedOnly) list = list.filter(c => owned.has(c.id));

            // 등급별 수집 현황 요약
            const summary = ['legendary', 'epic', 'rare', 'common'].map(r => {
                const info = RARITY_INFO[r];
                const total = CREATURES.filter(c => c.rarity === r).length;
                const got = CREATURES.filter(c => c.rarity === r && owned.has(c.id)).length;
                return `<span class="text-[10px] font-bold ${info.color} ${info.bg} px-1.5 py-0.5 rounded-md">${info.star} ${info.label} ${got}/${total}</span>`;
            }).join('');

            const cells = list.map(c => {
                const has = owned.has(c.id);
                const info = RARITY_INFO[c.rarity];
                if (has) {
                    return `<div class="relative flex flex-col items-center text-center gap-1 p-2.5 rounded-2xl ${info.bg} border border-slate-100">
                        ${counts[c.id] > 1 ? `<span class="absolute top-1 right-1.5 text-[10px] font-black ${info.color} bg-white/80 rounded-full px-1.5 py-0.5 shadow-sm">×${counts[c.id]}</span>` : ''}
                        <span class="absolute top-1 left-1.5 text-[9px]">${info.star}</span>
                        <span class="text-3xl">${c.emoji}</span>
                        <span class="text-[13px] font-black ${info.color} leading-tight">${c.name}</span>
                        <span class="text-[10px] text-slate-600 leading-snug">${c.desc}</span>
                    </div>`;
                } else {
                    return `<div class="relative flex flex-col items-center justify-center gap-1 p-2.5 rounded-2xl bg-slate-50 border border-slate-100 opacity-60">
                        <span class="absolute top-1 left-1.5 text-[9px] opacity-50">${info.star}</span>
                        <span class="text-3xl grayscale">❔</span>
                        <span class="text-[13px] font-bold text-slate-300 leading-tight">???</span>
                        <span class="text-[10px] text-slate-400">아직 못 만났어요</span>
                    </div>`;
                }
            }).join('');

            const emptyMsg = (eggCollectionOwnedOnly && list.length === 0)
                ? '<p class="text-xs text-slate-400 text-center py-6">아직 모은 생물이 없어요! 알을 부화시켜 보세요 🥚</p>' : '';

            return `
                <div class="mt-3 space-y-2">
                    <div class="flex items-center justify-between gap-2 flex-wrap">
                        <div class="flex items-center gap-1 flex-wrap">${summary}</div>
                        <button onclick="toggleEggOwnedOnly()" class="text-[10px] font-bold px-2 py-1 rounded-lg border transition-all ${eggCollectionOwnedOnly ? 'border-violet-500 bg-violet-50 text-violet-600' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}">
                            <i class="fa-solid ${eggCollectionOwnedOnly ? 'fa-check' : 'fa-eye'} text-[9px] mr-0.5"></i>모은 것만 보기
                        </button>
                    </div>
                    ${emptyMsg}
                    <div class="grid grid-cols-3 gap-2">${cells}</div>
                </div>`;
        }

        // [냐냐 PATCH] 학습 달력 상태
        let calView = 'month'; // 'month' | 'year' | 'decade'
        let calYear = new Date().getFullYear();
        let calMonth = new Date().getMonth(); // 0-11

        function dayActivity(dateStr) {
            const d = nyanyaDiary[dateStr];
            if (!d) return 0;
            return (d.quizTotal || 0) + (d.aiSessions || 0) + (d.newWordsCount || 0) + (d.reviewCount || 0) + (d.gameCount || 0);
        }
        function fmtDate(dt) {
            return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
        }
        // 상대평가 색상: 그 화면에서 가장 많이 한 값(maxVal) 대비 비율로 진하기 결정 (12단계)
        function calColor(n, maxVal) {
            if (n === 0) return 'bg-slate-100 border border-slate-200 text-slate-400';
            const ratio = maxVal > 0 ? n / maxVal : 0;
            // 12단계 색상 (연함 → 진함)
            const steps = [
                'bg-emerald-50 text-emerald-700',
                'bg-emerald-100 text-emerald-700',
                'bg-emerald-200 text-emerald-800',
                'bg-emerald-300 text-emerald-900',
                'bg-emerald-400 text-white',
                'bg-emerald-500 text-white',
                'bg-emerald-600 text-white',
                'bg-emerald-700 text-white',
                'bg-emerald-800 text-white',
                'bg-teal-800 text-white',
                'bg-teal-900 text-white',
                'bg-emerald-950 text-white',
            ];
            // ratio 0~1 을 1~12 단계로 매핑 (최소 1단계)
            let idx = Math.ceil(ratio * steps.length) - 1;
            if (idx < 0) idx = 0;
            if (idx >= steps.length) idx = steps.length - 1;
            return steps[idx];
        }

        // [냐냐 PATCH] 달력 날짜 클릭 → 그날 상세 기록 (툴팁이 안 보일 때도 확실히 보이게)
        function showCalendarDayDetail(ds) {
            const box = document.getElementById('calendar-day-detail');
            if (!box) return;
            const log = (nyanyaDiary && nyanyaDiary[ds]) || {};
            const items = [
                ['등록 단어', log.newWordsCount || 0, '개', 'text-violet-600'],
                ['마스터 단어', log.newMasteredCount || 0, '개', 'text-emerald-600'],
                ['등록 문법', log.newGrammarCount || 0, '개', 'text-[#5896cb]'],
                ['마스터 문법', log.newGrammarMasteredCount || 0, '개', 'text-emerald-600'],
                ['퀴즈', log.quizTotal || 0, '문제', 'text-amber-600'],
                ['AI 첨삭', log.aiSessions || 0, '회', 'text-indigo-600'],
                ['복습', log.reviewCount || 0, '개', 'text-sky-600'],
                ['게임', log.gameCount || 0, '판', 'text-pink-600'],
            ];
            const total = items.reduce((s, x) => s + x[1], 0);
            const grid = items.map(([label, val, unit, color]) =>
                `<div class="flex items-center justify-between bg-white/70 rounded-lg px-2 py-1">
                    <span class="text-slate-500">${label}</span>
                    <span class="font-bold ${val > 0 ? color : 'text-slate-300'}">${val}${unit}</span>
                </div>`).join('');
            box.classList.remove('hidden');
            box.innerHTML = `
                <div class="flex items-center justify-between mb-2">
                    <span class="font-black text-slate-700">${fmtDateSlash(ds)} ${total > 0 ? `<span class="text-violet-600">· 총 ${total}개 활동</span>` : '<span class="text-slate-400 font-bold">· 학습 기록 없음</span>'}</span>
                    <button onclick="document.getElementById('calendar-day-detail').classList.add('hidden')" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark"></i></button>
                </div>
                ${total > 0 ? `<div class="grid grid-cols-2 gap-1">${grid}</div>` : '<p class="text-slate-400 text-center py-1">이 날은 쉬어갔네요 🌙</p>'}
            `;
        }

        function renderCalendar() {
            const container = document.getElementById('learning-calendar');
            const titleEl = document.getElementById('cal-title');
            if (!container || !titleEl) return;

            if (calView === 'month') {
                titleEl.innerText = `${calYear}년 ${calMonth + 1}월`;
                const first = new Date(calYear, calMonth, 1);
                const startDow = first.getDay(); // 0=일
                const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
                // 이달 최대 학습량 (상대평가 기준)
                let maxVal = 0;
                for (let d = 1; d <= daysInMonth; d++) {
                    const v = dayActivity(fmtDate(new Date(calYear, calMonth, d)));
                    if (v > maxVal) maxVal = v;
                }
                const todayStr = getLocalDateString();
                const dowHead = ['일','월','화','수','목','금','토'].map((d, i) =>
                    `<div class="text-center text-[10px] font-bold ${i===0?'text-rose-400':i===6?'text-blue-400':'text-slate-400'}">${d}</div>`).join('');
                let cells = '';
                for (let i = 0; i < startDow; i++) cells += `<div></div>`;
                for (let d = 1; d <= daysInMonth; d++) {
                    const ds = fmtDate(new Date(calYear, calMonth, d));
                    const n = dayActivity(ds);
                    const isToday = ds === todayStr;
                    // [냐냐 PATCH] 지나간 날인데 학습 기록이 0이면 은은한 회색 ✗ (빨강은 부담스러워서 부드럽게)
                    const isPast = ds < todayStr;
                    const showX = isPast && n === 0;
                    const inner = showX
                        ? `<span class="relative flex items-center justify-center w-full h-full"><span class="text-slate-300">${d}</span><i class="fa-solid fa-xmark absolute text-slate-300/60 text-[13px]"></i></span>`
                        : `${d}`;
                    cells += `<div onclick="showCalendarDayDetail('${ds}')" class="aspect-square rounded-md flex items-center justify-center text-[10px] font-bold cursor-pointer hover:ring-2 hover:ring-violet-300 transition-all ${calColor(n, maxVal)} ${isToday ? 'ring-2 ring-violet-400' : ''}" title="${fmtDateSlash(ds)} · ${showX ? '학습 없음' : n + '개 학습'} (클릭하면 상세)">${inner}</div>`;
                }
                container.innerHTML = `<div class="grid grid-cols-7 gap-1 mb-1">${dowHead}</div><div class="grid grid-cols-7 gap-1">${cells}</div>`;
            } else if (calView === 'year') {
                titleEl.innerText = `${calYear}년`;
                // 각 월의 총 학습량
                const monthVals = [];
                for (let m = 0; m < 12; m++) {
                    const dim = new Date(calYear, m + 1, 0).getDate();
                    let sum = 0;
                    for (let d = 1; d <= dim; d++) sum += dayActivity(fmtDate(new Date(calYear, m, d)));
                    monthVals.push(sum);
                }
                const maxVal = Math.max(...monthVals);
                const cells = monthVals.map((v, m) =>
                    `<button onclick="calPickMonth(${m})" class="aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-bold ${calColor(v, maxVal)} transition-all hover:ring-2 hover:ring-violet-300" title="${calYear}년 ${m+1}월 · ${v}개 학습">
                        <span>${m + 1}월</span>
                        <span class="text-[9px] opacity-80">${v}</span>
                    </button>`).join('');
                container.innerHTML = `<div class="grid grid-cols-3 gap-2">${cells}</div>`;
            } else { // decade
                const startY = Math.floor(calYear / 10) * 10;
                titleEl.innerText = `${startY} ~ ${startY + 9}`;
                const yearVals = [];
                for (let y = startY; y < startY + 10; y++) {
                    let sum = 0;
                    for (const ds in nyanyaDiary) {
                        if (ds.startsWith(String(y))) sum += dayActivity(ds);
                    }
                    yearVals.push({ year: y, val: sum });
                }
                const maxVal = Math.max(...yearVals.map(x => x.val));
                const cells = yearVals.map(x =>
                    `<button onclick="calPickYear(${x.year})" class="aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-bold ${calColor(x.val, maxVal)} transition-all hover:ring-2 hover:ring-violet-300" title="${x.year}년 · ${x.val}개 학습">
                        <span>${x.year}</span>
                        <span class="text-[9px] opacity-80">${x.val}</span>
                    </button>`).join('');
                container.innerHTML = `<div class="grid grid-cols-3 gap-2">${cells}</div>`;
            }
        }

        // 제목 클릭 → 확대 (월→연→연도별)
        function calZoomOut() {
            if (calView === 'month') calView = 'year';
            else if (calView === 'year') calView = 'decade';
            renderCalendar();
        }
        // 연 화면에서 월 클릭 → 그 월 상세
        function calPickMonth(m) {
            calMonth = m;
            calView = 'month';
            renderCalendar();
        }
        // 연도별 화면에서 연도 클릭 → 그 해 월별
        function calPickYear(y) {
            calYear = y;
            calView = 'year';
            renderCalendar();
        }
        // 이전/다음 (화면 단위로)
        function calNav(dir) {
            if (calView === 'month') {
                calMonth += dir;
                if (calMonth < 0) { calMonth = 11; calYear--; }
                else if (calMonth > 11) { calMonth = 0; calYear++; }
            } else if (calView === 'year') {
                calYear += dir;
            } else {
                calYear += dir * 10;
            }
            renderCalendar();
        }

        function renderStreakBadge() {
            const streak = calcStreak();
            // 최고 기록 갱신 (learnerProfile에 저장)
            if (typeof learnerProfile !== 'undefined' && learnerProfile) {
                if (!learnerProfile.bestStreak) learnerProfile.bestStreak = 0;
                if (streak > learnerProfile.bestStreak) {
                    learnerProfile.bestStreak = streak;
                    saveToStorage();
                }
            }
            const best = (typeof learnerProfile !== 'undefined' && learnerProfile) ? (learnerProfile.bestStreak || 0) : 0;

            // 학습기록 탭의 연속 학습일 카드 갱신
            const mainEl = document.getElementById('streak-main');
            const bestEl = document.getElementById('streak-best');
            const fireEl = document.getElementById('streak-fire');
            if (mainEl && bestEl) {
                if (streak >= 1) {
                    mainEl.innerText = `${streak}일 연속`;
                    mainEl.className = "text-2xl font-black text-orange-700 leading-tight";
                    if (fireEl) fireEl.innerText = "🔥";
                    if (best === streak && best > 1) {
                        bestEl.innerText = `🎉 최고 기록 갱신 중! (${best}일)`;
                    } else {
                        bestEl.innerText = `최고 기록: ${best}일`;
                    }
                } else {
                    // 연속 끊김
                    mainEl.innerText = "0일 연속";
                    mainEl.className = "text-2xl font-black text-slate-400 leading-tight";
                    if (fireEl) fireEl.innerText = "❄️";
                    bestEl.innerText = best >= 1 ? `최고 기록: ${best}일` : "아직 기록이 없어요";
                }
            }

            // 사이드바 일일 학습일지의 연속 학습일 줄 갱신
            const diaryLine = document.getElementById('diary-streak-line');
            const diaryDays = document.getElementById('diary-streak-days');
            const diaryBest = document.getElementById('diary-streak-best');
            const diaryFire = document.getElementById('diary-streak-fire');
            if (diaryLine && diaryDays && diaryBest) {
                if (streak >= 1 || best >= 1) {
                    diaryLine.classList.remove('hidden');
                    diaryDays.innerText = `${streak}일 연속`;
                    diaryBest.innerText = `최고 ${best}일`;
                    if (diaryFire) diaryFire.innerText = streak >= 1 ? "🔥" : "❄️";
                    diaryDays.className = streak >= 1 ? "text-orange-700" : "text-slate-400";
                } else {
                    diaryLine.classList.add('hidden');
                }
            }
        }

        // [냐냐 PATCH-0배치] 오늘 복습하면 좋은 단어 = 오늘 틀린 단어. 통합 점수 낮은(=약한) 순.
        function getTodayReviewWords() {
            const today = getLocalDateString();
            return vocabulary
                .filter(w => w.lastWrongDate === today && !w.mastered)
                .sort((a, b) => getScore(a) - getScore(b));
        }

        // [냐냐 PATCH] 단어별 정답률 (이번 통계 기간 동안). 시도 3회 미만이면 null(표시 안 함)
        function getWordAccuracy(w) {
            const c = w.correctTotal || 0;
            const x = w.wrongTotal || 0;
            const total = c + x;
            if (total < 3) return null; // 데이터 적으면 신뢰 어려움
            return Math.round(c / total * 100);
        }

        // [냐냐 PATCH] 정답률 통계 주기적 초기화 (기본 1달마다) — 최근 실력만 반영
        const STATS_RESET_MONTHS = 1; // 몇 달마다 초기화할지 (1 또는 2)
        function currentStatsPeriod() {
            const d = new Date();
            // STATS_RESET_MONTHS 단위로 기간 키 생성 (예: 1달=매월, 2달=격월)
            const periodIndex = Math.floor(d.getMonth() / STATS_RESET_MONTHS);
            return `${d.getFullYear()}-${periodIndex}`;
        }
        function checkStatsReset() {
            const saved = localStorage.getItem('nyanya_stats_period');
            const now = currentStatsPeriod();
            if (saved && saved !== now) {
                // 기간이 바뀌었으면 모든 단어의 정답/오답 카운터 초기화
                vocabulary.forEach(w => { w.correctTotal = 0; w.wrongTotal = 0; });
                try { saveToStorage(); } catch (e) {}
            }
            try { localStorage.setItem('nyanya_stats_period', now); } catch (e) {}
        }

        // [냐냐 PATCH] 망각곡선 복습 — 틀린 날로부터 며칠 지났는지 계산
        function daysSince(dateStr) {
            if (!dateStr) return -1;
            const parts = dateStr.split('-').map(Number);
            if (parts.length !== 3) return -1;
            const then = new Date(parts[0], parts[1] - 1, parts[2]);
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            then.setHours(0, 0, 0, 0);
            return Math.round((now - then) / (1000 * 60 * 60 * 24));
        }

        // 망각곡선 복습 주기 (일). 이 날짜에 해당하면 복습 대상
        const REVIEW_INTERVALS = [1, 3, 7, 14, 30];

        // 오늘 복습해야 할 단어 (오늘 틀린 것 + 복습 주기에 도달한 것)
        function getReviewDueWords() {
            return vocabulary.filter(w => {
                if (w.mastered || !w.lastWrongDate) return false;
                const d = daysSince(w.lastWrongDate);
                // 오늘(0일) 또는 복습 주기(1,3,7,14,30일)에 해당
                return d === 0 || REVIEW_INTERVALS.includes(d);
            }).sort((a, b) => getScore(a) - getScore(b)); // [냐냐 PATCH-0배치] 점수 낮은(=약한) 순
        }

        // [냐냐 PATCH] 오늘 틀린 단어만 단어장에 필터링해서 보여주기
        let todayWrongFilterActive = false;
        function showTodayWrongInList() {
            todayWrongFilterActive = true;
            // 다른 필터는 초기화
            const filter = document.getElementById('mastery-filter-select');
            if (filter) filter.value = 'all';
            const sortSel = document.getElementById('sort-select');
            if (sortSel) sortSel.value = 'weak-score';
            renderWordList();
            const grid = document.getElementById('vocabulary-grid');
            if (grid) setTimeout(() => grid.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
            showToast("오늘 복습할 단어를 모아서 보여드려요! 📖", "info");
        }

        function renderTodayReview() {
            // [냐냐 PATCH] 단어장 알림 박스 제거됨 (단어 복습 탭에서 복습). 호환용 빈 함수.
            const box = document.getElementById('today-review-box');
            if (!box) return;
            const words = getReviewDueWords(); // [냐냐 PATCH] 망각곡선 복습 대상
            const countEl = document.getElementById('today-review-count');
            if (countEl) countEl.innerText = words.length;
            if (words.length === 0) {
                box.classList.add('hidden');
            } else {
                box.classList.remove('hidden');
            }
        }

        // ============================================================
        // [냐냐 PATCH-0배치] 점수 통합 — 약점점수/마스터점수 두 축을 하나(score)로
        //   score: -10 ~ +10 (0.1 단위)
        //     +8 이상  = 완벽 (찐초록)
        //     +5 ~ +7  = 마스터 (연초록)  ※ 주관식 정답 경험(subjectivePassed) 필요
        //     -2 ~ +4  = 일반 (회색)
        //     -3 ~ -7  = 약점 (노랑)
        //     -8 이하  = 치명적 약점 (빨강)
        // ============================================================
        const SCORE_MIN = -10;
        const SCORE_MAX = 10;
        const SCORE_MASTER = 5;   // 마스터 기준선
        const SCORE_PERFECT = 8;  // 완벽 기준선
        const SCORE_WEAK = -3;    // 약점 기준선
        const SCORE_CRITICAL = -8; // 치명적 약점 기준선

        function clampScore(n) {
            const v = Math.max(SCORE_MIN, Math.min(SCORE_MAX, n));
            return Math.round(v * 10) / 10; // 소수 첫째자리까지
        }

        // 단어의 현재 점수 (없으면 0)
        function getScore(w) {
            return (w && typeof w.score === 'number') ? w.score : 0;
        }

        // 점수 → 등급
        function getWordGrade(w) {
            const s = getScore(w);
            if (s >= SCORE_PERFECT && w.subjectivePassed) return 'perfect';
            if (s >= SCORE_MASTER && w.subjectivePassed) return 'mastered';
            if (s <= SCORE_CRITICAL) return 'critical';
            if (s <= SCORE_WEAK) return 'weak';
            return 'normal';
        }

        const GRADE_INFO = {
            perfect:  { label: '완벽',        emoji: '🟢', badge: 'bg-emerald-600 text-white' },
            mastered: { label: '마스터',      emoji: '🟩', badge: 'bg-emerald-100 text-emerald-700' },
            normal:   { label: '일반',        emoji: '⬜', badge: 'bg-slate-100 text-slate-500' },
            weak:     { label: '약점',        emoji: '🟨', badge: 'bg-amber-100 text-amber-700' },
            critical: { label: '치명적 약점', emoji: '🟥', badge: 'bg-red-100 text-red-600' }
        };

        // 점수 표시용 문자열 (+5 / -3.5 / 0)
        function formatScore(w) {
            const s = getScore(w);
            const txt = (Math.round(s * 10) / 10).toString();
            return s > 0 ? '+' + txt : txt;
        }

        // 점수 → mastered / weak 플래그 동기화 (+ 일지 카운트 증감)
        function syncWordFlags(w, opts = {}) {
            const silent = !!opts.silent; // 마이그레이션 등에서는 일지를 건드리지 않음
            const grade = getWordGrade(w);
            const shouldMaster = (grade === 'perfect' || grade === 'mastered');
            const shouldWeak = (grade === 'weak' || grade === 'critical');
            const wasMastered = !!w.mastered;
            const wasPerfect = !!w.perfect;
            const isPerfect = (grade === 'perfect');

            w.mastered = shouldMaster;
            w.weak = shouldWeak;
            w.perfect = isPerfect;

            if (!silent) {
                if (!wasMastered && shouldMaster) logAction('new-mastered');
                else if (wasMastered && !shouldMaster) logAction('undo-new-mastered');
                if (!wasPerfect && isPerfect) logAction('new-perfect');
                else if (wasPerfect && !isPerfect) logAction('undo-new-perfect');
            }
        }

        // ⭐핵심⭐ 모든 점수 변동은 이 함수를 통해서만!
        //   addWordScore(wordId또는단어객체, 증감점수, { correct: true|false|null, subjective: true })
        function addWordScore(wordOrId, delta, opts = {}) {
            const w = (typeof wordOrId === 'string')
                ? vocabulary.find(v => v.id === wordOrId)
                : wordOrId;
            if (!w) return null;

            if (typeof w.score !== 'number') w.score = 0;

            // 정답률 카운터 + 틀린 날짜
            if (opts.correct === true) {
                w.correctTotal = (w.correctTotal || 0) + 1;
                if (opts.subjective) w.subjectivePassed = true; // 마스터 필수 조건
            } else if (opts.correct === false) {
                w.wrongTotal = (w.wrongTotal || 0) + 1;
                w.lastWrongDate = getLocalDateString(); // '오늘 복습' 목록에 자동 등장
            }

            w.score = clampScore(w.score + (delta || 0));
            syncWordFlags(w);
            return w.score;
        }

        // 수동 설정 (별표/마스터 버튼용) — 점수를 특정 값으로 못박음
        function setWordScore(wordOrId, value, opts = {}) {
            const w = (typeof wordOrId === 'string')
                ? vocabulary.find(v => v.id === wordOrId)
                : wordOrId;
            if (!w) return null;
            w.score = clampScore(value);
            if (opts.subjectivePassed === true) w.subjectivePassed = true;
            if (opts.subjectivePassed === false) w.subjectivePassed = false;
            syncWordFlags(w);
            return w.score;
        }

        // 기존 데이터 → 통합 점수로 1회 변환 (score = 마스터점수 - 약점점수)
        function migrateWordScores() {
            if (!Array.isArray(vocabulary)) return;
            vocabulary.forEach(w => {
                if (typeof w.score !== 'number') {
                    const oldMaster = (typeof w.masterScore === 'number') ? w.masterScore : 0;
                    const oldWeak = (typeof w.weakScore === 'number') ? w.weakScore : 0;
                    // 예전에 수동 마스터였던 단어는 만점 유지
                    if (w.mastered && oldMaster >= 8) w.score = SCORE_MAX;
                    else w.score = clampScore(oldMaster - oldWeak);
                    // 예전에 마스터였는데 점수가 낮게 나오면 마스터 유지선까지 올려줌 (상태 보존)
                    if (w.mastered && w.score < SCORE_MASTER) w.score = SCORE_MASTER;
                    if (w.mastered) w.subjectivePassed = true;
                }
                syncWordFlags(w, { silent: true }); // 일지 카운트는 건드리지 않음
            });
        }

        // [냐냐 PATCH-0배치] 전역 음소거
        function isMuted() { return localStorage.getItem('nyanya_muted') === '1'; }
        function toggleMute() {
            const next = !isMuted();
            localStorage.setItem('nyanya_muted', next ? '1' : '0');
            if (next && 'speechSynthesis' in window) window.speechSynthesis.cancel();
            updateMuteBadge();
            showToast(next ? "소리를 껐어요 🔇" : "소리를 켰어요 🔊", "info");
        }
        function updateMuteBadge() {
            const btn = document.getElementById('mute-badge');
            if (!btn) return;
            const muted = isMuted();
            btn.innerHTML = muted
                ? `<i class="fa-solid fa-volume-xmark"></i><span class="hidden sm:inline"> 소리 꺼짐</span>`
                : `<i class="fa-solid fa-volume-high"></i><span class="hidden sm:inline"> 소리 켜짐</span>`;
            btn.className = muted
                ? "flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200 cursor-pointer"
                : "flex items-center gap-1.5 text-[10px] font-bold text-violet-600 bg-violet-50 px-2.5 py-1 rounded-full border border-violet-200 cursor-pointer";
        }

        // ============================================================
        // [냐냐 PATCH-0배치] 사이트 설명 모달 — 점수/등급 규칙 한 눈에
        // ============================================================
        function openHelpModal() {
            const body = document.getElementById('help-modal-body');
            if (body) body.innerHTML = buildHelpHtml();
            document.getElementById('help-modal').classList.remove('hidden');
        }
        function closeHelpModal() {
            document.getElementById('help-modal').classList.add('hidden');
        }

        function buildHelpHtml() {
            const gradeRows = [
                ['+8 ~ +10', '완벽', 'bg-emerald-600 text-white', '찐초록 — 확실히 내 것'],
                ['+5 ~ +7', '마스터', 'bg-emerald-100 text-emerald-700', '연초록 — 마스터 달성'],
                ['-2 ~ +4', '일반', 'bg-slate-100 text-slate-600', '아직 연습 중'],
                ['-3 ~ -7', '약점', 'bg-amber-100 text-amber-700', '자주 틀리는 단어'],
                ['-10 ~ -8', '치명적 약점', 'bg-red-100 text-red-600', '집중 공략 대상']
            ].map(([range, name, cls, desc]) => `
                <tr class="border-b border-slate-100 last:border-0">
                    <td class="py-2.5 px-3 font-black text-slate-700 whitespace-nowrap">${range}</td>
                    <td class="py-2.5 px-3"><span class="px-2.5 py-1 rounded-lg text-[11px] font-black ${cls}">${name}</span></td>
                    <td class="py-2.5 px-3 text-slate-500 font-semibold">${desc}</td>
                </tr>`).join('');

            // [냐냐 PATCH] 활동별 점수표 — 구분(퀴즈/미니게임/복습) 열로 묶어서 표시
            const SCORE_TABLE = [
                { group: '퀴즈', color: 'text-indigo-600 bg-indigo-50 border-indigo-200', rows: [
                    ['객관식', '+1', '−2'],
                    ['주관식', '+2', '−1'],
                    ['주관식 · 유의어 쓴 뒤 다시 정답', '+2', '−2'],
                    ['주관식 · 오타 고쳐서 다시 정답', '+1', '−2']
                ]},
                { group: '미니게임', color: 'text-teal-600 bg-teal-50 border-teal-200', rows: [
                    ['속사포', '+0.5', '−1'],
                    ['떨어지는 단어', '+1', '판정 없음'],
                    ['듣기 받아쓰기', '점수 없음', '점수 없음']
                ]},
                { group: '복습', color: 'text-amber-600 bg-amber-50 border-amber-200', rows: [
                    ['깜박이', '+0.2', '−2'],
                    ['단어 빈칸', '맞힌 칸당 +0.7', '틀린 칸당 −0.5'],
                    ['문법표 빈칸', '단어 점수 무관', '마스터한 표를 틀리면 마스터 해제']
                ]}
            ];
            const scoreRows = SCORE_TABLE.map(g => g.rows.map(([act, ok, no], i) => `
                <tr class="border-b border-slate-100 ${i === g.rows.length - 1 ? 'border-b-2 border-b-slate-200' : ''}">
                    ${i === 0 ? `<td rowspan="${g.rows.length}" class="py-2.5 px-3 align-middle border-r border-slate-200"><span class="px-2 py-1 rounded-lg text-[11px] font-black border ${g.color} whitespace-nowrap">${g.group}</span></td>` : ''}
                    <td class="py-2.5 px-3 font-bold text-slate-700">${act}</td>
                    <td class="py-2.5 px-3 font-black text-emerald-600 whitespace-nowrap">${ok}</td>
                    <td class="py-2.5 px-3 font-black text-rose-500 whitespace-nowrap">${no}</td>
                </tr>`).join('')).join('');

            const manualRows = [
                ['⭐ 별표 1번 클릭', '−3점 (약점)'],
                ['⭐ 별표 2번 클릭', '−8점 (치명적 약점)'],
                ['⭐ 별표 3번 클릭', '0점 (해제)'],
                ['✅ 마스터 1번 클릭', '+5점 (마스터)'],
                ['✅ 마스터 2번 클릭', '+8점 (완벽)'],
                ['✅ 마스터 3번 클릭', '0점 (해제)']
            ].map(([act, res]) => `
                <tr class="border-b border-slate-100 last:border-0">
                    <td class="py-2.5 px-3 font-bold text-slate-700">${act}</td>
                    <td class="py-2.5 px-3 font-semibold text-slate-600">${res}</td>
                </tr>`).join('');

            return `
            <div class="space-y-2">
                <p class="text-sm text-slate-600 font-semibold leading-relaxed">
                    모든 단어는 <b class="text-violet-600">점수 하나(−10 ~ +10)</b>로 관리돼요.
                    맞히면 오르고 틀리면 내려가요. 점수에 따라 등급이 자동으로 바뀌어요.
                </p>
            </div>

            <div class="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
                <h4 class="text-sm font-black text-slate-800 flex items-center gap-2"><i class="fa-solid fa-layer-group text-violet-500"></i> 등급 5단계</h4>
                <table class="w-full text-xs"><tbody>${gradeRows}</tbody></table>
                <p class="text-[11px] text-slate-500 font-semibold leading-relaxed pt-1">
                    ⚠️ <b>마스터·완벽은 점수만으로는 안 돼요.</b> <b class="text-violet-600">주관식으로 한 번은 맞혀야</b> 마스터가 열려요.
                    (미니게임만 돌려서는 마스터를 못 뚫습니다)
                </p>
            </div>

            <div class="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <h4 class="text-sm font-black text-slate-800 flex items-center gap-2"><i class="fa-solid fa-calculator text-indigo-500"></i> 활동별 점수</h4>
                <table class="w-full text-xs">
                    <thead>
                        <tr class="border-b-2 border-slate-200 text-[11px] text-slate-400 font-black uppercase">
                            <th class="py-2 px-3 text-left">구분</th>
                            <th class="py-2 px-3 text-left">활동</th>
                            <th class="py-2 px-3 text-left">정답</th>
                            <th class="py-2 px-3 text-left">오답</th>
                        </tr>
                    </thead>
                    <tbody>${scoreRows}</tbody>
                </table>
            </div>

            <div class="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <h4 class="text-sm font-black text-slate-800 flex items-center gap-2"><i class="fa-solid fa-hand-pointer text-amber-500"></i> 직접 누르는 버튼</h4>
                <table class="w-full text-xs"><tbody>${manualRows}</tbody></table>
            </div>

            <div class="bg-violet-50 rounded-2xl border border-violet-200 p-4 space-y-2">
                <h4 class="text-sm font-black text-violet-800 flex items-center gap-2"><i class="fa-solid fa-rotate text-violet-500"></i> 복습 주기</h4>
                <p class="text-xs text-violet-900 font-semibold leading-relaxed">
                    틀린 단어는 <b>그날 · 1일 · 3일 · 7일 · 14일 · 30일 뒤</b>에 '오늘 복습' 목록에 자동으로 올라와요.
                    (복습·게임·퀴즈 어디서 틀려도 똑같이 기록돼요)
                </p>
            </div>

            <div class="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2">
                <h4 class="text-sm font-black text-slate-800 flex items-center gap-2"><i class="fa-solid fa-percent text-teal-500"></i> 정답률 배지</h4>
                <p class="text-xs text-slate-600 font-semibold leading-relaxed">
                    카드에 뜨는 <b>%</b> 배지는 <b>시도 3회 이상</b>일 때만 보여요. 최근 실력만 반영하려고 <b>한 달마다 초기화</b>됩니다.
                </p>
            </div>`;
        }

        // ============================================================
        // [냐냐 PATCH-5배치] 유의어/반의어 칩 — 단어카드·퀴즈결과·복습 어디서나 공용
        //   유의어 = 스카이(하늘) · 반의어 = 로즈(빨강). 클릭하면 그 단어로 이동
        // ============================================================
        // 품사 영어 약자
        const POS_ABBR = { noun:'n.', verb:'v.', adjective:'adj.', adverb:'adv.', preposition:'prep.',
                           conjunction:'conj.', pronoun:'pron.', interrogative:'int.', phrase:'phr.' };

        // [냐냐 PATCH] 차이 설명을 "dormido : 완전히 잠든 상태 | adormecido : 잠들기 직전" 형태로 파싱
        //   파싱되면 단어/설명을 나눠서 보기 좋게, 안 되면 통째로 한 줄로
        function parseDifference(diff) {
            const raw = String(diff || '').trim();
            if (!raw) return null;
            const parts = raw.split('|').map(x => x.trim()).filter(Boolean);
            const rows = parts.map(part => {
                const i = part.indexOf(':');
                if (i < 0) return { word: '', desc: part };
                return { word: part.slice(0, i).trim(), desc: part.slice(i + 1).trim() };
            });
            return rows.length ? rows : null;
        }

        function buildSynonymChipsHtml(w) {
            if (!w || !Array.isArray(w.synonyms) || w.synonyms.length === 0) return '';
            const groups = { synonym: [], antonym: [] };
            w.synonyms.forEach(link => {
                const t = vocabulary.find(v => v.id === link.id);
                if (!t) return; // 삭제된 단어는 표시 안 함
                (link.type === 'antonym' ? groups.antonym : groups.synonym).push({ t, diff: link.difference || '' });
            });
            const blocks = [];
            const render = (list, kind) => {
                if (list.length === 0) return;
                const isAnt = kind === 'antonym';
                const icon = isAnt
                    ? '<i class="fa-solid fa-right-left text-[9px]"></i>'
                    : '<i class="fa-solid fa-equals text-[9px]"></i>';
                const title = isAnt ? `${icon} 반의어` : `${icon} 유의어`;
                const titleCls = isAnt ? 'text-rose-600' : 'text-sky-600';
                // [냐냐 PATCH] 테두리 없이 배경색만
                const boxCls = isAnt ? 'bg-rose-50/60' : 'bg-sky-50/60';
                const chipCls = isAnt ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : 'bg-sky-100 text-sky-700 hover:bg-sky-200';
                const items = list.map(({ t, diff }) => {
                    const abbr = POS_ABBR[t.pos] || '';
                    const rows = parseDifference(diff);
                    // [냐냐 PATCH] 차이 설명: 화살표 → · 두껍지 않게 · 단어 바로 아래 붙여서
                    // [냐냐 PATCH] 구분 기호: 화살표 대신 가운뎃점(·)으로 담백하게
                    const diffHtml = rows ? `
                        <div class="basis-full space-y-0 pl-0.5">
                            ${rows.map(r => `
                            <div class="text-[12px] text-slate-500 font-normal leading-snug">
                                <span class="${isAnt ? 'text-rose-300' : 'text-sky-300'} font-black">·</span>
                                ${r.word ? `<b class="${isAnt ? 'text-rose-600' : 'text-sky-600'} font-semibold">${escapeHtml(r.word)}</b> : ` : ''}${escapeHtml(r.desc)}
                            </div>`).join('')}
                        </div>` : '';
                    return `
                    <div class="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
                        <button type="button" onclick="event.stopPropagation(); goToWord('${t.id}')" class="px-2 py-0.5 rounded-lg text-[12px] font-black ${chipCls} transition-all">${escapeHtml(t.word)}</button>
                        ${abbr ? `<span class="text-[10px] text-slate-400 font-bold">${abbr}</span>` : ''}
                        <span class="text-[12px] text-slate-700 font-semibold">${escapeHtml(t.meaning || '')}</span>
                        ${diffHtml}
                    </div>`;
                }).join('');
                blocks.push(`
                    <div class="${boxCls} p-2.5 rounded-2xl space-y-1.5">
                        <span class="font-bold ${titleCls} block text-[10px] uppercase tracking-wider">${title}</span>
                        ${items}
                    </div>`);
            };
            render(groups.synonym, 'synonym');
            render(groups.antonym, 'antonym');
            return blocks.join('<div class="h-1.5"></div>');
        }

        // 칩 클릭 → 그 단어로 이동 (단어장 탭 + 검색으로 콕 집어줌)
        function goToWord(wordId) {
            const w = vocabulary.find(v => v.id === wordId);
            if (!w) { showToast("그 단어를 찾을 수 없어요", "error"); return; }

            // [냐냐 PATCH] 퀴즈/복습/게임 중이면 탭을 옮기지 않음 (진행 기록이 날아가버림)
            //   → 그 자리에서 단어 창(오버레이)만 띄우고, 닫으면 하던 거 그대로
            if (typeof activeTab !== 'undefined' && ['quiz', 'review', 'games'].includes(activeTab)) {
                if (typeof openWordModal === 'function') openWordModal(wordId);
                return;
            }

            if (typeof changeTab === 'function') changeTab('list');
            const search = document.getElementById('search-bar');
            if (search) {
                search.value = w.word;
                if (typeof handleSearchInput === 'function') handleSearchInput();
                else if (typeof renderWordList === 'function') renderWordList();
            }
            setTimeout(() => {
                const grid = document.getElementById('vocabulary-grid');
                if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
            showToast(`"${w.word}"로 이동했어요 🔗`, "info");
        }

        function logAction(type, extra) {
            touchDiarySnapshot();
            const today = getLocalDateString();

            if (type === 'quiz') {
                nyanyaDiary[today].quizTotal++;
                if (extra) nyanyaDiary[today].quizCorrect++;
            } else if (type === 'ai') {
                nyanyaDiary[today].aiSessions++;
            } else if (type === 'new-word') {
                nyanyaDiary[today].newWordsCount++;
            } else if (type === 'new-mastered') {
                nyanyaDiary[today].newMasteredCount++;
            } else if (type === 'new-perfect') {
                nyanyaDiary[today].newPerfectCount = (nyanyaDiary[today].newPerfectCount || 0) + 1; // [냐냐 PATCH-0배치] 오늘 새로 완벽 달성
            } else if (type === 'undo-new-perfect') {
                nyanyaDiary[today].newPerfectCount = Math.max(0, (nyanyaDiary[today].newPerfectCount || 0) - 1);
            } else if (type === 'review') {
                nyanyaDiary[today].reviewCount = (nyanyaDiary[today].reviewCount || 0) + 1; // [냐냐 PATCH] 복습 제출 1개
            } else if (type === 'game') {
                nyanyaDiary[today].gameCount = (nyanyaDiary[today].gameCount || 0) + 1; // [냐냐 PATCH] 게임 1판 완료
            } else if (type === 'new-grammar') {
                nyanyaDiary[today].newGrammarCount = (nyanyaDiary[today].newGrammarCount || 0) + 1; // [냐냐 PATCH] 문법표 등록
            } else if (type === 'new-grammar-mastered') {
                nyanyaDiary[today].newGrammarMasteredCount = (nyanyaDiary[today].newGrammarMasteredCount || 0) + 1; // [냐냐 PATCH] 문법표 마스터
            } else if (type === 'undo-new-word') {
                nyanyaDiary[today].newWordsCount = Math.max(0, (nyanyaDiary[today].newWordsCount || 0) - 1); // [냐냐 PATCH] 단어 삭제 시 오늘 등록 취소
            } else if (type === 'undo-new-mastered') {
                nyanyaDiary[today].newMasteredCount = Math.max(0, (nyanyaDiary[today].newMasteredCount || 0) - 1); // [냐냐 PATCH] 단어 마스터 해제/삭제
            } else if (type === 'undo-new-grammar') {
                nyanyaDiary[today].newGrammarCount = Math.max(0, (nyanyaDiary[today].newGrammarCount || 0) - 1); // [냐냐 PATCH] 문법표 삭제
            } else if (type === 'undo-new-grammar-mastered') {
                nyanyaDiary[today].newGrammarMasteredCount = Math.max(0, (nyanyaDiary[today].newGrammarMasteredCount || 0) - 1); // [냐냐 PATCH] 문법표 마스터 해제/삭제
            }
            // 'snapshot' 타입은 touchDiarySnapshot()의 총합 갱신만으로 충분함

            saveToStorage();
            renderDiary();
            if (typeof updateEggProgress === 'function') updateEggProgress(); // [냐냐 PATCH] 알 성장
        }

        // 학습 일지 렌더링
        function renderDiary() {
            renderStreakBadge();
            renderCalendar(); // [냐냐 PATCH] 학습 달력
            const container = document.getElementById('nyanya-diary-list');
            const today = getLocalDateString();
            const log = nyanyaDiary[today];

            if (!log) {
                container.innerHTML = `<p class="text-slate-400 text-center py-4">오늘의 첫 학습을 기록해보세요!</p>`;
                return;
            }

            container.innerHTML = `
                <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 grid grid-cols-2 gap-2 text-[11px] text-slate-500 font-medium">
                    <div>등록 단어: <strong class="text-violet-600">${log.newWordsCount || 0}개</strong></div>
                    <div>마스터 단어: <strong class="text-emerald-600">${log.newMasteredCount || 0}개</strong></div>
                    <div>등록 문법: <strong class="text-teal-600">${log.newGrammarCount || 0}개</strong></div>
                    <div>마스터 문법: <strong class="text-teal-500">${log.newGrammarMasteredCount || 0}개</strong></div>
                    <div>퀴즈: <strong class="text-amber-600">${log.quizCorrect || 0}/${log.quizTotal || 0}개</strong></div>
                    <div>AI 첨삭: <strong class="text-indigo-600">${log.aiSessions || 0}회</strong></div>
                    <div>복습: <strong class="text-sky-600">${log.reviewCount || 0}개</strong></div>
                    <div>미니 게임: <strong class="text-pink-600">${log.gameCount || 0}판</strong></div>
                </div>
            `;
        }

        // ============================================================
        // [냐냐 PATCH] 학습기록 탭: 기간별 통계 + 그래프
        // ============================================================
        let currentRecordRange = '7d';

        // [냐냐 PATCH] 학습기록 그래프 카드 접기/펼치기
        // [냐냐 PATCH] 학습 수준 데이터를 사용자가 직접 볼 수 있게 보기 좋게 렌더링
        function renderLearnerProfileDisplay() {
            const box = document.getElementById('learner-profile-display');
            if (!box) return;
            const { totalAnswered, totalCorrect, wrongByPos, wrongByGrammarType } = learnerProfile;

            if (!totalAnswered || totalAnswered < 5) {
                box.innerHTML = `<p class="text-slate-400 text-xs leading-relaxed">아직 데이터가 적어요! 퀴즈나 AI 첨삭을 ${5 - (totalAnswered || 0)}번 더 하면 수준 분석이 시작돼요. (현재 ${totalAnswered || 0}/5)</p>`;
                return;
            }

            const accuracy = Math.round((totalCorrect / totalAnswered) * 100);
            let level = "초급";
            let levelColor = "text-emerald-600";
            if (accuracy >= 85 && vocabulary.length >= 50) { level = "중상급"; levelColor = "text-violet-600"; }
            else if (accuracy >= 70) { level = "중급"; levelColor = "text-blue-600"; }

            const posNameKo = { noun: '명사', verb: '동사', adjective: '형용사', adverb: '부사', preposition: '전치사', conjunction: '접속사', pronoun: '대명사', phrase: '구문' };
            const weakPos = Object.entries(wrongByPos || {}).sort((a, b) => b[1] - a[1]).slice(0, 3);
            const weakGrammar = Object.entries(wrongByGrammarType || {}).sort((a, b) => b[1] - a[1]).slice(0, 3);

            let html = `
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div class="bg-white/70 rounded-2xl p-3 text-center">
                        <span class="block text-[10px] text-slate-400 font-bold">추정 수준</span>
                        <span class="text-lg font-black ${levelColor}">${level}</span>
                    </div>
                    <div class="bg-white/70 rounded-2xl p-3 text-center">
                        <span class="block text-[10px] text-slate-400 font-bold">전체 정답률</span>
                        <span class="text-lg font-black text-slate-700">${accuracy}%</span>
                    </div>
                </div>
                <p class="text-[11px] text-slate-400 mb-3">총 ${totalAnswered}문제 풀이 (퀴즈 + AI 첨삭 합산)</p>
            `;

            html += `<div class="mb-2">
                <span class="text-[11px] font-bold text-slate-500">자주 틀리는 품사 <span class="font-normal text-slate-400">(퀴즈 기준)</span></span>
                <div class="flex flex-wrap gap-1.5 mt-1">
                    ${weakPos.length > 0
                        ? weakPos.map(([pos, cnt]) => `<span class="text-[11px] font-semibold bg-rose-50 text-rose-500 px-2 py-0.5 rounded-full border border-rose-100">${posNameKo[pos] || pos} ${cnt}회</span>`).join('')
                        : '<span class="text-[11px] text-slate-400">아직 데이터가 없어요</span>'}
                </div>
            </div>`;
            html += `<div>
                <span class="text-[11px] font-bold text-slate-500">자주 틀리는 문법 <span class="font-normal text-slate-400">(자유 작문·질문답하기 기준)</span></span>
                <div class="flex flex-wrap gap-1.5 mt-1">
                    ${weakGrammar.length > 0
                        ? weakGrammar.map(([t, cnt]) => `<span class="text-[11px] font-semibold bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-100">${t} ${cnt}회</span>`).join('')
                        : '<span class="text-[11px] text-slate-400">아직 데이터가 없어요 (자유 작문/질문답하기를 해보세요!)</span>'}
                </div>
            </div>`;

            box.innerHTML = html;
        }

        function toggleChartCard(bodyId, btnEl) {
            const body = document.getElementById(bodyId);
            if (!body) return;
            const chevron = btnEl ? btnEl.querySelector('i') : null;
            const isHidden = body.classList.toggle('hidden');
            if (chevron) chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
        }

        function setRecordRange(range) {
            currentRecordRange = range;
            document.querySelectorAll('.record-range-btn').forEach(btn => {
                btn.className = "record-range-btn px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-500";
            });
            const btnMap = { '7d': 'range-btn-7d', '30d': 'range-btn-30d', '1y': 'range-btn-1y', 'custom': 'range-btn-custom' };
            const activeBtn = document.getElementById(btnMap[range]);
            if (activeBtn) activeBtn.className = "record-range-btn px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-white text-slate-900 shadow-sm";

            const customBox = document.getElementById('record-custom-range-box');
            if (range === 'custom') {
                customBox.classList.remove('hidden');
                const end = new Date();
                const start = new Date();
                start.setDate(end.getDate() - 6);
                document.getElementById('record-custom-start').value = getLocalDateString(start);
                document.getElementById('record-custom-end').value = getLocalDateString(end);
                return; // '적용' 버튼을 눌러야 그려짐
            }
            customBox.classList.add('hidden');

            let days = 7;
            if (range === '30d') days = 30;
            else if (range === '1y') days = 365;

            const end = new Date();
            const start = new Date();
            start.setDate(end.getDate() - (days - 1));
            renderRecordsForRange(start, end);
        }

        function applyCustomRecordRange() {
            const startVal = document.getElementById('record-custom-start').value;
            const endVal = document.getElementById('record-custom-end').value;
            if (!startVal || !endVal) {
                showToast("시작일과 종료일을 모두 선택해 주세요!", "error");
                return;
            }
            const start = new Date(startVal);
            const end = new Date(endVal);
            if (start > end) {
                showToast("시작일이 종료일보다 늦을 수 없어요!", "error");
                return;
            }
            renderRecordsForRange(start, end);
        }

        function getDateRangeArray(start, end) {
            const dates = [];
            const cur = new Date(start);
            cur.setHours(0,0,0,0);
            const endCopy = new Date(end);
            endCopy.setHours(0,0,0,0);
            while (cur <= endCopy) {
                dates.push(getLocalDateString(cur));
                cur.setDate(cur.getDate() + 1);
            }
            return dates;
        }

        function renderRecordsForRange(start, end) {
            const dateKeys = getDateRangeArray(start, end);
            const allKeysSorted = Object.keys(nyanyaDiary).sort();

            // 누적값(등록 단어/마스터 단어)은 그 날 기록이 없으면 이전 값을 그대로 이어붙임(carry-forward)
            let lastRegistered = 0, lastMastered = 0;
            for (const k of allKeysSorted) {
                if (k < dateKeys[0]) {
                    if (nyanyaDiary[k].registeredTotal !== undefined) lastRegistered = nyanyaDiary[k].registeredTotal;
                    if (nyanyaDiary[k].masteredTotal !== undefined) lastMastered = nyanyaDiary[k].masteredTotal;
                }
            }

            let prevRegistered = null;
            let prevMastered = null;
            const series = dateKeys.map(date => {
                const log = nyanyaDiary[date];
                if (log) {
                    if (log.registeredTotal !== undefined) lastRegistered = log.registeredTotal;
                    if (log.masteredTotal !== undefined) lastMastered = log.masteredTotal;
                }
                // [냐냐 PATCH] 신규 등록/마스터 수: 명시적 기록이 있으면 그걸 쓰고,
                // 없으면(예전 데이터) '오늘 누적 - 어제 누적'으로 계산
                let newWords = (log && log.newWordsCount) || 0;
                let newMastered = (log && log.newMasteredCount) || 0;
                if (newWords === 0 && prevRegistered !== null && lastRegistered > prevRegistered) {
                    newWords = lastRegistered - prevRegistered;
                }
                if (newMastered === 0 && prevMastered !== null && lastMastered > prevMastered) {
                    newMastered = lastMastered - prevMastered;
                }
                prevRegistered = lastRegistered;
                prevMastered = lastMastered;
                return {
                    date,
                    registeredTotal: lastRegistered,
                    masteredTotal: lastMastered,
                    quizTotal: (log && log.quizTotal) || 0,
                    quizCorrect: (log && log.quizCorrect) || 0,
                    aiSessions: (log && log.aiSessions) || 0,
                    newWordsCount: newWords,
                    newMasteredCount: newMastered,
                    reviewCount: (log && log.reviewCount) || 0,
                    gameCount: (log && log.gameCount) || 0,
                    newGrammarCount: (log && log.newGrammarCount) || 0,
                    newGrammarMasteredCount: (log && log.newGrammarMasteredCount) || 0,
                    // [냐냐 PATCH-0배치] 등급별 총계 (오늘부터 쌓임 — 과거 날짜는 undefined)
                    perfectTotal: (log && log.perfectTotal !== undefined) ? log.perfectTotal : null,
                    weakTotal: (log && log.weakTotal !== undefined) ? log.weakTotal : null,
                    criticalTotal: (log && log.criticalTotal !== undefined) ? log.criticalTotal : null,
                    newPerfectCount: (log && log.newPerfectCount) || 0
                };
            });

            const totalQuiz = series.reduce((sum, d) => sum + d.quizTotal, 0);
            const totalQuizCorrect = series.reduce((sum, d) => sum + d.quizCorrect, 0);
            const totalAi = series.reduce((sum, d) => sum + d.aiSessions, 0);
            const totalNewWords = series.reduce((sum, d) => sum + d.newWordsCount, 0);
            const totalNewMastered = series.reduce((sum, d) => sum + d.newMasteredCount, 0);
            const latestRegistered = series.length ? series[series.length - 1].registeredTotal : vocabulary.length;
            const latestMastered = series.length ? series[series.length - 1].masteredTotal : 0;

            document.getElementById('record-stat-words').innerText = `${latestRegistered}개`;
            document.getElementById('record-stat-mastered').innerText = `${latestMastered}개`;
            document.getElementById('record-stat-new-words').innerText = `${totalNewWords}개`;
            document.getElementById('record-stat-new-mastered').innerText = `${totalNewMastered}개`;
            document.getElementById('record-stat-quiz').innerText = `${totalQuizCorrect}/${totalQuiz}`;
            document.getElementById('record-stat-ai').innerText = `${totalAi}회`;
            // [냐냐 PATCH] 문법(단어와 동일 항목) + 복습 + 게임 요약
            const totalReview = series.reduce((sum, d) => sum + (d.reviewCount || 0), 0);
            const totalGame = series.reduce((sum, d) => sum + (d.gameCount || 0), 0);
            const totalNewGrammar = series.reduce((sum, d) => sum + (d.newGrammarCount || 0), 0);
            const totalNewGrammarMastered = series.reduce((sum, d) => sum + (d.newGrammarMasteredCount || 0), 0);
            const grammarTotal = (typeof getGrammarTotalCount === 'function') ? getGrammarTotalCount() : 0;
            const grammarMastered = (typeof getGrammarMasteredCount === 'function') ? getGrammarMasteredCount() : 0;
            const setStat = (id, txt) => { const el = document.getElementById(id); if (el) el.innerText = txt; };
            setStat('record-stat-grammar', `${grammarTotal}개`);
            setStat('record-stat-grammar-mastered', `${grammarMastered}개`);
            setStat('record-stat-new-grammar', `${totalNewGrammar}개`);
            setStat('record-stat-new-grammar-mastered', `${totalNewGrammarMastered}개`);
            setStat('record-stat-review', `${totalReview}개`);
            setStat('record-stat-game', `${totalGame}판`);

            renderRecordLineChart(series);
            renderGrowthDailyChart(series);
            renderActivityChart(series); // [냐냐 PATCH] 퀴즈·AI·복습·게임 통합 그래프 (기존 퀴즈/AI 대체)
            renderGrammarGrowthChart(series); // [냐냐 PATCH] 문법표 성장 그래프
            renderLearnerProfileDisplay();
        }

        // [냐냐 PATCH] 날짜 표시 형식: 2026-07-09 → 2026/07/09, 축 라벨은 07/09
        function fmtDateSlash(ds) { return (ds || '').replace(/-/g, '/'); }
        function fmtDateShort(ds) { return (ds || '').slice(5).replace('-', '/'); }

        function recordChartXLabels(series, xOf, height) {
            const labelEvery = Math.max(1, Math.ceil(series.length / 7));
            let html = '';
            series.forEach((d, i) => {
                if (i % labelEvery === 0 || i === series.length - 1) {
                    html += `<text x="${xOf(i).toFixed(1)}" y="${height - 8}" font-size="10" font-weight="700" fill="#475569" text-anchor="middle">${fmtDateShort(d.date)}</text>`;
                }
            });
            return html;
        }

        // [PATCH] 차트 너비를 기간 길이에 비례해서 늘리지 않고 항상 화면(컨테이너) 폭에 맞춤.
        // viewBox는 고정값(CHART_VIEW_WIDTH)을 쓰고 svg width="100%"로 반응형 처리 →
        // 기간이 길어져도(예: 1년) 좌우로 안 늘어나고 한 화면 안에 다 들어옴.
        const CHART_VIEW_WIDTH = 700;

        // [냐냐 PATCH] Y축 기준선 + 라벨 (세로축 기준점이 없다는 피드백 반영).
        // 마우스를 올리면(데스크탑) 정확한 수치도 <title>로 보이게 함.
        // [냐냐 PATCH-버그수정] 마우스 호버용 title 툴팁이 점이 너무 작아서 잘 안 보였음
        // → 클릭/탭하면 바로 뜨는 방식으로 교체 (모바일에서도 동작함)
        function showChartTooltip(event, tooltipId, text) {
            event.stopPropagation();
            const tooltip = document.getElementById(tooltipId);
            if (!tooltip) return;
            const container = tooltip.parentElement;
            const containerRect = container.getBoundingClientRect();
            const clientX = event.clientX !== undefined ? event.clientX : (event.touches && event.touches[0] ? event.touches[0].clientX : 0);
            const clientY = event.clientY !== undefined ? event.clientY : (event.touches && event.touches[0] ? event.touches[0].clientY : 0);
            let x = clientX - containerRect.left;
            let y = clientY - containerRect.top;
            x = Math.max(30, Math.min(x, containerRect.width - 30));
            tooltip.innerText = text;
            tooltip.style.left = `${x}px`;
            tooltip.style.top = `${Math.max(0, y - 38)}px`;
            tooltip.classList.remove('hidden');
            clearTimeout(tooltip._hideTimer);
            tooltip._hideTimer = setTimeout(() => tooltip.classList.add('hidden'), 2500);
        }

        function recordChartTooltipDiv(id) {
            return `<div id="${id}" class="hidden absolute z-10 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded-lg pointer-events-none whitespace-nowrap -translate-x-1/2" style="left:0; top:0;"></div>`;
        }

        function recordChartGridlines(maxVal, padding, chartW, chartH, width, suffix = '') {
            const steps = 4;
            let html = '';
            // [냐냐 PATCH] 라벨이 길면(자릿수 많으면) 글씨 크기를 줄여 잘림 방지
            const longest = Math.max(...Array.from({ length: steps + 1 }, (_, i) => `${Math.round((maxVal / steps) * i)}${suffix}`.length));
            const fs = longest >= 6 ? 7 : (longest >= 5 ? 8 : 9);
            for (let i = 0; i <= steps; i++) {
                const val = Math.round((maxVal / steps) * i);
                const y = padding.top + chartH - (i / steps) * chartH;
                html += `<line x1="${padding.left}" y1="${y.toFixed(1)}" x2="${width - padding.right}" y2="${y.toFixed(1)}" stroke="#f1f5f9" stroke-width="1"/>`;
                html += `<text x="${(padding.left - 5).toFixed(1)}" y="${(y + 3).toFixed(1)}" font-size="${fs}" font-weight="700" fill="#475569" text-anchor="end">${val}${suffix}</text>`;
            }
            return html;
        }

        // [냐냐 PATCH] 오른쪽 축 라벨 (막대 그래프 기준선). 왼쪽=꺾은선 축, 오른쪽=막대 축
        function recordChartRightAxis(maxVal, padding, chartH, width, suffix = '', color = '#94a3b8') {
            const steps = 4;
            let html = '';
            const rx = width - padding.right + 6;
            for (let i = 0; i <= steps; i++) {
                const val = Math.round((maxVal / steps) * i);
                const y = padding.top + chartH - (i / steps) * chartH;
                html += `<text x="${rx.toFixed(1)}" y="${(y + 3).toFixed(1)}" font-size="9" font-weight="700" fill="${color}" text-anchor="start">${val}${suffix}</text>`;
            }
            return html;
        }

        // [냐냐 PATCH-0배치] 단어장 성장 — 등록 단어 수(꺾은선) + 등급 비율 4종(누적 막대, 오른쪽 % 축)
        //   마스터% / 완벽% / 약점% / 치명적약점%  ← 전체 단어 수 대비
        //   ⚠️ 등급 총계는 오늘부터 쌓이기 시작 → 과거 날짜는 비어 있음 (막대 안 그림)
        function renderRecordLineChart(series) {
            const container = document.getElementById('record-line-chart');
            if (series.length === 0) { container.innerHTML = '<p class="text-xs text-slate-400 text-center py-8">데이터가 없어요</p>'; return; }

            const width = CHART_VIEW_WIDTH;
            const height = 180;
            const padding = { top: 16, right: 30, bottom: 28, left: 36 };
            const chartW = width - padding.left - padding.right;
            const chartH = height - padding.top - padding.bottom;

            const pct = (n, total) => (total > 0 && n !== null && n !== undefined) ? (n / total) * 100 : null;
            const withRatio = series.map(d => {
                const tot = d.registeredTotal;
                // '마스터'는 완벽을 포함한 값이므로, 순수 마스터(5~7점) = 마스터 - 완벽
                const perfect = d.perfectTotal;
                const masteredOnly = (perfect !== null && perfect !== undefined) ? Math.max(0, d.masteredTotal - perfect) : null;
                return {
                    ...d,
                    rPerfect: pct(perfect, tot),
                    rMastered: pct(masteredOnly, tot),
                    rWeak: pct(d.weakTotal, tot),
                    rCritical: pct(d.criticalTotal, tot),
                    hasGrade: (perfect !== null && perfect !== undefined)
                };
            });

            const maxVal = Math.max(1, ...series.map(d => d.registeredTotal));
            const xInset = Math.min(14, chartW * 0.06);
            const xSpan = chartW - xInset * 2;
            const xStep = series.length > 1 ? xSpan / (series.length - 1) : 0;
            const xOf = (i) => padding.left + xInset + (series.length > 1 ? i * xStep : xSpan / 2);
            const baseY = height - padding.bottom;
            const yOfCount = (val) => padding.top + chartH - (val / maxVal) * chartH;
            const groupWidth = series.length > 0 ? chartW / series.length : chartW;
            const barWidth = Math.min(9, groupWidth * 0.5);

            // 누적 막대: 아래부터 완벽 → 마스터 → 약점 → 치명적
            const STACK = [
                { key: 'rPerfect',  color: '#059669', label: '완벽' },
                { key: 'rMastered', color: '#6ee7b7', label: '마스터' },
                { key: 'rWeak',     color: '#fbbf24', label: '약점' },
                { key: 'rCritical', color: '#ef4444', label: '치명적' }
            ];
            let bars = '';
            withRatio.forEach((d, i) => {
                if (!d.hasGrade) return; // 등급 기록이 없는 과거 날짜는 건너뜀
                const x = xOf(i) - barWidth / 2;
                let acc = 0;
                STACK.forEach(seg => {
                    const v = d[seg.key] || 0;
                    if (v <= 0) return;
                    const h = (v / 100) * chartH;
                    const y = baseY - acc - h;
                    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${h.toFixed(1)}" fill="${seg.color}" opacity="0.85" rx="1"/>`;
                    acc += h;
                });
                const txt = `${fmtDateSlash(d.date)}: 완벽 ${Math.round(d.rPerfect || 0)}% · 마스터 ${Math.round(d.rMastered || 0)}% · 약점 ${Math.round(d.rWeak || 0)}% · 치명적 ${Math.round(d.rCritical || 0)}%`.replace(/'/g, "\\'");
                bars += `<rect x="${(xOf(i) - Math.max(barWidth + 2, 14) / 2).toFixed(1)}" y="${padding.top}" width="${Math.max(barWidth + 2, 14).toFixed(1)}" height="${chartH.toFixed(1)}" fill="transparent" style="cursor:pointer" onclick="showChartTooltip(event, 'record-line-chart-tooltip', '${txt}')"/>`;
            });

            // 등록 단어 수 = 꺾은선 (왼쪽 개수 축)
            const linePath = withRatio.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(1)} ${yOfCount(d.registeredTotal).toFixed(1)}`).join(' ');
            const lineDots = withRatio.map((d, i) => {
                const cx = xOf(i).toFixed(1);
                const cy = yOfCount(d.registeredTotal).toFixed(1);
                const txt = `${fmtDateSlash(d.date)}: 등록 단어 ${d.registeredTotal}개`.replace(/'/g, "\\'");
                return `<circle cx="${cx}" cy="${cy}" r="2.5" fill="#8b5cf6"/><circle cx="${cx}" cy="${cy}" r="9" fill="transparent" style="cursor:pointer" onclick="showChartTooltip(event, 'record-line-chart-tooltip', '${txt}')"/>`;
            }).join('');

            const anyGrade = withRatio.some(d => d.hasGrade);
            const legend = STACK.map(seg =>
                `<span class="inline-flex items-center gap-1"><span style="width:9px;height:9px;border-radius:2px;background:${seg.color};display:inline-block;"></span><span class="text-[10px] font-bold text-slate-600">${seg.label}</span></span>`
            ).join('<span class="mx-1.5"></span>');

            container.innerHTML = `
                ${recordChartTooltipDiv('record-line-chart-tooltip')}
                <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; display:block;" preserveAspectRatio="xMidYMid meet">
                    ${recordChartGridlines(maxVal, padding, chartW, chartH, width, '')}
                    ${recordChartRightAxis(100, padding, chartH, width, '%', '#10b981')}
                    <line x1="${padding.left}" y1="${baseY}" x2="${width - padding.right}" y2="${baseY}" stroke="#cbd5e1" stroke-width="1"/>
                    ${bars}
                    <path d="${linePath}" fill="none" stroke="#8b5cf6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    ${lineDots}
                    ${recordChartXLabels(series, xOf, height)}
                </svg>
                <div class="flex items-center justify-center flex-wrap gap-y-1 pt-1.5">${legend}</div>
                ${anyGrade ? '' : '<p class="text-[10px] text-slate-400 text-center font-semibold pt-1">등급 비율은 오늘부터 기록돼요 — 며칠 지나면 막대가 쌓여요!</p>'}
            `;
        }

        // 일별 신규 등록(꺾은선) + 신규 마스터(막대) - 둘 다 갯수 기준, 같은 스케일 공유
        function renderGrowthDailyChart(series) {
            const container = document.getElementById('record-growth-daily-chart');
            if (series.length === 0) { container.innerHTML = '<p class="text-xs text-slate-400 text-center py-8">데이터가 없어요</p>'; return; }

            const width = CHART_VIEW_WIDTH;
            const height = 180;
            const padding = { top: 16, right: 34, bottom: 28, left: 36 };
            const chartW = width - padding.left - padding.right;
            const chartH = height - padding.top - padding.bottom;
            const baseY = height - padding.bottom;

            // [냐냐 PATCH] 신규 등록/마스터 = 단어 + 문법 합산
            series = series.map(d => ({
                ...d,
                _newTotal: (d.newWordsCount || 0) + (d.newGrammarCount || 0),
                _newMasteredTotal: (d.newMasteredCount || 0) + (d.newGrammarMasteredCount || 0)
            }));

            // [냐냐 PATCH] 등록(막대)=왼쪽축, 마스터(선)=오른쪽축 (스케일 분리)
            const leftMax = Math.max(1, ...series.map(d => d._newTotal));
            const rightMax = Math.max(1, ...series.map(d => Math.max(d._newMasteredTotal, d.newPerfectCount || 0)));
            // [냐냐 PATCH] 좌우 여백(inset) — 첫/마지막 막대가 축에 붙어 잘리는 것 방지
            const xInset = Math.min(14, chartW * 0.06);
            const xSpan = chartW - xInset * 2;
            const xStep = series.length > 1 ? xSpan / (series.length - 1) : 0;
            const xOf = (i) => padding.left + xInset + (series.length > 1 ? i * xStep : xSpan / 2);
            const yOf = (val) => padding.top + chartH - (val / leftMax) * chartH;        // 등록 (왼쪽)
            const yOfRight = (val) => padding.top + chartH - (val / rightMax) * chartH;  // 마스터 (오른쪽)
            const groupWidth = series.length > 0 ? chartW / series.length : chartW;
            const barWidth = Math.min(4, groupWidth * 0.24); // 막대 3개라 살짝 좁게

            // [냐냐 PATCH-0배치] 등록(보라, 왼쪽축) + 마스터(초록) + 완벽(찐초록) 막대 3개 (오른쪽축)
            let bars = '';
            series.forEach((d, i) => {
                const rH = (d._newTotal / leftMax) * chartH;
                const mH = (d._newMasteredTotal / rightMax) * chartH;
                const pH = ((d.newPerfectCount || 0) / rightMax) * chartH;
                const bx = xOf(i) - barWidth * 1.5 - 1.5;  // 등록 (보라)
                const mx = xOf(i) - barWidth / 2;           // 마스터 (초록)
                const px = xOf(i) + barWidth / 2 + 1.5;     // 완벽 (찐초록)
                bars += `<rect x="${bx.toFixed(1)}" y="${(baseY - rH).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${rH.toFixed(1)}" fill="#8b5cf6" opacity="0.8" rx="1.5"/>`;
                bars += `<rect x="${mx.toFixed(1)}" y="${(baseY - mH).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${mH.toFixed(1)}" fill="#6ee7b7" opacity="0.9" rx="1.5"/>`;
                bars += `<rect x="${px.toFixed(1)}" y="${(baseY - pH).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${pH.toFixed(1)}" fill="#059669" opacity="0.9" rx="1.5"/>`;
                const text = `${fmtDateSlash(d.date)}: 신규 등록 ${d._newTotal}개 (단어 ${d.newWordsCount||0}+문법 ${d.newGrammarCount||0}) · 신규 마스터 ${d._newMasteredTotal}개 · 신규 완벽 ${d.newPerfectCount||0}개`.replace(/'/g, "\\'");
                bars += `<rect x="${(xOf(i) - Math.max(barWidth * 3 + 3, 16) / 2).toFixed(1)}" y="${padding.top}" width="${Math.max(barWidth * 3 + 3, 16).toFixed(1)}" height="${chartH.toFixed(1)}" fill="transparent" style="cursor:pointer" onclick="showChartTooltip(event, 'record-growth-daily-chart-tooltip', '${text}')"/>`;
            });

            const legend2 = [
                ['#8b5cf6', '신규 등록'],
                ['#6ee7b7', '신규 마스터'],
                ['#059669', '신규 완벽']
            ].map(([c, l]) => `<span class="inline-flex items-center gap-1"><span style="width:9px;height:9px;border-radius:2px;background:${c};display:inline-block;"></span><span class="text-[10px] font-bold text-slate-600">${l}</span></span>`).join('<span class="mx-1.5"></span>');

            container.innerHTML = `
                ${recordChartTooltipDiv('record-growth-daily-chart-tooltip')}
                <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; display:block;" preserveAspectRatio="xMidYMid meet">
                    ${recordChartGridlines(leftMax, padding, chartW, chartH, width, '')}
                    ${recordChartRightAxis(rightMax, padding, chartH, width, '', '#10b981')}
                    <line x1="${padding.left}" y1="${baseY}" x2="${width - padding.right}" y2="${baseY}" stroke="#cbd5e1" stroke-width="1"/>
                    ${bars}
                    ${recordChartXLabels(series, xOf, height)}
                </svg>
                <div class="flex items-center justify-center flex-wrap gap-y-1 pt-1.5">${legend2}</div>
            `;
        }

        // 퀴즈 차트: 전체 풀이 갯수(꺾은선) + 오답률%(막대)를 한 차트에 겹쳐서 표시
        function renderQuizChart(series) {
            const container = document.getElementById('record-quiz-chart');
            if (series.length === 0) { container.innerHTML = '<p class="text-xs text-slate-400 text-center py-8">데이터가 없어요</p>'; return; }

            const width = CHART_VIEW_WIDTH;
            const height = 180;
            const padding = { top: 16, right: 12, bottom: 28, left: 36 };
            const chartW = width - padding.left - padding.right;
            const chartH = height - padding.top - padding.bottom;
            const baseY = height - padding.bottom;

            const withRate = series.map(d => ({
                ...d,
                wrongRate: d.quizTotal > 0 ? ((d.quizTotal - d.quizCorrect) / d.quizTotal) * 100 : 0
            }));

            const maxTotal = Math.max(1, ...withRate.map(d => d.quizTotal));
            // [냐냐 PATCH] 좌우 여백(inset) — 첫/마지막 막대가 축에 붙어 잘리는 것 방지
            const xInset = Math.min(14, chartW * 0.06);
            const xSpan = chartW - xInset * 2;
            const xStep = series.length > 1 ? xSpan / (series.length - 1) : 0;
            const xOf = (i) => padding.left + xInset + (series.length > 1 ? i * xStep : xSpan / 2);
            const groupWidth = series.length > 0 ? chartW / series.length : chartW;
            const barWidth = Math.min(8, groupWidth * 0.5);

            // 오답률(%)은 0~100 고정 스케일의 막대로
            let bars = '';
            withRate.forEach((d, i) => {
                const barH = (d.wrongRate / 100) * chartH;
                const barX = (xOf(i) - barWidth / 2).toFixed(1);
                const barY = (baseY - barH).toFixed(1);
                const text = `${fmtDateSlash(d.date)}: 오답률 ${Math.round(d.wrongRate)}% (${d.quizTotal - d.quizCorrect}/${d.quizTotal}개)`.replace(/'/g, "\\'");
                bars += `<rect x="${barX}" y="${barY}" width="${barWidth.toFixed(1)}" height="${barH.toFixed(1)}" fill="#fb7185" opacity="0.7" rx="1.5"/>`;
                // 막대가 너무 얇아서 탭하기 어려우므로, 막대 전체 높이를 덮는 투명한 클릭 영역을 따로 추가
                bars += `<rect x="${(xOf(i) - Math.max(barWidth, 14) / 2).toFixed(1)}" y="${padding.top}" width="${Math.max(barWidth, 14).toFixed(1)}" height="${chartH.toFixed(1)}" fill="transparent" style="cursor:pointer" onclick="showChartTooltip(event, 'record-quiz-chart-tooltip', '${text}')"/>`;
            });

            // 전체 풀이 갯수는 자기 자신의 최댓값 기준 꺾은선으로
            const yOfTotal = (val) => padding.top + chartH - (val / maxTotal) * chartH;
            const linePath = withRate.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(1)} ${yOfTotal(d.quizTotal).toFixed(1)}`).join(' ');
            const lineDots = withRate.map((d, i) => {
                const cx = xOf(i).toFixed(1);
                const cy = yOfTotal(d.quizTotal).toFixed(1);
                const text = `${fmtDateSlash(d.date)}: 전체 ${d.quizTotal}문제`.replace(/'/g, "\\'");
                return `<circle cx="${cx}" cy="${cy}" r="2.5" fill="#8b5cf6"/><circle cx="${cx}" cy="${cy}" r="9" fill="transparent" style="cursor:pointer" onclick="showChartTooltip(event, 'record-quiz-chart-tooltip', '${text}')"/>`;
            }).join('');

            container.innerHTML = `
                ${recordChartTooltipDiv('record-quiz-chart-tooltip')}
                <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; display:block;" preserveAspectRatio="xMidYMid meet">
                    ${recordChartGridlines(maxTotal, padding, chartW, chartH, width)}
                    <line x1="${padding.left}" y1="${baseY}" x2="${width - padding.right}" y2="${baseY}" stroke="#cbd5e1" stroke-width="1"/>
                    ${bars}
                    <path d="${linePath}" fill="none" stroke="#8b5cf6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    ${lineDots}
                    ${recordChartXLabels(withRate, xOf, height)}
                </svg>
            `;
        }

        // AI 첨삭 차트: 일별 횟수 막대그래프
        function renderAiChart(series) {
            const container = document.getElementById('record-ai-chart');
            if (series.length === 0) { container.innerHTML = '<p class="text-xs text-slate-400 text-center py-8">데이터가 없어요</p>'; return; }

            const width = CHART_VIEW_WIDTH;
            const height = 140;
            const padding = { top: 16, right: 12, bottom: 28, left: 36 };
            const chartW = width - padding.left - padding.right;
            const chartH = height - padding.top - padding.bottom;
            const baseY = height - padding.bottom;

            const maxVal = Math.max(1, ...series.map(d => d.aiSessions));
            const groupWidth = chartW / series.length;
            const barWidth = Math.min(10, groupWidth * 0.6);
            const xOfGroup = (i) => padding.left + i * groupWidth + groupWidth / 2;

            let bars = '';
            series.forEach((d, i) => {
                const barH = (d.aiSessions / maxVal) * chartH;
                const text = `${fmtDateSlash(d.date)}: ${d.aiSessions}회`.replace(/'/g, "\\'");
                bars += `<rect x="${(xOfGroup(i) - barWidth / 2).toFixed(1)}" y="${(baseY - barH).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barH.toFixed(1)}" fill="#6366f1" rx="2"/>`;
                bars += `<rect x="${(xOfGroup(i) - Math.max(barWidth, 14) / 2).toFixed(1)}" y="${padding.top}" width="${Math.max(barWidth, 14).toFixed(1)}" height="${chartH.toFixed(1)}" fill="transparent" style="cursor:pointer" onclick="showChartTooltip(event, 'record-ai-chart-tooltip', '${text}')"/>`;
            });

            container.innerHTML = `
                ${recordChartTooltipDiv('record-ai-chart-tooltip')}
                <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; display:block;" preserveAspectRatio="xMidYMid meet">
                    ${recordChartGridlines(maxVal, padding, chartW, chartH, width, '회')}
                    <line x1="${padding.left}" y1="${baseY}" x2="${width - padding.right}" y2="${baseY}" stroke="#cbd5e1" stroke-width="1"/>
                    ${bars}
                    ${recordChartXLabels(series, xOfGroup, height)}
                </svg>
            `;
        }

        // [냐냐 PATCH] 학습 활동 통합 그래프: 총합=꺾은선(왼쪽축), 퀴즈·AI·복습·게임=막대(오른쪽축)
        // 색은 일지 숫자색과 맞춤: 퀴즈=amber, AI=indigo, 복습=sky, 게임=pink
        // [냐냐 PATCH] 신규등록은 값이 워낙 커서 막대만 1/10 축소 표시 (총합·툴팁은 실제 갯수 그대로)
        const ACT_REG_SCALE = 10;
        let activityHidden = []; // 숨긴 카테고리 key 목록 ('_total' 포함 가능)

        function toggleActivityCat(key) {
            const i = activityHidden.indexOf(key);
            if (i >= 0) activityHidden.splice(i, 1); else activityHidden.push(key);
            if (_lastActivitySeries) renderActivityChart(_lastActivitySeries); // 활동 그래프만 다시 그림
        }
        let _lastActivitySeries = null;

        // [냐냐 PATCH] 범례 전체 선택 / 전체 해제
        function setAllActivityCats(showAll) {
            activityHidden = showAll ? [] : ['_total', '_newReg', 'quizTotal', 'aiSessions', 'reviewCount', 'gameCount'];
            if (_lastActivitySeries) renderActivityChart(_lastActivitySeries);
        }

        function renderActivityChart(series) {
            const container = document.getElementById('record-activity-chart');
            if (!container) return;
            _lastActivitySeries = series; // 범례 토글 시 다시 그리기 위해 보관
            if (series.length === 0) { container.innerHTML = '<p class="text-xs text-slate-400 text-center py-8">데이터가 없어요</p>'; return; }

            const width = CHART_VIEW_WIDTH;
            const height = 200;
            const padding = { top: 18, right: 30, bottom: 28, left: 36 };
            const chartW = width - padding.left - padding.right;
            const chartH = height - padding.top - padding.bottom;
            const baseY = height - padding.bottom;

            const allCats = [
                { key: '_newReg', label: '신규등록', color: '#8b5cf6', scale: ACT_REG_SCALE },
                { key: 'quizTotal', label: '퀴즈', color: '#f59e0b', scale: 1 },
                { key: 'aiSessions', label: 'AI', color: '#6366f1', scale: 1 },
                { key: 'reviewCount', label: '복습', color: '#0ea5e9', scale: 1 },
                { key: 'gameCount', label: '게임', color: '#ec4899', scale: 1 },
            ];
            // 신규등록(단어+문법) 합산 — 총합엔 실제 갯수 그대로 반영
            series = series.map(d => ({ ...d, _newReg: (d.newWordsCount || 0) + (d.newGrammarCount || 0) }));
            const withTotal = series.map(d => ({ ...d, _total: allCats.reduce((s, c) => s + (d[c.key] || 0), 0) }));

            // 보이는 카테고리만 (범례 클릭으로 토글)
            const cats = allCats.filter(c => !activityHidden.includes(c.key));
            const showTotal = !activityHidden.includes('_total');

            // [냐냐 PATCH] 축 — 왼쪽=개별 활동 막대(등록은 ÷10), 오른쪽=총합(실제 갯수)
            const barMax = Math.max(1, ...withTotal.flatMap(d => cats.map(c => (d[c.key] || 0) / c.scale)));
            const totalMax = Math.max(1, ...withTotal.map(d => d._total));

            const xInset = Math.min(14, chartW * 0.06);
            const xSpan = chartW - xInset * 2;
            const xStep = series.length > 1 ? xSpan / (series.length - 1) : 0;
            const xOf = (i) => padding.left + xInset + (series.length > 1 ? i * xStep : xSpan / 2);
            const groupWidth = chartW / series.length;
            const barW = cats.length ? Math.max(2, Math.min(6, (groupWidth * 0.7) / cats.length)) : 4;

            let bars = '';
            withTotal.forEach((d, i) => {
                const groupCenter = xOf(i);
                const totalW = barW * cats.length;
                cats.forEach((c, ci) => {
                    const shown = (d[c.key] || 0) / c.scale; // 등록은 1/10로 그림
                    const barH = (shown / barMax) * chartH;  // 왼쪽 축 기준
                    const bx = groupCenter - totalW / 2 + ci * barW;
                    if (barH > 0) {
                        bars += `<rect x="${bx.toFixed(1)}" y="${(baseY - barH).toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" fill="${c.color}" opacity="0.85" rx="1"/>`;
                    }
                });
                const text = `${fmtDateSlash(d.date)}: 신규등록 ${d._newReg||0} · 퀴즈 ${d.quizTotal||0} · AI ${d.aiSessions||0} · 복습 ${d.reviewCount||0} · 게임 ${d.gameCount||0} (총 ${d._total}개 활동)`.replace(/'/g, "\\'");
                const hitW = Math.max(totalW, 14);
                bars += `<rect x="${(groupCenter - hitW / 2).toFixed(1)}" y="${padding.top}" width="${hitW.toFixed(1)}" height="${chartH.toFixed(1)}" fill="transparent" style="cursor:pointer" onclick="showChartTooltip(event, 'record-activity-chart-tooltip', '${text}')"/>`;
            });

            // 총합 꺾은선 (오른쪽 축, 실제 갯수 기준, 점선)
            let totalLine = '';
            if (showTotal) {
                const yOfTotal = (val) => padding.top + chartH - (val / totalMax) * chartH;
                const linePath = withTotal.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(1)} ${yOfTotal(d._total).toFixed(1)}`).join(' ');
                const lineDots = withTotal.map((d, i) => `<circle cx="${xOf(i).toFixed(1)}" cy="${yOfTotal(d._total).toFixed(1)}" r="2.5" fill="#8b5cf6"/>`).join('');
                totalLine = `<path d="${linePath}" fill="none" stroke="#8b5cf6" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2 2" opacity="0.8"/>${lineDots}`;
            }

            // 범례 (클릭해서 켜고 끄기) — 총합은 맨 뒤 + 전체 선택/해제
            const legendItems = [...allCats, { key: '_total', label: '총합', color: '#8b5cf6', isLine: true }].map(c => {
                const on = !activityHidden.includes(c.key);
                const mark = c.isLine
                    ? `<span class="w-3 h-0 inline-block" style="border-top:2px dashed ${c.color};"></span>`
                    : `<span class="w-2 h-2 rounded-sm inline-block" style="background:${c.color};"></span>`;
                const note = (c.key === '_newReg') ? ` <span class="text-[9px] text-slate-400">(막대 ÷${ACT_REG_SCALE})</span>` : '';
                return `<button type="button" onclick="toggleActivityCat('${c.key}')" class="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md transition-all ${on ? 'text-slate-600 bg-white/70' : 'text-slate-300 line-through'}">${mark}${c.label}${note}</button>`;
            }).join('');
            const bulkBtns = `
                <span class="w-px h-3 bg-slate-200 mx-0.5"></span>
                <button type="button" onclick="setAllActivityCats(true)" class="text-[10px] font-bold px-1.5 py-0.5 rounded-md text-slate-500 bg-white/70 hover:bg-white transition-all">전체 선택</button>
                <button type="button" onclick="setAllActivityCats(false)" class="text-[10px] font-bold px-1.5 py-0.5 rounded-md text-slate-500 bg-white/70 hover:bg-white transition-all">전체 해제</button>`;

            container.innerHTML = `
                ${recordChartTooltipDiv('record-activity-chart-tooltip')}
                <div class="flex flex-wrap items-center gap-1.5 mb-2">${legendItems}${bulkBtns}</div>
                <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; display:block;" preserveAspectRatio="xMidYMid meet">
                    ${recordChartGridlines(barMax, padding, chartW, chartH, width, '')}
                    ${showTotal ? recordChartRightAxis(totalMax, padding, chartH, width, '', '#8b5cf6') : ''}
                    <line x1="${padding.left}" y1="${baseY}" x2="${width - padding.right}" y2="${baseY}" stroke="#cbd5e1" stroke-width="1"/>
                    ${bars}
                    ${totalLine}
                    ${recordChartXLabels(series, xOf, height)}
                </svg>
                <p class="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                    하루에 뭘 얼마나 했는지 보여줘요. 활동별 <b>막대는 왼쪽 축</b>, <b>총합(점선)은 오른쪽 축</b> 기준이에요.
                    총합은 그날 한 활동을 <b>실제 갯수 그대로</b> 다 더한 값이고, 신규등록은 갯수가 많아 다른 활동이 안 보여서 <b>막대만 ${ACT_REG_SCALE}개당 1칸</b>으로 줄여 그렸어요.
                    범례를 눌러 보고 싶은 것만 골라 볼 수 있어요.
                </p>
            `;
        }

        // [냐냐 PATCH] 문법표 성장: 등록 문법(꺾은선) + 마스터 비율(막대) — 단어장 성장과 동일 형식
        function renderGrammarGrowthChart(series) {
            const container = document.getElementById('record-grammar-chart');
            if (!container) return;
            if (series.length === 0) { container.innerHTML = '<p class="text-xs text-slate-400 text-center py-8">데이터가 없어요</p>'; return; }

            const width = CHART_VIEW_WIDTH;
            const height = 160;
            const padding = { top: 16, right: 34, bottom: 28, left: 36 };
            const chartW = width - padding.left - padding.right;
            const chartH = height - padding.top - padding.bottom;
            const baseY = height - padding.bottom;

            // 문법은 일별 누적 스냅샷이 없으므로 현재 총계에서 역산해 일별 누적 만들기
            const grammarTotalNow = (typeof getGrammarTotalCount === 'function') ? getGrammarTotalCount() : 0;
            const grammarMasteredNow = (typeof getGrammarMasteredCount === 'function') ? getGrammarMasteredCount() : 0;
            const regByDay = new Array(series.length), masByDay = new Array(series.length);
            let regRun = grammarTotalNow, masRun = grammarMasteredNow;
            for (let i = series.length - 1; i >= 0; i--) {
                regByDay[i] = regRun;
                masByDay[i] = masRun;
                regRun = Math.max(0, regRun - (series[i].newGrammarCount || 0));
                masRun = Math.max(0, masRun - (series[i].newGrammarMasteredCount || 0));
            }
            const masteredRatioOf = (i) => regByDay[i] > 0 ? (masByDay[i] / regByDay[i]) * 100 : 0;

            const maxVal = Math.max(1, ...regByDay);
            // [냐냐 PATCH] 좌우 여백(inset) — 첫/마지막 막대가 축에 붙어 잘리는 것 방지
            const xInset = Math.min(14, chartW * 0.06);
            const xSpan = chartW - xInset * 2;
            const xStep = series.length > 1 ? xSpan / (series.length - 1) : 0;
            const xOf = (i) => padding.left + xInset + (series.length > 1 ? i * xStep : xSpan / 2);
            const yOfCount = (v) => padding.top + chartH - (v / maxVal) * chartH;
            const groupWidth = chartW / series.length;
            const barWidth = Math.min(6, groupWidth * 0.4);

            let bars = '';
            series.forEach((d, i) => {
                const mBarH = (masteredRatioOf(i) / 100) * chartH;
                bars += `<rect x="${(xOf(i) - barWidth / 2).toFixed(1)}" y="${(baseY - mBarH).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${mBarH.toFixed(1)}" fill="#14b8a6" opacity="0.7" rx="1.5"/>`;
                const text = `${fmtDateSlash(d.date)}: 등록 문법 ${regByDay[i]}개 · 마스터 비율 ${Math.round(masteredRatioOf(i))}%`.replace(/'/g, "\\'");
                bars += `<rect x="${(xOf(i) - Math.max(barWidth, 14) / 2).toFixed(1)}" y="${padding.top}" width="${Math.max(barWidth, 14).toFixed(1)}" height="${chartH.toFixed(1)}" fill="transparent" style="cursor:pointer" onclick="showChartTooltip(event, 'record-grammar-chart-tooltip', '${text}')"/>`;
            });

            const linePath = series.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(1)} ${yOfCount(regByDay[i]).toFixed(1)}`).join(' ');
            const lineDots = series.map((d, i) => `<circle cx="${xOf(i).toFixed(1)}" cy="${yOfCount(regByDay[i]).toFixed(1)}" r="2.5" fill="#5896cb"/>`).join('');

            container.innerHTML = `
                ${recordChartTooltipDiv('record-grammar-chart-tooltip')}
                <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; display:block;" preserveAspectRatio="xMidYMid meet">
                    ${recordChartGridlines(maxVal, padding, chartW, chartH, width, '')}
                    ${recordChartRightAxis(100, padding, chartH, width, '%', '#14b8a6')}
                    <line x1="${padding.left}" y1="${baseY}" x2="${width - padding.right}" y2="${baseY}" stroke="#cbd5e1" stroke-width="1"/>
                    ${bars}
                    <path d="${linePath}" fill="none" stroke="#5896cb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    ${lineDots}
                    ${recordChartXLabels(series, xOf, height)}
                </svg>
            `;
        }

        // [냐냐 PATCH] 제목 헤더 접기/펼치기 (기본 접힘)
        let headerExpanded = false;
        // [냐냐 PATCH] 고정 사이드바의 좌우 위치를 실제 자리(aside)에 맞춰 동기화
        function syncSidebarPosition() {
            const aside = document.getElementById('sidebar-menu');
            const inner = document.getElementById('sidebar-inner');
            if (!aside || !inner) return;
            // 데스크톱(md 이상)에서만 fixed 위치 계산
            if (window.innerWidth >= 768) {
                const rect = aside.getBoundingClientRect();
                inner.style.left = rect.left + 'px';
                inner.style.width = rect.width + 'px';
            } else {
                inner.style.left = '';
                inner.style.width = '';
            }
        }
        window.addEventListener('resize', syncSidebarPosition);
        window.addEventListener('load', syncSidebarPosition);

        // [냐냐 PATCH] 맨 위로 버튼: 스크롤 내리면 나타남
        window.addEventListener('scroll', () => {
            const btn = document.getElementById('scroll-top-btn');
            if (btn) btn.classList.toggle('hidden', window.scrollY < 300);
        });

        // [냐냐 PATCH] 헤더 접기 기능 제거됨. AI연결·동기화·백업 버튼은 헤더에 직접 노출.

        function toggleMobileMenu() {
            if (isMenuCollapsed) expandMobileMenu();
            else collapseMobileMenu();
        }

        function collapseMobileMenu() {
            const menu = document.getElementById('sidebar-menu');
            const icon = document.getElementById('menu-toggle-icon');
            menu.classList.add('hidden', 'md:flex');
            icon.className = "fa-solid fa-chevron-down text-sm";
            isMenuCollapsed = true;
        }

        function expandMobileMenu() {
            const menu = document.getElementById('sidebar-menu');
            const icon = document.getElementById('menu-toggle-icon');
            menu.classList.remove('hidden');
            icon.className = "fa-solid fa-chevron-up text-sm";
            isMenuCollapsed = false;
        }

        // ============================================================
        // [냐냐 PATCH] 문법 표 (참고용 표 모음)
        // ============================================================
        let grammarOpenState = {}; // 표별 펼침 상태 기억
        let pinnedGrammar = {}; // [냐냐 PATCH] 고정된 문법 표 (항상 위+열림)
        let masteredGrammar = {}; // [냐냐 PATCH] 마스터한 문법 표 {tableId: true}
        let hiddenDefaultGrammar = []; // [냐냐 PATCH] 삭제(숨김)한 기본 문법 표 id 목록
        let hiddenQuestionTopics = []; // [냐냐 PATCH] 질문 주제 드롭다운에서 숨긴 목록
        let grammarCellHighlights = {}; // [냐냐 PATCH] 문법표 칸별 강조 {tableId: {"ri-ci": true}}
        const GRAMMAR_TABLES = [
            {
                id: 'possessive',
                icon: '🫰',
                title: '소유형용사 (mi, tu, su...)',
                desc: '명사 앞에 붙어 "누구의"를 나타내요. 뒤에 오는 명사의 수(단·복수)에 맞춰 변해요. nuestro/vuestro만 성(남·여)도 변해요.',
                headers: ['뜻', '단수 명사 앞', '복수 명사 앞'],
                highlightCols: [0],
                rows: [
                    ['나의', 'mi', 'mis'],
                    ['너의', 'tu', 'tus'],
                    ['그/그녀/당신의', 'su', 'sus'],
                    ['우리의', 'nuestro / nuestra', 'nuestros / nuestras'],
                    ['너희의', 'vuestro / vuestra', 'vuestros / vuestras'],
                    ['그들/당신들의', 'su', 'sus'],
                ],
                note: '예: mi libro (내 책), mis libros (내 책들), nuestra casa (우리 집)'
            },
            {
                id: 'demonstrative',
                icon: '👉',
                title: '지시사 (이 · 그 · 저)',
                desc: '거리에 따라 este(이·가까움) / ese(그·중간) / aquel(저·멀리)로 나뉘고, 각각 성·수에 맞춰 변해요.',
                headers: ['뜻', '남성 단수', '여성 단수', '남성 복수', '여성 복수'],
                highlightCols: [0],
                rows: [
                    ['이 (가까이)', 'este', 'esta', 'estos', 'estas'],
                    ['그 (조금 멀리)', 'ese', 'esa', 'esos', 'esas'],
                    ['저 (멀리)', 'aquel', 'aquella', 'aquellos', 'aquellas'],
                ],
                note: '중성 지시대명사 esto/eso/aquello는 "이것/그것/저것"처럼 특정 명사 없이 막연한 것을 가리킬 때 써요. 예: ¿Qué es esto? (이게 뭐야?)'
            },
            {
                id: 'object-pronoun',
                icon: '🎯',
                title: '목적격 대명사 (me, te, lo, le...)',
                desc: '직접목적격("~을/를")과 간접목적격("~에게")이 있어요. 보통 동사 앞에 와요.',
                headers: ['뜻', '직접목적격 (~을/를)', '간접목적격 (~에게)'],
                highlightCols: [0],
                rows: [
                    ['나', 'me', 'me'],
                    ['너', 'te', 'te'],
                    ['그/그것/당신(남)', 'lo', 'le'],
                    ['그녀/그것/당신(여)', 'la', 'le'],
                    ['우리', 'nos', 'nos'],
                    ['너희', 'os', 'os'],
                    ['그들/그것들/당신들(남)', 'los', 'les'],
                    ['그녀들/그것들/당신들(여)', 'las', 'les'],
                ],
                note: '예: Te veo (너를 봐), Le doy un libro (그에게 책을 줘). 둘 다 쓸 땐 간접+직접 순서: Me lo da (나에게 그것을 줘).'
            },
            {
                id: 'numbers',
                icon: '🔢',
                title: '숫자 (Números)',
                desc: '기수(0~100 주요 숫자). 16~29는 한 단어로 붙여 써요(dieciséis, veintiuno...). 31부터는 y로 연결해요(treinta y uno).',
                headers: ['숫자', '스페인어', '숫자', '스페인어'],
                highlightCols: [0, 2],
                rows: [
                    ['0', 'cero', '16', 'dieciséis'],
                    ['1', 'uno', '17', 'diecisiete'],
                    ['2', 'dos', '18', 'dieciocho'],
                    ['3', 'tres', '19', 'diecinueve'],
                    ['4', 'cuatro', '20', 'veinte'],
                    ['5', 'cinco', '21', 'veintiuno'],
                    ['6', 'seis', '30', 'treinta'],
                    ['7', 'siete', '40', 'cuarenta'],
                    ['8', 'ocho', '50', 'cincuenta'],
                    ['9', 'nueve', '60', 'sesenta'],
                    ['10', 'diez', '70', 'setenta'],
                    ['11', 'once', '80', 'ochenta'],
                    ['12', 'doce', '90', 'noventa'],
                    ['13', 'trece', '100', 'cien'],
                    ['14', 'catorce', '1000', 'mil'],
                    ['15', 'quince', '', ''],
                ],
                note: '예: 31 = treinta y uno, 45 = cuarenta y cinco, 100 = cien (딱 100), 101 = ciento uno'
            },
            {
                id: 'months',
                icon: '📅',
                title: '월 (Meses)',
                desc: '스페인어에서 월 이름은 소문자로 써요. 관사도 안 붙여요.',
                headers: ['한국어', '스페인어', '한국어', '스페인어'],
                highlightCols: [0, 2],
                rows: [
                    ['1월', 'enero', '7월', 'julio'],
                    ['2월', 'febrero', '8월', 'agosto'],
                    ['3월', 'marzo', '9월', 'septiembre'],
                    ['4월', 'abril', '10월', 'octubre'],
                    ['5월', 'mayo', '11월', 'noviembre'],
                    ['6월', 'junio', '12월', 'diciembre'],
                ],
                note: '예: en enero (1월에), el 5 de mayo (5월 5일)'
            },
            {
                id: 'weekdays',
                icon: '🗓️',
                title: '요일 (Días de la semana)',
                desc: '요일도 소문자로 써요. 월요일부터 시작해요. 모두 남성명사예요.',
                headers: ['한국어', '스페인어'],
                highlightCols: [0],
                rows: [
                    ['월요일', 'lunes'],
                    ['화요일', 'martes'],
                    ['수요일', 'miércoles'],
                    ['목요일', 'jueves'],
                    ['금요일', 'viernes'],
                    ['토요일', 'sábado'],
                    ['일요일', 'domingo'],
                ],
                note: '예: el lunes (월요일에), los lunes (매주 월요일). lunes~viernes는 복수형이 단수와 같아요(el lunes → los lunes).'
            },
        ];

        function getAllGrammarTables() {
            // 기본 표 + 사용자 표. 사용자가 기본 표를 수정하면 override로 대체.
            const result = [];
            GRAMMAR_TABLES.forEach(base => {
                if (hiddenDefaultGrammar.includes(base.id)) return; // [냐냐 PATCH] 삭제한 기본 표는 숨김
                const override = customGrammarTables.find(c => c.id === base.id);
                result.push(override ? { ...override, isCustom: !!override._edited } : base);
            });
            // 완전히 새로 만든 사용자 표 (기본 id와 겹치지 않는 것)
            customGrammarTables.forEach(c => {
                if (!GRAMMAR_TABLES.find(b => b.id === c.id)) result.push({ ...c, isCustom: true });
            });
            return result;
        }

        // [냐냐 PATCH] 문법표 통계 헬퍼
        function getGrammarTotalCount() {
            return getAllGrammarTables().length;
        }
        function getGrammarMasteredCount() {
            const ids = new Set(getAllGrammarTables().map(t => t.id));
            return Object.keys(masteredGrammar).filter(id => masteredGrammar[id] && ids.has(id)).length;
        }

        // [냐냐 PATCH] 문법표 정렬 모드 ('newest' | 'oldest'), 기본 최신순
        let grammarSortMode = 'newest';
        function toggleGrammarSort() {
            grammarSortMode = grammarSortMode === 'newest' ? 'oldest' : 'newest';
            const btn = document.getElementById('grammar-sort-btn');
            if (btn) {
                btn.innerHTML = grammarSortMode === 'newest'
                    ? '<i class="fa-solid fa-arrow-down-wide-short mr-1"></i>최신순'
                    : '<i class="fa-solid fa-arrow-up-wide-short mr-1"></i>오래된순';
            }
            renderGrammarTables();
        }

        // ============================================================
        // [냐냐 PATCH-4차] 문법표 🔍 단어 찾기 모드
        //   켜면: 셀 안의 스페인어 단어에 밑줄 + 클릭 가능
        //   클릭 → 등록된 단어면 단어창 열기 (hablo → hablar 처럼 변형형도 원형 찾음)
        //          미등록이면 "등록할까요?" → AI 자동완성으로 바로 등록
        // ============================================================
        let grammarWordLookupMode = false;

        function toggleGrammarWordLookup() {
            grammarWordLookupMode = !grammarWordLookupMode;
            renderGrammarTables();
            showToast(grammarWordLookupMode
                ? "🔍 단어 찾기 켰어요! 표 안의 단어를 눌러보세요"
                : "단어 찾기를 껐어요", "info");
        }

        // 셀 텍스트를 단어 단위로 쪼개서 클릭 가능한 조각으로 만듦
        //   (스페인어 글자만 단어로 취급 — 화살표·슬래시·괄호·숫자는 그대로 둠)
        function buildLookupCellHtml(text) {
            const raw = String(text || '');
            if (!raw.trim()) return '';
            const parts = raw.split(/([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)/g);
            return parts.map(seg => {
                if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+$/.test(seg)) return escapeHtml(seg);
                if (seg.length < 2) return escapeHtml(seg); // 한 글자는 건너뜀
                const safe = seg.replace(/'/g, "\\'");
                return `<span onclick="lookupGrammarWord('${safe}')" class="underline decoration-sky-400 decoration-2 underline-offset-2 cursor-pointer hover:text-sky-600 hover:bg-sky-50 rounded px-0.5 transition-colors">${escapeHtml(seg)}</span>`;
            }).join('');
        }

        function lookupGrammarWord(rawWord) {
            const word = String(rawWord || '').trim();
            if (!word) return;

            // 등록된 단어 찾기 (변형형도 원형으로 역추적)
            const found = (typeof findVocabWordByForm === 'function') ? findVocabWordByForm(word) : null;
            if (found) {
                openWordModal(found.id);
                showToast(`"${found.word}" 단어창을 열었어요`, "info");
                return;
            }

            // 미등록 → 등록할지 물어보고, 예면 AI 자동완성까지 실행
            showConfirm(
                `"${word}" 는 아직 단어장에 없어요`,
                "지금 등록할까요? AI가 뜻·품사·예문을 자동으로 채워줘요!",
                () => {
                    openWordModal();
                    _skipContinueRegisterPrompt = true; // [냐냐 PATCH] 문법표에서 온 등록은 '계속 등록?' 안 물어봄
                    const input = document.getElementById('input-word');
                    if (input) {
                        input.value = word;
                        if (typeof handleWordInput === 'function') handleWordInput(word);
                    }
                    setTimeout(() => {
                        if (typeof triggerAiAutofill === 'function') triggerAiAutofill();
                    }, 250);
                },
                { okLabel: '등록할래요', cancelLabel: '아니요', okStyle: 'primary', icon: 'happy' }
            );
        }

        function renderGrammarTables() {
            const container = document.getElementById('grammar-tables-container');
            if (!container) return;
            const query = (document.getElementById('grammar-search')?.value || '').trim().toLowerCase();
            document.getElementById('grammar-search-clear')?.classList.toggle('hidden', !query);

            let tables = getAllGrammarTables();
            if (query) {
                tables = tables.filter(t => {
                    const haystack = [t.title, t.desc, t.note, ...(t.headers || []), ...((t.rows || []).flat())].join(' ').toLowerCase();
                    return haystack.includes(query);
                });
            }

            // [냐냐 PATCH] 마스터 상태 필터
            if (grammarFilterMastery === 'mastered') tables = tables.filter(t => masteredGrammar[t.id]);
            else if (grammarFilterMastery === 'not-mastered') tables = tables.filter(t => !masteredGrammar[t.id]);
            // [냐냐 PATCH] 아이콘 주제 필터 (여러 개 선택 가능, 빈 배열=전체)
            if (grammarFilterTopics.length > 0) tables = tables.filter(t => grammarFilterTopics.includes(grammarTopicKey(t)));

            document.getElementById('grammar-empty-msg')?.classList.toggle('hidden', tables.length > 0);

            // [냐냐 PATCH] 정렬: 최신순 / 오래된순 / 주제순(오름차순)
            if (grammarSortMode === 'newest') {
                tables = [...tables].reverse();
            } else if (grammarSortMode === 'topic') {
                tables = [...tables].sort((a, b) => grammarTopicLabel(grammarTopicKey(a)).localeCompare(grammarTopicLabel(grammarTopicKey(b)), 'ko'));
            }
            // [냐냐 PATCH] 고정된 표를 맨 위로 정렬 (고정끼리는 정렬된 순서 유지)
            tables = [...tables].sort((a, b) => (pinnedGrammar[b.id] ? 1 : 0) - (pinnedGrammar[a.id] ? 1 : 0));

            container.innerHTML = tables.map((t, idx) => {
                const cellHl = grammarCellHighlights[t.id] || {}; // [냐냐 PATCH] {"ri-ci": true} 강조된 칸
                const hlCols = t.highlightCols || [0]; // [냐냐 PATCH] 열 강조 (글씨체)
                const headerRow = (t.headers || []).map((h, ci) => {
                    return `<th class="text-center px-3 py-2.5 text-sm font-black text-white bg-[#5896cb] border border-[#4a85bb]">${escapeHtml(h)}</th>`;
                }).join('');
                const bodyRows = (t.rows || []).map((r, ri) => {
                    // 행마다 번갈아 배경색 (줄무늬) — 부드러운 파랑
                    const rowBg = ri % 2 === 0 ? 'bg-white' : 'bg-[#f3f8fd]';
                    const cells = r.map((c, ci) => {
                        // [냐냐 PATCH] 칸마다 별표 아이콘 → 클릭하면 연분홍 배경 강조 토글
                        const key = `${ri}-${ci}`;
                        const isHl = !!cellHl[key];
                        const cellBg = isHl ? 'bg-[#ffe0ec]' : '';
                        // [냐냐 PATCH] 열 강조: 해당 열은 진한 보라 두꺼운 글씨
                        const colHl = hlCols.includes(ci) ? 'text-violet-600 font-extrabold' : 'text-slate-800 font-bold';
                        // [냐냐 PATCH-4차] 🔍 단어 찾기 모드: 셀 안의 스페인어 단어마다 밑줄 + 클릭 가능
                        const cellContent = grammarWordLookupMode
                            ? buildLookupCellHtml(c || '')
                            : escapeHtml(c || '');
                        return `<td class="px-3 py-2 text-sm text-center border border-[#e1edf7] ${colHl} ${cellBg}">${cellContent}</td>`;
                    }).join('');
                    return `<tr class="${rowBg} hover:bg-[#fff8dd] transition-colors">${cells}</tr>`;
                }).join('');
                // 펼침 상태 유지 (검색 중이면 다 펼침, 아니면 기존 상태/첫번째만)
                const isOpen = query ? true : (pinnedGrammar[t.id] ? true : (grammarOpenState[t.id] !== undefined ? grammarOpenState[t.id] : false));
                const isMastered = !!masteredGrammar[t.id]; // [냐냐 PATCH] 문법표 마스터 여부
                const editBtns = `
                    <span class="flex items-center gap-1 shrink-0" onclick="event.stopPropagation();">
                        <button onclick="toggleMasterGrammar('${t.id}')" title="${isMastered ? '마스터 해제' : '마스터 표시'}" class="w-7 h-7 rounded-lg transition-colors ${isMastered ? 'text-emerald-500 bg-emerald-50' : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50'}"><i class="fa-solid fa-circle-check text-xs"></i></button>
                        <button onclick="togglePinGrammar('${t.id}')" title="${pinnedGrammar[t.id] ? '고정 해제' : '위에 고정 (항상 열림)'}" class="w-7 h-7 rounded-lg transition-colors ${pinnedGrammar[t.id] ? 'text-[#5896cb] bg-blue-50' : 'text-slate-400 hover:text-[#5896cb] hover:bg-blue-50'}"><i class="fa-solid fa-thumbtack text-xs"></i></button>
                        <button onclick="openGrammarEditor('${t.id}')" title="수정" class="w-7 h-7 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"><i class="fa-solid fa-pen text-xs"></i></button>
                        <button onclick="toggleGrammarWordLookup()" title="${grammarWordLookupMode ? '단어 찾기 끄기' : '🔍 단어 찾기 (셀의 단어를 눌러 단어장으로)'}" class="w-7 h-7 rounded-lg transition-colors ${grammarWordLookupMode ? 'text-sky-600 bg-sky-50' : 'text-slate-400 hover:text-sky-600 hover:bg-sky-50'}"><i class="fa-solid fa-magnifying-glass text-xs"></i></button>
                        <button onclick="deleteGrammarTable('${t.id}')" title="삭제" class="w-7 h-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"><i class="fa-solid fa-trash text-xs"></i></button>
                    </span>`;
                return `
                    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div class="w-full flex items-center justify-between gap-2 px-5 py-2.5">
                            <button type="button" onclick="toggleGrammarTable('${t.id}')" class="flex items-center gap-2.5 min-w-0 text-left flex-1">
                                <span class="text-2xl shrink-0">${t.icon || '📋'}</span>
                                <div class="min-w-0 flex-1">
                                    ${grammarTopicKey(t) !== GRAMMAR_OTHER_TOPIC ? (() => { const c = grammarTopicColor(grammarTopicKey(t)); return `<span class="inline-block mb-1 text-[10px] font-bold ${c.t} ${c.b} px-1.5 py-0.5 rounded-md">${escapeHtml(grammarTopicLabel(grammarTopicKey(t)))}</span>`; })() : ''}
                                    <div class="flex items-center gap-1.5 min-w-0">
                                        <span class="font-extrabold text-slate-900 text-sm truncate">${escapeHtml(t.title || '(제목 없음)')}</span>
                                        ${isMastered ? '<span class="shrink-0 text-emerald-500" title="마스터한 표"><i class="fa-solid fa-circle-check text-xs"></i></span>' : ''}
                                    </div>
                                </div>
                            </button>
                            ${editBtns}
                            <i class="fa-solid fa-chevron-down text-slate-400 text-xs transition-transform shrink-0 cursor-pointer" data-grammar-chevron="${t.id}" onclick="toggleGrammarTable('${t.id}')" style="${isOpen ? 'transform:rotate(180deg);' : ''}"></i>
                        </div>
                        <div class="${isOpen ? '' : 'hidden'} px-5 pb-5" data-grammar-body="${t.id}">
                            ${t.desc ? `<p class="text-sm text-slate-800 leading-relaxed mb-3">${escapeHtml(t.desc).replace(/\n/g, '<br>')}</p>` : ''}
                            <div class="overflow-x-auto rounded-xl border border-slate-100">
                                <table class="w-full border-collapse">
                                    ${headerRow ? `<thead><tr>${headerRow}</tr></thead>` : ''}
                                    <tbody>${bodyRows}</tbody>
                                </table>
                            </div>
                            ${t.note ? `<div class="text-sm text-slate-700 mt-3 leading-relaxed bg-slate-50 rounded-lg px-3 py-2.5 flex gap-2"><span class="shrink-0">💡</span><span class="flex-1">${escapeHtml(t.note).replace(/\n/g, '<br>')}</span></div>` : ''}
                        </div>
                    </div>
                `;
            }).join('');

            // [냐냐 PATCH] 필터 뱃지 + 요약 줄 갱신
            if (typeof updateGrammarFilterBadge === 'function') updateGrammarFilterBadge();
            if (typeof renderGrammarFilterSummary === 'function') renderGrammarFilterSummary();
        }

        function escapeHtml(s) {
            return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        function toggleGrammarTable(id) {
            const body = document.querySelector(`[data-grammar-body="${id}"]`);
            const chevron = document.querySelector(`[data-grammar-chevron="${id}"]`);
            if (!body) return;
            const nowHidden = body.classList.toggle('hidden');
            grammarOpenState[id] = !nowHidden;
            if (chevron) chevron.style.transform = nowHidden ? 'rotate(0deg)' : 'rotate(180deg)';
        }

        function expandAllGrammar(open) {
            getAllGrammarTables().forEach(t => { grammarOpenState[t.id] = open; });
            renderGrammarTables();
        }

        // [냐냐 PATCH] 문법표 칸 강조 토글 (별표 클릭 → 노란색)
        function toggleGrammarCellHighlight(tableId, ri, ci) {
            if (!grammarCellHighlights[tableId]) grammarCellHighlights[tableId] = {};
            const key = `${ri}-${ci}`;
            if (grammarCellHighlights[tableId][key]) {
                delete grammarCellHighlights[tableId][key];
                if (Object.keys(grammarCellHighlights[tableId]).length === 0) delete grammarCellHighlights[tableId];
            } else {
                grammarCellHighlights[tableId][key] = true;
            }
            renderGrammarTables();
            saveToStorage();
        }

        // [냐냐 PATCH] 문법 표 고정 (항상 위+열림)
        function togglePinGrammar(id) {
            if (pinnedGrammar[id]) {
                delete pinnedGrammar[id];
                showToast("고정을 해제했어요", "info");
            } else {
                pinnedGrammar[id] = true;
                grammarOpenState[id] = true; // 고정하면 열어둠
                showToast("표를 위에 고정했어요 📌", "success");
            }
            renderGrammarTables();
            saveToStorage();
        }

        function clearGrammarSearch() {
            const input = document.getElementById('grammar-search');
            if (input) { input.value = ''; input.focus(); }
            renderGrammarTables();
        }

        // [냐냐 PATCH] 문법표 마스터 토글 (헤더 문법 마스터 통계 + 일지 기록 연동)
        function toggleMasterGrammar(id) {
            if (masteredGrammar[id]) {
                delete masteredGrammar[id];
                if (typeof logAction === 'function') logAction('undo-new-grammar-mastered'); // [냐냐 PATCH] 일지/그래프도 감소
                showToast("마스터를 해제했어요", "info");
            } else {
                masteredGrammar[id] = true;
                if (typeof logAction === 'function') logAction('new-grammar-mastered'); // 일지 기록
                showToast("문법표를 마스터했어요! 🎉", "success");
            }
            renderGrammarTables();
            saveToStorage();
            if (typeof updateStats === 'function') updateStats(); // 헤더 마스터 문법 개수 갱신
        }

        // ============================================================
        // [냐냐 PATCH] 문법표 필터/정렬 패널 (단어장 필터 패널과 동일한 패턴)
        // - 주제(아이콘) 다중선택 + 마스터 상태 단일선택 + 정렬 단일선택, '확인' 눌러야 적용
        // ============================================================
        let grammarFilterTopics = [];       // [] = 전체, 아니면 아이콘 문자열(또는 '__other__') 목록
        let grammarFilterMastery = 'all';   // all | mastered | not-mastered
        // 정렬은 기존 grammarSortMode('newest'|'oldest') 재사용
        let pendingGrammarTopics = [];
        let pendingGrammarMastery = 'all';
        let pendingGrammarSort = 'newest';

        const GRAMMAR_OTHER_TOPIC = '__other__'; // 아이콘 목록에 없는 표는 전부 '기타'로

        // 표 하나의 주제 키: 아이콘이 GRAMMAR_ICONS에 있으면 그 아이콘, 없으면 '기타'
        function grammarTopicKey(t) {
            const icon = t.icon || '';
            return (typeof GRAMMAR_ICONS !== 'undefined' && GRAMMAR_ICONS.find(g => g.icon === icon)) ? icon : GRAMMAR_OTHER_TOPIC;
        }
        function grammarTopicLabel(key) {
            if (key === GRAMMAR_OTHER_TOPIC) return '기타';
            const g = (typeof GRAMMAR_ICONS !== 'undefined') ? GRAMMAR_ICONS.find(x => x.icon === key) : null;
            return g ? g.label : '기타';
        }
        // [냐냐 PATCH] 주제별 색상 (GRAMMAR_ICONS 순서대로 팔레트 순환)
        const GRAMMAR_TOPIC_COLORS = [
            { t: 'text-violet-600', b: 'bg-violet-50', r: 'border-violet-200' },
            { t: 'text-sky-600', b: 'bg-sky-50', r: 'border-sky-200' },
            { t: 'text-emerald-600', b: 'bg-emerald-50', r: 'border-emerald-200' },
            { t: 'text-amber-600', b: 'bg-amber-50', r: 'border-amber-200' },
            { t: 'text-rose-600', b: 'bg-rose-50', r: 'border-rose-200' },
            { t: 'text-teal-600', b: 'bg-teal-50', r: 'border-teal-200' },
            { t: 'text-indigo-600', b: 'bg-indigo-50', r: 'border-indigo-200' },
            { t: 'text-pink-600', b: 'bg-pink-50', r: 'border-pink-200' },
            { t: 'text-cyan-600', b: 'bg-cyan-50', r: 'border-cyan-200' },
            { t: 'text-orange-600', b: 'bg-orange-50', r: 'border-orange-200' },
        ];
        function grammarTopicColor(key) {
            if (key === GRAMMAR_OTHER_TOPIC) return { t: 'text-slate-500', b: 'bg-slate-50', r: 'border-slate-200' };
            const idx = (typeof GRAMMAR_ICONS !== 'undefined') ? GRAMMAR_ICONS.findIndex(g => g.icon === key) : -1;
            return GRAMMAR_TOPIC_COLORS[(idx >= 0 ? idx : 0) % GRAMMAR_TOPIC_COLORS.length];
        }

        // 현재 표들에 실제로 존재하는 주제만 필터 버튼으로 렌더 (기타는 맨 뒤)
        function renderGrammarTopicFilterButtons() {
            const box = document.getElementById('grammar-filter-topic-box');
            if (!box) return;
            const present = new Set(getAllGrammarTables().map(grammarTopicKey));
            const ordered = (typeof GRAMMAR_ICONS !== 'undefined' ? GRAMMAR_ICONS.map(g => g.icon) : []).filter(ic => present.has(ic));
            if (present.has(GRAMMAR_OTHER_TOPIC)) ordered.push(GRAMMAR_OTHER_TOPIC);
            if (ordered.length === 0) {
                box.innerHTML = '<span class="text-[11px] text-slate-400">표가 없어요</span>';
                return;
            }
            box.innerHTML = ordered.map(key => {
                const on = pendingGrammarTopics.includes(key);
                const label = key === GRAMMAR_OTHER_TOPIC ? '⭐ 기타' : `${key} ${grammarTopicLabel(key)}`;
                const cls = on ? 'border-violet-500 bg-violet-50 text-violet-600' : 'border-slate-200 bg-slate-50 text-slate-500';
                return `<button type="button" data-gtopic="${key}" onclick="toggleGrammarFilterTopic(this)" class="grammar-topic-btn text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all ${cls}">${label}</button>`;
            }).join('');
        }

        function toggleGrammarFilterTopic(btn) {
            const key = btn.dataset.gtopic;
            const i = pendingGrammarTopics.indexOf(key);
            if (i >= 0) pendingGrammarTopics.splice(i, 1);
            else pendingGrammarTopics.push(key);
            styleFilterPill(btn, i < 0); // vocab.js의 공용 헬퍼 재사용
        }
        function setGrammarFilterMastery(btn) {
            pendingGrammarMastery = btn.dataset.gmastery;
            document.querySelectorAll('.grammar-mastery-btn').forEach(b => styleFilterPill(b, b === btn));
        }
        function setGrammarFilterSort(btn) {
            pendingGrammarSort = btn.dataset.gsort;
            document.querySelectorAll('.grammar-sort-btn').forEach(b => styleFilterPill(b, b === btn));
        }

        function syncGrammarFilterPanelUI() {
            pendingGrammarTopics = [...grammarFilterTopics];
            pendingGrammarMastery = grammarFilterMastery;
            pendingGrammarSort = grammarSortMode;
            renderGrammarTopicFilterButtons();
            document.querySelectorAll('.grammar-mastery-btn').forEach(b => styleFilterPill(b, b.dataset.gmastery === pendingGrammarMastery));
            document.querySelectorAll('.grammar-sort-btn').forEach(b => styleFilterPill(b, b.dataset.gsort === pendingGrammarSort));
        }
        function toggleGrammarFilterPanel() {
            const panel = document.getElementById('grammar-filter-panel');
            if (!panel) return;
            const willOpen = panel.classList.contains('hidden');
            panel.classList.toggle('hidden');
            if (willOpen) syncGrammarFilterPanelUI();
        }
        function closeGrammarFilterPanel() {
            document.getElementById('grammar-filter-panel')?.classList.add('hidden');
        }
        function applyGrammarFilters() {
            grammarFilterTopics = [...pendingGrammarTopics];
            grammarFilterMastery = pendingGrammarMastery;
            grammarSortMode = pendingGrammarSort;
            saveGrammarFilterPrefs();
            closeGrammarFilterPanel();
            renderGrammarTables();
        }
        function resetGrammarFilters() {
            pendingGrammarTopics = [];
            pendingGrammarMastery = 'all';
            pendingGrammarSort = 'newest';
            grammarFilterTopics = [];
            grammarFilterMastery = 'all';
            grammarSortMode = 'newest';
            syncGrammarFilterPanelUI();
            saveGrammarFilterPrefs();
            renderGrammarTables();
        }
        function updateGrammarFilterBadge() {
            const badge = document.getElementById('grammar-filter-badge');
            if (!badge) return;
            const active = grammarFilterTopics.length > 0 || grammarFilterMastery !== 'all' || grammarSortMode !== 'newest';
            badge.classList.toggle('hidden', !active);
        }
        function renderGrammarFilterSummary() {
            const box = document.getElementById('grammar-filter-summary');
            if (!box) return;
            const chips = [];
            if (grammarFilterTopics.length > 0) chips.push(grammarFilterTopics.map(grammarTopicLabel).join('·'));
            if (grammarFilterMastery === 'mastered') chips.push('마스터만');
            else if (grammarFilterMastery === 'not-mastered') chips.push('마스터 제외');
            const sortLabel = grammarSortMode === 'newest' ? '최신순' : (grammarSortMode === 'topic' ? '주제순' : '오래된순');
            const filterPart = chips.length > 0
                ? chips.map(c => `<span class="bg-violet-50 text-violet-600 font-bold px-2 py-0.5 rounded-full">${escapeHtml(c)}</span>`).join('')
                : `<span class="text-slate-400">전체 표</span>`;
            box.innerHTML = `<i class="fa-solid fa-filter text-[9px]"></i>${filterPart}<span class="text-slate-300">·</span><span class="text-slate-500">${sortLabel}</span>`;
        }
        function saveGrammarFilterPrefs() {
            try {
                localStorage.setItem('nyanya_grammar_filters', JSON.stringify({
                    topics: grammarFilterTopics, mastery: grammarFilterMastery, sort: grammarSortMode
                }));
            } catch (e) {}
        }
        function loadGrammarFilterPrefs() {
            try {
                const raw = localStorage.getItem('nyanya_grammar_filters');
                if (!raw) return;
                const f = JSON.parse(raw);
                if (Array.isArray(f.topics)) grammarFilterTopics = f.topics;
                if (f.mastery) grammarFilterMastery = f.mastery;
                if (f.sort) grammarSortMode = f.sort;
            } catch (e) {}
        }

        // ---- 문법 표 편집기 ----
        let grammarEditorState = null; // { id, icon, title, desc, note, headers:[], rows:[[]] }

        // [냐냐 PATCH] 편집창(등록/수정) 너비 드래그 조절 — 열이 많은 표를 넓게 보기 위함. 조회 화면과 무관.
        let grammarEditorWidth = null; // px (null=기본 672)
        let _geResize = null;
        function loadGrammarEditorWidth() {
            try {
                const v = parseInt(localStorage.getItem('nyanya_grammar_editor_width') || '', 10);
                if (!isNaN(v)) grammarEditorWidth = v;
            } catch (e) {}
        }
        function clampGrammarEditorWidth(w) {
            const maxW = Math.round((window.innerWidth || 1200) * 0.95);
            return Math.max(480, Math.min(w, maxW, 1600));
        }
        function applyGrammarEditorWidth() {
            const box = document.getElementById('grammar-editor-box');
            if (!box) return;
            box.style.width = clampGrammarEditorWidth(grammarEditorWidth || 672) + 'px';
        }
        function startGrammarEditorResize(e) {
            const box = document.getElementById('grammar-editor-box');
            if (!box) return;
            e.preventDefault();
            _geResize = { startX: e.clientX, startW: box.getBoundingClientRect().width };
            document.addEventListener('mousemove', onGrammarEditorResize);
            document.addEventListener('mouseup', endGrammarEditorResize);
            document.body.style.userSelect = 'none';
        }
        function onGrammarEditorResize(e) {
            if (!_geResize) return;
            const box = document.getElementById('grammar-editor-box');
            if (!box) return;
            // 모달이 가운데 정렬이라 오른쪽으로 끈 만큼 좌우로 같이 늘어남 → ×2 해야 핸들이 커서를 따라감
            const w = clampGrammarEditorWidth(_geResize.startW + (e.clientX - _geResize.startX) * 2);
            box.style.width = w + 'px';
            grammarEditorWidth = w;
        }
        function endGrammarEditorResize() {
            _geResize = null;
            document.removeEventListener('mousemove', onGrammarEditorResize);
            document.removeEventListener('mouseup', endGrammarEditorResize);
            document.body.style.userSelect = '';
            try { if (grammarEditorWidth) localStorage.setItem('nyanya_grammar_editor_width', String(grammarEditorWidth)); } catch (e) {}
        }

        function openGrammarEditor(id) {
            if (id) {
                const existing = getAllGrammarTables().find(t => t.id === id);
                // 깊은 복사
                grammarEditorState = JSON.parse(JSON.stringify({
                    id: existing.id,
                    icon: existing.icon || '📋',
                    title: existing.title || '',
                    desc: existing.desc || '',
                    note: existing.note || '',
                    headers: existing.headers || ['', ''],
                    rows: existing.rows || [['', '']],
                    highlightCols: existing.highlightCols || [0],
                    _isBaseId: !!GRAMMAR_TABLES.find(b => b.id === existing.id)
                }));
            } else {
                grammarEditorState = {
                    id: 'custom-' + Date.now(),
                    icon: '📋',
                    title: '',
                    desc: '',
                    note: '',
                    headers: ['뜻', '스페인어'],
                    rows: [['', ''], ['', '']],
                    highlightCols: [0],
                    _isBaseId: false
                };
            }
            document.getElementById('grammar-editor-modal').classList.remove('hidden');
            applyGrammarEditorWidth(); // [냐냐 PATCH] 저장된/기본 너비 적용
            document.getElementById('grammar-editor-title').innerText = id ? '표 수정' : '새 표 만들기';
            renderGrammarEditorFields();
        }

        function closeGrammarEditor() {
            document.getElementById('grammar-editor-modal').classList.add('hidden');
            grammarEditorState = null;
        }

        // [냐냐 PATCH] 문법 종류별 아이콘 목록 — 냐냐가 '주제 관리'에서 직접 편집 가능(저장키 grammarTopics)
        const DEFAULT_GRAMMAR_ICONS = [
            { icon: '📘', label: '기본' },
            { icon: '🔢', label: '숫자' },
            { icon: '👤', label: '인칭/대명사' },
            { icon: '⏰', label: '시제' },
            { icon: '🔀', label: '동사변화' },
            { icon: '📝', label: '형용사' },
            { icon: '🔗', label: '전치사/접속사' },
            { icon: '❗', label: '불규칙' },
            { icon: '💬', label: '회화' },
            { icon: '⭐', label: '기타' },
        ];
        let GRAMMAR_ICONS = DEFAULT_GRAMMAR_ICONS.map(x => ({ ...x })); // 로드 시 저장된 목록으로 덮어씀
        function renderGeIconPicker(desired) {
            const sel = document.getElementById('ge-icon');
            if (!sel || sel.tagName !== 'SELECT') return;
            const cur = desired || sel.value || '📘';
            let opts = GRAMMAR_ICONS.map(g => `<option value="${g.icon}">${g.icon} ${escapeHtml(g.label)}</option>`).join('');
            // 현재 아이콘이 주제 목록에 없으면(구버전 기본표 등) 임시 옵션 추가
            if (cur && !GRAMMAR_ICONS.some(g => g.icon === cur)) {
                opts = `<option value="${cur}">${cur} (주제 미지정)</option>` + opts;
            }
            sel.innerHTML = opts;
            sel.value = cur; // 옵션 채운 뒤 값 지정 (빈 select에 미리 넣으면 안 먹힘)
        }
        function selectGeIcon(icon) {
            const sel = document.getElementById('ge-icon');
            if (sel) sel.value = icon;
            renderGeIconPicker();
        }

        // ============================================================
        // [냐냐 PATCH] 주제 관리 — 아이콘+주제 이름 목록을 직접 편집
        //   여기서 만든 주제로 필터(주제)·아이콘 피커·조회 표시가 전부 연동됨
        // ============================================================
        let topicEditorState = null; // 편집 중 임시 복사본 [{icon,label}]

        function openTopicManager() {
            topicEditorState = GRAMMAR_ICONS.map(x => ({ icon: x.icon, label: x.label }));
            renderTopicManagerList();
            document.getElementById('topic-manager-modal').classList.remove('hidden');
        }
        function closeTopicManager() {
            document.getElementById('topic-manager-modal').classList.add('hidden');
            topicEditorState = null;
        }
        function renderTopicManagerList() {
            const box = document.getElementById('topic-manager-list');
            if (!box || !topicEditorState) return;
            if (topicEditorState.length === 0) {
                box.innerHTML = '<p class="text-center text-sm text-slate-400 py-6">주제가 없어요. 아래 버튼으로 추가해 주세요!</p>';
                return;
            }
            box.innerHTML = topicEditorState.map((t, i) => `
                <div class="flex items-center gap-2">
                    <input type="text" value="${escapeHtml(t.icon || '').replace(/"/g, '&quot;')}" oninput="topicMgrUpdate(${i}, 'icon', this.value)" maxlength="8" placeholder="🙂" class="w-12 shrink-0 text-center bg-slate-50 px-1 py-2 rounded-lg border border-slate-200 text-lg focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <input type="text" value="${escapeHtml(t.label || '').replace(/"/g, '&quot;')}" oninput="topicMgrUpdate(${i}, 'label', this.value)" placeholder="주제 이름 (예: 시제)" class="flex-1 min-w-0 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <button type="button" onclick="topicMgrMove(${i}, -1)" title="위로" class="w-7 h-7 shrink-0 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 ${i === 0 ? 'opacity-30 pointer-events-none' : ''}"><i class="fa-solid fa-chevron-up text-xs"></i></button>
                    <button type="button" onclick="topicMgrMove(${i}, 1)" title="아래로" class="w-7 h-7 shrink-0 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 ${i === topicEditorState.length - 1 ? 'opacity-30 pointer-events-none' : ''}"><i class="fa-solid fa-chevron-down text-xs"></i></button>
                    <button type="button" onclick="topicMgrDelete(${i})" title="삭제" class="w-7 h-7 shrink-0 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"><i class="fa-solid fa-trash text-xs"></i></button>
                </div>
            `).join('');
        }
        function topicMgrUpdate(i, field, value) {
            if (!topicEditorState || !topicEditorState[i]) return;
            topicEditorState[i][field] = value; // input 값은 실시간 반영 (재렌더 안 함 → 포커스 유지)
        }
        function topicMgrAdd() {
            if (!topicEditorState) return;
            topicEditorState.push({ icon: '⭐', label: '' });
            renderTopicManagerList();
            // 방금 추가한 주제 이름 칸에 포커스
            const box = document.getElementById('topic-manager-list');
            const inputs = box ? box.querySelectorAll('input[type="text"]') : [];
            if (inputs.length >= 1) inputs[inputs.length - 1].focus();
        }
        function topicMgrDelete(i) {
            if (!topicEditorState) return;
            topicEditorState.splice(i, 1);
            renderTopicManagerList();
        }
        function topicMgrMove(i, dir) {
            if (!topicEditorState) return;
            const j = i + dir;
            if (j < 0 || j >= topicEditorState.length) return;
            [topicEditorState[i], topicEditorState[j]] = [topicEditorState[j], topicEditorState[i]];
            renderTopicManagerList();
        }
        function topicMgrReset() {
            showConfirm("주제 목록을 기본값으로?", "지금 편집 중인 내용이 기본 주제 목록으로 바뀌어요. (저장을 눌러야 실제로 적용돼요)", () => {
                topicEditorState = DEFAULT_GRAMMAR_ICONS.map(x => ({ ...x }));
                renderTopicManagerList();
            });
        }
        function saveTopicManager() {
            if (!topicEditorState) return;
            // 아이콘 비어있는 행은 제외, 주제 이름 없으면 아이콘으로 대체
            const cleaned = topicEditorState
                .map(t => ({ icon: (t.icon || '').trim(), label: (t.label || '').trim() }))
                .filter(t => t.icon)
                .map(t => ({ icon: t.icon, label: t.label || t.icon }));
            if (cleaned.length === 0) { showToast("주제를 하나 이상 남겨 주세요!", "error"); return; }
            GRAMMAR_ICONS = cleaned;
            closeTopicManager();
            saveToStorage();
            renderGrammarTables();          // 조회 화면 주제 칩 갱신
            if (typeof renderGeIconPicker === 'function') renderGeIconPicker(); // 아이콘 피커 갱신
            showToast("주제 목록을 저장했어요! ✨", "success");
        }

        function renderGrammarEditorFields() {
            const s = grammarEditorState;
            if (!s) return;
            renderGeIconPicker(s.icon || '📘'); // [냐냐 PATCH] 주제 콤보박스 채우고 현재 값 선택
            document.getElementById('ge-title').value = s.title;
            document.getElementById('ge-desc').value = s.desc;
            document.getElementById('ge-note').value = s.note;

            // 편집 중인 표의 칸 강조 상태 (id 기준)
            const hl = (s.id && grammarCellHighlights[s.id]) ? grammarCellHighlights[s.id] : {};

            // 표 그리드 (헤더 행 + 데이터 행들)
            const grid = document.getElementById('ge-grid');
            const colCount = s.headers.length;
            let html = '<table class="border-collapse w-full"><thead><tr>';
            s.headers.forEach((h, ci) => {
                // [냐냐 PATCH] 열 강조(글씨체) 버튼을 열 제목 '위'에 배치
                const isColHl = (s.highlightCols || []).includes(ci);
                html += `<th class="p-1 align-top">
                    <div class="flex items-center justify-center gap-1 mb-1">
                        <button type="button" onclick="moveGeCol(${ci}, -1)" title="왼쪽으로" class="w-5 h-5 rounded text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors flex items-center justify-center ${ci === 0 ? 'invisible' : ''}"><i class="fa-solid fa-chevron-left text-[9px]"></i></button>
                        <button type="button" onclick="moveGeCol(${ci}, 1)" title="오른쪽으로" class="w-5 h-5 rounded text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors flex items-center justify-center ${ci === colCount - 1 ? 'invisible' : ''}"><i class="fa-solid fa-chevron-right text-[9px]"></i></button>
                    </div>
                    <button type="button" onclick="toggleGeHighlight(${ci})" class="mb-1 w-full text-[10px] font-bold rounded-md py-1 transition-all ${isColHl ? 'bg-[#5896cb] text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}">${isColHl ? '★ 열 강조 켬' : '☆ 열 강조'}</button>
                    <input value="${escapeAttr(h)}" oninput="updateGeHeader(${ci}, this.value)" placeholder="열 제목" class="w-full min-w-[90px] bg-[#f3f8fd] border border-[#cfdeeb] rounded-lg px-2 py-1.5 text-xs font-bold text-[#2c5578] focus:outline-none focus:ring-1 focus:ring-[#5896cb]">
                </th>`;
            });
            html += `<th class="p-1 w-8"></th></tr></thead><tbody>`;
            s.rows.forEach((row, ri) => {
                html += '<tr>';
                for (let ci = 0; ci < colCount; ci++) {
                    const val = row[ci] || '';
                    // [냐냐 PATCH] 각 칸에 별표 → 클릭하면 연분홍 강조 토글 (편집 중에도 가능)
                    const isHl = !!hl[`${ri}-${ci}`];
                    const cellBg = isHl ? 'bg-[#ffe0ec]' : 'bg-slate-50';
                    const starColor = isHl ? 'text-pink-400' : 'text-slate-300 hover:text-pink-300';
                    html += `<td class="p-1">
                        <div class="flex items-center gap-1 ${cellBg} rounded-lg px-1">
                            <button type="button" onclick="toggleGeCellHighlight(${ri}, ${ci})" title="칸 강조" class="${starColor} transition-colors shrink-0"><i class="fa-solid fa-star text-[10px]"></i></button>
                            <input value="${escapeAttr(val)}" data-ge-ri="${ri}" data-ge-ci="${ci}" oninput="updateGeCell(${ri}, ${ci}, this.value)" onkeydown="handleGeCellKey(event, ${ri}, ${ci})" class="w-full min-w-[70px] bg-transparent border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400">
                        </div>
                    </td>`;
                }
                html += `<td class="p-1"><button onclick="removeGeRow(${ri})" title="행 삭제" class="text-slate-300 hover:text-red-500 px-1"><i class="fa-solid fa-circle-minus"></i></button></td>`;
                html += '</tr>';
            });
            html += '</tbody></table>';
            grid.innerHTML = html;
        }

        // [냐냐 PATCH] 편집 중 칸 강조 토글 (표 id 기준으로 grammarCellHighlights에 저장)
        function toggleGeCellHighlight(ri, ci) {
            const s = grammarEditorState;
            if (!s || !s.id) return;
            if (!grammarCellHighlights[s.id]) grammarCellHighlights[s.id] = {};
            const key = `${ri}-${ci}`;
            if (grammarCellHighlights[s.id][key]) {
                delete grammarCellHighlights[s.id][key];
                if (Object.keys(grammarCellHighlights[s.id]).length === 0) delete grammarCellHighlights[s.id];
            } else {
                grammarCellHighlights[s.id][key] = true;
            }
            renderGrammarEditorFields();
        }

        function escapeAttr(s) {
            return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        }
        function updateGeHeader(ci, val) { grammarEditorState.headers[ci] = val; }
        // [냐냐 PATCH] 열 강조(글씨체) 토글 — 편집 중
        function toggleGeHighlight(ci) {
            if (!grammarEditorState.highlightCols) grammarEditorState.highlightCols = [];
            const idx = grammarEditorState.highlightCols.indexOf(ci);
            if (idx >= 0) grammarEditorState.highlightCols.splice(idx, 1);
            else grammarEditorState.highlightCols.push(ci);
            renderGrammarEditorFields();
        }
        function updateGeCell(ri, ci, val) { grammarEditorState.rows[ri][ci] = val; }
        // [냐냐 PATCH] 열 위치 이동 (좌우 스왑)
        function moveGeCol(ci, dir) {
            const s = grammarEditorState;
            if (!s) return;
            const nc = ci + dir;
            if (nc < 0 || nc >= s.headers.length) return;
            // 헤더 스왑
            [s.headers[ci], s.headers[nc]] = [s.headers[nc], s.headers[ci]];
            // 각 행의 셀 스왑
            s.rows.forEach(row => {
                const a = row[ci] || '', b = row[nc] || '';
                row[ci] = b; row[nc] = a;
            });
            // 열 강조 목록 갱신
            if (s.highlightCols) {
                s.highlightCols = s.highlightCols.map(x => x === ci ? nc : (x === nc ? ci : x));
            }
            // 칸 강조(grammarCellHighlights)도 열 위치 반영
            if (s.id && grammarCellHighlights[s.id]) {
                const newHl = {};
                Object.keys(grammarCellHighlights[s.id]).forEach(key => {
                    const [ri, cc] = key.split('-').map(Number);
                    let ncc = cc;
                    if (cc === ci) ncc = nc; else if (cc === nc) ncc = ci;
                    newHl[`${ri}-${ncc}`] = true;
                });
                grammarCellHighlights[s.id] = newHl;
            }
            renderGrammarEditorFields();
        }
        // [냐냐 PATCH] 표 편집 중 엔터 → 다음 칸(아래칸, 없으면 다음 열 맨 위)로 이동
        function handleGeCellKey(e, ri, ci) {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const s = grammarEditorState;
            if (!s) return;
            const rowCount = s.rows.length;
            const colCount = s.headers.length;
            let nr = ri + 1, nc = ci;
            if (nr >= rowCount) {
                // 아래 칸 없으면 다음 열의 맨 위로
                nr = 0;
                nc = ci + 1;
                if (nc >= colCount) return; // 마지막 열 마지막 행이면 그대로
            }
            const next = document.querySelector(`[data-ge-ri="${nr}"][data-ge-ci="${nc}"]`);
            if (next) { next.focus(); next.select(); }
        }
        function addGeRow() {
            grammarEditorState.rows.push(new Array(grammarEditorState.headers.length).fill(''));
            renderGrammarEditorFields();
        }
        function removeGeRow(ri) {
            if (grammarEditorState.rows.length <= 1) { showToast("최소 한 줄은 있어야 해요", "error"); return; }
            grammarEditorState.rows.splice(ri, 1);
            renderGrammarEditorFields();
        }
        function addGeColumn() {
            grammarEditorState.headers.push('');
            grammarEditorState.rows.forEach(r => r.push(''));
            renderGrammarEditorFields();
        }
        function removeGeColumn() {
            if (grammarEditorState.headers.length <= 1) { showToast("최소 한 열은 있어야 해요", "error"); return; }
            const lastIdx = grammarEditorState.headers.length - 1;
            grammarEditorState.headers.pop();
            grammarEditorState.rows.forEach(r => r.pop());
            // 강조 목록에서 삭제된 열 제거
            if (grammarEditorState.highlightCols) {
                grammarEditorState.highlightCols = grammarEditorState.highlightCols.filter(ci => ci !== lastIdx);
            }
            renderGrammarEditorFields();
        }

        async function saveGrammarEditor() {
            const s = grammarEditorState;
            s.icon = document.getElementById('ge-icon').value.trim() || '📋';
            s.title = document.getElementById('ge-title').value.trim();
            s.desc = document.getElementById('ge-desc').value.trim();
            s.note = document.getElementById('ge-note').value.trim();
            if (!s.title) { showToast("표 제목을 입력해 주세요!", "error"); return; }

            // 빈 행 정리 (모든 칸이 비어있으면 제거)
            s.rows = s.rows.filter(r => r.some(c => (c || '').trim()));
            if (s.rows.length === 0) s.rows = [new Array(s.headers.length).fill('')];

            const tableData = {
                id: s.id, icon: s.icon, title: s.title, desc: s.desc, note: s.note,
                headers: s.headers, rows: s.rows, highlightCols: s.highlightCols || [0], _edited: true
            };

            // 기존 사용자 표면 교체, 아니면 추가
            const existingIdx = customGrammarTables.findIndex(c => c.id === s.id);
            const isDefaultId = GRAMMAR_TABLES.find(b => b.id === s.id);
            const isBrandNew = existingIdx < 0 && !isDefaultId; // 완전히 새로 만든 표
            if (existingIdx >= 0) customGrammarTables[existingIdx] = tableData;
            else customGrammarTables.push(tableData);

            closeGrammarEditor();
            renderGrammarTables();
            if (isBrandNew && typeof logAction === 'function') logAction('new-grammar'); // [냐냐 PATCH] 새 문법표 등록 기록
            await saveToStorage();
            if (typeof updateStats === 'function') updateStats(); // 헤더 문법 개수 갱신
            showToast("문법 표가 저장됐어요! ✨", "success");
        }

        function deleteGrammarTable(id) {
            const t = getAllGrammarTables().find(x => x.id === id);
            const isDefault = GRAMMAR_TABLES.find(b => b.id === id); // 기본 표인지
            showConfirm(
                `"${t ? t.title : '이 표'}"를 삭제할까요?`,
                "삭제한 표는 다시 꺼낼 수 없어요.",
                async () => {
                    customGrammarTables = customGrammarTables.filter(c => c.id !== id);
                    if (isDefault && !hiddenDefaultGrammar.includes(id)) hiddenDefaultGrammar.push(id); // [냐냐 PATCH] 기본 표는 숨김 목록에 추가
                    delete grammarOpenState[id];
                    delete pinnedGrammar[id];
                    // [냐냐 PATCH] 일지/그래프 감소 — 삭제 시 등록/마스터 카운트도 취소
                    if (masteredGrammar[id]) { delete masteredGrammar[id]; if (typeof logAction === 'function') logAction('undo-new-grammar-mastered'); }
                    if (typeof logAction === 'function') logAction('undo-new-grammar');
                    renderGrammarTables();
                    await saveToStorage();
                    showToast("표를 삭제했어요", "success");
                }
            );
        }

        function resetGrammarTable(id) {
            // 기본 표를 수정했던 걸 원래대로 되돌림
            const wasEdited = customGrammarTables.find(c => c.id === id);
            if (!wasEdited) { showToast("이미 기본 상태예요", "info"); return; }
            showConfirm(
                "기본값으로 되돌릴까요?",
                "수정한 내용이 사라지고 원래 기본 표로 돌아가요.",
                async () => {
                    customGrammarTables = customGrammarTables.filter(c => c.id !== id);
                    renderGrammarTables();
                    await saveToStorage();
                    showToast("기본 표로 되돌렸어요", "success");
                },
                { okLabel: '되돌리기', cancelLabel: '취소', okStyle: 'primary' }
            );
        }

        // [냐냐 PATCH] 메뉴별 아이콘 색 (선택 안 됐을 때)
        const NAV_ICON_COLORS = {
            'list': 'text-violet-500',
            'grammar': 'text-teal-500',
            'cards': 'text-cyan-500',
            'review': 'text-indigo-500',
            'quiz': 'text-amber-500',
            'games': 'text-pink-500',
            'ai-feedback': 'text-sky-500',
            'records': 'text-emerald-500'
        };
        // [냐냐 PATCH] 선택된 메뉴의 배경색 = 그 메뉴의 색 (아이콘은 통일, 선택으로 색 구분)
        const NAV_SELECT_STYLES = {
            'list': { bg: 'bg-violet-50', text: 'text-violet-700' },
            'grammar': { bg: 'bg-teal-50', text: 'text-teal-700' },
            'cards': { bg: 'bg-cyan-50', text: 'text-cyan-700' },
            'review': { bg: 'bg-indigo-50', text: 'text-indigo-700' },
            'quiz': { bg: 'bg-amber-50', text: 'text-amber-700' },
            'games': { bg: 'bg-pink-50', text: 'text-pink-700' },
            'ai-feedback': { bg: 'bg-sky-50', text: 'text-sky-700' },
            'records': { bg: 'bg-emerald-50', text: 'text-emerald-700' }
        };
        function changeTab(tabId) {
            activeTab = tabId;
            document.querySelectorAll('main > section > div').forEach(el => el.classList.add('hidden'));
            document.getElementById(`tab-${tabId}`).classList.remove('hidden');

            // [냐냐 PATCH-4배치] 퀴즈는 '복습 · 퀴즈' 메뉴 안의 서브탭 → 사이드 메뉴는 복습이 켜진 것처럼 보이게
            const navKey = (tabId === 'quiz') ? 'review' : tabId;
            
            if (window.innerWidth < 768) {
                collapseMobileMenu();
            }

            const btns = {
                'list': 'nav-list',
                'cards': 'nav-cards',
                'review': 'nav-review',
                'quiz': 'nav-quiz',
                'games': 'nav-games',
                'ai-feedback': 'nav-ai',
                'records': 'nav-records',
                'grammar': 'nav-grammar'
            };
            
            Object.keys(btns).forEach(key => {
                const el = document.getElementById(btns[key]);
                if (!el) return;
                // [냐냐 PATCH] 플래시카드 메뉴는 숨김 유지 (className 재설정 때 튀어나오는 것 방지)
                const hiddenPrefix = (key === 'cards' || key === 'quiz') ? 'hidden ' : ''; // [4배치] 퀴즈 메뉴는 숨김 유지
                // [냐냐 PATCH] 아이콘 색은 전부 통일(회색), 선택했을 때만 그 메뉴의 색으로 강조
                const sel = NAV_SELECT_STYLES[key] || { bg: 'bg-violet-50', text: 'text-violet-700' };
                if (key === navKey) {
                    el.className = hiddenPrefix + `w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-sm font-bold transition-all ${sel.bg} ${sel.text}`;
                } else {
                    el.className = hiddenPrefix + "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-sm font-medium transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-700";
                }
                const icon = el.querySelector('i');
                if (icon) {
                    // 모든 개별 색 클래스 제거 → 통일된 회색 or 선택 시 흰색
                    Object.values(NAV_ICON_COLORS).forEach(c => icon.classList.remove(c));
                    icon.classList.remove('text-white', 'text-slate-400', 'text-slate-600', 'text-slate-900');
                    // 선택 시 글씨 색을 그대로 따라감(색 클래스 없음), 미선택은 옅은 회색
                    if (key !== navKey) icon.classList.add('text-slate-400');
                }
            });

            if (tabId === 'cards') {
                currentFlashcardIndex = 0;
                isFlashcardFlipped = false;
                document.getElementById('flashcard-inner').classList.remove('rotate-y-180');
                shuffleFlashcards();
                renderFlashcard();
            } else if (tabId === 'quiz') {
                initQuizTab();
            } else if (tabId === 'games') {
                // 게임 탭 열면 메뉴로 초기화
                if (typeof resetGamesMenu === 'function') resetGamesMenu();
            } else if (tabId === 'review') {
                if (typeof resetReviewTab === 'function') resetReviewTab();
            } else if (tabId === 'ai-feedback') {
                resetKoEsMissionState();
            } else if (tabId === 'records') {
                // [냐냐 PATCH] 학습기록 탭 열 때마다 '숫자 요약'은 항상 접힌 상태로 시작
                const statsBody = document.getElementById('summary-stats-body');
                if (statsBody) statsBody.classList.add('hidden');
                const statsChevron = document.querySelector("button[onclick=\"toggleChartCard('summary-stats-body', this)\"] i");
                if (statsChevron) statsChevron.style.transform = 'rotate(180deg)';
                // '내 학습 수준'도 항상 접힌 상태로 시작
                const profileBody = document.getElementById('learner-profile-display');
                if (profileBody) profileBody.classList.add('hidden');
                const profileChevron = document.querySelector("button[onclick=\"toggleChartCard('learner-profile-display', this)\"] i");
                if (profileChevron) profileChevron.style.transform = 'rotate(180deg)';
                setRecordRange('7d');
                renderStreakBadge();
                if (typeof renderEgg === 'function') renderEgg(); // [냐냐 PATCH] 알 위젯
            } else if (tabId === 'grammar') {
                // 탭 재진입 시 고정 안 한 표는 다시 접기 (고정된 것만 열린 상태 유지)
                grammarOpenState = {};
                renderGrammarTables();
            }
        }

        function triggerPunchLogo() {
            AudioFX.playPunch();
            
            const logo = document.getElementById('header-logo');
            logo.classList.add('punch-effect-right');
            setTimeout(() => logo.classList.remove('punch-effect-right'), 200);
        }

        function updateStats() {
            const total = vocabulary.length;
            const mastered = vocabulary.filter(w => w.mastered).length;
            const weak = vocabulary.filter(w => w.weak).length;
            const grammarTotal = (typeof getGrammarTotalCount === 'function') ? getGrammarTotalCount() : 0;
            const grammarMastered = (typeof getGrammarMasteredCount === 'function') ? getGrammarMasteredCount() : 0;

            const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
            setTxt('header-total-vocab', `${total}개`);
            setTxt('header-mastered-vocab', `${mastered}개`);
            setTxt('header-weak-vocab', `${weak}개`);
            setTxt('header-total-grammar', `${grammarTotal}개`);
            setTxt('header-mastered-grammar', `${grammarMastered}개`);
            // 모바일 핵심 통계
            setTxt('header-total-vocab-m', `${total}`);
            setTxt('header-mastered-vocab-m', `${mastered}`);
        }
