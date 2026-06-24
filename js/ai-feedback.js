        let currentAiMode = 'ko-es';
        let aiCurrentWordForMission = null;
        let aiCurrentKoreanSentence = "";

        function switchAiMode(mode) {
            currentAiMode = mode;
            const btnKoEs = document.getElementById('ai-mode-btn-ko-es');
            const btnEsKo = document.getElementById('ai-mode-btn-es-ko');
            const paneKoEs = document.getElementById('ai-pane-ko-es');
            const paneEsKo = document.getElementById('ai-pane-es-ko');
            const resultBox = document.getElementById('ai-feedback-result');

            resultBox.classList.add('hidden');

            if (mode === 'ko-es') {
                btnKoEs.className = "py-2.5 rounded-lg text-xs font-bold transition-all bg-white text-slate-900 shadow-sm";
                btnEsKo.className = "py-2.5 rounded-lg text-xs font-bold transition-all text-slate-500 hover:text-slate-900";
                paneKoEs.classList.remove('hidden');
                paneEsKo.classList.add('hidden');
                resetKoEsMissionState();
            } else {
                btnEsKo.className = "py-2.5 rounded-lg text-xs font-bold transition-all bg-white text-slate-900 shadow-sm";
                btnKoEs.className = "py-2.5 rounded-lg text-xs font-bold transition-all text-slate-500 hover:text-slate-900";
                paneEsKo.classList.remove('hidden');
                paneKoEs.classList.add('hidden');
                document.getElementById('ai-free-input-es').value = '';
            }
        }

        // [PATCH] 스->한 자유 작문 모드: 첨삭 후 다음 문장을 쓸 수 있도록 입력칸/결과창을 초기화
        function resetEsKoPane() {
            document.getElementById('ai-free-input-es').value = '';
            document.getElementById('ai-feedback-result').classList.add('hidden');
            document.getElementById('ai-free-input-es').focus();
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
        function buildFallbackMission(wordObj) {
            const word = wordObj.word;
            const meaning = (wordObj.meaning || '').split(',')[0].trim();
            const pos = wordObj.pos;

            const curatedMissions = {
                'tener': "나 지금 급한 일이 있어서 지갑에 현금이 전혀 없어.",
                'querer': "오늘 밤에 스크램블 에그를 꼭 만들어 먹고 싶은 기분이야.",
                'poder': "나 지금 처리할 업무가 많아서 그 부탁은 들어주기 어렵겠어.",
                'hacer': "너 오늘 오후에 시간 있으면 나 좀 도와줄 수 있어?",
                'comer': "우리 저녁에 빠에야 만들어서 같이 먹을래?",
                'vivir': "나는 요즘 서울 근처에서 살고 있어.",
                'hablar': "저 사람은 스페인어를 정말 유창하게 하더라.",
                'con': "나는 친구와 함께 해변을 걷고 있어.",
                'para': "이 선물은 너를 위해 준비한 거야.",
                'porque': "나 오늘 너무 피곤해서 약속에 못 갈 것 같아.",
                'y': "민수랑 나는 어릴 때부터 친구야.",
                'pelo': "거울을 보니까 머리가 너무 길어진 것 같아.",
                'libro': "이 책 좀 빌려줄 수 있어? 진짜 재밌어 보여.",
                'mesa': "테이블 위에 있는 컵 좀 치워줄래?",
                'casa': "오늘은 그냥 집에서 푹 쉬고 싶어.",
                'el agua': "나 지금 너무 목이 말라서 물 한 잔만 줄래?",
                'el ascensor': "엘리베이터가 고장 나서 계단으로 올라가야 해."
            };

            if (curatedMissions[word]) return curatedMissions[word];
            if (pos === 'noun') return `저기 있는 ${meaning} 좀 나한테 갖다 줄래?`;
            if (pos === 'verb') return `"${word}" (${meaning})를 활용해서, 오늘 있었던 일을 스페인어 한 문장으로 말해보세요!`;
            if (pos === 'preposition' || pos === 'conjunction') return `"${word}" (${meaning})를 넣어서 자연스러운 스페인어 문장을 만들어보세요!`;
            return `"${word}" (${meaning})를 활용한 스페인어 문장을 만들어보세요!`;
        }

        // [PATCH] 내 단어장 기반으로 AI가 실시간으로 자연스러운 한국어 미션 문장을 생성
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
                return;
            }

            const randIdx = Math.floor(Math.random() * vocabulary.length);
            aiCurrentWordForMission = vocabulary[randIdx];

            if (!hasGeminiApiKey()) {
                showToast("Gemini API 키가 없어서 AI 문장 생성 대신 기본 문장을 사용합니다. 우측 상단 배지에서 키를 등록하면 매번 새로운 문장을 받을 수 있어요!", "warning");
                aiCurrentKoreanSentence = buildFallbackMission(aiCurrentWordForMission);
                missionHeading.innerText = `"${aiCurrentKoreanSentence}"`;
                AudioFX.playPunch();
                return;
            }

            const originalBtnHtml = genBtn.innerHTML;
            genBtn.disabled = true;
            genBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> 생성 중...`;
            missionHeading.innerHTML = `<span class="inline-flex items-center gap-2 text-slate-400 text-base"><i class="fa-solid fa-spinner animate-spin"></i> AI가 문장을 만들고 있어요... (보통 3~5초)</span>`;

            const prompt = `스페인어 단어 "${aiCurrentWordForMission.word}" (뜻: "${aiCurrentWordForMission.meaning}", 품사: ${aiCurrentWordForMission.pos})를 스페인어로 번역할 때 이 단어를 자연스럽게 써야 하는, 짧고 일상적인 구어체 한국어 문장을 1개 만들어주세요. 실제로 친구한테 말할 법한 자연스러운 문장으로, 너무 길지 않게.`;
            const system = "You are a creative Spanish-learning content writer. Output strictly valid JSON matching the schema, in natural conversational Korean. No explanations, no markdown fences, no preamble.";
            const schema = {
                type: "OBJECT",
                properties: {
                    sentence: { type: "STRING", description: "자연스러운 구어체 한국어 문장 1개 (1문장만)" }
                },
                required: ["sentence"]
            };

            try {
                const responseText = await callGemini(prompt, system, schema, 'low');
                const result = extractAndParseJson(responseText);
                aiCurrentKoreanSentence = result.sentence;
                missionHeading.innerText = `"${aiCurrentKoreanSentence}"`;
                AudioFX.playPunch();
            } catch (e) {
                console.warn("AI 미션 생성 실패, 기본 문장으로 대체", e);
                showToast(`${describeGeminiError(e)} 기본 문장으로 대체합니다.`, "error");
                aiCurrentKoreanSentence = buildFallbackMission(aiCurrentWordForMission);
                missionHeading.innerText = `"${aiCurrentKoreanSentence}"`;
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
            
            Note: the mission is either (a) a Korean sentence to translate, or (b) an instruction asking the student to freely write a Spanish sentence using the target word naturally. Evaluate accordingly: for (a) check translation accuracy; for (b) check that the target word is used correctly and the sentence is natural. Either way, check grammar is correct and the target word is used appropriately. Wrap any corrected words in correctedText inside '<span class="text-red-600 font-extrabold underline">corrected_word_here</span>' tags to highlight mistakes in RED.`;
            
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
            
            Analyze this sentence. Identify any grammar/word order issues (like placing 'no' after verbs, wrong gender-number agreements) and provide a perfect natural translation to Korean. Wrap corrected parts in correctedText using '<span class="text-red-600 font-extrabold underline">corrected_text</span>' tags.`;
            
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
               "tip": "One short, useful grammar tip in Korean, 1 sentence."
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
