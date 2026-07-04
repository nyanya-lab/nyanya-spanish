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
            return normalizeSpanishAnswer(userRaw) === normalizeSpanishAnswer(correct);
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
            if (qEl) qEl.innerText = gameState.current.meaning;
            const input = document.getElementById('rf-input');
            if (input) { input.value = ''; input.focus(); }
        }

        function rapidFireSubmit() {
            if (!gameState || !gameState.current) return;
            const input = document.getElementById('rf-input');
            const fb = document.getElementById('rf-feedback');
            const userAnswer = input.value.trim();
            if (!userAnswer) return;

            const isCorrect = gameCheckAnswer(userAnswer, gameState.current.word);
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
            showGamePlayArea(`
                <div class="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-4">
                    <div class="text-6xl">⚡</div>
                    <h3 class="text-xl font-black text-slate-900">시간 종료!</h3>
                    <p class="text-4xl font-black text-rose-600">${finalScore}점</p>
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
            showToast("깜빡이 기억 게임은 곧 추가돼요! ⏳", "info");
        }
        function startFallingWords() {
            showToast("떨어지는 단어 게임은 곧 추가돼요! ⏳", "info");
        }


