// TAB 4: LIVE AI TRANSLATION COACH
        let currentAiMode = 'ko-es';
        let aiCurrentWordForMission = null;
        let aiCurrentKoreanSentence = "";
        // [냐냐 요청] 이번 미션이 참고한 문법 노트와 같이 섞은 단어들 (첨삭 때 근거로 같이 넘김)
        let aiCurrentGrammarForMission = null;
        let aiCurrentExtraWordsForMission = [];
        let aiLastGrammarDelta = null;   // [냐냐 요청] 직전 첨삭에서 문법표 점수가 얼마나 움직였는지
        let aiForcedGrammarId = null;    // [냐냐 요청] 노트에서 '이 문법으로 번역 연습'을 눌렀을 때 딱 한 번 쓰임

        // [냐냐 요청] 문법 노트 → AI 첨삭으로 바로 가서 그 문법으로 미션 생성
        function startTranslationWithGrammar(id) {
            aiForcedGrammarId = id;
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
            if (!el) return;
            let lines = String(text || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
            // 줄바꿈 없이 길게 왔으면 문장 단위로 쪼갠다 (예시 줄은 붙여둔 채)
            if (lines.length === 1 && lines[0].length > 60) {
                lines = lines[0].split(/(?<=[.!?])\s+(?=[^\s])/).map(s => s.trim()).filter(Boolean);
            }
            if (!lines.length) { el.innerHTML = ''; return; }
            el.innerHTML = lines.map(l => {
                const m = l.match(/^예시\s*[:：]\s*(.*)$/);
                if (m) {
                    // [냐냐 요청] 예시 문장은 굵게 말고 기울임으로
                    return `<div class="mt-2 pt-2 border-t border-yellow-200">
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
            For "correctedText": output the corrected sentence; wrap ONLY the words you actually changed/added inside '<span class="text-red-600 font-extrabold underline">...</span>' tags. Already-correct words stay plain.
            For "originalMarked": output the student's ORIGINAL answer verbatim; wrap ONLY the wrong words inside '<span class="line-through text-slate-400">...</span>' tags. Correct words stay plain.
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
                const breakdownGrid = document.getElementById('ai-word-breakdown');
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

                resetBreakdown(breakdownGrid);
                const seenWordsQ = new Set();
                feedback.breakdown.forEach(item => {
                    const w = (item.word || '').trim();
                    const m = (item.mean || item.meaning || '').trim();
                    if (!w || seenWordsQ.has(w)) return;
                    seenWordsQ.add(w);
                    breakdownGrid.innerHTML += buildBreakdownRow(w, m);
                });

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
            const words = [aiCurrentWordForMission, ...(aiCurrentExtraWordsForMission || [])].filter(Boolean);
            if (!g && !words.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }
            const wordChips = words.map(w =>
                `<span class="inline-flex items-baseline gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
                    <b class="text-slate-800">${escapeHtml(w.word || '')}</b>
                    <span class="text-slate-400">${escapeHtml(w.meaning || '')}</span>
                </span>`).join('');
            box.innerHTML = `
                <div class="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5">
                    <i class="fa-solid fa-book-open text-violet-500"></i><span>이번 미션이 참고한 내용</span>
                </div>
                ${g ? `<button type="button" onclick="openGrammarNoteFromMission('${g.id}')" class="w-full text-left mb-2 bg-white border border-slate-200 hover:border-violet-300 rounded-xl px-3 py-2 transition-colors">
                    <span class="text-[10px] font-bold text-violet-500">문법</span>
                    <div class="text-xs font-extrabold text-slate-800">${escapeHtml(g.icon || '📋')} ${escapeHtml(g.title || '')}</div>
                    ${aiLastGrammarDelta ? (() => {
                        const u = aiLastGrammarDelta.usage, d = aiLastGrammarDelta.delta;
                        const txt = u === 'correct' ? '이 문법을 제대로 썼어요'
                                  : u === 'wrong' ? '이 문법을 쓰긴 했는데 틀렸어요'
                                  : (d < 0 ? '이 문법을 안 쓰고 번역했는데 문장도 틀렸어요' : '이 문법을 안 쓰고 번역했어요 (점수 변화 없음)');
                        const cls = d > 0 ? 'text-emerald-600' : d < 0 ? 'text-rose-500' : 'text-slate-400';
                        return `<div class="text-[10px] font-bold ${cls} mt-1">${txt}${d !== 0 ? ` · 점수 ${d > 0 ? '+' : ''}${d}` : ''}</div>`;
                    })() : ''}
                    <div class="text-[10px] text-slate-400 mt-0.5">눌러서 문법·개념 노트에서 보기 →</div>
                </button>` : ''}
                ${wordChips ? `<div class="flex flex-wrap gap-1.5 text-[11px] font-semibold">${wordChips}</div>` : ''}`;
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
            aiLastGrammarDelta = null;

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

            // [냐냐 요청] 이 미션이 어떤 문법 노트를 보고 나왔는지 첨삭 AI에게도 알려준다
            const refGrammar = aiCurrentGrammarForMission
                ? `\n            Grammar note this mission was built from (the student's own notes — judge against THIS):\n            제목: ${aiCurrentGrammarForMission.title || ''}\n            ${buildGrammarContextForMission(aiCurrentGrammarForMission).replace(/\n/g, '\n            ')}\n`
                : '';
            const refWords = (aiCurrentExtraWordsForMission || []).length
                ? `\n            Other words from the student's vocabulary that were offered: ${aiCurrentExtraWordsForMission.map(w => `${w.word}(${w.meaning})`).join(', ')}\n`
                : '';

            const prompt = `Korean Mission: "${aiCurrentKoreanSentence}"
            Target Word we practice: "${aiCurrentWordForMission.word}" (Meaning: "${aiCurrentWordForMission.meaning}")
            Student's Spanish Answer: "${userText}"
${refGrammar}${refWords}
            Note: the mission is either (a) a Korean sentence to translate, or (b) an instruction asking the student to freely write a Spanish sentence using the target word naturally. Evaluate accordingly: for (a) check translation accuracy; for (b) check that the target word is used correctly and the sentence is natural. Either way, check grammar is correct and the target word is used appropriately.
            CRITICAL GRADING RULE: A translation is CORRECT (isCorrect=true) as long as it is grammatically correct AND accurately conveys the Korean meaning. There are MANY valid ways to translate one sentence. DO NOT mark the student wrong just because their wording differs from any reference sentence — e.g. "Él es muy amable y simpático" and "Él tiene un carácter muy amable" can BOTH be correct translations of the same Korean sentence. Only mark isCorrect=false if there is an ACTUAL grammar error, wrong word, or mistranslation. If the student's sentence is fully correct, set isCorrect=true, and in "correctedText" simply return the student's own correct sentence (optionally you may add a brief note in "tip" showing an alternative phrasing). For "correctedText": wrap ONLY the words you actually changed/added inside '<span class="text-red-600 font-extrabold underline">...</span>' tags; already-correct words stay plain. For "originalMarked": output the student original sentence verbatim, wrapping ONLY the wrong words inside '<span class="line-through text-slate-400">...</span>' tags; correct words stay plain.
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
               "tip": "냐냐님에게 주는 학습 설명. 이 항목이 AI 코멘트를 대신하므로 자세히 쓸 것. 반드시 줄바꿈(\\n)으로 나눈 두 줄로 쓸 것. 한 덩어리로 이어 쓰지 말 것. 1번째 줄: 이번 문장에서 잘한 점 또는 틀린 핵심 한 문장. 2번째 줄: 그 문법이 왜 그렇게 되는지 규칙 설명 1~2문장. 각 줄은 60자 이내로 짧게. 예문은 넣지 말 것 — 고친 문장이 이미 위에 있음. 격려만 늘어놓지 말고 실제로 배울 내용을 담을 것.",
               "grammarPointUsage": "About the grammar note above ONLY. One word: 'correct' (used it, correctly) / 'wrong' (used it, incorrectly) / 'unused' (didn't use it, or no note given). Independent of isCorrect — a vocabulary slip still leaves the grammar 'correct'."${AI_ISSUE_JSON_FIELD}${AI_NATURAL_JSON_FIELDS}
            }${AI_NATURAL_RULES_TEXT}
            IMPORTANT for "changes": list EVERY meaningful change between the student sentence and the corrected one — word-order (어순), articles (el/un/la), gender/number, added/removed words. If a whole phrase was reordered, describe it as ONE change item (original phrase -> reordered phrase) with a clear reason. If already correct, use empty array [].
            IMPORTANT for "breakdown": split correctedText into its individual words/particles (typically 3-7 items). Each item must be exactly ONE word, EXCEPT reflexive verbs where the reflexive pronoun stays attached to the verb (e.g. "me llamo" is ONE item, not two). Never a full phrase or sentence, and "mean" must never be omitted or empty. Do not repeat the same word twice. Note: Korean "눈" is ambiguous (can mean either "snow"=nieve or "eye"=ojo) — always use the target word's actual given meaning to disambiguate, never assume.
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
                    grammarPointUsage: { type: "STRING", description: "correct | wrong | unused" },
                    ...aiIssueSchemaProp(),
                    ...aiNaturalSchemaProps()
                },
                required: ["isCorrect", "verdict", "correctedText", "originalMarked", "message", "breakdown", "tip", "grammarPointUsage", "issueType", ...AI_NATURAL_REQUIRED]
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
                const breakdownGrid = document.getElementById('ai-word-breakdown');
                const coachTip = document.getElementById('ai-coach-tip');
                const coachIcon = document.getElementById('ai-coach-icon');

                // [냐냐 요청] 참조 문법표 점수 반영 — 제대로 씀 +2 / 틀림 −2 /
                //   안 쓰고 문장은 맞음 0 / 안 쓰고 문장도 틀림 −2
                //   ⚠️ 단어 점수는 여기서 건드리지 않는다 (번역은 유의어·문맥 탓에 단어 오답 판정이 부정확)
                aiLastGrammarDelta = null;
                if (aiCurrentGrammarForMission && typeof addGrammarScore === 'function') {
                    const usage = (feedback.grammarPointUsage || 'unused').toString().toLowerCase();
                    let gDelta = 0, transUsed = false;
                    if (usage === 'correct') { gDelta = GRAMMAR_TRANS_OK; transUsed = true; }
                    else if (usage === 'wrong') { gDelta = GRAMMAR_TRANS_BAD; }
                    else if (!feedback.isCorrect) { gDelta = GRAMMAR_TRANS_BAD; }   // 안 쓰고 문장도 틀림
                    if (gDelta !== 0 || transUsed) addGrammarScore(aiCurrentGrammarForMission.id, gDelta, { transUsed });
                    // [냐냐 요청] 문법 망각곡선 — 한→스 미션이 곧 문법 복습이다.
                    //   제대로 썼으면 다음 칸으로, 틀리게 썼으면 진입/한 칸 뒤로.
                    //   안 쓴 경우(unused)는 복습을 한 게 아니므로 건드리지 않는다.
                    if (usage === 'correct' && typeof grammarReviewAdvance === 'function') {
                        grammarReviewAdvance(aiCurrentGrammarForMission.id);
                    } else if (usage === 'wrong' && typeof grammarReviewDemote === 'function') {
                        grammarReviewDemote(aiCurrentGrammarForMission.id);
                    }
                    aiLastGrammarDelta = { usage, delta: gDelta };
                }

                renderAiMissionRefs();   // [냐냐 요청] 채점 후에만 참고한 문법·단어 공개
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
                
                resetBreakdown(breakdownGrid);
                const seenWords = new Set();
                feedback.breakdown.forEach(item => {
                    const w = (item.word || '').trim();
                    const m = (item.mean || item.meaning || '').trim();
                    if (!w || seenWords.has(w)) return; // 중복/빈 항목 제거
                    seenWords.add(w);
                    breakdownGrid.innerHTML += buildBreakdownRow(w, m);
                });

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

            The student is translating the Korean mission into Spanish using the target word. Check translation accuracy, grammar, and natural usage of the target word. For "correctedText": wrap ONLY the words you actually changed/added inside '<span class="text-red-600 font-extrabold underline">...</span>' tags; already-correct words stay plain. For "originalMarked": output the student original sentence verbatim, wrapping ONLY the wrong words inside '<span class="line-through text-slate-400">...</span>' tags; correct words stay plain.
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
                const breakdownGrid = document.getElementById('ai-word-breakdown');
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

                resetBreakdown(breakdownGrid);
                const seenWords = new Set();
                feedback.breakdown.forEach(item => {
                    const w = (item.word || '').trim();
                    const m = (item.mean || item.meaning || '').trim();
                    if (!w || seenWords.has(w)) return;
                    seenWords.add(w);
                    breakdownGrid.innerHTML += buildBreakdownRow(w, m);
                });

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
        function flattenScoredList(feedback, okKey, badKey, legacyKey, legacyName, legacyFlag) {
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
            if (Array.isArray(feedback && feedback[badKey])) feedback[badKey].forEach(v => push(v, false));
            if (!out.length && Array.isArray(feedback && feedback[legacyKey])) {
                feedback[legacyKey].forEach(it => {
                    const flag = String((it && it[legacyFlag]) || '').toLowerCase();
                    if (flag === 'correct' || flag === 'wrong') push(it && it[legacyName], flag === 'correct');
                });
            }
            return out;
        }

        //   okDelta 를 안 주면 +2. 스→한 자유 작문만 +1 을 넘긴다 (문법과 같은 규칙).
        function applyEsKoWordScores(feedback, okDelta) {
            const gainOk = (typeof okDelta === 'number') ? okDelta : WORD_SPELL_OK;
            aiLastEsKoWords = [];
            const list = flattenScoredList(feedback, 'wordsOk', 'wordsBad', 'usedWords', 'word', 'spelling');
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

            const done = new Set();
            list.forEach(item => {
                const key = norm(item.name);
                // 사전형이 단어장 표기와 조금 달라도(활용형·복수형) 역추적으로 한 번 더 찾아본다
                const w = pickByPos(byWord.get(key), item.pos)
                    || ((typeof findVocabWordByForm === 'function' && key) ? findVocabWordByForm(key) : null);
                if (!w || done.has(w.id)) return;
                done.add(w.id);
                const ok = item.ok;
                const delta = ok ? gainOk : WORD_SPELL_BAD;
                // [냐냐 요청] 되돌릴 수 있게 반영 '전' 상태를 통째로 떠둔다.
                //   AI 가 의도와 다른 단어로 알아듣는 경우가 있어서 한 건씩 해제할 수 있어야 한다.
                //   델타만 빼면 안 된다 — 오답이면 lastWrongDate·reviewStage 까지 바뀌기 때문.
                const prev = snapshotWordScoreState(w);
                // 정답률·망각곡선까지 같이 반영되도록 단어 점수는 addWordScore 로 (퀴즈·복습과 같은 경로)
                if (typeof addWordScore === 'function') addWordScore(w, delta, { correct: ok });
                aiLastEsKoWords.push({ word: w, ok, delta, prev, undone: false });
            });
        }

        //   [냐냐 요청] 문법을 제대로 썼을 때 주는 점수는 모드마다 다르다.
        //     한→스 랜덤 미션 / 질문에 답하기 / 내 예문 연습 = +2
        //     스→한 자유 작문 = +1 (아는 문법을 골라 쓰는 거라 절반)
        //     틀리게 쓴 경우는 어디서든 −2.
        function applyEsKoGrammarScores(feedback, notes, okDelta) {
            const gainOk = (typeof okDelta === 'number') ? okDelta : GRAMMAR_TRANS_OK;
            aiLastEsKoGrammar = [];
            const list = flattenScoredList(feedback, 'grammarOk', 'grammarBad', 'usedGrammar', 'title', 'usage');
            if (!list.length || !notes || !notes.length) return;
            if (typeof addGrammarScore !== 'function') return;

            const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, '');
            const byTitle = new Map();
            notes.forEach(t => byTitle.set(norm(t.title), t));

            const done = new Set();
            list.forEach(item => {                       // AI 가 짚은 만큼 다 반영한다 (개수 제한 없음)
                const note = byTitle.get(norm(item.name));
                if (!note || done.has(note.id)) return;   // 지어낸 제목·중복은 버린다
                done.add(note.id);
                const usage = item.ok ? 'correct' : 'wrong';
                const delta = item.ok ? gainOk : GRAMMAR_TRANS_BAD;
                const prev = {
                    score: (typeof grammarScores !== 'undefined') ? grammarScores[note.id] : undefined,
                    transUsed: (typeof grammarTransUsed !== 'undefined') ? grammarTransUsed[note.id] : undefined,
                    mastered: (typeof masteredGrammar !== 'undefined') ? masteredGrammar[note.id] : undefined
                };
                addGrammarScore(note.id, delta, { transUsed: usage === 'correct' });
                // [냐냐 요청] 틀리게 쓴 문법은 어느 모드에서든 곡선에 들어온다.
                //   (앞으로 미는 건 한→스 미션에서만 — 여기선 고른 문법이라 증거가 약하다)
                if (!item.ok && typeof grammarReviewDemote === 'function') grammarReviewDemote(note.id);
                aiLastEsKoGrammar.push({ note, usage, delta, prev, undone: false });
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

        function undoEsKoWordScore(i) {
            const e = aiLastEsKoWords[i];
            if (!e || e.undone) return;
            restoreWordScoreState(e.word, e.prev);
            e.undone = true;
            if (typeof saveToStorage === 'function') saveToStorage();
            renderEsKoGrammarRefs();
            if (typeof renderWordList === 'function') renderWordList();
            if (typeof updateStats === 'function') updateStats();
            showToast(`"${e.word.word}" 점수를 되돌렸어요`, "info");
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
        // [냐냐 요청] 예전엔 제목만 보냈다. AI 가 표 안에 뭐가 있는지 모른 채 제목만 보고 짐작해서,
        //   문장에 없는 문법에도 점수가 붙는 일이 있었다. 표 전체는 하나에 3천 자라 못 보내니
        //   설명 앞부분과 표 안의 스페인어 낱말 몇 개만 단서로 붙인다 (한 표당 150자 안팎).
        function aiScoringNoteHint(t) {
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
            return `\n            My grammar notes. Each line is "TITLE :: what the note is about | example words from the note".\n            Use the hint to decide whether the sentence REALLY exercises that note — do not guess from the title alone:\n            ${lines.join('\n            ')}\n`;
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
               "grammarOk": ["EXACT note titles from the list above that this sentence uses CORRECTLY"],
               "grammarBad": ["EXACT note titles from the list above that this sentence uses INCORRECTLY"],
               "wordsOk": ["each content word the student spelled CORRECTLY, written as \\"dictionary form|part of speech\\""],
               "wordsBad": ["each content word the student MISSPELLED, written as \\"dictionary form|part of speech\\""]`;
        const AI_SCORING_RULES_TEXT = `
            IMPORTANT for "wordsOk"/"wordsBad": both are REQUIRED — always output them, using [] when empty. Output plain strings only, never objects. Walk through the student's ORIGINAL sentence and place each content word they actually wrote (nouns, verbs, adjectives, adverbs), in its dictionary form, into exactly one of the two lists. Dictionary form = verbs as infinitive (es → ser, tengo → tener), nouns as singular with article (libros → el libro), adjectives as masculine singular (bonita → bonito). Skip articles, bare one-word prepositions and pronouns. DO include multi-word set phrases and connectors as a single entry (e.g. "antes de", "después de", "al lado de", "a la derecha de", "tener ganas de") — these are vocabulary items too, so never split or drop them. Judge SPELLING ONLY — accents count (año and ano are different words); a correctly spelled word goes in "wordsOk" even if it was a poor word choice for the meaning. For a misspelled word, put the dictionary form of the word they were CLEARLY trying to write into "wordsBad". Never list a word the student did not write. ALWAYS append "|" and the part of speech the word has IN THIS SENTENCE — exactly one of noun, verb, adjective, adverb, preposition, pronoun, conjunction, interrogative, phrase. The same spelling can be different parts of speech ("vivo solo|adverb" but "un café solo|adjective"; "el joven|noun" but "un chico joven|adjective"), so decide from how it is actually used here, never from the word alone. Never omit the "|part of speech".
            IMPORTANT for "grammarOk"/"grammarBad": both are REQUIRED — always output them, using [] when empty. Output the note titles exactly as given in the list above, and never invent a title. Be STRICT: before listing a note, point to the exact word or structure in the student's sentence that matches the note's hint. If you cannot point to one, leave the note out. Most sentences match 0-2 notes; listing many is a sign you are guessing. Do NOT list a note merely because its topic feels related, because the sentence is in the present tense, or because it contains some noun — the note's own rule must be visibly used. A note whose hint lists specific words (e.g. months, weekdays, possessives) counts only if one of those actual words appears in the sentence.`;
        // 스키마 조각. ⚠️ 쓰는 쪽에서 required 에도 usedGrammar·usedWords 를 꼭 넣어야 한다 —
        //   빼두면 모델이 항목을 통째로 생략해서 점수가 조용히 안 붙는다 (실제로 그랬다).
        const AI_SCORING_REQUIRED = ["grammarOk", "grammarBad", "wordsOk", "wordsBad"];
        function aiScoringSchemaProps() {
            return {
                grammarOk: { type: "ARRAY", items: { type: "STRING" }, description: "이 문장이 제대로 쓴 문법 노트 제목들 (목록에 있는 제목 그대로)" },
                grammarBad: { type: "ARRAY", items: { type: "STRING" }, description: "이 문장이 틀리게 쓴 문법 노트 제목들" },
                wordsOk: { type: "ARRAY", items: { type: "STRING" }, description: "스펠링이 맞은 낱말의 사전형들" },
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
            IMPORTANT for "moreNatural"/"naturalWhy": both are REQUIRED — always output them, using "" when there is nothing to say. They describe how a NATIVE would say it, not what is wrong, so they must NEVER affect isCorrect, verdict, issueType or any score, and must never restate a mistake you already fixed in correctedText. Fill them in only when a native speaker would clearly phrase it differently — common cases: Spanish uses the plural for paired body parts (los pies, las manos), a definite article instead of a possessive for one's own body (me duele la cabeza, not mi cabeza), a fixed collocation (tener hambre, hacer una pregunta, dar un paseo), or a more idiomatic word order or register. If the sentence already sounds natural as written, output "" for both.`;
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
        function recordAiNote(mode, ask, mine, feedback) {
            if (typeof aiNotes === 'undefined' || !feedback) return;
            const plain = (v) => String(v == null ? '' : v).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
            const mineText = plain(mine);
            if (!mineText) return;   // 빈 제출은 남길 게 없다
            const issue = plain(feedback.issueType);
            aiNotes.unshift({
                t: new Date().toISOString(),
                mode: mode,                                   // 'question' | 'ko-es' | 'example' | 'es-ko'
                ask: plain(ask),                              // 질문·미션 (자유 작문은 빈 값)
                mine: mineText,                               // 내가 쓴 문장
                fixed: plain(feedback.correctedText),         // 교정본
                msg: plain(feedback.message),                 // 총평
                tip: plain(feedback.tip),
                natural: plain(feedback.moreNatural),         // 더 자연스러운 표현 (있을 때만)
                issue: (issue && issue !== '없음') ? issue : '',
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

        function aiNoteMatches(n) {
            if (aiNoteFilter === 'all') return true;
            if (aiNoteFilter === 'wrong') return !n.ok;
            return n.issue === aiNoteFilter;
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

        function renderAiNoteList() {
            const box = document.getElementById('ai-note-list');
            const filterBox = document.getElementById('ai-note-filters');
            if (!box) return;

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
                    issues.map(([t, c]) => chip(t, escapeHtml(t), c, amber)).join('');
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
                        ${hasDetail ? `<button onclick="toggleAiNote('${key}')" class="mt-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors">${open ? '접기' : '선생님 총평 보기'}</button>` : ''}
                    </div>`;
            }).join('');

            if (matched.length > page.length) {
                box.innerHTML += `<button onclick="showMoreAiNotes()" class="w-full py-2 text-[11px] font-bold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-2xl transition-all">${matched.length - page.length}개 더 보기</button>`;
            }
        }

        // 채점 결과를 반영하고 결과 카드에 표시한다 (해제 버튼 포함)
        //   halfCredit = 스→한 자유 작문. 아는 걸 골라 쓰는 거라 단어·문법 둘 다 절반(+1)만 준다.
        //   나머지 모드(한→스 미션·질문에 답하기·내 예문 연습)는 +2. 틀리면 어디서든 −2.
        function applyAiWritingScores(feedback, notes, halfCredit) {
            applyEsKoGrammarScores(feedback, notes, halfCredit ? GRAMMAR_FREE_OK : GRAMMAR_TRANS_OK);
            applyEsKoWordScores(feedback, halfCredit ? WORD_SPELL_FREE_OK : WORD_SPELL_OK);
            renderEsKoGrammarRefs();
        }
        // 새 채점을 시작하기 전에 지난 결과 카드를 치운다
        function resetAiWritingScores() {
            renderAiNatural(null); // 지난 결과의 '더 자연스러운 표현'이 남아 있으면 안 된다
            aiLastEsKoGrammar = [];
            aiLastEsKoWords = [];
            const box = document.getElementById('ai-mission-refs');
            if (box) { box.classList.add('hidden'); box.innerHTML = ''; }
        }

        function undoEsKoGrammarScore(i) {
            const e = aiLastEsKoGrammar[i];
            if (!e || e.undone) return;
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
            e.undone = true;
            if (typeof saveToStorage === 'function') saveToStorage();
            renderEsKoGrammarRefs();
            if (typeof renderGrammarTables === 'function') renderGrammarTables();
            showToast(`"${e.note.title}" 점수를 되돌렸어요`, "info");
        }

        // 결과 아래에 '이 문장이 쓴 문법'과 점수 변화를 보여준다 (한→스의 참고 카드와 같은 자리)
        function renderEsKoGrammarRefs() {
            const box = document.getElementById('ai-mission-refs');
            if (!box) return;
            if (!aiLastEsKoGrammar.length && !aiLastEsKoWords.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }

            // [냐냐 요청] 각 항목에 '해제' 버튼 — AI 가 의도와 다르게 알아들었을 때 그 점수만 되돌린다.
            const grammarHtml = aiLastEsKoGrammar.map((g, i) => {
                const ok = g.usage === 'correct';
                const txt = ok ? '이 문법을 제대로 썼어요' : '이 문법을 쓰긴 했는데 틀렸어요';
                const cls = ok ? 'text-emerald-600' : 'text-rose-500';
                return `<div class="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 ${g.undone ? 'opacity-50' : ''}">
                    <button type="button" onclick="openGrammarNoteFromMission('${g.note.id}')" class="flex-1 text-left min-w-0">
                        <div class="text-xs font-extrabold text-slate-800 truncate">${escapeHtml(g.note.icon || '📋')} ${escapeHtml(g.note.title || '')}</div>
                        <div class="text-[10px] font-bold ${g.undone ? 'text-slate-400 line-through' : cls}">${txt} · 점수 ${g.delta > 0 ? '+' : ''}${g.delta}</div>
                    </button>
                    ${g.undone
                        ? '<span class="text-[10px] font-bold text-slate-400 shrink-0">해제됨</span>'
                        : `<button type="button" onclick="undoEsKoGrammarScore(${i})" title="이 점수 해제" class="shrink-0 w-6 h-6 rounded-full bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-500 text-[10px] transition-colors"><i class="fa-solid fa-rotate-left"></i></button>`}
                </div>`;
            }).join('');

            // 단어는 개수가 많을 수 있어 한 줄짜리 칩으로
            const wordHtml = aiLastEsKoWords.map((w, i) => {
                const cls = w.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-600';
                if (w.undone) {
                    return `<span class="inline-flex items-baseline gap-1 border rounded-lg px-2 py-0.5 border-slate-200 bg-slate-50 text-slate-400">
                        <b class="line-through">${escapeHtml(w.word.word || '')}</b><span class="text-[10px] font-bold">해제됨</span>
                    </span>`;
                }
                return `<span class="inline-flex items-center gap-1 border rounded-lg pl-2 pr-1 py-0.5 ${cls}">
                    <b>${escapeHtml(w.word.word || '')}</b><span class="text-[10px] font-bold">${w.delta > 0 ? '+' : ''}${w.delta}</span>
                    <button type="button" onclick="undoEsKoWordScore(${i})" title="이 점수 해제" class="w-4 h-4 rounded-full hover:bg-white/70 text-[9px] opacity-60 hover:opacity-100 transition-opacity"><i class="fa-solid fa-rotate-left"></i></button>
                </span>`;
            }).join('');

            box.innerHTML = `
                ${grammarHtml ? `<div class="text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1.5">
                    <i class="fa-solid fa-book-open text-violet-500"></i><span>이 문장이 쓴 내 문법</span>
                </div>
                <div class="space-y-1.5">${grammarHtml}</div>` : ''}
                ${wordHtml ? `<div class="text-xs font-bold text-slate-500 mb-1.5 mt-${grammarHtml ? '3' : '0'} flex items-center gap-1.5">
                    <i class="fa-solid fa-spell-check text-violet-500"></i><span>스펠링 점수</span>
                </div>
                <div class="flex flex-wrap gap-1.5 text-[11px] font-semibold">${wordHtml}</div>` : ''}`;
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

            Analyze this sentence. Identify any grammar/word order issues (like placing 'no' after verbs, wrong gender-number agreements) and provide a perfect natural translation to Korean. For "correctedText": wrap ONLY the words you actually changed/added inside '<span class="text-red-600 font-extrabold underline">...</span>' tags; already-correct words stay plain. For "originalMarked": output the student original sentence verbatim, wrapping ONLY the wrong words inside '<span class="line-through text-slate-400">...</span>' tags; correct words stay plain.
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
                const breakdownGrid = document.getElementById('ai-word-breakdown');
                const coachTip = document.getElementById('ai-coach-tip');
                const coachIcon = document.getElementById('ai-coach-icon');

                // [냐냐 요청] 이 문장이 쓴 내 문법 노트·단어에 점수를 반영하고 결과에 보여준다
                // 스→한 자유 작문만 단어·문법 점수를 절반(+1)으로 준다 — 아는 걸 골라 쓰는 거라
                applyAiWritingScores(feedback, scoreNotes, true);

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
                
                resetBreakdown(breakdownGrid);
                const seenWordsEs = new Set();
                feedback.breakdown.forEach(item => {
                    const w = (item.word || '').trim();
                    const m = (item.mean || item.meaning || '').trim();
                    if (!w || seenWordsEs.has(w)) return; // 중복/빈 항목 제거
                    seenWordsEs.add(w);
                    breakdownGrid.innerHTML += buildBreakdownRow(w, m);
                });

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

        // [냐냐 요청] 핵심 분석 접기/펼치기. open 을 주면 그 상태로, 안 주면 뒤집는다
        function toggleAiBreakdown(open) {
            const wrap = document.getElementById('ai-breakdown-wrap');
            if (!wrap) return;
            const willOpen = (open === undefined) ? wrap.classList.contains('hidden') : !!open;
            wrap.classList.toggle('hidden', !willOpen);
            const chev = document.getElementById('ai-breakdown-chevron');
            if (chev) chev.style.transform = willOpen ? 'rotate(180deg)' : '';
        }

        // 항상 접은 채로 시작 — 새 첨삭 결과를 그릴 때마다 비우면서 같이 되접는다
        //   (한 번 펼쳐두면 그 상태가 남아서 다음 첨삭 때 펼쳐진 채로 나온다)
        function resetBreakdown(grid) {
            if (grid) grid.innerHTML = '';
            toggleAiBreakdown(false);
        }

        function buildBreakdownRow(word, mean) {
            const w = (word || '').trim();
            const m = (mean || '').trim();
            if (!w) return '';
            // 단어장에 이미 있는지 확인 (동사 변형·형용사 성수변화까지 고려)
            const existing = findVocabWordByForm(w);
            const wEsc = w.replace(/'/g, "\\'");
            const mEsc = m.replace(/'/g, "\\'");
            const registerBtn = existing
                ? `<button class="breakdown-reg text-[10px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-full shrink-0 transition-all" title="이 단어 수정하기" onclick="openWordModal('${existing.id}')">✓ 등록됨</button>`
                : `<button class="breakdown-reg text-[10px] font-bold text-white bg-violet-500 hover:bg-violet-600 px-2 py-0.5 rounded-full shrink-0 transition-all" onclick="registerWordFromBreakdown('${wEsc}', '${mEsc}')">+ 등록</button>`;
            return `
                <div class="flex items-center justify-between gap-2 px-3 py-2 text-sm" data-breakdown-word="${w.replace(/"/g, '&quot;')}">
                    <span class="font-bold text-slate-800 shrink-0">${w}</span>
                    <span class="text-slate-500 text-right flex-1 truncate">${m}</span>
                    ${registerBtn}
                </div>
            `;
        }

        // [냐냐 PATCH] 단어 등록 후 핵심분석의 등록 버튼을 '✓ 등록됨'(수정창으로 이동)으로 갱신 (AI item 1)
        function refreshBreakdownRegisterButtons() {
            document.querySelectorAll('[data-breakdown-word]').forEach(row => {
                const w = row.getAttribute('data-breakdown-word');
                const match = w ? findVocabWordByForm(w) : null;
                if (match) {
                    const regEl = row.querySelector('.breakdown-reg');
                    // 아직 '+ 등록' 버튼 상태(=위에 아직 안 바뀐 것)면 '✓ 등록됨'(수정 링크)으로 교체
                    if (regEl && regEl.tagName === 'BUTTON' && /\+ 등록/.test(regEl.textContent)) {
                        regEl.outerHTML = `<button class="breakdown-reg text-[10px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-full shrink-0 transition-all" title="이 단어 수정하기" onclick="openWordModal('${match.id}')">✓ 등록됨</button>`;
                    }
                }
            });
        }

        // 핵심 분석에서 단어 바로 등록
        function registerWordFromBreakdown(word, mean) {
            // [냐냐 PATCH] 탭을 옮기지 않고 현재 화면(AI 첨삭) 위에 등록 모달만 띄움
            openWordModal();
            _skipContinueRegisterPrompt = true; // [냐냐 PATCH] 첨삭에서 등록하면 '계속 등록?' 팝업 안 뜨게
            setTimeout(() => {
                const wordInput = document.getElementById('input-word');
                const meanInput = document.getElementById('input-meaning');
                if (wordInput) wordInput.value = word;
                if (meanInput) meanInput.value = mean;
                if (wordInput) handleWordInput(word);
            }, 100);
        }

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
