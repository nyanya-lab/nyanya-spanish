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

        function startQuiz() {
            // [냐냐 PATCH] 마스터한 단어는 출제 대상에서 제외 — 아직 안 외운 단어만 퀴즈로 나옴
            const reviewablePool = vocabulary.filter(w => !w.mastered);
            if (reviewablePool.length < 2) return;
            // 단어 수가 적으면 같은 단어가 반복 출제될 수 있음 (최대 단어 수의 4배까지만 허용)
            const count = Math.min(selectedQuizCount, reviewablePool.length * 4);
            const questions = [];
            for (let i = 0; i < count; i++) {
                const w = reviewablePool[Math.floor(Math.random() * reviewablePool.length)];
                const isSubjective = Math.random() < 0.3; // 약 30%는 주관식(스페인어 작문)
                const q = { word: w, type: isSubjective ? 'subjective' : 'mc' };
                if (!isSubjective) {
                    let choices = [w.meaning];
                    // 오답 선택지는 마스터한 단어도 포함해서 더 다양하게 뽑음 (실제 출제 대상만 마스터 제외)
                    let pool = vocabulary.filter(x => x.id !== w.id).map(x => x.meaning);
                    pool.sort(() => Math.random() - 0.5);
                    choices = choices.concat(pool.slice(0, 3));
                    choices.sort(() => Math.random() - 0.5);
                    q.choices = choices;
                }
                questions.push(q);
            }

            quizSession = { questions: questions, currentIndex: 0, correctCount: 0, wrongList: [] };

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

            if (q.type === 'mc') {
                document.getElementById('quiz-question-label').innerText = 'QUESTION';
                document.getElementById('quiz-question-text').innerText = `스페인어 "${q.word.word}"의 올바른 한국어 뜻은 무엇일까요?`;
                document.getElementById('quiz-choices-box').classList.remove('hidden');
                document.getElementById('quiz-subjective-box').classList.add('hidden');

                const box = document.getElementById('quiz-choices-box');
                box.innerHTML = '';
                q.choices.forEach((choice, idx) => {
                    box.innerHTML += `
                        <button onclick="submitMcAnswer('${choice.replace(/'/g, "\\'")}')" class="w-full bg-white border-2 border-slate-200 rounded-2xl py-4 px-5 text-slate-700 text-sm font-bold transition-all text-center flex items-center justify-center gap-2 hover:border-violet-400 hover:bg-violet-50 active:scale-95 shadow-sm">
                            <span class="w-6 h-6 rounded-full bg-slate-100 text-slate-400 text-xs flex items-center justify-center font-black">${idx + 1}</span>
                            <span class="flex-1">${choice}</span>
                        </button>
                    `;
                });
            } else {
                document.getElementById('quiz-question-label').innerText = 'WRITE IN SPANISH';
                document.getElementById('quiz-question-text').innerText = `"${q.word.meaning}"를 스페인어로 써보세요!`;
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

        function submitMcAnswer(choice) {
            const q = quizSession.questions[quizSession.currentIndex];
            finishQuizQuestion(choice === q.word.meaning, q);
        }

        function submitSubjectiveAnswer() {
            const q = quizSession.questions[quizSession.currentIndex];
            const userAnswer = document.getElementById('quiz-subjective-input').value.trim();
            if (!userAnswer) {
                showToast("스페인어로 답을 입력해 주세요!", "error");
                return;
            }
            document.getElementById('quiz-subjective-input').disabled = true;
            document.getElementById('quiz-subjective-submit-btn').disabled = true;
            const isCorrect = normalizeSpanishAnswer(userAnswer) === normalizeSpanishAnswer(q.word.word);
            finishQuizQuestion(isCorrect, q);
        }

        function finishQuizQuestion(isCorrect, q) {
            const coach = document.getElementById('quiz-coach-character');

            // [냐냐 PATCH-수준맞춤] 누적 정답률/취약 품사만 살짝 갱신 (전체 기록 저장 아님)
            learnerProfile.totalAnswered++;
            if (isCorrect) {
                learnerProfile.totalCorrect++;
            } else {
                const pos = q.word.pos || 'etc';
                learnerProfile.wrongByPos[pos] = (learnerProfile.wrongByPos[pos] || 0) + 1;
            }

            if (isCorrect) {
                AudioFX.playSuccess();
                quizSession.correctCount++;
                coach.innerText = "✨😄";
                showToast("🎯 정답입니다!", "success");
            } else {
                AudioFX.playError();
                quizSession.wrongList.push(q.word);
                coach.innerText = "🤔💭";
                showToast("아쉬워요, 정답을 확인하고 다시 기억해 봐요!", "error");
            }

            document.getElementById('arena-score').innerText = `정답 ${quizSession.correctCount}개`;

            const verdict = document.getElementById('quiz-review-verdict');
            verdict.innerText = isCorrect ? "🎯 정답입니다!" : "📝 다시 한 번 확인해 볼까요?";
            verdict.className = isCorrect ? "text-sm font-bold text-emerald-600" : "text-sm font-bold text-rose-600";

            document.getElementById('quiz-review-word').innerText = q.word.word;
            document.getElementById('quiz-review-meaning').innerText = q.word.meaning;

            const notesBox = document.getElementById('quiz-review-notes-box');
            if (q.word.notes) {
                notesBox.classList.remove('hidden');
                notesBox.innerText = q.word.notes;
            } else {
                notesBox.classList.add('hidden');
            }

            document.getElementById('quiz-review-panel').classList.remove('hidden');
            const nextBtn = document.getElementById('quiz-next-btn');
            nextBtn.disabled = false;
            nextBtn.className = "w-full bg-violet-600 hover:bg-violet-700 text-white py-3 rounded-xl text-sm font-bold transition-all active:scale-95";
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
        }

        function restartQuizSetup() {
            quizSession = null;
            document.getElementById('quiz-results-screen').classList.add('hidden');
            document.getElementById('quiz-question-screen').classList.add('hidden');
            document.getElementById('quiz-setup-screen').classList.remove('hidden');
        }


        // TAB 4: LIVE AI TRANSLATION COACH
