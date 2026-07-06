// TAB 4: LIVE AI TRANSLATION COACH
        let currentAiMode = 'ko-es';
        let aiCurrentWordForMission = null;
        let aiCurrentKoreanSentence = "";

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
            list.innerHTML = changes.map(c => {
                const from = (c.from || '').trim();
                const to = (c.to || '').trim();
                const why = (c.why || '').trim();
                return `<li class="flex flex-col gap-0.5">
                    <span><span class="text-slate-400 line-through">${from}</span> <span class="text-slate-300">→</span> <span class="text-red-600 font-bold">${to}</span></span>
                    ${why ? `<span class="text-[11px] text-slate-500 pl-1">· ${why}</span>` : ''}
                </li>`;
            }).join('');
        }

        function switchAiMode(mode) {
            currentAiMode = mode;
            const btnKoEs = document.getElementById('ai-mode-btn-ko-es');
            const btnEsKo = document.getElementById('ai-mode-btn-es-ko');
            const btnQuestion = document.getElementById('ai-mode-btn-question');
            const btnExample = document.getElementById('ai-mode-btn-example');
            const paneKoEs = document.getElementById('ai-pane-ko-es');
            const paneEsKo = document.getElementById('ai-pane-es-ko');
            const paneQuestion = document.getElementById('ai-pane-question');
            const paneExample = document.getElementById('ai-pane-example');
            const resultBox = document.getElementById('ai-feedback-result');

            resultBox.classList.add('hidden');

            const activeClass = "py-2.5 rounded-lg text-xs font-bold transition-all bg-white text-slate-900 shadow-sm";
            const inactiveClass = "py-2.5 rounded-lg text-xs font-bold transition-all text-slate-500 hover:text-slate-900";
            btnKoEs.className = mode === 'ko-es' ? activeClass : inactiveClass;
            btnEsKo.className = mode === 'es-ko' ? activeClass : inactiveClass;
            btnQuestion.className = mode === 'question' ? activeClass : inactiveClass;
            if (btnExample) btnExample.className = mode === 'example' ? activeClass : inactiveClass;
            paneKoEs.classList.toggle('hidden', mode !== 'ko-es');
            paneEsKo.classList.toggle('hidden', mode !== 'es-ko');
            paneQuestion.classList.toggle('hidden', mode !== 'question');
            if (paneExample) paneExample.classList.toggle('hidden', mode !== 'example');

            if (mode === 'ko-es') {
                resetKoEsMissionState();
            } else if (mode === 'es-ko') {
                document.getElementById('ai-free-input-es').value = '';
            } else if (mode === 'question') {
                // 질문 목록은 '질문 관리' 모달에서 보여주므로 여기선 별도 처리 불필요
            } else if (mode === 'example') {
                resetExampleMissionState();
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

            // 검색 중이면 다 펼침, 아니면 저장된 상태(기본 접힘)
            const searching = !!searchVal;

            box.innerHTML = Object.entries(groups).map(([topic, qs]) => {
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

        function pickRandomQuestion() {
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
            const randIdx = Math.floor(Math.random() * pool.length);
            currentQuestionForAnswer = pool[randIdx];
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

            const prompt = `Question (may be in Spanish or Korean): "${currentQuestionForAnswer.question}"
            Student's Spanish Answer: "${userAnswer}"

            Evaluate whether the student's Spanish answer is grammatically correct AND is a sensible, appropriate response to the question (content relevance matters, not just grammar).
            For "correctedText": output the corrected sentence; wrap ONLY the words you actually changed/added inside '<span class="text-red-600 font-extrabold underline">...</span>' tags. Already-correct words stay plain.
            For "originalMarked": output the student's ORIGINAL answer verbatim; wrap ONLY the wrong words inside '<span class="line-through text-slate-400">...</span>' tags. Correct words stay plain.
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
                  { "from": "original wrong part (word or phrase)", "to": "corrected part", "why": "Short Korean reason, e.g. '형용사는 명사 뒤에 와요' or '관사가 자연스러워요'. 1 sentence." }
               ],
               "tip": "One short, useful grammar or conversational tip in Korean, 1 sentence.",
               "issueType": "If isCorrect is false, classify the main issue as exactly one of: '어순', '성수일치', '동사변형', '시제', '전치사', '어휘선택', '내용부적절', '기타'. If isCorrect is true, use '없음'."
            }
            IMPORTANT for "breakdown": split correctedText into individual words/particles (typically 3-7 items), each exactly ONE word, "mean" never empty, no duplicates.
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
                    issueType: { type: "STRING", enum: ["어순", "성수일치", "동사변형", "시제", "전치사", "어휘선택", "내용부적절", "기타", "없음"] }
                },
                required: ["isCorrect", "verdict", "correctedText", "originalMarked", "message", "breakdown", "tip", "issueType"]
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
                    // [냐냐 PATCH] 냐냐님이 쓴 스페인어의 실제 한국어 뜻 표시 (의도와 다를 수 있음) — item 5
                    const utEl = document.getElementById('ai-user-translation');
                    if (utEl) {
                        if (feedback.userTranslation) {
                            utEl.innerHTML = `<span class="text-[11px] text-slate-400">냐냐님이 쓴 문장의 실제 뜻</span><br>💬 ${feedback.userTranslation}`;
                            utEl.classList.remove('hidden');
                        } else {
                            utEl.classList.add('hidden');
                        }
                    }
                }

                coachVerdict.innerText = feedback.verdict;
                coachMsg.innerHTML = feedback.message;

                breakdownGrid.innerHTML = '';
                const seenWordsQ = new Set();
                feedback.breakdown.forEach(item => {
                    const w = (item.word || '').trim();
                    const m = (item.mean || item.meaning || '').trim();
                    if (!w || seenWordsQ.has(w)) return;
                    seenWordsQ.add(w);
                    breakdownGrid.innerHTML += buildBreakdownRow(w, m);
                });

                coachTip.innerText = feedback.tip;

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

                logAction('ai');
                saveToStorage();
                updateStats();
                // [냐냐 PATCH] 연관 질문 생성 버튼 노출 + 직전 문답 맥락 저장
                lastAnsweredQuestion = { question: currentQuestionForAnswer.question, answer: userAnswer, corrected: (feedback.correctedText || '').replace(/<[^>]*>/g, '') };
                const followupBtn = document.getElementById('question-followup-btn');
                if (followupBtn) followupBtn.classList.remove('hidden');
                resultBox.scrollIntoView({ behavior: 'smooth' });
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
        async function generateAiMission() {
            const missionHeading = document.getElementById('ai-mission-korean');
            const resultBox = document.getElementById('ai-feedback-result');
            const hintBox = document.getElementById('ai-mission-hint-box');
            const genBtn = document.getElementById('ai-generate-mission-btn');

            resultBox.classList.add('hidden');
            hintBox.classList.add('hidden');
            isAiHintVisible = false;
            document.getElementById('ai-user-input').value = '';

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

            const originalBtnHtml = genBtn.innerHTML;
            genBtn.disabled = true;
            genBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> 생성 중...`;
            missionHeading.innerHTML = `<span class="inline-flex items-center gap-2 text-slate-400 text-base"><i class="fa-solid fa-spinner animate-spin"></i> AI가 문장을 만들고 있어요... (보통 3~5초)</span>`;

            const prompt = `스페인어 단어 "${targetWord.word}" (뜻: "${targetWord.meaning}", 품사: ${targetWord.pos})를 스페인어로 번역할 때 이 단어를 자연스럽게 써야 하는, 짧고 일상적인 구어체 한국어 문장을 1개 만들어주세요. 실제로 친구한테 말할 법한 자연스러운 문장으로, 너무 길지 않게.
            매우 중요: 문장은 100% 순수한 한국어로만 작성하고, 스페인어 단어("${targetWord.word}" 포함)나 알파벳, 영어를 절대 섞지 마세요. 학생이 이 한국어 문장을 보고 스스로 스페인어로 번역해야 하므로, 정답이 될 단어를 한국어 문장 안에 그대로 노출하면 절대 안 됩니다. 의미는 한국어 뜻("${targetWord.meaning}")으로만 표현하세요.
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

            const submitBtn = document.getElementById('ai-ko-es-submit-btn');
            const originalHtml = submitBtn.innerHTML;
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> 분석 중...`;
            showToast("Gemini AI가 냐냐님의 답변을 분석하고 있습니다...", "info");
            AudioFX.playPunch();

            const prompt = `Korean Mission: "${aiCurrentKoreanSentence}"
            Target Word we practice: "${aiCurrentWordForMission.word}" (Meaning: "${aiCurrentWordForMission.meaning}")
            Student's Spanish Answer: "${userText}"
            
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
                  { "from": "the original wrong part (word or phrase, e.g. 'el muy famoso restaurante')", "to": "the corrected part (e.g. 'un restaurante muy famoso')", "why": "Short Korean reason WHY it changed, e.g. '스페인어는 형용사가 명사 뒤에 와요' or '관사가 더 자연스러워요'. 1 sentence." }
               ],
               "tip": "One short, useful grammatical tip in Korean, 1 sentence."
            }
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
                                why: { type: "STRING", description: "Short Korean reason for the change" }
                            },
                            required: ["from", "to", "why"]
                        }
                    },
                    tip: { type: "STRING" }
                },
                required: ["isCorrect", "verdict", "correctedText", "originalMarked", "message", "breakdown", "tip"]
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
                
                breakdownGrid.innerHTML = '';
                const seenWords = new Set();
                feedback.breakdown.forEach(item => {
                    const w = (item.word || '').trim();
                    const m = (item.mean || item.meaning || '').trim();
                    if (!w || seenWords.has(w)) return; // 중복/빈 항목 제거
                    seenWords.add(w);
                    breakdownGrid.innerHTML += buildBreakdownRow(w, m);
                });

                coachTip.innerText = feedback.tip;

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

                logAction('ai');
                saveToStorage();
                updateStats();
                resultBox.scrollIntoView({ behavior: 'smooth' });
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
            const hint = document.getElementById('ai-example-hint-box');
            if (hint) hint.classList.add('hidden');
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

        // 예문 연습 힌트 (단어 정보)
        function toggleExampleHint() {
            const box = document.getElementById('ai-example-hint-box');
            if (!box) return;
            box.classList.toggle('hidden');
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

            const refExample = aiCurrentWordForMission.example || '';
            const prompt = `Korean Mission: "${aiCurrentKoreanSentence}"
            Target Word we practice: "${aiCurrentWordForMission.word}" (Meaning: "${aiCurrentWordForMission.meaning}")
            Reference example sentence (for context): "${refExample}"
            Student's Spanish Answer: "${userText}"

            The student is translating the Korean mission into Spanish using the target word. Check translation accuracy, grammar, and natural usage of the target word. For "correctedText": wrap ONLY the words you actually changed/added inside '<span class="text-red-600 font-extrabold underline">...</span>' tags; already-correct words stay plain. For "originalMarked": output the student original sentence verbatim, wrapping ONLY the wrong words inside '<span class="line-through text-slate-400">...</span>' tags; correct words stay plain.
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
               "tip": "One short useful tip in Korean."
            }
            IMPORTANT for "breakdown": split correctedText into individual words (3-7 items), each exactly ONE word, "mean" never empty, no duplicates.
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
                    tip: { type: "STRING" }
                },
                required: ["isCorrect", "verdict", "correctedText", "originalMarked", "message", "breakdown", "tip"]
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

                breakdownGrid.innerHTML = '';
                const seenWords = new Set();
                feedback.breakdown.forEach(item => {
                    const w = (item.word || '').trim();
                    const m = (item.mean || item.meaning || '').trim();
                    if (!w || seenWords.has(w)) return;
                    seenWords.add(w);
                    breakdownGrid.innerHTML += buildBreakdownRow(w, m);
                });

                coachTip.innerText = feedback.tip;

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

                logAction('ai');
                saveToStorage();
                updateStats();
                resultBox.scrollIntoView({ behavior: 'smooth' });
                showToast("AI 첨삭이 끝났습니다! ✨", "success");
            } catch (e) {
                console.error(e);
                showToast(describeGeminiError(e), "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHtml;
            }
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
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> 분석 중...`;
            showToast("Gemini AI가 자유 문장의 문법을 분석하고 있습니다...", "info");
            AudioFX.playPunch();

            const prompt = `Student's Free Spanish Sentence: "${userEsText}"
            
            Analyze this sentence. Identify any grammar/word order issues (like placing 'no' after verbs, wrong gender-number agreements) and provide a perfect natural translation to Korean. For "correctedText": wrap ONLY the words you actually changed/added inside '<span class="text-red-600 font-extrabold underline">...</span>' tags; already-correct words stay plain. For "originalMarked": output the student original sentence verbatim, wrapping ONLY the wrong words inside '<span class="line-through text-slate-400">...</span>' tags; correct words stay plain.
            ${buildLearnerProfileSummary()}`;
            
            const system = `You are an expert Spanish tutor evaluating a student named "냐냐".
            Return feedback matching this JSON schema:
            {
               "isCorrect": true/false,
               "verdict": "e.g., 어순이 완벽해요! 🟢 or 어순을 다시 살펴봐요! 🟠",
               "correctedText": "The corrected standard Spanish sentence. Wrap ONLY changed words in red span tags; correct words plain.",
               "originalMarked": "The student original sentence verbatim, with ONLY wrong words wrapped in line-through span tags; correct words plain.",
               "message": "Concise grammatical analysis in Korean mentioning '냐냐님', 1-2 sentences max. No long essays.",
               "breakdown": [
                  { "word": "ONE short Spanish word from correctedText. EXCEPTION: for reflexive verbs, keep the reflexive pronoun WITH the verb as one item (e.g. 'me llamo', 'se levanta' — NOT split into 'me'+'llamo'). Otherwise never a phrase or full clause.", "mean": "Its Korean meaning, 1-4 words only, never empty" }
               ],
               "changes": [
                  { "from": "original wrong part (word or phrase)", "to": "corrected part", "why": "Short Korean reason, e.g. '형용사는 명사 뒤에 와요' or '관사가 자연스러워요'. 1 sentence." }
               ],
               "tip": "One short, useful grammar tip in Korean, 1 sentence.",
               "issueType": "If isCorrect is false, classify the main mistake as exactly one of: '어순', '성수일치', '동사변형', '시제', '전치사', '어휘선택', '기타'. If isCorrect is true, use '없음'."
            }
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
                    issueType: { type: "STRING", enum: ["어순", "성수일치", "동사변형", "시제", "전치사", "어휘선택", "기타", "없음"], description: "주된 문법 실수 유형 분류. 정답이면 '없음'" }
                },
                required: ["isCorrect", "verdict", "correctedText", "originalMarked", "message", "breakdown", "tip", "issueType"]
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
                coachMsg.innerHTML = feedback.message;
                
                breakdownGrid.innerHTML = '';
                const seenWordsEs = new Set();
                feedback.breakdown.forEach(item => {
                    const w = (item.word || '').trim();
                    const m = (item.mean || item.meaning || '').trim();
                    if (!w || seenWordsEs.has(w)) return; // 중복/빈 항목 제거
                    seenWordsEs.add(w);
                    breakdownGrid.innerHTML += buildBreakdownRow(w, m);
                });

                coachTip.innerText = feedback.tip;

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

                logAction('ai');
                saveToStorage();
                updateStats();
                resultBox.scrollIntoView({ behavior: 'smooth' });
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
        function wordExistsInVocab(rawWord) {
            const target = normalizeSpanishAnswer(rawWord);
            if (!target) return false;
            // [냐냐 PATCH] 재귀동사 대응: 앞의 재귀대명사(me/te/se/nos/os)를 뗀 형태도 준비
            //   예: "me llamo" → "llamo", "se llama" → "llama"
            const targetNoReflexive = target.replace(/^(me|te|se|nos|os)\s+/, '');
            for (const v of vocabulary) {
                // 1) 원형/사전형 그대로 일치
                if (normalizeSpanishAnswer(v.word) === target) return true;
                // 2) 동사: 등록된 모든 시제/인칭 변형과 대조
                if (v.pos === 'verb') {
                    const tenses = v.conjugationsByTense || (v.conjugations ? { presente: v.conjugations } : {});
                    for (const tk in tenses) {
                        const forms = tenses[tk];
                        if (!forms) continue;
                        for (const pk in forms) {
                            if (!forms[pk]) continue;
                            const formN = normalizeSpanishAnswer(forms[pk]);
                            // 저장된 변형에서도 재귀대명사를 떼고 비교 (양쪽 다 관대하게)
                            const formNoReflexive = formN.replace(/^(me|te|se|nos|os)\s+/, '');
                            if (formN === target || formN === targetNoReflexive
                                || formNoReflexive === target || formNoReflexive === targetNoReflexive) {
                                return true;
                            }
                        }
                    }
                }
                // 3) 형용사: 남성형으로 등록됐어도 여성형/복수형이면 같은 단어로 취급
                if (v.pos === 'adjective') {
                    const base = normalizeSpanishAnswer(v.word);
                    const stem = base.replace(/(o|a|os|as|e|es)$/, '');
                    // 어간이 충분히 길고, 대상이 같은 어간으로 시작하며 형용사 어미로 끝나면 같은 단어
                    if (stem.length >= 2 && target.startsWith(stem) && /^(o|a|os|as|e|es)?$/.test(target.slice(stem.length))) {
                        return true;
                    }
                }
                // 4) 명사: 단수형 등록됐으면 복수형도 같은 단어로 취급 (그 반대도)
                if (v.pos === 'noun') {
                    // 관사 뗀 형태로 비교
                    const stripArt = (s) => s.replace(/^(el|la|los|las|un|una|unos|unas)\s+/, '');
                    const vn = stripArt(normalizeSpanishAnswer(v.word));
                    const tn = stripArt(target);
                    if (vn === tn) return true;
                    // 스페인어 복수 규칙: +s / +es / z→ces
                    const plurals = (s) => {
                        const arr = [s + 's', s + 'es'];
                        if (s.endsWith('z')) arr.push(s.slice(0, -1) + 'ces');
                        return arr;
                    };
                    // 단수→복수 또는 복수→단수 매칭
                    if (plurals(vn).includes(tn) || plurals(tn).includes(vn)) return true;
                }
            }
            return false;
        }

        function buildBreakdownRow(word, mean) {
            const w = (word || '').trim();
            const m = (mean || '').trim();
            if (!w) return '';
            // 단어장에 이미 있는지 확인 (동사 변형·형용사 성수변화까지 고려)
            const exists = wordExistsInVocab(w);
            const wEsc = w.replace(/'/g, "\\'");
            const mEsc = m.replace(/'/g, "\\'");
            const registerBtn = exists
                ? '<span class="breakdown-reg text-[10px] text-emerald-500 font-bold shrink-0">✓ 등록됨</span>'
                : `<button class="breakdown-reg text-[10px] font-bold text-white bg-violet-500 hover:bg-violet-600 px-2 py-0.5 rounded-full shrink-0 transition-all" onclick="registerWordFromBreakdown('${wEsc}', '${mEsc}')">+ 등록</button>`;
            return `
                <div class="flex items-center justify-between gap-2 px-3 py-2 text-sm" data-breakdown-word="${w.replace(/"/g, '&quot;')}">
                    <span class="font-bold text-slate-800 shrink-0">${w}</span>
                    <span class="text-slate-500 text-right flex-1 truncate">${m}</span>
                    ${registerBtn}
                </div>
            `;
        }

        // [냐냐 PATCH] 단어 등록 후 핵심분석의 등록 버튼을 '✓ 등록됨'으로 갱신 (AI item 1)
        function refreshBreakdownRegisterButtons() {
            document.querySelectorAll('[data-breakdown-word]').forEach(row => {
                const w = row.getAttribute('data-breakdown-word');
                if (w && wordExistsInVocab(w)) {
                    const regEl = row.querySelector('.breakdown-reg');
                    if (regEl && regEl.tagName === 'BUTTON') {
                        regEl.outerHTML = '<span class="breakdown-reg text-[10px] text-emerald-500 font-bold shrink-0">✓ 등록됨</span>';
                    }
                }
            });
        }

        // 핵심 분석에서 단어 바로 등록
        function registerWordFromBreakdown(word, mean) {
            // [냐냐 PATCH] 탭을 옮기지 않고 현재 화면(AI 첨삭) 위에 등록 모달만 띄움
            openWordModal();
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
                const response = await callGemini(contextPrompt, "You are a friendly, encouraging Spanish tutor. Talk in natural, warm Korean to the student '냐냐님'. Give clear and accurate grammar answers, concisely.", null, 'low');
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
