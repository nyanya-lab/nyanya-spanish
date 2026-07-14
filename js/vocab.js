// [냐냐 PATCH] 악센트 제거 (á→a, ó→o, ñ→n 등) — 검색 시 악센트 무시용
        function stripAccents(str) {
            return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        }

        // [냐냐 PATCH] 입력창 전체 지우기 (X 버튼)
        function clearInputField(id) {
            const el = document.getElementById(id);
            if (el) { el.value = ''; el.focus(); }
        }

        function togglePosFields() {
            const pos = document.getElementById('input-pos').value;
            const nounDetails = document.getElementById('field-noun-details');
            const verbConjugations = document.getElementById('field-verb-conjugations');
            const adjDetails = document.getElementById('field-adj-details');

            if (pos === 'noun') {
                nounDetails.classList.remove('hidden');
                verbConjugations.classList.add('hidden');
                adjDetails.classList.add('hidden');
            } else if (pos === 'verb') {
                nounDetails.classList.add('hidden');
                verbConjugations.classList.remove('hidden');
                adjDetails.classList.add('hidden');
            } else if (pos === 'adjective') {
                nounDetails.classList.add('hidden');
                verbConjugations.classList.add('hidden');
                adjDetails.classList.remove('hidden');
            } else {
                nounDetails.classList.add('hidden');
                verbConjugations.classList.add('hidden');
                adjDetails.classList.add('hidden');
            }
        }

        function toggleVerbTypeDetails() {
            // [냐냐 PATCH] 규칙/불규칙·불규칙유형은 이제 각 시제 블록마다 있음 (전역 콤보박스 제거) — 호환용 빈 함수
        }

        // [냐냐 PATCH] 동사 시제: 관용구처럼 '시제 블록'을 +/− 로 추가/삭제.
        //   각 블록 = 시제종류 select + 규칙/불규칙 select + 불규칙유형 select + AI추천 + 삭제 + 입력칸(6인칭 또는 현재분사 1칸)
        const CONJ_PERSON_KEYS = ['yo','tu','el','nos','vos','ellos'];
        const CONJ_PERSON_LABELS = ['yo (나)','tú (너)','él/ella','nosotros','vosotros','ellos/ellas'];
        const SINGLE_TENSES = ['gerundio']; // 6인칭이 아니라 1칸만 있는 특수 시제
        // 시제 종류 (틀 — 나중에 자유롭게 추가/수정 가능)
        const TENSE_TYPE_OPTIONS = [
            { key: 'presente', label: '직설법 현재' },
            { key: 'indefinido', label: '직설법 부정과거' },
            { key: 'imperfecto', label: '직설법 불완료과거' },
            { key: 'futuro', label: '직설법 미래' },
            { key: 'condicional', label: '조건법' },
            { key: 'subjPresente', label: '접속법 현재' },
            { key: 'subjImperfecto', label: '접속법 불완료과거' },
            { key: 'imperativo', label: '명령법' },
            { key: 'presProgresivo', label: '현재진행 (estar+gerundio)' },
            { key: 'gerundio', label: '현재분사 (gerundio · 1칸)' },
        ];
        // 불규칙 유형 (틀 — 학습하며 나중에 채우기)
        const IRREGULAR_TYPE_OPTIONS = ['none','1인칭','e ➡️ ie','o ➡️ ue','e ➡️ i','완전 불규칙','1인칭 및 e ➡️ ie','1인칭 및 e ➡️ i','1인칭 및 o ➡️ ue','기타 변형'];

        function isSingleTense(t) { return SINGLE_TENSES.includes(t); }

        // 블록 하나의 입력칸을 시제 종류에 맞게 렌더 (기존 입력값 최대한 보존)
        function renderBlockInputs(block) {
            const tense = block.querySelector('.conj-block-tense').value;
            const box = block.querySelector('.conj-block-inputs');
            const prev = readBlockConj(block);
            if (isSingleTense(tense)) {
                box.innerHTML = `<div class="space-y-1"><span class="text-[10px] font-bold text-slate-400">현재분사 (gerundio)</span><input type="text" data-person="form" placeholder="teniendo" autocomplete="off" class="conj-cell w-full bg-white px-3 py-2 rounded-lg border border-slate-200 text-sm text-center focus:outline-none font-bold text-blue-600"></div>`;
                const el = box.querySelector('[data-person="form"]'); if (el && prev.form) el.value = prev.form;
            } else {
                box.innerHTML = `<div class="grid grid-cols-3 gap-2">` + CONJ_PERSON_KEYS.map((p, i) =>
                    `<div class="space-y-1"><span class="text-[10px] font-bold text-slate-400">${CONJ_PERSON_LABELS[i]}</span><input type="text" data-person="${p}" autocomplete="off" class="conj-cell w-full bg-white px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-center focus:outline-none ${i === 0 ? 'font-bold text-blue-600' : 'font-semibold'}"></div>`
                ).join('') + `</div>`;
                CONJ_PERSON_KEYS.forEach(p => { const el = box.querySelector(`[data-person="${p}"]`); if (el && prev[p]) el.value = prev[p]; });
            }
        }
        function readBlockConj(block) {
            const d = {};
            block.querySelectorAll('.conj-block-inputs .conj-cell').forEach(el => { d[el.dataset.person] = el.value.trim(); });
            return d;
        }
        function fillBlockConj(block, data) {
            data = data || {};
            block.querySelectorAll('.conj-block-inputs .conj-cell').forEach(el => { const k = el.dataset.person; if (data[k]) el.value = data[k]; });
        }

        function addTenseBlock(tenseKey, data, vcVal, irrVal) {
            const box = document.getElementById('conj-tense-blocks');
            if (!box) return;
            if (!tenseKey) { // '+ 시제 추가' 버튼: 아직 안 쓴 시제 중 첫 번째로
                const used = [...box.querySelectorAll('.conj-block-tense')].map(s => s.value);
                tenseKey = TENSE_TYPE_OPTIONS.map(o => o.key).find(k => !used.includes(k)) || 'presente';
                data = {}; vcVal = 'regular'; irrVal = 'none';
            }
            const isRegular = (vcVal !== 'irregular');
            const block = document.createElement('div');
            block.className = 'conj-tense-block bg-white rounded-xl border border-slate-200 p-2.5 space-y-2';
            const tenseOpts = TENSE_TYPE_OPTIONS.map(o => `<option value="${o.key}" ${o.key === tenseKey ? 'selected' : ''}>${o.label}</option>`).join('');
            const irrOpts = IRREGULAR_TYPE_OPTIONS.map(o => `<option value="${o}" ${o === irrVal ? 'selected' : ''}>${o === 'none' ? '- 형태 -' : o}</option>`).join('');
            block.innerHTML = `
                <div class="flex items-center gap-1 flex-wrap">
                    <select class="conj-block-tense flex-1 min-w-[104px] bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-200 text-[11px] font-bold text-indigo-700 focus:outline-none" onchange="onBlockTenseChange(this)">${tenseOpts}</select>
                    <select class="conj-block-class bg-white px-1.5 py-1 rounded-lg border border-slate-200 text-[11px] font-medium focus:outline-none" onchange="onBlockClassChange(this)">
                        <option value="regular" ${isRegular ? 'selected' : ''}>규칙</option>
                        <option value="irregular" ${!isRegular ? 'selected' : ''}>불규칙</option>
                    </select>
                    <select class="conj-block-irr bg-white px-1.5 py-1 rounded-lg border border-slate-200 text-[11px] font-medium focus:outline-none" ${isRegular ? 'disabled' : ''}>${irrOpts}</select>
                    <button type="button" onclick="aiFillBlock(this)" title="이 시제만 AI 추천 (빈칸만 채움)" class="w-7 h-7 shrink-0 rounded-lg bg-violet-500 hover:bg-violet-600 text-white flex items-center justify-center transition-all"><i class="fa-solid fa-wand-magic-sparkles text-[10px]"></i></button>
                    <button type="button" onclick="removeTenseBlock(this)" title="이 시제 삭제" class="w-7 h-7 shrink-0 rounded-lg bg-slate-50 hover:bg-rose-50 hover:text-rose-500 text-slate-400 flex items-center justify-center transition-all"><i class="fa-solid fa-minus text-[10px]"></i></button>
                </div>
                <div class="conj-block-inputs"></div>
            `;
            box.appendChild(block);
            renderBlockInputs(block);
            fillBlockConj(block, data);
        }

        function onBlockTenseChange(sel) { renderBlockInputs(sel.closest('.conj-tense-block')); }
        function onBlockClassChange(sel) {
            const block = sel.closest('.conj-tense-block');
            const irr = block.querySelector('.conj-block-irr');
            if (sel.value === 'irregular') { irr.disabled = false; if (irr.value === 'none') irr.value = '1인칭'; }
            else { irr.disabled = true; irr.value = 'none'; }
        }
        function removeTenseBlock(btn) { const b = btn.closest('.conj-tense-block'); if (b) b.remove(); }

        // 모든 블록에서 시제별 변형 수집 (같은 시제 중복 시 마지막 블록 우선)
        function collectConjByTense() {
            const result = {};
            document.querySelectorAll('#conj-tense-blocks .conj-tense-block').forEach(block => {
                const tense = block.querySelector('.conj-block-tense').value;
                const d = readBlockConj(block);
                if (isSingleTense(tense)) { if ((d.form || '').trim()) result[tense] = { form: d.form.trim() }; }
                else if (CONJ_PERSON_KEYS.some(p => (d[p] || '').trim())) result[tense] = d;
            });
            return result;
        }
        // 시제별 규칙/불규칙 + 불규칙유형 수집
        function collectVerbInfoByTense() {
            const irregularByTense = {}, verbClassByTense = {};
            document.querySelectorAll('#conj-tense-blocks .conj-tense-block').forEach(block => {
                const tense = block.querySelector('.conj-block-tense').value;
                const cls = block.querySelector('.conj-block-class').value;
                const it = block.querySelector('.conj-block-irr').value;
                verbClassByTense[tense] = cls;
                if (cls === 'irregular' && it && it !== 'none') irregularByTense[tense] = it;
            });
            return { irregularByTense, verbClassByTense };
        }

        // 단어의 저장된 시제들로 블록을 다시 그림 (현재시제는 항상 하나 보장)
        function initConjBlocks(word) {
            const box = document.getElementById('conj-tense-blocks');
            if (!box) return;
            box.innerHTML = '';
            const byTense = (word && word.conjugationsByTense && Object.keys(word.conjugationsByTense).length) ? word.conjugationsByTense : (word && word.conjugations ? { presente: word.conjugations } : {});
            const irrByTense = (word && word.irregularByTense) || {};
            const vcByTense = (word && word.verbClassByTense) || {};
            let tenses = TENSE_TYPE_OPTIONS.map(o => o.key).filter(k => byTense[k]);
            if (!tenses.includes('presente')) tenses.unshift('presente'); // 현재시제 블록은 항상 하나
            tenses.forEach(t => {
                const vc = vcByTense[t] || ((t === 'presente' && word && word.verbClass) ? word.verbClass : (irrByTense[t] ? 'irregular' : 'regular'));
                const irr = irrByTense[t] || ((t === 'presente' && word && word.irregularType) ? word.irregularType : 'none');
                addTenseBlock(t, byTense[t] || {}, vc, irr);
            });
        }

        // AI로 현재 블록 시제만 추천 (빈칸만 채움, 기존 입력 보존)
        async function aiFillBlock(btn) {
            const block = btn.closest('.conj-tense-block');
            const wordInput = document.getElementById('input-word');
            const infinitive = (wordInput ? wordInput.value : '').trim().replace(/^(el|la|los|las)\s+/, '');
            if (!infinitive) { showToast("먼저 동사 원형을 입력해 주세요!", "error"); return; }
            if (!(typeof hasGeminiApiKey === 'function' && hasGeminiApiKey())) { openApiKeyModal(); return; }
            const tenseSel = block.querySelector('.conj-block-tense');
            const tense = tenseSel.value;
            const label = tenseSel.selectedOptions[0].text;
            const orig = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin text-[10px]"></i>';
            try {
                if (isSingleTense(tense)) {
                    const schema = { type: "OBJECT", properties: { form: { type: "STRING" } }, required: ["form"] };
                    const resp = await callGemini(`Give the gerundio (현재분사, present participle) of the Spanish verb "${infinitive}". JSON: {"form":"..."} with correct accents.`, `Return ONLY JSON.`, schema, 'minimal');
                    const data = extractAndParseJson(resp);
                    const el = block.querySelector('[data-person="form"]'); if (el && !el.value.trim()) el.value = (data.form || '').trim();
                } else {
                    const schema = { type: "OBJECT", properties: { yo: { type: "STRING" }, tu: { type: "STRING" }, el: { type: "STRING" }, nos: { type: "STRING" }, vos: { type: "STRING" }, ellos: { type: "STRING" } }, required: ["yo", "tu", "el", "nos", "vos", "ellos"] };
                    const resp = await callGemini(`Conjugate the Spanish verb "${infinitive}" in this tense: ${label} (internal key: ${tense}), all 6 persons. For 현재진행(presProgresivo) give full "estar + gerundio" forms (e.g. "estoy comiendo"). Return JSON: {"yo","tu","el","nos","vos","ellos"} with correct accents.`, `Return ONLY JSON.`, schema, 'minimal');
                    const data = extractAndParseJson(resp);
                    CONJ_PERSON_KEYS.forEach(p => { const el = block.querySelector(`[data-person="${p}"]`); if (el && !el.value.trim()) el.value = (data[p] || '').trim(); });
                }
                showToast(`${label} 추천 완료! (빈칸만 채웠어요)`, "success");
            } catch (e) {
                console.error(e);
                showToast((typeof describeGeminiError === 'function') ? describeGeminiError(e) : "AI 추천 실패", "error");
            } finally { btn.disabled = false; btn.innerHTML = orig; }
        }

        // [냐냐 PATCH] AI 추천 완료 여부 (완료 후 아무 칸에서 엔터 = 저장)
        let aiAutofillCompleted = false;
        let _skipContinueRegisterPrompt = false; // [냐냐 PATCH] 첨삭에서 등록 시 '계속 등록?' 팝업 스킵

        // [냐냐 PATCH] 단어 모달 드래그 이동 + 위치 기억
        let modalDragPos = null; // {left, top} — '계속 등록' 연속 창은 이 위치 유지, 직접 열면 null(중앙)
        let _modalDrag = null;
        function startModalDrag(e) {
            // 닫기 버튼 등은 드래그 시작 제외
            if (e.target.closest('button')) return;
            const inner = document.getElementById('word-modal-inner');
            if (!inner) return;
            const rect = inner.getBoundingClientRect();
            // 드래그 시작 시 flex 중앙정렬 해제하고 절대좌표로 고정
            applyModalPosition(rect.left, rect.top);
            _modalDrag = { startX: e.clientX, startY: e.clientY, origLeft: rect.left, origTop: rect.top };
            document.addEventListener('mousemove', onModalDrag);
            document.addEventListener('mouseup', endModalDrag);
            e.preventDefault();
        }
        function onModalDrag(e) {
            if (!_modalDrag) return;
            let newLeft = _modalDrag.origLeft + (e.clientX - _modalDrag.startX);
            let newTop = _modalDrag.origTop + (e.clientY - _modalDrag.startY);
            // 화면 밖으로 완전히 나가지 않게 살짝 제한
            const inner = document.getElementById('word-modal-inner');
            const w = inner.offsetWidth, h = 60; // 헤더 정도는 항상 보이게
            newLeft = Math.max(-w + 100, Math.min(newLeft, window.innerWidth - 100));
            newTop = Math.max(0, Math.min(newTop, window.innerHeight - h));
            applyModalPosition(newLeft, newTop);
        }
        function endModalDrag() {
            if (_modalDrag) {
                const inner = document.getElementById('word-modal-inner');
                const rect = inner.getBoundingClientRect();
                modalDragPos = { left: rect.left, top: rect.top }; // 위치 기억
            }
            _modalDrag = null;
            document.removeEventListener('mousemove', onModalDrag);
            document.removeEventListener('mouseup', endModalDrag);
        }
        function applyModalPosition(left, top) {
            const modal = document.getElementById('word-modal');
            const inner = document.getElementById('word-modal-inner');
            if (!modal || !inner) return;
            // flex 중앙정렬 해제 → 절대좌표 배치
            modal.classList.remove('items-center', 'justify-center');
            inner.style.position = 'fixed';
            inner.style.left = left + 'px';
            inner.style.top = top + 'px';
            inner.style.margin = '0';
        }
        function resetModalPosition() {
            // 중앙 정렬로 복귀 (직접 '새 단어 등록'/'수정' 버튼으로 열 때)
            const modal = document.getElementById('word-modal');
            const inner = document.getElementById('word-modal-inner');
            if (!modal || !inner) return;
            modal.classList.add('items-center', 'justify-center');
            inner.style.position = '';
            inner.style.left = '';
            inner.style.top = '';
            inner.style.margin = '';
            modalDragPos = null;
        }

        function openWordModal(wordId = null) {
            document.getElementById('word-modal').classList.remove('hidden');
            document.getElementById('word-suggestions').classList.add('hidden');
            aiAutofillCompleted = false; // 모달 열 때 초기화
            _skipContinueRegisterPrompt = false; // [냐냐 PATCH] 기본은 계속등록 팝업 표시 (첨삭 등록만 스킵)
            resetModalPosition(); // [냐냐 PATCH] 직접 열면 항상 중앙에서 시작
            
            if (wordId) {
                const w = vocabulary.find(item => item.id === wordId);
                if (!w) return;
                aiAutofillCompleted = true; // [냐냐 PATCH] 수정 모드는 이미 내용이 있으니 바로 엔터 저장 가능
                
                document.getElementById('modal-title').innerHTML = `✏️ 단어 수정하기: <span class="text-indigo-600 font-extrabold">${w.word}</span>`;
                document.getElementById('modal-word-id').value = w.id;
                document.getElementById('input-word').value = w.word;
                document.getElementById('input-meaning').value = w.meaning;
                document.getElementById('input-pos').value = w.pos || 'noun';
                
                document.getElementById('input-gender').value = w.gender || 'none';
                document.getElementById('input-adj-agreement').value = w.adjAgreement || 'full';

                // [냐냐 PATCH] 시제 블록으로 로드 (규칙/불규칙·불규칙유형도 시제별)
                initConjBlocks(w);

                document.getElementById('input-example').value = w.example || '';
                document.getElementById('input-example-meaning').value = w.exampleMeaning || '';

                // [냐냐 PATCH] 관용구 여러 개 지원 — 예전 단일 idiom/idiomMeaning 데이터도 자동 변환
                clearIdiomRows();
                const idiomList = (w.idioms && w.idioms.length > 0) ? w.idioms : (w.idiom ? [{ idiom: w.idiom, idiomMeaning: w.idiomMeaning || '' }] : []);
                const idiomBox = document.getElementById('idiom-fields-box');
                const idiomIcon = document.getElementById('idiom-toggle-icon');
                if (idiomList.length > 0) {
                    idiomList.forEach(item => addIdiomRow(item.idiom, item.idiomMeaning));
                    if (idiomBox) idiomBox.classList.remove('hidden');
                    if (idiomIcon) idiomIcon.className = "fa-solid fa-minus text-xs";
                } else {
                    if (idiomBox) idiomBox.classList.add('hidden');
                    if (idiomIcon) idiomIcon.className = "fa-solid fa-plus text-xs";
                }
                document.getElementById('input-notes').value = w.notes || '';
            } else {
                document.getElementById('modal-title').innerHTML = `✨ 새로운 단어 등록`;
                document.getElementById('modal-word-id').value = '';
                document.getElementById('input-word').value = '';
                document.getElementById('input-meaning').value = '';
                document.getElementById('input-pos').value = 'noun';
                document.getElementById('input-gender').value = 'none';
                document.getElementById('input-adj-agreement').value = 'full';

                clearConjugationFields();
                
                document.getElementById('input-example').value = '';
                document.getElementById('input-example-meaning').value = '';
                clearIdiomRows();
                const idiomBoxNew = document.getElementById('idiom-fields-box');
                const idiomIconNew = document.getElementById('idiom-toggle-icon');
                if (idiomBoxNew) idiomBoxNew.classList.add('hidden');
                if (idiomIconNew) idiomIconNew.className = "fa-solid fa-plus text-xs";
                document.getElementById('input-notes').value = '· ';
            }
            togglePosFields();
            toggleNotesClearBtn();
            // [냐냐 PATCH] 새 단어 등록이면 단어 입력칸에 바로 커서 (즉시 타이핑 가능)
            if (!wordId) {
                setTimeout(() => { const wi = document.getElementById('input-word'); if (wi) wi.focus(); }, 50);
            }
        }

        // [냐냐 PATCH] 노트 작성 시 엔터를 누르면 자동으로 '· ' 글머리 기호 추가 (지우는 건 자유)
        // [냐냐 PATCH] 문법표 설명/팁에서 엔터 = 자동 · 기호 (단어장 노트처럼)
        // [냐냐 PATCH] 설명/팁 입력 시작할 때 비어있으면 기본 기호(· ) 넣기
        function grammarNoteFocusDefault(event, stateKey) {
            const ta = event.target;
            if ((ta.value || '').trim() === '') {
                ta.value = '· ';
                ta.selectionStart = ta.selectionEnd = ta.value.length;
                if (grammarEditorState && stateKey) grammarEditorState[stateKey] = ta.value;
            }
        }

        function handleGrammarNoteEnter(event, stateKey) {
            if (event.key !== 'Enter' || event.shiftKey) return;
            event.preventDefault();
            const textarea = event.target;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const value = textarea.value;
            const insertion = '\n· ';
            textarea.value = value.slice(0, start) + insertion + value.slice(end);
            const newPos = start + insertion.length;
            textarea.selectionStart = textarea.selectionEnd = newPos;
            if (grammarEditorState && stateKey) grammarEditorState[stateKey] = textarea.value;
        }

        function handleNotesEnterKey(event) {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            const textarea = event.target;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const value = textarea.value;
            const insertion = '\n· ';
            textarea.value = value.slice(0, start) + insertion + value.slice(end);
            const newPos = start + insertion.length;
            textarea.selectionStart = textarea.selectionEnd = newPos;
            toggleNotesClearBtn();
        }

        // [냐냐 PATCH] 노트 전체 지우기 X 버튼
        function clearNotes() {
            const ta = document.getElementById('input-notes');
            if (!ta) return;
            ta.value = '';
            toggleNotesClearBtn();
            ta.focus();
        }
        function toggleNotesClearBtn() {
            const ta = document.getElementById('input-notes');
            const btn = document.getElementById('notes-clear-btn');
            if (!ta || !btn) return;
            btn.classList.toggle('hidden', !ta.value.trim());
        }

        // [냐냐 PATCH] 관용구 입력칸 펼치기/접기
        function toggleIdiomSection() {
            const box = document.getElementById('idiom-fields-box');
            const icon = document.getElementById('idiom-toggle-icon');
            if (!box || !icon) return;
            const isHidden = box.classList.contains('hidden');
            box.classList.toggle('hidden');
            icon.className = isHidden ? "fa-solid fa-minus text-xs" : "fa-solid fa-plus text-xs";
            // 처음 펼칠 때 입력칸이 하나도 없으면 자동으로 1개 추가
            const entriesBox = document.getElementById('idiom-entries-box');
            if (isHidden && entriesBox && entriesBox.children.length === 0) {
                addIdiomRow();
            }
        }

        // [냐냐 PATCH] 관용구를 여러 개 등록할 수 있도록 행(row) 추가/삭제
        let idiomRowCounter = 0;
        function addIdiomRow(idiomText = '', meaningText = '') {
            const entriesBox = document.getElementById('idiom-entries-box');
            if (!entriesBox) { console.warn('idiom-entries-box 엘리먼트를 찾을 수 없음 — index.html이 최신 버전이 아닐 수 있어요'); return; }
            const rowId = 'idiom-row-' + (idiomRowCounter++);
            const row = document.createElement('div');
            row.id = rowId;
            row.className = 'flex gap-2 items-start';
            row.innerHTML = `
                <input type="text" data-idiom-field="idiom" placeholder="예: ¿Qué tiempo hace?" autocomplete="off" value="${idiomText.replace(/"/g, '&quot;')}" class="flex-1 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <input type="text" data-idiom-field="meaning" placeholder="예: 날씨가 어때요?" autocomplete="off" value="${meaningText.replace(/"/g, '&quot;')}" class="flex-1 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <button type="button" onclick="document.getElementById('${rowId}').remove()" class="w-9 h-9 shrink-0 rounded-xl bg-slate-50 hover:bg-rose-50 hover:text-rose-500 text-slate-400 flex items-center justify-center transition-all"><i class="fa-solid fa-xmark text-xs"></i></button>
            `;
            entriesBox.appendChild(row);
        }

        function clearIdiomRows() {
            const box = document.getElementById('idiom-entries-box');
            if (box) box.innerHTML = '';
        }

        function getIdiomRowsData() {
            const rows = document.querySelectorAll('#idiom-entries-box > div');
            const result = [];
            rows.forEach(row => {
                const idiomInput = row.querySelector('[data-idiom-field="idiom"]');
                const meaningInput = row.querySelector('[data-idiom-field="meaning"]');
                const idiomVal = idiomInput ? idiomInput.value.trim() : '';
                if (idiomVal) {
                    result.push({ idiom: idiomVal, idiomMeaning: meaningInput ? meaningInput.value.trim() : '' });
                }
            });
            return result;
        }

        function clearConjugationFields() {
            // [냐냐 PATCH] 시제 블록 초기화 — 빈 현재시제 블록 하나만 남김
            const box = document.getElementById('conj-tense-blocks');
            if (box) { box.innerHTML = ''; addTenseBlock('presente', {}, 'regular', 'none'); }
        }

        function closeWordModal() {
            document.getElementById('word-modal').classList.add('hidden');
            hideAiLoadingOverlay();
        }

        function showConfirm(title, desc, onOk, options = {}) {
            const modal = document.getElementById('confirm-modal');
            document.getElementById('confirm-modal-title').innerText = title;
            document.getElementById('confirm-modal-desc').innerText = desc;
            modal.classList.remove('hidden');

            // [냐냐 PATCH] 아이콘 커스터마이즈 (기본: 빨간 경고, 'happy'면 보라 스마일)
            const iconBox = document.getElementById('confirm-modal-icon-box');
            const iconEl = document.getElementById('confirm-modal-icon');
            if (iconBox && iconEl) {
                if (options.icon === 'happy') {
                    iconBox.className = "w-16 h-16 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center text-3xl mx-auto";
                    iconEl.className = "fa-solid fa-face-smile";
                } else if (options.icon === 'info') {
                    iconBox.className = "w-16 h-16 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center text-3xl mx-auto";
                    iconEl.className = "fa-solid fa-circle-info";
                } else {
                    iconBox.className = "w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-3xl mx-auto";
                    iconEl.className = "fa-solid fa-triangle-exclamation";
                }
            }

            const btnOk = document.getElementById('confirm-ok-btn');
            const btnCancel = document.getElementById('confirm-cancel-btn');

            // [냐냐 PATCH] 버튼 라벨/색상 커스터마이즈 (기본: 삭제 확정 - 빨강)
            btnOk.innerText = options.okLabel || '삭제 확정';
            btnCancel.innerText = options.cancelLabel || '취소';
            if (options.okStyle === 'primary') {
                btnOk.className = "flex-1 py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-sm transition-all active:scale-95 shadow-md shadow-violet-100";
            } else {
                btnOk.className = "flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-all active:scale-95 shadow-md shadow-red-100";
            }

            const cleanup = () => {
                modal.classList.add('hidden');
                btnOk.onclick = null;
                btnCancel.onclick = null;
            };

            btnOk.onclick = () => {
                onOk();
                cleanup();
            };
            btnCancel.onclick = () => {
                if (options.onCancel) options.onCancel();
                cleanup();
            };
            // [냐냐 PATCH] 엔터로 확인 버튼 실행 (연속 등록 편하게)
            setTimeout(() => { try { btnOk.focus(); } catch(e){} }, 50);
            const keyHandler = (e) => {
                if (modal.classList.contains('hidden')) { document.removeEventListener('keydown', keyHandler); return; }
                if (e.key === 'Enter') { e.preventDefault(); btnOk.click(); document.removeEventListener('keydown', keyHandler); }
                else if (e.key === 'Escape') { e.preventDefault(); btnCancel.click(); document.removeEventListener('keydown', keyHandler); }
            };
            document.addEventListener('keydown', keyHandler);
        }

        // PREMIUM LIVE AI AUTOFILL (Improved with actual Gemini intelligence for phrase & tip generation)
        async function triggerAiAutofill() {
            const rawWord = document.getElementById('input-word').value.trim();
            if (!rawWord) {
                showToast("단어 입력창에 스페인어 단어를 먼저 적어주세요!", "error");
                return;
            }

            // [PATCH] API 키가 없으면 굳이 실패할 호출을 시도하지 않고 바로 안내
            if (!hasGeminiApiKey()) {
                showToast("Gemini API 키가 없어서 AI 추천 대신 오프라인 추측을 사용합니다. 우측 상단 배지에서 키를 등록하면 진짜 AI 추천을 받을 수 있어요!", "warning");
                runOfflineAutofill(rawWord);
                return;
            }

            const btn = document.getElementById('ai-autofill-btn');
            const originalHtml = btn.innerHTML;
            
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> 분석 중...`;
            showAiLoadingOverlay();

            // [PATCH-속도개선] 프롬프트를 간결하게 줄여서 모델이 더 빠르게 응답하도록 함
            const prompt = `스페인어 단어 "${rawWord}"를 분석해서 JSON 스키마에 맞게 채워주세요.
            - 동사면 1인칭/e➡️ie/o➡️ue/e➡️i/완전불규칙 중 정확히 분류하고 현재시제 변형 전부 채울 것.
            - 어간모음 변화와 1인칭 불규칙이 함께 있으면 '1인칭 및 e ➡️ ie', '1인칭 및 e ➡️ i', '1인칭 및 o ➡️ ue'로 분류할 것. 예: tener(tengo, tienes...) = '1인칭 및 e ➡️ ie', decir(digo, dices, dice, decimos, decís, dicen) = '1인칭 및 e ➡️ i', venir(vengo, vienes...) = '1인칭 및 e ➡️ ie'.
            - 명사면 gender(성별)와 isPlural(복수형 여부)을 정확히 판단할 것. 입력 단어 자체가 이미 복수형이면(casas, libros 등) isPlural=true.
            - estudiante, artista, cantante처럼 남녀 형태가 같고 관사만 바뀌는 사람 명사는 isCommonGender=true, gender='none'으로 (앱이 el/la로 표시함).
            - 여성명사인데 강세 있는 a-/ha-로 시작해서 단수에서 el을 쓰는 단어(agua, águila, alma, hambre, aula 등)는 usesElDespiteFeminine=true로 표시.
            - example은 실제로 쓰일 법한 자연스러운 스페인어 문장 1개, exampleMeaning은 그 정확한 한국어 번역.
            - correctedSpelling: 입력 단어에 명백한 철자 오류가 있으면 올바른 철자만 여기에, 오타가 없으면 빈 문자열로 둘 것.
            - adjMasculineBase: 형용사인데 입력이 여성형/복수형이면 사전 표제형인 남성 단수형을 여기에(관사 없이). 이미 남성 단수형이거나 성별로 안 변하는 형용사(feliz, azul 등)면 빈 문자열. 오타 교정(correctedSpelling)과는 별개로, 형태만 여성→남성으로 바꾸는 용도임.
            - idioms에는 (1) 진짜 흔한 관용구/숙어뿐 아니라 (2) 이 단어의 "핵심 문형/구문 패턴"도 넣을 것.
              구문 패턴 예시:
                · 특정 전치사와 자주 쓰이면: idiom "enfadado con [사람]", idiomMeaning "~에게 화가 난" 처럼 패턴+뜻으로.
                · gustar류 동사(gustar, encantar, importar 등)면 문형을 보여줄 것: idiom "[간접목적대명사] encanta [주어]", idiomMeaning "[주어]가 (나는) 너무 좋다" 처럼.
              대괄호 [ ]로 자리(주어/사람/사물 등)를 표시. 진짜 유용한 것만 0~3개, 없으면 빈 배열 []. 억지로 만들지 말 것.
            - notes는 "정말 알아두면 도움되는 특이사항"이 있을 때만 작성. 없으면 빈 문자열 ""로 둘 것 (억지로 채우지 말 것).
              쓸 만한 내용 예: 흔한 혼동 단어와의 차이, 불규칙한 부분, ser/estar 구분, 문화적/구어적 뉘앙스, 예외적 용법.
              절대 쓰지 말 것: "사람의 성품/상태/감정을 나타내는 형용사", "~를 뜻하는 명사", "일상에서 자주 쓰는 동사" 같이 뻔한 분류 설명. 형용사의 성·수 변화 여부(성변화 없음, 수변화 없음 등)도 이미 별도 항목이라 절대 쓰지 말 것. 남녀 공통 명사/성 구분 없는 명사라는 설명도 관사(el/la)로 이미 표시되므로 쓰지 말 것. 특정 전치사와 함께 쓰인다는 내용은 notes가 아니라 idioms(구문 패턴)에 넣을 것. 뻔한 말만 나올 거면 빈 문자열로 둘 것.
              형식: "· "로 시작하는 불릿, 최대 2줄, 각 줄 25자 이내, 줄바꿈은 \\n 하나. 인사말/이름 호칭 금지. "~함/~됨/~임" 서술형 대신 명사형으로 끝낼 것.`;

            const system = "You are a precise Spanish dictionary engine. Output must strictly follow the given JSON schema, in Korean where applicable. No greetings, no markdown fences, no conversational filler — just the structured facts.";
            
            const schema = {
                type: "OBJECT",
                properties: {
                    meaning: { type: "STRING", description: "핵심 한글 뜻" },
                    correctedSpelling: { type: "STRING", description: "입력된 스페인어 단어에 명백한 철자 오류가 있으면 올바른 철자를 여기에 (관사 없이 단어만). 오타가 없으면 빈 문자열. 예: 입력이 'hblar'면 'hablar', 입력이 'comer'면 빈 문자열" },
                    pos: { type: "STRING", enum: ["noun", "verb", "adjective", "adverb", "preposition", "conjunction", "pronoun", "phrase"] },
                    gender: { type: "STRING", enum: ["none", "masculine", "feminine"] },
                    isCommonGender: { type: "BOOLEAN", description: "사람을 가리키는 명사인데 형태가 남녀 공통이라 관사만 바뀌는 경우 true (el/la estudiante, el/la artista, el/la cantante). 이 경우 gender는 'none'으로. 성별이 고정된 명사(libro=남, casa=여)는 false" },
                    isPlural: { type: "BOOLEAN", description: "명사가 복수형이면 true, 단수형이면 false. 명사가 아니면 false. 예: casas/libros는 true, casa/libro는 false" },
                    usesElDespiteFeminine: { type: "BOOLEAN", description: "여성명사이지만 강세 있는 a-/ha-로 시작해서 단수에서 정관사 el을 쓰는 경우 true (예: agua, águila, alma, hambre, aula → el agua, el águila). 그 외에는 false. 남성명사이거나 복수형이면 false" },
                    adjAgreement: { type: "STRING", enum: ["full", "no-gender", "no-number", "invariable"], description: "형용사일 때만 사용. full=성·수 둘 다 변화(bueno/buena/buenos/buenas). no-gender=성별로는 안 변하고 수(단/복수)만 변화 — 보통 -e, -ista, -l, -z 로 끝남(tolerante→tolerantes, feliz→felices, fácil→fáciles, optimista→optimistas). no-number=수로는 안 변하고 성만 변화(매우 드묾). invariable=완전 불변. ⚠️주의: 남성형/여성형이 똑같으면(성별로 안 변하면) no-gender임. tolerante는 남녀 동일하고 tolerantes로 복수화되므로 반드시 no-gender. 형용사가 아니면 'full'" },
                    adjMasculineBase: { type: "STRING", description: "형용사이고 입력이 여성형(또는 복수형)이면, 사전 표제형인 '남성 단수형'을 여기에 (관사 없이). 예: 입력이 'buena'/'buenas'/'buenos'면 'bueno', 'roja'면 'rojo'. 이미 남성 단수형이거나(bueno) 성별로 안 변하는 형용사(feliz, azul, tolerante)이거나 형용사가 아니면 빈 문자열." },
                    verbClass: { type: "STRING", enum: ["regular", "irregular"] },
                    irregularType: { type: "STRING", enum: ["1인칭", "e ➡️ ie", "o ➡️ ue", "e ➡️ i", "완전 불규칙", "1인칭 및 e ➡️ ie", "1인칭 및 e ➡️ i", "1인칭 및 o ➡️ ue", "기타 변형"] },
                    conjugations: {
                        type: "OBJECT",
                        description: "현재시제 6인칭 변형. 반드시 표준 스페인(카스티야) 스페인어 기준으로 작성할 것 — 'vos' 키는 아르헨티나식 단수 'vos'가 아니라 스페인의 2인칭 복수 'vosotros'를 의미함 (예: tener→vos:'tenéis', llevar→vos:'lleváis'). 절대 -ás/-és 같은 아르헨티나식 voseo 어미를 쓰지 말 것.",
                        properties: {
                            yo: { type: "STRING", description: "yo (1인칭 단수)" },
                            tu: { type: "STRING", description: "tú (2인칭 단수)" },
                            el: { type: "STRING", description: "él/ella (3인칭 단수)" },
                            nos: { type: "STRING", description: "nosotros (1인칭 복수)" },
                            vos: { type: "STRING", description: "vosotros — 스페인식 2인칭 복수 '너희'. 아르헨티나 voseo 아님. -áis/-éis/-ís 어미 사용" },
                            ellos: { type: "STRING", description: "ellos/ellas (3인칭 복수)" }
                        }
                    },
                    example: { type: "STRING", description: "자연스러운 스페인어 예문 1개" },
                    idioms: {
                        type: "ARRAY",
                        description: "이 단어의 관용구/숙어 + 핵심 문형·구문 패턴. (1)흔한 관용구, (2)전치사 콜로케이션(예: idiom 'enfadado con [사람]', mean '~에게 화가 난'), (3)gustar류 문형(예: idiom '[간접목적대명사] encanta [주어]', mean '[주어]가 너무 좋다'). 대괄호로 자리 표시. 유용한 것만 0~3개, 없으면 []. 억지로 만들지 말 것",
                        items: {
                            type: "OBJECT",
                            properties: {
                                idiom: { type: "STRING", description: "관용구/숙어 또는 구문 패턴 (스페인어). 자리는 [주어]/[사람]/[사물] 같이 대괄호로. 예: ¿Qué tiempo hace?, enfadado con [사람]" },
                                idiomMeaning: { type: "STRING", description: "관용구/패턴의 한국어 뜻" }
                            },
                            required: ["idiom", "idiomMeaning"]
                        }
                    },
                    exampleMeaning: { type: "STRING", description: "예문의 정확한 한국어 번역" },
                    notes: { type: "STRING", description: "정말 도움되는 특이사항(혼동 단어 차이, 불규칙, ser/estar 구분, 뉘앙스, 예외 용법)만 · 불릿 2줄 이내로. 없으면 빈 문자열. 금지: 뻔한 품사/뜻 분류('사람의 성품 묘사' 등), 형용사 성·수 변화 여부, 성별/관사, 전치사 콜로케이션(이건 idioms로). 명사형으로 끝낼 것" }
                },
                required: ["meaning", "pos", "gender", "verbClass", "example", "exampleMeaning", "notes"]
            };

            try {
                // 실시간 API 호출 시도 (thinkingLevel: minimal → 단순 사전 조회라 깊은 추론 불필요, 가장 빠름)
                const responseText = await callGemini(prompt, system, schema, 'minimal', GEMINI_MODEL_FLASH_LITE);
                // 대화형 응답이나 블록 헤더가 섞여 있어도 완벽하게 추출하여 분석
                const result = extractAndParseJson(responseText);

                // [냐냐 PATCH] 오타 감지: AI가 교정한 철자가 입력과 다르면 확인 팝업
                const corrected = (result.correctedSpelling || '').trim();
                const bareInput = rawWord.replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, '').trim().toLowerCase();
                const isRealCorrection = corrected && corrected.toLowerCase() !== bareInput && corrected.toLowerCase() !== rawWord.toLowerCase();

                // [냐냐 PATCH] 형용사 여성형/복수형 → 남성 단수 기본형 건의 (오타와 별개)
                const mascBase = (result.adjMasculineBase || '').trim();
                const isFeminineAdj = !isRealCorrection && result.pos === 'adjective' && mascBase
                    && mascBase.toLowerCase() !== bareInput && mascBase.toLowerCase() !== rawWord.toLowerCase();

                if (isRealCorrection) {
                    showConfirm(
                        `혹시 "${corrected}"를 쓰려던 거였나요?`,
                        `입력하신 "${rawWord}"에 오타가 있는 것 같아요. "${corrected}"(으)로 고쳐서 등록할까요? (취소를 누르면 입력한 그대로 둡니다)`,
                        () => {
                            // 수정: 교정된 철자로 단어칸 교체 후 적용
                            document.getElementById('input-word').value = corrected;
                            applyAutofillResult(result, true);
                            saveAiWordCache(corrected, result);
                            AudioFX.playSuccess();
                            showToast(`"${corrected}"(으)로 고쳐서 적용했어요 ✨`, "success");
                        },
                        {
                            okLabel: '수정',
                            cancelLabel: '취소',
                            okStyle: 'primary',
                            onCancel: () => {
                                // 취소: 입력한 철자 그대로 정보만 적용
                                applyAutofillResult(result, true);
                                saveAiWordCache(rawWord, result);
                                showToast("입력한 철자 그대로 정보를 적용했어요", "info");
                            }
                        }
                    );
                } else if (isFeminineAdj) {
                    showConfirm(
                        `혹시 여성형인가요? 남성형 "${mascBase}"로 바꿀까요?`,
                        `형용사는 보통 사전형인 남성 단수형으로 등록해요. 입력하신 "${rawWord}"는 여성형/복수형 같아서, 남성형 "${mascBase}"(으)로 바꿔서 등록할지 여쭤봐요. (그대로를 누르면 입력한 형태로 둡니다)`,
                        () => {
                            document.getElementById('input-word').value = mascBase;
                            applyAutofillResult(result, true);
                            saveAiWordCache(mascBase, result);
                            AudioFX.playSuccess();
                            showToast(`남성형 "${mascBase}"(으)로 바꿔서 적용했어요 ✨`, "success");
                        },
                        {
                            okLabel: '남성형으로',
                            cancelLabel: '그대로',
                            okStyle: 'primary',
                            onCancel: () => {
                                applyAutofillResult(result, true);
                                saveAiWordCache(rawWord, result);
                                AudioFX.playSuccess();
                                showToast("입력하신 형태 그대로 적용했어요 ✨", "info");
                            }
                        }
                    );
                } else {
                    applyAutofillResult(result, true); // AI 추천 클릭 시 강제 덮어쓰기 허용 (true)
                    saveAiWordCache(rawWord, result); // [PATCH-속도개선] 다음 조회를 위해 캐시 저장
                    AudioFX.playSuccess();
                    showToast("Gemini AI 분석 완료! 추천 정보를 적용했어요 ✨", "success");
                }
            } catch (e) {
                console.warn("AI API 통신 실패: 오프라인 추측으로 자동 전환", e);
                showToast(`${describeGeminiError(e)} 오프라인 추측으로 대체합니다.`, "error");
                runOfflineAutofill(rawWord);
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
                hideAiLoadingOverlay();
                aiAutofillCompleted = true; // [냐냐 PATCH] AI 추천 완료 → 이제 엔터로 저장 가능
            }
        }

        // [PATCH-속도개선] 로딩 스켈레톤 + 경과시간 표시 (순수 UI 효과라 실제 응답 속도에는 영향 없음)
        let aiLoadingTimerHandle = null;
        function showAiLoadingOverlay() {
            const overlay = document.getElementById('ai-loading-overlay');
            const timerText = document.getElementById('ai-loading-timer-text');
            overlay.classList.remove('hidden');
            const startedAt = Date.now();
            clearInterval(aiLoadingTimerHandle);
            aiLoadingTimerHandle = setInterval(() => {
                const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
                timerText.innerText = `보통 3~5초 정도 걸려요 (${elapsed}초)`;
            }, 100);
        }
        function hideAiLoadingOverlay() {
            clearInterval(aiLoadingTimerHandle);
            document.getElementById('ai-loading-overlay').classList.add('hidden');
        }

        // 결과값 UI 대입 처리부 (사용자가 입력 중인 값은 보존)
        // [냐냐 PATCH] 강세 있는 a-/ha- 로 시작하는 단어인지 판별 (el agua 규칙용)
        // á/há 로 시작하면 확실히 강세. a/ha 로 시작하면 스페인어 강세 규칙상 첫 음절에 강세가 오는
        // 흔한 경우(자음+모음으로 끝나거나 s로 끝나는 단어)를 근사적으로 판단. 확실치 않은 애매한 경우는
        // 흔히 el을 쓰는 단어들을 화이트리스트로 보정.
        const EL_FEMININE_WORDS = new Set([
            'agua','águila','alma','ala','área','arma','aula','hacha','hada','hambre','habla',
            'ancla','ánfora','asa','aya','haba','ave','acta','ascua','asta'
        ]);
        function isStressedInitialA(word) {
            if (!word) return false;
            const w = word.trim().toLowerCase();
            // á 또는 há 로 시작 → 무조건 강세
            if (/^h?á/.test(w)) return true;
            // 화이트리스트(흔히 el을 쓰는 강세 a- 여성명사)
            const bare = w.replace(/^h/, '');
            if (EL_FEMININE_WORDS.has(w) || EL_FEMININE_WORDS.has(word.trim().toLowerCase())) return true;
            return false;
        }

        function applyAutofillResult(result, forceOverwrite = false) {
            const wordVal = document.getElementById('input-word').value.trim();
            
            const meaningInput = document.getElementById('input-meaning');
            // 사용자가 이미 뭔가를 적었다면, 강제 덮어쓰기 모드(추천 클릭)가 아닐 경우 지우지 않고 유지
            if (forceOverwrite || !meaningInput.value.trim()) {
                meaningInput.value = result.meaning || '';
            }

            const posInput = document.getElementById('input-pos');
            if (forceOverwrite || posInput.value === 'noun') {
                posInput.value = result.pos || 'noun';
            }
            togglePosFields();

            if (result.pos === 'noun') {
                const genderInput = document.getElementById('input-gender');
                // 남녀 공통 명사(estudiante 등)는 성별 없음으로 저장
                const effectiveGender = result.isCommonGender ? 'none' : (result.gender || 'none');
                if (forceOverwrite || genderInput.value === 'none') {
                    genderInput.value = effectiveGender;
                }
                // [냐냐 PATCH] 명사에 정관사 자동으로 붙이기 (복수형이면 los/las, 남녀공통이면 el/la, 이미 관사가 있으면 그대로 둠)
                const wordInput = document.getElementById('input-word');
                const curWord = wordInput.value.trim();
                const alreadyHasArticle = /^(el|la|los|las|un|una|unos|unas|el\/la|los\/las)\s+/i.test(curWord);
                if (curWord && !alreadyHasArticle) {
                    let article = '';
                    if (result.isCommonGender) {
                        // 남녀 공통 명사: el/la 로 표시 (복수면 los/las)
                        article = result.isPlural ? 'los/las' : 'el/la';
                    } else if (result.gender === 'masculine') {
                        article = result.isPlural ? 'los' : 'el';
                    } else if (result.gender === 'feminine') {
                        // 강세 있는 a-/ha- 로 시작하는 여성 단수 명사는 발음 때문에 el을 씀 (el agua, el águila, el alma).
                        // 단, 복수는 다시 las로 돌아감 (las aguas). 형용사는 계속 여성으로 받으므로 gender는 feminine 유지.
                        // AI 판단(usesElDespiteFeminine)을 우선 쓰되, 없으면 로컬 규칙으로 보정.
                        const takesEl = (result.usesElDespiteFeminine === true) || isStressedInitialA(curWord);
                        if (result.isPlural) article = 'las';
                        else article = takesEl ? 'el' : 'la';
                    }
                    if (article) wordInput.value = `${article} ${curWord}`;
                }
            } else if (result.pos === 'adjective') {
                const adjAgreementInput = document.getElementById('input-adj-agreement');
                if (forceOverwrite || adjAgreementInput.value === 'full') {
                    adjAgreementInput.value = result.adjAgreement || 'full';
                }
            } else if (result.pos === 'verb') {
                // [냐냐 PATCH] AI 자동완성은 현재시제 블록을 채움 (없으면 만들고, 빈칸만 채움)
                const box = document.getElementById('conj-tense-blocks');
                let presenteBlock = box ? [...box.querySelectorAll('.conj-tense-block')].find(b => b.querySelector('.conj-block-tense').value === 'presente') : null;
                if (!presenteBlock && box) {
                    addTenseBlock('presente', {}, result.verbClass || 'regular', result.irregularType || 'none');
                    presenteBlock = [...box.querySelectorAll('.conj-tense-block')].find(b => b.querySelector('.conj-block-tense').value === 'presente');
                }
                if (presenteBlock) {
                    // 규칙/불규칙 + 유형: 비어(규칙)있을 때만 또는 강제일 때만 반영
                    const clsSel = presenteBlock.querySelector('.conj-block-class');
                    const irrSel = presenteBlock.querySelector('.conj-block-irr');
                    if (forceOverwrite || clsSel.value === 'regular') {
                        clsSel.value = result.verbClass || 'regular';
                        onBlockClassChange(clsSel);
                        if (result.verbClass === 'irregular' && (forceOverwrite || irrSel.value === 'none')) irrSel.value = result.irregularType || '1인칭';
                    }
                    if (result.conjugations) {
                        CONJ_PERSON_KEYS.forEach(key => {
                            const cell = presenteBlock.querySelector(`[data-person="${key}"]`);
                            if (cell && (forceOverwrite || !cell.value.trim())) cell.value = result.conjugations[key] || '';
                        });
                    }
                }
            }

            const exampleInput = document.getElementById('input-example');
            // 기본 형태의 유치한 예문인 경우에만 좋은 예문으로 자동 교체
            if (forceOverwrite || !exampleInput.value.trim() || exampleInput.value.startsWith('Quiero ') || exampleInput.value.startsWith('Me gusta ')) {
                exampleInput.value = result.example || '';
            }

            const exampleMeaningInput = document.getElementById('input-example-meaning');
            if (forceOverwrite || !exampleMeaningInput.value.trim()) {
                exampleMeaningInput.value = result.exampleMeaning || '';
            }

            // [냐냐 PATCH] AI가 관용구를 찾아줬으면(여러 개 가능) 자동으로 채우고 섹션을 펼침
            if (result.idioms && result.idioms.length > 0) {
                clearIdiomRows();
                result.idioms.forEach(item => addIdiomRow(item.idiom, item.idiomMeaning));
                const idiomBoxAi = document.getElementById('idiom-fields-box');
                const idiomIconAi = document.getElementById('idiom-toggle-icon');
                if (idiomBoxAi) idiomBoxAi.classList.remove('hidden');
                if (idiomIconAi) idiomIconAi.className = "fa-solid fa-minus text-xs";
            }

            const notesInput = document.getElementById('input-notes');
            if (forceOverwrite || !notesInput.value.trim() || notesInput.value.includes('확인 필요') || notesInput.value.includes('직접 입력 필요')) {
                notesInput.value = result.notes || '';
            }
            toggleNotesClearBtn();
        }

        // 지능형 오프라인 단어 완성 데이터베이스 엔진 (완벽 백업 및 Fallback UI 고도화)
        function runOfflineAutofill(rawWord) {
            const cleanWord = rawWord.toLowerCase().trim().replace(/^(el\s+|la\s+|los\s+|las\s+)/, "");
            
            // 1차: 완전히 일치하는 DB 매핑이 있는지 확인
            let match = OFFLINE_DICT_DB[rawWord.toLowerCase().trim()] || OFFLINE_DICT_DB[cleanWord];
            
            // 2차: 규칙 기반 스마트 유추 가동
            if (!match) {
                // 동사형 규칙성 판별 (-ar, -er, -ir, 그리고 강세가 있는 -ír도 포함: oír, reír 등)
                if (cleanWord.endsWith("ar") || cleanWord.endsWith("er") || cleanWord.endsWith("ir") || cleanWord.endsWith("ír")) {
                    const ending = cleanWord.slice(-2);
                    const stem = cleanWord.slice(0, -2);
                    let conj = {};
                    
                    if (ending === "ar") {
                        conj = { yo: stem+"o", tu: stem+"as", el: stem+"a", nos: stem+"amos", vos: stem+"áis", ellos: stem+"an" };
                    } else if (ending === "er") {
                        conj = { yo: stem+"o", tu: stem+"es", el: stem+"e", nos: stem+"emos", vos: stem+"éis", ellos: stem+"en" };
                    } else { // -ir 또는 -ír
                        conj = { yo: stem+"o", tu: stem+"es", el: stem+"e", nos: stem+"imos", vos: stem+"ís", ellos: stem+"en" };
                    }
                    
                    match = {
                        meaning: "", 
                        pos: "verb",
                        verbClass: "regular",
                        irregularType: "none",
                        conjugations: conj,
                        example: `Quiero ${rawWord} hoy.`,
                        exampleMeaning: `나는 오늘 ${rawWord}하고 싶어.`, 
                        notes: "· 어미 규칙으로 현재시제 자동 계산\n· 뜻과 예문은 직접 입력 필요"
                    };
                } else if (["con", "para", "por", "de", "en", "sin"].includes(cleanWord)) {
                    match = {
                        meaning: "",
                        pos: "preposition",
                        example: `Voy a ir ${rawWord} mi amigo.`,
                        exampleMeaning: `나는 내 친구${rawWord} 같이 갈 거야.`,
                        notes: "· 자주 쓰이는 전치사\n· 뒤에 오는 명사와의 결합에 주의"
                    };
                } else if (["y", "o", "pero", "porque", "como", "que"].includes(cleanWord)) {
                    match = {
                        meaning: "",
                        pos: "conjunction",
                        example: `No voy ${rawWord} no quiero.`,
                        exampleMeaning: `나는 가고 싶지 않기 ${rawWord} 안 가.`,
                        notes: "· 문장을 이어주는 접속사"
                    };
                } else {
                    // 명사형 남/여성 기본 유추 및 관사 일치 처리 (Me gusta pelo 해소)
                    const isFeminine = cleanWord.endsWith("a") || cleanWord.endsWith("ción") || cleanWord.endsWith("dad");
                    const article = isFeminine ? "la" : "el";
                    match = {
                        meaning: "", 
                        pos: "noun",
                        gender: isFeminine ? "feminine" : "masculine",
                        example: `Me gusta ${article} ${cleanWord}.`,
                        exampleMeaning: `나는 그 ${isFeminine ? '여성명사' : '남성명사'}(${cleanWord})를 좋아해.`, 
                        notes: "· 어미로 품사·성별 추정 (확인 필요)\n· 뜻은 직접 입력 필요"
                    };
                }
            }

            // UI에 적용 (AI 추천의 fallback이므로 덮어쓰기 허용)
            applyAutofillResult(match, true);
            AudioFX.playSuccess();
            aiAutofillCompleted = true; // [냐냐 PATCH] 오프라인 추천 완료 → 엔터로 저장 가능

            // DB에 있던 명확한 단어인지, 아니면 동적 규칙 유추인지에 따른 깔끔한 피드백 제공
            if (OFFLINE_DICT_DB[rawWord.toLowerCase().trim()] || OFFLINE_DICT_DB[cleanWord]) {
                showToast(`지능형 오프라인 사전에서 "${rawWord}" 정보를 완벽하게 찾아 적용했습니다! ⚡`, "success");
            } else {
                showToast(`품사/성별 규칙이 자동 세팅되었습니다! 뜻과 예문 번역을 완성해 주세요! 💡`, "warning");
            }
        }

        // REAL-TIME SMART AUTOFILL ENGINE (실시간 어순 분석)
        function handleWordInput(value) {
            const suggestionsContainer = document.getElementById('word-suggestions');
            
            if (!value.trim()) {
                suggestionsContainer.classList.add('hidden');
                return;
            }

            // [PATCH] 어차피 'AI 추천' 버튼으로 정확하게 채우므로, 타이핑만으로 추측해서
            // 자동으로 채우던 기능은 제거함. 아래는 자동완성 후보 목록만 보여줌.
            showSuggestions(value.trim());
        }

        function showSuggestions(query) {
            const container = document.getElementById('word-suggestions');
            const cleanQuery = stripAccents(query.toLowerCase().trim()); // [냐냐 PATCH] 악센트 무시
            const results = [];
            const seenKeys = new Set();

            // [PATCH-16] 오프라인 사전뿐 아니라 내가 이미 등록한 단어장 전체에서도 검색
            vocabulary.forEach(item => {
                if (stripAccents(item.word.toLowerCase()).includes(cleanQuery)) {
                    seenKeys.add(item.word.toLowerCase());
                    results.push({ key: item.word, meaning: item.meaning, pos: item.pos, gender: item.gender, registeredId: item.id });
                }
            });
            Object.keys(OFFLINE_DICT_DB).forEach(key => {
                if (stripAccents(key.toLowerCase()).includes(cleanQuery) && !seenKeys.has(key.toLowerCase())) {
                    const item = OFFLINE_DICT_DB[key];
                    results.push({ key: key, meaning: item.meaning, pos: item.pos, gender: item.gender, registeredId: null });
                }
            });

            if (results.length === 0) {
                container.classList.add('hidden');
                return;
            }

            // [냐냐 PATCH] 정렬 우선순위: ①정확히 일치 → ②그 단어로 시작 → ③포함, 각 그룹 안에서는 ABC순
            const stripArt = (w) => stripAccents((w || '').toLowerCase().trim().replace(/^(el\/la|los\/las|el|la|los|las|un|una|unos|unas)\s+/, '').trim());
            const q = cleanQuery;
            const rank = (w) => {
                const s = stripArt(w);
                if (s === q) return 0;            // 정확히 일치 → 맨 위
                if (s.startsWith(q)) return 1;    // 입력으로 시작
                return 2;                          // 그냥 포함
            };
            results.sort((a, b) => {
                const ra = rank(a.key), rb = rank(b.key);
                if (ra !== rb) return ra - rb;
                return stripArt(a.key).localeCompare(stripArt(b.key), 'es', { sensitivity: 'base' });
            });

            container.classList.remove('hidden');
            let html = '';
            results.slice(0, 15).forEach(r => {
                const safeKey = r.key.replace(/'/g, "\\'");
                html += `
                    <div onclick="selectSuggestion('${safeKey}', ${r.registeredId ? `'${r.registeredId}'` : 'null'})" class="px-4 py-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs transition-colors gap-2">
                        <div class="flex flex-col min-w-0">
                            <span class="font-bold text-slate-800 truncate">${r.key}</span>
                            <span class="text-slate-400 text-[10px] truncate">${r.meaning}</span>
                        </div>
                        <span class="flex items-center gap-1 shrink-0">
                            ${r.registeredId ? '<span class="text-[9px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold">등록됨</span>' : ''}
                            <span class="text-[9px] bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full font-bold uppercase">${getPosAbbreviation(r.pos, r.gender)}</span>
                        </span>
                    </div>
                `;
            });
            container.innerHTML = html;
        }

        function selectSuggestion(word, registeredId) {
            document.getElementById('word-suggestions').classList.add('hidden');

            if (registeredId) {
                // 이미 등록된 단어 → 중복 등록 대신 수정 모드로 열기
                openWordModal(registeredId);
                showToast("이미 등록된 단어예요! 수정 모드로 열었어요 ✏️", "info");
                return;
            }

            document.getElementById('input-word').value = word;
            const match = OFFLINE_DICT_DB[word];
            if (match) {
                applyAutofillResult(match, true); // 리스트 클릭 시 확실한 선택이므로 덮어쓰기 허용 (true)
                showToast("오프라인 사전에 매칭되어 적용했어요! ⚡", "success");
                AudioFX.playSuccess();
            }
        }

        // Save Word Action
        function saveWord() {
            const wordVal = document.getElementById('input-word').value.trim();
            const meaningVal = document.getElementById('input-meaning').value.trim();
            
            if (!wordVal || !meaningVal) {
                showToast("단어 이름과 뜻은 필수입니다!", "error");
                return;
            }

            const modalId = document.getElementById('modal-word-id').value;

            // [냐냐 PATCH] 새 단어 등록 시 같은 철자 + 같은 품사면 중복 확인창 표시 (품사가 다르면 다른 단어로 취급)
            if (!modalId) {
                const posVal = document.getElementById('input-pos').value;
                const dup = vocabulary.find(item =>
                    item.word.toLowerCase().trim() === wordVal.toLowerCase() && item.pos === posVal
                );
                if (dup) {
                    showConfirm(
                        `"${dup.word}(${dup.meaning})" 단어가 이미 같은 품사로 등록되어 있습니다.`,
                        "그래도 중복으로 등록할까요? '등록취소'를 누르면 등록창이 그대로 열려있어요.",
                        () => performSaveWord(),
                        {
                            okLabel: '중복등록',
                            cancelLabel: '등록취소',
                            okStyle: 'primary'
                            // 취소 시 아무 동작 없음 → 확인창만 닫히고 단어 등록창은 그대로 유지됨
                        }
                    );
                    return;
                }
            }

            performSaveWord();
        }

        // [냐냐 PATCH] 단어 등록/수정 모달: AI 추천 완료 후 아무 칸에서 엔터 = 저장 (Shift+엔터는 줄바꿈)
        function handleWordModalKey(event) {
            if (event.key !== 'Enter' || event.shiftKey) return;
            if (!aiAutofillCompleted) return; // AI 추천 전에는 저장 안 함 (단어칸 엔터는 자체 핸들러가 추천 실행)
            const el = event.target;
            // 단어 입력칸은 자체 onkeydown이 처리하므로 건너뜀
            if (el && el.id === 'input-word') return;
            // input/textarea/select에서만 반응
            const tag = (el && el.tagName) ? el.tagName.toLowerCase() : '';
            if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') return;
            event.preventDefault();
            saveWord();
        }

        function performSaveWord() {
            const wordVal = document.getElementById('input-word').value.trim();
            const meaningVal = document.getElementById('input-meaning').value.trim();
            const modalId = document.getElementById('modal-word-id').value;
            const pos = document.getElementById('input-pos').value;

            // [냐냐 PATCH] 새 등록은 항상 고유한 새 id를 부여 (중복 등록 시 원본과 id가 겹쳐
            // 한쪽을 지우면 다른 쪽도 지워지던 문제 방지). 수정 모드일 때만 기존 id 유지.
            const newId = 'word-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

            let wordObj = {
                id: modalId || newId,
                word: wordVal,
                meaning: meaningVal,
                pos: pos,
                example: document.getElementById('input-example').value.trim(),
                exampleMeaning: document.getElementById('input-example-meaning').value.trim(),
                idioms: getIdiomRowsData(),
                notes: document.getElementById('input-notes').value.replace(/\s+$/, ''), // [냐냐 PATCH] 맨 앞 들여쓰기 공백은 보존, 끝쪽 공백만 정리
                mastered: false
            };

            if (pos === 'noun') {
                wordObj.gender = document.getElementById('input-gender').value;
            } else if (pos === 'adjective') {
                wordObj.adjAgreement = document.getElementById('input-adj-agreement').value;
            } else if (pos === 'verb') {
                // [냐냐 PATCH] 시제 블록에서 수집 (시제별 규칙/불규칙·유형 포함)
                const info = collectVerbInfoByTense();
                const byTense = collectConjByTense();
                wordObj.conjugationsByTense = byTense;
                wordObj.irregularByTense = info.irregularByTense;
                wordObj.verbClassByTense = info.verbClassByTense;
                // 구버전 호환 (현재시제 기준)
                wordObj.verbClass = info.verbClassByTense.presente || (Object.keys(info.irregularByTense).length ? 'irregular' : 'regular');
                wordObj.irregularType = info.irregularByTense.presente || 'none';
                wordObj.conjugations = byTense.presente || {};
            }

            if (modalId) {
                const index = vocabulary.findIndex(item => item.id === modalId);
                if (index !== -1) {
                    wordObj.mastered = vocabulary[index].mastered || false; // 수정 시 마스터 상태 보존 (기존엔 초기화되던 버그)
                    // [냐냐 PATCH] 수정한 단어를 맨 앞으로 (최근순에서 바로 보이게)
                    vocabulary.splice(index, 1);
                    vocabulary.unshift(wordObj);
                    showToast("단어가 깔끔하게 수정되었습니다! ✏️", "success");
                }
                logAction('snapshot');
            } else {
                vocabulary.unshift(wordObj);
                showToast("새 단어가 등록되었습니다! 📚", "success");
                logAction('new-word'); // [냐냐 PATCH] 오늘 새로 등록한 단어 수 추적
            }

            renderWordList();
            updateStats();
            if (typeof refreshBreakdownRegisterButtons === 'function') refreshBreakdownRegisterButtons();

            // [냐냐 PATCH] 새 단어 등록이면 계속 등록할지 물어봄 (수정이면 그냥 닫기)
            if (!modalId) {
                // [냐냐 PATCH] 첨삭에서 등록한 경우엔 '계속 등록?' 팝업 없이 바로 닫기
                if (_skipContinueRegisterPrompt) {
                    _skipContinueRegisterPrompt = false;
                    showToast("단어를 등록했어요! 📚", "success");
                    closeWordModal();
                } else {
                    showConfirm(
                        "단어를 등록했어요! 📚",
                        "계속해서 다른 단어를 등록하시겠어요?",
                        () => { prepareNextWordEntry(); }, // 예 → 폼 비우고 바로 다음 단어 입력
                        {
                            okLabel: '계속 등록',
                            cancelLabel: '아니요',
                            okStyle: 'primary',
                            icon: 'happy', // [냐냐 PATCH] 경고 아이콘 대신 스마일
                            onCancel: () => { closeWordModal(); } // 아니요 → 등록창 닫기
                        }
                    );
                }
            } else {
                // [냐냐 PATCH] 수정 저장은 팝업 없이 바로 닫기 (토스트만)
                showToast("수정했어요! ✏️", "success");
                closeWordModal();
            }
        }

        // [냐냐 PATCH] 다음 단어를 바로 입력할 수 있게 폼 초기화 + 커서 이동
        function prepareNextWordEntry() {
            document.getElementById('modal-word-id').value = '';
            document.getElementById('input-word').value = '';
            document.getElementById('input-meaning').value = '';
            document.getElementById('input-pos').value = 'noun';
            document.getElementById('input-gender').value = 'none';
            document.getElementById('input-adj-agreement').value = 'full';
            clearConjugationFields();
            document.getElementById('input-example').value = '';
            document.getElementById('input-example-meaning').value = '';
            clearIdiomRows();
            const ib = document.getElementById('idiom-fields-box');
            const ii = document.getElementById('idiom-toggle-icon');
            if (ib) ib.classList.add('hidden');
            if (ii) ii.className = "fa-solid fa-plus text-xs";
            document.getElementById('input-notes').value = '· ';
            document.getElementById('word-suggestions').classList.add('hidden');
            aiAutofillCompleted = false; // [냐냐 PATCH] 다음 단어는 다시 AI 추천 후 저장
            togglePosFields();
            toggleNotesClearBtn();
            setTimeout(() => { const wi = document.getElementById('input-word'); if (wi) wi.focus(); }, 50);
        }

        function deleteWord(wordId, event) {
            if (event) event.stopPropagation();
            const w = vocabulary.find(item => item.id === wordId);
            if (!w) return;

            showConfirm(
                `"${w.word}" 단어를 삭제할까요?`,
                "삭제한 데이터는 다시 꺼낼 수 없습니다.",
                () => {
                    const wasMastered = w.mastered; // [냐냐 PATCH] 삭제 전 마스터 여부
                    vocabulary = vocabulary.filter(item => item.id !== wordId);
                    // [냐냐 PATCH] 일지/그래프 감소 — 등록/마스터 카운트 취소
                    if (typeof logAction === 'function') {
                        if (wasMastered) logAction('undo-new-mastered');
                        logAction('undo-new-word');
                    }
                    renderWordList();
                    updateStats();
                    showToast("단어를 삭제했습니다. 🗑️", "success");
                    AudioFX.playError();
                }
            );
        }

        // [냐냐 PATCH] 약점 단어(별표) 수동 토글
        function toggleWeakWord(wordId, event) {
            if (event) event.stopPropagation();
            const w = vocabulary.find(item => item.id === wordId);
            if (w) {
                // [냐냐 PATCH-0배치] 3단계 순환: 해제 → 약점(-3) → 치명적 약점(-8) → 해제(0)
                const grade = getWordGrade(w);
                // (주관식 통과 이력은 건드리지 않음 — 나중에 점수가 다시 오르면 마스터 복귀 가능)
                if (grade === 'critical') {
                    setWordScore(w, 0);
                    showToast(`"${w.word}" 약점 표시를 해제했어요`, "info");
                } else if (grade === 'weak') {
                    setWordScore(w, SCORE_CRITICAL);
                    showToast(`"${w.word}" 치명적 약점으로 표시했어요 🟥`, "success");
                } else {
                    setWordScore(w, SCORE_WEAK);
                    showToast(`"${w.word}" 약점 단어로 표시했어요 🟨`, "success");
                }
                logAction('snapshot');
                renderWordList();
                saveToStorage();
            }
        }

        function toggleMasterWord(wordId, event) {
            if (event) event.stopPropagation();
            const w = vocabulary.find(item => item.id === wordId);
            if (w) {
                // [냐냐 PATCH-0배치] 수동 마스터 = 만점(+10, 완벽) / 해제 = 0점
                if (!w.mastered) {
                    setWordScore(w, SCORE_PERFECT, { subjectivePassed: true }); // [0배치] 수동 마스터 = 8점(완벽)
                    AudioFX.playBell();
                    showToast(`"${w.word}" 단어 마스터 완료! 🏆 (완벽 8점)`, "success");
                } else {
                    setWordScore(w, 0);
                    showToast(`"${w.word}" 마스터를 해제했어요`, "info");
                }
                renderWordList();
                updateStats();
                saveToStorage();
            }
        }

        // 현재시제 변형의 셀에서 불규칙 인칭만 파란색 글씨로 동적으로 골라내는 헬퍼
        function getConjugationCellMarkup(person, val, verbClass, irregularType) {
            if (!val) return `<div class="bg-white p-1 rounded-md border border-slate-100"><span class="text-slate-400 block">${person}</span><strong class="text-slate-800">-</strong></div>`;
            
            let isIrregular = false;
            if (verbClass === 'irregular') {
                const irr = irregularType || '';
                if (irr.includes('1인칭') && person === 'yo') {
                    isIrregular = true;
                }
                if (irr.includes('e ➡️ ie') && ['yo', 'tú', 'él', 'ellos'].includes(person)) {
                    isIrregular = true;
                }
                if (irr.includes('o ➡️ ue') && ['yo', 'tú', 'él', 'ellos'].includes(person)) {
                    isIrregular = true;
                }
                if (irr.includes('e ➡️ i') && ['yo', 'tú', 'él', 'ellos'].includes(person)) {
                    isIrregular = true;
                }
                if (irr.includes('완전 불규칙')) {
                    isIrregular = true;
                }
            }

            const colorClass = isIrregular ? 'text-blue-600 font-black' : 'text-slate-700 font-semibold';
            return `
                <div class="bg-white p-1 rounded-md border border-slate-100">
                    <span class="text-slate-400 block">${person}</span>
                    <strong class="${colorClass}">${val}</strong>
                </div>
            `;
        }

        // Render Vocabulary Tab List
        // [냐냐 PATCH] 필터/정렬 패널 펼치기/접기
        // [냐냐 PATCH] 필터 패널: 품사 중복선택 + 마스터/정렬 단일선택, 확인 눌러야 적용
        const ALL_POS_LIST = ['noun','verb','adjective','adverb','preposition','conjunction','pronoun','interrogative','phrase'];
        const POS_LABELS = { noun:'명사', verb:'동사', adjective:'형용사', adverb:'부사', preposition:'전치사', conjunction:'접속사', pronoun:'대명사', interrogative:'의문사', phrase:'구문' };
        const MASTERY_LABELS = { all:'전체', mastered:'마스터만', 'not-mastered':'미마스터' };
        const WEAK_LABELS = { all:'', weak:'약점만', 'not-weak':'약점제외' };
        // [냐냐 PATCH-0배치] 정렬 3종 × 방향 2가지
        //   등록순: recent(최근 먼저, 기본) ↔ oldest(오래된 먼저)
        //   점수순: weak-score(낮은 점수 먼저, 기본) ↔ score-desc(높은 점수 먼저)
        //   A→Z  : alpha-asc(a 먼저, 기본) ↔ alpha-desc(z 먼저)
        const SORT_LABELS = { recent:'최근 등록순 ↓', oldest:'오래된 등록순 ↑', 'weak-score':'점수 낮은순 ↓', 'score-desc':'점수 높은순 ↑', 'alpha-asc':'A→Z ↓', 'alpha-desc':'Z→A ↑' };
        const SORT_KEY_OF = { recent:'reg', oldest:'reg', 'weak-score':'score', 'score-desc':'score', 'alpha-asc':'alpha', 'alpha-desc':'alpha' };
        const SORT_DEFAULT_OF = { reg:'recent', score:'weak-score', alpha:'alpha-asc' };  // 처음 누를 때의 기본 방향
        const SORT_FLIP_OF = { recent:'oldest', oldest:'recent', 'weak-score':'score-desc', 'score-desc':'weak-score', 'alpha-asc':'alpha-desc', 'alpha-desc':'alpha-asc' };
        const SORT_BTN_LABEL = { recent:'등록순 ↓', oldest:'등록순 ↑', 'weak-score':'점수순 ↓', 'score-desc':'점수순 ↑', 'alpha-asc':'A→Z', 'alpha-desc':'Z→A' };

        // 적용된 필터 상태 (localStorage에서 복원, 없으면 기본값)
        let activeFilterPos = [];          // 빈 배열 = 전체
        let activeFilterMastery = 'not-mastered';
        let activeFilterWeak = 'all';
        let activeFilterSort = 'weak-score';
        // 패널에서 선택 중인 임시 상태
        let pendingFilterPos = [];
        let pendingFilterMastery = 'not-mastered';
        let pendingFilterWeak = 'all';
        let pendingFilterSort = 'weak-score';

        // [냐냐 PATCH] 필터/정렬 저장·복원 (localStorage)
        function saveFilterPrefs() {
            try {
                localStorage.setItem('nyanya_word_filters', JSON.stringify({
                    pos: activeFilterPos, mastery: activeFilterMastery, weak: activeFilterWeak, sort: activeFilterSort
                }));
            } catch (e) {}
        }
        function loadFilterPrefs() {
            try {
                const raw = localStorage.getItem('nyanya_word_filters');
                if (!raw) return; // 첫 방문 = 기본값 유지
                const f = JSON.parse(raw);
                if (Array.isArray(f.pos)) activeFilterPos = f.pos;
                if (f.mastery) activeFilterMastery = f.mastery;
                if (f.weak) activeFilterWeak = f.weak;
                if (f.sort) activeFilterSort = f.sort;
                // 숨은 select도 동기화
                const ms = document.getElementById('mastery-filter-select'); if (ms) ms.value = activeFilterMastery;
                const ws = document.getElementById('weak-filter-select'); if (ws) ws.value = activeFilterWeak;
                const ss = document.getElementById('sort-select'); if (ss) ss.value = activeFilterSort;
            } catch (e) {}
        }

        function toggleFilterPos(btn) {
            const pos = btn.dataset.pos;
            const i = pendingFilterPos.indexOf(pos);
            if (i >= 0) pendingFilterPos.splice(i, 1);
            else pendingFilterPos.push(pos);
            styleFilterPill(btn, i < 0);
            updatePosAllBtnLabel();
        }
        // [냐냐 PATCH] 품사 전체 선택/해제 토글
        function toggleAllFilterPos() {
            const allOn = pendingFilterPos.length >= ALL_POS_LIST.length;
            pendingFilterPos = allOn ? [] : [...ALL_POS_LIST];
            document.querySelectorAll('.filter-pos-btn').forEach(b => styleFilterPill(b, pendingFilterPos.includes(b.dataset.pos)));
            updatePosAllBtnLabel();
        }
        function updatePosAllBtnLabel() {
            const btn = document.getElementById('filter-pos-all-btn');
            if (btn) btn.innerText = (pendingFilterPos.length >= ALL_POS_LIST.length) ? '전체 해제' : '전체 선택';
        }
        function setFilterMastery(btn) {
            pendingFilterMastery = btn.dataset.mastery;
            document.querySelectorAll('.filter-mastery-btn').forEach(b => styleFilterPill(b, b === btn));
        }
        function setFilterWeak(btn) {
            pendingFilterWeak = btn.dataset.weak;
            document.querySelectorAll('.filter-weak-btn').forEach(b => styleFilterPill(b, b === btn));
        }
        function setFilterSort(btn) {
            const key = btn.dataset.sortkey;
            // 이미 선택된 기준을 또 누르면 → 오름/내림 전환. 아니면 그 기준의 기본 방향으로.
            if (SORT_KEY_OF[pendingFilterSort] === key) {
                pendingFilterSort = SORT_FLIP_OF[pendingFilterSort];
            } else {
                pendingFilterSort = SORT_DEFAULT_OF[key];
            }
            renderSortButtons();
        }
        // 정렬 버튼 3개의 라벨(↓↑)과 활성 상태를 다시 그림
        function renderSortButtons() {
            const activeKey = SORT_KEY_OF[pendingFilterSort];
            document.querySelectorAll('.filter-sort-btn').forEach(b => {
                const key = b.dataset.sortkey;
                const on = (key === activeKey);
                b.innerText = on
                    ? SORT_BTN_LABEL[pendingFilterSort]
                    : (key === 'reg' ? '등록순' : (key === 'score' ? '점수순' : 'A→Z'));
                styleFilterPill(b, on);
            });
        }
        function styleFilterPill(btn, on) {
            if (on) {
                btn.className = btn.className.replace(/border-slate-200 bg-slate-50 text-slate-500/, 'border-violet-500 bg-violet-50 text-violet-600');
            } else {
                btn.className = btn.className.replace(/border-violet-500 bg-violet-50 text-violet-600/, 'border-slate-200 bg-slate-50 text-slate-500');
            }
        }

        // 패널 열 때 현재 '적용된' 값으로 임시상태 초기화 (최근 선택값 유지)
        function syncFilterPanelUI() {
            pendingFilterPos = activeFilterPos.length === 0 ? [...ALL_POS_LIST] : [...activeFilterPos];
            pendingFilterMastery = activeFilterMastery;
            pendingFilterWeak = activeFilterWeak;
            pendingFilterSort = activeFilterSort;
            document.querySelectorAll('.filter-pos-btn').forEach(b => styleFilterPill(b, pendingFilterPos.includes(b.dataset.pos)));
            document.querySelectorAll('.filter-mastery-btn').forEach(b => styleFilterPill(b, b.dataset.mastery === pendingFilterMastery));
            document.querySelectorAll('.filter-weak-btn').forEach(b => styleFilterPill(b, b.dataset.weak === pendingFilterWeak));
            renderSortButtons(); // [0배치] 정렬 버튼 3종 (방향 화살표 포함)
            updatePosAllBtnLabel();
        }

        function applyFilters() {
            activeFilterPos = (pendingFilterPos.length === 0 || pendingFilterPos.length === ALL_POS_LIST.length) ? [] : [...pendingFilterPos];
            activeFilterMastery = pendingFilterMastery;
            activeFilterWeak = pendingFilterWeak;
            activeFilterSort = pendingFilterSort;
            const masterySel = document.getElementById('mastery-filter-select');
            const weakSel = document.getElementById('weak-filter-select');
            const sortSel = document.getElementById('sort-select');
            if (masterySel) masterySel.value = activeFilterMastery;
            if (weakSel) weakSel.value = activeFilterWeak;
            if (sortSel) sortSel.value = activeFilterSort;
            todayWrongFilterActive = false;
            saveFilterPrefs();
            closeFilterPanel();
            renderWordList();
        }
        function resetFilters() {
            pendingFilterPos = [...ALL_POS_LIST];
            pendingFilterMastery = 'not-mastered';
            pendingFilterWeak = 'all';
            pendingFilterSort = 'weak-score';
            // [냐냐 PATCH] 활성 필터도 기본값으로 적용하고, 목록도 갱신 (단 패널은 열어둬서 확인 가능)
            activeFilterPos = [];
            activeFilterMastery = 'not-mastered';
            activeFilterWeak = 'all';
            activeFilterSort = 'weak-score';
            syncFilterPanelUI();
            saveFilterPrefs();
            renderWordList();
        }

        // [냐냐 PATCH] 현재 필터/정렬 한 줄 요약
        function renderFilterSummary() {
            const box = document.getElementById('filter-summary');
            if (!box) return;
            const chips = [];
            // 품사
            if (activeFilterPos.length > 0 && activeFilterPos.length < ALL_POS_LIST.length) {
                chips.push(activeFilterPos.map(p => POS_LABELS[p] || p).join('·'));
            }
            // 마스터 상태 (기본 미마스터가 아닐 때만 표시... 은 아니고 항상 상태 보여주되 '전체'는 생략)
            if (activeFilterMastery !== 'all') chips.push(MASTERY_LABELS[activeFilterMastery]);
            // 약점 (전체가 아니면)
            if (activeFilterWeak !== 'all') chips.push(WEAK_LABELS[activeFilterWeak]);
            // 정렬은 항상 표시
            const sortLabel = SORT_LABELS[activeFilterSort] || activeFilterSort;

            const filterPart = chips.length > 0
                ? chips.map(c => `<span class="bg-violet-50 text-violet-600 font-bold px-2 py-0.5 rounded-full">${c}</span>`).join('')
                : `<span class="text-slate-400">전체 단어</span>`;
            box.innerHTML = `<i class="fa-solid fa-filter text-[9px]"></i>${filterPart}<span class="text-slate-300">·</span><span class="text-slate-500">${sortLabel}</span>`;
        }
        function closeFilterPanel() {
            document.getElementById('filter-panel').classList.add('hidden');
        }

        function toggleFilterPanel() {
            const panel = document.getElementById('filter-panel');
            const willOpen = panel.classList.contains('hidden');
            panel.classList.toggle('hidden');
            if (willOpen) syncFilterPanelUI();
        }

        function handleSearchInput() {
            const val = document.getElementById('search-bar').value;
            document.getElementById('search-clear-btn').classList.toggle('hidden', !val);
            if (val.trim()) todayWrongFilterActive = false;
            renderWordList();
        }

        function clearSearch() {
            const bar = document.getElementById('search-bar');
            bar.value = '';
            document.getElementById('search-clear-btn').classList.add('hidden');
            bar.focus();
            renderWordList();
        }

        let wordListExpandedAll = false; // [냐냐 PATCH] 단어 카드 전체 펼침 상태 (기본 접힘)

        function renderWordList() {
            renderStreakBadge();
            renderTodayReview();
            const grid = document.getElementById('vocabulary-grid');
            const emptyState = document.getElementById('vocab-empty-state');
            const rawSearchVal = document.getElementById('search-bar').value.trim().toLowerCase();
            const searchVal = stripAccents(rawSearchVal); // [냐냐 PATCH] 악센트 무시 (o=ó)
            const isSearching = searchVal.length > 0; // [냐냐 PATCH] 검색 중이면 필터 무시하고 전체에서 검색
            const masteryFilter = isSearching ? 'all' : activeFilterMastery;
            const weakFilter = isSearching ? 'all' : activeFilterWeak;
            const posFilterActive = isSearching ? [] : activeFilterPos;
            // 검색 중이면 결과를 펼쳐서 보여주고, 아니면 전체 펼침 상태를 따름(기본 접힘)
            const expandedAll = (searchVal.length > 0 || todayWrongFilterActive) ? true : wordListExpandedAll;
            
            const filtered = vocabulary.filter(w => {
                const queryInWord = stripAccents(w.word.toLowerCase()).includes(searchVal);
                const queryInMeaning = stripAccents(w.meaning.toLowerCase()).includes(searchVal);
                const matchesSearch = queryInWord || queryInMeaning; // [냐냐 PATCH] 메모 제외, 단어·뜻만 검색
                const matchesPos = posFilterActive.length === 0 || posFilterActive.includes(w.pos);
                // [냐냐 PATCH] 마스터 상태 (전체/마스터만/미마스터)
                const matchesMastery = masteryFilter === 'all'
                    || (masteryFilter === 'mastered' && w.mastered)
                    || (masteryFilter === 'not-mastered' && !w.mastered);
                // [냐냐 PATCH] 약점 필터 (전체/약점만/약점제외) — 분리됨
                const matchesWeak = weakFilter === 'all'
                    || (weakFilter === 'weak' && w.weak)
                    || (weakFilter === 'not-weak' && !w.weak);
                const matchesTodayWrong = !todayWrongFilterActive || (!w.mastered && w.lastWrongDate && (daysSince(w.lastWrongDate) === 0 || REVIEW_INTERVALS.includes(daysSince(w.lastWrongDate))));
                return matchesSearch && matchesPos && matchesMastery && matchesWeak && matchesTodayWrong;
            });

            // [냐냐 PATCH] 필터/정렬 요약 한 줄 + 활성 표시점
            renderFilterSummary();
            const sortModeForBadge = activeFilterSort;
            const hasActiveFilter = activeFilterPos.length > 0 || activeFilterMastery !== 'not-mastered' || activeFilterWeak !== 'all' || sortModeForBadge !== 'weak-score';
            const badge = document.getElementById('filter-active-badge');
            if (badge) badge.classList.toggle('hidden', !hasActiveFilter);

            // [냐냐 PATCH] 단어 목록은 항상 ABC순(정관사 제외) — 검색 결과도 정렬
            const sortMode = isSearching ? 'alpha-asc' : activeFilterSort;

            // [냐냐 PATCH] 정렬용으로만 맨 앞 정관사/부정관사를 떼어냄 (단수·복수 모두)
            // 예: "el libro" → "libro", "las casas" → "casas". 화면에 보이는 단어는 그대로 유지됨.
            const stripArticle = (w) => {
                return (w || '')
                    .toLowerCase()
                    .trim()
                    .replace(/^(el\/la|los\/las|el|la|los|las|un|una|unos|unas)\s+/, '')
                    .trim();
            };

            let filteredSorted = filtered;
            if (isSearching) {
                // [냐냐 PATCH] 검색 시: 완전 일치 → 검색어로 시작 → 포함, 그 안에서는 ABC순
                const q = searchVal; // 이미 악센트 제거됨
                const rank = (w) => {
                    const word = stripAccents(stripArticle(w.word));
                    const meaning = stripAccents((w.meaning || '').toLowerCase().trim());
                    if (word === q || meaning === q) return 0;           // 단어나 뜻이 정확히 일치 → 맨 위
                    if (word.startsWith(q)) return 1;                     // 검색어로 시작
                    return 2;                                             // 포함
                };
                filteredSorted = [...filtered].sort((a, b) => {
                    const ra = rank(a), rb = rank(b);
                    if (ra !== rb) return ra - rb;
                    return stripArticle(a.word).localeCompare(stripArticle(b.word));
                });
            } else if (sortMode === 'oldest') {
                filteredSorted = [...filtered].reverse();
            } else if (sortMode === 'alpha-asc') {
                filteredSorted = [...filtered].sort((a, b) => stripArticle(a.word).localeCompare(stripArticle(b.word)));
            } else if (sortMode === 'alpha-desc') {
                filteredSorted = [...filtered].sort((a, b) => stripArticle(b.word).localeCompare(stripArticle(a.word)));
            } else if (sortMode === 'weak-score') {
                // [냐냐 PATCH-0배치] 점수 낮은순(=약한 단어 먼저)
                filteredSorted = [...filtered].sort((a, b) => getScore(a) - getScore(b));
            } else if (sortMode === 'score-desc') {
                // [냐냐 PATCH-0배치] 점수 높은순(=잘 아는 단어 먼저)
                filteredSorted = [...filtered].sort((a, b) => getScore(b) - getScore(a));
            }
            // 'recent'는 등록 시 배열 맨 앞에 추가되므로(unshift) 별도 처리 없이 그대로 사용

            if (filteredSorted.length === 0) {
                grid.innerHTML = '';
                emptyState.classList.remove('hidden');
                return;
            }
            emptyState.classList.add('hidden');

            let html = '';
            filteredSorted.forEach(w => {
                const isVerb = w.pos === 'verb';
                
                // 품사 뱃지 완벽한 영어 약어 표기로 개편 (F., M., N., V., Adj., Adv., Prep., Conj., Pron., Phr.)
                let badgeMarkup = '';
                if (w.pos === 'noun') {
                    if (w.gender === 'masculine') {
                        badgeMarkup = `<span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-blue-100 text-blue-600 shadow-sm">M.</span>`;
                    } else if (w.gender === 'feminine') {
                        badgeMarkup = `<span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-rose-100 text-rose-600 shadow-sm">F.</span>`;
                    } else {
                        badgeMarkup = `<span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-slate-100 text-slate-600 shadow-sm">N.</span>`;
                    }
                } else if (w.pos === 'verb') {
                    badgeMarkup = `<span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-orange-100 text-orange-600 shadow-sm">V.</span>`;
                } else if (w.pos === 'adjective') {
                    let adjSubLabel = '';
                    if (w.adjAgreement === 'no-gender') adjSubLabel = ' <span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-amber-50 text-amber-600 border border-amber-200 shadow-sm">성 변화 X</span>';
                    else if (w.adjAgreement === 'no-number') adjSubLabel = ' <span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-amber-50 text-amber-600 border border-amber-200 shadow-sm">수 변화 X</span>';
                    else if (w.adjAgreement === 'invariable') adjSubLabel = ' <span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-amber-50 text-amber-600 border border-amber-200 shadow-sm">변화 X</span>';
                    badgeMarkup = `<span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-amber-100 text-amber-700 shadow-sm">Adj.</span>${adjSubLabel}`;
                } else if (w.pos === 'adverb') {
                    badgeMarkup = `<span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-emerald-100 text-emerald-700 shadow-sm">Adv.</span>`;
                } else if (w.pos === 'preposition') {
                    badgeMarkup = `<span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-teal-100 text-teal-700 shadow-sm">Prep.</span>`;
                } else if (w.pos === 'conjunction') {
                    badgeMarkup = `<span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-cyan-100 text-cyan-700 shadow-sm">Conj.</span>`;
                } else if (w.pos === 'pronoun') {
                    badgeMarkup = `<span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-pink-100 text-pink-700 shadow-sm">Pron.</span>`;
                } else if (w.pos === 'interrogative') {
                    badgeMarkup = `<span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-indigo-100 text-indigo-700 shadow-sm">Int.</span>`;
                } else if (w.pos === 'phrase') {
                    badgeMarkup = `<span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-purple-100 text-purple-600 shadow-sm">Phr.</span>`;
                }

                // [냐냐 PATCH] 정답률 배지 (시도 3회 이상일 때만) — 색으로 실력 표시
                const acc = getWordAccuracy(w);
                if (acc !== null) {
                    const accColor = acc >= 80 ? 'bg-emerald-100 text-emerald-700'
                        : acc >= 50 ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-100 text-rose-600';
                    badgeMarkup += `<span class="px-2 py-0.5 text-[10px] font-black rounded-full ${accColor} shadow-sm" title="이번 달 정답률 (정답 ${w.correctTotal||0} / 시도 ${(w.correctTotal||0)+(w.wrongTotal||0)})">${acc}%</span>`;
                }

                // [냐냐 PATCH-0배치] 등급 5단계 카드 스타일 (완벽=찐초록 / 마스터=연초록 / 일반 / 약점 / 치명적)
                const grade = getWordGrade(w);
                const cardStyle =
                      grade === 'perfect'  ? 'border-2 border-emerald-500 bg-emerald-50/70 shadow-sm'
                    : grade === 'mastered' ? 'border border-emerald-200 bg-emerald-50/30 shadow-xs'
                    : grade === 'critical' ? 'border-2 border-red-300 bg-red-50/60 shadow-xs'
                    : grade === 'weak'     ? 'border-2 border-amber-300 bg-amber-50/50 shadow-xs'
                    :                        'border border-slate-200 shadow-xs bg-white';
                const gi = GRADE_INFO[grade];

                let verbClassText = '';
                if (isVerb) {
                    if (w.verbClass === 'regular') {
                        verbClassText = '규칙';
                    } else {
                        verbClassText = `불규칙(${w.irregularType || '기타'})`;
                    }
                }

                html += `
                <div class="rounded-3xl p-5 ${cardStyle} flex flex-col justify-between hover:shadow-md transition-all duration-300 relative group gap-4">
                    <!-- [냐냐 PATCH-0배치] 통합 점수 배지 (우측 하단, 숫자만) -->
                    <div class="absolute bottom-2.5 right-3.5 pointer-events-none select-none">
                        <span class="px-2 py-0.5 text-[11px] font-black rounded-lg ${gi.badge}" title="${gi.label} · 통합 점수 (${SCORE_MIN} ~ ${SCORE_MAX})">${formatScore(w)}</span>
                    </div>
                    <div class="space-y-4">
                        <div class="flex items-start justify-between gap-2">
                            <button onclick="toggleWordCard('${w.id}')" class="flex items-start gap-2 min-w-0 text-left flex-1">
                                <i class="fa-solid fa-chevron-right text-slate-300 text-xs transition-transform shrink-0 mt-2" data-card-chevron="${w.id}"></i>
                                <span class="min-w-0 leading-tight" style="word-break:break-word;">
                                    <span class="text-lg font-extrabold text-slate-900 tracking-tight align-middle">${w.word}</span>
                                    <span class="inline-flex items-center gap-1.5 align-middle ml-1" style="transform: translateY(1px);">${badgeMarkup}</span>
                                    <span class="block text-sm text-slate-500 font-semibold mt-0.5 ${expandedAll ? 'hidden' : ''}" data-card-meaning="${w.id}">${w.meaning}</span>
                                </span>
                            </button>
                            <div class="flex items-center gap-1 shrink-0">
                                <button onclick="speakText(event, '${w.word}')" class="text-slate-400 hover:text-violet-500 transition-colors py-0.5 px-1 shrink-0"><i class="fa-solid fa-volume-high text-sm"></i></button>
                                <button onclick="toggleWeakWord('${w.id}', event)" title="약점 단어 표시 (약점 → 치명적 약점 → 해제)" class="w-7 h-7 rounded-full flex items-center justify-center transition-all ${grade === 'critical' ? 'bg-red-50 border-2 border-red-400 text-red-500 shadow-sm' : (grade === 'weak' ? 'bg-amber-50 border-2 border-amber-400 text-amber-500 shadow-sm' : 'bg-slate-50 hover:bg-slate-100 text-slate-300')}">
                                    <i class="fa-solid fa-star text-xs"></i>
                                </button>
                                <button onclick="toggleMasterWord('${w.id}', event)" title="마스터 표시" class="w-7 h-7 rounded-full flex items-center justify-center transition-all ${grade === 'perfect' ? 'bg-emerald-600 border-2 border-emerald-700 text-white shadow-sm' : (grade === 'mastered' ? 'bg-white border-2 border-emerald-400 text-emerald-500 shadow-sm' : 'bg-slate-50 hover:bg-slate-100 text-slate-300')}">
                                    <i class="fa-solid fa-check text-xs"></i>
                                </button>
                                <button onclick="openWordModal('${w.id}')" class="w-7 h-7 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500 flex items-center justify-center transition-all">
                                    <i class="fa-solid fa-pen text-xs"></i>
                                </button>
                                <button onclick="deleteWord('${w.id}', event)" class="w-7 h-7 rounded-full bg-slate-50 hover:bg-rose-50 hover:text-rose-600 text-slate-400 flex items-center justify-center transition-all">
                                    <i class="fa-solid fa-trash-can text-xs"></i>
                                </button>
                            </div>
                        </div>

                        <!-- 접히는 본문 -->
                        <div class="word-card-body space-y-4 ${expandedAll ? '' : 'hidden'}" data-card-body="${w.id}">
                        <!-- Meaning section -->
                        <div class="space-y-1">
                            <p class="text-sm font-bold text-slate-500 flex items-center gap-1.5">
                                <span class="w-1.5 h-1.5 bg-violet-500 rounded-full"></span>
                                <span>뜻:</span>
                                <strong class="text-slate-800 font-bold">${w.meaning}</strong>
                            </p>
                        </div>

                        <!-- 동사 변형표 개편 -->
                        ${isVerb && w.conjugations && Object.values(w.conjugations).some(v => v) ? `
                        <div class="bg-slate-50/80 rounded-2xl p-3 border border-slate-100 space-y-1.5">
                            <div class="flex items-center justify-between">
                                <span class="block text-[9px] font-bold text-indigo-500 tracking-wider uppercase">
                                    현재시제 <span class="text-indigo-600 font-extrabold ml-1">(${verbClassText})</span>
                                </span>
                            </div>
                            <div class="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                                ${getConjugationCellMarkup('yo', w.conjugations.yo, w.verbClass, w.irregularType)}
                                ${getConjugationCellMarkup('tú', w.conjugations.tu, w.verbClass, w.irregularType)}
                                ${getConjugationCellMarkup('él', w.conjugations.el, w.verbClass, w.irregularType)}
                                ${getConjugationCellMarkup('nos', w.conjugations.nos, w.verbClass, w.irregularType)}
                                ${getConjugationCellMarkup('vos', w.conjugations.vos, w.verbClass, w.irregularType)}
                                ${getConjugationCellMarkup('ellos', w.conjugations.ellos, w.verbClass, w.irregularType)}
                            </div>
                        </div>
                        ` : ''}

                        <!-- 관용구 먼저, 예문 나중 (순서 변경) -->
                        ${(() => {
                            const idiomList = (w.idioms && w.idioms.length > 0) ? w.idioms : (w.idiom ? [{ idiom: w.idiom, idiomMeaning: w.idiomMeaning || '' }] : []);
                            if (idiomList.length === 0) return '';
                            const rows = idiomList.map((item, idx) => `
                                <div class="${idx > 0 ? 'mt-2 pt-2 border-t border-slate-200/70' : ''}">
                                    <p class="font-bold text-slate-800 select-all">${item.idiom}</p>
                                    <p class="text-slate-400 italic">${item.idiomMeaning || ''}</p>
                                </div>
                            `).join('');
                            return `
                        <div class="bg-slate-50 border-l-2 border-violet-500 rounded-r-xl p-2.5 text-xs">
                            <span class="block text-[8px] font-black text-violet-500 uppercase mb-1">Expresión (관용구)</span>
                            ${rows}
                        </div>
                            `;
                        })()}
                        ${w.example ? `
                        <div class="bg-teal-50/40 border-l-2 border-teal-400 rounded-r-xl p-2.5 text-xs">
                            <span class="block text-[8px] font-black text-teal-600 uppercase">Ejemplo (예문)</span>
                            <p class="font-bold text-slate-800 mt-0.5 select-all">${w.example}</p>
                            <p class="text-slate-400 italic">${w.exampleMeaning || ''}</p>
                        </div>
                        ` : ''}

                        <!-- 핵심만 정리된 노트 -->
                        ${w.notes ? `<div class="bg-amber-50/50 p-2.5 rounded-2xl border border-amber-200/50 text-[13px] text-amber-900 leading-snug whitespace-pre-wrap font-medium"><span class="font-bold text-amber-700 block text-[10px] uppercase tracking-wider mb-1.5"><i class="fa-solid fa-thumbtack text-[9px]"></i> NOTE</span>${w.notes}</div>` : ''}
                        </div>
                    </div>
                </div>
                `;
            });

            grid.innerHTML = html;
            // 펼침 상태에 따라 chevron 회전 동기화
            if (expandedAll) {
                document.querySelectorAll('[data-card-chevron]').forEach(c => { c.style.transform = 'rotate(90deg)'; });
            }
        }

        // [냐냐 PATCH] 전체 접기/펼치기 버튼 토글
        function toggleExpandAllBtn() {
            const btn = document.getElementById('expand-all-btn');
            const willExpand = !wordListExpandedAll;
            setAllWordCards(willExpand);
            if (btn) {
                btn.querySelector('span').innerText = willExpand ? '전체 접기' : '전체 펼치기';
                const icon = btn.querySelector('i');
                if (icon) icon.className = willExpand ? 'fa-solid fa-down-left-and-up-right-to-center text-[10px]' : 'fa-solid fa-up-right-and-down-left-from-center text-[10px]';
            }
        }

        // [냐냐 PATCH] 단어 카드 하나 접기/펼치기
        function toggleWordCard(id) {
            const body = document.querySelector(`[data-card-body="${id}"]`);
            const chevron = document.querySelector(`[data-card-chevron="${id}"]`);
            const meaning = document.querySelector(`[data-card-meaning="${id}"]`);
            if (!body) return;
            const nowHidden = body.classList.toggle('hidden');
            if (chevron) chevron.style.transform = nowHidden ? 'rotate(0deg)' : 'rotate(90deg)';
            // [냐냐 PATCH] 접혔을 때만 헤더에 뜻 표시 (펼치면 본문에 뜻이 있으니 숨김)
            if (meaning) meaning.classList.toggle('hidden', !nowHidden);
        }

        // [냐냐 PATCH] 전체 접기/펼치기
        function setAllWordCards(expand) {
            wordListExpandedAll = expand;
            document.querySelectorAll('[data-card-body]').forEach(b => b.classList.toggle('hidden', !expand));
            document.querySelectorAll('[data-card-chevron]').forEach(c => { c.style.transform = expand ? 'rotate(90deg)' : 'rotate(0deg)'; });
            document.querySelectorAll('[data-card-meaning]').forEach(m => m.classList.toggle('hidden', expand)); // 펼치면 헤더 뜻 숨김
        }
