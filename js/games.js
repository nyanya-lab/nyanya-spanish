// ============================================================
        // [냐냐 PATCH] 미니 게임 모음
        // ============================================================
        let gameState = null; // 현재 진행 중인 게임 상태

        // 게임 메뉴로 돌아가기 (진행 중이던 게임 정리)
        function resetGamesMenu() {
            stopCurrentGame();
            const menu = document.getElementById('games-menu');
            const playArea = document.getElementById('game-play-area');
            if (menu) menu.classList.remove('hidden');
            if (playArea) { playArea.classList.add('hidden'); playArea.innerHTML = ''; }
            // 각 게임 최고기록 표시 (이번 주 / 역대)
            ['rapidfire', 'falling'].forEach(g => {
                const el = document.getElementById('hs-' + g);
                if (el) {
                    const week = getGameWeekHighScore(g);
                    const all = getGameHighScore(g);
                    el.innerHTML = `이번 주 <b class="text-slate-600">${week}</b> · 역대 <b class="text-amber-500">${all}</b>`;
                }
            });
        }

        // 진행 중인 게임의 타이머/애니메이션 정리
        function stopCurrentGame() {
            if (gameState) {
                if (gameState.timerInterval) clearInterval(gameState.timerInterval);
                if (gameState.spawnInterval) clearInterval(gameState.spawnInterval);
                if (gameState.rafId) cancelAnimationFrame(gameState.rafId);
                if (gameState.flashTimeout) clearTimeout(gameState.flashTimeout);
            }
            gameState = null;
        }

        // 게임용 단어 풀 (마스터 안 된 단어 우선, 없으면 전체)
        function getGameWordPool() {
            const notMastered = vocabulary.filter(w => !w.mastered && w.word && w.meaning);
            const pool = notMastered.length >= 4 ? notMastered : vocabulary.filter(w => w.word && w.meaning);
            return pool;
        }

        function showGamePlayArea(html) {
            const menu = document.getElementById('games-menu');
            const playArea = document.getElementById('game-play-area');
            if (menu) menu.classList.add('hidden');
            if (playArea) { playArea.classList.remove('hidden'); playArea.innerHTML = html; }
        }

        // 정답 비교 (악센트/관사 관용 — 기존 normalizeSpanishAnswer 재사용)
        function gameCheckAnswer(userRaw, correct) {
            const stripArticle = (s) => normalizeSpanishAnswer(s).replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, '');
            // 관사 포함/미포함 둘 다 정답 인정 (힌트가 관사를 뗀 앞글자를 주므로)
            return normalizeSpanishAnswer(userRaw) === normalizeSpanishAnswer(correct)
                || stripArticle(userRaw) === stripArticle(correct);
        }

        // [냐냐 PATCH] 동의어 방지용 시작 글자 힌트 (앞 2글자) — 게임 item 2
        function gameStartHint(word) {
            if (!word) return '';
            let clean = word.trim();
            // [냐냐 PATCH] 명사 등에서 정관사/부정관사를 떼고 실제 단어의 앞글자로 힌트
            clean = clean.replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, '');
            const n = Math.min(2, clean.length);
            return clean.slice(0, n);
        }

        // [냐냐 PATCH] 게임 결과를 단어의 마스터/약점 점수에 반영 (퀴즈 객관식과 동일한 강도)
        function applyGameScore(wordId, isCorrect) {
            const w = vocabulary.find(v => v.id === wordId);
            if (!w) return;
            if (isCorrect) {
                // [냐냐 PATCH] 정답률용 카운터
                w.correctTotal = (w.correctTotal || 0) + 1;
                // 정답: 약점 점수 -2, 마스터 점수 +1 (상한 8)
                w.weakScore = Math.max(0, (w.weakScore || 0) - 2);
                if (w.weakScore < 5) w.weak = false;
                w.masterScore = Math.min(8, (w.masterScore || 0) + 1);
                // 게임은 객관식 성격이라 자동 마스터의 '주관식 통과' 조건은 못 채움 (subjectivePassed 안 건드림)
                if (!w.mastered && w.masterScore >= 5 && w.subjectivePassed) {
                    w.mastered = true;
                    logAction('new-mastered'); // [냐냐 PATCH] 게임 자동 마스터도 일지/그래프에 반영
                }
            } else {
                // [냐냐 PATCH] 정답률용 카운터
                w.wrongTotal = (w.wrongTotal || 0) + 1;
                // 오답: 게임은 시간에 쫓겨 못 맞추기도 하니 약하게 감점 (약점 +1, 마스터 -1)
                w.weakScore = (w.weakScore || 0) + 1;
                w.lastWrongDate = getLocalDateString(); // [냐냐 PATCH] 오늘 틀림 기록
                if (w.weakScore >= 3) w.weak = true;
                w.masterScore = Math.max(0, (w.masterScore || 0) - 1);
                if (w.mastered && w.masterScore < 5) w.mastered = false;
            }
        }

        // [냐냐 PATCH] 게임 최고기록 — 역대 + 이번 주 (localStorage)
        function getWeekKey() {
            // 이번 주 월요일 날짜를 키로 사용 (YYYY-MM-DD)
            const d = new Date();
            const day = (d.getDay() + 6) % 7; // 월=0
            d.setDate(d.getDate() - day);
            d.setHours(0,0,0,0);
            return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        }
        function getGameHighScore(gameType) {
            try { return parseInt(localStorage.getItem('nyanya_game_hs_' + gameType) || '0', 10) || 0; }
            catch (e) { return 0; }
        }
        function getGameWeekHighScore(gameType) {
            try {
                const raw = localStorage.getItem('nyanya_game_whs_' + gameType);
                if (!raw) return 0;
                const obj = JSON.parse(raw);
                if (obj.week !== getWeekKey()) return 0; // 지난 주 기록이면 0
                return obj.score || 0;
            } catch (e) { return 0; }
        }
        function setGameHighScore(gameType, score) {
            let isNewAllTime = false;
            // 역대 최고
            const prev = getGameHighScore(gameType);
            if (score > prev) {
                try { localStorage.setItem('nyanya_game_hs_' + gameType, String(score)); } catch (e) {}
                isNewAllTime = true;
            }
            // 이번 주 최고
            const weekPrev = getGameWeekHighScore(gameType);
            if (score > weekPrev) {
                try { localStorage.setItem('nyanya_game_whs_' + gameType, JSON.stringify({ week: getWeekKey(), score })); } catch (e) {}
            }
            return isNewAllTime; // 역대 신기록 여부
        }

        // ============================================================
        // 게임 1: 속사포 퀴즈 (제한 시간 60초, 콤보)
        // ============================================================
        function startRapidFire() {
            const pool = getGameWordPool();
            if (pool.length < 4) {
                showToast("게임하려면 단어가 4개 이상 있어야 해요!", "error");
                return;
            }
            stopCurrentGame();
            gameState = {
                type: 'rapidfire',
                pool: pool,
                score: 0,
                combo: 0,
                maxCombo: 0,
                correct: 0,
                wrong: 0,
                timeLeft: 60,
                current: null,
                timerInterval: null
            };

            showGamePlayArea(`
                <div class="bg-white border border-slate-200 rounded-3xl p-6 space-y-5">
                    <div class="flex items-center justify-between">
                        <button onclick="resetGamesMenu()" class="text-xs font-bold text-slate-400 hover:text-slate-600"><i class="fa-solid fa-arrow-left"></i> 나가기</button>
                        <div class="flex items-center gap-4">
                            <span class="text-xs font-bold text-slate-500">점수 <span id="rf-score" class="text-rose-600 text-base">0</span></span>
                            <span class="text-xs font-bold text-slate-500">콤보 <span id="rf-combo" class="text-amber-500 text-base">0</span></span>
                        </div>
                    </div>
                    <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div id="rf-timebar" class="h-full bg-gradient-to-r from-rose-400 to-pink-500 transition-all duration-1000 ease-linear" style="width:100%"></div>
                    </div>
                    <div class="text-center py-4">
                        <p class="text-xs font-bold text-slate-400 mb-1">이 뜻의 스페인어는?</p>
                        <p id="rf-question" class="text-2xl font-black text-slate-900">-</p>
                        <p id="rf-feedback" class="text-sm font-bold mt-2 h-5"></p>
                    </div>
                    <input type="text" id="rf-input" autocomplete="off" placeholder="스페인어 입력 후 Enter" class="w-full bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-rose-400">
                    <p class="text-center text-xs text-slate-400">남은 시간 <span id="rf-time" class="font-bold text-slate-600">60</span>초</p>
                </div>
            `);

            const input = document.getElementById('rf-input');
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); rapidFireSubmit(); }
            });
            setTimeout(() => input.focus(), 50);

            rapidFireNext();
            gameState.timerInterval = setInterval(() => {
                if (!gameState) return;
                gameState.timeLeft--;
                const timeEl = document.getElementById('rf-time');
                const bar = document.getElementById('rf-timebar');
                if (timeEl) timeEl.innerText = gameState.timeLeft;
                if (bar) bar.style.width = Math.min(100, gameState.timeLeft / 60 * 100) + '%';
                if (gameState.timeLeft <= 0) rapidFireEnd();
            }, 1000);
        }

        function rapidFireNext() {
            if (!gameState) return;
            const pool = gameState.pool;
            gameState.current = pool[Math.floor(Math.random() * pool.length)];
            const qEl = document.getElementById('rf-question');
            if (qEl) qEl.innerHTML = `${gameState.current.meaning} <span class="text-base text-rose-400 font-bold">(${gameStartHint(gameState.current.word)}…)</span>`;
            const input = document.getElementById('rf-input');
            if (input) { input.value = ''; input.focus(); }
        }

        function rapidFireSubmit() {
            if (!gameState || !gameState.current) return;
            const input = document.getElementById('rf-input');
            const fb = document.getElementById('rf-feedback');
            const userAnswer = input.value.trim();
            // [냐냐 PATCH] 빈칸으로 엔터쳐도 넘어감 (오답 처리)

            const isCorrect = userAnswer ? gameCheckAnswer(userAnswer, gameState.current.word) : false;
            applyGameScore(gameState.current.id, isCorrect); // 마스터/약점 점수 반영
            if (isCorrect) {
                gameState.combo++;
                gameState.maxCombo = Math.max(gameState.maxCombo, gameState.combo);
                gameState.correct++;
                // 콤보 보너스: 기본 10점 + 콤보당 2점
                const points = 10 + (gameState.combo - 1) * 2;
                gameState.score += points;
                // [냐냐 PATCH] 정답 시 시간 +3초 보너스
                gameState.timeLeft += 3;
                const timerEl = document.getElementById('rf-time');
                if (timerEl) timerEl.innerText = gameState.timeLeft;
                if (fb) { fb.innerText = `+${points}점! +3초 ⏱ ${gameState.combo >= 3 ? '🔥 ' + gameState.combo + ' 콤보!' : '✓'}`; fb.className = "text-sm font-bold mt-2 h-5 text-emerald-600"; }
                AudioFX.playSuccess();
            } else {
                gameState.combo = 0;
                gameState.wrong++;
                if (fb) { fb.innerText = `✗ 정답: ${gameState.current.word}`; fb.className = "text-sm font-bold mt-2 h-5 text-rose-500"; }
                AudioFX.playError();
            }
            const scoreEl = document.getElementById('rf-score');
            const comboEl = document.getElementById('rf-combo');
            if (scoreEl) scoreEl.innerText = gameState.score;
            if (comboEl) comboEl.innerText = gameState.combo;
            rapidFireNext();
        }

        function rapidFireEnd() {
            if (!gameState) return;
            const finalScore = gameState.score;
            const correct = gameState.correct;
            const wrong = gameState.wrong;
            const maxCombo = gameState.maxCombo;
            stopCurrentGame();
            // [냐냐 PATCH] 게임 1판 완료 = 학습 기록에 게임 +1
            try { if (typeof logAction === 'function') logAction('game'); } catch (e) {}
            // 마스터/약점 점수 변경사항 저장 + 최고기록 갱신
            const isNewRecord = setGameHighScore('rapidfire', finalScore);
            const highScore = getGameHighScore('rapidfire');
            try { if (typeof saveToStorage === 'function') saveToStorage(); } catch (e) {}
            showGamePlayArea(`
                <div class="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-4">
                    <div class="text-6xl">⚡</div>
                    <h3 class="text-xl font-black text-slate-900">시간 종료!</h3>
                    <p class="text-4xl font-black text-rose-600">${finalScore}점</p>
                    ${isNewRecord ? '<p class="text-sm font-black text-amber-500">🎉 최고 기록 갱신!</p>' : `<p class="text-xs font-bold text-slate-400">최고 기록: ${highScore}점</p>`}
                    <div class="flex justify-center gap-6 text-sm">
                        <span class="text-slate-500">정답 <b class="text-emerald-600">${correct}</b></span>
                        <span class="text-slate-500">오답 <b class="text-rose-500">${wrong}</b></span>
                        <span class="text-slate-500">최고 콤보 <b class="text-amber-500">${maxCombo}</b></span>
                    </div>
                    <div class="flex gap-2 justify-center pt-2">
                        <button onclick="startRapidFire()" class="bg-rose-500 hover:bg-rose-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all">다시 하기</button>
                        <button onclick="resetGamesMenu()" class="bg-slate-100 hover:bg-slate-200 text-slate-600 px-5 py-2.5 rounded-xl text-sm font-bold transition-all">게임 목록</button>
                    </div>
                </div>
            `);
        }

        function startFallingWords() {
            const pool = getGameWordPool();
            if (pool.length < 4) {
                showToast("게임하려면 단어가 4개 이상 있어야 해요!", "error");
                return;
            }
            stopCurrentGame();
            gameState = {
                type: 'falling',
                pool: pool,
                score: 0,
                correct: 0,
                lives: 5,
                fallingItems: [], // {id, word, meaning, x, y, el}
                speed: 0.15, // % per frame
                spawnInterval: null,
                rafId: null,
                lastSpawn: 0
            };

            showGamePlayArea(`
                <div class="bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
                    <div class="flex items-center justify-between">
                        <button onclick="resetGamesMenu()" class="text-xs font-bold text-slate-400 hover:text-slate-600"><i class="fa-solid fa-arrow-left"></i> 나가기</button>
                        <div class="flex items-center gap-3">
                            <span class="text-xs font-bold text-slate-500">점수 <span id="fall-score" class="text-emerald-600 text-base">0</span></span>
                            <span id="fall-lives" class="text-sm">${'❤️'.repeat(5)}</span>
                        </div>
                    </div>
                    <div id="fall-area" class="relative bg-gradient-to-b from-sky-50 to-emerald-50 border border-slate-100 rounded-2xl overflow-hidden" style="height: 480px;">
                        <div class="absolute bottom-0 left-0 right-0 h-1 bg-rose-300"></div>
                    </div>
                    <input type="text" id="fall-input" autocomplete="off" placeholder="떨어지는 단어의 스페인어 입력 후 Enter" class="w-full bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 text-center text-base font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400">
                </div>
            `);

            const input = document.getElementById('fall-input');
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); fallingWordsSubmit(); }
            });
            setTimeout(() => input.focus(), 50);

            // 첫 단어 스폰 + 주기적 스폰
            fallingWordsSpawn();
            gameState.spawnInterval = setInterval(() => {
                if (gameState) fallingWordsSpawn();
            }, 2600);
            // 애니메이션 루프
            gameState.rafId = requestAnimationFrame(fallingWordsLoop);
        }

        function fallingWordsSpawn() {
            if (!gameState) return;
            const area = document.getElementById('fall-area');
            if (!area) return;
            const w = gameState.pool[Math.floor(Math.random() * gameState.pool.length)];
            const x = 5 + Math.random() * 80; // 좌우 위치 %
            const el = document.createElement('div');
            el.className = 'absolute px-3 py-1.5 bg-white rounded-xl shadow-sm border border-slate-200 text-sm font-bold text-slate-800 whitespace-nowrap';
            el.style.left = x + '%';
            el.style.top = '0%';
            el.innerHTML = `${w.meaning} <span class="text-emerald-500 text-xs">(${gameStartHint(w.word)}…)</span>`;
            area.appendChild(el);
            gameState.fallingItems.push({ id: w.id, word: w.word, meaning: w.meaning, x, y: 0, el });
        }

        function fallingWordsLoop() {
            if (!gameState) return;
            const area = document.getElementById('fall-area');
            if (!area) return;
            const items = gameState.fallingItems;
            for (let i = items.length - 1; i >= 0; i--) {
                const it = items[i];
                it.y += gameState.speed;
                it.el.style.top = it.y + '%';
                // 바닥(약 92%)에 닿으면 생명 -1
                if (it.y >= 92) {
                    it.el.remove();
                    items.splice(i, 1);
                    gameState.lives--;
                    const livesEl = document.getElementById('fall-lives');
                    if (livesEl) livesEl.innerText = '❤️'.repeat(Math.max(0, gameState.lives)) + '🖤'.repeat(Math.max(0, 5 - gameState.lives));
                    AudioFX.playError();
                    if (gameState.lives <= 0) { fallingWordsEnd(); return; }
                }
            }
            // 점점 빨라짐
            gameState.speed = Math.min(0.4, gameState.speed + 0.00003);
            gameState.rafId = requestAnimationFrame(fallingWordsLoop);
        }

        function fallingWordsSubmit() {
            if (!gameState) return;
            const input = document.getElementById('fall-input');
            const userAnswer = input.value.trim();
            input.value = '';
            if (!userAnswer) return; // 빈칸은 무시 (생명 안 깎음)

            // 떨어지는 단어 중 일치하는 것 찾기 (가장 아래 것 우선)
            const items = gameState.fallingItems;
            let matchIdx = -1;
            let lowestY = -1;
            for (let i = 0; i < items.length; i++) {
                if (gameCheckAnswer(userAnswer, items[i].word) && items[i].y > lowestY) {
                    matchIdx = i; lowestY = items[i].y;
                }
            }
            if (matchIdx >= 0) {
                const it = items[matchIdx];
                applyGameScore(it.id, true); // 맞힌 단어 점수 반영
                gameState.score += 10;
                gameState.correct++;
                it.el.remove();
                items.splice(matchIdx, 1);
                const scoreEl = document.getElementById('fall-score');
                if (scoreEl) scoreEl.innerText = gameState.score;
                AudioFX.playSuccess();
            } else {
                // 틀린 입력 — 페널티는 없지만 효과음
                AudioFX.playError();
            }
        }

        function fallingWordsEnd() {
            if (!gameState) return;
            const score = gameState.score;
            const correct = gameState.correct;
            stopCurrentGame();
            try { if (typeof logAction === 'function') logAction('game'); } catch (e) {} // [냐냐 PATCH] 게임 1판 완료
            const isNewRecord = setGameHighScore('falling', score);
            const highScore = getGameHighScore('falling');
            try { if (typeof saveToStorage === 'function') saveToStorage(); } catch (e) {}
            showGamePlayArea(`
                <div class="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-4">
                    <div class="text-6xl">🌧️</div>
                    <h3 class="text-xl font-black text-slate-900">게임 종료!</h3>
                    <p class="text-4xl font-black text-emerald-600">${score}점</p>
                    ${isNewRecord ? '<p class="text-sm font-black text-amber-500">🎉 최고 기록 갱신!</p>' : `<p class="text-xs font-bold text-slate-400">최고 기록: ${highScore}점</p>`}
                    <p class="text-sm text-slate-500">맞힌 단어 <b class="text-emerald-600">${correct}</b>개</p>
                    <div class="flex gap-2 justify-center pt-2">
                        <button onclick="startFallingWords()" class="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all">다시 하기</button>
                        <button onclick="resetGamesMenu()" class="bg-slate-100 hover:bg-slate-200 text-slate-600 px-5 py-2.5 rounded-xl text-sm font-bold transition-all">게임 목록</button>
                    </div>
                </div>
            `);
        }


        // ============================================================
        // 게임 4: 듣기 받아쓰기 (예문 듣고 따라 쓰기, 점수 없음)
        // ============================================================
        function speakSpanish(text, rate) {
            speakSpanishVoice(text, rate || 0.9);
        }

        // [냐냐 PATCH] 듣기 퀴즈 재생 속도 (기본 0.9)
        let listeningRate = 0.9;
        function setListeningRate(rate) {
            listeningRate = rate;
            // 버튼 하이라이트 갱신
            document.querySelectorAll('.listen-speed-btn').forEach(b => {
                const r = parseFloat(b.dataset.rate);
                if (Math.abs(r - rate) < 0.001) {
                    b.classList.add('bg-sky-500', 'text-white');
                    b.classList.remove('bg-sky-50', 'text-sky-600');
                } else {
                    b.classList.remove('bg-sky-500', 'text-white');
                    b.classList.add('bg-sky-50', 'text-sky-600');
                }
            });
        }
        function speakListening() {
            if (gameState && gameState.current) speakSpanish(gameState.current.example, listeningRate);
        }

        function startListeningQuiz() {
            // 예문이 있는 단어만 사용
            const pool = vocabulary.filter(w => w.example && w.example.trim().length > 0);
            if (pool.length < 1) {
                showToast("예문이 있는 단어가 없어요! 단어에 예문을 추가해 주세요.", "error");
                return;
            }
            stopCurrentGame();
            gameState = { type: 'listening', pool, index: 0, correct: 0, total: 0, current: null, goal: 5 }; // [냐냐 PATCH] 5문장 1세트
            listeningNext();
        }

        function listeningNext() {
            if (!gameState) return;
            gameState.current = gameState.pool[Math.floor(Math.random() * gameState.pool.length)];
            gameState.total++;
            showGamePlayArea(`
                <div class="bg-white border border-slate-200 rounded-3xl p-6 space-y-5">
                    <div class="flex items-center justify-between">
                        <button onclick="resetGamesMenu()" class="text-xs font-bold text-slate-400 hover:text-slate-600"><i class="fa-solid fa-arrow-left"></i> 나가기</button>
                        <span class="text-xs font-bold text-slate-500">${gameState.total}/${gameState.goal}문장 · 맞힌 문장 <span class="text-sky-600">${gameState.correct}</span></span>
                    </div>
                    <div class="text-center py-6 space-y-4">
                        <p class="text-xs font-bold text-sky-400">🎧 예문을 듣고 똑같이 써보세요!</p>
                        <button onclick="speakListening()" class="bg-sky-500 hover:bg-sky-600 text-white w-16 h-16 rounded-full text-2xl shadow-lg shadow-sky-100 transition-all active:scale-90">
                            <i class="fa-solid fa-volume-high"></i>
                        </button>
                        <div class="flex items-center justify-center gap-1.5">
                            <span class="text-[10px] font-bold text-slate-400 mr-1">속도</span>
                            <button onclick="setListeningRate(0.5)" data-rate="0.5" class="listen-speed-btn text-[11px] font-bold px-2 py-1 rounded-lg bg-sky-50 text-sky-600 transition-all">0.5x</button>
                            <button onclick="setListeningRate(0.75)" data-rate="0.75" class="listen-speed-btn text-[11px] font-bold px-2 py-1 rounded-lg bg-sky-50 text-sky-600 transition-all">0.75x</button>
                            <button onclick="setListeningRate(0.9)" data-rate="0.9" class="listen-speed-btn text-[11px] font-bold px-2 py-1 rounded-lg bg-sky-50 text-sky-600 transition-all">보통</button>
                            <button onclick="setListeningRate(1.1)" data-rate="1.1" class="listen-speed-btn text-[11px] font-bold px-2 py-1 rounded-lg bg-sky-50 text-sky-600 transition-all">1.1x</button>
                        </div>
                        <p class="text-xs text-slate-400">속도를 바꾸고 스피커를 다시 눌러요</p>
                        <p id="listen-feedback" class="text-sm font-bold h-5"></p>
                    </div>
                    <textarea id="listen-input" rows="2" placeholder="들은 문장을 입력하세요..." class="w-full bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 text-center text-base font-semibold focus:outline-none focus:ring-2 focus:ring-sky-400"></textarea>
                    <button onclick="listeningSubmit()" class="w-full bg-sky-600 hover:bg-sky-700 text-white py-3 rounded-xl text-sm font-bold transition-all">확인</button>
                </div>
            `);
            // 자동으로 한 번 읽어주기 (선택된 속도로)
            setTimeout(() => {
                setListeningRate(listeningRate); // 버튼 하이라이트
                speakListening();
                document.getElementById('listen-input')?.focus();
            }, 300);
        }

        function listeningSubmit() {
            if (!gameState || !gameState.current) return;
            const input = document.getElementById('listen-input');
            const fb = document.getElementById('listen-feedback');
            const userText = input.value.trim();
            input.disabled = true;

            // 문장 비교 (악센트/문장부호/대소문자 관대하게)
            const norm = (s) => s.toLowerCase().replace(/[.,!?¿¡;:"'()]/g, '').replace(/\s+/g, ' ').trim()
                .replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u').replace(/ü/g,'u');
            const correct = gameState.current.example;
            const isCorrect = norm(userText) === norm(correct);

            if (isCorrect) {
                gameState.correct++;
                if (fb) { fb.innerText = "✓ 완벽해요!"; fb.className = "text-sm font-bold h-5 text-emerald-600"; }
                AudioFX.playSuccess();
            } else {
                if (fb) { fb.innerHTML = `✗ 정답: <span class="text-slate-700">${correct}</span>`; fb.className = "text-sm font-bold h-5 text-rose-500"; }
                AudioFX.playError();
            }
            // [냐냐 PATCH] 5문장 완료하면 세트 종료, 아니면 다음 문장
            const playArea = document.getElementById('game-play-area');
            const isSetDone = gameState.total >= (gameState.goal || 5);
            let nextBtnHtml;
            if (isSetDone) {
                const correctCount = gameState.correct;
                const goalCount = gameState.goal || 5;
                // 게임 1판(세트) 완료 기록
                try { if (typeof logAction === 'function') logAction('game'); } catch (e) {}
                try { if (typeof saveToStorage === 'function') saveToStorage(); } catch (e) {}
                nextBtnHtml = `
                    <div class="text-center pt-3 space-y-3">
                        <p class="text-sm font-black text-sky-600">🎧 5문장 완료! 맞힌 문장 ${correctCount}/${goalCount}</p>
                        <div class="flex gap-2 justify-center">
                            <button onclick="startListeningQuiz()" class="bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all">한 세트 더</button>
                            <button onclick="resetGamesMenu()" class="bg-slate-100 hover:bg-slate-200 text-slate-600 px-5 py-2.5 rounded-xl text-sm font-bold transition-all">그만하기</button>
                        </div>
                    </div>`;
            } else {
                nextBtnHtml = `
                    <div class="flex gap-2 justify-center pt-3">
                        <button onclick="listeningNext()" class="bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all">다음 문장 (${gameState.total}/${gameState.goal || 5})</button>
                        <button onclick="resetGamesMenu()" class="bg-slate-100 hover:bg-slate-200 text-slate-600 px-5 py-2.5 rounded-xl text-sm font-bold transition-all">그만하기</button>
                    </div>`;
            }
            // 확인 버튼을 다음/완료 버튼으로 교체
            const confirmBtn = playArea.querySelector('button[onclick="listeningSubmit()"]');
            if (confirmBtn) confirmBtn.outerHTML = nextBtnHtml;
            // 정답 뜻도 보여주기
            if (fb && gameState.current.exampleMeaning) {
                fb.innerHTML += `<br><span class="text-xs text-slate-400 font-normal">${gameState.current.exampleMeaning}</span>`;
            }
        }


        // ============================================================
        // [냐냐 PATCH] 단어 복습 (깜빡이 방식, 점수 없음, 단어 선택 가능)
        // ============================================================
        let reviewState = null;
        let reviewScope = 'today-wrong';
        let reviewCount = 20;   // [냐냐 PATCH] 복습할 단어 개수
        let reviewRepeat = 1;   // [냐냐 PATCH] 반복 횟수

        function resetReviewTab() {
            reviewState = null;
            const setup = document.getElementById('review-setup');
            const play = document.getElementById('review-play-area');
            if (setup) setup.classList.remove('hidden');
            if (play) { play.classList.add('hidden'); play.innerHTML = ''; }
            // 기본 선택
            selectReviewScope(reviewScope || 'today-wrong');
            selectReviewCount(reviewCount || 20);
            selectReviewRepeat(reviewRepeat || 1);
            // [냐냐 PATCH] 빈칸 채우기 모드도 초기화 + 서브메뉴(모드) 반영
            if (typeof resetFillSetup === 'function') resetFillSetup();
            if (typeof selectReviewMode === 'function') selectReviewMode(reviewMode || 'blink');
        }

        function selectReviewCount(n) {
            reviewCount = n;
            document.querySelectorAll('.review-count-btn').forEach(btn => {
                if (parseInt(btn.dataset.reviewCount) === n) {
                    btn.classList.add('border-indigo-500', 'bg-indigo-50', 'text-indigo-700');
                    btn.classList.remove('border-slate-200', 'text-slate-600');
                } else {
                    btn.classList.remove('border-indigo-500', 'bg-indigo-50', 'text-indigo-700');
                    btn.classList.add('border-slate-200', 'text-slate-600');
                }
            });
        }

        function selectReviewRepeat(n) {
            reviewRepeat = n;
            document.querySelectorAll('.review-repeat-btn').forEach(btn => {
                if (parseInt(btn.dataset.reviewRepeat) === n) {
                    btn.classList.add('border-indigo-500', 'bg-indigo-50', 'text-indigo-700');
                    btn.classList.remove('border-slate-200', 'text-slate-600');
                } else {
                    btn.classList.remove('border-indigo-500', 'bg-indigo-50', 'text-indigo-700');
                    btn.classList.add('border-slate-200', 'text-slate-600');
                }
            });
        }

        function getReviewPool(scope) {
            // [냐냐 PATCH] '오늘 복습' = 망각곡선 복습 대상 (오늘 틀린 것 + 1·3·7·14·30일 주기)
            if (scope === 'today-wrong') return getReviewDueWords();
            if (scope === 'weak') return vocabulary.filter(w => w.weak && !w.mastered);
            if (scope === 'not-mastered') return vocabulary.filter(w => !w.mastered);
            return vocabulary.slice(); // all
        }

        function selectReviewScope(scope) {
            reviewScope = scope;
            // 버튼 하이라이트
            document.querySelectorAll('.review-scope-btn').forEach(btn => {
                if (btn.dataset.reviewScope === scope) {
                    btn.classList.add('border-indigo-500', 'bg-indigo-50', 'text-indigo-700');
                    btn.classList.remove('border-slate-200', 'text-slate-600');
                } else {
                    btn.classList.remove('border-indigo-500', 'bg-indigo-50', 'text-indigo-700');
                    btn.classList.add('border-slate-200', 'text-slate-600');
                }
            });
            const cnt = getReviewPool(scope).length;
            const cntEl = document.getElementById('review-scope-count');
            if (cntEl) cntEl.innerText = `복습할 단어: ${cnt}개`;
        }

        function startWordReview() {
            const pool = getReviewPool(reviewScope);
            if (pool.length < 1) {
                showToast("복습할 단어가 없어요! 다른 범위를 골라보세요.", "error");
                return;
            }
            // 순서 섞고, 선택한 개수만큼 자르기
            let shuffled = pool.slice().sort(() => Math.random() - 0.5);
            shuffled = shuffled.slice(0, reviewCount);
            // 반복 횟수만큼 리스트를 이어붙임 (매 회차 순서 다시 섞음)
            let sequence = [];
            for (let r = 0; r < reviewRepeat; r++) {
                sequence = sequence.concat(shuffled.slice().sort(() => Math.random() - 0.5));
            }
            reviewState = { pool: sequence, index: 0, correct: 0, total: sequence.length, showMs: 2500, uniqueCount: shuffled.length, repeat: reviewRepeat };
            document.getElementById('review-setup').classList.add('hidden');
            document.getElementById('review-play-area').classList.remove('hidden');
            reviewShowWord();
        }

        function reviewShowWord() {
            if (!reviewState) return;
            if (reviewState.index >= reviewState.pool.length) { reviewEnd(); return; }
            const w = reviewState.pool[reviewState.index];
            reviewState.current = w;
            const play = document.getElementById('review-play-area');
            play.innerHTML = `
                <div class="bg-white border border-slate-200 rounded-3xl p-6 space-y-5">
                    <div class="flex items-center justify-between">
                        <button onclick="resetReviewTab()" class="text-xs font-bold text-slate-400 hover:text-slate-600"><i class="fa-solid fa-arrow-left"></i> 나가기</button>
                        <span class="text-xs font-bold text-slate-500">${reviewState.index + 1} / ${reviewState.total}</span>
                    </div>
                    <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div class="h-full bg-indigo-500 transition-all" style="width:${(reviewState.index / reviewState.total * 100)}%"></div>
                    </div>
                    <div class="text-center py-10">
                        <p class="text-xs font-bold text-indigo-400 mb-3">👁️ 잘 기억하세요!</p>
                        <p class="text-4xl font-black text-slate-900">${w.word}</p>
                        <p class="text-sm text-slate-400 mt-2">${w.meaning}</p>
                    </div>
                </div>
            `;
            reviewState.flashTimeout = setTimeout(() => { if (reviewState) reviewAskInput(); }, reviewState.showMs);
        }

        function reviewAskInput() {
            if (!reviewState) return;
            const w = reviewState.current;
            const play = document.getElementById('review-play-area');
            play.innerHTML = `
                <div class="bg-white border border-slate-200 rounded-3xl p-6 space-y-5">
                    <div class="flex items-center justify-between">
                        <button onclick="resetReviewTab()" class="text-xs font-bold text-slate-400 hover:text-slate-600"><i class="fa-solid fa-arrow-left"></i> 나가기</button>
                        <span class="text-xs font-bold text-slate-500">${reviewState.index + 1} / ${reviewState.total}</span>
                    </div>
                    <div class="text-center py-6">
                        <p class="text-xs font-bold text-slate-400 mb-1">방금 본 단어를 써보세요!</p>
                        <p class="text-lg font-bold text-indigo-600">${w.meaning}</p>
                        <p id="review-feedback" class="text-sm font-bold mt-2 h-5"></p>
                    </div>
                    <input type="text" id="review-input" autocomplete="off" placeholder="스페인어 입력 후 Enter" class="w-full bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400">
                    <div class="flex gap-2">
                        <button onclick="reviewReveal()" class="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl text-sm font-bold transition-all">모르겠어요</button>
                        <button onclick="reviewSubmit()" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl text-sm font-bold transition-all">확인</button>
                    </div>
                </div>
            `;
            const input = document.getElementById('review-input');
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); reviewSubmit(); } });
            setTimeout(() => input.focus(), 50);
        }

        function reviewSubmit() {
            if (!reviewState || !reviewState.current) return;
            const input = document.getElementById('review-input');
            const userAnswer = input.value.trim();
            input.disabled = true;
            const w = reviewState.current;
            const isCorrect = userAnswer ? gameCheckAnswer(userAnswer, w.word) : false;
            const fb = document.getElementById('review-feedback');
            if (isCorrect) {
                reviewState.correct++;
                if (fb) { fb.innerText = "✓ 정답!"; fb.className = "text-sm font-bold mt-2 h-5 text-emerald-600"; }
                AudioFX.playSuccess();
            } else {
                if (fb) { fb.innerHTML = `정답: <b class="text-slate-800">${w.word}</b>`; fb.className = "text-sm font-bold mt-2 h-5 text-rose-500"; }
                AudioFX.playError();
            }
            reviewState.index++;
            logAction('review'); // [냐냐 PATCH] 제출한 단어 1개 = 복습 1개 기록
            setTimeout(() => { if (reviewState) reviewShowWord(); }, 1200);
        }

        function reviewReveal() {
            if (!reviewState || !reviewState.current) return;
            const fb = document.getElementById('review-feedback');
            const input = document.getElementById('review-input');
            if (input) input.disabled = true;
            if (fb) { fb.innerHTML = `정답: <b class="text-slate-800">${reviewState.current.word}</b>`; fb.className = "text-sm font-bold mt-2 h-5 text-slate-500"; }
            reviewState.index++;
            setTimeout(() => { if (reviewState) reviewShowWord(); }, 1400);
        }

        function reviewEnd() {
            const correct = reviewState ? reviewState.correct : 0;
            const total = reviewState ? reviewState.total : 0;
            reviewState = null;
            const play = document.getElementById('review-play-area');
            play.innerHTML = `
                <div class="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-4">
                    <div class="text-6xl">🎉</div>
                    <h3 class="text-xl font-black text-slate-900">복습 완료!</h3>
                    <p class="text-sm text-slate-500">${total}개 중 <b class="text-emerald-600">${correct}개</b> 기억했어요!</p>
                    <div class="flex gap-2 justify-center pt-2">
                        <button onclick="resetReviewTab()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all">다시 복습</button>
                    </div>
                </div>
            `;
        }

        // ============================================================
        // [냐냐 PATCH] 3차-① 단어 빈칸 채우기 복습 (AI 채점)
        //   단어 카드 전체를 보여주고 랜덤 1~2곳을 빈칸으로. 엔터로 칸 이동/채점/다음.
        // ============================================================
        let reviewMode = 'blink';          // 'blink' | 'fill'
        let fillScope = 'today-wrong';
        let fillCount = 10;
        let fillState = null;

        function selectReviewMode(mode) {
            reviewMode = mode;
            const blink = document.getElementById('review-mode-blink');
            const fill = document.getElementById('review-mode-fill');
            if (blink) blink.classList.toggle('hidden', mode !== 'blink');
            if (fill) fill.classList.toggle('hidden', mode !== 'fill');
            const bBtn = document.getElementById('review-mode-blink-btn');
            const fBtn = document.getElementById('review-mode-fill-btn');
            const on = 'bg-indigo-600 text-white shadow-sm';
            const off = 'text-slate-500 hover:bg-slate-50';
            [bBtn, fBtn].forEach(b => { if (b) b.className = b.className.replace(on, '').replace(off, ''); });
            if (bBtn) bBtn.className += ' ' + (mode === 'blink' ? on : off);
            if (fBtn) fBtn.className += ' ' + (mode === 'fill' ? on : off);
        }

        function resetFillSetup() {
            fillState = null;
            const setup = document.getElementById('fill-setup');
            const play = document.getElementById('fill-play-area');
            if (setup) setup.classList.remove('hidden');
            if (play) { play.classList.add('hidden'); play.innerHTML = ''; }
            selectFillScope(fillScope || 'today-wrong');
            selectFillCount(fillCount || 10);
        }

        function selectFillScope(scope) {
            fillScope = scope;
            document.querySelectorAll('.fill-scope-btn').forEach(btn => {
                const active = btn.dataset.fillScope === scope;
                btn.classList.toggle('border-indigo-500', active);
                btn.classList.toggle('bg-indigo-50', active);
                btn.classList.toggle('text-indigo-700', active);
                btn.classList.toggle('border-slate-200', !active);
                btn.classList.toggle('text-slate-600', !active);
            });
            const cnt = getReviewPool(scope).length;
            const el = document.getElementById('fill-scope-count');
            if (el) el.innerText = `복습할 단어: ${cnt}개`;
        }

        function selectFillCount(n) {
            fillCount = n;
            document.querySelectorAll('.fill-count-btn').forEach(btn => {
                const active = parseInt(btn.dataset.fillCount) === n;
                btn.classList.toggle('border-indigo-500', active);
                btn.classList.toggle('bg-indigo-50', active);
                btn.classList.toggle('text-indigo-700', active);
                btn.classList.toggle('border-slate-200', !active);
                btn.classList.toggle('text-slate-600', !active);
            });
        }

        function startFillReview() {
            const pool = getReviewPool(fillScope);
            if (pool.length < 1) { showToast("복습할 단어가 없어요! 다른 범위를 골라보세요.", "error"); return; }
            let shuffled = pool.slice().sort(() => Math.random() - 0.5).slice(0, fillCount);
            fillState = { pool: shuffled, index: 0, total: shuffled.length, results: [], current: null, phase: 'input' };
            document.getElementById('fill-setup').classList.add('hidden');
            document.getElementById('fill-play-area').classList.remove('hidden');
            renderFillProblem();
        }

        // 단어 하나에서 빈칸 낼 후보를 모아 랜덤 1~2곳 선택
        function buildFillProblem(w) {
            const idiomList = (w.idioms && w.idioms.length) ? w.idioms : (w.idiom ? [{ idiom: w.idiom, idiomMeaning: w.idiomMeaning || '' }] : []);
            const sources = [];
            if (w.word && w.meaning) {
                const side = Math.random() < 0.5 ? 'word' : 'meaning';
                sources.push(side === 'word'
                    ? { key: 'word', label: '단어', language: 'es', expected: w.word }
                    : { key: 'meaning', label: '뜻', language: 'ko', expected: w.meaning });
            }
            idiomList.forEach((id, i) => {
                const sp = (id.idiom || '').trim(); const me = (id.idiomMeaning || '').trim();
                if (sp && me) {
                    const side = Math.random() < 0.5 ? 'sp' : 'me';
                    sources.push(side === 'sp'
                        ? { key: 'idiom-sp-' + i, label: '관용구', language: 'es', expected: sp }
                        : { key: 'idiom-me-' + i, label: '관용구 뜻', language: 'ko', expected: me });
                }
            });
            const exSp = (w.example || '').trim(); const exMe = (w.exampleMeaning || '').trim();
            if (exSp && exMe) {
                const side = Math.random() < 0.5 ? 'sp' : 'me';
                sources.push(side === 'sp'
                    ? { key: 'ex-sp', label: '예문', language: 'es', expected: exSp }
                    : { key: 'ex-me', label: '예문 뜻', language: 'ko', expected: exMe });
            }
            // 후보가 하나도 없으면(뜻/단어 한쪽만 있는 특수 케이스) 있는 쪽이라도 빈칸
            if (sources.length === 0) {
                if (w.word) sources.push({ key: 'word', label: '단어', language: 'es', expected: w.word });
                else if (w.meaning) sources.push({ key: 'meaning', label: '뜻', language: 'ko', expected: w.meaning });
            }
            const shuffled = sources.slice().sort(() => Math.random() - 0.5);
            let n = 1;
            if (shuffled.length >= 2) n = Math.random() < 0.5 ? 1 : 2;
            const blanks = shuffled.slice(0, Math.max(1, Math.min(n, shuffled.length)));
            return { word: w, blanks };
        }

        function fillFieldHtml(problem, key, text, extraClass) {
            // 해당 key가 빈칸이면 input, 아니면 텍스트로 렌더
            const bi = problem.blanks.findIndex(b => b.key === key);
            if (bi >= 0) {
                return `<input id="fill-input-${bi}" type="text" autocomplete="off" onkeydown="fillInputKeydown(event, ${bi})" class="fill-input inline-block min-w-[120px] w-auto px-2 py-1 rounded-lg border-2 border-indigo-300 bg-indigo-50/40 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="?">`;
            }
            return `<span class="${extraClass || ''}">${escapeHtml(text || '')}</span>`;
        }

        function renderFillProblem() {
            if (!fillState) return;
            if (fillState.index >= fillState.pool.length) { endFillReview(); return; }
            fillState.phase = 'input';
            const w = fillState.pool[fillState.index];
            const problem = buildFillProblem(w);
            fillState.current = problem;
            const idiomList = (w.idioms && w.idioms.length) ? w.idioms : (w.idiom ? [{ idiom: w.idiom, idiomMeaning: w.idiomMeaning || '' }] : []);

            const posLabel = (typeof getPosAbbreviation === 'function') ? getPosAbbreviation(w.pos, w.gender) : (w.pos || '');
            let rows = '';
            // 단어 / 뜻
            rows += `<div class="flex items-baseline gap-2"><span class="text-[11px] font-bold text-slate-400 w-16 shrink-0">단어</span><span class="text-base font-extrabold text-slate-900">${fillFieldHtml(problem, 'word', w.word)}</span><span class="text-[10px] font-bold text-slate-400">${escapeHtml(posLabel)}</span></div>`;
            rows += `<div class="flex items-baseline gap-2"><span class="text-[11px] font-bold text-slate-400 w-16 shrink-0">뜻</span><span class="text-sm font-bold text-slate-700">${fillFieldHtml(problem, 'meaning', w.meaning)}</span></div>`;
            // 관용구
            idiomList.forEach((id, i) => {
                const sp = (id.idiom || '').trim(); const me = (id.idiomMeaning || '').trim();
                if (!sp && !me) return;
                rows += `<div class="flex items-baseline gap-2 pt-1"><span class="text-[11px] font-bold text-violet-400 w-16 shrink-0">관용구</span><div class="flex-1 space-y-0.5"><div class="text-sm font-bold text-slate-700">${fillFieldHtml(problem, 'idiom-sp-' + i, sp)}</div><div class="text-xs text-slate-500">${fillFieldHtml(problem, 'idiom-me-' + i, me)}</div></div></div>`;
            });
            // 예문
            const exSp = (w.example || '').trim(); const exMe = (w.exampleMeaning || '').trim();
            if (exSp || exMe) {
                rows += `<div class="flex items-baseline gap-2 pt-1"><span class="text-[11px] font-bold text-sky-400 w-16 shrink-0">예문</span><div class="flex-1 space-y-0.5"><div class="text-sm font-bold text-slate-700">${fillFieldHtml(problem, 'ex-sp', exSp)}</div><div class="text-xs text-slate-500">${fillFieldHtml(problem, 'ex-me', exMe)}</div></div></div>`;
            }
            // 노트 (문맥용, 빈칸 아님)
            if ((w.notes || '').trim()) {
                rows += `<div class="flex items-baseline gap-2 pt-1"><span class="text-[11px] font-bold text-slate-300 w-16 shrink-0">메모</span><span class="text-xs text-slate-400 whitespace-pre-line">${escapeHtml(w.notes)}</span></div>`;
            }

            const play = document.getElementById('fill-play-area');
            play.innerHTML = `
                <div class="bg-white border border-slate-200 rounded-3xl p-6 space-y-4">
                    <div class="flex items-center justify-between">
                        <button onclick="resetFillSetup()" class="text-xs font-bold text-slate-400 hover:text-slate-600"><i class="fa-solid fa-arrow-left"></i> 나가기</button>
                        <span class="text-xs font-bold text-slate-500">${fillState.index + 1} / ${fillState.total}</span>
                    </div>
                    <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div class="h-full bg-indigo-500 transition-all" style="width:${(fillState.index / fillState.total * 100)}%"></div>
                    </div>
                    <p class="text-[11px] font-bold text-indigo-400">✏️ 빈칸을 채워보세요 (엔터로 이동, 마지막 칸 엔터=채점)</p>
                    <div class="bg-slate-50 rounded-2xl p-4 space-y-2">${rows}</div>
                    <div id="fill-feedback" class="hidden space-y-2"></div>
                    <div class="flex justify-end">
                        <button id="fill-action-btn" onclick="submitFillProblem()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95">채점하기</button>
                    </div>
                </div>
            `;
            setTimeout(() => { const first = document.getElementById('fill-input-0'); if (first) first.focus(); }, 60);
        }

        function fillInputKeydown(e, idx) {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (fillState && fillState.phase === 'graded') { nextFillProblem(); return; }
            const total = fillState && fillState.current ? fillState.current.blanks.length : 0;
            if (idx < total - 1) {
                const next = document.getElementById('fill-input-' + (idx + 1));
                if (next) next.focus();
            } else {
                submitFillProblem();
            }
        }

        function fillLocalGrade(blank, ans) {
            const clean = s => (s || '').toString().toLowerCase().replace(/[\s.,!¡?¿;:"'()¿¡]/g, '');
            const u = clean(ans), ex = clean(blank.expected);
            if (!u) return false;
            if (blank.language === 'ko') return u === ex || ex.includes(u) || u.includes(ex);
            return u === ex; // 스페인어는 악센트 유지한 채 비교 (엄격)
        }

        async function submitFillProblem() {
            if (!fillState || !fillState.current || fillState.phase !== 'input') return;
            const blanks = fillState.current.blanks;
            const answers = blanks.map((b, i) => { const el = document.getElementById('fill-input-' + i); return el ? el.value.trim() : ''; });
            fillState.phase = 'grading';
            const actionBtn = document.getElementById('fill-action-btn');
            if (actionBtn) { actionBtn.disabled = true; actionBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> 채점 중...`; }

            let graded = null;
            if (typeof hasGeminiApiKey === 'function' && hasGeminiApiKey()) {
                try {
                    const items = blanks.map((b, i) => ({ index: i, language: b.language === 'es' ? 'Spanish' : 'Korean', field: b.label, expected: b.expected, studentAnswer: answers[i] }));
                    const system = `You grade fill-in-the-blank answers for a Korean student learning Spanish. Be fair but NOT lenient.
Rules:
- Spanish answers: accents and tildes MATTER (á é í ó ú ñ ü). Missing/wrong accent = INCORRECT. Ignore capitalization and surrounding punctuation/whitespace only.
- Korean (meaning) answers: accept if the meaning matches in substance (synonyms/paraphrases OK). Ignore particles, spacing, and punctuation. Do not demand exact wording.
- An empty answer is incorrect.
Return JSON only, no markdown.`;
                    const prompt = `Grade each blank. For each, the "expected" is the correct value from the flashcard and "studentAnswer" is what the student typed.\n${JSON.stringify(items)}\nReturn JSON: { "results": [ { "index": number, "correct": boolean, "correctAnswer": string } ] }`;
                    const schema = { type: "OBJECT", properties: { results: { type: "ARRAY", items: { type: "OBJECT", properties: { index: { type: "NUMBER" }, correct: { type: "BOOLEAN" }, correctAnswer: { type: "STRING" } }, required: ["index", "correct", "correctAnswer"] } } }, required: ["results"] };
                    const resp = await callGemini(prompt, system, schema, 'low');
                    const data = extractAndParseJson(resp);
                    graded = blanks.map((b, i) => {
                        const r = (data.results || []).find(x => x.index === i) || {};
                        return { correct: !!r.correct, correctAnswer: r.correctAnswer || b.expected };
                    });
                } catch (err) {
                    console.error(err);
                    showToast("AI 채점 실패 — 기본 채점으로 진행할게요", "error");
                }
            }
            if (!graded) {
                // API 키 없거나 실패 시 로컬 채점
                graded = blanks.map(b => ({ correct: fillLocalGrade(b, answers[blanks.indexOf(b)]), correctAnswer: b.expected }));
            }

            // 결과 저장 + 표시
            const detail = blanks.map((b, i) => ({ label: b.label, language: b.language, expected: b.expected, userAnswer: answers[i], correct: graded[i].correct, correctAnswer: graded[i].correctAnswer }));
            const allCorrect = detail.every(d => d.correct);
            fillState.results.push({ word: fillState.current.word, blanks: detail, allCorrect });
            if (typeof logAction === 'function') logAction('review'); // 복습 1개 기록

            applyFillGradeResults(detail);
            fillState.phase = 'graded';
        }

        function applyFillGradeResults(detail) {
            detail.forEach((d, i) => {
                const el = document.getElementById('fill-input-' + i);
                if (!el) return;
                el.disabled = true;
                el.classList.remove('border-indigo-300', 'bg-indigo-50/40');
                if (d.correct) el.classList.add('border-emerald-400', 'bg-emerald-50', 'text-emerald-700');
                else el.classList.add('border-red-400', 'bg-red-50', 'text-red-600', 'line-through');
            });
            const fb = document.getElementById('fill-feedback');
            if (fb) {
                fb.classList.remove('hidden');
                fb.innerHTML = detail.map(d => {
                    const icon = d.correct ? '<span class="text-emerald-500 font-black">✓</span>' : '<span class="text-red-500 font-black">✗</span>';
                    const ans = d.correct ? '' : ` <span class="text-slate-400">→ 정답:</span> <b class="text-slate-800">${escapeHtml(d.correctAnswer)}</b>`;
                    return `<div class="text-xs flex items-baseline gap-1.5"><span class="font-bold text-slate-400 shrink-0">${escapeHtml(d.label)}</span>${icon}<span class="text-slate-500">${escapeHtml(d.userAnswer || '(빈칸)')}</span>${ans}</div>`;
                }).join('');
            }
            const btn = document.getElementById('fill-action-btn');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = (fillState.index + 1 >= fillState.total) ? '결과 보기 →' : '다음 →';
                btn.setAttribute('onclick', 'nextFillProblem()');
                setTimeout(() => btn.focus(), 40); // 엔터 한 번 더 = 다음
            }
        }

        function nextFillProblem() {
            if (!fillState) return;
            fillState.index++;
            if (fillState.index >= fillState.pool.length) { endFillReview(); return; }
            renderFillProblem();
        }

        function endFillReview() {
            const results = fillState ? fillState.results : [];
            const total = results.length;
            const correct = results.filter(r => r.allCorrect).length;
            const studied = results.map(r => r.word);
            const masterCandidates = results.filter(r => r.allCorrect && r.word && !r.word.mastered).map(r => r.word);
            fillState = null;

            let listHtml = '';
            results.forEach(r => {
                const icon = r.allCorrect ? '<span class="text-emerald-500">✓</span>' : '<span class="text-red-400">✗</span>';
                listHtml += `<div class="flex items-baseline justify-between bg-white rounded-xl px-3 py-2 border border-slate-100"><span class="font-bold text-slate-800">${icon} ${escapeHtml(r.word.word)}</span><span class="text-slate-500 text-sm">${escapeHtml(r.word.meaning)}</span></div>`;
            });

            let masteryHtml = '';
            if (masterCandidates.length > 0) {
                masteryHtml = `
                    <div id="fill-mastery-box" class="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2 text-left">
                        <div class="flex items-center justify-between">
                            <p class="text-xs font-black text-emerald-700">🏆 다 맞힌 단어, 마스터로 등록할까요?</p>
                            <label class="text-[11px] font-bold text-emerald-600 flex items-center gap-1 cursor-pointer"><input type="checkbox" id="fill-master-all" onchange="fillMasterToggleAll(this)"> 전체</label>
                        </div>
                        <div class="space-y-1">${masterCandidates.map(w => `<label class="flex items-center gap-2 bg-white/70 rounded-lg px-2 py-1 cursor-pointer"><input type="checkbox" class="fill-master-chk" data-id="${w.id}"><span class="text-xs font-bold text-slate-700">${escapeHtml(w.word)}</span><span class="text-[11px] text-slate-400">${escapeHtml(w.meaning)}</span></label>`).join('')}</div>
                        <button onclick="applyFillMastery()" class="w-full mt-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-xs font-bold transition-all">선택 단어 마스터하기</button>
                    </div>`;
            }

            const play = document.getElementById('fill-play-area');
            play.innerHTML = `
                <div class="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-4">
                    <div class="text-6xl">${correct === total ? '🎉' : '💪'}</div>
                    <h3 class="text-xl font-black text-slate-900">빈칸 복습 완료!</h3>
                    <p class="text-sm text-slate-500">${total}문제 중 <b class="text-emerald-600">${correct}개</b> 다 맞혔어요! (정답률 ${total ? Math.round(correct / total * 100) : 0}%)</p>
                    ${masteryHtml}
                    <div class="text-left space-y-1.5 max-h-72 overflow-y-auto">
                        <p class="text-xs font-bold text-slate-500 mb-1">복습한 단어들</p>
                        ${listHtml}
                    </div>
                    <div class="flex gap-2 justify-center pt-2">
                        <button onclick="resetFillSetup()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all">다시 복습</button>
                    </div>
                </div>
            `;
            if (typeof updateStats === 'function') updateStats();
        }

        function fillMasterToggleAll(cb) {
            document.querySelectorAll('.fill-master-chk').forEach(c => { c.checked = cb.checked; });
        }
        function applyFillMastery() {
            const ids = [...document.querySelectorAll('.fill-master-chk:checked')].map(c => c.dataset.id);
            if (ids.length === 0) { showToast("선택된 단어가 없어요", "error"); return; }
            let n = 0;
            ids.forEach(id => { const w = vocabulary.find(v => v.id === id); if (w && !w.mastered) { w.mastered = true; if (typeof logAction === 'function') logAction('new-mastered'); n++; } });
            saveToStorage();
            if (typeof updateStats === 'function') updateStats();
            if (typeof renderWordList === 'function') renderWordList();
            showToast(`${n}개 마스터 완료! 🏆`, "success");
            document.getElementById('fill-mastery-box')?.classList.add('hidden');
        }
