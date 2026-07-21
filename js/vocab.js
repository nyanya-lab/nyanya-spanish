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

                fillSynonymRows(w); // [냐냐 PATCH-5배치] 저장된 유의어/반의어 링크 복원

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
                // [냐냐 PATCH-5배치] 유의어 칸도 초기화
                clearSynonymRows();
                const synBoxNew = document.getElementById('syn-fields-box');
                const synIconNew = document.getElementById('syn-toggle-icon');
                if (synBoxNew) synBoxNew.classList.add('hidden');
                if (synIconNew) synIconNew.className = "fa-solid fa-plus text-xs";
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

        // ============================================================
        // [냐냐 PATCH-5배치] 유의어 / 반의어 블록 (관용구와 동일한 +/- 방식)
        //   유의어 = 스카이(하늘색) · 반의어 = 로즈(빨강)
        //   저장 시: 미등록 유의어는 자동 등록 + 상대 단어에도 양방향 자동 연결
        // ============================================================
        const SYN_POS_ABBR = { noun:'n.', verb:'v.', adjective:'adj.', adverb:'adv.', preposition:'prep.',
                              conjunction:'conj.', pronoun:'pron.', interrogative:'int.', phrase:'phr.' };
        const SYN_TYPES = { synonym: { label: '유의어', chip: 'bg-sky-50 text-sky-600', dot: 'text-sky-500' },
                            antonym: { label: '반의어', chip: 'bg-rose-50 text-rose-600', dot: 'text-rose-500' } };

        function toggleSynonymSection() {
            const box = document.getElementById('syn-fields-box');
            const icon = document.getElementById('syn-toggle-icon');
            if (!box || !icon) return;
            const isHidden = box.classList.contains('hidden');
            box.classList.toggle('hidden');
            icon.className = isHidden ? "fa-solid fa-minus text-xs" : "fa-solid fa-plus text-xs";
            const entriesBox = document.getElementById('syn-entries-box');
            if (isHidden && entriesBox && entriesBox.children.length === 0) addSynonymRow();
        }

        let synRowCounter = 0;
        function addSynonymRow(data = {}) {
            const box = document.getElementById('syn-entries-box');
            if (!box) return;
            const rowId = 'syn-row-' + (synRowCounter++);
            const esc = (v) => String(v || '').replace(/"/g, '&quot;');
            const type = data.type === 'antonym' ? 'antonym' : 'synonym';
            // [냐냐 PATCH] 품사는 영어 약자로 (n. v. adj. ...)
            const posOpts = ALL_POS_LIST.map(p =>
                `<option value="${p}" ${data.pos === p ? 'selected' : ''}>${SYN_POS_ABBR[p] || p}</option>`).join('');
            const g = data.gender || 'none';

            const row = document.createElement('div');
            row.id = rowId;
            row.className = 'bg-slate-50/60 border border-slate-200 rounded-xl p-2.5 space-y-2';
            row.innerHTML = `
                <!-- [냐냐 PATCH] 1줄: [종류][단어][품사][뜻][성별][x] -->
                <div class="flex gap-2 items-center">
                    <select data-syn-field="type" onchange="styleSynonymRow('${rowId}')" class="shrink-0 bg-white px-2 py-2 rounded-lg border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-400">
                        <option value="synonym" ${type === 'synonym' ? 'selected' : ''}>유의어</option>
                        <option value="antonym" ${type === 'antonym' ? 'selected' : ''}>반의어</option>
                    </select>
                    <input type="text" data-syn-field="word" placeholder="단어" autocomplete="off" value="${esc(data.word)}" class="flex-1 min-w-0 bg-white px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-sky-400">
                    <!-- [냐냐 PATCH] 품사 + 성별을 나란히 (뜻이 사이에 끼지 않게) -->
                    <select data-syn-field="pos" onchange="styleSynonymRow('${rowId}')" class="shrink-0 bg-white px-1.5 py-2 rounded-lg border border-slate-200 text-xs font-normal text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-400">${posOpts}</select>
                    <select data-syn-field="gender" onchange="applySynonymArticle('${rowId}')" class="syn-gender-sel shrink-0 bg-white px-1.5 py-2 rounded-lg border border-slate-200 text-xs font-normal text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-400">
                        <option value="none" ${g === 'none' ? 'selected' : ''}>m./f.</option>
                        <option value="masculine" ${g === 'masculine' ? 'selected' : ''}>m.</option>
                        <option value="feminine" ${g === 'feminine' ? 'selected' : ''}>f.</option>
                    </select>
                    <input type="text" data-syn-field="meaning" placeholder="뜻" autocomplete="off" value="${esc(data.meaning)}" class="flex-1 min-w-0 bg-white px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400">
                    <button type="button" onclick="autofillSynonymRow('${rowId}')" title="이 단어 AI로 채우기 (뜻·품사·오타검수)" class="w-8 h-8 shrink-0 rounded-lg bg-white hover:bg-violet-50 hover:text-violet-500 text-slate-400 border border-slate-200 flex items-center justify-center transition-all"><i class="fa-solid fa-wand-magic-sparkles text-xs"></i></button>
                    <button type="button" onclick="document.getElementById('${rowId}').remove()" class="w-8 h-8 shrink-0 rounded-lg bg-white hover:bg-rose-50 hover:text-rose-500 text-slate-400 border border-slate-200 flex items-center justify-center transition-all"><i class="fa-solid fa-xmark text-xs"></i></button>
                </div>
                <!-- 2줄: 차이 설명 (유의어일 때만) -->
                <div class="flex gap-2 items-center">
                    <input type="text" data-syn-field="difference" placeholder="차이 (예: dormido : 완전히 잠든 상태 | adormecido : 잠들기 직전의 졸림)" autocomplete="off" value="${esc(data.difference)}" class="flex-1 min-w-0 bg-white px-3 py-2 rounded-lg border border-slate-200 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-sky-400">
                </div>
                <input type="hidden" data-syn-field="id" value="${esc(data.id)}">
            `;
            box.appendChild(row);
            styleSynonymRow(rowId);
        }

        // 종류(유의어/반의어)에 따라 블록 테두리 색을 바꿔줌
        function styleSynonymRow(rowId) {
            const row = document.getElementById(rowId);
            if (!row) return;
            const sel = row.querySelector('[data-syn-field="type"]');
            const isAnt = sel && sel.value === 'antonym';
            row.className = isAnt
                ? 'bg-rose-50/50 border border-rose-200 rounded-xl p-2.5 space-y-2'
                : 'bg-sky-50/50 border border-sky-200 rounded-xl p-2.5 space-y-2';
            // 명사가 아니면 성별 칸은 숨김
            const posSel = row.querySelector('[data-syn-field="pos"]');
            const genSel = row.querySelector('.syn-gender-sel');
            if (posSel && genSel) genSel.classList.toggle('hidden', posSel.value !== 'noun');
            if (posSel && posSel.value === 'noun') applySynonymArticle(rowId); // 명사면 관사 붙이기

            // [냐냐 PATCH] 반의어는 반대말이라 '차이' 설명이 필요 없음 → 칸 숨기고 값도 비움
            const diffInput = row.querySelector('[data-syn-field="difference"]');
            if (diffInput) {
                diffInput.classList.toggle('hidden', isAnt);
                if (isAnt) diffInput.value = '';
            }
        }

        // [냐냐 PATCH] 명사 + 성별이 정해지면 단어 칸에 관사를 바로 붙여줌 (la casa / el libro / el/la estudiante)
        function applySynonymArticle(rowId) {
            const row = document.getElementById(rowId);
            if (!row) return;
            const posSel = row.querySelector('[data-syn-field="pos"]');
            const genSel = row.querySelector('.syn-gender-sel');
            const wordInp = row.querySelector('[data-syn-field="word"]');
            if (!posSel || !genSel || !wordInp) return;
            if (posSel.value !== 'noun') return;
            const bare = wordInp.value.trim().replace(/^(el\/la|los\/las|un\/una|unos\/unas|el|la|los|las|un|una|unos|unas)\s+/i, '');
            if (!bare) return;
            wordInp.value = buildNounDisplayForm(bare, genSel.value, /s$/i.test(bare), 'noun');
        }

        // [냐냐 PATCH] 유의어 행 하나만 AI로 채우기 (뜻·품사·성별 + 철자 오타 교정)
        async function autofillSynonymRow(rowId) {
            const row = document.getElementById(rowId);
            if (!row) return;
            const wordInp = row.querySelector('[data-syn-field="word"]');
            const raw = wordInp ? wordInp.value.trim() : '';
            if (!raw) { showToast("먼저 유의어/반의어 단어를 입력해주세요!", "error"); return; }
            if (!hasGeminiApiKey()) { showToast("AI 추천은 설정에서 API 키를 등록해야 써요!", "error"); return; }

            const btn = row.querySelector('[onclick^="autofillSynonymRow"]');
            const icon = btn ? btn.querySelector('i') : null;
            const prevCls = icon ? icon.className : '';
            if (icon) icon.className = 'fa-solid fa-spinner fa-spin text-xs';

            try {
                const bare = raw.replace(/^(el\/la|los\/las|un\/una|unos\/unas|el|la|los|las|un|una|unos|unas)\s+/i, '');
                // 이 행이 유의어인지 반의어인지 + 원래(메인) 단어 파악
                const typeSel = row.querySelector('[data-syn-field="type"]');
                const isSynonym = !(typeSel && typeSel.value === 'antonym');
                const mainWord = (document.getElementById('input-word') || {}).value || '';
                const mainMeaning = (document.getElementById('input-meaning') || {}).value || '';

                const schema = {
                    type: "OBJECT",
                    properties: {
                        correctedWord: { type: "STRING", description: "철자 오타가 있으면 교정한 올바른 스페인어 단어(관사 없이). 정상이면 그대로" },
                        meaning: { type: "STRING", description: "핵심 한글 뜻 (짧게)" },
                        pos: { type: "STRING", enum: ["noun","verb","adjective","adverb","preposition","conjunction","pronoun","interrogative","phrase"] },
                        gender: { type: "STRING", enum: ["none","masculine","feminine"], description: "명사일 때만. 아니면 none" },
                        isPlural: { type: "BOOLEAN" },
                        difference: { type: "STRING", description: isSynonym
                            ? `유의어일 때만. "${mainWord}"와 이 단어의 차이. 반드시 형식: "${mainWord} : 설명 | ${bare} : 설명" (파이프로 구분, 콜론 뒤 명사형 짧은 설명). 서술형 금지`
                            : "반의어면 빈 문자열" }
                    },
                    required: ["correctedWord","meaning","pos","gender","difference"]
                };
                const prompt = isSynonym
                    ? `스페인어 단어 "${mainWord}"(뜻: ${mainMeaning})의 유의어로 "${bare}"를 등록하려 해. "${bare}"의 정보를 JSON으로 채워줘. 철자 틀렸으면 correctedWord에 교정. 뜻은 한국어로 짧게. difference에는 두 단어의 차이를 "단어A : 설명 | 단어B : 설명" 형식으로.`
                    : `스페인어 단어 "${bare}"의 정보를 JSON으로. 철자 틀렸으면 correctedWord에 교정. 뜻은 한국어로 짧게. difference는 빈 문자열.`;
                const sys = "You are a precise Spanish dictionary. Output strictly the JSON schema. Korean meaning. No markdown, no extra text.";
                const res = await callGemini(prompt, sys, schema);
                const data = (typeof res === 'string') ? extractAndParseJson(res) : res;
                if (!data) { showToast("AI 응답을 이해하지 못했어요. 다시 시도해주세요", "error"); return; }

                // 값 채우기
                const posSel = row.querySelector('[data-syn-field="pos"]');
                const genSel = row.querySelector('.syn-gender-sel');
                const meanInp = row.querySelector('[data-syn-field="meaning"]');
                if (posSel && data.pos) posSel.value = data.pos;
                if (genSel && data.gender) genSel.value = data.gender;
                if (meanInp && data.meaning) meanInp.value = data.meaning;
                // 차이 설명 채우기 (유의어만)
                const diffInp = row.querySelector('[data-syn-field="difference"]');
                if (diffInp && isSynonym && data.difference) diffInp.value = data.difference;
                // 오타 교정된 단어 + 관사 반영
                const fixed = (data.correctedWord || bare).trim();
                if (wordInp) {
                    wordInp.value = (data.pos === 'noun')
                        ? buildNounDisplayForm(fixed, data.gender, data.isPlural, 'noun')
                        : fixed;
                }
                styleSynonymRow(rowId); // 성별칸 표시/숨김 + 관사 재적용
                const wasTypo = fixed.toLowerCase() !== bare.toLowerCase();
                showToast(wasTypo ? `철자를 "${fixed}"로 고치고 정보를 채웠어요! ✨` : "AI가 정보를 채웠어요! ✨", "success");
            } catch (e) {
                showToast("AI 추천 중 문제가 생겼어요. 잠시 후 다시 시도해주세요", "error");
            } finally {
                if (icon) icon.className = prevCls || 'fa-solid fa-wand-magic-sparkles text-xs';
            }
        }

        function clearSynonymRows() {
            const box = document.getElementById('syn-entries-box');
            if (box) box.innerHTML = '';
        }

        // 폼에서 유의어 입력값 수집 (단어가 비어있는 줄은 무시)
        function getSynonymRowsData() {
            const rows = document.querySelectorAll('#syn-entries-box > div');
            const out = [];
            rows.forEach(row => {
                const get = (f) => { const el = row.querySelector(`[data-syn-field="${f}"]`); return el ? el.value.trim() : ''; };
                const word = get('word');
                if (!word) return;
                const pos = get('pos') || 'noun';
                const gender = get('gender') || 'none';
                const type = get('type') === 'antonym' ? 'antonym' : 'synonym';
                out.push({
                    id: get('id') || null,
                    // [냐냐 PATCH] 명사면 성별에 맞는 관사를 붙여서 저장
                    word: (pos === 'noun') ? buildNounDisplayForm(word, gender, /s$/i.test(word), pos) : word,
                    pos,
                    gender,
                    meaning: get('meaning'),
                    difference: (type === 'antonym') ? '' : get('difference'), // 반의어는 차이 설명 없음
                    type
                });
            });
            return out;
        }

        // 저장된 링크(id 기반)를 폼에 다시 채우기
        function fillSynonymRows(word) {
            clearSynonymRows();
            const links = (word && Array.isArray(word.synonyms)) ? word.synonyms : [];
            const box = document.getElementById('syn-fields-box');
            const icon = document.getElementById('syn-toggle-icon');
            links.forEach(link => {
                const target = vocabulary.find(v => v.id === link.id);
                if (!target) return; // 삭제된 단어는 건너뜀
                addSynonymRow({ id: target.id, word: target.word, pos: target.pos, gender: target.gender || 'none', meaning: target.meaning, difference: link.difference || '', type: link.type });
            });
            if (links.length > 0 && box && icon) {
                box.classList.remove('hidden');
                icon.className = "fa-solid fa-minus text-xs";
            }
        }

        // [냐냐 PATCH-5배치] 명사면 관사를 붙여서 표시형으로 (복수면 los/las)
        function buildNounDisplayForm(word, gender, isPlural, pos) {
            const raw = String(word || '').trim();
            if (!raw || pos !== 'noun') return raw;
            if (/^(el|la|los|las|un|una|unos|unas|el\/la|los\/las)\s+/i.test(raw)) return raw; // 이미 관사 있음
            let art;
            if (gender === 'feminine') art = isPlural ? 'las' : 'la';
            else if (gender === 'masculine') art = isPlural ? 'los' : 'el';
            else art = isPlural ? 'los/las' : 'el/la'; // 남녀공용
            return `${art} ${raw}`;
        }

        // 중복 판정: 단어 + 품사가 둘 다 같을 때만 같은 단어 (el poder 명사 ≠ poder 동사)
        function findExistingWord(wordText, pos, excludeId) {
            const norm = (t) => String(t || '').toLowerCase().trim()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/^(el\/la|los\/las|un\/una|unos\/unas|el|la|los|las|un|una|unos|unas)\s+/, '').trim();
            const target = norm(wordText);
            return vocabulary.find(w => w.id !== excludeId && norm(w.word) === target && w.pos === pos) || null;
        }

        // ⭐ 유의어/반의어 저장 — 자동 등록 + 양방향 연결 + 삭제된 링크 정리
        //   반환: { links, newIds, linkedNames }
        function applySynonymLinks(wordObj, rows) {
            const prevLinks = Array.isArray(wordObj.synonyms) ? wordObj.synonyms : [];
            const links = [];
            const newIds = [];      // 이번에 자동 등록된 단어들
            const linkedNames = []; // 자동 연결된 상대 단어 이름 (토스트용)

            rows.forEach(r => {
                // 1) 이미 링크된 단어(id 있음) → 그대로 사용
                let target = r.id ? vocabulary.find(v => v.id === r.id) : null;
                // 2) 단어+품사로 기존 단어 찾기 (중복 등록 방지)
                if (!target) target = findExistingWord(r.word, r.pos);
                // 3) 그래도 없으면 → 자동 등록 (단어·품사·뜻이 다 있으니 등록 요건 충족)
                if (!target) {
                    target = {
                        id: 'word-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
                        word: r.word,
                        meaning: r.meaning || '',
                        pos: r.pos || 'noun',
                        idioms: [],
                        example: '',
                        exampleMeaning: '',
                        notes: '',
                        mastered: false,
                        score: 0,
                        synonyms: []
                    };
                    if (target.pos === 'noun') target.gender = r.gender || 'none';
                    vocabulary.unshift(target);
                    newIds.push(target.id);
                    logAction('new-word'); // 자동 등록도 오늘 신규등록 카운트에 포함
                }
                if (target.id === wordObj.id) return; // 자기 자신은 링크 안 함

                links.push({ id: target.id, type: r.type, difference: r.difference || '' });

                // 4) 양방향 자동 연결 — 상대 단어에도 나를 걸어줌 (차이 설명은 그대로 공유)
                if (!Array.isArray(target.synonyms)) target.synonyms = [];
                const already = target.synonyms.find(l => l.id === wordObj.id);
                if (already) {
                    already.type = r.type;
                    already.difference = r.difference || '';
                } else {
                    target.synonyms.push({ id: wordObj.id, type: r.type, difference: r.difference || '' });
                    if (!newIds.includes(target.id)) linkedNames.push(target.word); // 새로 등록한 건 토스트에서 제외
                }
            });

            // 5) 내가 뺀(−) 링크는 상대 쪽에서도 제거 (양방향 해제)
            const keptIds = links.map(l => l.id);
            prevLinks.forEach(old => {
                if (keptIds.includes(old.id)) return;
                const other = vocabulary.find(v => v.id === old.id);
                if (other && Array.isArray(other.synonyms)) {
                    other.synonyms = other.synonyms.filter(l => l.id !== wordObj.id);
                }
            });

            wordObj.synonyms = links;
            return { links, newIds, linkedNames };
        }

        // [냐냐 PATCH-5배치] 자동 등록된 단어들의 상세정보를 차례로 채우기 (한 번에 한 창씩)
        let _synonymFillQueue = [];
        let _inSynonymFill = false; // 유의어 자동채우기 진행 중 표시 (저장 흐름 분기용)
        function processSynonymQueue() {
            if (!_synonymFillQueue || _synonymFillQueue.length === 0) { _inSynonymFill = false; return; }
            const nextId = _synonymFillQueue.shift();
            const w = vocabulary.find(v => v.id === nextId);
            if (!w) { processSynonymQueue(); return; }
            _inSynonymFill = true;
            // openWordModal이 이 단어의 저장된 유의어 링크(원래 단어 포함)를 폼에 복원해줌
            openWordModal(nextId);
            // 자동완성은 "빈 칸만" 채우도록(forceOverwrite=false) → 이미 걸려있는 유의어 링크를 지우지 않음
            setTimeout(() => {
                if (typeof triggerAiAutofill === 'function') triggerAiAutofill(false);
            }, 300);
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
        async function triggerAiAutofill(force = true) {
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
            - **의문사(qué, quién, dónde, cuándo, cómo, cuánto, por qué, cuál 등)와 의문사가 들어간 의문 구문은 품사를 무조건 pos="interrogative"(의문사)로 할 것.** 부사/대명사/구문으로 분류하지 말 것.
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
              절대 쓰지 말 것: "사람의 성품/상태/감정을 나타내는 형용사", "~를 뜻하는 명사", "일상에서 자주 쓰는 동사" 같이 뻔한 분류 설명. 형용사의 성·수 변화 여부(성변화 없음, 수변화 없음 등)도 이미 별도 항목이라 절대 쓰지 말 것. 남녀 공통 명사/성 구분 없는 명사라는 설명도 관사(el/la)로 이미 표시되므로 쓰지 말 것. 특정 전치사와 함께 쓰인다는 내용은 notes가 아니라 idioms(구문 패턴)에 넣을 것. **유의어/반의어 이야기는 notes에 절대 쓰지 말 것 — synonyms 항목이 따로 있음.** 뻔한 말만 나올 거면 빈 문자열로 둘 것.
              형식: "· "로 시작하는 불릿, 최대 2줄, 각 줄 25자 이내, 줄바꿈은 \\n 하나. 인사말/이름 호칭 금지. "~함/~됨/~임" 서술형 대신 명사형으로 끝낼 것.
            - **synonyms (중요, 반드시 채울 것):** 이 단어의 유의어(type="synonym")와 반의어(type="antonym")를 넣을 것.
              · 반의어가 존재하는 단어(형용사·부사·대부분의 상태/방향/크기 표현)라면 **반의어를 반드시 최소 1개** 넣을 것. 예: feliz↔triste, grande↔pequeño, abrir↔cerrar, siempre↔nunca, subir↔bajar.
              · 유의어도 있으면 1~2개 넣을 것. 학습에 도움되는 실제로 쓰이는 단어만.
              · 각 항목마다 word(관사 없이 단어만) · pos(품사) · gender(명사면 masculine/feminine, 아니면 none) · isPlural · meaning(한글 뜻) · type 을 전부 채울 것.
              · **difference(차이)는 유의어(synonym)일 때만 채울 것. 반의어(antonym)는 반대말이라 차이 설명이 필요 없으므로 반드시 빈 문자열 "" 로 둘 것.**
              · 유의어의 difference: **아래 형식을 반드시 지킬 것 (다른 형식 금지)**
                형식: "단어A : 설명 | 단어B : 설명"
                  · 파이프( | )로 두 항목을 나누고, 콜론( : ) 앞에 단어, 뒤에 설명.
                  · 설명은 **명사형으로 짧게 끝낼 것.** 서술형/구어체 금지.
                  · 좋은 예: "dormido : 완전히 잠든 상태 | adormecido : 잠들기 직전의 졸림, 손발 저림"
                  · 좋은 예: "ser : 본질·영구적 속성 | estar : 일시적 상태"
                  · 좋은 예: "feliz : 마음속 지속적 행복 | alegre : 겉으로 드러나는 밝음"
                  · 나쁜 예(금지): "dormido는 완전히 잠든 상태이고, adormecido는 ~를 의미함" ← 서술형 금지
                  · 나쁜 예(금지): "~에 가깝고," ← "가까움" 처럼 명사형으로
                차이가 거의 없는 완전 동의어면 사용역 차이라도 같은 형식으로: "단어A : 구어체 | 단어B : 문어체".
              · 정말 유의어도 반의어도 없는 단어(고유명사 등)만 빈 배열 [] 허용.`;

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
                    synonyms: {
                        type: "ARRAY",
                        description: "이 단어의 유의어(type=synonym)와 반의어(type=antonym). 1~4개. 반의어가 존재할 수 있는 단어(형용사·부사·상태/방향/크기/시간 표현, 대칭 동사 등)라면 반의어를 반드시 최소 1개 포함할 것. 유의어도 있으면 함께. difference(차이)는 유의어일 때만 채우고(두 단어 이름을 모두 언급), 반의어는 빈 문자열로 둘 것. 정말 유의어도 반의어도 없는 단어만 빈 배열 허용",
                        items: {
                            type: "OBJECT",
                            properties: {
                                word: { type: "STRING", description: "유의어/반의어 (스페인어, 관사 없이 단어만. 명사도 관사 빼고)" },
                                pos: { type: "STRING", enum: ["noun", "verb", "adjective", "adverb", "preposition", "conjunction", "pronoun", "phrase"], description: "그 단어의 품사" },
                                gender: { type: "STRING", enum: ["none", "masculine", "feminine"], description: "명사일 때만. 아니면 none" },
                                isPlural: { type: "BOOLEAN", description: "명사가 복수형이면 true" },
                                meaning: { type: "STRING", description: "그 단어의 핵심 한글 뜻" },
                                difference: { type: "STRING", description: "유의어(synonym)일 때만. 반드시 `단어A : 설명 | 단어B : 설명` 형식 (파이프로 구분, 콜론 뒤에 명사형 짧은 설명). 예: 'dormido : 완전히 잠든 상태 | adormecido : 잠들기 직전의 졸림'. 서술형 문장 금지. 반의어(antonym)는 반드시 빈 문자열" },
                                type: { type: "STRING", enum: ["synonym", "antonym"], description: "synonym=유의어, antonym=반의어" }
                            },
                            required: ["word", "pos", "gender", "meaning", "type"]
                        }
                    },
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
                            applyAutofillResult(result, force);
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
                                applyAutofillResult(result, force);
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
                            applyAutofillResult(result, force);
                            saveAiWordCache(mascBase, result);
                            AudioFX.playSuccess();
                            showToast(`남성형 "${mascBase}"(으)로 바꿔서 적용했어요 ✨`, "success");
                        },
                        {
                            okLabel: '남성형으로',
                            cancelLabel: '그대로',
                            okStyle: 'primary',
                            onCancel: () => {
                                applyAutofillResult(result, force);
                                saveAiWordCache(rawWord, result);
                                AudioFX.playSuccess();
                                showToast("입력하신 형태 그대로 적용했어요 ✨", "info");
                            }
                        }
                    );
                } else {
                    applyAutofillResult(result, force); // 기본 true(덮어쓰기), 유의어 자동채우기에선 false
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

        // [냐냐 PATCH] 의문사는 AI가 부사/구문으로 줘도 무조건 '의문사(interrogative)' 품사로 강제
        function coerceInterrogativePos(word, pos) {
            // 앞뒤 물음표·느낌표·기호를 다 떼고 판단 (¿Dónde? → donde)
            const w = String(word || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[¿?¡!.,;:"'()]/g, '').trim();
            const qWords = ['que','quien','quienes','donde','adonde','cuando','como','cuanto','cuanta','cuantos','cuantas','cual','cuales','porque'];
            const tokens = w.split(/\s+/).filter(Boolean);
            // 전치사 + 의문사 구문도 잡기 (de dónde, por qué, a dónde, con quién 등)
            //   → 짧은 구문(3단어 이하)에 의문사가 포함되면 의문사로 취급
            const hasQ = tokens.some(t => qWords.includes(t));
            if (qWords.includes(w) || (hasQ && tokens.length <= 3)) return 'interrogative';
            return pos;
        }

        function applyAutofillResult(result, forceOverwrite = false) {
            // 의문사 보정
            if (result && result.pos) {
                const rawW = document.getElementById('input-word') ? document.getElementById('input-word').value : '';
                result.pos = coerceInterrogativePos(rawW, result.pos);
            }
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

            // [냐냐 PATCH-5배치] AI가 유의어/반의어를 찾아줬으면 자동으로 채우고 섹션을 펼침
            // [냐냐 요청] 전체 ✨ 추천이어도 기존 유의어를 지우지 않고 '없는 것만 추가'로 합친다.
            //   예전엔 forceOverwrite면 clearSynonymRows()로 다 지워서, 이미 연결해둔
            //   양방향 링크가 통째로 끊어지는 문제가 있었음.
            if (result.synonyms && result.synonyms.length > 0) {
                // 이미 입력돼 있는 단어들 수집 (중복 추가 방지)
                const existing = new Set();
                document.querySelectorAll('#syn-entries-box > div').forEach(row => {
                    const inp = row.querySelector('input[data-syn-field="word"]');
                    if (inp && inp.value) existing.add(normalizeSpanishAnswer(inp.value));
                });
                let added = 0;
                result.synonyms.forEach(item => {
                    const t = item.type === 'antonym' ? 'antonym' : 'synonym';
                    // [냐냐 PATCH] 명사면 관사를 바로 붙여서 보여줌 (la casa)
                    const shown = buildNounDisplayForm(item.word, item.gender, item.isPlural, item.pos);
                    if (existing.has(normalizeSpanishAnswer(shown))) return; // 이미 있으면 건너뜀
                    existing.add(normalizeSpanishAnswer(shown));
                    added++;
                    addSynonymRow({
                        word: shown,
                        pos: item.pos || 'noun',
                        gender: item.gender || 'none',
                        meaning: item.meaning || '',
                        difference: (t === 'antonym') ? '' : (item.difference || ''), // 반의어는 차이 없음
                        type: t
                    });
                });
                if (added > 0) {
                    const synBoxAi = document.getElementById('syn-fields-box');
                    const synIconAi = document.getElementById('syn-toggle-icon');
                    if (synBoxAi) synBoxAi.classList.remove('hidden');
                    if (synIconAi) synIconAi.className = "fa-solid fa-minus text-xs";
                }
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
        // ============================================================
        // [냐냐 PATCH-3차] 중복 단어 반반 비교 편집창
        //   중복 판정 = 단어 + 품사가 둘 다 같을 때 (el poder 명사 ≠ poder 동사)
        //   좌 = 기존 / 우 = 신규. 양쪽 각각 편집 가능. 최종 하나만 선택.
        //   ⚠️ 단어 모달은 전역 상태를 쓰므로, 여기선 폼 상태를 "스냅샷 객체"로 분리해서 다룸
        // ============================================================
        let dupState = null; // { oldWord, newWord, oldId }

        // 현재 등록 폼의 모든 값을 하나의 단어 객체(스냅샷)로 뽑아냄
        function snapshotWordForm() {
            const val = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
            return {
                word: val('input-word'),
                meaning: val('input-meaning'),
                pos: val('input-pos'),
                gender: val('input-gender'),
                adjAgreement: val('input-adj-agreement'),
                notes: val('input-notes'),
                example: val('input-example'),
                exampleMeaning: val('input-example-meaning'),
                idioms: getIdiomRowsData(),
                _synRows: getSynonymRowsData(),
                conjugationsByTense: collectConjByTense(),
                irregularByTense: collectVerbInfoByTense().irregularByTense,
                verbClassByTense: collectVerbInfoByTense().verbClassByTense
            };
        }

        // 스냅샷 → 화면에 보여줄 읽기/편집 카드 HTML
        function buildDupSideHtml(side, w) {
            const isOld = side === 'old';
            const title = isOld ? '기존 단어' : '신규 입력';
            const badge = isOld ? 'bg-slate-100 text-slate-600' : 'bg-violet-100 text-violet-700';
            const border = isOld ? 'border-slate-300' : 'border-violet-400';
            const inp = (field, label, value, ph = '') => `
                <div class="space-y-1">
                    <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">${label}</label>
                    <input type="text" data-dup="${side}" data-field="${field}" value="${String(value || '').replace(/"/g, '&quot;')}" placeholder="${ph}" class="w-full bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-violet-400">
                </div>`;

            // 관용구·유의어·시제는 편집 대신 "요약 표시" (편집하려면 창 닫고 원래 폼에서)
            const idiomTxt = (w.idioms && w.idioms.length)
                ? w.idioms.map(it => `${escapeHtml(it.idiom)} <span class="text-slate-400">— ${escapeHtml(it.idiomMeaning || '')}</span>`).join('<br>')
                : '<span class="text-slate-300">없음</span>';
            const synRows = w._synRows || [];
            const synTxt = synRows.length
                ? synRows.map(r => `<span class="${r.type === 'antonym' ? 'text-rose-600' : 'text-sky-600'} font-bold">${r.type === 'antonym' ? '반의어' : '유의어'}</span> ${escapeHtml(r.word)} <span class="text-slate-400">${escapeHtml(r.meaning || '')}</span>`).join('<br>')
                : '<span class="text-slate-300">없음</span>';
            const tenseKeys = Object.keys(w.conjugationsByTense || {}).filter(k => {
                const c = w.conjugationsByTense[k];
                return c && (c.yo || c.tu || c.el || c.nos || c.vos || c.ellos || c.form);
            });
            const tenseTxt = tenseKeys.length
                ? tenseKeys.map(k => {
                    const o = TENSE_TYPE_OPTIONS.find(t => t.key === k);
                    return `<span class="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[10px] font-bold">${escapeHtml(o ? o.label : k)}</span>`;
                  }).join(' ')
                : '<span class="text-slate-300">없음</span>';

            const scoreTxt = isOld && dupState && dupState.oldWord && typeof dupState.oldWord.score === 'number'
                ? `<div class="text-[11px] font-bold text-slate-500">현재 점수: <span class="text-slate-800">${formatScore(dupState.oldWord)}</span> · 정답 ${dupState.oldWord.correctTotal || 0} / 오답 ${dupState.oldWord.wrongTotal || 0}</div>`
                : '';

            return `
            <div class="border-2 ${border} rounded-2xl p-4 space-y-3 bg-white">
                <div class="flex items-center justify-between">
                    <span class="px-2.5 py-1 rounded-lg text-[11px] font-black ${badge}">${title}</span>
                    ${scoreTxt}
                </div>
                ${inp('word', '단어', w.word)}
                ${inp('meaning', '뜻', w.meaning)}
                <div class="grid grid-cols-2 gap-2">
                    <div class="space-y-1">
                        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">품사</label>
                        <select data-dup="${side}" data-field="pos" class="w-full bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-violet-400">
                            ${ALL_POS_LIST.map(p => `<option value="${p}" ${w.pos === p ? 'selected' : ''}>${POS_LABELS[p] || p}</option>`).join('')}
                        </select>
                    </div>
                    <div class="space-y-1">
                        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">성별</label>
                        <select data-dup="${side}" data-field="gender" class="w-full bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-violet-400">
                            <option value="none" ${(!w.gender || w.gender === 'none') ? 'selected' : ''}>없음/공용</option>
                            <option value="masculine" ${w.gender === 'masculine' ? 'selected' : ''}>남성 (el)</option>
                            <option value="feminine" ${w.gender === 'feminine' ? 'selected' : ''}>여성 (la)</option>
                        </select>
                    </div>
                </div>
                ${inp('example', '예문', w.example)}
                ${inp('exampleMeaning', '예문 뜻', w.exampleMeaning)}
                <div class="space-y-1">
                    <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">메모</label>
                    <textarea data-dup="${side}" data-field="notes" rows="2" class="w-full bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">${escapeHtml(w.notes || '')}</textarea>
                </div>
                <div class="bg-slate-50 rounded-xl p-2.5 space-y-2 text-[12px] leading-relaxed">
                    <div><span class="text-[10px] font-black text-violet-600 uppercase">관용구</span><div class="mt-0.5">${idiomTxt}</div></div>
                    <div class="border-t border-slate-200 pt-2"><span class="text-[10px] font-black text-sky-600 uppercase">유의어·반의어</span><div class="mt-0.5">${synTxt}</div></div>
                    <div class="border-t border-slate-200 pt-2"><span class="text-[10px] font-black text-indigo-600 uppercase">등록된 시제</span><div class="mt-0.5 flex flex-wrap gap-1">${tenseTxt}</div></div>
                </div>
            </div>`;
        }

        function openDupModal(oldWord, newSnapshot, mergeFromId) {
            dupState = {
                oldId: oldWord.id,
                oldWord,
                mergeFromId: mergeFromId || null, // 수정 중이던 단어 (합쳐진 뒤 삭제됨)
                // 기존 단어 → 스냅샷 형태로 변환 (링크는 폼 행 형태로)
                oldSnap: {
                    word: oldWord.word, meaning: oldWord.meaning, pos: oldWord.pos,
                    gender: oldWord.gender || 'none', adjAgreement: oldWord.adjAgreement || 'full',
                    notes: oldWord.notes || '', example: oldWord.example || '', exampleMeaning: oldWord.exampleMeaning || '',
                    idioms: (oldWord.idioms && oldWord.idioms.length) ? oldWord.idioms : (oldWord.idiom ? [{ idiom: oldWord.idiom, idiomMeaning: oldWord.idiomMeaning || '' }] : []),
                    _synRows: (oldWord.synonyms || []).map(l => {
                        const t = vocabulary.find(v => v.id === l.id);
                        return t ? { id: t.id, word: t.word, pos: t.pos, meaning: t.meaning, difference: l.difference || '', type: l.type } : null;
                    }).filter(Boolean),
                    conjugationsByTense: oldWord.conjugationsByTense || (oldWord.conjugations ? { presente: oldWord.conjugations } : {}),
                    irregularByTense: oldWord.irregularByTense || {},
                    verbClassByTense: oldWord.verbClassByTense || {}
                },
                newSnap: newSnapshot
            };
            const sub = document.getElementById('dup-modal-sub');
            if (sub) sub.innerText = `"${newSnapshot.word}" (${POS_LABELS[newSnapshot.pos] || newSnapshot.pos}) — 양쪽 다 고칠 수 있어요. 남길 쪽을 골라주세요.`;
            document.getElementById('dup-side-old').innerHTML = buildDupSideHtml('old', dupState.oldSnap);
            document.getElementById('dup-side-new').innerHTML = buildDupSideHtml('new', dupState.newSnap);
            document.getElementById('dup-modal').classList.remove('hidden');
        }

        function closeDupModal() {
            document.getElementById('dup-modal').classList.add('hidden');
            dupState = null;
        }

        // 비교창의 편집 내용을 스냅샷에 다시 반영
        function collectDupSide(side) {
            const base = (side === 'old') ? { ...dupState.oldSnap } : { ...dupState.newSnap };
            document.querySelectorAll(`[data-dup="${side}"]`).forEach(el => {
                base[el.dataset.field] = el.value.trim();
            });
            return base;
        }

        // 최종 선택 — 고른 쪽만 남기고 나머지는 버림
        function resolveDuplicate(side) {
            if (!dupState) return;
            const chosen = collectDupSide(side);
            if (!chosen.word || !chosen.meaning) {
                showToast("단어와 뜻은 비워둘 수 없어요!", "error");
                return;
            }
            const target = vocabulary.find(v => v.id === dupState.oldId);
            if (!target) { closeDupModal(); return; }

            // 기존 단어 객체를 덮어씀 → 점수/학습기록은 그대로 유지됨 (중복 단어가 새로 안 생김)
            target.word = chosen.word;
            target.meaning = chosen.meaning;
            target.pos = chosen.pos;
            target.gender = chosen.gender;
            target.notes = chosen.notes || '';
            target.example = chosen.example || '';
            target.exampleMeaning = chosen.exampleMeaning || '';
            target.idioms = chosen.idioms || [];
            target.conjugationsByTense = chosen.conjugationsByTense || {};
            target.irregularByTense = chosen.irregularByTense || {};
            target.verbClassByTense = chosen.verbClassByTense || {};
            if (target.conjugationsByTense.presente) target.conjugations = target.conjugationsByTense.presente;

            // 유의어 링크도 고른 쪽 기준으로 다시 연결
            const synResult = applySynonymLinks(target, chosen._synRows || []);
            if (synResult.newIds.length > 0) _synonymFillQueue = [...synResult.newIds];

            // [냐냐 PATCH] 수정하다가 중복이 된 경우 → 두 단어를 하나로 합치고, 고치던 쪽은 삭제
            //   점수는 더 높은 쪽, 정답/오답 횟수는 합산해서 보존
            let mergedNote = '';
            if (dupState.mergeFromId && dupState.mergeFromId !== target.id) {
                const dying = vocabulary.find(v => v.id === dupState.mergeFromId);
                if (dying) {
                    target.score = clampScore(Math.max(getScore(target), getScore(dying)));
                    target.correctTotal = (target.correctTotal || 0) + (dying.correctTotal || 0);
                    target.wrongTotal = (target.wrongTotal || 0) + (dying.wrongTotal || 0);
                    if (dying.subjectivePassed) target.subjectivePassed = true;
                    syncWordFlags(target);

                    // 사라지는 단어를 유의어로 걸어둔 곳에서 링크 제거
                    vocabulary.forEach(other => {
                        if (Array.isArray(other.synonyms)) {
                            other.synonyms = other.synonyms.filter(l => l.id !== dying.id);
                        }
                    });
                    vocabulary = vocabulary.filter(v => v.id !== dying.id);
                    if (typeof logAction === 'function') logAction('undo-new-word'); // 단어 수 -1
                    mergedNote = ' (중복 단어 2개를 하나로 합쳤어요)';
                }
            }

            closeDupModal();
            closeWordModal();
            logAction('snapshot');
            renderWordList();
            updateStats();
            saveToStorage();
            showToast(side === 'old'
                ? `기존 "${target.word}" 를 남겼어요 (점수·기록 유지)${mergedNote} ✅`
                : `신규 내용으로 "${target.word}" 를 덮어썼어요 (점수·기록 유지)${mergedNote} ✅`, "success");

            if (_synonymFillQueue.length > 0) setTimeout(() => processSynonymQueue(), 250);
        }

        function saveWord() {
            const wordVal = document.getElementById('input-word').value.trim();
            const meaningVal = document.getElementById('input-meaning').value.trim();
            
            if (!wordVal || !meaningVal) {
                showToast("단어 이름과 뜻은 필수입니다!", "error");
                return;
            }

            const modalId = document.getElementById('modal-word-id').value;

            // [냐냐 PATCH-3차] "단어 + 품사"가 둘 다 같으면 → 반반 비교 편집창
            //   · 신규 등록뿐 아니라 [냐냐 PATCH] 수정할 때도 검사 (품사를 바꾸면 중복이 생길 수 있음)
            //   · 자기 자신은 제외
            {
                const posVal = document.getElementById('input-pos').value;
                const dup = findExistingWord(wordVal, posVal, modalId || null);
                if (dup) {
                    // 수정 중이면: 지금 고치던 단어(modalId)는 합쳐진 뒤 사라짐
                    openDupModal(dup, snapshotWordForm(), modalId || null);
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
                    // [냐냐 PATCH-0배치] 수정해도 점수·학습기록은 그대로 보존 (안 그러면 수정할 때마다 점수가 0으로 리셋됨)
                    const prev = vocabulary[index];
                    wordObj.score = (typeof prev.score === 'number') ? prev.score : 0;
                    wordObj.mastered = prev.mastered || false;
                    wordObj.perfect = prev.perfect || false;
                    wordObj.weak = prev.weak || false;
                    wordObj.subjectivePassed = prev.subjectivePassed || false;
                    wordObj.correctTotal = prev.correctTotal || 0;
                    wordObj.wrongTotal = prev.wrongTotal || 0;
                    if (prev.lastWrongDate) wordObj.lastWrongDate = prev.lastWrongDate;
                    wordObj.synonyms = Array.isArray(prev.synonyms) ? prev.synonyms : [];
                    // [냐냐 PATCH] 등록순 유지 — 수정해도 배열 위치를 그대로 둠 (맨 앞으로 안 올림)
                    //   등록일(createdAt)은 보존, 수정일(updatedAt)만 갱신 (정렬엔 안 쓰지만 데이터로 남김)
                    wordObj.createdAt = prev.createdAt || prev.registeredAt || null;
                    wordObj.updatedAt = Date.now();
                    vocabulary[index] = wordObj; // 제자리 교체
                    showToast("단어가 깔끔하게 수정되었습니다! ✏️", "success");
                }
                logAction('snapshot');
            } else {
                wordObj.createdAt = Date.now(); // [냐냐 PATCH] 등록 시각 기록
                vocabulary.unshift(wordObj);
                showToast("새 단어가 등록되었습니다! 📚", "success");
                logAction('new-word'); // [냐냐 PATCH] 오늘 새로 등록한 단어 수 추적
            }

            // [냐냐 PATCH-5배치] 유의어/반의어 — 미등록 단어 자동 등록 + 상대 단어에 양방향 연결
            const synResult = applySynonymLinks(wordObj, getSynonymRowsData());
            if (synResult.linkedNames.length > 0) {
                showToast(`${synResult.linkedNames.join(', ')}에도 자동으로 연결했어요 🔗`, "info");
            }
            if (synResult.newIds.length > 0) {
                _synonymFillQueue = [...synResult.newIds];
            }

            renderWordList();
            updateStats();
            if (typeof refreshBreakdownRegisterButtons === 'function') refreshBreakdownRegisterButtons();

            // [냐냐 PATCH] 지금 저장한 게 '유의어 자동채우기 큐'로 열린 단어라면
            //   → 팝업 없이 조용히 다음 큐로 넘어감 (또는 큐 끝이면 마무리)
            if (_inSynonymFill) {
                closeWordModal();
                if (_synonymFillQueue.length > 0) {
                    setTimeout(() => processSynonymQueue(), 250);
                } else {
                    _inSynonymFill = false;
                    showToast("유의어 단어 정보를 다 채웠어요! ✨", "success");
                }
                return;
            }

            // [냐냐 PATCH] 이번 저장으로 유의어가 자동 등록됐으면 → 상세정보 채울지 물어봄
            const autoCount = synResult.newIds.length;
            if (autoCount > 0) {
                closeWordModal();
                showConfirm(
                    `유의어 ${autoCount}개를 자동 등록했어요! 📚`,
                    `방금 등록한 ${autoCount}개 단어에 자세한 정보(뜻·예문 등)를 지금 채울까요? 한 창씩 차례로 열려요.`,
                    () => { _synonymFillQueue = [...synResult.newIds]; processSynonymQueue(); },
                    {
                        okLabel: '네, 채울게요',
                        cancelLabel: '나중에',
                        okStyle: 'primary',
                        icon: 'happy',
                        onCancel: () => { _synonymFillQueue = []; }
                    }
                );
                return;
            }

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
            // [냐냐 PATCH] 유의어/반의어 칸도 비움 (계속 등록 시 전 단어 유의어가 남던 버그)
            clearSynonymRows();
            const sb = document.getElementById('syn-fields-box');
            const si = document.getElementById('syn-toggle-icon');
            if (sb) sb.classList.add('hidden');
            if (si) si.className = "fa-solid fa-plus text-xs";
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
                    // [냐냐 PATCH-5배치] 이 단어를 유의어/반의어로 걸어둔 모든 단어에서 링크 자동 제거
                    vocabulary.forEach(other => {
                        if (Array.isArray(other.synonyms) && other.synonyms.some(l => l.id === wordId)) {
                            other.synonyms = other.synonyms.filter(l => l.id !== wordId);
                        }
                    });
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
                // [냐냐 PATCH] 마스터 버튼 3단계 순환 (별표와 동일한 방식)
                //   해제 → 마스터(+5) → 완벽(+8) → 해제(0)
                const gradeM = getWordGrade(w);
                if (gradeM === 'perfect') {
                    setWordScore(w, 0);
                    showToast(`"${w.word}" 마스터를 해제했어요`, "info");
                } else if (gradeM === 'mastered') {
                    setWordScore(w, SCORE_PERFECT, { subjectivePassed: true }); // 8점
                    AudioFX.playBell();
                    showToast(`"${w.word}" 완벽 단어로 올렸어요! 🏆 (8점)`, "success");
                } else {
                    setWordScore(w, SCORE_MASTER, { subjectivePassed: true }); // 5점
                    AudioFX.playBell();
                    showToast(`"${w.word}" 마스터 완료! ✅ (5점)`, "success");
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
                const ms = document.getElementById('mastery-filter-select'); if (ms) ms.value = activeFilterMastery;
                const ws = document.getElementById('weak-filter-select'); if (ws) ws.value = activeFilterWeak;
                const ss = document.getElementById('sort-select'); if (ss) ss.value = activeFilterSort;
            } catch (e) {}
        }

        // ============================================================
        // [냐냐 PATCH-6배치] 카드 표시 설정 — 어떤 정보를 보여줄지 (뜻·품사·점수는 항상 표시)
        // ============================================================
        const DISPLAY_SECTIONS = [
            { key: 'conj',    label: '동사 시제' },
            { key: 'idioms',  label: '관용구' },
            { key: 'example', label: '예문' },
            { key: 'notes',   label: '노트' },
            { key: 'synonyms',label: '유의어·반의어' }
        ];
        const DEFAULT_DISPLAY = {
            sections: DISPLAY_SECTIONS.map(s => s.key),          // 기본: 전부 표시
            tenses: TENSE_TYPE_OPTIONS.map(t => t.key)           // 기본: 모든 시제 표시
        };
        let displayPrefs = { sections: [...DEFAULT_DISPLAY.sections], tenses: [...DEFAULT_DISPLAY.tenses] };
        // [냐냐 PATCH] 설정 패널에서 편집 중인 임시 상태. [확인]을 눌러야 displayPrefs로 반영됨.
        let pendingDisplay = null;

        function isDisplayOn(key) { return displayPrefs.sections.includes(key); }
        function isTenseOn(key) { return displayPrefs.tenses.includes(key); }
        function isDisplayDefault() {
            return displayPrefs.sections.length === DEFAULT_DISPLAY.sections.length
                && displayPrefs.tenses.length === DEFAULT_DISPLAY.tenses.length;
        }
        function saveDisplayPrefs() {
            try { localStorage.setItem('nyanya_word_display', JSON.stringify(displayPrefs)); } catch (e) {}
        }
        function loadDisplayPrefs() {
            try {
                const raw = localStorage.getItem('nyanya_word_display');
                if (raw) {
                    const d = JSON.parse(raw);
                    if (Array.isArray(d.sections)) displayPrefs.sections = d.sections;
                    if (Array.isArray(d.tenses)) displayPrefs.tenses = d.tenses;
                }
            } catch (e) {}
        }

        function toggleDisplayPanel(ev) {
            if (ev && ev.stopPropagation) ev.stopPropagation();
            const panel = document.getElementById('display-panel');
            if (!panel) return;
            const willOpen = panel.classList.contains('hidden');
            if (typeof closeFilterPanel === 'function') closeFilterPanel();
            if (willOpen) {
                // 열 때 현재 설정을 임시본으로 복사 → 여기에 편집, [확인] 눌러야 반영
                pendingDisplay = { sections: [...displayPrefs.sections], tenses: [...displayPrefs.tenses] };
                renderDisplayPanel();
                panel.classList.remove('hidden');
            } else {
                panel.classList.add('hidden');
                pendingDisplay = null; // [확인] 없이 닫으면 편집 내용 버림
            }
        }
        function closeDisplayPanel() {
            const panel = document.getElementById('display-panel');
            if (panel) panel.classList.add('hidden');
            pendingDisplay = null;
        }

        function renderDisplayPanel() {
            const p = pendingDisplay || displayPrefs; // 패널은 항상 '편집 중' 상태를 그림
            const secBox = document.getElementById('display-section-box');
            const tenseBox = document.getElementById('display-tense-box');
            if (secBox) {
                secBox.innerHTML = DISPLAY_SECTIONS.map(sec => {
                    const on = p.sections.includes(sec.key);
                    const cls = on ? 'border-violet-500 bg-violet-50 text-violet-600' : 'border-slate-200 bg-slate-50 text-slate-500';
                    // [냐냐 PATCH] onclick 인라인 대신 data-속성 + 패널 위임 리스너 (렌더로 버튼 갈려도 안 깨짐)
                    return `<button type="button" data-disp-section="${sec.key}" class="text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all ${cls}">${sec.label}</button>`;
                }).join('');
            }
            if (tenseBox) {
                const conjOn = p.sections.includes('conj');
                tenseBox.innerHTML = TENSE_TYPE_OPTIONS.map(t => {
                    const on = p.tenses.includes(t.key) && conjOn;
                    const cls = !conjOn ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                              : (on ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-200 bg-slate-50 text-slate-500');
                    return `<button type="button" data-disp-tense="${t.key}" ${conjOn ? '' : 'disabled'} class="text-[11px] font-bold px-2 py-1 rounded-lg border transition-all ${cls}">${escapeHtml(t.label)}</button>`;
                }).join('');
            }
            const allBtn = document.getElementById('display-all-btn');
            if (allBtn) allBtn.innerText = (p.sections.length === 0) ? '전부 선택' : '전부 해제';
        }

        // [냐냐 PATCH] 패널 전체에 클릭 위임 — 버튼이 다시 그려져도 항상 동작
        //   ⭐ 편집은 pendingDisplay(임시본)에만 한다. 실제 반영은 [확인]에서.
        function _displayPanelClick(ev) {
            const t = ev.target.closest('[data-disp-section],[data-disp-tense],[data-disp-action]');
            if (!t) return;
            ev.stopPropagation();
            if (!pendingDisplay) pendingDisplay = { sections: [...displayPrefs.sections], tenses: [...displayPrefs.tenses] };

            if (t.hasAttribute('data-disp-section')) {
                const key = t.getAttribute('data-disp-section');
                const i = pendingDisplay.sections.indexOf(key);
                if (i >= 0) pendingDisplay.sections.splice(i, 1); else pendingDisplay.sections.push(key);
            } else if (t.hasAttribute('data-disp-tense')) {
                if (t.disabled) return;
                const key = t.getAttribute('data-disp-tense');
                const i = pendingDisplay.tenses.indexOf(key);
                if (i >= 0) pendingDisplay.tenses.splice(i, 1); else pendingDisplay.tenses.push(key);
            } else if (t.getAttribute('data-disp-action') === 'all') {
                if (pendingDisplay.sections.length === 0) {
                    pendingDisplay.sections = [...DEFAULT_DISPLAY.sections];
                    pendingDisplay.tenses = [...DEFAULT_DISPLAY.tenses];
                } else { pendingDisplay.sections = []; }
            } else if (t.getAttribute('data-disp-action') === 'reset') {
                pendingDisplay = { sections: [...DEFAULT_DISPLAY.sections], tenses: [...DEFAULT_DISPLAY.tenses] };
            } else if (t.getAttribute('data-disp-action') === 'apply') {
                // ⭐ [확인] — 이때 비로소 실제 반영 + 저장. 카드 펼침 상태 유지.
                if (pendingDisplay) {
                    displayPrefs = { sections: [...pendingDisplay.sections], tenses: [...pendingDisplay.tenses] };
                    saveDisplayPrefs();
                }
                closeDisplayPanel();
                renderWordList();
                if (typeof restoreExpandedCards === 'function') restoreExpandedCards();
                return;
            }
            renderDisplayPanel(); // 임시본 기준으로 패널만 다시 그림 (목록은 안 건드림)
        }
        // 패널에 리스너 한 번만 부착
        (function attachDisplayPanelListener() {
            function bind() {
                const panel = document.getElementById('display-panel');
                if (panel && !panel._dispBound) { panel.addEventListener('click', _displayPanelClick); panel._dispBound = true; }
            }
            if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
            else bind();
            setTimeout(bind, 500); // 안전망
        })();

        // 예전 이름 호환
        function toggleDisplaySection(key){ const b=document.querySelector('[data-disp-section="'+key+'"]'); if(b) b.click(); }
        function toggleDisplayTense(key){ const b=document.querySelector('[data-disp-tense="'+key+'"]'); if(b) b.click(); }
        function toggleAllDisplay(){ const b=document.querySelector('[data-disp-action="all"]'); if(b) b.click(); }
        function resetDisplayPrefs(){ const b=document.querySelector('[data-disp-action="reset"]'); if(b) b.click(); }
        function applyDisplayPrefs(){ const b=document.querySelector('[data-disp-action="apply"]'); if(b) b.click(); else closeDisplayPanel(); }

        // [냐냐 PATCH-6배치] 카드 안의 동사 변형표 — 등록된 시제 중 "설정에서 켠 시제"만 전부 표시
        function buildCardConjHtml(w) {
            const byTense = w.conjugationsByTense || {};
            const irrByTense = w.irregularByTense || {};
            const vcByTense = w.verbClassByTense || {};
            const hasValues = (c) => c && (c.yo || c.tu || c.el || c.nos || c.vos || c.ellos || c.form);

            let keys = Object.keys(byTense).filter(k => hasValues(byTense[k]));
            if (!keys.includes('presente') && hasValues(w.conjugations)) keys.unshift('presente');
            keys = keys.filter(k => isTenseOn(k));
            if (keys.length === 0) return '';

            const orderOf = (k) => { const i = TENSE_TYPE_OPTIONS.findIndex(t => t.key === k); return i < 0 ? 99 : i; };
            keys.sort((a, b) => orderOf(a) - orderOf(b));
            const labelOf = (k) => { const o = TENSE_TYPE_OPTIONS.find(t => t.key === k); return o ? o.label : k; };

            return keys.map(k => {
                const c = byTense[k] || (k === 'presente' ? w.conjugations : null);
                if (!hasValues(c)) return '';
                const irrType = irrByTense[k] || ((k === 'presente') ? (w.irregularType || '') : '');
                const verbClass = vcByTense[k] || ((irrType && irrType !== 'none') ? 'irregular' : (k === 'presente' ? (w.verbClass || 'regular') : 'regular'));
                const clsText = (verbClass === 'regular' || !irrType || irrType === 'none') ? '규칙' : `불규칙(${irrType})`;

                const body = (c.form && !c.yo)
                    ? `<div class="text-center py-1"><span class="text-sm font-black text-slate-800">${escapeHtml(c.form)}</span></div>`
                    : `<div class="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                            ${getConjugationCellMarkup('yo', c.yo, verbClass, irrType)}
                            ${getConjugationCellMarkup('tú', c.tu, verbClass, irrType)}
                            ${getConjugationCellMarkup('él', c.el, verbClass, irrType)}
                            ${getConjugationCellMarkup('nos', c.nos, verbClass, irrType)}
                            ${getConjugationCellMarkup('vos', c.vos, verbClass, irrType)}
                            ${getConjugationCellMarkup('ellos', c.ellos, verbClass, irrType)}
                        </div>`;

                return `
                <div class="bg-slate-50/80 rounded-2xl p-2.5 border border-slate-100 space-y-1">
                    <div class="flex items-center justify-between">
                        <span class="block text-[9px] font-bold text-indigo-500 tracking-wider uppercase">
                            ${escapeHtml(labelOf(k))} <span class="text-indigo-600 font-extrabold ml-1">(${escapeHtml(clsText)})</span>
                        </span>
                    </div>
                    ${body}
                </div>`;
            }).filter(Boolean).join('<div class="h-2"></div>');
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
            currentPage = 1; // [냐냐 PATCH-페이지네이션] 필터 바꾸면 1페이지로
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
            currentPage = 1; // [냐냐 PATCH-페이지네이션] 필터 초기화 시 1페이지로
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
            closeDisplayPanel(); // [6배치] 두 패널이 동시에 열리지 않게
            panel.classList.toggle('hidden');
            if (willOpen) syncFilterPanelUI();
        }

        // [냐냐 요청] 검색: 타이핑 중엔 렌더 안 함(렉 방지). 엔터 눌러야 검색.
        //   단, 검색창을 완전히 비우면 자동으로 전체 목록 복귀.
        function handleSearchInput() {
            const val = document.getElementById('search-bar').value;
            document.getElementById('search-clear-btn').classList.toggle('hidden', !val);
            if (val.trim()) todayWrongFilterActive = false;
            // 완전히 비우면 즉시 전체 복귀 (엔터 불필요)
            if (!val.trim()) {
                currentPage = 1;
                renderWordList();
            }
        }

        // [냐냐 요청] 엔터로 검색 실행
        function runSearch() {
            currentPage = 1;
            renderWordList();
        }

        function clearSearch() {
            const bar = document.getElementById('search-bar');
            bar.value = '';
            document.getElementById('search-clear-btn').classList.add('hidden');
            bar.focus();
            currentPage = 1; // [냐냐 PATCH-페이지네이션] 검색 지우면 1페이지부터
            renderWordList();
        }

        let wordListExpandedAll = false; // [냐냐 PATCH] 단어 카드 전체 펼침 상태 (기본 접힘)

        // [냐냐 PATCH-페이지네이션] 성능: 단어 850개+ 대응. 한 페이지에 50개씩만 렌더.
        //   currentPage는 일반 변수 → 메뉴 이동 시 유지, 새로고침 시 1로 리셋 (localStorage 저장 안 함)
        const WORDS_PER_PAGE = 12;
        let currentPage = 1;

        // ============================================================
        // [냐냐 요청] 쓰기 연습 — 지금 보고 있는 단어장 목록으로 스페인어를 2번씩 따라 쓴다.
        //   · 목록은 랜덤 순서 (같은 단어만 반복해서 만나지 않도록)
        //   · 정답을 보면서 그대로 입력 (철자·악센트를 손에 익히는 교정 연습)
        //   · 점수는 변하지 않음. 페이지 이동 없이 세션 안에서 끝까지 진행
        // ============================================================
        const WRITE_PRACTICE_TIMES = 2;
        let lastFilteredWords = [];
        let writePracticeState = null;

        function updateWritePracticeBtn() {
            const btn = document.getElementById('write-practice-btn');
            if (!btn) return;
            const n = lastFilteredWords.length;
            const cnt = document.getElementById('write-practice-count');
            if (cnt) cnt.innerText = n + '개';
            btn.disabled = n === 0;
            btn.classList.toggle('opacity-40', n === 0);
            btn.classList.toggle('cursor-not-allowed', n === 0);
        }

        // ============================================================
        // [냐냐 요청] 복습 탭 '쓰기' 설정 — 개수 / 범위 (단어만, 가볍게)
        // ============================================================
        let writeCount = 10;
        let writeScope = 'not-mastered';

        function selectWriteCount(n) {
            writeCount = n;
            document.querySelectorAll('.write-count-btn').forEach(b => {
                const on = Number(b.dataset.writeCount) === n;
                b.classList.toggle('border-indigo-500', on);
                b.classList.toggle('bg-indigo-50', on);
                b.classList.toggle('text-indigo-700', on);
                b.classList.toggle('border-slate-200', !on);
                b.classList.toggle('text-slate-600', !on);
            });
        }

        function selectWriteScope(scope) {
            writeScope = scope;
            document.querySelectorAll('.write-scope-btn').forEach(b => {
                const on = b.dataset.writeScope === scope;
                b.classList.toggle('border-indigo-500', on);
                b.classList.toggle('bg-indigo-50', on);
                b.classList.toggle('text-indigo-700', on);
                b.classList.toggle('border-slate-200', !on);
                b.classList.toggle('text-slate-600', !on);
            });
            const el = document.getElementById('write-scope-count');
            if (el) {
                const n = getWriteScopePool().length;
                el.innerText = n > 0 ? `이 범위에 ${n}개 있어요` : '이 범위엔 단어가 없어요';
            }
        }

        function getWriteScopePool() {
            if (writeScope === 'weak') return vocabulary.filter(w => w.weak && !w.mastered);
            if (writeScope === 'not-mastered') return vocabulary.filter(w => !w.mastered);
            return vocabulary.slice();
        }

        function resetWriteSetup() {
            selectWriteCount(writeCount || 10);
            selectWriteScope(writeScope || 'not-mastered');
            const setup = document.getElementById('write-setup');
            if (setup) setup.classList.remove('hidden');
            // [냐냐 요청] 인라인 진행 영역도 같이 정리 (진행 중이면 changeTab이 여기까지 안 옴)
            const play = document.getElementById('write-play-area');
            if (play) { play.classList.add('hidden'); play.innerHTML = ''; }
        }

        // [냐냐 요청] 쓰기는 '단어'만. 관용구·예문은 단어 빈칸이 이미 다루므로 여기선 안 씀.
        function startWriteReview() {
            const pool = getWriteScopePool().filter(w => w && w.word);
            if (!pool.length) { showToast("이 범위엔 단어가 없어요! 다른 범위를 골라보세요.", "error"); return; }
            const picked = shuffleArray(pool.slice()).slice(0, writeCount);
            const setup = document.getElementById('write-setup');
            if (setup) setup.classList.add('hidden');
            beginWritePractice(picked, { isTodayReview: false, onClose: () => { if (setup) setup.classList.remove('hidden'); } });
        }

        function startWritePractice() {
            const pool = (lastFilteredWords || []).filter(w => w && w.word);
            if (!pool.length) { showToast("연습할 단어가 없어요!", "error"); return; }
            beginWritePractice(pool, { isTodayReview: false });
        }

        // [냐냐 요청] 쓰기 연습 공용 시작점.
        //   1바퀴: 단어를 보면서 2번씩 쓰기 (익히기)
        //   2바퀴: 순서를 다시 섞고, 단어를 가린 채 뜻만 보고 1번 쓰기 (확인)
        //   isTodayReview면 2바퀴 첫 시도 결과로 망각곡선을 단어당 1회 반영 (점수는 안 건드림)
        //   [냐냐 요청] 팝업 폐지 → 복습 탭 '✍️ 쓰기' 영역 안에서 진행.
        //     단어장 ✍️ 버튼·헤더 📖 복습 배너에서 불러도 복습 탭으로 이동해서 거기서 푼다.
        function beginWritePractice(pool, opts) {
            // ⚠️ 순서 중요: changeTab('review')는 진행 중이 아니면 resetReviewTab()을 부르므로
            //    state를 세팅하기 '전에' 탭부터 옮긴다.
            if (typeof changeTab === 'function' && typeof activeTab !== 'undefined' && activeTab !== 'review') {
                changeTab('review');
            }
            if (typeof selectReviewMode === 'function') selectReviewMode('write');

            writePracticeState = {
                pool: shuffleArray(pool.slice()),
                index: 0,
                done: 0,
                phase: 1,                 // 1 = 보고 쓰기, 2 = 가리고 쓰기
                retry: false,             // 2바퀴에서 틀린 뒤 '정답 보고 한 번 더' 중인지
                wrongCount: 0,
                isTodayReview: !!(opts && opts.isTodayReview),
                onClose: (opts && opts.onClose) || null
            };

            const setup = document.getElementById('write-setup');
            const play = document.getElementById('write-play-area');
            if (setup) setup.classList.add('hidden');
            if (play) { play.classList.remove('hidden'); play.innerHTML = ''; }
            renderWritePractice();
        }

        function closeWritePractice() {
            const cb = writePracticeState && writePracticeState.onClose;
            writePracticeState = null;
            const play = document.getElementById('write-play-area');
            if (play) { play.classList.add('hidden'); play.innerHTML = ''; }
            const setup = document.getElementById('write-setup');
            if (setup) setup.classList.remove('hidden');
            if (typeof cb === 'function') { try { cb(); } catch (e) {} }
        }

        function renderWritePractice() {
            const s = writePracticeState;
            const body = document.getElementById('write-play-area');
            if (!s || !body) return;

            // [냐냐 요청] 인라인 카드 껍데기 — 다른 복습 모드(깜빡이·단어빈칸)와 같은 골격
            const wrap = (inner) => `
                <div class="bg-white border border-slate-200 rounded-3xl p-6 space-y-4">
                    <div class="flex items-center justify-between">
                        <button onclick="closeWritePractice()" class="text-xs font-bold text-slate-400 hover:text-slate-600"><i class="fa-solid fa-arrow-left"></i> 나가기</button>
                        <span class="text-xs font-bold text-slate-500"><i class="fa-solid fa-pen-to-square text-amber-500 mr-1"></i>보고 2번 → 가리고 1번</span>
                    </div>
                    ${inner}
                </div>`;

            if (s.index >= s.pool.length) {
                if (s.phase === 1) {
                    // [냐냐 요청] 1바퀴(보고 2번) 끝 → 순서 다시 섞어서 2바퀴(가리고 1번)로
                    s.phase = 2;
                    s.pool = shuffleArray(s.pool.slice());
                    s.index = 0;
                    s.done = 0;
                    s.retry = false;
                    s.showDetail = false;
                    body.innerHTML = wrap(`
                        <div class="text-center space-y-4 py-6">
                            <div class="text-5xl">🙈</div>
                            <p class="text-lg font-bold text-slate-900">이제 가리고 써볼 차례!</p>
                            <p class="text-xs font-bold text-slate-500 leading-relaxed">뜻만 보고 스페인어를 떠올려서 쓰세요.<br>순서는 다시 섞었어요.</p>
                            <button id="write-phase2-btn" onclick="renderWritePractice()" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl text-sm font-bold transition-all active:scale-95">2바퀴 시작 (Enter) →</button>
                        </div>`);
                    // [냐냐 요청] 엔터로도 시작되게 버튼에 포커스
                    setTimeout(() => { const b = document.getElementById('write-phase2-btn'); if (b) b.focus(); }, 60);
                    return;
                }
                // 2바퀴까지 끝 → 결과
                const total = s.pool.length;
                const ok = total - s.wrongCount;
                const reviewNote = `<p class="text-xs font-bold text-violet-600">📖 복습·점수에 반영했어요 (단어당 1회)</p>`;
                let nextBtn = '';
                if (s.isTodayReview && typeof getReviewDueWords === 'function') {
                    const remain = getReviewDueWords().length;
                    if (remain > 0) {
                        nextBtn = `<button onclick="closeWritePractice(); startTodayReviewShortcut();" class="w-full bg-violet-600 hover:bg-violet-700 text-white py-3 rounded-xl text-sm font-bold transition-all active:scale-95">다음 ${Math.min(remain, 10)}개 이어서 →</button>`;
                    }
                }
                body.innerHTML = wrap(`
                    <div class="text-center space-y-4 py-6">
                        <div class="text-5xl">🎉</div>
                        <p class="text-lg font-bold text-slate-900">${total}개 다 썼어요!</p>
                        <p class="text-sm font-bold text-slate-600">가리고 쓰기: <span class="text-emerald-600">${ok}개 성공</span>${s.wrongCount ? ` · <span class="text-rose-500">${s.wrongCount}개는 정답 보고 다시 씀</span>` : ''}</p>
                        ${reviewNote}
                        ${nextBtn}
                        <button onclick="closeWritePractice()" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl text-sm font-bold transition-all active:scale-95">설정으로 돌아가기</button>
                    </div>`);
                return;
            }

            const w = s.pool[s.index];
            const dotsCount = s.phase === 1 ? WRITE_PRACTICE_TIMES : 1;
            const dots = Array.from({ length: dotsCount }, (_, k) =>
                `<span class="w-2.5 h-2.5 rounded-full ${k < s.done ? 'bg-emerald-500' : 'bg-slate-200'}"></span>`).join('');
            const pct = Math.round(s.index / s.pool.length * 100);

            // [냐냐 요청] 품사 뱃지
            const posLabel = (typeof POS_LABELS !== 'undefined' && POS_LABELS[w.pos]) ? POS_LABELS[w.pos] : (w.pos || '');
            const posHtml = posLabel
                ? `<span class="inline-block text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded-lg px-2 py-0.5">${escapeHtml(posLabel)}</span>`
                : '';

            // [냐냐 요청] 1바퀴 카드는 "퀴즈 정답 화면"과 같은 양식으로 정보를 전부 펼쳐서 보여줌
            //   (펴기/접기 없음. 관용구·예문·유의어·반의어·노트는 buildNotesHtml, 동사변형은 renderQuizConjugation이 담당)

            // [냐냐 요청] 바퀴별 카드 — 1바퀴: 전체 정보 / 2바퀴: 가림(뜻만) / 2바퀴 틀림: 정답 공개
            let cardHtml, inputLabel, placeholder;
            if (s.phase === 1) {
                const badges = (typeof buildWordBadgesHtml === 'function') ? buildWordBadgesHtml(w) : '';
                const notes = (typeof buildNotesHtml === 'function') ? buildNotesHtml(w, {}) : '';
                const parts = [badges, notes].filter(x => x && x.trim());
                cardHtml = `
                    <div class="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-1 max-h-[42vh] overflow-y-auto no-scrollbar">
                        <div class="text-center space-y-1">
                            <p class="text-2xl font-extrabold text-slate-900 break-words">${escapeHtml(w.word)}</p>
                            <p class="text-sm font-bold text-slate-500 break-words">${escapeHtml(w.meaning || '')}</p>
                        </div>
                        ${parts.length ? '<div class="border-t border-slate-200 my-2"></div>' + parts.join('<div class="border-t border-slate-100 my-3"></div>') : ''}
                        <div id="write-conj-box" class="hidden"></div>
                    </div>`;
                inputLabel = '보고 그대로 쓰세요 (엔터)';
                placeholder = w.word;
            } else if (!s.retry) {
                cardHtml = `
                    <div class="bg-violet-50 rounded-2xl border border-violet-200 p-5 text-center space-y-1">
                        ${posHtml}
                        <p class="text-2xl font-extrabold text-violet-300 tracking-widest select-none">? ? ?</p>
                        <p class="text-base font-extrabold text-slate-800 break-words">${escapeHtml(w.meaning || '')}</p>
                    </div>`;
                inputLabel = '떠올려서 쓰세요 (엔터)';
                placeholder = '스페인어로...';
            } else {
                cardHtml = `
                    <div class="bg-rose-50 rounded-2xl border border-rose-200 p-5 text-center space-y-1">
                        ${posHtml}
                        <p class="text-2xl font-extrabold text-rose-600 break-words">${escapeHtml(w.word)}</p>
                        <p class="text-sm font-bold text-slate-500 break-words">${escapeHtml(w.meaning || '')}</p>
                        <p class="text-[10px] font-bold text-rose-400 pt-0.5">아쉬워요! 정답을 보고 한 번 더 쓰면 넘어가요</p>
                    </div>`;
                inputLabel = '정답을 보고 한 번 더 (엔터)';
                placeholder = w.word;
            }

            body.innerHTML = wrap(`
                <div class="space-y-4">
                    <div>
                        <div class="flex items-center justify-between mb-1.5">
                            <span class="text-[11px] font-bold ${s.phase === 2 ? 'text-violet-500' : 'text-slate-400'}">${s.phase === 1 ? '1바퀴 · 보고 쓰기' : '2바퀴 · 가리고 쓰기'} &nbsp;${s.index + 1} / ${s.pool.length}</span>
                            <span class="flex items-center gap-1.5">${dots}</span>
                        </div>
                        <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div class="h-full ${s.phase === 2 ? 'bg-violet-500' : 'bg-indigo-500'} transition-all" style="width:${pct}%"></div>
                        </div>
                    </div>

                    ${cardHtml}

                    <div class="space-y-1.5">
                        <label class="block text-xs font-bold text-slate-500">${inputLabel}</label>
                        <input id="write-practice-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                            onkeydown="writePracticeKeydown(event)"
                            class="w-full px-3 py-2.5 rounded-xl border-2 ${s.phase === 2 && !s.retry ? 'border-violet-300 bg-violet-50/40 focus:ring-violet-400' : 'border-indigo-300 bg-indigo-50/40 focus:ring-indigo-400'} text-base font-bold focus:outline-none focus:ring-2"
                            placeholder="${escapeHtml(placeholder)}">
                        <p id="write-practice-hint" class="text-[11px] font-bold text-slate-400">악센트까지 정확히 써야 넘어가요</p>
                    </div>

                    <div class="flex gap-2">
                        <button onclick="skipWritePractice()" class="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-bold transition-all">건너뛰기</button>
                        <button onclick="closeWritePractice()" class="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-bold transition-all">그만하기</button>
                    </div>
                </div>`);
            // [냐냐 요청] 1바퀴에서 동사면 등록된 시제 전부 (퀴즈 정답 화면과 동일한 렌더러 재사용)
            if (s.phase === 1 && typeof renderQuizConjugation === 'function') {
                renderQuizConjugation(w, null, 'write-conj-box');
            }
            setTimeout(() => { const el = document.getElementById('write-practice-input'); if (el) el.focus(); }, 60);
            // [냐냐 요청] 1바퀴(보고 쓰기)에서만 단어를 읽어줌. 2바퀴는 정답이 새어나가므로 안 읽음.
            if (s.phase === 1 && s.done === 0 && typeof speakSpanishVoice === 'function') {
                setTimeout(() => speakSpanishVoice(w.word), 120);
            }
        }

        // [냐냐 요청] 단어 정보 펼치기/접기. 다시 그리므로 입력 중이던 값은 보존한다.
        function toggleWritePracticeDetail() {
            if (!writePracticeState) return;
            const el = document.getElementById('write-practice-input');
            const keep = el ? el.value : '';
            writePracticeState.showDetail = !writePracticeState.showDetail;
            renderWritePractice();
            const el2 = document.getElementById('write-practice-input');
            if (el2) el2.value = keep;
        }

        function skipWritePractice() {
            if (!writePracticeState) return;
            writePracticeState.index++;
            writePracticeState.done = 0;
            writePracticeState.retry = false;
            writePracticeState.showDetail = false;
            renderWritePractice();
        }

        function writePracticeFlashWrong(el) {
            el.classList.add('border-red-400', 'bg-red-50');
            const hint = document.getElementById('write-practice-hint');
            if (hint) { hint.innerText = '다시 한 번 — 철자를 확인해 보세요'; hint.className = 'text-[11px] font-bold text-red-500'; }
            setTimeout(() => el.classList.remove('border-red-400', 'bg-red-50'), 500);
            el.select();
        }

        function writePracticeKeydown(e) {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const s = writePracticeState;
            const el = document.getElementById('write-practice-input');
            if (!s || !el) return;
            const w = s.pool[s.index];
            // 철자 연습이므로 악센트까지 정확히. 대소문자와 앞뒤·중복 공백만 관대하게 처리
            const norm = (t) => t.trim().toLowerCase().replace(/\s+/g, ' ');
            const isMatch = norm(el.value) === norm(w.word);

            // ── 1바퀴: 보면서 2번 쓰기 ──
            if (s.phase === 1) {
                if (isMatch) {
                    s.done++;
                    if (s.done >= WRITE_PRACTICE_TIMES) { s.index++; s.done = 0; s.showDetail = false; }
                    else el.value = '';
                    renderWritePractice();
                } else {
                    writePracticeFlashWrong(el);
                }
                return;
            }

            // ── 2바퀴: 가리고 쓰기 ──
            if (s.retry) {
                // 틀린 뒤 '정답 보고 한 번 더' — 정확히 써야 넘어감
                if (isMatch) { s.retry = false; s.index++; s.done = 0; renderWritePractice(); }
                else writePracticeFlashWrong(el);
                return;
            }
            // 첫 시도 — 여기서만 점수·복습 반영 (단어당 1회)
            if (isMatch) {
                // [냐냐 요청] 가리고 쓰기 정답 +0.4 (쓰기연습·복습 동일)
                if (typeof addWordScore === 'function') addWordScore(w.id, 0.4, { correct: true });
                if (typeof markWordReviewedToday === 'function') markWordReviewedToday(w.id, true);
                writePracticeSave();
                s.index++;
                s.done = 0;
                renderWritePractice();
            } else {
                s.wrongCount++;
                s.retry = true;
                // [냐냐 요청] 가리고 쓰기 오답 −2 → 틀린 날짜도 오늘로 바로 기록되고 곡선 재시작
                if (typeof addWordScore === 'function') addWordScore(w.id, -2, { correct: false });
                if (typeof markWordReviewedToday === 'function') markWordReviewedToday(w.id, false);
                writePracticeSave();
                renderWritePractice();
            }
        }

        // 저장 + 헤더(복습 배너·통계) 갱신
        function writePracticeSave() {
            try { if (typeof saveToStorage === 'function') saveToStorage(); } catch (err) {}
            if (typeof updateStats === 'function') updateStats();
        }

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
                // [냐냐 요청] '오늘 틀린 단어'는 말 그대로 오늘 틀린 것만. (복습 주기는 헤더 배너가 담당)
                const matchesTodayWrong = !todayWrongFilterActive || (!w.mastered && w.lastWrongDate && daysSince(w.lastWrongDate) === 0);
                return matchesSearch && matchesPos && matchesMastery && matchesWeak && matchesTodayWrong;
            });

            // [냐냐 PATCH] 필터/정렬 요약 한 줄 + 활성 표시점
            renderFilterSummary();
            const sortModeForBadge = activeFilterSort;
            const hasActiveFilter = activeFilterPos.length > 0 || activeFilterMastery !== 'not-mastered' || activeFilterWeak !== 'all' || sortModeForBadge !== 'weak-score';
            // [냐냐 PATCH] 점 배지 대신 버튼 자체의 배경색을 바꿔서 표시
            const ON = "w-10 h-10 bg-violet-100 hover:bg-violet-200 rounded-xl border border-violet-400 text-sm text-violet-700 transition-all flex items-center justify-center";
            const OFF = "w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-sm text-slate-600 transition-all flex items-center justify-center";
            const fBtn = document.getElementById('filter-panel-btn');
            if (fBtn) fBtn.className = hasActiveFilter ? ON : OFF;
            const dBtn = document.getElementById('display-panel-btn');
            if (dBtn) dBtn.className = isDisplayDefault() ? OFF : ON;

            // [냐냐 PATCH] 단어 목록은 항상 ABC순(정관사 제외) — 검색 결과도 정렬
            const sortMode = isSearching ? 'alpha-asc' : activeFilterSort;

            // [냐냐 PATCH] 정렬용으로만 맨 앞 정관사/부정관사를 떼어냄 (단수·복수 모두)
            // 예: "el libro" → "libro", "las casas" → "casas". 화면에 보이는 단어는 그대로 유지됨.
            const stripArticle = (w) => {
                return (w || '')
                    .toLowerCase()
                    .trim()
                    .replace(/^(el\/la|los\/las|el|la|los|las|un|una|unos|unas)\s+/, '')
                    // [냐냐 PATCH] 알파벳 정렬 시 기호는 무시 (¿ ¡ [ ] ( ) ~ - · , . 등)
                    .replace(/[^\p{L}\p{N}\s]/gu, '')
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
                renderPagination(0, 0); // [냐냐 PATCH-페이지네이션] 결과 없으면 바도 숨김
                lastFilteredWords = []; // [냐냐 요청] 쓰기 연습이 쓸 목록
                updateWritePracticeBtn();
                return;
            }
            emptyState.classList.add('hidden');
            // [냐냐 요청] 지금 보고 있는 목록(필터·검색 반영)을 쓰기 연습에서 그대로 사용
            lastFilteredWords = filteredSorted;
            updateWritePracticeBtn();

            // [냐냐 PATCH-페이지네이션] 검색 중엔 페이지 없이 전체 표시, 아니면 50개씩 잘라 그림
            let pageItems = filteredSorted;
            let totalPages = 1;
            if (!isSearching) {
                totalPages = Math.max(1, Math.ceil(filteredSorted.length / WORDS_PER_PAGE));
                // 필터/정렬로 결과가 줄어서 현재 페이지가 범위를 벗어나면 마지막 페이지로 보정
                if (currentPage > totalPages) currentPage = totalPages;
                if (currentPage < 1) currentPage = 1;
                const start = (currentPage - 1) * WORDS_PER_PAGE;
                pageItems = filteredSorted.slice(start, start + WORDS_PER_PAGE);
            }
            // 검색 중이면 페이지 바 숨김, 아니면 렌더
            renderPagination(isSearching ? 0 : totalPages, filteredSorted.length);

            let html = '';
            pageItems.forEach(w => {
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

                // [냐냐 PATCH] 정답률 배지 — 카드 우측 하단, 점수 배지 왼쪽으로 이동 (시도 3회 이상일 때만)
                const acc = getWordAccuracy(w);
                let accHtml = '';
                if (acc !== null) {
                    const accColor = acc >= 80 ? 'bg-emerald-100 text-emerald-700'
                        : acc >= 50 ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-100 text-rose-600';
                    accHtml = `<span class="px-2 py-0.5 text-[11px] font-black rounded-lg ${accColor}" title="이번 달 정답률 (정답 ${w.correctTotal||0} / 시도 ${(w.correctTotal||0)+(w.wrongTotal||0)})">${acc}%</span>`;
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
                <div class="rounded-3xl p-5 ${cardStyle} flex flex-col justify-between hover:shadow-md transition-all duration-300 relative group gap-3">
                    <!-- [냐냐 PATCH] 우측 하단: [정답률] [점수] -->
                    <div class="absolute bottom-2.5 right-3.5 flex items-center gap-1.5 pointer-events-none select-none">
                        ${accHtml}
                        <span class="px-2 py-0.5 text-[11px] font-black rounded-lg ${gi.badge}" title="${gi.label} · 통합 점수 (${SCORE_MIN} ~ ${SCORE_MAX})">${formatScore(w)}</span>
                    </div>
                    <div class="space-y-2.5">
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
                        <div class="word-card-body space-y-2 ${expandedAll ? '' : 'hidden'}" data-card-body="${w.id}">${buildCardBody(w)}</div>
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

        // [냐냐 PATCH-페이지네이션] 페이지 바 렌더. totalPages<=1 이거나 0이면 숨김
        function renderPagination(totalPages, totalCount) {
            let bar = document.getElementById('vocab-pagination');
            if (!bar) {
                // grid 바로 아래에 바 하나 만들어 둠
                const grid = document.getElementById('vocabulary-grid');
                bar = document.createElement('div');
                bar.id = 'vocab-pagination';
                grid.parentNode.insertBefore(bar, grid.nextSibling);
            }
            if (!totalPages || totalPages <= 1) { bar.innerHTML = ''; bar.classList.add('hidden'); return; }
            bar.classList.remove('hidden');

            const atFirst = currentPage <= 1;
            const atLast = currentPage >= totalPages;
            // [냐냐 요청] 톤다운: 파란 네모 제거, 심플한 회색 텍스트 버튼 + 크기 축소
            const ACT = "w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-indigo-600 font-bold text-xs transition-all active:scale-90";
            const DIS = "w-8 h-8 flex items-center justify-center rounded-lg text-slate-200 font-bold text-xs cursor-not-allowed";
            const btn = (icon, onclick, disabled, title) =>
                `<button ${disabled ? 'disabled' : `onclick="${onclick}"`} title="${title}" class="${disabled ? DIS : ACT}"><i class="fa-solid ${icon}"></i></button>`;

            bar.innerHTML = `
                <div class="flex items-center justify-center gap-1 mt-4 mb-1.5">
                    ${btn('fa-angles-left', 'gotoPage(1)', atFirst, '맨 앞')}
                    ${btn('fa-angle-left', `gotoPage(${currentPage - 1})`, atFirst, '이전')}
                    <div class="flex items-center gap-1 px-1.5">
                        <input id="page-jump-input" type="number" min="1" max="${totalPages}" value="${currentPage}"
                            onkeydown="if(event.key==='Enter'){event.preventDefault();jumpToPage();}"
                            onblur="jumpToPage()"
                            class="w-10 h-7 text-center text-sm font-bold text-indigo-600 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none">
                        <span class="text-xs font-bold text-slate-400">/ ${totalPages}</span>
                    </div>
                    ${btn('fa-angle-right', `gotoPage(${currentPage + 1})`, atLast, '다음')}
                    ${btn('fa-angles-right', `gotoPage(${totalPages})`, atLast, '맨 뒤')}
                </div>
                <p class="text-center text-[10px] font-semibold text-slate-300 mb-1">총 ${totalCount}개 단어</p>
            `;
        }

        // [냐냐 요청] 페이지 직접 입력 → 엔터/포커스아웃 시 이동
        function jumpToPage() {
            const inp = document.getElementById('page-jump-input');
            if (!inp) return;
            let n = parseInt(inp.value, 10);
            const max = parseInt(inp.getAttribute('max'), 10) || 1;
            if (isNaN(n)) { inp.value = currentPage; return; } // 잘못 입력하면 원래대로
            if (n < 1) n = 1;
            if (n > max) n = max;
            if (n === currentPage) { inp.value = currentPage; return; } // 그대로면 무시
            gotoPage(n);
        }

        // [냐냐 PATCH-페이지네이션] 페이지 이동 + 목록 맨 위로 스크롤
        function gotoPage(page) {
            if (page < 1) page = 1;
            currentPage = page;
            renderWordList();
            // 목록 맨 위로 스크롤 (검색바 sticky 아래로 자연스럽게)
            const grid = document.getElementById('vocabulary-grid');
            if (grid) {
                const top = grid.getBoundingClientRect().top + window.scrollY - 120;
                window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
            }
        }

        // [냐냐 PATCH] 전체 접기/펼치기 버튼 토글
        function toggleExpandAllBtn() {
            const btn = document.getElementById('expand-all-btn');
            const willExpand = !wordListExpandedAll;
            setAllWordCards(willExpand);
            if (btn) {
                // [냐냐 PATCH-6배치] 아이콘만 남겨서 span이 없음 → 툴팁(title)과 아이콘만 바꿔줌
                btn.title = willExpand ? '전체 접기' : '전체 펼치기';
                const icon = btn.querySelector('i');
                if (icon) icon.className = willExpand ? 'fa-solid fa-down-left-and-up-right-to-center' : 'fa-solid fa-up-right-and-down-left-from-center';
            }
        }

        // [냐냐 PATCH] 단어 카드 하나 접기/펼치기
        // [냐냐 PATCH] 어떤 카드가 펼쳐져 있는지 기억 (설정 바꿔서 다시 그려도 유지)
        const expandedCardIds = new Set();

        // [냐냐 PATCH-성능] 카드 본문 HTML을 따로 생성 — 접힌 카드는 본문을 아예 안 만들고,
        //   펼칠 때(toggleWordCard) 그때 채운다 → 750개 카드도 처음엔 헤더만 그려서 훨씬 가벼움
        function buildCardBody(w) {
            const isVerb = w.pos === 'verb';
            return `
                        <!-- Meaning section -->
                        <div class="space-y-1">
                            <p class="text-sm font-bold text-slate-500 flex items-center gap-1.5">
                                <span class="w-1.5 h-1.5 bg-violet-500 rounded-full"></span>
                                <span>뜻:</span>
                                <strong class="text-slate-800 font-bold">${w.meaning}</strong>
                            </p>
                        </div>

                        <!-- [냐냐 PATCH-6배치] 동사 변형표 — 설정에서 체크된 시제만, 등록된 시제 전부 -->
                        ${(isVerb && isDisplayOn('conj')) ? buildCardConjHtml(w) : ''}

                        <!-- 관용구 먼저, 예문 나중 (순서 변경) -->
                        ${(() => {
                            if (!isDisplayOn('idioms')) return '';
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
                        ${(w.example && isDisplayOn('example')) ? `
                        <div class="bg-teal-50/40 border-l-2 border-teal-400 rounded-r-xl p-2.5 text-xs">
                            <span class="block text-[8px] font-black text-teal-600 uppercase">Ejemplo (예문)</span>
                            <p class="font-bold text-slate-800 mt-0.5 select-all">${w.example}</p>
                            <p class="text-slate-400 italic">${w.exampleMeaning || ''}</p>
                        </div>
                        ` : ''}

                        <!-- 핵심만 정리된 노트 -->
                        ${(w.notes && isDisplayOn('notes')) ? `<div class="bg-amber-50/60 p-2.5 rounded-2xl text-[13px] text-amber-900 leading-snug whitespace-pre-wrap font-medium"><span class="font-bold text-amber-700 block text-[10px] uppercase tracking-wider mb-1.5"><i class="fa-solid fa-thumbtack text-[9px]"></i> NOTE</span>${w.notes}</div>` : ''}
                        ${isDisplayOn('synonyms') ? buildSynonymChipsHtml(w) : ''}
                        `;
        }

        function toggleWordCard(id) {
            const body = document.querySelector(`[data-card-body="${id}"]`);
            const chevron = document.querySelector(`[data-card-chevron="${id}"]`);
            const meaning = document.querySelector(`[data-card-meaning="${id}"]`);
            if (!body) return;
            const nowHidden = body.classList.toggle('hidden');
            if (nowHidden) expandedCardIds.delete(id); else expandedCardIds.add(id);
            if (chevron) chevron.style.transform = nowHidden ? 'rotate(0deg)' : 'rotate(90deg)';
            if (meaning) meaning.classList.toggle('hidden', !nowHidden);
        }

        // 다시 그린 뒤 펼쳐져 있던 카드를 복원
        function restoreExpandedCards() {
            expandedCardIds.forEach(id => {
                const body = document.querySelector(`[data-card-body="${id}"]`);
                const chevron = document.querySelector(`[data-card-chevron="${id}"]`);
                const meaning = document.querySelector(`[data-card-meaning="${id}"]`);
                if (!body) return;
                body.classList.remove('hidden');
                if (chevron) chevron.style.transform = 'rotate(90deg)';
                if (meaning) meaning.classList.add('hidden');
            });
        }

        // [냐냐 PATCH] 전체 접기/펼치기
        function setAllWordCards(expand) {
            wordListExpandedAll = expand;
            // [냐냐 PATCH] 개별 펼침 기억도 같이 갱신
            expandedCardIds.clear();
            if (expand) document.querySelectorAll('[data-card-body]').forEach(b => expandedCardIds.add(b.getAttribute('data-card-body')));
            document.querySelectorAll('[data-card-body]').forEach(b => b.classList.toggle('hidden', !expand));
            document.querySelectorAll('[data-card-chevron]').forEach(c => { c.style.transform = expand ? 'rotate(90deg)' : 'rotate(0deg)'; });
            document.querySelectorAll('[data-card-meaning]').forEach(m => m.classList.toggle('hidden', expand)); // 펼치면 헤더 뜻 숨김
        }
