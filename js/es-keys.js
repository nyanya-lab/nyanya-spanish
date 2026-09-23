        // ============================================================
        // [냐냐 요청] 스페인어 칸은 영어 자판으로 쳐도 스페인어(스페인) 자판처럼 들어간다 (2026-09-23).
        //   ; → ñ · ' → 악센트(다음 모음에 붙는다) · = → ¡ · Shift+= → ¿ · - → ' · Shift+- → ? …
        //   키 자리(e.code)와 찍힌 글자(e.key)로 가른다 — 진짜 스페인어 자판으로 치면 e.key 가 이미
        //   'ñ' 'Dead' 라서 손대지 않는다. 글자로 가르면 스페인 자판의 ';' '?' 까지 바꿔버린다.
        //   붙이는 곳: 지금은 모든 글 칸 (아래 ES_KEYS_EVERYWHERE). 끄면 data-es 가 달린 스페인어 칸만.
        //
        //   ⚠️ 한글 자판으로 친 것을 바꾸는 건 두 번 해보고 걷어냈다 (2026-09-23).
        //   한글 입력기가 키를 먼저 쥐고 글자를 조립해서, 웹페이지는 조립이 끝난 뒤에야 손댈 수 있다.
        //   - 조립이 끝난 뒤 바꾸기: 한 박자 늦게 바뀌어서 불편했다.
        //   - 조립을 강제로 끊기(포커스를 뺐다 되돌리기): 입력기가 자리를 잘못 기억해서 커서가 튀고
        //     뒷글자가 지워졌다.
        //   한/영 을 눌러 영어로 쳐야 한다. 폰은 자판을 직접 바꾸니 끈다 (pointer: coarse).
        // ============================================================
        (function () {
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

            //   키 하나를 스페인 자판 글자로 (영어 자판일 때만. 스페인 자판이면 null)
            //   돌려주는 값: 넣을 글자 (악센트 키면 ´ ¨), 또는 null
            function esCharForKey(e) {
                const m = ES_SYMBOLS[e.code];
                if (!m) return null;
                const us = e.shiftKey ? m[1] : m[0];
                if (e.key !== us) return null;   // 스페인 자판(또는 한글 조합 중)이다
                const es = e.shiftKey ? m[3] : m[2];
                return (es == null || es === us) ? null : es;
            }
            //   행맨처럼 칸 없이 키만 받는 곳에서 쓴다 — 키 자리로 스페인 글자 하나 (악센트 키는 ´ ¨).
            //   칸이 없으니 한글 조합이 안 생긴다 — 한글 자판이어도 키 자리(KeyA → a)로 읽으면 된다.
            window.esKeyChar = function (e) {
                if (/^Key[A-Z]$/.test(e.code) && (e.key === 'Process' || /[ㄱ-ㅣ]/.test(e.key))) {
                    const ch = e.code.slice(3).toLowerCase();
                    return e.shiftKey ? ch.toUpperCase() : ch;
                }
                if (e.key === 'Process' && ES_SYMBOLS[e.code]) {
                    const m = ES_SYMBOLS[e.code];
                    return (e.shiftKey ? m[3] : m[2]) || null;
                }
                return esCharForKey(e);
            };
            window.esApplyDead = function (dead, vowel) {
                const t = dead === DEAD_DIAER ? DIAER : ACUTE;
                return t[vowel] || null;
            };

            const ES_KEYS_ON = !(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
            //   [냐냐 요청] 우선 사이트 모든 글 칸에 켠다 (2026-09-23) — 써보고 한국어 칸을 뺄지 정하기로.
            //   ⚠️ 한국어 칸에서도 기호가 바뀐다 (/ → -, ~ → ª, ( → ) …). false 로 두면 data-es 칸만.
            //   비밀번호·API 키(type=password)와 동기화 주소(data-no-es)는 늘 뺀다 — 틀리면 동기화가 끊긴다.
            const ES_KEYS_EVERYWHERE = true;
            const isEsField = (el) => {
                if (!ES_KEYS_ON || !el || el.readOnly || el.disabled || el.hasAttribute('data-no-es')) return false;
                const textLike = el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'search'));
                if (!textLike) return false;
                return ES_KEYS_EVERYWHERE || el.hasAttribute('data-es');
            };

            //   악센트 키는 칸에 아무것도 안 넣고 기억만 했다가, 다음에 들어온 첫 글자가 모음이면 얹는다
            //   (한 칸 한 글자인 십자말풀이에서도 되게)
            document.addEventListener('input', (e) => {
                const el = e.target;
                if (!isEsField(el) || !e.isTrusted || e.isComposing) return;
                const dead = el._esDead;
                if (!dead || el.value.length <= dead.len) return;
                el._esDead = null;
                const caret = el.selectionStart;
                const t = dead.ch === DEAD_DIAER ? DIAER : ACUTE;
                const ch = el.value[caret - 1];
                if (caret > 0 && t[ch]) {
                    el.value = el.value.slice(0, caret - 1) + t[ch] + el.value.slice(caret);
                    el.setSelectionRange(caret, caret);
                }
            }, true);

            document.addEventListener('keydown', (e) => {
                const el = e.target;
                if (!isEsField(el) || !e.isTrusted || e.isComposing) return;
                if (e.ctrlKey || e.metaKey || e.altKey) return;
                const es = esCharForKey(e);
                if (!es) return;
                e.preventDefault();
                if (es === DEAD_ACUTE || es === DEAD_DIAER) { el._esDead = { ch: es, len: el.value.length }; return; }
                el.setRangeText(es, el.selectionStart, el.selectionEnd, 'end');
                el._esDead = null;
                el.dispatchEvent(new Event('input', { bubbles: true }));
            }, true);
        })();
