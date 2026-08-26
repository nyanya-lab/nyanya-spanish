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
            if (typeof DEFAULT_VOCABULARY === 'undefined') {
                alert("필수 파일(dictionary-data.js)이 로드되지 않았어요!\n\nGitHub에 'js/dictionary-data.js' 파일이 업로드됐는지, 그리고 index.html에서 이 파일을 불러오는 줄이 있는지 확인해 주세요.");
                return;
            }
            await loadFromStorage();
            checkStatsReset(); // [냐냐 PATCH] 정답률 통계 월별 초기화 확인
            if (typeof updateEggProgress === 'function') updateEggProgress(); // [냐냐 PATCH] 알 상태 초기화/렌더
            if (typeof loadFilterPrefs === 'function') loadFilterPrefs(); // [냐냐 PATCH] 저장된 필터/정렬 복원
            if (typeof loadDisplayPrefs === 'function') loadDisplayPrefs(); // [냐냐 PATCH-6배치] 카드 표시 설정 복원
            if (typeof loadQuizMix === 'function') { loadQuizMix(); if (typeof renderQuizMix === 'function') renderQuizMix(); } // [냐냐 PATCH] 퀴즈 비율 슬라이더
            if (typeof loadGrammarEditorWidth === 'function') loadGrammarEditorWidth(); // [냐냐 PATCH] 문법 편집창 너비 복원
            if (typeof loadAiGrammarScope === 'function') loadAiGrammarScope(); // [냐냐 요청] AI 미션 출제 문법 범위 복원
            if (typeof renderNotesSymbolBar === 'function') renderNotesSymbolBar(); // [냐냐 요청] 메모칸 기호 버튼
            // [냐냐 요청] 문법·개념은 마지막에 보던 모습으로 다시 시작한다.
            //   먼저 기본 모습을 깔고 → 저장된 설정으로 덮어쓴다. 순서 중요
            //   (initGrammarGroupsCollapsed 가 정렬·보기를 기본값으로 되돌려놓기 때문)
            if (typeof initGrammarGroupsCollapsed === 'function') initGrammarGroupsCollapsed();
            if (typeof loadGrammarFilterPrefs === 'function') loadGrammarFilterPrefs(); // 필터·정렬·보기·펼침 상태 복원
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
        // 기본 저장소 주소. 아무 설정도 안 하면 지금까지와 똑같이 여기를 쓴다.
        // [데모판] 기본 저장소 주소를 비워 둔다.
        //   원본에는 여기에 진짜 주소가 들어 있다. 데모에 그대로 두면, 누가 동기화 비밀번호를
        //   우연히 맞혔을 때 원본 데이터에 닿을 수 있다. 비워두면 경로가 성립하지 않아
        //   어떤 비밀번호를 넣어도 서버에 못 간다 (데모는 이 기기에만 저장된다).
        const DEFAULT_FIREBASE_DB_URL = '';
        const FIREBASE_URL_KEY = 'demo_firebase_db_url';
        const SYNC_PASSWORD_KEY = 'demo_sync_password';

        // [냐냐 요청] 앱을 남에게 나눠줄 때, 그 사람이 자기 Firebase 를 쓰게 하기 위한 설정.
        //   비워두면 위 기본 주소 → 기존 사용자는 이 값을 건드릴 일이 없고 동작도 그대로다.
        //   주소만 다르면 데이터베이스 자체가 갈리므로 서로의 데이터가 섞이지 않는다.
        function getFirebaseDbUrl() {
            const custom = (localStorage.getItem(FIREBASE_URL_KEY) || '').trim();
            return custom ? normalizeDbUrl(custom) : DEFAULT_FIREBASE_DB_URL;
        }
        function isCustomFirebaseDbUrl() {
            return getFirebaseDbUrl() !== DEFAULT_FIREBASE_DB_URL;
        }
        // 콘솔에서 복사한 주소는 끝에 `/` 나 `.json` 이 붙어 오기도 하고 https:// 가 빠지기도 한다.
        function normalizeDbUrl(raw) {
            let url = String(raw || '').trim();
            if (!url) return '';
            url = url.replace(/\.json$/i, '').replace(/\/+$/, '');
            if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
            return url;
        }

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
            return `${getFirebaseDbUrl()}/vocab/${encodeURIComponent(pw)}.json`;
        }

        function openSyncPasswordModal() {
            document.getElementById('sync-password-input').value = getSyncPassword();
            const urlInput = document.getElementById('sync-dburl-input');
            if (urlInput) urlInput.value = (localStorage.getItem(FIREBASE_URL_KEY) || '').trim();
            const adv = document.getElementById('sync-advanced');
            // 이미 직접 주소를 쓰고 있으면 접어두지 않고 바로 보여준다.
            if (adv) adv.classList.toggle('hidden', !isCustomFirebaseDbUrl());
            document.getElementById('sync-password-modal').classList.remove('hidden');
        }
        function toggleSyncAdvanced() {
            const adv = document.getElementById('sync-advanced');
            if (adv) adv.classList.toggle('hidden');
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
            const urlInput = document.getElementById('sync-dburl-input');
            const newUrl = urlInput ? normalizeDbUrl(urlInput.value) : '';
            const oldUrl = getFirebaseDbUrl();

            const apply = async () => {
                if (urlInput) {
                    // 비우면 기본 주소로 돌아간다 — 되돌릴 길을 항상 남겨둔다.
                    if (newUrl) localStorage.setItem(FIREBASE_URL_KEY, newUrl);
                    else localStorage.removeItem(FIREBASE_URL_KEY);
                }
                localStorage.setItem(SYNC_PASSWORD_KEY, value);
                closeSyncPasswordModal();
                showToast("저장했어요! 동기화를 다시 확인하는 중...", "info");
                await loadFromStorage();
                renderWordList();
                updateStats();
                renderDiary();
                if (typeof renderGrammarTables === 'function') renderGrammarTables();
            };

            // 주소를 바꾸는 건 저장소를 통째로 갈아타는 것이라, 실수하면 빈 앱이 뜬다.
            // 원래 주소의 데이터가 지워지진 않지만 놀랄 수 있으니 한 번 확인받는다.
            if ((newUrl || DEFAULT_FIREBASE_DB_URL) !== oldUrl) {
                showConfirm(
                    "저장소 주소를 바꿀까요?",
                    `데이터를 가져올 곳이 바뀝니다.\n\n지금: ${oldUrl}\n바꾼 뒤: ${newUrl || DEFAULT_FIREBASE_DB_URL}\n\n원래 주소에 있던 데이터는 지워지지 않고 그대로 남아요. 주소를 되돌리면 다시 보입니다. 바꾸기 전에 '백업 · 복원'에서 백업 파일을 한 번 받아두시는 걸 권해요.`,
                    apply
                );
                return;
            }
            await apply();
        }

        function hasServerStorage() {
            return typeof window !== 'undefined' && window.storage && typeof window.storage.get === 'function';
        }

        // 저장·백업이 담는 필드 목록은 여기 한 곳에서만 정의한다.
        //   예전엔 백업(openBackupModal)이 따로 4개 필드만 담고 있어서, 문법 점수·알 상태 같은 게
        //   비상용 백업에 조용히 빠져 있었다. 이제 저장과 백업이 같은 payload 를 쓴다.
        function buildDataPayload() {
            return {
                vocabulary: vocabulary,
                nyanyaDiary: nyanyaDiary,
                learnerProfile: learnerProfile,
                customQuestions: customQuestions,
                selectedQuestionTopics: selectedQuestionTopics,
                customGrammarTables: customGrammarTables,
                pinnedGrammar: pinnedGrammar,
                hiddenDefaultGrammar: hiddenDefaultGrammar,
                masteredGrammar: masteredGrammar,
                grammarScores: grammarScores,             // [냐냐 요청] 문법표 점수
                grammarTransUsed: grammarTransUsed,       // [냐냐 요청] 번역에서 써본 문법 (마스터 자격)
                hiddenQuestionTopics: hiddenQuestionTopics,
                grammarCellHighlights: grammarCellHighlights,
                grammarCellWords: grammarCellWords,       // [냐냐 요청] 표 칸 ↔ 단어장 연결
                grammarTopics: GRAMMAR_ICONS,
                eggState: eggState,
                gameHighScores: (typeof collectGameHighScores === 'function') ? collectGameHighScores() : {}
            };
        }

        async function saveToStorage() {
            const payload = buildDataPayload();
            const json = JSON.stringify(payload);

            // 항상 이 기기에도 백업 저장 (모든 동기화 방법이 실패해도 최소한 이 기기에서는 안전)
            try { localStorage.setItem('demo_data_v2', json); } catch (e) {}

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
                    updateSyncBadge('sync-error');
                }
            } else {
                // 비밀번호는 있는데 서버에 못 닿은 경우 — 주소 오타일 수 있으니 눈에 띄게 알린다.
                updateSyncBadge(firebasePath ? 'sync-error' : false);
            }

            if (!payload) {
                // 3순위: 이 기기 로컬 백업 (통합 키)
                try {
                    const localV2 = localStorage.getItem('demo_data_v2');
                    if (localV2) payload = JSON.parse(localV2);
                } catch (e) {}
            }

            if (!payload) {
                // 4순위: 예전 버전(분리된 키)에 저장된 데이터가 있으면 마이그레이션
                const oldVocab = localStorage.getItem('demo_vocabulary');
                if (oldVocab) {
                    try {
                        payload = {
                            vocabulary: JSON.parse(oldVocab),
                            nyanyaDiary: JSON.parse(localStorage.getItem('demo_diary') || '{}')
                        };
                    } catch (e) {}
                }
            }

            applyDataPayload(payload);

            // 동기화를 켜뒀는데 서버에 못 닿았다면 저장하지 않는다.
            //   여기서 저장하면, 주소나 비밀번호를 잘못 입력했을 때 (그리고 그 기기에 로컬 백업이
            //   없으면) 기본 단어장이 엉뚱한 경로에 써진다. 원래 경로는 그대로 남지만 놀라게 된다.
            //   지금 상태는 어차피 로컬 백업에서 온 것이라 건너뛰어도 잃는 게 없다.
            if (firebasePath && !firebaseReachable) {
                console.warn('[동기화] 서버에 못 닿아 자동 저장을 건너뜁니다. 주소·비밀번호를 확인해 주세요.');
                return;
            }

            // 첫 실행(Firebase가 비어있던 경우)이거나 로컬/예전 데이터로 복구한 경우,
            // 지금 상태를 다시 저장해서 다음부터는 모든 기기가 동기화되도록 함
            saveToStorage();
        }

        // payload 를 현재 상태로 펼친다. payload 가 없으면 초기 상태로 되돌린다.
        //   불러오기(loadFromStorage)와 백업 가져오기(importBackupData)가 같은 경로를 쓰게 해서,
        //   필드가 하나 늘었을 때 한쪽만 빠지는 일이 없게 한다.
        function applyDataPayload(payload) {
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
                grammarScores = payload.grammarScores || {};             // [냐냐 요청] 문법표 점수
                grammarTransUsed = payload.grammarTransUsed || {};       // [냐냐 요청] 번역에서 써본 문법
                hiddenQuestionTopics = payload.hiddenQuestionTopics || [];
                grammarCellHighlights = payload.grammarCellHighlights || {};
                grammarCellWords = payload.grammarCellWords || {};       // [냐냐 요청] 표 칸 ↔ 단어장 연결
                // [냐냐 PATCH] 저장된 주제(아이콘) 목록 복원 — 없으면 기본값 유지
                if (Array.isArray(payload.grammarTopics) && payload.grammarTopics.length) {
                    GRAMMAR_ICONS = payload.grammarTopics
                        .filter(t => t && (t.icon || '').trim())
                        .map(t => ({ icon: String(t.icon).trim(), label: (t.label ? String(t.label).trim() : String(t.icon).trim()) }));
                    if (GRAMMAR_ICONS.length === 0) GRAMMAR_ICONS = DEFAULT_GRAMMAR_ICONS.map(x => ({ ...x }));
                }
                eggState = Object.assign(defaultEggState(), payload.eggState || {});
                if (!Array.isArray(eggState.collection)) eggState.collection = [];
                // [냐냐 요청] 미니게임 역대기록 — 예전엔 이 기기 localStorage 에만 있어서
                //   폰과 PC 기록이 서로 안 보이고 '없어졌다 생겼다' 했다. 이제 같이 동기화한다.
                if (typeof mergeGameHighScores === 'function') mergeGameHighScores(payload.gameHighScores);
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
                grammarScores = {};
                grammarTransUsed = {};
                hiddenQuestionTopics = [];
                grammarCellHighlights = {};
                grammarCellWords = {};
                eggState = defaultEggState();
            }

            // [냐냐 PATCH-0배치] 통합 점수(score)로 1회 마이그레이션 (기존 약점/마스터 점수 합산)
            //   백업 가져오기로 예전 형식이 들어와도 여기서 같이 걸리게 안쪽에 둔다.
            if (typeof migrateWordScores === 'function') migrateWordScores();
        }

        // [냐냐 요청] 설정 드롭다운 안의 '동기화' 행을 갱신.
        //   ⚠️ 예전엔 className을 통째로 덮어써서 메뉴에 넣으면 레이아웃이 깨졌음.
        //   이제 내용(innerHTML)만 바꾸고 스타일은 HTML에 맡긴다.
        function updateSyncBadge(state) {
            const badge = document.getElementById('sync-status-badge');
            if (!badge) return;
            let dot = 'bg-slate-400', text = '이 기기에만 저장됨';
            if (state === true) { dot = 'bg-emerald-500'; text = isCustomFirebaseDbUrl() ? '내 저장소로 동기화 중' : '모든 기기 동기화 중'; }
            else if (state === 'claude-only') { dot = 'bg-amber-500'; text = 'Claude 안에서만 동기화'; }
            else if (state === 'no-password') { dot = 'bg-violet-500'; text = '동기화 비밀번호 설정하기'; }
            else if (state === 'sync-error') { dot = 'bg-rose-500'; text = '동기화 실패 — 주소·비밀번호 확인'; }
            badge.innerHTML = `<span class="w-2 h-2 rounded-full ${dot} shrink-0"></span>`
                + `<span class="text-xs font-bold text-slate-700 flex-1">${text}</span>`
                + `<i class="fa-solid fa-chevron-right text-[10px] text-slate-300"></i>`;
            if (typeof updateSettingsAlertDot === 'function') updateSettingsAlertDot();
        }

        // 설정 버튼의 작은 점: 뭔가 설정이 필요하면 눈에 띄게
        function updateSettingsAlertDot() {
            const dot = document.getElementById('settings-alert-dot');
            if (!dot) return;
            const apiOk = (typeof hasGeminiApiKey === 'function') ? hasGeminiApiKey() : false;
            dot.className = 'w-1.5 h-1.5 rounded-full ' + (apiOk ? 'bg-emerald-500' : 'bg-amber-500');
        }

        // 설정 드롭다운 열기/닫기
        function toggleSettingsMenu(e) {
            if (e) e.stopPropagation();
            const menu = document.getElementById('settings-menu');
            if (!menu) return;
            menu.classList.toggle('hidden');
        }
        function closeSettingsMenu() {
            const menu = document.getElementById('settings-menu');
            if (menu) menu.classList.add('hidden');
        }
        // 바깥 아무 데나 누르면 닫힘
        document.addEventListener('click', (e) => {
            const menu = document.getElementById('settings-menu');
            const btn = document.getElementById('settings-menu-btn');
            if (!menu || menu.classList.contains('hidden')) return;
            if (menu.contains(e.target) || (btn && btn.contains(e.target))) return;
            menu.classList.add('hidden');
        });

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

        // ============================================================
        // [냐냐 요청] AI에게 바로 물어보기 — 왼쪽 아래에 붙는 대화 패널.
        //   · 배경을 가리지 않아서 퀴즈·복습을 하면서 그때그때 물어볼 수 있음
        //   · 대화가 이어짐(앞 내용을 기억) · 새로고침 버튼으로 비우기
        //   · 탭을 옮겨도 대화는 그대로. 페이지를 새로고침하면 사라짐
        // ============================================================
        let askAiBusy = false;
        let askAiMessages = []; // { role: 'user' | 'ai', text }

        function toggleAskAi() {
            const panel = document.getElementById('ask-ai-panel');
            if (!panel) return;
            if (panel.classList.contains('hidden')) openAskAi(); else closeAskAi();
        }

        // ============================================================
        // [냐냐 요청] AI 패널 — 투명도 슬라이더 + 우상단 드래그 리사이즈
        //   · 그림자는 제거됨 (뒤 화면이 잘 보이도록)
        //   · 크기·투명도는 localStorage에 저장돼서 다음에 열 때 그대로 유지
        //   · pointer 이벤트라 마우스·터치 둘 다 동작
        // ============================================================
        const ASK_AI_MIN_W = 280, ASK_AI_MAX_W = 720;
        const ASK_AI_MIN_H = 260, ASK_AI_MAX_H = 900;

        function setAskAiOpacity(val) {
            const panel = document.getElementById('ask-ai-panel');
            const label = document.getElementById('ask-ai-opacity-label');
            const v = Math.max(30, Math.min(100, parseInt(val, 10) || 100));
            if (panel) panel.style.opacity = (v / 100).toString();
            if (label) label.innerText = v + '%';
            try { localStorage.setItem('demo_askai_opacity', String(v)); } catch (e) {}
        }

        function restoreAskAiPrefs() {
            const panel = document.getElementById('ask-ai-panel');
            if (!panel) return;
            try {
                const w = parseInt(localStorage.getItem('demo_askai_w') || '', 10);
                const h = parseInt(localStorage.getItem('demo_askai_h') || '', 10);
                if (w) panel.style.width = Math.max(ASK_AI_MIN_W, Math.min(ASK_AI_MAX_W, w)) + 'px';
                if (h) panel.style.height = Math.max(ASK_AI_MIN_H, Math.min(ASK_AI_MAX_H, h)) + 'px';
                const op = parseInt(localStorage.getItem('demo_askai_opacity') || '100', 10) || 100;
                const slider = document.getElementById('ask-ai-opacity');
                if (slider) slider.value = op;
                setAskAiOpacity(op);
            } catch (e) {}
        }

        function initAskAiResize() {
            const handle = document.getElementById('ask-ai-resize-handle');
            const panel = document.getElementById('ask-ai-panel');
            if (!handle || !panel || handle.dataset.bound === '1') return;
            handle.dataset.bound = '1';

            let startX = 0, startY = 0, startW = 0, startH = 0;

            const onMove = (e) => {
                // 패널이 좌하단 고정이므로 → 오른쪽으로 끌면 넓어지고, 위로 끌면 높아짐
                const dw = e.clientX - startX;
                const dh = startY - e.clientY;
                const w = Math.max(ASK_AI_MIN_W, Math.min(ASK_AI_MAX_W, startW + dw));
                const h = Math.max(ASK_AI_MIN_H, Math.min(ASK_AI_MAX_H, startH + dh));
                panel.style.width = w + 'px';
                panel.style.height = h + 'px';
                e.preventDefault();
            };

            const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                window.removeEventListener('pointercancel', onUp);
                document.body.style.userSelect = '';
                try {
                    localStorage.setItem('demo_askai_w', String(Math.round(panel.offsetWidth)));
                    localStorage.setItem('demo_askai_h', String(Math.round(panel.offsetHeight)));
                } catch (e) {}
            };

            handle.addEventListener('pointerdown', (e) => {
                startX = e.clientX;
                startY = e.clientY;
                startW = panel.offsetWidth;
                startH = panel.offsetHeight;
                document.body.style.userSelect = 'none';
                window.addEventListener('pointermove', onMove);
                window.addEventListener('pointerup', onUp);
                window.addEventListener('pointercancel', onUp);
                e.preventDefault();
            });
        }

        function openAskAi(preset) {
            const panel = document.getElementById('ask-ai-panel');
            if (!panel) return;
            closeQuickWord();   // 같은 자리에 뜨는 단어 찾기 패널은 닫는다
            panel.classList.remove('hidden');
            initAskAiResize();
            restoreAskAiPrefs();
            const icon = document.getElementById('ask-ai-fab-icon');
            if (icon) icon.className = 'fa-solid fa-xmark';
            renderAskAiThread();
            const input = document.getElementById('ask-ai-input');
            if (input && preset) input.value = preset;
            setTimeout(() => { if (input) input.focus(); }, 60);
        }

        function closeAskAi() {
            const panel = document.getElementById('ask-ai-panel');
            if (panel) panel.classList.add('hidden');
            const icon = document.getElementById('ask-ai-fab-icon');
            if (icon) icon.className = 'fa-solid fa-comment-dots';
        }

        function clearAskAi() {
            askAiMessages = [];
            renderAskAiThread();
            const input = document.getElementById('ask-ai-input');
            if (input) { input.value = ''; input.focus(); }
        }

        // ============================================================
        // [냐냐 요청] 어디서든 단어 찾기·등록 (왼쪽 아래 초록 돋보기)
        //   · 결과는 '단어 + 뜻' 만 작게. 자세히 보려면 눌러서 단어창으로
        //   · 등록된 단어 → 단어창 / 사전에만 있는 단어 → 등록창에 채워서 열기
        //   · AI 패널과 같은 자리에 뜨므로 둘 중 하나만 열린다
        // ============================================================
        let _quickWordResults = [];   // 화면에 그린 결과 (클릭 시 인덱스로 찾음 — 따옴표 escape 걱정 없음)

        function toggleQuickWord() {
            const panel = document.getElementById('quick-word-panel');
            if (!panel) return;
            if (panel.classList.contains('hidden')) openQuickWord(); else closeQuickWord();
        }

        function openQuickWord(preset) {
            const panel = document.getElementById('quick-word-panel');
            if (!panel) return;
            closeAskAi();
            panel.classList.remove('hidden');
            const icon = document.getElementById('quick-word-fab-icon');
            if (icon) icon.className = 'fa-solid fa-xmark';
            const input = document.getElementById('quick-word-input');
            if (input && preset !== undefined && preset !== null) input.value = String(preset);
            renderQuickWordResults();
            setTimeout(() => { if (input) { input.focus(); input.select(); } }, 60);
        }

        function closeQuickWord() {
            document.getElementById('quick-word-panel')?.classList.add('hidden');
            const icon = document.getElementById('quick-word-fab-icon');
            if (icon) icon.className = 'fa-solid fa-magnifying-glass';
        }

        function clearQuickWord() {
            const input = document.getElementById('quick-word-input');
            if (input) { input.value = ''; input.focus(); }
            renderQuickWordResults();
        }

        function quickWordKeydown(e) {
            if (e.key === 'Escape') { closeQuickWord(); return; }
            if (e.key !== 'Enter') return;
            e.preventDefault();
            // 결과가 있으면 맨 위 것을 열고, 없으면 등록창으로
            if (_quickWordResults.length > 0) pickQuickWord(0);
            else openQuickWordRegister();
        }

        // 내 단어장에서 찾는다. 스페인어·한글 뜻 둘 다 검색된다
        //   [냐냐 요청] 예전엔 하드코딩 사전 18개를 뒤에 붙였는데, 대부분 이미 등록한
        //   단어라 결과만 어지럽혀서 뺐다.
        function quickWordMatches(query) {
            const norm = (s) => (typeof stripAccents === 'function')
                ? stripAccents(String(s || '').toLowerCase())
                : String(s || '').toLowerCase();
            const q = norm(query);
            if (!q) return [];

            const out = [];
            (typeof vocabulary !== 'undefined' ? vocabulary : []).forEach(w => {
                if (norm(w.word).includes(q) || norm(w.meaning).includes(q)) {
                    out.push({ word: w.word, meaning: w.meaning, pos: w.pos, id: w.id });
                }
            });

            // 정확히 일치 → 입력으로 시작 → 그냥 포함
            const rank = (r) => { const s = norm(r.word); return s === q ? 0 : (s.startsWith(q) ? 1 : 2); };
            out.sort((a, b) => {
                const ra = rank(a), rb = rank(b);
                if (ra !== rb) return ra - rb;
                return norm(a.word).localeCompare(norm(b.word), 'es');
            });
            return out;
        }

        function renderQuickWordResults() {
            const box = document.getElementById('quick-word-results');
            if (!box) return;
            const raw = (document.getElementById('quick-word-input')?.value || '').trim();
            document.getElementById('quick-word-clear')?.classList.toggle('hidden', !raw);

            if (!raw) {
                _quickWordResults = [];
                box.innerHTML = `
                    <div class="h-full flex flex-col items-center justify-center text-center gap-1.5 px-4">
                        <div class="text-2xl">🔎</div>
                        <p class="text-[11px] font-bold text-slate-500">찾을 단어를 적어주세요</p>
                        <p class="text-[10px] text-slate-400">스페인어 · 한글 뜻 둘 다 돼요</p>
                    </div>`;
                return;
            }

            _quickWordResults = quickWordMatches(raw).slice(0, 40);
            if (_quickWordResults.length === 0) {
                box.innerHTML = `
                    <div class="h-full flex flex-col items-center justify-center text-center gap-1.5 px-4">
                        <div class="text-2xl">🆕</div>
                        <p class="text-[11px] font-bold text-slate-500">"${escapeHtml(raw)}" 는 아직 없어요</p>
                        <p class="text-[10px] text-slate-400">아래 '등록창 열기' 를 누르면 채워서 열어드려요</p>
                    </div>`;
                return;
            }

            // 이제 결과는 전부 내 단어장에서 온다 (사전 항목이 없으므로 '사전' 배지도 없다)
            box.innerHTML = _quickWordResults.map((r, i) => {
                const posLabel = (typeof POS_LABELS !== 'undefined' && POS_LABELS[r.pos]) ? POS_LABELS[r.pos] : '';
                const badge = `<span class="text-[9px] font-bold text-emerald-600 bg-emerald-50 rounded-md px-1.5 py-0.5 shrink-0">등록됨</span>`;
                return `
                    <div onclick="pickQuickWord(${i})" title="단어창 열기"
                        class="px-2.5 py-2 rounded-xl hover:bg-slate-50 cursor-pointer flex items-center gap-2 transition-colors">
                        <div class="min-w-0 flex-1">
                            <p class="text-xs font-bold text-slate-800 truncate">${escapeHtml(r.word)}${posLabel ? `<span class="ml-1 text-[9px] font-medium text-slate-400">${escapeHtml(posLabel)}</span>` : ''}</p>
                            <p class="text-[11px] text-slate-500 truncate">${escapeHtml(r.meaning || '뜻 없음')}</p>
                        </div>
                        ${badge}
                    </div>`;
            }).join('');
        }

        function pickQuickWord(i) {
            const r = _quickWordResults[i];
            if (!r) return;
            if (r.id !== null && r.id !== undefined) {
                closeQuickWord();
                if (typeof openWordModal === 'function') openWordModal(r.id);
                return;
            }
            openQuickWordRegister(r.word);
        }

        // 등록창 열기. 한글이면 뜻 칸, 스페인어면 단어 칸에 넣는다 (단어장 검색의 '등록하기' 와 같은 규칙)
        function openQuickWordRegister(presetWord) {
            const raw = (presetWord !== undefined && presetWord !== null)
                ? String(presetWord).trim()
                : (document.getElementById('quick-word-input')?.value || '').trim();
            closeQuickWord();
            if (typeof openWordModal !== 'function') return;
            openWordModal();
            if (!raw) return;
            const isKorean = /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(raw);
            const target = document.getElementById(isKorean ? 'input-meaning' : 'input-word');
            if (!target) return;
            target.value = raw;
            if (!isKorean && typeof handleWordInput === 'function') handleWordInput(raw);
            target.focus();
        }

        function renderAskAiThread() {
            const thread = document.getElementById('ask-ai-thread');
            if (!thread) return;
            if (!askAiMessages.length) {
                thread.innerHTML = `
                    <div class="h-full flex flex-col items-center justify-center text-center px-4 gap-1.5">
                        <div class="text-3xl">💬</div>
                        <p class="text-xs font-bold text-slate-500">풀다가 막히면 물어보세요</p>
                        <p class="text-[11px] font-semibold text-slate-400 leading-relaxed">단어 차이, 문법, 어순 무엇이든<br>대화는 이어서 물어볼 수 있어요</p>
                    </div>`;
                return;
            }
            thread.innerHTML = askAiMessages.map(m => {
                if (m.role === 'user') {
                    return `<div class="flex justify-end"><div class="bg-violet-600 text-white rounded-2xl rounded-br-md px-3 py-2 max-w-[85%] text-xs font-semibold whitespace-pre-wrap break-words">${escapeHtml(m.text)}</div></div>`;
                }
                if (m.role === 'pending') {
                    return `<div class="flex justify-start"><div class="bg-slate-100 text-slate-400 rounded-2xl rounded-bl-md px-3 py-2 text-xs font-bold">생각하는 중...</div></div>`;
                }
                const cls = m.error ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-100 text-slate-800';
                return `<div class="flex justify-start"><div class="${cls} rounded-2xl rounded-bl-md px-3 py-2 max-w-[90%] text-xs font-semibold leading-relaxed whitespace-pre-wrap break-words">${escapeHtml(m.text)}</div></div>`;
            }).join('');
            thread.scrollTop = thread.scrollHeight;
        }

        function askAiKeydown(e) {
            // 엔터로 전송 (줄바꿈은 Shift+Enter)
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitAskAi();
            }
        }

        async function submitAskAi() {
            if (askAiBusy) return;
            const input = document.getElementById('ask-ai-input');
            if (!input) return;
            const q = input.value.trim();
            if (!q) { showToast("궁금한 걸 적어주세요!", "error"); return; }

            askAiBusy = true;
            input.value = '';
            askAiMessages.push({ role: 'user', text: q });
            askAiMessages.push({ role: 'pending' });
            renderAskAiThread();
            const btn = document.getElementById('ask-ai-send-btn');
            if (btn) btn.disabled = true;

            try {
                const sys = "너는 한국인 스페인어 학습자를 돕는 친절한 선생님이야. "
                    + "반드시 한국어로, 짧고 명확하게 답해. 예시가 필요하면 스페인어 문장 1~2개만 들어. "
                    + "군더더기 인사말 없이 바로 핵심부터. 마크다운 기호(**, ##)는 쓰지 마. "
                    + "앞선 대화가 있으면 그 맥락을 이어서 답해.";
                // 최근 대화 몇 개를 같이 보내서 맥락이 이어지게 함
                const history = askAiMessages
                    .filter(m => m.role === 'user' || (m.role === 'ai' && !m.error))
                    .slice(-9, -1)
                    .map(m => (m.role === 'user' ? '학생: ' : '선생님: ') + m.text)
                    .join('\n');
                const prompt = history ? `${history}\n학생: ${q}` : q;
                const answer = await callGemini(prompt, sys, null, 'low');
                askAiMessages = askAiMessages.filter(m => m.role !== 'pending');
                askAiMessages.push({ role: 'ai', text: (answer || '').toString().trim() || '답을 받지 못했어요.' });
            } catch (e) {
                console.error(e);
                askAiMessages = askAiMessages.filter(m => m.role !== 'pending');
                askAiMessages.push({
                    role: 'ai', error: true,
                    text: (typeof describeGeminiError === 'function' ? describeGeminiError(e) : 'AI 응답을 받지 못했어요. 설정에서 API 키를 확인해 주세요.')
                });
            } finally {
                askAiBusy = false;
                if (btn) btn.disabled = false;
                renderAskAiThread();
                const el = document.getElementById('ask-ai-input');
                if (el) el.focus();
            }
        }

        function getLocalDateString(date = new Date()) {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }

        // [냐냐 요청] 제대로 섞기 (Fisher-Yates).
        //   예전에 쓰던 sort(() => Math.random() - 0.5)는 고르게 안 섞여서
        //   앞쪽 항목이 계속 앞에 남는 편향이 있었음. 이 함수는 모든 순서가 같은 확률.
        //   배열을 직접 섞고 그대로 돌려주므로 기존 .sort(...) 자리에 그대로 대체 가능.
        function shuffleArray(arr) {
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
            }
            return arr;
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

            // [냐냐 요청] 문법표도 같은 방식으로 스냅샷 — 문법표 성장 그래프의 비율용
            if (typeof getAllGrammarTables === 'function' && typeof getGrammarGrade === 'function') {
                const gt = getAllGrammarTables();
                d.grammarTotal = gt.length;
                d.grammarMasteredTotal = gt.filter(t => ['mastered', 'perfect'].includes(getGrammarGrade(t.id))).length;
                d.grammarWeakTotal = gt.filter(t => ['weak', 'critical'].includes(getGrammarGrade(t.id))).length;
            }
        }

        // ============================================================
        // [냐냐 PATCH] 연속 학습일(streak) 계산 — nyanyaDiary(날짜별 기록) 기반
        // ============================================================
        function calcStreak() {
            // [냐냐 요청] 학습장에서 뭐든 하나만 해도 그날은 "학습한 날" (예전엔 5개 이상이어야 인정했다).
            //   달력의 ✗ 표시와 같은 기준(dayActivity)을 쓰므로 둘이 어긋나지 않는다.
            //   앱을 켜기만 한 날은 touchDiarySnapshot() 이 만든 빈 기록이라 0 → 자동으로 제외됨
            const dates = Object.keys(nyanyaDiary || {}).filter(d => dayActivity(d) >= 1).sort(); // 오름차순
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
            // [냐냐 요청] 부화했다고 탭을 옮기지 않는다. 하던 걸 계속하게 두고 팝업으로만 알린다.
            //   확인 버튼이 '도감 보기'(=탭 이동)였던 데다 엔터로 자동 실행돼서, 쓰기 복습 중에
            //   부화하면 제출용 엔터가 그대로 눌려 팝업을 못 보고 탭만 넘어가 있었다.
            //   그래서 기본 동작을 '닫기'로 바꾸고 noEnter 로 엔터도 막는다.
            showConfirm(
                `🎉 부화 성공!`,
                `${creature.emoji} ${creature.name} (${info.label} ${info.star})\n\n${creature.desc}${isNew ? '\n\n✨ 도감에 새로 추가됐어요!' : '\n\n(이미 도감에 있어요)'}`,
                () => { /* 닫기만 — 하던 화면 그대로 */ },
                {
                    icon: 'happy',
                    okLabel: '계속하기',
                    okStyle: 'primary',
                    cancelLabel: '도감 보기',
                    noEnter: true,
                    onCancel: () => { changeTab('records'); setTimeout(renderEgg, 100); }
                }
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

        // [냐냐 요청] 그날 학습장에서 한 일의 개수 — 달력 진하기·✗ 표시·연속 학습일이 전부 이 하나를 쓴다.
        //   '한 일'만 센다: 마스터/완벽 달성 수는 퀴즈·복습의 결과라 같이 세면 한 번 한 걸 두 번 세게 됨.
        function dayActivity(dateStr) {
            const d = nyanyaDiary[dateStr];
            if (!d) return 0;
            return (d.quizTotal || 0) + (d.aiSessions || 0) + (d.newWordsCount || 0)
                 + (d.reviewCount || 0) + (d.gameCount || 0) + (d.newGrammarCount || 0);
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
            // [냐냐 요청] 2열은 그대로 두고 글씨만 줄여서 두 줄로 접히던 걸 없앤다.
            //   데스크톱 사이드바(w-56)에서 칸 하나가 70px 인데, 12px 글씨로는
            //   '마스터 단어'(58px)+값(22px)=80px 라 넘쳤다.
            //   10px 로 줄이면 66px, 좌우 여백도 px-2→px-1.5 로 줄여 74px 를 확보한다.
            const grid = items.map(([label, val, unit, color]) =>
                `<div class="flex items-baseline justify-between gap-1 py-0.5" title="${label} ${val}${unit}">
                    <span class="text-[10px] text-slate-500 whitespace-nowrap truncate min-w-0">${label}</span>
                    <span class="text-[10px] font-bold whitespace-nowrap shrink-0 ${val > 0 ? color : 'text-slate-300'}">${val}${unit}</span>
                </div>`).join('');
            // [냐냐 요청] 오늘·앞날이면 그날 복습 예정 단어도 같이 보여준다.
            //   지난 날은 '한 일', 오늘·앞날은 '할 일' — 달력 한 곳에서 둘 다 본다.
            //   단어 목록은 여기 늘어놓지 않고 '단어 보기'로 팝업에서 단계별로 본다.
            const today = getLocalDateString();
            const due = (typeof getReviewScheduledOn === 'function') ? getReviewScheduledOn(ds) : null;
            let planHtml = '';
            if (due) {
                // 기준 설명('밀린 것 포함' / '오늘 걸 다 하면')은 여기 안 쓴다.
                //   좁은 사이드바에서 개수와 한 줄에 못 들어가고, 어차피 '단어 보기' 팝업 머리에 적혀 있다.
                planHtml = `
                    <div class="mt-2 pt-2 border-t border-violet-100">
                        <div class="flex items-center justify-between gap-2 mb-1.5">
                            <span class="font-black text-amber-700">📖 복습 예정</span>
                            <span class="font-black text-amber-600">${due.length}개</span>
                        </div>
                        ${due.length
                            ? `<button onclick="openReviewPlanModal('${ds}')" class="w-full bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-xl text-[11px] font-bold transition-all active:scale-95"><i class="fa-solid fa-list-ul"></i> 단어 보기 (${due.length}개)</button>`
                            : '<p class="text-slate-400 text-center py-1">이 날은 복습할 게 없어요 ✨</p>'}
                    </div>`;
            }

            box.classList.remove('hidden');
            box.innerHTML = `
                <div class="flex items-center justify-between mb-2">
                    <span class="font-black text-slate-700">${fmtDateSlash(ds)} ${total > 0 ? `<span class="text-violet-600">· 총 ${total}개 활동</span>` : (ds > today ? '' : '<span class="text-slate-400 font-bold">· 학습 기록 없음</span>')}</span>
                    <button onclick="document.getElementById('calendar-day-detail').classList.add('hidden')" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark"></i></button>
                </div>
                ${total > 0
                    ? `<div class="grid grid-cols-2 gap-1">${grid}</div>`
                    : (ds > today ? '' : '<p class="text-slate-400 text-center py-1">이 날은 쉬어갔네요 🌙</p>')}
                ${planHtml}
            `;
        }

        // [냐냐 요청] 달력에서 '단어 보기' → 그날 복습 예정 단어를 망각곡선 단계별로 묶어서 보여준다.
        //   단계를 보여주는 이유: 같은 '61개'라도 처음 틀린 40개인지 30일차 5개인지에 따라
        //   그날 복습의 성격이 완전히 다르다.
        //   단어를 누르면 팝업 위에 팝업을 또 띄우지 않고 그 자리에서 아래로 펼친다 (폰 배려).
        function openReviewPlanModal(ds) {
            const due = (typeof getReviewScheduledOn === 'function') ? getReviewScheduledOn(ds) : null;
            const modal = document.getElementById('review-plan-modal');
            if (!due || !modal) return;

            const titleEl = document.getElementById('review-plan-title');
            const subEl = document.getElementById('review-plan-sub');
            const bodyEl = document.getElementById('review-plan-body');
            const isToday = ds === getLocalDateString();

            if (titleEl) titleEl.innerText = `${fmtDateSlash(ds)} 복습 예정 ${due.length}개`;
            if (subEl) subEl.innerText = isToday
                ? '밀린 복습까지 포함한 숫자예요. 약한 단어부터 보여드려요.'
                : '오늘 걸 제때 다 했을 때 기준이에요. 밀리면 이 날로 더 넘어와요.';

            const groups = REVIEW_INTERVALS.map((days, stage) => ({
                days,
                stage,
                words: due.filter(w => (w.reviewStage || 0) === stage)
            })).filter(g => g.words.length);

            // [냐냐 요청] 단계 묶음도 접었다 폈다. 처음엔 다 접어두면 '어느 단계가 몇 개'가
            //   한눈에 들어오고, 보고 싶은 단계만 펼치면 된다.
            bodyEl.innerHTML = groups.map(g => `
                <div class="space-y-1.5">
                    <button onclick="toggleReviewPlanGroup(${g.stage})" class="w-full flex items-center gap-2 sticky top-0 bg-white py-1.5 hover:bg-slate-50 rounded-lg transition-colors">
                        <i id="rpg-icon-${g.stage}" class="fa-solid fa-chevron-right text-[10px] text-slate-300 w-2.5"></i>
                        <span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black">${g.days}일차</span>
                        <span class="text-[10px] font-bold text-slate-400">${g.stage === 0 ? '처음 틀린 뒤 첫 복습' : `${g.stage}번 복습한 단어`}</span>
                        <span class="ml-auto text-[10px] font-black text-slate-500">${g.words.length}개</span>
                    </button>
                    <div id="rpg-${g.stage}" class="hidden space-y-1.5">
                    ${g.words.map(w => `
                        <div class="border border-slate-200 rounded-xl overflow-hidden">
                            <button onclick="toggleReviewPlanWord('${w.id}')" class="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-left transition-colors">
                                <span class="font-bold text-slate-800 text-sm">${escapeHtml(w.word)}</span>
                                <span class="text-[11px] text-slate-400 truncate flex-1">${escapeHtml(w.meaning || '')}</span>
                                <i id="rpw-icon-${w.id}" class="fa-solid fa-chevron-down text-[10px] text-slate-300"></i>
                            </button>
                            <div id="rpw-${w.id}" class="hidden px-3 pb-3"></div>
                        </div>`).join('')}
                    </div>
                </div>`).join('');

            modal.classList.remove('hidden');
        }

        function toggleReviewPlanGroup(stage) {
            const box = document.getElementById('rpg-' + stage);
            const icon = document.getElementById('rpg-icon-' + stage);
            if (!box) return;
            const opening = box.classList.contains('hidden');
            box.classList.toggle('hidden');
            if (icon) icon.className = `fa-solid fa-chevron-${opening ? 'down' : 'right'} text-[10px] text-slate-300 w-2.5`;
        }

        function closeReviewPlanModal() {
            const m = document.getElementById('review-plan-modal');
            if (m) m.classList.add('hidden');
        }

        function toggleReviewPlanWord(id) {
            const box = document.getElementById('rpw-' + id);
            const icon = document.getElementById('rpw-icon-' + id);
            if (!box) return;
            const opening = box.classList.contains('hidden');
            box.classList.toggle('hidden');
            if (icon) icon.className = `fa-solid fa-chevron-${opening ? 'up' : 'down'} text-[10px] text-slate-300`;
            // 처음 펼칠 때만 내용을 만든다 (61개를 미리 다 그리면 무겁다)
            if (opening && !box.dataset.filled) {
                const w = vocabulary.find(v => v.id === id);
                if (w) {
                    const badges = (typeof buildWordBadgesHtml === 'function') ? buildWordBadgesHtml(w, { align: 'left' }) : '';
                    const notes = (typeof buildNotesHtml === 'function') ? buildNotesHtml(w, {}) : '';
                    const parts = [badges, notes].filter(x => x && x.trim());
                    box.innerHTML = parts.length
                        ? `<div class="space-y-2 pt-1">${parts.join('')}</div>`
                        : '<p class="text-[11px] text-slate-400 pt-1">적어둔 정보가 없어요.</p>';
                }
                box.dataset.filled = '1';
            }
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
                    // [냐냐 요청] 앞으로 복습이 잡힌 날은 점을 찍어둔다 — 눌러보지 않아도 몰리는 날이 보이게.
                    const plan = (!isPast && typeof getReviewScheduledOn === 'function') ? (getReviewScheduledOn(ds) || []).length : 0;
                    const dot = plan > 0 ? `<span class="absolute bottom-0.5 w-1 h-1 rounded-full bg-amber-500"></span>` : '';
                    const inner = showX
                        ? `<span class="relative flex items-center justify-center w-full h-full"><span class="text-slate-300">${d}</span><i class="fa-solid fa-xmark absolute text-slate-300/60 text-[13px]"></i></span>`
                        : `<span class="relative flex items-center justify-center w-full h-full">${d}${dot}</span>`;
                    const planTitle = plan > 0 ? ` · 복습 예정 ${plan}개` : '';
                    cells += `<div onclick="showCalendarDayDetail('${ds}')" class="aspect-square rounded-md flex items-center justify-center text-[10px] font-bold cursor-pointer hover:ring-2 hover:ring-violet-300 transition-all ${calColor(n, maxVal)} ${isToday ? 'ring-2 ring-violet-400' : ''}" title="${fmtDateSlash(ds)} · ${showX ? '학습 없음' : n + '개 학습'}${planTitle} (클릭하면 상세)">${inner}</div>`;
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
            const saved = localStorage.getItem('demo_stats_period');
            const now = currentStatsPeriod();
            if (saved && saved !== now) {
                // 기간이 바뀌었으면 모든 단어의 정답/오답 카운터 초기화
                vocabulary.forEach(w => { w.correctTotal = 0; w.wrongTotal = 0; });
                try { saveToStorage(); } catch (e) {}
            }
            try { localStorage.setItem('demo_stats_period', now); } catch (e) {}
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

        // [냐냐 요청] 틀렸을 때 곡선을 처음(0)으로 되돌리지 않고 '한 단계만' 뒤로 물린다.
        //   14일을 버틴 단어가 실수 한 번에 1일차로 떨어지는 게 과했다.
        //   퀴즈·게임·복습·첨삭 어디서 틀리든 이 규칙 하나로 간다.
        //     stage 4(30일) → 3(14일) → 2(7일) → 1(3일) → 0(1일) → 0
        //   ⚠️ 하루에 한 번만 물린다. 같은 오답 한 건에 addWordScore 와
        //      markWordReviewedToday 가 잇따라 불려서 두 단계씩 떨어지면 안 된다.
        //      (예전엔 둘 다 0으로 만들어서 몇 번을 불러도 결과가 같았다)
        function demoteReviewStage(w) {
            if (!w) return;
            const today = getLocalDateString();
            if (w.lastDemoteDate === today) return;
            w.lastDemoteDate = today;
            // 졸업한 단어(마지막 칸 밖)는 마지막 칸으로 당겨놓고 뺀다 — 안 그러면
            // 방금 잊어버린 단어를 30일 뒤에나 다시 묻게 된다
            const cur = Math.min(w.reviewStage || 0, REVIEW_INTERVALS.length - 1);
            w.reviewStage = Math.max(0, cur - 1);
        }

        // 오늘 복습해야 할 단어
        // [냐냐 요청] B방식 — 놓친 복습도 사라지지 않고 할 때까지 계속 뜬다.
        //   w.reviewStage = 지금까지 끝낸 복습 단계 수 (0이면 아직 1일차도 안 함)
        //   기준일 = 마지막으로 복습한 날(lastReviewDate). 아직 복습 전이면 틀린 날.
        //   다음 복습일 = 기준일 + REVIEW_INTERVALS[reviewStage] 일
        //   '정확히 그날'이 아니라 '그날이 지났으면' 계속 대상 → 밀린 복습 유지
        function getReviewDueWords() {
            const today = getLocalDateString();
            return vocabulary.filter(w => {
                if (w.mastered || !w.lastWrongDate) return false;
                if (w.lastReviewDate === today) return false; // 오늘 이미 복습함
                const stage = w.reviewStage || 0;
                if (stage >= REVIEW_INTERVALS.length) return false; // 복습 주기 다 마침
                const base = w.lastReviewDate || w.lastWrongDate; // 복습했으면 그날부터 다시 셈
                return daysSince(base) >= REVIEW_INTERVALS[stage]; // 지났으면 계속 대상(밀린 복습)
            }).sort((a, b) => getScore(a) - getScore(b)); // [냐냐 PATCH-0배치] 점수 낮은(=약한) 순
        }

        // [냐냐 요청] 달력에서 어떤 날을 누르면 그날 복습 예정 단어를 보여주기 위한 계산.
        //   오늘 칸은 getReviewDueWords() 를 그대로 쓴다 — 헤더 배너와 숫자가 어긋나면 안 되니까
        //   (오늘은 '밀린 것'까지 전부 포함된다).
        //   앞날은 '오늘 걸 제때 다 한다면' 기준의 예정이다. 밀리면 그만큼 다음 날로 넘어가 쌓인다.
        //   지난 날은 예정이라는 개념이 없으므로 null.
        function addDaysToDateString(ds, n) {
            const p = String(ds).split('-').map(Number);
            const d = new Date(p[0], p[1] - 1, p[2]);
            d.setDate(d.getDate() + n);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
        function getReviewScheduledOn(ds) {
            const today = getLocalDateString();
            if (!ds || ds < today) return null;
            if (ds === today) return getReviewDueWords();
            return vocabulary.filter(w => {
                if (w.mastered || !w.lastWrongDate) return false;
                const stage = w.reviewStage || 0;
                if (stage >= REVIEW_INTERVALS.length) return false;
                const base = w.lastReviewDate || w.lastWrongDate;
                return addDaysToDateString(base, REVIEW_INTERVALS[stage]) === ds;
            }).sort((a, b) => getScore(a) - getScore(b));
        }

        // [냐냐 요청] 오늘의 복습(배너)에서 한 단어를 끝냈을 때 호출.
        //   맞았으면 다음 단계로, 핵심을 틀렸으면 한 단계 뒤로.
        function markWordReviewedToday(wordOrId, wasCorrect) {
            const w = (typeof wordOrId === 'string') ? vocabulary.find(v => v.id === wordOrId) : wordOrId;
            if (!w) return;
            w.lastReviewDate = getLocalDateString();
            if (wasCorrect) {
                const before = w.reviewStage || 0;
                w.reviewStage = before + 1;
                // [냐냐 요청] 마지막 칸을 넘어서는 순간을 알려준다. 예전엔 복습 목록에서
                //   그냥 사라지기만 해서 졸업한 줄도 몰랐다. 넘는 그 한 번만 뜬다.
                if (before < REVIEW_INTERVALS.length && w.reviewStage >= REVIEW_INTERVALS.length
                    && typeof showToast === 'function') {
                    const lastGap = REVIEW_INTERVALS[REVIEW_INTERVALS.length - 1];
                    showToast(`"${w.word}" 망각곡선 졸업! 🎓 ${lastGap}일을 버텼어요`, "success");
                }
            }
            else demoteReviewStage(w); // [냐냐 요청] 처음으로 되돌리지 않고 한 단계만 뒤로
        }

        // [냐냐 PATCH] 오늘 틀린 단어만 단어장에 필터링해서 보여주기
        let todayWrongFilterActive = false;
        function showTodayWrongInList() {
            todayWrongFilterActive = true;
            currentPage = 1; // [냐냐 PATCH-페이지네이션] 오늘 틀린 단어 필터도 1페이지부터
            // 다른 필터는 초기화
            const filter = document.getElementById('mastery-filter-select');
            if (filter) filter.value = 'all';
            const sortSel = document.getElementById('sort-select');
            if (sortSel) sortSel.value = 'weak-score';
            // [냐냐 요청] 헤더에서 눌러도 동작하도록 단어장 탭으로 이동 (기존엔 빠져 있었음)
            if (typeof changeTab === 'function') changeTab('list');
            renderWordList();
            const grid = document.getElementById('vocabulary-grid');
            if (grid) setTimeout(() => grid.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
            showToast("오늘 틀린 단어를 모아서 보여드려요! ✏️", "info");
        }

        // [냐냐 요청] 헤더 '오늘 틀린 단어' 버튼 갱신.
        //   퀴즈·게임·복습 어디서 틀렸든 오늘 날짜로 기록된 단어를 센다.
        //   ※ 현재 헤더 버튼은 내려간 상태 — 버튼이 없으면 아무것도 안 하므로 두면 됨.
        //     나중에 버튼(id: today-wrong-btn)을 다시 달면 바로 살아남.
        function renderTodayWrongBtn() {
            const btn = document.getElementById('today-wrong-btn');
            const badge = document.getElementById('today-wrong-count-badge');
            if (!btn || !badge) return;
            const n = (typeof getTodayReviewWords === 'function') ? getTodayReviewWords().length : 0;
            badge.innerText = n + '개';
            if (n === 0) {
                btn.disabled = true;
                btn.classList.remove('bg-rose-50', 'hover:bg-rose-100', 'border-rose-200', 'cursor-pointer', 'active:scale-95');
                btn.classList.add('bg-slate-50', 'border-slate-200', 'cursor-not-allowed', 'opacity-70');
                badge.classList.remove('text-rose-700'); badge.classList.add('text-slate-400');
                btn.querySelector('.tracking-widest')?.classList.remove('text-rose-500');
                btn.querySelector('.tracking-widest')?.classList.add('text-slate-400');
            } else {
                btn.disabled = false;
                btn.classList.add('bg-rose-50', 'hover:bg-rose-100', 'border-rose-200', 'cursor-pointer', 'active:scale-95');
                btn.classList.remove('bg-slate-50', 'border-slate-200', 'cursor-not-allowed', 'opacity-70');
                badge.classList.add('text-rose-700'); badge.classList.remove('text-slate-400');
                btn.querySelector('.tracking-widest')?.classList.add('text-rose-500');
                btn.querySelector('.tracking-widest')?.classList.remove('text-slate-400');
            }
        }

        function renderTodayReview() {
            renderTodayWrongBtn(); // 버튼이 헤더에 있을 때만 동작 (지금은 내려가 있어 그냥 통과)
            // [냐냐 요청] 헤더 '오늘의 복습' 배너 갱신: 복습할 단어 개수 표시.
            //   0개면 회색 비활성 + '복습 완료 ✓', 있으면 활성 + 'N개'
            const words = (typeof getReviewDueWords === 'function') ? getReviewDueWords() : [];
            const btn = document.getElementById('today-review-btn');
            const badge = document.getElementById('today-review-count-badge');
            if (!btn || !badge) return;

            if (words.length === 0) {
                // 완료 상태 (회색 비활성)
                badge.innerText = '완료 ✓';
                btn.disabled = true;
                btn.classList.remove('bg-amber-50', 'hover:bg-amber-100', 'border-amber-200', 'cursor-pointer', 'active:scale-95');
                btn.classList.add('bg-slate-50', 'border-slate-200', 'cursor-not-allowed', 'opacity-70');
                badge.classList.remove('text-amber-700'); badge.classList.add('text-slate-400');
                btn.querySelector('.tracking-widest')?.classList.remove('text-amber-600');
                btn.querySelector('.tracking-widest')?.classList.add('text-slate-400');
            } else {
                // 활성 상태 (호박색)
                badge.innerText = words.length + '개';
                btn.disabled = false;
                btn.classList.add('bg-amber-50', 'hover:bg-amber-100', 'border-amber-200', 'cursor-pointer', 'active:scale-95');
                btn.classList.remove('bg-slate-50', 'border-slate-200', 'cursor-not-allowed', 'opacity-70');
                badge.classList.add('text-amber-700'); badge.classList.remove('text-slate-400');
                btn.querySelector('.tracking-widest')?.classList.add('text-amber-600');
                btn.querySelector('.tracking-widest')?.classList.remove('text-slate-400');
            }
        }

        // ============================================================
        // [냐냐 PATCH-0배치] 점수 통합 — 약점점수/마스터점수 두 축을 하나(score)로
        //   score: -10 ~ +10 (0.1 단위)
        //     +8 이상    = 완벽 (찐초록)
        //     +4.5 ~ +7.9 = 마스터 (연초록)  ※ 주관식 정답 경험(subjectivePassed) 필요
        //     -4.4 ~ +4.4 = 일반 (회색)
        //     -4.5 ~ -7.9 = 약점 (노랑)
        //     -8 이하  = 치명적 약점 (빨강)
        // ============================================================
        const SCORE_MIN = -10;
        const SCORE_MAX = 10;
        const SCORE_MASTER = 4.5;  // [냐냐 요청] 마스터 기준선 (5 → 4.5)
        const SCORE_PERFECT = 8;   // 완벽 기준선
        const SCORE_WEAK = -4.5;   // [냐냐 요청] 약점 기준선 (-3 → -4.5)
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
            // [냐냐 요청] 한 번에 여러 칸을 채점한 경우엔 칸 하나당 하나씩 센다.
            //   correctCount/wrongCount 를 안 주면 지금까지처럼 correct 에 따라 1회만 센다.
            const cCount = (typeof opts.correctCount === 'number') ? opts.correctCount : (opts.correct === true ? 1 : 0);
            const wCount = (typeof opts.wrongCount === 'number') ? opts.wrongCount : (opts.correct === false ? 1 : 0);
            if (cCount) w.correctTotal = (w.correctTotal || 0) + cCount;
            if (wCount) w.wrongTotal = (w.wrongTotal || 0) + wCount;

            if (opts.correct === true) {
                if (opts.subjective) w.subjectivePassed = true; // 마스터 필수 조건
            } else if (opts.correct === false) {
                // [냐냐 요청] skipReviewDate가 true면 망각곡선 복습 대상에서 제외
                //   (단어빈칸에서 관용구/예문 칸만 틀린 경우 등)
                if (!opts.skipReviewDate) {
                    w.lastWrongDate = getLocalDateString(); // '오늘 복습' 목록에 자동 등장
                    // [냐냐 요청] 퀴즈·게임·복습 어디서 틀리든 곡선을 한 단계 뒤로 (처음으로 되돌리지 않음)
                    demoteReviewStage(w);
                    w.lastReviewDate = null;
                }
            }

            w.score = clampScore(w.score + (delta || 0));
            syncWordFlags(w);
            return w.score;
        }

        // ============================================================
        // [냐냐 요청] 문법표 점수 — 단어와 같은 척도(-10~+10)·같은 등급을 그대로 쓴다
        //   빈칸 복습:  delta = 1.5 × clamp((정답률 − 0.7) / 0.3, −1, +1)   ← 표 하나당 한 번
        //   번역 미션:  제대로 씀 +2 / 썼는데 틀림 −2 / 안 쓰고 문장 맞음 0 / 안 쓰고 문장도 틀림 −2
        //   ⚠️ 마스터·완벽은 점수만으로는 안 붙는다. 번역 미션에서 그 문법을 한 번이라도
        //      제대로 써봐야(grammarTransUsed) 열린다 — 단어의 subjectivePassed 와 같은 장치.
        // ============================================================
        const GRAMMAR_FILL_MAX = 1.5;   // 빈칸 복습 만점/최저점
        const GRAMMAR_TRANS_OK = 2;     // 한→스 미션에서 문법을 제대로 씀
        const GRAMMAR_TRANS_BAD = -2;   // 번역에서 문법을 틀리게 씀 / 안 쓰고 문장도 틀림
        // [냐냐 요청] 스→한 자유 문장에서 문법을 제대로 쓴 경우는 절반만.
        //   한→스는 그 문법을 써야만 풀리는 미션을 내주지만, 자유 문장은 아는 걸 골라 쓰는 거라
        //   같은 +2 를 주면 너무 쉽게 쌓인다. 틀렸을 때는 똑같이 −2 (틀린 건 어느 쪽이든 약점)
        const GRAMMAR_FREE_OK = 1;

        // [냐냐 요청] 자유 문장에 쓴 '내 단어장 단어' 점수 — 스펠링만 본다.
        //   뜻 판정은 유의어·문맥 때문에 부정확해서 예전부터 안 건드렸다. 스펠링은 객관적이라 괜찮다.
        const WORD_SPELL_OK = 2;
        const WORD_SPELL_BAD = -2;

        function getGrammarScore(id) {
            const s = grammarScores[id];
            return (typeof s === 'number') ? s : 0;
        }

        // 표시용 문자열 (+5 / -3.5 / 0) — 단어의 formatScore 와 같은 규칙
        function formatGrammarScore(id) {
            const s = getGrammarScore(id);
            const txt = (Math.round(s * 10) / 10).toString();
            return s > 0 ? '+' + txt : txt;
        }

        // 정답률(0~1) → 빈칸 복습 점수. 0점 기준 70%, 40% 이하는 바닥
        function grammarFillDelta(rate) {
            const t = (rate - 0.7) / 0.3;
            return clampScore(GRAMMAR_FILL_MAX * Math.max(-1, Math.min(1, t)));
        }

        function addGrammarScore(id, delta, opts = {}) {
            if (!id) return 0;
            const before = getGrammarScore(id);
            grammarScores[id] = clampScore(before + (delta || 0));
            if (opts.transUsed) grammarTransUsed[id] = true;   // 번역에서 제대로 써봤음 = 마스터 자격
            syncGrammarMastered(id, before);
            return grammarScores[id];
        }

        // 수동으로 마스터 박기 (✅ 버튼) — 단어의 별표처럼 점수를 기준선으로 못박는다
        function setGrammarScore(id, value, opts = {}) {
            if (!id) return 0;
            const before = getGrammarScore(id);
            grammarScores[id] = clampScore(value);
            if (opts.transUsed) grammarTransUsed[id] = true;
            syncGrammarMastered(id, before);
            return grammarScores[id];
        }

        function getGrammarGrade(id) {
            const s = getGrammarScore(id);
            const canMaster = !!grammarTransUsed[id];   // 번역에서 써봐야 마스터가 열림
            if (s >= SCORE_PERFECT && canMaster) return 'perfect';
            if (s >= SCORE_MASTER && canMaster) return 'mastered';
            if (s <= SCORE_CRITICAL) return 'critical';
            if (s <= SCORE_WEAK) return 'weak';
            return 'normal';
        }

        // 점수가 바뀔 때 masteredGrammar(표시용)·헤더 통계·일지 카운트를 따라 맞춘다
        function syncGrammarMastered(id, beforeScore) {
            // [냐냐 요청] 헤더의 문법 보유/마스터/약점 숫자를 항상 최신으로
            if (typeof updateStats === 'function') setTimeout(updateStats, 0);
            const grade = getGrammarGrade(id);
            const nowMastered = (grade === 'mastered' || grade === 'perfect');
            const wasMastered = !!masteredGrammar[id];
            if (nowMastered === wasMastered) return;
            if (nowMastered) {
                masteredGrammar[id] = true;
                if (typeof logAction === 'function') logAction('new-grammar-mastered');
            } else {
                delete masteredGrammar[id];
                if (typeof logAction === 'function') logAction('undo-new-grammar-mastered');
            }
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
        function isMuted() { return localStorage.getItem('demo_muted') === '1'; }
        function toggleMute() {
            const next = !isMuted();
            localStorage.setItem('demo_muted', next ? '1' : '0');
            if (next && 'speechSynthesis' in window) window.speechSynthesis.cancel();
            updateMuteBadge();
            showToast(next ? "소리를 껐어요 🔇" : "소리를 켰어요 🔊", "info");
        }
        function updateMuteBadge() {
            const btn = document.getElementById('mute-badge');
            if (!btn) return;
            const muted = isMuted();
            // [냐냐 요청] 설정 메뉴 행 형태. className은 건드리지 않음(레이아웃 깨짐 방지)
            btn.innerHTML = (muted
                ? `<i class="fa-solid fa-volume-xmark text-slate-400 w-4 text-center"></i><span class="text-xs font-bold text-slate-700 flex-1">소리 꺼짐</span>`
                : `<i class="fa-solid fa-volume-high text-violet-500 w-4 text-center"></i><span class="text-xs font-bold text-slate-700 flex-1">소리 켜짐</span>`)
                + `<span class="text-[10px] font-bold ${muted ? 'text-slate-400' : 'text-violet-500'}">${muted ? 'OFF' : 'ON'}</span>`;
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
                ['+4.5 ~ +7.9', '마스터', 'bg-emerald-100 text-emerald-700', '연초록 — 마스터 달성'],
                ['-4.4 ~ +4.4', '일반', 'bg-slate-100 text-slate-600', '아직 연습 중'],
                ['-4.5 ~ -7.9', '약점', 'bg-amber-100 text-amber-700', '자주 틀리는 단어'],
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
                    ['주관식 · 오타·악센트 고쳐서 다시 정답', '+1', '−2'],
                    ['동사 활용형', '+2', '−1'],
                    ['동사 활용형 · 악센트 고쳐서 다시 정답', '+1', '−2']
                ]},
                { group: '미니게임', color: 'text-teal-600 bg-teal-50 border-teal-200', rows: [
                    ['속사포', '+0.5', '−1'],
                    ['떨어지는 단어', '+1', '판정 없음'],
                    ['듣기 받아쓰기', '점수 없음', '점수 없음']
                ]},
                { group: '복습', color: 'text-amber-600 bg-amber-50 border-amber-200', rows: [
                    ['깜박이', '+0.2', '−2'],
                    ['단어 빈칸', '맞힌 칸당 +0.7 (동사변형 칸 +0.1)', '틀린 칸당 −0.5 (동사변형 칸 −0.1)'],
                    ['쓰기 복습 · 1바퀴에 바로 맞힘', '+2', '(점수 없이 2바퀴로)'],
                    ['쓰기 복습 · 1바퀴 · 유의어 쓴 뒤 다시 정답', '+2', '(점수 없이 2바퀴로)'],
                    ['쓰기 복습 · 1바퀴 · 오타·악센트 고쳐서 다시 정답', '+1', '(점수 없이 2바퀴로)'],
                    ['쓰기 복습 · 익힌 뒤 3바퀴에서', '−1', '−2'],
                    ['문법표 빈칸', '단어 점수 무관', '마스터한 표를 틀리면 마스터 해제']
                ]}
            ];
            const scoreRows = SCORE_TABLE.map(g => g.rows.map(([act, ok, no], i) => `
                <tr class="border-b border-slate-100 ${i === g.rows.length - 1 ? 'border-b-2 border-b-slate-200' : ''}">
                    ${i === 0 ? `<td rowspan="${g.rows.length}" class="py-2.5 px-3 align-middle border-r border-slate-200"><span class="px-2 py-1 rounded-lg text-[11px] font-black border ${g.color} whitespace-nowrap">${g.group}</span></td>` : ''}
                    <td class="py-2.5 px-3 font-bold text-slate-700">${act}</td>
                    <!-- 맞혀도 마이너스인 칸이 있다 (쓰기 복습 3바퀴) → 값이 마이너스면 빨갛게 -->
                    <td class="py-2.5 px-3 font-black whitespace-nowrap ${/^[−-]/.test(ok) ? 'text-rose-500' : 'text-emerald-600'}">${ok}</td>
                    <td class="py-2.5 px-3 font-black text-rose-500 whitespace-nowrap">${no}</td>
                </tr>`).join('')).join('');

            const manualRows = [
                ['⭐ 별표 1번 클릭', '−4.5점 (약점)'],
                ['⭐ 별표 2번 클릭', '−8점 (치명적 약점)'],
                ['⭐ 별표 3번 클릭', '0점 (해제)'],
                ['✅ 마스터 1번 클릭', '+4.5점 (마스터)'],
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

            <!-- [냐냐 요청] 문법표 점수 규칙 -->
            <div class="bg-[#eef5fb] rounded-2xl border border-[#c3d9ec] p-4 space-y-3">
                <h4 class="text-sm font-black text-[#2c5578] flex items-center gap-2"><i class="fa-solid fa-book-open text-[#5896cb]"></i> 문법표 점수</h4>
                <p class="text-[11px] text-[#2c5578] font-semibold leading-relaxed">
                    문법·개념 노트도 <b>단어와 똑같은 −10 ~ +10 점수·등급 5단계</b>를 써요.
                </p>
                <table class="w-full text-xs bg-white rounded-xl overflow-hidden">
                    <thead>
                        <tr class="border-b-2 border-slate-200 text-[11px] text-slate-400 font-black uppercase">
                            <th class="py-2 px-3 text-left">활동</th>
                            <th class="py-2 px-3 text-left">점수</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="border-b border-slate-100"><td class="py-2 px-3 font-black text-slate-700">문법표 빈칸 <b>다 맞음</b> (100%)</td><td class="py-2 px-3 font-black text-emerald-600">+1.5</td></tr>
                        <tr class="border-b border-slate-100"><td class="py-2 px-3 font-bold text-slate-600">빈칸 90% / 80%</td><td class="py-2 px-3 font-bold text-emerald-600">+1.0 / +0.5</td></tr>
                        <tr class="border-b border-slate-100"><td class="py-2 px-3 font-bold text-slate-600">빈칸 <b>70%</b></td><td class="py-2 px-3 font-bold text-slate-400">0 (본전)</td></tr>
                        <tr class="border-b border-slate-100"><td class="py-2 px-3 font-bold text-slate-600">빈칸 60% / 40% 이하</td><td class="py-2 px-3 font-bold text-rose-500">−0.5 / −1.5</td></tr>
                        <tr class="border-b border-slate-100"><td class="py-2 px-3 font-black text-slate-700">번역 미션에서 <b>그 문법을 제대로 씀</b></td><td class="py-2 px-3 font-black text-emerald-600">+2</td></tr>
                        <tr class="border-b border-slate-100"><td class="py-2 px-3 font-bold text-slate-600">번역에서 그 문법을 <b>틀리게 씀</b></td><td class="py-2 px-3 font-black text-rose-500">−2</td></tr>
                        <tr class="border-b border-slate-100"><td class="py-2 px-3 font-bold text-slate-600">그 문법을 안 쓰고 번역 — 문장은 맞음</td><td class="py-2 px-3 font-bold text-slate-400">0</td></tr>
                        <tr><td class="py-2 px-3 font-bold text-slate-600">그 문법을 안 쓰고 번역 — 문장도 틀림</td><td class="py-2 px-3 font-black text-rose-500">−2</td></tr>
                    </tbody>
                </table>
                <p class="text-[11px] text-[#2c5578] font-semibold leading-relaxed pt-1">
                    빈칸은 <b>표 하나 풀 때 한 번만</b> 반영돼요 (칸마다가 아니라 정답률로).
                    정답률 70%가 본전이고, 그보다 잘하면 오르고 못하면 내려가요.
                </p>
                <p class="text-[11px] text-[#2c5578] font-semibold leading-relaxed">
                    ⚠️ <b>문법표도 점수만으로는 마스터가 안 돼요.</b>
                    <b class="text-[#5896cb]">번역 미션에서 그 문법을 한 번이라도 제대로 써야</b> 마스터가 열려요.
                    (빈칸만 반복해서는 '외운 것'이지 '쓸 줄 아는 것'은 아니니까요)
                </p>
                <p class="text-[11px] text-slate-500 font-semibold leading-relaxed">
                    번역에서 <b>단어를 틀려도 문법표 점수는 안 깎여요.</b> 문법이 맞았으면 문법은 맞은 거예요.
                    반대로 번역 결과가 <b>단어 점수를 바꾸지도 않아요</b> — 번역은 유의어·문맥에 따라 답이 여러 개라서요.
                </p>
            </div>

            <div class="bg-violet-50 rounded-2xl border border-violet-200 p-4 space-y-3">
                <h4 class="text-sm font-black text-violet-800 flex items-center gap-2"><i class="fa-solid fa-rotate text-violet-500"></i> 오늘의 복습 — 어떤 단어가 뽑히나요?</h4>
                <p class="text-xs text-violet-900 font-semibold leading-relaxed">
                    <b>틀린 적 있고 아직 마스터 안 한 단어</b>가 망각곡선에 따라 올라와요.
                    헤더의 <b>📖 복습</b> 버튼을 누르면 <b>랜덤 20개씩 쓰기 복습</b>으로 진행해요:
                    먼저 <b>가린 채 1번</b> 써서 아는지 확인하고(맞히면 여기서 끝),
                    틀린 것만 <b>보면서 2번</b> 쓴 다음 <b>순서를 섞어 다시 한 번</b> 확인해요.
                    <b>1바퀴 결과</b>로 망각곡선이 반영되는데, 반영 시점은 <b>그 단어의 복습이 끝났을 때</b>예요 —
                    1바퀴에 맞히면 바로, 틀리면 3바퀴까지 다 돌고 나서요. 중간에 그만두면 안 한 걸로 남아요.
                </p>
                <table class="w-full text-xs bg-white rounded-xl overflow-hidden">
                    <thead>
                        <tr class="border-b-2 border-violet-100 text-[11px] text-violet-400 font-black uppercase">
                            <th class="py-2 px-3 text-left">단계</th>
                            <th class="py-2 px-3 text-left">언제 뜨나</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="border-b border-slate-100"><td class="py-2 px-3 font-black text-slate-700">1단계</td><td class="py-2 px-3 text-slate-600 font-semibold">틀린 날로부터 <b>1일</b> 뒤</td></tr>
                        <tr class="border-b border-slate-100"><td class="py-2 px-3 font-black text-slate-700">2단계</td><td class="py-2 px-3 text-slate-600 font-semibold">복습한 날로부터 <b>3일</b> 뒤</td></tr>
                        <tr class="border-b border-slate-100"><td class="py-2 px-3 font-black text-slate-700">3단계</td><td class="py-2 px-3 text-slate-600 font-semibold">복습한 날로부터 <b>7일</b> 뒤</td></tr>
                        <tr class="border-b border-slate-100"><td class="py-2 px-3 font-black text-slate-700">4단계</td><td class="py-2 px-3 text-slate-600 font-semibold">복습한 날로부터 <b>14일</b> 뒤</td></tr>
                        <tr class="border-b border-slate-100"><td class="py-2 px-3 font-black text-slate-700">5단계</td><td class="py-2 px-3 text-slate-600 font-semibold">복습한 날로부터 <b>30일</b> 뒤</td></tr>
                        <tr><td class="py-2 px-3 font-black text-emerald-600">졸업</td><td class="py-2 px-3 text-emerald-700 font-semibold">5단계까지 마치면 더 안 떠요 🎓</td></tr>
                    </tbody>
                </table>
                <ul class="text-xs text-violet-900 font-semibold leading-relaxed space-y-1.5 pt-1">
                    <li>• <b>틀린 당일</b>은 뜨지 않아요. 다음 날부터 시작해요.</li>
                    <li>• <b>놓쳐도 사라지지 않아요.</b> 복습일이 지나면 할 때까지 계속 떠요.</li>
                    <li>• 밀린 단어도 <b>하루에 한 번만</b> 떠요. (한 번 하면 그날은 빠짐)</li>
                    <li>• <b>어디서 틀리든</b>(퀴즈·게임·복습·첨삭) 단계가 <b>한 칸만 뒤로</b> 가요. 4단계에서 틀리면 3단계(7일 뒤)로요. 처음부터 다시 하진 않아요.</li>
                    <li>• 같은 단어를 하루에 여러 번 틀려도 <b>한 칸만</b> 내려가요.</li>
                    <li>• 단어 빈칸에서 <b>관용구·예문 칸만</b> 틀린 건 복습 대상이 안 돼요. (뜻·철자·동사변형만 해당)</li>
                    <li>• 그날 복습을 다 끝내면 버튼이 <b>회색 '완료 ✓'</b>로 바뀌어요.</li>
                </ul>
            </div>

            <div class="bg-indigo-50 rounded-2xl border border-indigo-200 p-4 space-y-3">
                <h4 class="text-sm font-black text-indigo-800 flex items-center gap-2"><i class="fa-solid fa-spell-check text-indigo-500"></i> 스페인어를 직접 쓰는 채점 — 퀴즈 주관식 · 쓰기 복습 1바퀴</h4>
                <p class="text-xs text-indigo-900 font-semibold leading-relaxed">
                    두 곳은 <b>똑같은 규칙</b>으로 채점해요. 뜻만 보고 스페인어를 떠올려 쓰는 같은 행위니까요.
                </p>
                <table class="w-full text-xs bg-white rounded-xl overflow-hidden">
                    <thead>
                        <tr class="border-b-2 border-indigo-100 text-[11px] text-indigo-400 font-black uppercase">
                            <th class="py-2 px-3 text-left">이렇게 쓰면</th>
                            <th class="py-2 px-3 text-left">이렇게 돼요</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="border-b border-slate-100"><td class="py-2 px-3 font-black text-slate-700 whitespace-nowrap">그대로 정답</td><td class="py-2 px-3 text-slate-600 font-semibold">바로 통과 (AI도 안 불러요)</td></tr>
                        <tr class="border-b border-slate-100"><td class="py-2 px-3 font-black text-slate-700 whitespace-nowrap">유의어</td><td class="py-2 px-3 text-slate-600 font-semibold">"그것도 같은 뜻이에요" + <b>앞글자 힌트</b> → 한 번 더</td></tr>
                        <tr class="border-b border-slate-100"><td class="py-2 px-3 font-black text-slate-700 whitespace-nowrap">철자 오타</td><td class="py-2 px-3 text-slate-600 font-semibold">3글자 차이까지 → 한 번 더</td></tr>
                        <tr class="border-b border-slate-100"><td class="py-2 px-3 font-black text-slate-700 whitespace-nowrap">악센트만 틀림</td><td class="py-2 px-3 text-slate-600 font-semibold">그냥 안 넘어가요 → 한 번 더 <span class="text-slate-400">(esta/está 처럼 뜻이 갈려요)</span></td></tr>
                        <tr><td class="py-2 px-3 font-black text-slate-700 whitespace-nowrap">아예 틀림</td><td class="py-2 px-3 text-slate-600 font-semibold">오답. 왜 틀렸는지 짚어줘요</td></tr>
                    </tbody>
                </table>
                <ul class="text-xs text-indigo-900 font-semibold leading-relaxed space-y-1.5">
                    <li>• <b>봐주는 건 이유마다 한 번씩.</b> 유의어를 알려줘서 제 단어를 떠올렸는데 철자를 흘렸다면 그건 새로운 실수라 <b>한 번 더</b> 기회를 줘요. 같은 이유로 두 번은 안 봐줘요.</li>
                    <li>• <b>오타·악센트를 고쳐서 맞히면 +1</b>, 유의어만 거쳤으면 <b>+2</b>. 오타가 한 번이라도 끼면 +1이에요.</li>
                    <li>• 틀렸을 때는 세 갈래로 알려줘요 — <b>철자면</b> 틀린 자리만 빨갛게, <b>다른 진짜 단어면</b> 그 단어의 뜻을, <b>없는 단어면</b> 없다고요.</li>
                    <li>• <b>안 써도 되는 것</b>: 대괄호 자리표시자(<span class="text-slate-500">antes de [명사/동사원형]</span>), 한글, 관사(el·la·el/la), 문장부호(¿ ? ¡ !).</li>
                    <li>• <b>악센트는 어디서든 봅니다</b> — 퀴즈(주관식·동사 활용형)·쓰기 복습·단어 빈칸·문법표 빈칸·미니게임 전부요.
                        <span class="text-slate-500">esta/está 처럼 뜻이 갈리기도 하고, vosotros(-áis)나 부정과거(-é/-ó)는 악센트가 곧 그 형태거든요.</span>
                        틀리면 어디가 다른지 <b>글자에 표시</b>해 줘요.</li>
                </ul>
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
            if (blocks.length === 0) return '';
            // [냐냐 PATCH] 유의어+반의어 두 박스 간격을 좁게 통일 (h-1.5 div 이중 간격 제거)
            return `<div class="space-y-2">${blocks.join('')}</div>`;
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

        // [냐냐 요청] 그래프 가로축 단위 — 'day' | 'week' | 'month'
        //   기간을 바꾸면 그 기간에 어울리는 단위로 자동으로 맞춘 뒤, 냐냐가 직접 바꿀 수 있다.
        //   (1년치 365개를 700px 에 넣으면 점 하나가 2px 라 막대가 안 보인다 — 그래서 기본이 '월')
        let currentRecordUnit = 'day';
        let lastRecordSpan = null;   // {start, end} — 단위만 바꿔서 다시 그릴 때 쓴다

        function defaultRecordUnit(days) {
            if (days <= 45) return 'day';
            if (days <= 190) return 'week';   // 반년까지는 주
            return 'month';
        }

        //   redraw:false 면 버튼 모양만 맞춘다 (기간을 바꿀 때 — 어차피 곧바로 다시 그리니까)
        function setRecordUnit(unit, redraw = true) {
            currentRecordUnit = unit;
            document.querySelectorAll('.record-unit-btn').forEach(btn => {
                btn.className = "record-unit-btn px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-500";
            });
            const activeBtn = document.getElementById({ day: 'unit-btn-day', week: 'unit-btn-week', month: 'unit-btn-month' }[unit]);
            if (activeBtn) activeBtn.className = "record-unit-btn px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all bg-white text-slate-900 shadow-sm";
            if (redraw && lastRecordSpan) renderRecordsForRange(lastRecordSpan.start, lastRecordSpan.end);
        }

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

            // [냐냐 요청] 기간에 어울리는 단위로 자동 전환 (1년 → 월). 그 뒤에 단위 버튼으로 바꿀 수 있다
            setRecordUnit(defaultRecordUnit(days), false);

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
            // 직접 고른 기간도 길이에 맞는 단위로 시작 (그 뒤 단위 버튼으로 변경 가능)
            const spanDays = Math.round((end - start) / 86400000) + 1;
            setRecordUnit(defaultRecordUnit(spanDays), false);
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

        // ============================================================
        // [냐냐 요청] 일별 series 를 주/월 단위로 접기
        //   항목마다 합치는 방법이 다르다:
        //     · 횟수(퀴즈·복습·게임·신규 등록…)  → 그 묶음의 합계
        //     · 누적 스냅샷(등록 단어 수·마스터 수) → 그 묶음의 마지막 값 (= 월말/주말 시점)
        //   정답률처럼 비율로 쓰는 값은 그래프 쪽에서 합계로 다시 계산하니까 여기선 안 건드린다.
        //   (합계의 비율이라 '평균의 평균'이 되지 않는다)
        // ============================================================
        const RECORD_SUM_FIELDS = ['quizTotal', 'quizCorrect', 'aiSessions', 'newWordsCount', 'newMasteredCount',
                                   'reviewCount', 'gameCount', 'newGrammarCount', 'newGrammarMasteredCount', 'newPerfectCount'];
        const RECORD_LAST_FIELDS = ['registeredTotal', 'masteredTotal', 'perfectTotal', 'weakTotal', 'criticalTotal',
                                    'grammarTotal', 'grammarMasteredTotal', 'grammarWeakTotal'];

        // 그 날짜가 속한 주의 시작(일요일) — 달력이 일요일 시작이라 맞춰준다
        function weekStartOf(ds) {
            const [y, m, d] = ds.split('-').map(Number);
            const dt = new Date(y, m - 1, d);
            dt.setDate(dt.getDate() - dt.getDay());
            return getLocalDateString(dt);
        }

        // [냐냐 요청] 주 라벨은 날짜(07/21)보다 '7월 4주'가 알아보기 쉽다.
        //   주가 시작하는 날(일요일)이 그 달의 몇째 주인지로 센다 — 1~7일=1주, 8~14일=2주 …
        function weekLabelOf(weekStart) {
            const mm = Number(weekStart.slice(5, 7));
            const dd = Number(weekStart.slice(8, 10));
            return `${mm}월 ${Math.floor((dd - 1) / 7) + 1}주`;
        }

        // [냐냐 요청] 일 라벨도 주·월과 같은 말투로 — '07/21' 대신 '7월 21일'
        function dayLabelOf(ds) {
            return `${Number(ds.slice(5, 7))}월 ${Number(ds.slice(8, 10))}일`;
        }

        // 묶음의 시작~끝 (같은 달이면 뒤쪽 달은 생략) — '7월 12일 ~ 18일'
        function spanLabelOf(first, last) {
            if (first === last) return dayLabelOf(first);
            return first.slice(0, 7) === last.slice(0, 7)
                ? `${dayLabelOf(first)} ~ ${Number(last.slice(8, 10))}일`
                : `${dayLabelOf(first)} ~ ${dayLabelOf(last)}`;
        }

        function aggregateRecordSeries(daily, unit) {
            const keyOf = unit === 'month' ? (d => d.date.slice(0, 7))
                        : unit === 'week'  ? (d => weekStartOf(d.date))
                        : (d => d.date);

            const buckets = [];
            const byKey = {};
            daily.forEach(d => {
                const k = keyOf(d);
                let b = byKey[k];
                if (!b) {
                    b = byKey[k] = { _key: k, _days: [] };
                    RECORD_SUM_FIELDS.forEach(f => b[f] = 0);
                    RECORD_LAST_FIELDS.forEach(f => b[f] = null);
                    buckets.push(b);
                }
                b._days.push(d.date);
                RECORD_SUM_FIELDS.forEach(f => b[f] += (d[f] || 0));
                // 마지막 '값이 있는' 날의 스냅샷 (등급별 총계는 예전 날짜엔 null 이라 건너뛴다)
                RECORD_LAST_FIELDS.forEach(f => { if (d[f] !== null && d[f] !== undefined) b[f] = d[f]; });
            });

            buckets.forEach(b => {
                const first = b._days[0];
                const last = b._days[b._days.length - 1];
                b.date = first;                 // 툴팁·정렬용 대표 날짜 (묶음의 첫날)
                // label = 달까지 적은 형태, labelShort = 달을 뗀 형태.
                //   [냐냐 요청] 가로축에서 앞 라벨과 같은 달이면 달을 안 적는다 (7월 21일 · 22일 · 23일 …)
                //   labelMonth 는 그 '같은 달인지' 비교용
                if (unit === 'month') {
                    b.labelMonth = b._key;
                    b.label = b.labelShort = `${Number(b._key.slice(5, 7))}월`;
                    b.fullLabel = `${b._key.slice(0, 4)}년 ${Number(b._key.slice(5, 7))}월`;
                } else if (unit === 'week') {
                    // 라벨은 '7월 4주', 툴팁엔 실제 날짜까지 — 묶음 첫날이 지난달이면 그 달 기준으로 적힌다
                    b.labelMonth = b._key.slice(0, 7);
                    b.label = weekLabelOf(b._key);
                    b.labelShort = b.label.split(' ')[1];                 // '4주'
                    b.fullLabel = `${b._key.slice(0, 4)}년 ${weekLabelOf(b._key)} (${spanLabelOf(first, last)})`;
                } else {
                    b.labelMonth = first.slice(0, 7);
                    b.label = dayLabelOf(first);
                    b.labelShort = `${Number(first.slice(8, 10))}일`;
                    b.fullLabel = `${first.slice(0, 4)}년 ${dayLabelOf(first)}`;
                }
                delete b._days;
            });
            return buckets;
        }

        function renderRecordsForRange(start, end) {
            lastRecordSpan = { start, end };   // 단위 버튼으로 다시 그릴 때 쓴다
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
            const dailySeries = dateKeys.map(date => {
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
                    newPerfectCount: (log && log.newPerfectCount) || 0,
                    // [냐냐 요청] 문법표 등급별 총계 (문법표 점수가 생긴 날부터 쌓임)
                    grammarTotal: (log && log.grammarTotal) || 0,
                    grammarMasteredTotal: (log && log.grammarMasteredTotal) || 0,
                    grammarWeakTotal: (log && log.grammarWeakTotal) || 0
                };
            });

            // [냐냐 요청] 여기서 일/주/월로 접는다. 그래프 4개는 점 개수만 줄어들 뿐 그대로 동작한다
            const series = aggregateRecordSeries(dailySeries, currentRecordUnit);

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

        // [냐냐 요청] 가로축 라벨. 예전엔 '전체의 1/7 간격'이라 09/17, 11/08 처럼 아무 날짜에나 찍혀서 지저분했다.
        //   · 일 단위(11일 이상): 1·5·10·15·20·25일 같은 떨어지는 날에만 찍는다
        //   · 그 밖에는 균등 간격이되, 단위별로 넣을 수 있는 개수를 다르게 (월 라벨은 짧아서 더 많이 들어감)
        function recordChartXLabels(series, xOf, height) {
            const n = series.length;
            if (!n) return '';
            const MAX_LABELS = 14;      // 700px 기준으로 이 정도까진 안 겹친다
            // 라벨 사이 최소 간격 (viewBox 단위 ≈ px). 한글 라벨('7월 21일')은 넓어서 넉넉히 띄운다
            const MIN_GAP = currentRecordUnit === 'week' ? 58 : (currentRecordUnit === 'month' ? 30 : 52);

            let idxs;
            if (currentRecordUnit === 'day' && n > 10) {
                // 떨어지는 날에만 — 30·31일은 다음 달 1일과 붙어버리니 뺀다.
                // 기간이 길면 후보를 점점 성기게 (1·5·10… → 1·15 → 1일만)
                const rules = [
                    dd => dd === 1 || (dd % 5 === 0 && dd <= 25),
                    dd => dd === 1 || dd === 15,
                    dd => dd === 1
                ];
                for (const ok of rules) {
                    idxs = series.map((d, i) => i).filter(i => ok(Number(series[i].date.slice(8, 10))));
                    if (idxs.length <= MAX_LABELS) break;
                }
                if (idxs.length > MAX_LABELS) {   // 2년치처럼 1일만 찍어도 많으면 솎아낸다
                    const every = Math.ceil(idxs.length / MAX_LABELS);
                    idxs = idxs.filter((_, k) => k % every === 0);
                }
            } else {
                const every = Math.max(1, Math.ceil(n / MAX_LABELS));
                idxs = series.map((d, i) => i).filter(i => i % every === 0 || i === n - 1);
            }

            // 그래도 붙는 라벨이 있으면 뒤엣것을 버린다.
            // 마지막 라벨은 항상 살리되, 그 바로 앞이 너무 가까우면 앞엣것을 대신 뺀다
            const kept = [];
            let lastX = -Infinity;
            idxs.forEach(i => {
                const x = xOf(i);
                if (x - lastX >= MIN_GAP) { kept.push(i); lastX = x; }
                else if (i === n - 1) { kept.pop(); kept.push(i); lastX = x; }
            });

            // [냐냐 요청] 화면에 실제로 남은 라벨끼리 비교해서, 앞엣것과 같은 달이면 달을 뗀다.
            //   (라벨이 듬성듬성해지면 앞뒤 달이 달라지니 자동으로 달이 다시 붙는다)
            let prevMonth = null;
            return kept.map(i => {
                const d = series[i];
                const txt = (d.labelMonth && d.labelMonth === prevMonth ? d.labelShort : d.label) || fmtDateShort(d.date);
                prevMonth = d.labelMonth;
                return `<text x="${xOf(i).toFixed(1)}" y="${height - 8}" font-size="10" font-weight="700" fill="#475569" text-anchor="middle">${txt}</text>`;
            }).join('');
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

        // [냐냐 요청] minVal을 주면 왼쪽 축 하단이 0이 아니라 그 값에서 시작한다
        //   (성장 그래프처럼 이미 쌓인 양이 많을 때 변화폭이 눌려 보이는 걸 방지)
        function recordChartGridlines(maxVal, padding, chartW, chartH, width, suffix = '', minVal = 0) {
            const steps = 4;
            let html = '';
            const span = Math.max(1, maxVal - minVal);
            const valAt = (i) => Math.round(minVal + (span / steps) * i);
            // [냐냐 PATCH] 라벨이 길면(자릿수 많으면) 글씨 크기를 줄여 잘림 방지
            const longest = Math.max(...Array.from({ length: steps + 1 }, (_, i) => `${valAt(i)}${suffix}`.length));
            const fs = longest >= 6 ? 7 : (longest >= 5 ? 8 : 9);
            for (let i = 0; i <= steps; i++) {
                const val = valAt(i);
                const y = padding.top + chartH - (i / steps) * chartH;
                html += `<line x1="${padding.left}" y1="${y.toFixed(1)}" x2="${width - padding.right}" y2="${y.toFixed(1)}" stroke="#f1f5f9" stroke-width="1"/>`;
                html += `<text x="${(padding.left - 5).toFixed(1)}" y="${(y + 3).toFixed(1)}" font-size="${fs}" font-weight="700" fill="#475569" text-anchor="end">${val}${suffix}</text>`;
            }
            return html;
        }

        // [냐냐 요청] 성장 그래프용 축 범위 계산 — 하단 = 조회 시작일의 개수
        //   · 기간 중 단어를 지워서 더 낮아진 값이 있으면 그 값까지 내려서 선이 잘리지 않게 함
        //   · 변화가 거의 없어도 눈금이 겹치지 않도록 최소 폭 4 확보
        function growthAxisRange(values) {
            const vals = (values || []).filter(v => typeof v === 'number' && isFinite(v));
            if (!vals.length) return { min: 0, max: 4 };
            const lo = Math.max(0, Math.floor(Math.min(...vals)));
            const hi = Math.ceil(Math.max(...vals));
            const span = Math.max(4, hi - lo);
            return { min: lo, max: lo + span };
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

            // [냐냐 요청] 왼쪽 축 하단을 0이 아니라 '조회 시작일의 단어 수'로
            const axis = growthAxisRange(series.map(d => d.registeredTotal));
            const minVal = axis.min;
            const maxVal = axis.max;
            const xInset = Math.min(14, chartW * 0.06);
            const xSpan = chartW - xInset * 2;
            const xStep = series.length > 1 ? xSpan / (series.length - 1) : 0;
            const xOf = (i) => padding.left + xInset + (series.length > 1 ? i * xStep : xSpan / 2);
            const baseY = height - padding.bottom;
            const yOfCount = (val) => padding.top + chartH - ((val - minVal) / (maxVal - minVal)) * chartH;
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
                const txt = `${d.fullLabel}: 완벽 ${Math.round(d.rPerfect || 0)}% · 마스터 ${Math.round(d.rMastered || 0)}% · 약점 ${Math.round(d.rWeak || 0)}% · 치명적 ${Math.round(d.rCritical || 0)}%`.replace(/'/g, "\\'");
                bars += `<rect x="${(xOf(i) - Math.max(barWidth + 2, 14) / 2).toFixed(1)}" y="${padding.top}" width="${Math.max(barWidth + 2, 14).toFixed(1)}" height="${chartH.toFixed(1)}" fill="transparent" style="cursor:pointer" onclick="showChartTooltip(event, 'record-line-chart-tooltip', '${txt}')"/>`;
            });

            // 등록 단어 수 = 꺾은선 (왼쪽 개수 축)
            const linePath = withRatio.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(1)} ${yOfCount(d.registeredTotal).toFixed(1)}`).join(' ');
            const lineDots = withRatio.map((d, i) => {
                const cx = xOf(i).toFixed(1);
                const cy = yOfCount(d.registeredTotal).toFixed(1);
                const txt = `${d.fullLabel}: 등록 단어 ${d.registeredTotal}개`.replace(/'/g, "\\'");
                return `<circle cx="${cx}" cy="${cy}" r="2.5" fill="#8b5cf6"/><circle cx="${cx}" cy="${cy}" r="9" fill="transparent" style="cursor:pointer" onclick="showChartTooltip(event, 'record-line-chart-tooltip', '${txt}')"/>`;
            }).join('');

            const anyGrade = withRatio.some(d => d.hasGrade);
            const legend = STACK.map(seg =>
                `<span class="inline-flex items-center gap-1"><span style="width:9px;height:9px;border-radius:2px;background:${seg.color};display:inline-block;"></span><span class="text-[10px] font-bold text-slate-600">${seg.label}</span></span>`
            ).join('<span class="mx-1.5"></span>');

            container.innerHTML = `
                ${recordChartTooltipDiv('record-line-chart-tooltip')}
                <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; display:block;" preserveAspectRatio="xMidYMid meet">
                    ${recordChartGridlines(maxVal, padding, chartW, chartH, width, '', minVal)}
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
                const text = `${d.fullLabel}: 신규 등록 ${d._newTotal}개 (단어 ${d.newWordsCount||0}+문법 ${d.newGrammarCount||0}) · 신규 마스터 ${d._newMasteredTotal}개 · 신규 완벽 ${d.newPerfectCount||0}개`.replace(/'/g, "\\'");
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
                const text = `${d.fullLabel}: 오답률 ${Math.round(d.wrongRate)}% (${d.quizTotal - d.quizCorrect}/${d.quizTotal}개)`.replace(/'/g, "\\'");
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
                const text = `${d.fullLabel}: 전체 ${d.quizTotal}문제`.replace(/'/g, "\\'");
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
                const text = `${d.fullLabel}: ${d.aiSessions}회`.replace(/'/g, "\\'");
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
                const text = `${d.fullLabel}: 신규등록 ${d._newReg||0} · 퀴즈 ${d.quizTotal||0} · AI ${d.aiSessions||0} · 복습 ${d.reviewCount||0} · 게임 ${d.gameCount||0} (총 ${d._total}개 활동)`.replace(/'/g, "\\'");
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
            // [냐냐 요청] 약점 비율 — 문법표 점수가 생긴 뒤 찍히는 스냅샷(grammarWeakTotal)을 쓴다.
            //   그 이전 날짜엔 데이터가 없으므로 0으로 둔다 (단어장 등급 스냅샷도 같은 방식으로 시작했음)
            const weakRatioOf = (i) => {
                const d = series[i] || {};
                const tot = d.grammarTotal || 0;
                return tot > 0 ? ((d.grammarWeakTotal || 0) / tot) * 100 : 0;
            };
            const hasWeakData = series.some(d => (d && d.grammarTotal) > 0);

            // [냐냐 요청] 왼쪽 축 하단을 0이 아니라 '조회 시작일의 문법표 수'로
            const gAxis = growthAxisRange(regByDay);
            const gMin = gAxis.min;
            const maxVal = gAxis.max;
            // [냐냐 PATCH] 좌우 여백(inset) — 첫/마지막 막대가 축에 붙어 잘리는 것 방지
            const xInset = Math.min(14, chartW * 0.06);
            const xSpan = chartW - xInset * 2;
            const xStep = series.length > 1 ? xSpan / (series.length - 1) : 0;
            const xOf = (i) => padding.left + xInset + (series.length > 1 ? i * xStep : xSpan / 2);
            const yOfCount = (v) => padding.top + chartH - ((v - gMin) / (maxVal - gMin)) * chartH;
            const groupWidth = chartW / series.length;
            const barWidth = Math.min(6, groupWidth * 0.4);

            let bars = '';
            series.forEach((d, i) => {
                const mBarH = (masteredRatioOf(i) / 100) * chartH;
                const wBarH = (weakRatioOf(i) / 100) * chartH;
                if (hasWeakData) {
                    // 마스터·약점을 나란히 (단어장 성장과 같은 구성)
                    const half = barWidth / 2;
                    bars += `<rect x="${(xOf(i) - barWidth / 2).toFixed(1)}" y="${(baseY - mBarH).toFixed(1)}" width="${half.toFixed(1)}" height="${mBarH.toFixed(1)}" fill="#14b8a6" opacity="0.7" rx="1.5"/>`;
                    bars += `<rect x="${xOf(i).toFixed(1)}" y="${(baseY - wBarH).toFixed(1)}" width="${half.toFixed(1)}" height="${wBarH.toFixed(1)}" fill="#f43f5e" opacity="0.6" rx="1.5"/>`;
                } else {
                    bars += `<rect x="${(xOf(i) - barWidth / 2).toFixed(1)}" y="${(baseY - mBarH).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${mBarH.toFixed(1)}" fill="#14b8a6" opacity="0.7" rx="1.5"/>`;
                }
                const text = `${d.fullLabel}: 등록 문법 ${regByDay[i]}개 · 마스터 비율 ${Math.round(masteredRatioOf(i))}%${hasWeakData ? ` · 약점 비율 ${Math.round(weakRatioOf(i))}%` : ''}`.replace(/'/g, "\\'");
                bars += `<rect x="${(xOf(i) - Math.max(barWidth, 14) / 2).toFixed(1)}" y="${padding.top}" width="${Math.max(barWidth, 14).toFixed(1)}" height="${chartH.toFixed(1)}" fill="transparent" style="cursor:pointer" onclick="showChartTooltip(event, 'record-grammar-chart-tooltip', '${text}')"/>`;
            });

            const linePath = series.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(1)} ${yOfCount(regByDay[i]).toFixed(1)}`).join(' ');
            const lineDots = series.map((d, i) => `<circle cx="${xOf(i).toFixed(1)}" cy="${yOfCount(regByDay[i]).toFixed(1)}" r="2.5" fill="#5896cb"/>`).join('');

            container.innerHTML = `
                ${recordChartTooltipDiv('record-grammar-chart-tooltip')}
                <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; display:block;" preserveAspectRatio="xMidYMid meet">
                    ${recordChartGridlines(maxVal, padding, chartW, chartH, width, '', gMin)}
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
        let masteredGrammar = {}; // [냐냐 PATCH] 마스터한 문법 표 {tableId: true} — 이제 점수에서 자동으로 채워짐
        // [냐냐 요청] 문법표 점수 — 단어와 같은 척도(-10~+10)·같은 등급을 쓴다
        let grammarScores = {};        // {tableId: -10~+10}
        let grammarTransUsed = {};     // {tableId: true} 번역 미션에서 그 문법을 제대로 써본 적 있음 (마스터 자격)
        let hiddenDefaultGrammar = []; // [냐냐 PATCH] 삭제(숨김)한 기본 문법 표 id 목록
        let hiddenQuestionTopics = []; // [냐냐 PATCH] 질문 주제 드롭다운에서 숨긴 목록
        let grammarCellHighlights = {}; // [냐냐 PATCH] 문법표 칸별 강조 {tableId: {"ri-ci": true}}

        // [냐냐 요청] 표 칸 ↔ 단어장 연결 {tableId: {"블록id:행-열": 단어id}}
        //   칸 강조와 같은 방식으로 노트 바깥에 둔다 — 표를 편집해도 안 날아가고 동기화도 따라감.
        //   ⚠️ 이 연결이 있는 칸만 빈칸 채점에서 단어 점수를 건드린다.
        //      즉 "연결이 하나라도 있는 표 = 단어 시험" 이라 따로 켜고 끄는 스위치가 필요 없다.
        let grammarCellWords = {};
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

        // [냐냐 요청] 문법표 정렬 — 단어장과 같은 방식.
        //   기준은 '등록순' 과 '가나다순' 둘. 같은 버튼을 또 누르면 오름/내림이 뒤집힌다.
        //   기본은 가나다순 (제목으로 찾는 일이 제일 많아서)
        const GSORT_KEY_OF = { newest: 'reg', oldest: 'reg', 'alpha-asc': 'alpha', 'alpha-desc': 'alpha' };
        const GSORT_DEFAULT_OF = { reg: 'newest', alpha: 'alpha-asc' };   // 처음 누를 때의 방향
        const GSORT_FLIP_OF = { newest: 'oldest', oldest: 'newest', 'alpha-asc': 'alpha-desc', 'alpha-desc': 'alpha-asc' };
        const GSORT_BTN_LABEL = { newest: '등록순 ↓', oldest: '등록순 ↑', 'alpha-asc': '가나다 ↓', 'alpha-desc': '가나다 ↑' };
        const GSORT_BASE_LABEL = { reg: '등록순', alpha: '가나다순' };

        let grammarSortMode = 'alpha-asc';

        // [냐냐 요청] 주제별 묶기 ↔ 그냥 목록. 목록일 땐 카드마다 주제 배지를 달아준다
        //   ⚠️ 아래쪽 grammarViewMode 는 '전체 펼치기 3단계' 용이라 이름이 다르다
        let grammarGroupView = 'group';   // 'group' | 'list'
        function toggleGrammarViewMode() {
            grammarGroupView = (grammarGroupView === 'group') ? 'list' : 'group';
            saveGrammarFilterPrefs();
            renderGrammarTables();
        }
        function syncGrammarViewBtn() {
            const ico = document.getElementById('grammar-view-icon');
            const btn = document.getElementById('grammar-view-btn');
            if (!ico || !btn) return;
            const grouped = (grammarGroupView === 'group');
            ico.className = grouped ? 'fa-solid fa-layer-group' : 'fa-solid fa-list';
            btn.title = grouped ? '주제별로 묶여 있어요 — 눌러서 목록으로' : '목록으로 보고 있어요 — 눌러서 주제별로';
        }

        // ============================================================
        // [냐냐 PATCH-4차] 문법표 🔍 단어 찾기 모드
        //   켜면: 셀 안의 스페인어 단어에 밑줄 + 클릭 가능
        //   클릭 → 등록된 단어면 단어창 열기 (hablo → hablar 처럼 변형형도 원형 찾음)
        //          미등록이면 "등록할까요?" → AI 자동완성으로 바로 등록
        // ============================================================
        let grammarWordLookupMode = false;

        // 켜진 상태를 버튼 색으로 보여준다 (맨 윗줄로 옮겼으니 어디가 켜졌는지 티가 나야 한다)
        function syncGrammarLookupBtn() {
            const btn = document.getElementById('grammar-lookup-btn');
            if (!btn) return;
            const on = grammarWordLookupMode;
            btn.className = `w-10 h-10 rounded-xl border text-sm transition-all flex items-center justify-center ${
                on ? 'bg-sky-50 border-sky-300 text-sky-600' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'}`;
            btn.title = on ? '단어 찾기 끄기' : '🔍 단어 찾기 (표 안의 단어를 눌러 단어장으로)';
        }

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
                    // [냐냐 요청] 블록 전체를 훑는다 — 글 블록 여러 개, 표 블록 여러 개 모두 검색됨
                    const parts = [t.title];
                    getNoteBlocks(t).forEach(b => {
                        if (b.type === 'text') parts.push(richTextToPlain(b.html));
                        else parts.push(...(b.headerRows || []).flat(), ...((b.rows || []).flat()));
                    });
                    const haystack = parts.join(' ').toLowerCase();
                    return haystack.includes(query);
                });
            }

            // [냐냐 PATCH] 마스터 상태 필터
            if (grammarFilterMastery === 'mastered') tables = tables.filter(t => masteredGrammar[t.id]);
            else if (grammarFilterMastery === 'not-mastered') tables = tables.filter(t => !masteredGrammar[t.id]);
            // [냐냐 요청] 약점 문법표만 보기 (단어장의 약점 필터와 같은 기준)
            else if (grammarFilterMastery === 'weak') tables = tables.filter(t => ['weak', 'critical'].includes(getGrammarGrade(t.id)));
            // [냐냐 PATCH] 아이콘 주제 필터 (여러 개 선택 가능, 빈 배열=전체)
            if (grammarFilterTopics.length > 0) tables = tables.filter(t => grammarFilterTopics.includes(grammarTopicKey(t)));

            document.getElementById('grammar-empty-msg')?.classList.toggle('hidden', tables.length > 0);

            // [냐냐 요청] 정렬: 등록순(최신/오래된) · 가나다순(오름/내림). 'oldest' 는 원래 순서 그대로
            const byTitle = (a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'ko');
            if (grammarSortMode === 'newest') tables = [...tables].reverse();
            else if (grammarSortMode === 'alpha-asc') tables = [...tables].sort(byTitle);
            else if (grammarSortMode === 'alpha-desc') tables = [...tables].sort((a, b) => byTitle(b, a));
            // [냐냐 PATCH] 고정된 표를 맨 위로 정렬 (고정끼리는 정렬된 순서 유지)
            tables = [...tables].sort((a, b) => (pinnedGrammar[b.id] ? 1 : 0) - (pinnedGrammar[a.id] ? 1 : 0));

            // [냐냐 요청] 검색·필터 중이 아니면 주제별로 묶어서 보여준다
            //   (주제 헤더는 펼친 채로 노트 제목을 나열하고, 노트 상세만 접힘)
            //   '목록으로 보기' 를 켜두면 검색·필터가 없어도 묶지 않는다
            const useGroups = grammarGroupView === 'group' && !query && grammarFilterTopics.length === 0 && grammarFilterMastery === 'all';
            container.innerHTML = useGroups
                ? renderGrammarGrouped(tables)
                : tables.map(t => renderGrammarNoteCard(t, query, true)).join('');

            // [냐냐 PATCH] 필터 뱃지 + 요약 줄 갱신
            if (typeof updateGrammarFilterBadge === 'function') updateGrammarFilterBadge();
            if (typeof renderGrammarFilterSummary === 'function') renderGrammarFilterSummary();
            if (typeof syncGrammarExpandBtn === 'function') syncGrammarExpandBtn();
            if (typeof syncGrammarViewBtn === 'function') syncGrammarViewBtn();
            if (typeof syncGrammarLookupBtn === 'function') syncGrammarLookupBtn();
        }

        // [냐냐 요청] 주제별 그룹 렌더 — 주제 헤더(접기 가능) 아래에 그 주제 노트들
        let grammarGroupCollapsed = {}; // {주제키: true} 접힌 주제. 없으면 펼침(기본)
        function toggleGrammarGroup(key) {
            grammarGroupCollapsed[key] = !grammarGroupCollapsed[key];
            saveGrammarFilterPrefs();   // [냐냐 요청] 접어둔 주제도 기억
            renderGrammarTables();
        }
        function renderGrammarGrouped(tables) {
            if (!tables.length) return '';
            // 주제별로 묶기 (tables 는 이미 정렬·고정 반영된 순서라 그룹 안 순서도 그대로 유지됨)
            const groups = {};
            tables.forEach(t => { const k = grammarTopicKey(t); (groups[k] = groups[k] || []).push(t); });
            // 주제 순서: 주제 관리에서 정한 순서 → 맨 끝에 '기타'
            const order = (typeof GRAMMAR_ICONS !== 'undefined' ? GRAMMAR_ICONS.map(g => g.icon) : []).filter(k => groups[k]);
            if (groups[GRAMMAR_OTHER_TOPIC]) order.push(GRAMMAR_OTHER_TOPIC);
            return order.map(key => {
                const list = groups[key];
                const collapsed = !!grammarGroupCollapsed[key];
                const c = grammarTopicColor(key);
                const icon = key === GRAMMAR_OTHER_TOPIC ? '⭐' : key;
                const label = grammarTopicLabel(key);
                const cards = list.map(t => renderGrammarNoteCard(t, '')).join('');
                // [냐냐 요청] 주제 줄은 배경색 + 큰 글씨로 강조 (접혀 있을 때 이게 목차 역할)
                return `
                    <div class="space-y-2">
                        <button type="button" onclick="toggleGrammarGroup('${key}')" class="w-full flex items-center gap-2.5 px-4 py-3 rounded-2xl border ${c.b} ${c.r} hover:brightness-95 transition-all text-left">
                            <i class="fa-solid fa-chevron-down ${c.t} text-xs transition-transform shrink-0" style="${collapsed ? 'transform:rotate(-90deg);' : ''}"></i>
                            <span class="text-xl shrink-0">${icon}</span>
                            <span class="text-base font-extrabold ${c.t} flex-1 min-w-0 truncate">${escapeHtml(label)}</span>
                            <span class="text-xs font-black ${c.t} opacity-60 shrink-0">${list.length}</span>
                        </button>
                        <div class="${collapsed ? 'hidden' : ''} space-y-3">${cards}</div>
                    </div>`;
            }).join('');
        }

        // [냐냐 요청] 노트 카드 하나 — 그룹 모드·일반 모드가 공유
        //   showTopicBadge: 그룹으로 안 묶일 때(검색·필터 중)만 카드에 주제를 적어준다
        function renderGrammarNoteCard(t, query, showTopicBadge) {
                // [냐냐 요청] 노트 = 블록 목록 — 글 블록과 표 블록을 저장된 순서 그대로 그린다
                const blocksHtml = getNoteBlocks(t)
                    .map(b => b.type === 'text' ? renderNoteTextBlock(b) : renderNoteTableBlock(t, b))
                    .filter(Boolean)
                    .join('');
                // 펼침 상태 유지 (검색 중이면 다 펼침, 아니면 기존 상태/첫번째만)
                const isOpen = query ? true : (pinnedGrammar[t.id] ? true : (grammarOpenState[t.id] !== undefined ? grammarOpenState[t.id] : false));
                const editBtns = `
                    <span class="flex items-center gap-1 shrink-0" onclick="event.stopPropagation();">
                        ${(() => {
                            // [냐냐 요청] 점수를 접은 상태에서도 보이게 — 마스터 체크 바로 왼쪽에.
                            //   펼치면 아래쪽(빈칸 채우기 옆)에도 같은 배지가 있지만, 목록만 훑을 때 점수가 안 보였다
                            const gi = GRADE_INFO[getGrammarGrade(t.id)] || GRADE_INFO.normal;
                            return `<span class="px-1.5 py-0.5 rounded-lg text-[10px] font-black ${gi.badge} select-none shrink-0" title="${gi.label} · 이 노트의 점수 (${SCORE_MIN} ~ ${SCORE_MAX})">${formatGrammarScore(t.id)}</span>`;
                        })()}
                        ${(() => {
                            // [냐냐 요청] 마스터 버튼 3단계 (단어장과 같은 색): 일반 → 마스터 → 완벽
                            const gr = getGrammarGrade(t.id);
                            const cls = gr === 'perfect' ? 'bg-emerald-600 border-2 border-emerald-700 text-white shadow-sm'
                                      : gr === 'mastered' ? 'bg-white border-2 border-emerald-400 text-emerald-500 shadow-sm'
                                      : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50';
                            const tip = gr === 'perfect' ? '마스터 해제' : gr === 'mastered' ? '완벽으로 올리기' : '마스터 표시';
                            return `<button onclick="toggleMasterGrammar('${t.id}')" title="${tip}" class="w-7 h-7 rounded-full flex items-center justify-center transition-all ${cls}"><i class="fa-solid fa-circle-check text-xs"></i></button>`;
                        })()}
                        ${(() => {
                            // [냐냐 요청] 약점 별표 — 단어장과 같은 3단계 순환 (해제 → 약점 → 치명적)
                            const gr = getGrammarGrade(t.id);
                            const cls = gr === 'critical' ? 'text-red-500 bg-red-50'
                                      : gr === 'weak' ? 'text-amber-500 bg-amber-50'
                                      : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50';
                            const tip = gr === 'critical' ? '약점 표시 해제' : gr === 'weak' ? '치명적 약점으로' : '약점으로 표시';
                            return `<button onclick="toggleWeakGrammar('${t.id}', event)" title="${tip}" class="w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${cls}"><i class="fa-solid fa-star text-xs"></i></button>`;
                        })()}
                        <button onclick="togglePinGrammar('${t.id}')" title="${pinnedGrammar[t.id] ? '고정 해제' : '위에 고정 (항상 열림)'}" class="w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${pinnedGrammar[t.id] ? 'text-[#5896cb] bg-blue-50' : 'text-slate-400 hover:text-[#5896cb] hover:bg-blue-50'}"><i class="fa-solid fa-thumbtack text-xs"></i></button>
                        <button onclick="openGrammarEditor('${t.id}')" title="수정" class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"><i class="fa-solid fa-pen text-xs"></i></button>
<!-- [냐냐 요청] 단어 찾기(돋보기)는 표 하나가 아니라 전체에 걸리는 모드라, 카드에서 빼고
                             맨 윗줄 검색창 옆으로 옮겼다 (카드에 있으니 그 표만 켜지는 것처럼 보였다) -->
                        <!-- [냐냐 요청] 연결 상태 색·숫자 배지는 뺐다 — 다른 아이콘들과 같은 모양으로 -->
                        <button onclick="openGrammarWordLinkFor('${t.id}')" title="단어 연결 (표 칸을 단어장과 이어두기)" class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"><i class="fa-solid fa-link text-xs"></i></button>
                        <button onclick="deleteGrammarTable('${t.id}')" title="삭제" class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"><i class="fa-solid fa-trash text-xs"></i></button>
                    </span>`;
                // [냐냐 요청] 배지 대신 카드 테두리·배경색으로 등급 표시 (단어장 카드와 같은 방식)
                const grade = getGrammarGrade(t.id);
                const cardStyle =
                      grade === 'perfect'  ? 'border-2 border-emerald-500 bg-emerald-50/70 shadow-sm'
                    : grade === 'mastered' ? 'border border-emerald-200 bg-emerald-50/30 shadow-xs'
                    : grade === 'critical' ? 'border-2 border-red-300 bg-red-50/60 shadow-xs'
                    : grade === 'weak'     ? 'border-2 border-amber-300 bg-amber-50/50 shadow-xs'
                    :                        'border border-slate-200 shadow-sm bg-white';
                return `
                    <div class="rounded-2xl overflow-hidden ${cardStyle}">
                        <div class="w-full flex items-center justify-between gap-2 px-5 py-2.5">
                            <button type="button" onclick="toggleGrammarTable('${t.id}')" class="flex items-center gap-2.5 min-w-0 text-left flex-1">
                                <!-- [냐냐 요청] 노트 아이콘은 주제 아이콘과 같아서 뺐다 (그룹 헤더에 이미 있음).
                                     그룹으로 안 묶이는 검색·필터 중에만 표시 -->
                                ${showTopicBadge ? `<span class="text-2xl shrink-0">${t.icon || '📋'}</span>` : ''}
                                <div class="min-w-0 flex-1">
                                    <!-- 주제 배지도 마찬가지 -->
                                    ${showTopicBadge && grammarTopicKey(t) !== GRAMMAR_OTHER_TOPIC ? (() => { const c = grammarTopicColor(grammarTopicKey(t)); return `<span class="inline-block mb-1 text-[10px] font-bold ${c.t} ${c.b} px-1.5 py-0.5 rounded-md">${escapeHtml(grammarTopicLabel(grammarTopicKey(t)))}</span>`; })() : ''}
                                    <div class="flex items-center gap-1.5 min-w-0">
                                        <!-- [냐냐 요청] 제목은 살짝 연한 회색 (주제 줄이 강조라 노트 제목까지 새까맣면 무거움) -->
                                        <span class="font-extrabold text-slate-600 text-sm truncate">${escapeHtml(t.title || '(제목 없음)')}</span>
                                    </div>
                                </div>
                            </button>
                            ${editBtns}
                            <i class="fa-solid fa-chevron-down text-slate-400 text-xs transition-transform shrink-0 cursor-pointer" data-grammar-chevron="${t.id}" onclick="toggleGrammarTable('${t.id}')" style="${isOpen ? 'transform:rotate(180deg);' : ''}"></i>
                        </div>
                        <div class="${isOpen ? '' : 'hidden'} px-5 pb-5 space-y-3" data-grammar-body="${t.id}">
                            ${blocksHtml}
                            <!-- [냐냐 요청] 읽다가 바로 연습으로 이어가기 (헤더 아이콘이 많아서 여기에 둠) -->
                            <div class="flex items-center gap-2 pt-1">
                                <button type="button" onclick="startTranslationWithGrammar('${t.id}')" class="flex-1 py-2 rounded-xl border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-bold transition-all active:scale-95">
                                    <i class="fa-solid fa-pen-nib mr-1"></i> 이 문법으로 번역 연습
                                </button>
                                <button type="button" onclick="startGrammarFillForTable('${t.id}')" class="flex-1 py-2 rounded-xl border border-[#c3d9ec] bg-[#eef5fb] hover:bg-[#dfeaf6] text-[#2c5578] text-xs font-bold transition-all active:scale-95">
                                    <i class="fa-solid fa-table-cells mr-1"></i> 빈칸 채우기
                                </button>
                                <!-- [냐냐 요청] 이 노트의 점수 — 단어 카드의 점수 배지와 같은 색·같은 척도 -->
                                ${(() => {
                                    const gi = GRADE_INFO[getGrammarGrade(t.id)] || GRADE_INFO.normal;
                                    return `<span class="shrink-0 px-2.5 py-2 rounded-xl text-[11px] font-black ${gi.badge} select-none" title="${gi.label} · 이 노트의 점수 (${SCORE_MIN} ~ ${SCORE_MAX})">${formatGrammarScore(t.id)}</span>`;
                                })()}
                            </div>
                        </div>
                    </div>
                `;
        }

        // [냐냐 요청] 조회 화면 — 글 블록
        //   style:'tip' 이면 예전 '표 아래 노트'처럼 💡 회색 상자로, 아니면 그냥 본문으로
        function renderNoteTextBlock(b) {
            if (!b.html || !richTextToPlain(b.html)) return '';
            if (b.style === 'tip') {
                return `<div class="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2.5 flex gap-2"><span class="shrink-0">💡</span><span class="nyanya-rt flex-1">${renderRichText(b.html)}</span></div>`;
            }
            return `<div class="nyanya-rt text-sm text-slate-800">${renderRichText(b.html)}</div>`;
        }

        // [냐냐 요청] 조회 화면 — 표 블록 (헤더 여러 줄 + 병합 + 칸/열 강조)
        function renderNoteTableBlock(t, b) {
            if (!tableBlockHasContent(b)) return '';   // 빈 표는 안 그림
            const cellHl = noteCellHighlights(t.id, b.id);   // {"행-열": true}
            const hlCols = b.highlightCols || [0];           // 열 강조 (글씨체)
            // 헤더 줄끼리 색 차이는 두지 않는다 — 전부 같은 파랑 + 흰 글씨, 층은 칸 테두리로만 구분
            const hMerges = b.headerMerges || {};
            const hHidden = buildMergeHidden(hMerges);
            const headerRow = (b.headerRows || []).map((hr, hi) => {
                const cells = hr.map((h, ci) => {
                    if (hHidden.has(`${hi}-${ci}`)) return '';
                    const mg = hMerges[`${hi}-${ci}`];
                    const cs = mg ? Math.max(1, mg.cs || 1) : 1;
                    const rs = mg ? Math.max(1, mg.rs || 1) : 1;
                    const spanAttr = `${cs > 1 ? ` colspan="${cs}"` : ''}${rs > 1 ? ` rowspan="${rs}"` : ''}`;
                    return `<th class="text-center px-3 py-2.5 text-sm font-black align-middle border text-white bg-[#649fd0] border-[#5590c2]"${spanAttr}>${escapeHtml(h)}</th>`;
                }).join('');
                return cells ? `<tr>${cells}</tr>` : '';
            }).join('');
            // 셀 병합 — 대표 칸만 rowspan/colspan 으로 그리고 덮인 칸은 건너뜀
            const tMerges = b.merges || {};
            const tHidden = buildMergeHidden(tMerges);
            const bodyRows = (b.rows || []).map((r, ri) => {
                // 행마다 번갈아 배경색 (줄무늬) — 부드러운 파랑
                const rowBg = ri % 2 === 0 ? 'bg-white' : 'bg-[#f3f8fd]';
                const cells = (r || []).map((c, ci) => {
                    if (tHidden.has(`${ri}-${ci}`)) return '';
                    const mg = tMerges[`${ri}-${ci}`];
                    const cs = mg ? Math.max(1, mg.cs || 1) : 1;
                    const rs = mg ? Math.max(1, mg.rs || 1) : 1;
                    const spanAttr = `${cs > 1 ? ` colspan="${cs}"` : ''}${rs > 1 ? ` rowspan="${rs}"` : ''}`;
                    const cellBg = cellHl[`${ri}-${ci}`] ? 'bg-[#ffe0ec]' : '';
                    const colHl = hlCols.includes(ci) ? 'text-violet-600 font-extrabold' : 'text-slate-800 font-bold';
                    // 🔍 단어 찾기 모드: 셀 안의 스페인어 단어마다 밑줄 + 클릭 가능
                    const cellContent = grammarWordLookupMode ? buildLookupCellHtml(c || '') : escapeHtml(c || '');
                    // [냐냐 요청] 표 안에는 연결 표시를 하지 않는다 (밑줄도 점도 없앰).
                    //   노트 카드의 연결 아이콘으로 상태를 보고, 어느 칸인지는 연결창의 표
                    //   미리보기가 색으로 보여준다. 표 자체는 깔끔하게 둔다.
                    //   툴팁은 남겨서 칸에 올리면 어떤 단어인지는 알 수 있다.
                    const linked = getCellWord(t.id, b.id, ri, ci);
                    let cellTitle = '';
                    if (linked && !grammarWordLookupMode) {
                        // 따옴표까지 막아야 뜻에 " 가 들어가도 속성이 안 깨진다
                        const tip = `단어장 연결: ${linked.word}${linked.meaning ? ' — ' + linked.meaning : ''}`;
                        cellTitle = ` title="${escapeHtml(tip).replace(/"/g, '&quot;')}"`;
                    }
                    return `<td class="px-3 py-2 text-sm text-center align-middle border border-[#c3d9ec] ${colHl} ${cellBg}"${spanAttr}${cellTitle}>${cellContent}</td>`;
                }).join('');
                return `<tr class="${rowBg} hover:bg-[#fff8dd] transition-colors">${cells}</tr>`;
            }).join('');
            return `<div class="overflow-x-auto rounded-xl border border-[#c3d9ec]">
                <table class="w-full ny-gtable">
                    ${headerRow ? `<thead>${headerRow}</thead>` : ''}
                    <tbody>${bodyRows}</tbody>
                </table>
            </div>`;
        }

        // ============================================================
        // [냐냐 요청] '사람이 칠 수 없는 것' 규칙은 여기 한 곳에만 둔다.
        //   채점(normalizeSpanishAnswer)과 오답 설명(typeableForm)이 반드시 같은 규칙을 써야 한다.
        //   예전엔 각자 정규식을 들고 있다가 관사 규칙이 한쪽만 바뀌어서,
        //   'el agua' 에 'aqua' 를 쓴 오타가 '아예 다른 단어'로 잡힌 적이 있다.
        // ============================================================
        const RE_PLACEHOLDER = /[\[\(（【][^\]\)）】]*[\]\)）】]/g;      // "antes de [명사/동사원형]" 의 대괄호 뭉치
        const RE_HANGUL = /[ㄱ-ㅎㅏ-ㅣ가-힣]/g;                        // 답에 한글이 섞일 일은 없다
        const RE_LEADING_ARTICLE = /^(el\/la|los\/las|un\/una|unos\/unas|el|la|los|las|un|una|unos|unas)\s+/i;

        // ============================================================
        // [냐냐 요청] 틀렸을 때 "왜" 틀렸는지 짚어준다. 퀴즈·쓰기 복습·단어 빈칸이 같이 쓴다.
        //   · 철자만 틀렸으면 → 틀린 자리만 빨갛게 (내가 쓴 답 / 정답 양쪽)
        //   · 아예 다른 진짜 단어를 썼으면 → 그 단어의 뜻을 알려준다
        //   · 없는 단어면 → 없는 단어라고 알려준다
        // ============================================================
        // 문자 단위 LCS — 어디가 다른지 표시하려고. 대소문자는 무시하고 비교하되 원래 글자를 그대로 보여준다.
        //   'same' 양쪽에 다 있음 / 'del' 내가 쓴 답에만 있음(틀리게 씀) / 'ins' 정답에만 있음(빠뜨림)
        function charDiffOps(aRaw, bRaw) {
            const a = [...String(aRaw || '')], b = [...String(bRaw || '')];
            const ka = a.map(c => c.toLowerCase()), kb = b.map(c => c.toLowerCase());
            const n = a.length, m = b.length;
            if (n * m > 40000) return [['del', String(aRaw || '')], ['ins', String(bRaw || '')]]; // 안전장치
            const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
            for (let i = n - 1; i >= 0; i--) {
                for (let j = m - 1; j >= 0; j--) {
                    dp[i][j] = (ka[i] === kb[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
                }
            }
            const ops = [];
            let i = 0, j = 0;
            while (i < n && j < m) {
                if (ka[i] === kb[j]) { ops.push(['same', a[i]]); i++; j++; }
                else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push(['del', a[i]]); i++; }
                else { ops.push(['ins', b[j]]); j++; }
            }
            while (i < n) ops.push(['del', a[i++]]);
            while (j < m) ops.push(['ins', b[j++]]);
            return ops;
        }
        // side 'user' = 내가 쓴 답(틀린 글자 빨강) / 'correct' = 정답(빠뜨린 글자 빨강)
        function renderCharDiff(ops, side) {
            const mark = (side === 'user') ? 'del' : 'ins';
            return ops.filter(([t]) => t === 'same' || t === mark)
                .map(([t, ch]) => t === 'same'
                    ? escapeHtml(ch)
                    : `<span class="bg-rose-200 text-rose-700 rounded-[3px] px-[1px]">${escapeHtml(ch)}</span>`)
                .join('');
        }
        // 단어장에서 이 답의 뜻을 찾아본다 (없으면 null)
        function lookupAnswerMeaning(raw) {
            if (typeof vocabulary === 'undefined' || !raw) return null;
            const n = (typeof normalizeSpanishAnswer === 'function') ? normalizeSpanishAnswer(raw) : String(raw).toLowerCase().trim();
            if (!n) return null;
            let hit = vocabulary.find(w => ((typeof normalizeSpanishAnswer === 'function') ? normalizeSpanishAnswer(w.word) : String(w.word).toLowerCase()) === n);
            if (!hit && typeof findVocabWordByForm === 'function') hit = findVocabWordByForm(raw);
            return (hit && hit.meaning) ? hit.meaning : null;
        }
        // 사람이 칠 수 있는 형태만 남긴다 — 자리표시자 대괄호·괄호와 한글은 뺀다.
        //   (악센트·대소문자·문장부호는 그대로. 철자를 짚어주려면 원형이 필요하다)
        //   "después de [명사/동사원형]" → "después de" · "el/la joven" → "joven"
        //   ⚠️ 문장부호도 뺀다. 채점이 기호를 통째로 무시하므로(normalizeSpanishAnswer),
        //      남겨두면 안 쳐도 되는 마침표가 '빠뜨린 글자'로 빨갛게 칠해진다.
        function typeableForm(s) {
            return String(s || '')
                .replace(RE_PLACEHOLDER, ' ')
                .replace(RE_HANGUL, ' ')
                .replace(/\s+/g, ' ').trim()
                .replace(RE_LEADING_ARTICLE, '')
                .replace(/[^\p{L}\p{N}\s]/gu, ' ')
                .replace(/\s+/g, ' ').trim();
        }
        // [냐냐 요청] '철자를 흘린 것'인가, '아예 다른 단어'인가.
        //   설명 문구를 고르는 데도, 단어 빈칸에서 틀린 글자를 칠할지 정하는 데도 같은 잣대를 쓴다.
        //   ⚠️ 거리는 악센트를 세는 쪽으로 재야 한다. normalizeSpanishAnswer 는 악센트를 떼기 때문에
        //      despues vs después 가 거리 0이 되어 '아예 다른 단어' 쪽으로 새어나갔다.
        function looksLikeSpellMiss(userRaw, correctRaw) {
            const user = String(userRaw || '').trim();
            const target = typeableForm(correctRaw) || String(correctRaw || '');
            if (!user || !target) return false;
            const norm = (s) => (typeof normalizeSpanishAnswer === 'function') ? normalizeSpanishAnswer(s) : String(s).toLowerCase().trim();
            const soft = (s) => String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
            if (soft(user) === soft(target)) return false;          // 아예 같으면 틀린 게 아니다
            if (!!norm(user) && norm(user) === norm(target)) return true;   // 악센트만 다름
            const dist = (typeof levenshtein === 'function') ? levenshtein(soft(user), soft(target)) : 99;
            // 정답 길이의 절반 안쪽으로 다르면 '철자를 틀린 것'으로 본다
            return dist > 0 && dist <= Math.max(1, Math.min(3, Math.floor(soft(target).length / 2)));
        }
        // opts: { aiIsRealWord: bool|undefined, aiMeaning: string, comment: string }
        function buildWrongAnswerHtml(userRaw, correctRaw, opts = {}) {
            const user = String(userRaw || '').trim();
            const correct = String(correctRaw || '');
            const target = typeableForm(correct) || correct;   // 철자 비교는 칠 수 있는 형태로
            if (!user) return `✏️ 정답은 <b>${escapeHtml(correct)}</b> 예요.`;

            if (looksLikeSpellMiss(user, correct)) {
                const ops = charDiffOps(typeableForm(user) || user, target);
                return `
                    <div class="space-y-1.5 text-left">
                        <p class="font-black text-rose-500">✏️ 철자가 틀렸어요</p>
                        <div class="flex items-baseline gap-2">
                            <span class="text-[10px] font-bold text-slate-400 shrink-0 w-11">내 답</span>
                            <span class="font-bold text-slate-600 break-words">${renderCharDiff(ops, 'user')}</span>
                        </div>
                        <div class="flex items-baseline gap-2">
                            <span class="text-[10px] font-bold text-slate-400 shrink-0 w-11">정답</span>
                            <span class="font-black text-slate-800 break-words">${renderCharDiff(ops, 'correct')}</span>
                        </div>
                    </div>`;
            }

            // 아예 다른 단어 — 단어장에 있으면 그 뜻을, 없으면 AI 판단을 쓴다
            const known = lookupAnswerMeaning(user);
            const meaning = known || (opts.aiMeaning || '').trim();
            const isReal = known ? true : (opts.aiIsRealWord === true);
            // 받침에 따라 '이라는/라는' — "'개'이라는" 처럼 나오면 안 되니까
            const josa = (str) => {
                const c = String(str || '').charCodeAt(String(str).length - 1);
                const hasBatchim = c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 !== 0;
                return hasBatchim ? '이라는' : '라는';
            };
            const head = isReal && meaning
                ? `❌ <b>${escapeHtml(user)}</b>는 <b class="text-slate-800">'${escapeHtml(meaning)}'</b>${josa(meaning)} 뜻이에요.`
                : (opts.aiIsRealWord === false
                    ? `❌ <b>${escapeHtml(user)}</b>는 없는 단어예요.`
                    : `❌ <b>${escapeHtml(user)}</b>는 답이 아니에요.`);
            return `
                <div class="space-y-1 text-left">
                    <p class="font-bold text-rose-500">${head}</p>
                    <p class="font-bold text-slate-600">정답은 <b class="text-slate-900">${escapeHtml(correct)}</b> 예요.</p>
                    ${(opts.comment && !(isReal && meaning)) ? `<p class="text-slate-400 font-semibold">${escapeHtml(opts.comment)}</p>` : ''}
                </div>`;
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
            saveGrammarFilterPrefs();   // [냐냐 요청] 열어둔 노트도 기억
        }

        function expandAllGrammar(open) {
            getAllGrammarTables().forEach(t => { grammarOpenState[t.id] = open; });
            grammarViewMode = open ? 'all-open' : 'default';
            if (open) grammarGroupCollapsed = {};   // 다 펼칠 땐 접힌 주제도 열어준다
            saveGrammarFilterPrefs();
            renderGrammarTables();
        }

        // ============================================================
        // [냐냐 요청] ⤢ 버튼 3단계 순환 — 접힌 데서 시작해 점점 펼쳐진다
        //   default    : 주제까지 다 접힘 (주제 줄만 = 목차)  ← 기본
        //   topics-open: 주제 펼침 (노트 제목 나열, 상세는 접힘)
        //   all-open   : 노트 상세까지 전부 펼침
        // ============================================================
        let grammarViewMode = 'default';
        // 기본이 '주제까지 접힘'이라, 처음 열 때 모든 주제를 접어둔다
        // [냐냐 요청] 들어올 때 항상 같은 모습으로 시작한다:
        //   주제로 묶여 있고 · 주제별 노트 제목까지 펼쳐져 있고 · 가나다순.
        //   (예전엔 주제까지 접어서 목차만 보여줬다)
        function initGrammarGroupsCollapsed() {
            grammarGroupCollapsed = {};          // 주제는 펼친 채로 = 노트 제목이 보인다
            grammarViewMode = 'topics-open';     // 전체 펼치기 버튼의 3단계 중 가운데
            grammarGroupView = 'group';          // 주제로 묶기
            grammarSortMode = 'alpha-asc';       // 가나다순
            getAllGrammarTables().forEach(t => { grammarOpenState[t.id] = false; });   // 노트 상세는 접힘
        }
        function toggleExpandAllGrammar() {
            if (grammarViewMode === 'default') {
                // → 주제 펼치기 (노트 제목까지)
                getAllGrammarTables().forEach(t => { grammarOpenState[t.id] = false; });
                grammarGroupCollapsed = {};
                grammarViewMode = 'topics-open';
            } else if (grammarViewMode === 'topics-open') {
                // → 노트 상세까지 전부 펼치기
                getAllGrammarTables().forEach(t => { grammarOpenState[t.id] = true; });
                grammarGroupCollapsed = {};
                grammarViewMode = 'all-open';
            } else {
                // → 기본 (주제까지 다 접기 = 목차만 보임)
                //   예전엔 여기서 initGrammarGroupsCollapsed 를 불러서 정렬·보기까지 되돌렸고,
                //   그 함수가 주제를 오히려 펼쳐놔서 '전부 접기' 가 안 먹었다. 접는 일만 한다.
                getAllGrammarTables().forEach(t => { grammarOpenState[t.id] = false; });
                grammarGroupCollapsed = {};
                getAllGrammarTables().forEach(t => { grammarGroupCollapsed[grammarTopicKey(t)] = true; });
                grammarViewMode = 'default';
            }
            saveGrammarFilterPrefs();
            renderGrammarTables();
        }
        function syncGrammarExpandBtn() {
            const btn = document.getElementById('grammar-expand-all-btn');
            if (!btn) return;
            const info = {
                'default':     { tip: '주제 펼치기 (노트 제목 보기)', icon: 'fa-solid fa-list' },
                'topics-open': { tip: '노트 내용까지 전부 펼치기',    icon: 'fa-solid fa-up-right-and-down-left-from-center' },
                'all-open':    { tip: '전부 접기 (주제만 보기)',      icon: 'fa-solid fa-down-left-and-up-right-to-center' }
            }[grammarViewMode] || {};
            btn.title = info.tip || '전체 펼치기';
            const icon = btn.querySelector('i');
            if (icon && info.icon) icon.className = info.icon;
        }

        // [냐냐 요청] 문법 목록 새로고침 (점수·약점 변동 반영) — 단어장 새로고침과 같은 역할
        function refreshGrammarList() {
            const icon = document.getElementById('grammar-refresh-icon');
            if (icon) { icon.classList.add('animate-spin'); setTimeout(() => icon.classList.remove('animate-spin'), 500); }
            renderGrammarTables();
            if (typeof updateStats === 'function') updateStats();
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
        // [냐냐 요청] 약점 문법표(별표) 수동 토글 — 단어의 toggleWeakWord 와 같은 3단계 순환
        //   해제 → 약점(-4.5) → 치명적 약점(-8) → 해제(0)
        function toggleWeakGrammar(id, event) {
            if (event) event.stopPropagation();
            const t = getAllGrammarTables().find(x => x.id === id);
            const title = t ? (t.title || '이 표') : '이 표';
            const grade = getGrammarGrade(id);
            if (grade === 'critical') {
                setGrammarScore(id, 0);
                showToast(`"${title}" 약점 표시를 해제했어요`, "info");
            } else if (grade === 'weak') {
                setGrammarScore(id, SCORE_CRITICAL);
                showToast(`"${title}" 치명적 약점으로 표시했어요 🟥`, "success");
            } else {
                setGrammarScore(id, SCORE_WEAK);
                showToast(`"${title}" 약점 문법표로 표시했어요 🟨`, "success");
            }
            if (typeof logAction === 'function') logAction('snapshot');
            renderGrammarTables();
            saveToStorage();
        }

        // [냐냐 요청] 수동 마스터 버튼 — 단어의 별표처럼 '점수를 못박는' 방식으로 통합
        //   마스터로 박으면 점수를 기준선(+4.5)까지 올리고 마스터 자격도 같이 준다.
        //   해제하면 점수를 0으로 되돌린다 (계속 쌓인 기록이 아니라 '내가 정한 상태'라서)
        function toggleMasterGrammar(id) {
            // [냐냐 요청] 단어 마스터 버튼과 똑같은 3단계 순환
            //   해제 → 마스터(+4.5) → 완벽(+8) → 해제(0)
            const t = getAllGrammarTables().find(x => x.id === id);
            const title = t ? (t.title || '이 표') : '이 표';
            const grade = getGrammarGrade(id);
            if (grade === 'perfect') {
                setGrammarScore(id, 0);
                delete grammarTransUsed[id];
                showToast(`"${title}" 마스터를 해제했어요`, "info");
            } else if (grade === 'mastered') {
                setGrammarScore(id, SCORE_PERFECT, { transUsed: true });   // 8점
                if (typeof AudioFX !== 'undefined') AudioFX.playBell();
                showToast(`"${title}" 완벽으로 올렸어요! 🏆 (8점)`, "success");
            } else {
                setGrammarScore(id, SCORE_MASTER, { transUsed: true });    // 4.5점
                if (typeof AudioFX !== 'undefined') AudioFX.playBell();
                showToast(`"${title}" 마스터 완료! ✅ (4.5점)`, "success");
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
        // 이미 고른 기준을 또 누르면 오름/내림 전환, 아니면 그 기준의 기본 방향 (단어장과 같은 규칙)
        function setGrammarFilterSort(btn) {
            const key = btn.dataset.gsort;
            pendingGrammarSort = (GSORT_KEY_OF[pendingGrammarSort] === key)
                ? GSORT_FLIP_OF[pendingGrammarSort]
                : GSORT_DEFAULT_OF[key];
            renderGrammarSortButtons();
        }

        // 정렬 버튼 라벨(↓↑)과 활성 상태 다시 그리기
        function renderGrammarSortButtons() {
            const activeKey = GSORT_KEY_OF[pendingGrammarSort];
            document.querySelectorAll('.grammar-sort-btn').forEach(b => {
                const key = b.dataset.gsort;
                const on = (key === activeKey);
                b.innerText = on ? GSORT_BTN_LABEL[pendingGrammarSort] : GSORT_BASE_LABEL[key];
                styleFilterPill(b, on);
            });
        }

        function syncGrammarFilterPanelUI() {
            pendingGrammarTopics = [...grammarFilterTopics];
            pendingGrammarMastery = grammarFilterMastery;
            pendingGrammarSort = grammarSortMode;
            renderGrammarTopicFilterButtons();
            document.querySelectorAll('.grammar-mastery-btn').forEach(b => styleFilterPill(b, b.dataset.gmastery === pendingGrammarMastery));
            renderGrammarSortButtons();
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
            else if (grammarFilterMastery === 'weak') chips.push('약점만');
            const sortLabel = { newest: '최신순', oldest: '오래된순', 'alpha-asc': '가나다순', 'alpha-desc': '가나다 역순' }[grammarSortMode] || '가나다순';
            const filterPart = chips.length > 0
                ? chips.map(c => `<span class="bg-violet-50 text-violet-600 font-bold px-2 py-0.5 rounded-full">${escapeHtml(c)}</span>`).join('')
                : `<span class="text-slate-400">전체 표</span>`;
            box.innerHTML = `<i class="fa-solid fa-filter text-[9px]"></i>${filterPart}<span class="text-slate-300">·</span><span class="text-slate-500">${sortLabel}</span>`;
        }
        function saveGrammarFilterPrefs() {
            try {
                localStorage.setItem('demo_grammar_filters', JSON.stringify({
                    topics: grammarFilterTopics, mastery: grammarFilterMastery, sort: grammarSortMode, view: grammarGroupView,
                    // [냐냐 요청] 마지막에 보던 모습까지 기억 — 펼침 단계 · 접어둔 주제 · 열어둔 노트
                    expand: grammarViewMode, groups: grammarGroupCollapsed, open: grammarOpenState
                }));
            } catch (e) {}
        }
        function loadGrammarFilterPrefs() {
            try {
                const raw = localStorage.getItem('demo_grammar_filters');
                if (!raw) return;
                const f = JSON.parse(raw);
                if (Array.isArray(f.topics)) grammarFilterTopics = f.topics;
                if (f.mastery) grammarFilterMastery = f.mastery;
                if (f.view === 'list' || f.view === 'group') grammarGroupView = f.view;
                // 예전에 저장해둔 값('topic' 등 지금은 없는 것)이 남아 있으면 기본(가나다순)으로
                if (f.sort) grammarSortMode = GSORT_KEY_OF[f.sort] ? f.sort : 'alpha-asc';
                // [냐냐 요청] 마지막에 보던 모습 복원 — 펼침 단계 · 접어둔 주제 · 열어둔 노트
                if (['default', 'topics-open', 'all-open'].includes(f.expand)) grammarViewMode = f.expand;
                if (f.groups && typeof f.groups === 'object') grammarGroupCollapsed = f.groups;
                if (f.open && typeof f.open === 'object') grammarOpenState = f.open;
            } catch (e) {}
        }

        // ---- 문법 표 편집기 ----
        let grammarEditorState = null; // { id, icon, title, desc, note, headers:[], rows:[[]] }

        // [냐냐 PATCH] 편집창(등록/수정) 너비 드래그 조절 — 열이 많은 표를 넓게 보기 위함. 조회 화면과 무관.
        let grammarEditorWidth = null; // px (null=기본 672)
        let _geResize = null;
        function loadGrammarEditorWidth() {
            try {
                const v = parseInt(localStorage.getItem('demo_grammar_editor_width') || '', 10);
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
            try { if (grammarEditorWidth) localStorage.setItem('demo_grammar_editor_width', String(grammarEditorWidth)); } catch (e) {}
        }

        function openGrammarEditor(id) {
            if (id) {
                const existing = getAllGrammarTables().find(t => t.id === id);
                // [냐냐 요청] 옛 구조(desc/표/note)는 getNoteBlocks 가 블록으로 승격해 준다
                grammarEditorState = JSON.parse(JSON.stringify({
                    id: existing.id,
                    icon: existing.icon || '📋',
                    title: existing.title || '',
                    blocks: getNoteBlocks(existing),
                    _isBaseId: !!GRAMMAR_TABLES.find(b => b.id === existing.id)
                }));
                if (!grammarEditorState.blocks.length) grammarEditorState.blocks = [emptyTableBlock()];
            } else {
                grammarEditorState = {
                    id: 'custom-' + Date.now(),
                    icon: '📋',
                    title: '',
                    blocks: [emptyTextBlock('plain'), emptyTableBlock()],
                    _isBaseId: false
                };
            }
            geOpenBlocks = {};   // 접기 상태는 열 때마다 초기화 (전부 펼침)
            document.getElementById('grammar-editor-modal').classList.remove('hidden');
            applyGrammarEditorWidth(); // [냐냐 PATCH] 저장된/기본 너비 적용
            document.getElementById('grammar-editor-title').innerText = id ? '내용 수정' : '새로 만들기';
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

        // ============================================================
        // [냐냐 요청] 편집기 = 블록 목록 — 글 블록과 표 블록을 추가·삭제·순서 변경
        //   ⚠️ 표를 건드릴 때마다 전체를 다시 그리면 글 블록의 커서가 날아간다.
        //      그래서 표 조작은 renderGeTableGrid(블록번호) 로 그 블록만 다시 그린다.
        // ============================================================
        let geOpenBlocks = {};   // 블록id → 펼침 여부 (없으면 펼친 것으로 봄)

        function geBlock(bi) {
            const s = grammarEditorState;
            return (s && s.blocks && s.blocks[bi]) ? s.blocks[bi] : null;
        }
        function geBlockOpen(id) { return geOpenBlocks[id] !== false; }
        function toggleGeBlock(id) { geOpenBlocks[id] = !geBlockOpen(id); renderGeBlocks(); }

        function renderGrammarEditorFields() {
            const s = grammarEditorState;
            if (!s) return;
            renderGeIconPicker(s.icon || '📘'); // [냐냐 PATCH] 주제 콤보박스 채우고 현재 값 선택
            document.getElementById('ge-title').value = s.title;
            renderGeBlocks();
        }

        // 서식 도구 모음 — 글 블록마다 하나씩 만들어 준다 (id 만 다름)
        function geRtToolbar(id) {
            const b = (fn, title, inner, cls) =>
                `<button type="button" onmousedown="event.preventDefault()" onclick="${fn}" title="${title}" class="${cls || 'w-7 h-7 rounded-lg text-slate-600 hover:bg-white hover:text-violet-600 font-black text-xs transition-all'}">${inner}</button>`;
            const sep = '<span class="w-px h-4 bg-slate-200 mx-0.5"></span>';
            const ico = 'w-7 h-7 rounded-lg hover:bg-white transition-all flex items-center justify-center';
            return `<div class="flex items-center gap-1 flex-wrap bg-slate-50 border border-slate-200 rounded-xl px-1.5 py-1">
                ${b(`rtExec('${id}','bold')`, '굵게', 'B')}
                ${b(`rtExec('${id}','italic')`, '기울임', 'I', 'w-7 h-7 rounded-lg text-slate-600 hover:bg-white hover:text-violet-600 font-black text-xs italic transition-all')}
                ${b(`rtHighlight('${id}')`, '형광펜', '<i class="fa-solid fa-highlighter text-[11px] text-amber-500"></i>', ico)}
                ${b(`rtRed('${id}')`, '빨간 글씨', '<i class="fa-solid fa-pen text-[11px] text-red-500"></i>', ico)}
                ${b(`rtBlue('${id}')`, '파란 글씨', '<i class="fa-solid fa-pen text-[11px] text-blue-600"></i>', ico)}
                ${b(`rtHeading('${id}')`, '소제목', 'H', 'w-7 h-7 rounded-lg text-slate-600 hover:bg-white hover:text-violet-600 font-black text-[11px] transition-all')}
                ${sep}
                ${b(`rtToggleList('${id}')`, '글머리 기호 넣기/빼기', '<i class="fa-solid fa-list-ul text-[11px] text-slate-600"></i>', ico)}
                ${b(`rtOutdent('${id}')`, '수준 올리기 (Shift+Tab)', '<i class="fa-solid fa-outdent text-[11px] text-slate-600"></i>', ico)}
                ${b(`rtIndent('${id}')`, '수준 내리기 (Tab)', '<i class="fa-solid fa-indent text-[11px] text-slate-600"></i>', ico)}
                ${sep}
                ${b(`rtClearFormat('${id}')`, '서식 지우기', '<i class="fa-solid fa-eraser text-[11px] text-slate-400"></i>', ico)}
                ${sep}
                ${b(`rtInsertLabel('${id}','ej.')`, '예시 표시 넣기', 'ej.', 'h-7 px-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-violet-600 font-black text-[11px] transition-all')}
                ${b(`rtInsertLabel('${id}','Q.')`, '질문 표시 넣기', 'Q.', 'h-7 px-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-violet-600 font-black text-[11px] transition-all')}
                ${b(`rtInsertLabel('${id}','A.')`, '답 표시 넣기', 'A.', 'h-7 px-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-violet-600 font-black text-[11px] transition-all')}
                ${sep}
                <!-- [냐냐 요청] 자판으로 치기 번거로운 기호 -->
                ${RT_SYMBOLS.map(s => b(`rtInsertSymbol('${id}','${s.ch}')`, s.title + ' 넣기', s.ch,
                    'w-7 h-7 rounded-lg text-slate-600 hover:bg-white hover:text-violet-600 font-black text-sm transition-all')).join('')}
            </div>`;
        }

        function renderGeBlocks() {
            const s = grammarEditorState;
            const box = document.getElementById('ge-blocks');
            if (!s || !box) return;
            const total = s.blocks.length;
            box.innerHTML = s.blocks.map((b, bi) => {
                const open = geBlockOpen(b.id);
                const isText = b.type === 'text';
                const label = isText ? (b.style === 'tip' ? '💡 팁 상자' : '📝 글') : '📋 표';
                // 접었을 때만 미리보기를 보여준다 (펼친 채로 타이핑하면 미리보기가 옛 내용으로 남으니까)
                const preview = open ? '' : escapeHtml(geBlockPreview(b));
                const inner = isText ? `
                    ${geRtToolbar('ge-rt-' + bi)}
                    <div id="ge-rt-${bi}" contenteditable="true" spellcheck="false"
                        data-placeholder="내용을 자유롭게 적어보세요"
                        onkeydown="rtKeydown(event,'ge-rt-${bi}')" onpaste="rtPaste(event,'ge-rt-${bi}')" oninput="rtSyncState('ge-rt-${bi}')"
                        onclick="rtEditorClick(event,'ge-rt-${bi}')" title="Ctrl+클릭으로 줄을 여러 개 고를 수 있어요"
                        class="nyanya-rt-edit w-full bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 text-sm"></div>` : `
                    <div class="flex justify-end gap-1">
                        <!-- [냐냐 요청] 이 표의 칸을 단어장 단어에 이어두는 화면 (이어둔 칸만 빈칸 채점에서 단어 점수를 받음) -->
                        <button type="button" onclick="openGrammarWordLink(${bi})" title="표 칸을 단어장 단어와 이어두기 — 단어 시험처럼 외우는 표에 쓰세요" class="mr-auto text-[11px] font-bold bg-violet-50 text-violet-600 px-2 py-1 rounded-lg hover:bg-violet-100"><i class="fa-solid fa-link"></i> 단어 연결</button>
                        <button type="button" onclick="addGeHeaderRow(${bi})" title="헤더 줄을 맨 위에 추가 (최대 3줄)" class="text-[11px] font-bold bg-[#e8f2fb] text-[#2c5578] px-2 py-1 rounded-lg hover:bg-[#d8e9f7]"><i class="fa-solid fa-plus"></i> 헤더줄</button>
                        <button type="button" onclick="addGeColumn(${bi})" class="text-[11px] font-bold bg-violet-50 text-violet-600 px-2 py-1 rounded-lg hover:bg-violet-100"><i class="fa-solid fa-plus"></i> 열</button>
                        <button type="button" onclick="removeGeColumn(${bi})" class="text-[11px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-lg hover:bg-slate-200"><i class="fa-solid fa-minus"></i> 열</button>
                    </div>
                    <div id="ge-grid-${bi}" class="overflow-x-auto"></div>
                    <button type="button" onclick="addGeRow(${bi})" class="w-full py-2 border border-dashed border-slate-300 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 hover:border-violet-300 transition-all"><i class="fa-solid fa-plus mr-1"></i> 행 추가</button>`;
                return `
                <div class="border border-slate-200 rounded-2xl overflow-hidden">
                    <div class="flex items-center gap-1 px-2 py-1.5 bg-slate-50 border-b border-slate-200">
                        <button type="button" onclick="toggleGeBlock('${b.id}')" class="flex items-center gap-2 min-w-0 flex-1 text-left">
                            <i class="fa-solid fa-chevron-down text-slate-400 text-[10px] transition-transform" style="${open ? 'transform:rotate(180deg);' : ''}"></i>
                            <span class="text-xs font-extrabold text-slate-600 shrink-0">${label}</span>
                            <span class="text-[11px] text-slate-400 truncate">${preview}</span>
                        </button>
                        ${isText ? `<button type="button" onclick="toggleGeTextStyle(${bi})" title="${b.style === 'tip' ? '보통 글로 바꾸기' : '💡 팁 상자로 바꾸기'}" class="w-6 h-6 rounded text-[11px] ${b.style === 'tip' ? 'bg-amber-100' : 'opacity-30 hover:opacity-100'}">💡</button>` : ''}
                        <button type="button" onclick="moveGeBlock(${bi}, -1)" title="블록 위로" class="w-6 h-6 rounded text-slate-400 hover:text-violet-600 ${bi === 0 ? 'invisible' : ''}"><i class="fa-solid fa-chevron-up text-[10px]"></i></button>
                        <button type="button" onclick="moveGeBlock(${bi}, 1)" title="블록 아래로" class="w-6 h-6 rounded text-slate-400 hover:text-violet-600 ${bi === total - 1 ? 'invisible' : ''}"><i class="fa-solid fa-chevron-down text-[10px]"></i></button>
                        <button type="button" onclick="removeGeBlock(${bi})" title="이 블록 삭제" class="w-6 h-6 rounded text-slate-400 hover:text-red-500"><i class="fa-solid fa-trash text-[10px]"></i></button>
                    </div>
                    <div class="${open ? '' : 'hidden'} p-2 space-y-2">${inner}</div>
                </div>`;
            }).join('');

            // 글 블록 내용은 innerHTML 로 넣어야 서식이 살아난다 (문자열 템플릿에 넣으면 escape 문제가 생김)
            s.blocks.forEach((b, bi) => {
                if (b.type !== 'text') return;
                const el = document.getElementById('ge-rt-' + bi);
                if (!el) return;
                el.dataset.stateKey = `blocks.${bi}.html`;
                el.innerHTML = b.html ? renderRichText(b.html) : '';
            });
            // 표 블록 그리드
            s.blocks.forEach((b, bi) => { if (b.type === 'table') renderGeTableGrid(bi); });
        }

        function geBlockPreview(b) {
            if (b.type === 'text') return (richTextToPlain(b.html) || '(비어 있음)').slice(0, 40);
            const head = ((b.headerRows || []).slice(-1)[0] || []).filter(h => (h || '').trim()).join(' · ');
            return `${head || '(제목 없음)'} — ${(b.rows || []).length}줄`;
        }

        function renderGeTableGrid(bi) {
            const s = grammarEditorState;
            const b = geBlock(bi);
            const grid = document.getElementById('ge-grid-' + bi);
            if (!s || !b || !grid) return;
            const hl = noteCellHighlights(s.id, b.id);   // 이 표 블록의 칸 강조 {"행-열": true}
            const colCount = geColCount(bi);
            // ① 열 조작줄 — 열 이동 ◀▶ 과 열 강조는 따로 빼둔다
            //    (헤더를 가로로 병합해도 열마다 버튼이 그대로 남아 있어야 열을 옮길 수 있음)
            let html = '<table class="border-collapse w-full"><thead><tr>';
            for (let ci = 0; ci < colCount; ci++) {
                const isColHl = (b.highlightCols || []).includes(ci);
                html += `<th class="p-1 align-bottom">
                    <div class="flex items-center justify-center gap-1 mb-1">
                        <button type="button" onclick="moveGeCol(${bi}, ${ci}, -1)" title="왼쪽으로" class="w-5 h-5 rounded text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors flex items-center justify-center ${ci === 0 ? 'invisible' : ''}"><i class="fa-solid fa-chevron-left text-[9px]"></i></button>
                        <button type="button" onclick="moveGeCol(${bi}, ${ci}, 1)" title="오른쪽으로" class="w-5 h-5 rounded text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors flex items-center justify-center ${ci === colCount - 1 ? 'invisible' : ''}"><i class="fa-solid fa-chevron-right text-[9px]"></i></button>
                    </div>
                    <button type="button" onclick="toggleGeHighlight(${bi}, ${ci})" class="w-full text-[10px] font-bold rounded-md py-1 transition-all ${isColHl ? 'bg-[#5896cb] text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}">${isColHl ? '★ 열 강조 켬' : '☆ 열 강조'}</button>
                </th>`;
            }
            html += `<th class="p-1 w-16"></th></tr>`;

            // ② 헤더 줄들 — 칸 우클릭으로 헤더끼리 병합, 오른쪽 버튼으로 줄 순서 바꾸기·삭제
            const hRows = b.headerRows;
            const hMerges = b.headerMerges || {};
            const hHidden = buildMergeHidden(hMerges);
            hRows.forEach((hr, hi) => {
                html += '<tr>';
                for (let ci = 0; ci < colCount; ci++) {
                    if (hHidden.has(`${hi}-${ci}`)) continue;   // 다른 헤더 칸에 덮임
                    const mg = hMerges[`${hi}-${ci}`];
                    const cs = mg ? Math.max(1, mg.cs || 1) : 1;
                    const rs = mg ? Math.max(1, mg.rs || 1) : 1;
                    const spanAttr = `${cs > 1 ? ` colspan="${cs}"` : ''}${rs > 1 ? ` rowspan="${rs}"` : ''}`;
                    // [냐냐 요청] 병합 표시는 따로 안 넣는다 — 입력칸이 합쳐진 넓이·높이만큼 늘어나는 걸로 충분
                    html += `<th class="p-1 align-middle"${spanAttr} oncontextmenu="openGeCellMenu(event, ${bi}, ${hi}, ${ci}, 'header')">
                        <input value="${escapeAttr(hr[ci] || '')}" oninput="updateGeHeader(${bi}, ${hi}, ${ci}, this.value)" placeholder="열 제목" class="ge-cell w-full min-w-[90px] bg-[#f3f8fd] border border-[#cfdeeb] rounded-lg px-2 py-1.5 text-xs font-bold text-[#2c5578] focus:outline-none focus:ring-1 focus:ring-[#5896cb]">
                    </th>`;
                }
                html += `<th class="p-1 align-middle">
                    <div class="flex items-center justify-center gap-0.5">
                        <button type="button" onclick="moveGeHeaderRow(${bi}, ${hi}, -1)" title="헤더 줄 위로" class="w-4 h-5 rounded text-slate-300 hover:text-violet-600 ${hi === 0 ? 'invisible' : ''}"><i class="fa-solid fa-chevron-up text-[9px]"></i></button>
                        <button type="button" onclick="moveGeHeaderRow(${bi}, ${hi}, 1)" title="헤더 줄 아래로" class="w-4 h-5 rounded text-slate-300 hover:text-violet-600 ${hi === hRows.length - 1 ? 'invisible' : ''}"><i class="fa-solid fa-chevron-down text-[9px]"></i></button>
                        <button type="button" onclick="removeGeHeaderRow(${bi}, ${hi})" title="헤더 줄 삭제" class="w-4 h-5 rounded text-slate-300 hover:text-red-500 ${hRows.length <= 1 ? 'invisible' : ''}"><i class="fa-solid fa-circle-minus text-[9px]"></i></button>
                    </div>
                </th></tr>`;
            });
            html += `</thead><tbody>`;
            // [냐냐 요청] 병합된 칸은 대표 칸만 그리고, 덮인 칸은 건너뜀
            const merges = b.merges || {};
            const hidden = buildMergeHidden(merges);
            b.rows.forEach((row, ri) => {
                html += '<tr>';
                for (let ci = 0; ci < colCount; ci++) {
                    if (hidden.has(`${ri}-${ci}`)) continue;      // 다른 칸에 덮임
                    const mg = merges[`${ri}-${ci}`];
                    const cs = mg ? Math.max(1, mg.cs || 1) : 1;
                    const rs = mg ? Math.max(1, mg.rs || 1) : 1;
                    const spanAttr = `${cs > 1 ? ` colspan="${cs}"` : ''}${rs > 1 ? ` rowspan="${rs}"` : ''}`;
                    const val = (row || [])[ci] || '';
                    // [냐냐 PATCH] 각 칸에 별표 → 클릭하면 연분홍 강조 토글 (편집 중에도 가능)
                    const isHl = !!hl[`${ri}-${ci}`];
                    const starColor = isHl ? 'text-pink-400' : 'text-slate-300 hover:text-pink-300';
                    // [냐냐 요청] 병합 표시는 따로 안 넣는다 — 기본 배경이 합쳐진 넓이·높이만큼 늘어나는 걸로 충분
                    const cellBg = isHl ? 'bg-[#ffe0ec]' : 'bg-slate-50';
                    html += `<td class="p-1 align-middle"${spanAttr} oncontextmenu="openGeCellMenu(event, ${bi}, ${ri}, ${ci}, 'body')">
                        <div class="ge-cell flex items-center gap-1 ${cellBg} rounded-lg px-1">
                            <button type="button" onclick="toggleGeCellHighlight(${bi}, ${ri}, ${ci})" title="칸 강조" class="${starColor} transition-colors shrink-0"><i class="fa-solid fa-star text-[10px]"></i></button>
                            <input value="${escapeAttr(val)}" data-ge-bi="${bi}" data-ge-ri="${ri}" data-ge-ci="${ci}" oninput="updateGeCell(${bi}, ${ri}, ${ci}, this.value)" onkeydown="handleGeCellKey(event, ${bi}, ${ri}, ${ci})" class="w-full min-w-[70px] bg-transparent border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400">
                        </div>
                    </td>`;
                }
                // [냐냐 요청] 행 이동 ▲▼ 과 삭제를 헤더 줄처럼 한 줄로 나란히
                html += `<td class="p-1 align-middle">
                    <div class="flex items-center justify-center gap-0.5">
                        <button type="button" onclick="moveGeRow(${bi}, ${ri}, -1)" title="행 위로" class="w-4 h-5 rounded text-slate-300 hover:text-violet-600 transition-colors ${ri === 0 ? 'invisible' : ''}"><i class="fa-solid fa-chevron-up text-[9px]"></i></button>
                        <button type="button" onclick="moveGeRow(${bi}, ${ri}, 1)" title="행 아래로" class="w-4 h-5 rounded text-slate-300 hover:text-violet-600 transition-colors ${ri === b.rows.length - 1 ? 'invisible' : ''}"><i class="fa-solid fa-chevron-down text-[9px]"></i></button>
                        <button type="button" onclick="removeGeRow(${bi}, ${ri})" title="행 삭제" class="w-4 h-5 rounded text-slate-300 hover:text-red-500 transition-colors"><i class="fa-solid fa-circle-minus text-[9px]"></i></button>
                    </div>
                </td>`;
                html += '</tr>';
            });
            html += '</tbody></table>';
            grid.innerHTML = html;
        }

        // ── 블록 추가 / 삭제 / 순서 ────────────────────────────────
        function addGeBlock(type) {
            const s = grammarEditorState;
            if (!s) return;
            s.blocks.push(type === 'table' ? emptyTableBlock() : emptyTextBlock('plain'));
            renderGeBlocks();
            // 방금 추가한 블록으로 스크롤
            const box = document.getElementById('ge-blocks');
            if (box && box.lastElementChild) box.lastElementChild.scrollIntoView({ block: 'nearest' });
        }

        function removeGeBlock(bi) {
            const s = grammarEditorState;
            const b = geBlock(bi);
            if (!s || !b) return;
            if (s.blocks.length <= 1) { showToast("블록은 최소 하나는 있어야 해요", "error"); return; }
            const doRemove = () => {
                if (s.id) setNoteCellHighlights(s.id, b.id, {});   // 이 블록의 칸 강조도 정리
                s.blocks.splice(bi, 1);
                renderGeBlocks();
            };
            const kept = b.type === 'text'
                ? [richTextToPlain(b.html)].filter(v => (v || '').trim())
                : [...(b.headerRows || []).flat(), ...((b.rows || []).flat())].map(v => (v || '').toString().trim()).filter(Boolean);
            if (!kept.length) { doRemove(); return; }
            showConfirm(
                b.type === 'text' ? "이 글 블록을 지울까요?" : "이 표 블록을 지울까요?",
                `지워지는 내용: ${geLostPreview(kept)}`,
                doRemove,
                { okLabel: '지울래요', cancelLabel: '아니요' }
            );
        }

        function moveGeBlock(bi, dir) {
            const s = grammarEditorState;
            if (!s) return;
            const nb = bi + dir;
            if (nb < 0 || nb >= s.blocks.length) return;
            [s.blocks[bi], s.blocks[nb]] = [s.blocks[nb], s.blocks[bi]];
            renderGeBlocks();
        }

        // 글 블록을 보통 글 ↔ 💡 팁 상자로 전환
        function toggleGeTextStyle(bi) {
            const b = geBlock(bi);
            if (!b || b.type !== 'text') return;
            b.style = b.style === 'tip' ? 'plain' : 'tip';
            renderGeBlocks();
        }

        // [냐냐 PATCH] 편집 중 칸 강조 토글 (노트 id + 블록 id 기준으로 저장)
        function toggleGeCellHighlight(bi, ri, ci) {
            const s = grammarEditorState;
            const b = geBlock(bi);
            if (!s || !s.id || !b) return;
            const map = noteCellHighlights(s.id, b.id);
            const key = `${ri}-${ci}`;
            if (map[key]) delete map[key]; else map[key] = true;
            setNoteCellHighlights(s.id, b.id, map);
            renderGeTableGrid(bi);
        }

        function escapeAttr(s) {
            return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        }
        function updateGeHeader(bi, hi, ci, val) {
            const b = geBlock(bi);
            if (b && b.headerRows[hi]) b.headerRows[hi][ci] = val;
        }
        function updateGeCell(bi, ri, ci, val) {
            const b = geBlock(bi);
            if (b && b.rows[ri]) b.rows[ri][ci] = val;
        }

        // ── [냐냐 요청] 헤더 줄 추가 / 삭제 / 순서 바꾸기 ──────────
        //   새 줄은 '맨 위'에 생김 — 기존 제목 줄 위에 '인칭' 같은 묶음 제목을 얹는 게 제일 흔해서
        function addGeHeaderRow(bi) {
            const b = geBlock(bi);
            if (!b) return;
            if (b.headerRows.length >= GRAMMAR_MAX_HEADER_ROWS) {
                showToast(`헤더는 최대 ${GRAMMAR_MAX_HEADER_ROWS}줄까지예요`, "error");
                return;
            }
            b.headerRows.unshift(new Array(geColCount(bi)).fill(''));
            b.headerMerges = remapMerges(b.headerMerges || {}, { insertRow: 0 });
            renderGeTableGrid(bi);
        }

        function removeGeHeaderRow(bi, hi) {
            const b = geBlock(bi);
            if (!b) return;
            if (b.headerRows.length <= 1) { showToast("헤더는 최소 한 줄은 있어야 해요", "error"); return; }
            const doRemove = () => {
                b.headerRows.splice(hi, 1);
                b.headerMerges = remapMerges(b.headerMerges || {}, { removeRow: hi });
                renderGeTableGrid(bi);
            };
            // 내용이 있을 때만 물어봄 (빈 줄은 그냥 지움)
            const kept = (b.headerRows[hi] || []).map(h => (h || '').toString().trim()).filter(Boolean);
            if (!kept.length) { doRemove(); return; }
            showConfirm(
                "이 헤더 줄을 지울까요?",
                `지워지는 제목: ${geLostPreview(kept)}`,
                doRemove,
                { okLabel: '지울래요', cancelLabel: '아니요' }
            );
        }

        function moveGeHeaderRow(bi, hi, dir) {
            const b = geBlock(bi);
            if (!b) return;
            const nh = hi + dir;
            if (nh < 0 || nh >= b.headerRows.length) return;
            // 세로 병합을 가로지르는 이동은 표가 무너지므로 막는다 (열 이동과 같은 규칙)
            if (mergeBlocksSwap(b.headerMerges || {}, hi, nh, 'row')) {
                showToast("세로로 합쳐진 헤더가 있어서 줄을 못 옮겨요. 먼저 병합을 분리해 주세요", "error");
                return;
            }
            [b.headerRows[hi], b.headerRows[nh]] = [b.headerRows[nh], b.headerRows[hi]];
            b.headerMerges = remapMerges(b.headerMerges || {}, { swapRows: [hi, nh] });
            renderGeTableGrid(bi);
        }

        // [냐냐 PATCH] 열 강조(글씨체) 토글 — 편집 중
        function toggleGeHighlight(bi, ci) {
            const b = geBlock(bi);
            if (!b) return;
            if (!b.highlightCols) b.highlightCols = [];
            const idx = b.highlightCols.indexOf(ci);
            if (idx >= 0) b.highlightCols.splice(idx, 1);
            else b.highlightCols.push(ci);
            renderGeTableGrid(bi);
        }

        // [냐냐 PATCH] 열 위치 이동 (좌우 스왑)
        function moveGeCol(bi, ci, dir) {
            const s = grammarEditorState;
            const b = geBlock(bi);
            if (!s || !b) return;
            const nc = ci + dir;
            if (nc < 0 || nc >= geColCount(bi)) return;
            // [냐냐 요청] 가로 병합 한가운데를 가로지르는 이동은 막는다 (예전엔 병합이 조용히 풀렸음)
            if (mergeBlocksSwap(b.headerMerges || {}, ci, nc, 'col')) {
                showToast("가로로 합쳐진 헤더가 있어서 열을 못 옮겨요. 먼저 병합을 분리해 주세요", "error");
                return;
            }
            if (mergeBlocksSwap(b.merges || {}, ci, nc, 'col')) {
                showToast("가로로 합쳐진 칸이 있어서 열을 못 옮겨요. 먼저 병합을 분리해 주세요", "error");
                return;
            }
            // 헤더 줄마다 스왑
            b.headerRows.forEach(hr => { [hr[ci], hr[nc]] = [hr[nc], hr[ci]]; });
            b.headerMerges = remapMerges(b.headerMerges || {}, { swapCols: [ci, nc] });
            // 각 행의 셀 스왑
            b.rows.forEach(row => {
                const x = row[ci] || '', y = row[nc] || '';
                row[ci] = y; row[nc] = x;
            });
            // 열 강조 목록 갱신
            if (b.highlightCols) {
                b.highlightCols = b.highlightCols.map(x => x === ci ? nc : (x === nc ? ci : x));
            }
            // [냐냐 요청] 병합·칸강조 좌표도 열 위치 반영
            b.merges = remapMerges(b.merges || {}, { swapCols: [ci, nc] });
            if (s.id) setNoteCellHighlights(s.id, b.id, remapCellHighlights(noteCellHighlights(s.id, b.id), { swapCols: [ci, nc] }));
            renderGeTableGrid(bi);
        }

        // [냐냐 PATCH] 표 편집 중 엔터 → 다음 칸(아래칸, 없으면 다음 열 맨 위)로 이동
        function handleGeCellKey(e, bi, ri, ci) {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const b = geBlock(bi);
            if (!b) return;
            const rowCount = b.rows.length;
            const colCount = geColCount(bi);
            let nr = ri + 1, nc = ci;
            if (nr >= rowCount) {
                // 아래 칸 없으면 다음 열의 맨 위로
                nr = 0;
                nc = ci + 1;
                if (nc >= colCount) return; // 마지막 열 마지막 행이면 그대로
            }
            const next = document.querySelector(`[data-ge-bi="${bi}"][data-ge-ri="${nr}"][data-ge-ci="${nc}"]`);
            if (next) { next.focus(); next.select(); }
        }

        function addGeRow(bi) {
            const b = geBlock(bi);
            if (!b) return;
            b.rows.push(new Array(geColCount(bi)).fill(''));
            renderGeTableGrid(bi);
        }

        // [냐냐 요청] 본문 행 위·아래로 옮기기 (헤더 줄 이동과 같은 규칙 — 헤더와는 안 섞임)
        function moveGeRow(bi, ri, dir) {
            const s = grammarEditorState;
            const b = geBlock(bi);
            if (!s || !b) return;
            const nr = ri + dir;
            if (nr < 0 || nr >= b.rows.length) return;
            // 세로 병합 한가운데를 가로지르는 이동은 표가 무너지므로 막는다
            if (mergeBlocksSwap(b.merges || {}, ri, nr, 'row')) {
                showToast("세로로 합쳐진 칸이 있어서 행을 못 옮겨요. 먼저 병합을 분리해 주세요", "error");
                return;
            }
            [b.rows[ri], b.rows[nr]] = [b.rows[nr], b.rows[ri]];
            b.merges = remapMerges(b.merges || {}, { swapRows: [ri, nr] });
            if (s.id) setNoteCellHighlights(s.id, b.id, remapCellHighlights(noteCellHighlights(s.id, b.id), { swapRows: [ri, nr] }));
            renderGeTableGrid(bi);
        }

        // [냐냐 요청] 지워질 내용 미리보기 — 너무 길면 뒤는 '외 N개'로 줄임
        function geLostPreview(values) {
            const v = values.slice(0, 5).join(', ');
            return v + (values.length > 5 ? ` 외 ${values.length - 5}개` : '');
        }

        function removeGeRow(bi, ri) {
            const s = grammarEditorState;
            const b = geBlock(bi);
            if (!s || !b) return;
            if (b.rows.length <= 1) { showToast("최소 한 줄은 있어야 해요", "error"); return; }
            const doRemove = () => {
                b.rows.splice(ri, 1);
                // [냐냐 요청] 병합·칸강조 좌표도 같이 당겨줌 (안 하면 엉뚱한 칸이 합쳐져 보임)
                b.merges = remapMerges(b.merges || {}, { removeRow: ri });
                if (s.id) setNoteCellHighlights(s.id, b.id, remapCellHighlights(noteCellHighlights(s.id, b.id), { removeRow: ri }));
                renderGeTableGrid(bi);
            };
            // [냐냐 요청] 내용이 있을 때만 물어봄 (빈 행은 그냥 지움)
            const kept = (b.rows[ri] || []).map(c => (c || '').toString().trim()).filter(Boolean);
            if (!kept.length) { doRemove(); return; }
            showConfirm(
                "이 행을 지울까요?",
                `지워지는 내용: ${geLostPreview(kept)}`,
                doRemove,
                { okLabel: '지울래요', cancelLabel: '아니요' }
            );
        }

        function addGeColumn(bi) {
            const b = geBlock(bi);
            if (!b) return;
            b.headerRows.forEach(hr => hr.push(''));
            b.rows.forEach(r => r.push(''));
            renderGeTableGrid(bi);
        }

        function removeGeColumn(bi) {
            const s = grammarEditorState;
            const b = geBlock(bi);
            if (!s || !b) return;
            if (geColCount(bi) <= 1) { showToast("최소 한 열은 있어야 해요", "error"); return; }
            const lastIdx = geColCount(bi) - 1;
            const doRemove = () => {
                b.headerRows.forEach(hr => hr.pop());
                b.rows.forEach(r => r.pop());
                // [냐냐 요청] 헤더 병합도 삭제된 열 반영
                b.headerMerges = remapMerges(b.headerMerges || {}, { removeCol: lastIdx });
                // 강조 목록에서 삭제된 열 제거
                if (b.highlightCols) b.highlightCols = b.highlightCols.filter(ci => ci !== lastIdx);
                // [냐냐 요청] 병합·칸강조도 삭제된 열 반영
                b.merges = remapMerges(b.merges || {}, { removeCol: lastIdx });
                if (s.id) setNoteCellHighlights(s.id, b.id, remapCellHighlights(noteCellHighlights(s.id, b.id), { removeCol: lastIdx }));
                renderGeTableGrid(bi);
            };
            // [냐냐 요청] 마지막 열의 헤더 제목·본문 내용이 있으면 물어봄 (빈 열은 그냥 지움)
            const kept = [
                ...b.headerRows.map(hr => hr[lastIdx]),
                ...b.rows.map(r => r[lastIdx])
            ].map(v => (v || '').toString().trim()).filter(Boolean);
            if (!kept.length) { doRemove(); return; }
            showConfirm(
                "맨 오른쪽 열을 지울까요?",
                `지워지는 내용: ${geLostPreview(kept)}`,
                doRemove,
                { okLabel: '지울래요', cancelLabel: '아니요' }
            );
        }

        // [냐냐 요청] 앞뒤 빈 줄만 걷어내고, 줄 앞 스페이스 들여쓰기는 살려두는 정리 함수
        function trimBlankLines(str) {
            return String(str == null ? '' : str)
                .replace(/^(?:[ \t]*\r?\n)+/, '')    // 맨 앞 빈 줄들
                .replace(/(?:\r?\n[ \t]*)+$/, '')    // 맨 뒤 빈 줄들
                .replace(/[ \t]+$/, '');             // 마지막 줄 끝 공백
        }

        // ============================================================
        // [냐냐 요청] 문법·개념 노트 — 서식 편집기 엔진
        //   저장 데이터가 글자가 아니라 HTML이 되므로, 반드시 허용 목록으로 걸러서 쓴다.
        //   허용 태그 외에는 전부 글자로 취급 → 웹에서 복붙해도 이상한 게 안 딸려옴
        // ============================================================
        const RT_ALLOWED_TAGS = ['UL', 'LI', 'B', 'STRONG', 'I', 'EM', 'U', 'MARK', 'SPAN', 'H4', 'BR', 'DIV', 'P'];

        function rtIsReddish(color) {
            if (!color) return false;
            const c = color.toString().toLowerCase().replace(/\s/g, '');
            if (c.includes('dc2626') || c.includes('ef4444') || c === 'red' || c.includes('e11d48')) return true;
            const m = c.match(/rgba?\((\d+),(\d+),(\d+)/);
            if (m) {
                const r = +m[1], g = +m[2], b = +m[3];
                return r > 120 && r > g * 1.6 && r > b * 1.6;
            }
            return false;
        }

        // [냐냐 요청] 파란 글씨 — 보라(#8b5cf6·#4c1d95)까지 파랑으로 잡히면 안 되므로
        //   'G 가 R 보다 크다' 는 조건을 같이 본다 (보라는 R 이 G 보다 크다)
        function rtIsBluish(color) {
            if (!color) return false;
            const c = color.toString().toLowerCase().replace(/\s/g, '');
            if (c.includes('2563eb') || c.includes('3b82f6') || c.includes('1d4ed8') || c === 'blue') return true;
            const m = c.match(/rgba?\((\d+),(\d+),(\d+)/);
            if (m) {
                const r = +m[1], g = +m[2], b = +m[3];
                return b > 120 && b > r * 1.6 && b > g * 1.25 && g >= r;
            }
            return false;
        }

        function rtHasBg(color) {
            if (!color) return false;
            const c = color.toString().toLowerCase().replace(/\s/g, '');
            if (!c || c === 'transparent' || c === 'initial' || c === 'inherit') return false;
            const m = c.match(/rgba?\(([^)]+)\)/);
            if (m) {
                const p = m[1].split(',').map(Number);
                if (p.length >= 4 && p[3] === 0) return false;              // 완전 투명
                // ⚠️ [버그] 편집창 배경(slate-50)까지 형광펜으로 인식하던 문제
                //    회색·흰색 계열(R≈G≈B)은 강조가 아니라 배경이므로 제외한다
                const mx = Math.max(p[0], p[1], p[2]), mn = Math.min(p[0], p[1], p[2]);
                if (mx - mn < 25) return false;
            }
            if (/^#?(fff|ffffff|f8fafc|f1f5f9|f9fafb)$/.test(c.replace('#', ''))) return false;
            return true;
        }

        // HTML 정화 — 허용 태그만 남기고, 색/배경 인라인 스타일은 mark/rt-red 로 정규화
        function sanitizeRichHtml(html) {
            if (!html) return '';
            const doc = document.implementation.createHTMLDocument('rt');
            const root = doc.body;
            // ⚠️ [버그] 복붙한 HTML은 태그 사이에 줄바꿈이 잔뜩 들어있는데,
            //    편집창이 pre-wrap이면 그게 전부 빈 줄로 보였음 → 태그 사이 줄바꿈만 제거
            root.innerHTML = String(html).replace(/>[ \t]*[\r\n]+[ \t]*</g, '><');

            const walk = (node) => {
                Array.from(node.childNodes).forEach(child => {
                    if (child.nodeType === 3) return;                 // 텍스트는 통과
                    if (child.nodeType !== 1) { child.remove(); return; } // 주석 등 제거
                    const tag = child.tagName;

                    // 스크립트/스타일은 내용까지 통째로 제거
                    if (tag === 'SCRIPT' || tag === 'STYLE') { child.remove(); return; }

                    walk(child); // 자식 먼저 정리

                    // execCommand가 만든 <font> → 의미 태그로 변환
                    if (tag === 'FONT') {
                        const col = child.getAttribute('color');
                        if (rtIsReddish(col) || rtIsBluish(col)) {
                            const rep = doc.createElement('span');
                            rep.className = rtIsReddish(col) ? 'rt-red' : 'rt-blue';
                            while (child.firstChild) rep.appendChild(child.firstChild);
                            child.replaceWith(rep);
                        } else {
                            const frag = doc.createDocumentFragment();
                            while (child.firstChild) frag.appendChild(child.firstChild);
                            child.replaceWith(frag);
                        }
                        return;
                    }

                    if (!RT_ALLOWED_TAGS.includes(tag)) {
                        // 허용 안 된 태그는 껍데기만 벗기고 내용은 살림
                        const frag = doc.createDocumentFragment();
                        while (child.firstChild) frag.appendChild(child.firstChild);
                        child.replaceWith(frag);
                        return;
                    }

                    // 스타일 → mark / rt-red / rt-blue 로 정규화
                    const style = child.getAttribute('style') || '';
                    const bgM = style.match(/background(?:-color)?\s*:\s*([^;]+)/i);
                    const fgM = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
                    // ⚠️ 이미 저장된 rt-red 는 스타일이 없으므로 class 도 같이 봐야 함
                    //    (안 보면 저장→다시 열기 때 빨간 글씨가 풀려버림)
                    const hadRed = child.classList && child.classList.contains('rt-red');
                    const hadBlue = child.classList && child.classList.contains('rt-blue');
                    // [냐냐 요청] 글머리 없는 문단의 들여쓰기 단계(rt-in1~3)도 보존
                    const inLv = (child.className && child.className.toString().match(/\brt-in([1-3])\b/) || [])[1];
                    const wantMark = !!(bgM && rtHasBg(bgM[1]));
                    // 색을 바꿔 칠했으면(빨강→파랑) 새 인라인 색이 옛 class 를 이긴다
                    const fgRed = !!(fgM && rtIsReddish(fgM[1]));
                    const fgBlue = !!(fgM && rtIsBluish(fgM[1]));
                    const wantRed = fgRed || (hadRed && !fgBlue);
                    const wantBlue = fgBlue || (hadBlue && !fgRed);
                    const wantBold = /font-weight\s*:\s*(bold|[7-9]00)/i.test(style);

                    // 속성 전부 제거 (class는 아래에서 다시 지정)
                    Array.from(child.attributes).forEach(a => child.removeAttribute(a.name));
                    if (inLv && ['DIV', 'P', 'H4'].includes(child.tagName)) child.className = 'rt-in' + inLv;

                    let target = child;
                    if (wantMark && tag !== 'MARK') {
                        const mk = doc.createElement('mark');
                        while (target.firstChild) mk.appendChild(target.firstChild);
                        target.appendChild(mk);
                        target = mk;
                    }
                    if (wantRed || wantBlue) {
                        const cls = wantRed ? 'rt-red' : 'rt-blue';
                        if (child.tagName === 'SPAN') child.className = cls;
                        else {
                            const sp = doc.createElement('span');
                            sp.className = cls;
                            while (target.firstChild) sp.appendChild(target.firstChild);
                            target.appendChild(sp);
                        }
                    }
                    if (wantBold && !['B', 'STRONG', 'H4'].includes(child.tagName)) {
                        const bb = doc.createElement('b');
                        while (target.firstChild) bb.appendChild(target.firstChild);
                        target.appendChild(bb);
                    }
                    // 의미 없는 빈 span 은 껍데기 제거
                    if (child.tagName === 'SPAN' && !child.className) {
                        const frag = doc.createDocumentFragment();
                        while (child.firstChild) frag.appendChild(child.firstChild);
                        child.replaceWith(frag);
                    }
                });
            };
            walk(root);
            rtUnwrapListWrappers(root);
            return root.innerHTML;
        }

        // [냐냐 요청] 옛 편집기(execCommand)가 남긴 껍데기를 펴준다.
        //   <div><ul>…</ul></div> 처럼 목록이 문단 안에 들어가 있으면 div 의 padding 과
        //   ul 의 padding 이 겹쳐 계단 폭이 어긋나고, 그 줄에서 Tab 을 누르면 수준이 안 바뀐다.
        //   <li><div>글</div></li> 도 Tab 이 <blockquote> 를 만들게 하므로 같이 편다.
        //   이미 저장해둔 노트도 열었다 저장하면 자동으로 정리된다.
        function rtUnwrapListWrappers(root) {
            // ⓪ <h4><ul><li>글</li></ul></h4> → <ul><li><h4>글</h4></li></ul>
            //    (옛 편집기에서 소제목 줄에 글머리를 켜면 이 모양이 나왔다.
            //     겉모습은 그대로 두고 구조만 바로잡는다 — 소제목이 li 안으로 들어간다)
            Array.prototype.forEach.call(root.querySelectorAll('h4 > ul'), ul => {
                const h4 = ul.parentElement;
                if (!h4 || h4.tagName !== 'H4') return;
                Array.prototype.forEach.call(ul.querySelectorAll(':scope > li'), li => {
                    if (li.querySelector(':scope > h4')) return;      // 이미 소제목이면 그대로
                    const h = li.ownerDocument.createElement('h4');
                    Array.prototype.slice.call(li.childNodes).forEach(c => {
                        if (c.nodeType === 1 && c.tagName === 'UL') return;   // 하위 목록은 밖에 둔다
                        h.appendChild(c);
                    });
                    li.insertBefore(h, li.firstChild);
                });
                h4.replaceWith(ul);
            });
            // ① 목록만 감싸고 있는 div/p 껍데기 벗기기
            let guard = 0;
            while (guard++ < 20) {
                const wrap = Array.prototype.find.call(root.querySelectorAll('div, p'), n => {
                    const kids = Array.prototype.filter.call(n.childNodes,
                        c => c.nodeType === 1 || (c.nodeType === 3 && c.nodeValue.trim()));
                    return kids.length > 0 && kids.every(c => c.nodeType === 1 && c.tagName === 'UL');
                });
                if (!wrap) break;
                const frag = wrap.ownerDocument.createDocumentFragment();
                while (wrap.firstChild) frag.appendChild(wrap.firstChild);
                wrap.replaceWith(frag);
            }
            // ② li 안의 div/p 껍데기 벗기기 (소제목 h4 는 그대로 둔다 — 목록 속 소제목은 정상 구조)
            Array.prototype.forEach.call(root.querySelectorAll('li > div, li > p'), n => {
                const frag = n.ownerDocument.createDocumentFragment();
                while (n.firstChild) frag.appendChild(n.firstChild);
                // 줄이 두 개로 붙어버리지 않게, 뒤에 형제가 더 있으면 줄바꿈을 넣어준다
                if (n.nextSibling && !(n.nextSibling.nodeType === 1 && n.nextSibling.tagName === 'UL')) {
                    frag.appendChild(n.ownerDocument.createElement('br'));
                }
                n.replaceWith(frag);
            });
        }

        // 예전에 저장된 '그냥 글자'를 서식 HTML로 변환 (· 로 시작하는 줄은 목록으로)
        function rtPlainToHtml(text) {
            const lines = String(text == null ? '' : text).split(/\r?\n/);
            let out = '', inList = false;
            const esc = (t) => escapeHtml(t).replace(/ {2}/g, ' &nbsp;');
            lines.forEach(line => {
                const m = line.match(/^(\s*)[·•*\-]\s+(.*)$/);
                if (m) {
                    const depth = Math.min(2, Math.floor((m[1] || '').length / 2)); // 공백 2칸 = 한 단계
                    if (!inList) { out += '<ul>'.repeat(depth + 1); inList = depth + 1; }
                    else if (depth + 1 > inList) { out += '<ul>'.repeat(depth + 1 - inList); inList = depth + 1; }
                    else if (depth + 1 < inList) { out += '</ul>'.repeat(inList - (depth + 1)); inList = depth + 1; }
                    out += `<li>${esc(m[2])}</li>`;
                } else {
                    if (inList) { out += '</ul>'.repeat(inList); inList = 0; }
                    out += line.trim() ? `<div>${esc(line)}</div>` : '<div><br></div>';
                }
            });
            if (inList) out += '</ul>'.repeat(inList);
            return out;
        }

        // 저장값이 HTML인지 판별 (아니면 예전 글자 → 변환)
        function rtLooksLikeHtml(v) {
            return /<(ul|li|div|p|b|strong|mark|span|h4|br|i|em|u)\b[^>]*>/i.test(String(v || ''));
        }

        // 조회 화면 출력용 — 예전 글자면 변환하고, 항상 정화해서 내보냄
        function renderRichText(v) {
            if (!v) return '';
            const html = rtLooksLikeHtml(v) ? v : rtPlainToHtml(v);
            return sanitizeRichHtml(html);
        }

        // 검색·미리보기용 — 태그를 걷어낸 순수 글자
        function richTextToPlain(v) {
            if (!v) return '';
            const d = document.implementation.createHTMLDocument('rt');
            // 블록이 붙어버리면 검색이 안 되므로(ser본질…) 블록 경계에 공백을 넣어줌
            const spaced = (rtLooksLikeHtml(v) ? sanitizeRichHtml(v) : escapeHtml(v))
                .replace(/<\/(li|div|p|h4|ul)>/gi, ' ')
                .replace(/<br\s*\/?>/gi, ' ');
            d.body.innerHTML = spaced;
            return (d.body.textContent || '').replace(/\s+/g, ' ').trim();
        }

        // ── 툴바 명령 ───────────────────────────────────────────────
        let rtActiveEditorId = null;

        function rtFocusEditor(id) {
            const el = document.getElementById(id);
            if (!el) return null;
            rtActiveEditorId = id;
            if (document.activeElement !== el) el.focus();
            return el;
        }

        function rtExec(id, cmd, val) {
            const el = rtFocusEditor(id);
            if (!el) return;
            try { document.execCommand('styleWithCSS', false, false); } catch (e) {}
            try { document.execCommand(cmd, false, val === undefined ? null : val); } catch (e) {}
            rtSyncState(id);
        }

        // 선택 위치의 조상 중에 조건에 맞는 요소 찾기 (토글 판정용)
        function rtFindAncestor(id, test) {
            const el = document.getElementById(id);
            const sel = window.getSelection();
            if (!el || !sel || !sel.rangeCount) return null;
            let node = sel.anchorNode;
            while (node && node !== el) {
                if (node.nodeType === 1 && test(node)) return node;
                node = node.parentNode;
            }
            return null;
        }

        // 껍데기만 벗기고 내용은 남김 (서식 해제용)
        function rtUnwrapNode(node) {
            if (!node || !node.parentNode) return;
            const p = node.parentNode;
            while (node.firstChild) p.insertBefore(node.firstChild, node);
            p.removeChild(node);
            p.normalize && p.normalize();
        }

        const rtIsMarkNode = (n) =>
            n.tagName === 'MARK' || rtHasBg(n.style && n.style.backgroundColor);
        const rtIsRedNode = (n) =>
            (n.classList && n.classList.contains('rt-red'))
            || rtIsReddish(n.style && n.style.color)
            || (n.tagName === 'FONT' && rtIsReddish(n.getAttribute('color')));
        const rtIsBlueNode = (n) =>
            (n.classList && n.classList.contains('rt-blue'))
            || rtIsBluish(n.style && n.style.color)
            || (n.tagName === 'FONT' && rtIsBluish(n.getAttribute('color')));

        // [냐냐 요청] 서식 해제 — 형광펜과 빨간펜이 <span> 하나에 같이 얹혀 있을 수 있다.
        //   형광펜을 칠한 자리에 빨간펜을 칠하면 크롬이 둘을 한 span 으로 합쳐 버린다:
        //     <span style="background-color: rgb(254,240,138); color: rgb(220,38,38);">
        //   예전엔 해제할 때 이 span 을 통째로 벗겨서, 빨간펜만 지웠는데 형광펜까지 같이 날아갔다.
        //   그래서 지울 속성만 지우고, 남은 서식이 하나도 없을 때만 껍데기를 벗긴다.
        function rtRemoveStyle(node, kind) {
            if (!node) return;
            if (kind === 'mark') {
                if (node.tagName === 'MARK') {
                    // <mark> 는 배경 전용 태그라 껍데기를 벗긴다.
                    //   다만 글자색을 같이 지고 있으면 그 색은 살려서 span 으로 바꿔 끼운다
                    const color = node.style && node.style.color;
                    const isRed = node.classList && node.classList.contains('rt-red');
                    const isBlue = node.classList && node.classList.contains('rt-blue');
                    if (color || isRed || isBlue) {
                        const sp = document.createElement('span');
                        if (color) sp.style.color = color;
                        if (isRed) sp.className = 'rt-red';
                        else if (isBlue) sp.className = 'rt-blue';
                        while (node.firstChild) sp.appendChild(node.firstChild);
                        node.parentNode.replaceChild(sp, node);
                        return;
                    }
                    rtUnwrapNode(node);
                    return;
                }
                node.style.backgroundColor = '';
                node.style.background = '';
            } else {
                // 글자색은 빨강·파랑이 같은 자리를 쓰므로 한꺼번에 지운다
                node.style.color = '';
                if (node.classList) { node.classList.remove('rt-red'); node.classList.remove('rt-blue'); }
                if (node.tagName === 'FONT') node.removeAttribute('color');
            }
            const styleLeft = (node.getAttribute('style') || '').trim();
            const classLeft = (node.getAttribute('class') || '').trim();
            if (!styleLeft) node.removeAttribute('style');
            if (!classLeft) node.removeAttribute('class');
            // 아무 서식도 안 남은 빈 껍데기면 벗긴다 (span/font 만 — b·i·mark 는 그 자체가 서식)
            if ((node.tagName === 'SPAN' || node.tagName === 'FONT') && !styleLeft && !classLeft) {
                rtUnwrapNode(node);
            }
        }

        // 형광펜 — 이미 칠해져 있으면 해제 (브라우저별 명령 이름이 달라서 둘 다 시도)
        function rtHighlight(id) {
            const el = rtFocusEditor(id);
            if (!el) return;
            const hit = rtFindAncestor(id, rtIsMarkNode);
            if (hit) { rtRemoveStyle(hit, 'mark'); rtSyncState(id); return; }
            try { document.execCommand('styleWithCSS', false, true); } catch (e) {}
            let ok = false;
            try { ok = document.execCommand('hiliteColor', false, '#fef08a'); } catch (e) {}
            if (!ok) { try { document.execCommand('backColor', false, '#fef08a'); } catch (e) {} }
            rtSyncState(id);
        }

        // 색만 지우고 껍데기는 그대로 둔다 — 색을 바꿔 칠할 때 쓴다.
        //   ⚠️ rtRemoveStyle 은 빈 span 을 벗기면서 normalize 로 글자를 합치는데,
        //      그러면 골라둔 범위가 풀려버려서 새로 칠할 색이 아무 데도 안 묻는다.
        //      빈 껍데기는 어차피 저장할 때 sanitizeRichHtml 이 걷어낸다.
        function rtClearColorOnly(node) {
            if (!node) return;
            node.style.color = '';
            if (node.classList) { node.classList.remove('rt-red'); node.classList.remove('rt-blue'); }
            if (node.tagName === 'FONT') node.removeAttribute('color');
            if (!(node.getAttribute('style') || '').trim()) node.removeAttribute('style');
            if (!(node.getAttribute('class') || '').trim()) node.removeAttribute('class');
        }

        // 색펜 — 같은 색이면 해제, 다른 색이면 그 색을 걷어내고 새로 칠한다
        //   (색을 겹쳐 칠하면 span 이 계속 겹쳐 쌓이니까 먼저 벗긴다)
        const RT_PEN_COLORS = { red: '#dc2626', blue: '#2563eb' };
        function rtColorPen(id, kind) {
            const el = rtFocusEditor(id);
            if (!el) return;
            const same = kind === 'red' ? rtIsRedNode : rtIsBlueNode;
            const other = kind === 'red' ? rtIsBlueNode : rtIsRedNode;
            const hit = rtFindAncestor(id, same);
            if (hit) { rtRemoveStyle(hit, 'color'); rtSyncState(id); return; }
            const prev = rtFindAncestor(id, other);
            if (prev) rtClearColorOnly(prev);
            try { document.execCommand('styleWithCSS', false, true); } catch (e) {}
            try { document.execCommand('foreColor', false, RT_PEN_COLORS[kind]); } catch (e) {}
            rtSyncState(id);
        }
        // 빨간 글씨 — 이미 빨갛면 해제
        function rtRed(id) { rtColorPen(id, 'red'); }
        // [냐냐 요청] 파란 글씨 — 이미 파랗면 해제
        function rtBlue(id) { rtColorPen(id, 'blue'); }

        // ── [냐냐 요청] Ctrl+클릭으로 여러 줄 골라서 한번에 서식 주기 ──────
        //   contenteditable 은 떨어진 줄을 동시에 선택하는 걸 브라우저가 지원하지 않는다
        //   (Firefox 만 됨). 그래서 고른 줄을 직접 기억해 두고, 서식 버튼을 누르면
        //   그 줄들에 차례로 적용한다. 표시용 클래스는 저장할 때 떼어낸다.
        const RT_MARK_CLASS = 'rt-picked';

        function rtMarkedLines(id) {
            const el = document.getElementById(id);
            return el ? Array.prototype.slice.call(el.querySelectorAll('.' + RT_MARK_CLASS)) : [];
        }
        function rtClearMarks(id) {
            rtMarkedLines(id).forEach(n => {
                n.classList.remove(RT_MARK_CLASS);
                if (!n.className) n.removeAttribute('class');
            });
        }
        // 저장 전에 표시를 떼어낸 HTML (노트에 보라 배경이 굳어버리면 안 되니까)
        function rtStripMarks(html) {
            return String(html || '')
                .replace(new RegExp('\\s*class="' + RT_MARK_CLASS + '"', 'g'), '')
                .replace(new RegExp('(class="[^"]*?)\\s*' + RT_MARK_CLASS + '\\s*', 'g'), '$1');
        }

        // 편집기 클릭 — Ctrl(맥은 ⌘)+클릭이면 그 줄을 찍고/뺀다. 그냥 클릭이면 표시를 지운다
        function rtEditorClick(e, id) {
            if (e.ctrlKey || e.metaKey) {
                rtActiveEditorId = id;
                let n = e.target;
                const el = document.getElementById(id);
                while (n && n !== el && !(n.nodeType === 1 && ['LI', 'H4', 'DIV', 'P'].includes(n.tagName))) n = n.parentNode;
                if (n && n !== el) {
                    n.classList.toggle(RT_MARK_CLASS);
                    if (!n.className) n.removeAttribute('class');
                    e.preventDefault();
                }
                return;
            }
            rtClearMarks(id);
        }

        // 찍어둔 줄이 있으면 그 줄마다 커서를 옮겨가며 fn 을 돌린다.
        //   돌린 뒤 DOM 이 바뀔 수 있어서 살아있는 줄만 처리한다
        function rtRunOnMarked(id, fn) {
            const lines = rtMarkedLines(id);
            if (!lines.length) return false;
            rtClearMarks(id);
            lines.forEach(node => {
                if (!node.isConnected) return;
                const r = document.createRange();
                r.selectNodeContents(node); r.collapse(false);
                const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
                fn();
            });
            return true;
        }

        // 소제목 — 이미 소제목이면 일반 문단으로 되돌림 (토글)
        //   ⚠️ execCommand('formatBlock') 을 쓰면 글머리 목록 안에서 <li> 가 아니라 <ul> 전체를
        //      <h4> 로 감싸버리고, 그 뒤엔 다시 눌러도 안 벗겨졌다 (h4 안에 div 만 하나 더 생김).
        //      들여쓴 소제목을 풀 때 rt-in* 이 사라지는 문제도 있었다. 그래서 직접 바꾼다.

        // 커서가 놓인 '한 줄'에 해당하는 요소 (목록 줄이면 li)
        function rtLineBlock(id) {
            const el = document.getElementById(id);
            const sel = window.getSelection();
            if (!el || !sel || !sel.rangeCount) return null;
            let n = sel.anchorNode;
            if (n && n.nodeType === 3) n = n.parentNode;
            while (n && n !== el) {
                if (n.nodeType === 1 && ['LI', 'H4', 'DIV', 'P'].includes(n.tagName)) return n;
                n = n.parentNode;
            }
            return null;
        }

        // [냐냐 요청] 아무것도 안 쓴 빈 편집기에는 줄(블록)이 아직 없다.
        //   그럴 때 rtLineBlock 이 null 이라 소제목 버튼이 아무 반응도 없었다.
        //   → 빈 문단을 하나 만들어 커서를 넣어준 뒤 서식을 적용한다.
        //   (글머리·들여쓰기는 rtEnsureBlock / execCommand 가 알아서 만들어 줘서 원래 잘 됐다)
        // 커서를 그 줄 맨 뒤에 놓기 (여러 곳에서 쓴다)
        function rtCaretEnd(node) {
            if (!node) return;
            const r = document.createRange();
            r.selectNodeContents(node); r.collapse(false);
            const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        }

        function rtEnsureLineBlock(id) {
            let block = rtLineBlock(id);
            if (block) return block;
            const el = document.getElementById(id);
            if (!el) return null;
            try { document.execCommand('formatBlock', false, 'div'); } catch (e) {}
            block = rtLineBlock(id);
            if (block) return block;
            // 브라우저가 formatBlock 을 안 먹으면 직접 만든다
            if (!el.textContent.trim()) el.innerHTML = '';   // 브라우저가 남긴 빈 <br> 치우기
            const div = document.createElement('div');
            div.appendChild(document.createElement('br'));
            el.appendChild(div);
            const r = document.createRange();
            r.setStart(div, 0); r.collapse(true);
            const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
            return div;
        }

        function rtHeading(id) {
            const el = rtFocusEditor(id);
            if (!el) return;
            // Ctrl+클릭으로 찍어둔 줄이 있으면 그 줄 전부에
            if (rtRunOnMarked(id, () => rtHeadingOne(id))) { rtSyncState(id); return; }
            rtHeadingOne(id);
            rtSyncState(id);
        }

        function rtHeadingOne(id) {
            const block = rtEnsureLineBlock(id);
            if (!block) return;

            const moveKids = (from, to) => { while (from.firstChild) to.appendChild(from.firstChild); };
            const caretEnd = (node) => {
                const r = document.createRange();
                r.selectNodeContents(node); r.collapse(false);
                const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
            };
            // 빈 줄이면 <br> 하나만 남기고 그 '앞'에 커서를 둔다.
            //   맨 뒤에 두면 타이핑한 글자가 <br> 뒤로 들어가서 첫 줄이 비어 보인다
            const caretInto = (node) => {
                if (node.textContent.trim()) { caretEnd(node); return; }
                node.innerHTML = '<br>';
                const r = document.createRange();
                r.setStart(node, 0); r.collapse(true);
                const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
            };

            if (block.tagName === 'H4') {
                const li = (block.parentNode && block.parentNode.tagName === 'LI') ? block.parentNode : null;
                if (li) {                       // 목록 줄이면 li 안으로 그냥 풀어준다
                    moveKids(block, li);
                    block.remove();
                    caretInto(li);
                } else {
                    const div = document.createElement('div');
                    if (block.className) div.className = block.className;   // 들여쓰기(rt-in*) 유지
                    moveKids(block, div);
                    block.parentNode.replaceChild(div, block);
                    caretInto(div);
                }
            } else if (block.tagName === 'LI') {
                // 목록 줄은 li 를 그대로 두고 안쪽만 소제목으로 (li 를 h4 로 바꾸면 목록이 깨진다)
                const h = document.createElement('h4');
                moveKids(block, h);
                block.appendChild(h);
                caretInto(h);
            } else {
                const h = document.createElement('h4');
                if (block.className) h.className = block.className;         // 들여쓰기 유지
                moveKids(block, h);
                block.parentNode.replaceChild(h, block);
                caretInto(h);
            }
        }

        // [냐냐 요청] 소제목 줄에서 엔터 → 다음 줄은 '보통 글' 로 시작한다.
        //   브라우저 기본 동작의 문제:
        //     · 줄 중간에서 엔터 → 소제목을 그대로 복제한다 (<h4>현재</h4><h4>시제</h4>)
        //     · 글머리 줄 안의 소제목에서 엔터 → 새 줄을 <li><div>…</div></li> 로 만든다.
        //       그 <div> 때문에 Tab 을 누르면 <blockquote> 가 생겨서 수준 변경이 깨졌다.
        //   true 를 돌려주면 기본 동작을 막고 우리가 만든 줄을 쓴다.
        function rtEnter(id) {
            const sel = window.getSelection();
            if (!sel || !sel.rangeCount || !sel.isCollapsed) return false;  // 범위 선택은 기본 동작에
            const line = rtLineBlock(id);
            if (!line || line.tagName !== 'H4') return false;               // 소제목 줄에서만 손댄다

            const h4 = line;
            const li = h4.closest('li');            // 글머리 줄 안의 소제목이면 새 줄도 li 로
            const anchor = li || h4;
            const r = sel.getRangeAt(0);

            // 커서 앞이 비어 있으면 = 줄 맨 앞 → 위에 빈 줄만 끼우고 커서는 소제목에 그대로 둔다
            const head = document.createRange();
            head.selectNodeContents(h4);
            head.setEnd(r.startContainer, r.startOffset);
            if (!head.toString().trim()) {
                const blank = document.createElement(li ? 'li' : 'div');
                blank.innerHTML = '<br>';
                anchor.parentNode.insertBefore(blank, anchor);
                return true;
            }

            // 커서 뒤 내용을 잘라내 새 줄로 옮긴다 (소제목 서식은 떼고)
            const tail = document.createRange();
            tail.selectNodeContents(h4);
            tail.setStart(r.startContainer, r.startOffset);
            const frag = tail.extractContents();

            const newLine = document.createElement(li ? 'li' : 'div');
            if (!li && h4.className) newLine.className = h4.className;      // 들여쓰기 단계는 이어받는다
            newLine.appendChild(frag);
            if (!newLine.textContent.trim()) newLine.innerHTML = '<br>';
            if (!h4.textContent.trim() && !h4.querySelector('br')) h4.appendChild(document.createElement('br'));

            anchor.parentNode.insertBefore(newLine, anchor.nextSibling);
            const r2 = document.createRange();
            r2.setStart(newLine, 0); r2.collapse(true);
            sel.removeAllRanges(); sel.addRange(r2);
            return true;
        }

        // ── 들여쓰기 / 글머리 기호 ────────────────────────────────
        const RT_MAX_LEVEL = 3;

        // 커서가 놓인 블록(문단) 찾기. 없으면 만들어줌
        function rtBlockOf(id) {
            const el = document.getElementById(id);
            const sel = window.getSelection();
            if (!el || !sel || !sel.rangeCount) return null;
            let n = sel.anchorNode;
            if (n && n.nodeType === 3) n = n.parentNode;
            while (n && n !== el) {
                if (n.nodeType === 1 && ['DIV', 'P', 'H4'].includes(n.tagName)) return n;
                n = n.parentNode;
            }
            return null;
        }
        function rtEnsureBlock(id) {
            let b = rtBlockOf(id);
            if (!b) { try { document.execCommand('formatBlock', false, 'div'); } catch (e) {} b = rtBlockOf(id); }
            return b;
        }
        function rtGetLevel(b) {
            for (let i = RT_MAX_LEVEL; i >= 1; i--) if (b.classList.contains('rt-in' + i)) return i;
            return 0;
        }
        function rtSetLevel(b, lv) {
            for (let i = 1; i <= RT_MAX_LEVEL; i++) b.classList.remove('rt-in' + i);
            if (lv > 0) b.classList.add('rt-in' + Math.min(RT_MAX_LEVEL, lv));
        }
        // 목록 중첩 깊이 (li 안일 때 1부터)
        function rtListDepth(id) {
            const el = document.getElementById(id);
            const sel = window.getSelection();
            if (!el || !sel || !sel.rangeCount) return 0;
            let n = sel.anchorNode, d = 0;
            while (n && n !== el) { if (n.nodeType === 1 && n.tagName === 'UL') d++; n = n.parentNode; }
            return d;
        }
        const rtInList = (id) => !!rtFindAncestor(id, n => n.tagName === 'LI');

        // 수준 내리기 — 목록 안이면 목록 단계, 아니면 문단 들여쓰기 (둘 다 같은 폭)
        function rtIndent(id) {
            const el = rtFocusEditor(id);
            if (!el) return;
            if (rtRunOnMarked(id, () => rtIndentOne(id))) { rtSyncState(id); return; }
            rtIndentOne(id);
            rtSyncState(id);
        }
        function rtIndentOne(id) {
            if (rtInList(id)) {
                if (rtListDepth(id) < RT_MAX_LEVEL) {
                    try { document.execCommand('indent'); } catch (e) {}
                }
            } else {
                const b = rtEnsureBlock(id);
                if (b) rtSetLevel(b, rtGetLevel(b) + 1);
            }
        }

        // 수준 올리기
        function rtOutdent(id) {
            const el = rtFocusEditor(id);
            if (!el) return;
            if (rtRunOnMarked(id, () => rtOutdentOne(id))) { rtSyncState(id); return; }
            rtOutdentOne(id);
            rtSyncState(id);
        }
        function rtOutdentOne(id) {
            if (rtInList(id)) {
                try { document.execCommand('outdent'); } catch (e) {}
            } else {
                const b = rtBlockOf(id);
                if (b) rtSetLevel(b, Math.max(0, rtGetLevel(b) - 1));
            }
        }

        // ── 글머리 기호 빼기 ──────────────────────────────────────
        //   예전엔 execCommand('outdent') 를 목록에서 빠져나올 때까지 반복했는데,
        //   커서 위치에 따라 결과가 제각각이었다:
        //     · 1수준에 커서를 두면 li 없는 빈 <ul> 이 남고
        //     · 두 줄을 선택하면 아래 목록이 윗줄 <div> 안으로 들어가서 한 단계 더 들어가 보였다
        //       (2수준 글씨가 41px 이어야 하는데 49px — div 의 padding 과 ul 의 padding 이 겹침)
        //   그래서 목록을 '줄 + 단계' 로 펼친 뒤 다시 쌓는다. 커서가 어디 있든 결과가 같다.

        // 목록을 훑어서 [{node: li, depth}] 로 펼친다. <ul><ul> 도 <li><ul> 도 같이 받는다
        function rtListLines(ul, depth, out) {
            Array.prototype.forEach.call(ul.children, n => {
                if (n.tagName === 'LI') {
                    out.push({ node: n, depth: depth });
                    Array.prototype.forEach.call(n.children, c => {
                        if (c.tagName === 'UL') rtListLines(c, depth + 1, out);
                    });
                } else if (n.tagName === 'UL') {
                    rtListLines(n, depth + 1, out);
                }
            });
        }

        // 선택에 걸친 '가장 바깥 <ul>' 들.
        //   커서만 있으면 그 목록 하나, 여러 줄을 범위로 잡았으면 걸친 목록 전부.
        //   ⚠️ 편집기 전체를 선택하면 커서(anchorNode)가 목록 밖이라 예전엔 목록을 못 찾고
        //      '글머리 넣기' 로 잘못 빠졌다 — 그때 첫 줄이 깨졌다. 그래서 범위도 같이 본다.
        let rtForcedTargets = null;   // Ctrl+클릭으로 찍어둔 li 들 (여러 줄 한번에 뺄 때)

        function rtSelectedLists(id) {
            const el = document.getElementById(id);
            const sel = window.getSelection();
            if (!el) return [];
            // 찍어둔 줄이 있으면 그 줄들이 속한 목록 전부 (여러 목록에 걸쳐 있어도 된다)
            if (rtForcedTargets && rtForcedTargets.size) {
                const outers = [];
                rtForcedTargets.forEach(li => {
                    let n = li, outer = null;
                    while (n && n !== el) { if (n.nodeType === 1 && n.tagName === 'UL') outer = n; n = n.parentNode; }
                    if (outer && outers.indexOf(outer) < 0) outers.push(outer);
                });
                if (outers.length) return outers;
            }
            if (!sel || !sel.rangeCount) return [];
            let n = sel.anchorNode, outer = null;
            while (n && n !== el) { if (n.nodeType === 1 && n.tagName === 'UL') outer = n; n = n.parentNode; }
            if (outer) return [outer];
            const range = sel.getRangeAt(0);
            if (range.collapsed) return [];
            return Array.prototype.filter.call(el.children, c => {
                if (c.tagName !== 'UL') return false;
                try { return range.intersectsNode(c); } catch (e) { return false; }
            });
        }

        function rtUnbullet(id) {
            const el = document.getElementById(id);
            if (!el) return;
            const lists = rtSelectedLists(id);
            if (!lists.length) return;
            // 목록을 갈아끼우면 선택 범위가 무효가 되니, 대상은 손대기 전에 전부 정해둔다
            const plan = lists.map(outer => {
                const lines = [];
                rtListLines(outer, 1, lines);
                return { outer, lines, targets: rtPickUnbulletTargets(lines) };
            });
            let lastDiv = null;
            plan.forEach(p => { lastDiv = rtUnbulletOne(p) || lastDiv; });
            if (lastDiv) {
                const sel = window.getSelection();
                const r = document.createRange();
                r.selectNodeContents(lastDiv);
                r.collapse(false);
                sel.removeAllRanges();
                sel.addRange(r);
            }
        }

        // 어떤 줄의 기호를 뺄지 — 커서만 있으면 그 줄, 범위로 잡았으면 걸친 줄 전부
        function rtPickUnbulletTargets(lines) {
            if (rtForcedTargets && rtForcedTargets.size) {
                const t = new Set();
                lines.forEach(ln => { if (rtForcedTargets.has(ln.node)) t.add(ln.node); });
                if (t.size) return t;
            }
            const sel = window.getSelection();
            const range = (sel && sel.rangeCount) ? sel.getRangeAt(0) : null;
            const targets = new Set();
            if (range && !range.collapsed) {
                lines.forEach(ln => { try { if (range.intersectsNode(ln.node)) targets.add(ln.node); } catch (e) {} });
            } else if (sel && sel.anchorNode) {
                // 커서를 담은 가장 안쪽 li
                let best = null;
                lines.forEach(ln => { if (ln.node.contains(sel.anchorNode) && (!best || best.contains(ln.node))) best = ln.node; });
                if (best) targets.add(best);
            }
            // 찍어둔 줄로 고르는 중이면 '아무것도 안 걸린 목록' 은 그대로 둔다 (엉뚱한 줄이 빠지면 안 됨)
            if (!targets.size && lines.length && !rtForcedTargets) targets.add(lines[0].node);
            return targets;
        }

        function rtUnbulletOne(plan) {
            const outer = plan.outer, lines = plan.lines, targets = plan.targets;
            if (!lines.length) return null;

            // 하위 목록은 이미 별도 줄로 뽑았으니 옮길 때 빼고 옮긴다
            const moveKids = (from, to) => {
                Array.prototype.slice.call(from.childNodes).forEach(c => {
                    if (c.nodeType === 1 && c.tagName === 'UL') return;
                    to.appendChild(c);
                });
                if (!to.childNodes.length) to.appendChild(document.createElement('br'));
            };

            const frag = document.createDocumentFragment();
            let stack = [], firstDiv = null;
            lines.forEach(ln => {
                if (targets.has(ln.node)) {
                    stack = [];                       // 목록을 끊고 문단으로 내보낸다
                    const div = document.createElement('div');
                    // 기호만 빼고 '있던 자리'는 유지 — 목록 N단계의 글씨 시작점 = rt-in{N}
                    if (ln.depth > 0) div.className = 'rt-in' + Math.min(RT_MAX_LEVEL, ln.depth);
                    moveKids(ln.node, div);
                    frag.appendChild(div);
                    if (!firstDiv) firstDiv = div;
                } else {
                    while (stack.length > ln.depth) stack.pop();
                    while (stack.length < ln.depth) {
                        const ul = document.createElement('ul');
                        (stack.length ? stack[stack.length - 1] : frag).appendChild(ul);
                        stack.push(ul);
                    }
                    const li = document.createElement('li');
                    moveKids(ln.node, li);
                    stack[stack.length - 1].appendChild(li);
                }
            });
            outer.parentNode.replaceChild(frag, outer);
            return firstDiv;   // 커서는 rtUnbullet 이 마지막 문단에 다시 놓아준다
        }

        // 글머리 기호 넣기/빼기
        //   ⚠️ execCommand('insertUnorderedList')는 중첩 목록에서 한 단계만 벗겨져서
        //      3단계에 있으면 세 번 눌러야 지워졌음 → 몇 단계든 한 번에 제거하도록 직접 처리
        function rtToggleList(id) {
            const el = rtFocusEditor(id);
            if (!el) return;

            // [냐냐 요청] Ctrl+클릭으로 찍어둔 줄이 있으면 그 줄들에만 적용한다.
            //   빼는 쪽은 목록을 통째로 다시 쌓으므로 한 줄씩 돌리면 나머지 줄의 참조가 끊긴다.
            //   그래서 찍어둔 li 를 대상 목록으로 한번에 넘긴다 (rtForcedTargets).
            const marked = rtMarkedLines(id);
            if (marked.length) {
                rtClearMarks(id);
                const lis = marked.map(n => (n.tagName === 'LI') ? n : n.closest('li')).filter(Boolean);
                if (lis.length) {
                    rtForcedTargets = new Set(lis);
                    try { rtUnbullet(id); } finally { rtForcedTargets = null; }
                } else {
                    // 전부 문단이면 줄마다 글머리를 켠다
                    marked.forEach(node => {
                        if (!node.isConnected) return;
                        const r = document.createRange();
                        r.selectNodeContents(node); r.collapse(false);
                        const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
                        rtAddBullet(id);
                    });
                }
                rtSyncState(id);
                return;
            }

            // 편집기 전체를 선택한 경우도 '목록 안' 으로 쳐야 한다 (rtInList 는 커서만 본다)
            if (rtSelectedLists(id).length) rtUnbullet(id);
            else rtAddBullet(id);
            rtSyncState(id);
        }

        // [냐냐 요청] execCommand('insertUnorderedList') 는 있던 줄을 그대로 두고 그 '안에' <ul> 을
        //   넣어버린다 — <div><ul>…</ul></div>, 소제목 줄이면 <h4><ul>…</ul></h4>.
        //   그러면 div/h4 의 padding 과 ul 의 padding 이 겹쳐 계단 폭이 어긋나고(위 5116줄 참고)
        //   Tab 을 눌러도 수준이 제대로 안 바뀐다. 그래서 <ul><li> 를 직접 만든다.
        //     · 소제목 줄 → <li><h4>…</h4></li> (소제목은 그대로 유지)
        //     · 보통 문단 → 껍데기를 벗겨 <li> 안으로
        function rtAddBullet(id) {
            const line = rtEnsureLineBlock(id);
            if (!line) return;
            if (line.tagName === 'LI' || line.closest('li')) return;   // 이미 목록 안
            const lv = rtGetLevel(line);
            rtSetLevel(line, 0);
            if (!line.className) line.removeAttribute('class');

            // 커서 자리를 기억해 둔다 (글자 노드는 옮겨도 그대로 살아있다)
            const sel = window.getSelection();
            const r0 = (sel && sel.rangeCount) ? sel.getRangeAt(0) : null;
            const cont = r0 ? r0.endContainer : null, off = r0 ? r0.endOffset : 0;

            const ul = document.createElement('ul');
            const li = document.createElement('li');
            ul.appendChild(li);
            line.parentNode.insertBefore(ul, line);
            if (line.tagName === 'H4') {
                li.appendChild(line);                                  // 소제목은 li 안에 그대로
            } else {
                while (line.firstChild) li.appendChild(line.firstChild);
                line.remove();
            }
            if (!li.childNodes.length) li.appendChild(document.createElement('br'));

            let restored = false;
            if (cont && cont.isConnected) {
                try {
                    const r = document.createRange();
                    r.setStart(cont, off); r.collapse(true);
                    sel.removeAllRanges(); sel.addRange(r);
                    restored = true;
                } catch (e) {}
            }
            if (!restored) rtCaretEnd(li);

            // 문단 들여쓰기(rt-in*) 단계가 있었으면 목록 단계로 옮겨준다.
            // 목록 1단계는 <ul> 을 만든 것으로 이미 셌으므로 나머지만 내린다
            for (let i = 0; i < Math.max(0, lv - 1); i++) { try { document.execCommand('indent'); } catch (e) {} }
        }
        // [냐냐 요청] ej. / Q. / A. 같은 표시를 커서 위치에 넣기 (서식 없이 그냥 글자로)
        function rtInsertLabel(id, txt) {
            const el = rtFocusEditor(id);
            if (!el) return;
            try { document.execCommand('styleWithCSS', false, false); } catch (e) {}
            try { document.execCommand('insertHTML', false, `${escapeHtml(txt)}&nbsp;`); } catch (e) {}
            rtSyncState(id);
        }

        // [냐냐 요청] 자판으로 치기 번거로운 기호를 커서 자리에 바로 넣기.
        //   뒤에 공백은 붙이지 않는다 — 바로 이어서 치는 게 대부분이라 (·주의, [사물])
        const RT_SYMBOLS = [
            { ch: '·', title: '가운데 점' },
            { ch: '/', title: '빗금' },
            { ch: '[', title: '대괄호 열기' },
            { ch: ']', title: '대괄호 닫기' }
        ];

        function rtInsertSymbol(id, ch) {
            const el = rtFocusEditor(id);
            if (!el) return;
            try { document.execCommand('styleWithCSS', false, false); } catch (e) {}
            try { document.execCommand('insertHTML', false, escapeHtml(ch)); } catch (e) {}
            rtSyncState(id);
        }

        // 서식 싹 지우기 (선택 영역)
        function rtClearFormat(id) {
            const el = rtFocusEditor(id);
            if (!el) return;
            try { document.execCommand('removeFormat', false, null); } catch (e) {}
            rtSyncState(id);
        }

        // 편집 중 내용을 state에 반영
        function rtSyncState(id) {
            const el = document.getElementById(id);
            if (!el || !grammarEditorState) return;
            const key = el.dataset.stateKey;
            if (!key) return;
            // Ctrl+클릭 표시는 편집 중에만 쓰는 거라 저장할 내용에선 떼어낸다
            const html = rtStripMarks(el.innerHTML);
            // [냐냐 요청] 블록 구조 — "blocks.2.html" 같은 경로도 받는다
            const m = key.match(/^blocks\.(\d+)\.html$/);
            if (m) {
                const b = grammarEditorState.blocks && grammarEditorState.blocks[+m[1]];
                if (b) b.html = html;
                return;
            }
            grammarEditorState[key] = html;
        }

        // 목록 안에서 Tab = 수준 내리기 / Shift+Tab = 올리기
        function rtKeydown(e, id) {
            if (e.key === 'Tab') {
                e.preventDefault();
                if (e.shiftKey) rtOutdent(id); else rtIndent(id);
                return;
            }
            // [냐냐 요청] 소제목 줄에서 엔터 → 다음 줄은 보통 글로.
            //   한글 조합 중(isComposing)에는 손대지 않는다 — 그 엔터는 글자를 확정하는 엔터다
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
                if (rtEnter(id)) { e.preventDefault(); rtSyncState(id); }
            }
        }

        // 붙여넣기는 항상 정화해서 삽입 (웹에서 복사한 서식이 통째로 딸려오는 것 방지)
        function rtPaste(e, id) {
            e.preventDefault();
            const cb = e.clipboardData || window.clipboardData;
            if (!cb) return;
            const html = cb.getData('text/html');
            const text = cb.getData('text/plain');
            const safe = html ? sanitizeRichHtml(html) : escapeHtml(text || '').replace(/\r?\n/g, '<br>');
            try { document.execCommand('insertHTML', false, safe); } catch (err) {}
            rtSyncState(id);
        }

        // ============================================================
        // [냐냐 요청] 문법표 셀 병합 엔진 (가로 + 세로)
        //   저장 형태: t.merges = { "행-열": {cs, rs} }  ← 병합의 '대표 칸'만 기록
        //   rows/headers 구조는 그대로라 기존 데이터·복습 기능이 안 깨짐
        // ============================================================

        // 대표 칸이 덮고 있는(= 화면에 안 그려지는) 칸들의 집합
        function buildMergeHidden(merges) {
            const hidden = new Set();
            Object.keys(merges || {}).forEach(k => {
                const m = merges[k] || {};
                const [r, c] = k.split('-').map(Number);
                const cs = Math.max(1, m.cs || 1), rs = Math.max(1, m.rs || 1);
                for (let dr = 0; dr < rs; dr++) {
                    for (let dc = 0; dc < cs; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        hidden.add(`${r + dr}-${c + dc}`);
                    }
                }
            });
            return hidden;
        }

        // (r,c)를 덮고 있는 대표 칸 찾기 (자기 자신이 대표면 자기 자신)
        function findMergeAnchor(merges, r, c) {
            const self = merges[`${r}-${c}`];
            if (self) return { r, c, cs: self.cs || 1, rs: self.rs || 1 };
            for (const k of Object.keys(merges || {})) {
                const m = merges[k];
                const [ar, ac] = k.split('-').map(Number);
                const cs = Math.max(1, m.cs || 1), rs = Math.max(1, m.rs || 1);
                if (r >= ar && r < ar + rs && c >= ac && c < ac + cs) return { r: ar, c: ac, cs, rs };
            }
            return { r, c, cs: 1, rs: 1 };
        }

        // 직사각형이 기존 병합을 자르지 않도록, 걸치는 병합들을 흡수해 사각형을 넓힘
        function expandMergeRect(merges, rect) {
            let { r1, c1, r2, c2 } = rect;
            for (let guard = 0; guard < 30; guard++) {
                let grew = false;
                Object.keys(merges || {}).forEach(k => {
                    const m = merges[k];
                    const [ar, ac] = k.split('-').map(Number);
                    const br = ar + Math.max(1, m.rs || 1) - 1;
                    const bc = ac + Math.max(1, m.cs || 1) - 1;
                    const overlap = !(br < r1 || ar > r2 || bc < c1 || ac > c2);
                    if (!overlap) return;
                    if (ar < r1) { r1 = ar; grew = true; }
                    if (br > r2) { r2 = br; grew = true; }
                    if (ac < c1) { c1 = ac; grew = true; }
                    if (bc > c2) { c2 = bc; grew = true; }
                });
                if (!grew) break;
            }
            return { r1, c1, r2, c2 };
        }

        // 행/열이 추가·삭제될 때 병합 좌표를 따라 옮김 (안 하면 엉뚱한 칸이 합쳐져 보임)
        function remapMerges(merges, opts) {
            const out = {};
            Object.keys(merges || {}).forEach(k => {
                const m = merges[k];
                let [r, c] = k.split('-').map(Number);
                let rs = Math.max(1, m.rs || 1), cs = Math.max(1, m.cs || 1);
                if (opts.removeRow !== undefined) {
                    const x = opts.removeRow;
                    if (x >= r && x < r + rs) rs--;          // 병합 안쪽 행이 사라짐 → 높이 축소
                    else if (x < r) r--;                      // 위쪽 행이 사라짐 → 위로 이동
                    if (rs < 1) return;
                }
                if (opts.removeCol !== undefined) {
                    const x = opts.removeCol;
                    if (x >= c && x < c + cs) cs--;
                    else if (x < c) c--;
                    if (cs < 1) return;
                }
                if (opts.insertRow !== undefined) {
                    const x = opts.insertRow;
                    if (x <= r) r++;                          // 위에 줄이 끼어듦 → 통째로 아래로 밀림
                    else if (x < r + rs) rs++;                // 병합 한가운데 끼어듦 → 높이가 늘어남
                }
                if (opts.swapCols) {
                    const [a, b] = opts.swapCols;
                    // 가로 병합은 좌표를 안 건드림 — 병합을 '가로지르는' 이동은 호출 쪽(moveGeCol)에서 미리 막는다
                    if (cs === 1) { if (c === a) c = b; else if (c === b) c = a; }
                }
                if (opts.swapRows) {
                    const [a, b] = opts.swapRows;
                    // 세로 병합도 마찬가지 — 가로지르는 줄 이동은 호출 쪽에서 미리 막는다
                    if (rs === 1) { if (r === a) r = b; else if (r === b) r = a; }
                }
                if (rs === 1 && cs === 1) return;             // 병합이 풀린 건 기록할 필요 없음
                out[`${r}-${c}`] = { cs, rs };
            });
            return out;
        }

        // 칸 강조도 같은 규칙으로 따라 옮김 (기존에 안 되어 있어서 행 삭제 시 강조가 어긋났음)
        function remapCellHighlights(hl, opts) {
            const out = {};
            Object.keys(hl || {}).forEach(k => {
                let [r, c] = k.split('-').map(Number);
                if (opts.removeRow !== undefined) {
                    if (r === opts.removeRow) return;
                    if (r > opts.removeRow) r--;
                }
                if (opts.removeCol !== undefined) {
                    if (c === opts.removeCol) return;
                    if (c > opts.removeCol) c--;
                }
                if (opts.swapCols) {
                    const [a, b] = opts.swapCols;
                    if (c === a) c = b; else if (c === b) c = a;
                }
                if (opts.swapRows) {
                    const [a, b] = opts.swapRows;
                    if (r === a) r = b; else if (r === b) r = a;
                }
                out[`${r}-${c}`] = true;
            });
            return out;
        }

        // ============================================================
        // [냐냐 요청] 헤더 여러 줄 (최대 3줄) + 헤더 전용 병합
        //   저장 형태: t.headerRows   = [['인칭','인칭','뜻'], ['단수','복수','']]
        //             t.headerMerges = { "헤더줄-열": {cs, rs} }
        //   헤더 좌표와 본문 좌표가 안 섞이도록 병합 맵을 따로 둔다 (본문은 t.merges 그대로)
        //   옛 데이터(headers 한 줄짜리)는 읽을 때 자동으로 한 줄 headerRows 로 승격됨
        // ============================================================
        const GRAMMAR_MAX_HEADER_ROWS = 3;

        function getHeaderRows(t) {
            const src = (t && Array.isArray(t.headerRows) && t.headerRows.length)
                ? t.headerRows
                : [(t && t.headers) || []];
            const n = Math.max(0, ...src.map(r => (r || []).length));
            return src.map(r => {
                const a = (r || []).slice(0, n).map(x => (x == null ? '' : x));
                while (a.length < n) a.push('');
                return a;
            });
        }

        // 열 하나의 제목을 위에서부터 이어 붙임 → '인칭 - 단수' (AI 채점에 보낼 문맥용)
        function grammarColumnLabel(t, ci) {
            const hRows = getHeaderRows(t);
            const hM = (t && t.headerMerges) || {};
            const parts = [];
            hRows.forEach((_, hi) => {
                const a = findMergeAnchor(hM, hi, ci);        // 병합에 덮인 칸이면 대표 칸 글자를 가져옴
                const v = ((hRows[a.r] && hRows[a.r][a.c]) || '').toString().trim();
                if (v && !parts.includes(v)) parts.push(v);
            });
            return parts.join(' - ');
        }

        // 두 열(또는 두 줄)을 맞바꾸는 게 병합 한가운데를 가로지르는지 검사
        //   가로지르면 표가 소리 없이 무너지므로 이동 자체를 막는다
        function mergeBlocksSwap(merges, a, b, axis) {
            return Object.keys(merges || {}).some(k => {
                const m = merges[k] || {};
                const [ar, ac] = k.split('-').map(Number);
                const size = Math.max(1, (axis === 'col' ? m.cs : m.rs) || 1);
                if (size === 1) return false;
                const p1 = (axis === 'col' ? ac : ar), p2 = p1 + size - 1;
                const inA = a >= p1 && a <= p2, inB = b >= p1 && b <= p2;
                return inA !== inB;                           // 한쪽만 병합 안에 있으면 가로지름
            });
        }

        // ============================================================
        // [냐냐 요청] 노트 = 블록 목록 — 글 블록과 표 블록을 원하는 만큼, 원하는 순서로
        //   저장 형태: t.blocks = [
        //     { id, type:'text',  html, style:'plain'|'tip' },
        //     { id, type:'table', headerRows, rows, merges, headerMerges, highlightCols }
        //   ]
        //   옛 구조(desc → 표 하나 → note)는 읽을 때 블록으로 자동 승격되므로 기존 노트가 그대로 열린다.
        //   저장할 때 옛 필드도 같이 채워둔다 — 캐시에 예전 버전 앱이 남아 있어도 빈 노트로 안 보이게.
        // ============================================================
        const LEGACY_TABLE_BLOCK_ID = 'legacy-table';

        function newBlockId() {
            return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        }

        function emptyTextBlock(style) {
            return { id: newBlockId(), type: 'text', html: '', style: style === 'tip' ? 'tip' : 'plain' };
        }
        function emptyTableBlock() {
            return {
                id: newBlockId(), type: 'table',
                headerRows: [['뜻', '스페인어']], rows: [['', ''], ['', '']],
                merges: {}, headerMerges: {}, highlightCols: [0]
            };
        }

        // 표 블록의 헤더 줄·행 폭을 맞춰서 돌려줌 (옛 headers 한 줄짜리도 여기서 승격됨)
        function normalizeTableBlock(b) {
            const hr = getHeaderRows(b);
            const width = Math.max(1, (hr[0] || []).length, ...((b.rows || []).map(r => (r || []).length)));
            return {
                id: b.id || newBlockId(),
                type: 'table',
                headerRows: hr.map(r => { const a = r.slice(); while (a.length < width) a.push(''); return a; }),
                rows: (b.rows || []).map(r => (r || []).slice()),
                merges: b.merges || {},
                headerMerges: b.headerMerges || {},
                highlightCols: b.highlightCols || [0]
            };
        }

        function tableBlockHasContent(b) {
            return (b.headerRows || []).some(hr => (hr || []).some(h => (h || '').toString().trim()))
                || (b.rows || []).some(r => (r || []).some(c => (c || '').toString().trim()));
        }

        function getNoteBlocks(t) {
            if (t && Array.isArray(t.blocks) && t.blocks.length) {
                return t.blocks.map(b => (b && b.type === 'table')
                    ? normalizeTableBlock(b)
                    : { id: (b && b.id) || newBlockId(), type: 'text', html: (b && b.html) || '', style: (b && b.style === 'tip') ? 'tip' : 'plain' });
            }
            // 옛 구조 → 블록으로 승격 (표 블록 id 를 고정값으로 둬야 예전 칸 강조가 그대로 붙는다)
            const out = [];
            if (t && t.desc) out.push({ id: 'legacy-desc', type: 'text', html: t.desc, style: 'plain' });
            const legacyTable = normalizeTableBlock({
                id: LEGACY_TABLE_BLOCK_ID,
                headerRows: (t && t.headerRows) || null, headers: (t && t.headers) || [],
                rows: (t && t.rows) || [], merges: (t && t.merges) || {},
                headerMerges: (t && t.headerMerges) || {}, highlightCols: (t && t.highlightCols) || [0]
            });
            if (tableBlockHasContent(legacyTable)) out.push(legacyTable);
            if (t && t.note) out.push({ id: 'legacy-note', type: 'text', html: t.note, style: 'tip' });
            return out;
        }

        // ── 칸 강조: 노트id → { "블록id:행-열": true } ─────────────
        //   예전 데이터는 "행-열" 만 있어서, 접두사가 없으면 첫(승격된) 표 블록 것으로 본다
        function migrateCellHighlightKeys(tableId) {
            const all = grammarCellHighlights[tableId];
            if (!all) return;
            let changed = false;
            const out = {};
            Object.keys(all).forEach(k => {
                if (k.indexOf(':') < 0) { out[`${LEGACY_TABLE_BLOCK_ID}:${k}`] = true; changed = true; }
                else out[k] = true;
            });
            if (changed) grammarCellHighlights[tableId] = out;
        }

        function noteCellHighlights(tableId, blockId) {
            const all = grammarCellHighlights[tableId] || {};
            const out = {};
            Object.keys(all).forEach(k => {
                const i = k.indexOf(':');
                if (i < 0) { if (blockId === LEGACY_TABLE_BLOCK_ID) out[k] = true; }
                else if (k.slice(0, i) === blockId) out[k.slice(i + 1)] = true;
            });
            return out;
        }

        // ── 칸 ↔ 단어 연결: 노트id → { "블록id:행-열": 단어id } ─────
        function cellWordKey(blockId, ri, ci) { return `${blockId}:${ri}-${ci}`; }

        function getCellWordId(tableId, blockId, ri, ci) {
            const all = grammarCellWords[tableId];
            return all ? (all[cellWordKey(blockId, ri, ci)] || null) : null;
        }

        // 연결된 단어 객체. 단어가 지워졌으면 연결도 같이 정리하고 null
        function getCellWord(tableId, blockId, ri, ci) {
            const id = getCellWordId(tableId, blockId, ri, ci);
            if (!id) return null;
            const w = vocabulary.find(v => v.id === id);
            if (!w) { setCellWordLink(tableId, blockId, ri, ci, null); return null; }
            return w;
        }

        function setCellWordLink(tableId, blockId, ri, ci, wordId) {
            const key = cellWordKey(blockId, ri, ci);
            if (!wordId) {
                if (grammarCellWords[tableId]) {
                    delete grammarCellWords[tableId][key];
                    if (Object.keys(grammarCellWords[tableId]).length === 0) delete grammarCellWords[tableId];
                }
                return;
            }
            if (!grammarCellWords[tableId]) grammarCellWords[tableId] = {};
            grammarCellWords[tableId][key] = wordId;
        }

        // 이 노트에 연결이 하나라도 있나 (= 단어 시험처럼 쓰는 표인가)
        function noteHasCellWords(tableId) {
            const all = grammarCellWords[tableId];
            return !!(all && Object.keys(all).length);
        }

        // 카드의 연결 아이콘 → 수정창을 열고 그 표의 연결창까지 한 번에 띄운다
        //   (예전엔 수정 → 표 블록 찾기 → '단어 연결' 로 세 번 눌러야 했다)
        function openGrammarWordLinkFor(tableId) {
            if (typeof openGrammarEditor !== 'function') return;
            openGrammarEditor(tableId);
            const s = grammarEditorState;
            if (!s) return;
            const tableIdx = (s.blocks || []).map((b, i) => ({ b, i })).filter(x => x.b.type === 'table');
            if (tableIdx.length === 1) openGrammarWordLink(tableIdx[0].i);
            else if (tableIdx.length > 1) showToast("표가 여러 개예요 — 이을 표에서 '단어 연결'을 눌러주세요", "info");
            else showToast("이 노트에는 표가 없어요", "info");
        }

        // [냐냐 요청] 셀 텍스트 → 단어장 후보들 (하나만 고르지 않고 다 보여주고 고르게 한다)
        //   findVocabWordByForm 은 vocabulary 순서상 먼저 걸리는 하나만 준다. 그래서 'frío' 가
        //   freír(튀기다)의 1인칭 변형으로 잡히는 일이 생긴다 — 정확히 일치하는 걸 항상 앞에 둔다.
        function findVocabCandidates(rawCell) {
            const text = String(rawCell || '').trim();
            if (!text || typeof normalizeSpanishAnswer !== 'function') return [];
            const target = normalizeSpanishAnswer(text);
            if (!target) return [];
            const out = [];
            const seen = new Set();
            const push = (w) => { if (w && !seen.has(w.id)) { seen.add(w.id); out.push(w); } };
            // 1순위: 표기가 그대로 일치 (관사 차이는 normalizeSpanishAnswer 가 이미 흡수한다)
            vocabulary.forEach(v => { if (normalizeSpanishAnswer(v.word) === target) push(v); });
            // 2순위: 변형형 역추적 (동사 활용·복수형·형용사 성수)
            if (typeof findVocabWordByForm === 'function') push(findVocabWordByForm(text));
            return out;
        }

        function setNoteCellHighlights(tableId, blockId, map) {
            migrateCellHighlightKeys(tableId);
            const all = grammarCellHighlights[tableId] || {};
            Object.keys(all).forEach(k => { if (k.indexOf(blockId + ':') === 0) delete all[k]; });
            Object.keys(map || {}).forEach(k => { all[`${blockId}:${k}`] = true; });
            if (Object.keys(all).length) grammarCellHighlights[tableId] = all;
            else delete grammarCellHighlights[tableId];
        }

        // ============================================================
        // [냐냐 요청] 단어 연결 — 표의 스페인어 칸을 단어장 단어에 미리 이어둔다
        //   여기서 이어둔 칸만 빈칸 채점에서 단어 점수를 받는다. 채점하는 순간에 글자로
        //   추측하지 않는 게 핵심 — 'frío' 가 freír(튀기다)로 잡히는 사고를 여기서 막는다.
        // ============================================================
        let wordLinkState = null; // { tableId, blockId, title, cells:[{ri,ci,text,rowLabel,colHeader}] }

        // [냐냐 요청] 한 글자짜리 스페인어 낱말 — 전치사 a, 접속사 y·o·e·u.
        //   2글자 이상만 받던 탓에 'a' 가 단어장에 있는데도 연결 목록에 아예 안 떴다.
        //   아무 한 글자나 받으면 표의 기호·약자까지 딸려오니 실제로 쓰는 낱말만 허용한다.
        const SINGLE_LETTER_ES = new Set(['a', 'y', 'o', 'e', 'u']);

        // 스페인어 칸만 고른다 — 한글이 들어간 칸(뜻 열)과 빈 칸은 뺀다
        function isSpanishCell(text) {
            const s = String(text || '').trim();
            if (!s) return false;
            if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(s)) return false;
            if (SINGLE_LETTER_ES.has(s.toLowerCase())) return true;
            return /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,}/.test(s);
        }

        function openGrammarWordLink(bi) {
            const s = grammarEditorState;
            const b = geBlock(bi);
            if (!s || !b || b.type !== 'table') return;
            const cells = [];
            (b.rows || []).forEach((row, ri) => {
                (row || []).forEach((c, ci) => {
                    if (!isSpanishCell(c)) return;
                    // [냐냐 요청] 행 이름(row[hlCols[0]])은 뺐다. '스페인어|뜻|스페인어|뜻' 처럼 짝지어진
                    //   표에서는 한 행의 모든 칸에 같은 뜻이 붙어서 calor 옆에 '감기' 가 뜨는 식으로 어긋난다.
                    //   표 생김새가 제각각이라 제대로 짝짓기가 어려워, 틀린 뜻을 보여주느니 안 보여준다.
                    cells.push({
                        ri, ci, text: String(c).trim(),
                        colHeader: (typeof grammarColumnLabel === 'function') ? grammarColumnLabel(b, ci) : ''
                    });
                });
            });
            // [냐냐 요청] 1열을 다 하고 2열로 넘어가는 순서. 표를 세로로 읽으며 이어주기 편하게.
            cells.sort((a, z) => (a.ci - z.ci) || (a.ri - z.ri));
            wordLinkState = { tableId: s.id, blockId: b.id, bi, title: s.title || '(제목 없음)', cells };
            renderGrammarWordLink();
            document.getElementById('word-link-modal').classList.remove('hidden');
        }

        function closeGrammarWordLink() {
            document.getElementById('word-link-modal').classList.add('hidden');
            wordLinkState = null;
            renderGrammarTables();   // 조회 화면의 연결 표시 갱신
        }

        // [냐냐 요청] 연결창 안에 그 표를 같이 그린다 — 창을 옆으로 밀지 않아도 어떤 칸인지 보인다.
        //   목록과 같은 번호를 칸에도 달아서 표 ↔ 목록이 눈으로 이어지고, 칸을 누르면 그 줄로 간다.
        //   색: 초록=이어둠, 보라=후보 있음, 노랑=단어장에 없음, 회색=이을 수 없는 칸(뜻·빈칸)
        function renderWordLinkTablePreview() {
            const st = wordLinkState;
            const box = document.getElementById('word-link-table');
            if (!box) return;
            const b = st ? geBlock(st.bi) : null;
            if (!st || !b) { box.innerHTML = ''; return; }

            const numOf = {};   // "행-열" → 목록에서 몇 번째인가
            st.cells.forEach((c, i) => { numOf[`${c.ri}-${c.ci}`] = i + 1; });

            const hMerges = b.headerMerges || {};
            const hHidden = buildMergeHidden(hMerges);
            const headerRow = (b.headerRows || []).map((hr, hi) => {
                const cells = hr.map((h, ci) => {
                    if (hHidden.has(`${hi}-${ci}`)) return '';
                    const mg = hMerges[`${hi}-${ci}`];
                    const cs = mg ? Math.max(1, mg.cs || 1) : 1, rs = mg ? Math.max(1, mg.rs || 1) : 1;
                    const span = `${cs > 1 ? ` colspan="${cs}"` : ''}${rs > 1 ? ` rowspan="${rs}"` : ''}`;
                    return `<th class="px-2 py-1.5 text-[11px] font-black text-white bg-[#649fd0] border border-[#5590c2]"${span}>${escapeHtml(h)}</th>`;
                }).join('');
                return cells ? `<tr>${cells}</tr>` : '';
            }).join('');

            const tMerges = b.merges || {};
            const tHidden = buildMergeHidden(tMerges);
            const bodyRows = (b.rows || []).map((r, ri) => {
                const cells = (r || []).map((c, ci) => {
                    if (tHidden.has(`${ri}-${ci}`)) return '';
                    const mg = tMerges[`${ri}-${ci}`];
                    const cs = mg ? Math.max(1, mg.cs || 1) : 1, rs = mg ? Math.max(1, mg.rs || 1) : 1;
                    const span = `${cs > 1 ? ` colspan="${cs}"` : ''}${rs > 1 ? ` rowspan="${rs}"` : ''}`;
                    const n = numOf[`${ri}-${ci}`];
                    if (!n) return `<td class="px-2 py-1 text-[11px] text-center text-slate-400 border border-[#c3d9ec] bg-white"${span}>${escapeHtml(c || '')}</td>`;
                    const linked = getCellWord(st.tableId, st.blockId, ri, ci);
                    const tone = linked ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : (findVocabCandidates(c).length ? 'bg-violet-50 border-violet-200 text-violet-800'
                            : 'bg-amber-50 border-amber-200 text-amber-800');
                    return `<td class="p-0 border ${tone}"${span}>
                        <button type="button" onclick="wordLinkFocusCell(${n - 1})" title="목록에서 보기"
                            class="w-full px-2 py-1 flex items-center justify-center gap-1 text-[11px] font-bold hover:brightness-95">
                            <span class="text-[9px] opacity-50 tabular-nums shrink-0">${n}</span>
                            <span class="truncate">${escapeHtml(c || '')}</span>
                        </button></td>`;
                }).join('');
                return `<tr>${cells}</tr>`;
            }).join('');

            box.innerHTML = `<div class="rounded-xl border border-[#c3d9ec] overflow-hidden">
                <table class="w-full">${headerRow ? `<thead>${headerRow}</thead>` : ''}<tbody>${bodyRows}</tbody></table>
            </div>`;
        }

        // 표의 칸을 누르면 아래 목록의 그 줄로 데려간다
        function wordLinkFocusCell(i) {
            const el = document.getElementById('word-link-row-' + i);
            if (!el) return;
            // 목록 칸 안에서 그 줄이 가운데 오게 직접 계산한다.
            //   scrollIntoView 는 스크롤 상자가 여럿일 때 엉뚱한 걸 움직이거나 아예 안 먹는 경우가 있다
            const box = document.getElementById('word-link-list');
            if (box) {
                const r = el.getBoundingClientRect(), br = box.getBoundingClientRect();
                const top = box.scrollTop + (r.top - br.top) - (box.clientHeight - r.height) / 2;
                box.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
            } else {
                el.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
            // 테두리는 인라인으로 — CDN Tailwind 라 나중에 붙인 클래스는 안 만들어질 수 있다
            el.style.outline = '2px solid #8b5cf6';
            el.style.outlineOffset = '2px';
            setTimeout(() => { el.style.outline = ''; el.style.outlineOffset = ''; }, 1200);
        }

        function renderGrammarWordLink() {
            const st = wordLinkState;
            const box = document.getElementById('word-link-list');
            const sum = document.getElementById('word-link-summary');
            renderWordLinkTablePreview();
            if (!st || !box) return;

            if (!st.cells.length) {
                box.innerHTML = `<p class="text-center text-sm text-slate-400 py-8">이 표에는 이어줄 스페인어 칸이 없어요.<br><span class="text-xs">한글만 있는 칸과 빈 칸은 목록에서 빠져요.</span></p>`;
                if (sum) sum.innerHTML = '';
                return;
            }

            let linked = 0, candidate = 0, missing = 0;
            box.innerHTML = st.cells.map((c, i) => {
                const cur = getCellWord(st.tableId, st.blockId, c.ri, c.ci);
                const cands = findVocabCandidates(c.text);
                if (cur) linked++; else if (cands.length) candidate++; else missing++;

                // 열이 바뀌는 자리에 그 열의 머리글을 끼워넣는다 (1열 묶음 → 2열 묶음 순서가 눈에 보이게)
                const prev = st.cells[i - 1];
                const colHead = (!prev || prev.ci !== c.ci)
                    ? `<div class="flex items-center gap-2 px-1 ${i ? 'pt-3' : ''} pb-1">
                           <span class="text-[11px] font-extrabold text-violet-600">${c.ci + 1}열</span>
                           ${c.colHeader ? `<span class="text-[11px] font-bold text-slate-400 truncate">${escapeHtml(c.colHeader)}</span>` : ''}
                           <span class="flex-1 h-px bg-slate-100"></span>
                       </div>`
                    : '';
                const left = `
                    <span class="w-5 shrink-0 text-[11px] font-bold text-slate-300 text-right tabular-nums">${i + 1}</span>
                    <div class="min-w-0 flex-1">
                        <div class="text-sm font-extrabold text-slate-800 truncate">${escapeHtml(c.text)}</div>
                    </div>`;

                let right;
                if (cur) {
                    // [냐냐 요청] 이어둔 단어를 눌러서 어떤 단어인지 확인할 수 있게 (단어창이 위로 열린다)
                    right = `
                        <button type="button" onclick="wordLinkPeek('${cur.id}')" title="${escapeHtml(cur.meaning || '')} — 눌러서 단어창 열기"
                            class="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-2 py-1 rounded-lg truncate max-w-[45%] transition-colors">
                            <i class="fa-solid fa-link text-[9px]"></i> ${escapeHtml(cur.word)}
                        </button>
                        <button type="button" onclick="wordLinkUnset(${i})" title="연결 해제" class="w-7 h-7 shrink-0 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"><i class="fa-solid fa-link-slash text-xs"></i></button>`;
                } else if (cands.length) {
                    const opts = cands.map(w => `<option value="${w.id}">${escapeHtml(w.word)} — ${escapeHtml((w.meaning || '').slice(0, 20))}</option>`).join('');
                    right = `
                        <select id="word-link-sel-${i}" class="min-w-0 max-w-[38%] bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-violet-500">${opts}</select>
                        <!-- 잇기 전에 어떤 단어인지 먼저 보기 -->
                        <button type="button" onclick="wordLinkPeekSelected(${i})" title="고른 단어 확인하기" class="w-7 h-7 shrink-0 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50"><i class="fa-solid fa-magnifying-glass text-xs"></i></button>
                        <button type="button" onclick="wordLinkSet(${i})" class="shrink-0 text-[11px] font-bold bg-violet-600 hover:bg-violet-700 text-white px-2.5 py-1.5 rounded-lg transition-all active:scale-95">연결</button>`;
                } else {
                    // [냐냐 요청] 골라서 한 번에 등록 — 기본은 꺼둔다. la·mi 같은 문법 낱말이 섞여 있어서
                    //   '전부 등록' 은 일부러 안 만들었다 (켠 것만 등록한다)
                    right = `
                        <label class="shrink-0 flex items-center gap-1.5 text-[10px] font-bold text-slate-500 cursor-pointer select-none" title="한 번에 등록할 목록에 넣기">
                            <input type="checkbox" class="word-link-pick w-4 h-4 accent-violet-600 cursor-pointer" data-i="${i}">
                            고르기
                        </label>
                        <span class="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg shrink-0">단어장에 없음</span>
                        <button type="button" onclick="wordLinkAddWord(${i})" class="shrink-0 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1.5 rounded-lg transition-all active:scale-95"><i class="fa-solid fa-plus"></i> 추가</button>`;
                }

                return colHead + `<div id="word-link-row-${i}" class="flex items-center gap-2 px-3 py-2 rounded-xl border ${cur ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200'}">${left}${right}</div>`;
            }).join('');

            if (sum) {
                sum.innerHTML = `
                    <div class="flex flex-wrap gap-1.5 text-[11px] font-bold">
                        <span class="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700">연결됨 ${linked}</span>
                        <span class="px-2 py-1 rounded-lg bg-violet-100 text-violet-700">후보 있음 ${candidate}</span>
                        <span class="px-2 py-1 rounded-lg bg-amber-100 text-amber-700">단어장에 없음 ${missing}</span>
                    </div>`;
            }
        }

        // [냐냐 요청] 어떤 단어인지 확인 — 단어창을 띄운다.
        //   예전엔 연결창(z-60)이 단어창(z-50)을 덮어서 연결창을 아예 숨겼는데, 그러면 뒤의 표까지
        //   사라져서 어떤 칸을 이어주는 중인지 알 수가 없었다. 이제 숨기지 않고 단어창을 위로 올린다.
        //   배경 어둠도 옅게 줄여서 뒤의 연결창·표가 그대로 보인다. 단어창은 제목줄을 잡고 옮길 수 있다.
        //   z 는 클래스 대신 인라인으로 준다 — Tailwind 를 CDN 으로 쓰고 있어서 나중에 붙인
        //   z-[65] 같은 클래스는 만들어지지 않을 수 있다.
        let wordModalLifted = false;

        function liftWordModalOverWordLink() {
            const link = document.getElementById('word-link-modal');
            if (!link || link.classList.contains('hidden')) return;   // 연결창 흐름이 아니면 그대로 둔다
            const el = document.getElementById('word-modal');
            if (!el) return;
            el.style.zIndex = '65';                       // 연결창(60) 위, 확인창(70) 아래
            el.style.backgroundColor = 'rgba(0,0,0,0.2)'; // 뒤가 비쳐 보이게
            el.style.backdropFilter = 'none';
            wordModalLifted = true;
        }

        // 단어창이 닫힐 때 vocab.js 의 closeWordModal 이 부른다
        function dropWordModalAfterWordLink() {
            if (!wordModalLifted) return false;
            wordModalLifted = false;
            const el = document.getElementById('word-modal');
            if (el) { el.style.zIndex = ''; el.style.backgroundColor = ''; el.style.backdropFilter = ''; }
            // 골라서 등록하는 중이면 다음 칸으로 넘어간다.
            //   유의어 자동채우기가 도는 중이면 그게 먼저 — 그 큐가 끝나고 이어서 간다.
            const inSyn = (typeof _inSynonymFill !== 'undefined') && _inSynonymFill;
            if (wordLinkRegQueue.length && !inSyn) setTimeout(() => processWordLinkRegQueue(), 250);
            return true;
        }

        function wordLinkPeek(wordId) {
            if (!wordId) return;
            openWordModal(wordId);
            liftWordModalOverWordLink();          // 연 다음에 올린다 (openWordModal 이 위치를 되돌리므로)
            _skipContinueRegisterPrompt = true;   // 확인하러 연 거라 '계속 등록?' 은 안 물어봄
        }

        function wordLinkPeekSelected(i) {
            const sel = document.getElementById('word-link-sel-' + i);
            if (sel && sel.value) wordLinkPeek(sel.value);
        }

        function wordLinkSet(i) {
            const st = wordLinkState; if (!st) return;
            const c = st.cells[i];
            const sel = document.getElementById('word-link-sel-' + i);
            if (!c || !sel || !sel.value) return;
            setCellWordLink(st.tableId, st.blockId, c.ri, c.ci, sel.value);
            saveToStorage();
            renderGrammarWordLink();
        }

        function wordLinkUnset(i) {
            const st = wordLinkState; if (!st) return;
            const c = st.cells[i]; if (!c) return;
            setCellWordLink(st.tableId, st.blockId, c.ri, c.ci, null);
            saveToStorage();
            renderGrammarWordLink();
        }

        // 후보가 하나뿐인 칸만 자동으로 잇는다. 여러 개면 어느 걸 고를지 사람이 정해야 하니 건너뛴다
        function wordLinkAutoAll() {
            const st = wordLinkState; if (!st) return;
            let n = 0, skipped = 0;
            st.cells.forEach(c => {
                if (getCellWordId(st.tableId, st.blockId, c.ri, c.ci)) return;
                const cands = findVocabCandidates(c.text);
                if (cands.length === 1) { setCellWordLink(st.tableId, st.blockId, c.ri, c.ci, cands[0].id); n++; }
                else if (cands.length > 1) skipped++;
            });
            saveToStorage();
            renderGrammarWordLink();
            showToast(n ? `${n}개를 이었어요!${skipped ? ` (후보가 여러 개인 ${skipped}개는 직접 골라주세요)` : ''}` : "자동으로 이을 게 없어요", n ? "success" : "info");
        }

        function wordLinkClearAll() {
            const st = wordLinkState; if (!st) return;
            showConfirm("이 표의 연결을 전부 해제할까요?", "단어 점수는 그대로 두고 연결만 끊어요. 다시 이으면 돼요!", () => {
                st.cells.forEach(c => setCellWordLink(st.tableId, st.blockId, c.ri, c.ci, null));
                saveToStorage();
                renderGrammarWordLink();
                showToast("연결을 전부 해제했어요", "info");
            });
        }

        // ── [냐냐 요청] 단어장에 없는 칸 골라서 한 번에 등록 ──────────
        //   '전부 등록' 버튼은 일부러 안 만들었다. 실제로 세어보니 못 찾는 칸의 대부분이
        //   la·las·mi·mis·su 같은 문법 낱말이라, 통째로 넣으면 단어장이 오염되고 단어 시험에도 나온다.
        //   그래서 켠 것만 등록한다. 등록창은 한 창씩 차례로 열려서 확인하며 저장하면 된다.
        let wordLinkRegQueue = [];   // 등록 대기 중인 칸 번호들

        function wordLinkPickedIndexes() {
            return Array.prototype.slice.call(document.querySelectorAll('.word-link-pick:checked'))
                .map(el => Number(el.dataset.i));
        }

        function toggleAllWordLinkPicks() {
            const boxes = document.querySelectorAll('.word-link-pick');
            if (!boxes.length) return;
            const turnOn = wordLinkPickedIndexes().length < boxes.length;   // 하나라도 꺼져 있으면 전부 켜기
            boxes.forEach(el => { el.checked = turnOn; });
        }

        function startWordLinkBulkRegister() {
            const picked = wordLinkPickedIndexes();
            if (!picked.length) { showToast("등록할 칸을 먼저 골라주세요 ('고르기' 체크)", "info"); return; }
            const names = picked.map(i => (wordLinkState.cells[i] || {}).text).filter(Boolean);
            showConfirm(
                `${picked.length}개를 등록할까요?`,
                `${names.slice(0, 6).join(', ')}${names.length > 6 ? ` 외 ${names.length - 6}개` : ''}\n등록창이 한 창씩 차례로 열려요. 창을 닫으면 다음으로 넘어가요.`,
                () => { wordLinkRegQueue = picked.slice(); processWordLinkRegQueue(); },
                { okLabel: '등록 시작', cancelLabel: '취소', okStyle: 'primary', icon: 'happy' }
            );
        }

        function processWordLinkRegQueue() {
            if (!wordLinkRegQueue.length) return;
            const i = wordLinkRegQueue.shift();
            wordLinkAddWord(i);   // 한 칸 등록하는 기존 흐름을 그대로 쓴다
        }

        // 단어장에 없는 칸 → 등록창을 열어준다 (돋보기의 등록 흐름을 그대로 씀).
        //   등록을 마치고 '다시 찾기'를 누르면 후보로 잡힌다
        function wordLinkAddWord(i) {
            const st = wordLinkState; if (!st) return;
            const c = st.cells[i]; if (!c) return;
            openWordModal();
            liftWordModalOverWordLink();
            _skipContinueRegisterPrompt = true;
            const input = document.getElementById('input-word');
            if (input) {
                input.value = c.text;
                if (typeof handleWordInput === 'function') handleWordInput(c.text);
            }
            setTimeout(() => { if (typeof triggerAiAutofill === 'function') triggerAiAutofill(); }, 250);
            showToast(wordLinkRegQueue.length
                ? `${c.text} — 저장하면 다음으로 넘어가요 (${wordLinkRegQueue.length}개 남음)`
                : "등록을 마치면 '다시 찾기'를 눌러주세요!", "info");
        }

        // ── 편집기: 우클릭 메뉴 / 병합 / 분리 ──────────────────────
        let geMenuCell = null;   // { bi, ri, ci, scope }  scope: 'body' | 'header'

        // 편집 중인 표 블록의 열 개수 (헤더 첫 줄 기준)
        function geColCount(bi) {
            const b = geBlock(bi);
            return (b && b.headerRows && b.headerRows[0]) ? b.headerRows[0].length : 0;
        }

        // 스코프별로 '칸 배열 + 병합 맵'을 한 쌍으로 넘겨줌 (병합 로직을 헤더·본문이 그대로 공유)
        function geGrid(bi, scope) {
            const b = geBlock(bi);
            if (!b) return { cells: [], merges: {}, rowCount: 0 };
            if (scope === 'header') {
                if (!b.headerMerges) b.headerMerges = {};
                return { cells: b.headerRows, merges: b.headerMerges, rowCount: b.headerRows.length };
            }
            if (!b.merges) b.merges = {};
            return { cells: b.rows, merges: b.merges, rowCount: b.rows.length };
        }

        function geMerges(bi, scope) {
            return geGrid(bi, scope).merges;
        }

        // 칸 우클릭 → 방향 메뉴 띄우기 (scope: 'body' | 'header' — 헤더는 헤더끼리만 합쳐짐)
        function openGeCellMenu(ev, bi, ri, ci, scope) {
            ev.preventDefault();
            ev.stopPropagation();
            const s = grammarEditorState;
            if (!s) return;
            scope = scope === 'header' ? 'header' : 'body';
            geMenuCell = { bi, ri, ci, scope };
            const g = geGrid(bi, scope);
            const merges = g.merges;
            const anchor = findMergeAnchor(merges, ri, ci);
            const isMerged = anchor.cs > 1 || anchor.rs > 1;
            const rowCount = g.rowCount, colCount = geColCount(bi);

            const item = (label, icon, onclick, disabled) => `
                <button type="button" ${disabled ? 'disabled' : `onclick="${onclick}"`}
                    class="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-left transition-colors ${disabled ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-violet-50 hover:text-violet-700'}">
                    <i class="fa-solid ${icon} w-3.5 text-[10px]"></i>${label}
                </button>`;

            const canUp = anchor.r > 0;
            const canDown = anchor.r + anchor.rs < rowCount;
            const canLeft = anchor.c > 0;
            const canRight = anchor.c + anchor.cs < colCount;

            const menu = document.getElementById('ge-cell-menu');
            menu.innerHTML = `
                <div class="py-1">
                    ${item('위와 합치기', 'fa-arrow-up', 'mergeGeCell(\'up\')', !canUp)}
                    ${item('아래와 합치기', 'fa-arrow-down', 'mergeGeCell(\'down\')', !canDown)}
                    ${item('왼쪽과 합치기', 'fa-arrow-left', 'mergeGeCell(\'left\')', !canLeft)}
                    ${item('오른쪽과 합치기', 'fa-arrow-right', 'mergeGeCell(\'right\')', !canRight)}
                    ${isMerged ? '<div class="h-px bg-slate-100 my-1"></div>' + item('병합 분리하기', 'fa-table-cells', 'splitGeCell()') : ''}
                </div>`;
            menu.classList.remove('hidden');

            // 화면 밖으로 안 나가게 위치 보정
            const mw = 170, mh = menu.offsetHeight || 190;
            let x = ev.clientX, y = ev.clientY;
            if (x + mw > window.innerWidth - 8) x = window.innerWidth - mw - 8;
            if (y + mh > window.innerHeight - 8) y = Math.max(8, window.innerHeight - mh - 8);
            menu.style.left = x + 'px';
            menu.style.top = y + 'px';
        }

        function closeGeCellMenu() {
            const menu = document.getElementById('ge-cell-menu');
            if (menu) menu.classList.add('hidden');
            geMenuCell = null;
        }

        function mergeGeCell(dir) {
            const s = grammarEditorState;
            if (!s || !geMenuCell) return;
            const { bi, ri, ci, scope } = geMenuCell;
            closeGeCellMenu();
            const g = geGrid(bi, scope);
            const merges = g.merges;
            const a = findMergeAnchor(merges, ri, ci);

            // 현재 칸이 차지한 사각형에서 원하는 방향으로 한 칸 넓힘
            let rect = { r1: a.r, c1: a.c, r2: a.r + a.rs - 1, c2: a.c + a.cs - 1 };
            if (dir === 'up') rect.r1--;
            else if (dir === 'down') rect.r2++;
            else if (dir === 'left') rect.c1--;
            else if (dir === 'right') rect.c2++;

            if (rect.r1 < 0 || rect.c1 < 0 || rect.r2 >= g.rowCount || rect.c2 >= geColCount(bi)) {
                showToast("더 이상 합칠 칸이 없어요", "error");
                return;
            }
            // 다른 병합을 자르지 않도록 사각형 확장
            rect = expandMergeRect(merges, rect);

            // 대표 칸(왼쪽 위) 외에 내용이 있는 칸 확인
            const keepR = rect.r1, keepC = rect.c1;
            const cells = g.cells;
            const lost = [];
            for (let r = rect.r1; r <= rect.r2; r++) {
                for (let c = rect.c1; c <= rect.c2; c++) {
                    if (r === keepR && c === keepC) continue;
                    const v = (cells[r] && cells[r][c] || '').toString().trim();
                    if (v) lost.push(v);
                }
            }
            // [냐냐 요청] 대표 칸(왼쪽 위)이 비어 있고 살릴 글자가 딱 하나면 그 글자를 대표 칸으로 끌어올린다
            //   헤더 줄을 위에 새로 얹고 '뜻' 열을 세로로 합칠 때 글자가 사라지는 걸 막아줌
            if (lost.length === 1 && !((cells[keepR] && cells[keepR][keepC]) || '').toString().trim()) {
                if (!cells[keepR]) cells[keepR] = [];
                cells[keepR][keepC] = lost[0];
                lost.length = 0;
            }
            const applyMerge = () => {
                // 사각형 안의 기존 병합 제거 후 새 대표 칸 등록
                Object.keys(merges).forEach(k => {
                    const [r, c] = k.split('-').map(Number);
                    if (r >= rect.r1 && r <= rect.r2 && c >= rect.c1 && c <= rect.c2) delete merges[k];
                });
                for (let r = rect.r1; r <= rect.r2; r++) {
                    for (let c = rect.c1; c <= rect.c2; c++) {
                        if (r === keepR && c === keepC) continue;
                        if (cells[r]) cells[r][c] = '';
                    }
                }
                const cs = rect.c2 - rect.c1 + 1, rs = rect.r2 - rect.r1 + 1;
                if (cs > 1 || rs > 1) merges[`${keepR}-${keepC}`] = { cs, rs };
                renderGeTableGrid(bi);
            };
            if (!lost.length) { applyMerge(); return; }
            // [냐냐 요청] 앱 기본 확인창으로 — 브라우저 기본 confirm 은 차단되면 그냥 '아니요'가 돼버림
            showConfirm(
                "합치면 내용이 지워져요",
                `지워지는 내용: ${geLostPreview(lost)}`,
                applyMerge,
                { okLabel: '합칠래요', cancelLabel: '아니요' }
            );
        }

        function splitGeCell() {
            const s = grammarEditorState;
            if (!s || !geMenuCell) return;
            const { bi, ri, ci, scope } = geMenuCell;
            closeGeCellMenu();
            const merges = geMerges(bi, scope);
            const a = findMergeAnchor(merges, ri, ci);
            delete merges[`${a.r}-${a.c}`];
            renderGeTableGrid(bi);
        }

        async function saveGrammarEditor() {
            const s = grammarEditorState;
            s.icon = document.getElementById('ge-icon').value.trim() || '📋';
            s.title = document.getElementById('ge-title').value.trim();
            if (!s.title) { showToast("표 제목을 입력해 주세요!", "error"); return; }

            // [냐냐 요청] 글 블록 — 서식 편집기 내용을 정화해서 블록에 반영
            s.blocks.forEach((b, bi) => {
                if (b.type !== 'text') return;
                const el = document.getElementById('ge-rt-' + bi);
                if (!el) return;
                const html = sanitizeRichHtml(el.innerHTML);
                b.html = richTextToPlain(html) ? html : '';   // 알맹이가 없으면(빈 태그만) 빈 값으로
            });

            // [냐냐 요청] 표 블록 — 빈 행 정리
            //   ⚠️ 세로 병합에 덮인 행은 내용이 비어 있는 게 정상이라 그냥 지우면 표가 무너짐
            //      → 병합에 걸린 행은 남기고, 지운 행만큼 병합·강조 좌표를 보정한다
            s.blocks.forEach((b, bi) => {
                if (b.type !== 'table') return;
                b.merges = b.merges || {};
                const rowsCoveredByMerge = () => {
                    const set = new Set();
                    Object.keys(b.merges || {}).forEach(k => {
                        const m = b.merges[k];
                        const r = Number(k.split('-')[0]);
                        for (let dr = 0; dr < Math.max(1, m.rs || 1); dr++) set.add(r + dr);
                    });
                    return set;
                };
                for (let ri = b.rows.length - 1; ri >= 0; ri--) {
                    const hasText = (b.rows[ri] || []).some(c => (c || '').trim());
                    if (hasText || rowsCoveredByMerge().has(ri)) continue;
                    b.rows.splice(ri, 1);
                    b.merges = remapMerges(b.merges || {}, { removeRow: ri });
                    if (s.id) setNoteCellHighlights(s.id, b.id, remapCellHighlights(noteCellHighlights(s.id, b.id), { removeRow: ri }));
                }
                if (b.rows.length === 0) { b.rows = [new Array(geColCount(bi)).fill('')]; b.merges = {}; }
                b.headerRows = b.headerRows.map(hr => hr.map(h => (h == null ? '' : h.toString())));
            });

            // 내용이 하나도 없는 블록은 저장에서 뺀다 (빈 글 블록·빈 표가 노트에 남지 않게)
            const blocks = s.blocks.filter(b => b.type === 'text' ? !!b.html : tableBlockHasContent(b));

            // [냐냐 요청] 옛 필드도 같이 채워둔다 — 캐시에 예전 버전 앱이 남아 있어도 빈 노트로 안 보이게
            const firstTable = blocks.find(b => b.type === 'table');
            const firstPlain = blocks.find(b => b.type === 'text' && b.style !== 'tip');
            const firstTip = blocks.find(b => b.type === 'text' && b.style === 'tip');
            const tableData = {
                id: s.id, icon: s.icon, title: s.title,
                blocks: blocks,                                  // [냐냐 요청] 여기가 원본
                desc: firstPlain ? firstPlain.html : '',
                note: firstTip ? firstTip.html : '',
                headers: firstTable ? firstTable.headerRows[firstTable.headerRows.length - 1].slice() : [],
                headerRows: firstTable ? firstTable.headerRows : [],
                headerMerges: firstTable ? (firstTable.headerMerges || {}) : {},
                rows: firstTable ? firstTable.rows : [],
                merges: firstTable ? (firstTable.merges || {}) : {},
                highlightCols: firstTable ? (firstTable.highlightCols || [0]) : [0],
                _edited: true
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
                    delete grammarScores[id];        // [냐냐 요청] 점수·마스터 자격도 같이 정리
                    delete grammarTransUsed[id];
                    delete grammarCellWords[id];     // [냐냐 요청] 단어 연결도 정리
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
        // [냐냐 요청] 탭마다 마지막으로 보던 스크롤 위치. 탭을 왔다갔다해도 보던 자리로 돌아온다.
        //   왜 기억해 둬야 하나: 탭은 화면을 갈아끼우는 게 아니라 hidden 을 옮기는 방식이라
        //   스크롤 주체가 창(window) 하나뿐이다. 짧은 탭(대부분 720px = 스크롤 없음)으로 옮기는
        //   순간 브라우저가 스크롤을 0으로 깎아버려서, 돌아와도 맨 위였다.
        //   문법 탭이 제일 길어서(2,200px+, 표를 펼치면 더) 여기서 제일 크게 티가 났다.
        const tabScrollTop = {};
        function changeTab(tabId) {
            // 떠나기 전에 지금 보던 자리를 적어둔다 (깎이기 전에)
            if (activeTab && activeTab !== tabId) tabScrollTop[activeTab] = window.scrollY;
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
                // [냐냐 요청] 퀴즈 진행 중이면(quizSession 살아있음) 화면 유지. 처음/끝났을 때만 셋업 화면으로.
                const quizInProgress = (typeof quizSession !== 'undefined') && quizSession;
                if (!quizInProgress) {
                    initQuizTab();
                }
            } else if (tabId === 'games') {
                // 게임 탭 열면 메뉴로 초기화
                if (typeof resetGamesMenu === 'function') resetGamesMenu();
            } else if (tabId === 'review') {
                // [냐냐 요청] 복습 진행 중이면 화면 유지. 처음/끝났을 때만 셋업 화면으로.
                //   ⚠️ resetReviewTab()은 쓰기·단어빈칸·문법표빈칸을 전부 초기화하므로
                //      셋 중 하나라도 진행 중이면 건드리면 안 됨.
                const reviewInProgress =
                    (typeof fillState !== 'undefined' && fillState) ||
                    (typeof gfillState !== 'undefined' && gfillState) ||
                    (typeof writePracticeState !== 'undefined' && writePracticeState);
                if (typeof resetReviewTab === 'function' && !reviewInProgress) resetReviewTab();
            } else if (tabId === 'ai-feedback') {
                // [냐냐 요청] 탭 이동해도 진행 중이던 미션/결과/대화 유지.
                //   '아직 아무것도 안 한 완전 처음' 상태일 때만 초기화한다.
                //   판단 기준: 현재 모드가 기본(ko-es)이고, 미션도 없고, 결과창도 안 떠있으면 = 처음.
                const resultShown = !document.getElementById('ai-feedback-result').classList.contains('hidden');
                const freshStart = (currentAiMode === 'ko-es') && !aiCurrentKoreanSentence && !resultShown;
                if (freshStart) {
                    resetKoEsMissionState();
                }
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
                // [냐냐 요청] 탭을 왔다갔다해도 마지막에 보던 모습 그대로 둔다
                //   (예전엔 여기서 grammarOpenState 를 비워서 펼쳐둔 노트가 다 접혔다)
                renderGrammarTables();
            }

            // 펼쳐둔 것뿐 아니라 보던 자리까지 되돌린다. 처음 여는 탭은 맨 위에서 시작한다.
            //   ⚠️ requestAnimationFrame 으로 미루면 안 된다. 창이 백그라운드일 때는 프레임이
            //      돌지 않아서 복원이 영영 안 걸린다 (폰에서 앱을 잠깐 내렸다 올리면 그렇다).
            //      scrollHeight 를 한 번 읽어 레이아웃을 확정시킨 뒤 바로 세운다.
            const savedTop = tabScrollTop[tabId] || 0;
            void document.documentElement.scrollHeight;
            window.scrollTo(0, savedTop);
            // 폰트·이미지가 늦게 자리를 잡아 높이가 나중에 늘어나는 경우만 한 번 더 시도한다
            if (savedTop && Math.round(window.scrollY) !== savedTop) {
                requestAnimationFrame(() => window.scrollTo(0, savedTop));
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
            // [냐냐 요청] 문법표 약점 개수도 헤더에 (약점 + 치명적 약점)
            const grammarWeak = (typeof getAllGrammarTables === 'function' && typeof getGrammarGrade === 'function')
                ? getAllGrammarTables().filter(t => ['weak', 'critical'].includes(getGrammarGrade(t.id))).length
                : 0;

            const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
            setTxt('header-total-vocab', `${total}개`);
            setTxt('header-mastered-vocab', `${mastered}개`);
            setTxt('header-weak-vocab', `${weak}개`);
            setTxt('header-total-grammar', `${grammarTotal}개`);
            setTxt('header-mastered-grammar', `${grammarMastered}개`);
            setTxt('header-weak-grammar', `${grammarWeak}개`);
            // 모바일 핵심 통계
            setTxt('header-total-vocab-m', `${total}`);
            setTxt('header-mastered-vocab-m', `${mastered}`);
            // [냐냐 요청] 헤더 '오늘의 복습' 배너도 함께 갱신
            if (typeof renderTodayReview === 'function') renderTodayReview();
        }
