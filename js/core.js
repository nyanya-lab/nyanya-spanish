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
            renderWordList();
            updateStats();
            renderDiary();
            resetKoEsMissionState();
            updateApiKeyBadge();

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
                customGrammarTables: customGrammarTables
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
            } else {
                vocabulary = [...DEFAULT_VOCABULARY];
                nyanyaDiary = {};
                learnerProfile = { totalAnswered: 0, totalCorrect: 0, wrongByPos: {}, wrongByGrammarType: {} };
                customQuestions = [];
                selectedQuestionTopics = [];
                customGrammarTables = [];
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
                nyanyaDiary[today] = { registeredTotal: 0, masteredTotal: 0, quizTotal: 0, quizCorrect: 0, aiSessions: 0, newWordsCount: 0, newMasteredCount: 0 };
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
            }
            // 'snapshot' 타입은 touchDiarySnapshot()의 총합 갱신만으로 충분함

            saveToStorage();
            renderDiary();
        }

        // 학습 일지 렌더링
        function renderDiary() {
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
                    <div>풀이 퀴즈: <strong class="text-amber-600">${log.quizCorrect || 0}/${log.quizTotal || 0}개</strong></div>
                    <div>AI 첨삭: <strong class="text-indigo-600">${log.aiSessions || 0}회</strong></div>
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
        const GRAMMAR_TABLES = [
            {
                id: 'possessive',
                icon: '🫰',
                title: '소유형용사 (mi, tu, su...)',
                desc: '명사 앞에 붙어 "누구의"를 나타내요. 뒤에 오는 명사의 수(단·복수)에 맞춰 변해요. nuestro/vuestro만 성(남·여)도 변해요.',
                headers: ['뜻', '단수 명사 앞', '복수 명사 앞'],
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
                const override = customGrammarTables.find(c => c.id === base.id);
                result.push(override ? { ...override, isCustom: !!override._edited } : base);
            });
            // 완전히 새로 만든 사용자 표 (기본 id와 겹치지 않는 것)
            customGrammarTables.forEach(c => {
                if (!GRAMMAR_TABLES.find(b => b.id === c.id)) result.push({ ...c, isCustom: true });
            });
            return result;
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

            container.innerHTML = tables.map((t, idx) => {
                const headerRow = (t.headers || []).map(h => `<th class="text-center px-3 py-2.5 text-xs font-black text-violet-800 bg-violet-100 border border-violet-200">${escapeHtml(h)}</th>`).join('');
                const bodyRows = (t.rows || []).map((r, ri) => {
                    // 행마다 번갈아 배경색 (줄무늬) — 가독성 ↑
                    const rowBg = ri % 2 === 0 ? 'bg-white' : 'bg-violet-50/40';
                    const cells = r.map((c, ci) => {
                        // 모든 칸 동일한 크기·가운데 정렬·세로 구분선
                        const firstCol = ci === 0 ? 'font-bold text-slate-900' : 'font-medium text-slate-700';
                        return `<td class="px-3 py-2 text-sm text-center border border-slate-200 ${firstCol}">${escapeHtml(c || '')}</td>`;
                    }).join('');
                    return `<tr class="${rowBg} hover:bg-violet-100/40 transition-colors">${cells}</tr>`;
                }).join('');
                // 펼침 상태 유지 (검색 중이면 다 펼침, 아니면 기존 상태/첫번째만)
                const isOpen = query ? true : (grammarOpenState[t.id] !== undefined ? grammarOpenState[t.id] : idx === 0);
                const editBtns = `
                    <span class="flex items-center gap-1 shrink-0" onclick="event.stopPropagation();">
                        <button onclick="openGrammarEditor('${t.id}')" title="수정" class="w-7 h-7 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"><i class="fa-solid fa-pen text-xs"></i></button>
                        ${t.isCustom ? `<button onclick="deleteGrammarTable('${t.id}')" title="삭제" class="w-7 h-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"><i class="fa-solid fa-trash text-xs"></i></button>` : `<button onclick="resetGrammarTable('${t.id}')" title="기본값으로 되돌리기" class="w-7 h-7 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"><i class="fa-solid fa-rotate-left text-xs"></i></button>`}
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
                            ${t.desc ? `<p class="text-xs text-slate-500 leading-relaxed mb-3">${escapeHtml(t.desc)}</p>` : ''}
                            <div class="overflow-x-auto rounded-xl border border-slate-100">
                                <table class="w-full border-collapse">
                                    ${headerRow ? `<thead><tr>${headerRow}</tr></thead>` : ''}
                                    <tbody>${bodyRows}</tbody>
                                </table>
                            </div>
                            ${t.note ? `<p class="text-[11px] text-slate-400 mt-3 leading-relaxed bg-slate-50 rounded-lg px-3 py-2">💡 ${escapeHtml(t.note)}</p>` : ''}
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

        function renderGrammarEditorFields() {
            const s = grammarEditorState;
            if (!s) return;
            document.getElementById('ge-icon').value = s.icon;
            document.getElementById('ge-title').value = s.title;
            document.getElementById('ge-desc').value = s.desc;
            document.getElementById('ge-note').value = s.note;

            // 표 그리드 (헤더 행 + 데이터 행들)
            const grid = document.getElementById('ge-grid');
            const colCount = s.headers.length;
            let html = '<table class="border-collapse w-full"><thead><tr>';
            s.headers.forEach((h, ci) => {
                html += `<th class="p-1"><input value="${escapeAttr(h)}" oninput="updateGeHeader(${ci}, this.value)" placeholder="열 제목" class="w-full min-w-[90px] bg-violet-50 border border-violet-200 rounded-lg px-2 py-1.5 text-xs font-bold text-violet-700 focus:outline-none focus:ring-1 focus:ring-violet-400"></th>`;
            });
            html += `<th class="p-1 w-8"></th></tr></thead><tbody>`;
            s.rows.forEach((row, ri) => {
                html += '<tr>';
                for (let ci = 0; ci < colCount; ci++) {
                    const val = row[ci] || '';
                    html += `<td class="p-1"><input value="${escapeAttr(val)}" oninput="updateGeCell(${ri}, ${ci}, this.value)" class="w-full min-w-[90px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400"></td>`;
                }
                html += `<td class="p-1"><button onclick="removeGeRow(${ri})" title="행 삭제" class="text-slate-300 hover:text-red-500 px-1"><i class="fa-solid fa-circle-minus"></i></button></td>`;
                html += '</tr>';
            });
            html += '</tbody></table>';
            grid.innerHTML = html;
        }

        function escapeAttr(s) {
            return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        }
        function updateGeHeader(ci, val) { grammarEditorState.headers[ci] = val; }
        function updateGeCell(ri, ci, val) { grammarEditorState.rows[ri][ci] = val; }
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
            grammarEditorState.headers.pop();
            grammarEditorState.rows.forEach(r => r.pop());
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
                headers: s.headers, rows: s.rows, _edited: true
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
            showConfirm(
                `"${t ? t.title : '이 표'}"를 삭제할까요?`,
                "삭제한 표는 다시 꺼낼 수 없어요.",
                async () => {
                    customGrammarTables = customGrammarTables.filter(c => c.id !== id);
                    delete grammarOpenState[id];
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
                'quiz': 'nav-quiz',
                'ai-feedback': 'nav-ai',
                'records': 'nav-records',
                'grammar': 'nav-grammar'
            };
            
            Object.keys(btns).forEach(key => {
                const el = document.getElementById(btns[key]);
                if (key === tabId) {
                    el.className = "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-bold transition-all bg-violet-600 text-white shadow-md shadow-violet-100";
                } else {
                    el.className = "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium transition-all text-slate-600 hover:bg-slate-50";
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
            } else if (tabId === 'grammar') {
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

            const todayStr = getLocalDateString();
            document.getElementById('header-today-date').innerText = todayStr.slice(5).replace('-', '/'); // MM/DD
            document.getElementById('header-today-date').title = todayStr;
        }
