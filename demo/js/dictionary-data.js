// [냐냐 요청] 오프라인 사전(OFFLINE_DICT_DB)은 뺐다.
//   하드코딩된 18개짜리라 1,100개 단어장 옆에서는 검색을 어지럽히기만 했다.
//   API 키가 없을 때 도는 추측(runOfflineAutofill)은 어미 규칙만으로 그대로 돈다.
//   이 파일에는 기본 단어(DEFAULT_VOCABULARY)와 공용 도구들이 남아 있다.

        // Custom Toast Notification System
        function showToast(message, type = 'success') {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = `flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border text-sm font-bold transition-all duration-300 transform translate-y-2 opacity-0 pointer-events-auto max-w-xs md:max-w-md ${
                type === 'success' 
                ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                : type === 'error'
                ? 'bg-rose-50 border-rose-100 text-rose-800'
                : 'bg-amber-50 border-amber-100 text-amber-800'
            }`;
            
            const icon = type === 'success' 
                ? '<i class="fa-solid fa-circle-check text-emerald-500 text-base"></i>' 
                : type === 'error'
                ? '<i class="fa-solid fa-triangle-exclamation text-rose-500 text-base"></i>'
                : '<i class="fa-solid fa-lightbulb text-amber-500 text-base"></i>';
                
            toast.innerHTML = `${icon} <span class="flex-1">${message}</span>`;
            container.appendChild(toast);
            
            setTimeout(() => {
                toast.classList.remove('translate-y-2', 'opacity-0');
            }, 10);
            
            setTimeout(() => {
                toast.classList.add('translate-y-2', 'opacity-0');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        const AudioFX = {
            ctx: null,
            init() {
                if (!this.ctx) {
                    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
                }
            },
            playPunch() {
                this.init();
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(150, this.ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.15);
                gain.gain.setValueAtTime(0.8, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
                osc.start();
                osc.stop(this.ctx.currentTime + 0.15);
            },
            playBell() {
                this.init();
                const now = this.ctx.currentTime;
                const osc1 = this.ctx.createOscillator();
                const gain1 = this.ctx.createGain();
                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(1200, now);
                gain1.gain.setValueAtTime(0.3, now);
                gain1.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
                osc1.connect(gain1);
                gain1.connect(this.ctx.destination);
                const osc2 = this.ctx.createOscillator();
                const gain2 = this.ctx.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(1500, now);
                gain2.gain.setValueAtTime(0.15, now);
                gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
                osc2.connect(gain2);
                gain2.connect(this.ctx.destination);
                osc1.start(now);
                osc2.start(now);
                osc1.stop(now + 1.0);
                osc2.stop(now + 1.0);
            },
            playSuccess() {
                this.init();
                const now = this.ctx.currentTime;
                const notes = [300, 450, 600];
                notes.forEach((freq, idx) => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.frequency.setValueAtTime(freq, now + idx * 0.08);
                    gain.gain.setValueAtTime(0.15, now + idx * 0.08);
                    gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.08 + 0.15);
                    osc.start(now + idx * 0.08);
                    osc.stop(now + idx * 0.08 + 0.2);
                });
            },
            playError() {
                this.init();
                const now = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(180, now);
                osc.frequency.linearRampToValueAtTime(100, now + 0.25);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
                osc.start(now);
                osc.stop(now + 0.25);
            }
        };

        // [냐냐 PATCH-0배치] 전역 음소거 — play* 메서드를 감싸서 음소거 시 소리를 내지 않음
        Object.keys(AudioFX).forEach(k => {
            if (typeof AudioFX[k] === 'function' && k.indexOf('play') === 0) {
                const _orig = AudioFX[k];
                AudioFX[k] = function (...args) {
                    try { if (localStorage.getItem('demo_muted') === '1') return; } catch (e) {}
                    return _orig.apply(this, args);
                };
            }
        });

        // JSON 추출 및 파싱 안전 처리 (불필요한 텍스트 우회용)
        function extractAndParseJson(text) {
            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                const jsonString = text.substring(firstBrace, lastBrace + 1);
                return JSON.parse(jsonString);
            }
            throw new Error("No valid JSON object found in response");
        }

        // ============================================================
        // [냐냐 PATCH] Gemini API 키를 브라우저에 직접 저장/조회하는 헬퍼
        // 원래 코드는 apiKey가 항상 빈 문자열("")이라 모든 AI 호출이
        // 100% 실패하고 항상 오프라인 추측 로직으로 빠지고 있었습니다.
        // 이제 사용자가 직접 본인의 무료 Gemini API 키를 등록하면
        // 진짜 AI 응답을 받아올 수 있습니다.
        // ============================================================
        const GEMINI_KEY_STORAGE_NAME = 'demo_gemini_api_key';

        function getGeminiApiKey() {
            return (localStorage.getItem(GEMINI_KEY_STORAGE_NAME) || '').trim();
        }

        function hasGeminiApiKey() {
            return getGeminiApiKey().length > 0;
        }

        function openApiKeyModal() {
            const modal = document.getElementById('api-key-modal');
            const input = document.getElementById('api-key-input');
            input.value = getGeminiApiKey();
            modal.classList.remove('hidden');
        }

        function closeApiKeyModal() {
            document.getElementById('api-key-modal').classList.add('hidden');
        }

        function saveApiKey() {
            const input = document.getElementById('api-key-input');
            const value = input.value.trim();
            if (!value) {
                showToast("API 키를 입력해 주세요!", "error");
                return;
            }
            localStorage.setItem(GEMINI_KEY_STORAGE_NAME, value);
            closeApiKeyModal();
            showToast("Gemini API 키가 저장되었습니다! 이제부터 진짜 AI 추천이 작동합니다 ✨", "success");
            updateApiKeyBadge();
        }

        function clearApiKey() {
            localStorage.removeItem(GEMINI_KEY_STORAGE_NAME);
            document.getElementById('api-key-input').value = '';
            showToast("API 키가 삭제되었습니다.", "warning");
            updateApiKeyBadge();
        }

        function updateApiKeyBadge() {
            const badge = document.getElementById('api-key-status-badge');
            if (!badge) return;
            // [냐냐 요청] 설정 메뉴 행 형태. className은 건드리지 않음(레이아웃 깨짐 방지)
            const ok = hasGeminiApiKey();
            badge.innerHTML = `<span class="w-2 h-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-slate-400'} shrink-0"></span>`
                + `<span class="text-xs font-bold text-slate-700 flex-1">${ok ? 'AI 연결됨' : 'AI 키 미등록'}</span>`
                + `<i class="fa-solid fa-chevron-right text-[10px] text-slate-300"></i>`;
            if (typeof updateSettingsAlertDot === 'function') updateSettingsAlertDot();
        }
        // ============================================================
        // [냐냐 PATCH] 다른 기기로 데이터 옮기기 (이 앱은 서버가 없어서
        // localStorage에만 저장됨 → 기기/브라우저마다 따로 저장되는 게 정상 동작.
        // 수동으로 내보내기/가져오기 해서 다른 기기에 옮길 수 있게 함)
        // ============================================================
        function openBackupModal() {
            // 예전엔 여기서 4개 필드만 담아서, 문법 점수·직접 만든 표·알 상태가 백업에 빠져 있었다.
            // 이제 저장(saveToStorage)과 똑같은 payload 를 쓴다.
            document.getElementById('backup-export-area').value = JSON.stringify(buildDataPayload());
            document.getElementById('backup-import-area').value = '';
            document.getElementById('backup-modal').classList.remove('hidden');
        }

        // 백업이 커서(단어 수백 개) 복사·붙여넣기로 옮기다 잘리는 일이 있다. 파일로도 받게 한다.
        function downloadBackupFile() {
            const json = JSON.stringify(buildDataPayload());
            const stamp = new Date().toISOString().slice(0, 10);
            const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = `nyanya-backup-${stamp}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            showToast("백업 파일을 저장했어요! 안전한 곳에 보관해 주세요 💾", "success");
        }

        // 받아둔 백업 파일을 그대로 가져오기 칸에 넣어준다.
        function loadBackupFile(input) {
            const file = input.files && input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                document.getElementById('backup-import-area').value = String(reader.result || '');
                showToast("파일을 불러왔어요. 아래 '가져오기'를 눌러 주세요!", "info");
            };
            reader.onerror = () => showToast("파일을 읽지 못했어요.", "error");
            reader.readAsText(file);
            input.value = '';
        }

        function closeBackupModal() {
            document.getElementById('backup-modal').classList.add('hidden');
        }

        function copyBackupExport() {
            const area = document.getElementById('backup-export-area');
            area.select();
            try {
                navigator.clipboard.writeText(area.value);
                showToast("복사했어요! 다른 기기의 '가져오기'에 붙여넣어 주세요 📋", "success");
            } catch (e) {
                document.execCommand('copy');
                showToast("복사했어요! 다른 기기의 '가져오기'에 붙여넣어 주세요 📋", "success");
            }
        }

        function importBackupData() {
            const raw = document.getElementById('backup-import-area').value.trim();
            if (!raw) {
                showToast("붙여넣을 데이터가 없어요!", "error");
                return;
            }
            let parsed;
            try {
                parsed = JSON.parse(raw);
            } catch (e) {
                showToast("데이터 형식이 올바르지 않아요. 복사한 내용 전체를 그대로 붙여넣어 주세요!", "error");
                return;
            }
            if (!parsed || !Array.isArray(parsed.vocabulary)) {
                showToast("단어장 데이터를 찾을 수 없어요. 올바른 백업 내용인지 확인해 주세요!", "error");
                return;
            }
            showConfirm(
                "현재 기기의 데이터를 덮어쓸까요?",
                `가져올 데이터에는 단어 ${parsed.vocabulary.length}개가 들어있어요. 현재 이 기기에 저장된 데이터는 사라집니다.`,
                () => {
                    // 불러오기와 같은 경로를 써서 필드가 하나 빠지는 일이 없게 한다.
                    // (예전 4개짜리 백업도 그대로 들어온다 — 없는 값은 초기값이 된다)
                    applyDataPayload(parsed);
                    saveToStorage();
                    renderWordList();
                    updateStats();
                    renderDiary();
                    if (typeof renderGrammarTables === 'function') renderGrammarTables();
                    closeBackupModal();
                    showToast(`단어 ${vocabulary.length}개를 이 기기로 가져왔어요! 🎉`, "success");
                }
            );
        }
        // ============================================================

        // Live Gemini API Connector Utility
        // [PATCH-혼합모델] 단순 작업(단어 추천, 문장 생성)은 더 가볍고 빠른 Flash-Lite,
        // 정밀한 판단이 필요한 작업(첨삭 채점, 문법 설명)은 기존 Flash를 그대로 사용
        const GEMINI_MODEL_FLASH = 'gemini-3-flash-preview';
        const GEMINI_MODEL_FLASH_LITE = 'gemini-3.1-flash-lite';

        // [냐냐 PATCH] 기본 모델을 Flash → Flash-Lite로 변경 (더 빠름). 원복하려면 아래 model 기본값을
        // GEMINI_MODEL_FLASH 로 다시 바꾸면 됨.
        async function callGemini(promptText, systemInstruction = '', jsonSchema = null, thinkingLevel = 'low', model = GEMINI_MODEL_FLASH_LITE) {
            const apiKey = getGeminiApiKey(); // [PATCH] 더 이상 빈 문자열이 아니라 사용자가 등록한 실제 키를 사용
            if (!apiKey) {
                throw new Error("NO_API_KEY");
            }
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            
            const payload = {
                contents: [{ parts: [{ text: promptText }] }]
            };
            
            if (systemInstruction) {
                payload.systemInstruction = {
                    parts: [{ text: systemInstruction }]
                };
            }
            
            // [PATCH-속도개선] Gemini 3 계열은 기본적으로 깊게 "생각"하고 답하느라 느림.
            // 단순 사전조회/문장채점 수준에는 깊은 추론이 필요 없으므로 thinkingLevel을 낮춰서
            // 체감 응답속도를 크게 끌어올림. (minimal/low = 가장 빠름)
            payload.generationConfig = {
                thinkingConfig: { thinkingLevel: thinkingLevel.toUpperCase() },
                // [냐냐 요청] 768은 너무 빠듯했음 — 첨삭 응답(총평+단어분석+수정내역+팁)이
                //   한국어라 토큰을 많이 먹어서 JSON이 중간에 잘리는 일이 잦았다.
                //   상한일 뿐이라 짧은 응답은 그대로 짧게 끝나고 요금도 안 늘어난다.
                //   [냐냐 요청] 2048 → 4096. usedWords·usedGrammar 배열이 붙으면서 응답이 더
                //   길어졌고, 잘리면 JSON 파싱이 깨져 '네트워크 문제'처럼 보였다.
                maxOutputTokens: 4096
            };
            if (jsonSchema) {
                payload.generationConfig.responseMimeType = "application/json";
                payload.generationConfig.responseSchema = jsonSchema;
            }
            
            // [PATCH-에러분류] 401/403(키 오류), 429(요청 과다/한도초과)는 재시도해도 똑같이 실패하므로
            // 즉시 정확한 원인을 담아 에러를 던짐. 그 외(네트워크 끊김, 5xx)는 여러 번 재시도해서
            // 일시적인 통신/서버 문제는 사용자가 다시 누르지 않아도 알아서 복구되게 함.
            let delay = 500;
            const MAX_ATTEMPTS = 4; // 최초 1회 + 재시도 3회
            for (let i = 0; i < MAX_ATTEMPTS; i++) {
                try {
                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    if (!response.ok) {
                        const errBody = await response.text().catch(() => '');
                        let apiStatus = '';
                        let apiMessage = '';
                        try {
                            const parsed = JSON.parse(errBody);
                            apiStatus = parsed?.error?.status || '';
                            apiMessage = parsed?.error?.message || '';
                        } catch (parseErr) { /* 본문이 JSON이 아닐 수도 있음 */ }
                        const err = new Error(`API response status ${response.status}: ${apiMessage || errBody}`);
                        err.status = response.status;
                        err.apiStatus = apiStatus;
                        throw err;
                    }
                    const result = await response.json();
                    const cand = result.candidates?.[0];
                    const text = cand?.content?.parts?.[0]?.text || '';
                    // [냐냐 요청] 잘리거나 빈 응답을 여기서 잡아낸다.
                    //   예전엔 잘린 JSON을 그대로 돌려줘서 파싱이 깨졌고, 그 에러엔 status 가 없어
                    //   '네트워크 문제'로 안내됐다. 서버가 끊긴 줄 알기 딱 좋았다.
                    const finishReason = cand?.finishReason || '';
                    if (finishReason === 'MAX_TOKENS') {
                        const err = new Error('Response truncated (MAX_TOKENS)');
                        err.finishReason = 'MAX_TOKENS';
                        throw err;
                    }
                    if (!text) {
                        const reason = finishReason || result.promptFeedback?.blockReason || 'EMPTY';
                        const err = new Error(`Empty response (${reason})`);
                        err.finishReason = reason;
                        throw err;
                    }
                    return text;
                } catch (e) {
                    // 키 오류/요청형식 오류/한도초과는 재시도해도 소용없으므로 즉시 중단.
                    //   잘린 응답(MAX_TOKENS)도 다시 물어봐야 똑같이 잘리므로 바로 알린다.
                    const permanent = e.status === 400 || e.status === 401 || e.status === 403
                        || e.status === 429 || e.finishReason === 'MAX_TOKENS';
                    if (i === MAX_ATTEMPTS - 1 || permanent) throw e;
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2; // 0.5s → 1s → 2s 점진적으로 늘려가며 재시도
                }
            }
        }

        // [PATCH-에러분류] callGemini가 던진 에러를 사용자에게 보여줄 정확한 한국어 메시지로 변환
        function describeGeminiError(e) {
            const msg = String(e && e.message || '');
            if (msg.includes('NO_API_KEY')) {
                return "API 키가 없어서 AI를 사용할 수 없습니다.";
            }
            if (e && e.status === 401 || e && e.status === 403) {
                return "Gemini API 키가 유효하지 않아요. 우측 상단 배지에서 키를 다시 확인해 주세요.";
            }
            if (e && e.status === 429) {
                return "요청이 너무 많아서 잠시 제한됐어요 (무료 요금제는 분당/일일 요청 수 제한이 있어요). 1분 정도 후에 다시 시도해 주세요.";
            }
            if (e && e.status === 400) {
                return "요청 형식에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.";
            }
            if (e && (e.status >= 500)) {
                return "Gemini 서버에 일시적인 문제가 있어요. 잠시 후 다시 시도해 주세요.";
            }
            // [냐냐 요청] 잘린 응답·빈 응답을 '네트워크 문제'로 뭉뚱그리지 않는다.
            //   원인이 다르면 대처도 달라서 (문장을 줄이는 것 vs 인터넷 확인) 구분해서 알려준다.
            if (e && e.finishReason === 'MAX_TOKENS') {
                return "AI 답변이 너무 길어져서 중간에 잘렸어요. 문장을 조금 짧게 해서 다시 시도해 주세요.";
            }
            if (e && (e.finishReason === 'SAFETY' || e.finishReason === 'RECITATION')) {
                return "AI가 이 문장에는 답변을 만들지 않았어요. 문장을 조금 바꿔서 다시 시도해 주세요.";
            }
            if (e && e.finishReason) {
                return "AI가 답변을 만들지 못했어요. 잠시 후 다시 시도해 주세요.";
            }
            if (msg.includes('No valid JSON') || e instanceof SyntaxError) {
                return "AI 답변을 읽지 못했어요 (형식 오류). 다시 시도해 주세요.";
            }
            return "AI 통신 중 네트워크 문제가 발생했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.";
        }

        // [PATCH-속도개선] 같은 단어를 다시 조회할 때 AI를 또 호출하지 않고 즉시 재사용하기 위한 캐시
        const AI_WORD_CACHE_KEY = 'demo_ai_word_cache';
        function getAiWordCache() {
            try { return JSON.parse(localStorage.getItem(AI_WORD_CACHE_KEY) || '{}'); }
            catch (e) { return {}; }
        }
        function saveAiWordCache(word, result) {
            const cache = getAiWordCache();
            cache[word.toLowerCase().trim()] = result;
            try { localStorage.setItem(AI_WORD_CACHE_KEY, JSON.stringify(cache)); } catch (e) {}
        }

        function clearAiWordCacheUI() {
            try { localStorage.removeItem(AI_WORD_CACHE_KEY); } catch (e) {}
            showToast("단어 추천 캐시를 초기화했어요! 다음 AI 추천부터 새로 조회해요. ✨", "success");
        }


        const DEFAULT_VOCABULARY = [
            {
                id: "seed-1",
                word: "tener",
                meaning: "가지다",
                pos: "verb",
                verbClass: "irregular",
                irregularType: "1인칭 및 e ➡️ ie",
                conjugations: {
                    yo: "tengo",
                    tu: "tienes",
                    el: "tiene",
                    nos: "tenemos",
                    vos: "tenéis",
                    ellos: "tienen"
                },
                example: "No tengo dinero ahora.",
                exampleMeaning: "나 지금 돈이 한 푼도 없어.",
                notes: "· 소유를 나타내는 핵심 동사\n· 나이 표현에도 사용 (Tengo 20 años)",
                mastered: false
            },
            {
                id: "seed-2",
                word: "el agua",
                meaning: "물",
                pos: "noun",
                gender: "masculine",
                example: "Quiero el agua.",
                exampleMeaning: "저 그 물 좀 원해요.",
                notes: "· 문법상 여성명사지만 단수 관사는 el\n· 복수형은 여성형 las aguas",
                mastered: false
            },
            {
                id: "seed-3",
                word: "querer",
                meaning: "원하다",
                pos: "verb",
                verbClass: "irregular",
                irregularType: "e ➡️ ie",
                conjugations: {
                    yo: "quiero",
                    tu: "quieres",
                    el: "quiere",
                    nos: "queremos",
                    vos: "queréis",
                    ellos: "quieren"
                },
                example: "Hoy los quiero comer.",
                exampleMeaning: "나 오늘 그것들을 꼭 먹고 싶어.",
                notes: "· e→ie 불규칙 동사\n· nosotros·vosotros는 규칙형 유지",
                mastered: false
            },
            {
                id: "seed-4",
                word: "con",
                meaning: "~와 함께",
                pos: "preposition",
                example: "Quiero ir al cine con Margarita.",
                exampleMeaning: "마르가리타랑 같이 영화관에 가고 싶어.",
                notes: "· 전치사\n· '나와 함께'=conmigo, '너와 함께'=contigo",
                mastered: false
            },
            {
                id: "seed-5",
                word: "porque",
                meaning: "왜냐하면, ~때문에",
                pos: "conjunction",
                example: "No voy porque estoy muy cansado.",
                exampleMeaning: "나 너무 피곤하기 때문에 안 갈 거야.",
                notes: "· 접속사 (이유)\n· 의문사 '¿Por qué?'와 표기가 다름",
                mastered: false
            }
        ];
