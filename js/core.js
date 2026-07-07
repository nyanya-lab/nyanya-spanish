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
            renderWordList();
            updateStats();
            renderDiary();
            resetKoEsMissionState();
            updateApiKeyBadge();

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
                hiddenQuestionTopics: hiddenQuestionTopics,
                grammarCellHighlights: grammarCellHighlights,
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
                hiddenQuestionTopics = payload.hiddenQuestionTopics || [];
                grammarCellHighlights = payload.grammarCellHighlights || {};
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
                hiddenQuestionTopics = [];
                grammarCellHighlights = {};
                eggState = defaultEggState();
            }

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
            // 여성 이름 힌트 (스페인어권 여성 음성들)
            const femaleHints = ['mónica','monica','paulina','helena','laura','marisol','sabina','female','mujer','esperanza','lucia','lucía','conchita','penelope','penélope'];
            let pick = esVoices.find(v => femaleHints.some(h => (v.name || '').toLowerCase().includes(h)));
            // 스페인(es-ES) 여성 우선, 없으면 아무 스페인어 여성, 없으면 첫 스페인어 음성
            if (!pick) pick = esVoices.find(v => (v.lang || '').toLowerCase() === 'es-es' && femaleHints.some(h => (v.name||'').toLowerCase().includes(h)));
            if (!pick) pick = esVoices.find(v => (v.lang || '').toLowerCase() === 'es-es') || esVoices[0];
            _cachedEsVoice = pick;
            return pick;
        }
        // 음성 목록은 비동기로 로드되므로 로드되면 캐시 초기화
        if ('speechSynthesis' in window) {
            window.speechSynthesis.onvoiceschanged = () => { _cachedEsVoice = null; pickSpanishVoice(); };
        }
        function speakSpanishVoice(text, rate) {
            if (!('speechSynthesis' in window)) {
                showToast("이 브라우저는 음성 합성을 지원하지 않아요.", "error");
                return;
            }
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'es-ES';
            u.rate = rate || 0.9;
            const voice = pickSpanishVoice();
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
                nyanyaDiary[today] = { registeredTotal: 0, masteredTotal: 0, quizTotal: 0, quizCorrect: 0, aiSessions: 0, newWordsCount: 0, newMasteredCount: 0, reviewCount: 0, gameCount: 0 };
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

            d.registeredTotal = vocabulary.length;
            d.masteredTotal = vocabulary.filter(w => w.mastered).length;
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
        const EGG_HATCH_GOAL = 200;

        // 생물 도감 (스페인/스페인어권 테마 + 정체불명 몬스터). rarity: common/rare/epic/legendary
        const CREATURES = [
            // ===== common (일반) =====
            { id: "chick", emoji: "🐤", name: "pollito (병아리)", rarity: "common", desc: "갓 태어난 노란 병아리예요!" },
            { id: "cat", emoji: "🐱", name: "gato (고양이)", rarity: "common", desc: "늘어지게 낮잠을 좋아해요." },
            { id: "dog", emoji: "🐶", name: "perro (개)", rarity: "common", desc: "충직한 친구예요." },
            { id: "frog", emoji: "🐸", name: "rana (개구리)", rarity: "common", desc: "웅덩이에서 폴짝!" },
            { id: "snail", emoji: "🐌", name: "caracol (달팽이)", rarity: "common", desc: "느리지만 꾸준해요." },
            { id: "bee", emoji: "🐝", name: "abeja (벌)", rarity: "common", desc: "부지런한 일꾼이에요." },
            { id: "mouse", emoji: "🐭", name: "ratón (생쥐)", rarity: "common", desc: "작지만 재빨라요." },
            { id: "rabbit", emoji: "🐰", name: "conejo (토끼)", rarity: "common", desc: "깡충깡충 뛰어다녀요." },
            { id: "chicken", emoji: "🐔", name: "gallina (암탉)", rarity: "common", desc: "알을 낳는 엄마예요." },
            { id: "pig", emoji: "🐷", name: "cerdo (돼지)", rarity: "common", desc: "하몽의 주인공이에요." },
            { id: "duck", emoji: "🦆", name: "pato (오리)", rarity: "common", desc: "물에서 둥둥 떠다녀요." },
            { id: "fish", emoji: "🐟", name: "pez (물고기)", rarity: "common", desc: "바닷속을 헤엄쳐요." },
            { id: "cow", emoji: "🐮", name: "vaca (소)", rarity: "common", desc: "음메- 우유를 줘요." },
            { id: "sheep", emoji: "🐑", name: "oveja (양)", rarity: "common", desc: "포근한 털을 가졌어요." },
            { id: "goat", emoji: "🐐", name: "cabra (염소)", rarity: "common", desc: "산을 잘 타요." },
            { id: "hen", emoji: "🐓", name: "gallo (수탉)", rarity: "common", desc: "아침을 알려요." },
            { id: "turkey", emoji: "🦃", name: "pavo (칠면조)", rarity: "common", desc: "크리스마스의 주인공!" },
            { id: "hamster", emoji: "🐹", name: "hámster (햄스터)", rarity: "common", desc: "볼주머니가 빵빵해요." },
            { id: "ant", emoji: "🐜", name: "hormiga (개미)", rarity: "common", desc: "작지만 힘이 세요." },
            { id: "ladybug", emoji: "🐞", name: "mariquita (무당벌레)", rarity: "common", desc: "빨간 등에 점이 있어요." },
            { id: "spider", emoji: "🕷️", name: "araña (거미)", rarity: "common", desc: "거미줄을 쳐요." },
            { id: "caterpillar", emoji: "🐛", name: "oruga (애벌레)", rarity: "common", desc: "곧 나비가 될 거예요." },
            { id: "cricket", emoji: "🦗", name: "grillo (귀뚜라미)", rarity: "common", desc: "밤에 노래해요." },
            { id: "apple", emoji: "🍎", name: "manzana (사과)", rarity: "common", desc: "빨갛고 아삭해요." },
            { id: "banana", emoji: "🍌", name: "plátano (바나나)", rarity: "common", desc: "달콤하고 노래요." },
            { id: "grape", emoji: "🍇", name: "uva (포도)", rarity: "common", desc: "스페인에선 새해에 12알 먹어요!" },
            { id: "orange", emoji: "🍊", name: "naranja (오렌지)", rarity: "common", desc: "비타민C가 가득!" },
            { id: "lemon", emoji: "🍋", name: "limón (레몬)", rarity: "common", desc: "시큼시큼해요." },
            { id: "strawberry", emoji: "🍓", name: "fresa (딸기)", rarity: "common", desc: "달콤한 봄의 과일." },
            { id: "tomato", emoji: "🍅", name: "tomate (토마토)", rarity: "common", desc: "토마티나 축제의 주인공!" },
            { id: "carrot", emoji: "🥕", name: "zanahoria (당근)", rarity: "common", desc: "토끼가 좋아해요." },
            { id: "corn", emoji: "🌽", name: "maíz (옥수수)", rarity: "common", desc: "노란 알갱이가 가득." },
            { id: "bread", emoji: "🍞", name: "pan (빵)", rarity: "common", desc: "갓 구운 냄새가 좋아요." },
            { id: "cheese", emoji: "🧀", name: "queso (치즈)", rarity: "common", desc: "고소하고 쫄깃해요." },
            { id: "egg", emoji: "🥚", name: "huevo (달걀)", rarity: "common", desc: "또 다른 알이네요?" },
            { id: "flower", emoji: "🌸", name: "flor (꽃)", rarity: "common", desc: "예쁘게 피었어요." },
            { id: "rose", emoji: "🌹", name: "rosa (장미)", rarity: "common", desc: "사랑의 꽃이에요." },
            { id: "sunflower", emoji: "🌻", name: "girasol (해바라기)", rarity: "common", desc: "해를 따라 움직여요." },
            { id: "tulip", emoji: "🌷", name: "tulipán (튤립)", rarity: "common", desc: "봄의 전령이에요." },
            { id: "tree", emoji: "🌳", name: "árbol (나무)", rarity: "common", desc: "든든하게 서 있어요." },
            { id: "cactus", emoji: "🌵", name: "cactus (선인장)", rarity: "common", desc: "물 없이도 잘 살아요." },
            { id: "leaf", emoji: "🍃", name: "hoja (잎)", rarity: "common", desc: "바람에 살랑살랑." },
            { id: "mushroom", emoji: "🍄", name: "seta (버섯)", rarity: "common", desc: "숲속에서 자라요." },
            { id: "star", emoji: "⭐", name: "estrella (별)", rarity: "common", desc: "밤하늘에 반짝여요." },
            { id: "cloud", emoji: "☁️", name: "nube (구름)", rarity: "common", desc: "하늘에 두둥실." },
            // ===== rare (레어) =====
            { id: "bull", emoji: "🐂", name: "toro (황소)", rarity: "rare", desc: "스페인의 상징이에요!" },
            { id: "owl", emoji: "🦉", name: "búho (부엉이)", rarity: "rare", desc: "밤에 공부하는 친구." },
            { id: "fox", emoji: "🦊", name: "zorro (여우)", rarity: "rare", desc: "영리하고 재빨라요." },
            { id: "octopus", emoji: "🐙", name: "pulpo (문어)", rarity: "rare", desc: "갈리시아식 pulpo가 유명해요!" },
            { id: "horse", emoji: "🐴", name: "caballo (말)", rarity: "rare", desc: "안달루시아 명마예요." },
            { id: "lion", emoji: "🦁", name: "león (사자)", rarity: "rare", desc: "용맹의 상징이에요." },
            { id: "wolf", emoji: "🐺", name: "lobo (늑대)", rarity: "rare", desc: "이베리아 늑대예요." },
            { id: "bear", emoji: "🐻", name: "oso (곰)", rarity: "rare", desc: "마드리드의 상징이에요!" },
            { id: "eagle", emoji: "🦅", name: "águila (독수리)", rarity: "rare", desc: "하늘의 제왕이에요." },
            { id: "turtle", emoji: "🐢", name: "tortuga (거북이)", rarity: "rare", desc: "오래오래 살아요." },
            { id: "butterfly", emoji: "🦋", name: "mariposa (나비)", rarity: "rare", desc: "예쁘게 팔랑팔랑." },
            { id: "deer", emoji: "🦌", name: "ciervo (사슴)", rarity: "rare", desc: "숲을 우아하게 달려요." },
            { id: "monkey", emoji: "🐵", name: "mono (원숭이)", rarity: "rare", desc: "나무를 잘 타요." },
            { id: "elephant", emoji: "🐘", name: "elefante (코끼리)", rarity: "rare", desc: "코가 아주 길어요." },
            { id: "penguin", emoji: "🐧", name: "pingüino (펭귄)", rarity: "rare", desc: "뒤뚱뒤뚱 걸어요." },
            { id: "dolphin", emoji: "🐬", name: "delfín (돌고래)", rarity: "rare", desc: "똑똑한 바다 친구." },
            { id: "shark", emoji: "🦈", name: "tiburón (상어)", rarity: "rare", desc: "바다의 사냥꾼이에요." },
            { id: "snake", emoji: "🐍", name: "serpiente (뱀)", rarity: "rare", desc: "스르륵 미끄러져요." },
            { id: "crab", emoji: "🦀", name: "cangrejo (게)", rarity: "rare", desc: "옆으로 걸어요." },
            { id: "swan", emoji: "🦢", name: "cisne (백조)", rarity: "rare", desc: "우아한 물새예요." },
            { id: "peacock_r", emoji: "🦚", name: "pavo real (공작)", rarity: "rare", desc: "화려한 깃털을 뽐내요." },
            { id: "flamingo", emoji: "🦩", name: "flamenco (홍학)", rarity: "rare", desc: "스페인 춤이랑 이름이 같아요!" },
            { id: "parrot", emoji: "🦜", name: "loro (앵무새)", rarity: "rare", desc: "말을 따라 해요." },
            { id: "hedgehog", emoji: "🦔", name: "erizo (고슴도치)", rarity: "rare", desc: "가시로 몸을 지켜요." },
            { id: "bat", emoji: "🦇", name: "murciélago (박쥐)", rarity: "rare", desc: "발렌시아의 상징이에요!" },
            { id: "paella", emoji: "🥘", name: "paella (파에야)", rarity: "rare", desc: "스페인 대표 요리예요!" },
            { id: "grapes_wine", emoji: "🍷", name: "vino (와인)", rarity: "rare", desc: "스페인 리오하 와인!" },
            { id: "churro", emoji: "🍩", name: "churro (츄러스)", rarity: "rare", desc: "초콜릿에 찍어 먹어요." },
            { id: "olive", emoji: "🫒", name: "aceituna (올리브)", rarity: "rare", desc: "스페인이 세계 1위예요." },
            { id: "rainbow", emoji: "🌈", name: "arcoíris (무지개)", rarity: "rare", desc: "비 온 뒤 나타나요." },
            // ===== epic (에픽) =====
            { id: "dragon", emoji: "🐲", name: "dragón (용)", rarity: "epic", desc: "카탈루냐 전설의 용이에요!" },
            { id: "unicorn", emoji: "🦄", name: "unicornio (유니콘)", rarity: "epic", desc: "아주 드문 전설의 동물!" },
            { id: "phoenix", emoji: "🔥", name: "fénix (불사조)", rarity: "epic", desc: "다시 타오르는 열정!" },
            { id: "whale", emoji: "🐋", name: "ballena (고래)", rarity: "epic", desc: "바다의 거인이에요." },
            { id: "tiger", emoji: "🐯", name: "tigre (호랑이)", rarity: "epic", desc: "용맹한 밀림의 왕." },
            { id: "panda", emoji: "🐼", name: "panda (판다)", rarity: "epic", desc: "대나무를 좋아해요." },
            { id: "koala", emoji: "🐨", name: "koala (코알라)", rarity: "epic", desc: "나무에 매달려 자요." },
            { id: "crocodile", emoji: "🐊", name: "cocodrilo (악어)", rarity: "epic", desc: "강가의 포식자예요." },
            { id: "rhino", emoji: "🦏", name: "rinoceronte (코뿔소)", rarity: "epic", desc: "단단한 뿔이 있어요." },
            { id: "hippo", emoji: "🦛", name: "hipopótamo (하마)", rarity: "epic", desc: "물속에서 지내요." },
            { id: "gorilla", emoji: "🦍", name: "gorila (고릴라)", rarity: "epic", desc: "힘이 아주 세요." },
            { id: "camel", emoji: "🐫", name: "camello (낙타)", rarity: "epic", desc: "사막을 건너요." },
            { id: "giraffe", emoji: "🦒", name: "jirafa (기린)", rarity: "epic", desc: "목이 아주 길어요." },
            { id: "volcano", emoji: "🌋", name: "volcán (화산)", rarity: "epic", desc: "용암을 뿜어요." },
            { id: "comet", emoji: "☄️", name: "cometa (혜성)", rarity: "epic", desc: "긴 꼬리를 그려요." },
            { id: "moon", emoji: "🌙", name: "luna (달)", rarity: "epic", desc: "밤을 밝혀줘요." },
            { id: "sun", emoji: "☀️", name: "sol (태양)", rarity: "epic", desc: "세상을 비춰요." },
            { id: "crystal", emoji: "💎", name: "cristal (수정)", rarity: "epic", desc: "반짝이는 보석이에요." },
            // ===== legendary (전설) =====
            { id: "alien", emoji: "👽", name: "alienígena (외계인)", rarity: "legendary", desc: "정체불명의 외계 생명체!" },
            { id: "ghost", emoji: "👾", name: "misterio (미스터리)", rarity: "legendary", desc: "정체를 알 수 없어요!" },
            { id: "robot", emoji: "🤖", name: "robot (로봇)", rarity: "legendary", desc: "수수께끼의 로봇이에요." },
            { id: "ninja", emoji: "🥷", name: "ninja (닌자)", rarity: "legendary", desc: "그림자처럼 나타나요!" },
            { id: "wizard", emoji: "🧙", name: "mago (마법사)", rarity: "legendary", desc: "신비한 마법을 부려요." },
            { id: "mermaid", emoji: "🧜", name: "sirena (인어)", rarity: "legendary", desc: "바닷속 전설의 존재!" },
            { id: "fairy", emoji: "🧚", name: "hada (요정)", rarity: "legendary", desc: "반짝이는 날개를 가졌어요." },
        ];

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

        function renderCollectionGrid() {
            if (!eggState) eggState = defaultEggState();
            if (!Array.isArray(eggState.collection)) eggState.collection = [];
            const owned = new Set(eggState.collection);
            const counts = {};
            eggState.collection.forEach(id => counts[id] = (counts[id] || 0) + 1);
            const cells = CREATURES.map(c => {
                const has = owned.has(c.id);
                const info = RARITY_INFO[c.rarity];
                if (has) {
                    return `<div class="relative flex flex-col items-center text-center gap-1 p-2.5 rounded-2xl ${info.bg} border border-slate-100">
                        ${counts[c.id] > 1 ? `<span class="absolute top-1 right-1.5 text-[10px] font-black ${info.color} bg-white/80 rounded-full px-1.5 py-0.5 shadow-sm">×${counts[c.id]}</span>` : ''}
                        <span class="text-3xl">${c.emoji}</span>
                        <span class="text-[11px] font-black ${info.color} leading-tight">${c.name}</span>
                        <span class="text-[9px] text-slate-400 leading-snug">${c.desc}</span>
                    </div>`;
                } else {
                    return `<div class="flex flex-col items-center justify-center gap-1 p-2.5 rounded-2xl bg-slate-50 border border-slate-100 opacity-60">
                        <span class="text-3xl grayscale">❔</span>
                        <span class="text-[11px] font-bold text-slate-300 leading-tight">???</span>
                        <span class="text-[9px] text-slate-300">아직 못 만났어요</span>
                    </div>`;
                }
            }).join('');
            return `
                <div class="mt-3">
                    <div class="grid grid-cols-3 gap-2">${cells}</div>
                </div>
            `;
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
                    cells += `<div class="aspect-square rounded-md flex items-center justify-center text-[10px] font-bold ${calColor(n, maxVal)} ${isToday ? 'ring-2 ring-violet-400' : ''}" title="${ds} · ${n}개 학습">${d}</div>`;
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

        // [냐냐 PATCH] 오늘 복습하면 좋은 단어 = 약점 점수(weakScore) 1점 이상. 점수 높은 순.
        function getTodayReviewWords() {
            const today = getLocalDateString();
            // [냐냐 PATCH] 오늘 틀린 단어만 (아직 마스터 안 된 것)
            return vocabulary
                .filter(w => w.lastWrongDate === today && !w.mastered)
                .sort((a, b) => (b.weakScore || 0) - (a.weakScore || 0));
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
            }).sort((a, b) => (b.weakScore || 0) - (a.weakScore || 0));
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
            } else if (type === 'review') {
                nyanyaDiary[today].reviewCount = (nyanyaDiary[today].reviewCount || 0) + 1; // [냐냐 PATCH] 복습 제출 1개
            } else if (type === 'game') {
                nyanyaDiary[today].gameCount = (nyanyaDiary[today].gameCount || 0) + 1; // [냐냐 PATCH] 게임 1판 완료
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
                    <div>퀴즈: <strong class="text-amber-600">${log.quizCorrect || 0}/${log.quizTotal || 0}개</strong></div>
                    <div>AI 첨삭: <strong class="text-indigo-600">${log.aiSessions || 0}회</strong></div>
                    <div>단어 복습: <strong class="text-sky-600">${log.reviewCount || 0}개</strong></div>
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
                    newMasteredCount: newMastered
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

            renderRecordLineChart(series);
            renderGrowthDailyChart(series);
            renderQuizChart(series);
            renderAiChart(series);
            renderLearnerProfileDisplay();
        }

        function recordChartXLabels(series, xOf, height) {
            const labelEvery = Math.max(1, Math.ceil(series.length / 7));
            let html = '';
            series.forEach((d, i) => {
                if (i % labelEvery === 0 || i === series.length - 1) {
                    html += `<text x="${xOf(i).toFixed(1)}" y="${height - 8}" font-size="9" fill="#94a3b8" text-anchor="middle">${d.date.slice(5)}</text>`;
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
            for (let i = 0; i <= steps; i++) {
                const val = Math.round((maxVal / steps) * i);
                const y = padding.top + chartH - (i / steps) * chartH;
                html += `<line x1="${padding.left}" y1="${y.toFixed(1)}" x2="${width - padding.right}" y2="${y.toFixed(1)}" stroke="#f1f5f9" stroke-width="1"/>`;
                html += `<text x="${(padding.left - 6).toFixed(1)}" y="${(y + 3).toFixed(1)}" font-size="8" fill="#94a3b8" text-anchor="end">${val}${suffix}</text>`;
            }
            return html;
        }

        function renderRecordLineChart(series) {
            const container = document.getElementById('record-line-chart');
            if (series.length === 0) { container.innerHTML = '<p class="text-xs text-slate-400 text-center py-8">데이터가 없어요</p>'; return; }

            const width = CHART_VIEW_WIDTH;
            const height = 180;
            const padding = { top: 16, right: 12, bottom: 28, left: 32 };
            const chartW = width - padding.left - padding.right;
            const chartH = height - padding.top - padding.bottom;

            // [냐냐 PATCH] 마스터 단어는 절대 갯수 대신 "총 단어 대비 비율(%)"로 표시
            const withRatio = series.map(d => ({
                ...d,
                masteredRatio: d.registeredTotal > 0 ? (d.masteredTotal / d.registeredTotal) * 100 : 0
            }));

            const maxVal = Math.max(1, ...series.map(d => d.registeredTotal));
            const xStep = series.length > 1 ? chartW / (series.length - 1) : 0;
            const xOf = (i) => padding.left + i * xStep;
            const baseY = height - padding.bottom;
            const yOfCount = (val) => padding.top + chartH - (val / maxVal) * chartH;
            const groupWidth = series.length > 0 ? chartW / series.length : chartW;
            const barWidth = Math.min(8, groupWidth * 0.5);

            // [냐냐 PATCH] 마스터 비율(%)은 막대그래프로 표시
            let bars = '';
            withRatio.forEach((d, i) => {
                const barH = (d.masteredRatio / 100) * chartH;
                const text = `${d.date}: 마스터 비율 ${Math.round(d.masteredRatio)}%`.replace(/'/g, "\\'");
                bars += `<rect x="${(xOf(i) - barWidth / 2).toFixed(1)}" y="${(baseY - barH).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barH.toFixed(1)}" fill="#10b981" opacity="0.7" rx="1.5"/>`;
                bars += `<rect x="${(xOf(i) - Math.max(barWidth, 14) / 2).toFixed(1)}" y="${padding.top}" width="${Math.max(barWidth, 14).toFixed(1)}" height="${chartH.toFixed(1)}" fill="transparent" style="cursor:pointer" onclick="showChartTooltip(event, 'record-line-chart-tooltip', '${text}')"/>`;
            });

            // 등록 단어 수는 꺾은선
            const linePath = withRatio.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(1)} ${yOfCount(d.registeredTotal).toFixed(1)}`).join(' ');
            const lineDots = withRatio.map((d, i) => {
                const cx = xOf(i).toFixed(1);
                const cy = yOfCount(d.registeredTotal).toFixed(1);
                const text = `${d.date}: 등록 단어 ${d.registeredTotal}개`.replace(/'/g, "\\'");
                return `<circle cx="${cx}" cy="${cy}" r="2.5" fill="#8b5cf6"/><circle cx="${cx}" cy="${cy}" r="9" fill="transparent" style="cursor:pointer" onclick="showChartTooltip(event, 'record-line-chart-tooltip', '${text}')"/>`;
            }).join('');

            container.innerHTML = `
                ${recordChartTooltipDiv('record-line-chart-tooltip')}
                <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
                    ${recordChartGridlines(maxVal, padding, chartW, chartH, width, '개')}
                    <line x1="${padding.left}" y1="${baseY}" x2="${width - padding.right}" y2="${baseY}" stroke="#cbd5e1" stroke-width="1"/>
                    ${bars}
                    <path d="${linePath}" fill="none" stroke="#8b5cf6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    ${lineDots}
                    ${recordChartXLabels(series, xOf, height)}
                </svg>
            `;
        }

        // 일별 신규 등록(꺾은선) + 신규 마스터(막대) - 둘 다 갯수 기준, 같은 스케일 공유
        function renderGrowthDailyChart(series) {
            const container = document.getElementById('record-growth-daily-chart');
            if (series.length === 0) { container.innerHTML = '<p class="text-xs text-slate-400 text-center py-8">데이터가 없어요</p>'; return; }

            const width = CHART_VIEW_WIDTH;
            const height = 180;
            const padding = { top: 16, right: 12, bottom: 28, left: 28 };
            const chartW = width - padding.left - padding.right;
            const chartH = height - padding.top - padding.bottom;
            const baseY = height - padding.bottom;

            const maxVal = Math.max(1, ...series.map(d => Math.max(d.newWordsCount, d.newMasteredCount)));
            const xStep = series.length > 1 ? chartW / (series.length - 1) : 0;
            const xOf = (i) => padding.left + i * xStep;
            const yOf = (val) => padding.top + chartH - (val / maxVal) * chartH;
            const groupWidth = series.length > 0 ? chartW / series.length : chartW;
            const barWidth = Math.min(8, groupWidth * 0.5);

            let bars = '';
            series.forEach((d, i) => {
                const barH = (d.newWordsCount / maxVal) * chartH;
                const text = `${d.date}: 신규 등록 ${d.newWordsCount}개`.replace(/'/g, "\\'");
                bars += `<rect x="${(xOf(i) - barWidth / 2).toFixed(1)}" y="${(baseY - barH).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barH.toFixed(1)}" fill="#8b5cf6" opacity="0.7" rx="1.5"/>`;
                bars += `<rect x="${(xOf(i) - Math.max(barWidth, 14) / 2).toFixed(1)}" y="${padding.top}" width="${Math.max(barWidth, 14).toFixed(1)}" height="${chartH.toFixed(1)}" fill="transparent" style="cursor:pointer" onclick="showChartTooltip(event, 'record-growth-daily-chart-tooltip', '${text}')"/>`;
            });

            const linePath = series.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(1)} ${yOf(d.newMasteredCount).toFixed(1)}`).join(' ');
            const lineDots = series.map((d, i) => {
                const cx = xOf(i).toFixed(1);
                const cy = yOf(d.newMasteredCount).toFixed(1);
                const text = `${d.date}: 신규 마스터 ${d.newMasteredCount}개`.replace(/'/g, "\\'");
                return `<circle cx="${cx}" cy="${cy}" r="2.5" fill="#10b981"/><circle cx="${cx}" cy="${cy}" r="9" fill="transparent" style="cursor:pointer" onclick="showChartTooltip(event, 'record-growth-daily-chart-tooltip', '${text}')"/>`;
            }).join('');

            container.innerHTML = `
                ${recordChartTooltipDiv('record-growth-daily-chart-tooltip')}
                <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
                    ${recordChartGridlines(maxVal, padding, chartW, chartH, width, '개')}
                    <line x1="${padding.left}" y1="${baseY}" x2="${width - padding.right}" y2="${baseY}" stroke="#cbd5e1" stroke-width="1"/>
                    ${bars}
                    <path d="${linePath}" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4 3"/>
                    ${lineDots}
                    ${recordChartXLabels(series, xOf, height)}
                </svg>
            `;
        }

        // 퀴즈 차트: 전체 풀이 갯수(꺾은선) + 오답률%(막대)를 한 차트에 겹쳐서 표시
        function renderQuizChart(series) {
            const container = document.getElementById('record-quiz-chart');
            if (series.length === 0) { container.innerHTML = '<p class="text-xs text-slate-400 text-center py-8">데이터가 없어요</p>'; return; }

            const width = CHART_VIEW_WIDTH;
            const height = 180;
            const padding = { top: 16, right: 12, bottom: 28, left: 28 };
            const chartW = width - padding.left - padding.right;
            const chartH = height - padding.top - padding.bottom;
            const baseY = height - padding.bottom;

            const withRate = series.map(d => ({
                ...d,
                wrongRate: d.quizTotal > 0 ? ((d.quizTotal - d.quizCorrect) / d.quizTotal) * 100 : 0
            }));

            const maxTotal = Math.max(1, ...withRate.map(d => d.quizTotal));
            const xStep = series.length > 1 ? chartW / (series.length - 1) : 0;
            const xOf = (i) => padding.left + i * xStep;
            const groupWidth = series.length > 0 ? chartW / series.length : chartW;
            const barWidth = Math.min(8, groupWidth * 0.5);

            // 오답률(%)은 0~100 고정 스케일의 막대로
            let bars = '';
            withRate.forEach((d, i) => {
                const barH = (d.wrongRate / 100) * chartH;
                const barX = (xOf(i) - barWidth / 2).toFixed(1);
                const barY = (baseY - barH).toFixed(1);
                const text = `${d.date}: 오답률 ${Math.round(d.wrongRate)}% (${d.quizTotal - d.quizCorrect}/${d.quizTotal}개)`.replace(/'/g, "\\'");
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
                const text = `${d.date}: 전체 ${d.quizTotal}문제`.replace(/'/g, "\\'");
                return `<circle cx="${cx}" cy="${cy}" r="2.5" fill="#8b5cf6"/><circle cx="${cx}" cy="${cy}" r="9" fill="transparent" style="cursor:pointer" onclick="showChartTooltip(event, 'record-quiz-chart-tooltip', '${text}')"/>`;
            }).join('');

            container.innerHTML = `
                ${recordChartTooltipDiv('record-quiz-chart-tooltip')}
                <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
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
            const padding = { top: 16, right: 12, bottom: 28, left: 24 };
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
                const text = `${d.date}: ${d.aiSessions}회`.replace(/'/g, "\\'");
                bars += `<rect x="${(xOfGroup(i) - barWidth / 2).toFixed(1)}" y="${(baseY - barH).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barH.toFixed(1)}" fill="#6366f1" rx="2"/>`;
                bars += `<rect x="${(xOfGroup(i) - Math.max(barWidth, 14) / 2).toFixed(1)}" y="${padding.top}" width="${Math.max(barWidth, 14).toFixed(1)}" height="${chartH.toFixed(1)}" fill="transparent" style="cursor:pointer" onclick="showChartTooltip(event, 'record-ai-chart-tooltip', '${text}')"/>`;
            });

            container.innerHTML = `
                ${recordChartTooltipDiv('record-ai-chart-tooltip')}
                <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
                    ${recordChartGridlines(maxVal, padding, chartW, chartH, width, '회')}
                    <line x1="${padding.left}" y1="${baseY}" x2="${width - padding.right}" y2="${baseY}" stroke="#cbd5e1" stroke-width="1"/>
                    ${bars}
                    ${recordChartXLabels(series, xOfGroup, height)}
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

            document.getElementById('grammar-empty-msg')?.classList.toggle('hidden', tables.length > 0);

            // [냐냐 PATCH] 최신순/오래된순 정렬 (natural order = 오래된순, reverse = 최신순)
            if (grammarSortMode === 'newest') {
                tables = [...tables].reverse();
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
                        // [냐냐 PATCH] 열 강조: 해당 열은 진한 파랑 두꺼운 글씨
                        const colHl = hlCols.includes(ci) ? 'text-[#2c5578] font-extrabold' : 'text-slate-800 font-bold';
                        // [냐냐 PATCH] 조회 화면에선 별표 없이 색 강조만 (별표는 수정 탭에서만)
                        return `<td class="px-3 py-2 text-sm text-center border border-[#e1edf7] ${colHl} ${cellBg}">${escapeHtml(c || '')}</td>`;
                    }).join('');
                    return `<tr class="${rowBg} hover:bg-[#fff8dd] transition-colors">${cells}</tr>`;
                }).join('');
                // 펼침 상태 유지 (검색 중이면 다 펼침, 아니면 기존 상태/첫번째만)
                const isOpen = query ? true : (pinnedGrammar[t.id] ? true : (grammarOpenState[t.id] !== undefined ? grammarOpenState[t.id] : false));
                const editBtns = `
                    <span class="flex items-center gap-1 shrink-0" onclick="event.stopPropagation();">
                        <button onclick="togglePinGrammar('${t.id}')" title="${pinnedGrammar[t.id] ? '고정 해제' : '위에 고정 (항상 열림)'}" class="w-7 h-7 rounded-lg transition-colors ${pinnedGrammar[t.id] ? 'text-[#5896cb] bg-blue-50' : 'text-slate-400 hover:text-[#5896cb] hover:bg-blue-50'}"><i class="fa-solid fa-thumbtack text-xs"></i></button>
                        <button onclick="openGrammarEditor('${t.id}')" title="수정" class="w-7 h-7 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"><i class="fa-solid fa-pen text-xs"></i></button>
                        <button onclick="deleteGrammarTable('${t.id}')" title="삭제" class="w-7 h-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"><i class="fa-solid fa-trash text-xs"></i></button>
                    </span>`;
                return `
                    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div class="w-full flex items-center justify-between gap-2 px-5 py-4">
                            <button type="button" onclick="toggleGrammarTable('${t.id}')" class="flex items-center gap-2.5 min-w-0 text-left flex-1">
                                <span class="text-lg shrink-0">${t.icon || '📋'}</span>
                                <span class="font-extrabold text-slate-900 text-sm">${escapeHtml(t.title || '(제목 없음)')}</span>
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
                            ${t.note ? `<p class="text-sm text-slate-700 mt-3 leading-relaxed bg-slate-50 rounded-lg px-3 py-2.5">💡 ${escapeHtml(t.note).replace(/\n/g, '<br>')}</p>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
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

        // ---- 문법 표 편집기 ----
        let grammarEditorState = null; // { id, icon, title, desc, note, headers:[], rows:[[]] }

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
            document.getElementById('grammar-editor-title').innerText = id ? '표 수정' : '새 표 만들기';
            renderGrammarEditorFields();
        }

        function closeGrammarEditor() {
            document.getElementById('grammar-editor-modal').classList.add('hidden');
            grammarEditorState = null;
        }

        // [냐냐 PATCH] 문법 종류별 아이콘 목록
        const GRAMMAR_ICONS = [
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
        function renderGeIconPicker() {
            const box = document.getElementById('ge-icon-picker');
            if (!box) return;
            const cur = document.getElementById('ge-icon').value || '📘';
            box.innerHTML = GRAMMAR_ICONS.map(g => {
                const sel = g.icon === cur;
                return `<button type="button" onclick="selectGeIcon('${g.icon}')" title="${g.label}" class="w-10 h-10 rounded-xl border text-lg flex items-center justify-center transition-all ${sel ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-200' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}">${g.icon}</button>`;
            }).join('');
        }
        function selectGeIcon(icon) {
            document.getElementById('ge-icon').value = icon;
            renderGeIconPicker();
        }

        function renderGrammarEditorFields() {
            const s = grammarEditorState;
            if (!s) return;
            document.getElementById('ge-icon').value = s.icon || '📘';
            renderGeIconPicker(); // [냐냐 PATCH] 아이콘 선택 UI
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
            if (existingIdx >= 0) customGrammarTables[existingIdx] = tableData;
            else customGrammarTables.push(tableData);

            closeGrammarEditor();
            renderGrammarTables();
            await saveToStorage();
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

        function changeTab(tabId) {
            activeTab = tabId;
            document.querySelectorAll('main > section > div').forEach(el => el.classList.add('hidden'));
            document.getElementById(`tab-${tabId}`).classList.remove('hidden');
            
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
                const hiddenPrefix = (key === 'cards') ? 'hidden ' : '';
                if (key === tabId) {
                    el.className = hiddenPrefix + "w-full flex items-center gap-3 px-4 py-2 rounded-xl text-left text-sm font-bold transition-all bg-violet-600 text-white shadow-md shadow-violet-100";
                } else {
                    el.className = hiddenPrefix + "w-full flex items-center gap-3 px-4 py-2 rounded-xl text-left text-sm font-medium transition-all text-slate-600 hover:bg-slate-50";
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
            
            document.getElementById('header-total-vocab').innerText = `${total}개`;
            document.getElementById('header-mastered-vocab').innerText = `${mastered}개`;
            // [냐냐 PATCH] 오늘 날짜 표시 제거됨 (달력이 있어서 불필요)
        }
