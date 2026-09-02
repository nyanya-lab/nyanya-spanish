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

        // [냐냐 요청] 빈칸 채점 결과 줄에서 틀린 글자만 빨갛게.
        //   철자를 흘린 경우에만 칠한다 — 아예 다른 답이면 전부 빨개져서 오히려 안 보인다.
        //   퀴즈·쓰기 복습이 쓰는 것과 같은 잣대(looksLikeSpellMiss)를 쓴다.
        function blankDiffHtml(userRaw, correctRaw) {
            const user = String(userRaw || '').trim();
            if (!user || typeof looksLikeSpellMiss !== 'function' || typeof charDiffOps !== 'function') return null;
            if (!looksLikeSpellMiss(user, correctRaw)) return null;
            const target = typeableForm(correctRaw) || String(correctRaw || '');
            const ops = charDiffOps(typeableForm(user) || user, target);
            return { mine: renderCharDiff(ops, 'user'), answer: renderCharDiff(ops, 'correct') };
        }

        // 정답 비교 — 관사는 관용, 악센트는 엄격 [냐냐 요청]
        //   퀴즈 주관식·쓰기 복습·활용형과 같은 잣대다. 악센트도 철자의 일부다.
        function gameCheckAnswer(userRaw, correct) {
            const norm = (s) => normalizeSpanishAnswer(s, true);
            const stripArticle = (s) => norm(s).replace(/^(el\/la|los\/las|un\/una|el|la|los|las|un|una|unos|unas)\s+/i, '');
            // 관사 포함/미포함 둘 다 정답 인정 (힌트가 관사를 뗀 앞글자를 주므로)
            return norm(userRaw) === norm(correct)
                || stripArticle(userRaw) === stripArticle(correct);
        }

        // [냐냐 PATCH] 동의어 방지용 시작 글자 힌트 (앞 2글자) — 게임 item 2
        function gameStartHint(word) {
            if (!word) return '';
            let clean = word.trim();
            // [냐냐 요청] 정관사/부정관사 제거 강화: el/la 합쳐진 경우(el/la, los/las 등)도 처리
            //   gameCheckAnswer와 동일한 규칙으로 맞춤
            clean = clean.replace(/^(el\/la|los\/las|un\/una|el|la|los|las|un|una|unos|unas)\s+/i, '');
            const n = Math.min(2, clean.length);
            return clean.slice(0, n);
        }

        // [냐냐 PATCH-0배치] 게임 결과를 통합 점수(score)에 반영
        //   [냐냐 요청] 속사포·떨어지는 단어 둘 다 정답 +0.8로 통일
        //   속사포: 정답 +0.8 / 오답 -1
        //   떨어지는 단어: 정답 +0.8 / 바닥까지 놓치면 -0.5 (틀린 입력은 판정 없음)
        //   듣기 받아쓰기: 문장 단위라 단어 점수 반영 없음
        //   게임 정답만으로는 마스터 못 뚫음 (주관식 정답 경험이 있어야 마스터)
        const GAME_SCORE = {
            rapid: { correct: 0.8, wrong: -1 },
            // [냐냐 요청] 떨어지는 단어도 벌점을 준다. 예전엔 0 이라 이 게임만 반복하면
            //   점수가 손해 없이 계속 올랐다 (유일하게 잃을 게 없는 경로였다).
            fall:  { correct: 0.8, wrong: -0.5 }
        };
        function applyGameScore(wordId, isCorrect, gameType = 'rapid') {
            const rule = GAME_SCORE[gameType] || GAME_SCORE.rapid;
            const delta = isCorrect ? rule.correct : rule.wrong;
            addWordScore(wordId, delta, { correct: !!isCorrect });
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
        // [냐냐 요청] 역대기록을 동기화 대상에 포함시키기 위한 수집/병합.
        //   기록은 원래 localStorage 에만 있어서 기기마다 따로 놀았다. 서버에 올려 합치되,
        //   합칠 때는 항상 '큰 값'을 남긴다 — 먼저 저장한 기기가 상대 기록을 지우면 안 되니까.
        const GAME_TYPES = ['rapidfire', 'falling'];
        function collectGameHighScores() {
            const out = {};
            GAME_TYPES.forEach(g => {
                const all = getGameHighScore(g);
                let week = null;
                try {
                    const raw = localStorage.getItem('nyanya_game_whs_' + g);
                    if (raw) week = JSON.parse(raw);
                } catch (e) {}
                if (all || week) out[g] = { all: all || 0, week: week || null };
            });
            return out;
        }
        function mergeGameHighScores(remote) {
            if (!remote || typeof remote !== 'object') return;
            GAME_TYPES.forEach(g => {
                const r = remote[g];
                if (!r) return;
                // 역대: 큰 쪽을 남긴다
                if ((r.all || 0) > getGameHighScore(g)) {
                    try { localStorage.setItem('nyanya_game_hs_' + g, String(r.all)); } catch (e) {}
                }
                // 이번 주: 같은 주차일 때만, 그리고 큰 쪽을 남긴다
                if (r.week && r.week.week === getWeekKey() && (r.week.score || 0) > getGameWeekHighScore(g)) {
                    try { localStorage.setItem('nyanya_game_whs_' + g, JSON.stringify(r.week)); } catch (e) {}
                }
            });
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
            let changed = isNewAllTime;
            if (score > weekPrev) {
                try { localStorage.setItem('nyanya_game_whs_' + gameType, JSON.stringify({ week: getWeekKey(), score })); } catch (e) {}
                changed = true;
            }
            // [냐냐 요청] 기록이 바뀌면 여기서 바로 저장한다.
            //   호출부는 logAction('game')(=저장)을 이 함수보다 '먼저' 부르기 때문에,
            //   여기서 저장하지 않으면 새 기록이 다음 저장 때까지 서버에 안 올라간다.
            if (changed && typeof saveToStorage === 'function') saveToStorage();
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

            // [냐냐 요청] 유의어도 정답 처리: 입력한 단어가 단어장에 있고 뜻이 같으면 정답
            let isCorrect = userAnswer ? gameCheckAnswer(userAnswer, gameState.current.word) : false;
            if (!isCorrect && userAnswer && typeof meaningsOverlap === 'function') {
                const un = normalizeSpanishAnswer(userAnswer);
                const syn = vocabulary.find(w => normalizeSpanishAnswer(w.word) === un
                    && meaningsOverlap(w.meaning, gameState.current.meaning));
                if (syn) isCorrect = true;
            }
            applyGameScore(gameState.current.id, isCorrect, 'rapid'); // [0배치] 속사포: 정답 +0.5 / 오답 -1
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
                // [냐냐 PATCH-2차잔여] 틀린 단어 기록 → 결과 화면에서 복습용으로 보여줌
                if (!gameState.wrongIds) gameState.wrongIds = [];
                if (!gameState.wrongIds.includes(gameState.current.id)) gameState.wrongIds.push(gameState.current.id);
                // [냐냐 요청] 악센트를 엄격하게 봤으니 어디가 틀렸는지도 같이 보여준다
                if (fb) {
                    const df = blankDiffHtml(userAnswer, gameState.current.word);
                    fb.innerHTML = df ? `✗ ${df.mine} → <b>${df.answer}</b>` : `✗ 정답: ${escapeHtml(gameState.current.word)}`;
                    fb.className = "text-sm font-bold mt-2 h-5 text-rose-500";
                }
                AudioFX.playError();
            }
            const scoreEl = document.getElementById('rf-score');
            const comboEl = document.getElementById('rf-combo');
            if (scoreEl) scoreEl.innerText = gameState.score;
            if (comboEl) comboEl.innerText = gameState.combo;
            rapidFireNext();
        }

        // [냐냐 PATCH-2차잔여] 게임 결과 화면의 '틀린 단어' 목록 — 유의어/반의어까지 같이 보여줌
        function buildGameWrongListHtml(wrongIds) {
            if (!wrongIds || wrongIds.length === 0) return '';
            const cards = wrongIds.map(id => {
                const w = vocabulary.find(v => v.id === id);
                if (!w) return '';
                const syn = (typeof buildSynonymChipsHtml === 'function') ? buildSynonymChipsHtml(w) : '';
                return `
                <div class="bg-white border border-slate-200 rounded-2xl p-3 text-left space-y-2">
                    <div class="flex items-baseline gap-2 flex-wrap">
                        <button type="button" onclick="goToWord('${w.id}')" class="text-base font-black text-slate-900 hover:text-violet-600 transition-colors">${escapeHtml(w.word)}</button>
                        <span class="text-sm text-slate-500 font-semibold">${escapeHtml(w.meaning || '')}</span>
                    </div>
                    ${syn}
                </div>`;
            }).filter(Boolean).join('');
            if (!cards) return '';
            return `
                <div class="pt-3 border-t border-slate-100 space-y-2 text-left">
                    <p class="text-xs font-black text-rose-500">✗ 틀린 단어 ${wrongIds.length}개 — 다시 한 번 보고 가요!</p>
                    <div class="space-y-2 max-h-64 overflow-y-auto">${cards}</div>
                </div>`;
        }

        function rapidFireEnd() {
            if (!gameState) return;
            const finalScore = gameState.score;
            const correct = gameState.correct;
            const wrong = gameState.wrong;
            const maxCombo = gameState.maxCombo;
            const wrongIds = gameState.wrongIds ? [...gameState.wrongIds] : [];
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
                    ${buildGameWrongListHtml(wrongIds)}
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
                    <div id="fall-area" class="relative bg-gradient-to-b from-sky-50 to-emerald-50 border border-slate-100 rounded-2xl overflow-hidden" style="height: min(68vh, 640px); min-height: 480px;">
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
                    // [냐냐 요청] 바닥까지 떨어뜨린 단어에 벌점 (-0.5).
                    //   틀린 입력에는 점수를 못 매긴다 — 어느 단어를 겨냥한 건지 알 수 없어서다.
                    //   놓친 건 어느 단어인지 분명하므로 여기서만 준다.
                    applyGameScore(it.id, false, 'fall');
                    // [냐냐 요청] 놓친 단어 기록 (결과 화면 표시용)
                    if (!gameState.missedIds) gameState.missedIds = [];
                    if (!gameState.missedIds.includes(it.id)) gameState.missedIds.push(it.id);
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
                applyGameScore(it.id, true, 'fall'); // 떨어지는 단어: 정답 +0.8
                gameState.score += 10;
                gameState.correct++;
                // [냐냐 요청] 맞춘 단어 기록 (결과 화면 표시용)
                if (!gameState.correctIds) gameState.correctIds = [];
                if (!gameState.correctIds.includes(it.id)) gameState.correctIds.push(it.id);
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
            // [냐냐 요청] stopCurrentGame 전에 맞춘/놓친 단어 ID 확보
            const correctIds = (gameState.correctIds || []).slice();
            const missedIds = (gameState.missedIds || []).slice();
            stopCurrentGame();
            try { if (typeof logAction === 'function') logAction('game'); } catch (e) {} // [냐냐 PATCH] 게임 1판 완료
            const isNewRecord = setGameHighScore('falling', score);
            const highScore = getGameHighScore('falling');
            try { if (typeof saveToStorage === 'function') saveToStorage(); } catch (e) {}
            // [냐냐 요청] 맞춘/놓친 단어를 칩으로 렌더
            const idToChip = (id, kind) => {
                const w = vocabulary.find(v => v.id === id);
                if (!w) return '';
                const color = kind === 'ok'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-600 border-rose-200';
                return `<span class="inline-block px-2 py-0.5 rounded-lg border ${color} text-xs font-bold m-0.5">${w.word} <span class="opacity-60">${w.meaning}</span></span>`;
            };
            let wordSummary = '';
            if (correctIds.length || missedIds.length) {
                wordSummary = '<div class="text-left space-y-3 pt-2">';
                if (correctIds.length) {
                    wordSummary += `<div><p class="text-xs font-black text-emerald-600 mb-1">✓ 맞힌 단어 (${correctIds.length})</p><div>${correctIds.map(id => idToChip(id, 'ok')).join('')}</div></div>`;
                }
                if (missedIds.length) {
                    wordSummary += `<div><p class="text-xs font-black text-rose-500 mb-1">✗ 놓친 단어 (${missedIds.length})</p><div>${missedIds.map(id => idToChip(id, 'miss')).join('')}</div></div>`;
                }
                wordSummary += '</div>';
            }
            showGamePlayArea(`
                <div class="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-4">
                    <div class="text-6xl">🌧️</div>
                    <h3 class="text-xl font-black text-slate-900">게임 종료!</h3>
                    <p class="text-4xl font-black text-emerald-600">${score}점</p>
                    ${isNewRecord ? '<p class="text-sm font-black text-amber-500">🎉 최고 기록 갱신!</p>' : `<p class="text-xs font-bold text-slate-400">최고 기록: ${highScore}점</p>`}
                    <p class="text-sm text-slate-500">맞힌 단어 <b class="text-emerald-600">${correct}</b>개</p>
                    ${wordSummary}
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
                    <!-- [냐냐 PATCH-2차잔여] 확인 후 이 문장의 단어 정보(유의어 포함) -->
                    <div id="listen-detail-box" class="hidden"></div>
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

            // 문장 비교 — 문장부호·대소문자는 관대, 악센트는 엄격 [냐냐 요청]
            //   NFC 로 모양을 통일한다 (normalizeSpanishAnswer 와 같은 이유 — 분해형 á 를 오답으로 보면 안 된다)
            const norm = (s) => String(s || '').toLowerCase().normalize('NFC')
                .replace(/[.,!?¿¡;:"'()]/g, '').replace(/\s+/g, ' ').trim();
            const correct = gameState.current.example;
            const isCorrect = norm(userText) === norm(correct);

            if (isCorrect) {
                gameState.correct++;
                if (fb) { fb.innerText = "✓ 완벽해요!"; fb.className = "text-sm font-bold h-5 text-emerald-600"; }
                AudioFX.playSuccess();
            } else {
                if (fb) {
                    const df = blankDiffHtml(userText, correct);
                    fb.innerHTML = df ? `✗ ${df.mine} → <span class="text-slate-700">${df.answer}</span>`
                                      : `✗ 정답: <span class="text-slate-700">${escapeHtml(correct)}</span>`;
                    fb.className = "text-sm font-bold h-5 text-rose-500";
                }
                AudioFX.playError();
            }

            // [냐냐 PATCH-2차잔여] 정답/오답 상관없이, 이 문장이 나온 단어의 정보를 보여줌 (유의어 포함)
            const detailBox = document.getElementById('listen-detail-box');
            if (detailBox && gameState.current) {
                const w = gameState.current;
                const badges = (typeof buildWordBadgesHtml === 'function') ? buildWordBadgesHtml(w) : '';
                const notes = (typeof buildNotesHtml === 'function') ? buildNotesHtml(w, {}) : '';
                const parts = [badges, notes].filter(x => x && x.trim());
                detailBox.classList.remove('hidden');
                detailBox.innerHTML = `
                    <div class="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1 leading-relaxed text-left">
                        <div class="text-center pb-2">
                            <p class="text-[10px] font-black text-sky-500 uppercase tracking-wider mb-1">이 문장의 단어</p>
                            <button type="button" onclick="goToWord('${w.id}')" class="text-xl font-black text-slate-900 hover:text-violet-600 transition-colors">${escapeHtml(w.word)}</button>
                            <p class="text-sm text-slate-500">${escapeHtml(w.meaning || '')}</p>
                        </div>
                        ${parts.length ? '<div class="border-t border-slate-200 my-2"></div>' + parts.join('<div class="border-t border-slate-100 my-3"></div>') : ''}
                    </div>`;
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
        // 복습 탭 공통
        //   [냐냐 요청] 깜빡이 모드는 없앴다. 맞혀도 망각곡선이 안 도는데 틀리면 리셋만 돼서
        //   (곡선을 앞으로는 못 돌리고 뒤로만 돌림) 복습 일정을 조용히 되돌리고 있었다.
        // ============================================================
        function resetReviewTab() {
            // [냐냐 PATCH] 빈칸 채우기 모드도 초기화 + 서브메뉴(모드) 반영
            if (typeof resetFillSetup === 'function') resetFillSetup();
            if (typeof resetGrammarFillSetup === 'function') resetGrammarFillSetup();
            // [냐냐 요청] 쓰기 모드 설정도 초기화 + 기본 모드는 쓰기
            if (typeof resetWriteSetup === 'function') resetWriteSetup();
            if (typeof selectReviewMode === 'function') selectReviewMode(reviewMode || 'write');
        }

        // 빈칸 채우기(fill)도 이 풀을 쓰므로 깜빡이를 없애도 남겨둔다.
        function getReviewPool(scope) {
            // [냐냐 PATCH] '오늘 복습' = 망각곡선 복습 대상 (오늘 틀린 것 + 1·3·7·14·30일 주기)
            if (scope === 'today-wrong') return getReviewDueWords();
            if (scope === 'weak') return vocabulary.filter(w => w.weak && !w.mastered);
            if (scope === 'not-mastered') return vocabulary.filter(w => !w.mastered);
            return vocabulary.slice(); // all
        }

        // ============================================================
        // [냐냐 PATCH] 3차-① 단어 빈칸 채우기 복습 (AI 채점)
        //   단어 카드 전체를 보여주고 랜덤 1~2곳을 빈칸으로. 엔터로 칸 이동/채점/다음.
        // ============================================================
        // [냐냐 요청] 처음 들어오거나 새로고침하면 항상 '쓰기'. 세션 중에는 마지막에 보던 모드를 기억함
        //   (localStorage에 저장하지 않으므로 새로고침하면 자동으로 'write'로 돌아감)
        let reviewMode = 'write';          // 'write' | 'fill' | 'gfill'
        let fillScope = 'not-mastered'; // [냐냐 요청] 기본: 마스터 안 된 단어
        let fillCount = 5; // [냐냐 요청] 단어빈칸 기본 5개
        let fillState = null;

        function selectReviewMode(mode) {
            // [냐냐 PATCH-4배치] '퀴즈'는 별도 탭 → 탭 전환만 하고 끝
            if (mode === 'quiz') {
                if (typeof changeTab === 'function') changeTab('quiz');
                return;
            }
            // 퀴즈 탭에서 복습 서브메뉴를 누른 경우 → 복습 탭으로 되돌아옴
            if (typeof activeTab !== 'undefined' && activeTab === 'quiz' && typeof changeTab === 'function') {
                changeTab('review');
            }
            reviewMode = mode;
            const containers = { fill: 'review-mode-fill', gfill: 'review-mode-gfill', write: 'review-mode-write', vconj: 'review-mode-vconj' };
            Object.entries(containers).forEach(([m, id]) => { const el = document.getElementById(id); if (el) el.classList.toggle('hidden', m !== mode); });
            // [냐냐 PATCH] 퀴즈 버튼도 목록에 포함 (빠져 있어서 혼자 글씨색이 달랐음)
            const btns = { fill: 'review-mode-fill-btn', gfill: 'review-mode-gfill-btn', quiz: 'review-mode-quiz-btn', write: 'review-mode-write-btn', vconj: 'review-mode-vconj-btn' };
            const on = 'bg-indigo-600 text-white shadow-sm';
            const off = 'text-slate-500 hover:bg-slate-50';
            if (mode === 'vconj' && !vconjState) renderVconjSetup();   // 설정 화면을 그려 둔다
            Object.entries(btns).forEach(([m, id]) => {
                const b = document.getElementById(id); if (!b) return;
                b.className = b.className.replace(on, '').replace(off, '').replace(/\s+/g, ' ').trim();
                b.className += ' ' + (m === mode ? on : off);
            });
        }

        // ============================================================
        // [냐냐 요청] 동사 변형 연습 (2026-09-02)
        //   뜻만 보고 내가 고른 시제를 한 화면에 전부 채운다. 원형은 숨긴다 —
        //   원형이 보이면 규칙만 대입하게 되고, 그건 이미 문법표 빈칸이 하는 일이다.
        //   채점은 로컬로 끝낸다. 활용형은 정답이 하나라 AI 를 부를 이유가 없다
        //   (악센트는 엄격 — 퀴즈·단어 빈칸과 같은 잣대).
        //   점수는 그 동사에 한 번, 정답률로. 곡선은 새로 만들지 않는다 —
        //   틀리면 단어 곡선에 들여놓기만 하고 칸은 '오늘의 복습' 에서만 움직인다.
        // ============================================================
        let vconjState = null;
        let vconjTenses = ['presente'];     // 고른 시제
        let vconjScope = 'all';             // all | weak | notMastered
        let vconjCount = 20;

        const VCONJ_PERSONS = [
            { key: 'yo', label: 'yo' }, { key: 'tu', label: 'tú' }, { key: 'el', label: 'él/ella' },
            { key: 'nos', label: 'nosotros' }, { key: 'vos', label: 'vosotros' }, { key: 'ellos', label: 'ellos/ellas' }
        ];
        const VCONJ_SCOPES = [{ key: 'all', label: '전체' }, { key: 'weak', label: '약점만' }, { key: 'notMastered', label: '미마스터' }];
        const VCONJ_COUNTS = [10, 20, 30, 0];   // 0 = 전부

        function vconjTenseOptions() {
            return (typeof TENSE_TYPE_OPTIONS !== 'undefined') ? TENSE_TYPE_OPTIONS : [{ key: 'presente', label: '직설법 현재' }];
        }
        // 그 시제가 채워져 있는 동사만 — 없는 시제를 물어볼 수는 없다
        function vconjVerbsFor(tense) {
            return (vocabulary || []).filter(w => w.pos === 'verb'
                && typeof getTenseConj === 'function' && hasConjValues(getTenseConj(w, tense)));
        }
        function vconjScopeOk(w) {
            if (vconjScope === 'weak') return !!w.weak;
            if (vconjScope === 'notMastered') return !w.mastered;
            return true;
        }
        function getVconjPool() {
            const picked = vconjTenses.filter(Boolean);
            if (!picked.length) return [];
            return (vocabulary || []).filter(w => w.pos === 'verb' && vconjScopeOk(w)
                && picked.some(t => hasConjValues(getTenseConj(w, t))));
        }

        function renderVconjSetup() {
            const list = document.getElementById('vconj-tense-list');
            if (list) {
                list.innerHTML = vconjTenseOptions().map(o => {
                    const n = vconjVerbsFor(o.key).length;
                    const on = vconjTenses.includes(o.key);
                    const dim = n === 0;
                    return `<button type="button" onclick="toggleVconjTense('${o.key}')" ${dim ? 'disabled' : ''}
                        class="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${dim ? 'border-slate-100 text-slate-300 cursor-default' : (on ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}">
                        <span class="truncate">${on ? '✓ ' : ''}${escapeHtml(o.label)}</span>
                        <span class="shrink-0 ${dim ? 'text-slate-300' : 'text-slate-400'}">${n}개</span>
                    </button>`;
                }).join('');
            }
            const scopeBox = document.getElementById('vconj-scope-btns');
            if (scopeBox) {
                scopeBox.innerHTML = VCONJ_SCOPES.map(sc => `<button type="button" onclick="setVconjScope('${sc.key}')"
                    class="py-2.5 rounded-xl border text-xs font-bold transition-all ${vconjScope === sc.key ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}">${sc.label}</button>`).join('');
            }
            const cntBox = document.getElementById('vconj-count-btns');
            if (cntBox) {
                cntBox.innerHTML = VCONJ_COUNTS.map(n => `<button type="button" onclick="setVconjCount(${n})"
                    class="py-2.5 rounded-xl border text-xs font-bold transition-all ${vconjCount === n ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}">${n === 0 ? '전부' : n + '개'}</button>`).join('');
            }
            const info = document.getElementById('vconj-pool-info');
            if (info) {
                const n = getVconjPool().length;
                const cells = vconjTenses.reduce((sum, t) => sum + (isSingleTense(t) ? 1 : 6), 0);
                info.innerHTML = vconjTenses.length
                    ? `고른 시제 <b class="text-slate-600">${vconjTenses.length}개</b> · 한 문제에 최대 <b class="text-slate-600">${cells}칸</b> · 낼 수 있는 동사 <b class="text-slate-600">${n}개</b>`
                    : '시제를 하나 이상 골라주세요';
            }
        }
        function toggleVconjTense(key) {
            vconjTenses = vconjTenses.includes(key) ? vconjTenses.filter(k => k !== key) : vconjTenses.concat([key]);
            renderVconjSetup();
        }
        function vconjPickAllTenses(on) {
            vconjTenses = on ? vconjTenseOptions().map(o => o.key).filter(k => vconjVerbsFor(k).length) : [];
            renderVconjSetup();
        }
        function setVconjScope(k) { vconjScope = k; renderVconjSetup(); }
        function setVconjCount(n) { vconjCount = n; renderVconjSetup(); }

        function resetVconjSetup() {
            vconjState = null;
            const setup = document.getElementById('vconj-setup');
            const play = document.getElementById('vconj-play-area');
            if (setup) setup.classList.remove('hidden');
            if (play) { play.classList.add('hidden'); play.innerHTML = ''; }
            renderVconjSetup();
        }

        function startVconjReview() {
            if (!vconjTenses.length) { showToast("시제를 하나 이상 골라주세요", "error"); return; }
            const pool = shuffleArray(getVconjPool().slice());
            if (!pool.length) { showToast("고른 시제가 채워진 동사가 없어요", "error"); return; }
            const picked = vconjCount ? pool.slice(0, vconjCount) : pool;
            vconjState = { pool: picked, index: 0, total: picked.length, results: [], current: null, phase: 'input' };
            const setup = document.getElementById('vconj-setup');
            const play = document.getElementById('vconj-play-area');
            if (setup) setup.classList.add('hidden');
            if (play) play.classList.remove('hidden');
            renderVconjProblem();
        }

        // 고른 시제 중 이 동사에 채워진 것만, 등록 폼 순서대로
        function buildVconjProblem(w) {
            const order = vconjTenseOptions().map(o => o.key);
            const blanks = [];
            const blocks = [];
            order.filter(t => vconjTenses.includes(t)).forEach(t => {
                const c = getTenseConj(w, t);
                if (!hasConjValues(c)) return;
                const label = (vconjTenseOptions().find(o => o.key === t) || {}).label || t;
                const cells = isSingleTense(t)
                    ? [{ person: 'form', personLabel: '', expected: String(c.form || '').trim() }]
                    : VCONJ_PERSONS.map(p => ({ person: p.key, personLabel: p.label, expected: String(c[p.key] || '').trim() }));
                const rows = cells.filter(x => x.expected).map(x => {
                    const idx = blanks.length;
                    blanks.push({ tense: t, person: x.person, expected: x.expected });
                    return Object.assign({ idx: idx }, x);
                });
                if (rows.length) blocks.push({ tense: t, label: label, single: isSingleTense(t), rows: rows });
            });
            return { word: w, blocks: blocks, blanks: blanks };
        }

        function renderVconjProblem() {
            if (!vconjState) return;
            if (vconjState.index >= vconjState.pool.length) { endVconjReview(); return; }
            const play = document.getElementById('vconj-play-area');
            if (!play) return;
            vconjState.phase = 'input';
            const w = vconjState.pool[vconjState.index];
            const problem = buildVconjProblem(w);
            vconjState.current = problem;

            const blocksHtml = problem.blocks.map(blk => `
                <div class="rounded-2xl border border-slate-200 overflow-hidden">
                    <div class="bg-slate-50 px-3 py-1.5 text-[11px] font-black text-indigo-500">${escapeHtml(blk.label)}</div>
                    <div class="p-2 ${blk.single ? '' : 'grid grid-cols-2 sm:grid-cols-3 gap-2'}">
                        ${blk.rows.map(r => `
                        <div class="space-y-1">
                            ${r.personLabel ? `<span class="block text-[10px] font-bold text-slate-400 text-center">${escapeHtml(r.personLabel)}</span>` : ''}
                            <input type="text" id="vconj-input-${r.idx}" onkeydown="vconjInputKeydown(event, ${r.idx})" autocomplete="off" autocapitalize="off" spellcheck="false"
                                class="vconj-cell w-full bg-white px-2 py-2 rounded-lg border border-slate-200 text-sm text-center font-bold focus:outline-none focus:border-indigo-400">
                            <div id="vconj-mark-${r.idx}" class="hidden text-[11px] text-center font-bold"></div>
                        </div>`).join('')}
                    </div>
                </div>`).join('');

            play.innerHTML = `
                <div class="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 space-y-4">
                    <div class="flex items-center justify-between">
                        <button onclick="resetVconjSetup()" class="text-xs font-bold text-slate-400 hover:text-slate-600"><i class="fa-solid fa-arrow-left"></i> 나가기</button>
                        <span class="text-xs font-bold text-slate-500">${vconjState.index + 1} / ${vconjState.total}</span>
                    </div>
                    <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div class="h-full bg-indigo-500 transition-all" style="width:${(vconjState.index / vconjState.total * 100)}%"></div>
                    </div>
                    <div class="text-center py-2">
                        <span class="text-[10px] font-bold text-slate-400 tracking-wider">이 뜻의 동사를 활용해 보세요</span>
                        <p class="text-2xl font-black text-slate-900 mt-1">${escapeHtml(w.meaning || '(뜻 없음)')}</p>
                    </div>
                    <div class="space-y-2.5">${blocksHtml}</div>
                    <div id="vconj-feedback" class="hidden text-center text-sm font-bold"></div>
                    <div class="flex justify-end">
                        <button id="vconj-action-btn" onclick="submitVconjProblem()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95">채점하기</button>
                    </div>
                </div>`;
            setTimeout(() => { const first = document.getElementById('vconj-input-0'); if (first) first.focus(); }, 60);
        }

        function vconjInputKeydown(e, idx) {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (vconjState && vconjState.phase === 'graded') { nextVconjProblem(); return; }
            const total = vconjState && vconjState.current ? vconjState.current.blanks.length : 0;
            if (idx < total - 1) { const n = document.getElementById('vconj-input-' + (idx + 1)); if (n) n.focus(); }
            else submitVconjProblem();
        }

        function submitVconjProblem() {
            if (!vconjState || !vconjState.current || vconjState.phase !== 'input') return;
            const w = vconjState.current.word;
            const blanks = vconjState.current.blanks;
            const answers = blanks.map((b, i) => { const el = document.getElementById('vconj-input-' + i); return el ? el.value.trim() : ''; });
            // 활용형은 정답이 하나다 — 로컬로 끝낸다. 악센트는 엄격(퀴즈·단어 빈칸과 같은 잣대)
            const detail = blanks.map((b, i) => ({
                tense: b.tense, person: b.person, expected: b.expected, userAnswer: answers[i],
                correct: fillLocalGrade({ language: 'es', expected: b.expected }, answers[i])
            }));
            vconjState.phase = 'graded';

            detail.forEach((d, i) => {
                const input = document.getElementById('vconj-input-' + i);
                const mark = document.getElementById('vconj-mark-' + i);
                if (input) input.className = input.className.replace('border-slate-200', d.correct ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50');
                if (mark) {
                    mark.classList.remove('hidden');
                    mark.innerHTML = d.correct ? '<span class="text-emerald-600">✓</span>'
                        : `<span class="text-rose-500">${escapeHtml(d.expected)}</span>`;
                }
            });

            const okCount = detail.filter(d => d.correct).length;
            const rate = detail.length ? okCount / detail.length : 0;
            const allCorrect = okCount === detail.length;
            // 문법표 빈칸과 같은 잣대 — 표 하나당 한 번, 정답률 70% 가 본전
            const delta = (typeof grammarFillDelta === 'function') ? grammarFillDelta(rate) : (allCorrect ? 2 : -2);
            if (typeof withGradeShift === 'function') {
                withGradeShift(w, () => { if (typeof addWordScore === 'function') addWordScore(w.id, delta, { correct: allCorrect }); });
            } else if (typeof addWordScore === 'function') {
                addWordScore(w.id, delta, { correct: allCorrect });
            }

            vconjState.results.push({ word: w, detail: detail, okCount: okCount, total: detail.length, delta: delta });
            const fb = document.getElementById('vconj-feedback');
            if (fb) {
                fb.classList.remove('hidden');
                fb.innerHTML = `<span class="${allCorrect ? 'text-emerald-600' : 'text-slate-600'}">${escapeHtml(w.word)} · ${okCount}/${detail.length} 칸</span>
                    <span class="ml-2 ${delta > 0 ? 'text-emerald-600' : (delta < 0 ? 'text-rose-500' : 'text-slate-400')}">${delta > 0 ? '+' : ''}${Math.round(delta * 10) / 10}점</span>`;
            }
            const btn = document.getElementById('vconj-action-btn');
            if (btn) { btn.innerHTML = '다음 (Enter) →'; btn.setAttribute('onclick', 'nextVconjProblem()'); }
            if (typeof logAction === 'function') logAction('review');
            try { if (typeof saveToStorage === 'function') saveToStorage(); } catch (e) {}
            if (typeof updateStats === 'function') updateStats();
        }

        function nextVconjProblem() {
            if (!vconjState) return;
            vconjState.index++;
            renderVconjProblem();
        }

        function endVconjReview() {
            const play = document.getElementById('vconj-play-area');
            if (!play || !vconjState) return;
            const rs = vconjState.results;
            const cells = rs.reduce((a, r) => a + r.total, 0);
            const ok = rs.reduce((a, r) => a + r.okCount, 0);
            const rows = rs.map(r => `
                <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 last:border-0">
                    <span class="font-bold text-slate-800 text-sm truncate">${escapeHtml(r.word.word)}</span>
                    <span class="text-[11px] text-slate-400 truncate flex-1">${escapeHtml(r.word.meaning || '')}</span>
                    <span class="text-xs font-black shrink-0 ${r.okCount === r.total ? 'text-emerald-600' : 'text-rose-500'}">${r.okCount}/${r.total}</span>
                </div>`).join('');
            play.innerHTML = `
                <div class="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 text-center">
                    <div class="text-5xl">${ok === cells ? '🏆' : '💪'}</div>
                    <h3 class="text-lg font-black text-slate-900">동사 변형 연습 끝!</h3>
                    <p class="text-sm font-bold text-slate-500">동사 ${rs.length}개 · 칸 ${ok}/${cells} 맞음</p>
                    <div class="text-left rounded-2xl border border-slate-200 overflow-hidden max-h-72 overflow-y-auto">${rows}</div>
                    <button onclick="resetVconjSetup()" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-2xl text-sm font-bold transition-all active:scale-95">다시 하기</button>
                </div>`;
            vconjState = null;
        }

        function resetFillSetup() {
            fillState = null;
            const setup = document.getElementById('fill-setup');
            const play = document.getElementById('fill-play-area');
            if (setup) setup.classList.remove('hidden');
            if (play) { play.classList.add('hidden'); play.innerHTML = ''; }
            selectFillScope((!fillScope || fillScope === 'today-wrong') ? 'not-mastered' : fillScope);
            selectFillCount(fillCount || 5);
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
            let shuffled = shuffleArray(pool.slice()).slice(0, fillCount);
            fillState = { pool: shuffled, index: 0, total: shuffled.length, results: [], current: null, phase: 'input' };
            document.getElementById('fill-setup').classList.add('hidden');
            document.getElementById('fill-play-area').classList.remove('hidden');
            renderFillProblem();
        }

        // [냐냐 요청] 헤더의 '복습' 배너 → 쓰기 복습으로 원클릭.
        //   랜덤 20개 · 1바퀴 가리고 1번(테스트) → 틀린 것만 보고 2번 → 3바퀴 다시 가리고 1번.
        //   망각곡선은 1바퀴 결과로 반영.
        //   모달로 돌아서 탭 이동이 필요 없음 (어느 화면에서든 바로 시작).
        //   [냐냐 요청] 10 → 20. 묶음 크기가 곧 '익히기(2바퀴)와 확인(3바퀴) 사이의 간격'이라,
        //   10개면 방금 쓴 걸 열 개 뒤에 다시 물어보는 셈이라 잘 안 틀렸다. 간격을 두 배로 늘린다.
        const TODAY_REVIEW_BATCH = 20;

        // [냐냐 요청] 밀린 복습을 몇 번에 나눠 할지 먼저 고르게 한다.
        //   딱 안 나눠지면 앞쪽부터 1개씩 더 준다: 83개를 4번 → 21 · 21 · 21 · 20
        function splitReviewCounts(total, parts) {
            const base = Math.floor(total / parts);
            const rem = total % parts;
            return Array.from({ length: parts }, (_, i) => base + (i < rem ? 1 : 0));
        }

        // 고른 나눔을 회차 사이에 기억해 둔다. '다음 N개 이어서'가 이 계획을 따라간다.
        let todayReviewPlan = null;   // { counts: [21,21,21,20], index: 0 }
        let todayReviewParts = 1;     // 팝업에서 고르는 중인 횟수

        function startTodayReviewShortcut() {
            const due = (typeof getReviewDueWords === 'function') ? getReviewDueWords() : [];
            if (due.length < 1) { showToast("오늘 복습할 단어가 없어요! 🎉", "info"); return; }
            todayReviewPlan = null;
            // 한 번에 다 할 만큼 적으면 굳이 안 물어본다
            if (due.length <= TODAY_REVIEW_BATCH) { beginTodayReview(1); return; }
            todayReviewParts = Math.min(5, Math.max(1, Math.ceil(due.length / TODAY_REVIEW_BATCH)));
            renderReviewSplitModal();
            document.getElementById('review-split-modal').classList.remove('hidden');
        }

        function changeReviewSplit(delta) {
            todayReviewParts = Math.min(5, Math.max(1, todayReviewParts + delta));
            renderReviewSplitModal();
        }

        function renderReviewSplitModal() {
            const due = (typeof getReviewDueWords === 'function') ? getReviewDueWords() : [];
            const counts = splitReviewCounts(due.length, todayReviewParts);
            const numEl = document.getElementById('review-split-num');
            const perEl = document.getElementById('review-split-per');
            const listEl = document.getElementById('review-split-list');
            const totalEl = document.getElementById('review-split-total');
            if (totalEl) totalEl.innerText = `오늘 복습할 단어 ${due.length}개`;
            if (numEl) numEl.innerText = `${todayReviewParts}번`;
            // counts 는 앞쪽이 크므로 그대로 쓰면 '18~17개'처럼 거꾸로 적힌다. 작은 쪽을 앞에 둔다.
            if (perEl) perEl.innerText = counts.every(c => c === counts[0])
                ? `한 번에 ${counts[0]}개씩`
                : `한 번에 ${counts[counts.length - 1]}~${counts[0]}개씩`;
            if (listEl) listEl.innerHTML = counts.map((c, i) =>
                `<span class="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-700">${i + 1}회 ${c}개</span>`).join(' ');
            const minus = document.getElementById('review-split-minus');
            const plus = document.getElementById('review-split-plus');
            if (minus) minus.disabled = todayReviewParts <= 1;
            if (plus) plus.disabled = todayReviewParts >= 5;
        }

        function closeReviewSplitModal() {
            const m = document.getElementById('review-split-modal');
            if (m) m.classList.add('hidden');
        }

        function confirmReviewSplit() {
            closeReviewSplitModal();
            beginTodayReview(todayReviewParts);
        }

        // parts 로 나눠 첫 회차를 시작한다. 이후 회차는 continueTodayReview() 가 이어받는다.
        function beginTodayReview(parts) {
            const due = (typeof getReviewDueWords === 'function') ? getReviewDueWords() : [];
            if (due.length < 1) { showToast("오늘 복습할 단어가 없어요! 🎉", "info"); return; }
            todayReviewPlan = { counts: splitReviewCounts(due.length, parts), index: 0 };
            runTodayReviewChunk(due);
        }

        // '다음 N개 이어서' — 고른 나눔의 다음 회차만큼 가져온다.
        function continueTodayReview() {
            const due = (typeof getReviewDueWords === 'function') ? getReviewDueWords() : [];
            if (due.length < 1) { showToast("오늘 복습할 단어가 없어요! 🎉", "info"); return; }
            if (!todayReviewPlan) { startTodayReviewShortcut(); return; }
            todayReviewPlan.index++;
            runTodayReviewChunk(due);
        }

        // 결과 화면의 '다음 N개 이어서' 버튼에 쓸 숫자 — 실제로 다음에 나올 개수와 맞춘다.
        function peekNextTodayReviewCount(remain, fallbackBatch) {
            const plan = todayReviewPlan;
            const n = (plan && plan.counts[plan.index + 1]) || fallbackBatch || TODAY_REVIEW_BATCH;
            return Math.min(remain, n);
        }

        // 이번 회차 개수만큼 뽑아서 시작. 계획을 다 썼으면 남은 만큼 한 번에.
        function runTodayReviewChunk(due) {
            const plan = todayReviewPlan;
            const n = (plan && plan.counts[plan.index]) || Math.min(due.length, TODAY_REVIEW_BATCH);
            const picked = shuffleArray(due.slice()).slice(0, n);
            if (typeof beginWritePractice === 'function') {
                beginWritePractice(picked, { isTodayReview: true, batchSize: n });
            }
        }

        // [냐냐 PATCH] 한 단어당 "한 언어만" 비움 (스페인어만 or 한국어만)
        //   ⚠️ 예전엔 항목마다 따로 뽑아서 스페인어/한국어가 섞였고, 서로 답의 힌트가 됐음
        //   → 스페인어 차례면 스페인어 칸 전부 / 한국어 차례면 한국어 칸 전부를 비움
        function buildFillProblem(w) {
            const idiomList = (w.idioms && w.idioms.length) ? w.idioms : (w.idiom ? [{ idiom: w.idiom, idiomMeaning: w.idiomMeaning || '' }] : []);

            // 이 단어에서 가능한 빈칸을 언어별로 모아둠
            const es = [];
            const ko = [];
            if (w.word) es.push({ key: 'word', label: '단어', language: 'es', expected: w.word });
            if (w.meaning) ko.push({ key: 'meaning', label: '뜻', language: 'ko', expected: w.meaning });

            idiomList.forEach((id, i) => {
                const sp = (id.idiom || '').trim();
                const me = (id.idiomMeaning || '').trim();
                if (sp) es.push({ key: 'idiom-sp-' + i, label: '관용구', language: 'es', expected: sp });
                if (me) ko.push({ key: 'idiom-me-' + i, label: '관용구 뜻', language: 'ko', expected: me });
            });

            const exSp = (w.example || '').trim();
            const exMe = (w.exampleMeaning || '').trim();
            if (exSp) es.push({ key: 'ex-sp', label: '예문', language: 'es', expected: exSp });
            if (exMe) ko.push({ key: 'ex-me', label: '예문 뜻', language: 'ko', expected: exMe });

            // 동사 변형은 스페인어 전용
            if (w.pos === 'verb') {
                const conj = (w.conjugationsByTense && w.conjugationsByTense.presente) || w.conjugations || {};
                ['yo', 'tu', 'el', 'nos', 'vos', 'ellos'].forEach(p => {
                    const v = (conj[p] || '').toString().trim();
                    if (v) es.push({ key: 'conj-' + p, label: p, language: 'es', expected: v });
                });
            }

            // 언어 하나 고르기 (한쪽이 비면 반대쪽으로)
            let lang;
            if (es.length === 0) lang = 'ko';
            else if (ko.length === 0) lang = 'es';
            else lang = Math.random() < 0.5 ? 'es' : 'ko';

            return { word: w, blanks: (lang === 'es' ? es : ko), lang };
        }

        function fillFieldHtml(problem, key, text, extraClass, inputClass) {
            // 해당 key가 빈칸이면 input, 아니면 텍스트로 렌더
            const bi = problem.blanks.findIndex(b => b.key === key);
            if (bi >= 0) {
                // [냐냐 요청] 입력칸을 옆으로 쭉 늘림 (w-full)
                const cls = inputClass || 'inline-block w-full';
                return `<input id="fill-input-${bi}" type="text" autocomplete="off" onkeydown="fillInputKeydown(event, ${bi})" class="fill-input ${cls} px-2 py-1 rounded-lg border-2 border-indigo-300 bg-indigo-50/40 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="?">`;
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
            // [냐냐 PATCH] 동사 변형 (현재시제) — 등록폼처럼 6칸 그리드, 전부 빈칸 (규칙/불규칙 표시 없음)
            if (w.pos === 'verb') {
                const conj = (w.conjugationsByTense && w.conjugationsByTense.presente) || w.conjugations || {};
                const persons = [['yo', 'yo (나)'], ['tu', 'tú (너)'], ['el', 'él/ella'], ['nos', 'nosotros'], ['vos', 'vosotros'], ['ellos', 'ellos/ellas']];
                const hasConj = persons.some(([p]) => (conj[p] || '').toString().trim());
                if (hasConj) {
                    const cells = persons.map(([p, lbl]) => {
                        const val = (conj[p] || '').toString().trim();
                        const inner = val ? fillFieldHtml(problem, 'conj-' + p, val, '', 'w-full text-center text-xs') : '<span class="text-slate-300 text-xs">–</span>';
                        return `<div class="space-y-1"><span class="text-[10px] font-bold text-slate-400">${lbl}</span><div>${inner}</div></div>`;
                    }).join('');
                    rows += `<div class="pt-2"><span class="text-[11px] font-bold text-blue-400 block mb-1.5">동사 변형 (현재시제)</span><div class="grid grid-cols-3 gap-2 bg-white/60 rounded-xl p-2 border border-slate-100">${cells}</div></div>`;
                }
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
            if (!(ans || '').toString().trim()) return false;
            // [냐냐 PATCH] 스페인어는 퀴즈와 동일한 정규화 사용
            //   → 관사·기호·대괄호 자리표시자([명사/동사원형])·한글을 채점에서 제외
            if (blank.language === 'es') {
                // [냐냐 요청] 악센트도 엄격하게 — AI 채점 프롬프트가 "악센트가 빠지면 오답"이라
                //   못박아 두고 있는데 폴백만 봐주면 AI 유무에 따라 결과가 갈린다
                return normalizeSpanishAnswer(ans, true) === normalizeSpanishAnswer(blank.expected, true);
            }
            // 한국어 뜻은 관대하게 (대괄호 자리표시자와 기호는 무시)
            const cleanKo = (t) => (t || '').toString().toLowerCase()
                .replace(/[\[\(（【][^\]\)）】]*[\]\)）】]/g, ' ')
                .replace(/[^\p{L}\p{N}]/gu, '')
                .trim();
            const u = cleanKo(ans), ex = cleanKo(blank.expected);
            if (!u) return false;
            return u === ex || ex.includes(u) || u.includes(ex);
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
- IMPORTANT — placeholders: the expected value may contain bracket placeholders written in Korean, e.g. "antes de [명사/동사원형]" or "[간접목적대명사] encanta [주어]". The student CANNOT be expected to reproduce those Korean placeholders. Grade ONLY the non-bracket part. If the student wrote the non-bracket part correctly (e.g. "antes de"), mark it CORRECT. Never mark wrong just because a bracket placeholder is missing.
- Leading articles (el/la/los/las/un/una) are optional for nouns — accept with or without.
- An empty answer is incorrect.
Return JSON only, no markdown.`;
                    const prompt = `Grade each blank. For each, the "expected" is the correct value from the flashcard and "studentAnswer" is what the student typed.\n${JSON.stringify(items)}\nReturn JSON: { "results": [ { "index": number, "correct": boolean, "correctAnswer": string } ] }`;
                    const schema = { type: "OBJECT", properties: { results: { type: "ARRAY", items: { type: "OBJECT", properties: { index: { type: "NUMBER" }, correct: { type: "BOOLEAN" }, correctAnswer: { type: "STRING" } }, required: ["index", "correct", "correctAnswer"] } } }, required: ["results"] };
                    const resp = await callGemini(prompt, system, schema, 'low');
                    const data = extractAndParseJson(resp);
                    graded = blanks.map((b, i) => {
                        const r = (data.results || []).find(x => x.index === i);
                        // [냐냐 요청] AI 가 그 칸을 빼먹으면 예전엔 무조건 오답이 됐다.
                        //   (정답을 써도 '오답 · 정답: julio' 처럼 보였음) 빠졌으면 기본 채점으로 넘긴다
                        if (!r) return { correct: fillLocalGrade(b, answers[i]), correctAnswer: b.expected };
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
            graded = rescueExactMatches(graded, blanks, answers);

            // 결과 저장 + 표시
            const detail = blanks.map((b, i) => ({ key: b.key, label: b.label, language: b.language, expected: b.expected, userAnswer: answers[i], correct: graded[i].correct, correctAnswer: graded[i].correctAnswer }));
            const allCorrect = detail.every(d => d.correct);
            fillState.results.push({ word: fillState.current.word, blanks: detail, allCorrect,
                                     ...(fillState.current.gradeShift || {}) });

            // [냐냐 PATCH-0배치] 단어 빈칸 복습 점수: 정답 칸당 +0.7 / 오답 칸당 -0.5
            //   [냐냐 요청] 단, 동사변형(conj-*) 칸은 한 문제에 6칸까지 나올 수 있어
            //   점수가 과하게 커지므로 ±0.1로 작게 계산한다.
            if (typeof addWordScore === 'function' && fillState.current.word) {
                const isConj = (k) => k && k.startsWith('conj-');
                let delta = 0;
                detail.forEach(d => {
                    if (d.correct) delta += isConj(d.key) ? 0.1 : 0.7;
                    else delta += isConj(d.key) ? -0.1 : -0.5;
                });
                delta = Math.round(delta * 100) / 100; // 소수점 오차 정리
                // [냐냐 요청] 한 판 상한 — 칸이 많다고 주관식보다 크게 붙으면 안 된다
                if (typeof WORD_FILL_MAX === 'number') {
                    delta = Math.max(-WORD_FILL_MAX, Math.min(WORD_FILL_MAX, delta));
                }
                // [냐냐 요청] 망각곡선 복습 대상 판정: 관용구/예문 칸은 제외하고,
                //   핵심 칸(뜻·철자·동사변형)에서 틀렸을 때만 lastWrongDate를 찍는다.
                const isIdiomOrExample = (k) => k && (k.startsWith('idiom-') || k.startsWith('ex-'));
                const coreWrong = detail.some(d => !d.correct && !isIdiomOrExample(d.key));
                // [냐냐 요청] 관용구 칸은 단어 곡선에서 빼두고 있었는데, 이제 갈 곳이 생겼다.
                // [냐냐 기준] 틀렸을 때만 그 표현의 곡선을 건드린다(진입·후퇴).
                //   맞혔다고 앞으로 밀지는 않는다 — 곡선을 앞으로 미는 건 관용구 복습에서만.
                if (typeof idiomReviewDemote === 'function') {
                    const cur = fillState.current.word;
                    detail.forEach(d => {
                        if (!d.key || !String(d.key).startsWith('idiom-')) return;
                        const text = String(d.correctAnswer || '').trim();
                        if (!text || d.correct) return;
                        idiomReviewDemote(cur.id, text);
                    });
                }
                // [냐냐 요청] 스페인어 '단어' 칸을 직접 써서 맞혔으면 = 주관식 정답 → 마스터 자격
                //   (한국어 뜻 칸이나 관용구·예문 칸은 해당 없음)
                const wordBlankPassed = detail.some(d => d.key === 'word' && d.language === 'es' && d.correct);
                const gShift = withGradeShift(fillState.current.word, () => {
                    addWordScore(fillState.current.word.id, delta, { correct: allCorrect, skipReviewDate: !coreWrong });
                });
                fillState.current.gradeShift = gShift;   // 결과 화면에서 쓴다
                // ⚠️ addWordScore는 correct===true 일 때만 subjective를 반영한다.
                //   단어 칸은 맞고 예문 칸만 틀린 경우도 인정해야 하므로 여기서 직접 세운다.
                //   [냐냐 요청] 세운 뒤 syncWordFlags 를 다시 불러야 마스터 플래그가 그 자리에서 붙는다.
                //   안 그러면 점수·주관식을 다 채웠는데도 w.mastered 가 false 로 남아서
                //   등급 표시는 '마스터' 인데 헤더 통계·필터에서는 빠지는 어긋남이 생긴다.
                if (wordBlankPassed && !fillState.current.word.subjectivePassed) {
                    fillState.current.word.subjectivePassed = true;
                    if (typeof syncWordFlags === 'function') syncWordFlags(fillState.current.word);
                }
                // [냐냐 요청] 배너(오늘의 복습)로 시작한 경우에만 '오늘 복습함'으로 인정
                if (fillState.isTodayReview && typeof markWordReviewedToday === 'function') {
                    markWordReviewedToday(fillState.current.word.id, !coreWrong);
                }
                // 진행 상황 저장 + 헤더 배너(남은 개수) 갱신
                try { if (typeof saveToStorage === 'function') saveToStorage(); } catch (e) {}
                if (typeof updateStats === 'function') updateStats();
            }

            if (typeof logAction === 'function') logAction('review'); // 복습 1개 기록

            applyFillGradeResults(detail);
            fillState.phase = 'graded';
        }

        // [냐냐 요청] 적어낸 답이 정답과 글자까지 똑같으면 무조건 정답으로 되돌린다.
        //   AI 채점이 칸을 빼먹거나 잘못 짚어서 'julio' 를 쓰고도 '오답 · 정답: julio' 가 나온 적이 있다.
        //   대소문자와 앞뒤 공백만 관대하게 보고, 악센트는 그대로 본다 (á 와 a 는 다른 글자다).
        //   NFC 로 모양만 통일한다 — 같은 글자가 분해형으로 저장돼 있을 수 있어서.
        function rescueExactMatches(graded, blanks, answers) {
            if (!Array.isArray(graded)) return graded;
            const norm = (s) => String(s || '').trim().normalize('NFC').toLowerCase();
            return graded.map((g, i) => {
                if (!g || g.correct) return g;
                const expected = blanks[i] ? blanks[i].expected : '';
                if (!norm(answers[i])) return g;                 // 빈 칸은 그대로 오답
                if (norm(answers[i]) !== norm(expected)) return g;
                return { correct: true, correctAnswer: g.correctAnswer || expected };
            });
        }

        // [냐냐 요청] 오답 칸 — 내가 쓴 답에 줄을 긋고 바로 밑에 정답을 적어준다.
        //   input 안에는 글자를 한 덩어리로밖에 못 넣어서, 정답은 칸 바로 뒤에 붙인다.
        //   (아래 오답 목록에도 정답이 있지만, 표를 보면서 바로 확인하고 싶다는 요청)
        function markBlankAnswer(el, d) {
            if (!el || !el.parentNode) return;
            // 다시 채점해도 두 번 붙지 않게 먼저 지운다
            const prev = el.parentNode.querySelector('.nyanya-answer-hint');
            if (prev) prev.remove();
            if (d.correct) return;
            if (!String(el.value || '').trim()) el.value = '(빈칸)';   // 빈 칸이면 줄 그을 글자가 없다
            const hint = document.createElement('div');
            hint.className = 'nyanya-answer-hint mt-0.5 text-[11px] font-black text-emerald-600 leading-tight break-words text-center';
            hint.textContent = d.correctAnswer || '';
            el.insertAdjacentElement('afterend', hint);
        }

        function applyFillGradeResults(detail) {
            detail.forEach((d, i) => {
                const el = document.getElementById('fill-input-' + i);
                if (!el) return;
                el.disabled = true;
                el.classList.remove('border-indigo-300', 'bg-indigo-50/40');
                // [냐냐 요청] 정답 후 글씨크기 명시적으로 유지 (text-sm font-bold)
                if (d.correct) el.classList.add('border-emerald-400', 'bg-emerald-50', 'text-emerald-700', 'text-sm', 'font-bold');
                else el.classList.add('border-red-400', 'bg-red-50', 'text-red-600', 'line-through', 'text-sm', 'font-bold');
                markBlankAnswer(el, d);
            });
            const fb = document.getElementById('fill-feedback');
            if (fb) {
                fb.classList.remove('hidden');
                fb.innerHTML = detail.map(d => {
                    const icon = d.correct ? '<span class="text-emerald-500 font-black">✓</span>' : '<span class="text-red-500 font-black">✗</span>';
                    // [냐냐 요청] 스페인어 칸이 철자로 틀렸으면 어디가 다른지 글자로 짚어준다 (뜻 칸은 제외)
                    const df = (!d.correct && d.language === 'es') ? blankDiffHtml(d.userAnswer, d.correctAnswer) : null;
                    const mine = df ? df.mine : escapeHtml(d.userAnswer || '(빈칸)');
                    const ans = d.correct ? '' : ` <span class="text-slate-400">→ 정답:</span> <b class="text-slate-800">${df ? df.answer : escapeHtml(d.correctAnswer)}</b>`;
                    return `<div class="text-xs flex items-baseline gap-1.5"><span class="font-bold text-slate-400 shrink-0">${escapeHtml(d.label)}</span>${icon}<span class="text-slate-500">${mine}</span>${ans}</div>`;
                }).join('');
            }
            // [냐냐 요청] 스페인어 칸을 틀렸으면 그 단어를 한 번 읽어준다.
            //   화면에 이미 정답이 떠 있어서 새어나갈 게 없고, 귀로 한 번 듣는 게 남는다.
            //   한국어 뜻 칸만 틀린 경우엔 읽어줄 게 없으니 넘어간다. (음소거면 안 읽힌다)
            const esWrong = detail.some(d => !d.correct && d.language === 'es');
            if (esWrong && typeof speakSpanishVoice === 'function') {
                const w = fillState.current && fillState.current.word;
                if (w && w.word) setTimeout(() => speakSpanishVoice(w.word), 150);
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

            // [냐냐 요청] 이번 복습으로 등급이 바뀐 단어 (마스터 / 약점 / 마스터 풀림)
            const shiftHtml = (typeof gradeShiftHtml === 'function')
                ? gradeShiftHtml(results.map(r => ({ word: r.word.word, meaning: r.word.meaning || '',
                                                     gradeBefore: r.gradeBefore, gradeAfter: r.gradeAfter })))
                : '';

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
                    ${shiftHtml}
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

        // ============================================================
        // [냐냐 PATCH] 3차-② 문법표 빈칸 채우기 복습 (AI 채점)
        //   제목·설명·팁·열제목·강조열 전체는 공개, 나머지 (비어있지 않은) 칸을 빈칸으로.
        // ============================================================
        let gfillMastery = 'not-mastered'; // [냐냐 PATCH] 마스터 필터: all | not-mastered | mastered (갯수 선택 제거)
        let gfillState = null;

        function resetGrammarFillSetup() {
            gfillState = null;
            const setup = document.getElementById('gfill-setup');
            const play = document.getElementById('gfill-play-area');
            if (setup) setup.classList.remove('hidden');
            if (play) { play.classList.add('hidden'); play.innerHTML = ''; }
            selectGfillMastery(gfillMastery || 'not-mastered');
        }

        function selectGfillMastery(m) {
            gfillMastery = m;
            document.querySelectorAll('.gfill-mastery-btn').forEach(btn => {
                const active = btn.dataset.gfillMastery === m;
                btn.classList.toggle('border-indigo-500', active);
                btn.classList.toggle('bg-indigo-50', active);
                btn.classList.toggle('text-indigo-700', active);
                btn.classList.toggle('border-slate-200', !active);
                btn.classList.toggle('text-slate-600', !active);
            });
            const el = document.getElementById('gfill-scope-count');
            if (el) el.innerText = `복습할 표: ${getGrammarFillPool().length}개`;
        }

        // 빈칸 낼 칸이 있고, 마스터 필터에 맞는 표만
        function getGrammarFillPool() {
            const all = (typeof getAllGrammarTables === 'function') ? getAllGrammarTables() : [];
            return all.filter(t => {
                if (countGrammarBlanks(t) <= 0) return false;
                const mastered = (typeof masteredGrammar !== 'undefined') && !!masteredGrammar[t.id];
                if (gfillMastery === 'mastered') return mastered;
                if (gfillMastery === 'not-mastered') return !mastered;
                // [냐냐 요청] 약점만 — 문법표 점수가 낮은(약점·치명적) 표만 골라 복습
                if (gfillMastery === 'weak') {
                    return (typeof getGrammarGrade === 'function') && ['weak', 'critical'].includes(getGrammarGrade(t.id));
                }
                return true; // all
            });
        }
        // [냐냐 요청] 노트 안의 표 블록을 전부 합쳐서 센다 (노트 하나 = 문제 하나)
        function countGrammarBlanks(t) {
            const blocks = (typeof getNoteBlocks === 'function') ? getNoteBlocks(t) : [];
            let n = 0;
            blocks.forEach(b => {
                if (b.type !== 'table') return;
                const hlCols = b.highlightCols || [0];
                const hidden = (typeof buildMergeHidden === 'function') ? buildMergeHidden(b.merges || {}) : new Set();
                (b.rows || []).forEach((r, ri) => (r || []).forEach((c, ci) => {
                    if (hlCols.includes(ci)) return;                 // 강조 열은 공개
                    if (hidden.has(`${ri}-${ci}`)) return;           // 병합에 덮인 칸은 화면에 없음
                    if ((c || '').toString().trim()) n++;
                }));
            });
            return n;
        }

        // [냐냐 요청] 문법 노트 → 그 표 하나만 바로 빈칸 채우기
        function startGrammarFillForTable(id) {
            const t = (typeof getAllGrammarTables === 'function') ? getAllGrammarTables().find(x => x.id === id) : null;
            if (!t) return;
            if (countGrammarBlanks(t) <= 0) {
                showToast("이 표는 빈칸으로 낼 칸이 없어요 (강조 열만 있거나 내용이 비어 있어요)", "error");
                return;
            }
            if (typeof changeTab === 'function') changeTab('review');
            if (typeof selectReviewMode === 'function') selectReviewMode('gfill');
            gfillState = { pool: [t], index: 0, total: 1, results: [], current: null, phase: 'input' };
            document.getElementById('gfill-setup')?.classList.add('hidden');
            document.getElementById('gfill-play-area')?.classList.remove('hidden');
            renderGrammarFillProblem();
        }

        function startGrammarFillReview() {
            const pool = getGrammarFillPool();
            if (pool.length < 1) { showToast("복습할 문법표가 없어요! (마스터 필터/강조열 조건 확인)", "error"); return; }
            const shuffled = shuffleArray(pool.slice()); // [냐냐 PATCH] 갯수 제한 없이 전부
            gfillState = { pool: shuffled, index: 0, total: shuffled.length, results: [], current: null, phase: 'input' };
            document.getElementById('gfill-setup').classList.add('hidden');
            document.getElementById('gfill-play-area').classList.remove('hidden');
            renderGrammarFillProblem();
        }

        // [냐냐 PATCH] 열 우선(세로) 순서로 빈칸 수집 → 엔터가 한 열을 쭉 내려간 뒤 다음 열로
        // [냐냐 요청] 노트 하나 = 문제 하나 — 노트 안 표 블록을 순서대로 돌며 빈칸을 모은다
        function buildGrammarFillProblem(t) {
            const blocks = (typeof getNoteBlocks === 'function') ? getNoteBlocks(t) : [];
            const blanks = [];
            blocks.forEach((b, bi) => {
                if (b.type !== 'table') return;
                const hlCols = b.highlightCols || [0];
                const rows = b.rows || [];
                const numCols = Math.max(...(b.headerRows || []).map(r => r.length), ...rows.map(r => (r || []).length), 0);
                // [냐냐 요청] 병합에 덮인 칸은 화면에 없으므로 출제 대상에서 제외
                const hidden = (typeof buildMergeHidden === 'function') ? buildMergeHidden(b.merges || {}) : new Set();
                for (let ci = 0; ci < numCols; ci++) {
                    if (hlCols.includes(ci)) continue;         // 강조 열은 공개
                    for (let ri = 0; ri < rows.length; ri++) {
                        if (hidden.has(`${ri}-${ci}`)) continue;
                        const c = (rows[ri] || [])[ci];
                        if (!(c || '').toString().trim()) continue; // 빈 칸은 스킵
                        blanks.push({ bi, ri, ci, expected: c });
                    }
                }
            });
            return { table: t, blocks, blanks };
        }

        function renderGrammarFillProblem() {
            if (!gfillState) return;
            if (gfillState.index >= gfillState.pool.length) { endGrammarFillReview(); return; }
            gfillState.phase = 'input';
            gfillState.hintUsed = false;   // [냐냐 요청] 문제마다 힌트 사용 여부를 새로 센다
            const play = document.getElementById('gfill-play-area');   // ⚠️ 병합 작업 때 실수로 지웠던 줄
            if (!play) return;
            const t = gfillState.pool[gfillState.index];
            const problem = buildGrammarFillProblem(t);
            gfillState.current = problem;
            // 빈칸 key(블록-행-열) → input index
            const blankIndexOf = {};
            problem.blanks.forEach((b, i) => { blankIndexOf[`${b.bi}-${b.ri}-${b.ci}`] = i; });

            // [냐냐 요청] 노트와 똑같은 모양으로 — 글 블록과 표 블록을 저장된 순서 그대로 출제
            const blocksHtml = problem.blocks.map((blk, bi) => {
                if (blk.type === 'text') {
                    if (!blk.html || !richTextToPlain(blk.html)) return '';
                    const body = blk.style === 'tip'
                        ? `<div class="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 flex gap-2"><span class="shrink-0">💡</span><span class="nyanya-rt flex-1">${renderRichText(blk.html)}</span></div>`
                        : `<div class="nyanya-rt text-xs text-slate-600">${renderRichText(blk.html)}</div>`;
                    // [냐냐 요청] 설명·팁에 답이 적혀 있는 경우가 많아서 가려둔다. 채점하면 자동으로 풀림
                    return `<div class="relative" data-gfill-note="${bi}">
                        <div class="gfill-note-body select-none">${body}</div>
                        <button type="button" onclick="revealGfillNote(${bi})" class="gfill-note-cover absolute inset-0 flex items-center justify-center rounded-lg">
                            <span class="text-[11px] font-bold text-slate-500 bg-white/90 border border-slate-200 rounded-full px-3 py-1 shadow-sm hover:text-indigo-600 hover:border-indigo-300 transition-colors"><i class="fa-solid fa-eye mr-1"></i>힌트 보기</span>
                        </button>
                    </div>`;
                }
                const hlCols = blk.highlightCols || [0];
                const hMerges = blk.headerMerges || {};
                const hHidden = (typeof buildMergeHidden === 'function') ? buildMergeHidden(hMerges) : new Set();
                const headerRow = (blk.headerRows || []).map((hr, hi) => {
                    // 헤더 줄끼리 색 차이 없이 전부 같은 파랑 + 흰 글씨 (노트 화면과 같은 규칙)
                    const cells = hr.map((h, ci) => {
                        if (hHidden.has(`${hi}-${ci}`)) return '';
                        const mg = hMerges[`${hi}-${ci}`];
                        const cs = mg ? Math.max(1, mg.cs || 1) : 1;
                        const rs = mg ? Math.max(1, mg.rs || 1) : 1;
                        const spanAttr = `${cs > 1 ? ` colspan="${cs}"` : ''}${rs > 1 ? ` rowspan="${rs}"` : ''}`;
                        return `<th class="text-center px-2 py-2 text-xs font-black align-middle border text-white bg-[#649fd0] border-[#5590c2]"${spanAttr}>${escapeHtml(h)}</th>`;
                    }).join('');
                    return cells ? `<tr>${cells}</tr>` : '';
                }).join('');
                // 셀 병합을 표 모양 그대로 출제 — 대표 칸만 그리고 덮인 칸은 건너뜀
                const tMerges = blk.merges || {};
                const tHidden = (typeof buildMergeHidden === 'function') ? buildMergeHidden(tMerges) : new Set();
                const bodyRows = (blk.rows || []).map((r, ri) => {
                    const rowBg = ri % 2 === 0 ? 'bg-white' : 'bg-[#f3f8fd]';
                    const cells = (r || []).map((c, ci) => {
                        if (tHidden.has(`${ri}-${ci}`)) return '';
                        const mg = tMerges[`${ri}-${ci}`];
                        const cs = mg ? Math.max(1, mg.cs || 1) : 1;
                        const rs = mg ? Math.max(1, mg.rs || 1) : 1;
                        const spanAttr = `${cs > 1 ? ` colspan="${cs}"` : ''}${rs > 1 ? ` rowspan="${rs}"` : ''}`;
                        const colHl = hlCols.includes(ci) ? 'text-violet-600 font-extrabold' : 'text-slate-800';
                        const key = `${bi}-${ri}-${ci}`;
                        if (key in blankIndexOf) {
                            const idx = blankIndexOf[key];
                            return `<td class="px-1 py-1 align-middle border border-[#c3d9ec] ${rowBg}"${spanAttr}><input id="gfill-input-${idx}" type="text" autocomplete="off" onkeydown="gfillInputKeydown(event, ${idx})" class="gfill-input w-full min-w-[70px] px-1.5 py-1 rounded border-2 border-indigo-300 bg-indigo-50/40 text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="?"></td>`;
                        }
                        return `<td class="px-2 py-1.5 text-xs text-center align-middle border border-[#c3d9ec] ${colHl}"${spanAttr}>${escapeHtml(c || '')}</td>`;
                    }).join('');
                    return `<tr class="${rowBg}">${cells}</tr>`;
                }).join('');
                return `<div class="overflow-x-auto rounded-xl border border-[#c3d9ec]">
                    <table class="w-full ny-gtable">
                        ${headerRow ? `<thead>${headerRow}</thead>` : ''}
                        <tbody>${bodyRows}</tbody>
                    </table>
                </div>`;
            }).filter(Boolean).join('');
            play.innerHTML = `
                <div class="bg-white border border-slate-200 rounded-3xl p-6 space-y-4">
                    <div class="flex items-center justify-between">
                        <button onclick="resetGrammarFillSetup()" class="text-xs font-bold text-slate-400 hover:text-slate-600"><i class="fa-solid fa-arrow-left"></i> 나가기</button>
                        <span class="text-xs font-bold text-slate-500">${gfillState.index + 1} / ${gfillState.total}</span>
                    </div>
                    <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div class="h-full bg-indigo-500 transition-all" style="width:${(gfillState.index / gfillState.total * 100)}%"></div>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-lg shrink-0">${t.icon || '📋'}</span>
                        <h3 class="font-extrabold text-slate-900 text-sm">${escapeHtml(t.title || '(제목 없음)')}</h3>
                    </div>
                    <p class="text-[11px] font-bold text-indigo-400">✏️ 빈칸을 채워보세요 (엔터로 이동, 마지막 칸 엔터=채점)</p>
                    <div class="space-y-3">${blocksHtml}</div>
                    <div id="gfill-feedback" class="hidden space-y-1"></div>
                    <div class="flex justify-end">
                        <button id="gfill-action-btn" onclick="submitGrammarFillProblem()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95">채점하기</button>
                    </div>
                </div>
            `;
            setTimeout(() => { const first = document.getElementById('gfill-input-0'); if (first) first.focus(); }, 60);
        }

        // [냐냐 요청] 가려둔 설명·팁 열어보기 — 이 문제는 '힌트 봤음'으로 기록된다
        function revealGfillNote(bi) {
            const box = document.querySelector(`[data-gfill-note="${bi}"]`);
            if (!box) return;
            box.classList.add('gfill-note-revealed');
            if (gfillState) gfillState.hintUsed = true;
        }
        function revealAllGfillNotes() {
            document.querySelectorAll('[data-gfill-note]').forEach(el => el.classList.add('gfill-note-revealed'));
        }

        function gfillInputKeydown(e, idx) {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (gfillState && gfillState.phase === 'graded') { nextGrammarFillProblem(); return; }
            const total = gfillState && gfillState.current ? gfillState.current.blanks.length : 0;
            if (idx < total - 1) {
                const next = document.getElementById('gfill-input-' + (idx + 1));
                if (next) next.focus();
            } else {
                submitGrammarFillProblem();
            }
        }

        async function submitGrammarFillProblem() {
            if (!gfillState || !gfillState.current || gfillState.phase !== 'input') return;
            const t = gfillState.current.table;
            const blocks = gfillState.current.blocks;
            const blanks = gfillState.current.blanks;
            const answers = blanks.map((b, i) => { const el = document.getElementById('gfill-input-' + i); return el ? el.value.trim() : ''; });
            gfillState.phase = 'grading';
            const actionBtn = document.getElementById('gfill-action-btn');
            if (actionBtn) { actionBtn.disabled = true; actionBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> 채점 중...`; }

            // 각 빈칸에 문맥(어느 표인지, 행 대표값=강조열, 열 제목) 부여
            // [냐냐 요청] 노트에 표가 여러 개일 수 있으므로 '몇 번째 표'인지도 같이 보낸다
            const tableOrder = {};
            blocks.forEach((blk, bi) => { if (blk.type === 'table') tableOrder[bi] = Object.keys(tableOrder).length + 1; });
            const tableCount = Object.keys(tableOrder).length;
            const ctxItems = blanks.map((b, i) => {
                const blk = blocks[b.bi] || {};
                const hlCols = blk.highlightCols || [0];
                const rowLabel = ((blk.rows || [])[b.ri] && hlCols.length) ? (blk.rows[b.ri][hlCols[0]] || '') : '';
                // [냐냐 요청] 헤더가 여러 줄이면 위에서부터 이어 붙여서 보냄 ('인칭 - 단수')
                const colHeader = (typeof grammarColumnLabel === 'function') ? grammarColumnLabel(blk, b.ci) : '';
                const item = { index: i, rowLabel, column: colHeader, expected: b.expected, studentAnswer: answers[i] };
                if (tableCount > 1) item.table = `표 ${tableOrder[b.bi]}`;
                return item;
            });

            let graded = null;
            if (typeof hasGeminiApiKey === 'function' && hasGeminiApiKey()) {
                try {
                    const system = `You grade fill-in-the-blank answers in a Spanish grammar table for a Korean student. Be fair but NOT lenient.
Rules:
- Spanish text: accents/tildes MATTER (á é í ó ú ñ ü). Missing/wrong accent = INCORRECT. Ignore only capitalization and surrounding punctuation/whitespace.
- Cells may be TEMPLATE PATTERNS with placeholders/variables, e.g. "Hay [숫자] [algo/alguien]" or "verbo + -ando". For these, accept the student's answer if it expresses the SAME structure/pattern; equivalent placeholder wording is OK (e.g., brackets vs no brackets, "algo" vs "[algo]").
- Korean text: accept if the meaning matches in substance (paraphrases OK); ignore particles/spacing/punctuation.
- Empty answer = incorrect.
Return JSON only, no markdown.`;
                    const prompt = `Grammar table: "${t.title || ''}". Grade each blank cell. "rowLabel" is the row's key column, "column" is the column header, "expected" is the correct cell text, "studentAnswer" is what the student typed.\n${JSON.stringify(ctxItems)}\nReturn JSON: { "results": [ { "index": number, "correct": boolean, "correctAnswer": string } ] }`;
                    const schema = { type: "OBJECT", properties: { results: { type: "ARRAY", items: { type: "OBJECT", properties: { index: { type: "NUMBER" }, correct: { type: "BOOLEAN" }, correctAnswer: { type: "STRING" } }, required: ["index", "correct", "correctAnswer"] } } }, required: ["results"] };
                    const resp = await callGemini(prompt, system, schema, 'low');
                    const data = extractAndParseJson(resp);
                    graded = blanks.map((b, i) => {
                        const r = (data.results || []).find(x => x.index === i);
                        // [냐냐 요청] AI 가 그 칸을 빼먹으면 예전엔 무조건 오답이 됐다 → 기본 채점으로 넘긴다
                        if (!r) return { correct: fillLocalGrade({ language: 'es', expected: b.expected }, answers[i]), correctAnswer: b.expected };
                        return { correct: !!r.correct, correctAnswer: r.correctAnswer || b.expected };
                    });
                } catch (err) {
                    console.error(err);
                    showToast("AI 채점 실패 — 기본 채점으로 진행할게요", "error");
                }
            }
            if (!graded) {
                graded = blanks.map((b, i) => ({ correct: fillLocalGrade({ language: 'es', expected: b.expected }, answers[i]), correctAnswer: b.expected }));
            }
            graded = rescueExactMatches(graded, blanks, answers);

            const detail = blanks.map((b, i) => ({
                bi: b.bi, ri: b.ri, ci: b.ci,
                rowLabel: ctxItems[i].rowLabel, column: ctxItems[i].column,
                expected: b.expected, userAnswer: answers[i],
                correct: graded[i].correct, correctAnswer: graded[i].correctAnswer
            }));
            const allCorrect = detail.every(d => d.correct);
            gfillState.results.push({ table: t, blanks: detail, allCorrect, hintUsed: !!gfillState.hintUsed });

            // [냐냐 요청] 문법표 점수 반영 — 표 하나당 한 번, 정답률 기준
            //   100%→+1.5 / 80%→+0.5 / 70%→0 / 60%→−0.5 / 40% 이하→−1.5
            //   마스터 해제는 addGrammarScore 안에서 점수에 따라 자동으로 처리된다
            const wasMastered = (typeof masteredGrammar !== 'undefined') && !!masteredGrammar[t.id];
            let gDelta = 0;
            if (typeof addGrammarScore === 'function' && detail.length) {
                const rate = detail.filter(d => d.correct).length / detail.length;
                gDelta = grammarFillDelta(rate);
                addGrammarScore(t.id, gDelta);
                // [냐냐 요청] 빈칸은 못했을 때만 곡선을 건드린다 (70% 미만).
                //   잘 봤다고 앞으로 밀어주진 않는다 — 문법 복습은 번역으로 하는 거라서.
                // [냐냐 기준] 여기서는 '들여놓기' 까지만 한다. 이미 곡선 안에 있는 표의 칸은
                //   복습 배너로 시작한 번역 미션에서만 움직인다.
                if (rate < 0.7 && typeof grammarReviewEnter === 'function') grammarReviewEnter(t.id);
            }
            const unmastered = wasMastered && !masteredGrammar[t.id];
            if (unmastered) showToast(`"${t.title || '이 표'}" 마스터가 해제됐어요 ⚠️`, "warning");
            gfillState.lastUnmastered = unmastered;
            gfillState.lastScoreDelta = gDelta;

            // [냐냐 요청] '단어 연결'이 된 칸은 단어 점수도 같이 움직인다 — 정답 +1.5 / 오답 -2.
            //   단어 빈칸 복습(+0.7/-0.5)보다 세게 매긴다. 뜻을 보고 스페인어를 직접 쓰는 거라
            //   더 어렵고, 틀렸으면 확실히 모르는 것으로 본다.
            //   연결이 없는 칸은 안 건드린다. 문법 구조 표(소유형용사·목적격 대명사 등)는 연결을
            //   안 해두니까 자동으로 제외되고, 단어 시험처럼 쓰는 표만 반영된다.
            gfillState.lastWordScores = [];
            if (typeof getCellWord === 'function' && typeof addWordScore === 'function') {
                const acc = {};   // {단어id: {w, delta, allCorrect, anyCorrect}}
                detail.forEach(d => {
                    const blk = blocks[d.bi];
                    if (!blk || blk.type !== 'table') return;
                    const w = getCellWord(t.id, blk.id, d.ri, d.ci);
                    if (!w) return;
                    const a = acc[w.id] || (acc[w.id] = { w, delta: 0, allCorrect: true, anyCorrect: false, nRight: 0, nWrong: 0 });
                    a.delta += d.correct ? 1.5 : -2;
                    if (d.correct) { a.anyCorrect = true; a.nRight++; } else { a.allCorrect = false; a.nWrong++; }
                });
                Object.keys(acc).forEach(id => {
                    const a = acc[id];
                    a.delta = Math.round(a.delta * 100) / 100;
                    // [냐냐 요청] 정답·오답 횟수는 칸 하나당 하나씩 센다 (정답률 배지에 쓰이는 숫자).
                    //   한 단어가 한 칸만 걸려 있으면 지금까지와 똑같고, 여러 칸에 걸어두면 푼 만큼 센다.
                    //   correct 는 그대로 '전부 맞았나' — 복습 대상 판정(lastWrongDate)은 한 칸이라도
                    //   틀리면 걸리는 게 맞다.
                    addWordScore(id, a.delta, {
                        correct: a.allCorrect, subjective: true,
                        correctCount: a.nRight, wrongCount: a.nWrong
                    });
                    // [냐냐 요청] 표에서 그 단어를 직접 써서 맞혔으면 주관식 정답으로 인정한다 (마스터 자격).
                    //   ⚠️ addWordScore 는 correct===true 일 때만 subjective 를 반영해서, 한 단어가
                    //      여러 칸에 걸려 있고 그중 하나만 틀리면 정작 맞힌 칸이 인정을 못 받았다.
                    //      단어 빈칸 복습(wordBlankPassed)과 같은 방식으로 맞춘다.
                    //   세운 뒤 syncWordFlags 를 다시 불러야 마스터 플래그와 일지 카운트가 그 자리에서 갱신된다
                    //   (addWordScore 안의 syncWordFlags 는 subjectivePassed 를 세우기 전에 이미 지나갔다)
                    if (a.anyCorrect && !a.w.subjectivePassed) {
                        a.w.subjectivePassed = true;
                        if (typeof syncWordFlags === 'function') syncWordFlags(a.w);
                    }
                    gfillState.lastWordScores.push({ word: a.w.word, delta: a.delta });
                });
            }

            if (typeof logAction === 'function') logAction('review');

            applyGrammarFillResults(detail);
            gfillState.phase = 'graded';
        }

        function applyGrammarFillResults(detail) {
            revealAllGfillNotes();   // [냐냐 요청] 채점하면 가려뒀던 설명·팁을 다 열어준다
            detail.forEach((d, i) => {
                const el = document.getElementById('gfill-input-' + i);
                if (!el) return;
                el.disabled = true;
                el.classList.remove('border-indigo-300', 'bg-indigo-50/40');
                if (d.correct) el.classList.add('border-emerald-400', 'bg-emerald-50', 'text-emerald-700');
                else el.classList.add('border-red-400', 'bg-red-50', 'text-red-600', 'line-through');
                markBlankAnswer(el, d);
            });
            const fb = document.getElementById('gfill-feedback');
            if (fb) {
                fb.classList.remove('hidden');
                // [냐냐 PATCH-0배치] 마스터 해제 알림 배너
                const unmasterBanner = (gfillState && gfillState.lastUnmastered)
                    ? `<div class="bg-amber-50 border border-amber-300 text-amber-800 rounded-xl px-3 py-2 text-[11px] font-bold mb-1.5"><i class="fa-solid fa-triangle-exclamation"></i> 마스터했던 표라서 <b>마스터가 해제됐어요.</b> 다시 정복해봐요!</div>`
                    : '';
                // [냐냐 요청] 이번 복습으로 문법표 점수가 얼마나 움직였는지
                const d = gfillState ? gfillState.lastScoreDelta : 0;
                const okCnt = detail.filter(x => x.correct).length;
                const scoreBanner = (typeof d === 'number' && detail.length)
                    ? `<div class="rounded-xl px-3 py-2 text-[11px] font-bold mb-1.5 border ${d > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : d < 0 ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-200 text-slate-500'}">
                        <i class="fa-solid fa-chart-line"></i> ${okCnt}/${detail.length} 정답 (${Math.round(okCnt / detail.length * 100)}%) →
                        문법표 점수 <b>${d > 0 ? '+' : ''}${d}</b>${d === 0 ? ' (변화 없음)' : ''}
                       </div>`
                    : '';
                // [냐냐 요청] 힌트(설명·팁)를 열어봤으면 표시해 준다
                const hintBanner = (gfillState && gfillState.hintUsed)
                    ? `<div class="bg-slate-50 border border-slate-200 text-slate-500 rounded-xl px-3 py-2 text-[11px] font-bold mb-1.5"><i class="fa-solid fa-eye"></i> 이 문제는 <b>힌트를 봤어요.</b></div>`
                    : '';
                // [냐냐 요청] 단어 연결이 된 칸이 있었으면 어느 단어가 얼마나 움직였는지도 알려준다
                const ws = (gfillState && gfillState.lastWordScores) || [];
                const wordBanner = ws.length
                    ? `<div class="bg-violet-50 border border-violet-200 text-violet-700 rounded-xl px-3 py-2 text-[11px] font-bold mb-1.5">
                        <i class="fa-solid fa-link"></i> 이어둔 단어 점수도 반영했어요 —
                        ${ws.map(x => `${escapeHtml(x.word)} <b>${x.delta > 0 ? '+' : ''}${x.delta}</b>`).join(' · ')}
                       </div>`
                    : '';
                fb.innerHTML = scoreBanner + wordBanner + unmasterBanner + hintBanner + detail.map(d => {
                    const label = [d.rowLabel, d.column].filter(Boolean).map(escapeHtml).join(' · ');
                    const icon = d.correct ? '<span class="text-emerald-500 font-black">✓</span>' : '<span class="text-red-500 font-black">✗</span>';
                    // [냐냐 요청] 문법표 칸은 전부 스페인어라 철자 오류면 바로 짚어준다
                    const df = d.correct ? null : blankDiffHtml(d.userAnswer, d.correctAnswer);
                    const mine = df ? df.mine : escapeHtml(d.userAnswer || '(빈칸)');
                    const ans = d.correct ? '' : ` <span class="text-slate-400">→ 정답:</span> <b class="text-slate-800">${df ? df.answer : escapeHtml(d.correctAnswer)}</b>`;
                    return `<div class="text-[11px] flex items-baseline gap-1.5"><span class="font-bold text-slate-400 shrink-0">${label || '칸'}</span>${icon}<span class="text-slate-500">${mine}</span>${ans}</div>`;
                }).join('');
            }
            const btn = document.getElementById('gfill-action-btn');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = (gfillState.index + 1 >= gfillState.total) ? '결과 보기 →' : '다음 →';
                btn.setAttribute('onclick', 'nextGrammarFillProblem()');
                setTimeout(() => btn.focus(), 40);
            }
        }

        function nextGrammarFillProblem() {
            if (!gfillState) return;
            gfillState.index++;
            if (gfillState.index >= gfillState.pool.length) { endGrammarFillReview(); return; }
            renderGrammarFillProblem();
        }

        function endGrammarFillReview() {
            const results = gfillState ? gfillState.results : [];
            const total = results.length;
            const correct = results.filter(r => r.allCorrect).length;
            const masterCandidates = results.filter(r => r.allCorrect && r.table && !masteredGrammar[r.table.id]).map(r => r.table);
            gfillState = null;

            let listHtml = '';
            results.forEach(r => {
                const icon = r.allCorrect ? '<span class="text-emerald-500">✓</span>' : '<span class="text-red-400">✗</span>';
                const wrongN = r.blanks.filter(b => !b.correct).length;
                const sub = r.allCorrect ? '<span class="text-emerald-600 text-xs">다 맞힘</span>' : `<span class="text-slate-400 text-xs">${wrongN}칸 틀림</span>`;
                listHtml += `<div class="flex items-baseline justify-between bg-white rounded-xl px-3 py-2 border border-slate-100"><span class="font-bold text-slate-800">${icon} ${escapeHtml(r.table.icon || '📋')} ${escapeHtml(r.table.title || '')}</span>${sub}</div>`;
            });

            let masteryHtml = '';
            if (masterCandidates.length > 0) {
                masteryHtml = `
                    <div id="gfill-mastery-box" class="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2 text-left">
                        <div class="flex items-center justify-between">
                            <p class="text-xs font-black text-emerald-700">🏆 다 맞힌 표, 마스터로 등록할까요?</p>
                            <label class="text-[11px] font-bold text-emerald-600 flex items-center gap-1 cursor-pointer"><input type="checkbox" id="gfill-master-all" onchange="gfillMasterToggleAll(this)"> 전체</label>
                        </div>
                        <div class="space-y-1">${masterCandidates.map(t => `<label class="flex items-center gap-2 bg-white/70 rounded-lg px-2 py-1 cursor-pointer"><input type="checkbox" class="gfill-master-chk" data-id="${t.id}"><span class="text-xs font-bold text-slate-700">${escapeHtml(t.icon || '📋')} ${escapeHtml(t.title || '')}</span></label>`).join('')}</div>
                        <button onclick="applyGrammarFillMastery()" class="w-full mt-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-xs font-bold transition-all">선택 표 마스터하기</button>
                    </div>`;
            }

            const play = document.getElementById('gfill-play-area');
            play.innerHTML = `
                <div class="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-4">
                    <div class="text-6xl">${correct === total ? '🎉' : '💪'}</div>
                    <h3 class="text-xl font-black text-slate-900">문법표 복습 완료!</h3>
                    <p class="text-sm text-slate-500">${total}개 표 중 <b class="text-emerald-600">${correct}개</b> 완벽하게 채웠어요! (${total ? Math.round(correct / total * 100) : 0}%)</p>
                    ${masteryHtml}
                    <div class="text-left space-y-1.5 max-h-72 overflow-y-auto">
                        <p class="text-xs font-bold text-slate-500 mb-1">복습한 문법표</p>
                        ${listHtml}
                    </div>
                    <div class="flex gap-2 justify-center pt-2">
                        <button onclick="resetGrammarFillSetup()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all">다시 복습</button>
                    </div>
                </div>
            `;
            if (typeof updateStats === 'function') updateStats();
        }

        function gfillMasterToggleAll(cb) {
            document.querySelectorAll('.gfill-master-chk').forEach(c => { c.checked = cb.checked; });
        }
        function applyGrammarFillMastery() {
            const ids = [...document.querySelectorAll('.gfill-master-chk:checked')].map(c => c.dataset.id);
            if (ids.length === 0) { showToast("선택된 표가 없어요", "error"); return; }
            let n = 0;
            ids.forEach(id => { if (!masteredGrammar[id]) { masteredGrammar[id] = true; if (typeof logAction === 'function') logAction('new-grammar-mastered'); n++; } });
            saveToStorage();
            if (typeof updateStats === 'function') updateStats();
            if (typeof renderGrammarTables === 'function') renderGrammarTables();
            showToast(`${n}개 표 마스터 완료! 🏆`, "success");
            document.getElementById('gfill-mastery-box')?.classList.add('hidden');
        }
