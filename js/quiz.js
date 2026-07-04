let quizSession = null;
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
        function startWeakFocusQuiz() {
            const weakWords = vocabulary.filter(w => w.weak && !w.mastered);
            if (weakWords.length < 2) {
                showToast("약점 단어가 2개 이상 있어야 복습할 수 있어요!", "error");
                return;
            }
            changeTab('quiz');
            // 범위: 약점 단어만 체크
            setTimeout(() => {
                const notM = document.getElementById('scope-not-mastered');
                const mas = document.getElementById('scope-mastered');
                const weak = document.getElementById('scope-weak');
                const promo = document.getElementById('scope-promotion');
                if (notM) notM.checked = false;
                if (mas) mas.checked = false;
                if (weak) weak.checked = true;
                if (promo) promo.checked = false;
                startQuiz();
            }, 50);
        }

        function startQuiz() {
            // [냐냐 PATCH] 출제 범위: 체크박스로 여러 개 선택 (마스터 제외/마스터/약점 단어/승급 대기)
            const wantNotMastered = document.getElementById('scope-not-mastered')?.checked;
            const wantMastered = document.getElementById('scope-mastered')?.checked;
            const wantWeak = document.getElementById('scope-weak')?.checked;
            const wantPromotion = document.getElementById('scope-promotion')?.checked;

            if (!wantNotMastered && !wantMastered && !wantWeak && !wantPromotion) {
                showToast("출제 범위를 최소 하나는 선택해 주세요!", "error");
                return;
            }

            // 승급 대기 단어 = 마스터 점수 3점 이상 + 아직 마스터 안 됨
            const promotionWords = vocabulary.filter(w => !w.mastered && (w.masterScore || 0) >= 3);
            // 승급 대기 퀴즈는 5개 이상 있어야 열림
            if (wantPromotion && promotionWords.length < 5) {
                showToast(`아직 승급할 단어가 5개 미만이에요! (현재 ${promotionWords.length}개) 퀴즈를 더 풀어서 마스터 점수를 쌓아보세요.`, "info");
                return;
            }

            // 선택된 범위들의 합집합 (중복 제거)
            const poolSet = new Map();
            if (wantNotMastered) vocabulary.filter(w => !w.mastered).forEach(w => poolSet.set(w.id, w));
            if (wantMastered) vocabulary.filter(w => w.mastered).forEach(w => poolSet.set(w.id, w));
            if (wantWeak) vocabulary.filter(w => w.weak).forEach(w => poolSet.set(w.id, w));
            if (wantPromotion) promotionWords.forEach(w => poolSet.set(w.id, w));
            let reviewablePool = [...poolSet.values()];

            if (reviewablePool.length < 2) {
                showToast("출제할 단어가 2개 이상 있어야 해요! 출제 범위를 바꿔보세요.", "error");
                return;
            }
            // 단어 수가 적으면 같은 단어가 반복 출제될 수 있음 (최대 단어 수의 4배까지만 허용)
            const count = Math.min(selectedQuizCount, reviewablePool.length * 4);

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
            const canMakeIdiomQuiz = allIdioms.length >= 1 && allIdiomsGlobal.length >= 2 && selectedQuizFormat !== 'subjective';
            const idiomCount = canMakeIdiomQuiz ? Math.min(Math.round(count * 0.20), allIdioms.length * 2) : 0;
            const wordCount = count - idiomCount;

            const questions = [];
            // 단어 문제
            for (let i = 0; i < wordCount; i++) {
                const w = reviewablePool[Math.floor(Math.random() * reviewablePool.length)];
                // [냐냐 PATCH] 문제 유형: 객관식만 / 주관식만 / 섞어서(약 30% 주관식)
                let isSubjective;
                if (selectedQuizFormat === 'mc') isSubjective = false;
                else if (selectedQuizFormat === 'subjective') isSubjective = true;
                else isSubjective = Math.random() < 0.3;
                const q = { word: w, type: isSubjective ? 'subjective' : 'mc' };
                if (!isSubjective) {
                    q.answer = w.meaning;
                    let choices = [w.meaning];
                    // [냐냐 PATCH] 보기(오답)는 정답 단어와 같은 품사에서 우선 뽑기
                    const samePos = vocabulary.filter(x => x.id !== w.id && x.pos === w.pos).map(x => x.meaning);
                    const otherPos = vocabulary.filter(x => x.id !== w.id && x.pos !== w.pos).map(x => x.meaning);
                    let pool = [...new Set(samePos)]; // 같은 품사 우선, 중복 제거
                    pool.sort(() => Math.random() - 0.5);
                    // 같은 품사가 3개 미만이면 다른 품사로 채움
                    if (pool.length < 3) {
                        const filler = [...new Set(otherPos)].sort(() => Math.random() - 0.5);
                        pool = pool.concat(filler);
                    }
                    // 정답과 같은 뜻은 제외
                    pool = pool.filter(m => m !== w.meaning);
                    choices = choices.concat(pool.slice(0, 3));
                    choices.sort(() => Math.random() - 0.5);
                    q.choices = choices;
                }
                questions.push(q);
            }

            // 관용구 문제 (양방향 섞어서)
            for (let i = 0; i < idiomCount; i++) {
                const target = allIdioms[Math.floor(Math.random() * allIdioms.length)];
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
                pool.sort(() => Math.random() - 0.5);
                choices = choices.concat(pool.slice(0, 3));
                choices.sort(() => Math.random() - 0.5);
                questions.push({ type: 'idiom-mc', word: target.word, answer: answer, choices: choices, promptText: promptText, idiomData: target });
            }

            // 단어 문제 + 관용구 문제 전체를 섞음
            questions.sort(() => Math.random() - 0.5);

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

            if (q.type === 'mc' || q.type === 'idiom-mc') {
                document.getElementById('quiz-question-label').innerText = q.type === 'idiom-mc' ? '관용구 QUESTION' : 'QUESTION';
                document.getElementById('quiz-question-text').innerText = q.type === 'idiom-mc'
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
                document.getElementById('quiz-question-label').innerText = 'WRITE IN SPANISH';
                // [냐냐 PATCH] 형용사는 남성형(사전형)으로 통일해서 물어봄 — 답이 하나로 명확해짐
                const genderHint = (q.word.pos === 'adjective') ? ' <span class="text-violet-500">(남성형)</span>' : '';
                document.getElementById('quiz-question-text').innerHTML = `${q.word.meaning} → 스페인어로 써보세요!${genderHint}`;
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
                const sharedLen = sharedPrefixLen(userNorm, correctNorm);
                const hintPrefix = correct.slice(0, sharedLen + 1);
                return {
                    isCorrect: false,
                    hint: `💡 그것도 같은 뜻이에요! 다른 동의어를 생각해 볼까요? <b>${hintPrefix}</b>로 시작하는 단어예요.`,
                    isSynonym: true
                };
            }

            // 4) 입력한 단어가 단어장에 없음 → 등록 추천 표시 (오답)
            if (!userWordInVocab && userRaw.trim().length >= 2) {
                return {
                    isCorrect: false,
                    hint: `❌ 정답은 <b>${correct}</b> 예요.`,
                    unknownWord: userRaw.trim()
                };
            }

            // 5) 그 외 (단어장엔 있지만 뜻이 다른 경우 등) → 일반 오답
            return { isCorrect: false, hint: `❌ 정답은 <b>${correct}</b> 예요.` };
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
            return s.toLowerCase().trim()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // 채점은 악센트 관용 처리
                .replace(/^(el|la|los|las)\s+/, '');
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
                btnEl.classList.remove('opacity-60', 'border-slate-200', 'hover:border-violet-400', 'hover:bg-violet-50');
                btnEl.classList.add(isCorrect ? 'border-emerald-500' : 'border-rose-500', isCorrect ? 'bg-emerald-50' : 'bg-rose-50');
            }

            finishQuizQuestion(isCorrect, q);
        }

        // [냐냐 PATCH] 퀴즈에서 입력한 미등록 단어를 단어장에 등록
        function registerUnknownFromQuiz() {
            const word = quizSession && quizSession._pendingRegisterWord;
            if (!word) return;
            changeTab('list');
            setTimeout(() => {
                openWordModal();
                const input = document.getElementById('input-word');
                if (input) {
                    input.value = word;
                    handleWordInput(word);
                }
                showToast(`"${word}" 등록 화면을 열었어요. AI 자동완성을 눌러보세요!`, "info");
            }, 100);
        }

        // [냐냐 PATCH] 퀴즈 정답 확인 화면에 동사 현재시제 활용표 표시
        function renderQuizConjugation(word) {
            const box = document.getElementById('quiz-review-conj-box');
            if (!box) return;
            const c = word.conjugations;
            const hasConj = word.pos === 'verb' && c && (c.yo || c.tu || c.el || c.nos || c.vos || c.ellos);
            if (!hasConj) {
                box.classList.add('hidden');
                box.innerHTML = '';
                return;
            }
            const rows = [
                ['yo', c.yo], ['tú', c.tu], ['él/ella', c.el],
                ['nosotros', c.nos], ['vosotros', c.vos], ['ellos/ellas', c.ellos]
            ];
            const cells = rows.map(([label, val]) => `
                <div class="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 last:border-0">
                    <span class="text-xs text-slate-500 font-medium">${label}</span>
                    <span class="text-sm font-bold text-slate-800">${val || '-'}</span>
                </div>`).join('');
            box.classList.remove('hidden');
            box.innerHTML = `
                <div class="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div class="bg-slate-100 px-3 py-2 text-xs font-black text-slate-600 flex items-center gap-1.5">
                        <span>🔀</span> 현재시제 활용 ${word.verbClass === 'irregular' ? '<span class="text-rose-500 ml-1">(불규칙)</span>' : ''}
                    </div>
                    <div class="grid grid-cols-2">${cells}</div>
                </div>`;
        }

        function submitSubjectiveAnswer() {
            const q = quizSession.questions[quizSession.currentIndex];
            const userAnswer = document.getElementById('quiz-subjective-input').value.trim();
            // [냐냐 PATCH] 스마트 분석 (동의어 힌트 / 성수틀림 / 등록추천)
            const analysis = analyzeSubjectiveAnswer(userAnswer, q);

            // [냐냐 PATCH] 동의어를 입력한 경우: 오답 처리하지 않고 힌트를 보여준 뒤 다시 입력받음
            // (동의어는 '틀린 답'이 아니라 '정답으로 가는 길목'이라는 관점)
            if (analysis.isSynonym) {
                const synHintBox = document.getElementById('quiz-synonym-hint');
                if (synHintBox) {
                    synHintBox.classList.remove('hidden');
                    synHintBox.innerHTML = analysis.hint;
                }
                // 입력칸 비우고 다시 활성화 (재입력)
                const input = document.getElementById('quiz-subjective-input');
                input.value = '';
                input.focus();
                return; // 채점 보류, 다음 문제로 안 넘어감
            }

            // 동의어가 아니면 정상 채점
            document.getElementById('quiz-subjective-input').disabled = true;
            document.getElementById('quiz-subjective-submit-btn').disabled = true;
            const synHintBox = document.getElementById('quiz-synonym-hint');
            if (synHintBox) synHintBox.classList.add('hidden');
            q._subjectiveHint = analysis.hint || '';
            q._userAnswer = userAnswer;
            if (analysis.unknownWord) q._unknownWord = analysis.unknownWord;
            finishQuizQuestion(analysis.isCorrect, q);
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
                // [냐냐 PATCH] 정답 처리: 약점 점수↓ + 마스터 점수↑ (동시에, 모순 방지)
                const vocabItemC = vocabulary.find(w => w.id === q.word.id);
                if (vocabItemC) {
                    // (1) 약점 점수 내리기: 객관식 -2, 주관식 -1
                    const weakReward = (q.type === 'subjective') ? 1 : 2;
                    vocabItemC.weakScore = Math.max(0, (vocabItemC.weakScore || 0) - weakReward);
                    if (vocabItemC.weakScore < 5) vocabItemC.weak = false;

                    // (2) 마스터 점수 올리기: 객관식 +1, 주관식 +2 (상한 8점)
                    const masterGain = (q.type === 'subjective') ? 2 : 1;
                    vocabItemC.masterScore = Math.min(8, (vocabItemC.masterScore || 0) + masterGain);
                    // 주관식으로 맞힌 적 있으면 기록 (자동 마스터 필수 조건)
                    if (q.type === 'subjective') vocabItemC.subjectivePassed = true;

                    // (3) 자동 마스터: 5점 이상 + 주관식 정답 경험 있음
                    if (!vocabItemC.mastered && vocabItemC.masterScore >= 5 && vocabItemC.subjectivePassed) {
                        vocabItemC.mastered = true;
                        if (!quizSession.autoMasteredIds) quizSession.autoMasteredIds = [];
                        quizSession.autoMasteredIds.push(vocabItemC.id);
                    }
                }
                coach.innerText = "✨😄";
                showToast("🎯 정답입니다!", "success");
            } else {
                AudioFX.playError();
                quizSession.wrongList.push(q.word);
                // [냐냐 PATCH] 오답 처리: 약점 점수↑ + 마스터 점수↓ (동시에)
                const vocabItem = vocabulary.find(w => w.id === q.word.id);
                if (vocabItem) {
                    // (1) 약점 점수 올리기: 객관식 +2, 주관식 +1
                    const penalty = (q.type === 'subjective') ? 1 : 2;
                    vocabItem.weakScore = (vocabItem.weakScore || 0) + penalty;
                    if (vocabItem.weakScore >= 5) vocabItem.weak = true;

                    // (2) 마스터 점수 내리기: -3점. 5점 밑으로 떨어지면 마스터 해제
                    vocabItem.masterScore = Math.max(0, (vocabItem.masterScore || 0) - 3);
                    if (vocabItem.mastered && vocabItem.masterScore < 5) {
                        vocabItem.mastered = false;
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

            if (q.type === 'idiom-mc') {
                // 관용구 문제: 관용구 자체 + 뜻 + 부모 단어의 전체 정보(노트/관용구/예문)
                const it = q.idiomData || {};
                document.getElementById('quiz-review-word').innerText = it.idiom || q.answer;
                document.getElementById('quiz-review-meaning').innerText = it.idiomMeaning || '';

                const notesBox = document.getElementById('quiz-review-notes-box');
                const extraParts = [];
                extraParts.push(`📌 관용구 안내\n"${q.word.word}" (${q.word.meaning}) 단어의 관용구예요.`);
                if (q.word.notes) extraParts.push(`📝 노트\n${q.word.notes}`);
                const idiomList2 = (q.word.idioms && q.word.idioms.length > 0) ? q.word.idioms : (q.word.idiom ? [{ idiom: q.word.idiom, idiomMeaning: q.word.idiomMeaning || '' }] : []);
                if (idiomList2.length > 0) {
                    const idiomText = idiomList2.map(x => `· ${x.idiom}${x.idiomMeaning ? ' — ' + x.idiomMeaning : ''}`).join('\n');
                    extraParts.push(`💬 관용구\n${idiomText}`);
                }
                if (q.word.example) extraParts.push(`✍️ 예문\n${q.word.example}${q.word.exampleMeaning ? '\n' + q.word.exampleMeaning : ''}`);
                notesBox.classList.remove('hidden');
                notesBox.innerText = extraParts.join('\n\n');
            } else {
                document.getElementById('quiz-review-word').innerText = q.word.word;
                document.getElementById('quiz-review-meaning').innerText = q.word.meaning;

                // 단어 문제: 노트 + 관용구 + 예문을 함께 보여줌
                const notesBox = document.getElementById('quiz-review-notes-box');
                const extraParts = [];
                if (q.word.notes) extraParts.push(`📝 노트\n${q.word.notes}`);
                const idiomList = (q.word.idioms && q.word.idioms.length > 0) ? q.word.idioms : (q.word.idiom ? [{ idiom: q.word.idiom, idiomMeaning: q.word.idiomMeaning || '' }] : []);
                if (idiomList.length > 0) {
                    const idiomText = idiomList.map(it => `· ${it.idiom}${it.idiomMeaning ? ' — ' + it.idiomMeaning : ''}`).join('\n');
                    extraParts.push(`💬 관용구\n${idiomText}`);
                }
                if (q.word.example) extraParts.push(`✍️ 예문\n${q.word.example}${q.word.exampleMeaning ? '\n' + q.word.exampleMeaning : ''}`);

                if (extraParts.length > 0) {
                    notesBox.classList.remove('hidden');
                    notesBox.innerText = extraParts.join('\n\n');
                } else {
                    notesBox.classList.add('hidden');
                }
            }

            // [냐냐 PATCH] 동사 문제면 현재시제 활용표를 보여줌
            renderQuizConjugation(q.word);

            document.getElementById('quiz-review-panel').classList.remove('hidden');
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
                    w.mastered = true;
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
