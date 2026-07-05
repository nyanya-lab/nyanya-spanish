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
            ['rapidfire', 'flash', 'falling'].forEach(g => {
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
                // 정답: 약점 점수 -2, 마스터 점수 +1 (상한 8)
                w.weakScore = Math.max(0, (w.weakScore || 0) - 2);
                if (w.weakScore < 5) w.weak = false;
                w.masterScore = Math.min(8, (w.masterScore || 0) + 1);
                // 게임은 객관식 성격이라 자동 마스터의 '주관식 통과' 조건은 못 채움 (subjectivePassed 안 건드림)
                if (!w.mastered && w.masterScore >= 5 && w.subjectivePassed) {
                    w.mastered = true;
                }
            } else {
                // 오답: 게임은 시간에 쫓겨 못 맞추기도 하니 약하게 감점 (약점 +1, 마스터 -1)
                w.weakScore = (w.weakScore || 0) + 1;
                w.lastWrongDate = getLocalDateString(); // [냐냐 PATCH] 오늘 틀림 기록
                if (w.weakScore >= 5) w.weak = true;
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
                if (bar) bar.style.width = (gameState.timeLeft / 60 * 100) + '%';
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
                if (fb) { fb.innerText = `+${points}점! ${gameState.combo >= 3 ? '🔥 ' + gameState.combo + ' 콤보!' : '✓'}`; fb.className = "text-sm font-bold mt-2 h-5 text-emerald-600"; }
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
            // 학습일지에 게임도 학습 활동으로 기록 (퀴즈처럼)
            try { if (typeof logAction === 'function') logAction('snapshot'); } catch (e) {}
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

        // ============================================================
        // 게임 2, 3 자리 (다음 배치에서 구현)
        // ============================================================
        function startFlashMemory() {
            const pool = getGameWordPool();
            if (pool.length < 4) {
                showToast("게임하려면 단어가 4개 이상 있어야 해요!", "error");
                return;
            }
            stopCurrentGame();
            gameState = {
                type: 'flash',
                pool: pool,
                round: 0,
                score: 0,
                correct: 0,
                wrong: 0,
                lives: 3,
                current: null,
                flashMs: 2000, // 처음엔 2초, 점점 짧아짐
                flashTimeout: null
            };
            flashMemoryNextRound();
        }

        function flashMemoryNextRound() {
            if (!gameState) return;
            gameState.round++;
            gameState.current = gameState.pool[Math.floor(Math.random() * gameState.pool.length)];
            // 라운드가 올라갈수록 보여주는 시간 감소 (최소 0.8초)
            const showMs = Math.max(800, gameState.flashMs - (gameState.round - 1) * 100);

            // 1단계: 단어를 잠깐 보여줌
            showGamePlayArea(`
                <div class="bg-white border border-slate-200 rounded-3xl p-6 space-y-5">
                    <div class="flex items-center justify-between">
                        <button onclick="resetGamesMenu()" class="text-xs font-bold text-slate-400 hover:text-slate-600"><i class="fa-solid fa-arrow-left"></i> 나가기</button>
                        <div class="flex items-center gap-3">
                            <span class="text-xs font-bold text-slate-500">라운드 <span class="text-indigo-600 text-base">${gameState.round}</span></span>
                            <span class="text-xs font-bold text-slate-500">점수 <span class="text-indigo-600 text-base">${gameState.score}</span></span>
                            <span class="text-xs font-bold text-rose-400">${'❤️'.repeat(gameState.lives)}</span>
                        </div>
                    </div>
                    <div class="text-center py-10">
                        <p class="text-xs font-bold text-indigo-400 mb-3">👁️ 잘 기억하세요!</p>
                        <p id="flash-word" class="text-4xl font-black text-slate-900 transition-opacity duration-300">${gameState.current.word}</p>
                        <p class="text-sm text-slate-400 mt-2">${gameState.current.meaning}</p>
                    </div>
                </div>
            `);

            // 2단계: showMs 후에 단어를 숨기고 입력 받기
            gameState.flashTimeout = setTimeout(() => {
                if (!gameState) return;
                flashMemoryAskInput();
            }, showMs);
        }

        function flashMemoryAskInput() {
            if (!gameState) return;
            showGamePlayArea(`
                <div class="bg-white border border-slate-200 rounded-3xl p-6 space-y-5">
                    <div class="flex items-center justify-between">
                        <button onclick="resetGamesMenu()" class="text-xs font-bold text-slate-400 hover:text-slate-600"><i class="fa-solid fa-arrow-left"></i> 나가기</button>
                        <div class="flex items-center gap-3">
                            <span class="text-xs font-bold text-slate-500">라운드 <span class="text-indigo-600 text-base">${gameState.round}</span></span>
                            <span class="text-xs font-bold text-slate-500">점수 <span class="text-indigo-600 text-base">${gameState.score}</span></span>
                            <span class="text-xs font-bold text-rose-400">${'❤️'.repeat(gameState.lives)}</span>
                        </div>
                    </div>
                    <div class="text-center py-6">
                        <p class="text-xs font-bold text-slate-400 mb-1">방금 본 단어를 입력하세요!</p>
                        <p class="text-lg font-bold text-indigo-600">${gameState.current.meaning}</p>
                        <p id="flash-feedback" class="text-sm font-bold mt-2 h-5"></p>
                    </div>
                    <input type="text" id="flash-input" autocomplete="off" placeholder="스페인어 입력 후 Enter" class="w-full bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400">
                    <button onclick="flashMemorySubmit()" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl text-sm font-bold transition-all">확인</button>
                </div>
            `);
            const input = document.getElementById('flash-input');
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); flashMemorySubmit(); }
            });
            setTimeout(() => input.focus(), 50);
        }

        function flashMemorySubmit() {
            if (!gameState || !gameState.current) return;
            const input = document.getElementById('flash-input');
            const userAnswer = input.value.trim();
            input.disabled = true;

            const isCorrect = userAnswer ? gameCheckAnswer(userAnswer, gameState.current.word) : false;
            // [냐냐 PATCH] 깜빡이 게임은 복습용이라 마스터/약점 점수에 반영하지 않음
            const fb = document.getElementById('flash-feedback');
            if (isCorrect) {
                gameState.correct++;
                gameState.score += 10 + gameState.round; // 라운드 보너스
                if (fb) { fb.innerText = "✓ 정답!"; fb.className = "text-sm font-bold mt-2 h-5 text-emerald-600"; }
                AudioFX.playSuccess();
            } else {
                gameState.wrong++;
                gameState.lives--;
                if (fb) { fb.innerText = `✗ 정답: ${gameState.current.word}`; fb.className = "text-sm font-bold mt-2 h-5 text-rose-500"; }
                AudioFX.playError();
            }
            // 다음 라운드 또는 게임 종료
            setTimeout(() => {
                if (!gameState) return;
                if (gameState.lives <= 0) {
                    flashMemoryEnd();
                } else {
                    flashMemoryNextRound();
                }
            }, 1200);
        }

        function flashMemoryEnd() {
            if (!gameState) return;
            const score = gameState.score;
            const round = gameState.round;
            const correct = gameState.correct;
            stopCurrentGame();
            try { if (typeof logAction === 'function') logAction('snapshot'); } catch (e) {}
            const isNewRecord = setGameHighScore('flash', score);
            const highScore = getGameHighScore('flash');
            try { if (typeof saveToStorage === 'function') saveToStorage(); } catch (e) {}
            showGamePlayArea(`
                <div class="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-4">
                    <div class="text-6xl">👁️</div>
                    <h3 class="text-xl font-black text-slate-900">게임 종료!</h3>
                    <p class="text-4xl font-black text-indigo-600">${score}점</p>
                    ${isNewRecord ? '<p class="text-sm font-black text-amber-500">🎉 최고 기록 갱신!</p>' : `<p class="text-xs font-bold text-slate-400">최고 기록: ${highScore}점</p>`}
                    <div class="flex justify-center gap-6 text-sm">
                        <span class="text-slate-500">도달 라운드 <b class="text-indigo-600">${round}</b></span>
                        <span class="text-slate-500">맞힌 단어 <b class="text-emerald-600">${correct}</b></span>
                    </div>
                    <div class="flex gap-2 justify-center pt-2">
                        <button onclick="startFlashMemory()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all">다시 하기</button>
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
            try { if (typeof logAction === 'function') logAction('snapshot'); } catch (e) {}
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
        function speakSpanish(text) {
            if (!('speechSynthesis' in window)) {
                showToast("이 브라우저는 음성 합성을 지원하지 않아요.", "error");
                return;
            }
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'es-ES';
            u.rate = 0.9;
            window.speechSynthesis.speak(u);
        }

        function startListeningQuiz() {
            // 예문이 있는 단어만 사용
            const pool = vocabulary.filter(w => w.example && w.example.trim().length > 0);
            if (pool.length < 1) {
                showToast("예문이 있는 단어가 없어요! 단어에 예문을 추가해 주세요.", "error");
                return;
            }
            stopCurrentGame();
            gameState = { type: 'listening', pool, index: 0, correct: 0, total: 0, current: null };
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
                        <span class="text-xs font-bold text-slate-500">${gameState.total}번째 · 맞힌 문장 <span class="text-sky-600">${gameState.correct}</span></span>
                    </div>
                    <div class="text-center py-6 space-y-4">
                        <p class="text-xs font-bold text-sky-400">🎧 예문을 듣고 똑같이 써보세요!</p>
                        <button onclick="speakSpanish(gameState.current.example)" class="bg-sky-500 hover:bg-sky-600 text-white w-16 h-16 rounded-full text-2xl shadow-lg shadow-sky-100 transition-all active:scale-90">
                            <i class="fa-solid fa-volume-high"></i>
                        </button>
                        <p class="text-xs text-slate-400">다시 들으려면 스피커를 눌러요</p>
                        <p id="listen-feedback" class="text-sm font-bold h-5"></p>
                    </div>
                    <textarea id="listen-input" rows="2" placeholder="들은 문장을 입력하세요..." class="w-full bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 text-center text-base font-semibold focus:outline-none focus:ring-2 focus:ring-sky-400"></textarea>
                    <button onclick="listeningSubmit()" class="w-full bg-sky-600 hover:bg-sky-700 text-white py-3 rounded-xl text-sm font-bold transition-all">확인</button>
                </div>
            `);
            // 자동으로 한 번 읽어주기
            setTimeout(() => { speakSpanish(gameState.current.example); document.getElementById('listen-input')?.focus(); }, 300);
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
            // 다음 문장 버튼 표시
            const playArea = document.getElementById('game-play-area');
            const nextBtnHtml = `
                <div class="flex gap-2 justify-center pt-3">
                    <button onclick="listeningNext()" class="bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all">다음 문장</button>
                    <button onclick="resetGamesMenu()" class="bg-slate-100 hover:bg-slate-200 text-slate-600 px-5 py-2.5 rounded-xl text-sm font-bold transition-all">그만하기</button>
                </div>`;
            // 확인 버튼을 다음 버튼으로 교체
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

        function resetReviewTab() {
            reviewState = null;
            const setup = document.getElementById('review-setup');
            const play = document.getElementById('review-play-area');
            if (setup) setup.classList.remove('hidden');
            if (play) { play.classList.add('hidden'); play.innerHTML = ''; }
            // 기본 선택: 오늘 틀린 단어
            selectReviewScope(reviewScope || 'today-wrong');
        }

        function getReviewPool(scope) {
            const today = getLocalDateString();
            if (scope === 'today-wrong') return vocabulary.filter(w => w.lastWrongDate === today && !w.mastered);
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
            // 순서 섞기
            const shuffled = pool.slice().sort(() => Math.random() - 0.5);
            reviewState = { pool: shuffled, index: 0, correct: 0, total: shuffled.length, showMs: 1800 };
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
