// TAB 4: LIVE AI TRANSLATION COACH
        let currentAiMode = 'ko-es';
        let aiCurrentWordForMission = null;
        let aiCurrentKoreanSentence = "";
        // [냐냐 요청] 이번 미션이 참고한 문법 노트와 같이 섞은 단어들 (첨삭 때 근거로 같이 넘김)
        let aiCurrentGrammarForMission = null;
        let aiCurrentExtraWordsForMission = [];
        let aiLastCorrectedText = '';   // 미션 참고 칩을 '실제로 쓴 것' 으로 추리는 데 쓴다
        let aiForcedGrammarId = null;    // [냐냐 요청] 노트에서 '이 문법으로 번역 연습'을 눌렀을 때 딱 한 번 쓰임
        let aiForcedFromReview = false;  // 그 진입이 '오늘의 문법 복습' 이었나
        //   [냐냐 기준] 곡선의 칸이 움직이는 건 '복습 배너로 시작한 그 미션' 에서뿐이다.
        //   들어오는 것만 어디서든 한다. 이번 미션이 그 복습이면 여기에 그 문법 id 가 담긴다.
        let aiMissionReviewGrammarId = null;

        // [냐냐 요청] 오늘 복습할 문법을 전부 이어서 한다. 예전엔 배너를 눌러도 가장 약한 하나만
        //   하고 끝이라, 네 개면 네 번 눌러야 했다.
        let grammarReviewQueue = [];   // 아직 안 한 문법 id 들
        let grammarReviewTotal = 0;
        let grammarReviewDone = 0;
        let grammarReviewLastNoteId = null;   // 방금 푼 문법 — 채점 뒤에 이름을 밝히는 데 쓴다

        function startGrammarReviewQueue(ids) {
            grammarReviewQueue = (ids || []).slice();
            grammarReviewTotal = grammarReviewQueue.length;
            grammarReviewDone = 0;
            if (!grammarReviewTotal) return;
            nextGrammarReviewMission();
        }

        function nextGrammarReviewMission() {
            const id = grammarReviewQueue.shift();
            if (!id) { renderGrammarReviewBar(); return; }
            renderGrammarReviewBar();
            startTranslationWithGrammar(id, true);
        }

        function endGrammarReviewQueue() {
            grammarReviewQueue = [];
            grammarReviewTotal = 0;
            grammarReviewDone = 0;
            renderGrammarReviewBar();
        }

        //   진행 줄 — 지금 몇 번째인지, 답을 내고 나면 '다음' 버튼.
        function renderGrammarReviewBar(state) {
            const box = document.getElementById('ai-grammar-review-bar');
            if (!box) return;
            if (!grammarReviewTotal) { box.classList.add('hidden'); box.innerHTML = ''; return; }
            const left = grammarReviewQueue.length;
            const at = Math.min(grammarReviewDone + (state === 'graded' ? 0 : 1), grammarReviewTotal);
            //   푸는 중에는 감춰야 하니 이름은 채점 뒤에만 쓴다 (그때 aiMissionReviewGrammarId 는 이미 비워져 있다)
            const noteId = (state === 'graded') ? grammarReviewLastNoteId : aiMissionReviewGrammarId;
            const note = (typeof getAllGrammarTables === 'function' && noteId)
                ? getAllGrammarTables().find(t => t.id === noteId) : null;
            box.classList.remove('hidden');
            box.innerHTML = `
                <div class="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2.5 flex items-center gap-3">
                    <span class="text-xs font-black text-amber-700 shrink-0">📋 문법 복습 ${state === 'graded' ? grammarReviewDone : at} / ${grammarReviewTotal}</span>
                    ${/* [냐냐 요청] 답을 내기 전에는 무슨 문법인지 감춘다 — 알면 짐작해서 쓰게 된다 */''}
                    ${(note && state === 'graded') ? `<span class="text-[11px] font-bold text-amber-600 truncate min-w-0">${escapeHtml(note.icon || '')} ${escapeHtml(note.title || '')}</span>` : ''}
                    <div class="ml-auto shrink-0">
                        ${state === 'graded'
                            ? (left
                                ? `<button onclick="nextGrammarReviewMission()" class="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all active:scale-95">다음 문법 <i class="fa-solid fa-arrow-right"></i> <span class="opacity-80">${left}개 남음</span></button>`
                                : `<button onclick="endGrammarReviewQueue()" class="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all active:scale-95">오늘 문법 복습 끝! 🎉</button>`)
                            : `<button onclick="endGrammarReviewQueue()" title="복습을 여기서 그만둡니다" class="text-[11px] font-bold text-amber-500 hover:text-amber-700 px-2 py-1">그만하기</button>`}
                    </div>
                </div>`;
        }

        // [냐냐 요청] 문법 노트 → AI 첨삭으로 바로 가서 그 문법으로 미션 생성
        //   fromReview = '오늘의 문법 복습' 으로 들어온 것. 단어와 같은 규칙을 쓰려고 표시해 둔다 —
        //   단어 곡선도 배너(오늘의 복습)로 시작한 복습에서만 앞으로 간다 (fillState.isTodayReview).
        function startTranslationWithGrammar(id, fromReview) {
            aiForcedGrammarId = id;
            aiForcedFromReview = !!fromReview;
            if (typeof changeTab === 'function') changeTab('ai-feedback');
            if (typeof switchAiMode === 'function') switchAiMode('ko-es');
            setTimeout(() => { generateAiMission(); }, 80);
        }

        // [냐냐 요청] 첨삭 결과가 나올 때, 결과의 '맨 윗줄'이 보이는 자리로 스크롤한다.
        //   결과 위에는 두 개가 겹쳐 있다 — 페이지 헤더(top-0)와 입력영역(sm 이상에서 top-14).
        //   둘의 높이를 합친 만큼 내려서 멈춰야 결과 상단이 가려지지 않는다.
        //   ⚠️ 예전엔 querySelector('.sticky') 로 입력영역을 찾았는데, 실제 클래스는
        //      'static sm:sticky' 라서 영영 못 찾았다 (높이를 0 으로 계산 → 결과 위쪽
        //      517px 이 입력칸에 덮여서, 냐냐 눈에는 결과 아랫부분만 보였다).
        // [냐냐 요청] 입력영역 고정을 켜고/끈다.
        //   입력칸이 517px 이나 돼서, 고정한 채로 결과를 보면 화면 아래 140px 틈으로만
        //   읽게 된다. 그래서 결과가 뜨는 동안에는 고정을 풀어 결과가 화면을 다 쓰게 한다.
        function setAiInputSticky(on) {
            const el = document.getElementById('ai-input-sticky');
            if (el) el.classList.toggle('ai-unstick', !on);
        }

        function scrollAiResultIntoView() {
            const resultBox = document.getElementById('ai-feedback-result');
            if (!resultBox) return;
            setAiInputSticky(false);
            const header = document.querySelector('header');
            const headerH = header && getComputedStyle(header).position === 'sticky'
                ? header.getBoundingClientRect().height : 0;
            // 입력영역은 넓은 화면에서만 고정된다 (폰에서는 같이 밀려 올라가므로 0)
            const sticky = document.getElementById('ai-input-sticky');
            const stickyH = sticky && getComputedStyle(sticky).position === 'sticky'
                ? sticky.getBoundingClientRect().height : 0;
            const top = resultBox.getBoundingClientRect().top + window.scrollY - headerH - stickyH - 12;
            window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        }

        // 결과를 닫으면(모드 변경·새 미션 뽑기) 입력영역 고정을 되살린다.
        //   숨기는 곳이 여섯 군데라 한 곳씩 고치는 대신 결과 상자를 지켜본다.
        (function watchAiResultVisibility() {
            const box = document.getElementById('ai-feedback-result');
            if (!box || typeof MutationObserver === 'undefined') return;
            new MutationObserver(() => {
                if (box.classList.contains('hidden')) setAiInputSticky(true);
            }).observe(box, { attributes: true, attributeFilter: ['class'] });
        })();

        // [냐냐 요청] 학습 팁 — 한 덩어리 줄글로 나오면 읽기 힘들어서 줄 단위로 나눠 그린다.
        //   프롬프트가 세 줄(잘한 점·규칙 설명·예시)로 주게 돼 있지만, 한 덩어리로 와도
        //   문장 끝에서 끊어 최소한의 줄나눔은 만들어 준다.
        function renderAiTip(text) {
            const el = document.getElementById('ai-coach-tip');
            const wrap = document.getElementById('ai-coach-tip-wrap');   // 총평 아래 붙는 칸 — 팁이 없으면 통째로 숨긴다
            const show = (on) => { if (wrap) wrap.classList.toggle('hidden', !on); };
            if (!el) return;
            let lines = String(text || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
            // 줄바꿈 없이 길게 왔으면 문장 단위로 쪼갠다 (예시 줄은 붙여둔 채)
            if (lines.length === 1 && lines[0].length > 60) {
                lines = lines[0].split(/(?<=[.!?])\s+(?=[^\s])/).map(s => s.trim()).filter(Boolean);
            }
            if (!lines.length) { el.innerHTML = ''; show(false); return; }
            show(true);
            el.innerHTML = lines.map(l => {
                const m = l.match(/^예시\s*[:：]\s*(.*)$/);
                if (m) {
                    // [냐냐 요청] 예시 문장은 굵게 말고 기울임으로
                    return `<div class="mt-2 pt-2 border-t border-slate-200">
                        <span class="text-[11px] font-bold text-slate-500">예시</span>
                        <span class="italic text-slate-700">${m[1]}</span>
                    </div>`;
                }
                return `<div>${l}</div>`;
            }).join('');
        }

        // [냐냐 PATCH] B-2 첨삭: '바뀐 부분' 설명 리스트 렌더링 (어순/관사 변경도 표시)
        function renderAiChanges(feedback) {
            const box = document.getElementById('ai-changes-box');
            const list = document.getElementById('ai-changes-list');
            if (!box || !list) return;
            const changes = Array.isArray(feedback.changes) ? feedback.changes.filter(c => c && (c.from || c.to)) : [];
            if (changes.length === 0) {
                box.classList.add('hidden');
                list.innerHTML = '';
                return;
            }
            box.classList.remove('hidden');
            // [냐냐 요청] 사유 글씨가 작고 흐려서 잘 안 읽혔다 — 사유를 흰 칸에 담고
            //   글씨를 키우고(11px→13px) 진하게, 바뀐 말과 사유를 세로로 확실히 나눈다
            list.innerHTML = changes.map(c => {
                const from = (c.from || '').trim();
                const to = (c.to || '').trim();
                const why = (c.why || '').trim();
                return `<li class="bg-white rounded-xl px-3 py-2 border border-red-100/70 space-y-1">
                    <div class="text-sm leading-relaxed">
                        <span class="text-slate-400 line-through">${from}</span>
                        <span class="text-slate-300 mx-1">→</span>
                        <span class="text-red-600 font-extrabold">${to}</span>
                    </div>
                    ${why ? `<div class="text-[13px] text-slate-600 leading-relaxed">${why}</div>` : ''}
                </li>`;
            }).join('');
        }

        function switchAiMode(mode) {
            currentAiMode = mode;
            const btnKoEs = document.getElementById('ai-mode-btn-ko-es');
            const btnEsKo = document.getElementById('ai-mode-btn-es-ko');
            const btnQuestion = document.getElementById('ai-mode-btn-question');
            const btnExample = document.getElementById('ai-mode-btn-example');
            const btnNote = document.getElementById('ai-mode-btn-note');
            const paneKoEs = document.getElementById('ai-pane-ko-es');
            const paneEsKo = document.getElementById('ai-pane-es-ko');
            const paneQuestion = document.getElementById('ai-pane-question');
            const paneExample = document.getElementById('ai-pane-example');
            const paneNote = document.getElementById('ai-pane-note');
            const resultBox = document.getElementById('ai-feedback-result');

            resultBox.classList.add('hidden');

            const activeClass = "py-2.5 rounded-lg text-xs font-bold transition-all bg-white text-slate-900 shadow-sm";
            const inactiveClass = "py-2.5 rounded-lg text-xs font-bold transition-all text-slate-500 hover:text-slate-900";
            btnKoEs.className = mode === 'ko-es' ? activeClass : inactiveClass;
            btnEsKo.className = mode === 'es-ko' ? activeClass : inactiveClass;
            btnQuestion.className = mode === 'question' ? activeClass : inactiveClass;
            if (btnExample) btnExample.className = mode === 'example' ? activeClass : inactiveClass;
            if (btnNote) btnNote.className = mode === 'note' ? activeClass : inactiveClass;
            paneKoEs.classList.toggle('hidden', mode !== 'ko-es');
            paneEsKo.classList.toggle('hidden', mode !== 'es-ko');
            paneQuestion.classList.toggle('hidden', mode !== 'question');
            if (paneExample) paneExample.classList.toggle('hidden', mode !== 'example');
            // 첨삭 노트는 쓰는 화면이 아니라 보는 화면이라 sticky 바깥에 있다.
            //   입력칸 넷이 다 접히므로 위에는 버튼 줄만 남는다.
            if (paneNote) paneNote.classList.toggle('hidden', mode !== 'note');

            if (mode === 'ko-es') {
                resetKoEsMissionState();
            } else if (mode === 'es-ko') {
                document.getElementById('ai-free-input-es').value = '';
            } else if (mode === 'question') {
                // 질문 목록은 '질문 관리' 모달에서 보여주므로 여기선 별도 처리 불필요
            } else if (mode === 'example') {
                resetExampleMissionState();
            } else if (mode === 'note') {
                // 들어올 때마다 '틀린 것만' 부터. 펼쳐 둔 총평도 접고 시작한다
                aiNoteFilter = 'wrong';
                aiNoteShown = AI_NOTE_PAGE;
                aiNoteOpen = {};
                renderAiNoteList();
            }
        }

        // [PATCH] 스->한 자유 작문 모드: 첨삭 후 다음 문장을 쓸 수 있도록 입력칸/결과창을 초기화
        function resetEsKoPane() {
            document.getElementById('ai-free-input-es').value = '';
            document.getElementById('ai-feedback-result').classList.add('hidden');
            document.getElementById('ai-free-input-es').focus();
        }

        // ============================================================
        // [냐냐 PATCH] 질문에 답하기 코너
        // ============================================================
        // ── 질문 관리 모달 ──
        function openQuestionManageModal() {
            document.getElementById('question-manage-modal').classList.remove('hidden');
            document.getElementById('question-search-input').value = '';
            renderCustomQuestionsList();
            refreshTopicsDatalist();
        }
        function closeQuestionManageModal() {
            document.getElementById('question-manage-modal').classList.add('hidden');
        }

        // [냐냐 PATCH] 드롭다운에서 숨긴 주제 목록 (질문은 유지, 목록에서만 숨김)
        // hiddenQuestionTopics는 core.js 전역에서 관리됨
        function refreshTopicsDatalist() {
            const sel = document.getElementById('new-question-topic-select');
            if (!sel) return;
            const prev = sel.value;
            const allTopics = [...new Set(customQuestions.map(q => q.topic).filter(Boolean))];
            const visible = allTopics.filter(t => !hiddenQuestionTopics.includes(t));
            let html = '';
            if (visible.length > 0) {
                html += visible.map(t => `<option value="${t.replace(/"/g, '&quot;')}">${t}</option>`).join('');
            }
            html += `<option value="__new__">➕ 새 주제 입력...</option>`;
            sel.innerHTML = html;
            // 이전 선택 유지 (있으면)
            if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
            onTopicSelectChange();
        }
        // 드롭다운에서 '새 주제'를 고르면 텍스트 입력칸 표시
        function onTopicSelectChange() {
            const sel = document.getElementById('new-question-topic-select');
            const input = document.getElementById('new-question-topic-input');
            if (!sel || !input) return;
            if (sel.value === '__new__') {
                input.classList.remove('hidden');
                input.focus();
            } else {
                input.classList.add('hidden');
            }
        }

        function addCustomQuestion() {
            const input = document.getElementById('new-question-input');
            const sel = document.getElementById('new-question-topic-select');
            const topicInput = document.getElementById('new-question-topic-input');
            const text = input.value.trim();
            // 주제: 드롭다운이 '새 주제'면 입력칸 값, 아니면 선택값
            let topic;
            if (sel && sel.value === '__new__') {
                topic = topicInput.value.trim() || '기타';
            } else {
                topic = (sel && sel.value) ? sel.value : '기타';
            }
            if (!text) {
                showToast("질문 내용을 입력해 주세요!", "error");
                return;
            }
            // [냐냐 PATCH] 같은 주제에 중복 질문 확인
            const dup = customQuestions.find(q => (q.topic || '기타') === topic && q.question.trim().toLowerCase() === text.toLowerCase());
            if (dup) {
                showToast(`'${topic}' 주제에 이미 같은 질문이 있어요!`, "error");
                return;
            }
            customQuestions.push({ id: 'q-' + Date.now(), question: text, topic: topic });
            input.value = '';
            // 새로 만든 주제가 숨김 목록에 있었으면 다시 보이게
            const hi = hiddenQuestionTopics.indexOf(topic);
            if (hi >= 0) hiddenQuestionTopics.splice(hi, 1);
            saveToStorage();
            renderCustomQuestionsList();
            refreshTopicsDatalist();
            if (sel) sel.value = topic; // 방금 등록한 주제 유지
            onTopicSelectChange();
            showToast(`'${topic}' 주제에 질문을 등록했어요! 📝`, "success");
        }

        // ── 주제 관리 모달 (드롭다운에서 숨기기/보이기) ──
        function openTopicManageModal() {
            renderTopicManageList();
            document.getElementById('topic-manage-modal').classList.remove('hidden');
        }
        function closeTopicManageModal() {
            document.getElementById('topic-manage-modal').classList.add('hidden');
        }
        function renderTopicManageList() {
            const box = document.getElementById('topic-manage-list');
            if (!box) return;
            const counts = {};
            customQuestions.forEach(q => { const t = q.topic || '기타'; counts[t] = (counts[t] || 0) + 1; });
            const topics = Object.keys(counts);
            if (topics.length === 0) {
                box.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">등록된 주제가 없어요.</p>`;
                return;
            }
            box.innerHTML = topics.map(t => {
                const hidden = hiddenQuestionTopics.includes(t);
                return `<div class="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border ${hidden ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-200'}">
                    <span class="flex items-center gap-2 min-w-0">
                        <span class="text-xs font-bold ${hidden ? 'text-slate-400 line-through' : 'text-slate-700'} truncate">${t}</span>
                        <span class="text-[10px] text-slate-400 shrink-0">${counts[t]}개</span>
                    </span>
                    <button onclick="toggleHiddenTopic('${t.replace(/'/g, "\\'")}')" title="${hidden ? '드롭다운에 다시 보이기' : '드롭다운에서 숨기기'}" class="shrink-0 ${hidden ? 'text-slate-400 hover:text-violet-500' : 'text-slate-300 hover:text-rose-500'} transition-colors px-1">
                        <i class="fa-solid ${hidden ? 'fa-eye' : 'fa-trash-can'} text-xs"></i>
                    </button>
                </div>`;
            }).join('');
        }
        async function toggleHiddenTopic(topic) {
            const i = hiddenQuestionTopics.indexOf(topic);
            if (i >= 0) hiddenQuestionTopics.splice(i, 1);
            else hiddenQuestionTopics.push(topic);
            await saveToStorage();
            renderTopicManageList();
            refreshTopicsDatalist();
        }

        function deleteCustomQuestion(id) {
            customQuestions = customQuestions.filter(q => q.id !== id);
            saveToStorage();
            renderCustomQuestionsList();
            refreshTopicsDatalist();
        }

        // 주제별로 묶어서 보여주기 (+ 검색 필터 + 수정 버튼)
        // [냐냐 PATCH] 질문 관리: 주제별 접기/펼치기 상태 (기본 접힘)
        let questionTopicOpen = {};
        function toggleQuestionTopic(topic) {
            questionTopicOpen[topic] = !questionTopicOpen[topic];
            renderCustomQuestionsList();
        }
        // [냐냐 PATCH] 주제 이름 수정 — 그 주제의 모든 질문을 새 이름으로 옮김
        let _renamingTopic = null;
        function editQuestionTopic(topic) {
            _renamingTopic = topic;
            const input = document.getElementById('topic-rename-input');
            if (input) input.value = topic;
            const label = document.getElementById('topic-rename-old');
            if (label) label.innerText = topic;
            document.getElementById('topic-rename-modal').classList.remove('hidden');
            setTimeout(() => { if (input) input.focus(); }, 50);
        }
        function closeTopicRenameModal() {
            document.getElementById('topic-rename-modal').classList.add('hidden');
            _renamingTopic = null;
        }
        async function saveTopicRename() {
            const newName = (document.getElementById('topic-rename-input').value || '').trim();
            if (!newName) { showToast("주제 이름을 입력해 주세요!", "error"); return; }
            if (_renamingTopic === null) return;
            if (newName === _renamingTopic) { closeTopicRenameModal(); return; }
            let count = 0;
            customQuestions.forEach(q => {
                if ((q.topic || '기타') === _renamingTopic) { q.topic = newName; count++; }
            });
            // 접힘 상태도 새 이름으로 옮김
            if (questionTopicOpen[_renamingTopic] !== undefined) {
                questionTopicOpen[newName] = questionTopicOpen[_renamingTopic];
                delete questionTopicOpen[_renamingTopic];
            }
            await saveToStorage();
            renderCustomQuestionsList();
            refreshTopicsDatalist();
            closeTopicRenameModal();
            showToast(`주제 이름을 "${newName}"(으)로 바꿨어요 (질문 ${count}개)`, "success");
        }

        function deleteQuestionTopic(topic) {
            const qs = customQuestions.filter(q => (q.topic || '기타') === topic);
            showConfirm(
                `"${topic}" 주제를 통째로 삭제할까요?`,
                `이 주제의 질문 ${qs.length}개가 모두 삭제돼요. 되돌릴 수 없어요.`,
                async () => {
                    customQuestions = customQuestions.filter(q => (q.topic || '기타') !== topic);
                    await saveToStorage();
                    renderCustomQuestionsList();
                    refreshTopicsDatalist();
                    showToast(`"${topic}" 주제를 삭제했어요`, "success");
                }
            );
        }

        function renderCustomQuestionsList() {
            const box = document.getElementById('question-list-box');
            if (!box) return;
            // [냐냐 PATCH] 전체 질문 개수 항상 표시
            const totalEl = document.getElementById('question-total-count');
            if (totalEl) totalEl.innerText = customQuestions.length > 0 ? `총 ${customQuestions.length}개` : '';
            const searchVal = (document.getElementById('question-search-input')?.value || '').trim().toLowerCase();

            const filtered = customQuestions.filter(q =>
                !searchVal || q.question.toLowerCase().includes(searchVal) || (q.topic || '').toLowerCase().includes(searchVal)
            );

            if (filtered.length === 0) {
                box.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">${customQuestions.length === 0 ? '등록된 질문이 없어요. 위에서 추가해 보세요!' : '검색 결과가 없어요.'}</p>`;
                return;
            }

            const groups = {};
            filtered.forEach(q => {
                const t = q.topic || '기타';
                if (!groups[t]) groups[t] = [];
                groups[t].push(q);
            });
            // [냐냐 PATCH] 각 주제 안의 질문은 ABC 오름차순 정렬
            Object.values(groups).forEach(qs => qs.sort((a, b) => a.question.localeCompare(b.question, 'es', { sensitivity: 'base' })));
            // [냐냐 PATCH] 주제는 내림차순 정렬
            const sortedTopics = Object.keys(groups).sort((a, b) => b.localeCompare(a, 'ko'));

            // 검색 중이면 다 펼침, 아니면 저장된 상태(기본 접힘)
            const searching = !!searchVal;

            box.innerHTML = sortedTopics.map(topic => {
                const qs = groups[topic];
                const isOpen = searching ? true : !!questionTopicOpen[topic];
                return `
                <div class="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                    <div class="flex items-center justify-between gap-2 px-3 py-2">
                        <button onclick="toggleQuestionTopic('${topic.replace(/'/g, "\\'")}')" class="flex items-center gap-2 flex-1 min-w-0 text-left">
                            <i class="fa-solid fa-chevron-right text-[10px] text-slate-400 transition-transform shrink-0" style="${isOpen ? 'transform:rotate(90deg);' : ''}"></i>
                            <span class="text-[11px] font-extrabold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full truncate">${topic}</span>
                            <span class="text-[10px] text-slate-400 shrink-0">${qs.length}개</span>
                        </button>
                        <div class="flex items-center shrink-0">
                            <button onclick="editQuestionTopic('${topic.replace(/'/g, "\\'")}')" title="주제 이름 수정" class="text-slate-300 hover:text-violet-500 transition-colors px-1"><i class="fa-solid fa-pen text-xs"></i></button>
                            <button onclick="deleteQuestionTopic('${topic.replace(/'/g, "\\'")}')" title="주제 전체 삭제" class="text-slate-300 hover:text-rose-500 transition-colors px-1"><i class="fa-solid fa-trash-can text-xs"></i></button>
                        </div>
                    </div>
                    <div class="${isOpen ? '' : 'hidden'} px-2 pb-2 space-y-1.5">
                        ${qs.map(q => `
                            <div class="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-100 text-xs gap-2">
                                <span class="text-slate-700 font-semibold truncate pr-1 flex-1">${q.question}</span>
                                <button onclick="openQuestionEditModal('${q.id}')" class="text-slate-300 hover:text-violet-500 transition-colors shrink-0"><i class="fa-solid fa-pen"></i></button>
                                <button onclick="deleteCustomQuestion('${q.id}')" class="text-slate-300 hover:text-rose-500 transition-colors shrink-0"><i class="fa-solid fa-trash-can"></i></button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            }).join('');
        }

        // ── 질문 수정 ──
        function openQuestionEditModal(id) {
            const q = customQuestions.find(item => item.id === id);
            if (!q) return;
            document.getElementById('edit-question-id').value = q.id;
            document.getElementById('edit-question-topic-input').value = q.topic || '기타';
            document.getElementById('edit-question-input').value = q.question;
            document.getElementById('question-edit-modal').classList.remove('hidden');
        }
        function closeQuestionEditModal() {
            document.getElementById('question-edit-modal').classList.add('hidden');
        }
        function saveEditedQuestion() {
            const id = document.getElementById('edit-question-id').value;
            const newText = document.getElementById('edit-question-input').value.trim();
            const newTopic = document.getElementById('edit-question-topic-input').value.trim() || '기타';
            if (!newText) {
                showToast("질문 내용을 입력해 주세요!", "error");
                return;
            }
            const q = customQuestions.find(item => item.id === id);
            if (q) {
                q.question = newText;
                q.topic = newTopic;
                saveToStorage();
                renderCustomQuestionsList();
                refreshTopicsDatalist();
                closeQuestionEditModal();
                showToast("질문을 수정했어요! ✏️", "success");
            }
        }

        // ── 랜덤 질문 주제 설정 모달 (체크박스 다중선택, 설정 저장) ──
        function openTopicPickerModal() {
            if (customQuestions.length === 0) {
                showToast("먼저 '질문 관리'에서 질문을 등록해 주세요!", "error");
                return;
            }
            // 저장해 둔 섞기 비율을 슬라이더에 반영
            const mixRange = document.getElementById('question-ai-mix-range');
            if (mixRange) mixRange.value = String(questionAiMix);
            const mixLabel = document.getElementById('question-ai-mix-label');
            if (mixLabel) mixLabel.innerText = questionAiMix + '%';

            const listBox = document.getElementById('topic-picker-list');
            const topics = [...new Set(customQuestions.map(q => q.topic || '기타'))];

            // 저장된 선택이 비어있으면(=전체) 모두 체크된 상태로 보여줌
            const allSelected = selectedQuestionTopics.length === 0;

            listBox.innerHTML = `
                <label class="flex items-center gap-2 bg-violet-50 px-4 py-3 rounded-xl cursor-pointer border border-violet-100">
                    <input type="checkbox" id="topic-check-all" onchange="toggleAllTopicChecks(this.checked)" ${allSelected ? 'checked' : ''} class="w-4 h-4 accent-violet-600">
                    <span class="text-sm font-bold text-violet-700">전체 주제</span>
                </label>
                <div class="h-px bg-slate-100 my-1"></div>
            ` + topics.map(t => {
                const count = customQuestions.filter(q => (q.topic || '기타') === t).length;
                const checked = allSelected || selectedQuestionTopics.includes(t);
                return `
                    <label class="flex items-center justify-between gap-2 bg-slate-50 px-4 py-3 rounded-xl cursor-pointer border border-slate-100 hover:bg-violet-50 transition-colors">
                        <span class="flex items-center gap-2">
                            <input type="checkbox" data-topic-check="${t.replace(/"/g, '&quot;')}" onchange="onTopicCheckChange()" ${checked ? 'checked' : ''} class="w-4 h-4 accent-violet-600">
                            <span class="text-sm font-semibold text-slate-700">${t}</span>
                        </span>
                        <span class="text-xs text-slate-400">${count}개</span>
                    </label>
                `;
            }).join('');

            document.getElementById('topic-picker-modal').classList.remove('hidden');
        }
        function closeTopicPickerModal() {
            document.getElementById('topic-picker-modal').classList.add('hidden');
        }
        function toggleAllTopicChecks(checked) {
            document.querySelectorAll('[data-topic-check]').forEach(cb => { cb.checked = checked; });
        }
        function onTopicCheckChange() {
            // 개별 체크가 모두 켜졌는지 보고 '전체' 체크 상태 동기화
            const all = [...document.querySelectorAll('[data-topic-check]')];
            const allChecked = all.length > 0 && all.every(cb => cb.checked);
            const allBox = document.getElementById('topic-check-all');
            if (allBox) allBox.checked = allChecked;
        }
        function saveTopicSelection() {
            const all = [...document.querySelectorAll('[data-topic-check]')];
            const checkedTopics = all.filter(cb => cb.checked).map(cb => cb.getAttribute('data-topic-check'));
            if (checkedTopics.length === 0) {
                showToast("최소 한 개 주제는 선택해 주세요!", "error");
                return;
            }
            // 전부 선택이면 빈 배열로 저장(= 전체)해서 새 주제가 생겨도 자동 포함되게 함
            selectedQuestionTopics = (checkedTopics.length === all.length) ? [] : checkedTopics;
            saveToStorage();
            closeTopicPickerModal();
            const label = selectedQuestionTopics.length === 0 ? '전체 주제' : selectedQuestionTopics.join(', ');
            showToast(`랜덤 뽑기 주제를 '${label}'(으)로 설정했어요! 🎯`, "success");
        }

        // ============================================================
        // [냐냐 요청] 랜덤 뽑기에 AI가 만든 질문을 섞는다.
        //   예전엔 등록한 질문만 돌고 돌았다. AI 질문은 답변을 제출한 뒤
        //   '연관 질문' 버튼으로만 나왔고 일회성이라 모을 수도 없었다.
        //   재료는 내가 등록한 질문의 주제 — 결이 비슷해서 이질감이 적다.
        // ============================================================
        const QUESTION_AI_MIX_KEY = 'nyanya_question_ai_mix';
        let questionAiMix = 30; // %
        function loadQuestionAiMix() {
            try {
                const v = parseInt(localStorage.getItem(QUESTION_AI_MIX_KEY) || '', 10);
                if (!isNaN(v)) questionAiMix = Math.min(100, Math.max(0, v));
            } catch (e) {}
        }
        function setQuestionAiMix(v) {
            questionAiMix = Math.min(100, Math.max(0, parseInt(v, 10) || 0));
            const lab = document.getElementById('question-ai-mix-label');
            if (lab) lab.innerText = questionAiMix + '%';
            try { localStorage.setItem(QUESTION_AI_MIX_KEY, String(questionAiMix)); } catch (e) {}
        }
        loadQuestionAiMix();

        // AI가 만든 질문일 때만 '이 질문 저장' 버튼을 보여준다
        function updateSaveAiQuestionBtn() {
            const btn = document.getElementById('question-save-ai-btn');
            if (!btn) return;
            const q = currentQuestionForAnswer;
            const savable = !!(q && q._aiMade && !q._saved);
            btn.classList.toggle('hidden', !savable);
        }
        function saveAiQuestion() {
            const q = currentQuestionForAnswer;
            if (!q || !q._aiMade) return;
            const topic = q.topic || '기타';
            const text = String(q.question || '').trim();
            if (!text) return;
            const dup = customQuestions.find(x => (x.topic || '기타') === topic
                && x.question.trim().toLowerCase() === text.toLowerCase());
            if (dup) { showToast(`'${topic}' 주제에 이미 같은 질문이 있어요!`, "info"); q._saved = true; updateSaveAiQuestionBtn(); return; }
            customQuestions.push({ id: 'q-' + Date.now(), question: text, topic: topic });
            q._saved = true;
            const hi = hiddenQuestionTopics.indexOf(topic);
            if (hi >= 0) hiddenQuestionTopics.splice(hi, 1);
            saveToStorage();
            if (typeof renderCustomQuestionsList === 'function') renderCustomQuestionsList();
            if (typeof refreshTopicsDatalist === 'function') refreshTopicsDatalist();
            updateSaveAiQuestionBtn();
            showToast(`'${topic}' 주제에 질문을 저장했어요! 📝`, "success");
        }

        // 주제를 재료로 새 질문 하나를 만든다. 실패하면 null (부르는 쪽이 등록 질문으로 넘어간다)
        async function generateTopicQuestion(pool) {
            const topics = [...new Set(pool.map(q => q.topic || '기타'))];
            // 결을 잡아주려고 그 주제의 기존 질문을 몇 개 보여준다. 겹치지 말라고도 일러둔다.
            const samples = pool.slice().sort(() => Math.random() - 0.5).slice(0, 8)
                .map(q => `- [${q.topic || '기타'}] ${q.question}`);
            const prompt = `Topics: ${topics.join(', ')}
            Questions the student already has (do NOT repeat or lightly reword these):
            ${samples.join('\n            ')}

            Write ONE new Spanish question on one of those topics, in the same spirit and difficulty as the examples. It must be answerable from personal experience.
            ${buildLearnerProfileSummary()}`;
            const system = `You are a friendly Spanish conversation partner for a learner named "냐냐".
            Return JSON matching this schema:
            {
               "question": "The new question in Spanish",
               "koreanHint": "Korean meaning of the question, 1 sentence",
               "topic": "EXACTLY one of the given topics, copied verbatim"
            }
            Do not wrap JSON in markdown.`;
            const schema = {
                type: "OBJECT",
                properties: {
                    question: { type: "STRING" },
                    koreanHint: { type: "STRING" },
                    topic: { type: "STRING" }
                },
                required: ["question", "koreanHint", "topic"]
            };
            try {
                const data = extractAndParseJson(await callGemini(prompt, system, schema, 'low'));
                if (!data || !String(data.question || '').trim()) return null;
                return {
                    id: 'ai-' + Date.now(),
                    question: String(data.question).trim(),
                    topic: topics.includes(data.topic) ? data.topic : (topics[0] || '기타'),
                    koreanHint: data.koreanHint || '',
                    _aiMade: true
                };
            } catch (e) {
                console.warn('AI 질문 생성 실패, 등록 질문으로 대신함', e);
                return null;
            }
        }

        async function pickRandomQuestion() {
            if (customQuestions.length === 0) {
                showToast("먼저 '질문 관리'에서 질문을 등록해 주세요!", "error");
                return;
            }
            // 저장된 주제 설정에 따라 후보군 결정 (빈 배열이면 전체)
            const pool = selectedQuestionTopics.length === 0
                ? customQuestions
                : customQuestions.filter(q => selectedQuestionTopics.includes(q.topic || '기타'));

            if (pool.length === 0) {
                showToast("설정한 주제에 질문이 없어요. '주제 설정'에서 다시 골라주세요!", "error");
                return;
            }

            // 주사위를 굴려 AI 차례면 새로 만든다. 키가 없거나 실패하면 조용히 등록 질문으로.
            let picked = null;
            if (questionAiMix > 0 && Math.random() * 100 < questionAiMix && hasGeminiApiKey()) {
                const btn = document.getElementById('question-pick-btn');
                const original = btn ? btn.innerHTML : '';
                if (btn) { btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> <span>만드는 중...</span>`; }
                try { picked = await generateTopicQuestion(pool); }
                finally { if (btn) { btn.disabled = false; btn.innerHTML = original; } }
            }
            if (!picked) picked = pool[Math.floor(Math.random() * pool.length)];
            currentQuestionForAnswer = picked;
            updateSaveAiQuestionBtn();
            document.getElementById('question-display-text').innerText = currentQuestionForAnswer.question;
            // [냐냐 PATCH] 주제는 기본적으로 숨김 (정답 유추 방지) — '주제 보기' 눌러야 보임
            const topicBadge = document.getElementById('question-topic-badge');
            const revealBtn = document.getElementById('question-topic-reveal-btn');
            if (topicBadge) topicBadge.innerText = '주제 보기';
            if (revealBtn) {
                revealBtn.classList.remove('bg-violet-600', 'text-white');
                revealBtn.classList.add('bg-white', 'text-violet-600');
                const icon = revealBtn.querySelector('i');
                if (icon) icon.className = 'fa-solid fa-eye text-[10px]';
            }
            document.getElementById('question-answer-input').value = '';
            document.getElementById('question-answer-input').disabled = false;
            document.getElementById('ai-feedback-result').classList.add('hidden');
            document.getElementById('question-followup-btn')?.classList.add('hidden');
            document.getElementById('question-translation-text')?.classList.add('hidden'); // 해석 숨김
            AudioFX.playPunch();
        }

        // [냐냐 PATCH] 주제 보기/숨기기 토글
        function toggleTopicReveal() {
            const topicBadge = document.getElementById('question-topic-badge');
            const revealBtn = document.getElementById('question-topic-reveal-btn');
            if (!topicBadge || !revealBtn || !currentQuestionForAnswer) {
                if (!currentQuestionForAnswer) showToast("먼저 '랜덤 질문 뽑기'를 눌러주세요!", "info");
                return;
            }
            const icon = revealBtn.querySelector('i');
            const isHidden = topicBadge.innerText === '주제 보기';
            if (isHidden) {
                topicBadge.innerText = currentQuestionForAnswer._isFollowup ? (currentQuestionForAnswer.koreanHint || '연관 질문') : (currentQuestionForAnswer.topic || '기타');
                revealBtn.classList.remove('bg-white', 'text-violet-600');
                revealBtn.classList.add('bg-violet-600', 'text-white');
                if (icon) icon.className = 'fa-solid fa-eye-slash text-[10px]';
            } else {
                topicBadge.innerText = '주제 보기';
                revealBtn.classList.remove('bg-violet-600', 'text-white');
                revealBtn.classList.add('bg-white', 'text-violet-600');
                if (icon) icon.className = 'fa-solid fa-eye text-[10px]';
            }
        }

        // [냐냐 PATCH] 질문 답하기 - 스페인어 질문 읽어주기 (item 2)
        function speakCurrentQuestion() {
            if (currentQuestionForAnswer && currentQuestionForAnswer.question) {
                speakSpanishVoice(currentQuestionForAnswer.question, 0.9);
            } else {
                showToast("먼저 '랜덤 질문 뽑기'를 눌러주세요!", "info");
            }
        }

        // [냐냐 PATCH] 스→한 자유작문 - 내가 쓴 스페인어 읽어주기
        function speakEsKoInput() {
            const el = document.getElementById('ai-free-input-es');
            const text = el ? el.value.trim() : '';
            if (text) {
                speakSpanishVoice(text, 0.9);
            } else {
                showToast("먼저 스페인어 문장을 입력해 주세요!", "info");
            }
        }

        // [냐냐 PATCH] 질문 해석 보기/숨기기 (AI로 한국어 번역, 결과 캐시) — item 6
        async function toggleQuestionTranslation() {
            const transEl = document.getElementById('question-translation-text');
            const btn = document.getElementById('question-translate-btn');
            if (!transEl || !currentQuestionForAnswer) {
                if (!currentQuestionForAnswer) showToast("먼저 '랜덤 질문 뽑기'를 눌러주세요!", "info");
                return;
            }
            // 이미 보이면 숨김
            if (!transEl.classList.contains('hidden')) {
                transEl.classList.add('hidden');
                return;
            }
            // 이미 번역해둔 게 있으면 바로 표시
            if (currentQuestionForAnswer._koreanTranslation) {
                transEl.innerText = '💬 ' + currentQuestionForAnswer._koreanTranslation;
                transEl.classList.remove('hidden');
                return;
            }
            // AI로 번역
            if (!hasGeminiApiKey()) {
                showToast("Gemini API 키가 필요해요. 우측 상단 배지에서 등록해 주세요!", "error");
                return;
            }
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-[10px]"></i> 번역 중';
            try {
                const prompt = `다음 스페인어 질문을 자연스러운 한국어로 번역해줘. 번역문만 출력(따옴표 없이): "${currentQuestionForAnswer.question}"`;
                const responseText = await callGemini(prompt, "당신은 스페인어-한국어 번역가입니다. 번역문만 간결하게 출력하세요.", null, 'low');
                const ko = (responseText || '').trim().replace(/^["']|["']$/g, '');
                currentQuestionForAnswer._koreanTranslation = ko;
                transEl.innerText = '💬 ' + ko;
                transEl.classList.remove('hidden');
            } catch (e) {
                showToast(describeGeminiError(e), "error");
            } finally {
                btn.innerHTML = originalHtml;
            }
        }

        // [냐냐 PATCH] 연관 질문 생성용 - 직전에 답한 질문/답변 맥락
        let lastAnsweredQuestion = null;

        async function generateFollowupQuestion() {
            if (!lastAnsweredQuestion) {
                showToast("먼저 질문에 답변을 제출해 주세요!", "error");
                return;
            }
            if (!hasGeminiApiKey()) {
                showToast("Gemini API 키가 없어 연관 질문을 만들 수 없어요. 우측 상단 배지에서 키를 등록해 주세요!", "error");
                openApiKeyModal();
                return;
            }
            const btn = document.getElementById('question-followup-btn');
            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> 생성 중...`;

            const prompt = `Previous question: "${lastAnsweredQuestion.question}"
            Student's answer (Spanish): "${lastAnsweredQuestion.answer}"
            Corrected answer: "${lastAnsweredQuestion.corrected}"

            Generate ONE natural follow-up question in Spanish that continues this conversation, as a real conversation partner would. It should build on the student's answer to keep the dialogue flowing (e.g., ask for more detail, a related opinion, or a next step). Keep it at a similar or slightly higher difficulty. Return JSON only.`;
            const system = `You are a friendly Spanish conversation partner for a learner named "냐냐". Create engaging follow-up questions that make conversation flow naturally.
            Return JSON matching this schema:
            {
               "followupQuestion": "The follow-up question in Spanish",
               "koreanHint": "Korean translation/meaning of the question, 1 sentence"
            }
            Do not wrap JSON in markdown.`;
            const schema = {
                type: "OBJECT",
                properties: {
                    followupQuestion: { type: "STRING" },
                    koreanHint: { type: "STRING" }
                },
                required: ["followupQuestion", "koreanHint"]
            };

            try {
                const responseText = await callGemini(prompt, system, schema, 'low');
                const data = extractAndParseJson(responseText);
                // 생성된 연관 질문을 현재 질문으로 세팅 (등록 질문 목록엔 저장 안 함 — 일회성 대화 흐름)
                currentQuestionForAnswer = { question: data.followupQuestion, _isFollowup: true, koreanHint: data.koreanHint || '' };
                updateSaveAiQuestionBtn(); // 연관 질문은 대화 흐름용이라 저장 버튼을 감춘다
                document.getElementById('question-display-text').innerText = data.followupQuestion;
                // 주제 배지를 한국어 힌트로 활용
                const topicBadge = document.getElementById('question-topic-badge');
                if (topicBadge) topicBadge.innerText = '주제 보기';
                // 답변창 초기화
                const answerInput = document.getElementById('question-answer-input');
                answerInput.value = '';
                answerInput.disabled = false;
                // 이전 채점 결과 숨기기
                document.getElementById('ai-feedback-result')?.classList.add('hidden');
                document.getElementById('question-followup-btn')?.classList.add('hidden');
                // [냐냐 PATCH] 이전 질문의 해석(번역) 숨기기 — 새 질문엔 안 맞으니까
                document.getElementById('question-translation-text')?.classList.add('hidden');
                showToast("이어지는 질문이 생성됐어요! 대화를 계속해 보세요 💬", "success");
                document.getElementById('question-display-text').scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => answerInput.focus(), 300); // 바로 답변 입력 가능하게
            } catch (e) {
                console.error(e);
                showToast(describeGeminiError(e), "error");
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }

        // [냐냐 PATCH] 답변창 엔터 처리: 제출 전이면 제출, 제출 후(연관질문 버튼 보이면)면 연관질문 생성
        function handleQuestionAnswerKeydown(e) {
            if (e.key !== 'Enter' || e.shiftKey) return; // Shift+Enter는 줄바꿈
            e.preventDefault();
            const submitBtn = document.getElementById('question-submit-btn');
            const followupBtn = document.getElementById('question-followup-btn');
            // 연관 질문 버튼이 보이면(=이미 답변 제출됨) → 엔터로 연관 질문 생성
            if (followupBtn && !followupBtn.classList.contains('hidden')) {
                generateFollowupQuestion();
            } else if (submitBtn && !submitBtn.disabled) {
                submitQuestionAnswer();
            }
        }

        async function submitQuestionAnswer() {
            if (!currentQuestionForAnswer) {
                showToast("먼저 '랜덤 질문 뽑기'를 눌러서 질문을 받아주세요!", "error");
                return;
            }
            const userAnswer = document.getElementById('question-answer-input').value.trim();
            if (!userAnswer) {
                showToast("스페인어로 답변을 입력해 주세요!", "error");
                return;
            }
            if (!hasGeminiApiKey()) {
                showToast("Gemini API 키가 등록되지 않아 AI 채점을 사용할 수 없습니다. 우측 상단 배지에서 키를 등록해 주세요!", "error");
                openApiKeyModal();
                return;
            }

            const submitBtn = document.getElementById('question-submit-btn');
            const originalHtml = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> 채점 중...`;
            showToast("Gemini AI가 답변을 분석하고 있습니다...", "info");
            AudioFX.playPunch();

            // [냐냐 요청] 여기도 스페인어를 직접 쓰는 곳이라 스→한과 똑같이 단어·문법 점수를 매긴다
            const qScoreNotes = aiScoringNoteList();
            resetAiWritingScores();

            const prompt = `Question (may be in Spanish or Korean): "${currentQuestionForAnswer.question}"
            Student's Spanish Answer: "${userAnswer}"

            Evaluate whether the student's Spanish answer is grammatically correct AND is a sensible, appropriate response to the question (content relevance matters, not just grammar).
            For "correctedText": output the corrected sentence; wrap ONLY the words you actually changed/added inside '<span class='text-red-600 font-extrabold underline'>...</span>' tags. Already-correct words stay plain.
            For "originalMarked": output the student's ORIGINAL answer verbatim; wrap ONLY the wrong words inside '<span class='line-through text-slate-400'>...</span>' tags. Correct words stay plain.
            ${aiScoringNoteListText(qScoreNotes)}
            ${buildLearnerProfileSummary()}`;
            const system = `You are an expert Spanish tutor evaluating a student named "냐냐" answering a practice question in Spanish.
            Return feedback matching this JSON schema:
            {
               "isCorrect": true/false,
               "verdict": "e.g., 완벽한 답변이에요! 🎉 or 다시 한 번 살펴볼까요? 📝",
               "userTranslation": "냐냐님이 실제로 쓴 스페인어 문장을 있는 그대로 한국어로 직역한 것 (의도와 다를 수 있으니 실제 쓴 대로). 1문장.",
               "correctedText": "The corrected Spanish answer. Wrap ONLY changed words in red span tags; leave correct words plain.",
               "originalMarked": "The student ORIGINAL answer verbatim, with ONLY wrong words wrapped in line-through span tags; correct words stay plain.",
               "message": "Concise feedback in Korean mentioning '냐냐님', 1-2 sentences. Comment on both grammar AND whether the answer actually addresses the question.",
               "breakdown": [
                  { "word": "ONE short Spanish word from correctedText. EXCEPTION: for reflexive verbs, keep the reflexive pronoun WITH the verb as one item (e.g. 'me llamo', 'se levanta' — NOT split into 'me'+'llamo'). Otherwise never a phrase or full clause.", "mean": "Its Korean meaning, 1-4 words only, never empty" }
               ],
               "changes": [
                  { "from": "original wrong part (word or phrase)", "to": "corrected part", "why": "왜 고쳤는지 한국어로. 규칙 이름과 이유를 함께 쓸 것. 예: '성수일치 — casa 가 여성명사라 bonito 가 아니라 bonita', '어순 — 스페인어는 꾸미는 말이 명사 뒤'. 1~2문장." }
               ],
               "tip": "냐냐님에게 주는 학습 설명. 이 항목이 AI 코멘트를 대신하므로 자세히 쓸 것. 반드시 줄바꿈(\\n)으로 나눈 두 줄로 쓸 것. 한 덩어리로 이어 쓰지 말 것. 1번째 줄: 이번 문장에서 잘한 점 또는 틀린 핵심 한 문장. 2번째 줄: 그 문법이 왜 그렇게 되는지 규칙 설명 1~2문장. 각 줄은 60자 이내로 짧게. 예문은 넣지 말 것 — 고친 문장이 이미 위에 있음. 격려만 늘어놓지 말고 실제로 배울 내용을 담을 것.",
               "issueType": "If isCorrect is false, classify the main issue as exactly one of: '어순', '성수일치', '동사변형', '시제', '전치사', '어휘선택', '내용부적절', '기타'. If isCorrect is true, use '없음'.",${AI_SCORING_JSON_FIELDS}${AI_NATURAL_JSON_FIELDS}
            }
            IMPORTANT for "breakdown": split correctedText into individual words/particles (typically 3-7 items), each exactly ONE word, "mean" never empty, no duplicates.${AI_SCORING_RULES_TEXT}${AI_NATURAL_RULES_TEXT}
            Do not wrap JSON in markdown blockticks.`;

            const schema = {
                type: "OBJECT",
                properties: {
                    isCorrect: { type: "BOOLEAN" },
                    verdict: { type: "STRING" },
                    userTranslation: { type: "STRING", description: "Korean translation of what the student ACTUALLY wrote (literal meaning, may differ from intent)" },
                    correctedText: { type: "STRING" },
                    originalMarked: { type: "STRING" },
                    message: { type: "STRING" },
                    breakdown: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                word: { type: "STRING", description: "Exactly one Spanish word or particle, never a phrase or sentence" },
                                mean: { type: "STRING", description: "Korean meaning of that single word, 1-4 words, required and never empty" }
                            },
                            required: ["word", "mean"]
                        }
                    },
                    changes: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                from: { type: "STRING" },
                                to: { type: "STRING" },
                                why: { type: "STRING" }
                            },
                            required: ["from", "to", "why"]
                        }
                    },
                    tip: { type: "STRING" },
                    issueType: { type: "STRING", enum: ["어순", "성수일치", "동사변형", "시제", "전치사", "어휘선택", "내용부적절", "기타", "없음"] },
                    ...aiScoringSchemaProps(),
                    ...aiNaturalSchemaProps()
                },
                required: ["isCorrect", "verdict", "correctedText", "originalMarked", "message", "breakdown", "tip", "issueType", ...AI_SCORING_REQUIRED, ...AI_NATURAL_REQUIRED]
            };

            try {
                const responseText = await callGemini(prompt, system, schema, 'low');
                const feedback = extractAndParseJson(responseText);

                // [냐냐 요청] 이 답변이 쓴 단어·문법에 점수를 반영하고 결과에 보여준다 (해제 버튼 포함)
                applyAiWritingScores(feedback, qScoreNotes);

                const resultBox = document.getElementById('ai-feedback-result');
                const correctionBox = document.getElementById('ai-coach-correction-box');
                const originalRender = document.getElementById('ai-original-render');
                const correctedRender = document.getElementById('ai-corrected-render');
                const coachVerdict = document.getElementById('ai-coach-verdict');
                const coachMsg = document.getElementById('ai-coach-message');
                const coachTip = document.getElementById('ai-coach-tip');
                const coachIcon = document.getElementById('ai-coach-icon');

                resultBox.classList.remove('hidden');

                if (feedback.isCorrect) {
                    coachIcon.innerText = "🎉";
                    coachVerdict.className = "text-sm font-bold text-emerald-600";
                    correctionBox.classList.add('hidden');
                } else {
                    coachIcon.innerText = "📝";
                    coachVerdict.className = "text-sm font-bold text-rose-600";
                    correctionBox.classList.remove('hidden');
                    originalRender.innerHTML = feedback.originalMarked || userAnswer;
                    correctedRender.innerHTML = feedback.correctedText;
                    renderAiChanges(feedback);
                    // [냐냐 요청] '쓴 문장 실제 뜻'을 아래가 아니라 AI 코멘트 안 위로 이동 → 아래 칸은 숨김
                    const utEl = document.getElementById('ai-user-translation');
                    if (utEl) utEl.classList.add('hidden');
                }

                coachVerdict.innerText = feedback.verdict;
                // [냐냐 요청] 스→한과 동일하게: AI 코멘트 위에 '쓴 문장의 실제 뜻'을 박스로 표시
                // [냐냐 요청] 코멘트 박스엔 '쓴 문장의 실제 뜻'만 남긴다.
                //   AI 코멘트는 아래 학습 팁·교정 표시와 겹쳐서 뺐다.
                //   해석이 안 왔을 때만 박스가 비지 않게 코멘트로 대신한다 (feedback.message 는 Q&A 에 계속 쓰임)
                coachMsg.innerHTML = feedback.userTranslation
                    ? `<span class="text-[11px] font-bold text-sky-500">💬 쓴 문장의 실제 뜻</span> <span class="font-semibold text-slate-800">${feedback.userTranslation}</span>`
                    : `<span>${feedback.message}</span>`;

                renderAiTip(feedback.tip);
                renderAiNatural(feedback);

                // [냐냐 PATCH-수준맞춤] 질문 답하기 결과도 학습 프로필에 반영
                learnerProfile.totalAnswered++;
                if (feedback.isCorrect) {
                    learnerProfile.totalCorrect++;
                } else if (feedback.issueType && feedback.issueType !== '없음') {
                    learnerProfile.wrongByGrammarType[feedback.issueType] = (learnerProfile.wrongByGrammarType[feedback.issueType] || 0) + 1;
                }

                aiChatHistory = [
                    { role: "system", content: "당신은 냐냐님의 상냥하고 친절한 스페인어 선생님입니다. 이전 질문-답변 첨삭 결과에 이어지는 냐냐님의 추가 질문에 친절하고 정확하게 한국어로 대답해주세요." },
                    { role: "assistant", content: `<b>질문:</b> ${currentQuestionForAnswer.question}<br><b>냐냐님 답변:</b> ${userAnswer}<br><b>선생님 피드백:</b> ${feedback.message}<br><b>추천 답변:</b> ${feedback.correctedText.replace(/<[^>]*>/g, '')}` }
                ];
                renderChatThread();

                recordAiNote('question', currentQuestionForAnswer.question, userAnswer, feedback);
                logAction('ai');
                saveToStorage();
                updateStats();
                // [냐냐 PATCH] 연관 질문 생성 버튼 노출 + 직전 문답 맥락 저장
                lastAnsweredQuestion = { question: currentQuestionForAnswer.question, answer: userAnswer, corrected: (feedback.correctedText || '').replace(/<[^>]*>/g, '') };
                const followupBtn = document.getElementById('question-followup-btn');
                if (followupBtn) followupBtn.classList.remove('hidden');
                scrollAiResultIntoView();
                showToast("채점이 끝났어요! 궁금한 점을 하단에서 바로 질문해 보세요! ✨", "success");
            } catch (e) {
                console.error(e);
                showToast(describeGeminiError(e), "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHtml;
            }
        }

        function toggleAiHint() {
            const hintBox = document.getElementById('ai-mission-hint-box');
            if (isAiHintVisible) {
                hintBox.classList.add('hidden');
                isAiHintVisible = false;
            } else {
                if (!aiCurrentWordForMission) {
                    hintBox.innerText = "아직 미션 문장이 없어요. 먼저 '✨ 랜덤 문장 생성'을 눌러주세요!";
                } else {
                    let hintHtml = `💡 <b>학습 단어 힌트:</b> ${aiCurrentWordForMission.word} (${aiCurrentWordForMission.meaning}) <br>`;
                    if (aiCurrentWordForMission.pos === 'verb') {
                        hintHtml += `👉 <b>V. (동사) 힌트:</b> 현재 1인칭 변형은 <b>'${aiCurrentWordForMission.conjugations?.yo || '비정형'}'</b> 입니다. 어순에 신경써 보세요!`;
                    } else if (aiCurrentWordForMission.pos === 'noun') {
                        const genderKorean = aiCurrentWordForMission.gender === 'masculine' ? '남성명사(정관사 el)' : aiCurrentWordForMission.gender === 'feminine' ? '여성명사(정관사 la)' : '성별 지정 없음';
                        hintHtml += `👉 <b>명사 성별 힌트:</b> 이 명사는 <b>${genderKorean}</b> 입니다. 관사 및 형용사 어미 일치에 주의하세요!`;
                    } else {
                        hintHtml += `👉 문맥 속에서 단어가 매끄럽게 연결되도록 문법 어순을 천천히 조립해 보세요!`;
                    }
                    hintBox.innerHTML = hintHtml;
                }
                hintBox.classList.remove('hidden');
                isAiHintVisible = true;
                AudioFX.playPunch();
            }
        }

        // [PATCH] 한->스 모드는 이제 기본적으로 빈 상태로 시작 (자동 생성 없음)
        function resetKoEsMissionState() {
            const missionHeading = document.getElementById('ai-mission-korean');
            const resultBox = document.getElementById('ai-feedback-result');
            const hintBox = document.getElementById('ai-mission-hint-box');

            resultBox.classList.add('hidden');
            hintBox.classList.add('hidden');
            isAiHintVisible = false;
            document.getElementById('ai-user-input').value = '';
            aiCurrentWordForMission = null;
            aiCurrentKoreanSentence = "";

            if (vocabulary.length === 0) {
                missionHeading.innerText = "단어장 데이터가 비어 있습니다! 내 단어장 탭에서 단어를 추가해 주세요.";
            } else {
                missionHeading.innerText = "아직 생성된 문장이 없어요! 위의 '✨ 랜덤 문장 생성'을 눌러서 시작해보세요.";
            }
        }

        // [PATCH] AI 호출이 실패했을 때만 쓰는 안전한 대체 문장 (기존 curated/rule 로직 재사용)
        // [PATCH] 내 단어장 기반으로 AI가 실시간으로 자연스러운 한국어 미션 문장을 생성
        // (이전엔 실패 시 미리 써둔 문장으로 대체했는데, 그 템플릿이 신체 부위 등에서
        //  "저기 있는 귀 좀 갖다 줄래?" 처럼 이상하게 나와서 — 그냥 실패를 솔직하게 알려주는 방식으로 변경)
        // [냐냐 요청] 첨삭 결과 아래에 '이번 미션이 참고한 문법·단어'를 보여준다.
        //   문제 풀기 전에 보이면 답 힌트가 되므로 채점 후에만 연다.
        function renderAiMissionRefs() {
            const box = document.getElementById('ai-mission-refs');
            if (!box) return;
            const g = aiCurrentGrammarForMission;
            // [냐냐 요청] 덧붙임 단어는 '미션을 만들 때 후보로 준 것' 이라 문장에 안 들어갈 수 있다.
            //   채점이 끝난 뒤에는 실제로 정답 문장에 나온 것만 남긴다 (안 그러면 beber 처럼
            //   쓰지도 않은 단어가 '이번 미션이 참고한 내용' 에 남아서 헷갈린다).
            //   목표 단어는 미션의 핵심이라 안 썼어도 그대로 둔다.
            const usedInSentence = (word) => {
                const t = (aiLastCorrectedText || '').toLowerCase();
                if (!t) return true;                       // 아직 채점 전이면 다 보여준다
                //   'el/la estudiante' 처럼 슬래시가 낀 관사도 떼야 한다 (core.js 의 규칙을 그대로 쓴다)
                const key = String(word.word || '').toLowerCase().replace(RE_LEADING_ARTICLE, '').trim();
                return !!key && t.includes(key);
            };
            const words = [aiCurrentWordForMission,
                           ...(aiCurrentExtraWordsForMission || []).filter(usedInSentence)].filter(Boolean);
            if (!g && !words.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }
            const wordChips = words.map(w =>
                `<span class="inline-flex items-baseline gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
                    <b class="text-slate-800">${escapeHtml(w.word || '')}</b>
                    <span class="text-slate-400">${escapeHtml(w.meaning || '')}</span>
                </span>`).join('');
            box.innerHTML = `<div data-mission-refs>

                <div class="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5">
                    <i class="fa-solid fa-book-open text-violet-500"></i><span>이번 미션이 참고한 내용</span>
                </div>
                ${g ? `<button type="button" onclick="openGrammarNoteFromMission('${g.id}')" class="w-full text-left mb-2 bg-white border border-slate-200 hover:border-violet-300 rounded-xl px-3 py-2 transition-colors">
                    <span class="text-[10px] font-bold text-violet-500">문법</span>
                    <div class="text-xs font-extrabold text-slate-800">${escapeHtml(g.icon || '📋')} ${escapeHtml(g.title || '')}</div>
                    <div class="text-[10px] text-slate-400 mt-0.5">이 문법으로 문장을 만들었어요 · 눌러서 노트 보기 →</div>
                </button>` : ''}
                ${wordChips ? `<div class="flex flex-wrap gap-1.5 text-[11px] font-semibold">${wordChips}</div>` : ''}
                </div>`;
            box.classList.remove('hidden');
        }

        // 참조 문법 카드를 누르면 문법·개념 탭에서 그 노트를 펼쳐 보여준다
        function openGrammarNoteFromMission(id) {
            // ⚠️ 순서 주의: changeTab 이 문법 탭을 다시 그리면서 펼침 상태를 초기화하므로
            //    탭을 먼저 옮기고 → 그 다음에 펼침 표시 → 다시 그리기
            if (typeof changeTab === 'function') changeTab('grammar');   // switchTab 이 아니라 changeTab
            setTimeout(() => {
                if (typeof grammarOpenState !== 'undefined') grammarOpenState[id] = true;
                if (typeof renderGrammarTables === 'function') renderGrammarTables();
                const el = document.querySelector(`[data-grammar-body="${id}"]`);
                if (el && el.parentElement) el.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 80);
        }

        // [냐냐 요청] 문법 노트 한 개를 AI에게 넘길 글로 요약 — 표 칸뿐 아니라 노트에 쓴 설명까지 통째로
        function buildGrammarContextForMission(note) {
            const blocks = (typeof getNoteBlocks === 'function') ? getNoteBlocks(note) : [];
            const parts = [];
            blocks.forEach(b => {
                if (b.type === 'text') {
                    const t = (typeof richTextToPlain === 'function') ? richTextToPlain(b.html) : '';
                    if (t.trim()) parts.push('설명: ' + t.trim());
                    return;
                }
                const head = (b.headerRows || []).map(hr => (hr || []).join(' | ')).filter(h => h.replace(/[|\s]/g, ''));
                const rows = (b.rows || []).map(r => (r || []).join(' | ')).filter(r => r.replace(/[|\s]/g, ''));
                if (head.length) parts.push('표 제목줄: ' + head.join(' / '));
                if (rows.length) parts.push('표 내용:\n' + rows.join('\n'));
            });
            return parts.join('\n');
        }

        // 단어장 항목이 '단어/짧은 표현'인지 (문장 통째로 등록된 건 미션 재료로 안 씀)
        function isSimpleWordEntry(w) {
            const s = ((w && w.word) || '').trim();
            if (!s || s.length > 24) return false;
            if (/[?¿!¡.,;:\[\]()]/.test(s)) return false;   // 문장부호가 있으면 문장·표현
            return s.split(/\s+/).length <= 3;              // 'el disco duro' 정도까지만
        }

        // ============================================================
        // [냐냐 요청] 출제할 문법 범위 — 내가 고른 노트들 안에서만 문법을 뽑는다.
        //   여러 문법을 한 문장에 합치는 게 아니라, '출제 범위'를 좁히는 것.
        //   그래서 미션·첨삭 프롬프트는 그대로고, 고르는 풀만 달라진다.
        //   빈 배열 = 범위 안 정함 = 전체에서 무작위 (예전과 같음)
        // ============================================================
        const AI_SCOPE_KEY = 'nyanya_ai_grammar_scope';
        let aiMissionGrammarScope = [];
        let aiScopePending = null;   // 모달에서 고르는 중인 임시 선택 (취소하면 버림)

        function loadAiGrammarScope() {
            try {
                const raw = localStorage.getItem(AI_SCOPE_KEY);
                if (!raw) return;
                const v = JSON.parse(raw);
                if (Array.isArray(v)) aiMissionGrammarScope = v.filter(x => typeof x === 'string');
            } catch (e) {}
            syncAiScopeBadge();
        }
        function saveAiGrammarScope() {
            try { localStorage.setItem(AI_SCOPE_KEY, JSON.stringify(aiMissionGrammarScope)); } catch (e) {}
        }

        // 미션 재료로 쓸 수 있는 노트 (내용이 비어 있으면 AI 에게 줄 게 없다)
        function aiUsableGrammarNotes() {
            const all = (typeof getAllGrammarTables === 'function') ? getAllGrammarTables() : [];
            return all.filter(t => buildGrammarContextForMission(t).trim().length > 0);
        }

        // 지금 범위에 실제로 걸리는 노트들. 범위가 비었거나 다 지워졌으면 전체
        function aiScopedGrammarNotes() {
            const usable = aiUsableGrammarNotes();
            if (!aiMissionGrammarScope.length) return usable;
            const scoped = usable.filter(t => aiMissionGrammarScope.includes(t.id));
            return scoped.length ? scoped : usable;   // 고른 노트가 전부 지워진 경우 대비
        }

        function syncAiScopeBadge() {
            const badge = document.getElementById('ai-scope-badge');
            if (!badge) return;
            const picked = aiMissionGrammarScope.length
                ? aiUsableGrammarNotes().filter(t => aiMissionGrammarScope.includes(t.id)).length
                : 0;
            const on = picked > 0;
            badge.innerText = on ? `${picked}개` : '전체';
            badge.className = on
                ? 'bg-violet-100 text-violet-700 rounded-md px-1.5 py-0.5 text-[10px] font-black'
                : 'bg-slate-200 text-slate-600 rounded-md px-1.5 py-0.5 text-[10px] font-black';
        }

        // [냐냐 요청] 주제 접고 펴기 — 접힌 주제 키를 기억해 둔다 (모달을 다시 열어도 유지)
        let aiScopeCollapsed = {};

        function toggleAiScopeGroup(key) {
            aiScopeCollapsed[key] = !aiScopeCollapsed[key];
            renderAiGrammarScope();
        }

        // [냐냐 요청] 주제 단위로 한번에 켜고 끄기 — 그 주제가 다 켜져 있으면 끄고, 아니면 다 켠다
        function toggleAiScopeGroupAll(key) {
            if (!aiScopePending) return;
            const ids = aiUsableGrammarNotes()
                .filter(t => ((typeof grammarTopicKey === 'function') ? grammarTopicKey(t) : '__other__') === key)
                .map(t => t.id);
            if (!ids.length) return;
            const allOn = ids.every(id => aiScopePending.has(id));
            ids.forEach(id => { if (allOn) aiScopePending.delete(id); else aiScopePending.add(id); });
            renderAiGrammarScope();
        }

        function openAiGrammarScope() {
            const modal = document.getElementById('ai-grammar-scope-modal');
            if (!modal) return;
            aiScopePending = new Set(aiMissionGrammarScope);
            renderAiGrammarScope();
            modal.classList.remove('hidden');
        }
        function closeAiGrammarScope() {
            document.getElementById('ai-grammar-scope-modal')?.classList.add('hidden');
            aiScopePending = null;
        }
        function toggleAiScopeNote(id) {
            if (!aiScopePending) return;
            if (aiScopePending.has(id)) aiScopePending.delete(id); else aiScopePending.add(id);
            renderAiGrammarScope();
        }
        function setAiScopeAll(on) {
            if (!aiScopePending) return;
            aiScopePending = on ? new Set(aiUsableGrammarNotes().map(t => t.id)) : new Set();
            renderAiGrammarScope();
        }
        // 약점·치명적 약점 문법만 담기 (문법 탭의 약점 필터와 같은 기준)
        function setAiScopeWeak() {
            if (!aiScopePending) return;
            const weak = aiUsableGrammarNotes().filter(t =>
                typeof getGrammarGrade === 'function' && ['weak', 'critical'].includes(getGrammarGrade(t.id)));
            if (!weak.length) {
                showToast("약점으로 잡힌 문법이 아직 없어요", "info");
                return;
            }
            aiScopePending = new Set(weak.map(t => t.id));
            renderAiGrammarScope();
        }
        function applyAiGrammarScope() {
            if (!aiScopePending) return;
            const all = aiUsableGrammarNotes();
            const picked = all.filter(t => aiScopePending.has(t.id)).map(t => t.id);
            // 전부 고른 건 '범위 없음'과 같으니 비워둔다 (배지가 '전체'로 보이게)
            aiMissionGrammarScope = (picked.length === all.length) ? [] : picked;
            saveAiGrammarScope();
            syncAiScopeBadge();
            closeAiGrammarScope();
            showToast(aiMissionGrammarScope.length
                ? `문법 ${aiMissionGrammarScope.length}개 범위로 출제할게요`
                : "전체 문법에서 출제할게요", "success");
        }

        function renderAiGrammarScope() {
            const box = document.getElementById('ai-scope-list');
            const countEl = document.getElementById('ai-scope-count');
            if (!box || !aiScopePending) return;
            const all = aiUsableGrammarNotes();
            if (countEl) countEl.innerText = `${aiScopePending.size} / ${all.length}개 선택`;

            if (!all.length) {
                box.innerHTML = `<div class="py-10 text-center text-xs text-slate-400">쓸 수 있는 문법 노트가 없어요.<br>문법·개념 탭에서 노트를 먼저 채워주세요.</div>`;
                return;
            }

            // 문법 탭과 같은 주제 순서로 묶어서 보여준다
            const groups = {};
            all.forEach(t => {
                const k = (typeof grammarTopicKey === 'function') ? grammarTopicKey(t) : '__other__';
                (groups[k] = groups[k] || []).push(t);
            });
            const order = (typeof GRAMMAR_ICONS !== 'undefined' ? GRAMMAR_ICONS.map(g => g.icon) : []).filter(k => groups[k]);
            if (typeof GRAMMAR_OTHER_TOPIC !== 'undefined' && groups[GRAMMAR_OTHER_TOPIC]) order.push(GRAMMAR_OTHER_TOPIC);
            Object.keys(groups).forEach(k => { if (order.indexOf(k) < 0) order.push(k); });

            box.innerHTML = order.map(key => {
                const label = (typeof grammarTopicLabel === 'function') ? grammarTopicLabel(key) : key;
                const list = groups[key];
                const onCount = list.filter(t => aiScopePending.has(t.id)).length;
                const allOn = onCount === list.length;
                const someOn = onCount > 0 && !allOn;
                const collapsed = !!aiScopeCollapsed[key];
                const safeKey = String(key).replace(/'/g, "\\'");

                const rows = list.map(t => {
                    const on = aiScopePending.has(t.id);
                    const grade = (typeof getGrammarGrade === 'function') ? getGrammarGrade(t.id) : null;
                    const weakChip = ['weak', 'critical'].includes(grade)
                        ? `<span class="text-[9px] font-black text-rose-600 bg-rose-50 rounded-md px-1.5 py-0.5 shrink-0">약점</span>` : '';
                    return `
                        <button type="button" onclick="toggleAiScopeNote('${t.id}')"
                            class="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all ${
                                on ? 'bg-violet-50 border-violet-300' : 'bg-white border-slate-200 hover:border-slate-300'}">
                            <span class="w-4 h-4 shrink-0 rounded-md border flex items-center justify-center ${
                                on ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-slate-300'}">
                                ${on ? '<i class="fa-solid fa-check text-[9px]"></i>' : ''}
                            </span>
                            <span class="text-xs font-bold text-slate-800 truncate flex-1">${escapeHtml(t.icon || '📋')} ${escapeHtml(t.title || '')}</span>
                            ${weakChip}
                        </button>`;
                }).join('');

                // 주제 줄: 왼쪽 화살표 = 접고 펴기 / 체크칸 = 그 주제 전부 켜고 끄기
                return `
                    <div>
                        <div class="flex items-center gap-1.5 mb-1.5">
                            <button type="button" onclick="toggleAiScopeGroup('${safeKey}')" title="${collapsed ? '펴기' : '접기'}"
                                class="w-5 h-5 shrink-0 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center transition-colors">
                                <i class="fa-solid fa-chevron-down text-[10px] transition-transform" style="${collapsed ? '' : 'transform:rotate(180deg);'}"></i>
                            </button>
                            <button type="button" onclick="toggleAiScopeGroupAll('${safeKey}')" title="${allOn ? '이 주제 전체 해제' : '이 주제 전체 선택'}"
                                class="flex items-center gap-2 flex-1 min-w-0 text-left rounded-lg px-1.5 py-1 hover:bg-slate-100 transition-colors">
                                <span class="w-4 h-4 shrink-0 rounded-md border flex items-center justify-center ${
                                    allOn ? 'bg-violet-600 border-violet-600 text-white'
                                    : someOn ? 'bg-violet-100 border-violet-300 text-violet-600' : 'bg-white border-slate-300'}">
                                    ${allOn ? '<i class="fa-solid fa-check text-[9px]"></i>' : someOn ? '<i class="fa-solid fa-minus text-[9px]"></i>' : ''}
                                </span>
                                <span class="text-[11px] font-black text-slate-500 truncate">${escapeHtml(label)}</span>
                                <span class="text-[10px] font-bold ${onCount ? 'text-violet-500' : 'text-slate-300'} shrink-0">${onCount}/${list.length}</span>
                            </button>
                        </div>
                        <div class="${collapsed ? 'hidden' : ''} space-y-1.5 pl-6">${rows}</div>
                    </div>`;
            }).join('');
        }

        // 내용이 있는 문법 노트 중에서 하나를 무작위로 (범위를 정해뒀으면 그 안에서만)
        function pickMissionGrammarNote() {
            const pool = aiScopedGrammarNotes();
            if (!pool.length) return null;
            return pool[Math.floor(Math.random() * pool.length)];
        }

        async function generateAiMission() {
            const missionHeading = document.getElementById('ai-mission-korean');
            const resultBox = document.getElementById('ai-feedback-result');
            const hintBox = document.getElementById('ai-mission-hint-box');
            const genBtn = document.getElementById('ai-generate-mission-btn');

            resultBox.classList.add('hidden');
            hintBox.classList.add('hidden');
            isAiHintVisible = false;
            document.getElementById('ai-user-input').value = '';
            // [냐냐 요청] 새 미션을 뽑으면 지난 미션의 참고 내용은 감춘다 (힌트 방지)
            const refsBox = document.getElementById('ai-mission-refs');
            if (refsBox) { refsBox.classList.add('hidden'); refsBox.innerHTML = ''; }
            aiCurrentGrammarForMission = null;
            aiCurrentExtraWordsForMission = [];
            aiLastCorrectedText = '';

            if (vocabulary.length === 0) {
                missionHeading.innerText = "단어장 데이터가 비어 있습니다! 내 단어장 탭에서 단어를 추가해 주세요.";
                aiCurrentWordForMission = null;
                aiCurrentKoreanSentence = "";
                return;
            }

            if (!hasGeminiApiKey()) {
                showToast("Gemini API 키가 없어서 AI 문장 생성을 사용할 수 없어요. 우측 상단 배지에서 키를 등록해 주세요!", "error");
                missionHeading.innerText = "API 키가 없어서 문장을 생성할 수 없어요.";
                openApiKeyModal();
                aiCurrentWordForMission = null;
                aiCurrentKoreanSentence = "";
                return;
            }

            const randIdx = Math.floor(Math.random() * vocabulary.length);
            const targetWord = vocabulary[randIdx];
            // [냐냐 요청] 문법표 1개를 골라 문맥으로 주고, 단어장에서 몇 개 더 섞는다
            //   노트에서 '이 문법으로 번역 연습'을 눌러 들어왔으면 그 문법을 쓴다 (한 번만)
            const forced = aiForcedGrammarId
                ? (typeof getAllGrammarTables === 'function' ? getAllGrammarTables().find(t => t.id === aiForcedGrammarId) : null)
                : null;
            aiForcedGrammarId = null;
            aiMissionReviewGrammarId = (forced && aiForcedFromReview) ? forced.id : null;
            aiForcedFromReview = false;
            if (!aiMissionReviewGrammarId && grammarReviewTotal) endGrammarReviewQueue();  // 랜덤 미션을 뽑으면 복습 줄은 끝난 것
            else renderGrammarReviewBar();
            const grammarNote = forced || pickMissionGrammarNote();
            const grammarContext = grammarNote ? buildGrammarContextForMission(grammarNote) : '';
            //   섞을 단어는 '단어'다운 항목만 고른다 — 단어장에는 "¿Quién es [지시사+사람]?" 처럼
            //   문장·표현 통째로 등록된 것도 있어서, 그런 걸 섞으라고 주면 억지로 우겨넣은 이상한 문장이 나온다
            const extraWords = (typeof shuffleArray === 'function' ? shuffleArray(vocabulary.slice()) : vocabulary.slice())
                .filter(w => w !== targetWord && isSimpleWordEntry(w)).slice(0, 2);

            const originalBtnHtml = genBtn.innerHTML;
            genBtn.disabled = true;
            genBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> 생성 중...`;
            missionHeading.innerHTML = `<span class="inline-flex items-center gap-2 text-slate-400 text-base"><i class="fa-solid fa-spinner animate-spin"></i> AI가 문장을 만들고 있어요... (보통 3~5초)</span>`;

            const prompt = `스페인어 단어 "${targetWord.word}" (뜻: "${targetWord.meaning}", 품사: ${targetWord.pos})를 스페인어로 번역할 때 이 단어를 자연스럽게 써야 하는, 짧고 일상적인 구어체 한국어 문장을 1개 만들어주세요. 실제로 친구한테 말할 법한 자연스러운 문장으로, 너무 길지 않게.
            매우 중요: 문장은 100% 순수한 한국어로만 작성하고, 스페인어 단어("${targetWord.word}" 포함)나 알파벳, 영어를 절대 섞지 마세요. 학생이 이 한국어 문장을 보고 스스로 스페인어로 번역해야 하므로, 정답이 될 단어를 한국어 문장 안에 그대로 노출하면 절대 안 됩니다. 의미는 한국어 뜻("${targetWord.meaning}")으로만 표현하세요.
${grammarContext ? `
[이번에 같이 연습할 문법 — 학생이 직접 정리해 둔 노트입니다]
제목: ${grammarNote.title || ''}
${grammarContext}

위 문법을 실제로 써야만 번역할 수 있는 문장으로 만들어 주세요. 노트의 설명까지 읽고, 그 문법이 자연스럽게 필요한 상황을 잡으세요.
아래 표 안의 스페인어는 참고용일 뿐이며, 만들 문장에는 절대 넣지 마세요.` : ''}

⚠️ 가장 중요 — 문장이 '말이 되는지' 반드시 검토하세요. 문법을 끼워 넣는 것보다 우선입니다.
내보내기 전에 스스로 물어보세요: "실제 사람이 이 말을 하는 상황이 존재하는가?"
말이 안 되는 예:
- "혹시 내 우산을 빌릴 수 있을까?" → 내 물건을 내가 빌린다는 건 모순. ('네 우산을 빌릴 수 있을까'여야 맞음)
- "나는 어제 내일 갈 거야" → 시제가 서로 모순
- 서로 관계없는 소재를 한 문장에 억지로 몰아넣기
주어·소유자·시점·인과관계가 앞뒤로 맞아떨어지는지 확인하고, 조금이라도 어색하면 상황 자체를 다시 잡으세요.
문법을 넣으려다 어색해질 바에는, 그 문법이 자연스럽게 쓰이는 다른 상황을 고르는 게 낫습니다.
${extraWords.length ? `
[참고: 내 단어장에 있는 다른 단어] ${extraWords.map(w => `${w.word}(${w.meaning})`).join(', ')}
이 중 하나가 위 문법과 정말 자연스럽게 어울릴 때만 그 '뜻'을 슬쩍 녹여 주세요.
어울리지 않으면 하나도 안 쓰는 게 낫습니다. 여러 단어를 억지로 한 문장에 몰아넣지 마세요 —
문장이 어색해지면 실패입니다. 문장은 짧고 자연스러운 게 최우선입니다.` : ''}
            ${buildLearnerProfileSummary()}`;
            const system = "You are a creative Spanish-learning content writer. Output strictly valid JSON matching the schema, in natural conversational Korean. The sentence must be written ENTIRELY in Korean script (Hangul) — never include the target Spanish word, any other Spanish words, or Latin alphabet characters anywhere in the sentence, since the student must translate it themselves. No explanations, no markdown fences, no preamble.";
            const schema = {
                type: "OBJECT",
                properties: {
                    sentence: { type: "STRING", description: "100% 순수 한글로만 작성된 구어체 문장 1개. 스페인어 단어나 알파벳 절대 포함 금지" }
                },
                required: ["sentence"]
            };

            try {
                const responseText = await callGemini(prompt, system, schema, 'low', GEMINI_MODEL_FLASH_LITE);
                const result = extractAndParseJson(responseText);
                const candidateSentence = (result.sentence || '').trim();

                // [PATCH-안전장치] 그래도 스페인어/알파벳이 섞여 나오면(정답 노출) 실패로 처리
                if (/[a-zA-Z]/.test(candidateSentence)) {
                    throw new Error("SENTENCE_CONTAINS_SPANISH");
                }

                aiCurrentWordForMission = targetWord;
                aiCurrentKoreanSentence = candidateSentence;
                // [냐냐 요청] 첨삭 때 근거로 쓰려고 이번 미션이 참고한 것들을 기억해 둔다
                aiCurrentGrammarForMission = grammarNote || null;
                aiCurrentExtraWordsForMission = extraWords;
                missionHeading.innerText = aiCurrentKoreanSentence;
                AudioFX.playPunch();
            } catch (e) {
                console.warn("AI 미션 생성 실패", e);
                if (String(e.message || '').includes('SENTENCE_CONTAINS_SPANISH')) {
                    showToast("생성된 문장에 스페인어가 섞여 있어서 다시 시도해 주세요!", "error");
                } else {
                    showToast(describeGeminiError(e), "error");
                }
                missionHeading.innerText = "문장 생성에 실패했어요. '✨ 랜덤 문장 생성'을 다시 눌러주세요.";
                aiCurrentWordForMission = null;
                aiCurrentKoreanSentence = "";
            } finally {
                genBtn.disabled = false;
                genBtn.innerHTML = originalBtnHtml;
            }
        }

        async function submitAiTranslationKoEs() {
            if (!aiCurrentWordForMission) {
                showToast("먼저 '✨ 랜덤 문장 생성'을 눌러서 미션을 받아주세요!", "error");
                return;
            }
            const userText = document.getElementById('ai-user-input').value.trim();
            if (!userText) {
                showToast("스페인어 답변을 입력해 주세요!", "error");
                return;
            }

            if (!hasGeminiApiKey()) {
                showToast("Gemini API 키가 등록되지 않아 AI 채점을 사용할 수 없습니다. 우측 상단 배지에서 키를 등록해 주세요!", "error");
                openApiKeyModal();
                return;
            }

            renderAiNatural(null); // 지난 결과의 '더 자연스러운 표현'을 먼저 치운다
            const submitBtn = document.getElementById('ai-ko-es-submit-btn');
            const originalHtml = submitBtn.innerHTML;
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> 분석 중...`;
            showToast("Gemini AI가 냐냐님의 답변을 분석하고 있습니다...", "info");
            AudioFX.playPunch();

            // [냐냐 지적] 이 미션의 지정 문법을 채점 목록에서 빼고 있었다. 예전엔 grammarPointUsage 가
            //   그 문법을 따로 판정했으니 겹치지 말라고 뺀 것인데, 그 판정을 없앤 뒤(89c0a7e)에도
            //   빼는 것만 남았다. 그래서 미션이 연습하라고 내준 바로 그 문법만 아무도 채점하지 않았다 —
            //   제대로 써도 +2 가 안 붙고, 복습으로 시작한 미션이어도 곡선이 영영 안 나갔다.
            //   ('날씨' 미션에서 hace mal tiempo 를 맞게 써도 문법 판정이 0건이었다)
            const koEsScoreNotes = aiScoringNoteList();
            // [냐냐 요청] 네 모드가 같은 잣대로 채점한다. 여기만 노트 목록을 안 주고 있어서,
            //   미션 답안에 다른 문법을 잘 써도 그건 점수를 못 받았다. 문장을 '만들' 때는
            //   지금처럼 문법 하나만 보고 만든다 — 목록은 '채점' 에만 붙는다.
            const koEsNoteListText = aiScoringNoteListText(koEsScoreNotes);
            const refGrammar = aiCurrentGrammarForMission
                ? `\n            This mission was built from one of the notes listed above. Its full content (the student's own note):\n            제목: ${aiCurrentGrammarForMission.title || ''}\n            ${buildGrammarContextForMission(aiCurrentGrammarForMission).replace(/\n/g, '\n            ')}\n`
                : '';
            const refWords = (aiCurrentExtraWordsForMission || []).length
                ? `\n            Other words from the student's vocabulary that were offered: ${aiCurrentExtraWordsForMission.map(w => `${w.word}(${w.meaning})`).join(', ')}\n`
                : '';

            const prompt = `Korean Mission: "${aiCurrentKoreanSentence}"
            Target Word we practice: "${aiCurrentWordForMission.word}" (Meaning: "${aiCurrentWordForMission.meaning}")
            Student's Spanish Answer: "${userText}"
${koEsNoteListText}${refGrammar}${refWords}
            Note: the mission is either (a) a Korean sentence to translate, or (b) an instruction asking the student to freely write a Spanish sentence using the target word naturally.
            COMPLETENESS: the Spanish must carry EVERY piece of the Korean mission — each clause, each modifier, each object. If something in the Korean is missing from the answer (a dropped noun, a dropped "~하고 있는", a dropped reason), that is a mistranslation: set isCorrect=false, add the missing part in "correctedText", and say in "message" what was left out. Do not call a shortened answer "완벽" just because the Spanish it does contain is grammatical.
            For (a): the target word above is CONTEXT ONLY — it is the word the mission was built around, not a requirement. NEVER mark the answer wrong, and never ask for that word, just because the student expressed the same meaning with a different word. Judge only whether the Spanish is grammatical and conveys the Korean sentence accurately. (If the student's word changes the MEANING — e.g. writing "name" where the Korean says "surname" — that is a mistranslation, and you say so as a meaning error, not as "you must use the target word".)
            For (b): the target word must actually appear and be used naturally, since the mission asked for it.
            Either way, check the grammar is correct.
            CRITICAL GRADING RULE: A translation is CORRECT (isCorrect=true) as long as it is grammatically correct AND accurately conveys the Korean meaning. There are MANY valid ways to translate one sentence. DO NOT mark the student wrong just because their wording differs from any reference sentence — e.g. "Él es muy amable y simpático" and "Él tiene un carácter muy amable" can BOTH be correct translations of the same Korean sentence. Only mark isCorrect=false if there is an ACTUAL grammar error, wrong word, or mistranslation. If the student's sentence is fully correct, set isCorrect=true, and in "correctedText" simply return the student's own correct sentence (optionally you may add a brief note in "tip" showing an alternative phrasing). For "correctedText": wrap ONLY the words you actually changed/added inside '<span class='text-red-600 font-extrabold underline'>...</span>' tags; already-correct words stay plain. BEFORE OUTPUT, walk the two sentences word by word: if a word appears in the student's sentence and in your correction in the SAME form, it was NOT changed — leave it plain. Marking an unchanged word is a mistake; the student reads the red as "this is what I got wrong". Write the tag with SINGLE quotes exactly as shown — a double quote inside a JSON string breaks the whole response, and the student then sees a sentence that stops mid-way. The reverse is just as bad: EVERY word you changed, added or re-formed must be wrapped — es→está, el pie→mis pies and an added "mucho" all get tags. Count the differences between the two sentences, count your tags, and make the two numbers match. When you EXTEND a sentence, tag only the words you actually added: for "Ayer vi una película." → "Ayer vi una película con mi amigo y cenamos juntos.", the tags go on "con mi amigo y cenamos juntos" alone — "vi una película" stayed exactly as the student wrote it and must stay plain. Split "changes" the same way, one row per piece that really differs; never write a row whose "from" repeats words that did not change. Then give "changes" one row per difference, in the same order — a change you made but never explained leaves the student guessing why their sentence was rewritten. For "originalMarked": output the student original sentence verbatim, wrapping ONLY the wrong words inside '<span class='line-through text-slate-400'>...</span>' tags; correct words stay plain.
            ${buildLearnerProfileSummary()}`;
            
            const system = `You are an encouraging and extremely precise professional Spanish tutor tutoring a passionate student named "냐냐".
            Evaluate the student's translation. Accept ANY grammatically correct sentence that conveys the intended meaning as correct — there is never only one right translation. Return feedback matching this exact JSON schema:
            {
               "isCorrect": true/false,
               "verdict": "e.g., 완벽한 정답이에요! 🎉 or 다시 한 번 살펴볼까요? 📝",
               "correctedText": "The perfect standard Spanish sentence. Wrap ONLY changed words in red span tags; correct words plain.",
               "originalMarked": "The student original sentence verbatim, with ONLY wrong words wrapped in line-through span tags; correct words plain.",
               "message": "Concise evaluation in Korean, 1-2 sentences max. Mention the student '냐냐님' and the key grammar point (어순/conjugation). No long essays.",
               "breakdown": [
                  { "word": "ONE short Spanish word from correctedText. EXCEPTION: for reflexive verbs, keep the reflexive pronoun WITH the verb as one item (e.g. 'me llamo', 'se levanta' — NOT split into 'me'+'llamo'). Otherwise never a phrase or full clause.", "mean": "Its Korean meaning, 1-4 words only, never empty" }
               ],
               "changes": [
                  { "from": "the original wrong part (word or phrase, e.g. 'el muy famoso restaurante')", "to": "the corrected part (e.g. 'un restaurante muy famoso')", "why": "왜 고쳤는지 한국어로. 규칙 이름과 이유를 함께 쓸 것. 예: '어순 — 스페인어는 형용사가 명사 뒤라 muy famoso 가 restaurante 뒤로', '관사 — 처음 언급하는 대상이라 el 대신 un'. 1~2문장." }
               ],
               "tip": "냐냐님에게 주는 학습 설명. 이 항목이 AI 코멘트를 대신하므로 자세히 쓸 것. 반드시 줄바꿈(\\n)으로 나눈 두 줄로 쓸 것. 한 덩어리로 이어 쓰지 말 것. 1번째 줄: 이번 문장에서 잘한 점 또는 틀린 핵심 한 문장. 2번째 줄: 그 문법이 왜 그렇게 되는지 규칙 설명 1~2문장. 각 줄은 60자 이내로 짧게. 예문은 넣지 말 것 — 고친 문장이 이미 위에 있음. 격려만 늘어놓지 말고 실제로 배울 내용을 담을 것."${AI_ISSUE_JSON_FIELD},${AI_SCORING_JSON_FIELDS}${AI_NATURAL_JSON_FIELDS}
            }${AI_NATURAL_RULES_TEXT}
            IMPORTANT for "changes": list EVERY meaningful change between the student sentence and the corrected one — word-order (어순), articles (el/un/la), gender/number, added/removed words. If a whole phrase was reordered, describe it as ONE change item (original phrase -> reordered phrase) with a clear reason. If already correct, use empty array [].
            IMPORTANT for "breakdown": split correctedText into its individual words/particles (typically 3-7 items). Each item must be exactly ONE word, EXCEPT reflexive verbs where the reflexive pronoun stays attached to the verb (e.g. "me llamo" is ONE item, not two). Never a full phrase or sentence, and "mean" must never be omitted or empty. Do not repeat the same word twice. Note: Korean "눈" is ambiguous (can mean either "snow"=nieve or "eye"=ojo) — always use the target word's actual given meaning to disambiguate, never assume.${AI_SCORING_RULES_TEXT}
            Do not wrap JSON in markdown blockticks.`;

            const schema = {
                type: "OBJECT",
                properties: {
                    isCorrect: { type: "BOOLEAN" },
                    verdict: { type: "STRING" },
                    correctedText: { type: "STRING" },
                    originalMarked: { type: "STRING" },
                    message: { type: "STRING" },
                    breakdown: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                word: { type: "STRING", description: "Exactly one Spanish word or particle, never a phrase or sentence" },
                                mean: { type: "STRING", description: "Korean meaning of that single word, 1-4 words, required and never empty" }
                            },
                            required: ["word", "mean"]
                        }
                    },
                    changes: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                from: { type: "STRING", description: "Original wrong part (word or phrase)" },
                                to: { type: "STRING", description: "Corrected part" },
                                why: { type: "STRING", description: "왜 고쳤는지 한국어로. 규칙 이름 + 이유를 함께, 1~2문장" }
                            },
                            required: ["from", "to", "why"]
                        }
                    },
                    tip: { type: "STRING" },
                    // [냐냐 요청] 참조 문법을 제대로 썼는지 — 문장 전체 정오(isCorrect)와 별개로 판정
                    ...aiIssueSchemaProp(),
                    ...aiScoringSchemaProps(),
                    ...aiNaturalSchemaProps()
                },
                required: ["isCorrect", "verdict", "correctedText", "originalMarked", "message", "breakdown", "tip", "issueType", ...AI_SCORING_REQUIRED, ...AI_NATURAL_REQUIRED]
            };

            try {
                const responseText = await callGemini(prompt, system, schema, 'low');
                // 안전 파서 작동
                const feedback = extractAndParseJson(responseText);

                const resultBox = document.getElementById('ai-feedback-result');
                const correctionBox = document.getElementById('ai-coach-correction-box');
                const originalRender = document.getElementById('ai-original-render');
                const correctedRender = document.getElementById('ai-corrected-render');
                const coachVerdict = document.getElementById('ai-coach-verdict');
                const coachMsg = document.getElementById('ai-coach-message');
                const coachTip = document.getElementById('ai-coach-tip');
                const coachIcon = document.getElementById('ai-coach-icon');

                // [냐냐 요청] 미션에 붙은 단어·문법은 '문장을 만드는 재료' 일 뿐이다.
                //   말이 통하게 옮겼으면 맞는 것이므로, 그것들을 썼는지로 따로 점수를 매기지 않는다.
                //   점수는 네 모드 모두 아래 applyAiWritingScores 한 곳에서만 나온다.
    
                aiLastCorrectedText = String(feedback.correctedText || '').replace(/<[^>]*>/g, '');
                // [냐냐 요청] '이번 미션이 참고한 내용' 카드는 없앴다 (2026-09-02).
                //   채점 결과에 '이 문장이 쓴 내 문법' 이 이미 나오므로 겹치고,
                //   복습으로 들어온 미션이면 어떤 문법인지 미리 알려주는 셈이라 짐작하게 된다.
                applyAiWritingScores(feedback, koEsScoreNotes);   // 점수 카드는 그 아래에 이어 붙는다
                if (aiMissionReviewGrammarId && grammarReviewTotal) grammarReviewDone++;
                grammarReviewLastNoteId = aiMissionReviewGrammarId;
                aiMissionReviewGrammarId = null;   // 복습 한 번에 한 칸. 같은 미션을 다시 내도 또 나가지 않는다
                renderGrammarReviewBar('graded');
                resultBox.classList.remove('hidden');   // ⚠️ 847d5ce 에서 이 줄이 지워져 결과 카드가 안 보였다



                if (feedback.isCorrect) {
                    coachIcon.innerText = "🏆🏅";
                    coachVerdict.className = "text-sm font-bold text-emerald-600";
                    correctionBox.classList.add('hidden');
                } else {
                    coachIcon.innerText = "📝📝";
                    coachVerdict.className = "text-sm font-bold text-red-600";
                    correctionBox.classList.remove('hidden');
                    originalRender.innerHTML = feedback.originalMarked || userText;
                    correctedRender.innerHTML = feedback.correctedText;
                    renderAiChanges(feedback);
                }

                coachVerdict.innerText = feedback.verdict;
                coachMsg.innerHTML = feedback.message;

                renderAiTip(feedback.tip);
                renderAiNatural(feedback);

                // [냐냐 PATCH-수준맞춤] 1:1 첨삭(한->스) 결과도 학습 프로필에 반영
                learnerProfile.totalAnswered++;
                if (feedback.isCorrect) {
                    learnerProfile.totalCorrect++;
                } else if (aiCurrentWordForMission) {
                    const pos = aiCurrentWordForMission.pos || 'etc';
                    learnerProfile.wrongByPos[pos] = (learnerProfile.wrongByPos[pos] || 0) + 1;
                }

                aiChatHistory = [
                    { role: "system", content: "당신은 냐냐님의 상냥하고 친절한 스페인어 선생님입니다. 이전 번역 피드백에 이어지는 냐냐님의 추가 질문이나 의구심에 대해 명쾌하고 친근하게 한국어로 대답해주세요." },
                    { role: "assistant", content: `<b>미션:</b> ${aiCurrentKoreanSentence}<br><b>냐냐님 제출 답안:</b> ${userText}<br><b>선생님 총평:</b> ${feedback.message}<br><b>정석 가이드라인:</b> ${feedback.correctedText.replace(/<[^>]*>/g, '')}` }
                ];
                renderChatThread();

                recordAiNote('ko-es', aiCurrentKoreanSentence, userText, feedback);
                logAction('ai');
                saveToStorage();
                updateStats();
                scrollAiResultIntoView();
                showToast("AI 첨삭이 끝났습니다! 궁금한 점을 하단에서 바로 질문해 보세요! ✨", "success");
            } catch (e) {
                console.error(e);
                showToast(describeGeminiError(e), "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHtml;
            }
        }

        // ============================================================
        // [냐냐 PATCH] 내 예문으로 연습 모드
        // ============================================================
        let exampleMissionMode = 'translate'; // 'translate'(예문 그대로 번역) | 'similar'(비슷한 새 문장)

        function resetExampleMissionState() {
            aiCurrentWordForMission = null;
            aiCurrentKoreanSentence = "";
            const box = document.getElementById('ai-example-korean');
            if (box) box.innerText = "'문장 뽑기'를 누르면 등록한 단어의 예문으로 미션이 나와요.";
            const input = document.getElementById('ai-example-input');
            if (input) input.value = '';
            document.getElementById('ai-feedback-result').classList.add('hidden');
        }

        async function generateExampleMission() {
            // 예문이 있는 단어만 대상으로
            const withExample = vocabulary.filter(w => w.example && w.example.trim() && w.exampleMeaning && w.exampleMeaning.trim());
            if (withExample.length === 0) {
                showToast("예문이 등록된 단어가 없어요! 단어에 예문을 추가한 뒤 이용해 주세요.", "error");
                return;
            }

            const target = withExample[Math.floor(Math.random() * withExample.length)];
            aiCurrentWordForMission = target;

            // 절반은 예문 그대로 번역, 절반은 비슷한 새 문장 만들기
            exampleMissionMode = Math.random() < 0.5 ? 'translate' : 'similar';
            const badge = document.getElementById('ai-example-mode-badge');
            const koreanBox = document.getElementById('ai-example-korean');
            document.getElementById('ai-example-input').value = '';
            document.getElementById('ai-feedback-result').classList.add('hidden');

            if (exampleMissionMode === 'translate') {
                // 예문의 한국어 뜻을 미션으로 → 학생이 스페인어로 (원래 예문이 정답)
                if (badge) badge.innerText = '예문 그대로 번역 ✍️';
                aiCurrentKoreanSentence = target.exampleMeaning;
                koreanBox.innerText = target.exampleMeaning;
            } else {
                // AI가 예문을 참고해 비슷한 새 한국어 문장을 만들어 미션으로
                if (badge) badge.innerText = '비슷한 새 문장 🎲';
                if (!hasGeminiApiKey()) {
                    // 키 없으면 그냥 번역 모드로 대체
                    exampleMissionMode = 'translate';
                    if (badge) badge.innerText = '예문 그대로 번역 ✍️';
                    aiCurrentKoreanSentence = target.exampleMeaning;
                    koreanBox.innerText = target.exampleMeaning;
                    return;
                }
                koreanBox.innerText = "AI가 비슷한 문장을 만들고 있어요...";
                const btn = document.getElementById('ai-generate-example-btn');
                const orig = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> 생성 중...`;
                try {
                    const prompt = `단어 "${target.word}" (뜻: ${target.meaning})의 예문: "${target.example}" (${target.exampleMeaning}).
                    이 예문과 같은 단어를 쓰되, 상황/주어/목적어를 조금 바꾼 자연스러운 새 스페인어 문장 1개와 그 한국어 번역을 만들어줘. 너무 어렵지 않게, 원래 예문과 난이도 비슷하게.`;
                    const system = `You are a Spanish tutor. Create ONE new natural Spanish sentence using the same target word, similar in difficulty to the given example. Return JSON only.`;
                    const schema = {
                        type: "OBJECT",
                        properties: {
                            spanish: { type: "STRING", description: "새 스페인어 문장" },
                            korean: { type: "STRING", description: "그 문장의 자연스러운 한국어 번역" }
                        },
                        required: ["spanish", "korean"]
                    };
                    const responseText = await callGemini(prompt, system, schema, 'low', GEMINI_MODEL_FLASH_LITE);
                    const res = extractAndParseJson(responseText);
                    aiCurrentKoreanSentence = res.korean || target.exampleMeaning;
                    koreanBox.innerText = aiCurrentKoreanSentence;
                } catch (e) {
                    console.error(e);
                    // 실패 시 예문 그대로 번역으로 대체
                    exampleMissionMode = 'translate';
                    if (badge) badge.innerText = '예문 그대로 번역 ✍️';
                    aiCurrentKoreanSentence = target.exampleMeaning;
                    koreanBox.innerText = target.exampleMeaning;
                    showToast("새 문장 생성에 실패해서 예문 번역으로 대체했어요", "info");
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = orig;
                }
            }
        }

        // 예문 연습 답변 제출 — 기존 한->스 채점 로직을 재사용 (aiCurrentWordForMission/aiCurrentKoreanSentence 세팅됨)
        async function submitExampleMission() {
            if (!aiCurrentWordForMission) {
                showToast("먼저 '✨ 문장 뽑기'를 눌러서 미션을 받아주세요!", "error");
                return;
            }
            const userText = document.getElementById('ai-example-input').value.trim();
            if (!userText) {
                showToast("스페인어 답변을 입력해 주세요!", "error");
                return;
            }
            if (!hasGeminiApiKey()) {
                showToast("Gemini API 키가 등록되지 않아 AI 채점을 사용할 수 없습니다. 우측 상단 배지에서 키를 등록해 주세요!", "error");
                openApiKeyModal();
                return;
            }

            const submitBtn = document.getElementById('ai-example-submit-btn');
            const originalHtml = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> 분석 중...`;
            AudioFX.playPunch();

            // [냐냐 요청] 여기도 스페인어를 직접 쓰는 곳이라 스→한과 똑같이 단어·문법 점수를 매긴다
            const exScoreNotes = aiScoringNoteList();
            resetAiWritingScores();

            const refExample = aiCurrentWordForMission.example || '';
            const prompt = `Korean Mission: "${aiCurrentKoreanSentence}"
            Target Word we practice: "${aiCurrentWordForMission.word}" (Meaning: "${aiCurrentWordForMission.meaning}")
            Reference example sentence (for context): "${refExample}"
            Student's Spanish Answer: "${userText}"

            The student is translating the Korean mission into Spanish using the target word. Check translation accuracy, grammar, and natural usage of the target word. For "correctedText": wrap ONLY the words you actually changed/added inside '<span class='text-red-600 font-extrabold underline'>...</span>' tags; already-correct words stay plain. BEFORE OUTPUT, walk the two sentences word by word: if a word appears in the student's sentence and in your correction in the SAME form, it was NOT changed — leave it plain. Marking an unchanged word is a mistake; the student reads the red as "this is what I got wrong". Write the tag with SINGLE quotes exactly as shown — a double quote inside a JSON string breaks the whole response, and the student then sees a sentence that stops mid-way. The reverse is just as bad: EVERY word you changed, added or re-formed must be wrapped — es→está, el pie→mis pies and an added "mucho" all get tags. Count the differences between the two sentences, count your tags, and make the two numbers match. When you EXTEND a sentence, tag only the words you actually added: for "Ayer vi una película." → "Ayer vi una película con mi amigo y cenamos juntos.", the tags go on "con mi amigo y cenamos juntos" alone — "vi una película" stayed exactly as the student wrote it and must stay plain. Split "changes" the same way, one row per piece that really differs; never write a row whose "from" repeats words that did not change. Then give "changes" one row per difference, in the same order — a change you made but never explained leaves the student guessing why their sentence was rewritten. For "originalMarked": output the student original sentence verbatim, wrapping ONLY the wrong words inside '<span class='line-through text-slate-400'>...</span>' tags; correct words stay plain.
            ${aiScoringNoteListText(exScoreNotes)}
            ${buildLearnerProfileSummary()}`;

            const system = `You are an encouraging and precise Spanish tutor tutoring a student named "냐냐".
            Return feedback matching this exact JSON schema:
            {
               "isCorrect": true/false,
               "verdict": "e.g., 완벽한 정답이에요! 🎉 or 다시 한 번 살펴볼까요? 📝",
               "correctedText": "The perfect standard Spanish sentence. Wrap ONLY changed words in red span tags; correct words plain.",
               "originalMarked": "The student original sentence verbatim, with ONLY wrong words wrapped in line-through span tags; correct words plain.",
               "message": "Concise evaluation in Korean, 1-2 sentences. Mention '냐냐님' and the key grammar point.",
               "breakdown": [ { "word": "ONE Spanish word", "mean": "Korean meaning 1-4 words" } ],
               "tip": "냐냐님에게 주는 학습 설명. 이 항목이 AI 코멘트를 대신하므로 자세히 쓸 것. 반드시 줄바꿈(\\n)으로 나눈 두 줄로 쓸 것. 한 덩어리로 이어 쓰지 말 것. 1번째 줄: 이번 문장에서 잘한 점 또는 틀린 핵심 한 문장. 2번째 줄: 그 문법이 왜 그렇게 되는지 규칙 설명 1~2문장. 각 줄은 60자 이내로 짧게. 예문은 넣지 말 것 — 고친 문장이 이미 위에 있음. 격려만 늘어놓지 말고 실제로 배울 내용을 담을 것."${AI_ISSUE_JSON_FIELD},${AI_SCORING_JSON_FIELDS}${AI_NATURAL_JSON_FIELDS}
            }
            IMPORTANT for "breakdown": split correctedText into individual words (3-7 items), each exactly ONE word, "mean" never empty, no duplicates.${AI_SCORING_RULES_TEXT}${AI_NATURAL_RULES_TEXT}
            Do not wrap JSON in markdown blockticks.`;

            const schema = {
                type: "OBJECT",
                properties: {
                    isCorrect: { type: "BOOLEAN" },
                    verdict: { type: "STRING" },
                    correctedText: { type: "STRING" },
                    originalMarked: { type: "STRING" },
                    message: { type: "STRING" },
                    breakdown: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                word: { type: "STRING", description: "Exactly one Spanish word or particle" },
                                mean: { type: "STRING", description: "Korean meaning, 1-4 words, never empty" }
                            },
                            required: ["word", "mean"]
                        }
                    },
                    tip: { type: "STRING" },
                    ...aiIssueSchemaProp(),
                    ...aiScoringSchemaProps(),
                    ...aiNaturalSchemaProps()
                },
                required: ["isCorrect", "verdict", "correctedText", "originalMarked", "message", "breakdown", "tip", "issueType", ...AI_SCORING_REQUIRED, ...AI_NATURAL_REQUIRED]
            };

            try {
                const responseText = await callGemini(prompt, system, schema, 'low');
                const feedback = extractAndParseJson(responseText);

                const resultBox = document.getElementById('ai-feedback-result');
                const correctionBox = document.getElementById('ai-coach-correction-box');
                const originalRender = document.getElementById('ai-original-render');
                const correctedRender = document.getElementById('ai-corrected-render');
                const coachVerdict = document.getElementById('ai-coach-verdict');
                const coachMsg = document.getElementById('ai-coach-message');
                const coachTip = document.getElementById('ai-coach-tip');
                const coachIcon = document.getElementById('ai-coach-icon');

                // [냐냐 요청] 이 문장이 쓴 단어·문법에 점수를 반영하고 결과에 보여준다 (해제 버튼 포함)
                applyAiWritingScores(feedback, exScoreNotes);

                resultBox.classList.remove('hidden');

                if (feedback.isCorrect) {
                    coachIcon.innerText = "🏆🏅";
                    coachVerdict.className = "text-sm font-bold text-emerald-600";
                    correctionBox.classList.add('hidden');
                } else {
                    coachIcon.innerText = "📝📝";
                    coachVerdict.className = "text-sm font-bold text-red-600";
                    correctionBox.classList.remove('hidden');
                    originalRender.innerHTML = feedback.originalMarked || userText;
                    correctedRender.innerHTML = feedback.correctedText;
                    renderAiChanges(feedback);
                }

                coachVerdict.innerText = feedback.verdict;
                coachMsg.innerHTML = feedback.message;

                renderAiTip(feedback.tip);
                renderAiNatural(feedback);

                // 학습 프로필 반영
                learnerProfile.totalAnswered++;
                if (feedback.isCorrect) {
                    learnerProfile.totalCorrect++;
                } else if (aiCurrentWordForMission) {
                    const pos = aiCurrentWordForMission.pos || 'etc';
                    learnerProfile.wrongByPos[pos] = (learnerProfile.wrongByPos[pos] || 0) + 1;
                }

                aiChatHistory = [
                    { role: "system", content: "당신은 냐냐님의 상냥한 스페인어 선생님입니다. 이전 번역 피드백에 이어지는 추가 질문에 친근하게 한국어로 답해주세요." },
                    { role: "assistant", content: `<b>미션:</b> ${aiCurrentKoreanSentence}<br><b>제출 답안:</b> ${userText}<br><b>총평:</b> ${feedback.message}<br><b>정석:</b> ${feedback.correctedText.replace(/<[^>]*>/g, '')}` }
                ];
                renderChatThread();

                recordAiNote('example', aiCurrentKoreanSentence, userText, feedback);
                logAction('ai');
                saveToStorage();
                updateStats();
                scrollAiResultIntoView();
                showToast("AI 첨삭이 끝났습니다! ✨", "success");
            } catch (e) {
                console.error(e);
                showToast(describeGeminiError(e), "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHtml;
            }
        }

        // ============================================================
        // [냐냐 요청] 스→한 자유 문장 첨삭에서도 문법표 점수를 반영한다.
        //   한→스는 문법을 정해주고 그 문법이 필요한 미션을 내지만,
        //   여기는 냐냐가 아무 문장이나 쓰므로 'AI 가 짚어준 노트'를 근거로 삼는다.
        //   점수는 제대로 씀 +1 / 틀리게 씀 −2 (한→스는 +2 — 거긴 그 문법을 써야만 풀리는 미션이다).
        //   AI 가 짚은 노트는 개수 제한 없이 다 반영한다 (한 문장이 문법 세 개를 쓰면 세 개 다).
        //   대신 AI 가 없는 제목을 지어낼 수 있으니 실제 노트와 이름이 맞는 것만 반영한다.
        // ============================================================
        let aiLastEsKoGrammar = [];   // [{ note, usage, delta }] — 결과 화면에 보여주려고 기억
        let aiLastEsKoWords = [];     // [{ word, ok, delta }] — 스펠링 판정 결과
        let aiLastIdiomHits = [];     // [{ word, idiom, ok }] — 이 문장이 쓴 관용구 (곡선만 돌린다)

        // [냐냐 요청] 자유 문장에 쓴 '내 단어장 단어' 의 스펠링 점수 — 맞으면 +2 / 틀리면 −2.
        //   AI 가 돌려준 단어를 실제 단어장과 이름으로 맞춰본다. 없는 단어는 버린다.
        //   ⚠️ 뜻이 맞았는지는 보지 않는다 (유의어·문맥 탓에 판정이 부정확해서 원래부터 안 건드렸다)
        // 응답을 [{ name, ok }] 로 펴준다.
        //   지금 형식은 맞음/틀림이 갈린 문자열 배열(wordsOk/wordsBad)이다. 예전 형식
        //   ([{word, spelling}])도 받아준다 — 모델이 옛 꼴로 답해도 점수가 조용히 사라지지 않게.
        // [냐냐 요청] 첨삭이 "solo|adverb" 처럼 품사를 붙여 보낸다. 같은 철자가 품사만 다르게
        //   두 번 등록된 단어(solo 부사/형용사, joven 명사/형용사 등 11개)를 가려내려고 쓴다.
        //   ⚠️ 문법 노트 제목에도 이 함수를 쓴다. 제목에 | 가 들어 있어도 잘리면 안 되므로
        //      뒤 조각이 진짜 품사 이름일 때만 가른다.
        const AI_POS_WORDS = new Set(['noun', 'verb', 'adjective', 'adverb', 'preposition',
            'pronoun', 'conjunction', 'interrogative', 'phrase']);
        //   [냐냐 요청] neutralKey 는 '점수를 안 주는' 칸이다 (ok === null).
        //     철자는 맞는데 활용·성수를 틀린 낱말 — 맞다고 +2 를 주면 성수일치 지적 바로 밑에
        //     그 동사가 +2 로 붙어 앞뒤가 안 맞는다. 틀렸다고 −2 를 주기엔 낱말을 아는 건 맞다.
        function flattenScoredList(feedback, okKey, badKey, legacyKey, legacyName, legacyFlag, neutralKey) {
            const out = [];
            const push = (v, ok) => {
                let s = String(v || '').trim();
                if (!s) return;
                let pos = '';
                const bar = s.lastIndexOf('|');
                if (bar > 0) {
                    const tail = s.slice(bar + 1).trim().toLowerCase();
                    if (AI_POS_WORDS.has(tail)) { pos = tail; s = s.slice(0, bar).trim(); }
                }
                if (s) out.push({ name: s, ok, pos });
            };
            if (Array.isArray(feedback && feedback[okKey])) feedback[okKey].forEach(v => push(v, true));
            if (neutralKey && Array.isArray(feedback && feedback[neutralKey])) feedback[neutralKey].forEach(v => push(v, null));
            if (Array.isArray(feedback && feedback[badKey])) feedback[badKey].forEach(v => push(v, false));
            // [냐냐 요청] AI 가 같은 항목을 맞음·틀림 양쪽에 넣어 오는 일이 있다.
            //   그럴 땐 틀림을 따른다 — 고쳐놓고 '제대로 썼다'고 하는 것보다, 한 번 더
            //   짚고 넘어가는 쪽이 덜 억울하다 (게다가 점수는 해제 버튼으로 되돌릴 수 있다).
            const bad = new Set(out.filter(e => e.ok === false).map(e => e.name.toLowerCase()));
            const neutral = new Set(out.filter(e => e.ok === null).map(e => e.name.toLowerCase()));
            if (bad.size || neutral.size) {
                for (let i = out.length - 1; i >= 0; i--) {
                    const n = out[i].name.toLowerCase();
                    if (out[i].ok === true && (bad.has(n) || neutral.has(n))) out.splice(i, 1);
                    else if (out[i].ok === null && bad.has(n)) out.splice(i, 1);
                }
            }
            if (!out.length && Array.isArray(feedback && feedback[legacyKey])) {
                feedback[legacyKey].forEach(it => {
                    const flag = String((it && it[legacyFlag]) || '').toLowerCase();
                    if (flag === 'correct' || flag === 'wrong') push(it && it[legacyName], flag === 'correct');
                });
            }
            return out;
        }

        //   okDelta 를 안 주면 +2. 스→한 자유 작문만 +1 을 넘긴다 (문법과 같은 규칙).
        // [냐냐 요청] 엉뚱한 단어에 점수가 붙는 일이 있었다.
        //   AI 가 "se"(재귀대명사)나 "nada"(아무것도) 같은 기능어를 보내면, 역추적이 그걸
        //   동사 활용형으로 알아들었다 — se → saber(sé), nada → nadar(3인칭 단수).
        //   지시문에 '기능어는 빼라'고 적어뒀지만 가끔 섞여 온다.
        //   단어장에 그 낱말이 그대로 등록돼 있으면 그건 진짜니까 그대로 두고,
        //   등록돼 있지 않을 때만 '활용형이겠지' 하는 추측을 막는다.
        // [냐냐 요청] 여기 있는 낱말은 '아직 단어장에 없어요' 추천에서 뺀다.
        //   지시사만 해도 este/esta/esto/estos/estas … 열다섯 개라 다 등록하자면 끝이 없다.
        //   문법 노트에서 표로 익히는 것들이라 낱말 카드로 외울 것도 아니다.
        //   ⚠️ 점수는 그대로 붙는다 — 단어장에 직접 등록해 둔 것은 여기 있어도 그대로 채점된다
        //      (이 목록은 '활용형을 추측해서 억지로 맞추지 마라' 는 뜻으로도 쓰인다).
        //   악센트를 뗀 꼴과 붙인 꼴을 같이 넣어 둔다 — 두 자리에서 각각 다르게 다듬어 오기 때문.
        const AI_FUNCTION_WORDS = new Set([
            'el','la','los','las','un','una','unos','unas','al','del','lo',
            'a','de','en','con','por','para','sin','sobre','entre','hasta','desde','hacia','tras',
            'me','te','se','nos','os','le','les','mi','tu','su','mis','tus','sus',
            'yo','ti','ella','ello','ellos','ellas','usted','ustedes','nosotros','vosotros',
            'el','tu','tú','él',
            'y','e','o','u','ni','que','si','no','pero','como','cuando','donde',
            'nada','nadie','nunca','algo','alguien','muy','ya','tan','solo',
            // 지시형용사·지시대명사
            'este','esta','esto','estos','estas',
            'ese','esa','eso','esos','esas',
            'aquel','aquella','aquello','aquellos','aquellas',
            // 소유대명사 (~의 것)
            'mio','mía','mio','mía','mios','mias','mío','míos','mías',
            'tuyo','tuya','tuyos','tuyas','suyo','suya','suyos','suyas',
            'nuestro','nuestra','nuestros','nuestras','vuestro','vuestra','vuestros','vuestras',
            // 의문사
            'qué','quién','quiénes','cuál','cuáles','cuándo','dónde','cómo','cuánto','cuánta','cuántos','cuántas',
            'quien','quienes','cual','cuales','cuanto','cuanta','cuantos','cuantas','porqué','porque',
            // 비교·정도
            'más','mas','menos','tanto','tanta','tantos','tantas','también','tambien','tampoco'
        ]);

        // [냐냐 요청] 이 문장에 딸린 추천.
        //   ① 문장에 나온 단어에 내가 등록해둔 관용구 중 이번에 안 쓴 것
        //      — 아는 표현인데 안 떠올린 것이라 다음에 써먹기 좋다
        //   ② 문장에는 나왔는데 단어장에 없는 낱말 — 등록하러 갈 수 있게
        //   AI 를 더 부르지 않는다. 교정본과 내 단어장만으로 만든다.
        let aiLastSuggest = { idioms: [], newWords: [] };

        function buildAiSuggestions(feedback) {
            const out = { idioms: [], newWords: [] };
            const text = String(feedback && feedback.correctedText || '').replace(/<[^>]*>/g, '');
            const norm = (t) => (typeof normalizeSpanishAnswer === 'function') ? normalizeSpanishAnswer(t, false) : String(t || '').toLowerCase();
            const flat = ' ' + norm(text) + ' ';
            if (!flat.trim()) return out;

            // [냐냐 요청] '이 문장에 쓸 수 있었던 내 관용구' 는 없앴다 (2026-09-02).
            //   문장에 든 낱말 하나만 겹쳐도 그 낱말에 달린 표현이 전부 딸려나왔다 —
            //   'el pie' 때문에 'a pie', 'porque' 때문에 'por qué' 가 뜨는 식이라 맞는 게 없었다.
            //   실제로 쓴 표현은 '이 문장이 쓴 관용구' 가 이미 보여준다.

            // ② 문장에 나왔는데 단어장에 없는 낱말 — 분석(breakdown) 이 이미 낱말을 갈라놨으니 그걸 쓴다
            const words = new Set();
            (feedback && Array.isArray(feedback.breakdown) ? feedback.breakdown : []).forEach(it => {
                const raw = String((it && it.word) || '').trim();
                if (!raw || raw.length < 2) return;
                if (typeof findVocabWordByForm === 'function' && findVocabWordByForm(raw)) return;   // 이미 있음
                if (typeof AI_FUNCTION_WORDS !== 'undefined' && AI_FUNCTION_WORDS.has(norm(raw))) return;
                if (words.has(raw.toLowerCase())) return;
                words.add(raw.toLowerCase());
                out.newWords.push({ word: raw, mean: String((it && it.mean) || '').trim() });
            });
            out.newWords = out.newWords.slice(0, 5);
            return out;
        }

        function aiSuggestHtml() {
            const s = aiLastSuggest || { idioms: [], newWords: [] };
            if (!s.newWords.length) return '';
            const wordPart = s.newWords.length ? `
                <div>
                    <p class="text-[11px] font-bold text-slate-500 mb-1">➕ 아직 단어장에 없어요</p>
                    <div class="flex flex-wrap gap-1.5">
                        ${s.newWords.map(x => `<button type="button" onclick="openQuickWordRegister(this.dataset.w)" data-w="${escapeAttr(x.word)}" title="눌러서 등록하기" class="inline-flex items-center gap-1 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg px-2 py-0.5 text-[11px] font-semibold transition-colors">
                            <i class="fa-solid fa-plus text-[9px]"></i><b>${escapeHtml(x.word)}</b>
                            <span class="text-[10px] text-slate-400">${escapeHtml(x.mean)}</span>
                        </button>`).join('')}
                    </div>
                </div>` : '';
            return `<div class="mt-3 pt-3 border-t border-slate-200">${wordPart}</div>`;
        }

        // 첨삭이 짚은 표현이 내 관용구 목록에 있나 (관사·자리표시자·악센트를 무시하고 맞춰본다)
        // 자리표시자를 떼면 낱말 하나만 남는 표현이 1113개 중 84개 있다 ("ser [시간/날짜]" → "ser").
        //   그 조각은 아무 문장에나 걸린다 — es 한 번 썼다고 'ser [색깔형용사]' 곡선이 앞으로 가면 안 된다.
        //   두 낱말 이상이거나 6글자가 넘는 것만 표현으로 인정한다 (pintarse·desayunar 같은 건 그대로 잡힌다).
        function idiomKeyUsable(k) {
            return !!k && (k.split(' ').length >= 2 || k.length >= 6);
        }

        // [냐냐 지적] 악센트를 떼고 맞추다 보니 'porque'(왜냐하면) 를 쓴 문장이 'el porqué'(까닭) 를
        //   썼다고 잡혔다. si/sí, que/qué 도 같은 짝이다. 앱은 어디서나 악센트를 보므로 여기서도 본다.
        function findIdiomEntryByText(raw) {
            const key = (typeof normalizeSpanishAnswer === 'function') ? normalizeSpanishAnswer(raw, true) : String(raw || '').toLowerCase();
            if (!idiomKeyUsable(key)) return null;
            for (const w of vocabulary) {
                const list = (typeof wordIdiomList === 'function') ? wordIdiomList(w) : [];
                for (const it of list) {
                    const k2 = (typeof normalizeSpanishAnswer === 'function') ? normalizeSpanishAnswer(it.idiom, true) : String(it.idiom).toLowerCase();
                    if (k2 && k2 === key) return { w, it };
                }
            }
            return null;
        }

        // [냐냐 요청] 관용구는 AI 보고에 기대지 않고 문장을 직접 훑는다.
        //   'tener ganas de' 를 써도 AI 는 tener·ganar 로 쪼개 보내서 표현이 통째로 안 잡혔다.
        //   내 관용구 목록을 정답 문장에 대조하면 확실하다 (자리표시자·관사·악센트는 무시).
        function detectIdiomsInText(rawText) {
            const norm = (t) => (typeof normalizeSpanishAnswer === 'function') ? normalizeSpanishAnswer(t, true) : String(t || '').toLowerCase();
            const hay = ' ' + norm(String(rawText || '').replace(/<[^>]*>/g, '')) + ' ';
            if (hay.trim().length < 3) return [];
            const out = [];
            (vocabulary || []).forEach(w => {
                const list = (typeof wordIdiomList === 'function') ? wordIdiomList(w) : [];
                list.forEach(it => {
                    const k = norm(it.idiom);
                    // 너무 짧은 조각은 우연히 걸린다 (두 낱말 이상이거나 6글자 넘는 것만)
                    if (!idiomKeyUsable(k)) return;
                    if (hay.includes(' ' + k + ' ')) out.push({ w, it });
                });
            });
            return out;
        }

        function applyEsKoWordScores(feedback, okDelta) {
            const gainOk = (typeof okDelta === 'number') ? okDelta : WORD_SPELL_OK;
            aiLastEsKoWords = [];
            aiLastIdiomHits = [];

            // 정답 문장에 들어 있는 내 관용구 — 제대로 쓴 것이므로 곡선을 앞으로
            //   (점수는 단어 기준 그대로 두기로 했으니 여기서 점수는 안 건드린다)
            // [냐냐 기준] 곡선을 앞으로 미는 건 관용구 복습에서만. 여기서는 '썼다' 고 표시만 한다.
            //   (문장에 넣었다는 것만으로 한 칸 나가면 곡선이 너무 빨리 돈다 — 단어·문법과 같은 기준)
            const seenIdiom = new Set();
            detectIdiomsInText(feedback && feedback.correctedText).forEach(({ w, it }) => {
                const k = `${w.id}::${it.idiom}`;
                if (seenIdiom.has(k)) return;
                seenIdiom.add(k);
                aiLastIdiomHits.push({ word: w, idiom: it.idiom, ok: true });
            });
            const list = flattenScoredList(feedback, 'wordsOk', 'wordsBad', 'usedWords', 'word', 'spelling', 'wordsForm');
            if (!list.length || typeof vocabulary === 'undefined') return;

            // 관사를 떼고 악센트까지 그대로 비교한다 (carne ≠ carné 와 같은 이유)
            //   [냐냐 요청] 대괄호 자리표시자도 뗀다. 단어장에 "antes de [명사/동사원형]" 처럼
            //   적힌 항목이 26개 있는데, 냐냐가 문장에 쓰는 건 "antes de" 라서 예전엔 영영 안 맞았다.
            //   (빈칸·퀴즈 채점은 이미 대괄호를 떼고 있었는데 첨삭만 빠져 있었다)
            const norm = (s) => String(s || '').toLowerCase().trim().normalize('NFC')
                .replace(/\[[^\]]*\]/g, ' ')
                .replace(/^(el\/la|los\/las|un\/una|unos\/unas|el|la|los|las|un|una|unos|unas)\s+/, '')
                .replace(/\s+/g, ' ').trim();
            // 같은 철자가 품사만 다르게 등록된 단어가 11개 있다 (solo 부사/형용사, joven 명사/형용사 …).
            //   예전엔 먼저 등록된 쪽만 map 에 남아서, 나머지 하나는 첨삭 점수를 영영 못 받았다.
            //   이제 후보를 모두 들고 있다가 첨삭이 알려준 품사로 고른다.
            const byWord = new Map();
            vocabulary.forEach(w => {
                const k = norm(w.word);
                if (!k) return;
                if (!byWord.has(k)) byWord.set(k, []);
                byWord.get(k).push(w);
            });
            // 품사를 못 받았거나 맞는 게 없으면 예전처럼 먼저 등록된 것을 쓴다
            const pickByPos = (cands, pos) => {
                if (!cands || !cands.length) return null;
                if (cands.length === 1 || !pos) return cands[0];
                return cands.find(w => String(w.pos || '').toLowerCase() === pos) || cands[0];
            };

            // [냐냐 지적] 내가 쓰지도 않은 낱말에 점수가 붙었다 — es 라고 썼는데 AI 가 está 로 고쳐놓고
            //   estar 에 +2 를 줬다. 프롬프트로 여러 번 못박아도 흔들려서 여기서 직접 거른다.
            //   내 원문(originalMarked)의 낱말을 단어장과 맞춰 '내가 쓴 단어' 집합을 만들고,
            //   그 밖의 것은 점수를 안 붙인다. 원문을 못 받았을 때만 예전처럼 다 받아준다.
            const mineText = String((feedback && feedback.originalMarked) || '').replace(/<[^>]*>/g, ' ');
            const mineIds = new Set();
            if (mineText.trim()) {
                const flat = ' ' + norm(mineText.replace(/[^\p{L}\p{N}\s]/gu, ' ')) + ' ';
                mineText.split(/[^\p{L}\p{N}]+/u).forEach(tok => {
                    if (!tok) return;
                    const hit = (typeof findVocabWordByForm === 'function') ? findVocabWordByForm(tok) : null;
                    if (hit) mineIds.add(hit.id);
                });
                // 여러 낱말짜리 표현은 토막으로는 안 잡힌다 — 통째로 들어 있는지 한 번 더 본다
                vocabulary.forEach(w => {
                    const k = norm(w.word);
                    if (k && k.includes(' ') && flat.includes(' ' + k + ' ')) mineIds.add(w.id);
                });
            }
            const done = new Set();
            list.forEach(item => {
                const key = norm(item.name);
                // 사전형이 단어장 표기와 조금 달라도(활용형·복수형) 역추적으로 한 번 더 찾아본다
                // [냐냐 요청] 관용구를 문장에 썼으면 그 표현의 곡선을 돌린다.
                //   점수는 손대지 않는다 — 점수는 단어 기준 그대로 두기로 했다.
                //   (그래야 단어와 관용구가 같이 잡혀도 같은 단어에 두 번 붙지 않는다)
                //   AI 가 표현을 통째로 짚어 준 경우 — 위 훑기가 못 잡은 것만 (틀리게 쓴 것이 여기 걸린다)
                if (typeof idiomReviewDemote === 'function') {
                    const hitIdiom = findIdiomEntryByText(item.name);
                    // 형태를 틀린 낱말(ok === null)은 곡선도 안 건드린다 — 점수를 안 주기로 한 것과 같은 이유
                    if (hitIdiom && item.ok !== null && !aiLastIdiomHits.some(h => h.word.id === hitIdiom.w.id && h.idiom === hitIdiom.it.idiom)) {
                        // 틀리게 쓴 것만 곡선을 건드린다 (진입·후퇴). 잘 쓴 건 표시만.
                        if (!item.ok) idiomReviewDemote(hitIdiom.w.id, hitIdiom.it.idiom);
                        aiLastIdiomHits.push({ word: hitIdiom.w, idiom: hitIdiom.it.idiom, ok: item.ok });
                    }
                }
                const exact = pickByPos(byWord.get(key), item.pos);
                // 기능어는 정확히 등록돼 있을 때만 인정한다 (활용형 추측 금지)
                const w = exact || (AI_FUNCTION_WORDS.has(key) ? null
                    : ((typeof findVocabWordByForm === 'function' && key) ? findVocabWordByForm(key) : null));
                if (!w || done.has(w.id)) return;
                if (mineIds.size && !mineIds.has(w.id)) return;   // 내가 안 쓴 낱말이면 점수를 안 붙인다
                done.add(w.id);
                // [냐냐 요청] 철자는 맞는데 활용·성수를 틀린 낱말은 점수를 안 준다 (0점, 곡선도 그대로).
                const noScore = (item.ok === null);
                const ok = (item.ok === true);
                const delta = noScore ? 0 : (ok ? gainOk : WORD_SPELL_BAD);
                // [냐냐 요청] 되돌릴 수 있게 반영 '전' 상태를 통째로 떠둔다.
                //   AI 가 의도와 다른 단어로 알아듣는 경우가 있어서 한 건씩 해제할 수 있어야 한다.
                //   델타만 빼면 안 된다 — 오답이면 lastWrongDate·reviewStage 까지 바뀌기 때문.
                const prev = snapshotWordScoreState(w);
                // [냐냐 요청] 등급이 바뀌면 결과 카드에서 알려준다 (안 바뀌면 아무 말 안 한다)
                const gradeBefore = (typeof getWordGrade === 'function') ? getWordGrade(w) : null;
                // 정답률·망각곡선까지 같이 반영되도록 단어 점수는 addWordScore 로 (퀴즈·복습과 같은 경로)
                if (delta && typeof addWordScore === 'function') addWordScore(w, delta, { correct: ok });
                aiLastEsKoWords.push({ word: w, ok, noScore, delta, baseDelta: delta, prev, gradeBefore, state: 'normal', undone: false });
            });
        }

        //   [냐냐 요청] 문법을 제대로 썼을 때 주는 점수는 모드마다 다르다.
        //     한→스 랜덤 미션 / 질문에 답하기 / 내 예문 연습 = +2
        //     스→한 자유 작문 = +1 (아는 문법을 골라 쓰는 거라 절반)
        //     틀리게 쓴 경우는 어디서든 −2.
        //   ok = 제대로 썼나 / canMove = 복습 배너로 시작한 그 미션인가
        function applyGrammarCurve(id, ok, canMove) {
            if (ok) {
                if (canMove && typeof grammarReviewAdvance === 'function') grammarReviewAdvance(id);
                return;                                   // 복습 밖에서 잘 쓴 건 점수만
            }
            if (canMove && typeof grammarReviewDemote === 'function') grammarReviewDemote(id);
            else if (typeof grammarReviewEnter === 'function') grammarReviewEnter(id);
        }

        // ============================================================
        // [냐냐 요청] 근거 확인 — AI 가 문법 노트를 짚을 때 '문장의 어느 조각 때문인지'를 같이 받는다.
        //   그 조각이 냐냐님 문장에도, 고친 문장에도 없으면 그 노트는 버린다(점수도 곡선도 없음).
        //   제목만 보고 아무 문장에나 갖다 붙이던 것을 코드로 막는 장치다.
        //   ⚠️ AI 가 형식을 통째로 무시하고 제목만 보내면 확인을 끈다 — 안 그러면 문법 점수가 전부 사라진다.
        // ============================================================
        function aiStripTags(html) {
            return String(html || '').replace(/<[^>]*>/g, ' ');
        }
        // 비교용으로 악센트·대소문자·문장부호를 지운다 (ñ 은 NFD 에서 n 으로 풀려 양쪽 다 같아진다)
        function grammarEvidenceNorm(s) {
            return String(s || '')
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .replace(/[^a-z0-9 ]+/g, ' ')
                .replace(/\s+/g, ' ').trim();
        }
        //   문장을 따로따로 담는다 — 이어 붙이면 '내 문장 끝 + 고친 문장 앞'이 한 조각처럼 걸린다
        function grammarEvidenceHaystack(feedback) {
            const f = feedback || {};
            return [f.originalMarked, f.correctedText, f.userText]
                .map(x => grammarEvidenceNorm(aiStripTags(x))).filter(Boolean);
        }
        // 조각이 문장에 있나. '...' 은 사이가 벌어진 규칙(más ... que)이라 한 문장 안에서 순서만 맞으면 인정
        function grammarEvidenceFound(ev, hays) {
            const parts = String(ev || '').replace(/…/g, '...').split('...')
                .map(x => grammarEvidenceNorm(x)).filter(Boolean);
            const list = Array.isArray(hays) ? hays : [hays];
            if (!parts.length || !list.length) return false;
            return list.some(hay => {
                if (!hay) return false;
                let from = 0;
                for (const part of parts) {
                    const at = hay.indexOf(part, from);
                    if (at < 0) return false;
                    from = at + part.length;
                }
                return true;
            });
        }

        function applyEsKoGrammarScores(feedback, notes, okDelta) {
            const gainOk = (typeof okDelta === 'number') ? okDelta : GRAMMAR_TRANS_OK;
            aiLastEsKoGrammar = [];
            const list = flattenScoredList(feedback, 'grammarOk', 'grammarBad', 'usedGrammar', 'title', 'usage');
            if (!list.length || !notes || !notes.length) return;
            if (typeof addGrammarScore !== 'function') return;

            const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, '');
            const byTitle = new Map();
            notes.forEach(t => byTitle.set(norm(t.title), t));

            // '제목 >> 근거 조각' 을 갈라서, 근거가 문장에 실제로 있는 것만 남긴다
            const hay = grammarEvidenceHaystack(feedback);
            const useEvidence = list.some(it => String(it.name || '').includes('>>'));
            const parsed = [];
            list.forEach(item => {                       // AI 가 짚은 만큼 다 반영한다 (개수 제한 없음)
                const cut = String(item.name || '').split('>>');
                const title = cut[0].trim();
                const ev = cut.slice(1).join('>>').trim();
                const note = byTitle.get(norm(title));
                if (!note) return;                       // 지어낸 제목은 버린다
                if (useEvidence && !grammarEvidenceFound(ev, hay)) return;   // 근거를 못 대면 점수도 없다
                parsed.push({ note, ok: item.ok, ev });
            });
            // 같은 노트가 맞음·틀림 양쪽에 오면 틀림을 따른다 (근거가 달라서 앞단 정리에 안 걸린다)
            const badIds = new Set(parsed.filter(x => x.ok === false).map(x => x.note.id));

            const done = new Set();
            parsed.forEach(item => {
                const note = item.note;
                if (done.has(note.id)) return;           // 중복은 버린다
                if (item.ok && badIds.has(note.id)) return;
                done.add(note.id);
                const usage = item.ok ? 'correct' : 'wrong';
                const delta = item.ok ? gainOk : GRAMMAR_TRANS_BAD;
                // [냐냐 요청] 망각곡선까지 담아야 '다 돌릴 수 있다'. 예전엔 점수만 담아서
                //   해제해도 곡선에 들어간 건 그대로 남았다.
                const prev = {
                    score: (typeof grammarScores !== 'undefined') ? grammarScores[note.id] : undefined,
                    transUsed: (typeof grammarTransUsed !== 'undefined') ? grammarTransUsed[note.id] : undefined,
                    mastered: (typeof masteredGrammar !== 'undefined') ? masteredGrammar[note.id] : undefined,
                    review: (typeof grammarReview !== 'undefined' && grammarReview[note.id])
                        ? JSON.parse(JSON.stringify(grammarReview[note.id])) : undefined
                };
                addGrammarScore(note.id, delta, { transUsed: usage === 'correct' });
                // [냐냐 기준] 곡선에 들어오는 건 어디서든, 칸이 움직이는 건 복습 배너로 시작한 미션에서만.
                //   그래야 아무 데서나 한 칸씩 나가서 너무 빨리 졸업하는 일이 없다.
                //   여기 밖에서 제대로 쓴 것은 점수(+2)로만 쳐준다 — 단어의 wordsOk 와 같은 대접.
                const canMove = (note.id === aiMissionReviewGrammarId);
                applyGrammarCurve(note.id, item.ok, canMove);
                aiLastEsKoGrammar.push({ note, usage, delta, baseDelta: delta, prev, canMove, ev: item.ev, state: 'normal', undone: false });
            });
        }

        // [냐냐 요청] AI 가 잘못 알아들어 붙은 점수를 한 건씩 해제한다.
        //   반영 전 상태를 그대로 되돌린다 (점수뿐 아니라 정답/오답 횟수, 망각곡선 날짜까지).
        function snapshotWordScoreState(w) {
            const keys = ['score', 'correctTotal', 'wrongTotal', 'lastWrongDate', 'reviewStage',
                          'lastDemoteDate', // 곡선을 하루 한 번만 물리는 표시 — 되돌릴 때 같이 지워야 재반영이 먹는다
                          'lastReviewDate', 'weak', 'mastered', 'perfect', 'subjectivePassed'];
            const snap = {};
            keys.forEach(k => { snap[k] = w[k]; });
            return snap;
        }

        function restoreWordScoreState(w, snap) {
            Object.keys(snap).forEach(k => {
                if (snap[k] === undefined) delete w[k];
                else w[k] = snap[k];
            });
        }

        // ============================================================
        // [냐냐 요청] 스페인어로 직접 쓰는 모드는 모두 같은 방식으로 점수를 매긴다.
        //   스→한(자유 작문) · 질문에 답하기 · 내 예문으로 연습 — 셋 다 냐냐가 스페인어를
        //   직접 쓰는 곳이라 한쪽만 점수가 붙으면 일관성이 없다.
        //   지시문·스키마·반영 함수를 여기 한 곳에 두고 세 곳이 같이 쓴다.
        // ============================================================
        function aiScoringNoteList() {
            return (typeof getAllGrammarTables === 'function') ? getAllGrammarTables() : [];
        }
        // ============================================================
        // [냐냐 요청] AI 채점 단서 — 노트 하나를 통째로 읽혀 '이 노트가 실제로 가르치는 규칙' 한 줄을 미리 받아둔다.
        //   왜: 제목이 넓은 노트(예: '위치를 나타내는 표현' 인데 내용은 al/del 축약)는 AI 가 제목만 보고
        //   아무 문장에나 갖다 붙였다. 프롬프트로 네 번 조여도 단서 자체가 거칠어서 한계가 있었다.
        //   제목을 좁히는 건 냐냐님 손이 많이 가고, 규칙 줄은 노트 내용만 보면 AI 가 만들 수 있다.
        //   ⚠️ 만들 때 제목은 일부러 안 준다 — 제목을 주면 또 제목에 끌려간 요약이 나온다.
        // ============================================================
        function grammarHintSource(t) {
            return buildGrammarContextForMission(t).trim();
        }
        // 내용이 바뀌면 단서를 다시 만들어야 하니 짧은 지문을 남긴다
        function grammarHintHash(src) {
            let h = 0;
            for (let i = 0; i < src.length; i++) h = (h * 31 + src.charCodeAt(i)) | 0;
            return h.toString(36) + '.' + src.length;
        }
        // 지금 쓸 수 있는 단서 (내용이 바뀌었으면 null). 내가 손댄 줄(m)은 내용이 바뀌어도 그대로 쓴다
        function grammarAiHintOf(t) {
            if (typeof grammarAiHints === 'undefined' || !t) return null;
            const e = grammarAiHints[t.id];
            if (!e || !String(e.r || '').trim()) return null;
            if (e.m) return e;
            return (e.h === grammarHintHash(grammarHintSource(t))) ? e : null;
        }
        function grammarAiHintText(e) {
            if (!e) return '';
            const tr = (e.t || []).filter(Boolean).join(', ').slice(0, 200);
            return String(e.r || '').trim() + (tr ? ' | 신호: ' + tr : '');
        }
        // 단서가 없거나 낡은 노트들 (내용이 빈 노트는 애초에 채점 목록에 안 들어간다)
        function staleGrammarHintNotes() {
            const all = (typeof aiScoringNoteList === 'function') ? aiScoringNoteList() : [];
            return all.filter(t => grammarHintSource(t) && !grammarAiHintOf(t));
        }

        const GRAMMAR_HINT_SYSTEM = 'You are a Spanish grammar analyst. Return ONLY JSON, no markdown fences.';

        async function makeGrammarAiHint(t) {
            const src = grammarHintSource(t);
            if (!src) return null;
            const prompt = `Below is ONE grammar note kept by a Korean learner of Spanish — its explanation and tables.
            The note's TITLE is deliberately withheld: describe only what the content below actually shows.

            NOTE CONTENT:
            ${src.slice(0, 3000)}

            Return two things.
            "rule": ONE line of Korean stating the rule this note teaches AS A TESTABLE CONDITION - written so that
            someone holding a Spanish sentence can answer yes or no. Name the actual forms, and write it as a sentence
            with a verb: "전치사 a/de 가 관사 el 을 만나면 al/del 로 줄어든다", "비교는 más/menos ... que 로 잇는다".
            60자 이내. Do NOT hand back a topic label - a noun phrase ending in 용법·사용법·표현·만들기 ("시간 전치사의
            용법", "비교급 문장 만들기") is exactly what the title already says, and it is what makes the judgement go wrong.
            "triggers": 3-12 concrete Spanish signals whose presence in a sentence means this note is in play —
            actual words (al, del, encima de), endings (-ando, -ído), or short patterns with ... for gaps
            (más ... que). Spanish only, no Korean, no explanation. If the note is a closed list (months,
            weekdays, possessives), give the list words themselves.`;
            const schema = {
                type: "OBJECT",
                properties: {
                    rule: { type: "STRING", description: "이 노트가 가르치는 규칙 한 줄 (한국어, 60자 이내)" },
                    triggers: { type: "ARRAY", items: { type: "STRING" }, description: "이 노트가 걸려야 할 스페인어 신호" }
                },
                required: ["rule", "triggers"]
            };
            // 가끔 규칙 없이 빈 응답이 온다 — 30개를 한 번에 만드니 한 번은 더 물어본다
            let rule = '', triggersRaw = [];
            for (let tries = 0; tries < 2 && !rule; tries++) {
                const data = extractAndParseJson(await callGemini(prompt, GRAMMAR_HINT_SYSTEM, schema, 'low'));
                rule = String((data && data.rule) || '').replace(/\s+/g, ' ').trim().slice(0, 120);
                triggersRaw = Array.isArray(data && data.triggers) ? data.triggers : [];
            }
            if (!rule) return null;
            const triggers = triggersRaw.map(x => String(x || '').trim()).filter(Boolean).slice(0, 12);
            return { h: grammarHintHash(src), r: rule, t: triggers };
        }

        let grammarHintBusy = false;
        // 낡은 노트만 골라 하나씩 만든다. force 면 내가 손댄 것 빼고 전부 다시.
        async function refreshGrammarAiHints(force) {
            if (grammarHintBusy) { showToast("단서를 만드는 중이에요", "info"); return; }
            const all = (typeof aiScoringNoteList === 'function') ? aiScoringNoteList() : [];
            const targets = force
                ? all.filter(t => grammarHintSource(t) && !((grammarAiHints[t.id] || {}).m))
                : staleGrammarHintNotes();
            if (!targets.length) { showToast("모든 노트에 단서가 있어요", "info"); return; }
            grammarHintBusy = true;
            renderGrammarHintBar();
            let done = 0, failed = 0;
            showToast(`AI 채점 단서를 만들어요 · ${targets.length}개`, "info");
            const nap = (ms) => new Promise(r => setTimeout(r, ms));
            for (const t of targets) {
                let hint = null;
                // [냐냐 지적] 30개를 쉬지 않고 물으면 분당 한도(429)에 걸려 뒤쪽 열몇 개가 통째로 실패했다.
                //   한도에 걸리면 기다렸다 그 노트만 다시 묻는다 — 한도가 넉넉한 키면 그냥 빨리 끝난다.
                for (let tries = 0; tries < 3 && !hint; tries++) {
                    try {
                        hint = await makeGrammarAiHint(t);
                        if (!hint) break;                 // 답은 왔는데 규칙이 없으면 그만 (안에서 이미 한 번 더 물었다)
                    } catch (e) {
                        const rate = e && (e.status === 429 || e.apiStatus === 'RESOURCE_EXHAUSTED');
                        if (!rate || tries === 2) break;
                        renderGrammarHintBar(done + failed, targets.length, true);
                        await nap(20000);
                    }
                }
                if (hint) { grammarAiHints[t.id] = hint; done++; } else failed++;
                renderGrammarHintBar(done + failed, targets.length);
                await nap(600);
            }
            grammarHintBusy = false;
            if (done && typeof saveToStorage === 'function') saveToStorage();
            if (typeof renderGrammarTables === 'function') renderGrammarTables();
            renderGrammarHintBar();
            showToast(failed ? `단서 ${done}개 완성 · ${failed}개 실패` : `단서 ${done}개를 만들었어요`, failed ? "error" : "success");
        }

        // 노트 하나만 다시 만들기 (카드 안의 새로고침 버튼)
        async function regenGrammarAiHint(id) {
            if (grammarHintBusy) return;
            const t = ((typeof aiScoringNoteList === 'function') ? aiScoringNoteList() : []).find(x => x.id === id);
            if (!t) return;
            if (!grammarHintSource(t)) { showToast("노트가 비어 있어서 단서를 못 만들어요", "error"); return; }
            grammarHintBusy = true;
            showToast("단서를 다시 만드는 중...", "info");
            try {
                const hint = await makeGrammarAiHint(t);
                if (hint) {
                    grammarAiHints[id] = hint;
                    if (typeof saveToStorage === 'function') saveToStorage();
                    showToast("단서를 새로 만들었어요", "success");
                } else showToast("단서를 못 만들었어요", "error");
            } catch (e) { showToast("단서를 못 만들었어요", "error"); }
            grammarHintBusy = false;
            refreshGrammarHintViews(id);
            renderGrammarHintBar();
        }

        // 단서 줄은 들춰보기 팝업 안에 있다 — 고치고 나면 그 팝업을 다시 그려야 바뀐 게 보인다
        function refreshGrammarHintViews(id) {
            if (typeof renderGrammarTables === 'function') renderGrammarTables();
            if (typeof _grammarPeekId !== 'undefined' && _grammarPeekId
                && (!id || _grammarPeekId === id) && typeof openGrammarPeek === 'function') {
                openGrammarPeek(_grammarPeekId);
            }
        }

        // [냐냐 요청] 단서를 직접 고치기 — AI 요약이 어긋나도 노트 제목·구조는 안 건드리고 한 줄만 손본다
        let grammarHintEditId = null;
        function editGrammarAiHint(id) {
            grammarHintEditId = (grammarHintEditId === id) ? null : id;
            refreshGrammarHintViews(id);
        }
        function saveGrammarAiHint(id) {
            const rule = (document.getElementById('ghint-rule-' + id) || {}).value || '';
            const trig = (document.getElementById('ghint-trig-' + id) || {}).value || '';
            const r = rule.replace(/\s+/g, ' ').trim().slice(0, 120);
            if (!r) { showToast("규칙 한 줄은 비울 수 없어요", "error"); return; }
            const t = ((typeof aiScoringNoteList === 'function') ? aiScoringNoteList() : []).find(x => x.id === id);
            grammarAiHints[id] = {
                h: t ? grammarHintHash(grammarHintSource(t)) : '',
                r: r,
                t: trig.split(',').map(x => x.trim()).filter(Boolean).slice(0, 12),
                m: 1                                   // 내가 손댄 줄 — 노트를 고쳐도, 전체 다시 만들기에도 안 지운다
            };
            grammarHintEditId = null;
            if (typeof saveToStorage === 'function') saveToStorage();
            refreshGrammarHintViews(id);
            showToast("채점 단서를 고쳤어요", "success");
        }

        // 문법 탭 위의 한 줄 — 단서가 없는 노트가 있을 때만 보인다
        function renderGrammarHintBar(doneN, totalN, waiting) {
            const box = document.getElementById('grammar-hint-bar');
            if (!box) return;
            if (grammarHintBusy) {
                const prog = totalN ? ` · ${doneN}/${totalN}` : '';
                const msg = waiting ? '요청이 몰려서 20초 쉬었다 이어가요' : 'AI 채점 단서를 만드는 중이에요';
                box.className = 'flex items-center gap-2 text-[11px] font-bold text-violet-600 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2';
                box.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> ${msg}${prog}`;
                return;
            }
            const n = staleGrammarHintNotes().length;
            if (!n) { box.className = 'hidden'; box.innerHTML = ''; return; }
            box.className = 'flex items-center gap-2 text-[11px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2';
            box.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles text-violet-500"></i>
                <span class="flex-1">AI 채점 단서가 없는 노트 ${n}개 — 첨삭이 이 노트를 제목만 보고 짐작해요</span>
                <button type="button" onclick="refreshGrammarAiHints(false)" class="px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold transition-all active:scale-95">만들기</button>`;
        }

        // [냐냐 요청] 예전엔 제목만 보냈다. AI 가 표 안에 뭐가 있는지 모른 채 제목만 보고 짐작해서,
        //   문장에 없는 문법에도 점수가 붙는 일이 있었다. 표 전체는 하나에 3천 자라 못 보내니
        //   설명 앞부분과 표 안의 스페인어 낱말 몇 개만 단서로 붙인다 (한 표당 150자 안팎).
        //   [냐냐 요청] 이제 AI 가 미리 만들어 둔 '규칙 한 줄'이 있으면 그걸 쓴다.
        //   단서가 없는 노트만 아래 거친 방식(설명 앞부분 + 표 낱말)으로 떨어진다.
        function aiScoringNoteHint(t) {
            const ai = (typeof grammarAiHintOf === 'function') ? grammarAiHintOf(t) : null;
            if (ai) return grammarAiHintText(ai);
            return aiScoringNoteHintRaw(t);
        }
        function aiScoringNoteHintRaw(t) {
            const strip = (h) => String(h || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
            // 설명이 없으면 첫 글 블록의 본문을 대신 쓴다 (표만 있고 desc 가 빈 노트가 있다)
            let desc = strip(t.desc);
            if (!desc) {
                const textBlock = (t.blocks || []).find(b => b && b.html);
                if (textBlock) desc = strip(textBlock.html);
            }
            //   [냐냐 요청] 80 → 150자. 단서가 모자라면 '근거를 못 짚겠으면 빼라'는 지시 때문에
            //   실제로 쓴 문법도 놓친다. 정보를 늘리면 헛점수와 놓침이 같이 줄어든다.
            desc = desc.slice(0, 150);

            const words = [];
            const push = (c) => {
                const s = strip(c);
                // 스페인어처럼 보이는 칸만 고른다. 낱말뿐 아니라 짧은 문구도 단서가 되므로
                //   쉼표·물음표·¿¡ 까지 허용하되, 한글이 섞인 칸은 뜻풀이라 제외한다.
                if (!s || s.length > 40 || /[ㄱ-ㅎ가-힣]/.test(s)) return;
                if (!/^[¿¡A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(s)) return;
                if (!/^[¿¡?!.,'’\- A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+$/.test(s)) return;
                if (!words.includes(s)) words.push(s);
            };
            (t.blocks || []).forEach(b => (b.rows || []).forEach(r => (r || []).forEach(push)));
            (t.rows || []).forEach(r => (r || []).forEach(push));
            const ex = words.slice(0, 12).join(', ').slice(0, 240);
            return [desc, ex && `e.g. ${ex}`].filter(Boolean).join(' | ');
        }
        function aiScoringNoteListText(notes) {
            if (!notes || !notes.length) return '';
            const lines = notes.map(t => {
                const hint = aiScoringNoteHint(t);
                return `- ${t.title || ''}${hint ? ` :: ${hint}` : ''}`;
            });
            return `\n            My grammar notes. Each line is "TITLE :: the rule this note actually teaches | 신호: the Spanish signals that mean this note is in play".\n            The TITLE is only a label the student typed - it is often broader than the note. JUDGE ONLY BY THE RULE after "::",\n            never by the title: a note titled "위치를 나타내는 표현" whose rule is about al/del is NOT used by a sentence with no contraction.\n            ${lines.join('\n            ')}\n`;
        }
        // [냐냐 요청] 실수 유형. 예전엔 자유 작문·질문답하기에만 있어서, 한→스 미션과
        //   예문 연습으로 틀린 것은 첨삭 노트에서 유형 없이 떠돌았다. 네 곳이 같은 표를 쓴다.
        const AI_ISSUE_TYPES = ["어순", "성수일치", "동사변형", "시제", "전치사", "어휘선택", "기타", "없음"];
        const AI_ISSUE_JSON_FIELD = `,
               "issueType": "If isCorrect is false, classify the main mistake as exactly one of: '어순', '성수일치', '동사변형', '시제', '전치사', '어휘선택', '기타'. If isCorrect is true, use '없음'."`;
        function aiIssueSchemaProp() {
            return { issueType: { type: "STRING", enum: AI_ISSUE_TYPES, description: "주된 실수 유형. 정답이면 '없음'" } };
        }

        // 응답 JSON 예시에 끼워 넣을 항목.
        //   [냐냐 요청] 예전엔 [{word, spelling}] 꼴이라 단어 하나에 39자를 썼다. 응답이 길어지면
        //   maxOutputTokens 에 걸려 잘리므로, 맞음/틀림을 배열로 갈라 이름만 담는다 (10자).
        const AI_SCORING_JSON_FIELDS = `
               "grammarOk": ["for each note this sentence uses CORRECTLY: \"EXACT note title >> the exact Spanish fragment that proves it\""],
               "grammarBad": ["for each note this sentence uses INCORRECTLY: \"EXACT note title >> the exact Spanish fragment that proves it\""],
               "wordsOk": ["each content word the student spelled CORRECTLY, written as \\"dictionary form|part of speech\\""],
               "wordsForm": ["each content word spelled correctly but put in the WRONG FORM, written as \\"dictionary form|part of speech\\""],
               "wordsBad": ["each content word the student MISSPELLED, written as \\"dictionary form|part of speech\\""]`;
        //   [냐냐 지적] 팁에는 terceira, 고친 문장에는 tercera 처럼 같은 낱말을 다르게 적어 보낸 적이 있다.
        //   어느 쪽이 맞는지 알 수 없으니 배우는 사람만 헷갈린다. 네 모드 프롬프트가 같이 쓴다.
        const AI_SPELLING_CONSISTENCY_RULE = `
            SPELLING CONSISTENCY: every Spanish word you write in "tip", "message" or "changes" must be spelled EXACTLY as it appears in "correctedText" — same letters, same accents. Before output, re-read your own text and fix any word that differs. Writing "tercera" in one place and "terceira" in another teaches the student the wrong word.

            DO NOT SAY THE SAME THING THREE TIMES. "message", "naturalWhy" and "tip" are three different slots and each must carry something the other two do not:
            - "message": the verdict on THIS answer — what the student got right, and what the main error was. One or two sentences.
            - "naturalWhy": only the reason a native would phrase it differently. If "moreNatural" is empty, this is empty too.
            - "tip": the RULE behind it — why Spanish works that way, so the student can apply it next time. Not a repeat of the verdict, not a repeat of the natural phrasing.
            Concretely, this is the failure to avoid: message says "반복되는 단어를 대명사로 바꾸면 더 자연스러워집니다", naturalWhy says "지시대명사를 활용해 자연스럽게 표현했어요", and tip says "'esa ropa' 대신 'esta'처럼 지시대명사를 사용해보세요" — three sentences, one idea, and the student's eye slides off all of them. When "moreNatural" is filled, ONLY "naturalWhy" may discuss that rephrasing; "message" and "tip" must then talk about something else — the grammar the student actually used, or the rule behind the correction you made.`;
        const AI_SCORING_RULES_TEXT = `
            IMPORTANT for "wordsOk"/"wordsForm"/"wordsBad": all three are REQUIRED — always output them, using [] when empty. Output plain strings only, never objects. Walk through the student's ORIGINAL sentence and place each content word they actually wrote (nouns, verbs, adjectives, adverbs), in its dictionary form, into exactly one of the three lists. Dictionary form = verbs as infinitive (es → ser, tengo → tener), nouns as singular with article (libros → el libro), adjectives as masculine singular (bonita → bonito). Skip articles, bare one-word prepositions and pronouns. DO include multi-word set phrases and connectors as a single entry (e.g. "antes de", "después de", "al lado de", "a la derecha de", "tener ganas de") — these are vocabulary items too, so never split or drop them. Accents count — año and ano are different words. Which list a word goes in: "wordsBad" ONLY when the student misspelled it — the letters they typed are not a real Spanish word (put the dictionary form of the word they were CLEARLY trying to write). A correctly spelled real word can NEVER go in "wordsBad", however wrong it was for this sentence; if you replaced it, it belongs in "wordsForm"; "wordsForm" when the word is spelled correctly but you did NOT leave it as it was — a wrong conjugation (es → son), a wrong gender or number ending (caros → caro, aquel → aquellos), or a word you had to swap for a different one (es → está, Cuál → Qué, el pie → mis pies). The student knew the word but did not place it right here, so it earns nothing either way; "wordsOk" only for words that survive into correctedText exactly as the student wrote them. Never list a word the student did not write. BEFORE OUTPUT, walk the three lists once more and delete any entry whose word does not literally appear in the student's ORIGINAL sentence — words YOU added in "correctedText" are yours, not theirs, and must never earn or lose the student points. ALWAYS append "|" and the part of speech the word has IN THIS SENTENCE — exactly one of noun, verb, adjective, adverb, preposition, pronoun, conjunction, interrogative, phrase. The same spelling can be different parts of speech ("vivo solo|adverb" but "un café solo|adjective"; "el joven|noun" but "un chico joven|adjective"), so decide from how it is actually used here, never from the word alone. Never omit the "|part of speech".
            IMPORTANT for "grammarOk"/"grammarBad": both are REQUIRED — always output them, using [] when empty. Output the note titles exactly as given in the list above, and never invent a title. Be STRICT: before listing a note, point to the exact word or structure in the student's sentence that matches the note's hint. If you cannot point to one, leave the note out. List EVERY note you can point to concretely — one sentence often exercises three or four of them at once (e.g. "tu tercera gorra se mancha" uses the ordinal note, the possessive-adjective note AND the reflexive-verb note). Leaving out a note the student really used costs them the points and the review they earned, so do not hold back when you can point to the word. What you must NOT do is list a note merely because its topic feels related, because the sentence is in the present tense, or because it contains some noun — the note's own rule must be visibly used. Concretely: a note titled "위치를 나타내는 표현" whose hint is about "del / al" and "encima de, cerca de, al lado de" is NOT used by a sentence that just says "sobre el pie" — no contraction, none of its phrases — so that note belongs in NEITHER list, not in "grammarOk" and not in "grammarBad". Read the hint, not the title: the title is a topic, the hint is the rule. A note whose hint lists specific words (e.g. months, weekdays, possessives) counts only if one of those actual words appears in the sentence.
            DECIDING which of the two lists a note goes in: ask whether THE NOTE'S OWN RULE was applied wrongly.
            - "grammarBad" only when the note's own rule is what you had to fix. Example: the student wrote "a frente mi casa" and you corrected it to "frente a mi casa" — a note about location expressions goes in "grammarBad", because the fixed phrase IS that note's rule. Another: the student wrote "el libro que es sobre el pie" and you corrected it to "el libro que está arriba de mis pies" — you rewrote the location phrase itself, so a location note is "grammarBad", never "grammarOk". Ask yourself: did I have to touch the very structure this note teaches? If yes it is "grammarBad", no matter how much of the rest of the sentence was fine. Decide in this order, never the other way round: (1) does the sentence actually exercise this note's rule, judged from its hint? If no, the note goes in NEITHER list and you are done with it. (2) For a note that passed (1), ask whether the part of the sentence that note covers came through your correction UNTOUCHED. Untouched → "grammarOk". Touched for ANY reason → "grammarBad". "The part that note covers" means the words its own rule is about, not the whole sentence. Two versions of one example, for a note about location phrases (del/al, encima de, arriba de):
            - student wrote "el libro que es sobre el pie" and you returned "el libro que está sobre el pie" — you only swapped the verb, which is a ser/estar rule, NOT this note's rule; the location phrase "sobre el pie" survived exactly as written, so this note is "grammarOk".
            - student wrote "el libro que es sobre el pie" and you returned "el libro que está arriba de mis pies" — now you rewrote the location phrase itself, so this note is "grammarBad".
            The same test decides "wordsOk" vs "wordsForm" for each word: survived as written, or not.
            - "grammarOk" when the student applied the note's rule correctly, even if you changed other words nearby for a DIFFERENT reason. Example: the student wrote "¿Cuál pantalones es más caros que aquel?" and you fixed the interrogative (Cuál→Qué), the verb agreement (es→son) and the demonstrative (aquel→esos) — a note about COMPARATIVES stays in "grammarOk", because "más ... que" itself was used correctly. Do not punish a note just because a word standing next to it changed.
            A note must never appear in both lists. If you are unsure whether the note's own rule was broken, leave the note out of both lists rather than guessing "grammarBad".
            EVIDENCE IS MANDATORY. Every entry of "grammarOk"/"grammarBad" is written as "TITLE >> FRAGMENT", where FRAGMENT is 1-5 Spanish words COPIED VERBATIM from the student's sentence or from your corrected sentence - the very words this note's rule is about. Copy them letter for letter; do not paraphrase, do not translate, do not name the rule again. Use "..." for a gap when the rule spans words (e.g. "mas ... que"). A fragment that does not appear in either sentence is thrown away by the app together with its note, so the student loses the point - and a fragment you cannot find is proof the note was not really used, which is exactly when you must leave the note out.${AI_SPELLING_CONSISTENCY_RULE}`;
        // 스키마 조각. ⚠️ 쓰는 쪽에서 required 에도 usedGrammar·usedWords 를 꼭 넣어야 한다 —
        //   빼두면 모델이 항목을 통째로 생략해서 점수가 조용히 안 붙는다 (실제로 그랬다).
        const AI_SCORING_REQUIRED = ["grammarOk", "grammarBad", "wordsOk", "wordsForm", "wordsBad"];
        function aiScoringSchemaProps() {
            return {
                grammarOk: { type: "ARRAY", items: { type: "STRING" }, description: "제대로 쓴 문법 노트 — '제목 >> 문장에서 베낀 근거 조각'" },
                grammarBad: { type: "ARRAY", items: { type: "STRING" }, description: "틀리게 쓴 문법 노트 — '제목 >> 문장에서 베낀 근거 조각'" },
                wordsOk: { type: "ARRAY", items: { type: "STRING" }, description: "스펠링도 형태도 맞은 낱말의 사전형들" },
                wordsForm: { type: "ARRAY", items: { type: "STRING" }, description: "스펠링은 맞지만 활용·성수 형태를 틀린 낱말의 사전형들 (점수 없음)" },
                wordsBad: { type: "ARRAY", items: { type: "STRING" }, description: "스펠링이 틀린 낱말의 사전형들" }
            };
        }
        // [냐냐 요청] 문법은 맞는데 원어민은 다르게 말하는 경우를 짚어준다.
        //   "el pie de mi novio" 는 틀린 문장이 아니지만, 스페인어는 짝으로 있는 몸은 복수로 말해서
        //   "los pies de mi novio" 가 자연스럽다. 예전엔 이런 게 그냥 '정답'으로 지나갔다.
        //   ⚠️ 이건 오답이 아니다 — isCorrect·verdict·issueType·점수를 절대 건드리지 않는다.
        //      맞게 쓴 문장에 벌을 주면 안 된다. 더 나은 표현을 '덧붙여' 알려주는 자리다.
        const AI_NATURAL_JSON_FIELDS = `,
               "moreNatural": "If the sentence is grammatically acceptable but a native speaker would normally phrase it differently, write the more natural Spanish version here. Empty string when there is nothing to say.",
               "naturalWhy": "One short Korean sentence (60자 이내) on why a native prefers that phrasing. Empty string when moreNatural is empty."`;
        const AI_NATURAL_RULES_TEXT = `
            IMPORTANT for "moreNatural"/"naturalWhy": both are REQUIRED — always output them, using "" when there is nothing to say. They describe how a NATIVE would say it, not what is wrong, so they must NEVER affect isCorrect, verdict, issueType or any score, and must never restate a mistake you already fixed in correctedText. Fill them in only when a native speaker would clearly phrase it differently — common cases: Spanish uses the plural for paired body parts (los pies, las manos), a definite article instead of a possessive for one's own body (me duele la cabeza, not mi cabeza), a fixed collocation (tener hambre, hacer una pregunta, dar un paseo), or a more idiomatic word order or register. Before you settle on "", run this checklist over the student's sentence and stop at the first hit: (1) a paired body part in the singular (el pie, la mano, el ojo, la pierna) where Spanish would normally say both in the plural; (2) a possessive on a body part (mi cabeza, mis manos) where Spanish uses the definite article; (3) a verb+noun pair that has a fixed collocation (tener hambre, hacer una pregunta, dar un paseo, tomar una decision); (4) word order or register a native would not use. If one of them applies AND you did not already fix it in correctedText, fill both fields with it. Only when none of them applies does the sentence count as natural — then output "" for both.`;
        const AI_NATURAL_REQUIRED = ["moreNatural", "naturalWhy"];
        function aiNaturalSchemaProps() {
            return {
                moreNatural: { type: "STRING", description: "원어민이라면 이렇게 말한다는 스페인어 문장 (없으면 빈 문자열)" },
                naturalWhy: { type: "STRING", description: "그 표현이 더 자연스러운 이유 한 문장 (없으면 빈 문자열)" }
            };
        }
        // 결과 카드의 '이렇게 말하면 더 자연스러워요' 박스. 알려줄 게 없으면 통째로 숨긴다.
        function renderAiNatural(feedback) {
            const box = document.getElementById('ai-natural-box');
            if (!box) return;
            const textEl = document.getElementById('ai-natural-text');
            const whyEl = document.getElementById('ai-natural-why');
            const sentence = String((feedback && feedback.moreNatural) || '').trim();
            const why = String((feedback && feedback.naturalWhy) || '').trim();
            // 고친 문장을 그대로 옮겨 적어 오는 경우가 있다 — 그건 새로 알려주는 게 없으니 숨긴다
            const corrected = String((feedback && feedback.correctedText) || '').replace(/<[^>]*>/g, '').trim();
            const sameAsCorrected = sentence && corrected
                && typeof normalizeSpanishAnswer === 'function'
                && normalizeSpanishAnswer(sentence) === normalizeSpanishAnswer(corrected);
            if (!sentence || sameAsCorrected) {
                box.classList.add('hidden');
                if (textEl) textEl.innerHTML = '';
                if (whyEl) whyEl.innerHTML = '';
                return;
            }
            box.classList.remove('hidden');
            if (textEl) textEl.innerHTML = escapeHtml(sentence);
            if (whyEl) whyEl.innerHTML = why ? escapeHtml(why) : '';
        }

        // [냐냐 요청] 첨삭 노트에 한 줄 남긴다. 스페인어를 직접 쓰는 네 곳이 모두 여기를 지난다.
        //   숫자만 세던 '내 학습 수준' 과 달리, 실제로 내가 쓴 문장과 교정본을 통째로 남긴다.
        //   화면에 그릴 때 core.js 의 charDiffOps 로 두 문장을 대조하므로, 여기서는 표시용
        //   태그를 다 벗겨 맨 글자만 저장한다 (용량도 줄고, 나중에 검색하기도 쉽다).
        //   gramHits 를 안 주면 방금 채점이 남긴 aiLastEsKoGrammar 를 그대로 쓴다. AI 가 지어낸
        //   제목은 채점 단계에서 이미 걸러진 뒤라, 여기 오는 건 전부 실제로 있는 노트다.
        let _lastAiNoteKey = null;   // 방금 남긴 노트 (점수를 해제하면 이 노트에서 빼야 한다)

        function recordAiNote(mode, ask, mine, feedback, gramHits) {
            if (typeof aiNotes === 'undefined' || !feedback) return;
            const plain = (v) => String(v == null ? '' : v).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
            const mineText = plain(mine);
            if (!mineText) return;   // 빈 제출은 남길 게 없다
            const issue = plain(feedback.issueType);
            const stamp = new Date().toISOString();
            _lastAiNoteKey = stamp;
            aiNotes.unshift({
                t: stamp,
                mode: mode,                                   // 'question' | 'ko-es' | 'example' | 'es-ko'
                ask: plain(ask),                              // 질문·미션 (자유 작문은 빈 값)
                mine: mineText,                               // 내가 쓴 문장
                fixed: plain(feedback.correctedText),         // 교정본
                msg: plain(feedback.message),                 // 총평
                tip: plain(feedback.tip),
                natural: plain(feedback.moreNatural),         // 더 자연스러운 표현 (있을 때만)
                issue: (issue && issue !== '없음') ? issue : '',
                gram: aiNoteGramHits(gramHits),               // [{ id, n(제목), ok }]
                ok: !!feedback.isCorrect
            });
            if (aiNotes.length > AI_NOTE_LIMIT) aiNotes.length = AI_NOTE_LIMIT;
        }

        // ============================================================
        // [냐냐 요청] 첨삭 노트 — '내 학습 수준'의 숫자 뒤에 있는 실제 문장들
        //   학습기록의 '내 학습 수준' 이 "어순 3회" 라고만 알려주던 걸, 그 세 문장을 펼쳐 본다.
        //   내가 쓴 문장과 교정본은 맨 글자로만 저장해 두고, 어디가 달라졌는지는
        //   볼 때마다 낱말 단위로 맞대본다 (저장은 가볍게, 표시는 자세히).
        // ============================================================
        let aiNoteFilter = 'wrong';   // 'all' | 'wrong' | 실수 유형 이름
        let aiNoteOpen = {};          // 펼쳐 둔 항목 (기록 시각 t 를 키로)
        const AI_NOTE_PAGE = 20;      // 한 번에 보여줄 개수
        let aiNoteShown = AI_NOTE_PAGE;

        const AI_NOTE_MODES = {
            'ko-es':    { label: '한→스 미션', cls: 'bg-violet-100 text-violet-600' },
            'es-ko':    { label: '자유 작문',   cls: 'bg-sky-100 text-sky-600' },
            'question': { label: '질문 답하기', cls: 'bg-emerald-100 text-emerald-600' },
            'example':  { label: '예문 연습',   cls: 'bg-amber-100 text-amber-600' }
        };

        // [냐냐 요청] 실수 유형은 AI가 준 글자라 따옴표가 섞일 수 있다. onclick 에 글자를 그대로
        //   적으면 (escape 를 해도) 브라우저가 &#39; 를 ' 로 되돌린 뒤에 JS 를 읽어서 호출이 깨진다.
        //   그래서 어디서든 '몇 번째'만 넘기고 값은 여기 배열에서 찾는다 — 단어 빠른찾기와 같은 방식.
        let _aiNoteFilterVals = [];   // 노트 필터 줄의 칩 값
        let _aiNoteGramVals = [];     // 약한 문법 칩 값

        function setAiNoteFilterAt(i) {
            const v = _aiNoteFilterVals[i];
            if (v !== undefined) setAiNoteFilter(v);
        }
        // [냐냐 요청] 문장은 '낱말' 단위로 맞대본다.
        //   퀴즈 오답이 쓰는 charDiffOps 는 낱말 하나를 볼 때 만든 것이라, 문장에 그대로 쓰면
        //   어순이 바뀐 자리에서 글자가 조각조각 붉어져 오히려 안 읽힌다.
        //   같은 최장공통부분수열이되 낱말을 한 덩어리로 놓고 센다.
        function aiNoteWordDiff(aRaw, bRaw) {
            const cut = (t) => String(t || '').trim().split(/\s+/).filter(Boolean);
            const a = cut(aRaw), b = cut(bRaw);
            // 대소문자·문장부호는 같은 낱말로 친다 ("Voy" 와 "voy," 가 서로 다르게 잡히면 안 된다)
            const key = (w) => w.toLowerCase().replace(/[.,;:!?¡¿"']/g, '');
            const ka = a.map(key), kb = b.map(key);
            const n = a.length, m = b.length;
            if (!n || !m || n * m > 40000) return [['del', aRaw], ['ins', bRaw]];
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

        // side 'user' = 내가 쓴 문장(빠진 낱말 빨강) / 'correct' = 교정본(새로 들어온 낱말 빨강)
        function renderAiNoteDiff(ops, side) {
            const mark = (side === 'user') ? 'del' : 'ins';
            return ops.filter(([t]) => t === 'same' || t === mark)
                .map(([t, w]) => t === 'same'
                    ? escapeHtml(w)
                    : `<span class="bg-rose-200 text-rose-700 rounded px-[3px]">${escapeHtml(w)}</span>`)
                .join(' ');
        }

        // 필터는 접두사로 갈래를 구분한다: 'all' | 'wrong' | 'issue:어순' | 'gram:<노트id>'
        function aiNoteMatches(n) {
            if (aiNoteFilter === 'all') return true;
            if (aiNoteFilter === 'wrong') return !n.ok;
            if (aiNoteFilter.startsWith('issue:')) return n.issue === aiNoteFilter.slice(6);
            if (aiNoteFilter.startsWith('gram:')) {
                const id = aiNoteFilter.slice(5);
                return (n.gram || []).some(g => g.id === id && !g.ok);
            }
            return false;
        }

        // [냐냐 요청] 약한 문법 — 첨삭에서 쓴 문법 노트를 정답률 낮은 순으로.
        //   '어순/시제' 같은 뭉뚱그린 유형이 아니라 '소유형용사', '정관사' 처럼
        //   내 문법 노트 이름 그대로 나온다. AI 가 첨삭할 때마다 짚어준 걸 세는 것뿐이다.
        function aiNoteGrammarStats() {
            const by = new Map();
            (aiNotes || []).forEach(n => (n.gram || []).forEach(g => {
                if (!g || !g.id) return;
                if (!by.has(g.id)) by.set(g.id, { id: g.id, name: g.n || '(이름 없는 노트)', total: 0, bad: 0 });
                const e = by.get(g.id);
                e.total++;
                if (!g.ok) e.bad++;
                if (g.n) e.name = g.n;          // 제목이 바뀌었으면 최근 것으로
            }));
            return [...by.values()]
                .map(e => Object.assign(e, { rate: Math.round(((e.total - e.bad) / e.total) * 100) }))
                .sort((a, b) => (a.rate - b.rate) || (b.bad - a.bad) || (b.total - a.total));
        }

        function setAiNoteFilter(v) {
            aiNoteFilter = v;
            aiNoteShown = AI_NOTE_PAGE;
            renderAiNoteList();
        }

        function toggleAiNote(key) {
            aiNoteOpen[key] = !aiNoteOpen[key];
            renderAiNoteList();
        }

        function showMoreAiNotes() {
            aiNoteShown += AI_NOTE_PAGE;
            renderAiNoteList();
        }

        // 날짜만 짧게 (오늘이면 시각까지)
        function aiNoteWhen(iso) {
            const d = new Date(iso);
            if (isNaN(d)) return '';
            const ds = getLocalDateString(d);
            if (ds === getLocalDateString()) {
                return `오늘 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            }
            return fmtDateShort(ds);
        }

        function renderAiNoteGrammarBox() {
            const box = document.getElementById('ai-note-grammar');
            if (!box) return;
            const stats = aiNoteGrammarStats();
            if (!stats.length) { box.innerHTML = ''; box.classList.add('hidden'); return; }
            box.classList.remove('hidden');

            _aiNoteGramVals = [];
            const chips = stats.slice(0, 10).map(e => {
                const idx = _aiNoteGramVals.push('gram:' + e.id) - 1;
                const on = aiNoteFilter === 'gram:' + e.id;
                // 정답률로 색을 나눈다 — 반도 못 맞히면 빨강, 8할 넘으면 초록
                const tone = e.rate < 50 ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                           : e.rate < 80 ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                           : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100';
                const sel = on ? 'ring-2 ring-slate-700 ring-offset-1' : '';
                const dis = e.bad === 0 ? ' title="틀린 적이 없어요"' : ' title="이 문법으로 틀린 문장만 보기"';
                return `<button onclick="setAiNoteGramAt(${idx})"${dis} class="px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${tone} ${sel}">
                    ${escapeHtml(e.name)}
                    <span class="font-normal opacity-70">${e.total - e.bad}/${e.total} · ${e.rate}%</span>
                </button>`;
            }).join('');

            box.innerHTML = `
                <div class="flex items-baseline gap-2 mb-2 flex-wrap">
                    <span class="text-xs font-bold text-slate-700">약한 문법</span>
                    <span class="text-[10px] text-slate-400">첨삭에서 쓴 내 문법 노트를 정답률 낮은 순으로. 눌러서 그때 문장을 봐요</span>
                </div>
                <div class="flex flex-wrap gap-1.5">${chips}</div>`;
        }

        function setAiNoteGramAt(i) {
            const v = _aiNoteGramVals[i];
            if (v === undefined) return;
            setAiNoteFilter(aiNoteFilter === v ? 'wrong' : v);   // 같은 걸 다시 누르면 해제
        }

        function renderAiNoteList() {
            const box = document.getElementById('ai-note-list');
            const filterBox = document.getElementById('ai-note-filters');
            if (!box) return;
            renderAiNoteGrammarBox();

            const notes = Array.isArray(aiNotes) ? aiNotes : [];
            const wrongCount = notes.filter(n => !n.ok).length;

            // 필터 줄 — 유형 버튼은 실제로 쌓인 유형만, 많이 틀린 순으로
            if (filterBox) {
                const byIssue = {};
                notes.forEach(n => { if (n.issue) byIssue[n.issue] = (byIssue[n.issue] || 0) + 1; });
                const issues = Object.entries(byIssue).sort((a, b) => b[1] - a[1]);
                _aiNoteFilterVals = [];
                const chip = (val, label, cnt, tone) => {
                    const on = aiNoteFilter === val;
                    const idx = _aiNoteFilterVals.push(val) - 1;
                    return `<button onclick="setAiNoteFilterAt(${idx})" class="px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${on ? tone.on : tone.off}">${label}${cnt != null ? ` <span class="font-normal opacity-70">${cnt}</span>` : ''}</button>`;
                };
                const slate = { on: 'bg-slate-700 text-white border-slate-700', off: 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50' };
                const rose  = { on: 'bg-rose-500 text-white border-rose-500',   off: 'bg-white text-rose-500 border-rose-200 hover:bg-rose-50' };
                const amber = { on: 'bg-amber-500 text-white border-amber-500', off: 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50' };
                filterBox.innerHTML =
                    chip('wrong', '틀린 것만', wrongCount, rose) +
                    chip('all', '전체', notes.length, slate) +
                    issues.map(([t, c]) => chip('issue:' + t, escapeHtml(t), c, amber)).join('');
            }

            if (notes.length === 0) {
                box.innerHTML = `<p class="text-slate-400 text-xs leading-relaxed py-2">아직 첨삭받은 문장이 없어요. AI 1:1 번역 첨삭에서 문장을 써서 제출하면 여기에 차곡차곡 쌓여요.</p>`;
                return;
            }

            const matched = notes.filter(aiNoteMatches);
            if (matched.length === 0) {
                box.innerHTML = `<p class="text-slate-400 text-xs py-2">이 조건에 맞는 문장이 없어요.</p>`;
                return;
            }

            // 문법으로 걸러 보는 중이면, 그 노트를 바로 열어볼 수 있게 한 줄 띄운다
            let jump = '';
            if (aiNoteFilter.startsWith('gram:')) {
                const gid = aiNoteFilter.slice(5);
                const st = aiNoteGrammarStats().find(e => e.id === gid);
                if (st) {
                    jump = `<button onclick="openGrammarPeek('${escapeAttr(gid)}')" class="w-full text-left px-3 py-2 mb-1 rounded-2xl bg-teal-50 border border-teal-100 text-[11px] font-bold text-teal-700 hover:bg-teal-100 transition-all">
                        <i class="fa-solid fa-book-open mr-1"></i>${escapeHtml(st.name)} 노트 들춰보기 <i class="fa-solid fa-up-right-from-square text-[9px] opacity-60"></i>
                    </button>`;
                }
            }

            const page = matched.slice(0, aiNoteShown);
            box.innerHTML = page.map(n => {
                const key = escapeAttr(n.t || '');
                const open = !!aiNoteOpen[n.t];
                const m = AI_NOTE_MODES[n.mode] || { label: '첨삭', cls: 'bg-slate-100 text-slate-500' };
                // 맞은 문장은 대조할 게 없다. 틀렸는데 교정본이 실제로 다를 때만 글자를 맞대본다.
                const changed = !n.ok && n.fixed && n.fixed !== n.mine;
                const ops = changed ? aiNoteWordDiff(n.mine, n.fixed) : null;

                const head = `
                    <div class="flex items-center gap-1.5 flex-wrap mb-1.5">
                        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${m.cls}">${m.label}</span>
                        ${n.issue ? `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-500 border border-rose-100">${escapeHtml(n.issue)}</span>` : ''}
                        ${n.ok ? '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100">정답</span>' : ''}
                        <span class="text-[10px] text-slate-400 ml-auto">${aiNoteWhen(n.t)}</span>
                    </div>`;

                const ask = n.ask ? `<p class="text-[11px] text-slate-400 mb-1">${escapeHtml(n.ask)}</p>` : '';
                const mineLine = `<p class="text-xs leading-relaxed ${n.ok ? 'text-slate-700' : 'text-slate-500'}">${ops ? renderAiNoteDiff(ops, 'user') : escapeHtml(n.mine)}</p>`;
                const fixedLine = changed
                    ? `<p class="text-xs leading-relaxed text-slate-800 font-semibold mt-1"><span class="text-slate-300 mr-1">→</span>${renderAiNoteDiff(ops, 'correct')}</p>`
                    : '';

                const detail = open ? `
                    <div class="mt-2 pt-2 border-t border-slate-100 space-y-1.5">
                        ${n.msg ? `<p class="text-[11px] text-slate-600 leading-relaxed">${escapeHtml(n.msg)}</p>` : ''}
                        ${n.tip ? `<p class="text-[11px] text-slate-500 leading-relaxed whitespace-pre-line bg-slate-50 rounded-xl p-2">${escapeHtml(n.tip)}</p>` : ''}
                        ${n.natural ? `<p class="text-[11px] text-sky-700 leading-relaxed bg-sky-50 rounded-xl p-2"><span class="font-bold">더 자연스럽게 </span>${escapeHtml(n.natural)}</p>` : ''}
                    </div>` : '';

                const hasDetail = !!(n.msg || n.tip || n.natural);

                return `
                    <div class="bg-white rounded-2xl border border-slate-200 p-3">
                        ${head}${ask}${mineLine}${fixedLine}${detail}
                        <div class="flex items-center gap-2 mt-1.5">
                            ${hasDetail ? `<button onclick="toggleAiNote('${key}')" class="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors">${open ? '접기' : '선생님 총평 보기'}</button>` : ''}
                            <button onclick="deleteAiNote('${key}')" title="AI 가 잘못 봤으면 이 기록을 빼세요" class="ml-auto text-[10px] text-slate-300 hover:text-rose-500 transition-colors"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                    </div>`;
            }).join('');
            box.innerHTML = jump + box.innerHTML;

            if (matched.length > page.length) {
                box.innerHTML += `<button onclick="showMoreAiNotes()" class="w-full py-2 text-[11px] font-bold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-2xl transition-all">${matched.length - page.length}개 더 보기</button>`;
            }
        }

        // [냐냐 요청] AI 가 잘못 짚어서 점수를 해제하면, 첨삭 노트에서도 그 문법을 빼준다.
        //   점수만 되돌리고 노트에 남겨두면 '약한 문법' 집계에는 계속 틀린 걸로 잡힌다.
        //   해제한 사람 입장에서는 없던 일이 되어야 맞다.
        function removeAiNoteGram(noteKey, gramId) {
            if (!noteKey || !gramId || typeof aiNotes === 'undefined') return false;
            const n = aiNotes.find(x => x && x.t === noteKey);      // 상한에 밀려 사라졌으면 그냥 넘어간다
            if (!n || !Array.isArray(n.gram)) return false;
            const before = n.gram.length;
            n.gram = n.gram.filter(g => g.id !== gramId);
            return n.gram.length !== before;
        }

        // 찾아보고 썼다고 표시하면, 첨삭 노트에서도 '맞음' 이 아니게 한다.
        //   찾아봐야 쓸 수 있었다면 약한 문법에 잡히는 게 맞다.
        function setAiNoteGramOk(noteKey, gramId, ok) {
            if (!noteKey || !gramId || typeof aiNotes === 'undefined') return;
            const n = aiNotes.find(x => x && x.t === noteKey);
            if (!n || !Array.isArray(n.gram)) return;
            const g = n.gram.find(x => x.id === gramId);
            if (g) g.ok = ok;
        }

        // 이 기록 자체를 없앤다 — AI 가 문장을 통째로 잘못 봤을 때
        function deleteAiNote(key) {
            if (typeof aiNotes === 'undefined') return;
            const i = aiNotes.findIndex(x => x && x.t === key);
            if (i < 0) return;
            aiNotes.splice(i, 1);
            if (typeof saveToStorage === 'function') saveToStorage();
            renderAiNoteList();
            showToast("첨삭 노트에서 뺐어요", "info");
        }

        // 이 문장이 건드린 문법 노트를 { id, n, ok } 로 간추린다.
        //   제목도 같이 남긴다 — 나중에 노트를 지워도 "그때 뭘 틀렸는지"는 남아야 한다.
        function aiNoteGramHits(gramHits) {
            const src = Array.isArray(gramHits) ? gramHits
                      : (typeof aiLastEsKoGrammar !== 'undefined' ? aiLastEsKoGrammar : []);
            const out = [];
            const seen = new Set();
            (src || []).forEach(e => {
                const note = e && (e.note || e);
                const id = note && note.id;
                const title = note && note.title;
                if (!id || seen.has(id)) return;
                seen.add(id);
                out.push({ id: id, n: String(title || ''), ok: (e.usage ? e.usage === 'correct' : !!e.ok) });
            });
            return out;
        }

        // 채점 결과를 반영하고 결과 카드에 표시한다 (해제 버튼 포함)
        //   [냐냐 요청] 네 모드가 같은 점수를 쓴다 — 제대로 쓰면 +2, 틀리면 −2.
        //   자유 작문만 절반이던 건 '찾아보고 쓸 수 있어서' 였는데, 이제 찾아본 건 내가
        //   결과 카드에서 표시하면 되므로(−2) 미리 깎아둘 이유가 없다.
        function applyAiWritingScores(feedback, notes) {
            applyEsKoGrammarScores(feedback, notes, GRAMMAR_TRANS_OK);
            applyEsKoWordScores(feedback, WORD_SPELL_OK);
            aiLastSuggest = buildAiSuggestions(feedback);   // [냐냐 요청] 추천은 점수 다음에 (쓴 관용구를 알아야 뺀다)
            renderEsKoGrammarRefs();
        }
        // 새 채점을 시작하기 전에 지난 결과 카드를 치운다
        function resetAiWritingScores() {
            renderAiNatural(null); // 지난 결과의 '더 자연스러운 표현'이 남아 있으면 안 된다
            aiLastEsKoGrammar = [];
            aiLastEsKoWords = [];
            aiLastIdiomHits = [];
            aiLastSuggest = { idioms: [], newWords: [] };
            const box = document.getElementById('ai-mission-refs');
            if (box) { box.classList.add('hidden'); box.innerHTML = ''; }
        }

        // [냐냐 요청] 점수 항목은 세 상태를 자유롭게 오간다.
        //     normal — AI 가 매긴 그대로
        //     looked — 찾아보고 썼다 (−2, 망각곡선도 틀렸을 때처럼 들어간다)
        //     undone — 해제. AI 가 잘못 짚었으니 없던 일로
        //   어느 상태에서 어느 상태로든 갈 수 있어야 해서, 무조건 '반영 전' 으로 되돌린 뒤
        //   새 상태를 처음부터 다시 매긴다. 그래야 점수가 겹쳐 쌓이지 않는다.
        function restoreGrammarPrev(e) {
            const id = e.note.id;
            if (typeof grammarScores !== 'undefined') {
                if (e.prev.score === undefined) delete grammarScores[id]; else grammarScores[id] = e.prev.score;
            }
            if (typeof grammarTransUsed !== 'undefined') {
                if (e.prev.transUsed === undefined) delete grammarTransUsed[id]; else grammarTransUsed[id] = e.prev.transUsed;
            }
            if (typeof masteredGrammar !== 'undefined') {
                if (e.prev.mastered === undefined) delete masteredGrammar[id]; else masteredGrammar[id] = e.prev.mastered;
            }
            if (typeof grammarReview !== 'undefined') {
                if (e.prev.review === undefined) delete grammarReview[id];
                else grammarReview[id] = JSON.parse(JSON.stringify(e.prev.review));
            }
        }

        function setGrammarEntryState(i, state) {
            const e = aiLastEsKoGrammar[i];
            if (!e || e.state === state) return;
            const id = e.note.id;
            restoreGrammarPrev(e);

            e.state = state;
            e.undone = (state === 'undone');
            e.lookedUp = (state === 'looked');

            if (state === 'normal') {
                e.delta = e.baseDelta;
                addGrammarScore(id, e.delta, { transUsed: e.usage === 'correct' });
                applyGrammarCurve(id, e.usage === 'correct', e.canMove);   // 처음 반영과 같은 자격으로
            } else if (state === 'looked') {
                e.delta = LOOKUP_PENALTY;
                // [냐냐 요청] 찾아봐도 번역에서 쓴 건 쓴 거라 마스터 자격은 그대로 둔다.
                //   어차피 점수가 −2 로 깎여서 마스터 기준(4.5)에 한참 못 미친다.
                addGrammarScore(id, e.delta, { transUsed: e.usage === 'correct' });
                applyGrammarCurve(id, false, e.canMove);   // 찾아보고 쓴 건 틀린 것과 같이 친다
            } else {
                e.delta = 0;
            }
            setAiNoteGramOk(_lastAiNoteKey, id, state === 'normal' && e.usage === 'correct');

            if (typeof saveToStorage === 'function') saveToStorage();
            renderEsKoGrammarRefs();
            if (typeof renderGrammarTables === 'function') renderGrammarTables();
            if (typeof renderAiNoteList === 'function') renderAiNoteList();
        }

        // [냐냐 요청] 버튼 하나로 세 상태를 돌린다 — 그대로 → 찾아봄 → 해제 → 그대로.
        //   (돋보기는 '자세히 보기' 로 넘겼다)
        const AI_ENTRY_CYCLE = ['normal', 'looked', 'undone'];
        function nextEntryState(cur) {
            const i = AI_ENTRY_CYCLE.indexOf(cur || 'normal');
            return AI_ENTRY_CYCLE[(i + 1) % AI_ENTRY_CYCLE.length];
        }
        function aiEntryStateLabel(state) {
            return state === 'looked' ? '찾아보고 썼어요' : state === 'undone' ? '해제됨' : '점수 그대로';
        }

        function cycleGrammarEntry(i) {
            const e = aiLastEsKoGrammar[i];
            if (!e) return;
            const to = nextEntryState(e.state);
            setGrammarEntryState(i, to);
            showToast(`"${e.note.title}" · ${aiEntryStateLabel(to)}${to === 'looked' ? ` (${LOOKUP_PENALTY})` : ''}`, "info");
        }

        function setWordEntryState(i, state) {
            const e = aiLastEsKoWords[i];
            if (!e || e.state === state) return;
            restoreWordScoreState(e.word, e.prev);

            e.state = state;
            e.undone = (state === 'undone');
            e.lookedUp = (state === 'looked');

            if (state === 'normal') {
                e.delta = e.baseDelta;
                if (e.delta) addWordScore(e.word, e.delta, { correct: e.ok });
            } else if (state === 'looked') {
                e.delta = LOOKUP_PENALTY;
                // 틀린 것과 같이 친다 — 그래야 망각곡선에 들어가 다시 만나게 된다
                addWordScore(e.word, e.delta, { correct: false });
            } else {
                e.delta = 0;
            }

            if (typeof saveToStorage === 'function') saveToStorage();
            renderEsKoGrammarRefs();
            if (typeof renderWordList === 'function') renderWordList();
            if (typeof updateStats === 'function') updateStats();
        }

        function cycleWordEntry(i) {
            const e = aiLastEsKoWords[i];
            if (!e) return;
            const to = nextEntryState(e.state);
            setWordEntryState(i, to);
            showToast(`"${e.word.word}" · ${aiEntryStateLabel(to)}${to === 'looked' ? ` (${LOOKUP_PENALTY})` : ''}`, "info");
        }

        // 결과 아래에 '이 문장이 쓴 문법'과 점수 변화를 보여준다 (한→스의 참고 카드와 같은 자리)
        function renderEsKoGrammarRefs() {
            const box = document.getElementById('ai-mission-refs');
            if (!box) return;
            // [냐냐 요청] 한→스는 같은 칸에 '이번 미션이 참고한 내용' 을 먼저 그린다.
            //   점수 카드가 그걸 덮어써서 단어 점수와 해제·찾아봄 버튼이 안 보였다. 위에 남겨둔다.
            const keep = box.querySelector('[data-mission-refs]');
            const keepHtml = keep ? keep.outerHTML : '';
            const hasSuggest = !!((aiLastSuggest || {}).idioms || []).length || !!((aiLastSuggest || {}).newWords || []).length;
            if (!aiLastEsKoGrammar.length && !aiLastEsKoWords.length && !(aiLastIdiomHits || []).length && !hasSuggest) {
                box.innerHTML = keepHtml;
                box.classList.toggle('hidden', !keepHtml);
                return;
            }

            // [냐냐 요청] 각 항목에 '해제' 버튼 — AI 가 의도와 다르게 알아들었을 때 그 점수만 되돌린다.
            const grammarHtml = aiLastEsKoGrammar.map((g, i) => {
                const ok = g.usage === 'correct';
                const txt = g.lookedUp ? '찾아보고 썼어요' : (ok ? '이 문법을 제대로 썼어요' : '이 문법을 쓰긴 했는데 틀렸어요');
                const cls = g.lookedUp ? 'text-amber-600' : (ok ? 'text-emerald-600' : 'text-rose-500');
                return `<div class="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 ${g.undone ? 'opacity-50' : ''}">
                    <button type="button" onclick="openGrammarNoteFromMission('${g.note.id}')" class="flex-1 text-left min-w-0">
                        <div class="text-xs font-extrabold text-slate-800 truncate">${escapeHtml(g.note.icon || '📋')} ${escapeHtml(g.note.title || '')}</div>
                        <div class="text-[10px] font-bold ${g.undone ? 'text-slate-400 line-through' : cls}">${txt} · 점수 ${g.delta > 0 ? '+' : ''}${g.delta}</div>
                        <!-- [냐냐 요청] AI 가 이 노트를 고른 근거 — 문장의 어느 조각 때문인지 보여준다.
                             엉뚱한 노트가 걸리면 여기가 먼저 이상해 보인다 -->
                        ${g.ev ? `<div class="text-[10px] text-slate-400 truncate">근거 · ${escapeHtml(g.ev)}</div>` : ''}
                    </button>
                    ${g.undone ? '<span class="text-[10px] font-bold text-slate-400 shrink-0 mr-1">해제됨</span>' : ''}
                    ${`<button type="button" onclick="openGrammarPeek('${g.note.id}')" title="이 문법 노트 들춰보기" class="shrink-0 w-6 h-6 rounded-full bg-slate-100 hover:bg-teal-100 text-slate-400 hover:text-teal-600 text-[10px] transition-colors"><i class="fa-solid fa-magnifying-glass"></i></button>
                           <button type="button" onclick="cycleGrammarEntry(${i})" title="점수 바꾸기 — 그대로 → 찾아봄(${LOOKUP_PENALTY}) → 해제" class="shrink-0 w-6 h-6 rounded-full ${g.lookedUp ? 'bg-amber-100 text-amber-600' : (g.undone ? 'bg-slate-700 text-white' : 'bg-slate-100 hover:bg-violet-100 text-slate-400 hover:text-violet-600')} text-[10px] transition-colors"><i class="fa-solid fa-rotate-left"></i></button>`}
                </div>`;
            }).join('');

            // 단어는 개수가 많을 수 있어 한 줄짜리 칩으로
            const wordHtml = aiLastEsKoWords.map((w, i) => {
                // 철자는 맞고 형태만 틀린 낱말은 초록도 빨강도 아니다 — 점수가 없다는 걸 회색으로 보여준다
                const cls = w.undone ? 'border-slate-200 bg-slate-50 text-slate-400'
                          : (w.lookedUp ? 'border-amber-200 bg-amber-50 text-amber-700'
                          : (w.noScore ? 'border-slate-300 bg-slate-50 text-slate-500'
                          : (w.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-600')));
                const mark = w.undone ? '해제됨' : (w.noScore && !w.lookedUp ? '고쳐졌어요 · 0' : (w.delta > 0 ? '+' : '') + w.delta);
                return `<span class="inline-flex items-center gap-1 border rounded-lg pl-2 pr-1 py-0.5 ${cls}">
                    <b class="${w.undone ? 'line-through' : ''}">${escapeHtml(w.word.word || '')}</b><span class="text-[10px] font-bold">${mark}</span>
                    <button type="button" onclick="openWordModal('${w.word.id}')" title="이 단어 자세히 보기" class="w-4 h-4 rounded-full hover:bg-white/70 text-[9px] opacity-60 hover:opacity-100 transition-opacity"><i class="fa-solid fa-magnifying-glass"></i></button>
                    <button type="button" onclick="cycleWordEntry(${i})" title="점수 바꾸기 — 그대로 → 찾아봄(${LOOKUP_PENALTY}) → 해제" class="w-4 h-4 rounded-full hover:bg-white/70 text-[9px] ${(w.lookedUp || w.undone) ? 'opacity-100' : 'opacity-60'} hover:opacity-100 transition-opacity"><i class="fa-solid fa-rotate-left"></i></button>
                </span>`;
            }).join('');

            // [냐냐 요청] 등급이 바뀐 단어가 있을 때만 한 덩어리 보여준다.
            //   해제·찾아봄으로 점수를 바꾸면 여기도 같이 다시 계산된다 (지금 등급을 그때그때 읽으므로)
            const shiftRows = aiLastEsKoWords.map(e => ({
                word: e.word.word, meaning: e.word.meaning || '',
                gradeBefore: e.gradeBefore, gradeAfter: (typeof getWordGrade === 'function') ? getWordGrade(e.word) : e.gradeBefore
            }));
            const shiftInner = (typeof gradeShiftHtml === 'function') ? gradeShiftHtml(shiftRows) : '';
            // [냐냐 요청] 이 문장이 쓴 관용구 — 점수는 안 붙고 곡선만 돈다는 걸 분명히 적는다
            const idiomHtml = (aiLastIdiomHits || []).length ? `
                <div class="mt-3 pt-3 border-t border-slate-200">
                    <div class="text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1.5">
                        <i class="fa-solid fa-book-bookmark text-violet-500"></i><span>이 문장이 쓴 관용구</span>
                        <span class="font-normal text-slate-400">점수는 단어에 붙어요. 곡선은 관용구 복습에서만 움직여요</span>
                    </div>
                    <div class="flex flex-wrap gap-1.5 text-[11px] font-semibold">
                        ${aiLastIdiomHits.map(h => `<span class="inline-flex items-center gap-1 border rounded-lg px-2 py-0.5 ${h.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-600'}">
                            <b>${escapeHtml(h.idiom)}</b><span class="text-[10px]">${h.ok ? '이 표현을 썼어요' : '곡선에 들어갔어요'}</span>
                        </span>`).join('')}
                    </div>
                </div>` : '';
            const shiftHtml = shiftInner ? `<div class="mt-3 pt-3 border-t border-slate-200">${shiftInner}</div>` : '';

            box.innerHTML = keepHtml + `
                ${keepHtml ? '<div class="border-t border-slate-200 my-3"></div>' : ''}
                ${grammarHtml ? `<div class="text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1.5">
                    <i class="fa-solid fa-book-open text-violet-500"></i><span>이 문장이 쓴 내 문법</span>
                </div>
                <div class="space-y-1.5">${grammarHtml}</div>` : ''}
                ${wordHtml ? `<div class="text-xs font-bold text-slate-500 mb-1.5 mt-${grammarHtml ? '3' : '0'} flex items-center gap-1.5">
                    <i class="fa-solid fa-spell-check text-violet-500"></i><span>스펠링 점수</span>
                </div>
                <div class="flex flex-wrap gap-1.5 text-[11px] font-semibold">${wordHtml}</div>` : ''}
                ${idiomHtml}
                ${shiftHtml}
                ${(typeof aiSuggestHtml === 'function') ? aiSuggestHtml() : ''}
                ${(grammarHtml || wordHtml) ? `<p class="text-[10px] text-slate-400 mt-2">🔍 자세히 보기 · ↺ 눌러서 점수 바꾸기 (그대로 → 찾아보고 씀 ${LOOKUP_PENALTY} → 해제)</p>` : ''}`;
            box.classList.remove('hidden');
        }

        async function submitAiTranslationEsKo() {
            const userEsText = document.getElementById('ai-free-input-es').value.trim();
            if (!userEsText) {
                showToast("검사받을 스페인어 문장을 적어주세요!", "error");
                return;
            }

            if (!hasGeminiApiKey()) {
                showToast("Gemini API 키가 등록되지 않아 AI 채점을 사용할 수 없습니다. 우측 상단 배지에서 키를 등록해 주세요!", "error");
                openApiKeyModal();
                return;
            }

            const submitBtn = document.getElementById('ai-es-ko-submit-btn');
            const originalHtml = submitBtn.innerHTML;

            // 지난 결과의 문법·단어 카드가 새 채점을 기다리는 동안 남아 있지 않게
            resetAiWritingScores();

            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> 분석 중...`;
            showToast("Gemini AI가 자유 문장의 문법을 분석하고 있습니다...", "info");
            AudioFX.playPunch();

            // [냐냐 요청] 내가 등록해 둔 문법 노트 제목을 주고, 이 문장이 실제로 쓰는 문법을 짚게 한다.
            //   내용까지 다 보내면 25개라 너무 길어져서 제목만 준다 (제목이 충분히 서술적이다)
            const scoreNotes = aiScoringNoteList();
            const noteListText = aiScoringNoteListText(scoreNotes);

            // [냐냐 요청] 단어 후보 목록은 주지 않는다.
            //   예전엔 단어장에서 앞글자가 비슷한 것을 추려 보여줬는데, parece 의 'pare' 에
            //   pareja·pared 가 걸려 엉뚱한 단어가 섞였고 AI 가 그 목록에서 고르려는 유인도 생겼다.
            //   그냥 '문장에 실제로 쓴 단어'를 사전형으로 돌려받아 단어장과 대조한다.
            const prompt = `Student's Free Spanish Sentence: "${userEsText}"

            Analyze this sentence. Identify any grammar/word order issues (like placing 'no' after verbs, wrong gender-number agreements) and provide a perfect natural translation to Korean. For "correctedText": wrap ONLY the words you actually changed/added inside '<span class='text-red-600 font-extrabold underline'>...</span>' tags; already-correct words stay plain. BEFORE OUTPUT, walk the two sentences word by word: if a word appears in the student's sentence and in your correction in the SAME form, it was NOT changed — leave it plain. Marking an unchanged word is a mistake; the student reads the red as "this is what I got wrong". Write the tag with SINGLE quotes exactly as shown — a double quote inside a JSON string breaks the whole response, and the student then sees a sentence that stops mid-way. The reverse is just as bad: EVERY word you changed, added or re-formed must be wrapped — es→está, el pie→mis pies and an added "mucho" all get tags. Count the differences between the two sentences, count your tags, and make the two numbers match. When you EXTEND a sentence, tag only the words you actually added: for "Ayer vi una película." → "Ayer vi una película con mi amigo y cenamos juntos.", the tags go on "con mi amigo y cenamos juntos" alone — "vi una película" stayed exactly as the student wrote it and must stay plain. Split "changes" the same way, one row per piece that really differs; never write a row whose "from" repeats words that did not change. Then give "changes" one row per difference, in the same order — a change you made but never explained leaves the student guessing why their sentence was rewritten. For "originalMarked": output the student original sentence verbatim, wrapping ONLY the wrong words inside '<span class='line-through text-slate-400'>...</span>' tags; correct words stay plain.
${noteListText}
            ${buildLearnerProfileSummary()}`;
            
            const system = `You are an expert Spanish tutor evaluating a student named "냐냐".
            Return feedback matching this JSON schema:
            {
               "isCorrect": true/false,
               "verdict": "e.g., 어순이 완벽해요! 🟢 or 어순을 다시 살펴봐요! 🟠",
               "correctedText": "The corrected standard Spanish sentence. Wrap ONLY changed words in red span tags; correct words plain.",
               "originalMarked": "The student original sentence verbatim, with ONLY wrong words wrapped in line-through span tags; correct words plain.",
               "message": "Concise grammatical analysis in Korean mentioning '냐냐님', 1-2 sentences max. No long essays.",
               "interpretation": "A natural Korean translation of what the student's ORIGINAL sentence actually means (interpret their sentence as written, so they can check if it matches their intent). 1 sentence.",
               "breakdown": [
                  { "word": "ONE short Spanish word from correctedText. EXCEPTION: for reflexive verbs, keep the reflexive pronoun WITH the verb as one item (e.g. 'me llamo', 'se levanta' — NOT split into 'me'+'llamo'). Otherwise never a phrase or full clause.", "mean": "Its Korean meaning, 1-4 words only, never empty" }
               ],
               "changes": [
                  { "from": "original wrong part (word or phrase)", "to": "corrected part", "why": "왜 고쳤는지 한국어로. 규칙 이름과 이유를 함께 쓸 것. 예: '성수일치 — casa 가 여성명사라 bonito 가 아니라 bonita', '어순 — 스페인어는 꾸미는 말이 명사 뒤'. 1~2문장." }
               ],
               "tip": "냐냐님에게 주는 학습 설명. 이 항목이 AI 코멘트를 대신하므로 자세히 쓸 것. 반드시 줄바꿈(\\n)으로 나눈 두 줄로 쓸 것. 한 덩어리로 이어 쓰지 말 것. 1번째 줄: 이번 문장에서 잘한 점 또는 틀린 핵심 한 문장. 2번째 줄: 그 문법이 왜 그렇게 되는지 규칙 설명 1~2문장. 각 줄은 60자 이내로 짧게. 예문은 넣지 말 것 — 고친 문장이 이미 위에 있음. 격려만 늘어놓지 말고 실제로 배울 내용을 담을 것.",
               "issueType": "If isCorrect is false, classify the main mistake as exactly one of: '어순', '성수일치', '동사변형', '시제', '전치사', '어휘선택', '기타'. If isCorrect is true, use '없음'.",${AI_SCORING_JSON_FIELDS}${AI_NATURAL_JSON_FIELDS}
            }${AI_SCORING_RULES_TEXT}${AI_NATURAL_RULES_TEXT}
            IMPORTANT for "breakdown": split correctedText into its individual words/particles (typically 3-7 items). Each item must be exactly ONE word, EXCEPT reflexive verbs where the reflexive pronoun stays attached to the verb (e.g. "me llamo" is ONE item, not two). Never a full phrase or sentence, and "mean" must never be omitted or empty. Do not repeat the same word twice.
            Do not wrap JSON in markdown blockticks.`;

            const schema = {
                type: "OBJECT",
                properties: {
                    isCorrect: { type: "BOOLEAN" },
                    verdict: { type: "STRING" },
                    correctedText: { type: "STRING" },
                    originalMarked: { type: "STRING" },
                    message: { type: "STRING" },
                    interpretation: { type: "STRING", description: "학생이 쓴 원래 문장의 자연스러운 한국어 해석 (의도 확인용)" },
                    breakdown: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                word: { type: "STRING", description: "Exactly one Spanish word or particle, never a phrase or sentence" },
                                mean: { type: "STRING", description: "Korean meaning of that single word, 1-4 words, required and never empty" }
                            },
                            required: ["word", "mean"]
                        }
                    },
                    changes: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                from: { type: "STRING" },
                                to: { type: "STRING" },
                                why: { type: "STRING" }
                            },
                            required: ["from", "to", "why"]
                        }
                    },
                    tip: { type: "STRING" },
                    issueType: { type: "STRING", enum: ["어순", "성수일치", "동사변형", "시제", "전치사", "어휘선택", "기타", "없음"], description: "주된 문법 실수 유형 분류. 정답이면 '없음'" },
                    ...aiScoringSchemaProps(),
                    ...aiNaturalSchemaProps()
                },
                required: ["isCorrect", "verdict", "correctedText", "originalMarked", "message", "breakdown", "tip", "issueType", ...AI_SCORING_REQUIRED, ...AI_NATURAL_REQUIRED]
            };

            try {
                const responseText = await callGemini(prompt, system, schema, 'low');
                // 안전 파서 작동
                const feedback = extractAndParseJson(responseText);

                const resultBox = document.getElementById('ai-feedback-result');
                const correctionBox = document.getElementById('ai-coach-correction-box');
                const originalRender = document.getElementById('ai-original-render');
                const correctedRender = document.getElementById('ai-corrected-render');
                const coachVerdict = document.getElementById('ai-coach-verdict');
                const coachMsg = document.getElementById('ai-coach-message');
                const coachTip = document.getElementById('ai-coach-tip');
                const coachIcon = document.getElementById('ai-coach-icon');

                // [냐냐 요청] 이 문장이 쓴 내 문법 노트·단어에 점수를 반영하고 결과에 보여준다
                // 스→한 자유 작문만 단어·문법 점수를 절반(+1)으로 준다 — 아는 걸 골라 쓰는 거라
                applyAiWritingScores(feedback, scoreNotes);

                resultBox.classList.remove('hidden');

                if (feedback.isCorrect) {
                    coachIcon.innerText = "⭐🟢";
                    coachVerdict.className = "text-sm font-bold text-emerald-600";
                    correctionBox.classList.add('hidden');
                } else {
                    coachIcon.innerText = "📝🟠";
                    coachVerdict.className = "text-sm font-bold text-red-600";
                    correctionBox.classList.remove('hidden');
                    originalRender.innerHTML = feedback.originalMarked || userEsText;
                    correctedRender.innerHTML = feedback.correctedText;
                    renderAiChanges(feedback);
                }

                coachVerdict.innerText = feedback.verdict;
                // [냐냐 PATCH] AI 코멘트 위에 '냐냐님 문장의 추정 해석' 표시 (의도 확인용)
                // [냐냐 요청] 코멘트 박스엔 '추정 해석'만 남긴다 (위 질문 답변 화면과 같은 이유)
                coachMsg.innerHTML = feedback.interpretation
                    ? `<span class="text-[11px] font-bold text-sky-500">📝 추정 해석</span> <span class="font-semibold text-slate-800">${feedback.interpretation}</span>`
                    : `<span>${feedback.message}</span>`;

                renderAiTip(feedback.tip);
                renderAiNatural(feedback);

                // [냐냐 PATCH-수준맞춤] 1:1 첨삭(스->한 자유작문) 결과도 학습 프로필에 반영
                // (자유 작문은 특정 단어/품사가 없는 대신, AI가 분류한 문법 실수 유형으로 추적)
                learnerProfile.totalAnswered++;
                if (feedback.isCorrect) {
                    learnerProfile.totalCorrect++;
                } else if (feedback.issueType && feedback.issueType !== '없음') {
                    learnerProfile.wrongByGrammarType[feedback.issueType] = (learnerProfile.wrongByGrammarType[feedback.issueType] || 0) + 1;
                }

                aiChatHistory = [
                    { role: "system", content: "당신은 냐냐님의 상냥하고 친절한 스페인어 선생님입니다. 이전 자유 작문 첨삭 결과에 이어지는 냐냐님의 추가 질문에 친절하고 정확하게 한국어로 대답해주세요." },
                    { role: "assistant", content: `<b>냐냐님 자유 문장:</b> ${userEsText}<br><b>선생님 피드백:</b> ${feedback.message}<br><b>추천 교정본:</b> ${feedback.correctedText.replace(/<[^>]*>/g, '')}` }
                ];
                renderChatThread();

                recordAiNote('es-ko', '', userEsText, feedback);
                logAction('ai');
                saveToStorage();
                updateStats();
                scrollAiResultIntoView();
                showToast("자유 문장 검토가 끝났습니다! 의문점은 바로 하단 대화창에 남겨보세요! ✨", "success");
            } catch (e) {
                console.error(e);
                showToast(describeGeminiError(e), "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHtml;
            }
        }

        // [냐냐 PATCH] AI 답변의 마크다운(**굵게**, ### 제목, * 목록, 줄바꿈)을 HTML로 변환 + 가독성
        function formatAiText(text) {
            if (!text) return '';
            let html = text;
            // [냐냐 PATCH] 과한 줄바꿈 정리: 연속 빈 줄(3개+)을 2개로 축소
            html = html.replace(/\n{3,}/g, '\n\n');
            html = html
                .replace(/^###\s*(.+)$/gm, '<div class="font-black text-slate-900 mt-2 mb-1">$1</div>') // ### 제목
                .replace(/^##\s*(.+)$/gm, '<div class="font-black text-slate-900 mt-2 mb-1">$1</div>')
                .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') // **굵게**
                .replace(/`(.+?)`/g, '<code class="bg-slate-200 px-1 rounded text-[0.9em]">$1</code>') // `코드`
                .replace(/^\s*[\*\-]\s+(.+)$/gm, '<div class="flex gap-1.5 my-0.5"><span class="text-indigo-400">•</span><span>$1</span></div>') // * 목록
                .replace(/---+/g, '<hr class="my-2 border-slate-200">') // 구분선
                .replace(/\n\n/g, '<br>') // 문단 구분은 br 1개
                .replace(/\n/g, '<br>'); // 나머지 줄바꿈
            return html;
        }

        // [냐냐 PATCH] 핵심 분석 한 줄 — 단어장에 없는 단어면 등록 버튼 추가 (item 4)
        // [냐냐 PATCH] 단어가 이미 등록됐는지 스마트 확인 (동사 변형·형용사 성수변화 포함)
        // [냐냐 PATCH] 입력 단어와 일치하는 단어장 항목을 찾아 반환 (없으면 null)
        //   동사 변형·형용사 성수·명사 단복수까지 관대하게 매칭 — task 7: 등록됨→수정창 열기용
        // ⚠️ 먼저 걸리는 것을 그냥 돌려주면 안 된다. 후보마다 '얼마나 확실한 일치인지'
        //   등급을 매겨서 가장 좋은 것을 고른다.
        //   [냐냐 요청] 예전엔 단어장 순서가 곧 우선순위였다. 그래서 "duermo" 를 쓰면
        //   dormir 가 아니라 dormirse 가 점수를 받았다 — dormirse 의 "me duermo" 에서
        //   재귀대명사를 뗀 "duermo" 가 먼저 걸렸기 때문이다.
        //   재귀형과 아닌 형이 같이 등록된 동사가 28개라 이게 자주 어긋났고,
        //   냐냐 입장에서는 "분명히 쓴 단어에 점수가 안 붙는" 걸로 보였다.
        //   (그 단어에 점수가 안 붙는 데서 끝나지 않는다 — 엉뚱한 단어가 대신 받는다.)
        const FVBF_RANK = { WORD: 0, FORM: 1, NOUN_NUM: 2, REFLEXIVE: 3, ENCLITIC: 4, ENCLITIC_SE: 5, ADJ_STEM: 6 };

        // [냐냐 요청] 동사 뒤에 붙여 쓰는 대명사를 뗀 형태도 만들어 둔다.
        //   "presentarles" → "presentar", "dármelo" → "dar", "hablándome" → "hablando"
        //   원형(-ar/-er/-ir)이나 현재분사(-ando/-iendo/-yendo)로 끝날 때만 인정한다.
        //   이 조건이 없으면 "tomate"(토마토)에서 te 를 떼어 tomar 로 붙는 식의 오인이 생긴다.
        //   악센트는 normalizeSpanishAnswer 가 이미 떼어 준다 (dármelo → darmelo → dar).
        const FVBF_ENCLITICS = ['me', 'te', 'se', 'nos', 'os', 'lo', 'la', 'le', 'los', 'las', 'les'];
        function fvbfEncliticBases(word) {
            const out = [];
            const isVerbBase = (s) => s.length >= 3 && /(ar|er|ir|ando|iendo|yendo)$/.test(s);
            // 대명사는 최대 두 개까지 붙는다 (dármelo = dar + me + lo)
            const peel = (s, depth) => {
                if (depth > 2) return;
                FVBF_ENCLITICS.forEach(p => {
                    if (!s.endsWith(p) || s.length <= p.length + 2) return;
                    const rest = s.slice(0, -p.length);
                    if (isVerbBase(rest) && out.indexOf(rest) < 0) out.push(rest);
                    peel(rest, depth + 1);
                });
            };
            peel(word, 1);
            return out;
        }

        function findVocabWordByForm(rawWord) {
            const target = normalizeSpanishAnswer(rawWord);
            if (!target) return null;
            // 재귀동사 대응: 앞의 재귀대명사(me/te/se/nos/os)를 뗀 형태도 준비
            //   예: "me llamo" → "llamo", "se llama" → "llama"
            const stripReflexive = (s) => s.replace(/^(me|te|se|nos|os)\s+/, '');
            const targetNoReflexive = stripReflexive(target);
            // 뒤에 붙은 대명사를 뗀 형태들 ("presentarles" → "presentar")
            const encliticBases = fvbfEncliticBases(target);

            let best = null, bestRank = Infinity;
            // 같은 등급이면 단어장에서 먼저 나온 것을 쓴다 (예전과 같은 순서)
            const offer = (v, rank) => { if (rank < bestRank) { best = v; bestRank = rank; } };

            for (const v of vocabulary) {
                if (bestRank === FVBF_RANK.WORD) break; // 더 좋은 게 나올 수 없다
                // 1) 원형/사전형 그대로 일치
                const vWordN = normalizeSpanishAnswer(v.word);
                if (vWordN === target) { offer(v, FVBF_RANK.WORD); continue; }
                // 1-2) 붙임 대명사를 뗀 원형과 일치 — "presentarles" → presentar
                //   재귀형으로만 등록된 동사(presentarse)도 받아주되, 그냥 원형이 등록돼
                //   있으면 그쪽이 이기도록 등급을 한 칸 낮춘다.
                if (encliticBases.length) {
                    if (encliticBases.indexOf(vWordN) >= 0) offer(v, FVBF_RANK.ENCLITIC);
                    else if (/(ar|er|ir)se$/.test(vWordN) && encliticBases.indexOf(vWordN.slice(0, -2)) >= 0) {
                        offer(v, FVBF_RANK.ENCLITIC_SE);
                    }
                }
                // 2) 동사: 등록된 모든 시제/인칭 변형과 대조
                if (v.pos === 'verb') {
                    const tenses = v.conjugationsByTense || (v.conjugations ? { presente: v.conjugations } : {});
                    for (const tk in tenses) {
                        const forms = tenses[tk];
                        if (!forms) continue;
                        for (const pk in forms) {
                            if (!forms[pk]) continue;
                            const formN = normalizeSpanishAnswer(forms[pk]);
                            // 글자 그대로 맞은 것이 재귀대명사를 떼고 맞춘 것보다 항상 낫다.
                            //   "duermes" → dormir 의 "duermes"(그대로) 가
                            //               dormirse 의 "te duermes"(뗀 뒤) 를 이긴다.
                            //   "te duermes" → 반대로 dormirse 가 그대로 맞아서 이긴다.
                            if (formN === target) { offer(v, FVBF_RANK.FORM); break; }
                            const formNoReflexive = stripReflexive(formN);
                            if (formN === targetNoReflexive || formNoReflexive === target
                                || formNoReflexive === targetNoReflexive) {
                                offer(v, FVBF_RANK.REFLEXIVE);
                            }
                            // 현재분사에 대명사가 붙은 꼴 — "hablándome" → hablando
                            if (encliticBases.length && encliticBases.indexOf(formN) >= 0) {
                                offer(v, FVBF_RANK.ENCLITIC);
                            }
                        }
                    }
                }
                // 3) 형용사: 남성형으로 등록됐어도 여성형/복수형이면 같은 단어로 취급
                if (v.pos === 'adjective') {
                    const base = normalizeSpanishAnswer(v.word);
                    const stem = base.replace(/(o|a|os|as|e|es)$/, '');
                    // 어간이 충분히 길고, 대상이 같은 어간으로 시작하며 형용사 어미로 끝나면 같은 단어
                    //   어간만 보는 느슨한 추측이라 등급은 가장 낮다
                    if (stem.length >= 2 && target.startsWith(stem) && /^(o|a|os|as|e|es)?$/.test(target.slice(stem.length))) {
                        offer(v, FVBF_RANK.ADJ_STEM);
                    }
                }
                // 4) 명사: 단수형 등록됐으면 복수형도 같은 단어로 취급 (그 반대도)
                if (v.pos === 'noun') {
                    // 관사 뗀 형태로 비교
                    const stripArt = (s) => s.replace(/^(el|la|los|las|un|una|unos|unas)\s+/, '');
                    const vn = stripArt(normalizeSpanishAnswer(v.word));
                    const tn = stripArt(target);
                    if (vn === tn) { offer(v, FVBF_RANK.WORD); continue; }
                    // 스페인어 복수 규칙: +s / +es / z→ces
                    const plurals = (s) => {
                        const arr = [s + 's', s + 'es'];
                        if (s.endsWith('z')) arr.push(s.slice(0, -1) + 'ces');
                        return arr;
                    };
                    // 단수→복수 또는 복수→단수 매칭
                    if (plurals(vn).includes(tn) || plurals(tn).includes(vn)) offer(v, FVBF_RANK.NOUN_NUM);
                }
            }
            return best;
        }

        // [냐냐 요청] '핵심 분석' 카드를 없애면서 그걸 그리던 함수들도 같이 뺐다 (2026-09-02).
        //   toggleAiBreakdown / resetBreakdown / buildBreakdownRow /
        //   refreshBreakdownRegisterButtons / registerWordFromBreakdown
        //   AI 가 주는 낱말 쪼갠 결과(breakdown)는 '아직 단어장에 없어요' 칩을 만드는 데만 쓴다.


        function renderChatThread() {
            const threadEl = document.getElementById('ai-chat-thread');
            threadEl.innerHTML = '';
            
            if (aiChatHistory.length <= 2) {
                threadEl.innerHTML = `
                    <div class="text-center text-slate-400 py-4 font-semibold">
                        🤖 AI에게 실시간으로 추가 질문을 해보세요!<br>
                        "왜 이 전치사가 들어가죠?", "성별 일치는 어떻게 되나요?" 등을 아래에 편하게 타이핑해 물어보세요.
                    </div>
                `;
                return;
            }

            for (let i = 2; i < aiChatHistory.length; i++) {
                const msg = aiChatHistory[i];
                if (msg.role === 'user') {
                    threadEl.innerHTML += `
                        <div class="flex justify-end">
                            <div class="bg-indigo-600 text-white rounded-2xl px-4 py-2.5 max-w-[85%] text-sm font-semibold shadow-xs">
                                ${formatAiText(msg.content)}
                            </div>
                        </div>
                    `;
                } else {
                    threadEl.innerHTML += `
                        <div class="flex justify-start gap-2 items-start">
                            <div class="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-sm shrink-0">🤖</div>
                            <div class="bg-slate-100 text-slate-800 rounded-2xl px-4 py-3 max-w-[85%] text-sm font-medium shadow-2xs leading-relaxed">
                                ${formatAiText(msg.content)}
                            </div>
                        </div>
                    `;
                }
            }
            
            setTimeout(() => {
                threadEl.scrollTop = threadEl.scrollHeight;
            }, 50);
        }

        async function sendFollowupQuestion() {
            const inputEl = document.getElementById('ai-followup-input');
            const question = inputEl.value.trim();
            if (!question) return;

            if (!hasGeminiApiKey()) {
                showToast("Gemini API 키가 등록되지 않아 AI와의 대화를 사용할 수 없습니다. 우측 상단 배지에서 키를 등록해 주세요!", "error");
                openApiKeyModal();
                return;
            }

            const sendBtn = document.getElementById('ai-chat-send-btn');
            const originalHtml = sendBtn.innerHTML;

            aiChatHistory.push({ role: "user", content: question });
            renderChatThread();
            inputEl.value = '';

            sendBtn.disabled = true;
            sendBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i>`;
            AudioFX.playPunch();

            let contextPrompt = `이전 대화 맥락:\n`;
            aiChatHistory.slice(0, -1).forEach(m => {
                contextPrompt += `${m.role === 'user' ? '학생(냐냐)' : '선생님'}: ${m.content}\n`;
            });
            contextPrompt += `\n학생(냐냐)의 새로운 질문: "${question}"\n\n위 질문에 대해 스페인어 선생님으로서 상냥하고 정확하게 답변해 주세요.`;

            try {
                const response = await callGemini(contextPrompt, "You are a friendly, encouraging Spanish tutor. Talk in natural, warm Korean to the student '냐냐님'. Give clear and accurate grammar answers, concisely. IMPORTANT: Do NOT greet or start with phrases like '냐냐님 안녕하세요' — this is an ongoing conversation, so answer the question directly without any greeting.", null, 'low');
                aiChatHistory.push({ role: "assistant", content: response.trim() });
                AudioFX.playSuccess();
                renderChatThread();
            } catch (e) {
                console.error(e);
                aiChatHistory.push({ role: "assistant", content: `앗, 냐냐님! ${describeGeminiError(e)}` });
                renderChatThread();
            } finally {
                sendBtn.disabled = false;
                sendBtn.innerHTML = originalHtml;
            }
        }

        function speakText(event, textIdOrWord) {
            if (event) event.stopPropagation();
            
            let utteranceText = textIdOrWord;
            const targetEl = document.getElementById(textIdOrWord);
            if (targetEl) {
                utteranceText = targetEl.innerText;
            }

            if ('speechSynthesis' in window) {
                speakSpanishVoice(utteranceText, 0.9);
            } else {
                showToast("죄송합니다. 현재 브라우저가 원어민 음성 합성을 지원하지 않습니다.", "error");
            }
        }
