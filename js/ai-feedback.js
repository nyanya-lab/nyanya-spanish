let currentAiMode = 'ko-es';
        let aiCurrentWordForMission = null;
        let aiCurrentKoreanSentence = "";

        function switchAiMode(mode) {
            currentAiMode = mode;
            const btnKoEs = document.getElementById('ai-mode-btn-ko-es');
            const btnEsKo = document.getElementById('ai-mode-btn-es-ko');
            const btnQuestion = document.getElementById('ai-mode-btn-question');
            const paneKoEs = document.getElementById('ai-pane-ko-es');
            const paneEsKo = document.getElementById('ai-pane-es-ko');
            const paneQuestion = document.getElementById('ai-pane-question');
            const resultBox = document.getElementById('ai-feedback-result');

            resultBox.classList.add('hidden');

            const activeClass = "py-2.5 rounded-lg text-xs font-bold transition-all bg-white text-slate-900 shadow-sm";
            const inactiveClass = "py-2.5 rounded-lg text-xs font-bold transition-all text-slate-500 hover:text-slate-900";
            btnKoEs.className = mode === 'ko-es' ? activeClass : inactiveClass;
            btnEsKo.className = mode === 'es-ko' ? activeClass : inactiveClass;
            btnQuestion.className = mode === 'question' ? activeClass : inactiveClass;
            paneKoEs.classList.toggle('hidden', mode !== 'ko-es');
            paneEsKo.classList.toggle('hidden', mode !== 'es-ko');
            paneQuestion.classList.toggle('hidden', mode !== 'question');

            if (mode === 'ko-es') {
                resetKoEsMissionState();
            } else if (mode === 'es-ko') {
                document.getElementById('ai-free-input-es').value = '';
            } else if (mode === 'question') {
                renderCustomQuestionsList();
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
        function toggleQuestionManageBox() {
            const box = document.getElementById('question-manage-box');
            const icon = document.getElementById('question-manage-toggle-icon');
            const isHidden = box.classList.contains('hidden');
            box.classList.toggle('hidden');
            icon.className = isHidden ? "fa-solid fa-minus text-xs" : "fa-solid fa-plus text-xs";
        }

        function addCustomQuestion() {
            const input = document.getElementById('new-question-input');
            const text = input.value.trim();
            if (!text) {
                showToast("질문 내용을 입력해 주세요!", "error");
                return;
            }
            customQuestions.push({ id: 'q-' + Date.now(), question: text });
            input.value = '';
            saveToStorage();
            renderCustomQuestionsList();
            showToast("질문을 등록했어요! 📝", "success");
        }

        function deleteCustomQuestion(id) {
            customQuestions = customQuestions.filter(q => q.id !== id);
            saveToStorage();
            renderCustomQuestionsList();
        }

        function renderCustomQuestionsList() {
            const box = document.getElementById('question-list-box');
            if (!box) return;
            if (customQuestions.length === 0) {
                box.innerHTML = '<p class="text-xs text-slate-400 text-center py-2">등록된 질문이 없어요. 위에서 추가해 보세요!</p>';
                return;
            }
            box.innerHTML = customQuestions.map(q => `
                <div class="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-100 text-xs">
                    <span class="text-slate-700 font-semibold truncate pr-2">${q.question}</span>
                    <button onclick="deleteCustomQuestion('${q.id}')" class="text-slate-300 hover:text-rose-500 transition-colors shrink-0"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            `).join('');
        }

        function pickRandomQuestion() {
            if (customQuestions.length === 0) {
                showToast("먼저 질문을 등록해 주세요! '내 질문 목록 관리'를 눌러서 추가할 수 있어요.", "error");
                return;
            }
            const randIdx = Math.floor(Math.random() * customQuestions.length);
            currentQuestionForAnswer = customQuestions[randIdx];
            document.getElementById('question-display-text').innerText = currentQuestionForAnswer.question;
            document.getElementById('question-answer-input').value = '';
            document.getElementById('ai-feedback-result').classList.add('hidden');
            AudioFX.playPunch();
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

            Evaluate whether the student's Spanish answer is grammatically correct AND is a sensible, appropriate response to the question (content relevance matters, not just grammar). Wrap corrected words in correctedText inside '<span class="text-red-600 font-extrabold underline">corrected_word_here</span>' tags.
            ${buildLearnerProfileSummary()}`;
            const system = `You are an expert Spanish tutor evaluating a student named "냐냐" answering a practice question in Spanish.
            Return feedback matching this JSON schema:
            {
               "isCorrect": true/false,
               "verdict": "e.g., 완벽한 답변이에요! 🎉 or 다시 한 번 살펴볼까요? 📝",
               "correctedText": "The corrected/improved Spanish answer. Wrap corrected words in '<span class=\"text-red-600 font-extrabold underline\">...</span>' tags.",
               "message": "Concise feedback in Korean mentioning '냐냐님', 1-2 sentences. Comment on both grammar AND whether the answer actually addresses the question.",
               "breakdown": [
                  { "word": "ONE short Spanish word or particle from correctedText (never a phrase or full clause)", "mean": "Its Korean meaning, 1-4 words only, never empty" }
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
                    correctedText: { type: "STRING" },
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
                    tip: { type: "STRING" },
                    issueType: { type: "STRING", enum: ["어순", "성수일치", "동사변형", "시제", "전치사", "어휘선택", "내용부적절", "기타", "없음"] }
                },
                required: ["isCorrect", "verdict", "correctedText", "message", "breakdown", "tip", "issueType"]
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
                    originalRender.innerText = userAnswer;
                    correctedRender.innerHTML = feedback.correctedText;
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
                    breakdownGrid.innerHTML += `
                        <div class="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
                            <span class="font-bold text-slate-800 shrink-0">${w}</span>
                            <span class="text-slate-500 text-right">${m}</span>
                        </div>
                    `;
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
            
            Note: the mission is either (a) a Korean sentence to translate, or (b) an instruction asking the student to freely write a Spanish sentence using the target word naturally. Evaluate accordingly: for (a) check translation accuracy; for (b) check that the target word is used correctly and the sentence is natural. Either way, check grammar is correct and the target word is used appropriately. Wrap any corrected words in correctedText inside '<span class="text-red-600 font-extrabold underline">corrected_word_here</span>' tags to highlight mistakes in RED.
            ${buildLearnerProfileSummary()}`;
            
            const system = `You are an encouraging and extremely precise professional Spanish tutor tutoring a passionate student named "냐냐".
            Evaluate the student's translation. Return feedback matching this exact JSON schema:
            {
               "isCorrect": true/false,
               "verdict": "e.g., 완벽한 정답이에요! 🎉 or 다시 한 번 살펴볼까요? 📝",
               "correctedText": "The perfect standard Spanish sentence. Wrap corrected/changed words in '<span class=\"text-red-600 font-extrabold underline\">...</span>' tags to highlight mistakes in RED.",
               "message": "Concise evaluation in Korean, 1-2 sentences max. Mention the student '냐냐님' and the key grammar point (어순/conjugation). No long essays.",
               "breakdown": [
                  { "word": "ONE short Spanish word or particle from correctedText (never a phrase or full clause)", "mean": "Its Korean meaning, 1-4 words only, never empty" }
               ],
               "tip": "One short, useful grammatical tip in Korean, 1 sentence."
            }
            IMPORTANT for "breakdown": split correctedText into its individual words/particles (typically 3-7 items). Each item must be exactly ONE word, never a full phrase or sentence, and "mean" must never be omitted or empty. Do not repeat the same word twice. Note: Korean "눈" is ambiguous (can mean either "snow"=nieve or "eye"=ojo) — always use the target word's actual given meaning to disambiguate, never assume.
            Do not wrap JSON in markdown blockticks.`;

            const schema = {
                type: "OBJECT",
                properties: {
                    isCorrect: { type: "BOOLEAN" },
                    verdict: { type: "STRING" },
                    correctedText: { type: "STRING" },
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
                    tip: { type: "STRING" }
                },
                required: ["isCorrect", "verdict", "correctedText", "message", "breakdown", "tip"]
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
                    originalRender.innerText = userText;
                    correctedRender.innerHTML = feedback.correctedText;
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
                    breakdownGrid.innerHTML += `
                        <div class="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
                            <span class="font-bold text-slate-800 shrink-0">${w}</span>
                            <span class="text-slate-500 text-right">${m}</span>
                        </div>
                    `;
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
            
            Analyze this sentence. Identify any grammar/word order issues (like placing 'no' after verbs, wrong gender-number agreements) and provide a perfect natural translation to Korean. Wrap corrected parts in correctedText using '<span class="text-red-600 font-extrabold underline">corrected_text</span>' tags.
            ${buildLearnerProfileSummary()}`;
            
            const system = `You are an expert Spanish tutor evaluating a student named "냐냐".
            Return feedback matching this JSON schema:
            {
               "isCorrect": true/false,
               "verdict": "e.g., 어순이 완벽해요! 🟢 or 어순을 다시 살펴봐요! 🟠",
               "correctedText": "The corrected standard Spanish sentence. Wrap any corrected words in '<span class=\"text-red-600 font-extrabold underline\">...</span>' tags.",
               "message": "Concise grammatical analysis in Korean mentioning '냐냐님', 1-2 sentences max. No long essays.",
               "breakdown": [
                  { "word": "ONE short Spanish word or particle from correctedText (never a phrase or full clause)", "mean": "Its Korean meaning, 1-4 words only, never empty" }
               ],
               "tip": "One short, useful grammar tip in Korean, 1 sentence.",
               "issueType": "If isCorrect is false, classify the main mistake as exactly one of: '어순', '성수일치', '동사변형', '시제', '전치사', '어휘선택', '기타'. If isCorrect is true, use '없음'."
            }
            IMPORTANT for "breakdown": split correctedText into its individual words/particles (typically 3-7 items). Each item must be exactly ONE word, never a full phrase or sentence, and "mean" must never be omitted or empty. Do not repeat the same word twice.
            Do not wrap JSON in markdown blockticks.`;

            const schema = {
                type: "OBJECT",
                properties: {
                    isCorrect: { type: "BOOLEAN" },
                    verdict: { type: "STRING" },
                    correctedText: { type: "STRING" },
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
                    tip: { type: "STRING" },
                    issueType: { type: "STRING", enum: ["어순", "성수일치", "동사변형", "시제", "전치사", "어휘선택", "기타", "없음"], description: "주된 문법 실수 유형 분류. 정답이면 '없음'" }
                },
                required: ["isCorrect", "verdict", "correctedText", "message", "breakdown", "tip", "issueType"]
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
                    originalRender.innerText = userEsText;
                    correctedRender.innerHTML = feedback.correctedText;
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
                    breakdownGrid.innerHTML += `
                        <div class="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
                            <span class="font-bold text-slate-800 shrink-0">${w}</span>
                            <span class="text-slate-500 text-right">${m}</span>
                        </div>
                    `;
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
                            <div class="bg-indigo-600 text-white rounded-2xl px-3.5 py-2 max-w-[85%] font-semibold shadow-xs">
                                ${msg.content}
                            </div>
                        </div>
                    `;
                } else {
                    threadEl.innerHTML += `
                        <div class="flex justify-start gap-2 items-start">
                            <div class="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-sm">🤖</div>
                            <div class="bg-slate-100 text-slate-800 rounded-2xl px-3.5 py-2 max-w-[85%] font-medium shadow-2xs leading-relaxed">
                                ${msg.content}
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
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(utteranceText);
                utterance.lang = 'es-ES';
                utterance.rate = 0.9;
                window.speechSynthesis.speak(utterance);
            } else {
                showToast("죄송합니다. 현재 브라우저가 원어민 음성 합성을 지원하지 않습니다.", "error");
            }
        }
