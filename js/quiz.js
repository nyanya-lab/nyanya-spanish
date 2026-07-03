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

        function startQuiz() {
            // [냐냐 PATCH] 출제 범위: 체크박스로 여러 개 선택 (마스터 제외/마스터/약점 단어)
            const wantNotMastered = document.getElementById('scope-not-mastered')?.checked;
            const wantMastered = document.getElementById('scope-mastered')?.checked;
            const wantWeak = document.getElementById('scope-weak')?.checked;

            if (!wantNotMastered && !wantMastered && !wantWeak) {
                showToast("출제 범위를 최소 하나는 선택해 주세요!", "error");
                return;
            }

            // 선택된 범위들의 합집합 (중복 제거)
            const poolSet = new Map();
            if (wantNotMastered) vocabulary.filter(w => !w.mastered).forEach(w => poolSet.set(w.id, w));
            if (wantMastered) vocabulary.filter(w => w.mastered).forEach(w => poolSet.set(w.id, w));
            if (wantWeak) vocabulary.filter(w => w.weak).forEach(w => poolSet.set(w.id, w));
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
                    let pool = vocabulary.filter(x => x.id !== w.id).map(x => x.meaning);
                    pool.sort(() => Math.random() - 0.5);
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
                document.getElementById('quiz-question-text').innerText = `${q.word.meaning} → 스페인어로 써보세요!`;
                document.getElementById('quiz-choices-box').classList.add('hidden');
                document.getElementById('quiz-subjective-box').classList.remove('hidden');
                const input = document.getElementById('quiz-subjective-input');
                input.value = '';
                input.disabled = false;
                document.getElementById('quiz-subjective-submit-btn').disabled = false;
                setTimeout(() => input.focus(), 50);
            }
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

        function submitSubjectiveAnswer() {
            const q = quizSession.questions[quizSession.currentIndex];
            const userAnswer = document.getElementById('quiz-subjective-input').value.trim();
            // [냐냐 PATCH] 빈칸 제출 허용 — 모르는 단어는 빈칸으로 넘겨서 정답 확인 가능 (빈칸 = 오답 처리)
            document.getElementById('quiz-subjective-input').disabled = true;
            document.getElementById('quiz-subjective-submit-btn').disabled = true;
            const isCorrect = userAnswer ? (normalizeSpanishAnswer(userAnswer) === normalizeSpanishAnswer(q.word.word)) : false;
            finishQuizQuestion(isCorrect, q);
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
                coach.innerText = "✨😄";
                showToast("🎯 정답입니다!", "success");
            } else {
                AudioFX.playError();
                quizSession.wrongList.push(q.word);
                // [냐냐 PATCH] 틀린 횟수 누적 → 3번 이상 틀리면 약점 단어(weak)로 표시
                const vocabItem = vocabulary.find(w => w.id === q.word.id);
                if (vocabItem) {
                    vocabItem.wrongCount = (vocabItem.wrongCount || 0) + 1;
                    if (vocabItem.wrongCount >= 3) vocabItem.weak = true;
                }
                coach.innerText = "🤔💭";
                showToast("아쉬워요, 정답을 확인하고 다시 기억해 봐요!", "error");
            }

            document.getElementById('arena-score').innerText = `정답 ${quizSession.correctCount}개`;

            const verdict = document.getElementById('quiz-review-verdict');
            verdict.innerText = isCorrect ? "🎯 정답입니다!" : "📝 다시 한 번 확인해 볼까요?";
            verdict.className = isCorrect ? "text-sm font-bold text-emerald-600" : "text-sm font-bold text-rose-600";

            if (q.type === 'idiom-mc') {
                // 관용구 문제: 관용구 자체 + 뜻 + 부모 단어의 전체 정보(노트/관용구/예문)
                const it = q.idiomData || {};
                document.getElementById('quiz-review-word').innerText = it.idiom || q.answer;
                document.getElementById('quiz-review-meaning').innerText = it.idiomMeaning || '';

                const notesBox = document.getElementById('quiz-review-notes-box');
                const extraParts = [];
                extraParts.push(`📌 "${q.word.word}" (${q.word.meaning}) 단어의 관용구예요.`);
                if (q.word.notes) extraParts.push(`📝 ${q.word.notes}`);
                const idiomList2 = (q.word.idioms && q.word.idioms.length > 0) ? q.word.idioms : (q.word.idiom ? [{ idiom: q.word.idiom, idiomMeaning: q.word.idiomMeaning || '' }] : []);
                if (idiomList2.length > 0) {
                    const idiomText = idiomList2.map(x => `· ${x.idiom}${x.idiomMeaning ? ' — ' + x.idiomMeaning : ''}`).join('\n');
                    extraParts.push(`💬 관용구\n${idiomText}`);
                }
                if (q.word.example) extraParts.push(`✍️ ${q.word.example}${q.word.exampleMeaning ? '\n   ' + q.word.exampleMeaning : ''}`);
                notesBox.classList.remove('hidden');
                notesBox.innerText = extraParts.join('\n\n');
            } else {
                document.getElementById('quiz-review-word').innerText = q.word.word;
                document.getElementById('quiz-review-meaning').innerText = q.word.meaning;

                // 단어 문제: 노트 + 관용구 + 예문을 함께 보여줌
                const notesBox = document.getElementById('quiz-review-notes-box');
                const extraParts = [];
                if (q.word.notes) extraParts.push(`📝 ${q.word.notes}`);
                const idiomList = (q.word.idioms && q.word.idioms.length > 0) ? q.word.idioms : (q.word.idiom ? [{ idiom: q.word.idiom, idiomMeaning: q.word.idiomMeaning || '' }] : []);
                if (idiomList.length > 0) {
                    const idiomText = idiomList.map(it => `· ${it.idiom}${it.idiomMeaning ? ' — ' + it.idiomMeaning : ''}`).join('\n');
                    extraParts.push(`💬 관용구\n${idiomText}`);
                }
                if (q.word.example) extraParts.push(`✍️ ${q.word.example}${q.word.exampleMeaning ? '\n   ' + q.word.exampleMeaning : ''}`);

                if (extraParts.length > 0) {
                    notesBox.classList.remove('hidden');
                    notesBox.innerText = extraParts.join('\n\n');
                } else {
                    notesBox.classList.add('hidden');
                }
            }

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
