const OFFLINE_DICT_DB = {
            "pelo": {
                meaning: "머리카락, 털", pos: "noun", gender: "masculine",
                example: "Me gusta el pelo largo.", exampleMeaning: "나는 긴 머리가 마음에 들어.",
                notes: "· 머리카락, 동물의 털 의미"
            },
            "libro": {
                meaning: "책", pos: "noun", gender: "masculine",
                example: "Leo un libro en español.", exampleMeaning: "나는 스페인어로 책 한 권을 읽는다.",
                notes: "· -o로 끝나는 전형적인 명사 형태\n· 복수형: libros"
            },
            "mesa": {
                meaning: "책상, 테이블", pos: "noun", gender: "feminine",
                example: "Pongo el vaso sobre la mesa.", exampleMeaning: "나는 잔을 테이블 위에 올려놓는다.",
                notes: "· -a로 끝나는 전형적인 명사 형태"
            },
            "casa": {
                meaning: "집", pos: "noun", gender: "feminine",
                example: "Mi casa es pequeña pero hermosa.", exampleMeaning: "우리 집은 작지만 참 예쁘다.",
                notes: "· 'en casa'는 관사 없이 '집에서' 의미"
            },
            "comer": {
                meaning: "먹다", pos: "verb", verbClass: "regular", irregularType: "none",
                conjugations: { yo: "como", tu: "comes", el: "come", nos: "comemos", vos: "coméis", ellos: "comen" },
                example: "Quiero comer una paella deliciosa.", exampleMeaning: "나는 맛있는 빠에야를 먹고 싶어.",
                notes: "· -er 규칙 동사\n· 어미만 바꾸면 변형 끝"
            },
            "vivir": {
                meaning: "살다, 거주하다", pos: "verb", verbClass: "regular", irregularType: "none",
                conjugations: { yo: "vivo", tu: "vives", el: "vive", nos: "vivimos", vos: "vivís", ellos: "viven" },
                example: "Yo vivo en Seúl hoy en día.", exampleMeaning: "나는 요즘 서울에 살고 있어.",
                notes: "· -ir 규칙 동사\n· 어미만 바꾸면 변형 끝"
            },
            "hablar": {
                meaning: "말하다, 대화하다", pos: "verb", verbClass: "regular", irregularType: "none",
                conjugations: { yo: "hablo", tu: "hablas", el: "habla", nos: "hablamos", vos: "habláis", ellos: "hablan" },
                example: "Ella habla español muy bien.", exampleMeaning: "그녀는 스페인어를 아주 유창하게 구사해.",
                notes: "· -ar 규칙 동사\n· 가장 기본적인 변화형"
            },
            "tener": {
                meaning: "가지다", pos: "verb", verbClass: "irregular", irregularType: "1인칭 및 e ➡️ ie",
                conjugations: { yo: "tengo", tu: "tienes", el: "tiene", nos: "tenemos", vos: "tenéis", ellos: "tienen" },
                example: "No tengo dinero ahora.", exampleMeaning: "나 지금 돈이 한 푼도 없어.",
                notes: "· 소유를 나타내는 핵심 동사\n· 나이 표현에도 사용 (Tengo 20 años)"
            },
            "querer": {
                meaning: "원하다, 사랑하다", pos: "verb", verbClass: "irregular", irregularType: "e ➡️ ie",
                conjugations: { yo: "quiero", tu: "quieres", el: "quiere", nos: "queremos", vos: "queréis", ellos: "quieren" },
                example: "Hoy los quiero comer.", exampleMeaning: "나 오늘 그것들을 꼭 먹고 싶어.",
                notes: "· e→ie 불규칙 동사\n· nosotros·vosotros는 규칙형 유지"
            },
            "poder": {
                meaning: "할 수 있다", pos: "verb", verbClass: "irregular", irregularType: "o ➡️ ue",
                conjugations: { yo: "puedo", tu: "puedes", el: "puede", nos: "podemos", vos: "podéis", ellos: "pueden" },
                example: "No puedo dártelo.", exampleMeaning: "너한테 그거 지금 넘겨줄 수 없어.",
                notes: "· o→ue 불규칙 동사, 영어 can과 유사\n· 뒤에 동사원형을 바로 붙여 사용"
            },
            "hacer": {
                meaning: "하다, 만들다", pos: "verb", verbClass: "irregular", irregularType: "1인칭",
                conjugations: { yo: "hago", tu: "haces", el: "hace", nos: "hacemos", vos: "hacéis", ellos: "hacen" },
                example: "¿Qué haces hoy?", exampleMeaning: "너 오늘 뭐 하니?",
                notes: "· 1인칭만 불규칙 (hago)\n· 날씨 표현에도 사용 (Hace frío)"
            },
            "oír": {
                meaning: "듣다", pos: "verb", verbClass: "irregular", irregularType: "기타 변형",
                conjugations: { yo: "oigo", tu: "oyes", el: "oye", nos: "oímos", vos: "oís", ellos: "oyen" },
                example: "¿Oyes esa música?", exampleMeaning: "그 음악 들려?",
                notes: "· 1인칭 oigo, 강세없는 인칭은 í→oy\n· nosotros/vosotros만 규칙형 유지"
            },
            "con": {
                meaning: "~와 함께", pos: "preposition",
                example: "Quiero ir al cine con Margarita.", exampleMeaning: "마르가리타랑 같이 영화관에 가고 싶어.",
                notes: "· 전치사\n· '나와 함께'=conmigo, '너와 함께'=contigo"
            },
            "para": {
                meaning: "~을 위해, ~ 방향으로", pos: "preposition",
                example: "Este regalo es para ti.", exampleMeaning: "이 선물은 너를 위한 거야.",
                notes: "· 전치사 (목적·방향)\n· por와 쓰임이 다르니 구별 필요"
            },
            "porque": {
                meaning: "왜냐하면, ~때문에", pos: "conjunction",
                example: "No voy porque estoy muy cansado.", exampleMeaning: "나 너무 피곤하기 때문에 안 갈 거야.",
                notes: "· 접속사 (이유)\n· 의문사 '¿Por qué?'와 표기가 다름"
            },
            "y": {
                meaning: "그리고, ~와/과", pos: "conjunction",
                example: "Margarita y yo somos amigos.", exampleMeaning: "마르가리타와 나는 친구야.",
                notes: "· 접속사 (그리고)\n· 뒤에 i/hi로 시작하는 단어가 오면 e로 변함"
            },
            "el agua": {
                meaning: "물", pos: "noun", gender: "masculine",
                example: "Quiero el agua.", exampleMeaning: "저 그 물 좀 원해요.",
                notes: "· 문법상 여성명사지만 단수 관사는 el\n· 강세 a로 시작해서 발음 충돌 회피"
            },
            "el ascensor": {
                meaning: "엘리베이터", pos: "noun", gender: "masculine",
                example: "El ascensor no funciona.", exampleMeaning: "엘리베이터가 고장 나서 작동을 안 해.",
                notes: "남성명사이며, 작동하지 않을 때는 'funcionar' 동사에 'no'를 붙여 말합니다."
            }
        };

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
        const GEMINI_KEY_STORAGE_NAME = 'nyanya_gemini_api_key';

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
            if (hasGeminiApiKey()) {
                badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> AI 연결됨`;
                badge.className = "flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 cursor-pointer";
            } else {
                badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span> AI 키 미등록`;
                badge.className = "flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200 cursor-pointer";
            }
        }
        // ============================================================
        // [냐냐 PATCH] 다른 기기로 데이터 옮기기 (이 앱은 서버가 없어서
        // localStorage에만 저장됨 → 기기/브라우저마다 따로 저장되는 게 정상 동작.
        // 수동으로 내보내기/가져오기 해서 다른 기기에 옮길 수 있게 함)
        // ============================================================
        function openBackupModal() {
            const exportData = {
                vocabulary: vocabulary,
                gymPunchesCount: gymPunchesCount,
                arenaScore: arenaScore,
                nyanyaDiary: nyanyaDiary
            };
            document.getElementById('backup-export-area').value = JSON.stringify(exportData);
            document.getElementById('backup-import-area').value = '';
            document.getElementById('backup-modal').classList.remove('hidden');
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
                    vocabulary = parsed.vocabulary;
                    gymPunchesCount = parsed.gymPunchesCount || 0;
                    arenaScore = parsed.arenaScore || 0;
                    nyanyaDiary = parsed.nyanyaDiary || {};
                    saveToStorage();
                    renderWordList();
                    updateStats();
                    renderDiary();
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

        async function callGemini(promptText, systemInstruction = '', jsonSchema = null, thinkingLevel = 'low', model = GEMINI_MODEL_FLASH) {
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
                maxOutputTokens: 768
            };
            if (jsonSchema) {
                payload.generationConfig.responseMimeType = "application/json";
                payload.generationConfig.responseSchema = jsonSchema;
            }
            
            // [PATCH-에러분류] 401/403(키 오류), 429(요청 과다/한도초과)는 재시도해도 똑같이 실패하므로
            // 즉시 정확한 원인을 담아 에러를 던짐. 그 외(네트워크 끊김, 5xx)만 짧게 한 번 재시도.
            let delay = 300;
            for (let i = 0; i < 2; i++) {
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
                    return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
                } catch (e) {
                    const permanent = e.status === 400 || e.status === 401 || e.status === 403 || e.status === 429;
                    if (i === 1 || permanent) throw e;
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2;
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
            return "AI 통신 중 네트워크 문제가 발생했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.";
        }

        // [PATCH-속도개선] 같은 단어를 다시 조회할 때 AI를 또 호출하지 않고 즉시 재사용하기 위한 캐시
        const AI_WORD_CACHE_KEY = 'nyanya_ai_word_cache';
        function getAiWordCache() {
            try { return JSON.parse(localStorage.getItem(AI_WORD_CACHE_KEY) || '{}'); }
            catch (e) { return {}; }
        }
        function saveAiWordCache(word, result) {
            const cache = getAiWordCache();
            cache[word.toLowerCase().trim()] = result;
            try { localStorage.setItem(AI_WORD_CACHE_KEY, JSON.stringify(cache)); } catch (e) {}
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

        let vocabulary = [];
        let activeTab = 'list';
        let currentFlashcardIndex = 0;
        let isFlashcardFlipped = false;
        let isMenuCollapsed = false;
        
        // Quiz & Game state
        let gymPunchesCount = 0;
        let arenaScore = 0;
        let nyanyaDiary = {}; 

        // [냐냐 PATCH-수준맞춤] 매번 전체 기록을 보내는 대신, 작은 누적 요약만 유지.
        // 문제 풀 때마다 살짝씩만 갱신되고 크기가 거의 고정이라 토큰/속도에 거의 영향 없음.
        let learnerProfile = { totalAnswered: 0, totalCorrect: 0, wrongByPos: {}, wrongByGrammarType: {} };

        // AI 꼬리대화 히스토리 및 힌트 상태 관리
        let aiChatHistory = [];
        let isAiHintVisible = false;

        // 실시간 입력 타이머
        // (실시간 입력 타이머는 더 이상 사용하지 않음 — AI 추천 버튼으로 대체됨)

        window.onload = async function() {
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
                gymPunchesCount: gymPunchesCount,
                arenaScore: arenaScore,
                nyanyaDiary: nyanyaDiary,
                learnerProfile: learnerProfile
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
                            gymPunchesCount: parseInt(localStorage.getItem('nyanya_punches') || '0'),
                            arenaScore: parseInt(localStorage.getItem('nyanya_score') || '0'),
                            nyanyaDiary: JSON.parse(localStorage.getItem('nyanya_diary') || '{}')
                        };
                    } catch (e) {}
                }
            }

            if (payload) {
                vocabulary = payload.vocabulary || [...DEFAULT_VOCABULARY];
                gymPunchesCount = payload.gymPunchesCount || 0;
                arenaScore = payload.arenaScore || 0;
                nyanyaDiary = payload.nyanyaDiary || {};
                learnerProfile = payload.learnerProfile || { totalAnswered: 0, totalCorrect: 0, wrongByPos: {}, wrongByGrammarType: {} };
                if (!learnerProfile.wrongByGrammarType) learnerProfile.wrongByGrammarType = {}; // 예전 데이터 마이그레이션
            } else {
                vocabulary = [...DEFAULT_VOCABULARY];
                gymPunchesCount = 0;
                arenaScore = 0;
                nyanyaDiary = {};
                learnerProfile = { totalAnswered: 0, totalCorrect: 0, wrongByPos: {}, wrongByGrammarType: {} };
            }

            // 첫 실행(Firebase가 비어있던 경우)이거나 로컬/예전 데이터로 복구한 경우,
            // 지금 상태를 다시 저장해서 다음부터는 모든 기기가 동기화되도록 함
            saveToStorage();
        }

        function updateSyncBadge(state) {
            const badge = document.getElementById('sync-status-badge');
            if (!badge) return;
            if (state === true) {
                badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> 모든 기기 동기화 중`;
                badge.className = "flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 cursor-pointer";
            } else if (state === 'claude-only') {
                badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Claude 안에서만 동기화`;
                badge.className = "flex items-center gap-1.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 cursor-pointer";
            } else if (state === 'no-password') {
                badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-violet-500"></span> 동기화 비밀번호 설정하기`;
                badge.className = "flex items-center gap-1.5 text-[10px] font-bold text-violet-600 bg-violet-50 px-2.5 py-1 rounded-full border border-violet-200 cursor-pointer";
            } else {
                badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span> 이 기기에만 저장됨`;
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
                nyanyaDiary[today] = { registeredTotal: 0, masteredTotal: 0, quizTotal: 0, quizCorrect: 0, aiSessions: 0 };
            }
            // 마이그레이션: 예전 데이터 구조(punches/quizzes/masters)가 남아있어도 안전하게 새 필드로 보강
            const d = nyanyaDiary[today];
            if (d.registeredTotal === undefined) d.registeredTotal = 0;
            if (d.masteredTotal === undefined) d.masteredTotal = 0;
            if (d.quizTotal === undefined) d.quizTotal = d.quizzes || 0;
            if (d.quizCorrect === undefined) d.quizCorrect = 0;
            if (d.aiSessions === undefined) d.aiSessions = 0;

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
            }
            // 'master'나 'snapshot' 타입은 touchDiarySnapshot()의 총합 갱신만으로 충분함

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
                    <div>등록 단어: <strong class="text-violet-600">${log.registeredTotal || 0}개</strong></div>
                    <div>마스터 단어: <strong class="text-emerald-600">${log.masteredTotal || 0}개</strong></div>
                    <div>풀이 퀴즈: <strong class="text-amber-600">${log.quizCorrect || 0}/${log.quizTotal || 0}개</strong></div>
                    <div>AI 첨삭: <strong class="text-indigo-600">${log.aiSessions || 0}회</strong></div>
                </div>
            `;
        }

        // ============================================================
        // [냐냐 PATCH] 학습기록 탭: 기간별 통계 + 그래프
        // ============================================================
        let currentRecordRange = '7d';

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

            const series = dateKeys.map(date => {
                const log = nyanyaDiary[date];
                if (log) {
                    if (log.registeredTotal !== undefined) lastRegistered = log.registeredTotal;
                    if (log.masteredTotal !== undefined) lastMastered = log.masteredTotal;
                }
                return {
                    date,
                    registeredTotal: lastRegistered,
                    masteredTotal: lastMastered,
                    quizTotal: (log && log.quizTotal) || 0,
                    quizCorrect: (log && log.quizCorrect) || 0,
                    aiSessions: (log && log.aiSessions) || 0
                };
            });

            const totalQuiz = series.reduce((sum, d) => sum + d.quizTotal, 0);
            const totalQuizCorrect = series.reduce((sum, d) => sum + d.quizCorrect, 0);
            const totalAi = series.reduce((sum, d) => sum + d.aiSessions, 0);
            const latestRegistered = series.length ? series[series.length - 1].registeredTotal : vocabulary.length;
            const latestMastered = series.length ? series[series.length - 1].masteredTotal : 0;

            document.getElementById('record-stat-words').innerText = `${latestRegistered}개`;
            document.getElementById('record-stat-mastered').innerText = `${latestMastered}개`;
            document.getElementById('record-stat-quiz').innerText = `${totalQuizCorrect}/${totalQuiz}`;
            document.getElementById('record-stat-ai').innerText = `${totalAi}회`;

            renderRecordLineChart(series);
            renderQuizChart(series);
            renderAiChart(series);
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

            const maxVal = Math.max(1, ...series.map(d => d.registeredTotal));
            const xStep = series.length > 1 ? chartW / (series.length - 1) : 0;
            const xOf = (i) => padding.left + i * xStep;
            const yOf = (val) => padding.top + chartH - (val / maxVal) * chartH;

            const buildPath = (key) => series.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(1)} ${yOf(d[key]).toFixed(1)}`).join(' ');
            const buildDots = (key, color, label) => series.map((d, i) => {
                const cx = xOf(i).toFixed(1);
                const cy = yOf(d[key]).toFixed(1);
                const text = `${d.date}: ${label} ${d[key]}개`.replace(/'/g, "\\'");
                return `<circle cx="${cx}" cy="${cy}" r="2.5" fill="${color}"/><circle cx="${cx}" cy="${cy}" r="9" fill="transparent" style="cursor:pointer" onclick="showChartTooltip(event, 'record-line-chart-tooltip', '${text}')"/>`;
            }).join('');

            container.innerHTML = `
                ${recordChartTooltipDiv('record-line-chart-tooltip')}
                <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
                    ${recordChartGridlines(maxVal, padding, chartW, chartH, width, '개')}
                    <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#cbd5e1" stroke-width="1"/>
                    <path d="${buildPath('registeredTotal')}" fill="none" stroke="#8b5cf6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="${buildPath('masteredTotal')}" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    ${buildDots('registeredTotal', '#8b5cf6', '등록 단어')}
                    ${buildDots('masteredTotal', '#10b981', '마스터 단어')}
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
                'records': 'nav-records'
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
                setRecordRange('7d');
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
