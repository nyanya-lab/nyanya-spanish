        // ============================================================
        // [냐냐 요청] 스페인어 칸은 한글 자판으로 쳐도 스페인어(스페인) 자판처럼 들어간다 (2026-09-23).
        //   웹페이지는 한/영 전환을 대신 못 누른다. 그래서 들어온 글자를 '같은 키 자리' 의 글자로 바꾼다.
        //   - 한글 → 알파벳: 두벌식은 키와 자모가 1:1 이라 '안녕' → 'dkssud' 로 정확히 돌아간다.
        //   - 기호 → 스페인 자판 자리: ; → ñ · ' → 악센트(다음 모음에 붙는다) · = → ¡ · Shift+= → ¿ …
        //     기호는 키를 누를 때(keydown) 키 자리(e.code)로 가른다. 글자로 가르면 진짜 스페인어 자판으로
        //     친 ';' '?' 까지 바꿔버린다 — 스페인 자판이면 e.key 가 이미 'ñ' 'Dead' 라서 그대로 둔다.
        //   - 한글 조합 중에는 손대지 않는다 (조합 중에 값을 바꾸면 글자가 겹쳐 들어간다).
        //     조합이 끝나는 순간(compositionend)과 조합 밖 입력(input)에서 바꾼다.
        //   - 조합 중에 엔터를 치면 그 엔터는 잠깐 붙잡았다가, 글자를 다 바꾼 뒤 다시 보낸다.
        //   붙이는 곳: data-es 가 달린 칸 (스페인어 답을 쓰는 칸만. 한국어 칸·검색창은 안 붙인다)
        // ============================================================
        (function () {
            const ES_JAMO = {
                'ㄱ': 'r', 'ㄲ': 'R', 'ㄳ': 'rt', 'ㄴ': 's', 'ㄵ': 'sw', 'ㄶ': 'sg', 'ㄷ': 'e', 'ㄸ': 'E',
                'ㄹ': 'f', 'ㄺ': 'fr', 'ㄻ': 'fa', 'ㄼ': 'fq', 'ㄽ': 'ft', 'ㄾ': 'fx', 'ㄿ': 'fv', 'ㅀ': 'fg',
                'ㅁ': 'a', 'ㅂ': 'q', 'ㅃ': 'Q', 'ㅄ': 'qt', 'ㅅ': 't', 'ㅆ': 'T', 'ㅇ': 'd', 'ㅈ': 'w', 'ㅉ': 'W',
                'ㅊ': 'c', 'ㅋ': 'z', 'ㅌ': 'x', 'ㅍ': 'v', 'ㅎ': 'g',
                'ㅏ': 'k', 'ㅐ': 'o', 'ㅑ': 'i', 'ㅒ': 'O', 'ㅓ': 'j', 'ㅔ': 'p', 'ㅕ': 'u', 'ㅖ': 'P',
                'ㅗ': 'h', 'ㅘ': 'hk', 'ㅙ': 'ho', 'ㅚ': 'hl', 'ㅛ': 'y', 'ㅜ': 'n', 'ㅝ': 'nj', 'ㅞ': 'np',
                'ㅟ': 'nl', 'ㅠ': 'b', 'ㅡ': 'm', 'ㅢ': 'ml', 'ㅣ': 'l'
            };
            const L = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
            const V = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
            const T = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ',
                       'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
            const DEAD_ACUTE = '´', DEAD_DIAER = '¨';
            const ACUTE = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', A: 'Á', E: 'É', I: 'Í', O: 'Ó', U: 'Ú' };
            const DIAER = { a: 'ä', e: 'ë', i: 'ï', o: 'ö', u: 'ü', A: 'Ä', E: 'Ë', I: 'Ï', O: 'Ö', U: 'Ü' };

            //   키 자리(e.code) → [영어 자판에서 찍히는 글자(보통, Shift), 스페인 자판 글자(보통, Shift)]
            //   스페인 글자가 null 이면 영어와 같다 (손대지 않음)
            const ES_SYMBOLS = {
                Semicolon:    [';', ':', 'ñ', 'Ñ'],
                Quote:        ["'", '"', DEAD_ACUTE, DEAD_DIAER],
                Equal:        ['=', '+', '¡', '¿'],
                Minus:        ['-', '_', "'", '?'],
                Slash:        ['/', '?', '-', '_'],
                Comma:        [',', '<', null, ';'],
                Period:       ['.', '>', null, ':'],
                BracketLeft:  ['[', '{', '`', '^'],
                BracketRight: [']', '}', '+', '*'],
                Backslash:    ['\\', '|', 'ç', 'Ç'],
                Backquote:    ['`', '~', 'º', 'ª'],
                Digit2:       ['2', '@', null, '"'],
                Digit3:       ['3', '#', null, '·'],
                Digit6:       ['6', '^', null, '&'],
                Digit7:       ['7', '&', null, '/'],
                Digit8:       ['8', '*', null, '('],
                Digit9:       ['9', '(', null, ')'],
                Digit0:       ['0', ')', null, '=']
            };

            function hangulToKeys(str) {
                let out = '';
                for (const ch of String(str)) {
                    const c = ch.charCodeAt(0);
                    if (c >= 0xAC00 && c <= 0xD7A3) {
                        const n = c - 0xAC00;
                        out += ES_JAMO[L[Math.floor(n / 588)]] + ES_JAMO[V[Math.floor((n % 588) / 28)]] + (T[n % 28] ? ES_JAMO[T[n % 28]] : '');
                    } else out += (ES_JAMO[ch] !== undefined ? ES_JAMO[ch] : ch);
                }
                return out;
            }
            //   전체 변환: 한글 → 키 글자, 그 다음 악센트 자리표 + 모음 → 악센트 모음
            function esKeysConvert(str) {
                return hangulToKeys(str)
                    .replace(new RegExp(DEAD_ACUTE + '([aeiouAEIOU])', 'g'), (m, v) => ACUTE[v])
                    .replace(new RegExp(DEAD_DIAER + '([aeiouAEIOU])', 'g'), (m, v) => DIAER[v]);
            }
            window.esKeysConvert = esKeysConvert;

            //   키 하나를 스페인 자판 글자로 (영어·한글 자판일 때만. 스페인 자판이면 null)
            //   돌려주는 값: 넣을 글자 (악센트 키면 자리표 ´ ¨), 또는 null
            function esCharForKey(e) {
                const m = ES_SYMBOLS[e.code];
                if (!m) return null;
                const us = e.shiftKey ? m[1] : m[0];
                if (e.key !== us && e.key !== 'Process') return null;   // 스페인 자판(또는 다른 자판)이다
                const es = e.shiftKey ? m[3] : m[2];
                return (es == null || es === us) ? null : es;
            }
            //   행맨처럼 칸 없이 키만 받는 곳에서 쓴다 — 키 자리로 스페인 글자 하나 (악센트 키는 자리표)
            window.esKeyChar = function (e) {
                if (/^Key[A-Z]$/.test(e.code) && (e.key === 'Process' || /[ㄱ-ㅣ]/.test(e.key))) {
                    const ch = e.code.slice(3).toLowerCase();
                    return e.shiftKey ? ch.toUpperCase() : ch;
                }
                return esCharForKey(e);
            };
            window.ES_DEAD_ACUTE = DEAD_ACUTE;
            window.esApplyDead = function (dead, vowel) {
                const t = dead === DEAD_DIAER ? DIAER : ACUTE;
                return t[vowel] || null;
            };

            //   [냐냐 요청] PC 에서만 (2026-09-23). 폰은 한글 자판 배열이 제각각이라 키 자리 짝이 안 맞고,
            //   조합을 끊으려고 포커스를 빼면 폰 자판이 내려가 버린다. 폰은 자판을 직접 바꿔 쓴다.
            const ES_KEYS_ON = !(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
            const isEsField = (el) => ES_KEYS_ON && el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')
                && el.hasAttribute('data-es') && !el.readOnly && !el.disabled;
            const composing = new WeakSet();
            window.esKeysComposing = (el) => composing.has(el);

            //   칸 값을 지금 바꾼다. 글자 수가 바뀌니 커서 자리도 앞부분을 바꾼 길이로 다시 잡는다.
            function convertField(el) {
                let v = el.value;
                let caret = (typeof el.selectionStart === 'number') ? el.selectionStart : v.length;
                //   조합 중에 친 기호는 영어 글자로 들어와 있다 — 커서 바로 앞 그 글자를 스페인 글자로.
                //   ⚠️ 조합이 끝나는 순간엔 아직 안 들어왔을 수 있어서, 들어올 때까지 1초 기다린다
                const pend = el._esPending;
                if (pend && Date.now() - pend.at > 1000) el._esPending = null;
                else if (pend && caret > 0 && v[caret - 1] === pend.us) {
                    const isDead = pend.es === DEAD_ACUTE || pend.es === DEAD_DIAER;
                    v = v.slice(0, caret - 1) + (isDead ? '' : pend.es) + v.slice(caret);
                    if (isDead) { caret--; setDead(el, pend.es, v.length); }
                    el._esPending = null;
                }
                let nv = esKeysConvert(v);
                caret = Math.min(caret, v.length);
                let newCaret = esKeysConvert(v.slice(0, caret)).length;
                //   악센트 키를 누른 뒤 새로 들어온 첫 글자가 모음이면 악센트를 얹는다
                const dead = el._esDead;
                if (dead && nv.length > dead.len) {
                    const t = dead.ch === DEAD_DIAER ? DIAER : ACUTE;
                    const ch = nv[newCaret - 1];
                    if (newCaret > 0 && t[ch]) nv = nv.slice(0, newCaret - 1) + t[ch] + nv.slice(newCaret);
                    el._esDead = null;
                }
                if (nv === el.value) return false;
                el.value = nv;
                try { el.setSelectionRange(newCaret, newCaret); } catch (e) {}
                return true;
            }
            //   악센트 키는 칸에 아무것도 안 넣고 기억만 해둔다 (한 칸 한 글자인 십자말풀이도 되게)
            function setDead(el, ch, len) { el._esDead = { ch, len: (len == null ? el.value.length : len) }; }

            function insertAtCaret(el, text) {
                const s = el.selectionStart, e = el.selectionEnd;
                el.setRangeText(text, s, e, 'end');
                convertField(el);
                el.dispatchEvent(new Event('input', { bubbles: true }));
            }

            //   [냐냐 요청] 치자마자 바꾼다 (2026-09-23) — 한글 조합이 시작되면 그 자리에서 끊는다.
            //   포커스를 잠깐 빼면 브라우저가 조합을 확정하고(compositionend) 거기서 바꾼다.
            //   글자가 '호' 로 뭉칠 틈이 없어서, 한 키 = 한 글자로 바로 바뀐다.
            //   ⚠️ 칸 주인이 그사이 다른 칸으로 옮겨갔으면(십자말풀이) 되돌아오지 않는다.
            function commitComposition(el) {
                el.blur();
                const a = document.activeElement;
                if (!a || a === document.body) el.focus();
            }

            document.addEventListener('compositionstart', (e) => {
                if (isEsField(e.target)) composing.add(e.target);
            }, true);
            document.addEventListener('compositionend', (e) => {
                const el = e.target;
                if (!isEsField(el)) return;
                composing.delete(el);
                //   조합이 끝난 뒤엔 input 이 안 올 수 있다 — 칸 주인에게 바뀐 값을 알려준다
                convertField(el);
                el.dispatchEvent(new Event('input', { bubbles: true }));
            }, true);
            document.addEventListener('input', (e) => {
                const el = e.target;
                if (!isEsField(el) || !e.isTrusted) return;
                if (e.isComposing || composing.has(el)) {
                    e.stopImmediatePropagation();   // 칸 주인은 바뀐 값만 받는다 (compositionend 가 다시 보낸다)
                    commitComposition(el);
                    return;
                }
                convertField(el);
            }, true);

            let synthEnterAt = 0;
            document.addEventListener('keydown', (e) => {
                const el = e.target;
                if (!isEsField(el) || !e.isTrusted) return;
                if (e.ctrlKey || e.metaKey || e.altKey) return;
                const isEnter = e.code === 'Enter' || e.code === 'NumpadEnter';
                if (isEnter) {
                    //   방금 붙잡았다 다시 보낸 엔터의 짝이 뒤늦게 또 오면 버린다 (두 번 채점되지 않게)
                    if (Date.now() - synthEnterAt < 250) { e.preventDefault(); e.stopImmediatePropagation(); return; }
                    if (e.isComposing || e.keyCode === 229) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        setTimeout(() => {
                            composing.delete(el);
                            convertField(el);
                            synthEnterAt = Date.now();
                            el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: e.code, shiftKey: e.shiftKey, bubbles: true, cancelable: true }));
                        }, 30);
                        return;
                    }
                    convertField(el);   // 채점 전에 남은 한글을 바꿔둔다
                    return;
                }
                const es = esCharForKey(e);
                if (!es) return;
                if (e.key === 'Process') {
                    //   조합 중이라 막을 수 없다 — 영어 글자가 들어온 뒤 바꾼다
                    const m = ES_SYMBOLS[e.code];
                    el._esPending = { us: e.shiftKey ? m[1] : m[0], es, at: Date.now() };
                    return;
                }
                e.preventDefault();
                if (es === DEAD_ACUTE || es === DEAD_DIAER) { setDead(el, es); return; }
                insertAtCaret(el, es);
            }, true);
        })();
