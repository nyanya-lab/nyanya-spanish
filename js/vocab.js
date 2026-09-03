// [냐냐 PATCH] 악센트 제거 (á→a, ó→o, ñ→n 등) — 검색 시 악센트 무시용
        function stripAccents(str) {
            return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        }

        // [냐냐 PATCH] 입력창 전체 지우기 (X 버튼)
        function clearInputField(id) {
            const el = document.getElementById(id);
            if (el) { el.value = ''; el.focus(); }
        }

        function togglePosFields() {
            const pos = document.getElementById('input-pos').value;
            const nounDetails = document.getElementById('field-noun-details');
            const verbConjugations = document.getElementById('field-verb-conjugations');
            const adjDetails = document.getElementById('field-adj-details');

            if (pos === 'noun') {
                nounDetails.classList.remove('hidden');
                verbConjugations.classList.add('hidden');
                adjDetails.classList.add('hidden');
            } else if (pos === 'verb') {
                nounDetails.classList.add('hidden');
                verbConjugations.classList.remove('hidden');
                adjDetails.classList.add('hidden');
            } else if (pos === 'adjective') {
                nounDetails.classList.add('hidden');
                verbConjugations.classList.add('hidden');
                adjDetails.classList.remove('hidden');
            } else {
                nounDetails.classList.add('hidden');
                verbConjugations.classList.add('hidden');
                adjDetails.classList.add('hidden');
            }
        }

        // [냐냐 PATCH] 동사 시제: 관용구처럼 '시제 블록'을 +/− 로 추가/삭제.
        //   각 블록 = 시제종류 select + 규칙/불규칙 select + 불규칙유형 select + AI추천 + 삭제 + 입력칸(6인칭 또는 현재분사 1칸)
        const CONJ_PERSON_KEYS = ['yo','tu','el','nos','vos','ellos'];
        const CONJ_PERSON_LABELS = ['yo (나)','tú (너)','él/ella','nosotros','vosotros','ellos/ellas'];
        const SINGLE_TENSES = ['gerundio', 'participio']; // 6인칭이 아니라 1칸만 있는 특수 시제
        // 시제 종류 (틀 — 나중에 자유롭게 추가/수정 가능)
        const TENSE_TYPE_OPTIONS = [
            { key: 'presente', label: '직설법 현재' },
            { key: 'indefinido', label: '직설법 부정과거' },
            { key: 'imperfecto', label: '직설법 불완료과거' },
            { key: 'futuro', label: '직설법 미래' },
            { key: 'condicional', label: '조건법' },
            { key: 'subjPresente', label: '접속법 현재' },
            { key: 'subjImperfecto', label: '접속법 불완료과거' },
            { key: 'imperativo', label: '명령법' },
            { key: 'gerundio', label: '현재분사 (gerundio · 1칸)' },
            { key: 'participio', label: '과거분사 (participio · 1칸)' },
            // [냐냐 요청] 현재진행은 넣지 않는다 — estar+현재분사라 새로 볼 게 없고,
            //   조회 화면에서도 퀴즈에서도 자리만 차지했다.
        ];
        // 불규칙 유형 (틀 — 학습하며 나중에 채우기)
        const IRREGULAR_TYPE_OPTIONS = ['none','1인칭','e ➡️ ie','o ➡️ ue','e ➡️ i','완전 불규칙','1인칭 및 e ➡️ ie','1인칭 및 e ➡️ i','1인칭 및 o ➡️ ue','기타 변형'];
        // [냐냐 요청] 현재분사는 불규칙 갈래가 현재시제와 아예 달라서 목록을 따로 쓴다.
        //   e➡️i: pedir→pidiendo · decir→diciendo · reír→riendo
        //   o➡️u: dormir→durmiendo · poder→pudiendo
        //   -yendo: 어간이 모음으로 끝남 (leer→leyendo · oír→oyendo · ir→yendo)
        // [냐냐 요청] 과거분사는 현재분사처럼 '어간이 이렇게 바뀐다' 는 갈래가 없다.
        //   -to(abierto·escrito·puesto) 와 -cho(dicho·hecho) 로 나눠봤지만 외울 때 도움이 안 돼서
        //   갈래를 둘로 줄였다 — 그냥 '불규칙' 과, 규칙형·불규칙형을 둘 다 쓰는 것.
        //   (imprimir→imprimido/impreso, freír→freído/frito 처럼 두 꼴이 다 살아 있는 동사)
        const IRREGULAR_TYPES_BY_TENSE = {
            gerundio: ['none', 'e ➡️ i', 'o ➡️ u', '-yendo', '기타 변형'],
            participio: ['none', '불규칙', '두 꼴 다 씀'],
        };
        function irregularTypesFor(tense) { return IRREGULAR_TYPES_BY_TENSE[tense] || IRREGULAR_TYPE_OPTIONS; }
        function irrOptionsHtml(tense, cur) {
            const list = irregularTypesFor(tense);
            const val = list.includes(cur) ? cur : 'none';
            return list.map(o => `<option value="${o}" ${o === val ? 'selected' : ''}>${o === 'none' ? '- 형태 -' : o}</option>`).join('');
        }

        // [냐냐 요청] AI에게 활용을 물어볼 때 공통으로 붙이는 규칙 (블록별 추천 + 일괄 추가가 같이 씀)
        //   ⚠️ 재귀동사는 단어장이 재귀대명사를 포함해서 저장한다 (secarse → "me seco").
        //      현재분사도 같은 규칙으로 대명사를 붙인 형태여야 한다 (secarse → "secándose").
        const REFLEXIVE_RULE = `If the infinitive ends in -se it is REFLEXIVE and the reflexive pronoun MUST be kept:
- conjugated tenses put the pronoun before the verb (secarse → "me seco / te secas / se seca / nos secamos / os secáis / se secan", levantarse → "me levanto")
- the gerundio attaches it to the end with the written accent (secarse → "secándose", levantarse → "levantándose", dormirse → "durmiéndose", irse → "yéndose")
Never drop the pronoun for a reflexive verb.`;
        // [냐냐 요청] 과거분사는 재귀대명사를 붙이지 않는다. 대명사는 haber 앞에 간다
        //   (levantarse → "me he levantado", 분사 자체는 "levantado").
        //   현재분사(secándose)와 반대라서 따로 못박아 둔다.
        const PARTICIPIO_RULE_PROMPT = `You are a precise Spanish conjugation engine (standard peninsular Spanish).
For each verb give its participio (과거분사 / past participle) with correct accents, and classify it as EXACTLY one of:
- "none" = regular: -ar → -ado, -er/-ir → -ido (hablar→hablado, comer→comido, vivir→vivido; note the accent in leer→leído, oír→oído, traer→traído — those still count as regular)
- "불규칙" = any irregular participle, including a compound that inherits one (abrir→abierto, escribir→escrito, poner→puesto, ver→visto, volver→vuelto, romper→roto, morir→muerto, decir→dicho, hacer→hecho, descubrir→descubierto, componer→compuesto, devolver→devuelto)
- "두 꼴 다 씀" = a regular AND an irregular participle are both in use (imprimir→imprimido/impreso, freír→freído/frito, proveer→proveído/provisto); give the one used with haber first
⚠️ The participio NEVER carries the reflexive pronoun — levantarse → "levantado", not "levantadose" (the pronoun goes before haber: "me he levantado").
Give the masculine singular form. Never add "haber".`;
        const GERUNDIO_IRREGULAR_ENUM = IRREGULAR_TYPES_BY_TENSE.gerundio;
        const GERUNDIO_RULE_PROMPT = `You are a precise Spanish conjugation engine (standard peninsular Spanish).
For each verb give its gerundio (현재분사 / present participle) with correct accents, and classify the irregularity as EXACTLY one of:
- "none" = regular: -ar → -ando, -er/-ir → -iendo (hablar→hablando, comer→comiendo, vivir→viviendo)
- "e ➡️ i" = stem e becomes i (pedir→pidiendo, decir→diciendo, venir→viniendo, sentir→sintiendo, seguir→siguiendo, reír→riendo)
- "o ➡️ u" = stem o becomes u (dormir→durmiendo, morir→muriendo, poder→pudiendo)
- "-yendo" = stem ends in a vowel so the ending becomes -yendo (leer→leyendo, oír→oyendo, traer→trayendo, construir→construyendo, ir→yendo)
- "기타 변형" = none of the above fits
${REFLEXIVE_RULE}
Never add "estar".`;
        // 시제별 프롬프트 — 현재분사만 갈래 설명이 따로 있고, 나머지는 공통 틀을 쓴다
        function tenseRulePrompt(tense) {
            if (tense === 'gerundio') return GERUNDIO_RULE_PROMPT;
            if (tense === 'participio') return PARTICIPIO_RULE_PROMPT;
            const o = TENSE_TYPE_OPTIONS.find(t => t.key === tense);
            const label = o ? o.label : tense;
            return `You are a precise Spanish conjugation engine (standard peninsular Spanish).
Conjugate each verb in this tense: ${label} (internal key: ${tense}), all 6 persons, with correct accents.
"vos" means the Spanish 2nd person plural vosotros (-áis/-éis/-ís) — NEVER Argentinian voseo (-ás/-és).
${REFLEXIVE_RULE}
Also classify the irregularity as EXACTLY one of: ${irregularTypesFor(tense).map(t => `"${t}"`).join(', ')} ("none" = fully regular).`;
        }
        // AI가 준 불규칙 갈래를 블록 콤보박스에 반영 (사용자가 이미 불규칙으로 지정해 뒀으면 건드리지 않음)
        // [냐냐 지적] 1칸짜리 시제가 둘(현재분사·과거분사)이 되면서 시제별 갈래를 봐야 한다.
        //   예전엔 현재분사 목록으로만 검사해서 과거분사의 '불규칙' 이 걸러졌다.
        function applySingleTenseIrregular(block, tense, type) {
            if (!type || !irregularTypesFor(tense).includes(type) || type === 'none') return;
            const cls = block.querySelector('.conj-block-class');
            const irr = block.querySelector('.conj-block-irr');
            if (!cls || !irr || cls.value === 'irregular') return;
            cls.value = 'irregular';
            irr.disabled = false;
            irr.value = type;
        }

        function isSingleTense(t) { return SINGLE_TENSES.includes(t); }

        function hasConjValues(c) { return !!(c && (c.yo || c.tu || c.el || c.nos || c.vos || c.ellos || c.form)); }
        // 단어의 한 시제 변형을 얻는다 (구버전 conjugations = 현재시제 호환)
        function getTenseConj(word, key) {
            if (!word) return null;
            const byTense = word.conjugationsByTense || {};
            let c = byTense[key];
            if (!hasConjValues(c) && key === 'presente') c = word.conjugations;
            return hasConjValues(c) ? c : null;
        }
        // 표시·출제에 쓸 시제 키 목록, 등록 폼 순서대로
        function listTenseKeys(word) {
            return TENSE_TYPE_OPTIONS.map(o => o.key).filter(k => hasConjValues(getTenseConj(word, k)));
        }

        // ============================================================
        // [냐냐 요청] '불규칙'이라고 적혀 있지만 실제로는 규칙형인 시제를 걸러낸다.
        //   AI 가 단어를 채울 때, 다른 시제의 불규칙을 현재시제에 잘못 붙이는 일이 있었다.
        //   abrir 은 과거분사(abierto)가 불규칙인데 현재시제가 '1인칭 불규칙'으로 저장돼서
        //   완전히 규칙형인 abro 가 파랗게 강조됐다. 실데이터에서 9개가 이랬다
        //   (abrir·romper·sacar·cruzar·andar·leer·meter 현재 / contener·esquiar 현재분사).
        //
        //   스페인어 현재형 규칙 변화는 계산할 수 있으므로, 여섯 칸이 전부 계산 결과와
        //   같으면 그 시제는 규칙이다 — 라벨이 뭐라고 적혀 있든.
        //   ⚠️ 반대 방향(규칙이라 적혔는데 형태가 다름)은 건드리지 않는다.
        //      enviar(envío)·esquiar(esquío)처럼 악센트만 옮겨가는 동사가 걸려서,
        //      맞게 적어둔 것까지 불규칙으로 뒤집어 버린다.
        // ============================================================
        const REG_ENDINGS = {
            ar: ['o', 'as', 'a', 'amos', 'áis', 'an'],
            er: ['o', 'es', 'e', 'emos', 'éis', 'en'],
            ir: ['o', 'es', 'e', 'imos', 'ís', 'en']
        };
        const REG_PERSON_KEYS = ['yo', 'tu', 'el', 'nos', 'vos', 'ellos'];
        const REG_REFLEXIVE_PRONOUNS = ['me', 'te', 'se', 'nos', 'os', 'se'];
        function conjNorm(s) { return String(s || '').trim().toLowerCase().normalize('NFC'); }
        // 재귀동사는 단어장이 대명사를 포함해 저장한다 (levantarse → "me levanto")
        function regularPresentForms(infinitive) {
            let w = conjNorm(infinitive);
            let reflexive = false;
            if (w.endsWith('se')) { reflexive = true; w = w.slice(0, -2); }
            const ending = REG_ENDINGS[w.slice(-2)];
            const stem = w.slice(0, -2);
            if (!ending || !stem) return null;
            const out = {};
            REG_PERSON_KEYS.forEach((k, i) => {
                out[k] = (reflexive ? REG_REFLEXIVE_PRONOUNS[i] + ' ' : '') + stem + ending[i];
            });
            return out;
        }
        function regularGerundioForm(infinitive) {
            const w = conjNorm(infinitive);
            // 재귀는 대명사가 뒤에 붙고 악센트까지 생겨서(secándose) 계산이 복잡하다 — 건드리지 않는다
            if (w.endsWith('se')) return null;
            const type = w.slice(-2);
            if (!REG_ENDINGS[type]) return null;
            return w.slice(0, -2) + (type === 'ar' ? 'ando' : 'iendo');
        }
        function regularParticipioForm(infinitive) {
            const w = conjNorm(infinitive);
            if (w.endsWith('se')) return null;   // 재귀는 대명사를 떼야 해서 여기선 판단하지 않는다
            // 원형에 악센트가 있으면(oír·reír·freír) 어미를 못 알아본다 — 떼고 본다
            const bare = w.normalize('NFD').replace(/[̀-ͯ]/g, '');
            const type = bare.slice(-2);
            if (!REG_ENDINGS[type]) return null;
            const stem = bare.slice(0, -2);
            if (type === 'ar') return stem + 'ado';
            // -er/-ir 인데 어간이 센모음(a·e·o)으로 끝나면 -ído 로 악센트가 붙는다.
            //   leer→leído · oír→oído · traer→traído · caer→caído (이것도 규칙이다)
            //   약모음이면 안 붙는다 — construir→construido
            return stem + (/[aeo]$/.test(stem) ? 'ído' : 'ido');
        }
        // 이 시제의 저장된 형태가 규칙 변화와 완전히 같은가
        function tenseLooksRegular(word, tenseKey) {
            const c = getTenseConj(word, tenseKey);
            if (!word || !c) return false;
            if (tenseKey === 'gerundio') {
                const reg = regularGerundioForm(word.word);
                return !!reg && conjNorm(c.form) === reg;
            }
            if (tenseKey === 'participio') {
                const reg = regularParticipioForm(word.word);
                return !!reg && conjNorm(c.form) === reg;
            }
            if (tenseKey !== 'presente') return false; // 나머지 시제는 규칙표가 없으니 판단하지 않는다
            const reg = regularPresentForms(word.word);
            if (!reg) return false;
            return REG_PERSON_KEYS.every(k => conjNorm(c[k]) === conjNorm(reg[k]));
        }
        // 화면에 쓸 실제 분류. 라벨이 불규칙인데 형태가 규칙형이면 규칙으로 돌려준다.
        function resolveTenseIrregularity(word, tenseKey, verbClass, irrType) {
            if (verbClass !== 'irregular') return { verbClass: verbClass, irrType: irrType };
            if (tenseLooksRegular(word, tenseKey)) return { verbClass: 'regular', irrType: 'none' };
            return { verbClass: verbClass, irrType: irrType };
        }

        // 블록 하나의 입력칸을 시제 종류에 맞게 렌더 (기존 입력값 최대한 보존)
        function renderBlockInputs(block) {
            const tense = block.querySelector('.conj-block-tense').value;
            const box = block.querySelector('.conj-block-inputs');
            const prev = readBlockConj(block);
            if (isSingleTense(tense)) {
                // [냐냐 지적] 과거분사 칸에도 '현재분사 (gerundio)' 라고 떠 있었다 — 시제에 맞춰 적는다
                const single = { gerundio: { label: '현재분사 (gerundio)', ph: 'teniendo' },
                                 participio: { label: '과거분사 (participio)', ph: 'tenido' } }[tense]
                            || { label: '한 칸', ph: '' };
                box.innerHTML = `<div class="space-y-1"><span class="text-[10px] font-bold text-slate-400">${single.label}</span><input type="text" data-person="form" placeholder="${single.ph}" autocomplete="off" class="conj-cell w-full bg-white px-3 py-2 rounded-lg border border-slate-200 text-sm text-center focus:outline-none font-bold text-blue-600"></div>`;
                const el = box.querySelector('[data-person="form"]'); if (el && prev.form) el.value = prev.form;
            } else {
                box.innerHTML = `<div class="grid grid-cols-3 gap-2">` + CONJ_PERSON_KEYS.map((p, i) =>
                    `<div class="space-y-1"><span class="text-[10px] font-bold text-slate-400">${CONJ_PERSON_LABELS[i]}</span><input type="text" data-person="${p}" autocomplete="off" class="conj-cell w-full bg-white px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-center focus:outline-none ${i === 0 ? 'font-bold text-blue-600' : 'font-semibold'}"></div>`
                ).join('') + `</div>`;
                CONJ_PERSON_KEYS.forEach(p => { const el = box.querySelector(`[data-person="${p}"]`); if (el && prev[p]) el.value = prev[p]; });
            }
        }
        function readBlockConj(block) {
            const d = {};
            block.querySelectorAll('.conj-block-inputs .conj-cell').forEach(el => { d[el.dataset.person] = el.value.trim(); });
            return d;
        }
        function fillBlockConj(block, data) {
            data = data || {};
            block.querySelectorAll('.conj-block-inputs .conj-cell').forEach(el => { const k = el.dataset.person; if (data[k]) el.value = data[k]; });
        }

        function addTenseBlock(tenseKey, data, vcVal, irrVal) {
            const box = document.getElementById('conj-tense-blocks');
            if (!box) return;
            if (!tenseKey) { // '+ 시제 추가' 버튼: 아직 안 쓴 시제 중 첫 번째로 (자동 생성 시제는 건너뜀)
                const used = [...box.querySelectorAll('.conj-block-tense')].map(s => s.value);
                tenseKey = TENSE_TYPE_OPTIONS.map(o => o.key).find(k => !used.includes(k)) || 'presente';
                data = {}; vcVal = 'regular'; irrVal = 'none';
            }
            const isRegular = (vcVal !== 'irregular');
            const block = document.createElement('div');
            block.className = 'conj-tense-block bg-white rounded-xl border border-slate-200 p-2.5 space-y-2';
            // 자동 생성 시제(현재진행)는 고를 수 없다 — 현재분사에서 만들어지므로
            const tenseOpts = TENSE_TYPE_OPTIONS
                .map(o => `<option value="${o.key}" ${o.key === tenseKey ? 'selected' : ''}>${o.label}</option>`).join('');
            const irrOpts = irrOptionsHtml(tenseKey, irrVal);
            block.innerHTML = `
                <div class="flex items-center gap-1 flex-wrap">
                    <select class="conj-block-tense flex-1 min-w-[104px] bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-200 text-[11px] font-bold text-indigo-700 focus:outline-none" onchange="onBlockTenseChange(this)">${tenseOpts}</select>
                    <select class="conj-block-class bg-white px-1.5 py-1 rounded-lg border border-slate-200 text-[11px] font-medium focus:outline-none" onchange="onBlockClassChange(this)">
                        <option value="regular" ${isRegular ? 'selected' : ''}>규칙</option>
                        <option value="irregular" ${!isRegular ? 'selected' : ''}>불규칙</option>
                    </select>
                    <select class="conj-block-irr bg-white px-1.5 py-1 rounded-lg border border-slate-200 text-[11px] font-medium focus:outline-none" ${isRegular ? 'disabled' : ''}>${irrOpts}</select>
                    <button type="button" onclick="aiFillBlock(this)" title="이 시제만 AI 추천 (빈칸만 채움)" class="w-7 h-7 shrink-0 rounded-lg bg-violet-500 hover:bg-violet-600 text-white flex items-center justify-center transition-all"><i class="fa-solid fa-wand-magic-sparkles text-[10px]"></i></button>
                    <button type="button" onclick="removeTenseBlock(this)" title="이 시제 삭제" class="w-7 h-7 shrink-0 rounded-lg bg-slate-50 hover:bg-rose-50 hover:text-rose-500 text-slate-400 flex items-center justify-center transition-all"><i class="fa-solid fa-minus text-[10px]"></i></button>
                </div>
                <div class="conj-block-inputs"></div>
            `;
            box.appendChild(block);
            renderBlockInputs(block);
            fillBlockConj(block, data);
        }

        // [냐냐 요청] 시제를 바꾸면 불규칙 유형 목록도 그 시제 것으로 다시 그린다.
        //   (예전엔 블록을 만들 때 한 번만 그려서, 현재분사 블록에도 '1인칭' 같은 현재시제 전용 항목이 남아 있었다)
        function onBlockTenseChange(sel) {
            const block = sel.closest('.conj-tense-block');
            const irr = block.querySelector('.conj-block-irr');
            if (irr) {
                const cur = irr.value;
                irr.innerHTML = irrOptionsHtml(sel.value, cur);
                if (irr.value === 'none' && cur !== 'none') {
                    // 새 시제엔 없는 유형이었으면 규칙으로 되돌림 (엉뚱한 유형이 남지 않게)
                    const cls = block.querySelector('.conj-block-class');
                    if (cls) cls.value = 'regular';
                    irr.disabled = true;
                }
            }
            renderBlockInputs(block);
        }
        function onBlockClassChange(sel) {
            const block = sel.closest('.conj-tense-block');
            const irr = block.querySelector('.conj-block-irr');
            const tense = block.querySelector('.conj-block-tense').value;
            if (sel.value === 'irregular') {
                irr.disabled = false;
                if (irr.value === 'none') irr.value = irregularTypesFor(tense).find(o => o !== 'none') || 'none';
            }
            else { irr.disabled = true; irr.value = 'none'; }
        }
        function removeTenseBlock(btn) { const b = btn.closest('.conj-tense-block'); if (b) b.remove(); }

        // 모든 블록에서 시제별 변형 수집 (같은 시제 중복 시 마지막 블록 우선)
        function collectConjByTense() {
            const result = {};
            document.querySelectorAll('#conj-tense-blocks .conj-tense-block').forEach(block => {
                const tense = block.querySelector('.conj-block-tense').value;
                const d = readBlockConj(block);
                if (isSingleTense(tense)) { if ((d.form || '').trim()) result[tense] = { form: d.form.trim() }; }
                else if (CONJ_PERSON_KEYS.some(p => (d[p] || '').trim())) result[tense] = d;
            });
            return result;
        }
        // 시제별 규칙/불규칙 + 불규칙유형 수집
        function collectVerbInfoByTense() {
            const irregularByTense = {}, verbClassByTense = {};
            document.querySelectorAll('#conj-tense-blocks .conj-tense-block').forEach(block => {
                const tense = block.querySelector('.conj-block-tense').value;
                const cls = block.querySelector('.conj-block-class').value;
                const it = block.querySelector('.conj-block-irr').value;
                verbClassByTense[tense] = cls;
                if (cls === 'irregular' && it && it !== 'none') irregularByTense[tense] = it;
            });
            return { irregularByTense, verbClassByTense };
        }

        // 단어의 저장된 시제들로 블록을 다시 그림 (현재시제는 항상 하나 보장)
        function initConjBlocks(word) {
            const box = document.getElementById('conj-tense-blocks');
            if (!box) return;
            box.innerHTML = '';
            const byTense = (word && word.conjugationsByTense && Object.keys(word.conjugationsByTense).length) ? word.conjugationsByTense : (word && word.conjugations ? { presente: word.conjugations } : {});
            const irrByTense = (word && word.irregularByTense) || {};
            const vcByTense = (word && word.verbClassByTense) || {};
            // 자동 생성 시제(현재진행)는 입력 블록을 만들지 않는다 — 저장된 값이 있어도 그대로 보존만 됨
            let tenses = TENSE_TYPE_OPTIONS.map(o => o.key).filter(k => byTense[k]);
            if (!tenses.includes('presente')) tenses.unshift('presente'); // 현재시제 블록은 항상 하나
            tenses.forEach(t => {
                const rawVc = vcByTense[t] || ((t === 'presente' && word && word.verbClass) ? word.verbClass : (irrByTense[t] ? 'irregular' : 'regular'));
                const rawIrr = irrByTense[t] || ((t === 'presente' && word && word.irregularType) ? word.irregularType : 'none');
                // 조회 화면과 같은 것을 보여준다. 여기만 '불규칙'으로 열리면 카드와 어긋나 보인다.
                //   이 상태로 저장하면 잘못 적힌 값도 같이 바로잡힌다.
                const r = resolveTenseIrregularity(word, t, rawVc, rawIrr);
                addTenseBlock(t, byTense[t] || {}, r.verbClass, r.irrType);
            });
        }

        // AI로 현재 블록 시제만 추천 (빈칸만 채움, 기존 입력 보존)
        async function aiFillBlock(btn) {
            const block = btn.closest('.conj-tense-block');
            const wordInput = document.getElementById('input-word');
            const infinitive = (wordInput ? wordInput.value : '').trim().replace(/^(el|la|los|las)\s+/, '');
            if (!infinitive) { showToast("먼저 동사 원형을 입력해 주세요!", "error"); return; }
            if (!(typeof hasGeminiApiKey === 'function' && hasGeminiApiKey())) { openApiKeyModal(); return; }
            const tenseSel = block.querySelector('.conj-block-tense');
            const tense = tenseSel.value;
            const label = tenseSel.selectedOptions[0].text;
            const orig = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin text-[10px]"></i>';
            try {
                if (isSingleTense(tense)) {
                    // [냐냐 요청] 1칸짜리 시제는 형태와 함께 불규칙 갈래도 같이 받아 콤보박스에 채운다
                    // [냐냐 지적] 여기가 현재분사 규칙으로 고정돼 있었다 — 과거분사 블록에서 눌러도
                    //   현재분사 규칙으로 물어보고 갈래도 현재분사 목록으로 받았다. 시제를 따라간다.
                    const schema = { type: "OBJECT", properties: { form: { type: "STRING" }, irregular: { type: "STRING", enum: irregularTypesFor(tense) } }, required: ["form", "irregular"] };
                    const resp = await callGemini(`${tenseRulePrompt(tense)}\n\nVerb: "${infinitive}". JSON: {"form":"...","irregular":"..."}`, `Return ONLY JSON.`, schema, 'minimal');
                    const data = extractAndParseJson(resp);
                    const el = block.querySelector('[data-person="form"]'); if (el && !el.value.trim()) el.value = (data.form || '').trim();
                    applySingleTenseIrregular(block, tense, data.irregular);
                } else {
                    const schema = { type: "OBJECT", properties: { yo: { type: "STRING" }, tu: { type: "STRING" }, el: { type: "STRING" }, nos: { type: "STRING" }, vos: { type: "STRING" }, ellos: { type: "STRING" } }, required: ["yo", "tu", "el", "nos", "vos", "ellos"] };
                    const resp = await callGemini(`${tenseRulePrompt(tense)}\n\nVerb: "${infinitive}". Return JSON: {"yo","tu","el","nos","vos","ellos"}`, `Return ONLY JSON.`, schema, 'minimal');
                    const data = extractAndParseJson(resp);
                    CONJ_PERSON_KEYS.forEach(p => { const el = block.querySelector(`[data-person="${p}"]`); if (el && !el.value.trim()) el.value = (data[p] || '').trim(); });
                }
                showToast(`${label} 추천 완료! (빈칸만 채웠어요)`, "success");
            } catch (e) {
                console.error(e);
                showToast((typeof describeGeminiError === 'function') ? describeGeminiError(e) : "AI 추천 실패", "error");
            } finally { btn.disabled = false; btn.innerHTML = orig; }
        }

        // ============================================================
        // [냐냐 요청] 시제 일괄 추가
        //   시제를 하나 고르면, 그 시제가 비어 있는 동사를 AI가 묶음으로 채우고
        //   같은 목록을 AI가 한 번 더 풀게 해서 두 답이 갈린 것만 ⚠️로 올려 준다.
        //   (전부 눈으로 확인할 필요 없이, 갈린 것만 보면 됨)
        // ============================================================
        const BULK_BATCH = 20;    // 한 번에 물어볼 동사 수 (응답이 잘리지 않는 선)
        let bulkConjState = null; // { tense, targets, rows, running, cancelled, failed }

        // 일괄 추가로 채울 수 있는 시제 (자동 생성 시제인 현재진행은 제외)
        function bulkTenseOptions() { return TENSE_TYPE_OPTIONS.slice(); }

        function verbKey(s) {
            return String(s || '').toLowerCase().trim()
                .normalize('NFD').replace(/[̀-ͯ]/g, '')
                .replace(/[^a-z]/g, '');
        }
        function sameForm(a, b) {
            return String(a || '').toLowerCase().trim() === String(b || '').toLowerCase().trim();
        }
        // 두 응답이 같은 답인지 (1칸 시제는 form, 나머지는 6인칭 전부)
        function sameConj(tense, a, b) {
            const keys = isSingleTense(tense) ? ['form'] : CONJ_PERSON_KEYS;
            return keys.every(k => sameForm(a[k], b[k]));
        }
        // 사람이 읽을 한 줄 (1칸이면 그 형태, 6칸이면 · 로 이어서)
        function conjOneLine(tense, c) {
            const keys = isSingleTense(tense) ? ['form'] : CONJ_PERSON_KEYS;
            return keys.map(k => (c[k] || '')).filter(Boolean).join(' · ');
        }
        function verbsMissingTense(tense) {
            return vocabulary.filter(v => v.pos === 'verb' && !hasConjValues(getTenseConj(v, tense)));
        }

        // [냐냐 요청] 표시 설정 패널 안에서 열기 — 패널을 닫고 모달을 띄운다
        //   (패널의 위임 리스너가 삼키지 않도록 여기서 직접 전파를 끊는다)
        function openBulkConjFromPanel(ev) {
            if (ev && ev.stopPropagation) ev.stopPropagation();
            closeDisplayPanel();
            openBulkConj();
        }

        function openBulkConj() {
            bulkConjState = { tense: 'gerundio', targets: [], rows: [], running: false, cancelled: false, failed: [] };
            const modal = document.getElementById('bulk-conj-modal');
            if (modal) modal.classList.remove('hidden');
            const sel = document.getElementById('bulk-conj-tense');
            if (sel) {
                sel.innerHTML = bulkTenseOptions().map(o => `<option value="${o.key}" ${o.key === bulkConjState.tense ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('');
                sel.disabled = false;
            }
            onBulkTenseChange();
        }
        function closeBulkConj() {
            if (bulkConjState) bulkConjState.cancelled = true; // 진행 중이면 중단
            const modal = document.getElementById('bulk-conj-modal');
            if (modal) modal.classList.add('hidden');
            bulkConjState = null;
        }
        function onBulkTenseChange() {
            const st = bulkConjState;
            if (!st || st.running) return;
            const sel = document.getElementById('bulk-conj-tense');
            st.tense = (sel && sel.value) || 'gerundio';
            st.targets = verbsMissingTense(st.tense);
            st.rows = []; st.failed = [];
            renderBulkConjIntro();
        }
        function setBulkConjAction(label, handler, disabled) {
            const btn = document.getElementById('bulk-conj-action');
            if (!btn) return;
            btn.innerText = label;
            btn.disabled = !!disabled;
            btn.classList.toggle('hidden', !handler);
            btn.onclick = handler || null;
        }
        // 문장에 넣을 짧은 이름 — 괄호 설명은 뗀다 ('현재분사 (gerundio · 1칸)' → '현재분사')
        function bulkTenseLabel(tense) {
            const o = TENSE_TYPE_OPTIONS.find(t => t.key === tense);
            return o ? o.label.replace(/\s*\(.*\)\s*$/, '') : tense;
        }

        function renderBulkConjIntro() {
            const st = bulkConjState;
            const body = document.getElementById('bulk-conj-body');
            const sub = document.getElementById('bulk-conj-sub');
            if (!st || !body) return;
            const verbCount = vocabulary.filter(v => v.pos === 'verb').length;
            const n = st.targets.length;
            if (sub) sub.innerText = `등록된 동사 ${verbCount}개 중 ${n}개가 비어 있어요`;
            if (n === 0) {
                body.innerHTML = `<div class="text-center py-10 text-slate-400 text-sm font-bold">모든 동사에 ${escapeHtml(bulkTenseLabel(st.tense))}이(가) 이미 있어요 🎉</div>`;
                setBulkConjAction('', null, false);
                return;
            }
            setBulkConjAction('AI로 채우기', startBulkConj, false);
            body.innerHTML = `
                <div class="bg-violet-50 border border-violet-100 rounded-2xl p-3 text-xs text-violet-700 leading-relaxed font-medium">
                    <b>${n}개</b> 동사의 <b>${escapeHtml(bulkTenseLabel(st.tense))}</b>을(를) AI가 만들고, <b>같은 목록을 AI가 한 번 더</b> 풀어서 맞춰봐요.<br>
                    두 답이 갈린 것만 ⚠️로 표시되니 그것만 확인하시면 돼요.
                </div>
                <div class="max-h-52 overflow-y-auto flex flex-wrap gap-1.5">
                    ${st.targets.map(v => `<span class="text-[11px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">${escapeHtml(v.word)}</span>`).join('')}
                </div>`;
        }

        function renderBulkConjProgress(msg, pct) {
            const body = document.getElementById('bulk-conj-body');
            if (!body) return;
            const p = Math.max(0, Math.min(100, Math.round(pct)));
            body.innerHTML = `
                <div class="py-10 text-center space-y-3">
                    <i class="fa-solid fa-wand-magic-sparkles text-3xl text-violet-500 animate-pulse"></i>
                    <p class="text-sm font-bold text-slate-700">${escapeHtml(msg)}… <span class="text-violet-600">${p}%</span></p>
                    <div class="h-2 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-violet-500 transition-all" style="width:${p}%"></div></div>
                    <p class="text-[11px] text-slate-400">창을 닫으면 중단돼요</p>
                </div>`;
        }

        // AI 한 번 호출 = 동사 목록 하나. candidates 를 주면 '검증(다시 풀어서 맞춰보기)' 모드.
        async function bulkConjAsk(tense, words, candidates) {
            const single = isSingleTense(tense);
            const props = { verb: { type: "STRING", description: "the infinitive exactly as given in the input list" } };
            if (single) props.form = { type: "STRING", description: tense === 'participio'
                ? "the participio (masculine singular) with correct accents, no haber, no reflexive pronoun"
                : "the gerundio with correct accents, no estar" };
            else CONJ_PERSON_KEYS.forEach(p => { props[p] = { type: "STRING" }; });
            props.irregular = { type: "STRING", enum: irregularTypesFor(tense) };
            const required = ['verb', 'irregular'].concat(single ? ['form'] : CONJ_PERSON_KEYS);
            const schema = {
                type: "OBJECT",
                properties: { items: { type: "ARRAY", items: { type: "OBJECT", properties: props, required } } },
                required: ["items"]
            };

            const listText = candidates
                ? words.map(w => `${w} -> ${conjOneLine(tense, candidates[verbKey(w)] || {}) || '?'}`).join('\n')
                : words.join('\n');
            const prompt = candidates
                ? `${tenseRulePrompt(tense)}\n\nEach line below is "verb -> a proposed answer". For EVERY verb, work out the answer yourself from the rules above FIRST, then output your own answer (keep the proposal only if your own derivation matches it). Output one item per verb, no verb skipped.\n\n${listText}`
                : `${tenseRulePrompt(tense)}\n\nAnswer for every verb below. Output one item per verb, in the same order, no verb skipped.\n\n${listText}`;

            const resp = await callGemini(prompt, 'Return ONLY JSON.', schema, 'minimal');
            const data = extractAndParseJson(resp);
            const out = {};
            (data.items || []).forEach(it => {
                const k = verbKey(it && it.verb);
                if (!k) return;
                const row = { irregular: irregularTypesFor(tense).includes(it.irregular) ? it.irregular : 'none' };
                if (single) row.form = String(it.form || '').trim();
                else CONJ_PERSON_KEYS.forEach(p => { row[p] = String(it[p] || '').trim(); });
                if (!conjOneLine(tense, row)) return; // 알맹이가 없으면 버림
                out[k] = row;
            });
            return out;
        }

        async function startBulkConj() {
            if (!(typeof hasGeminiApiKey === 'function' && hasGeminiApiKey())) { openApiKeyModal(); return; }
            const st = bulkConjState;
            if (!st || st.running || st.targets.length === 0) return;
            st.running = true; st.rows = []; st.failed = [];
            setBulkConjAction('진행 중…', null, true);
            const tenseSel = document.getElementById('bulk-conj-tense');
            if (tenseSel) tenseSel.disabled = true;

            const batches = [];
            for (let i = 0; i < st.targets.length; i += BULK_BATCH) batches.push(st.targets.slice(i, i + BULK_BATCH));
            const totalSteps = batches.length * 2; // 만들기 + 검증
            let step = 0;
            const pct = () => (step / totalSteps) * 100;
            renderBulkConjProgress('만드는 중', 0);

            for (const batch of batches) {
                if (st.cancelled) break;
                const words = batch.map(v => (v.word || '').trim());
                let made = null;
                try {
                    renderBulkConjProgress('만드는 중', pct());
                    made = await bulkConjAsk(st.tense, words, null);
                } catch (e) {
                    console.error(e);
                    batch.forEach(v => st.failed.push(v.word));
                    step += 2;
                    continue;
                }
                step++;
                let verified = {};
                if (!st.cancelled) {
                    try {
                        renderBulkConjProgress('AI 검증 중', pct());
                        verified = await bulkConjAsk(st.tense, words, made);
                    } catch (e) { console.error(e); verified = {}; } // 검증만 실패하면 '검증 못 함'으로 남김
                }
                step++;
                batch.forEach(v => {
                    const k = verbKey(v.word);
                    const a = made[k], b = verified[k];
                    if (!a && !b) { st.failed.push(v.word); return; }
                    const chosen = b || a;                      // 검증본을 채택
                    const conflict = !!(a && b) && !sameConj(st.tense, a, b);
                    const row = { id: v.id, word: v.word, meaning: v.meaning, irregular: chosen.irregular || 'none', unverified: !b, on: true };
                    if (isSingleTense(st.tense)) row.form = chosen.form;
                    else CONJ_PERSON_KEYS.forEach(p => { row[p] = chosen[p]; });
                    row.text = conjOneLine(st.tense, row);
                    row.alt = conflict ? conjOneLine(st.tense, a) : '';
                    st.rows.push(row);
                });
            }

            if (bulkConjState !== st) return; // 진행 중에 창을 닫았으면 그리지 않음
            st.running = false;
            if (tenseSel) tenseSel.disabled = false;
            renderBulkConjResult();
        }

        function bulkConjRowHtml(r, i) {
            const flagged = !!(r.alt || r.unverified);
            const note = r.alt ? `⚠️ 1차 답: ${escapeHtml(r.alt)}` : (r.unverified ? '⚠️ 검증 못 함' : '');
            return `
                <label class="flex items-start gap-2 p-2 rounded-xl border ${flagged ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}">
                    <input type="checkbox" data-bulk-conj="${i}" ${r.on ? 'checked' : ''} onchange="toggleBulkConjRow(this)" class="w-4 h-4 accent-violet-600 shrink-0 mt-0.5">
                    <span class="text-[11px] font-bold text-slate-500 w-16 shrink-0 truncate">${escapeHtml(r.word)}</span>
                    <span class="min-w-0 flex-1">
                        <span class="block text-xs font-black text-blue-600 break-words">${escapeHtml(r.text)}</span>
                        ${note ? `<span class="block text-[10px] text-amber-700 font-bold mt-0.5">${note}</span>` : ''}
                    </span>
                    ${(r.irregular && r.irregular !== 'none') ? `<span class="text-[10px] font-bold text-rose-500 shrink-0">${escapeHtml(r.irregular)}</span>` : ''}
                </label>`;
        }

        function renderBulkConjResult() {
            const st = bulkConjState;
            const body = document.getElementById('bulk-conj-body');
            if (!st || !body) return;
            const items = st.rows.map((r, i) => ({ r, i }));
            const flagged = items.filter(x => x.r.alt || x.r.unverified);
            const clean = items.filter(x => !(x.r.alt || x.r.unverified));
            const sub = document.getElementById('bulk-conj-sub');
            if (sub) sub.innerText = `${st.rows.length}개 완성 · 확인 필요 ${flagged.length}개`;

            if (st.rows.length === 0) {
                body.innerHTML = `<div class="text-center py-10 text-slate-400 text-sm font-bold">받아온 결과가 없어요. 잠시 뒤 다시 시도해 주세요.</div>`;
                setBulkConjAction('다시 시도', renderBulkConjIntro, false);
                return;
            }

            body.innerHTML = `
                ${flagged.length ? `
                <div class="space-y-1.5">
                    <p class="text-[11px] font-bold text-amber-700">⚠️ 두 답이 갈렸어요 — 여기만 확인해 주세요 (${flagged.length}개)</p>
                    ${flagged.map(x => bulkConjRowHtml(x.r, x.i)).join('')}
                </div>` : `<div class="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-xs text-emerald-700 font-bold">두 번 다 같은 답이 나왔어요 — 확인할 게 없어요 ✨</div>`}
                <div class="space-y-1.5">
                    <p class="text-[11px] font-bold text-slate-400">검증 통과 (${clean.length}개)</p>
                    ${clean.map(x => bulkConjRowHtml(x.r, x.i)).join('')}
                </div>
                ${st.failed.length ? `<p class="text-[11px] text-rose-500 font-bold">못 받아온 단어 ${st.failed.length}개: ${escapeHtml(st.failed.join(', '))}</p>` : ''}`;
            updateBulkConjActionLabel();
        }

        function updateBulkConjActionLabel() {
            const st = bulkConjState;
            if (!st) return;
            const n = st.rows.filter(r => r.on && r.text).length;
            setBulkConjAction(`${n}개 저장`, saveBulkConj, n === 0);
        }
        function toggleBulkConjRow(el) {
            const i = parseInt(el.getAttribute('data-bulk-conj'), 10);
            if (bulkConjState && bulkConjState.rows[i]) bulkConjState.rows[i].on = el.checked;
            updateBulkConjActionLabel();
        }

        function saveBulkConj() {
            const st = bulkConjState;
            if (!st) return;
            const tense = st.tense;
            const picked = st.rows.filter(r => r.on && r.text);
            if (picked.length === 0) { showToast("선택된 게 없어요", "error"); return; }
            let n = 0;
            picked.forEach(r => {
                const v = vocabulary.find(x => x.id === r.id);
                if (!v) return;
                const data = {};
                if (isSingleTense(tense)) data.form = r.form;
                else CONJ_PERSON_KEYS.forEach(p => { data[p] = r[p] || ''; });
                v.conjugationsByTense = v.conjugationsByTense || {};
                v.conjugationsByTense[tense] = data;
                v.verbClassByTense = v.verbClassByTense || {};
                v.irregularByTense = v.irregularByTense || {};
                if (r.irregular && r.irregular !== 'none') {
                    v.verbClassByTense[tense] = 'irregular';
                    v.irregularByTense[tense] = r.irregular;
                } else {
                    v.verbClassByTense[tense] = 'regular';
                    delete v.irregularByTense[tense];
                }
                // 구버전 호환 필드도 같이 (현재시제일 때만)
                if (tense === 'presente') {
                    v.conjugations = data;
                    v.verbClass = v.verbClassByTense.presente;
                    v.irregularType = v.irregularByTense.presente || 'none';
                }
                n++;
            });
            const label = bulkTenseLabel(tense);
            const extra = (tense === 'gerundio') ? ' 현재진행도 같이 생겨요 ✨' : ' ✨';
            saveToStorage();
            closeBulkConj();
            if (typeof renderWordList === 'function') renderWordList();
            if (typeof restoreExpandedCards === 'function') restoreExpandedCards();
            showToast(`${label} ${n}개를 채웠어요!${extra}`, "success");
        }

        // [냐냐 PATCH] AI 추천 완료 여부 (완료 후 아무 칸에서 엔터 = 저장)
        let aiAutofillCompleted = false;
        let _skipContinueRegisterPrompt = false; // [냐냐 PATCH] 첨삭에서 등록 시 '계속 등록?' 팝업 스킵

        // [냐냐 PATCH] 단어 모달 드래그 이동 + 위치 기억
        let modalDragPos = null; // {left, top} — '계속 등록' 연속 창은 이 위치 유지, 직접 열면 null(중앙)
        let _modalDrag = null;
        function startModalDrag(e) {
            // 닫기 버튼 등은 드래그 시작 제외
            if (e.target.closest('button')) return;
            const inner = document.getElementById('word-modal-inner');
            if (!inner) return;
            const rect = inner.getBoundingClientRect();
            // 드래그 시작 시 flex 중앙정렬 해제하고 절대좌표로 고정
            applyModalPosition(rect.left, rect.top);
            _modalDrag = { startX: e.clientX, startY: e.clientY, origLeft: rect.left, origTop: rect.top };
            document.addEventListener('mousemove', onModalDrag);
            document.addEventListener('mouseup', endModalDrag);
            e.preventDefault();
        }
        function onModalDrag(e) {
            if (!_modalDrag) return;
            let newLeft = _modalDrag.origLeft + (e.clientX - _modalDrag.startX);
            let newTop = _modalDrag.origTop + (e.clientY - _modalDrag.startY);
            // 화면 밖으로 완전히 나가지 않게 살짝 제한
            const inner = document.getElementById('word-modal-inner');
            const w = inner.offsetWidth, h = 60; // 헤더 정도는 항상 보이게
            newLeft = Math.max(-w + 100, Math.min(newLeft, window.innerWidth - 100));
            newTop = Math.max(0, Math.min(newTop, window.innerHeight - h));
            applyModalPosition(newLeft, newTop);
        }
        function endModalDrag() {
            if (_modalDrag) {
                const inner = document.getElementById('word-modal-inner');
                const rect = inner.getBoundingClientRect();
                modalDragPos = { left: rect.left, top: rect.top }; // 위치 기억
            }
            _modalDrag = null;
            document.removeEventListener('mousemove', onModalDrag);
            document.removeEventListener('mouseup', endModalDrag);
        }
        function applyModalPosition(left, top) {
            const modal = document.getElementById('word-modal');
            const inner = document.getElementById('word-modal-inner');
            if (!modal || !inner) return;
            // flex 중앙정렬 해제 → 절대좌표 배치
            modal.classList.remove('items-center', 'justify-center');
            inner.style.position = 'fixed';
            inner.style.left = left + 'px';
            inner.style.top = top + 'px';
            inner.style.margin = '0';
        }
        function resetModalPosition() {
            // 중앙 정렬로 복귀 (직접 '새 단어 등록'/'수정' 버튼으로 열 때)
            const modal = document.getElementById('word-modal');
            const inner = document.getElementById('word-modal-inner');
            if (!modal || !inner) return;
            modal.classList.add('items-center', 'justify-center');
            inner.style.position = '';
            inner.style.left = '';
            inner.style.top = '';
            inner.style.margin = '';
            modalDragPos = null;
        }

        // [냐냐 요청] 검색했는데 없을 때 '등록하기' — 검색어를 등록창에 그대로 채워준다.
        //   검색은 단어와 뜻 둘 다에 걸리니, 한글이면 뜻 칸에 넣는다 (스페인어 칸에 한글이 들어가면 안 되니까)
        function openWordModalFromSearch() {
            const q = ((document.getElementById('search-bar') || {}).value || '').trim();
            openWordModal();
            if (!q) return;
            const isKorean = /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(q);
            const target = document.getElementById(isKorean ? 'input-meaning' : 'input-word');
            if (!target) return;
            target.value = q;
            if (!isKorean && typeof handleWordInput === 'function') handleWordInput(q);
            target.focus();
        }

        function openWordModal(wordId = null) {
            document.getElementById('word-modal').classList.remove('hidden');
            document.getElementById('word-suggestions').classList.add('hidden');
            aiAutofillCompleted = false; // 모달 열 때 초기화
            _skipContinueRegisterPrompt = false; // [냐냐 PATCH] 기본은 계속등록 팝업 표시 (첨삭 등록만 스킵)
            resetModalPosition(); // [냐냐 PATCH] 직접 열면 항상 중앙에서 시작
            
            if (wordId) {
                const w = vocabulary.find(item => item.id === wordId);
                if (!w) return;
                aiAutofillCompleted = true; // [냐냐 PATCH] 수정 모드는 이미 내용이 있으니 바로 엔터 저장 가능
                
                document.getElementById('modal-title').innerHTML = `✏️ 단어 수정하기: <span class="text-indigo-600 font-extrabold">${w.word}</span>`;
                document.getElementById('modal-word-id').value = w.id;
                document.getElementById('input-word').value = w.word;
                document.getElementById('input-meaning').value = w.meaning;
                document.getElementById('input-pos').value = w.pos || 'noun';
                
                document.getElementById('input-gender').value = w.gender || 'none';
                document.getElementById('input-adj-agreement').value = w.adjAgreement || 'full';

                // [냐냐 PATCH] 시제 블록으로 로드 (규칙/불규칙·불규칙유형도 시제별)
                initConjBlocks(w);

                document.getElementById('input-example').value = w.example || '';
                document.getElementById('input-example-meaning').value = w.exampleMeaning || '';

                fillSynonymRows(w); // [냐냐 PATCH-5배치] 저장된 유의어/반의어 링크 복원

                // [냐냐 PATCH] 관용구 여러 개 지원 — 예전 단일 idiom/idiomMeaning 데이터도 자동 변환
                clearIdiomRows();
                const idiomList = (w.idioms && w.idioms.length > 0) ? w.idioms : (w.idiom ? [{ idiom: w.idiom, idiomMeaning: w.idiomMeaning || '' }] : []);
                const idiomBox = document.getElementById('idiom-fields-box');
                const idiomIcon = document.getElementById('idiom-toggle-icon');
                if (idiomList.length > 0) {
                    idiomList.forEach(item => addIdiomRow(item.idiom, item.idiomMeaning));
                    if (idiomBox) idiomBox.classList.remove('hidden');
                    if (idiomIcon) idiomIcon.className = "fa-solid fa-minus text-xs";
                } else {
                    if (idiomBox) idiomBox.classList.add('hidden');
                    if (idiomIcon) idiomIcon.className = "fa-solid fa-plus text-xs";
                }
                document.getElementById('input-notes').value = w.notes || '';
            } else {
                document.getElementById('modal-title').innerHTML = `✨ 새로운 단어 등록`;
                document.getElementById('modal-word-id').value = '';
                document.getElementById('input-word').value = '';
                document.getElementById('input-meaning').value = '';
                document.getElementById('input-pos').value = 'noun';
                document.getElementById('input-gender').value = 'none';
                document.getElementById('input-adj-agreement').value = 'full';

                clearConjugationFields();
                
                document.getElementById('input-example').value = '';
                document.getElementById('input-example-meaning').value = '';
                clearIdiomRows();
                const idiomBoxNew = document.getElementById('idiom-fields-box');
                const idiomIconNew = document.getElementById('idiom-toggle-icon');
                if (idiomBoxNew) idiomBoxNew.classList.add('hidden');
                if (idiomIconNew) idiomIconNew.className = "fa-solid fa-plus text-xs";
                // [냐냐 PATCH-5배치] 유의어 칸도 초기화
                clearSynonymRows();
                const synBoxNew = document.getElementById('syn-fields-box');
                const synIconNew = document.getElementById('syn-toggle-icon');
                if (synBoxNew) synBoxNew.classList.add('hidden');
                if (synIconNew) synIconNew.className = "fa-solid fa-plus text-xs";
                document.getElementById('input-notes').value = '· ';
            }
            togglePosFields();
            toggleNotesClearBtn();
            // [냐냐 PATCH] 새 단어 등록이면 단어 입력칸에 바로 커서 (즉시 타이핑 가능)
            if (!wordId) {
                setTimeout(() => { const wi = document.getElementById('input-word'); if (wi) wi.focus(); }, 50);
            }
        }

        // [냐냐 요청] 메모에서 Alt+Enter(또는 Shift+Enter) 는 줄바꿈, 그냥 Enter 는 저장.
        //   예전엔 그냥 Enter 가 여기서 줄바꿈을 넣고, 그 이벤트가 창 전체 핸들러
        //   (handleWordModalKey)까지 올라가서 저장까지 같이 돼버렸다.
        //   줄바꿈을 넣을 때는 stopPropagation 으로 저장을 막는다.
        function handleNotesEnterKey(event) {
            if (event.key !== 'Enter') return;
            //   AI 추천 전에는 창 핸들러가 저장을 안 하므로(빈 키가 되지 않게) 그때는 줄바꿈을 넣는다
            if (!event.altKey && !event.shiftKey && aiAutofillCompleted) return;   // 저장은 handleWordModalKey 가 맡는다
            event.preventDefault();
            event.stopPropagation();
            const textarea = event.target;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const value = textarea.value;
            const insertion = '\n· ';
            textarea.value = value.slice(0, start) + insertion + value.slice(end);
            const newPos = start + insertion.length;
            textarea.selectionStart = textarea.selectionEnd = newPos;
            toggleNotesClearBtn();
        }

        // [냐냐 PATCH] 노트 전체 지우기 X 버튼
        function clearNotes() {
            const ta = document.getElementById('input-notes');
            if (!ta) return;
            ta.value = '';
            toggleNotesClearBtn();
            ta.focus();
        }
        function toggleNotesClearBtn() {
            const ta = document.getElementById('input-notes');
            const btn = document.getElementById('notes-clear-btn');
            if (!ta || !btn) return;
            btn.classList.toggle('hidden', !ta.value.trim());
        }

        // [냐냐 요청] 메모칸에도 기호 버튼 — 문법 노트 편집기와 같은 기호를 커서 자리에 끼워 넣는다.
        //   여긴 그냥 textarea 라 execCommand 대신 값을 직접 자르고 붙인다
        function renderNotesSymbolBar() {
            const box = document.getElementById('notes-symbol-bar');
            if (!box || typeof RT_SYMBOLS === 'undefined') return;
            box.innerHTML = RT_SYMBOLS.map(s =>
                `<button type="button" onmousedown="event.preventDefault()" onclick="insertNotesSymbol('${s.ch}')" title="${s.title} 넣기"
                    class="w-6 h-6 rounded-md bg-slate-100 hover:bg-violet-100 hover:text-violet-600 text-slate-600 font-black text-xs transition-colors">${s.ch}</button>`
            ).join('');
        }

        function insertNotesSymbol(ch) {
            const ta = document.getElementById('input-notes');
            if (!ta) return;
            const s = (ta.selectionStart != null) ? ta.selectionStart : ta.value.length;
            const e = (ta.selectionEnd != null) ? ta.selectionEnd : s;
            ta.value = ta.value.slice(0, s) + ch + ta.value.slice(e);
            const pos = s + ch.length;
            ta.focus();
            try { ta.setSelectionRange(pos, pos); } catch (err) {}
            toggleNotesClearBtn();
        }

        // [냐냐 PATCH] 관용구 입력칸 펼치기/접기
        function toggleIdiomSection() {
            const box = document.getElementById('idiom-fields-box');
            const icon = document.getElementById('idiom-toggle-icon');
            if (!box || !icon) return;
            const isHidden = box.classList.contains('hidden');
            box.classList.toggle('hidden');
            icon.className = isHidden ? "fa-solid fa-minus text-xs" : "fa-solid fa-plus text-xs";
            // 처음 펼칠 때 입력칸이 하나도 없으면 자동으로 1개 추가
            const entriesBox = document.getElementById('idiom-entries-box');
            if (isHidden && entriesBox && entriesBox.children.length === 0) {
                addIdiomRow();
            }
        }

        // [냐냐 PATCH] 관용구를 여러 개 등록할 수 있도록 행(row) 추가/삭제
        let idiomRowCounter = 0;
        function addIdiomRow(idiomText = '', meaningText = '') {
            const entriesBox = document.getElementById('idiom-entries-box');
            if (!entriesBox) { console.warn('idiom-entries-box 엘리먼트를 찾을 수 없음 — index.html이 최신 버전이 아닐 수 있어요'); return; }
            const rowId = 'idiom-row-' + (idiomRowCounter++);
            const row = document.createElement('div');
            row.id = rowId;
            row.className = 'flex gap-2 items-start';
            row.innerHTML = `
                <input type="text" data-idiom-field="idiom" placeholder="예: ¿Qué tiempo hace?" autocomplete="off" value="${idiomText.replace(/"/g, '&quot;')}" class="flex-1 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <input type="text" data-idiom-field="meaning" placeholder="예: 날씨가 어때요?" autocomplete="off" value="${meaningText.replace(/"/g, '&quot;')}" class="flex-1 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <!-- [냐냐 요청] 관용구마다 AI 추천 — 비어 있으면 하나 추천해주고, 적어뒀으면 뜻을 채운다 -->
                <button type="button" onclick="autofillIdiomRow('${rowId}')" title="AI 추천 (비어 있으면 관용구를 추천, 적어뒀으면 뜻을 채워요)" class="w-9 h-9 shrink-0 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-600 flex items-center justify-center transition-all"><i class="fa-solid fa-wand-magic-sparkles text-xs"></i></button>
                <button type="button" onclick="document.getElementById('${rowId}').remove()" class="w-9 h-9 shrink-0 rounded-xl bg-slate-50 hover:bg-rose-50 hover:text-rose-500 text-slate-400 flex items-center justify-center transition-all"><i class="fa-solid fa-xmark text-xs"></i></button>
            `;
            entriesBox.appendChild(row);
        }

        // [냐냐 요청] 관용구 행 하나만 AI로 채우기
        //   칸이 비어 있으면 그 단어로 자주 쓰는 표현을 하나 추천하고,
        //   이미 적어뒀으면 뜻을 채운다(철자·강세도 고쳐줌). 이미 있는 것과는 안 겹치게 보낸다.
        async function autofillIdiomRow(rowId) {
            const row = document.getElementById(rowId);
            if (!row) return;
            const idiomInp = row.querySelector('[data-idiom-field="idiom"]');
            const meanInp = row.querySelector('[data-idiom-field="meaning"]');
            const word = (document.getElementById('input-word') || {}).value || '';
            if (!word.trim()) { showToast("먼저 단어를 입력해주세요!", "error"); return; }
            if (!hasGeminiApiKey()) { showToast("AI 추천은 설정에서 API 키를 등록해야 써요!", "error"); return; }

            const btn = row.querySelector('[onclick^="autofillIdiomRow"]');
            const icon = btn ? btn.querySelector('i') : null;
            const prevCls = icon ? icon.className : '';
            if (icon) icon.className = 'fa-solid fa-spinner fa-spin text-xs';

            try {
                const cur = idiomInp ? idiomInp.value.trim() : '';
                const meaning = (document.getElementById('input-meaning') || {}).value || '';
                // 다른 줄에 이미 있는 관용구 — 추천이 겹치지 않게
                const others = Array.prototype.slice.call(document.querySelectorAll('#idiom-entries-box [data-idiom-field="idiom"]'))
                    .map(i => i.value.trim()).filter(v => v && v !== cur);

                const schema = {
                    type: "OBJECT",
                    properties: {
                        idiom: { type: "STRING", description: "스페인어 관용구/자주 쓰는 표현. 강세 부호 정확히" },
                        meaning: { type: "STRING", description: "한국어 뜻 (짧고 자연스럽게)" }
                    },
                    required: ["idiom", "meaning"]
                };
                const prompt = cur
                    ? `스페인어 표현 "${cur}" 의 한국어 뜻을 채워줘. 철자나 강세가 틀렸으면 idiom 에 고쳐서 넣어줘. (관련 단어: "${word}"${meaning ? `, 뜻: ${meaning}` : ''})`
                    : `스페인어 단어 "${word}"${meaning ? `(뜻: ${meaning})` : ''} 를 쓰는 자주 쓰이는 관용구나 표현을 하나만 추천해줘.${others.length ? ` 다음과 겹치지 않게: ${others.join(', ')}` : ''}`;
                const sys = "You are a precise Spanish dictionary. Output strictly the JSON schema. Korean meaning. No markdown, no extra text.";
                const res = await callGemini(prompt, sys, schema);
                const data = (typeof res === 'string') ? extractAndParseJson(res) : res;
                if (!data) { showToast("AI 응답을 이해하지 못했어요. 다시 시도해주세요", "error"); return; }

                if (idiomInp && data.idiom) idiomInp.value = data.idiom.trim();
                if (meanInp && data.meaning) meanInp.value = data.meaning.trim();
                showToast(cur ? "관용구 뜻을 채웠어요! ✨" : `"${(data.idiom || '').trim()}" 를 추천했어요! ✨`, "success");
            } catch (e) {
                showToast("AI 추천 중 문제가 생겼어요. 잠시 후 다시 시도해주세요", "error");
            } finally {
                if (icon) icon.className = prevCls || 'fa-solid fa-wand-magic-sparkles text-xs';
            }
        }

        // [냐냐 요청] 예문도 같은 방식으로 — 비어 있으면 만들어주고, 적어뒀으면 번역을 채운다
        async function autofillExampleRow() {
            const spInp = document.getElementById('input-example');
            const meInp = document.getElementById('input-example-meaning');
            const word = (document.getElementById('input-word') || {}).value || '';
            if (!word.trim()) { showToast("먼저 단어를 입력해주세요!", "error"); return; }
            if (!hasGeminiApiKey()) { showToast("AI 추천은 설정에서 API 키를 등록해야 써요!", "error"); return; }

            const btn = document.getElementById('example-ai-btn');
            const icon = btn ? btn.querySelector('i') : null;
            const prevCls = icon ? icon.className : '';
            if (icon) icon.className = 'fa-solid fa-spinner fa-spin text-xs';

            try {
                const cur = spInp ? spInp.value.trim() : '';
                const meaning = (document.getElementById('input-meaning') || {}).value || '';
                const schema = {
                    type: "OBJECT",
                    properties: {
                        example: { type: "STRING", description: "그 단어를 쓴 스페인어 예문 한 문장. 강세 부호 정확히" },
                        meaning: { type: "STRING", description: "예문의 한국어 번역" }
                    },
                    required: ["example", "meaning"]
                };
                const prompt = cur
                    ? `스페인어 예문 "${cur}" 를 한국어로 번역해줘. 철자나 강세가 틀렸으면 example 에 고쳐서 넣어줘.`
                    : `스페인어 단어 "${word}"${meaning ? `(뜻: ${meaning})` : ''} 를 쓴 짧고 일상적인 예문 한 문장을 만들어줘.`;
                const sys = "You are a precise Spanish tutor. Output strictly the JSON schema. Korean translation. No markdown, no extra text.";
                const res = await callGemini(prompt, sys, schema);
                const data = (typeof res === 'string') ? extractAndParseJson(res) : res;
                if (!data) { showToast("AI 응답을 이해하지 못했어요. 다시 시도해주세요", "error"); return; }

                if (spInp && data.example) spInp.value = data.example.trim();
                if (meInp && data.meaning) meInp.value = data.meaning.trim();
                showToast(cur ? "예문 번역을 채웠어요! ✨" : "예문을 만들었어요! ✨", "success");
            } catch (e) {
                showToast("AI 추천 중 문제가 생겼어요. 잠시 후 다시 시도해주세요", "error");
            } finally {
                if (icon) icon.className = prevCls || 'fa-solid fa-wand-magic-sparkles text-xs';
            }
        }

        function clearIdiomRows() {
            const box = document.getElementById('idiom-entries-box');
            if (box) box.innerHTML = '';
        }

        function getIdiomRowsData() {
            const rows = document.querySelectorAll('#idiom-entries-box > div');
            const result = [];
            rows.forEach(row => {
                const idiomInput = row.querySelector('[data-idiom-field="idiom"]');
                const meaningInput = row.querySelector('[data-idiom-field="meaning"]');
                const idiomVal = idiomInput ? idiomInput.value.trim() : '';
                if (idiomVal) {
                    result.push({ idiom: idiomVal, idiomMeaning: meaningInput ? meaningInput.value.trim() : '' });
                }
            });
            return result;
        }

        // ============================================================
        // [냐냐 PATCH-5배치] 유의어 / 반의어 블록 (관용구와 동일한 +/- 방식)
        //   유의어 = 스카이(하늘색) · 반의어 = 로즈(빨강)
        //   저장 시: 미등록 유의어는 자동 등록 + 상대 단어에도 양방향 자동 연결
        // ============================================================
        const SYN_POS_ABBR = { noun:'n.', verb:'v.', adjective:'adj.', adverb:'adv.', preposition:'prep.',
                              conjunction:'conj.', pronoun:'pron.', interrogative:'int.', phrase:'phr.' };
        const SYN_TYPES = { synonym: { label: '유의어', chip: 'bg-sky-50 text-sky-600', dot: 'text-sky-500' },
                            antonym: { label: '반의어', chip: 'bg-rose-50 text-rose-600', dot: 'text-rose-500' } };

        function toggleSynonymSection() {
            const box = document.getElementById('syn-fields-box');
            const icon = document.getElementById('syn-toggle-icon');
            if (!box || !icon) return;
            const isHidden = box.classList.contains('hidden');
            box.classList.toggle('hidden');
            icon.className = isHidden ? "fa-solid fa-minus text-xs" : "fa-solid fa-plus text-xs";
            const entriesBox = document.getElementById('syn-entries-box');
            if (isHidden && entriesBox && entriesBox.children.length === 0) addSynonymRow();
        }

        let synRowCounter = 0;
        function addSynonymRow(data = {}) {
            const box = document.getElementById('syn-entries-box');
            if (!box) return;
            const rowId = 'syn-row-' + (synRowCounter++);
            const esc = (v) => String(v || '').replace(/"/g, '&quot;');
            const type = data.type === 'antonym' ? 'antonym' : 'synonym';
            // [냐냐 PATCH] 품사는 영어 약자로 (n. v. adj. ...)
            const posOpts = ALL_POS_LIST.map(p =>
                `<option value="${p}" ${data.pos === p ? 'selected' : ''}>${SYN_POS_ABBR[p] || p}</option>`).join('');
            const g = data.gender || 'none';

            const row = document.createElement('div');
            row.id = rowId;
            row.className = 'bg-slate-50/60 border border-slate-200 rounded-xl p-2.5 space-y-2';
            row.innerHTML = `
                <!-- [냐냐 PATCH] 1줄: [종류][단어][품사][뜻][성별][x] -->
                <div class="flex gap-2 items-center">
                    <select data-syn-field="type" onchange="styleSynonymRow('${rowId}')" class="shrink-0 bg-white px-2 py-2 rounded-lg border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-400">
                        <option value="synonym" ${type === 'synonym' ? 'selected' : ''}>유의어</option>
                        <option value="antonym" ${type === 'antonym' ? 'selected' : ''}>반의어</option>
                    </select>
                    <input type="text" data-syn-field="word" placeholder="단어" autocomplete="off" value="${esc(data.word)}" class="flex-1 min-w-0 bg-white px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-sky-400">
                    <!-- [냐냐 PATCH] 품사 + 성별을 나란히 (뜻이 사이에 끼지 않게) -->
                    <select data-syn-field="pos" onchange="styleSynonymRow('${rowId}')" class="shrink-0 bg-white px-1.5 py-2 rounded-lg border border-slate-200 text-xs font-normal text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-400">${posOpts}</select>
                    <select data-syn-field="gender" onchange="applySynonymArticle('${rowId}')" class="syn-gender-sel shrink-0 bg-white px-1.5 py-2 rounded-lg border border-slate-200 text-xs font-normal text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-400">
                        <option value="none" ${g === 'none' ? 'selected' : ''}>m./f.</option>
                        <option value="masculine" ${g === 'masculine' ? 'selected' : ''}>m.</option>
                        <option value="feminine" ${g === 'feminine' ? 'selected' : ''}>f.</option>
                    </select>
                    <input type="text" data-syn-field="meaning" placeholder="뜻" autocomplete="off" value="${esc(data.meaning)}" class="flex-1 min-w-0 bg-white px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400">
                    <button type="button" onclick="autofillSynonymRow('${rowId}')" title="이 단어 AI로 채우기 (뜻·품사·오타검수)" class="w-8 h-8 shrink-0 rounded-lg bg-white hover:bg-violet-50 hover:text-violet-500 text-slate-400 border border-slate-200 flex items-center justify-center transition-all"><i class="fa-solid fa-wand-magic-sparkles text-xs"></i></button>
                    <button type="button" onclick="document.getElementById('${rowId}').remove()" class="w-8 h-8 shrink-0 rounded-lg bg-white hover:bg-rose-50 hover:text-rose-500 text-slate-400 border border-slate-200 flex items-center justify-center transition-all"><i class="fa-solid fa-xmark text-xs"></i></button>
                </div>
                <!-- 2줄: 차이 설명 (유의어일 때만) -->
                <div class="flex gap-2 items-center">
                    <input type="text" data-syn-field="difference" placeholder="차이 (예: dormido : 완전히 잠든 상태 | adormecido : 잠들기 직전의 졸림)" autocomplete="off" value="${esc(data.difference)}" class="flex-1 min-w-0 bg-white px-3 py-2 rounded-lg border border-slate-200 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-sky-400">
                </div>
                <input type="hidden" data-syn-field="id" value="${esc(data.id)}">
            `;
            box.appendChild(row);
            styleSynonymRow(rowId);
        }

        // 종류(유의어/반의어)에 따라 블록 테두리 색을 바꿔줌
        function styleSynonymRow(rowId) {
            const row = document.getElementById(rowId);
            if (!row) return;
            const sel = row.querySelector('[data-syn-field="type"]');
            const isAnt = sel && sel.value === 'antonym';
            row.className = isAnt
                ? 'bg-rose-50/50 border border-rose-200 rounded-xl p-2.5 space-y-2'
                : 'bg-sky-50/50 border border-sky-200 rounded-xl p-2.5 space-y-2';
            // 명사가 아니면 성별 칸은 숨김
            const posSel = row.querySelector('[data-syn-field="pos"]');
            const genSel = row.querySelector('.syn-gender-sel');
            if (posSel && genSel) genSel.classList.toggle('hidden', posSel.value !== 'noun');
            if (posSel && posSel.value === 'noun') applySynonymArticle(rowId); // 명사면 관사 붙이기

            // [냐냐 PATCH] 반의어는 반대말이라 '차이' 설명이 필요 없음 → 칸 숨기고 값도 비움
            const diffInput = row.querySelector('[data-syn-field="difference"]');
            if (diffInput) {
                diffInput.classList.toggle('hidden', isAnt);
                if (isAnt) diffInput.value = '';
            }
        }

        // [냐냐 PATCH] 명사 + 성별이 정해지면 단어 칸에 관사를 바로 붙여줌 (la casa / el libro / el/la estudiante)
        function applySynonymArticle(rowId) {
            const row = document.getElementById(rowId);
            if (!row) return;
            const posSel = row.querySelector('[data-syn-field="pos"]');
            const genSel = row.querySelector('.syn-gender-sel');
            const wordInp = row.querySelector('[data-syn-field="word"]');
            if (!posSel || !genSel || !wordInp) return;
            if (posSel.value !== 'noun') return;
            const bare = wordInp.value.trim().replace(/^(el\/la|los\/las|un\/una|unos\/unas|el|la|los|las|un|una|unos|unas)\s+/i, '');
            if (!bare) return;
            wordInp.value = buildNounDisplayForm(bare, genSel.value, /s$/i.test(bare), 'noun');
        }

        // [냐냐 PATCH] 유의어 행 하나만 AI로 채우기 (뜻·품사·성별 + 철자 오타 교정)
        async function autofillSynonymRow(rowId) {
            const row = document.getElementById(rowId);
            if (!row) return;
            const wordInp = row.querySelector('[data-syn-field="word"]');
            const raw = wordInp ? wordInp.value.trim() : '';
            if (!raw) { showToast("먼저 유의어/반의어 단어를 입력해주세요!", "error"); return; }
            if (!hasGeminiApiKey()) { showToast("AI 추천은 설정에서 API 키를 등록해야 써요!", "error"); return; }

            const btn = row.querySelector('[onclick^="autofillSynonymRow"]');
            const icon = btn ? btn.querySelector('i') : null;
            const prevCls = icon ? icon.className : '';
            if (icon) icon.className = 'fa-solid fa-spinner fa-spin text-xs';

            try {
                const bare = raw.replace(/^(el\/la|los\/las|un\/una|unos\/unas|el|la|los|las|un|una|unos|unas)\s+/i, '');
                // 이 행이 유의어인지 반의어인지 + 원래(메인) 단어 파악
                const typeSel = row.querySelector('[data-syn-field="type"]');
                const isSynonym = !(typeSel && typeSel.value === 'antonym');
                const mainWord = (document.getElementById('input-word') || {}).value || '';
                const mainMeaning = (document.getElementById('input-meaning') || {}).value || '';

                const schema = {
                    type: "OBJECT",
                    properties: {
                        correctedWord: { type: "STRING", description: "철자 오타가 있으면 교정한 올바른 스페인어 단어(관사 없이). 정상이면 그대로" },
                        meaning: { type: "STRING", description: "핵심 한글 뜻 (짧게)" },
                        pos: { type: "STRING", enum: ["noun","verb","adjective","adverb","preposition","conjunction","pronoun","interrogative","phrase"] },
                        gender: { type: "STRING", enum: ["none","masculine","feminine"], description: "명사일 때만. 아니면 none" },
                        isPlural: { type: "BOOLEAN" },
                        difference: { type: "STRING", description: isSynonym
                            ? `유의어일 때만. "${mainWord}"와 이 단어의 차이. 반드시 형식: "${mainWord} : 설명 | ${bare} : 설명" (파이프로 구분, 콜론 뒤 명사형 짧은 설명). 서술형 금지`
                            : "반의어면 빈 문자열" }
                    },
                    required: ["correctedWord","meaning","pos","gender","difference"]
                };
                const prompt = isSynonym
                    ? `스페인어 단어 "${mainWord}"(뜻: ${mainMeaning})의 유의어로 "${bare}"를 등록하려 해. "${bare}"의 정보를 JSON으로 채워줘. 철자 틀렸으면 correctedWord에 교정. 뜻은 한국어로 짧게. difference에는 두 단어의 차이를 "단어A : 설명 | 단어B : 설명" 형식으로.`
                    : `스페인어 단어 "${bare}"의 정보를 JSON으로. 철자 틀렸으면 correctedWord에 교정. 뜻은 한국어로 짧게. difference는 빈 문자열.`;
                const sys = "You are a precise Spanish dictionary. Output strictly the JSON schema. Korean meaning. No markdown, no extra text.";
                const res = await callGemini(prompt, sys, schema);
                const data = (typeof res === 'string') ? extractAndParseJson(res) : res;
                if (!data) { showToast("AI 응답을 이해하지 못했어요. 다시 시도해주세요", "error"); return; }

                // 값 채우기
                const posSel = row.querySelector('[data-syn-field="pos"]');
                const genSel = row.querySelector('.syn-gender-sel');
                const meanInp = row.querySelector('[data-syn-field="meaning"]');
                if (posSel && data.pos) posSel.value = data.pos;
                if (genSel && data.gender) genSel.value = data.gender;
                if (meanInp && data.meaning) meanInp.value = data.meaning;
                // 차이 설명 채우기 (유의어만)
                const diffInp = row.querySelector('[data-syn-field="difference"]');
                if (diffInp && isSynonym && data.difference) diffInp.value = data.difference;
                // 오타 교정된 단어 + 관사 반영
                const fixed = (data.correctedWord || bare).trim();
                if (wordInp) {
                    wordInp.value = (data.pos === 'noun')
                        ? buildNounDisplayForm(fixed, data.gender, data.isPlural, 'noun')
                        : fixed;
                }
                styleSynonymRow(rowId); // 성별칸 표시/숨김 + 관사 재적용
                const wasTypo = fixed.toLowerCase() !== bare.toLowerCase();
                showToast(wasTypo ? `철자를 "${fixed}"로 고치고 정보를 채웠어요! ✨` : "AI가 정보를 채웠어요! ✨", "success");
            } catch (e) {
                showToast("AI 추천 중 문제가 생겼어요. 잠시 후 다시 시도해주세요", "error");
            } finally {
                if (icon) icon.className = prevCls || 'fa-solid fa-wand-magic-sparkles text-xs';
            }
        }

        function clearSynonymRows() {
            const box = document.getElementById('syn-entries-box');
            if (box) box.innerHTML = '';
        }

        // 폼에서 유의어 입력값 수집 (단어가 비어있는 줄은 무시)
        function getSynonymRowsData() {
            const rows = document.querySelectorAll('#syn-entries-box > div');
            const out = [];
            rows.forEach(row => {
                const get = (f) => { const el = row.querySelector(`[data-syn-field="${f}"]`); return el ? el.value.trim() : ''; };
                const word = get('word');
                if (!word) return;
                const pos = get('pos') || 'noun';
                const gender = get('gender') || 'none';
                const type = get('type') === 'antonym' ? 'antonym' : 'synonym';
                out.push({
                    id: get('id') || null,
                    // [냐냐 PATCH] 명사면 성별에 맞는 관사를 붙여서 저장
                    word: (pos === 'noun') ? buildNounDisplayForm(word, gender, /s$/i.test(word), pos) : word,
                    pos,
                    gender,
                    meaning: get('meaning'),
                    difference: (type === 'antonym') ? '' : get('difference'), // 반의어는 차이 설명 없음
                    type
                });
            });
            return out;
        }

        // 저장된 링크(id 기반)를 폼에 다시 채우기
        function fillSynonymRows(word) {
            clearSynonymRows();
            const links = (word && Array.isArray(word.synonyms)) ? word.synonyms : [];
            const box = document.getElementById('syn-fields-box');
            const icon = document.getElementById('syn-toggle-icon');
            links.forEach(link => {
                const target = vocabulary.find(v => v.id === link.id);
                if (!target) return; // 삭제된 단어는 건너뜀
                addSynonymRow({ id: target.id, word: target.word, pos: target.pos, gender: target.gender || 'none', meaning: target.meaning, difference: link.difference || '', type: link.type });
            });
            if (links.length > 0 && box && icon) {
                box.classList.remove('hidden');
                icon.className = "fa-solid fa-minus text-xs";
            }
        }

        // [냐냐 PATCH-5배치] 명사면 관사를 붙여서 표시형으로 (복수면 los/las)
        function buildNounDisplayForm(word, gender, isPlural, pos) {
            const raw = String(word || '').trim();
            if (!raw || pos !== 'noun') return raw;
            if (/^(el|la|los|las|un|una|unos|unas|el\/la|los\/las)\s+/i.test(raw)) return raw; // 이미 관사 있음
            let art;
            if (gender === 'feminine') art = isPlural ? 'las' : 'la';
            else if (gender === 'masculine') art = isPlural ? 'los' : 'el';
            else art = isPlural ? 'los/las' : 'el/la'; // 남녀공용
            return `${art} ${raw}`;
        }

        // 중복 판정: 단어 + 품사가 둘 다 같을 때만 같은 단어 (el poder 명사 ≠ poder 동사)
        //
        // [냐냐 요청] ⚠️ 악센트·물결표는 절대 떼고 비교하면 안 된다 — 스페인어는 뜻이 아예 달라진다.
        //   carne(고기) ≠ carné(증명서) · papa(감자) ≠ papá(아빠) · ano ≠ año(해)
        //   예전엔 NFD로 악센트를 떼서 비교했고, 그래서 carné를 carne의 중복으로 보고
        //   '합치기'(=한쪽 삭제)를 하자고 했다. NFC로 모양만 통일하고 글자는 그대로 본다.
        //   찾기·검색은 지금도 악센트를 무시한다(stripAccents) — 여기만 정확히 본다.
        function findExistingWord(wordText, pos, excludeId) {
            const norm = (t) => String(t || '').toLowerCase().trim()
                .normalize('NFC')
                .replace(/^(el\/la|los\/las|un\/una|unos\/unas|el|la|los|las|un|una|unos|unas)\s+/, '').trim();
            const target = norm(wordText);
            return vocabulary.find(w => w.id !== excludeId && norm(w.word) === target && w.pos === pos) || null;
        }

        // ⭐ 유의어/반의어 저장 — 자동 등록 + 양방향 연결 + 삭제된 링크 정리
        //   반환: { links, newIds, linkedNames }
        function applySynonymLinks(wordObj, rows) {
            const prevLinks = Array.isArray(wordObj.synonyms) ? wordObj.synonyms : [];
            const links = [];
            const newIds = [];      // 이번에 자동 등록된 단어들
            const linkedNames = []; // 자동 연결된 상대 단어 이름 (토스트용)

            rows.forEach(r => {
                // 1) 이미 링크된 단어(id 있음) → 그대로 사용
                let target = r.id ? vocabulary.find(v => v.id === r.id) : null;
                // 2) 단어+품사로 기존 단어 찾기 (중복 등록 방지)
                if (!target) target = findExistingWord(r.word, r.pos);
                // 3) 그래도 없으면 → 자동 등록 (단어·품사·뜻이 다 있으니 등록 요건 충족)
                if (!target) {
                    target = {
                        id: 'word-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
                        word: r.word,
                        meaning: r.meaning || '',
                        pos: r.pos || 'noun',
                        idioms: [],
                        example: '',
                        exampleMeaning: '',
                        notes: '',
                        mastered: false,
                        score: 0,
                        synonyms: []
                    };
                    if (target.pos === 'noun') target.gender = r.gender || 'none';
                    vocabulary.unshift(target);
                    newIds.push(target.id);
                    logAction('new-word'); // 자동 등록도 오늘 신규등록 카운트에 포함
                }
                if (target.id === wordObj.id) return; // 자기 자신은 링크 안 함

                links.push({ id: target.id, type: r.type, difference: r.difference || '' });

                // 4) 양방향 자동 연결 — 상대 단어에도 나를 걸어줌 (차이 설명은 그대로 공유)
                if (!Array.isArray(target.synonyms)) target.synonyms = [];
                const already = target.synonyms.find(l => l.id === wordObj.id);
                if (already) {
                    already.type = r.type;
                    already.difference = r.difference || '';
                } else {
                    target.synonyms.push({ id: wordObj.id, type: r.type, difference: r.difference || '' });
                    if (!newIds.includes(target.id)) linkedNames.push(target.word); // 새로 등록한 건 토스트에서 제외
                }
            });

            // 5) 내가 뺀(−) 링크는 상대 쪽에서도 제거 (양방향 해제)
            const keptIds = links.map(l => l.id);
            prevLinks.forEach(old => {
                if (keptIds.includes(old.id)) return;
                const other = vocabulary.find(v => v.id === old.id);
                if (other && Array.isArray(other.synonyms)) {
                    other.synonyms = other.synonyms.filter(l => l.id !== wordObj.id);
                }
            });

            wordObj.synonyms = links;
            return { links, newIds, linkedNames };
        }

        // [냐냐 PATCH-5배치] 자동 등록된 단어들의 상세정보를 차례로 채우기 (한 번에 한 창씩)
        let _synonymFillQueue = [];
        let _inSynonymFill = false; // 유의어 자동채우기 진행 중 표시 (저장 흐름 분기용)
        function processSynonymQueue() {
            if (!_synonymFillQueue || _synonymFillQueue.length === 0) { _inSynonymFill = false; return; }
            const nextId = _synonymFillQueue.shift();
            const w = vocabulary.find(v => v.id === nextId);
            if (!w) { processSynonymQueue(); return; }
            _inSynonymFill = true;
            // openWordModal이 이 단어의 저장된 유의어 링크(원래 단어 포함)를 폼에 복원해줌
            openWordModal(nextId);
            // [냐냐 요청] 문법 표의 단어 연결에서 온 흐름이면 단어창을 연결창 위로 올린다.
            //   안 올리면 연결창(z-60)이 단어창(z-50)을 덮어서 창이 "아예 안 뜨는" 것처럼 보인다.
            //   (연결창 흐름이 아니면 아무것도 안 한다)
            if (typeof liftWordModalOverWordLink === 'function') liftWordModalOverWordLink();
            // 자동완성은 "빈 칸만" 채우도록(forceOverwrite=false) → 이미 걸려있는 유의어 링크를 지우지 않음
            setTimeout(() => {
                if (typeof triggerAiAutofill === 'function') triggerAiAutofill(false);
            }, 300);
        }

        function clearConjugationFields() {
            // [냐냐 PATCH] 시제 블록 초기화 — 빈 현재시제 블록 하나만 남김
            const box = document.getElementById('conj-tense-blocks');
            if (box) { box.innerHTML = ''; addTenseBlock('presente', {}, 'regular', 'none'); }
        }

        function closeWordModal() {
            document.getElementById('word-modal').classList.add('hidden');
            hideAiLoadingOverlay();
            // [냐냐 요청] 단어 연결 화면에서 올려뒀던 경우 — 층·배경을 되돌리고,
            //   방금 고치거나 새로 등록한 내용을 반영해서 연결창을 다시 그린다
            if (typeof dropWordModalAfterWordLink === 'function' && dropWordModalAfterWordLink()) {
                if (typeof renderGrammarWordLink === 'function') renderGrammarWordLink();
            }
        }

        function showConfirm(title, desc, onOk, options = {}) {
            const modal = document.getElementById('confirm-modal');
            document.getElementById('confirm-modal-title').innerText = title;
            document.getElementById('confirm-modal-desc').innerText = desc;
            modal.classList.remove('hidden');

            // [냐냐 PATCH] 아이콘 커스터마이즈 (기본: 빨간 경고, 'happy'면 보라 스마일)
            const iconBox = document.getElementById('confirm-modal-icon-box');
            const iconEl = document.getElementById('confirm-modal-icon');
            if (iconBox && iconEl) {
                if (options.icon === 'happy') {
                    iconBox.className = "w-16 h-16 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center text-3xl mx-auto";
                    iconEl.className = "fa-solid fa-face-smile";
                } else if (options.icon === 'info') {
                    iconBox.className = "w-16 h-16 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center text-3xl mx-auto";
                    iconEl.className = "fa-solid fa-circle-info";
                } else {
                    iconBox.className = "w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-3xl mx-auto";
                    iconEl.className = "fa-solid fa-triangle-exclamation";
                }
            }

            const btnOk = document.getElementById('confirm-ok-btn');
            const btnCancel = document.getElementById('confirm-cancel-btn');

            // [냐냐 PATCH] 버튼 라벨/색상 커스터마이즈 (기본: 삭제 확정 - 빨강)
            btnOk.innerText = options.okLabel || '삭제 확정';
            btnCancel.innerText = options.cancelLabel || '취소';
            if (options.okStyle === 'primary') {
                btnOk.className = "flex-1 py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-sm transition-all active:scale-95 shadow-md shadow-violet-100";
            } else {
                btnOk.className = "flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-all active:scale-95 shadow-md shadow-red-100";
            }

            const cleanup = () => {
                modal.classList.add('hidden');
                btnOk.onclick = null;
                btnCancel.onclick = null;
            };

            btnOk.onclick = () => {
                onOk();
                cleanup();
            };
            btnCancel.onclick = () => {
                if (options.onCancel) options.onCancel();
                cleanup();
            };
            // [냐냐 PATCH] 엔터로 확인 버튼 실행 (연속 등록 편하게)
            //   [냐냐 요청] noEnter 면 자동 포커스도 엔터 실행도 안 한다.
            //   갑자기 뜨는 알림(예: 알 부화)에 이걸 켜야 한다 — 쓰기 복습처럼 엔터를 계속
            //   누르는 중에 팝업이 뜨면, 그 엔터가 확인 버튼을 눌러버려서 내용을 볼 새도 없이 사라진다.
            if (!options.noEnter) {
                setTimeout(() => { try { btnOk.focus(); } catch(e){} }, 50);
            }
            const keyHandler = (e) => {
                if (modal.classList.contains('hidden')) { document.removeEventListener('keydown', keyHandler); return; }
                if (e.key === 'Enter' && !options.noEnter) { e.preventDefault(); btnOk.click(); document.removeEventListener('keydown', keyHandler); }
                else if (e.key === 'Escape') { e.preventDefault(); btnCancel.click(); document.removeEventListener('keydown', keyHandler); }
            };
            document.addEventListener('keydown', keyHandler);
        }

        // ============================================================
        // [냐냐 요청] 한글 뜻만 알 때 — 뜻 칸에 한글을 적고 'AI 추천'을 누르면
        //   스페인어 단어부터 찾아준다. (예전엔 스페인어를 모르면 아무것도 못 했다:
        //   오프라인 사전은 18개뿐이고, AI 추천은 스페인어 단어 칸을 기준으로만 돌았다)
        //   후보가 하나면 바로 채워서 이어가고, 여럿이면 단어칸 아래 목록에서 고르게 한다
        //   ("빨래" → la colada / lavar la ropa 처럼 갈리는 경우가 많다)
        // ============================================================
        const hasKoreanText = (s) => /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(String(s || ''));

        async function findSpanishFromKorean(meaningText) {
            const btn = document.getElementById('ai-autofill-btn');
            const originalHtml = btn ? btn.innerHTML : '';
            if (btn) { btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> 찾는 중...`; }

            const prompt = `한국어 뜻 "${meaningText}" 에 해당하는 스페인어 단어·표현을 찾아주세요.
            - 실제로 쓰이는 것만 1~4개. 억지로 개수를 채우지 말 것.
            - 뜻이 갈리면 갈리는 대로 다 넣을 것. 예: "빨래" → la colada(빨랫감, 명사), lavar la ropa(빨래하다, 동사)
            - word: 명사면 관사를 붙여서(el/la), 동사는 원형, 그 외는 단어만.
            - meaning: 그 단어의 한국어 뜻을 짧게. 원래 물어본 뜻과 어떻게 다른지 드러나게 쓸 것.
            - pos 는 noun/verb/adjective/adverb/preposition/conjunction/pronoun/interrogative/phrase 중 하나.
            - 가장 흔하고 대표적인 것을 맨 앞에 둘 것.`;
            const system = "You are a Spanish-Korean dictionary. Output strictly valid JSON matching the schema. No explanations, no markdown fences.";
            const schema = {
                type: "OBJECT",
                properties: {
                    candidates: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                word: { type: "STRING", description: "스페인어 단어. 명사는 관사 포함(el libro), 동사는 원형" },
                                meaning: { type: "STRING", description: "짧은 한국어 뜻" },
                                pos: { type: "STRING", description: "noun|verb|adjective|adverb|preposition|conjunction|pronoun|interrogative|phrase" }
                            },
                            required: ["word", "meaning", "pos"]
                        }
                    }
                },
                required: ["candidates"]
            };

            try {
                const responseText = await callGemini(prompt, system, schema, 'low', GEMINI_MODEL_FLASH_LITE);
                const result = extractAndParseJson(responseText);
                const list = (result.candidates || []).filter(c => c && (c.word || '').trim()).slice(0, 4);
                if (!list.length) {
                    showToast(`"${meaningText}" 에 맞는 스페인어를 못 찾았어요. 뜻을 조금 다르게 적어보세요!`, "warning");
                    return;
                }
                if (list.length === 1) {
                    // 하나뿐이면 바로 채우고 원래 흐름(단어 분석)으로 이어간다
                    document.getElementById('input-word').value = list[0].word.trim();
                    showToast(`"${list[0].word.trim()}" 를 찾았어요! 이어서 채우는 중...`, "success");
                    await triggerAiAutofill();
                    return;
                }
                renderAiWordCandidates(list);
                showToast(`후보를 ${list.length}개 찾았어요. 맞는 걸 골라주세요!`, "info");
            } catch (e) {
                console.warn("한글→스페인어 찾기 실패", e);
                showToast(describeGeminiError(e), "error");
            } finally {
                if (btn) { btn.disabled = false; btn.innerHTML = originalHtml; }
            }
        }

        // 후보 목록은 단어칸 아래의 기존 자동완성 드롭다운 자리를 그대로 쓴다
        function renderAiWordCandidates(list) {
            const box = document.getElementById('word-suggestions');
            if (!box) return;
            box.innerHTML = list.map(c => {
                const safe = String(c.word).trim().replace(/'/g, "\\'");
                const posLabel = (typeof POS_LABELS !== 'undefined' && POS_LABELS[c.pos]) ? POS_LABELS[c.pos] : (c.pos || '');
                return `<div onclick="pickAiWordCandidate('${safe}')" class="px-4 py-2.5 hover:bg-violet-50 cursor-pointer flex items-center justify-between gap-2 text-xs transition-colors">
                    <div class="flex flex-col min-w-0">
                        <span class="font-bold text-slate-800 truncate">${escapeHtml(String(c.word).trim())}</span>
                        <span class="text-slate-400 text-[10px] truncate">${escapeHtml(c.meaning || '')}</span>
                    </div>
                    <span class="text-[9px] font-bold text-violet-600 bg-violet-50 rounded-md px-1.5 py-0.5 shrink-0">${escapeHtml(posLabel)}</span>
                </div>`;
            }).join('');
            box.classList.remove('hidden');
        }

        function pickAiWordCandidate(word) {
            document.getElementById('word-suggestions').classList.add('hidden');
            document.getElementById('input-word').value = word;
            triggerAiAutofill();
        }

        // PREMIUM LIVE AI AUTOFILL (Improved with actual Gemini intelligence for phrase & tip generation)
        async function triggerAiAutofill(force = true) {
            const rawWord = document.getElementById('input-word').value.trim();
            if (!rawWord) {
                // [냐냐 요청] 단어칸이 비어 있어도 뜻 칸에 한글이 있으면 거기서 스페인어를 찾아준다
                const meaningText = (document.getElementById('input-meaning')?.value || '').trim();
                if (hasKoreanText(meaningText)) {
                    if (!hasGeminiApiKey()) {
                        showToast("한글 뜻으로 스페인어를 찾으려면 Gemini API 키가 필요해요. 우측 상단 배지에서 등록해 주세요!", "warning");
                        openApiKeyModal();
                        return;
                    }
                    await findSpanishFromKorean(meaningText);
                    return;
                }
                showToast("단어 입력창에 스페인어 단어를 먼저 적어주세요! (한글 뜻만 알면 뜻 칸에 적고 눌러도 돼요)", "error");
                return;
            }

            // [PATCH] API 키가 없으면 굳이 실패할 호출을 시도하지 않고 바로 안내
            if (!hasGeminiApiKey()) {
                showToast("Gemini API 키가 없어서 AI 추천 대신 오프라인 추측을 사용합니다. 우측 상단 배지에서 키를 등록하면 진짜 AI 추천을 받을 수 있어요!", "warning");
                runOfflineAutofill(rawWord);
                return;
            }

            const btn = document.getElementById('ai-autofill-btn');
            const originalHtml = btn.innerHTML;
            
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> 분석 중...`;
            showAiLoadingOverlay();

            // [PATCH-속도개선] 프롬프트를 간결하게 줄여서 모델이 더 빠르게 응답하도록 함
            const prompt = `스페인어 단어 "${rawWord}"를 분석해서 JSON 스키마에 맞게 채워주세요.
            - 동사면 1인칭/e➡️ie/o➡️ue/e➡️i/완전불규칙 중 정확히 분류하고 현재시제 변형 전부 채울 것.
            - 어간모음 변화와 1인칭 불규칙이 함께 있으면 '1인칭 및 e ➡️ ie', '1인칭 및 e ➡️ i', '1인칭 및 o ➡️ ue'로 분류할 것. 예: tener(tengo, tienes...) = '1인칭 및 e ➡️ ie', decir(digo, dices, dice, decimos, decís, dicen) = '1인칭 및 e ➡️ i', venir(vengo, vienes...) = '1인칭 및 e ➡️ ie'.
            - 명사면 gender(성별)와 isPlural(복수형 여부)을 정확히 판단할 것. 입력 단어 자체가 이미 복수형이면(casas, libros 등) isPlural=true.
            - estudiante, artista, cantante처럼 남녀 형태가 같고 관사만 바뀌는 사람 명사는 isCommonGender=true, gender='none'으로 (앱이 el/la로 표시함).
            - 여성명사인데 강세 있는 a-/ha-로 시작해서 단수에서 el을 쓰는 단어(agua, águila, alma, hambre, aula 등)는 usesElDespiteFeminine=true로 표시.
            - **의문사(qué, quién, dónde, cuándo, cómo, cuánto, por qué, cuál 등)와 의문사가 들어간 의문 구문은 품사를 무조건 pos="interrogative"(의문사)로 할 것.** 부사/대명사/구문으로 분류하지 말 것.
            - example은 실제로 쓰일 법한 자연스러운 스페인어 문장 1개, exampleMeaning은 그 정확한 한국어 번역.
            - correctedSpelling: 입력 단어에 명백한 철자 오류가 있으면 올바른 철자만 여기에, 오타가 없으면 빈 문자열로 둘 것.
            - adjMasculineBase: 형용사인데 입력이 여성형/복수형이면 사전 표제형인 남성 단수형을 여기에(관사 없이). 이미 남성 단수형이거나 성별로 안 변하는 형용사(feliz, azul 등)면 빈 문자열. 오타 교정(correctedSpelling)과는 별개로, 형태만 여성→남성으로 바꾸는 용도임.
            - idioms에는 (1) 진짜 흔한 관용구/숙어뿐 아니라 (2) 이 단어의 "핵심 문형/구문 패턴"도 넣을 것.
              구문 패턴 예시:
                · 특정 전치사와 자주 쓰이면: idiom "enfadado con [사람]", idiomMeaning "~에게 화가 난" 처럼 패턴+뜻으로.
                · gustar류 동사(gustar, encantar, importar 등)면 문형을 보여줄 것: idiom "[간접목적대명사] encanta [주어]", idiomMeaning "[주어]가 (나는) 너무 좋다" 처럼.
              대괄호 [ ]로 자리(주어/사람/사물 등)를 표시. 진짜 유용한 것만 0~3개, 없으면 빈 배열 []. 억지로 만들지 말 것.
            - notes는 "정말 알아두면 도움되는 특이사항"이 있을 때만 작성. 없으면 빈 문자열 ""로 둘 것 (억지로 채우지 말 것).
              쓸 만한 내용 예: 흔한 혼동 단어와의 차이, ser/estar 구분, 역구조동사 같은 문장 구조, 문화적/구어적 뉘앙스, 예외적 용법.
              **동사 활용·불규칙 변화 이야기는 절대 쓰지 말 것 — 활용형은 시제 표에 이미 전부 들어 있어서 두 번 쓰는 셈이 됨.**
                금지 예: "1인칭 단수와 3인칭 어미의 z가 c로 변화", "어간 모음 o가 ue로 변하는 불규칙 동사", "-ucir로 끝나는 동사의 전형적 불규칙", "어간변화 동사", "완전 불규칙 동사".
                (역구조동사처럼 '어떻게 활용하는가'가 아니라 '어떤 문장 구조로 쓰는가'인 내용은 표에 없으므로 써도 됨)
              절대 쓰지 말 것: "사람의 성품/상태/감정을 나타내는 형용사", "~를 뜻하는 명사", "일상에서 자주 쓰는 동사" 같이 뻔한 분류 설명. 형용사의 성·수 변화 여부(성변화 없음, 수변화 없음 등)도 이미 별도 항목이라 절대 쓰지 말 것. 남녀 공통 명사/성 구분 없는 명사라는 설명도 관사(el/la)로 이미 표시되므로 쓰지 말 것. 특정 전치사와 함께 쓰인다는 내용은 notes가 아니라 idioms(구문 패턴)에 넣을 것. **유의어/반의어 이야기는 notes에 절대 쓰지 말 것 — synonyms 항목이 따로 있음.** 뻔한 말만 나올 거면 빈 문자열로 둘 것.
              형식: "· "로 시작하는 불릿, 최대 2줄, 각 줄 25자 이내, 줄바꿈은 \\n 하나. 인사말/이름 호칭 금지. "~함/~됨/~임" 서술형 대신 명사형으로 끝낼 것.
            - **synonyms (중요, 반드시 채울 것):** 이 단어의 유의어(type="synonym")와 반의어(type="antonym")를 넣을 것.
              · 반의어가 존재하는 단어(형용사·부사·대부분의 상태/방향/크기 표현)라면 **반의어를 반드시 최소 1개** 넣을 것. 예: feliz↔triste, grande↔pequeño, abrir↔cerrar, siempre↔nunca, subir↔bajar.
              · 유의어도 있으면 1~2개 넣을 것. 학습에 도움되는 실제로 쓰이는 단어만.
              · 각 항목마다 word(관사 없이 단어만) · pos(품사) · gender(명사면 masculine/feminine, 아니면 none) · isPlural · meaning(한글 뜻) · type 을 전부 채울 것.
              · **difference(차이)는 유의어(synonym)일 때만 채울 것. 반의어(antonym)는 반대말이라 차이 설명이 필요 없으므로 반드시 빈 문자열 "" 로 둘 것.**
              · 유의어의 difference: **아래 형식을 반드시 지킬 것 (다른 형식 금지)**
                형식: "단어A : 설명 | 단어B : 설명"
                  · 파이프( | )로 두 항목을 나누고, 콜론( : ) 앞에 단어, 뒤에 설명.
                  · 설명은 **명사형으로 짧게 끝낼 것.** 서술형/구어체 금지.
                  · 좋은 예: "dormido : 완전히 잠든 상태 | adormecido : 잠들기 직전의 졸림, 손발 저림"
                  · 좋은 예: "ser : 본질·영구적 속성 | estar : 일시적 상태"
                  · 좋은 예: "feliz : 마음속 지속적 행복 | alegre : 겉으로 드러나는 밝음"
                  · 나쁜 예(금지): "dormido는 완전히 잠든 상태이고, adormecido는 ~를 의미함" ← 서술형 금지
                  · 나쁜 예(금지): "~에 가깝고," ← "가까움" 처럼 명사형으로
                차이가 거의 없는 완전 동의어면 사용역 차이라도 같은 형식으로: "단어A : 구어체 | 단어B : 문어체".
              · 정말 유의어도 반의어도 없는 단어(고유명사 등)만 빈 배열 [] 허용.`;

            const system = "You are a precise Spanish dictionary engine. Output must strictly follow the given JSON schema, in Korean where applicable. No greetings, no markdown fences, no conversational filler — just the structured facts.";
            
            const schema = {
                type: "OBJECT",
                properties: {
                    meaning: { type: "STRING", description: "핵심 한글 뜻" },
                    correctedSpelling: { type: "STRING", description: "입력된 스페인어 단어에 명백한 철자 오류가 있으면 올바른 철자를 여기에 (관사 없이 단어만). 오타가 없으면 빈 문자열. 예: 입력이 'hblar'면 'hablar', 입력이 'comer'면 빈 문자열" },
                    pos: { type: "STRING", enum: ["noun", "verb", "adjective", "adverb", "preposition", "conjunction", "pronoun", "phrase"] },
                    gender: { type: "STRING", enum: ["none", "masculine", "feminine"] },
                    isCommonGender: { type: "BOOLEAN", description: "사람을 가리키는 명사인데 형태가 남녀 공통이라 관사만 바뀌는 경우 true (el/la estudiante, el/la artista, el/la cantante). 이 경우 gender는 'none'으로. 성별이 고정된 명사(libro=남, casa=여)는 false" },
                    isPlural: { type: "BOOLEAN", description: "명사가 복수형이면 true, 단수형이면 false. 명사가 아니면 false. 예: casas/libros는 true, casa/libro는 false" },
                    usesElDespiteFeminine: { type: "BOOLEAN", description: "여성명사이지만 강세 있는 a-/ha-로 시작해서 단수에서 정관사 el을 쓰는 경우 true (예: agua, águila, alma, hambre, aula → el agua, el águila). 그 외에는 false. 남성명사이거나 복수형이면 false" },
                    adjAgreement: { type: "STRING", enum: ["full", "no-gender", "no-number", "invariable"], description: "형용사일 때만 사용. full=성·수 둘 다 변화(bueno/buena/buenos/buenas). no-gender=성별로는 안 변하고 수(단/복수)만 변화 — 보통 -e, -ista, -l, -z 로 끝남(tolerante→tolerantes, feliz→felices, fácil→fáciles, optimista→optimistas). no-number=수로는 안 변하고 성만 변화(매우 드묾). invariable=완전 불변. ⚠️주의: 남성형/여성형이 똑같으면(성별로 안 변하면) no-gender임. tolerante는 남녀 동일하고 tolerantes로 복수화되므로 반드시 no-gender. 형용사가 아니면 'full'" },
                    adjMasculineBase: { type: "STRING", description: "형용사이고 입력이 여성형(또는 복수형)이면, 사전 표제형인 '남성 단수형'을 여기에 (관사 없이). 예: 입력이 'buena'/'buenas'/'buenos'면 'bueno', 'roja'면 'rojo'. 이미 남성 단수형이거나(bueno) 성별로 안 변하는 형용사(feliz, azul, tolerante)이거나 형용사가 아니면 빈 문자열." },
                    verbClass: { type: "STRING", enum: ["regular", "irregular"] },
                    irregularType: { type: "STRING", enum: ["1인칭", "e ➡️ ie", "o ➡️ ue", "e ➡️ i", "완전 불규칙", "1인칭 및 e ➡️ ie", "1인칭 및 e ➡️ i", "1인칭 및 o ➡️ ue", "기타 변형"] },
                    conjugations: {
                        type: "OBJECT",
                        description: "현재시제 6인칭 변형. 반드시 표준 스페인(카스티야) 스페인어 기준으로 작성할 것 — 'vos' 키는 아르헨티나식 단수 'vos'가 아니라 스페인의 2인칭 복수 'vosotros'를 의미함 (예: tener→vos:'tenéis', llevar→vos:'lleváis'). 절대 -ás/-és 같은 아르헨티나식 voseo 어미를 쓰지 말 것.",
                        properties: {
                            yo: { type: "STRING", description: "yo (1인칭 단수)" },
                            tu: { type: "STRING", description: "tú (2인칭 단수)" },
                            el: { type: "STRING", description: "él/ella (3인칭 단수)" },
                            nos: { type: "STRING", description: "nosotros (1인칭 복수)" },
                            vos: { type: "STRING", description: "vosotros — 스페인식 2인칭 복수 '너희'. 아르헨티나 voseo 아님. -áis/-éis/-ís 어미 사용" },
                            ellos: { type: "STRING", description: "ellos/ellas (3인칭 복수)" }
                        }
                    },
                    // [냐냐 요청] AI 추천 한 번에 현재분사까지 같이 받는다 (현재진행은 여기서 자동 생성됨)
                    gerundio: {
                        type: "OBJECT",
                        description: "동사일 때만 채울 것. 현재분사(gerundio). -ar→-ando, -er/-ir→-iendo. 재귀동사(-se로 끝나는 동사)는 재귀대명사를 뒤에 붙이고 악센트까지 표기 (secarse→secándose, dormirse→durmiéndose). 절대 estar를 붙이지 말 것. 동사가 아니면 빈 문자열.",
                        properties: {
                            form: { type: "STRING", description: "현재분사 형태 (악센트 정확히)" },
                            irregular: { type: "STRING", enum: ["none", "e ➡️ i", "o ➡️ u", "-yendo", "기타 변형"], description: "현재분사의 불규칙 갈래. none=규칙(-ando/-iendo). 'e ➡️ i'=pedir→pidiendo·decir→diciendo. 'o ➡️ u'=dormir→durmiendo·poder→pudiendo. '-yendo'=어간이 모음으로 끝남(leer→leyendo·oír→oyendo·ir→yendo)" }
                        }
                    },
                    // [냐냐 지적] 과거분사는 AI 추천에 빠져 있어서 손으로 채워야 했다 (2026-09-03).
                    //   ⚠️ 과거분사는 재귀대명사를 붙이지 않는다 (levantarse → levantado).
                    //      현재분사(levantándose)와 반대라서 여기 못박아 둔다.
                    participio: {
                        type: "OBJECT",
                        description: "동사일 때만 채울 것. 과거분사(participio). -ar→-ado, -er/-ir→-ido. 재귀동사(-se)는 재귀대명사를 절대 붙이지 말 것 (levantarse→levantado). haber 도 붙이지 말 것. 센모음(a·e·o) 뒤에서는 -ído 로 악센트를 찍는다 (leer→leído, traer→traído, oír→oído). 약모음 뒤는 그냥 -ido (construir→construido). 동사가 아니면 빈 문자열.",
                        properties: {
                            form: { type: "STRING", description: "과거분사 형태 (남성 단수, 악센트 정확히)" },
                            irregular: { type: "STRING", enum: ["none", "불규칙", "두 꼴 다 씀"], description: "none=규칙(-ado/-ido, -ído 포함). '불규칙'=abierto·escrito·puesto·dicho·hecho 처럼 어미가 다른 것. '두 꼴 다 씀'=imprimir→imprimido/impreso, freír→freído/frito 처럼 두 꼴이 다 살아 있는 것" }
                        }
                    },
                    example: { type: "STRING", description: "자연스러운 스페인어 예문 1개" },
                    idioms: {
                        type: "ARRAY",
                        description: "이 단어의 관용구/숙어 + 핵심 문형·구문 패턴. (1)흔한 관용구, (2)전치사 콜로케이션(예: idiom 'enfadado con [사람]', mean '~에게 화가 난'), (3)gustar류 문형(예: idiom '[간접목적대명사] encanta [주어]', mean '[주어]가 너무 좋다'). 대괄호로 자리 표시. 유용한 것만 0~3개, 없으면 []. 억지로 만들지 말 것",
                        items: {
                            type: "OBJECT",
                            properties: {
                                idiom: { type: "STRING", description: "관용구/숙어 또는 구문 패턴 (스페인어). 자리는 [주어]/[사람]/[사물] 같이 대괄호로. 예: ¿Qué tiempo hace?, enfadado con [사람]" },
                                idiomMeaning: { type: "STRING", description: "관용구/패턴의 한국어 뜻" }
                            },
                            required: ["idiom", "idiomMeaning"]
                        }
                    },
                    exampleMeaning: { type: "STRING", description: "예문의 정확한 한국어 번역" },
                    synonyms: {
                        type: "ARRAY",
                        description: "이 단어의 유의어(type=synonym)와 반의어(type=antonym). 1~4개. 반의어가 존재할 수 있는 단어(형용사·부사·상태/방향/크기/시간 표현, 대칭 동사 등)라면 반의어를 반드시 최소 1개 포함할 것. 유의어도 있으면 함께. difference(차이)는 유의어일 때만 채우고(두 단어 이름을 모두 언급), 반의어는 빈 문자열로 둘 것. 정말 유의어도 반의어도 없는 단어만 빈 배열 허용",
                        items: {
                            type: "OBJECT",
                            properties: {
                                word: { type: "STRING", description: "유의어/반의어 (스페인어, 관사 없이 단어만. 명사도 관사 빼고)" },
                                pos: { type: "STRING", enum: ["noun", "verb", "adjective", "adverb", "preposition", "conjunction", "pronoun", "phrase"], description: "그 단어의 품사" },
                                gender: { type: "STRING", enum: ["none", "masculine", "feminine"], description: "명사일 때만. 아니면 none" },
                                isPlural: { type: "BOOLEAN", description: "명사가 복수형이면 true" },
                                meaning: { type: "STRING", description: "그 단어의 핵심 한글 뜻" },
                                difference: { type: "STRING", description: "유의어(synonym)일 때만. 반드시 `단어A : 설명 | 단어B : 설명` 형식 (파이프로 구분, 콜론 뒤에 명사형 짧은 설명). 예: 'dormido : 완전히 잠든 상태 | adormecido : 잠들기 직전의 졸림'. 서술형 문장 금지. 반의어(antonym)는 반드시 빈 문자열" },
                                type: { type: "STRING", enum: ["synonym", "antonym"], description: "synonym=유의어, antonym=반의어" }
                            },
                            required: ["word", "pos", "gender", "meaning", "type"]
                        }
                    },
                    // [냐냐 요청] 동사 변화형은 시제 표에 이미 다 있으니 메모에 두 번 쓰지 않는다.
                    //   예전엔 허용 목록에 '불규칙'이 들어 있어서 "1인칭 단수 z가 c로 변화" 같은
                    //   표에 있는 내용이 메모에 그대로 또 들어왔다. 문장 구조(역구조동사 등)는 표에
                    //   없는 정보라 그대로 남긴다.
                    notes: { type: "STRING", description: "정말 도움되는 특이사항(혼동 단어 차이, ser/estar 구분, 역구조동사 같은 문장 구조, 뉘앙스, 예외 용법)만 · 불릿 2줄 이내로. 없으면 빈 문자열. 금지: 동사 활용·불규칙 변화 패턴 전부(활용은 시제 표에 이미 있음 — '1인칭 단수 z→c', '어간 o가 ue로 변함', '-ucir 동사의 전형적 불규칙', '어간변화 동사' 같은 서술 절대 금지), 뻔한 품사/뜻 분류('사람의 성품 묘사' 등), 형용사 성·수 변화 여부, 성별/관사, 전치사 콜로케이션(이건 idioms로). 명사형으로 끝낼 것" }
                },
                required: ["meaning", "pos", "gender", "verbClass", "example", "exampleMeaning", "notes"]
            };

            try {
                // 실시간 API 호출 시도 (thinkingLevel: minimal → 단순 사전 조회라 깊은 추론 불필요, 가장 빠름)
                const responseText = await callGemini(prompt, system, schema, 'minimal', GEMINI_MODEL_FLASH_LITE);
                // 대화형 응답이나 블록 헤더가 섞여 있어도 완벽하게 추출하여 분석
                const result = extractAndParseJson(responseText);

                // [냐냐 PATCH] 오타 감지: AI가 교정한 철자가 입력과 다르면 확인 팝업
                const corrected = (result.correctedSpelling || '').trim();
                const bareInput = rawWord.replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, '').trim().toLowerCase();
                const isRealCorrection = corrected && corrected.toLowerCase() !== bareInput && corrected.toLowerCase() !== rawWord.toLowerCase();

                // [냐냐 PATCH] 형용사 여성형/복수형 → 남성 단수 기본형 건의 (오타와 별개)
                const mascBase = (result.adjMasculineBase || '').trim();
                const isFeminineAdj = !isRealCorrection && result.pos === 'adjective' && mascBase
                    && mascBase.toLowerCase() !== bareInput && mascBase.toLowerCase() !== rawWord.toLowerCase();

                if (isRealCorrection) {
                    showConfirm(
                        `혹시 "${corrected}"를 쓰려던 거였나요?`,
                        `입력하신 "${rawWord}"에 오타가 있는 것 같아요. "${corrected}"(으)로 고쳐서 등록할까요? (취소를 누르면 입력한 그대로 둡니다)`,
                        () => {
                            // 수정: 교정된 철자로 단어칸 교체 후 적용
                            document.getElementById('input-word').value = corrected;
                            applyAutofillResult(result, force);
                            saveAiWordCache(corrected, result);
                            AudioFX.playSuccess();
                            showToast(`"${corrected}"(으)로 고쳐서 적용했어요 ✨`, "success");
                        },
                        {
                            okLabel: '수정',
                            cancelLabel: '취소',
                            okStyle: 'primary',
                            onCancel: () => {
                                // 취소: 입력한 철자 그대로 정보만 적용
                                applyAutofillResult(result, force);
                                saveAiWordCache(rawWord, result);
                                showToast("입력한 철자 그대로 정보를 적용했어요", "info");
                            }
                        }
                    );
                } else if (isFeminineAdj) {
                    showConfirm(
                        `혹시 여성형인가요? 남성형 "${mascBase}"로 바꿀까요?`,
                        `형용사는 보통 사전형인 남성 단수형으로 등록해요. 입력하신 "${rawWord}"는 여성형/복수형 같아서, 남성형 "${mascBase}"(으)로 바꿔서 등록할지 여쭤봐요. (그대로를 누르면 입력한 형태로 둡니다)`,
                        () => {
                            document.getElementById('input-word').value = mascBase;
                            applyAutofillResult(result, force);
                            saveAiWordCache(mascBase, result);
                            AudioFX.playSuccess();
                            showToast(`남성형 "${mascBase}"(으)로 바꿔서 적용했어요 ✨`, "success");
                        },
                        {
                            okLabel: '남성형으로',
                            cancelLabel: '그대로',
                            okStyle: 'primary',
                            onCancel: () => {
                                applyAutofillResult(result, force);
                                saveAiWordCache(rawWord, result);
                                AudioFX.playSuccess();
                                showToast("입력하신 형태 그대로 적용했어요 ✨", "info");
                            }
                        }
                    );
                } else {
                    applyAutofillResult(result, force); // 기본 true(덮어쓰기), 유의어 자동채우기에선 false
                    saveAiWordCache(rawWord, result); // [PATCH-속도개선] 다음 조회를 위해 캐시 저장
                    AudioFX.playSuccess();
                    showToast("Gemini AI 분석 완료! 추천 정보를 적용했어요 ✨", "success");
                }
            } catch (e) {
                console.warn("AI API 통신 실패: 오프라인 추측으로 자동 전환", e);
                showToast(`${describeGeminiError(e)} 오프라인 추측으로 대체합니다.`, "error");
                runOfflineAutofill(rawWord);
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
                hideAiLoadingOverlay();
                aiAutofillCompleted = true; // [냐냐 PATCH] AI 추천 완료 → 이제 엔터로 저장 가능
            }
        }

        // [PATCH-속도개선] 로딩 스켈레톤 + 경과시간 표시 (순수 UI 효과라 실제 응답 속도에는 영향 없음)
        let aiLoadingTimerHandle = null;
        function showAiLoadingOverlay() {
            const overlay = document.getElementById('ai-loading-overlay');
            const timerText = document.getElementById('ai-loading-timer-text');
            overlay.classList.remove('hidden');
            const startedAt = Date.now();
            clearInterval(aiLoadingTimerHandle);
            aiLoadingTimerHandle = setInterval(() => {
                const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
                timerText.innerText = `보통 3~5초 정도 걸려요 (${elapsed}초)`;
            }, 100);
        }
        function hideAiLoadingOverlay() {
            clearInterval(aiLoadingTimerHandle);
            document.getElementById('ai-loading-overlay').classList.add('hidden');
        }

        // 결과값 UI 대입 처리부 (사용자가 입력 중인 값은 보존)
        // [냐냐 PATCH] 강세 있는 a-/ha- 로 시작하는 단어인지 판별 (el agua 규칙용)
        // á/há 로 시작하면 확실히 강세. a/ha 로 시작하면 스페인어 강세 규칙상 첫 음절에 강세가 오는
        // 흔한 경우(자음+모음으로 끝나거나 s로 끝나는 단어)를 근사적으로 판단. 확실치 않은 애매한 경우는
        // 흔히 el을 쓰는 단어들을 화이트리스트로 보정.
        const EL_FEMININE_WORDS = new Set([
            'agua','águila','alma','ala','área','arma','aula','hacha','hada','hambre','habla',
            'ancla','ánfora','asa','aya','haba','ave','acta','ascua','asta'
        ]);
        function isStressedInitialA(word) {
            if (!word) return false;
            const w = word.trim().toLowerCase();
            // á 또는 há 로 시작 → 무조건 강세
            if (/^h?á/.test(w)) return true;
            // 화이트리스트(흔히 el을 쓰는 강세 a- 여성명사)
            const bare = w.replace(/^h/, '');
            if (EL_FEMININE_WORDS.has(w) || EL_FEMININE_WORDS.has(word.trim().toLowerCase())) return true;
            return false;
        }

        // [냐냐 PATCH] 의문사는 AI가 부사/구문으로 줘도 무조건 '의문사(interrogative)' 품사로 강제
        function coerceInterrogativePos(word, pos) {
            // 앞뒤 물음표·느낌표·기호를 다 떼고 판단 (¿Dónde? → donde)
            const w = String(word || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[¿?¡!.,;:"'()]/g, '').trim();
            const qWords = ['que','quien','quienes','donde','adonde','cuando','como','cuanto','cuanta','cuantos','cuantas','cual','cuales','porque'];
            const tokens = w.split(/\s+/).filter(Boolean);
            // 전치사 + 의문사 구문도 잡기 (de dónde, por qué, a dónde, con quién 등)
            //   → 짧은 구문(3단어 이하)에 의문사가 포함되면 의문사로 취급
            const hasQ = tokens.some(t => qWords.includes(t));
            if (qWords.includes(w) || (hasQ && tokens.length <= 3)) return 'interrogative';
            return pos;
        }

        function applyAutofillResult(result, forceOverwrite = false) {
            // 의문사 보정
            if (result && result.pos) {
                const rawW = document.getElementById('input-word') ? document.getElementById('input-word').value : '';
                result.pos = coerceInterrogativePos(rawW, result.pos);
            }
            const wordVal = document.getElementById('input-word').value.trim();
            
            const meaningInput = document.getElementById('input-meaning');
            // 사용자가 이미 뭔가를 적었다면, 강제 덮어쓰기 모드(추천 클릭)가 아닐 경우 지우지 않고 유지
            if (forceOverwrite || !meaningInput.value.trim()) {
                meaningInput.value = result.meaning || '';
            }

            const posInput = document.getElementById('input-pos');
            if (forceOverwrite || posInput.value === 'noun') {
                posInput.value = result.pos || 'noun';
            }
            togglePosFields();

            if (result.pos === 'noun') {
                const genderInput = document.getElementById('input-gender');
                // 남녀 공통 명사(estudiante 등)는 성별 없음으로 저장
                const effectiveGender = result.isCommonGender ? 'none' : (result.gender || 'none');
                if (forceOverwrite || genderInput.value === 'none') {
                    genderInput.value = effectiveGender;
                }
                // [냐냐 PATCH] 명사에 정관사 자동으로 붙이기 (복수형이면 los/las, 남녀공통이면 el/la, 이미 관사가 있으면 그대로 둠)
                const wordInput = document.getElementById('input-word');
                const curWord = wordInput.value.trim();
                const alreadyHasArticle = /^(el|la|los|las|un|una|unos|unas|el\/la|los\/las)\s+/i.test(curWord);
                if (curWord && !alreadyHasArticle) {
                    let article = '';
                    if (result.isCommonGender) {
                        // 남녀 공통 명사: el/la 로 표시 (복수면 los/las)
                        article = result.isPlural ? 'los/las' : 'el/la';
                    } else if (result.gender === 'masculine') {
                        article = result.isPlural ? 'los' : 'el';
                    } else if (result.gender === 'feminine') {
                        // 강세 있는 a-/ha- 로 시작하는 여성 단수 명사는 발음 때문에 el을 씀 (el agua, el águila, el alma).
                        // 단, 복수는 다시 las로 돌아감 (las aguas). 형용사는 계속 여성으로 받으므로 gender는 feminine 유지.
                        // AI 판단(usesElDespiteFeminine)을 우선 쓰되, 없으면 로컬 규칙으로 보정.
                        const takesEl = (result.usesElDespiteFeminine === true) || isStressedInitialA(curWord);
                        if (result.isPlural) article = 'las';
                        else article = takesEl ? 'el' : 'la';
                    }
                    if (article) wordInput.value = `${article} ${curWord}`;
                }
            } else if (result.pos === 'adjective') {
                const adjAgreementInput = document.getElementById('input-adj-agreement');
                if (forceOverwrite || adjAgreementInput.value === 'full') {
                    adjAgreementInput.value = result.adjAgreement || 'full';
                }
            } else if (result.pos === 'verb') {
                // [냐냐 PATCH] AI 자동완성은 현재시제 블록을 채움 (없으면 만들고, 빈칸만 채움)
                const box = document.getElementById('conj-tense-blocks');
                let presenteBlock = box ? [...box.querySelectorAll('.conj-tense-block')].find(b => b.querySelector('.conj-block-tense').value === 'presente') : null;
                if (!presenteBlock && box) {
                    addTenseBlock('presente', {}, result.verbClass || 'regular', result.irregularType || 'none');
                    presenteBlock = [...box.querySelectorAll('.conj-tense-block')].find(b => b.querySelector('.conj-block-tense').value === 'presente');
                }
                if (presenteBlock) {
                    // 규칙/불규칙 + 유형: 비어(규칙)있을 때만 또는 강제일 때만 반영
                    const clsSel = presenteBlock.querySelector('.conj-block-class');
                    const irrSel = presenteBlock.querySelector('.conj-block-irr');
                    if (forceOverwrite || clsSel.value === 'regular') {
                        clsSel.value = result.verbClass || 'regular';
                        onBlockClassChange(clsSel);
                        if (result.verbClass === 'irregular' && (forceOverwrite || irrSel.value === 'none')) irrSel.value = result.irregularType || '1인칭';
                    }
                    if (result.conjugations) {
                        CONJ_PERSON_KEYS.forEach(key => {
                            const cell = presenteBlock.querySelector(`[data-person="${key}"]`);
                            if (cell && (forceOverwrite || !cell.value.trim())) cell.value = result.conjugations[key] || '';
                        });
                    }
                }
                // [냐냐 요청] 현재분사도 같이 등록 — 블록이 없으면 만들어서 채운다 (현재진행은 여기서 자동 생성됨)
                const ger = result.gerundio || {};
                const gerForm = String(ger.form || '').trim();
                if (gerForm && box) {
                    const gerBlock = [...box.querySelectorAll('.conj-tense-block')].find(b => b.querySelector('.conj-block-tense').value === 'gerundio');
                    if (!gerBlock) {
                        const irr = GERUNDIO_IRREGULAR_ENUM.includes(ger.irregular) ? ger.irregular : 'none';
                        addTenseBlock('gerundio', { form: gerForm }, irr !== 'none' ? 'irregular' : 'regular', irr);
                    } else {
                        const cell = gerBlock.querySelector('[data-person="form"]');
                        if (cell && (forceOverwrite || !cell.value.trim())) cell.value = gerForm;
                        applySingleTenseIrregular(gerBlock, 'gerundio', ger.irregular);
                    }
                }
                // [냐냐 지적] 과거분사도 같이 등록 (현재분사와 같은 방식)
                const par = result.participio || {};
                const parForm = String(par.form || '').trim();
                if (parForm && box) {
                    const parBlock = [...box.querySelectorAll('.conj-tense-block')].find(b => b.querySelector('.conj-block-tense').value === 'participio');
                    if (!parBlock) {
                        const irr = irregularTypesFor('participio').includes(par.irregular) ? par.irregular : 'none';
                        addTenseBlock('participio', { form: parForm }, irr !== 'none' ? 'irregular' : 'regular', irr);
                    } else {
                        const cell = parBlock.querySelector('[data-person="form"]');
                        if (cell && (forceOverwrite || !cell.value.trim())) cell.value = parForm;
                        applySingleTenseIrregular(parBlock, 'participio', par.irregular);
                    }
                }
            }

            const exampleInput = document.getElementById('input-example');
            // 기본 형태의 유치한 예문인 경우에만 좋은 예문으로 자동 교체
            if (forceOverwrite || !exampleInput.value.trim() || exampleInput.value.startsWith('Quiero ') || exampleInput.value.startsWith('Me gusta ')) {
                exampleInput.value = result.example || '';
            }

            const exampleMeaningInput = document.getElementById('input-example-meaning');
            if (forceOverwrite || !exampleMeaningInput.value.trim()) {
                exampleMeaningInput.value = result.exampleMeaning || '';
            }

            // [냐냐 PATCH-5배치] AI가 유의어/반의어를 찾아줬으면 자동으로 채우고 섹션을 펼침
            // [냐냐 요청] 전체 ✨ 추천이어도 기존 유의어를 지우지 않고 '없는 것만 추가'로 합친다.
            //   예전엔 forceOverwrite면 clearSynonymRows()로 다 지워서, 이미 연결해둔
            //   양방향 링크가 통째로 끊어지는 문제가 있었음.
            if (result.synonyms && result.synonyms.length > 0) {
                // 이미 입력돼 있는 단어들 수집 (중복 추가 방지)
                const existing = new Set();
                document.querySelectorAll('#syn-entries-box > div').forEach(row => {
                    const inp = row.querySelector('input[data-syn-field="word"]');
                    if (inp && inp.value) existing.add(normalizeSpanishAnswer(inp.value));
                });
                let added = 0;
                result.synonyms.forEach(item => {
                    const t = item.type === 'antonym' ? 'antonym' : 'synonym';
                    // [냐냐 PATCH] 명사면 관사를 바로 붙여서 보여줌 (la casa)
                    const shown = buildNounDisplayForm(item.word, item.gender, item.isPlural, item.pos);
                    if (existing.has(normalizeSpanishAnswer(shown))) return; // 이미 있으면 건너뜀
                    existing.add(normalizeSpanishAnswer(shown));
                    added++;
                    addSynonymRow({
                        word: shown,
                        pos: item.pos || 'noun',
                        gender: item.gender || 'none',
                        meaning: item.meaning || '',
                        difference: (t === 'antonym') ? '' : (item.difference || ''), // 반의어는 차이 없음
                        type: t
                    });
                });
                if (added > 0) {
                    const synBoxAi = document.getElementById('syn-fields-box');
                    const synIconAi = document.getElementById('syn-toggle-icon');
                    if (synBoxAi) synBoxAi.classList.remove('hidden');
                    if (synIconAi) synIconAi.className = "fa-solid fa-minus text-xs";
                }
            }

            // [냐냐 PATCH] AI가 관용구를 찾아줬으면(여러 개 가능) 자동으로 채우고 섹션을 펼침
            if (result.idioms && result.idioms.length > 0) {
                clearIdiomRows();
                result.idioms.forEach(item => addIdiomRow(item.idiom, item.idiomMeaning));
                const idiomBoxAi = document.getElementById('idiom-fields-box');
                const idiomIconAi = document.getElementById('idiom-toggle-icon');
                if (idiomBoxAi) idiomBoxAi.classList.remove('hidden');
                if (idiomIconAi) idiomIconAi.className = "fa-solid fa-minus text-xs";
            }

            const notesInput = document.getElementById('input-notes');
            if (forceOverwrite || !notesInput.value.trim() || notesInput.value.includes('확인 필요') || notesInput.value.includes('직접 입력 필요')) {
                notesInput.value = result.notes || '';
            }
            toggleNotesClearBtn();
        }

        // API 키가 없을 때 도는 규칙 기반 추측 (하드코딩 사전은 뺐다 — 어미 규칙만 쓴다)
        function runOfflineAutofill(rawWord) {
            const cleanWord = rawWord.toLowerCase().trim().replace(/^(el\s+|la\s+|los\s+|las\s+)/, "");
            let match;
            // 동사형 규칙성 판별 (-ar, -er, -ir, 그리고 강세가 있는 -ír도 포함: oír, reír 등)
            if (cleanWord.endsWith("ar") || cleanWord.endsWith("er") || cleanWord.endsWith("ir") || cleanWord.endsWith("ír")) {
                const ending = cleanWord.slice(-2);
                const stem = cleanWord.slice(0, -2);
                let conj = {};
                
                if (ending === "ar") {
                    conj = { yo: stem+"o", tu: stem+"as", el: stem+"a", nos: stem+"amos", vos: stem+"áis", ellos: stem+"an" };
                } else if (ending === "er") {
                    conj = { yo: stem+"o", tu: stem+"es", el: stem+"e", nos: stem+"emos", vos: stem+"éis", ellos: stem+"en" };
                } else { // -ir 또는 -ír
                    conj = { yo: stem+"o", tu: stem+"es", el: stem+"e", nos: stem+"imos", vos: stem+"ís", ellos: stem+"en" };
                }
                
                match = {
                    meaning: "", 
                    pos: "verb",
                    verbClass: "regular",
                    irregularType: "none",
                    conjugations: conj,
                    example: `Quiero ${rawWord} hoy.`,
                    exampleMeaning: `나는 오늘 ${rawWord}하고 싶어.`, 
                    notes: "· 어미 규칙으로 현재시제 자동 계산\n· 뜻과 예문은 직접 입력 필요"
                };
            } else if (["con", "para", "por", "de", "en", "sin"].includes(cleanWord)) {
                match = {
                    meaning: "",
                    pos: "preposition",
                    example: `Voy a ir ${rawWord} mi amigo.`,
                    exampleMeaning: `나는 내 친구${rawWord} 같이 갈 거야.`,
                    notes: "· 자주 쓰이는 전치사\n· 뒤에 오는 명사와의 결합에 주의"
                };
            } else if (["y", "o", "pero", "porque", "como", "que"].includes(cleanWord)) {
                match = {
                    meaning: "",
                    pos: "conjunction",
                    example: `No voy ${rawWord} no quiero.`,
                    exampleMeaning: `나는 가고 싶지 않기 ${rawWord} 안 가.`,
                    notes: "· 문장을 이어주는 접속사"
                };
            } else {
                // 명사형 남/여성 기본 유추 및 관사 일치 처리 (Me gusta pelo 해소)
                const isFeminine = cleanWord.endsWith("a") || cleanWord.endsWith("ción") || cleanWord.endsWith("dad");
                const article = isFeminine ? "la" : "el";
                match = {
                    meaning: "", 
                    pos: "noun",
                    gender: isFeminine ? "feminine" : "masculine",
                    example: `Me gusta ${article} ${cleanWord}.`,
                    exampleMeaning: `나는 그 ${isFeminine ? '여성명사' : '남성명사'}(${cleanWord})를 좋아해.`, 
                    notes: "· 어미로 품사·성별 추정 (확인 필요)\n· 뜻은 직접 입력 필요"
                };
            }

            // UI에 적용 (AI 추천의 fallback이므로 덮어쓰기 허용)
            applyAutofillResult(match, true);
            AudioFX.playSuccess();
            aiAutofillCompleted = true; // [냐냐 PATCH] 오프라인 추천 완료 → 엔터로 저장 가능
            showToast(`품사/성별 규칙이 자동 세팅되었습니다! 뜻과 예문 번역을 완성해 주세요! 💡`, "warning");
        }

        // REAL-TIME SMART AUTOFILL ENGINE (실시간 어순 분석)
        function handleWordInput(value) {
            const suggestionsContainer = document.getElementById('word-suggestions');
            
            if (!value.trim()) {
                suggestionsContainer.classList.add('hidden');
                return;
            }

            // [PATCH] 어차피 'AI 추천' 버튼으로 정확하게 채우므로, 타이핑만으로 추측해서
            // 자동으로 채우던 기능은 제거함. 아래는 자동완성 후보 목록만 보여줌.
            showSuggestions(value.trim());
        }

        function showSuggestions(query) {
            const container = document.getElementById('word-suggestions');
            const cleanQuery = stripAccents(query.toLowerCase().trim()); // [냐냐 PATCH] 악센트 무시
            const results = [];

            // [냐냐 요청] 내 단어장에서만 찾는다 (하드코딩 사전 18개는 뺐다 — 검색만 어지럽혔다)
            vocabulary.forEach(item => {
                if (stripAccents(item.word.toLowerCase()).includes(cleanQuery)) {
                    results.push({ key: item.word, meaning: item.meaning, pos: item.pos, gender: item.gender, registeredId: item.id });
                }
            });

            if (results.length === 0) {
                container.classList.add('hidden');
                return;
            }

            // [냐냐 PATCH] 정렬 우선순위: ①정확히 일치 → ②그 단어로 시작 → ③포함, 각 그룹 안에서는 ABC순
            const stripArt = (w) => stripAccents((w || '').toLowerCase().trim().replace(/^(el\/la|los\/las|el|la|los|las|un|una|unos|unas)\s+/, '').trim());
            const q = cleanQuery;
            const rank = (w) => {
                const s = stripArt(w);
                if (s === q) return 0;            // 정확히 일치 → 맨 위
                if (s.startsWith(q)) return 1;    // 입력으로 시작
                return 2;                          // 그냥 포함
            };
            results.sort((a, b) => {
                const ra = rank(a.key), rb = rank(b.key);
                if (ra !== rb) return ra - rb;
                return stripArt(a.key).localeCompare(stripArt(b.key), 'es', { sensitivity: 'base' });
            });

            container.classList.remove('hidden');
            let html = '';
            results.slice(0, 15).forEach(r => {
                const safeKey = r.key.replace(/'/g, "\\'");
                html += `
                    <div onclick="selectSuggestion('${safeKey}', ${r.registeredId ? `'${r.registeredId}'` : 'null'})" class="px-4 py-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs transition-colors gap-2">
                        <div class="flex flex-col min-w-0">
                            <span class="font-bold text-slate-800 truncate">${r.key}</span>
                            <span class="text-slate-400 text-[10px] truncate">${r.meaning}</span>
                        </div>
                        <span class="flex items-center gap-1 shrink-0">
                            ${r.registeredId ? '<span class="text-[9px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold">등록됨</span>' : ''}
                            <span class="text-[9px] bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full font-bold uppercase">${getPosAbbreviation(r.pos, r.gender)}</span>
                        </span>
                    </div>
                `;
            });
            container.innerHTML = html;
        }

        function selectSuggestion(word, registeredId) {
            document.getElementById('word-suggestions').classList.add('hidden');

            if (registeredId) {
                // 이미 등록된 단어 → 중복 등록 대신 수정 모드로 열기
                openWordModal(registeredId);
                showToast("이미 등록된 단어예요! 수정 모드로 열었어요 ✏️", "info");
                return;
            }
            // 후보는 이제 전부 내 단어장에서 오므로 여기까지 오지 않는다 (안전장치)
            document.getElementById('input-word').value = word;
        }

        // Save Word Action
        // ============================================================
        // [냐냐 PATCH-3차] 중복 단어 반반 비교 편집창
        //   중복 판정 = 단어 + 품사가 둘 다 같을 때 (el poder 명사 ≠ poder 동사)
        //   좌 = 기존 / 우 = 신규. 양쪽 각각 편집 가능. 최종 하나만 선택.
        //   ⚠️ 단어 모달은 전역 상태를 쓰므로, 여기선 폼 상태를 "스냅샷 객체"로 분리해서 다룸
        // ============================================================
        let dupState = null; // { oldWord, newWord, oldId }

        // 현재 등록 폼의 모든 값을 하나의 단어 객체(스냅샷)로 뽑아냄
        function snapshotWordForm() {
            const val = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
            return {
                word: val('input-word'),
                meaning: val('input-meaning'),
                pos: val('input-pos'),
                gender: val('input-gender'),
                adjAgreement: val('input-adj-agreement'),
                notes: val('input-notes'),
                example: val('input-example'),
                exampleMeaning: val('input-example-meaning'),
                idioms: getIdiomRowsData(),
                _synRows: getSynonymRowsData(),
                conjugationsByTense: collectConjByTense(),
                irregularByTense: collectVerbInfoByTense().irregularByTense,
                verbClassByTense: collectVerbInfoByTense().verbClassByTense
            };
        }

        // 스냅샷 → 화면에 보여줄 읽기/편집 카드 HTML
        function buildDupSideHtml(side, w) {
            const isOld = side === 'old';
            const title = isOld ? '기존 단어' : '신규 입력';
            const badge = isOld ? 'bg-slate-100 text-slate-600' : 'bg-violet-100 text-violet-700';
            const border = isOld ? 'border-slate-300' : 'border-violet-400';
            const inp = (field, label, value, ph = '') => `
                <div class="space-y-1">
                    <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">${label}</label>
                    <input type="text" data-dup="${side}" data-field="${field}" value="${String(value || '').replace(/"/g, '&quot;')}" placeholder="${ph}" class="w-full bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-violet-400">
                </div>`;

            // 관용구·유의어·시제는 편집 대신 "요약 표시" (편집하려면 창 닫고 원래 폼에서)
            const idiomTxt = (w.idioms && w.idioms.length)
                ? w.idioms.map(it => `${escapeHtml(it.idiom)} <span class="text-slate-400">— ${escapeHtml(it.idiomMeaning || '')}</span>`).join('<br>')
                : '<span class="text-slate-300">없음</span>';
            const synRows = w._synRows || [];
            const synTxt = synRows.length
                ? synRows.map(r => `<span class="${r.type === 'antonym' ? 'text-rose-600' : 'text-sky-600'} font-bold">${r.type === 'antonym' ? '반의어' : '유의어'}</span> ${escapeHtml(r.word)} <span class="text-slate-400">${escapeHtml(r.meaning || '')}</span>`).join('<br>')
                : '<span class="text-slate-300">없음</span>';
            const tenseKeys = Object.keys(w.conjugationsByTense || {}).filter(k => {
                const c = w.conjugationsByTense[k];
                return c && (c.yo || c.tu || c.el || c.nos || c.vos || c.ellos || c.form);
            });
            const tenseTxt = tenseKeys.length
                ? tenseKeys.map(k => {
                    const o = TENSE_TYPE_OPTIONS.find(t => t.key === k);
                    return `<span class="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[10px] font-bold">${escapeHtml(o ? o.label : k)}</span>`;
                  }).join(' ')
                : '<span class="text-slate-300">없음</span>';

            const scoreTxt = isOld && dupState && dupState.oldWord && typeof dupState.oldWord.score === 'number'
                ? `<div class="text-[11px] font-bold text-slate-500">현재 점수: <span class="text-slate-800">${formatScore(dupState.oldWord)}</span> · 정답 ${dupState.oldWord.correctTotal || 0} / 오답 ${dupState.oldWord.wrongTotal || 0}</div>`
                : '';

            return `
            <div class="border-2 ${border} rounded-2xl p-4 space-y-3 bg-white">
                <div class="flex items-center justify-between">
                    <span class="px-2.5 py-1 rounded-lg text-[11px] font-black ${badge}">${title}</span>
                    ${scoreTxt}
                </div>
                ${inp('word', '단어', w.word)}
                ${inp('meaning', '뜻', w.meaning)}
                <div class="grid grid-cols-2 gap-2">
                    <div class="space-y-1">
                        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">품사</label>
                        <select data-dup="${side}" data-field="pos" class="w-full bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-violet-400">
                            ${ALL_POS_LIST.map(p => `<option value="${p}" ${w.pos === p ? 'selected' : ''}>${POS_LABELS[p] || p}</option>`).join('')}
                        </select>
                    </div>
                    <div class="space-y-1">
                        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">성별</label>
                        <select data-dup="${side}" data-field="gender" class="w-full bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-violet-400">
                            <option value="none" ${(!w.gender || w.gender === 'none') ? 'selected' : ''}>없음/공용</option>
                            <option value="masculine" ${w.gender === 'masculine' ? 'selected' : ''}>남성 (el)</option>
                            <option value="feminine" ${w.gender === 'feminine' ? 'selected' : ''}>여성 (la)</option>
                        </select>
                    </div>
                </div>
                ${inp('example', '예문', w.example)}
                ${inp('exampleMeaning', '예문 뜻', w.exampleMeaning)}
                <div class="space-y-1">
                    <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">메모</label>
                    <textarea data-dup="${side}" data-field="notes" rows="2" class="w-full bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">${escapeHtml(w.notes || '')}</textarea>
                </div>
                <div class="bg-slate-50 rounded-xl p-2.5 space-y-2 text-[12px] leading-relaxed">
                    <div><span class="text-[10px] font-black text-violet-600 uppercase">관용구</span><div class="mt-0.5">${idiomTxt}</div></div>
                    <div class="border-t border-slate-200 pt-2"><span class="text-[10px] font-black text-sky-600 uppercase">유의어·반의어</span><div class="mt-0.5">${synTxt}</div></div>
                    <div class="border-t border-slate-200 pt-2"><span class="text-[10px] font-black text-indigo-600 uppercase">등록된 시제</span><div class="mt-0.5 flex flex-wrap gap-1">${tenseTxt}</div></div>
                </div>
            </div>`;
        }

        function openDupModal(oldWord, newSnapshot, mergeFromId) {
            dupState = {
                oldId: oldWord.id,
                oldWord,
                mergeFromId: mergeFromId || null, // 수정 중이던 단어 (합쳐진 뒤 삭제됨)
                // 기존 단어 → 스냅샷 형태로 변환 (링크는 폼 행 형태로)
                oldSnap: {
                    word: oldWord.word, meaning: oldWord.meaning, pos: oldWord.pos,
                    gender: oldWord.gender || 'none', adjAgreement: oldWord.adjAgreement || 'full',
                    notes: oldWord.notes || '', example: oldWord.example || '', exampleMeaning: oldWord.exampleMeaning || '',
                    idioms: (oldWord.idioms && oldWord.idioms.length) ? oldWord.idioms : (oldWord.idiom ? [{ idiom: oldWord.idiom, idiomMeaning: oldWord.idiomMeaning || '' }] : []),
                    _synRows: (oldWord.synonyms || []).map(l => {
                        const t = vocabulary.find(v => v.id === l.id);
                        return t ? { id: t.id, word: t.word, pos: t.pos, meaning: t.meaning, difference: l.difference || '', type: l.type } : null;
                    }).filter(Boolean),
                    conjugationsByTense: oldWord.conjugationsByTense || (oldWord.conjugations ? { presente: oldWord.conjugations } : {}),
                    irregularByTense: oldWord.irregularByTense || {},
                    verbClassByTense: oldWord.verbClassByTense || {}
                },
                newSnap: newSnapshot
            };
            const sub = document.getElementById('dup-modal-sub');
            if (sub) sub.innerText = `"${newSnapshot.word}" (${POS_LABELS[newSnapshot.pos] || newSnapshot.pos}) — 양쪽 다 고칠 수 있어요. 남길 쪽을 골라주세요.`;
            document.getElementById('dup-side-old').innerHTML = buildDupSideHtml('old', dupState.oldSnap);
            document.getElementById('dup-side-new').innerHTML = buildDupSideHtml('new', dupState.newSnap);
            document.getElementById('dup-modal').classList.remove('hidden');
        }

        function closeDupModal() {
            document.getElementById('dup-modal').classList.add('hidden');
            dupState = null;
        }

        // 비교창의 편집 내용을 스냅샷에 다시 반영
        function collectDupSide(side) {
            const base = (side === 'old') ? { ...dupState.oldSnap } : { ...dupState.newSnap };
            document.querySelectorAll(`[data-dup="${side}"]`).forEach(el => {
                base[el.dataset.field] = el.value.trim();
            });
            return base;
        }

        // 최종 선택 — 고른 쪽만 남기고 나머지는 버림
        function resolveDuplicate(side) {
            if (!dupState) return;
            const chosen = collectDupSide(side);
            if (!chosen.word || !chosen.meaning) {
                showToast("단어와 뜻은 비워둘 수 없어요!", "error");
                return;
            }
            const target = vocabulary.find(v => v.id === dupState.oldId);
            if (!target) { closeDupModal(); return; }

            // 기존 단어 객체를 덮어씀 → 점수/학습기록은 그대로 유지됨 (중복 단어가 새로 안 생김)
            target.word = chosen.word;
            target.meaning = chosen.meaning;
            target.pos = chosen.pos;
            target.gender = chosen.gender;
            target.notes = chosen.notes || '';
            target.example = chosen.example || '';
            target.exampleMeaning = chosen.exampleMeaning || '';
            target.idioms = chosen.idioms || [];
            target.conjugationsByTense = chosen.conjugationsByTense || {};
            target.irregularByTense = chosen.irregularByTense || {};
            target.verbClassByTense = chosen.verbClassByTense || {};
            if (target.conjugationsByTense.presente) target.conjugations = target.conjugationsByTense.presente;

            // 유의어 링크도 고른 쪽 기준으로 다시 연결
            const synResult = applySynonymLinks(target, chosen._synRows || []);
            if (synResult.newIds.length > 0) _synonymFillQueue = [...synResult.newIds];

            // [냐냐 PATCH] 수정하다가 중복이 된 경우 → 두 단어를 하나로 합치고, 고치던 쪽은 삭제
            //   점수는 더 높은 쪽, 정답/오답 횟수는 합산해서 보존
            let mergedNote = '';
            if (dupState.mergeFromId && dupState.mergeFromId !== target.id) {
                const dying = vocabulary.find(v => v.id === dupState.mergeFromId);
                if (dying) {
                    target.score = clampScore(Math.max(getScore(target), getScore(dying)));
                    target.correctTotal = (target.correctTotal || 0) + (dying.correctTotal || 0);
                    target.wrongTotal = (target.wrongTotal || 0) + (dying.wrongTotal || 0);
                    if (dying.subjectivePassed) target.subjectivePassed = true;
                    syncWordFlags(target);

                    // 사라지는 단어를 유의어로 걸어둔 곳에서 링크 제거
                    vocabulary.forEach(other => {
                        if (Array.isArray(other.synonyms)) {
                            other.synonyms = other.synonyms.filter(l => l.id !== dying.id);
                        }
                    });
                    vocabulary = vocabulary.filter(v => v.id !== dying.id);
                    if (typeof logAction === 'function') logAction('undo-new-word'); // 단어 수 -1
                    mergedNote = ' (중복 단어 2개를 하나로 합쳤어요)';
                }
            }

            closeDupModal();
            closeWordModal();
            logAction('snapshot');
            renderWordList();
            updateStats();
            saveToStorage();
            showToast(side === 'old'
                ? `기존 "${target.word}" 를 남겼어요 (점수·기록 유지)${mergedNote} ✅`
                : `신규 내용으로 "${target.word}" 를 덮어썼어요 (점수·기록 유지)${mergedNote} ✅`, "success");

            if (_synonymFillQueue.length > 0) setTimeout(() => processSynonymQueue(), 250);
        }

        function saveWord() {
            const wordVal = document.getElementById('input-word').value.trim();
            const meaningVal = document.getElementById('input-meaning').value.trim();
            
            if (!wordVal || !meaningVal) {
                showToast("단어 이름과 뜻은 필수입니다!", "error");
                return;
            }

            const modalId = document.getElementById('modal-word-id').value;

            // [냐냐 PATCH-3차] "단어 + 품사"가 둘 다 같으면 → 반반 비교 편집창
            //   · 신규 등록뿐 아니라 [냐냐 PATCH] 수정할 때도 검사 (품사를 바꾸면 중복이 생길 수 있음)
            //   · 자기 자신은 제외
            {
                const posVal = document.getElementById('input-pos').value;
                const dup = findExistingWord(wordVal, posVal, modalId || null);
                if (dup) {
                    // 수정 중이면: 지금 고치던 단어(modalId)는 합쳐진 뒤 사라짐
                    openDupModal(dup, snapshotWordForm(), modalId || null);
                    return;
                }
            }

            performSaveWord();
        }

        // [냐냐 PATCH] 단어 등록/수정 모달: AI 추천 완료 후 아무 칸에서 엔터 = 저장 (Shift+엔터는 줄바꿈)
        function handleWordModalKey(event) {
            if (event.key !== 'Enter' || event.shiftKey) return;
            if (!aiAutofillCompleted) return; // AI 추천 전에는 저장 안 함 (단어칸 엔터는 자체 핸들러가 추천 실행)
            const el = event.target;
            // 단어 입력칸은 자체 onkeydown이 처리하므로 건너뜀
            if (el && el.id === 'input-word') return;
            // input/textarea/select에서만 반응
            const tag = (el && el.tagName) ? el.tagName.toLowerCase() : '';
            if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') return;
            event.preventDefault();
            saveWord();
        }

        function performSaveWord() {
            const wordVal = document.getElementById('input-word').value.trim();
            const meaningVal = document.getElementById('input-meaning').value.trim();
            const modalId = document.getElementById('modal-word-id').value;
            const pos = document.getElementById('input-pos').value;

            // [냐냐 PATCH] 새 등록은 항상 고유한 새 id를 부여 (중복 등록 시 원본과 id가 겹쳐
            // 한쪽을 지우면 다른 쪽도 지워지던 문제 방지). 수정 모드일 때만 기존 id 유지.
            const newId = 'word-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

            let wordObj = {
                id: modalId || newId,
                word: wordVal,
                meaning: meaningVal,
                pos: pos,
                example: document.getElementById('input-example').value.trim(),
                exampleMeaning: document.getElementById('input-example-meaning').value.trim(),
                idioms: getIdiomRowsData(),
                notes: document.getElementById('input-notes').value.replace(/\s+$/, ''), // [냐냐 PATCH] 맨 앞 들여쓰기 공백은 보존, 끝쪽 공백만 정리
                mastered: false
            };

            if (pos === 'noun') {
                wordObj.gender = document.getElementById('input-gender').value;
            } else if (pos === 'adjective') {
                wordObj.adjAgreement = document.getElementById('input-adj-agreement').value;
            } else if (pos === 'verb') {
                // [냐냐 PATCH] 시제 블록에서 수집 (시제별 규칙/불규칙·유형 포함)
                const info = collectVerbInfoByTense();
                const byTense = collectConjByTense();
                wordObj.conjugationsByTense = byTense;
                wordObj.irregularByTense = info.irregularByTense;
                wordObj.verbClassByTense = info.verbClassByTense;
                // 구버전 호환 (현재시제 기준)
                wordObj.verbClass = info.verbClassByTense.presente || (Object.keys(info.irregularByTense).length ? 'irregular' : 'regular');
                wordObj.irregularType = info.irregularByTense.presente || 'none';
                wordObj.conjugations = byTense.presente || {};
            }

            if (modalId) {
                const index = vocabulary.findIndex(item => item.id === modalId);
                if (index !== -1) {
                    // [냐냐 PATCH-0배치] 수정해도 점수·학습기록은 그대로 보존 (안 그러면 수정할 때마다 점수가 0으로 리셋됨)
                    const prev = vocabulary[index];
                    wordObj.score = (typeof prev.score === 'number') ? prev.score : 0;
                    wordObj.mastered = prev.mastered || false;
                    wordObj.perfect = prev.perfect || false;
                    wordObj.weak = prev.weak || false;
                    wordObj.subjectivePassed = prev.subjectivePassed || false;
                    wordObj.correctTotal = prev.correctTotal || 0;
                    wordObj.wrongTotal = prev.wrongTotal || 0;
                    if (prev.lastWrongDate) wordObj.lastWrongDate = prev.lastWrongDate;
                    wordObj.synonyms = Array.isArray(prev.synonyms) ? prev.synonyms : [];
                    // [냐냐 PATCH] 등록순 유지 — 수정해도 배열 위치를 그대로 둠 (맨 앞으로 안 올림)
                    //   등록일(createdAt)은 보존, 수정일(updatedAt)만 갱신 (정렬엔 안 쓰지만 데이터로 남김)
                    wordObj.createdAt = prev.createdAt || prev.registeredAt || null;
                    wordObj.updatedAt = Date.now();
                    vocabulary[index] = wordObj; // 제자리 교체
                    // 끝낼 때 한 번만 알린다 — 여기서도 띄우면 같은 말이 두 줄로 뜬다
                }
                logAction('snapshot');
            } else {
                wordObj.createdAt = Date.now(); // [냐냐 PATCH] 등록 시각 기록
                vocabulary.unshift(wordObj);
                // 등록도 끝낼 때 한 번만 알린다 (아래 토스트 또는 '계속 등록?' 확인창이 이미 말해준다)
                logAction('new-word'); // [냐냐 PATCH] 오늘 새로 등록한 단어 수 추적
            }

            // [냐냐 PATCH-5배치] 유의어/반의어 — 미등록 단어 자동 등록 + 상대 단어에 양방향 연결
            const synResult = applySynonymLinks(wordObj, getSynonymRowsData());
            if (synResult.linkedNames.length > 0) {
                showToast(`${synResult.linkedNames.join(', ')}에도 자동으로 연결했어요 🔗`, "info");
            }
            if (synResult.newIds.length > 0) {
                _synonymFillQueue = [...synResult.newIds];
            }

            renderWordList();
            updateStats();

            // [냐냐 PATCH] 지금 저장한 게 '유의어 자동채우기 큐'로 열린 단어라면
            //   → 팝업 없이 조용히 다음 큐로 넘어감 (또는 큐 끝이면 마무리)
            if (_inSynonymFill) {
                closeWordModal();
                if (_synonymFillQueue.length > 0) {
                    setTimeout(() => processSynonymQueue(), 250);
                } else {
                    _inSynonymFill = false;
                    showToast("유의어 단어 정보를 다 채웠어요! ✨", "success");
                }
                return;
            }

            // [냐냐 PATCH] 이번 저장으로 유의어가 자동 등록됐으면 → 상세정보 채울지 물어봄
            const autoCount = synResult.newIds.length;
            if (autoCount > 0) {
                closeWordModal();
                showConfirm(
                    `유의어 ${autoCount}개를 자동 등록했어요! 📚`,
                    `방금 등록한 ${autoCount}개 단어에 자세한 정보(뜻·예문 등)를 지금 채울까요? 한 창씩 차례로 열려요.`,
                    () => { _synonymFillQueue = [...synResult.newIds]; processSynonymQueue(); },
                    {
                        okLabel: '네, 채울게요',
                        cancelLabel: '나중에',
                        okStyle: 'primary',
                        icon: 'happy',
                        onCancel: () => { _synonymFillQueue = []; }
                    }
                );
                return;
            }

            // [냐냐 PATCH] 새 단어 등록이면 계속 등록할지 물어봄 (수정이면 그냥 닫기)
            if (!modalId) {
                // [냐냐 PATCH] 첨삭에서 등록한 경우엔 '계속 등록?' 팝업 없이 바로 닫기
                if (_skipContinueRegisterPrompt) {
                    _skipContinueRegisterPrompt = false;
                    showToast("단어를 등록했어요! 📚", "success");
                    closeWordModal();
                } else {
                    showConfirm(
                        "단어를 등록했어요! 📚",
                        "계속해서 다른 단어를 등록하시겠어요?",
                        () => { prepareNextWordEntry(); }, // 예 → 폼 비우고 바로 다음 단어 입력
                        {
                            okLabel: '계속 등록',
                            cancelLabel: '아니요',
                            okStyle: 'primary',
                            icon: 'happy', // [냐냐 PATCH] 경고 아이콘 대신 스마일
                            onCancel: () => { closeWordModal(); } // 아니요 → 등록창 닫기
                        }
                    );
                }
            } else {
                // [냐냐 PATCH] 수정 저장은 팝업 없이 바로 닫기 (토스트만)
                showToast("단어를 수정했어요! ✏️", "success");
                closeWordModal();
            }
        }

        // [냐냐 PATCH] 다음 단어를 바로 입력할 수 있게 폼 초기화 + 커서 이동
        function prepareNextWordEntry() {
            document.getElementById('modal-word-id').value = '';
            document.getElementById('input-word').value = '';
            document.getElementById('input-meaning').value = '';
            document.getElementById('input-pos').value = 'noun';
            document.getElementById('input-gender').value = 'none';
            document.getElementById('input-adj-agreement').value = 'full';
            clearConjugationFields();
            document.getElementById('input-example').value = '';
            document.getElementById('input-example-meaning').value = '';
            clearIdiomRows();
            const ib = document.getElementById('idiom-fields-box');
            const ii = document.getElementById('idiom-toggle-icon');
            if (ib) ib.classList.add('hidden');
            if (ii) ii.className = "fa-solid fa-plus text-xs";
            // [냐냐 PATCH] 유의어/반의어 칸도 비움 (계속 등록 시 전 단어 유의어가 남던 버그)
            clearSynonymRows();
            const sb = document.getElementById('syn-fields-box');
            const si = document.getElementById('syn-toggle-icon');
            if (sb) sb.classList.add('hidden');
            if (si) si.className = "fa-solid fa-plus text-xs";
            document.getElementById('input-notes').value = '· ';
            document.getElementById('word-suggestions').classList.add('hidden');
            aiAutofillCompleted = false; // [냐냐 PATCH] 다음 단어는 다시 AI 추천 후 저장
            togglePosFields();
            toggleNotesClearBtn();
            setTimeout(() => { const wi = document.getElementById('input-word'); if (wi) wi.focus(); }, 50);
        }

        function deleteWord(wordId, event) {
            if (event) event.stopPropagation();
            const w = vocabulary.find(item => item.id === wordId);
            if (!w) return;

            showConfirm(
                `"${w.word}" 단어를 삭제할까요?`,
                "삭제한 데이터는 다시 꺼낼 수 없습니다.",
                () => {
                    const wasMastered = w.mastered; // [냐냐 PATCH] 삭제 전 마스터 여부
                    // [냐냐 PATCH-5배치] 이 단어를 유의어/반의어로 걸어둔 모든 단어에서 링크 자동 제거
                    vocabulary.forEach(other => {
                        if (Array.isArray(other.synonyms) && other.synonyms.some(l => l.id === wordId)) {
                            other.synonyms = other.synonyms.filter(l => l.id !== wordId);
                        }
                    });
                    vocabulary = vocabulary.filter(item => item.id !== wordId);
                    // [냐냐 PATCH] 일지/그래프 감소 — 등록/마스터 카운트 취소
                    if (typeof logAction === 'function') {
                        if (wasMastered) logAction('undo-new-mastered');
                        logAction('undo-new-word');
                    }
                    renderWordList();
                    updateStats();
                    showToast("단어를 삭제했습니다. 🗑️", "success");
                    AudioFX.playError();
                }
            );
        }

        // [냐냐 PATCH] 약점 단어(별표) 수동 토글
        function toggleWeakWord(wordId, event) {
            if (event) event.stopPropagation();
            const w = vocabulary.find(item => item.id === wordId);
            if (w) {
                // [냐냐 PATCH-0배치] 3단계 순환: 해제 → 약점(-3) → 치명적 약점(-8) → 해제(0)
                const grade = getWordGrade(w);
                // (주관식 통과 이력은 건드리지 않음 — 나중에 점수가 다시 오르면 마스터 복귀 가능)
                if (grade === 'critical') {
                    setWordScore(w, 0);
                    showToast(`"${w.word}" 약점 표시를 해제했어요`, "info");
                } else if (grade === 'weak') {
                    setWordScore(w, SCORE_CRITICAL);
                    showToast(`"${w.word}" 치명적 약점으로 표시했어요 🟥`, "success");
                } else {
                    setWordScore(w, SCORE_WEAK);
                    showToast(`"${w.word}" 약점 단어로 표시했어요 🟨`, "success");
                }
                logAction('snapshot');
                renderWordList();
                saveToStorage();
            }
        }

        function toggleMasterWord(wordId, event) {
            if (event) event.stopPropagation();
            const w = vocabulary.find(item => item.id === wordId);
            if (w) {
                // [냐냐 PATCH] 마스터 버튼 3단계 순환 (별표와 동일한 방식)
                //   해제 → 마스터(+5) → 완벽(+8) → 해제(0)
                const gradeM = getWordGrade(w);
                if (gradeM === 'perfect') {
                    setWordScore(w, 0);
                    showToast(`"${w.word}" 마스터를 해제했어요`, "info");
                } else if (gradeM === 'mastered') {
                    setWordScore(w, SCORE_PERFECT, { subjectivePassed: true }); // 8점
                    AudioFX.playBell();
                    showToast(`"${w.word}" 완벽 단어로 올렸어요! 🏆 (8점)`, "success");
                } else {
                    setWordScore(w, SCORE_MASTER, { subjectivePassed: true }); // 5점
                    AudioFX.playBell();
                    showToast(`"${w.word}" 마스터 완료! ✅ (5점)`, "success");
                }
                renderWordList();
                updateStats();
                saveToStorage();
            }
        }

        // 현재시제 변형의 셀에서 불규칙 인칭만 파란색 글씨로 동적으로 골라내는 헬퍼
        function getConjugationCellMarkup(person, val, verbClass, irregularType) {
            if (!val) return `<div class="bg-white p-1 rounded-md border border-slate-100"><span class="text-slate-400 block">${person}</span><strong class="text-slate-800">-</strong></div>`;
            
            let isIrregular = false;
            if (verbClass === 'irregular') {
                const irr = irregularType || '';
                if (irr.includes('1인칭') && person === 'yo') {
                    isIrregular = true;
                }
                if (irr.includes('e ➡️ ie') && ['yo', 'tú', 'él', 'ellos'].includes(person)) {
                    isIrregular = true;
                }
                if (irr.includes('o ➡️ ue') && ['yo', 'tú', 'él', 'ellos'].includes(person)) {
                    isIrregular = true;
                }
                if (irr.includes('e ➡️ i') && ['yo', 'tú', 'él', 'ellos'].includes(person)) {
                    isIrregular = true;
                }
                if (irr.includes('완전 불규칙')) {
                    isIrregular = true;
                }
            }

            const colorClass = isIrregular ? 'text-blue-600 font-black' : 'text-slate-700 font-semibold';
            return `
                <div class="bg-white p-1 rounded-md border border-slate-100">
                    <span class="text-slate-400 block">${person}</span>
                    <strong class="${colorClass}">${val}</strong>
                </div>
            `;
        }

        // Render Vocabulary Tab List
        // [냐냐 PATCH] 필터/정렬 패널 펼치기/접기
        // [냐냐 PATCH] 필터 패널: 품사 중복선택 + 마스터/정렬 단일선택, 확인 눌러야 적용
        const ALL_POS_LIST = ['noun','verb','adjective','adverb','preposition','conjunction','pronoun','interrogative','phrase'];
        const POS_LABELS = { noun:'명사', verb:'동사', adjective:'형용사', adverb:'부사', preposition:'전치사', conjunction:'접속사', pronoun:'대명사', interrogative:'의문사', phrase:'구문' };
        const MASTERY_LABELS = { all:'전체', mastered:'마스터만', 'not-mastered':'미마스터' };
        const WEAK_LABELS = { all:'', weak:'약점만', 'not-weak':'약점제외' };
        // [냐냐 PATCH-0배치] 정렬 3종 × 방향 2가지
        //   등록순: recent(최근 먼저, 기본) ↔ oldest(오래된 먼저)
        //   점수순: weak-score(낮은 점수 먼저, 기본) ↔ score-desc(높은 점수 먼저)
        //   A→Z  : alpha-asc(a 먼저, 기본) ↔ alpha-desc(z 먼저)
        const SORT_LABELS = { recent:'최근 등록순 ↓', oldest:'오래된 등록순 ↑', 'weak-score':'점수 낮은순 ↓', 'score-desc':'점수 높은순 ↑', 'alpha-asc':'A→Z ↓', 'alpha-desc':'Z→A ↑' };
        const SORT_KEY_OF = { recent:'reg', oldest:'reg', 'weak-score':'score', 'score-desc':'score', 'alpha-asc':'alpha', 'alpha-desc':'alpha' };
        const SORT_DEFAULT_OF = { reg:'recent', score:'weak-score', alpha:'alpha-asc' };  // 처음 누를 때의 기본 방향
        const SORT_FLIP_OF = { recent:'oldest', oldest:'recent', 'weak-score':'score-desc', 'score-desc':'weak-score', 'alpha-asc':'alpha-desc', 'alpha-desc':'alpha-asc' };
        const SORT_BTN_LABEL = { recent:'등록순 ↓', oldest:'등록순 ↑', 'weak-score':'점수순 ↓', 'score-desc':'점수순 ↑', 'alpha-asc':'A→Z', 'alpha-desc':'Z→A' };

        // 적용된 필터 상태 (localStorage에서 복원, 없으면 기본값)
        let activeFilterPos = [];          // 빈 배열 = 전체
        let activeFilterMastery = 'not-mastered';
        let activeFilterWeak = 'all';
        let activeFilterSort = 'weak-score';
        // 패널에서 선택 중인 임시 상태
        let pendingFilterPos = [];
        let pendingFilterMastery = 'not-mastered';
        let pendingFilterWeak = 'all';
        let pendingFilterSort = 'weak-score';

        // [냐냐 PATCH] 필터/정렬 저장·복원 (localStorage)
        function saveFilterPrefs() {
            try {
                localStorage.setItem('nyanya_word_filters', JSON.stringify({
                    pos: activeFilterPos, mastery: activeFilterMastery, weak: activeFilterWeak, sort: activeFilterSort
                }));
            } catch (e) {}
        }
        function loadFilterPrefs() {
            try {
                const raw = localStorage.getItem('nyanya_word_filters');
                if (!raw) return; // 첫 방문 = 기본값 유지
                const f = JSON.parse(raw);
                if (Array.isArray(f.pos)) activeFilterPos = f.pos;
                if (f.mastery) activeFilterMastery = f.mastery;
                if (f.weak) activeFilterWeak = f.weak;
                if (f.sort) activeFilterSort = f.sort;
                const ms = document.getElementById('mastery-filter-select'); if (ms) ms.value = activeFilterMastery;
                const ws = document.getElementById('weak-filter-select'); if (ws) ws.value = activeFilterWeak;
                const ss = document.getElementById('sort-select'); if (ss) ss.value = activeFilterSort;
            } catch (e) {}
        }

        // ============================================================
        // [냐냐 PATCH-6배치] 카드 표시 설정 — 어떤 정보를 보여줄지 (뜻·품사·점수는 항상 표시)
        // ============================================================
        const DISPLAY_SECTIONS = [
            { key: 'conj',    label: '동사 시제' },
            { key: 'idioms',  label: '관용구' },
            { key: 'example', label: '예문' },
            { key: 'notes',   label: '노트' },
            { key: 'synonyms',label: '유의어·반의어' }
        ];
        const DEFAULT_DISPLAY = {
            sections: DISPLAY_SECTIONS.map(s => s.key),                          // 기본: 전부 표시
            tenses: TENSE_TYPE_OPTIONS.map(t => t.key)           // 기본: 모든 시제 표시
        };
        let displayPrefs = { sections: [...DEFAULT_DISPLAY.sections], tenses: [...DEFAULT_DISPLAY.tenses] };
        // [냐냐 PATCH] 설정 패널에서 편집 중인 임시 상태. [확인]을 눌러야 displayPrefs로 반영됨.
        let pendingDisplay = null;

        function isDisplayOn(key) { return displayPrefs.sections.includes(key); }
        function isTenseOn(key) { return displayPrefs.tenses.includes(key); }
        function isDisplayDefault() {
            return displayPrefs.sections.length === DEFAULT_DISPLAY.sections.length
                && displayPrefs.tenses.length === DEFAULT_DISPLAY.tenses.length;
        }
        function saveDisplayPrefs() {
            try { localStorage.setItem('nyanya_word_display', JSON.stringify(displayPrefs)); } catch (e) {}
        }
        function loadDisplayPrefs() {
            try {
                const raw = localStorage.getItem('nyanya_word_display');
                if (raw) {
                    const d = JSON.parse(raw);
                    if (Array.isArray(d.sections)) displayPrefs.sections = d.sections;
                    // 예전에 저장된 목록엔 현재진행이 들어 있을 수 있다 — 이제 목록에 없는 시제는 버린다
                    if (Array.isArray(d.tenses)) displayPrefs.tenses = d.tenses.filter(k => DEFAULT_DISPLAY.tenses.includes(k));
                }
            } catch (e) {}
        }

        function toggleDisplayPanel(ev) {
            if (ev && ev.stopPropagation) ev.stopPropagation();
            const panel = document.getElementById('display-panel');
            if (!panel) return;
            const willOpen = panel.classList.contains('hidden');
            if (typeof closeFilterPanel === 'function') closeFilterPanel();
            if (willOpen) {
                // 열 때 현재 설정을 임시본으로 복사 → 여기에 편집, [확인] 눌러야 반영
                pendingDisplay = { sections: [...displayPrefs.sections], tenses: [...displayPrefs.tenses] };
                renderDisplayPanel();
                panel.classList.remove('hidden');
            } else {
                panel.classList.add('hidden');
                pendingDisplay = null; // [확인] 없이 닫으면 편집 내용 버림
            }
        }
        function closeDisplayPanel() {
            const panel = document.getElementById('display-panel');
            if (panel) panel.classList.add('hidden');
            pendingDisplay = null;
        }

        function renderDisplayPanel() {
            const p = pendingDisplay || displayPrefs; // 패널은 항상 '편집 중' 상태를 그림
            const secBox = document.getElementById('display-section-box');
            const tenseBox = document.getElementById('display-tense-box');
            if (secBox) {
                secBox.innerHTML = DISPLAY_SECTIONS.map(sec => {
                    const on = p.sections.includes(sec.key);
                    const cls = on ? 'border-violet-500 bg-violet-50 text-violet-600' : 'border-slate-200 bg-slate-50 text-slate-500';
                    // [냐냐 PATCH] onclick 인라인 대신 data-속성 + 패널 위임 리스너 (렌더로 버튼 갈려도 안 깨짐)
                    return `<button type="button" data-disp-section="${sec.key}" class="text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all ${cls}">${sec.label}</button>`;
                }).join('');
            }
            if (tenseBox) {
                const conjOn = p.sections.includes('conj');
                // [냐냐 요청] 현재진행은 현재분사를 켜면 같이 나오므로 목록에서 뺀다
                tenseBox.innerHTML = TENSE_TYPE_OPTIONS.map(t => {
                    const on = p.tenses.includes(t.key) && conjOn;
                    const cls = !conjOn ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                              : (on ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-200 bg-slate-50 text-slate-500');
                    return `<button type="button" data-disp-tense="${t.key}" ${conjOn ? '' : 'disabled'} class="text-[11px] font-bold px-2 py-1 rounded-lg border transition-all ${cls}">${escapeHtml(t.label)}</button>`;
                }).join('');
            }
            const allBtn = document.getElementById('display-all-btn');
            if (allBtn) allBtn.innerText = (p.sections.length === 0) ? '전부 선택' : '전부 해제';
        }

        // [냐냐 PATCH] 패널 전체에 클릭 위임 — 버튼이 다시 그려져도 항상 동작
        //   ⭐ 편집은 pendingDisplay(임시본)에만 한다. 실제 반영은 [확인]에서.
        function _displayPanelClick(ev) {
            const t = ev.target.closest('[data-disp-section],[data-disp-tense],[data-disp-action]');
            if (!t) return;
            ev.stopPropagation();
            if (!pendingDisplay) pendingDisplay = { sections: [...displayPrefs.sections], tenses: [...displayPrefs.tenses] };

            if (t.hasAttribute('data-disp-section')) {
                const key = t.getAttribute('data-disp-section');
                const i = pendingDisplay.sections.indexOf(key);
                if (i >= 0) pendingDisplay.sections.splice(i, 1); else pendingDisplay.sections.push(key);
            } else if (t.hasAttribute('data-disp-tense')) {
                if (t.disabled) return;
                const key = t.getAttribute('data-disp-tense');
                const i = pendingDisplay.tenses.indexOf(key);
                if (i >= 0) pendingDisplay.tenses.splice(i, 1); else pendingDisplay.tenses.push(key);
            } else if (t.getAttribute('data-disp-action') === 'all') {
                if (pendingDisplay.sections.length === 0) {
                    pendingDisplay.sections = [...DEFAULT_DISPLAY.sections];
                    pendingDisplay.tenses = [...DEFAULT_DISPLAY.tenses];
                } else { pendingDisplay.sections = []; }
            } else if (t.getAttribute('data-disp-action') === 'reset') {
                pendingDisplay = { sections: [...DEFAULT_DISPLAY.sections], tenses: [...DEFAULT_DISPLAY.tenses] };
            } else if (t.getAttribute('data-disp-action') === 'apply') {
                // ⭐ [확인] — 이때 비로소 실제 반영 + 저장. 카드 펼침 상태 유지.
                if (pendingDisplay) {
                    displayPrefs = { sections: [...pendingDisplay.sections], tenses: [...pendingDisplay.tenses] };
                    saveDisplayPrefs();
                }
                closeDisplayPanel();
                renderWordList();
                if (typeof restoreExpandedCards === 'function') restoreExpandedCards();
                return;
            }
            renderDisplayPanel(); // 임시본 기준으로 패널만 다시 그림 (목록은 안 건드림)
        }
        // 패널에 리스너 한 번만 부착
        (function attachDisplayPanelListener() {
            function bind() {
                const panel = document.getElementById('display-panel');
                if (panel && !panel._dispBound) { panel.addEventListener('click', _displayPanelClick); panel._dispBound = true; }
            }
            if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
            else bind();
            setTimeout(bind, 500); // 안전망
        })();

        // [냐냐 PATCH-6배치] 카드 안의 동사 변형표 — 등록된 시제 중 "설정에서 켠 시제"만 전부 표시
        function buildCardConjHtml(w) {
            const irrByTense = w.irregularByTense || {};
            const vcByTense = w.verbClassByTense || {};

            // [냐냐 요청] 등록된 시제 + 자동 생성되는 시제(현재진행)를 등록 폼 순서대로
            const keys = listTenseKeys(w).filter(k => isTenseOn(k));
            if (keys.length === 0) return '';

            const labelOf = (k) => { const o = TENSE_TYPE_OPTIONS.find(t => t.key === k); return o ? o.label : k; };

            return keys.map(k => {
                const c = getTenseConj(w, k);
                if (!hasConjValues(c)) return '';
                const rawIrr = irrByTense[k] || ((k === 'presente') ? (w.irregularType || '') : '');
                const rawClass = vcByTense[k] || ((rawIrr && rawIrr !== 'none') ? 'irregular' : (k === 'presente' ? (w.verbClass || 'regular') : 'regular'));
                // 적혀 있는 게 불규칙이어도 형태가 규칙형이면 규칙으로 본다 (resolveTenseIrregularity 주석 참고)
                const resolved = resolveTenseIrregularity(w, k, rawClass, rawIrr);
                const irrType = resolved.irrType;
                const verbClass = resolved.verbClass;
                // 갈래 이름이 '불규칙' 자체면 '불규칙(불규칙)' 이 되니 괄호를 뺀다
                const clsText = (verbClass === 'regular' || !irrType || irrType === 'none') ? '규칙'
                    : (irrType === '불규칙' ? '불규칙' : `불규칙(${irrType})`);

                // [냐냐 지적] 1칸짜리 시제(현재분사·과거분사)는 불규칙이어도 파란색이 안 붙고 있었다.
                //   6인칭 시제는 '어느 인칭이 불규칙인가' 를 가리지만, 1칸은 그 한 칸이 곧 불규칙이다.
                const singleIrr = !(verbClass === 'regular' || !irrType || irrType === 'none');
                const body = (c.form && !c.yo)
                    ? `<div class="text-center py-1"><span class="text-sm font-black ${singleIrr ? 'text-blue-600' : 'text-slate-800'}">${escapeHtml(c.form)}</span></div>`
                    : `<div class="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                            ${getConjugationCellMarkup('yo', c.yo, verbClass, irrType)}
                            ${getConjugationCellMarkup('tú', c.tu, verbClass, irrType)}
                            ${getConjugationCellMarkup('él', c.el, verbClass, irrType)}
                            ${getConjugationCellMarkup('nos', c.nos, verbClass, irrType)}
                            ${getConjugationCellMarkup('vos', c.vos, verbClass, irrType)}
                            ${getConjugationCellMarkup('ellos', c.ellos, verbClass, irrType)}
                        </div>`;

                return `
                <div class="bg-slate-50/80 rounded-2xl p-2.5 border border-slate-100 space-y-1">
                    <div class="flex items-center justify-between">
                        <span class="block text-[9px] font-bold text-indigo-500 tracking-wider uppercase">
                            ${escapeHtml(labelOf(k))} <span class="text-indigo-600 font-extrabold ml-1">(${escapeHtml(clsText)})</span>
                        </span>
                    </div>
                    ${body}
                </div>`;
            }).filter(Boolean).join('<div class="h-2"></div>');
        }

        function toggleFilterPos(btn) {
            const pos = btn.dataset.pos;
            const i = pendingFilterPos.indexOf(pos);
            if (i >= 0) pendingFilterPos.splice(i, 1);
            else pendingFilterPos.push(pos);
            styleFilterPill(btn, i < 0);
            updatePosAllBtnLabel();
        }
        // [냐냐 PATCH] 품사 전체 선택/해제 토글
        function toggleAllFilterPos() {
            const allOn = pendingFilterPos.length >= ALL_POS_LIST.length;
            pendingFilterPos = allOn ? [] : [...ALL_POS_LIST];
            document.querySelectorAll('.filter-pos-btn').forEach(b => styleFilterPill(b, pendingFilterPos.includes(b.dataset.pos)));
            updatePosAllBtnLabel();
        }
        function updatePosAllBtnLabel() {
            const btn = document.getElementById('filter-pos-all-btn');
            if (btn) btn.innerText = (pendingFilterPos.length >= ALL_POS_LIST.length) ? '전체 해제' : '전체 선택';
        }
        function setFilterMastery(btn) {
            pendingFilterMastery = btn.dataset.mastery;
            document.querySelectorAll('.filter-mastery-btn').forEach(b => styleFilterPill(b, b === btn));
        }
        function setFilterWeak(btn) {
            pendingFilterWeak = btn.dataset.weak;
            document.querySelectorAll('.filter-weak-btn').forEach(b => styleFilterPill(b, b === btn));
        }
        function setFilterSort(btn) {
            const key = btn.dataset.sortkey;
            // 이미 선택된 기준을 또 누르면 → 오름/내림 전환. 아니면 그 기준의 기본 방향으로.
            if (SORT_KEY_OF[pendingFilterSort] === key) {
                pendingFilterSort = SORT_FLIP_OF[pendingFilterSort];
            } else {
                pendingFilterSort = SORT_DEFAULT_OF[key];
            }
            renderSortButtons();
        }
        // 정렬 버튼 3개의 라벨(↓↑)과 활성 상태를 다시 그림
        function renderSortButtons() {
            const activeKey = SORT_KEY_OF[pendingFilterSort];
            document.querySelectorAll('.filter-sort-btn').forEach(b => {
                const key = b.dataset.sortkey;
                const on = (key === activeKey);
                b.innerText = on
                    ? SORT_BTN_LABEL[pendingFilterSort]
                    : (key === 'reg' ? '등록순' : (key === 'score' ? '점수순' : 'A→Z'));
                styleFilterPill(b, on);
            });
        }
        function styleFilterPill(btn, on) {
            if (on) {
                btn.className = btn.className.replace(/border-slate-200 bg-slate-50 text-slate-500/, 'border-violet-500 bg-violet-50 text-violet-600');
            } else {
                btn.className = btn.className.replace(/border-violet-500 bg-violet-50 text-violet-600/, 'border-slate-200 bg-slate-50 text-slate-500');
            }
        }

        // 패널 열 때 현재 '적용된' 값으로 임시상태 초기화 (최근 선택값 유지)
        function syncFilterPanelUI() {
            pendingFilterPos = activeFilterPos.length === 0 ? [...ALL_POS_LIST] : [...activeFilterPos];
            pendingFilterMastery = activeFilterMastery;
            pendingFilterWeak = activeFilterWeak;
            pendingFilterSort = activeFilterSort;
            document.querySelectorAll('.filter-pos-btn').forEach(b => styleFilterPill(b, pendingFilterPos.includes(b.dataset.pos)));
            document.querySelectorAll('.filter-mastery-btn').forEach(b => styleFilterPill(b, b.dataset.mastery === pendingFilterMastery));
            document.querySelectorAll('.filter-weak-btn').forEach(b => styleFilterPill(b, b.dataset.weak === pendingFilterWeak));
            renderSortButtons(); // [0배치] 정렬 버튼 3종 (방향 화살표 포함)
            updatePosAllBtnLabel();
        }

        function applyFilters() {
            activeFilterPos = (pendingFilterPos.length === 0 || pendingFilterPos.length === ALL_POS_LIST.length) ? [] : [...pendingFilterPos];
            activeFilterMastery = pendingFilterMastery;
            activeFilterWeak = pendingFilterWeak;
            activeFilterSort = pendingFilterSort;
            const masterySel = document.getElementById('mastery-filter-select');
            const weakSel = document.getElementById('weak-filter-select');
            const sortSel = document.getElementById('sort-select');
            if (masterySel) masterySel.value = activeFilterMastery;
            if (weakSel) weakSel.value = activeFilterWeak;
            if (sortSel) sortSel.value = activeFilterSort;
            todayWrongFilterActive = false;
            currentPage = 1; // [냐냐 PATCH-페이지네이션] 필터 바꾸면 1페이지로
            saveFilterPrefs();
            closeFilterPanel();
            renderWordList();
        }
        function resetFilters() {
            pendingFilterPos = [...ALL_POS_LIST];
            pendingFilterMastery = 'not-mastered';
            pendingFilterWeak = 'all';
            pendingFilterSort = 'weak-score';
            // [냐냐 PATCH] 활성 필터도 기본값으로 적용하고, 목록도 갱신 (단 패널은 열어둬서 확인 가능)
            activeFilterPos = [];
            activeFilterMastery = 'not-mastered';
            activeFilterWeak = 'all';
            activeFilterSort = 'weak-score';
            currentPage = 1; // [냐냐 PATCH-페이지네이션] 필터 초기화 시 1페이지로
            syncFilterPanelUI();
            saveFilterPrefs();
            renderWordList();
        }

        // [냐냐 PATCH] 현재 필터/정렬 한 줄 요약
        function renderFilterSummary() {
            const box = document.getElementById('filter-summary');
            if (!box) return;
            const chips = [];
            // 품사
            if (activeFilterPos.length > 0 && activeFilterPos.length < ALL_POS_LIST.length) {
                chips.push(activeFilterPos.map(p => POS_LABELS[p] || p).join('·'));
            }
            // 마스터 상태 (기본 미마스터가 아닐 때만 표시... 은 아니고 항상 상태 보여주되 '전체'는 생략)
            if (activeFilterMastery !== 'all') chips.push(MASTERY_LABELS[activeFilterMastery]);
            // 약점 (전체가 아니면)
            if (activeFilterWeak !== 'all') chips.push(WEAK_LABELS[activeFilterWeak]);
            // 정렬은 항상 표시
            const sortLabel = SORT_LABELS[activeFilterSort] || activeFilterSort;

            const filterPart = chips.length > 0
                ? chips.map(c => `<span class="bg-violet-50 text-violet-600 font-bold px-2 py-0.5 rounded-full">${c}</span>`).join('')
                : `<span class="text-slate-400">전체 단어</span>`;
            box.innerHTML = `<i class="fa-solid fa-filter text-[9px]"></i>${filterPart}<span class="text-slate-300">·</span><span class="text-slate-500">${sortLabel}</span>`;
        }
        function closeFilterPanel() {
            document.getElementById('filter-panel').classList.add('hidden');
        }

        function toggleFilterPanel() {
            const panel = document.getElementById('filter-panel');
            const willOpen = panel.classList.contains('hidden');
            closeDisplayPanel(); // [6배치] 두 패널이 동시에 열리지 않게
            panel.classList.toggle('hidden');
            if (willOpen) syncFilterPanelUI();
        }

        // [냐냐 요청] 검색: 타이핑 중엔 렌더 안 함(렉 방지). 엔터 눌러야 검색.
        //   단, 검색창을 완전히 비우면 자동으로 전체 목록 복귀.
        function handleSearchInput() {
            const val = document.getElementById('search-bar').value;
            document.getElementById('search-clear-btn').classList.toggle('hidden', !val);
            if (val.trim()) todayWrongFilterActive = false;
            // 완전히 비우면 즉시 전체 복귀 (엔터 불필요)
            if (!val.trim()) {
                currentPage = 1;
                renderWordList();
            }
        }

        // [냐냐 요청] 엔터로 검색 실행
        function runSearch() {
            currentPage = 1;
            renderWordList();
        }

        function clearSearch() {
            const bar = document.getElementById('search-bar');
            bar.value = '';
            document.getElementById('search-clear-btn').classList.add('hidden');
            bar.focus();
            currentPage = 1; // [냐냐 PATCH-페이지네이션] 검색 지우면 1페이지부터
            renderWordList();
        }

        let wordListExpandedAll = false; // [냐냐 PATCH] 단어 카드 전체 펼침 상태 (기본 접힘)

        // [냐냐 PATCH-페이지네이션] 성능: 단어 850개+ 대응. 한 페이지에 50개씩만 렌더.
        //   currentPage는 일반 변수 → 메뉴 이동 시 유지, 새로고침 시 1로 리셋 (localStorage 저장 안 함)
        const WORDS_PER_PAGE = 12;
        let currentPage = 1;

        // ============================================================
        // [냐냐 요청] 쓰기 연습 — 지금 보고 있는 단어장 목록으로 스페인어를 2번씩 따라 쓴다.
        //   · 목록은 랜덤 순서 (같은 단어만 반복해서 만나지 않도록)
        //   · 정답을 보면서 그대로 입력 (철자·악센트를 손에 익히는 교정 연습)
        //   · 점수는 변하지 않음. 페이지 이동 없이 세션 안에서 끝까지 진행
        // ============================================================
        const WRITE_PRACTICE_TIMES = 2;
        let lastFilteredWords = [];
        let writePracticeState = null;

        function updateWritePracticeBtn() {
            const btn = document.getElementById('write-practice-btn');
            if (!btn) return;
            const n = lastFilteredWords.length;
            const cnt = document.getElementById('write-practice-count');
            if (cnt) cnt.innerText = n + '개';
            btn.disabled = n === 0;
            btn.classList.toggle('opacity-40', n === 0);
            btn.classList.toggle('cursor-not-allowed', n === 0);
        }

        // ============================================================
        // [냐냐 요청] 복습 탭 '쓰기' 설정 — 개수 / 범위 (단어만, 가볍게)
        // ============================================================
        //   [냐냐 요청] 기본 10 → 20. 1바퀴가 주관식이라 예전 개수로는 너무 짧다.
        let writeCount = 20;

        // [냐냐 요청] 쓰기 복습에 관용구를 섞는다.
        //   단어 빈칸이 무거워서 잘 안 쓰게 되고, 그러면 관용구를 틀려도 다시 만날 일이 없었다.
        //   퀴즈처럼 비율로 섞되 기본은 0 — 지금까지처럼 단어 뜻만 나온다.
        //   [냐냐 요청] 막대(슬라이더)보다 고르는 게 낫다. 세 갈래로 나눈다.
        //     word  — 단어 뜻만 (기본, 지금까지와 같음)
        //     idiom — 관용구만
        //     mix   — 섞어서. 이때만 비율(idiom %)을 쓴다
        const WRITE_MIX_MIN = 10, WRITE_MIX_MAX = 90;   // 섞기 비율이 갈 수 있는 범위
        const WRITE_MIX_DEFAULT = { mode: 'word', idiom: 50 };
        let writeMix = { ...WRITE_MIX_DEFAULT };
        // 실제로 문제를 뽑을 때 쓰는 관용구 비율
        function writeIdiomPct() {
            if (writeMix.mode === 'idiom') return 100;
            if (writeMix.mode === 'mix') return Math.max(0, Math.min(100, writeMix.idiom || 0));
            return 0;
        }
        function loadWriteMix() {
            try { const r = localStorage.getItem('nyanya_write_mix'); if (r) writeMix = { ...WRITE_MIX_DEFAULT, ...JSON.parse(r) }; } catch (e) {}
            // 슬라이더가 막대였던 시절 값(0·100)이 남아 있으면 '섞어서' 가 한쪽으로 쏠린다.
            //   0/100 은 이제 '단어만'·'관용구만' 이 맡으므로 섞기 비율은 그 사이로 되돌린다.
            if (!(writeMix.idiom >= WRITE_MIX_MIN && writeMix.idiom <= WRITE_MIX_MAX)) writeMix.idiom = 50;
            if (writeMix.mode !== 'idiom' && writeMix.mode !== 'mix') writeMix.mode = 'word';
        }
        function saveWriteMix() {
            try { localStorage.setItem('nyanya_write_mix', JSON.stringify(writeMix)); } catch (e) {}
        }
        function setWriteMixMode(mode) {
            writeMix.mode = (mode === 'idiom' || mode === 'mix') ? mode : 'word';
            saveWriteMix();
            renderWriteMix();
        }
        function setWriteMix(v) {
            writeMix.idiom = Math.max(WRITE_MIX_MIN, Math.min(WRITE_MIX_MAX, parseInt(v, 10) || 50));
            saveWriteMix();
            renderWriteMix();
        }
        // [냐냐 요청] 슬라이더를 잡고 미는 게 번거로워서, 퍼센트 숫자를 눌러 0 → 50 → 100 으로
        //   돌린다. 중간 값(30 등)에서 누르면 그보다 큰 첫 단계로 간다. 슬라이더도 그대로 쓴다.
        //   0%·100% 는 이제 '단어만'·'관용구만' 이 맡으므로, 섞기 비율은 그 사이만 돈다.
        const WRITE_MIX_STEPS = [25, 50, 75];
        function cycleWriteMix() {
            const cur = writeMix.idiom || 0;
            const next = WRITE_MIX_STEPS.find(v => v > cur);
            setWriteMix(next === undefined ? WRITE_MIX_STEPS[0] : next);
        }

        function renderWriteMix() {
            // 고른 갈래에 표시
            document.querySelectorAll('.write-mix-btn').forEach(b => {
                const on = b.dataset.writeMix === writeMix.mode;
                b.classList.toggle('border-violet-500', on);
                b.classList.toggle('bg-violet-50', on);
                b.classList.toggle('text-violet-700', on);
                b.classList.toggle('border-slate-200', !on);
                b.classList.toggle('text-slate-600', !on);
            });
            // 비율 줄은 '섞어서' 일 때만
            const row = document.getElementById('write-mix-ratio');
            if (row) row.classList.toggle('hidden', writeMix.mode !== 'mix');

            const val = document.getElementById('write-mix-idiom');
            const lab = document.getElementById('write-mix-idiom-label');
            const wordLab = document.getElementById('write-mix-word-label');
            if (val && val.value !== String(writeMix.idiom)) val.value = writeMix.idiom;
            if (lab) lab.innerText = writeMix.idiom + '%';
            if (wordLab) wordLab.innerText = (100 - writeMix.idiom) + '%';

            // [냐냐 요청] 개수 안내는 여기 한 줄로 모은다 (범위 밑에도 따로 적어서 숫자가 어긋나 보였다).
            //   단어는 고른 범위 안의 개수, 관용구는 실제로 나올 수 있는 표현의 개수다.
            const hint = document.getElementById('write-mix-hint');
            if (hint) {
                const n = countIdiomEntries();
                const wordN = (typeof getWriteScopePool === 'function') ? getWriteScopePool().length : 0;
                hint.innerText = writeMix.mode === 'word'
                        ? (wordN ? `단어 ${wordN}개에서 나와요` : '이 범위엔 단어가 없어요')
                    : (n === 0 ? '등록된 관용구가 없어서 단어만 나와요'
                    : (writeMix.mode === 'idiom' ? `관용구 ${n}개에서 나와요`
                                                 : `단어 ${wordN}개 · 관용구 ${n}개를 섞어서 내요`));
            }
        }
        //   [냐냐 지적] 전체 개수를 적어서, 범위를 좁혀도 관용구는 그대로인 것처럼 보였다.
        //   지금 고른 범위 안에서 실제로 나올 수 있는 표현만 센다.
        function countIdiomEntries() {
            const onlyNew = (writeScope === 'untouched') && (typeof isUntouchedIdiom === 'function');
            const pool = onlyNew ? (vocabulary || [])
                : ((typeof getWriteScopePool === 'function') ? getWriteScopePool() : (vocabulary || []));
            return pool.reduce((a, w) => a + wordIdiomList(w).filter(it => !onlyNew || isUntouchedIdiom(w.id, it.idiom)).length, 0);
        }
        // 단어 하나가 가진 관용구 목록 (예전 단일 필드 형태도 받아준다)
        // [냐냐 요청] 관용구도 소리내 들어본다. 표현은 통으로 들어야 입에 붙는다.
        //   따옴표가 섞여도 onclick 이 안 깨지게 인덱스가 아니라 escape 한 글자를 넘긴다.
        function speakIdiom(text) {
            if (typeof speakSpanishVoice === 'function') speakSpanishVoice(String(text || ''), 0.9);
        }
        function idiomSpeakerHtml(idiomText) {
            const safe = escapeHtml(String(idiomText || '')).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
            return `<button type="button" onclick="event.stopPropagation(); speakIdiom(this.dataset.t)" data-t="${safe}" title="발음 듣기" class="shrink-0 w-5 h-5 rounded-full text-slate-400 hover:text-violet-600 hover:bg-violet-50 text-[10px] transition-colors"><i class="fa-solid fa-volume-high"></i></button>`;
        }

        function wordIdiomList(w) {
            if (!w) return [];
            const arr = Array.isArray(w.idioms) ? w.idioms : (w.idiom ? [{ idiom: w.idiom, idiomMeaning: w.idiomMeaning || '' }] : []);
            return arr.filter(x => x && String(x.idiom || '').trim() && String(x.idiomMeaning || '').trim());
        }

        // [냐냐 요청] 관용구 문제는 '단어의 복제본'으로 만든다.
        //   word/meaning 만 관용구 것으로 갈아끼우면 채점·점수·결과 표시가 지금 코드 그대로 돈다.
        //   id 가 원래 단어와 같으므로 점수는 그 단어에 붙는다 (요청대로 단어와 똑같이 반영).
        function makeWriteIdiomTask(w, idiom) {
            return Object.assign({}, w, {
                word: String(idiom.idiom).trim(),
                meaning: String(idiom.idiomMeaning || '').trim() || w.meaning,
                pos: 'phrase',
                _idiomOf: w,          // 등급 변화는 원래 단어 기준으로 봐야 한다
                _isIdiomTask: true
            });
        }

        // [냐냐 요청] 동사는 원형이 아니라 활용형으로 묻는다 (2026-09-02).
        //   원형은 활용형을 쓰려면 어차피 알아야 하니, 활용형으로 물으면 둘 다 시험된다.
        //   ⚠️ 시제를 먼저 고르고 그 안에서 인칭을 고른다. 칸을 통째로 섞으면 현재시제가
        //      6칸이라 1칸짜리 분사보다 여섯 배 자주 나온다.
        function pickConjSlot(w) {
            const opts = (typeof TENSE_TYPE_OPTIONS !== 'undefined') ? TENSE_TYPE_OPTIONS : [];
            const tenses = opts.map(o => o.key).filter(t => {
                const c = (typeof getTenseConj === 'function') ? getTenseConj(w, t) : null;
                return c && (typeof hasConjValues === 'function' ? hasConjValues(c) : false);
            });
            if (!tenses.length) return null;
            const tense = tenses[Math.floor(Math.random() * tenses.length)];
            const c = getTenseConj(w, tense);
            // 화면에 뜨는 이름이라 짧게 — '현재분사 (gerundio · 1칸)' 은 문제 앞에 붙이기엔 길다
            const SHORT = { gerundio: '현재분사', participio: '과거분사' };
            const label = SHORT[tense] || (opts.find(o => o.key === tense) || {}).label || tense;
            if (typeof isSingleTense === 'function' && isSingleTense(tense)) {
                const form = String(c.form || '').trim();
                return form ? { tense, tenseLabel: label, person: 'form', personLabel: '', form } : null;
            }
            const persons = [['yo', 'yo'], ['tu', 'tú'], ['el', 'él/ella'], ['nos', 'nosotros'], ['vos', 'vosotros'], ['ellos', 'ellos/ellas']]
                .filter(([k]) => String(c[k] || '').trim());
            if (!persons.length) return null;
            const [pk, plabel] = persons[Math.floor(Math.random() * persons.length)];
            return { tense, tenseLabel: label, person: pk, personLabel: plabel, form: String(c[pk] || '').trim() };
        }

        // 활용형 과제도 '단어의 복제본' 으로 만든다 (관용구 과제와 같은 방식).
        //   id 가 같아서 점수는 그 동사에 붙고, 채점·결과 화면이 지금 코드 그대로 돈다.
        function makeWriteConjTask(w, slot) {
            const cue = slot.personLabel ? `${slot.tenseLabel} · ${slot.personLabel}` : slot.tenseLabel;
            return Object.assign({}, w, {
                word: slot.form,
                meaning: `${w.meaning || ''} → ${cue}`,
                _conjOf: w,
                _conjSlot: slot,
                _isConjTask: true
            });
        }

        // 비율만큼 관용구 문제를 섞어서 낸다.
        //   [냐냐 요청] 예전엔 단어를 먼저 뽑고 그중 몇 개를 관용구로 바꿨다. 그러면 한 단어에
        //   표현이 여럿이어도 한 번에 하나밖에 못 나왔고, 표현이 많은 단어가 오히려 손해였다.
        //   이제 '표현' 하나하나를 후보로 놓고 전체에서 고른다 (관용구 1113개가 다 대상).
        //   같은 단어가 단어 문제와 관용구 문제로 겹쳐 나오지는 않게 한다.
        function buildWriteTasks(pool, count) {
            const pct = writeIdiomPct();
            if (pct <= 0) return shuffleArray(pool.slice()).slice(0, count).map(toWriteVerbTask);

            const wantIdiom = Math.round(count * pct / 100);
            const entries = [];
            // [냐냐 지적] 범위를 '안 만난' 으로 골라도 관용구는 전체에서 나왔다 — 범위가 관용구엔 안 걸렸다.
            //   ⚠️ 그렇다고 '안 만난 단어' 안에서만 찾으면 안 된다. 관용구는 표현 단위라
            //   이미 만난 단어에 달린 표현도 처음일 수 있다 (실제로 1117개 중 541개가 그랬다).
            //   그래서 이 범위에서만 관용구는 단어장 전체를 보고, '안 만난 표현' 으로 거른다.
            const onlyNew = (writeScope === 'untouched') && (typeof isUntouchedIdiom === 'function');
            (onlyNew ? (vocabulary || []) : pool).forEach(w => wordIdiomList(w).forEach(it => {
                if (onlyNew && !isUntouchedIdiom(w.id, it.idiom)) return;
                entries.push({ w, it });
            }));
            const idiomTasks = shuffleArray(entries).slice(0, wantIdiom)
                .map(e => makeWriteIdiomTask(e.w, e.it));

            // 관용구로 이미 나온 단어는 단어 문제에서 뺀다
            const used = new Set(idiomTasks.map(t => t._idiomOf.id));
            const rest = shuffleArray(pool.filter(w => !used.has(w.id)))
                .slice(0, Math.max(0, count - idiomTasks.length));
            return shuffleArray(idiomTasks.concat(rest.map(toWriteVerbTask)));
        }
        // 동사이고 활용이 채워져 있으면 활용형으로 묻는다. 없으면 예전처럼 원형.
        function toWriteVerbTask(w) {
            if (!w || w.pos !== 'verb') return w;
            const slot = pickConjSlot(w);
            return slot ? makeWriteConjTask(w, slot) : w;
        }
        const WRITE_COUNT_MIN = 1;
        const WRITE_COUNT_MAX = 200;
        let writeScope = 'not-mastered';

        // fromInput = 직접 적는 칸에서 부른 것 (그 칸의 값은 건드리지 않는다 — 타이핑 중이라)
        function selectWriteCount(n, fromInput) {
            const raw = parseInt(n, 10);
            // 지우는 중이면 아직 확정하지 않는다. 칸을 비운 채로 시작하면 그때 기본값으로 되돌린다
            if (fromInput && (!Number.isFinite(raw) || raw < WRITE_COUNT_MIN)) return;
            writeCount = Math.max(WRITE_COUNT_MIN, Math.min(WRITE_COUNT_MAX, Number.isFinite(raw) ? raw : 20));
            const input = document.getElementById('write-count-input');
            if (input && !fromInput) input.value = writeCount;
            document.querySelectorAll('.write-count-btn').forEach(b => {
                const on = Number(b.dataset.writeCount) === writeCount;
                b.classList.toggle('border-indigo-500', on);
                b.classList.toggle('bg-indigo-50', on);
                b.classList.toggle('text-indigo-700', on);
                b.classList.toggle('border-slate-200', !on);
                b.classList.toggle('text-slate-600', !on);
            });
        }

        function selectWriteScope(scope) {
            writeScope = scope;
            document.querySelectorAll('.write-scope-btn').forEach(b => {
                const on = b.dataset.writeScope === scope;
                b.classList.toggle('border-indigo-500', on);
                b.classList.toggle('bg-indigo-50', on);
                b.classList.toggle('text-indigo-700', on);
                b.classList.toggle('border-slate-200', !on);
                b.classList.toggle('text-slate-600', !on);
            });
            // [냐냐 요청] 범위 밑의 개수 줄은 없앴다 — 문제 유형 밑 한 줄이 단어·관용구를 같이 적는다
            if (typeof renderWriteMix === 'function') renderWriteMix();
        }

        function getWriteScopePool() {
            //   [냐냐 요청] 관용구 복습은 여기 끼우지 않는다 — 헤더 복습 배지의 '관용구' 로 들어간다.
            //   (범위는 '어떤 단어를 쓸까' 를 고르는 자리라, 표현 단위인 관용구와 결이 다르다)
            // [냐냐 요청] 아직 한 번도 안 만난 단어만
            if (writeScope === 'untouched') {
                return vocabulary.filter(w => (typeof isUntouchedWord === 'function') && isUntouchedWord(w));
            }
            if (writeScope === 'mastered') return vocabulary.filter(w => w.mastered);
            if (writeScope === 'weak') return vocabulary.filter(w => w.weak && !w.mastered);
            if (writeScope === 'not-mastered') return vocabulary.filter(w => !w.mastered);
            return vocabulary.slice();
        }

        function resetWriteSetup() {
            selectWriteCount(writeCount || 20);
            selectWriteScope(writeScope || 'not-mastered');
            const setup = document.getElementById('write-setup');
            if (setup) setup.classList.remove('hidden');
            // [냐냐 요청] 인라인 진행 영역도 같이 정리 (진행 중이면 changeTab이 여기까지 안 옴)
            const play = document.getElementById('write-play-area');
            if (play) { play.classList.add('hidden'); play.innerHTML = ''; }
        }

        // [냐냐 요청] 쓰기는 '단어'만. 관용구·예문은 단어 빈칸이 이미 다루므로 여기선 안 씀.
        function startWriteReview() {
            const pool = getWriteScopePool().filter(w => w && w.word);
            if (!pool.length) { showToast("이 범위엔 단어가 없어요! 다른 범위를 골라보세요.", "error"); return; }
            // 칸을 비워둔 채 시작하면 기본값으로 (숫자가 없으면 몇 개를 뽑을지 알 수 없다)
            const input = document.getElementById('write-count-input');
            if (input && !parseInt(input.value, 10)) selectWriteCount(20);
            const picked = buildWriteTasks(pool, writeCount);
            const setup = document.getElementById('write-setup');
            if (setup) setup.classList.add('hidden');
            beginWritePractice(picked, {
                isTodayReview: false,
                batchSize: writeCount,      // [냐냐 요청] '다음 N개 이어서'가 내가 고른 개수를 따라감
                scopeContinue: true,
                onClose: () => { if (setup) setup.classList.remove('hidden'); }
            });
        }

        // [냐냐 요청] 쓰기 복습 공용 시작점 — 테스트부터 하고, 틀린 것만 익힌다.
        //   1바퀴: 가리고 쓰기 (전체) — 한 번에 맞히면 +2, 거기서 끝
        //   2바퀴: 1바퀴에서 틀린 것만 보면서 2번씩 쓰기 (익히기, 점수 없음)
        //   3바퀴: 그 단어들만 다시 가리고 쓰기 — 맞아도 −1, 끝내 틀리면 −2
        //   ⚠️ 망각곡선·오답 기록은 1바퀴 결과 기준이다. 3바퀴에서 맞혔다고 취소되면 안 된다
        //      (2바퀴에서 답을 보고 온 거라 '기억하고 있었다'는 증거가 못 된다).
        //   ⚠️ 다만 '언제' 적느냐는 복습이 끝난 시점이다 [냐냐 요청]:
        //      1바퀴에 맞히면 그 단어는 거기서 끝나므로 그 자리에서,
        //      틀리면 3바퀴까지 돌고 나서 한꺼번에 (복습 횟수·점수·곡선 전부).
        //      중간에 그만두면 그 단어는 복습을 안 한 것으로 남는다.
        //   마스터 자격(subjectivePassed)도 1바퀴 정답에만 준다 — 힌트 없이 떠올린 것만 인정.
        //   [냐냐 요청] 팝업 폐지 → 복습 탭 '✍️ 쓰기' 영역 안에서 진행.
        //     단어장 ✍️ 버튼·헤더 📖 복습 배너에서 불러도 복습 탭으로 이동해서 거기서 푼다.
        function beginWritePractice(pool, opts) {
            // ⚠️ 순서 중요: changeTab('review')는 진행 중이 아니면 resetReviewTab()을 부르므로
            //    state를 세팅하기 '전에' 탭부터 옮긴다.
            if (typeof changeTab === 'function' && typeof activeTab !== 'undefined' && activeTab !== 'review') {
                changeTab('review');
            }
            if (typeof selectReviewMode === 'function') selectReviewMode('write');

            writePracticeState = {
                pool: shuffleArray(pool.slice()),
                totalCount: pool.length,  // 결과 화면용 — pool은 바퀴마다 줄어든다
                index: 0,
                done: 0,
                phase: 1,                 // 1 = 테스트(가리고), 2 = 익히기(보고 2번), 3 = 재테스트(가리고)
                wrongPool: [],            // 1바퀴에서 틀린 단어 — 2·3바퀴 대상
                retry: false,             // 3바퀴에서 틀린 뒤 '정답 보고 한 번 더' 중인지
                feedback: null,           // 1바퀴 채점 결과 화면 (정답/오답 표시)
                feedbackTimer: null,
                retryReason: null,        // 1바퀴 점수 기준 — 'synonym'(+2) | 'typo'(+1)
                usedRetries: {},          // 종류별로 한 번씩만 봐준다 { synonym, typo }
                hint: '',                 // 1바퀴 재입력 안내 문구
                grading: false,           // AI 채점 중
                wrongCount: 0,            // 최종(3바퀴) 오답 수
                results: [],              // [냐냐 요청] 결과 화면용 — {word, meaning, correct, firstTry}
                // [냐냐 요청] '다음 N개 이어서'가 처음 시작한 개수를 그대로 따라가도록 기억
                //   배너로 시작 → 5개 / 쓰기연습 탭에서 시작 → 내가 고른 개수
                batchSize: (opts && opts.batchSize) || pool.length,
                scopeContinue: !!(opts && opts.scopeContinue),
                isTodayReview: !!(opts && opts.isTodayReview),
                // [냐냐 기준] 관용구 곡선을 앞으로 미는 건 '관용구 복습' 으로 시작했을 때만
                idiomReview: !!(opts && opts.idiomReview),
                onClose: (opts && opts.onClose) || null
            };

            const setup = document.getElementById('write-setup');
            const play = document.getElementById('write-play-area');
            if (setup) setup.classList.add('hidden');
            if (play) { play.classList.remove('hidden'); play.innerHTML = ''; }
            renderWritePractice();
        }

        function closeWritePractice() {
            const cb = writePracticeState && writePracticeState.onClose;
            if (writePracticeState && writePracticeState.feedbackTimer) clearTimeout(writePracticeState.feedbackTimer);
            writePracticeState = null;
            const play = document.getElementById('write-play-area');
            if (play) { play.classList.add('hidden'); play.innerHTML = ''; }
            const setup = document.getElementById('write-setup');
            if (setup) setup.classList.remove('hidden');
            if (typeof cb === 'function') { try { cb(); } catch (e) {} }
        }

        function renderWritePractice() {
            const s = writePracticeState;
            const body = document.getElementById('write-play-area');
            if (!s || !body) return;

            // [냐냐 요청] 인라인 카드 껍데기 — 다른 복습 모드(깜빡이·단어빈칸)와 같은 골격
            const wrap = (inner) => `
                <div class="bg-white border border-slate-200 rounded-3xl p-6 space-y-4">
                    <div class="flex items-center justify-between">
                        <button onclick="closeWritePractice()" class="text-xs font-bold text-slate-400 hover:text-slate-600"><i class="fa-solid fa-arrow-left"></i> 나가기</button>
                        <span class="text-xs font-bold text-slate-500"><i class="fa-solid fa-pen-to-square text-amber-500 mr-1"></i>테스트 → 틀린 것만 익히기 → 다시 테스트</span>
                    </div>
                    ${inner}
                </div>`;

            // 바퀴별 안내 화면 (엔터로 넘어감)
            const gate = (emoji, title, desc, btnText, cls) => {
                body.innerHTML = wrap(`
                    <div class="text-center space-y-4 py-6">
                        <div class="text-5xl">${emoji}</div>
                        <p class="text-lg font-bold text-slate-900">${title}</p>
                        <p class="text-xs font-bold text-slate-500 leading-relaxed">${desc}</p>
                        <button id="write-gate-btn" onclick="renderWritePractice()" class="w-full ${cls} text-white py-3 rounded-xl text-sm font-bold transition-all active:scale-95">${btnText} (Enter) →</button>
                    </div>`);
                setTimeout(() => { const b = document.getElementById('write-gate-btn'); if (b) b.focus(); }, 60);
            };

            if (s.index >= s.pool.length) {
                // ── 1바퀴(테스트) 끝 → 틀린 게 있으면 2바퀴(익히기)로, 없으면 바로 결과 ──
                if (s.phase === 1 && s.wrongPool.length > 0) {
                    s.phase = 2;
                    s.pool = s.wrongPool.slice();
                    s.index = 0; s.done = 0; s.retry = false; s.lastWrong = '';
                    s.retryReason = null; s.usedRetries = {}; s.hint = ''; s.hintMine = ''; s.grading = false; s.feedback = null;
                    gate('✍️', `틀린 ${s.pool.length}개만 익혀볼게요`,
                        `단어를 보면서 ${WRITE_PRACTICE_TIMES}번씩 써요.<br>그 다음 다시 가리고 확인합니다.`,
                        '2바퀴 시작', 'bg-indigo-600 hover:bg-indigo-700');
                    return;
                }
                // ── 2바퀴(익히기) 끝 → 3바퀴(재테스트)로 ──
                if (s.phase === 2) {
                    s.phase = 3;
                    s.pool = shuffleArray(s.wrongPool.slice());
                    s.index = 0; s.done = 0; s.retry = false; s.lastWrong = '';
                    s.retryReason = null; s.usedRetries = {}; s.hint = ''; s.hintMine = ''; s.grading = false; s.feedback = null;
                    gate('🙈', '이제 가리고 써볼 차례!',
                        '뜻만 보고 스페인어를 떠올려서 쓰세요.<br>순서는 다시 섞었어요.',
                        '3바퀴 시작', 'bg-violet-600 hover:bg-violet-700');
                    return;
                }
                // ── 끝 → 결과 ──
                const total = s.totalCount || s.pool.length;
                const nBy = (g) => (s.results || []).filter(r => r.gain === g).length;
                // [냐냐 요청] 성공 개수는 채점 결과에서 센다.
                //   total - wrongCount 로 세면 '건너뛰기'가 성공으로 잡혔다 (전부 건너뛰어도 "3개 중 3개 성공").
                const ok = (s.results || []).filter(r => r.correct).length;
                const skipped = Math.max(0, total - (s.results || []).length);
                const reviewNote = `<p class="text-xs font-bold text-violet-600">📖 복습·점수에 반영했어요 (단어당 1회)</p>`;
                let nextBtn = '';
                const batch = s.batchSize || total;
                if (s.isTodayReview && typeof getTodayReviewTasks === 'function') {
                    // 헤더 복습 배너 → 망각곡선 대상에서 이어서.
                    //   [냐냐 요청] 처음에 '몇 번에 나눠 할지' 골랐으면 그 계획의 다음 회차 개수를 따라간다.
                    //   그래서 나눔 팝업을 다시 띄우는 startTodayReviewShortcut 이 아니라 continueTodayReview 를 부른다.
                    const remain = getTodayReviewTasks().length;   // 단어 + 관용구
                    if (remain > 0) {
                        const nextN = (typeof peekNextTodayReviewCount === 'function')
                            ? peekNextTodayReviewCount(remain, batch) : Math.min(remain, batch);
                        nextBtn = `<button onclick="closeWritePractice(); continueTodayReview();" class="w-full bg-violet-600 hover:bg-violet-700 text-white py-3 rounded-xl text-sm font-bold transition-all active:scale-95">다음 ${nextN}개 이어서 →</button>`;
                    }
                } else if (s.scopeContinue && typeof getWriteScopePool === 'function') {
                    // [냐냐 요청] 쓰기연습 탭에서 시작 → 같은 범위에서 '내가 고른 개수'만큼 이어서
                    const poolLeft = getWriteScopePool().filter(x => x && x.word).length;
                    if (poolLeft > 0) {
                        nextBtn = `<button onclick="closeWritePractice(); startWriteReview();" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl text-sm font-bold transition-all active:scale-95">다음 ${Math.min(poolLeft, batch)}개 이어서 →</button>`;
                    }
                }
                // [냐냐 요청] 맞은 단어 / 틀린 단어 목록 (단어 + 뜻)
                const res = s.results || [];
                const chip = (r, ok) => `<span class="inline-block m-0.5 px-2.5 py-1 rounded-xl border text-[11px] font-bold ${ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}">${r.isIdiom ? '<span class="text-[9px] font-black text-violet-500 mr-1">관용구</span>' : ''}${escapeHtml(r.word)}<span class="font-semibold text-slate-400"> ${escapeHtml(r.meaning)}</span></span>`;
                // [냐냐 요청] '한 번에 맞힌 것' 과 '2바퀴에서 익히고 3바퀴에 맞힌 것' 을 가른다.
                //   둘 다 초록으로 뭉뚱그리면 뭘 원래 알았고 뭘 방금 외웠는지 안 보인다.
                const okList = res.filter(r => r.correct && r.firstTry);
                const learnedList = res.filter(r => r.correct && !r.firstTry);
                const noList = res.filter(r => !r.correct);
                // [냐냐 요청] 실제로 붙은 점수대로 묶어서 보여준다 (오타 고친 +1을 +2로 뭉뚱그리지 않게)
                const groups = [
                    ['한 번에',      nBy(2),   '+2',   'text-emerald-600'],
                    ['오타 고쳐서',  nBy(1),   '+1',   'text-emerald-600'],
                    ['익혀서',       nBy(-1),  '−1',   'text-amber-600'],
                    ['끝내',         nBy(-2),  '−2',   'text-rose-500']
                ].filter(g => g[1] > 0).map(([label, n, pts, cls]) => `<span class="${cls}">${label} ${n}개 (${pts})</span>`);
                const scoreLine = groups.length ? `<p class="text-sm font-bold text-slate-600">${groups.join(' · ')}</p>` : '';
                //   익혀서 맞힌 것은 초록도 빨강도 아니다 — 노랑으로 따로 둔다 (점수도 −1 이다)
                const chipAmber = (r) => `<span class="inline-block m-0.5 px-2.5 py-1 rounded-xl border text-[11px] font-bold bg-amber-50 border-amber-200 text-amber-700">${r.isIdiom ? '<span class="text-[9px] font-black text-violet-500 mr-1">관용구</span>' : ''}${escapeHtml(r.word)}<span class="font-semibold text-slate-400"> ${escapeHtml(r.meaning)}</span></span>`;
                const listBlock = (title, arr, ok, tone) => arr.length ? `
                    <div class="text-left">
                        <p class="text-xs font-black ${tone || (ok ? 'text-emerald-600' : 'text-rose-500')} mb-1.5">${title} ${arr.length}개</p>
                        <div class="-m-0.5">${arr.map(r => (tone === 'text-amber-600' ? chipAmber(r) : chip(r, ok))).join('')}</div>
                    </div>` : '';
                // [냐냐 요청] 이번 복습으로 등급이 바뀐 단어들 (core.js 의 공용 표시를 쓴다)
                //   관용구 문제였어도 점수는 그 단어에 붙으므로, 여기선 단어 이름으로 보여준다
                const shiftRows = res.map(r => ({ ...r, word: r.baseWord || r.word, meaning: r.baseMeaning || r.meaning }));
                const shiftInner = (typeof gradeShiftHtml === 'function') ? gradeShiftHtml(shiftRows) : '';
                const shiftLists = shiftInner ? `<div class="pt-2 mt-2 border-t border-slate-100">${shiftInner}</div>` : '';

                const resultLists = (okList.length || learnedList.length || noList.length) ? `
                    <div class="pt-2 mt-2 border-t border-slate-100 space-y-3">
                        ${listBlock('✅ 바로 맞힌 단어', okList, true)}
                        ${listBlock('📖 익혀서 맞힌 단어', learnedList, true, 'text-amber-600')}
                        ${listBlock('❌ 끝내 틀린 단어', noList, false)}
                    </div>` : '';

                body.innerHTML = wrap(`
                    <div class="text-center space-y-4 py-6">
                        <div class="text-5xl">🎉</div>
                        <p class="text-lg font-bold text-slate-900">${total}개 중 ${ok}개 성공!${skipped ? `<span class="text-sm font-bold text-slate-400"> · 건너뜀 ${skipped}개</span>` : ''}</p>
                        ${scoreLine}
                        ${reviewNote}
                        ${shiftLists}
                        ${resultLists}
                        ${nextBtn}
                        <button onclick="closeWritePractice()" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl text-sm font-bold transition-all active:scale-95">설정으로 돌아가기</button>
                    </div>`);
                return;
            }

            const w = s.pool[s.index];
            const isTest = (s.phase === 1 || s.phase === 3);   // 가리고 쓰는 바퀴
            const dotsCount = isTest ? 1 : WRITE_PRACTICE_TIMES;
            const dots = Array.from({ length: dotsCount }, (_, k) =>
                `<span class="w-2.5 h-2.5 rounded-full ${k < s.done ? 'bg-emerald-500' : 'bg-slate-200'}"></span>`).join('');
            const pct = Math.round(s.index / s.pool.length * 100);

            // [냐냐 요청] 품사 뱃지
            const posLabel = (typeof POS_LABELS !== 'undefined' && POS_LABELS[w.pos]) ? POS_LABELS[w.pos] : (w.pos || '');
            // [냐냐 요청] 관용구 문제는 한눈에 알아보게. 단어 하나가 아니라 표현을 쓰는 자리다.
            //   ⚠️ 어느 단어의 표현인지는 답을 가린 동안 적으면 안 된다 — 그 단어가 대개 정답
            //   안에 그대로 들어 있어서 답을 알려주는 꼴이 된다
            //   (예: '📘 관용구 · la línea' → 정답 'estar en la línea de [상황]').
            //   정답이 이미 드러난 화면(다시 쓰기)에서만 같이 적는다.
            const showIdiomBase = !!s.retry;
            const posHtml = w._isIdiomTask
                ? `<span class="inline-block text-[10px] font-black text-violet-600 bg-violet-100 border border-violet-200 rounded-lg px-2 py-0.5">📘 관용구${showIdiomBase ? ` · ${escapeHtml((w._idiomOf || {}).word || '')}` : ''}</span>`
                : (posLabel
                    ? `<span class="inline-block text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded-lg px-2 py-0.5">${escapeHtml(posLabel)}</span>`
                    : '');

            // [냐냐 요청] 익히기 바퀴 카드는 "퀴즈 정답 화면"과 같은 양식으로 정보를 전부 펼쳐서 보여줌
            //   (펴기/접기 없음. 관용구·예문·유의어·반의어·노트는 buildNotesHtml, 동사변형은 renderQuizConjugation이 담당)

            // [냐냐 요청] 바퀴별 카드 — 테스트(1·3): 가림(뜻만) / 익히기(2): 전체 정보 / 3바퀴 틀림: 정답 공개
            let cardHtml, inputLabel, placeholder;
            if (s.phase === 2) {
                const badges = (typeof buildWordBadgesHtml === 'function') ? buildWordBadgesHtml(w, { align: 'left' }) : '';
                const notes = (typeof buildNotesHtml === 'function') ? buildNotesHtml(w, {}) : '';
                const parts = [badges, notes].filter(x => x && x.trim());
                //   [냐냐 요청] 활용형 문제는 익히기 바퀴에서 원형으로 — 뜻도 시제 꼬리표를 뗀 것으로
                const learnWord = writeRoundTarget(w, 2);
                const learnMean = (w._isConjTask && w._conjOf) ? (w._conjOf.meaning || '') : (w.meaning || '');
                const conjBack = (w._isConjTask && w._conjSlot)
                    ? `<p class="text-[11px] font-bold text-indigo-500">🔀 원형부터 익히고, 다음 바퀴에서 <b>${escapeHtml(w._conjSlot.personLabel ? w._conjSlot.tenseLabel + ' · ' + w._conjSlot.personLabel : w._conjSlot.tenseLabel)}</b> 로 다시 물어봐요</p>`
                    : '';
                cardHtml = `
                    <div class="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-1 max-h-[42vh] overflow-y-auto no-scrollbar">
                        <div class="text-left space-y-1">
                            <p class="text-2xl font-extrabold text-slate-900 break-words">${escapeHtml(learnWord)}</p>
                            <p class="text-sm font-bold text-slate-500 break-words">${escapeHtml(learnMean)}</p>
                            ${conjBack}
                        </div>
                        ${parts.length ? '<div class="border-t border-slate-200 my-2"></div>' + parts.join('<div class="border-t border-slate-100 my-3"></div>') : ''}
                        <div id="write-conj-box" class="hidden"></div>
                    </div>`;
                inputLabel = '보고 그대로 쓰세요 (엔터)';
                placeholder = learnWord;
            } else if (!s.retry) {
                cardHtml = `
                    <div class="bg-violet-50 rounded-2xl border border-violet-200 p-5 text-center space-y-1">
                        ${posHtml}
                        <p class="text-2xl font-extrabold text-violet-300 tracking-widest select-none">? ? ?</p>
                        <p class="text-base font-extrabold text-slate-800 break-words">${escapeHtml(w.meaning || '')}</p>
                    </div>`;
                inputLabel = '떠올려서 쓰세요 (엔터)';
                placeholder = '스페인어로...';
            } else {
                // [냐냐 요청] 내가 쓴 오답을 같이 보여줘서 어디가 틀렸는지 바로 비교
                const mine = (s.lastWrong || '').trim();
                // [냐냐 요청] 틀린 자리만 빨갛게 — 어디가 다른지 눈으로 바로 보이게
                const mineHtml = mine
                    ? `<p class="text-xs font-bold text-slate-600 break-words">${(typeof charDiffOps === 'function') ? renderCharDiff(charDiffOps(mine, w.word), 'user') : escapeHtml(mine)}</p>`
                    : `<p class="text-xs font-bold text-slate-300">(빈칸으로 제출했어요)</p>`;
                cardHtml = `
                    <div class="bg-rose-50 rounded-2xl border border-rose-200 p-5 text-center space-y-1">
                        ${posHtml}
                        <p class="text-2xl font-extrabold text-rose-600 break-words">${escapeHtml(w.word)}</p>
                        <p class="text-sm font-bold text-slate-500 break-words">${escapeHtml(w.meaning || '')}</p>
                        <div class="pt-2 mt-2 border-t border-rose-200 space-y-0.5">
                            <p class="text-[10px] font-bold text-slate-400">내가 쓴 답</p>
                            ${mineHtml}
                        </div>
                        <p class="text-[10px] font-bold text-rose-400 pt-1">아쉬워요! 정답을 보고 한 번 더 쓰면 넘어가요</p>
                    </div>`;
                inputLabel = '정답을 보고 한 번 더 (엔터)';
                placeholder = w.word;
            }

            // [냐냐 요청] 1바퀴는 맞았는지 틀렸는지를 보여주고 넘어간다.
            //   예전엔 조용히 다음 단어로 넘어가서 채점이 됐는지조차 알 수 없었다.
            const fb = s.feedback;
            let feedbackHtml = '';
            if (fb) {
                const gainText = fb.gain === 1 ? '오타 고쳐서 +1' : (fb.gain === 2 ? '+2' : '');
                const mine = (fb.mine || '').trim();
                feedbackHtml = `
                    <div class="rounded-2xl border p-5 text-center space-y-1 ${fb.correct ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}">
                        <p class="text-xs font-black ${fb.correct ? 'text-emerald-600' : 'text-rose-500'}">${fb.correct ? `✅ 정답! <span class="text-emerald-500">${gainText}</span>` : '❌ 아쉬워요'}</p>
                        <p class="text-2xl font-extrabold ${fb.correct ? 'text-emerald-700' : 'text-rose-600'} break-words">${escapeHtml(fb.answer)}</p>
                        <p class="text-sm font-bold text-slate-500 break-words">${escapeHtml(fb.meaning || '')}</p>
                        ${(!fb.correct && fb.why) ? `
                        <div class="pt-2 mt-2 border-t border-rose-200 text-xs">${fb.why}</div>` : ((!fb.correct && mine) ? `
                        <div class="pt-2 mt-2 border-t border-rose-200 space-y-0.5">
                            <p class="text-[10px] font-bold text-slate-400">내가 쓴 답</p>
                            <p class="text-xs font-bold text-rose-400 line-through break-words">${escapeHtml(mine)}</p>
                        </div>` : '')}
                        ${fb.correct ? '' : '<p class="text-[10px] font-bold text-rose-400 pt-1">2바퀴에서 다시 익혀요</p>'}
                    </div>`;
            }

            body.innerHTML = wrap(`
                <div class="space-y-4">
                    <div>
                        <div class="flex items-center justify-between mb-1.5">
                            <span class="text-[11px] font-bold ${isTest ? 'text-violet-500' : 'text-slate-400'}">${s.phase === 1 ? '1바퀴 · 가리고 쓰기' : (s.phase === 2 ? '2바퀴 · 보고 쓰기' : '3바퀴 · 다시 가리고 쓰기')} &nbsp;${s.index + 1} / ${s.pool.length}</span>
                            <span class="flex items-center gap-1.5">${dots}</span>
                        </div>
                        <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div class="h-full ${isTest ? 'bg-violet-500' : 'bg-indigo-500'} transition-all" style="width:${pct}%"></div>
                        </div>
                    </div>

                    ${fb ? feedbackHtml : cardHtml}

                    ${(!fb && s.hint) ? `<div class="bg-amber-50 border border-amber-200 rounded-2xl px-3 py-2.5 text-xs font-bold text-amber-800 leading-relaxed">
                        ${s.hint}
                        ${s.hintMine ? `<div class="mt-2 pt-2 border-t border-amber-200 flex items-baseline gap-2">
                            <span class="text-[10px] font-bold text-amber-600 shrink-0">내가 쓴 답</span>
                            <span class="text-xs font-bold text-slate-600 break-words">${writeRetryMineHtml(s, w)}</span>
                        </div>` : ''}
                    </div>` : ''}

                    ${fb ? `
                    <button id="write-next-btn" onclick="writeFirstRoundNext()" class="w-full ${fb.correct ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-500 hover:bg-rose-600'} text-white py-3 rounded-xl text-sm font-bold transition-all active:scale-95">다음 (Enter) →</button>
                    ` : `
                    <div class="space-y-1.5">
                        <label class="block text-xs font-bold text-slate-500">${s.grading ? '<i class="fa-solid fa-spinner animate-spin"></i> 채점 중...' : inputLabel}</label>
                        <input id="write-practice-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                            onkeydown="writePracticeKeydown(event)" ${s.grading ? 'disabled' : ''}
                            class="w-full px-3 py-2.5 rounded-xl border-2 ${isTest && !s.retry ? 'border-violet-300 bg-violet-50/40 focus:ring-violet-400' : 'border-indigo-300 bg-indigo-50/40 focus:ring-indigo-400'} text-base font-bold focus:outline-none focus:ring-2 disabled:opacity-50"
                            placeholder="${escapeHtml(placeholder)}">
                        <p id="write-practice-hint" class="text-[11px] font-bold text-slate-400">${s.phase === 1 ? '유의어나 오타는 한 번 더 기회를 줘요' : '악센트까지 정확히 써야 넘어가요'}</p>
                    </div>`}

                    <div class="flex gap-2">
                        ${fb ? '' : `<button onclick="skipWritePractice()" class="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-bold transition-all">건너뛰기</button>`}
                        <button onclick="closeWritePractice()" class="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-bold transition-all">그만하기</button>
                    </div>
                </div>`);
            // [냐냐 요청] 익히기 바퀴에서 동사면 등록된 시제 전부 (퀴즈 정답 화면과 동일한 렌더러 재사용)
            if (s.phase === 2 && typeof renderQuizConjugation === 'function') {
                renderQuizConjugation(w, null, 'write-conj-box');
            }
            setTimeout(() => {
                const nextBtn = document.getElementById('write-next-btn');
                if (nextBtn) { nextBtn.focus(); return; }   // 채점 결과 화면에선 '다음' 버튼에 포커스
                const el = document.getElementById('write-practice-input'); if (el) el.focus();
            }, 60);
            // [냐냐 요청] 익히기 바퀴(보고 쓰기)에선 매 시도마다 읽어줌 (1회차 제출 후 2회차에도 한 번 더).
            //   테스트 바퀴는 정답이 새어나가므로 안 읽음.
            if (s.phase === 2 && typeof speakSpanishVoice === 'function') {
                setTimeout(() => speakSpanishVoice(w.word), 120);
            }
        }

        function skipWritePractice() {
            const s = writePracticeState;
            if (!s || s.grading) return;
            s.index++;
            s.done = 0;
            s.retry = false;
            s.lastWrong = '';
            s.retryReason = null;   // [냐냐 요청] 봐준 이유는 단어마다 초기화
            s.usedRetries = {};
            s.hint = '';
            s.hintMine = '';
            s.feedback = null;
            renderWritePractice();
        }

        function writePracticeFlashWrong(el) {
            el.classList.add('border-red-400', 'bg-red-50');
            const hint = document.getElementById('write-practice-hint');
            if (hint) { hint.innerText = '다시 한 번 — 철자를 확인해 보세요'; hint.className = 'text-[11px] font-bold text-red-500'; }
            setTimeout(() => el.classList.remove('border-red-400', 'bg-red-50'), 500);
            el.select();
        }

        // [냐냐 요청] 쓰기 채점 정규화는 퀴즈와 같은 함수를 쓴다 (keepAccents=true).
        //   철자 연습이라 악센트만 살리고, 걷어내는 건 전부 같다 —
        //   자리표시자·한글·관사·문장부호. 예전엔 여기에 같은 정규식을 따로 들고 있다가
        //   관사 규칙이 한쪽만 바뀌어서 오답 설명이 어긋난 적이 있다.
        function normalizeWriteAnswer(s) { return normalizeSpanishAnswer(s, true); }
        function stripAccentMarks(s) {
            return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
        }
        // [냐냐 요청] 관용구는 같은 뜻을 내는 표현이 단어보다 훨씬 많다.
        //   다른 표현으로 맞게 말했어도 지금 외우려는 건 이 표현이니, 어느 낱말을 써야 하는지
        //   짚어주고 한 번 더 쓰게 한다. ("querer 말고 tener 를 써서 말해볼까요?")
        //   고르는 법: 정답 표현의 낱말 중 내가 안 쓴 것, 그중 기능어가 아닌 첫 낱말.
        const WRITE_HINT_STOPWORDS = new Set([
            'el','la','los','las','un','una','unos','unas','de','del','a','al','en','con','por','para',
            'que','se','y','o','u','lo','le','me','te','nos','os','su','mi','tu','es','ser','estar'
        ]);
        function writeIdiomHintWord(userRaw, targetRaw) {
            const bare = (t) => String(t || '').toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9\s]/g, ' ').trim();
            const mine = new Set(bare(userRaw).split(/\s+/).filter(Boolean));
            const raw = String(targetRaw || '').trim().split(/\s+/).filter(Boolean);
            const pick = (test) => {
                for (let i = 0; i < raw.length; i++) {
                    const k = bare(raw[i]);
                    if (k && test(k)) return raw[i].replace(/^[^\wÁÉÍÓÚÜÑáéíóúüñ]+|[^\wÁÉÍÓÚÜÑáéíóúüñ]+$/g, '');
                }
                return '';
            };
            // ① 내가 안 쓴 알맹이 낱말 → ② 안 쓴 아무 낱말 → ③ 알맹이 낱말 아무거나
            return pick(k => !mine.has(k) && !WRITE_HINT_STOPWORDS.has(k) && k.length > 2)
                || pick(k => !mine.has(k) && k.length > 1)
                || pick(k => !WRITE_HINT_STOPWORDS.has(k) && k.length > 2);
        }

        function writeAnswerMatches(userRaw, correctRaw) {
            return normalizeWriteAnswer(userRaw) === normalizeWriteAnswer(correctRaw);
        }

        // 같은 뜻이지만 다른 표현을 썼을 때 보여줄 안내.
        //   관용구면 '이 낱말을 써서' 로 좁혀준다 — 표현이 여럿이라 그냥 '다시'로는 못 맞힌다.
        //   [냐냐 요청] 힌트는 오타 힌트와 같은 '앞글자' 방식으로 준다.
        //   정답 표현에서 낱말을 골라 짚어주면 두 낱말짜리는 거의 답이고,
        //   등록된 단어를 통째로 알려줘도 그 단어가 대개 표현 안에 그대로 들어 있다.
        //   그래서 그 단어의 앞글자만 흘린다 (writePrefixHint 가 마지막 글자는 남겨둔다).
        function writeSynonymHint(userAnswer, w, fallback) {
            if (w && w._isIdiomTask) {
                const base = (w._idiomOf || {}).word;
                const p = base ? writePrefixHint(userAnswer, base) : '';
                if (p) return `💡 그것도 통하는 말이에요! 이번엔 <b>${escapeHtml(p)}</b> 로 시작하는 단어를 써서 말해볼까요?`;
                return `💡 그것도 통하는 말이에요! 이번엔 외우려던 그 표현으로 써볼까요?`;
            }
            return fallback || `💡 그것도 같은 뜻이에요! 다른 단어를 생각해 볼까요?`;
        }
        // 악센트만 틀린 경우 — 봐주지는 않고 '한 번 더' 기회를 준다
        function writeAccentOnlyMiss(userRaw, correctRaw) {
            const u = normalizeWriteAnswer(userRaw), c = normalizeWriteAnswer(correctRaw);
            return u !== c && !!u && stripAccentMarks(u) === stripAccentMarks(c);
        }

        // [냐냐 지적] 채점이 오래 걸린다. 재보니 AI 한 번 왕복이 빠를 때 1초, 밀릴 땐 5~8초다.
        //   그런데 되묻는 경우의 대부분은 '철자가 살짝 틀린 것' 이고, 그건 AI 없이도 안다 —
        //   AI 프롬프트가 쓰는 기준("정답을 쓰려다 서너 글자 안쪽으로 틀림")과 같은 잣대를 여기서 쓴다.
        //   그러면 오타는 기다림 없이 그 자리에서 되묻고, AI 는 '다른 낱말을 썼나(유의어)' 를
        //   가려야 할 때만 부른다. 유의어는 대개 철자가 멀어서 여기 안 걸린다.
        //   ⚠️ 네 글자 미만은 건드리지 않는다 — 짧은 낱말은 두 글자만 달라도 아예 다른 낱말이다.
        //   ⚠️ 한 글자 차이(+ 붙은 두 글자가 뒤바뀐 것)까지만 오타로 본다. 두 글자가 진짜로 다르면
        //      televisor ↔ televisión 처럼 '다른 진짜 낱말' 일 수 있어서 그건 AI 에게 넘긴다.
        function writeLooksLikeTypo(userRaw, correctRaw) {
            if (typeof levenshtein !== 'function') return false;
            const u = normalizeWriteAnswer(userRaw), c = normalizeWriteAnswer(correctRaw);
            if (!u || !c || c.length < 4) return false;
            // [냐냐 지적] 여전히 느리다 → 두 글자까지 오타로 본다. 대신 안전장치를 하나 둔다:
            //   내가 쓴 답이 단어장에서 '어떤 낱말' 로 알아들어지면 그건 오타가 아닐 수 있다.
            //   (esperando 를 물었는데 esperado — 같은 동사 다른 활용, 또는 아예 다른 낱말)
            //   그런 건 판정이 갈리는 자리라 그대로 AI 에게 맡긴다.
            if (typeof findVocabWordByForm === 'function' && findVocabWordByForm(userRaw)) return false;
            const d = levenshtein(u, c);
            return d > 0 && d <= 2;
        }

        // [냐냐 요청] 내가 이미 등록해 둔 유의어면 AI 에게 물을 것도 없다 — 답이 단어장에 있다.
        //   (유의어만. 반의어는 뜻이 반대라 봐주면 안 된다)
        function writeRegisteredSynonym(userRaw, w) {
            const base = (w && (w._idiomOf || w._conjOf || w)) || w;
            const list = (base && Array.isArray(base.synonyms)) ? base.synonyms : [];
            if (!list.length || typeof vocabulary === 'undefined') return null;
            const u = normalizeWriteAnswer(userRaw);
            if (!u) return null;
            for (const sy of list) {
                if (!sy || sy.type === 'antonym') continue;
                const v = vocabulary.find(x => x.id === sy.id);
                if (v && normalizeWriteAnswer(v.word) === u) return v;
            }
            return null;
        }

        // [냐냐 요청] 활용형 문제를 틀리면 2바퀴(익히기)는 '원형' 으로 익힌다 (2026-09-03).
        //   활용을 틀렸다는 건 대개 원형부터 흔들린다는 뜻이라, 익히기 바퀴에서 뿌리를 잡는다.
        //   3바퀴는 1바퀴에 냈던 그 시제로 다시 묻는다 — 과제 객체를 그대로 쓰므로 저절로 같다.
        function writeRoundTarget(w, phase) {
            if (phase === 2 && w && w._isConjTask && w._conjOf && w._conjOf.word) return w._conjOf.word;
            return (w && w.word) || '';
        }

        function writePracticeKeydown(e) {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const s = writePracticeState;
            const el = document.getElementById('write-practice-input');
            if (!s || s.grading) return;              // AI 채점 중이면 엔터 무시
            if (s.feedback) { writeFirstRoundNext(); return; }  // 채점 결과를 보고 있으면 엔터로 다음
            if (!el) return;
            const w = s.pool[s.index];
            //   2바퀴에서 활용형 문제는 원형을 쓴다 (writeRoundTarget)
            const isMatch = writeAnswerMatches(el.value, writeRoundTarget(w, s.phase));

            // ── 2바퀴: 보면서 2번 쓰기 (익히기 — 점수 없음) ──
            if (s.phase === 2) {
                if (isMatch) {
                    s.done++;
                    if (s.done >= WRITE_PRACTICE_TIMES) { s.index++; s.done = 0; }
                    else el.value = '';
                    renderWritePractice();
                } else {
                    writePracticeFlashWrong(el);
                }
                return;
            }

            // ── 3바퀴에서 틀린 뒤 '정답 보고 한 번 더' — 정확히 써야 넘어감 (점수 없음) ──
            if (s.retry) {
                if (isMatch) { s.retry = false; s.lastWrong = ''; s.index++; s.done = 0; renderWritePractice(); }
                else writePracticeFlashWrong(el);
                return;
            }

            // [냐냐 요청] 빈칸으로 엔터를 치면 바로 넘기지 않고 한 번 물어본다 (가리고 쓰는 바퀴만).
            //   손이 미끄러져 엔터를 친 것과 정말 모르겠는 것을 가른다. 한 번 더 치면 그때 넘어간다.
            //   ⚠️ 물어본 자리를 '몇 번째 문제의 몇 바퀴' 로 기억한다 — 그래야 다음 단어에서 다시 묻는다.
            if (!el.value.trim()) {
                const askKey = s.index + ':' + s.phase;
                if (s.blankAskKey !== askKey) {
                    s.blankAskKey = askKey;
                    s.hint = '✏️ 빈칸이에요. 정말 모르겠으면 <b>한 번 더 엔터</b>를 치세요 — 모르는 것으로 넘어가요.';
                    s.hintMine = '';
                    renderWritePractice();
                    return;
                }
            } else if (s.blankAskKey === s.index + ':' + s.phase) {
                s.blankAskKey = null;      // 뭔가 쓰고 냈으면 빈칸 안내는 걷는다 (채점 중에 남아 있으면 헷갈린다)
                s.hint = '';
            }

            // ── 1바퀴: 가리고 쓰기 (테스트) — 퀴즈 주관식과 같은 채점 경로 ──
            if (s.phase === 1) { gradeWriteFirstRound(el.value); return; }

            // ── 3바퀴: 다시 가리고 쓰기 (최종) ──
            //   [냐냐 요청] 1바퀴에서 틀린 단어의 기록을 여기서 한꺼번에 반영한다.
            //   correct:false 로 부르는 건 "1바퀴에서 못 떠올렸다"는 사실을 지금 적는 것이다 —
            //   오답 횟수·틀린 날짜가 남고 망각곡선이 한 칸 뒤로 간다. 3바퀴에서 맞혔다고
            //   취소되지 않는다 (2바퀴에서 답을 보고 온 거라 기억했다는 증거가 아니다).
            //   [냐냐 요청] 델타는 맞혀도 마이너스다: 맞히면 −1, 끝내 틀리면 −2.
            //   1바퀴에서 못 떠올린 단어라 '아는 단어'로 볼 수 없다. 2바퀴에서 답을 보고
            //   두 번 베껴 쓴 뒤에 맞힌 것이라 기억했다는 증거가 아니다.
            //   그래도 다시 붙잡긴 했으니 끝내 틀린 −2 와는 구분해 준다.
            // [냐냐 지적] 관용구 과제는 단어 곡선을 건드리면 안 된다 — 그 표현은 제 곡선을 따로 갖는다.
            //   (1바퀴에서 이미 idiomReviewDemote 로 그 표현의 곡선을 뒤로 밀어뒀다)
            //   퀴즈와 단어 빈칸은 skipReviewDate 로 빼고 있었는데 여기만 빠져 있었다.
            const idiomTask = !!w._isIdiomTask;
            // [냐냐 지적] 1바퀴에서 틀린 순간 −2 와 곡선을 이미 적었다. 여기서는 차액만 반영한다:
            //   3바퀴에서 맞히면 +1 (합 −1), 끝내 틀리면 더할 게 없다 (합 −2). 곡선은 다시 안 민다.
            const already = !!w._firstFailScored;
            if (isMatch) {
                const shift = withGradeShift(w._idiomOf || w._conjOf || w, () => {
                    if (typeof addWordScore !== 'function') return;
                    // ⚠️ 1바퀴에서 이미 적었으면 여기서는 '점수 차액'만 돌려준다.
                    //   correct 를 넘기면 오답 횟수가 두 번 세어지고 곡선도 또 뒤로 간다.
                    if (already) addWordScore(w.id, 1, { correctCount: 0, wrongCount: 0, skipReviewDate: true });
                    else addWordScore(w.id, -1, { correct: false, skipReviewDate: idiomTask });
                });
                if (!already && !idiomTask && typeof markWordReviewedToday === 'function') markWordReviewedToday(w.id, false);
                if (!already && typeof logAction === 'function') logAction('review');
                s.results.push({ word: w.word, meaning: w.meaning || '', baseWord: (w._idiomOf || w._conjOf || w).word, baseMeaning: (w._idiomOf || w._conjOf || w).meaning || '', isIdiom: !!w._isIdiomTask, correct: true, firstTry: false, gain: -1, ...shift });
                s.index++;
                s.done = 0;
            } else {
                s.wrongCount++;
                s.retry = true;
                s.lastWrong = el.value.trim();   // [냐냐 요청] 다시 쓰기 화면에 내가 쓴 오답 보여주기
                const shift = withGradeShift(w._idiomOf || w._conjOf || w, () => {
                    if (!already && typeof addWordScore === 'function') addWordScore(w.id, -2, { correct: false, skipReviewDate: idiomTask });
                });
                if (!already && !idiomTask && typeof markWordReviewedToday === 'function') markWordReviewedToday(w.id, false);
                if (!already && typeof logAction === 'function') logAction('review');
                s.results.push({ word: w.word, meaning: w.meaning || '', baseWord: (w._idiomOf || w._conjOf || w).word, baseMeaning: (w._idiomOf || w._conjOf || w).meaning || '', isIdiom: !!w._isIdiomTask, correct: false, firstTry: false, gain: -2, ...shift });
            }
            writePracticeSave();
            renderWritePractice();
        }

        // ============================================================
        // [냐냐 요청] 1바퀴(테스트) 채점 — 퀴즈 주관식과 같은 대접을 해준다.
        //   유의어를 썼거나 철자가 살짝 틀렸으면 한 번 더 쓸 기회를 주고,
        //   판정은 AI에게 맡긴다 (키가 없거나 실패하면 로컬 채점으로 폴백).
        //   점수도 퀴즈 주관식과 같은 값: 바로 정답 +2 / 유의어 후 정답 +2 / 오타 후 정답 +1
        // ============================================================
        const WRITE_FEEDBACK_MS = 900;   // 정답은 잠깐 보여주고 알아서 넘어간다

        // [냐냐 요청] 쓰기 복습으로도 마스터가 되고 약점으로도 떨어지는데, 결과 화면이
        //   맞은/틀린 것만 보여줘서 그 변화를 알 수가 없었다. 점수를 매기기 전후의 등급을
        //   재두었다가 결과 화면에서 짚어준다.
        //   (재는 것도 그리는 것도 core.js 의 withGradeShift / gradeShiftHtml 을 같이 쓴다)
        function writeFirstRoundPass(w, gain) {
            const s = writePracticeState;
            // [냐냐 기준] 그 표현을 맞혔으면 곡선을 한 칸 앞으로 — 단, 관용구 복습으로 시작했을 때만.
            //   단어 복습에 섞여 나온 관용구나 퀴즈에서 맞힌 건 점수만 준다 (단어·문법과 같은 기준).
            if (w._isIdiomTask && w._idiomOf) {
                if (typeof markIdiomSeen === 'function') markIdiomSeen(w._idiomOf.id, w.word);   // 만난 표현으로 기록
                if (s.idiomReview && typeof idiomReviewAdvance === 'function') idiomReviewAdvance(w._idiomOf.id, w.word);
            }
            const shift = withGradeShift(w._idiomOf || w._conjOf || w, () => {
                if (typeof addWordScore === 'function') addWordScore(w.id, gain, { correct: true, subjective: true });
            });
            // 관용구 과제를 맞힌 것으로 단어 곡선을 앞으로 밀지 않는다 — 방금 그 표현의 곡선을 밀었다
            if (!w._isIdiomTask && typeof markWordReviewedToday === 'function') markWordReviewedToday(w.id, true);
            if (typeof logAction === 'function') logAction('review');
            s.results.push({ word: w.word, meaning: w.meaning || '', baseWord: (w._idiomOf || w._conjOf || w).word, baseMeaning: (w._idiomOf || w._conjOf || w).meaning || '', isIdiom: !!w._isIdiomTask, correct: true, firstTry: true, gain, ...shift });
            s.feedback = { correct: true, gain, answer: w.word, meaning: w.meaning || '', mine: '' };
            writePracticeSave();
            renderWritePractice();
            // 정답은 굳이 손을 안 대도 넘어가게 (엔터를 치면 기다리지 않고 바로)
            s.feedbackTimer = setTimeout(() => {
                if (writePracticeState === s && s.feedback) writeFirstRoundNext();
            }, WRITE_FEEDBACK_MS);
        }
        function writeFirstRoundFail(w, mine, aiInfo) {
            const s = writePracticeState;
            // [냐냐 요청] 관용구는 제 망각곡선을 따로 갖는다 (단어 곡선과 별개).
            //   '다시 만나기' 는 그 곡선이 맡으므로 따로 표시해 둘 필요가 없다.
            if (w._isIdiomTask && w._idiomOf) {
                if (typeof markIdiomSeen === 'function') markIdiomSeen(w._idiomOf.id, w.word);   // 만난 표현으로 기록
                if (typeof idiomReviewDemote === 'function') idiomReviewDemote(w._idiomOf.id, w.word);
            }
            // [냐냐 지적] 틀리는 '그 순간' 에 적는다 (2026-09-03). 예전엔 3바퀴까지 다 돌아야
            //   점수·곡선이 붙어서, 중간에 그만두면 틀린 기록이 통째로 사라졌다.
            //   ⚠️ 최종 점수는 그대로다 — 여기서 −2 를 먼저 적고, 3바퀴에서 맞히면 +1 을 돌려줘
            //   합이 −1 이 된다 (끝내 틀리면 −2 그대로). 곡선과 복습 횟수는 여기서 한 번만 민다.
            const idiomTask = !!w._isIdiomTask;
            if (!w._firstFailScored) {
                w._firstFailScored = true;
                if (typeof addWordScore === 'function') {
                    addWordScore(w.id, -2, { correct: false, skipReviewDate: idiomTask });
                }
                // 관용구 과제는 단어 곡선을 건드리지 않는다 (그 표현의 곡선은 위에서 이미 밀었다)
                if (!idiomTask && typeof markWordReviewedToday === 'function') markWordReviewedToday(w.id, false);
                if (typeof logAction === 'function') logAction('review');
            }
            s.wrongPool.push(w);
            // 오답은 정답을 보여주고, 엔터를 눌러야 넘어간다 (그냥 지나가면 뭘 틀렸는지 모른다)
            // [냐냐 요청] 왜 틀렸는지까지 — 철자면 틀린 자리 표시, 다른 단어면 그 단어의 뜻
            const why = (typeof buildWrongAnswerHtml === 'function')
                ? buildWrongAnswerHtml(mine || '', w.word, aiInfo || {}) : '';
            s.feedback = { correct: false, answer: w.word, meaning: w.meaning || '', mine: mine || '', why };
            writePracticeSave();
            renderWritePractice();
            // [냐냐 요청] 틀렸을 때 정답을 한 번 읽어준다. 화면에 이미 답이 떠 있으니
            //   새어나갈 게 없고, 눈으로만 보고 넘어가는 것보다 귀로 한 번 듣는 게 남는다.
            //   (음소거면 speakSpanishVoice 가 알아서 안 읽는다)
            if (typeof speakSpanishVoice === 'function') {
                setTimeout(() => speakSpanishVoice(w.word), 150);
            }
        }
        function writeFirstRoundNext() {
            const s = writePracticeState;
            if (!s) return;
            if (s.feedbackTimer) { clearTimeout(s.feedbackTimer); s.feedbackTimer = null; }
            s.feedback = null;
            s.retryReason = null;
            s.usedRetries = {};
            s.hint = '';
            s.hintMine = '';
            s.lastWrong = '';
            s.index++;
            s.done = 0;
            renderWritePractice();
        }
        // 한 번 더 쓰게 하기 (점수 반영 없음, 단어당 한 번만)
        // 다시 쓰기 안내에 붙일 '내가 쓴 답'.
        //   [냐냐 지적] 예전엔 오타로 되물을 때 틀린 글자를 빨갛게 칠했다. 그런데 앞글자 힌트와
        //   같이 뜨다 보니 답을 거의 알려주는 꼴이었다 — 'cassa' 라고 쓰면 'cas 로 시작해요' 옆에
        //   'cas[s]a' 가 뜨니 빼야 할 글자까지 보인다. 되묻기는 시험이지 교정이 아니다.
        //   그래서 되물을 땐 칠하지 않는다 (유의어 되묻기와 같다). 방금 뭐라고 썼는지만 보여준다.
        //   틀린 자리 표시는 '최종 오답' 화면에만 남는다 — 거긴 정답을 이미 보여주는 자리다.
        function writeRetryMineHtml(s, w) {
            return escapeHtml(s.hintMine || '');
        }

        //   [냐냐 요청] 힌트만 띄우면 방금 뭐라고 썼는지 잊는다. 내가 쓴 답도 같이 남긴다.
        function writeAskRetry(reason, hintHtml, mine) {
            const s = writePracticeState;
            s.usedRetries = s.usedRetries || {};
            s.usedRetries[reason] = true;
            // 오타가 한 번이라도 끼면 점수는 오타 기준(+1). 유의어만이면 +2
            s.retryReason = s.usedRetries.typo ? 'typo' : reason;
            s.hint = hintHtml;
            s.hintMine = String(mine || '').trim();
            s.hintReason = reason;
            renderWritePractice();
        }
        // 앞글자 힌트: 정답과 내 답이 공유하는 앞부분 + 다음 한 글자
        function writePrefixHint(userRaw, correctRaw) {
            const bare = String(correctRaw || '').trim()
                .replace(/^(el\/la|los\/las|un\/una|unos\/unas|el|la|los|las|un|una|unos|unas)\s+/i, '');
            const u = normalizeWriteAnswer(userRaw), c = normalizeWriteAnswer(bare);
            const shared = (typeof sharedPrefixLen === 'function') ? sharedPrefixLen(u, c) : 0;
            // ⚠️ 마지막 글자는 남긴다. 'cassa'처럼 앞이 거의 다 맞으면 정답을 통째로 흘리게 된다
            return bare.slice(0, Math.max(1, Math.min(shared + 1, bare.length - 1)));
        }

        async function gradeWriteFirstRound(userRaw) {
            const s = writePracticeState;
            if (!s) return;
            const w = s.pool[s.index];
            const userAnswer = String(userRaw || '').trim();

            // 1) 맞음 — 다시 쓰기였다면 왜 다시 썼는지에 따라 점수가 갈린다
            if (writeAnswerMatches(userAnswer, w.word)) {
                writeFirstRoundPass(w, s.retryReason === 'typo' ? 1 : 2);
                return;
            }
            // 2) 빈칸이면 오답
            if (!userAnswer) { writeFirstRoundFail(w, userAnswer); return; }
            const used = (s.usedRetries = s.usedRetries || {});

            // [냐냐 지적] 활용형 과제에도 유의어가 있다 — 원형을 안 보여주고 뜻만 주니까
            //   다른 동사를 같은 시제·인칭으로 바르게 활용해 쓸 수 있다 (esperando ↔ aguardando).
            //   그래서 AI 채점을 그대로 탄다. 대신 '같은 동사인데 활용을 틀린 것' 은
            //   유의어가 아니라 오답이라고 프롬프트에서 갈라준다 (aiGradeSubjective).

            // 3) 악센트만 틀림 → AI 부를 것도 없이 바로 '한 번 더' (철자로 이미 봐줬으면 오답)
            if (writeAccentOnlyMiss(userAnswer, w.word)) {
                if (used.typo) { writeFirstRoundFail(w, userAnswer); return; }
                writeAskRetry('typo', `✏️ 악센트가 빠졌거나 자리가 달라요! 다시 한 번 써볼까요?`, userAnswer);
                return;
            }

            // 3-0) [냐냐 지적] 내가 쓴 답이 '그 낱말의 다른 형태' 면 AI 를 부를 이유가 없다.
            //   같은 낱말인지 아닌지는 역추적으로 알 수 있고, 그 뒤 판정은 이미 정해진 규칙이다:
            //     활용형 문제에서 같은 동사 다른 형태 → 오답, 기회 없음 (그게 이 문제가 묻는 바로 그것)
            //     그 밖(명사 단·복수 등)          → 오타와 같은 대접으로 한 번 더
            //   다른 낱말로 알아들어지면 유의어일 수 있으니 그건 그대로 AI 가 본다.
            {
                const baseW = w._idiomOf || w._conjOf || w;
                const hit = (typeof findVocabWordByForm === 'function') ? findVocabWordByForm(userAnswer) : null;
                if (hit && baseW && hit.id === baseW.id) {
                    if (w._isConjTask || used.typo) { writeFirstRoundFail(w, userAnswer); return; }
                    writeAskRetry('typo', `✏️ 형태가 조금 달라요! 다시 한 번 써볼까요?`, userAnswer);
                    return;
                }
            }

            // 3-1) 내가 등록해 둔 유의어 — AI 없이 그 자리에서 되묻는다
            if (!used.synonym) {
                const syn = writeRegisteredSynonym(userAnswer, w);
                if (syn) {
                    writeAskRetry('synonym', `💡 <b>${escapeHtml(syn.word)}</b> 도 맞는 말이지만, 지금 외우려는 건 다른 낱말이에요. 다시 한 번 써볼까요?`, userAnswer);
                    return;
                }
            }

            // 3-2) 철자가 살짝 틀린 것 — AI 를 안 부르고 그 자리에서 되묻는다 (기다림 0초)
            if (!used.typo && writeLooksLikeTypo(userAnswer, w.word)) {
                writeAskRetry('typo', `✏️ 철자가 살짝 틀렸어요! 다시 한 번 써볼까요?`, userAnswer);
                return;
            }

            // 4) AI 채점
            const q = { word: w };
            let ai = null;
            const aiInfo = () => ai ? { aiIsRealWord: ai.answerIsRealWord, aiMeaning: ai.answerMeaning, comment: ai.comment } : {};
            if (typeof aiGradeSubjective === 'function') {
                s.grading = true;
                renderWritePractice();
                try { ai = await aiGradeSubjective(userAnswer, q); } catch (err) { console.warn(err); }
                s.grading = false;
                if (writePracticeState !== s) return;   // 채점 중에 나갔으면 아무것도 하지 않음
            }

            // 5) AI가 없거나 실패 → 로컬 채점으로 폴백
            if (!ai) {
                const a = (typeof analyzeSubjectiveAnswer === 'function') ? analyzeSubjectiveAnswer(userAnswer, q) : { isCorrect: false };
                if (a.isCorrect) { writeFirstRoundPass(w, 2); return; }
                if (a.isSynonym && !used.synonym) { writeAskRetry('synonym', writeSynonymHint(userAnswer, w, a.hint), userAnswer); return; }
                if (a.isTypo && !used.typo) { writeAskRetry('typo', `✏️ 철자가 살짝 틀렸어요! 다시 한 번 — <b>${escapeHtml(writePrefixHint(userAnswer, w.word))}</b>로 시작해요.`, userAnswer); return; }
                writeFirstRoundFail(w, userAnswer, aiInfo());
                return;
            }

            const verdict = String(ai.verdict || '').toLowerCase();
            // 낱말이 빠진 표현은 AI가 정답이라 해도 받아주지 않는다 (퀴즈 주관식과 같은 규칙)
            if (verdict === 'correct' && typeof phraseAnswerIncomplete === 'function'
                && phraseAnswerIncomplete(userAnswer, w.word)) {
                if (!used.typo) {
                    writeAskRetry('typo', `✏️ 낱말이 빠졌어요! 통째로 하나의 표현이라 전부 써야 해요.`, userAnswer);
                    return;
                }
                writeFirstRoundFail(w, userAnswer, aiInfo());
                return;
            }
            if (verdict === 'correct') { writeFirstRoundPass(w, 2); return; }
            // [냐냐 요청] 같은 이유로는 한 번만 봐준다. 이유가 다르면(유의어 → 오타) 한 번 더.
            if (verdict === 'synonym' && !used.synonym) {
                writeAskRetry('synonym', writeSynonymHint(userAnswer, w,
                    `💡 그것도 같은 뜻이에요! 다른 단어를 생각해 볼까요? <b>${escapeHtml(writePrefixHint(userAnswer, w.word))}</b>로 시작해요.`), userAnswer);
                return;
            }
            if (verdict === 'typo' && !used.typo) {
                // 오타가 3글자를 넘으면 봐주지 않는다 (퀴즈와 같은 기준 — 악센트를 뗀 문자열로 잰다)
                const dist = (typeof levenshtein === 'function' && typeof normalizeSpanishAnswer === 'function')
                    ? levenshtein(normalizeSpanishAnswer(userAnswer), normalizeSpanishAnswer(w.word)) : 99;
                if (dist <= 3) {
                    writeAskRetry('typo', `✏️ 철자가 살짝 틀렸어요! 다시 한 번 — <b>${escapeHtml(writePrefixHint(userAnswer, w.word))}</b>로 시작해요.`, userAnswer);
                    return;
                }
            }
            writeFirstRoundFail(w, userAnswer, aiInfo());
        }

        // 저장 + 헤더(복습 배너·통계) 갱신
        function writePracticeSave() {
            try { if (typeof saveToStorage === 'function') saveToStorage(); } catch (err) {}
            if (typeof updateStats === 'function') updateStats();
            // [냐냐 요청] 헤더 '오늘의 복습' 배너도 실시간 갱신
            if (typeof renderTodayReview === 'function') { try { renderTodayReview(); } catch (err) {} }
        }

        function renderWordList() {
            renderStreakBadge();
            renderTodayReview();
            const grid = document.getElementById('vocabulary-grid');
            const emptyState = document.getElementById('vocab-empty-state');
            const rawSearchVal = document.getElementById('search-bar').value.trim().toLowerCase();
            const searchVal = stripAccents(rawSearchVal); // [냐냐 PATCH] 악센트 무시 (o=ó)
            const isSearching = searchVal.length > 0; // [냐냐 PATCH] 검색 중이면 필터 무시하고 전체에서 검색
            const masteryFilter = isSearching ? 'all' : activeFilterMastery;
            const weakFilter = isSearching ? 'all' : activeFilterWeak;
            const posFilterActive = isSearching ? [] : activeFilterPos;
            // 검색 중이면 결과를 펼쳐서 보여주고, 아니면 전체 펼침 상태를 따름(기본 접힘)
            const expandedAll = (searchVal.length > 0 || todayWrongFilterActive) ? true : wordListExpandedAll;
            
            const filtered = vocabulary.filter(w => {
                const queryInWord = stripAccents(w.word.toLowerCase()).includes(searchVal);
                const queryInMeaning = stripAccents(w.meaning.toLowerCase()).includes(searchVal);
                // [냐냐 요청] 관용구도 찾아준다. 1113개가 검색에서 통째로 빠져 있어서
                //   'ganas' 를 쳐도 morirse de ganas 를 못 찾았다 (뭘 등록했는지 알 길이 없었다).
                const queryInIdiom = searchVal.length > 0 && wordIdiomList(w).some(it =>
                    stripAccents(String(it.idiom).toLowerCase()).includes(searchVal)
                    || stripAccents(String(it.idiomMeaning).toLowerCase()).includes(searchVal));
                const matchesSearch = queryInWord || queryInMeaning || queryInIdiom; // 메모는 여전히 제외
                const matchesPos = posFilterActive.length === 0 || posFilterActive.includes(w.pos);
                // [냐냐 PATCH] 마스터 상태 (전체/마스터만/미마스터)
                const matchesMastery = masteryFilter === 'all'
                    || (masteryFilter === 'mastered' && w.mastered)
                    || (masteryFilter === 'not-mastered' && !w.mastered);
                // [냐냐 PATCH] 약점 필터 (전체/약점만/약점제외) — 분리됨
                const matchesWeak = weakFilter === 'all'
                    || (weakFilter === 'weak' && w.weak)
                    || (weakFilter === 'not-weak' && !w.weak);
                // [냐냐 요청] '오늘 틀린 단어'는 말 그대로 오늘 틀린 것만. (복습 주기는 헤더 배너가 담당)
                const matchesTodayWrong = !todayWrongFilterActive || (!w.mastered && w.lastWrongDate && daysSince(w.lastWrongDate) === 0);
                return matchesSearch && matchesPos && matchesMastery && matchesWeak && matchesTodayWrong;
            });

            // [냐냐 PATCH] 필터/정렬 요약 한 줄 + 활성 표시점
            renderFilterSummary();
            const sortModeForBadge = activeFilterSort;
            const hasActiveFilter = activeFilterPos.length > 0 || activeFilterMastery !== 'not-mastered' || activeFilterWeak !== 'all' || sortModeForBadge !== 'weak-score';
            // [냐냐 PATCH] 점 배지 대신 버튼 자체의 배경색을 바꿔서 표시
            const ON = "w-10 h-10 bg-violet-100 hover:bg-violet-200 rounded-xl border border-violet-400 text-sm text-violet-700 transition-all flex items-center justify-center";
            const OFF = "w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-sm text-slate-600 transition-all flex items-center justify-center";
            const fBtn = document.getElementById('filter-panel-btn');
            if (fBtn) fBtn.className = hasActiveFilter ? ON : OFF;
            const dBtn = document.getElementById('display-panel-btn');
            if (dBtn) dBtn.className = isDisplayDefault() ? OFF : ON;

            // [냐냐 PATCH] 단어 목록은 항상 ABC순(정관사 제외) — 검색 결과도 정렬
            const sortMode = isSearching ? 'alpha-asc' : activeFilterSort;

            // [냐냐 PATCH] 정렬용으로만 맨 앞 정관사/부정관사를 떼어냄 (단수·복수 모두)
            // 예: "el libro" → "libro", "las casas" → "casas". 화면에 보이는 단어는 그대로 유지됨.
            const stripArticle = (w) => {
                return (w || '')
                    .toLowerCase()
                    .trim()
                    .replace(/^(el\/la|los\/las|el|la|los|las|un|una|unos|unas)\s+/, '')
                    // [냐냐 PATCH] 알파벳 정렬 시 기호는 무시 (¿ ¡ [ ] ( ) ~ - · , . 등)
                    .replace(/[^\p{L}\p{N}\s]/gu, '')
                    .trim();
            };

            let filteredSorted = filtered;
            if (isSearching) {
                // [냐냐 PATCH] 검색 시: 완전 일치 → 검색어로 시작 → 포함, 그 안에서는 ABC순
                const q = searchVal; // 이미 악센트 제거됨
                const rank = (w) => {
                    const word = stripAccents(stripArticle(w.word));
                    const meaning = stripAccents((w.meaning || '').toLowerCase().trim());
                    if (word === q || meaning === q) return 0;           // 단어나 뜻이 정확히 일치 → 맨 위
                    if (word.startsWith(q)) return 1;                     // 검색어로 시작
                    return 2;                                             // 포함
                };
                filteredSorted = [...filtered].sort((a, b) => {
                    const ra = rank(a), rb = rank(b);
                    if (ra !== rb) return ra - rb;
                    return stripArticle(a.word).localeCompare(stripArticle(b.word));
                });
            } else if (sortMode === 'oldest') {
                filteredSorted = [...filtered].reverse();
            } else if (sortMode === 'alpha-asc') {
                filteredSorted = [...filtered].sort((a, b) => stripArticle(a.word).localeCompare(stripArticle(b.word)));
            } else if (sortMode === 'alpha-desc') {
                filteredSorted = [...filtered].sort((a, b) => stripArticle(b.word).localeCompare(stripArticle(a.word)));
            } else if (sortMode === 'weak-score') {
                // [냐냐 PATCH-0배치] 점수 낮은순(=약한 단어 먼저)
                filteredSorted = [...filtered].sort((a, b) => getScore(a) - getScore(b));
            } else if (sortMode === 'score-desc') {
                // [냐냐 PATCH-0배치] 점수 높은순(=잘 아는 단어 먼저)
                filteredSorted = [...filtered].sort((a, b) => getScore(b) - getScore(a));
            }
            // 'recent'는 등록 시 배열 맨 앞에 추가되므로(unshift) 별도 처리 없이 그대로 사용

            if (filteredSorted.length === 0) {
                grid.innerHTML = '';
                // [냐냐 요청] 검색해서 안 나온 경우엔 그 검색어를 바로 등록할 수 있게 안내를 바꾼다
                //   (버튼을 누르면 openWordModalFromSearch 가 검색어를 등록창에 채워준다)
                const q = document.getElementById('search-bar').value.trim();
                const t = document.getElementById('vocab-empty-title');
                const d = document.getElementById('vocab-empty-desc');
                const b = document.getElementById('vocab-empty-btn');
                const short = q.length > 20 ? q.slice(0, 20) + '…' : q;
                if (q) {
                    if (t) t.innerText = `"${short}" 는 아직 단어장에 없어요`;
                    if (d) d.innerText = '아래 버튼을 누르면 이 말이 등록창에 채워져요.';
                    if (b) b.innerHTML = `<i class="fa-solid fa-plus"></i> "${escapeHtml(short)}" 등록하기`;
                } else {
                    if (t) t.innerText = '등록된 단어가 아직 없어요!';
                    if (d) d.innerText = '새로운 단어를 등록하고 스페인어 학습을 시작해보세요!';
                    if (b) b.innerText = '첫 단어 등록하기';
                }
                emptyState.classList.remove('hidden');
                renderPagination(0, 0); // [냐냐 PATCH-페이지네이션] 결과 없으면 바도 숨김
                lastFilteredWords = []; // [냐냐 요청] 쓰기 연습이 쓸 목록
                updateWritePracticeBtn();
                return;
            }
            emptyState.classList.add('hidden');
            // [냐냐 요청] 지금 보고 있는 목록(필터·검색 반영)을 쓰기 연습에서 그대로 사용
            lastFilteredWords = filteredSorted;
            updateWritePracticeBtn();

            // [냐냐 PATCH-페이지네이션] 검색 중엔 페이지 없이 전체 표시, 아니면 50개씩 잘라 그림
            let pageItems = filteredSorted;
            let totalPages = 1;
            if (!isSearching) {
                totalPages = Math.max(1, Math.ceil(filteredSorted.length / WORDS_PER_PAGE));
                // 필터/정렬로 결과가 줄어서 현재 페이지가 범위를 벗어나면 마지막 페이지로 보정
                if (currentPage > totalPages) currentPage = totalPages;
                if (currentPage < 1) currentPage = 1;
                const start = (currentPage - 1) * WORDS_PER_PAGE;
                pageItems = filteredSorted.slice(start, start + WORDS_PER_PAGE);
            }
            // 검색 중이면 페이지 바 숨김, 아니면 렌더
            renderPagination(isSearching ? 0 : totalPages, filteredSorted.length);

            let html = '';
            pageItems.forEach(w => {
                const isVerb = w.pos === 'verb';
                
                // 품사 뱃지 완벽한 영어 약어 표기로 개편 (F., M., N., V., Adj., Adv., Prep., Conj., Pron., Phr.)
                let badgeMarkup = '';
                if (w.pos === 'noun') {
                    if (w.gender === 'masculine') {
                        badgeMarkup = `<span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-blue-100 text-blue-600 shadow-sm">M.</span>`;
                    } else if (w.gender === 'feminine') {
                        badgeMarkup = `<span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-rose-100 text-rose-600 shadow-sm">F.</span>`;
                    } else {
                        badgeMarkup = `<span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-slate-100 text-slate-600 shadow-sm">N.</span>`;
                    }
                } else if (w.pos === 'verb') {
                    badgeMarkup = `<span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-orange-100 text-orange-600 shadow-sm">V.</span>`;
                } else if (w.pos === 'adjective') {
                    let adjSubLabel = '';
                    if (w.adjAgreement === 'no-gender') adjSubLabel = ' <span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-amber-50 text-amber-600 border border-amber-200 shadow-sm">성 변화 X</span>';
                    else if (w.adjAgreement === 'no-number') adjSubLabel = ' <span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-amber-50 text-amber-600 border border-amber-200 shadow-sm">수 변화 X</span>';
                    else if (w.adjAgreement === 'invariable') adjSubLabel = ' <span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-amber-50 text-amber-600 border border-amber-200 shadow-sm">변화 X</span>';
                    badgeMarkup = `<span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-amber-100 text-amber-700 shadow-sm">Adj.</span>${adjSubLabel}`;
                } else if (w.pos === 'adverb') {
                    badgeMarkup = `<span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-emerald-100 text-emerald-700 shadow-sm">Adv.</span>`;
                } else if (w.pos === 'preposition') {
                    badgeMarkup = `<span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-teal-100 text-teal-700 shadow-sm">Prep.</span>`;
                } else if (w.pos === 'conjunction') {
                    badgeMarkup = `<span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-cyan-100 text-cyan-700 shadow-sm">Conj.</span>`;
                } else if (w.pos === 'pronoun') {
                    badgeMarkup = `<span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-pink-100 text-pink-700 shadow-sm">Pron.</span>`;
                } else if (w.pos === 'interrogative') {
                    badgeMarkup = `<span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-indigo-100 text-indigo-700 shadow-sm">Int.</span>`;
                } else if (w.pos === 'phrase') {
                    badgeMarkup = `<span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-purple-100 text-purple-600 shadow-sm">Phr.</span>`;
                }

                // [냐냐 PATCH] 정답률 배지 — 카드 우측 하단, 점수 배지 왼쪽으로 이동 (시도 3회 이상일 때만)
                const acc = getWordAccuracy(w);
                let accHtml = '';
                if (acc !== null) {
                    const accColor = acc >= 80 ? 'bg-emerald-100 text-emerald-700'
                        : acc >= 50 ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-100 text-rose-600';
                    accHtml = `<span class="px-2 py-0.5 text-[11px] font-black rounded-lg ${accColor}" title="이번 달 정답률 (정답 ${w.correctTotal||0} / 시도 ${(w.correctTotal||0)+(w.wrongTotal||0)})">${acc}%</span>`;
                }

                // [냐냐 PATCH-0배치] 등급 5단계 카드 스타일 (완벽=찐초록 / 마스터=연초록 / 일반 / 약점 / 치명적)
                const grade = getWordGrade(w);
                const cardStyle =
                      grade === 'perfect'  ? 'border-2 border-emerald-500 bg-emerald-50/70 shadow-sm'
                    : grade === 'mastered' ? 'border border-emerald-200 bg-emerald-50/30 shadow-xs'
                    : grade === 'critical' ? 'border-2 border-red-300 bg-red-50/60 shadow-xs'
                    : grade === 'weak'     ? 'border-2 border-amber-300 bg-amber-50/50 shadow-xs'
                    :                        'border border-slate-200 shadow-xs bg-white';
                const gi = GRADE_INFO[grade];

                let verbClassText = '';
                if (isVerb) {
                    if (w.verbClass === 'regular') {
                        verbClassText = '규칙';
                    } else {
                        verbClassText = `불규칙(${w.irregularType || '기타'})`;
                    }
                }

                html += `
                <div class="rounded-3xl p-5 ${cardStyle} flex flex-col justify-between hover:shadow-md transition-all duration-300 relative group gap-3">
                    <!-- [냐냐 PATCH] 우측 하단: [정답률] [점수] -->
                    <div class="absolute bottom-2.5 right-3.5 flex items-center gap-1.5 pointer-events-none select-none">
                        ${accHtml}
                        <span class="px-2 py-0.5 text-[11px] font-black rounded-lg ${gi.badge}" title="${gi.label} · 통합 점수 (${SCORE_MIN} ~ ${SCORE_MAX})">${formatScore(w)}</span>
                    </div>
                    <div class="space-y-2.5">
                        <div class="flex items-start justify-between gap-2">
                            <button onclick="toggleWordCard('${w.id}')" class="flex items-start gap-2 min-w-0 text-left flex-1">
                                <i class="fa-solid fa-chevron-right text-slate-300 text-xs transition-transform shrink-0 mt-2" data-card-chevron="${w.id}"></i>
                                <span class="min-w-0 leading-tight" style="word-break:break-word;">
                                    <span class="text-lg font-extrabold text-slate-900 tracking-tight align-middle">${w.word}</span>
                                    <span class="inline-flex items-center gap-1.5 align-middle ml-1" style="transform: translateY(1px);">${badgeMarkup}</span>
                                    <span class="block text-sm text-slate-500 font-semibold mt-0.5 ${expandedAll ? 'hidden' : ''}" data-card-meaning="${w.id}">${w.meaning}</span>
                                </span>
                            </button>
                            <div class="flex items-center gap-1 shrink-0">
                                <button onclick="speakText(event, '${w.word}')" class="text-slate-400 hover:text-violet-500 transition-colors py-0.5 px-1 shrink-0"><i class="fa-solid fa-volume-high text-sm"></i></button>
                                <button onclick="toggleWeakWord('${w.id}', event)" title="약점 단어 표시 (약점 → 치명적 약점 → 해제)" class="w-7 h-7 rounded-full flex items-center justify-center transition-all ${grade === 'critical' ? 'bg-red-50 border-2 border-red-400 text-red-500 shadow-sm' : (grade === 'weak' ? 'bg-amber-50 border-2 border-amber-400 text-amber-500 shadow-sm' : 'bg-slate-50 hover:bg-slate-100 text-slate-300')}">
                                    <i class="fa-solid fa-star text-xs"></i>
                                </button>
                                <button onclick="toggleMasterWord('${w.id}', event)" title="마스터 표시" class="w-7 h-7 rounded-full flex items-center justify-center transition-all ${grade === 'perfect' ? 'bg-emerald-600 border-2 border-emerald-700 text-white shadow-sm' : (grade === 'mastered' ? 'bg-white border-2 border-emerald-400 text-emerald-500 shadow-sm' : 'bg-slate-50 hover:bg-slate-100 text-slate-300')}">
                                    <i class="fa-solid fa-check text-xs"></i>
                                </button>
                                <button onclick="openWordModal('${w.id}')" class="w-7 h-7 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500 flex items-center justify-center transition-all">
                                    <i class="fa-solid fa-pen text-xs"></i>
                                </button>
                                <button onclick="deleteWord('${w.id}', event)" class="w-7 h-7 rounded-full bg-slate-50 hover:bg-rose-50 hover:text-rose-600 text-slate-400 flex items-center justify-center transition-all">
                                    <i class="fa-solid fa-trash-can text-xs"></i>
                                </button>
                            </div>
                        </div>

                        <!-- 접히는 본문 -->
                        <div class="word-card-body space-y-2 ${expandedAll ? '' : 'hidden'}" data-card-body="${w.id}">${buildCardBody(w)}</div>
                    </div>
                </div>
                `;
            });

            grid.innerHTML = html;
            // 펼침 상태에 따라 chevron 회전 동기화
            if (expandedAll) {
                document.querySelectorAll('[data-card-chevron]').forEach(c => { c.style.transform = 'rotate(90deg)'; });
            }
        }

        // [냐냐 PATCH-페이지네이션] 페이지 바 렌더
        //   [냐냐 요청] 검색창과 같이 고정되는 필터 줄 오른쪽으로 이동 (아래 바는 폐지).
        //   모바일은 ‹ 3/12 › 축소판, sm 이상에서 맨앞/맨뒤 화살표까지 전부 표시.
        function renderPagination(totalPages, totalCount) {
            const bar = document.getElementById('vocab-pagination-sticky');
            if (!bar) return;
            // 예전 위치(그리드 아래)에 남아 있던 바가 있으면 정리
            const legacy = document.getElementById('vocab-pagination');
            if (legacy) legacy.remove();

            if (!totalPages || totalPages <= 1) { bar.innerHTML = ''; bar.classList.add('hidden'); return; }
            bar.classList.remove('hidden');

            const atFirst = currentPage <= 1;
            const atLast = currentPage >= totalPages;
            const ACT = "w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-indigo-600 font-bold text-[11px] transition-all active:scale-90";
            const DIS = "w-7 h-7 flex items-center justify-center rounded-lg text-slate-200 font-bold text-[11px] cursor-not-allowed";
            const btn = (icon, onclick, disabled, title, extraClass) =>
                `<button ${disabled ? 'disabled' : `onclick="${onclick}"`} title="${title}" class="${disabled ? DIS : ACT} ${extraClass || ''}"><i class="fa-solid ${icon}"></i></button>`;

            bar.innerHTML = `
                <div class="flex items-center gap-0.5">
                    ${btn('fa-angles-left', 'gotoPage(1)', atFirst, '맨 앞', 'hidden sm:flex')}
                    ${btn('fa-angle-left', `gotoPage(${currentPage - 1})`, atFirst, '이전')}
                    <div class="flex items-center gap-1 px-1">
                        <input id="page-jump-input" type="number" min="1" max="${totalPages}" value="${currentPage}"
                            onkeydown="if(event.key==='Enter'){event.preventDefault();jumpToPage();}"
                            onblur="jumpToPage()"
                            title="총 ${totalCount}개 단어"
                            class="w-9 h-6 text-center text-xs font-bold text-indigo-600 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none">
                        <span class="text-[11px] font-bold text-slate-400 whitespace-nowrap">/ ${totalPages}</span>
                    </div>
                    ${btn('fa-angle-right', `gotoPage(${currentPage + 1})`, atLast, '다음')}
                    ${btn('fa-angles-right', `gotoPage(${totalPages})`, atLast, '맨 뒤', 'hidden sm:flex')}
                </div>`;
        }

        // [냐냐 요청] 단어 목록 새로고침 — 약점·점수 변동이 목록에 바로 반영되도록
        function refreshWordList() {
            const icon = document.getElementById('vocab-refresh-icon');
            if (icon) {
                icon.classList.add('fa-spin');
                setTimeout(() => icon.classList.remove('fa-spin'), 600);
            }
            if (typeof renderWordList === 'function') renderWordList();
            if (typeof updateStats === 'function') updateStats();
            if (typeof showToast === 'function') showToast("단어 목록을 새로고침했어요! 🔄", "info");
        }

        // [냐냐 요청] 페이지 직접 입력 → 엔터/포커스아웃 시 이동
        function jumpToPage() {
            const inp = document.getElementById('page-jump-input');
            if (!inp) return;
            let n = parseInt(inp.value, 10);
            const max = parseInt(inp.getAttribute('max'), 10) || 1;
            if (isNaN(n)) { inp.value = currentPage; return; } // 잘못 입력하면 원래대로
            if (n < 1) n = 1;
            if (n > max) n = max;
            if (n === currentPage) { inp.value = currentPage; return; } // 그대로면 무시
            gotoPage(n);
        }

        // [냐냐 PATCH-페이지네이션] 페이지 이동 + 목록 맨 위로 스크롤
        function gotoPage(page) {
            if (page < 1) page = 1;
            currentPage = page;
            renderWordList();
            // 목록 맨 위로 스크롤 (검색바 sticky 아래로 자연스럽게)
            const grid = document.getElementById('vocabulary-grid');
            if (grid) {
                const top = grid.getBoundingClientRect().top + window.scrollY - 120;
                window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
            }
        }

        // [냐냐 PATCH] 전체 접기/펼치기 버튼 토글
        function toggleExpandAllBtn() {
            const btn = document.getElementById('expand-all-btn');
            const willExpand = !wordListExpandedAll;
            setAllWordCards(willExpand);
            if (btn) {
                // [냐냐 PATCH-6배치] 아이콘만 남겨서 span이 없음 → 툴팁(title)과 아이콘만 바꿔줌
                btn.title = willExpand ? '전체 접기' : '전체 펼치기';
                const icon = btn.querySelector('i');
                if (icon) icon.className = willExpand ? 'fa-solid fa-down-left-and-up-right-to-center' : 'fa-solid fa-up-right-and-down-left-from-center';
            }
        }

        // [냐냐 PATCH] 단어 카드 하나 접기/펼치기
        // [냐냐 PATCH] 어떤 카드가 펼쳐져 있는지 기억 (설정 바꿔서 다시 그려도 유지)
        const expandedCardIds = new Set();

        // [냐냐 PATCH-성능] 카드 본문 HTML을 따로 생성 — 접힌 카드는 본문을 아예 안 만들고,
        //   펼칠 때(toggleWordCard) 그때 채운다 → 750개 카드도 처음엔 헤더만 그려서 훨씬 가벼움
        function buildCardBody(w) {
            const isVerb = w.pos === 'verb';
            return `
                        <!-- Meaning section -->
                        <div class="space-y-1">
                            <p class="text-sm font-bold text-slate-500 flex items-center gap-1.5">
                                <span class="w-1.5 h-1.5 bg-violet-500 rounded-full"></span>
                                <span>뜻:</span>
                                <strong class="text-slate-800 font-bold">${w.meaning}</strong>
                            </p>
                        </div>

                        <!-- [냐냐 PATCH-6배치] 동사 변형표 — 설정에서 체크된 시제만, 등록된 시제 전부 -->
                        ${(isVerb && isDisplayOn('conj')) ? buildCardConjHtml(w) : ''}

                        <!-- 관용구 먼저, 예문 나중 (순서 변경) -->
                        ${(() => {
                            if (!isDisplayOn('idioms')) return '';
                            const idiomList = (w.idioms && w.idioms.length > 0) ? w.idioms : (w.idiom ? [{ idiom: w.idiom, idiomMeaning: w.idiomMeaning || '' }] : []);
                            if (idiomList.length === 0) return '';
                            const rows = idiomList.map((item, idx) => `
                                <div class="${idx > 0 ? 'mt-2 pt-2 border-t border-slate-200/70' : ''}">
                                    <p class="font-bold text-slate-800 select-all">${item.idiom}</p>
                                    <p class="text-slate-400 italic">${item.idiomMeaning || ''}</p>
                                </div>
                            `).join('');
                            return `
                        <div class="bg-slate-50 border-l-2 border-violet-500 rounded-r-xl p-2.5 text-xs">
                            <span class="block text-[8px] font-black text-violet-500 uppercase mb-1">Expresión (관용구)</span>
                            ${rows}
                        </div>
                            `;
                        })()}
                        ${(w.example && isDisplayOn('example')) ? `
                        <div class="bg-teal-50/40 border-l-2 border-teal-400 rounded-r-xl p-2.5 text-xs">
                            <span class="block text-[8px] font-black text-teal-600 uppercase">Ejemplo (예문)</span>
                            <p class="font-bold text-slate-800 mt-0.5 select-all">${w.example}</p>
                            <p class="text-slate-400 italic">${w.exampleMeaning || ''}</p>
                        </div>
                        ` : ''}

                        <!-- 핵심만 정리된 노트 -->
                        ${(w.notes && isDisplayOn('notes')) ? `<div class="bg-amber-50/60 p-2.5 rounded-2xl text-[13px] text-amber-900 leading-snug whitespace-pre-wrap font-medium"><span class="font-bold text-amber-700 block text-[10px] uppercase tracking-wider mb-1.5"><i class="fa-solid fa-thumbtack text-[9px]"></i> NOTE</span>${w.notes}</div>` : ''}
                        ${isDisplayOn('synonyms') ? buildSynonymChipsHtml(w) : ''}
                        `;
        }

        function toggleWordCard(id) {
            const body = document.querySelector(`[data-card-body="${id}"]`);
            const chevron = document.querySelector(`[data-card-chevron="${id}"]`);
            const meaning = document.querySelector(`[data-card-meaning="${id}"]`);
            if (!body) return;
            const nowHidden = body.classList.toggle('hidden');
            if (nowHidden) expandedCardIds.delete(id); else expandedCardIds.add(id);
            if (chevron) chevron.style.transform = nowHidden ? 'rotate(0deg)' : 'rotate(90deg)';
            if (meaning) meaning.classList.toggle('hidden', !nowHidden);
        }

        // 다시 그린 뒤 펼쳐져 있던 카드를 복원
        function restoreExpandedCards() {
            expandedCardIds.forEach(id => {
                const body = document.querySelector(`[data-card-body="${id}"]`);
                const chevron = document.querySelector(`[data-card-chevron="${id}"]`);
                const meaning = document.querySelector(`[data-card-meaning="${id}"]`);
                if (!body) return;
                body.classList.remove('hidden');
                if (chevron) chevron.style.transform = 'rotate(90deg)';
                if (meaning) meaning.classList.add('hidden');
            });
        }

        // [냐냐 PATCH] 전체 접기/펼치기
        function setAllWordCards(expand) {
            wordListExpandedAll = expand;
            // [냐냐 PATCH] 개별 펼침 기억도 같이 갱신
            expandedCardIds.clear();
            if (expand) document.querySelectorAll('[data-card-body]').forEach(b => expandedCardIds.add(b.getAttribute('data-card-body')));
            document.querySelectorAll('[data-card-body]').forEach(b => b.classList.toggle('hidden', !expand));
            document.querySelectorAll('[data-card-chevron]').forEach(c => { c.style.transform = expand ? 'rotate(90deg)' : 'rotate(0deg)'; });
            document.querySelectorAll('[data-card-meaning]').forEach(m => m.classList.toggle('hidden', expand)); // 펼치면 헤더 뜻 숨김
        }
