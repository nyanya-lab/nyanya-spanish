function togglePosFields() {
            const pos = document.getElementById('input-pos').value;
            const nounDetails = document.getElementById('field-noun-details');
            const verbTypeDetails = document.getElementById('field-verb-type-details');
            const verbConjugations = document.getElementById('field-verb-conjugations');
            const adjDetails = document.getElementById('field-adj-details');

            if (pos === 'noun') {
                nounDetails.classList.remove('hidden');
                verbTypeDetails.classList.add('hidden');
                verbConjugations.classList.add('hidden');
                adjDetails.classList.add('hidden');
            } else if (pos === 'verb') {
                nounDetails.classList.add('hidden');
                verbTypeDetails.classList.remove('hidden');
                verbConjugations.classList.remove('hidden');
                adjDetails.classList.add('hidden');
            } else if (pos === 'adjective') {
                nounDetails.classList.add('hidden');
                verbTypeDetails.classList.add('hidden');
                verbConjugations.classList.add('hidden');
                adjDetails.classList.remove('hidden');
            } else {
                nounDetails.classList.add('hidden');
                verbTypeDetails.classList.add('hidden');
                verbConjugations.classList.add('hidden');
                adjDetails.classList.add('hidden');
            }
        }

        function toggleVerbTypeDetails() {
            const verbClass = document.getElementById('input-verb-class').value;
            const irrSelect = document.getElementById('input-verb-irregular-type');
            if (verbClass === 'irregular') {
                irrSelect.disabled = false;
                irrSelect.value = "1인칭";
            } else {
                irrSelect.disabled = true;
                irrSelect.value = "none";
            }
        }

        function openWordModal(wordId = null) {
            document.getElementById('word-modal').classList.remove('hidden');
            document.getElementById('word-suggestions').classList.add('hidden');
            
            if (wordId) {
                const w = vocabulary.find(item => item.id === wordId);
                if (!w) return;
                
                document.getElementById('modal-title').innerHTML = `✏️ 단어 수정하기: <span class="text-indigo-600 font-extrabold">${w.word}</span>`;
                document.getElementById('modal-word-id').value = w.id;
                document.getElementById('input-word').value = w.word;
                document.getElementById('input-meaning').value = w.meaning;
                document.getElementById('input-pos').value = w.pos || 'noun';
                
                document.getElementById('input-gender').value = w.gender || 'none';
                document.getElementById('input-adj-agreement').value = w.adjAgreement || 'full';
                document.getElementById('input-verb-class').value = w.verbClass || 'regular';
                const irrSelect = document.getElementById('input-verb-irregular-type');
                irrSelect.value = w.irregularType || 'none';
                irrSelect.disabled = (w.verbClass !== 'irregular');

                if (w.conjugations) {
                    document.getElementById('conj-yo').value = w.conjugations.yo || '';
                    document.getElementById('conj-tu').value = w.conjugations.tu || '';
                    document.getElementById('conj-el').value = w.conjugations.el || '';
                    document.getElementById('conj-nos').value = w.conjugations.nos || '';
                    document.getElementById('conj-vos').value = w.conjugations.vos || '';
                    document.getElementById('conj-ellos').value = w.conjugations.ellos || '';
                } else {
                    clearConjugationFields();
                }

                document.getElementById('input-example').value = w.example || '';
                document.getElementById('input-example-meaning').value = w.exampleMeaning || '';
                document.getElementById('input-notes').value = w.notes || '';
            } else {
                document.getElementById('modal-title').innerHTML = `✨ 새로운 단어 등록`;
                document.getElementById('modal-word-id').value = '';
                document.getElementById('input-word').value = '';
                document.getElementById('input-meaning').value = '';
                document.getElementById('input-pos').value = 'noun';
                document.getElementById('input-gender').value = 'none';
                document.getElementById('input-adj-agreement').value = 'full';
                document.getElementById('input-verb-class').value = 'regular';
                document.getElementById('input-verb-irregular-type').value = 'none';
                document.getElementById('input-verb-irregular-type').disabled = true;
                
                clearConjugationFields();
                
                document.getElementById('input-example').value = '';
                document.getElementById('input-example-meaning').value = '';
                document.getElementById('input-notes').value = '· ';
            }
            togglePosFields();
        }

        // [냐냐 PATCH] 노트 작성 시 엔터를 누르면 자동으로 '· ' 글머리 기호 추가 (지우는 건 자유)
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
        }

        function clearConjugationFields() {
            document.getElementById('conj-yo').value = '';
            document.getElementById('conj-tu').value = '';
            document.getElementById('conj-el').value = '';
            document.getElementById('conj-nos').value = '';
            document.getElementById('conj-vos').value = '';
            document.getElementById('conj-ellos').value = '';
        }

        function closeWordModal() {
            document.getElementById('word-modal').classList.add('hidden');
            hideAiLoadingOverlay();
        }

        function showConfirm(title, desc, onOk) {
            const modal = document.getElementById('confirm-modal');
            document.getElementById('confirm-modal-title').innerText = title;
            document.getElementById('confirm-modal-desc').innerText = desc;
            modal.classList.remove('hidden');

            const btnOk = document.getElementById('confirm-ok-btn');
            const btnCancel = document.getElementById('confirm-cancel-btn');

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
                cleanup();
            };
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

            // [PATCH-버그수정] 단어 '수정' 중일 때는 캐시를 건너뛰고 항상 새로 조회함.
            // (이전 버그로 잘못 저장된 캐시를 고친 후에도 계속 그대로 불러오는 문제 방지 —
            //  수정 화면에서 AI 추천을 다시 누르는 건 "예전 결과를 고치고 싶다"는 의도이므로)
            const isEditingExisting = !!document.getElementById('modal-word-id').value;

            // [PATCH-속도개선] 새 단어 등록 중이고 이미 조회했던 단어면 캐시에서 즉시 불러옴
            if (!isEditingExisting) {
                const cache = getAiWordCache();
                const cached = cache[rawWord.toLowerCase().trim()];
                if (cached) {
                    applyAutofillResult(cached, true);
                    AudioFX.playSuccess();
                    showToast("이전에 조회했던 단어라 바로 적용했어요! ⚡", "success");
                    return;
                }
            }

            const btn = document.getElementById('ai-autofill-btn');
            const originalHtml = btn.innerHTML;
            
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> 분석 중...`;
            showAiLoadingOverlay();

            // [PATCH-속도개선] 프롬프트를 간결하게 줄여서 모델이 더 빠르게 응답하도록 함
            const prompt = `스페인어 단어 "${rawWord}"를 분석해서 JSON 스키마에 맞게 채워주세요.
            - 동사면 1인칭/e➡️ie/o➡️ue/e➡️i/완전불규칙 중 정확히 분류하고 현재시제 변형 전부 채울 것.
            - example은 실제로 쓰일 법한 자연스러운 스페인어 문장 1개, exampleMeaning은 그 정확한 한국어 번역.
            - notes는 대화체로 쓰지 말고, 한 줄에 핵심 문법/품사 특징 하나, 다른 한 줄에 주의점 하나만 "· "로 시작하는 불릿 2줄로 짧게 작성 (각 줄 25자 이내, 줄바꿈은 \\n 하나로 구분). 인사말이나 이름 호칭 금지. 명사의 성별/관사(여성명사, 관사 la 등)와 형용사의 성·수 변화 여부는 이미 별도 항목으로 표시되므로 notes에 절대 반복하지 말 것. "~함", "~됨", "~임" 같은 서술형 어미 대신 명사형으로 간결하게 끝낼 것 (예: "의미함"이 아니라 "의미", "구별됨"이 아니라 "구별").`;

            const system = "You are a precise Spanish dictionary engine. Output must strictly follow the given JSON schema, in Korean where applicable. No greetings, no markdown fences, no conversational filler — just the structured facts.";
            
            const schema = {
                type: "OBJECT",
                properties: {
                    meaning: { type: "STRING", description: "핵심 한글 뜻" },
                    pos: { type: "STRING", enum: ["noun", "verb", "adjective", "adverb", "preposition", "conjunction", "pronoun", "phrase"] },
                    gender: { type: "STRING", enum: ["none", "masculine", "feminine"] },
                    adjAgreement: { type: "STRING", enum: ["full", "no-gender", "no-number", "invariable"], description: "형용사일 때만 사용. full=성수 둘 다 변화(bueno/buena/buenos/buenas), no-gender=성 변화 없이 수만 변화(feliz/felices), no-number=수 변화 없이 성만 변화, invariable=완전 불변. 형용사가 아니면 'full'" },
                    verbClass: { type: "STRING", enum: ["regular", "irregular"] },
                    irregularType: { type: "STRING", enum: ["1인칭", "e ➡️ ie", "o ➡️ ue", "e ➡️ i", "완전 불규칙", "1인칭 및 e ➡️ ie", "1인칭 및 o ➡️ ue", "기타 변형"] },
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
                    exampleMeaning: { type: "STRING", description: "예문의 정확한 한국어 번역" },
                    notes: { type: "STRING", description: "· 로 시작하는 불릿 2줄 이내, 줄바꿈은 \\n, 대화체/인사말 금지, 핵심 문법 사실만. 성별/관사는 반복하지 말 것. 명사형으로 간결하게 끝낼 것" }
                },
                required: ["meaning", "pos", "gender", "verbClass", "example", "exampleMeaning", "notes"]
            };

            try {
                // 실시간 API 호출 시도 (thinkingLevel: minimal → 단순 사전 조회라 깊은 추론 불필요, 가장 빠름)
                const responseText = await callGemini(prompt, system, schema, 'minimal', GEMINI_MODEL_FLASH_LITE);
                // 대화형 응답이나 블록 헤더가 섞여 있어도 완벽하게 추출하여 분석
                const result = extractAndParseJson(responseText);

                applyAutofillResult(result, true); // AI 추천 클릭 시 강제 덮어쓰기 허용 (true)
                saveAiWordCache(rawWord, result); // [PATCH-속도개선] 다음 조회를 위해 캐시 저장
                AudioFX.playSuccess();
                showToast("Gemini AI 분석 완료! 추천 정보를 적용했어요 ✨", "success");
            } catch (e) {
                console.warn("AI API 통신 실패: 오프라인 추측으로 자동 전환", e);
                showToast(`${describeGeminiError(e)} 오프라인 추측으로 대체합니다.`, "error");
                runOfflineAutofill(rawWord);
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
                hideAiLoadingOverlay();
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
                if (forceOverwrite || genderInput.value === 'none') {
                    genderInput.value = result.gender || 'none';
                }
            } else if (result.pos === 'adjective') {
                const adjAgreementInput = document.getElementById('input-adj-agreement');
                if (forceOverwrite || adjAgreementInput.value === 'full') {
                    adjAgreementInput.value = result.adjAgreement || 'full';
                }
            } else if (result.pos === 'verb') {
                const verbClassInput = document.getElementById('input-verb-class');
                if (forceOverwrite || verbClassInput.value === 'regular') {
                    verbClassInput.value = result.verbClass || 'regular';
                }
                toggleVerbTypeDetails();
                
                if (result.verbClass === 'irregular') {
                    const irrTypeInput = document.getElementById('input-verb-irregular-type');
                    if (forceOverwrite || irrTypeInput.value === 'none') {
                        irrTypeInput.value = result.irregularType || "1인칭";
                    }
                }
                
                if (result.conjugations) {
                    const conjKeys = ['yo', 'tu', 'el', 'nos', 'vos', 'ellos'];
                    conjKeys.forEach(key => {
                        const conjInput = document.getElementById(`conj-${key}`);
                        if (forceOverwrite || !conjInput.value.trim()) {
                            conjInput.value = result.conjugations[key] || '';
                        }
                    });
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

            const notesInput = document.getElementById('input-notes');
            if (forceOverwrite || !notesInput.value.trim() || notesInput.value.includes('확인 필요') || notesInput.value.includes('직접 입력 필요')) {
                notesInput.value = result.notes || '';
            }
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
            const cleanQuery = query.toLowerCase().trim();
            const results = [];
            const seenKeys = new Set();

            // [PATCH-16] 오프라인 사전뿐 아니라 내가 이미 등록한 단어장 전체에서도 검색
            vocabulary.forEach(item => {
                if (item.word.toLowerCase().includes(cleanQuery)) {
                    seenKeys.add(item.word.toLowerCase());
                    results.push({ key: item.word, meaning: item.meaning, pos: item.pos, gender: item.gender, registeredId: item.id });
                }
            });
            Object.keys(OFFLINE_DICT_DB).forEach(key => {
                if (key.toLowerCase().includes(cleanQuery) && !seenKeys.has(key.toLowerCase())) {
                    const item = OFFLINE_DICT_DB[key];
                    results.push({ key: key, meaning: item.meaning, pos: item.pos, gender: item.gender, registeredId: null });
                }
            });

            if (results.length === 0) {
                container.classList.add('hidden');
                return;
            }

            container.classList.remove('hidden');
            let html = '';
            results.slice(0, 6).forEach(r => {
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

            // [냐냐 PATCH] 새 단어 등록 시 이미 같은 철자의 단어가 있으면 확인창 표시
            if (!modalId) {
                const dup = vocabulary.find(item => item.word.toLowerCase().trim() === wordVal.toLowerCase());
                if (dup) {
                    showConfirm(
                        `"${dup.word}(${dup.meaning})" 단어가 이미 등록되어 있습니다.`,
                        "그래도 새로 등록하시겠습니까? (같은 단어가 2개로 등록돼요)",
                        () => performSaveWord()
                    );
                    return;
                }
            }

            performSaveWord();
        }

        function performSaveWord() {
            const wordVal = document.getElementById('input-word').value.trim();
            const meaningVal = document.getElementById('input-meaning').value.trim();
            const modalId = document.getElementById('modal-word-id').value;
            const pos = document.getElementById('input-pos').value;
            
            let wordObj = {
                id: modalId || 'word-' + Date.now(),
                word: wordVal,
                meaning: meaningVal,
                pos: pos,
                example: document.getElementById('input-example').value.trim(),
                exampleMeaning: document.getElementById('input-example-meaning').value.trim(),
                notes: document.getElementById('input-notes').value.trim(),
                mastered: false
            };

            if (pos === 'noun') {
                wordObj.gender = document.getElementById('input-gender').value;
            } else if (pos === 'adjective') {
                wordObj.adjAgreement = document.getElementById('input-adj-agreement').value;
            } else if (pos === 'verb') {
                const verbClass = document.getElementById('input-verb-class').value;
                wordObj.verbClass = verbClass;
                wordObj.irregularType = (verbClass === 'irregular') ? document.getElementById('input-verb-irregular-type').value : 'none';
                wordObj.conjugations = {
                    yo: document.getElementById('conj-yo').value.trim(),
                    tu: document.getElementById('conj-tu').value.trim(),
                    el: document.getElementById('conj-el').value.trim(),
                    nos: document.getElementById('conj-nos').value.trim(),
                    vos: document.getElementById('conj-vos').value.trim(),
                    ellos: document.getElementById('conj-ellos').value.trim()
                };
            }

            if (modalId) {
                const index = vocabulary.findIndex(item => item.id === modalId);
                if (index !== -1) {
                    wordObj.mastered = vocabulary[index].mastered || false; // 수정 시 마스터 상태 보존 (기존엔 초기화되던 버그)
                    vocabulary[index] = wordObj;
                    showToast("단어가 깔끔하게 수정되었습니다! ✏️", "success");
                }
            } else {
                vocabulary.unshift(wordObj);
                showToast("새 단어가 등록되었습니다! 📚", "success");
            }

            logAction('snapshot');
            closeWordModal();
            renderWordList();
            updateStats();
        }

        function deleteWord(wordId, event) {
            if (event) event.stopPropagation();
            const w = vocabulary.find(item => item.id === wordId);
            if (!w) return;

            showConfirm(
                `"${w.word}" 단어를 삭제할까요?`,
                "삭제한 데이터는 다시 꺼낼 수 없습니다.",
                () => {
                    vocabulary = vocabulary.filter(item => item.id !== wordId);
                    logAction('snapshot');
                    renderWordList();
                    updateStats();
                    showToast("단어를 삭제했습니다. 🗑️", "success");
                    AudioFX.playError();
                }
            );
        }

        function toggleMasterWord(wordId, event) {
            if (event) event.stopPropagation();
            const w = vocabulary.find(item => item.id === wordId);
            if (w) {
                w.mastered = !w.mastered;
                if (w.mastered) {
                    AudioFX.playBell();
                    showToast(`"${w.word}" 단어 마스터 완료! 🏆`, "success");
                }
                logAction('snapshot');
                renderWordList();
                updateStats();
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
        function handleSearchInput() {
            const val = document.getElementById('search-bar').value;
            document.getElementById('search-clear-btn').classList.toggle('hidden', !val);
            renderWordList();
        }

        function clearSearch() {
            const bar = document.getElementById('search-bar');
            bar.value = '';
            document.getElementById('search-clear-btn').classList.add('hidden');
            bar.focus();
            renderWordList();
        }

        function renderWordList() {
            const grid = document.getElementById('vocabulary-grid');
            const emptyState = document.getElementById('vocab-empty-state');
            const searchVal = document.getElementById('search-bar').value.trim().toLowerCase();
            
            const filtered = vocabulary.filter(w => {
                const queryInWord = w.word.toLowerCase().includes(searchVal);
                const queryInMeaning = w.meaning.toLowerCase().includes(searchVal);
                const queryInNotes = w.notes && w.notes.toLowerCase().includes(searchVal);
                return queryInWord || queryInMeaning || queryInNotes;
            });

            // [PATCH-20] 정렬/필터 기능 (최근 추가순은 배열 기본 순서를 그대로 사용)
            const sortMode = document.getElementById('sort-select') ? document.getElementById('sort-select').value : 'recent';
            let filteredSorted = filtered;
            if (sortMode === 'oldest') {
                filteredSorted = [...filtered].reverse();
            } else if (sortMode === 'alpha-asc') {
                filteredSorted = [...filtered].sort((a, b) => a.word.localeCompare(b.word));
            } else if (sortMode === 'alpha-desc') {
                filteredSorted = [...filtered].sort((a, b) => b.word.localeCompare(a.word));
            } else if (sortMode === 'mastered-only') {
                filteredSorted = filtered.filter(w => w.mastered);
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
                    if (w.adjAgreement === 'no-gender') adjSubLabel = ' <span class="px-1.5 py-0.5 text-[8px] font-bold rounded-full bg-amber-50 text-amber-600 border border-amber-200">성 변화 X</span>';
                    else if (w.adjAgreement === 'no-number') adjSubLabel = ' <span class="px-1.5 py-0.5 text-[8px] font-bold rounded-full bg-amber-50 text-amber-600 border border-amber-200">수 변화 X</span>';
                    else if (w.adjAgreement === 'invariable') adjSubLabel = ' <span class="px-1.5 py-0.5 text-[8px] font-bold rounded-full bg-amber-50 text-amber-600 border border-amber-200">불변</span>';
                    badgeMarkup = `<span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-amber-100 text-amber-700 shadow-sm">Adj.</span>${adjSubLabel}`;
                } else if (w.pos === 'adverb') {
                    badgeMarkup = `<span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-emerald-100 text-emerald-700 shadow-sm">Adv.</span>`;
                } else if (w.pos === 'preposition') {
                    badgeMarkup = `<span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-teal-100 text-teal-700 shadow-sm">Prep.</span>`;
                } else if (w.pos === 'conjunction') {
                    badgeMarkup = `<span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-cyan-100 text-cyan-700 shadow-sm">Conj.</span>`;
                } else if (w.pos === 'pronoun') {
                    badgeMarkup = `<span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-pink-100 text-pink-700 shadow-sm">Pron.</span>`;
                } else if (w.pos === 'phrase') {
                    badgeMarkup = `<span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-purple-100 text-purple-600 shadow-sm">Phr.</span>`;
                }

                const cardStyle = w.mastered 
                    ? 'border border-emerald-100 bg-emerald-50/40 shadow-xs' 
                    : 'border border-slate-200 shadow-xs bg-white';

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
                    <div class="space-y-4">
                        <div class="flex items-start justify-between gap-2">
                            <div class="flex items-center gap-2 flex-wrap min-w-0">
                                <h3 class="text-xl font-extrabold text-slate-900 tracking-tight break-all">
                                    ${w.word}
                                </h3>
                                ${badgeMarkup}
                                <button onclick="speakText(event, '${w.word}')" class="text-slate-400 hover:text-violet-500 transition-colors py-0.5 px-1 shrink-0"><i class="fa-solid fa-volume-high text-sm"></i></button>
                            </div>
                            <div class="flex items-center gap-1 shrink-0">
                                <button onclick="toggleMasterWord('${w.id}', event)" class="w-7 h-7 rounded-full flex items-center justify-center transition-all ${w.mastered ? 'bg-white border-2 border-emerald-400 text-emerald-500 shadow-sm' : 'bg-slate-50 hover:bg-slate-100 text-slate-300'}">
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

                        <!-- Example Sentences -->
                        ${w.example ? `
                        <div class="bg-slate-50 border-l-2 border-violet-500 rounded-r-xl p-2.5 text-xs">
                            <span class="block text-[8px] font-black text-violet-500 uppercase">Ejemplo (예문)</span>
                            <p class="font-bold text-slate-800 mt-0.5 select-all">${w.example}</p>
                            <p class="text-slate-400 italic">${w.exampleMeaning || ''}</p>
                        </div>
                        ` : ''}
                    </div>

                    <!-- 핵심만 정리된 노트 -->
                    ${w.notes ? `<div class="bg-amber-50/50 p-2.5 rounded-2xl border border-amber-200/50 text-[13px] text-amber-900 leading-snug whitespace-pre-line font-medium -mt-2"><span class="font-bold text-amber-700 block text-[10px] uppercase tracking-wider mb-1.5"><i class="fa-solid fa-thumbtack text-[9px]"></i> NOTE</span>${w.notes}</div>` : ''}
                </div>
                `;
            });

            grid.innerHTML = html;
        }

        // TAB 2: FLASHCARD PLAYGROUND LOGICS
