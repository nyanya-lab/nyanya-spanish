let quizSession = null;
        let quizReviewPoolOverride = null; // [냐냐 PATCH] 오늘의 복습 전용 단어 풀 (있으면 범위 무시)
        let selectedQuizCount = 30;

        function initQuizTab() {
            document.getElementById('quiz-setup-screen').classList.remove('hidden');
            document.getElementById('quiz-question-screen').classList.add('hidden');
            document.getElementById('quiz-results-screen').classList.add('hidden');
            document.getElementById('quiz-combo-box').classList.add('hidden');

            const startBtn = document.getElementById('quiz-start-btn');
            const sub = document.getElementById('quiz-setup-sub');
            // [냐냐 PATCH] 마스터한 단어는 퀴즈에서 제외 — 아직 안 외운 단어만 출제
            const reviewablePool = vocabulary.filter(w => !w.mastered);
            if (reviewablePool.length < 2) {
                sub.innerText = vocabulary.length >= 2
                    ? '복습할 단어가 부족해요! (마스터한 단어는 제외돼요. 전부 마스터하셨다면 멋져요 🎉)'
                    : '퀴즈를 시작하려면 단어장에 최소 2개 이상의 단어를 등록해 주어야 합니다!';
                startBtn.disabled = true;
                startBtn.className = "bg-slate-300 text-white px-8 py-3 rounded-xl text-sm font-bold cursor-not-allowed";
            } else {
                sub.innerText = '객관식과 주관식(스페인어 작문)이 섞여서 나와요 (마스터한 단어는 제외돼요)';
                startBtn.disabled = false;
                startBtn.className = "bg-violet-600 hover:bg-violet-700 text-white px-8 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 shadow-md shadow-violet-100";
            }
        }

        function selectQuizCount(count, btnEl) {
            selectedQuizCount = count;
            document.querySelectorAll('.quiz-count-btn').forEach(btn => {
                btn.className = "quiz-count-btn px-6 py-3 rounded-xl border-2 border-slate-200 font-bold text-slate-600 hover:border-violet-300 transition-all";
            });
            btnEl.className = "quiz-count-btn px-6 py-3 rounded-xl border-2 border-violet-500 bg-violet-50 font-bold text-violet-600 transition-all";
        }

        let selectedQuizFormat = 'mc'; // 'mc' | 'subjective' | 'mixed'
        function selectQuizFormat(fmt, btnEl) {
            selectedQuizFormat = fmt;
            document.querySelectorAll('.quiz-format-btn').forEach(btn => {
                btn.className = "quiz-format-btn py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 text-xs font-bold hover:border-violet-300 transition-all";
            });
            btnEl.className = "quiz-format-btn py-2.5 rounded-xl border-2 border-violet-500 bg-violet-50 text-violet-600 text-xs font-bold transition-all";
        }

        // [냐냐 PATCH] 약점 집중 모드 — 퀴즈 탭으로 이동 후 약점 단어만으로 바로 시작
        // ============================================================
        // [냐냐 PATCH-4차] 유의어 묶음 퀴즈 — 유의어/반의어가 등록된 단어만 출제
        //   ① "다음 중 feliz 의 반의어는?"  (객관식)
        //   ② "차이 구분: '겉으로 드러나는 밝음' 쪽은?" (차이 설명 활용, 객관식)
        //   → 차이를 서술이 아니라 객관식으로 물어서 부담 없이 학습
        // ============================================================
        function buildSynonymQuestions(sourcePool, maxCount) {
            const out = [];
            // 링크가 살아있는 단어만 (상대 단어가 삭제됐으면 제외)
            const linked = (sourcePool || vocabulary).filter(w =>
                Array.isArray(w.synonyms) && w.synonyms.some(l => vocabulary.find(v => v.id === l.id))
            );
            if (linked.length === 0) return out;

            const shuffled = shuffleArray([...linked]);
            const limit = Math.min(maxCount, shuffled.length);

            for (let i = 0; i < limit; i++) {
                const w = shuffled[i];
                const links = w.synonyms
                    .map(l => ({ link: l, t: vocabulary.find(v => v.id === l.id) }))
                    .filter(x => x.t);
                if (links.length === 0) continue;

                // '차이' 설명이 있으면 35% 확률로 차이 구분 문제
                //   ⚠️ 차이 설명은 양방향으로 공유되므로, 설명이 "어느 쪽 단어를 가리키는지"를
                //      본문에서 직접 찾아야 함 (안 그러면 정답이 뒤집힘)
                // [냐냐 PATCH] '차이 구분' 문제는 유의어만 (반의어는 반대말이라 차이 설명이 없음)
                // [냐냐 PATCH] '차이 구분' 문제 — 두 단어를 직접 제시하고, 한쪽 설명만 물어봄
                //   차이 형식: "dormido : 완전히 잠든 상태 | adormecido : 잠들기 직전의 졸림"
                //   → "dormido, adormecido 중 '완전히 잠든 상태'를 뜻하는 단어는?" (보기 2개)
                const withDiff = links.filter(x => x.link.type !== 'antonym' && (x.link.difference || '').trim().length > 3);
                if (withDiff.length > 0 && Math.random() < 0.35) {
                    const pick = withDiff[Math.floor(Math.random() * withDiff.length)];
                    const rows = (typeof parseDifference === 'function') ? parseDifference(pick.link.difference) : null;
                    // 새 형식(단어 : 설명 | 단어 : 설명)으로 파싱되고, 단어 이름이 제대로 들어있을 때만 출제
                    const usable = rows && rows.length >= 2 && rows.every(r => r.word && r.desc);
                    if (usable) {
                        const askIdx = Math.floor(Math.random() * rows.length);
                        const asked = rows[askIdx];
                        // 설명에 적힌 단어 이름이 실제 단어와 매칭되는지 확인
                        const match = (name) => {
                            const n = normalizeSpanishAnswer(name);
                            if (normalizeSpanishAnswer(w.word) === n) return w.word;
                            if (normalizeSpanishAnswer(pick.t.word) === n) return pick.t.word;
                            return null;
                        };
                        const answerWord = match(asked.word);
                        const choices = rows.map(r => match(r.word)).filter(Boolean);
                        if (answerWord && choices.length >= 2) {
                            out.push({
                                type: 'syn-mc',
                                word: w,
                                answer: answerWord,
                                choices: shuffleArray([...new Set(choices)]),
                                promptText: `🔍 차이 구분 — "${asked.desc}" 을(를) 뜻하는 단어는?`,
                                synInfo: { partner: pick.t, kind: pick.link.type, difference: pick.link.difference }
                            });
                            continue;
                        }
                    }
                    // 옛 형식이거나 파싱 실패 → 차이 문제는 건너뛰고 아래 일반 유의어 문제로
                }

                // 일반 유의어/반의어 문제 — 한 유형(유의어 or 반의어)을 골라 그 중 하나를 정답으로
                const pickType = Math.random() < 0.5 ? 'synonym' : 'antonym';
                let typed = links.filter(x => (x.link.type === 'antonym' ? 'antonym' : 'synonym') === pickType);
                if (typed.length === 0) typed = links; // 그 유형이 없으면 아무거나
                const pick = typed[Math.floor(Math.random() * typed.length)];
                const kind = pick.link.type === 'antonym' ? 'antonym' : 'synonym';
                const kindLabel = kind === 'antonym' ? '반의어' : '유의어';

                // 오답 보기: 같은 품사의 다른 단어 (그 단어의 유의어/반의어가 아닌 것)
                const relatedIds = w.synonyms.map(l => l.id);
                let filler = shuffleArray(vocabulary
                    .filter(v => v.id !== w.id && !relatedIds.includes(v.id) && v.pos === w.pos)
                    .map(v => v.word));
                if (filler.length < 3) {
                    const more = shuffleArray(vocabulary
                        .filter(v => v.id !== w.id && !relatedIds.includes(v.id) && v.pos !== w.pos)
                        .map(v => v.word));
                    filler = filler.concat(more);
                }
                if (filler.length < 2) continue; // 보기가 너무 적으면 출제 안 함

                let choices = [pick.t.word, ...filler.slice(0, 3)];
                choices = shuffleArray([...new Set(choices)]);
                out.push({
                    type: 'syn-mc',
                    word: w,
                    answer: pick.t.word,
                    choices,
                    promptText: `다음 중 "${w.word}" 의 ${kindLabel}는?`,
                    synInfo: { partner: pick.t, kind, difference: pick.link.difference || '' }
                });
            }
            return out;
        }

        // ============================================================
        // [냐냐 PATCH] 문제 유형별 비율 (관용구 · 유의어). 나머지는 단어(뜻) 문제가 자동으로 채움
        // ============================================================
        const QUIZ_MIX_DEFAULT = { idiom: 20, synonym: 10 };
        let quizMix = { ...QUIZ_MIX_DEFAULT };

        function loadQuizMix() {
            try { const r = localStorage.getItem('nyanya_quiz_mix'); if (r) quizMix = { ...QUIZ_MIX_DEFAULT, ...JSON.parse(r) }; } catch (e) {}
        }
        function saveQuizMix() {
            try { localStorage.setItem('nyanya_quiz_mix', JSON.stringify(quizMix)); } catch (e) {}
        }
        function renderQuizMix() {
            const box = document.getElementById('quiz-mix-box');
            if (!box) return;
            const rows = [
                { key: 'idiom', label: '📘 관용구', color: 'accent-violet-600' },
                { key: 'synonym', label: '🟰 유의어·반의어', color: 'accent-sky-600' }
            ];
            const wordPct = Math.max(0, 100 - (quizMix.idiom || 0) - (quizMix.synonym || 0));
            box.innerHTML = rows.map(r => `
                <div class="flex items-center gap-3">
                    <span class="text-xs font-bold text-slate-600 w-28 shrink-0">${r.label}</span>
                    <input type="range" min="0" max="60" step="5" value="${quizMix[r.key]}"
                        oninput="setQuizMix('${r.key}', this.value)"
                        class="flex-1 ${r.color}">
                    <span class="text-xs font-black text-slate-700 w-10 text-right">${quizMix[r.key]}%</span>
                </div>`).join('') + `
                <div class="flex items-center gap-3 pt-1 border-t border-slate-200">
                    <span class="text-xs font-bold text-slate-500 w-28 shrink-0">📝 단어(뜻) 문제</span>
                    <div class="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden"><div class="h-full bg-emerald-400" style="width:${wordPct}%"></div></div>
                    <span class="text-xs font-black text-emerald-600 w-10 text-right">${wordPct}%</span>
                </div>`;
        }
        function setQuizMix(key, val) {
            let v = parseInt(val, 10) || 0;
            // 관용구 + 유의어가 90%를 넘지 않게 (단어 문제 최소 10% 확보)
            const other = key === 'idiom' ? (quizMix.synonym || 0) : (quizMix.idiom || 0);
            if (v + other > 90) v = 90 - other;
            quizMix[key] = v;
            saveQuizMix();
            renderQuizMix();
        }
        function resetQuizMix() {
            quizMix = { ...QUIZ_MIX_DEFAULT };
            saveQuizMix();
            renderQuizMix();
        }

        function startQuiz() {
            // [냐냐 PATCH] 오늘의 복습 전용 풀이 지정된 경우: 범위 무시하고 그 단어들로 진행
            let reviewablePool;
            if (quizReviewPoolOverride && quizReviewPoolOverride.length >= 2) {
                reviewablePool = quizReviewPoolOverride;
                quizReviewPoolOverride = null; // 1회성 (다음 퀴즈엔 영향 없음)
            } else {
                quizReviewPoolOverride = null;
                // [냐냐 PATCH] 출제 범위: 체크박스로 여러 개 선택 (마스터 제외/마스터/약점 단어/승급 대기)
                const wantNotMastered = document.getElementById('scope-not-mastered')?.checked;
                const wantMastered = document.getElementById('scope-mastered')?.checked;
                const wantWeak = document.getElementById('scope-weak')?.checked;
                const wantPromotion = document.getElementById('scope-promotion')?.checked;

                if (!wantNotMastered && !wantMastered && !wantWeak && !wantPromotion) {
                    showToast("출제 범위를 최소 하나는 선택해 주세요!", "error");
                    return;
                }

                // [냐냐 PATCH-0배치] 승급 대기 단어 = 통합 점수 3점 이상 + 아직 마스터 안 됨
                const promotionWords = vocabulary.filter(w => !w.mastered && getScore(w) >= 3);
                // [냐냐 PATCH] 승급 대기 5개 제한은 "승급 대기만" 단독 선택했을 때만 적용
                //   다른 범위도 같이 골랐으면 그쪽 단어로 채우면 되니까 막지 않음
                const onlyPromotion = wantPromotion && !wantNotMastered && !wantMastered && !wantWeak;
                if (onlyPromotion && promotionWords.length < 5) {
                    showToast(`아직 승급할 단어가 5개 미만이에요! (현재 ${promotionWords.length}개) 다른 범위도 함께 선택하거나, 퀴즈를 더 풀어보세요.`, "info");
                    return;
                }

                // [냐냐 PATCH] 선택된 범위들의 합집합 (중복 제거)
                //   ⭐ 우선순위: 승급 대기 > 약점 > 나머지
                //      → 문제 수가 모자라면 승급 대기 단어부터 채워짐
                const poolSet = new Map();
                if (wantPromotion) promotionWords.forEach(w => poolSet.set(w.id, w));
                if (wantWeak) vocabulary.filter(w => w.weak).forEach(w => poolSet.set(w.id, w));
                if (wantNotMastered) vocabulary.filter(w => !w.mastered).forEach(w => poolSet.set(w.id, w));
                if (wantMastered) vocabulary.filter(w => w.mastered).forEach(w => poolSet.set(w.id, w));
                reviewablePool = [...poolSet.values()];
            }

            if (reviewablePool.length < 2) {
                showToast("출제할 단어가 2개 이상 있어야 해요! 출제 범위를 바꿔보세요.", "error");
                return;
            }
            // [냐냐 PATCH] 단어 하나당 문제 하나 (반복 출제 금지)
            //   출제할 단어가 3개뿐이면 → 문제도 3개. 예전엔 같은 단어를 4번까지 재탕했음
            const count = Math.min(selectedQuizCount, reviewablePool.length);

            // [냐냐 PATCH] 관용구 문제 풀 준비 (관용구는 객관식만)
            const allIdioms = [];
            reviewablePool.forEach(w => {
                const list = (w.idioms && w.idioms.length > 0) ? w.idioms : (w.idiom ? [{ idiom: w.idiom, idiomMeaning: w.idiomMeaning || '' }] : []);
                list.forEach(it => { if (it.idiom && it.idiomMeaning) allIdioms.push({ ...it, word: w }); });
            });
            const allIdiomsGlobal = [];
            vocabulary.forEach(w => {
                const list = (w.idioms && w.idioms.length > 0) ? w.idioms : (w.idiom ? [{ idiom: w.idiom, idiomMeaning: w.idiomMeaning || '' }] : []);
                list.forEach(it => { if (it.idiom && it.idiomMeaning) allIdiomsGlobal.push(it); });
            });

            // [냐냐 PATCH] 관용구 문제 수는 전체 문제(count)의 약 20%로 하되, 전체 개수는 선택한 수를 넘지 않음
            // 주관식만 모드에서는 관용구(객관식) 문제를 넣지 않음
            // [냐냐 PATCH] 유형별 비율은 슬라이더(quizMix)에서 가져옴
            const canMakeIdiomQuiz = allIdioms.length >= 1 && allIdiomsGlobal.length >= 2 && selectedQuizFormat !== 'subjective';
            const idiomCount = canMakeIdiomQuiz ? Math.min(Math.round(count * (quizMix.idiom || 0) / 100), allIdioms.length) : 0;

            const synPoolSize = reviewablePool.filter(w =>
                Array.isArray(w.synonyms) && w.synonyms.some(l => vocabulary.find(v => v.id === l.id))
            ).length;
            const synCount = (selectedQuizFormat !== 'subjective')
                ? Math.min(Math.round(count * (quizMix.synonym || 0) / 100), synPoolSize)
                : 0;

            const wordCount = Math.max(0, count - idiomCount - synCount);

            const questions = [];
            // [냐냐 PATCH] 단어 문제 — 승급대기 그룹을 우선하되, 각 그룹 "안에서는" 셔플해서 매번 다른 단어가 나오게
            //   (예전엔 배열 앞쪽만 계속 뽑혀서 같은 단어가 반복되는 것처럼 보였음)
            const shuffle = (arr) => { const a = [...arr]; for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; };
            //   승급대기 = 통합점수 3점 이상 + 미마스터 (여기서 다시 계산 — 위 블록 스코프 밖이라)
            const promoIdSet = new Set(vocabulary.filter(x => !x.mastered && getScore(x) >= 3).map(x => x.id));
            const promo = shuffle(reviewablePool.filter(x => promoIdSet.has(x.id)));
            const rest = shuffle(reviewablePool.filter(x => !promoIdSet.has(x.id)));
            const wordQueue = [...promo, ...rest]; // 승급대기 먼저, 각 그룹은 셔플
            for (let i = 0; i < wordCount && i < wordQueue.length; i++) {
                const w = wordQueue[i];
                // [냐냐 PATCH] 문제 유형: 객관식만 / 주관식만 / 섞어서(약 30% 주관식)
                let isSubjective;
                if (selectedQuizFormat === 'mc') isSubjective = false;
                else if (selectedQuizFormat === 'subjective') isSubjective = true;
                else isSubjective = Math.random() < 0.3;
                const q = { word: w, type: isSubjective ? 'subjective' : 'mc' };

                // [냐냐 PATCH] 동사이고 활용 정보가 있으면 30% 확률로 '활용형 문제' 출제 (B방식: 원형 숨김)
                //   여러 시제가 등록돼 있으면 그 중 랜덤으로 출제
                const tenseMap = {
                    presente: '직설법 현재', indefinido: '직설법 부정과거', imperfecto: '직설법 불완료과거',
                    futuro: '직설법 미래', condicional: '조건법', subjPresente: '접속법 현재',
                    subjImperfecto: '접속법 불완료과거', imperativo: '명령법'
                };
                // 사용 가능한 시제 목록 수집 (구버전 conjugations는 presente로 취급)
                const availableTenses = [];
                if (w.pos === 'verb') {
                    if (w.conjugationsByTense) {
                        Object.keys(tenseMap).forEach(t => {
                            const c = w.conjugationsByTense[t];
                            if (c && (c.yo || c.tu || c.el || c.nos || c.vos || c.ellos)) availableTenses.push({ key: t, data: c });
                        });
                    } else if (w.conjugations && (w.conjugations.yo || w.conjugations.el)) {
                        availableTenses.push({ key: 'presente', data: w.conjugations });
                    }
                }
                if (availableTenses.length > 0 && selectedQuizFormat !== 'mc' && Math.random() < 0.3) {
                    const pickedTense = availableTenses[Math.floor(Math.random() * availableTenses.length)];
                    const conj = pickedTense.data;
                    const forms = [
                        { key: 'yo', label: '1인칭 단수 (yo)' },
                        { key: 'tu', label: '2인칭 단수 (tú)' },
                        { key: 'el', label: '3인칭 단수 (él/ella)' },
                        { key: 'nos', label: '1인칭 복수 (nosotros)' },
                        { key: 'vos', label: '2인칭 복수 (vosotros)' },
                        { key: 'ellos', label: '3인칭 복수 (ellos/ellas)' },
                    ].filter(f => conj[f.key]); // 값이 있는 형태만
                    if (forms.length > 0) {
                        const pick = forms[Math.floor(Math.random() * forms.length)];
                        questions.push({
                            word: w,
                            type: 'conjugation',
                            conjKey: pick.key,
                            conjLabel: pick.label,
                            tenseKey: pickedTense.key,
                            tenseLabel: tenseMap[pickedTense.key],
                            answer: conj[pick.key]
                        });
                        continue; // 이 문제는 활용형으로 대체
                    }
                }

                if (!isSubjective) {
                    q.answer = w.meaning;
                    let choices = [w.meaning];
                    // [냐냐 PATCH] 보기(오답)는 정답 단어와 같은 품사에서 우선 뽑기
                    const samePos = vocabulary.filter(x => x.id !== w.id && x.pos === w.pos).map(x => x.meaning);
                    const otherPos = vocabulary.filter(x => x.id !== w.id && x.pos !== w.pos).map(x => x.meaning);
                    let pool = [...new Set(samePos)]; // 같은 품사 우선, 중복 제거
                    shuffleArray(pool);
                    // 같은 품사가 3개 미만이면 다른 품사로 채움
                    if (pool.length < 3) {
                        const filler = shuffleArray([...new Set(otherPos)]);
                        pool = pool.concat(filler);
                    }
                    // 정답과 같은 뜻은 제외
                    pool = pool.filter(m => m !== w.meaning);
                    choices = choices.concat(pool.slice(0, 3));
                    shuffleArray(choices);
                    q.choices = choices;
                }
                questions.push(q);
            }

            // 관용구 문제 (양방향 섞어서)
            for (let i = 0; i < idiomCount; i++) {
                const target = allIdioms[Math.floor(Math.random() * allIdioms.length)];
                // [냐냐 PATCH] 섞어서/주관식 모드에서 30% 확률로 '뜻 해석 주관식' 문제 (AI가 유연하게 채점)
                const canSubjective = selectedQuizFormat === 'subjective' || (selectedQuizFormat === 'mixed' && Math.random() < 0.3);
                if (canSubjective) {
                    // 방향 랜덤: 스→한(뜻 쓰기) 또는 한→스(관용구 쓰기)
                    const askSpanish = Math.random() < 0.5;
                    if (askSpanish) {
                        questions.push({
                            type: 'idiom-subjective',
                            subDir: 'ko-es', // 한국어 뜻 → 스페인어 관용구 입력
                            word: target.word,
                            answer: target.idiom,
                            idiomData: target,
                            promptText: `"${target.idiomMeaning}" 를 뜻하는 스페인어 관용구를 써보세요.`
                        });
                    } else {
                        questions.push({
                            type: 'idiom-subjective',
                            subDir: 'es-ko', // 스페인어 관용구 → 한국어 뜻 입력
                            word: target.word,
                            answer: target.idiomMeaning,
                            idiomData: target,
                            promptText: `관용구 "${target.idiom}"의 뜻을 한국어로 써보세요.`
                        });
                    }
                    continue;
                }
                const showIdiomAskMeaning = Math.random() < 0.5; // true: 관용구 보여주고 뜻, false: 뜻 보여주고 관용구
                let answer, distractorField, promptText;
                if (showIdiomAskMeaning) {
                    answer = target.idiomMeaning;
                    promptText = `관용구 "${target.idiom}"의 뜻은 무엇일까요?`;
                    distractorField = 'idiomMeaning';
                } else {
                    answer = target.idiom;
                    promptText = `"${target.idiomMeaning}" — 이 뜻의 관용구는 무엇일까요?`;
                    distractorField = 'idiom';
                }
                let choices = [answer];
                let pool = allIdiomsGlobal.map(it => it[distractorField]).filter(v => v && v !== answer);
                pool = [...new Set(pool)];
                shuffleArray(pool);
                choices = choices.concat(pool.slice(0, 3));
                shuffleArray(choices);
                questions.push({ type: 'idiom-mc', word: target.word, answer: answer, choices: choices, promptText: promptText, idiomData: target });
            }

            // [냐냐 PATCH-4차] 유의어 묶음 문제 (위에서 count 안에 몫을 떼둔 만큼만)
            if (synCount > 0) {
                questions.push(...buildSynonymQuestions(reviewablePool, synCount));
            }

            // 총 개수가 선택한 수를 절대 넘지 않게 마지막으로 한 번 더 자름
            if (questions.length > count) questions.length = count;

            // 단어 문제 + 관용구 문제 + 유의어 문제 전체를 섞음
            shuffleArray(questions);

            quizSession = { questions: questions, currentIndex: 0, correctCount: 0, wrongList: [], correctWordIds: [] };

            document.getElementById('quiz-setup-screen').classList.add('hidden');
            document.getElementById('quiz-results-screen').classList.add('hidden');
            document.getElementById('quiz-question-screen').classList.remove('hidden');
            document.getElementById('quiz-combo-box').classList.remove('hidden');
            renderQuizQuestion();
        }

        function renderQuizQuestion() {
            const q = quizSession.questions[quizSession.currentIndex];
            document.getElementById('quiz-question-counter').innerText = `${quizSession.currentIndex + 1} / ${quizSession.questions.length}`;
            document.getElementById('arena-score').innerText = `정답 ${quizSession.correctCount}개`;
            document.getElementById('quiz-progress-text').innerText = `${quizSession.currentIndex + 1}/${quizSession.questions.length}`;

            document.getElementById('quiz-review-panel').classList.add('hidden');
            const nextBtn = document.getElementById('quiz-next-btn');
            nextBtn.disabled = true;
            nextBtn.className = "w-full bg-slate-300 text-white py-3 rounded-xl text-sm font-bold transition-all cursor-not-allowed";

            const coach = document.getElementById('quiz-coach-character');
            coach.innerText = "🧑‍🏫";

            if (q.type === 'mc' || q.type === 'idiom-mc' || q.type === 'syn-mc') {
                // [냐냐 PATCH-4차] syn-mc = 유의어/반의어 묶음 문제 (객관식)
                document.getElementById('quiz-question-label').innerText =
                    q.type === 'idiom-mc' ? '관용구 QUESTION'
                    : (q.type === 'syn-mc' ? '유의어 QUESTION' : 'QUESTION');
                document.getElementById('quiz-question-text').innerText =
                    (q.type === 'idiom-mc' || q.type === 'syn-mc')
                    ? q.promptText
                    : `스페인어 "${q.word.word}"의 올바른 한국어 뜻은 무엇일까요?`;
                document.getElementById('quiz-choices-box').classList.remove('hidden');
                document.getElementById('quiz-subjective-box').classList.add('hidden');

                const box = document.getElementById('quiz-choices-box');
                box.innerHTML = '';
                q.choices.forEach((choice, idx) => {
                    box.innerHTML += `
                        <button onclick="submitMcAnswer('${choice.replace(/'/g, "\\'")}', this)" class="w-full bg-white border-2 border-slate-200 rounded-2xl py-4 px-5 text-slate-700 text-sm font-bold transition-all text-center flex items-center justify-center gap-2 hover:border-violet-400 hover:bg-violet-50 active:scale-95 shadow-sm">
                            <span class="w-6 h-6 rounded-full bg-slate-100 text-slate-400 text-xs flex items-center justify-center font-black">${idx + 1}</span>
                            <span class="flex-1">${choice}</span>
                        </button>
                    `;
                });
            } else {
                // 주관식 또는 활용형 문제
                if (q.type === 'conjugation') {
                    document.getElementById('quiz-question-label').innerText = '동사 활용';
                    // [냐냐 PATCH] B방식: 원형(스페인어)을 숨기고 한국어 뜻 + 시제로 물어봄
                    const tenseName = q.tenseLabel || '현재시제';
                    document.getElementById('quiz-question-text').innerHTML = `<b class="text-violet-600">${q.word.meaning}</b>의 ${tenseName} <b>${q.conjLabel}</b>은?`;
                } else if (q.type === 'idiom-subjective') {
                    document.getElementById('quiz-question-label').innerText = '관용구 뜻풀이';
                    if (q.subDir === 'ko-es') {
                        document.getElementById('quiz-question-text').innerHTML = `<b class="text-violet-600">${q.idiomData.idiomMeaning}</b> 를 뜻하는 스페인어 관용구를 써보세요.`;
                    } else {
                        document.getElementById('quiz-question-text').innerHTML = `관용구 <b class="text-violet-600">${q.idiomData.idiom}</b>의 뜻을 한국어로 써보세요.`;
                    }
                } else {
                    document.getElementById('quiz-question-label').innerText = 'WRITE IN SPANISH';
                    // [냐냐 PATCH] 형용사는 남성형(사전형)으로 통일해서 물어봄 — 답이 하나로 명확해짐
                    const genderHint = (q.word.pos === 'adjective') ? ' <span class="text-violet-500">(남성형)</span>' : '';
                    document.getElementById('quiz-question-text').innerHTML = `${q.word.meaning} → 스페인어로 써보세요!${genderHint}`;
                }
                document.getElementById('quiz-choices-box').classList.add('hidden');
                document.getElementById('quiz-subjective-box').classList.remove('hidden');
                const input = document.getElementById('quiz-subjective-input');
                input.value = '';
                input.disabled = false;
                const synHint = document.getElementById('quiz-synonym-hint');
                if (synHint) synHint.classList.add('hidden'); // 새 문제면 동의어 힌트 숨김
                document.getElementById('quiz-subjective-submit-btn').disabled = false;
                setTimeout(() => input.focus(), 50);
            }
        }

        // [냐냐 PATCH] 서술형 답 분석 — 오답일 때 힌트 생성 (동의어/성수틀림/철자근접)
        // AI 없이 문자열 비교로 처리 (빠름). 반환: {isCorrect, hint}
        function analyzeSubjectiveAnswer(userRaw, q) {
            const correct = q.word.word;
            const correctNorm = normalizeSpanishAnswer(correct);
            const userNorm = normalizeSpanishAnswer(userRaw);

            // 1) 정답 (악센트/관사 관용 처리 후 일치)
            if (userNorm === correctNorm) return { isCorrect: true, hint: '' };

            // 빈칸이면 힌트 없이 오답
            if (!userRaw.trim()) return { isCorrect: false, hint: '' };

            // 2) 성/수 틀림 감지 (형용사) — 어근이 같은데 어미만 다름
            //    corto vs corta, egoísta vs egoísto 등
            const stem = (s) => s.replace(/(o|a|os|as|e|es)$/,'');
            if (q.word.pos === 'adjective' && stem(userNorm) === stem(correctNorm) && stem(correctNorm).length >= 2) {
                return {
                    isCorrect: false,
                    hint: `✏️ 어근은 맞아요! 어미(성·수)를 확인해 보세요. 남성형은 <b>${correct}</b> 예요.`
                };
            }

            // 3) 동의어 감지 — 사용자가 입력한 단어가 단어장에 있고, 뜻이 같으면 동의어
            const userWordInVocab = vocabulary.find(w => normalizeSpanishAnswer(w.word) === userNorm);
            const sameMeaning = userWordInVocab && meaningsOverlap(userWordInVocab.meaning, q.word.meaning);
            if (sameMeaning) {
                // 앞글자 힌트: 정답과 사용자 답이 공유하는 접두사 + 다음 한 글자
                // [냐냐 요청] 정관사 제외: 정답 앞의 정관사/부정관사 제거 후 힌트 표시
                //   el/la 합쳐진 경우(el/la, los/las 등)까지 처리
                let hintWord = correct.toLowerCase().trim()
                    .replace(/^(el\/la|los\/las|un\/una|el|la|los|las|un|una|unos|unas)\s+/i, '');
                const sharedLen = sharedPrefixLen(userNorm, normalizeSpanishAnswer(hintWord));
                const hintPrefix = hintWord.slice(0, sharedLen + 1);
                return {
                    isCorrect: false,
                    hint: `💡 그것도 같은 뜻이에요! 다른 동의어를 생각해 볼까요? <b>${hintPrefix}</b>로 시작하는 단어예요.`,
                    isSynonym: true
                };
            }

            // 4) [냐냐 PATCH-1배치] 오타 감지 — 정답과 1~2글자 차이면 새 단어가 아니라 그냥 오타
            //    (예: hblar → hablar). 등록 버튼 띄우지 않음.
            const dist = levenshtein(userNorm, correctNorm);
            if (correctNorm.length >= 4 && dist > 0 && dist <= 2) {
                return {
                    isCorrect: false,
                    hint: `✏️ 철자가 살짝 틀렸어요! 정답은 <b>${correct}</b> 예요.`,
                    isTypo: true
                };
            }

            // 5) [냐냐 PATCH-1배치] 활용형·복수형 등 "변형된 형태"도 이미 등록된 단어로 인정
            //    (예: hablo → hablar가 단어장에 있음). 등록 버튼 띄우지 않음.
            const formInVocab = (typeof findVocabWordByForm === 'function') ? findVocabWordByForm(userRaw) : null;

            // 6) 입력한 단어가 단어장에 정말 없음 → 등록 추천 표시 (오답)
            if (!userWordInVocab && !formInVocab && userRaw.trim().length >= 2) {
                return {
                    isCorrect: false,
                    hint: `❌ 정답은 <b>${correct}</b> 예요.`,
                    unknownWord: userRaw.trim()
                };
            }

            // 7) 그 외 (단어장엔 있지만 뜻이 다른 경우 등) → 일반 오답
            return { isCorrect: false, hint: `❌ 정답은 <b>${correct}</b> 예요.` };
        }

        // [냐냐 PATCH-1배치] 두 단어의 편집 거리 (오타 판정용)
        function levenshtein(a, b) {
            if (a === b) return 0;
            if (!a.length) return b.length;
            if (!b.length) return a.length;
            let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
            for (let i = 1; i <= a.length; i++) {
                const cur = [i];
                for (let j = 1; j <= b.length; j++) {
                    cur[j] = Math.min(
                        prev[j] + 1,
                        cur[j - 1] + 1,
                        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
                    );
                }
                prev = cur;
            }
            return prev[b.length];
        }

        // 두 뜻 문자열이 겹치는지 (동의어 판정용) — 쉼표/슬래시로 나눠 하나라도 겹치면 true
        function meaningsOverlap(m1, m2) {
            const split = (m) => m.toLowerCase().replace(/\(.*?\)/g,'').split(/[,;/·]/).map(s => s.trim()).filter(Boolean);
            const a = split(m1), b = split(m2);
            return a.some(x => b.some(y => x === y || x.includes(y) || y.includes(x)));
        }

        // 두 문자열의 공통 접두사 길이
        function sharedPrefixLen(a, b) {
            let i = 0;
            while (i < a.length && i < b.length && a[i] === b[i]) i++;
            return i;
        }

        function normalizeSpanishAnswer(s) {
            return String(s || '').toLowerCase().trim()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // 채점은 악센트 관용 처리
                // [냐냐 PATCH] 대괄호 자리표시자는 통째로 제거 — "antes de [명사/동사원형]" → "antes de"
                //   (냐냐가 저 안의 한글을 똑같이 칠 수는 없으니 채점 대상에서 뺌)
                .replace(/[\[\(（【][^\]\)）】]*[\]\)）】]/g, ' ')
                // [냐냐 PATCH] 한글은 채점하지 않음 (스페인어만 비교)
                .replace(/[ㄱ-ㅎㅏ-ㅣ가-힣]/g, ' ')
                // [냐냐 PATCH] 기호 전부 무시 (¿ ? ¡ ! . , ; : " ' ( ) ~ - / 등)
                // ⚠️ 관사는 기호 제거보다 "먼저" 떼야 함 (안 그러면 el/la 의 슬래시가 공백이 돼서 la가 남음)
                .replace(/^(el\/la|los\/las|un\/una|unos\/unas|el|la|los|las|un|una|unos|unas)\s+/, '')
                .replace(/[^\p{L}\p{N}\s]/gu, ' ')
                .replace(/\s+/g, ' ').trim()
                .replace(/^(el|la|los|las|un|una|unos|unas)\s+/, '') // 기호 제거 후 남은 관사도 한 번 더
                .trim();
        }

        function submitMcAnswer(choice, btnEl) {
            const q = quizSession.questions[quizSession.currentIndex];
            const correctAnswer = q.answer !== undefined ? q.answer : q.word.meaning;
            const isCorrect = (choice === correctAnswer);

            // [냐냐 PATCH-버그수정] 클릭한 선택지가 바로 시각적으로 표시되도록 함
            // (정답/오답 색 표시 + 다른 선택지들은 비활성화해서 중복 클릭 방지)
            const allBtns = document.querySelectorAll('#quiz-choices-box button');
            allBtns.forEach(btn => { btn.disabled = true; btn.classList.add('opacity-60'); });
            if (btnEl) {
                // [냐냐 PATCH] bg-white가 안 지워져서 배경색이 안 보이던 문제 → 같이 제거 + 색 진하게
                btnEl.classList.remove('opacity-60', 'bg-white', 'border-slate-200', 'text-slate-700',
                                       'hover:border-violet-400', 'hover:bg-violet-50');
                if (isCorrect) {
                    btnEl.classList.add('border-emerald-500', 'bg-emerald-100', 'text-emerald-800');
                } else {
                    btnEl.classList.add('border-rose-500', 'bg-rose-100', 'text-rose-700');
                }
            }

            finishQuizQuestion(isCorrect, q);
        }

        // [냐냐 PATCH-1배치] 퀴즈에서 입력한 미등록 단어를 단어장에 등록
        //   ⚠️ 예전엔 changeTab('list')로 단어장 탭으로 넘어가버려서 퀴즈 기록이 날아갔음.
        //      단어 모달은 화면 전체를 덮는 오버레이라 탭을 옮길 필요가 없음 → 모달만 띄움.
        function registerUnknownFromQuiz() {
            const word = quizSession && quizSession._pendingRegisterWord;
            if (!word) return;
            openWordModal();
            const input = document.getElementById('input-word');
            if (input) {
                input.value = word;
                if (typeof handleWordInput === 'function') handleWordInput(word);
            }
            showToast(`"${word}" 등록 창을 열었어요. 닫으면 퀴즈로 돌아와요!`, "info");
        }

        // [냐냐 PATCH] 형용사 성·수 변화 설명 텍스트 생성
        function adjAgreementText(word) {
            if (word.pos !== 'adjective') return '';
            const base = word.word;
            const stem = base.replace(/(o|a|os|as|e|es)$/, '');
            switch (word.adjAgreement) {
                case 'full': // corto/corta
                    return `남성: ${stem}o · 여성: ${stem}a (복수는 -s)`;
                case 'no-gender': // egoísta
                    return `성별 변화 없음 (남녀 모두 ${base}) · 복수는 -s`;
                case 'no-number':
                    return `수 변화 없음 (단수·복수 모두 ${base})`;
                case 'invariable':
                    return `성·수 변화 없음 (항상 ${base})`;
                default:
                    return '';
            }
        }

        // [냐냐 PATCH] 노트/관용구/예문/성수를 색 구분된 HTML로 (제목색 ≠ 내용색)
        // [냐냐 PATCH-1배치] 결과 화면 상단 배지 — 품사 · 성별 · 통합 점수
        // [냐냐 요청] 단어장 카드와 똑같은 영어 약어 뱃지 (M./F./N./V./Adj./Adv./Prep./Conj./Pron./Int./Phr.)
        //   형용사 성·수 변화도 설명문 대신 품사 옆 뱃지로만 표시
        //   opts.align === 'left' 면 왼쪽 정렬 (쓰기연습용), 기본은 가운데 (퀴즈 결과화면용)
        function buildWordBadgesHtml(word, opts) {
            if (!word) return '';
            opts = opts || {};
            const chips = [];
            const B = (cls, txt) => `<span class="px-2.5 py-0.5 text-[10px] font-black rounded-full ${cls} shadow-sm">${txt}</span>`;

            if (word.pos === 'noun') {
                if (word.gender === 'masculine') chips.push(B('bg-blue-100 text-blue-600', 'M.'));
                else if (word.gender === 'feminine') chips.push(B('bg-rose-100 text-rose-600', 'F.'));
                else chips.push(B('bg-slate-100 text-slate-600', 'N.'));
            } else if (word.pos === 'verb') {
                chips.push(B('bg-orange-100 text-orange-600', 'V.'));
            } else if (word.pos === 'adjective') {
                chips.push(B('bg-amber-100 text-amber-700', 'Adj.'));
                const AG = 'bg-amber-50 text-amber-600 border border-amber-200';
                if (word.adjAgreement === 'no-gender') chips.push(B(AG, '성 변화 X'));
                else if (word.adjAgreement === 'no-number') chips.push(B(AG, '수 변화 X'));
                else if (word.adjAgreement === 'invariable') chips.push(B(AG, '변화 X'));
            } else if (word.pos === 'adverb') {
                chips.push(B('bg-emerald-100 text-emerald-700', 'Adv.'));
            } else if (word.pos === 'preposition') {
                chips.push(B('bg-teal-100 text-teal-700', 'Prep.'));
            } else if (word.pos === 'conjunction') {
                chips.push(B('bg-cyan-100 text-cyan-700', 'Conj.'));
            } else if (word.pos === 'pronoun') {
                chips.push(B('bg-pink-100 text-pink-700', 'Pron.'));
            } else if (word.pos === 'interrogative') {
                chips.push(B('bg-indigo-100 text-indigo-700', 'Int.'));
            } else if (word.pos === 'phrase') {
                chips.push(B('bg-purple-100 text-purple-600', 'Phr.'));
            }

            if (typeof getWordGrade === 'function' && typeof GRADE_INFO !== 'undefined') {
                const gi = GRADE_INFO[getWordGrade(word)];
                chips.push(`<span class="px-2 py-0.5 rounded-lg text-[11px] font-black ${gi.badge}" title="${gi.label}">${formatScore(word)}</span>`);
            }
            const justify = (opts.align === 'left') ? '' : ' justify-center';
            return chips.length ? `<div class="flex items-center${justify} gap-1.5 flex-wrap">${chips.join('')}</div>` : '';
        }

        function buildNotesHtml(word, opts) {
            opts = opts || {};
            const sections = [];
            // 관용구 안내 (관용구 문제일 때만)
            if (opts.idiomIntro) {
                sections.push(`
                    <div>
                        <span class="block text-xs font-black text-rose-500 mb-1.5">📌 관용구 안내</span>
                        <span class="block text-sm text-slate-700 leading-relaxed">"${word.word}" (${word.meaning}) 단어의 관용구예요.</span>
                    </div>`);
            }
            // [냐냐 요청] 성·수 변화 설명문은 제거 — 품사 뱃지 옆 '성 변화 X' 칩으로 대체됨
            //   (adjAgreementText()는 다른 데서 쓸 수 있으니 함수 자체는 남겨둠)
            // 관용구
            const idiomList = (word.idioms && word.idioms.length > 0) ? word.idioms : (word.idiom ? [{ idiom: word.idiom, idiomMeaning: word.idiomMeaning || '' }] : []);
            if (idiomList.length > 0) {
                const items = idiomList.map(x => `<span class="block text-sm text-slate-700 leading-relaxed">· <b class="text-slate-800">${escapeHtml(x.idiom)}</b>${x.idiomMeaning ? ' — ' + escapeHtml(x.idiomMeaning) : ''}</span>`).join('');
                sections.push(`
                    <div>
                        <span class="block text-xs font-black text-emerald-600 mb-1.5">💬 관용구</span>
                        ${items}
                    </div>`);
            }
            // 예문
            if (word.example) {
                sections.push(`
                    <div>
                        <span class="block text-xs font-black text-sky-600 mb-1.5">✍️ 예문</span>
                        <span class="block text-sm text-slate-700 italic leading-relaxed">${escapeHtml(word.example)}</span>
                        ${word.exampleMeaning ? `<span class="block text-sm text-slate-500 leading-relaxed">${escapeHtml(word.exampleMeaning)}</span>` : ''}
                    </div>`);
            }
            // [냐냐 요청] 노트는 예문 밑으로
            if (word.notes) {
                sections.push(`
                    <div>
                        <span class="block text-xs font-black text-amber-600 mb-1.5">📝 노트</span>
                        <span class="block text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">${escapeHtml(word.notes)}</span>
                    </div>`);
            }
            // [냐냐 PATCH-5배치] 유의어 / 반의어 (퀴즈 결과·복습 화면에도 표시)
            if (typeof buildSynonymChipsHtml === 'function') {
                const syn = buildSynonymChipsHtml(word);
                if (syn) sections.push(`<div class="space-y-2">${syn}</div>`);
            }
            return sections.join('<div class="border-t border-slate-100 my-3"></div>');
        }

        // [냐냐 PATCH-1배치] 퀴즈 정답 화면 동사 활용표 — 등록된 "모든 시제"를 다 보여줌
        //   (예전엔 출제된 시제 하나만 보여줬음. 출제된 시제는 맨 위 + 보라 테두리로 강조)
        function renderQuizConjugation(word, q, boxId) {
            const box = document.getElementById(boxId || 'quiz-review-conj-box'); // [3배치] 복습 화면에서도 재사용
            if (!box) return;
            if (!word || word.pos !== 'verb') { box.classList.add('hidden'); box.innerHTML = ''; return; }

            const byTense = word.conjugationsByTense || {};
            const irrByTense = word.irregularByTense || {};
            const vcByTense = word.verbClassByTense || {};
            const askedKey = (q && q.tenseKey) || null;

            const hasValues = (c) => c && (c.yo || c.tu || c.el || c.nos || c.vos || c.ellos || c.form);
            const tenseOpts = (typeof TENSE_TYPE_OPTIONS !== 'undefined') ? TENSE_TYPE_OPTIONS : [{ key: 'presente', label: '직설법 현재' }];
            const labelOf = (k) => { const o = tenseOpts.find(t => t.key === k); return o ? o.label : k; };

            // 등록된 시제 모으기 (구버전 호환: conjugations = 현재시제)
            let keys = Object.keys(byTense).filter(k => hasValues(byTense[k]));
            if (!keys.includes('presente') && hasValues(word.conjugations)) keys.unshift('presente');
            if (keys.length === 0) { box.classList.add('hidden'); box.innerHTML = ''; return; }

            // 정렬: 출제된 시제 먼저 → 나머지는 등록 폼의 시제 순서대로
            const orderOf = (k) => { const i = tenseOpts.findIndex(t => t.key === k); return i < 0 ? 99 : i; };
            keys.sort((a, b) => {
                if (a === askedKey) return -1;
                if (b === askedKey) return 1;
                return orderOf(a) - orderOf(b);
            });

            const blocks = keys.map(k => {
                const c = byTense[k] || (k === 'presente' ? word.conjugations : null);
                if (!hasValues(c)) return '';
                const irrType = irrByTense[k] || ((k === 'presente') ? (word.irregularType || '') : '');
                const verbClass = vcByTense[k] || ((irrType && irrType !== 'none') ? 'irregular' : (k === 'presente' ? (word.verbClass || 'regular') : 'regular'));
                const isIrr = verbClass === 'irregular' && irrType && irrType !== 'none';
                const isAsked = (k === askedKey);

                const isIrregularCell = (person) => {
                    if (!isIrr) return false;
                    const p = person.split('/')[0];
                    if (irrType.includes('완전 불규칙')) return true;
                    if (irrType.includes('1인칭') && p === 'yo') return true;
                    const stemChange = irrType.includes('e ➡️ ie') || irrType.includes('o ➡️ ue') || irrType.includes('e ➡️ i');
                    if (stemChange && ['yo', 'tú', 'él', 'ellos'].includes(p)) return true;
                    return false;
                };

                let cells;
                if (c.form && !c.yo) {
                    // 1칸짜리 특수 시제 (gerundio 등)
                    cells = `<div class="col-span-3 flex items-center justify-center py-2.5"><span class="text-sm font-black text-slate-800">${escapeHtml(c.form)}</span></div>`;
                } else {
                    const rows = [['yo', c.yo], ['tú', c.tu], ['él/ella', c.el], ['nosotros', c.nos], ['vosotros', c.vos], ['ellos/ellas', c.ellos]];
                    cells = rows.map(([label, val]) => {
                        const hl = val && isIrregularCell(label);
                        return `
                        <div class="flex flex-col items-center justify-center px-2 py-2 border border-slate-100 text-center gap-0.5">
                            <span class="text-[11px] text-slate-400 font-medium">${label}</span>
                            <span class="text-sm ${hl ? 'text-blue-600 font-black' : 'text-slate-800 font-bold'}">${val ? escapeHtml(val) : '-'}</span>
                        </div>`;
                    }).join('');
                }

                return `
                <div class="bg-white border ${isAsked ? 'border-2 border-violet-400' : 'border-slate-200'} rounded-xl overflow-hidden">
                    <div class="${isAsked ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-600'} px-3 py-2 text-xs font-black flex items-center justify-center gap-1.5 flex-wrap">
                        <span>🔀</span> ${escapeHtml(labelOf(k))}
                        ${isAsked ? '<span class="text-violet-500">· 이번 문제</span>' : ''}
                        ${isIrr ? `<span class="text-rose-500">· 불규칙 <span class="text-blue-600">(${escapeHtml(irrType)})</span></span>` : '<span class="text-slate-400 font-bold">· 규칙</span>'}
                    </div>
                    <div class="grid grid-cols-3">${cells}</div>
                </div>`;
            }).filter(Boolean).join('');

            box.classList.remove('hidden');
            box.innerHTML = `<div class="space-y-2">${blocks}</div>`;
        }

        // [냐냐 PATCH] 관용구 뜻풀이 채점 — 먼저 로컬(부분일치) 확인, 애매하면 AI가 유연하게 판단
        async function gradeIdiomSubjective(q, userAnswer) {
            const input = document.getElementById('quiz-subjective-input');
            const submitBtn = document.getElementById('quiz-subjective-submit-btn');
            input.disabled = true;
            submitBtn.disabled = true;

            const correctMeaning = q.answer || '';
            // 1) 빈칸이면 바로 오답
            if (!userAnswer) {
                q._subjectiveHint = `✏️ 정답은 <b>${correctMeaning}</b> 예요.`;
                finishQuizQuestion(false, q);
                return;
            }
            // 2) 로컬 빠른 확인: 핵심 단어가 겹치면 정답 (AI 안 부르고 빠르게)
            const norm = (s) => s.toLowerCase().replace(/[.,!?~\s]/g, '');
            if (norm(userAnswer) === norm(correctMeaning) ||
                (norm(correctMeaning).length >= 2 && (norm(userAnswer).includes(norm(correctMeaning)) || norm(correctMeaning).includes(norm(userAnswer))))) {
                finishQuizQuestion(true, q);
                return;
            }

            // 3) 애매하면 AI에게 유연 채점 요청
            submitBtn.innerText = '채점 중...';
            try {
                let prompt, system;
                if (q.subDir === 'ko-es') {
                    // 한국어 뜻 → 스페인어 관용구 입력
                    prompt = `스페인어 관용구 채점 (한국어 뜻을 보고 스페인어 관용구를 쓰는 문제).
정답 관용구: "${q.idiomData.idiom}"
관용구 뜻: "${q.idiomData.idiomMeaning}"
학생이 쓴 스페인어: "${userAnswer}"

학생이 쓴 스페인어가 정답 관용구와 같거나, 같은 뜻의 올바른 스페인어 관용구면 정답이에요. 사소한 철자/악센트 차이는 정답으로 인정하세요. JSON만: {"correct": true/false, "comment": "짧은 한국어 코멘트 1문장"}`;
                    system = "당신은 관대하고 친절한 스페인어 선생님입니다. 학생이 올바른 관용구를 떠올렸으면 사소한 철자 차이는 정답으로 인정합니다.";
                } else {
                    // 스페인어 관용구 → 한국어 뜻 입력
                    prompt = `스페인어 관용구 채점.
관용구: "${q.idiomData.idiom}"
정확한 뜻: "${correctMeaning}"
학생이 쓴 뜻: "${userAnswer}"

학생의 답이 관용구의 뜻을 올바르게 이해했으면 정답이에요. 표현이 정확히 같지 않아도, 의미가 통하면 정답으로 인정하세요. JSON만 출력: {"correct": true/false, "comment": "짧은 한국어 코멘트 1문장"}`;
                    system = "당신은 관대하고 친절한 스페인어 선생님입니다. 학생이 관용구의 핵심 의미를 파악했으면 표현이 조금 달라도 정답으로 인정합니다.";
                }
                const responseText = await callGemini(prompt, system, null, 'low');
                const parsed = extractAndParseJson(responseText);
                const isCorrect = !!(parsed && parsed.correct);
                if (!isCorrect) {
                    q._subjectiveHint = `✏️ 정답은 <b>${correctMeaning}</b> 예요.${parsed && parsed.comment ? '<br>' + parsed.comment : ''}`;
                } else if (parsed && parsed.comment) {
                    q._subjectiveHint = `👍 ${parsed.comment}`;
                }
                submitBtn.innerText = '제출하기';
                finishQuizQuestion(isCorrect, q);
            } catch (e) {
                // AI 실패 시: 관대하게 정답 처리하지 않고, 정답을 보여주며 오답 (안전)
                submitBtn.innerText = '제출하기';
                q._subjectiveHint = `✏️ 정답은 <b>${correctMeaning}</b> 예요. (채점 오류로 정답을 확인하세요)`;
                finishQuizQuestion(false, q);
            }
        }

        // [냐냐 PATCH-2배치] AI 주관식 채점
        //   AI가 4가지로 분류: correct(정답) / synonym(유의어) / typo(오타) / wrong(오답)
        //   - 유의어  → 점수 없이 재입력 1회 (앞글자 힌트 공개)
        //   - 오타    → 점수 없이 재입력 1회 (단, 3글자 초과로 틀리면 바로 오답)
        //   - AI 키 없거나 실패 → 기존 로컬 채점(analyzeSubjectiveAnswer)으로 폴백
        async function aiGradeSubjective(userAnswer, q) {
            if (typeof hasGeminiApiKey !== 'function' || !hasGeminiApiKey()) return null;
            try {
                const system = `You grade a Korean learner's Spanish vocabulary answer. Classify into exactly one verdict.
- "correct": the answer IS the target word (ignore capitalization, surrounding punctuation, and a leading article el/la/los/las/un/una).
- "synonym": a DIFFERENT, real Spanish word that means the same or nearly the same thing as the target (e.g. target "televisor", answer "televisión"). It must be a real word, not a misspelling.
- "typo": clearly an attempt at the TARGET word but misspelled (including a wrong/missing accent), i.e. within about 3 characters of the target.
- "wrong": anything else (different meaning, gibberish, blank).
Prefer "typo" over "synonym" when the answer is not a real Spanish word.
Return JSON only.`;
                const prompt = `Target word: "${q.word.word}" (meaning in Korean: "${q.word.meaning}", part of speech: ${q.word.pos}).
Student answered: "${userAnswer}".
Return JSON: { "verdict": "correct"|"synonym"|"typo"|"wrong", "comment": "짧은 한국어 설명 (한 문장)" }`;
                const schema = { type: "OBJECT", properties: { verdict: { type: "STRING" }, comment: { type: "STRING" } }, required: ["verdict"] };
                const resp = await callGemini(prompt, system, schema, 'low');
                const data = extractAndParseJson(resp);
                if (data && data.verdict) return data;
            } catch (e) {
                console.warn('AI 주관식 채점 실패, 로컬 채점으로 대체', e);
            }
            return null;
        }

        async function submitSubjectiveAnswer() {
            const q = quizSession.questions[quizSession.currentIndex];
            const inputEl = document.getElementById('quiz-subjective-input');
            const submitBtn = document.getElementById('quiz-subjective-submit-btn');
            if (!inputEl || inputEl.disabled) return;
            const userAnswer = inputEl.value.trim();

            // 활용형 문제는 정답(활용형)과 직접 비교
            if (q.type === 'conjugation') {
                inputEl.disabled = true;
                submitBtn.disabled = true;
                const isCorrect = userAnswer && (normalizeSpanishAnswer(userAnswer) === normalizeSpanishAnswer(q.answer));
                q._subjectiveHint = isCorrect ? '' : `✏️ 정답은 <b>${q.answer}</b> 예요. (${q.word.word} = ${q.word.meaning} · ${q.tenseLabel || '현재'} ${q.conjLabel})`;
                finishQuizQuestion(isCorrect, q);
                return;
            }

            // 관용구 뜻풀이는 AI가 유연하게 채점
            if (q.type === 'idiom-subjective') {
                gradeIdiomSubjective(q, userAnswer);
                return;
            }

            const correct = q.word.word;
            const correctNorm = normalizeSpanishAnswer(correct);
            const userNorm = normalizeSpanishAnswer(userAnswer);
            const synHintBox = document.getElementById('quiz-synonym-hint');

            const gradeNow = (isCorrect, hint, unknownWord) => {
                inputEl.disabled = true;
                submitBtn.disabled = true;
                submitBtn.innerHTML = '확인';
                if (synHintBox) synHintBox.classList.add('hidden');
                q._subjectiveHint = hint || '';
                q._userAnswer = userAnswer;
                if (unknownWord) q._unknownWord = unknownWord;
                finishQuizQuestion(isCorrect, q);
            };

            // 한 번 더 쓰게 하기 (점수 반영 없음)
            const askRetry = (reason, hintHtml) => {
                q._retryReason = reason;   // 'synonym' | 'typo' → 재입력 후 점수에 반영됨
                if (synHintBox) {
                    synHintBox.classList.remove('hidden');
                    synHintBox.innerHTML = hintHtml;
                }
                inputEl.disabled = false;
                submitBtn.disabled = false;
                submitBtn.innerHTML = '확인';
                inputEl.value = '';
                inputEl.focus();
            };

            // 앞글자 힌트: 정답과 내 답이 공유하는 앞부분 + 다음 한 글자 (televisión → televiso)
            const prefixHint = () => correct.slice(0, sharedPrefixLen(userNorm, correctNorm) + 1);

            // 0) 빈칸이면 바로 오답
            if (!userAnswer) { gradeNow(false, `✏️ 정답은 <b>${correct}</b> 예요.`); return; }
            // 1) 정답이면 AI 안 부르고 바로 통과 (빠름)
            if (userNorm === correctNorm) { gradeNow(true, ''); return; }

            // 2) AI 채점 (키 있을 때만) — 채점 중 표시
            submitBtn.disabled = true;
            inputEl.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> 채점 중...';
            const ai = await aiGradeSubjective(userAnswer, q);
            inputEl.disabled = false;
            submitBtn.disabled = false;
            submitBtn.innerHTML = '확인';

            if (!ai) {
                // 3) 폴백 — AI 키가 없거나 실패하면 기존 로컬 채점
                const analysis = analyzeSubjectiveAnswer(userAnswer, q);
                if (analysis.isSynonym && !q._retryReason) { askRetry('synonym', analysis.hint); return; }
                if (analysis.isTypo && !q._retryReason) { askRetry('typo', `✏️ 철자가 살짝 틀렸어요! 다시 한 번 써볼까요? <b>${prefixHint()}</b>로 시작해요.`); return; }
                gradeNow(analysis.isCorrect, analysis.hint, analysis.unknownWord);
                return;
            }

            const verdict = String(ai.verdict || '').toLowerCase();

            if (verdict === 'correct') { gradeNow(true, ''); return; }

            // 이미 재입력 기회를 한 번 썼으면 → 더는 안 봐주고 채점
            if (q._retryReason) {
                const unknown = (verdict === 'wrong' && !isWordKnown(userAnswer) && userAnswer.length >= 2) ? userAnswer : null;
                gradeNow(false, `❌ 정답은 <b>${correct}</b> 예요.${ai.comment ? '<br><span class="text-slate-500">' + escapeHtml(ai.comment) + '</span>' : ''}`, unknown);
                return;
            }

            if (verdict === 'synonym') {
                askRetry('synonym', `💡 그것도 같은 뜻이에요! 다른 단어를 생각해 볼까요? <b>${prefixHint()}</b>로 시작하는 단어예요.`);
                return;
            }

            if (verdict === 'typo') {
                // 오타가 3글자를 넘으면 봐주지 않고 바로 오답
                if (levenshtein(userNorm, correctNorm) > 3) {
                    gradeNow(false, `❌ 정답은 <b>${correct}</b> 예요.`);
                    return;
                }
                askRetry('typo', `✏️ 철자가 살짝 틀렸어요! 다시 한 번 써볼까요? <b>${prefixHint()}</b>로 시작해요.`);
                return;
            }

            // wrong — 미등록 단어면 등록 추천
            const unknown = (!isWordKnown(userAnswer) && userAnswer.length >= 2) ? userAnswer : null;
            gradeNow(false, `❌ 정답은 <b>${correct}</b> 예요.${ai.comment ? '<br><span class="text-slate-500">' + escapeHtml(ai.comment) + '</span>' : ''}`, unknown);
        }

        // [냐냐 PATCH-2배치] 이 단어가 단어장에 이미 있나? (원형·활용형·관사 전부 고려)
        function isWordKnown(raw) {
            const n = normalizeSpanishAnswer(raw);
            if (vocabulary.some(w => normalizeSpanishAnswer(w.word) === n)) return true;
            if (typeof findVocabWordByForm === 'function' && findVocabWordByForm(raw)) return true;
            return false;
        }

        function finishQuizQuestion(isCorrect, q) {
            const coach = document.getElementById('quiz-coach-character');

            // [냐냐 PATCH-수준맞춤] 누적 정답률/취약 품사만 살짝 갱신 (전체 기록 저장 아님)
            // 방어 코드: learnerProfile이 없어도(파일 버전이 안 맞아도) 퀴즈 본 기능은 멈추지 않게 함
            if (typeof learnerProfile !== 'undefined' && learnerProfile) {
                learnerProfile.totalAnswered = (learnerProfile.totalAnswered || 0) + 1;
                if (isCorrect) {
                    learnerProfile.totalCorrect = (learnerProfile.totalCorrect || 0) + 1;
                } else {
                    if (!learnerProfile.wrongByPos) learnerProfile.wrongByPos = {};
                    const pos = q.word.pos || 'etc';
                    learnerProfile.wrongByPos[pos] = (learnerProfile.wrongByPos[pos] || 0) + 1;
                }
            }

            if (isCorrect) {
                AudioFX.playSuccess();
                quizSession.correctCount++;
                // [냐냐 PATCH] 맞힌 단어 id 기록 (중복 제외) — 결과 화면에서 마스터 등록 선택용
                if (!quizSession.correctWordIds) quizSession.correctWordIds = [];
                if (!quizSession.correctWordIds.includes(q.word.id)) quizSession.correctWordIds.push(q.word.id);

                // [냐냐 PATCH-0배치] 통합 점수 반영 — 객관식 +1 / 주관식 +2
                //   유의어 재입력 후 정답 +2 · 오타 재입력 후 정답 +1
                const vocabItemC = vocabulary.find(w => w.id === q.word.id);
                if (vocabItemC) {
                    const wasMasteredC = vocabItemC.mastered;
                    const isProductionC = (q.type === 'subjective' || q.type === 'conjugation' || q.type === 'idiom-subjective');
                    let gain = isProductionC ? 2 : 1;
                    if (q._retryReason === 'typo') gain = 1;
                    else if (q._retryReason === 'synonym') gain = 2;
                    addWordScore(vocabItemC, gain, { correct: true, subjective: (q.type === 'subjective') });
                    if (!wasMasteredC && vocabItemC.mastered) {
                        if (!quizSession.autoMasteredIds) quizSession.autoMasteredIds = [];
                        quizSession.autoMasteredIds.push(vocabItemC.id);
                    }
                }
                coach.innerText = "✨😄";
                showToast("🎯 정답입니다!", "success");
            } else {
                AudioFX.playError();
                quizSession.wrongList.push(q.word);

                // [냐냐 PATCH-0배치] 통합 점수 반영 — 객관식 -2 / 주관식 -1
                //   재입력(유의어·오타) 기회를 줬는데도 틀리면 -2
                const vocabItem = vocabulary.find(w => w.id === q.word.id);
                if (vocabItem) {
                    const wasWeak = vocabItem.weak;
                    const isProductionW = (q.type === 'subjective' || q.type === 'conjugation' || q.type === 'idiom-subjective');
                    let penalty = isProductionW ? -1 : -2;
                    if (q._retryReason) penalty = -2;
                    addWordScore(vocabItem, penalty, { correct: false });
                    if (!wasWeak && vocabItem.weak) {
                        if (!quizSession.newlyWeakIds) quizSession.newlyWeakIds = [];
                        if (!quizSession.newlyWeakIds.includes(vocabItem.id)) quizSession.newlyWeakIds.push(vocabItem.id);
                    }
                }
                coach.innerText = "🤔💭";
                showToast("아쉬워요, 정답을 확인하고 다시 기억해 봐요!", "error");
            }

            document.getElementById('arena-score').innerText = `정답 ${quizSession.correctCount}개`;

            const verdict = document.getElementById('quiz-review-verdict');
            verdict.innerText = isCorrect ? "🎯 정답입니다!" : "📝 다시 한 번 확인해 볼까요?";
            verdict.className = isCorrect ? "text-sm font-bold text-emerald-600" : "text-sm font-bold text-rose-600";

            // [냐냐 PATCH] 스마트 힌트 박스 (동의어/성수틀림/등록추천)
            const hintBox = document.getElementById('quiz-review-hint-box');
            const registerBox = document.getElementById('quiz-review-register-box');
            if (hintBox) {
                if (!isCorrect && q._subjectiveHint) {
                    hintBox.classList.remove('hidden');
                    hintBox.innerHTML = q._subjectiveHint;
                } else {
                    hintBox.classList.add('hidden');
                }
            }
            if (registerBox) {
                if (!isCorrect && q._unknownWord) {
                    registerBox.classList.remove('hidden');
                    document.getElementById('quiz-review-register-box').querySelector('span').innerText = `"${q._unknownWord}"를 단어장에 등록할까요?`;
                    quizSession._pendingRegisterWord = q._unknownWord;
                } else {
                    registerBox.classList.add('hidden');
                }
            }

            // [냐냐 PATCH-1배치] 정답이든 오답이든 단어장 정보를 "항상 전부" 보여줌
            //   (배지: 품사·성별·점수 / 성수변화 / 노트 / 관용구 / 예문 / 등록된 시제 전부)
            const notesBox = document.getElementById('quiz-review-notes-box');
            const isIdiomQ = (q.type === 'idiom-mc' || q.type === 'idiom-subjective');

            if (isIdiomQ) {
                const it = q.idiomData || {};
                document.getElementById('quiz-review-word').innerText = it.idiom || q.answer;
                document.getElementById('quiz-review-meaning').innerText = it.idiomMeaning || '';
            } else {
                document.getElementById('quiz-review-word').innerText = q.word.word;
                document.getElementById('quiz-review-meaning').innerText = q.word.meaning;
            }

            const badges = buildWordBadgesHtml(q.word);
            const notes = buildNotesHtml(q.word, { idiomIntro: isIdiomQ });

            // [냐냐 PATCH] 유의어 문제여도 상단 안내는 안 띄움
            //   (빨간색이라 오답처럼 보이고, 어차피 아래 유의어 섹션에 똑같이 나옴)
            const combined = [badges, notes].filter(x => x && x.trim())
                .join('<div class="border-t border-slate-100 my-3"></div>');

            if (combined.trim()) {
                notesBox.classList.remove('hidden');
                notesBox.innerHTML = combined;
            } else {
                notesBox.classList.add('hidden');
            }

            // [냐냐 PATCH] 동사 문제면 현재시제 활용표를 보여줌
            renderQuizConjugation(q.word, q);

            document.getElementById('quiz-review-panel').classList.remove('hidden');
            window._quizReviewShownAt = Date.now(); // 엔터 가드용 (방금 제출한 엔터로 바로 안 넘어가게)
            const nextBtn = document.getElementById('quiz-next-btn');
            nextBtn.disabled = false;
            nextBtn.className = "w-full bg-violet-600 hover:bg-violet-700 text-white py-3 rounded-xl text-sm font-bold transition-all active:scale-95";

            // [냐냐 PATCH-버그수정] 모바일에서 키보드가 열려있거나 화면이 길면 결과 패널이
            // 화면 밖에 가려져서 "멈춘 것처럼" 보였을 수 있음 — 결과 패널로 자동 스크롤
            const subjInput = document.getElementById('quiz-subjective-input');
            if (subjInput) subjInput.blur();
            setTimeout(() => {
                const reviewPanel = document.getElementById('quiz-review-panel');
                if (reviewPanel) reviewPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }

        function nextQuizQuestion() {
            if (document.getElementById('quiz-next-btn').disabled) return;
            quizSession.currentIndex++;
            if (quizSession.currentIndex >= quizSession.questions.length) {
                showQuizResults();
            } else {
                renderQuizQuestion();
            }
        }

        function showQuizResults() {
            document.getElementById('quiz-question-screen').classList.add('hidden');
            document.getElementById('quiz-results-screen').classList.remove('hidden');
            document.getElementById('quiz-combo-box').classList.add('hidden');

            // [냐냐 PATCH] 이번 퀴즈에서 자동 마스터된 단어 알림
            const autoMastered = quizSession.autoMasteredIds || [];
            if (autoMastered.length > 0) {
                const names = autoMastered.map(id => { const w = vocabulary.find(v => v.id === id); return w ? w.word : ''; }).filter(Boolean);
                setTimeout(() => {
                    showToast(`🏆 자동 마스터! ${names.join(', ')} (${names.length}개)`, "success");
                }, 600);
            }

            // [냐냐 PATCH] 이번 퀴즈에서 자동으로 바뀐 단어 목록 표시 (마스터 승급 / 약점 추가)
            const changesBox = document.getElementById('quiz-results-changes-box');
            if (changesBox) {
                const newlyWeak = (quizSession.newlyWeakIds || []).filter(id => !autoMastered.includes(id));
                const parts = [];
                if (autoMastered.length > 0) {
                    const items = autoMastered.map(id => { const w = vocabulary.find(v => v.id === id); return w ? `<span class="inline-block bg-white/70 rounded-lg px-2 py-0.5 text-xs font-bold text-emerald-700 m-0.5">${w.word}</span>` : ''; }).join('');
                    parts.push(`<div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-3">
                        <p class="text-xs font-black text-emerald-700 mb-1.5">🏆 마스터 승급 (${autoMastered.length}개)</p>
                        <div class="flex flex-wrap">${items}</div>
                    </div>`);
                }
                if (newlyWeak.length > 0) {
                    const items = newlyWeak.map(id => { const w = vocabulary.find(v => v.id === id); return w ? `<span class="inline-block bg-white/70 rounded-lg px-2 py-0.5 text-xs font-bold text-amber-700 m-0.5">${w.word}</span>` : ''; }).join('');
                    parts.push(`<div class="bg-amber-50 border border-amber-200 rounded-2xl p-3">
                        <p class="text-xs font-black text-amber-700 mb-1.5">⭐ 약점 단어 추가 (${newlyWeak.length}개)</p>
                        <div class="flex flex-wrap">${items}</div>
                    </div>`);
                }
                if (parts.length > 0) {
                    changesBox.classList.remove('hidden');
                    changesBox.innerHTML = parts.join('');
                } else {
                    changesBox.classList.add('hidden');
                }
            }

            const total = quizSession.questions.length;
            const correct = quizSession.correctCount;
            document.getElementById('quiz-results-score').innerText = `${correct} / ${total}`;
            document.getElementById('quiz-results-percent').innerText = `정답률 ${Math.round((correct / total) * 100)}%`;

            // [PATCH] 퀴즈가 끝났을 때 한 번만 학습일지에 기록 (문제마다 갱신하지 않음)
            touchDiarySnapshot();
            const today = getLocalDateString();
            nyanyaDiary[today].quizTotal += total;
            nyanyaDiary[today].quizCorrect += correct;
            saveToStorage();
            renderDiary();
            updateStats();

            const wrongBox = document.getElementById('quiz-results-wrong-list');
            if (quizSession.wrongList.length === 0) {
                wrongBox.innerHTML = '<p class="text-center text-emerald-600 text-sm font-bold py-2">전부 다 맞췄어요! 완벽해요 🎉</p>';
            } else {
                let html = '<p class="text-xs font-bold text-slate-500 mb-1">다시 볼 단어들</p>';
                quizSession.wrongList.forEach(w => {
                    html += `<div class="flex items-baseline justify-between bg-white rounded-xl px-3 py-2 border border-slate-100"><span class="font-bold text-slate-800">${w.word}</span><span class="text-slate-500 text-sm">${w.meaning}</span></div>`;
                });
                wrongBox.innerHTML = html;
            }

            // [냐냐 PATCH] 맞힌 단어 중 아직 마스터 안 된 것들을 골라 마스터 등록할 수 있게 표시
            const masteryBox = document.getElementById('quiz-results-mastery-box');
            const masteryList = document.getElementById('quiz-mastery-list');
            const correctIds = quizSession.correctWordIds || [];
            const masterCandidates = correctIds
                .map(id => vocabulary.find(w => w.id === id))
                .filter(w => w && !w.mastered);

            if (masterCandidates.length === 0) {
                masteryBox.classList.add('hidden');
            } else {
                masteryBox.classList.remove('hidden');
                document.getElementById('quiz-mastery-all').checked = false;
                masteryList.innerHTML = masterCandidates.map(w => {
                    const isStrong = (quizSession.masterSuggestIds || []).includes(w.id);
                    const strongBadge = isStrong ? '<span class="text-[9px] font-black text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full shrink-0">잘 아는 단어!</span>' : '';
                    const idiomList = (w.idioms && w.idioms.length > 0) ? w.idioms : (w.idiom ? [{ idiom: w.idiom, idiomMeaning: w.idiomMeaning || '' }] : []);
                    const detailParts = [];
                    if (idiomList.length > 0) {
                        const idiomText = idiomList.map(it => `· ${it.idiom}${it.idiomMeaning ? ' — ' + it.idiomMeaning : ''}`).join('<br>');
                        detailParts.push(`<div class="text-teal-700"><span class="font-bold">💬 관용구</span><br>${idiomText}</div>`);
                    }
                    if (w.example) detailParts.push(`<div class="text-slate-600"><span class="font-bold">✍️ 예문</span><br>${w.example}${w.exampleMeaning ? '<br><span class="text-slate-400">' + w.exampleMeaning + '</span>' : ''}</div>`);
                    if (w.notes) detailParts.push(`<div class="text-amber-700"><span class="font-bold">📝 노트</span><br>${w.notes.replace(/\n/g, '<br>')}</div>`);
                    const detailHtml = detailParts.length > 0 ? detailParts.join('<div class="my-1"></div>') : '<span class="text-slate-400">추가 정보가 없어요</span>';
                    return `
                    <div class="bg-white rounded-xl border border-slate-100 overflow-hidden">
                        <div class="flex items-center gap-2 px-3 py-2">
                            <input type="checkbox" data-master-id="${w.id}" class="w-4 h-4 accent-emerald-600 shrink-0">
                            <button type="button" onclick="toggleMasteryDetail('${w.id}')" class="flex items-center gap-2 flex-1 min-w-0 text-left">
                                <i class="fa-solid fa-chevron-right text-slate-300 text-[10px] transition-transform shrink-0" data-mastery-chevron="${w.id}"></i>
                                <span class="font-bold text-slate-800 text-sm truncate">${w.word}</span>
                                ${strongBadge}
                                <span class="text-slate-400 text-xs ml-auto shrink-0">${w.meaning}</span>
                            </button>
                        </div>
                        <div class="hidden px-3 pb-2.5 pt-0.5 text-[11px] leading-relaxed border-t border-slate-50 bg-slate-50/50" data-mastery-detail="${w.id}">
                            ${detailHtml}
                        </div>
                    </div>
                `;
                }).join('');
            }
        }

        // [냐냐 PATCH] 마스터 후보 단어 상세정보 펼치기/접기
        function toggleMasteryDetail(id) {
            const detail = document.querySelector(`[data-mastery-detail="${id}"]`);
            const chevron = document.querySelector(`[data-mastery-chevron="${id}"]`);
            if (!detail) return;
            const nowHidden = detail.classList.toggle('hidden');
            if (chevron) chevron.style.transform = nowHidden ? 'rotate(0deg)' : 'rotate(90deg)';
        }

        // [냐냐 PATCH] 마스터 등록 체크박스 - 전체 선택
        function toggleAllMasteryChecks(checked) {
            document.querySelectorAll('[data-master-id]').forEach(cb => { cb.checked = checked; });
        }

        // [냐냐 PATCH] 선택한 단어를 단어장에서 마스터로 등록 (연동)
        function applyQuizMastery() {
            const checked = [...document.querySelectorAll('[data-master-id]')].filter(cb => cb.checked);
            if (checked.length === 0) {
                showToast("마스터로 등록할 단어를 선택해 주세요!", "info");
                return;
            }
            let count = 0;
            checked.forEach(cb => {
                const id = cb.getAttribute('data-master-id');
                const w = vocabulary.find(x => x.id === id);
                if (w && !w.mastered) {
                    // [냐냐 PATCH-0배치] 수동 마스터 = 8점(완벽) + 주관식 조건 통과 처리
                    setWordScore(w, SCORE_PERFECT, { subjectivePassed: true });
                    count++;
                }
            });
            // 마스터 단어 수 변화를 학습일지에 반영
            touchDiarySnapshot();
            saveToStorage();
            renderWordList();
            updateStats();
            renderDiary();
            // 방금 등록한 단어들은 목록에서 사라지게 다시 렌더
            const masteryBox = document.getElementById('quiz-results-mastery-box');
            const remaining = [...document.querySelectorAll('[data-master-id]')].filter(cb => !cb.checked);
            if (remaining.length === 0) masteryBox.classList.add('hidden');
            else checked.forEach(cb => { const card = cb.parentElement && cb.parentElement.parentElement; if (card) card.remove(); });
            showToast(`${count}개 단어를 마스터로 등록했어요! 🎉`, "success");
        }

        function restartQuizSetup() {
            quizSession = null;
            document.getElementById('quiz-results-screen').classList.add('hidden');
            document.getElementById('quiz-question-screen').classList.add('hidden');
            document.getElementById('quiz-setup-screen').classList.remove('hidden');
        }
