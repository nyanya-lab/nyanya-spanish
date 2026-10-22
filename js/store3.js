// ============================================================
// [냐냐 결정] 저장을 욱진보드처럼 — 항목마다 자기 자리 (2026-10-15, 'v3')
//   왜: 예전엔 저장할 때마다 전부(1.7MB, 그중 단어장 72%)를 통째로 올렸다. 복습 30문제면 50MB.
//   욱진보드처럼 데이터를 고치는 곳마다 **그 항목 자리에만** 쓴다 — 단어 하나 · 일지 하루 · 곡선 한 칸.
//
//   자리 (<주소>/vocab/<비밀번호>__v3/…, 로컬 시험은 __v3dev):
//     words/<단어id> · meta/wordOrder(단어장 차례)
//     notes/<첨삭 시각> · meta/noteOrder        (첨삭 노트)
//     tables/<노트id> · meta/tableOrder         (문법 노트)
//     questions/<질문id> · meta/questionOrder
//     diary/<날짜>
//     map/<이름>/<키>     — idiomScores · idiomReview · grammarScores · grammarReview … (항목마다 한 칸)
//     misc/<이름>         — 설정·보물상자처럼 작은 덩어리
//
//   단계 (냐냐님과 정함):
//     1단계 — 앱은 아직 옛 통째 저장을 읽는다. 고치는 곳마다 여기에도 **같이** 쓴다 (S3.word(w) 같은 한 줄).
//     2단계 — 초반에만 크로스체크: 여기 것을 모아 만든 것과 통째 것을 견줘 다른 항목을 적는다 = 빠뜨린 곳.
//     3단계 — 여기를 읽고 쓰고 실시간. 옛 통째 저장은 잠깐 백업만.
//
//   ⚠️ 왓치로그에서 배운 것: 서버가 돌려준 값을 글자 그대로 비교하지 말 것 —
//      서버는 null·빈 배열·빈 객체를 지우고 키를 정렬해 돌려준다. 비교는 늘 s3Canon 으로.
//   ⚠️ 로컬 시험(dev-local.js)에서는 NYANYA_DEV_S3(또는 NYANYA_DEV_ALLOW_WRITE)를 켜야 보낸다.
//      켜더라도 '__v3dev' 라는 딴 자리에 쓴다 — 진짜 v3 를 시험으로 더럽히지 않게.
// ============================================================
const S3 = (() => {
    const MAP_KEYS = ['idiomScores', 'idiomReview', 'grammarScores', 'grammarReview', 'grammarTransUsed', 'grammarDayGain',
                      'masteredGrammar', 'grammarDeleLevels', 'grammarCellWords', 'grammarCellHighlights', 'grammarCellMarks', 'pinnedGrammar'];
    const LIST_KEYS = { vocabulary: ['words', 'wordOrder', x => x.id],
                        aiNotes: ['notes', 'noteOrder', x => noteKey(x.t)],
                        customGrammarTables: ['tables', 'tableOrder', x => x.id],
                        customQuestions: ['questions', 'questionOrder', x => x.id] };
    const SKIP_KEYS = new Set(['savedRev']);
    //   map 칸들은 core.js 의 let 변수라 window 에 없다 — 이름으로 찾는 표
    const MAP_GET = {
        idiomScores: () => (typeof idiomScores !== 'undefined' ? idiomScores : null),
        idiomReview: () => (typeof idiomReview !== 'undefined' ? idiomReview : null),
        grammarScores: () => (typeof grammarScores !== 'undefined' ? grammarScores : null),
        grammarReview: () => (typeof grammarReview !== 'undefined' ? grammarReview : null),
        grammarTransUsed: () => (typeof grammarTransUsed !== 'undefined' ? grammarTransUsed : null),
        grammarDayGain: () => (typeof grammarDayGain !== 'undefined' ? grammarDayGain : null),
        masteredGrammar: () => (typeof masteredGrammar !== 'undefined' ? masteredGrammar : null),
        grammarDeleLevels: () => (typeof grammarDeleLevels !== 'undefined' ? grammarDeleLevels : null),
        grammarCellWords: () => (typeof grammarCellWords !== 'undefined' ? grammarCellWords : null),
        grammarCellHighlights: () => (typeof grammarCellHighlights !== 'undefined' ? grammarCellHighlights : null),
        grammarCellMarks: () => (typeof grammarCellMarks !== 'undefined' ? grammarCellMarks : null),
        pinnedGrammar: () => (typeof pinnedGrammar !== 'undefined' ? pinnedGrammar : null)
    };
    const isDev = () => typeof window.NYANYA_DEV_ALLOW_WRITE !== 'undefined';
    //   로컬 시험: 통째 저장 차단(NYANYA_DEV_ALLOW_WRITE)과 따로 켠다 — 콘솔에서 window.NYANYA_DEV_S3 = true. 그래도 __v3dev 자리다
    const devOn = () => !!(window.NYANYA_DEV_S3 || window.NYANYA_DEV_ALLOW_WRITE);
    //   첨삭 시각(ISO)은 '.' 가 있어 서버 자리 이름이 못 된다
    function noteKey(t) { return String(t || '').replace(/[.#$\[\]\/]/g, '_'); }

    function rootUrl() {
        const pw = (typeof getSyncPassword === 'function') ? getSyncPassword() : '';
        const url = (typeof getFirebaseDbUrl === 'function') ? getFirebaseDbUrl() : '';
        if (!pw || !url) return null;
        //   ⚠️ 서버 보안 규칙이 vocab/<비밀번호…> 만 열어 둬서 새 갈래(vocab3/…)는 401 이었다 (10/15 확인).
        //      그래서 같은 vocab 아래 옆자리 <비밀번호>__v3 에 둔다 (왓치로그 백업이 <비밀번호>_bak_… 인 것과 같은 꼴).
        //      통째 저장 자리(<비밀번호>) 안에 두면 통째 PUT 이 덮어 지우니 안 된다.
        return `${String(url).replace(/\/$/, '')}/vocab/${encodeURIComponent(pw)}${isDev() ? '__v3dev' : '__v3'}`;
    }
    const clone = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
    //   SDK 쪽 자리 이름 (주소가 아니라 갈래 경로)
    function rootPath() {
        const pw = (typeof getSyncPassword === 'function') ? getSyncPassword() : '';
        return pw ? `vocab/${pw}${isDev() ? '__v3dev' : '__v3'}` : null;
    }

    // ============================================================
    // [냐냐 결정] 욱진보드처럼 Firebase SDK 로 (2026-10-16) — "왜 3단계에서 바꿔?" 지금 바꾼다.
    //   SDK 가 끊김 감지·다시 잇기·끊긴 동안 쓰기 모아 두기·칸 단위 실시간을 해 준다.
    //   왓치로그 사고는 다 이걸 직접 짠 코드(시각 비교·합치기)에서 났다.
    //   크로스체크 며칠이 SDK 로 쓴 결과까지 같이 검증해 준다.
    //   SDK 를 못 불러오면(망·CDN 문제) 예전처럼 REST PATCH 로 보낸다.
    //   버전은 욱진보드와 같게.
    // ============================================================
    const FB_VER = '10.12.2';
    let sdkPromise = null, sdkFailedAt = 0;
    function loadSdk() {
        if (sdkPromise) return sdkPromise;
        if (Date.now() - sdkFailedAt < 60000) return Promise.resolve(null);
        const url = (typeof getFirebaseDbUrl === 'function') ? getFirebaseDbUrl() : '';
        if (!url) return Promise.resolve(null);
        const base = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
        sdkPromise = Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-database.js')])
            .then(([appMod, rt]) => {
                const name = 'nyanya-v3';
                const app = (appMod.getApps().find(a => a.name === name)) || appMod.initializeApp({ databaseURL: url }, name);
                const db = rt.getDatabase(app);
                rt.onValue(rt.ref(db, '.info/connected'), (snap) => { api.connected = snap.val() === true; });
                return { rt, db };
            })
            .catch(e => { console.warn('[v3] SDK 못 불러옴 — REST 로 보낸다', e); sdkPromise = null; sdkFailedAt = Date.now(); return null; });
        return sdkPromise;
    }
    //   한 번에 여러 자리 — SDK update (끊겨 있으면 SDK 가 모아 뒀다가 붙으면 보낸다)
    async function writeMany(body, leaving) {
        const sdk = await loadSdk();
        const path = rootPath();
        if (sdk && path) {
            //   ⚠️ 끊긴 동안 SDK 는 promise 를 안 끝내고 들고 있다 — 기다리지 않는다 (줄은 SDK 가 지킨다)
            const p = sdk.rt.update(sdk.rt.ref(sdk.db, path), body);
            if (api.connected === false) { p.catch(e => console.warn('[v3] 쓰기 실패', e)); return; }
            await p;
            return;
        }
        const root = rootUrl();
        const json = JSON.stringify(body);
        const res = await fetch(root + '.json', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: json,
                                                    keepalive: !!leaving && json.length < 60000 });
        if (!res.ok) throw new Error('HTTP ' + res.status);
    }
    async function readPath(sub) {
        const sdk = await loadSdk();
        const path = rootPath();
        if (sdk && path) {
            const snap = await sdk.rt.get(sdk.rt.ref(sdk.db, sub ? `${path}/${sub}` : path));
            return snap.exists() ? snap.val() : null;
        }
        const r = await fetch(rootUrl() + (sub ? '/' + sub : '') + '.json', { cache: 'no-store' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
    }
    async function writeAll(tree) {
        const sdk = await loadSdk();
        const path = rootPath();
        if (sdk && path) return sdk.rt.set(sdk.rt.ref(sdk.db, path), tree);
        const res = await fetch(rootUrl() + '.json', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tree) });
        if (!res.ok) throw new Error('HTTP ' + res.status);
    }

    // ── 보낼 것 모으기 — 같은 자리는 마지막 값만. 0.4초 뒤 한 번에 PATCH ──
    const queue = new Map();
    let timer = null;
    function put(path, value) {
        queue.set(path, value);
        if (timer) clearTimeout(timer);
        timer = setTimeout(flush, 400);
    }
    //   [냐냐 결정] 주 저장소가 된 뒤(3단계, 2026-10-17): 보낼 때마다 저장 번호(meta/rev)를 같이 적고,
    //   보내기 직전에 서버 번호만 읽어서 이 창이 아는 번호와 다르면 = 다른 곳이 그 사이 저장한 것 → 보내지 않고 묻는다.
    //   (예전 통째 저장의 savedRev 와 같은 장치 — 옛 데이터를 든 창이 새 공부를 덮지 않게.) 번호를 못 읽으면 그냥 보낸다.
    //   보내기는 한 줄로 세운다 — 둘이 겹치면 서버 번호와 내 번호가 엇갈려 헛 경고가 뜬다.
    const newRev = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    let chain = Promise.resolve();
    function flush(leaving) {
        if (timer) { clearTimeout(timer); timer = null; }
        const p = chain.then(() => flushNow(leaving));
        chain = p.catch(() => {});
        return p;
    }
    async function flushNow(leaving) {
        if (!queue.size) return;
        const root = rootUrl();
        if (!root) { queue.clear(); return; }
        if (isDev() && !devOn()) { queue.clear(); return; }
        //   값은 보내는 순간의 것을 읽는다 (자리만 적어 두고 값은 함수로 받은 것도 있다)
        const body = {};
        queue.forEach((v, p) => { body[p] = (typeof v === 'function') ? clone(v()) : clone(v); });
        queue.clear();
        const requeue = () => Object.keys(body).forEach(p => { if (p !== 'meta/rev' && !queue.has(p)) queue.set(p, body[p]); });
        if (api.primary && !api.force) {
            let srv;
            try {
                const r = await fetch(root + '/meta/rev.json', { cache: 'no-store' });
                if (r.ok) srv = await r.json();
            } catch (e) { srv = undefined; }
            if (srv && srv !== api.knownRev) {
                requeue();
                console.warn('[v3 보류] 서버 번호', srv, '≠ 이 창', api.knownRev);
                if (typeof api.onConflict === 'function') api.onConflict();
                return;
            }
        }
        const rev = api.primary ? newRev() : null;
        if (rev) { body['meta/rev'] = rev; api.sendingRev = rev; }
        const json = JSON.stringify(body);
        try {
            await writeMany(body, leaving);
            if (rev) api.knownRev = rev;
            S3.sentBytes += json.length; S3.sentCount++;
        } catch (e) {
            //   못 보낸 것은 다시 줄에 — 다음 쓰기 때 같이 간다 (그 사이 새 값이 들어왔으면 새 값이 이긴다)
            requeue();
            console.warn('[v3] 보내기 실패, 다음에 다시', e);
        } finally {
            if (rev) api.sendingRev = null;
        }
    }
    window.addEventListener('pagehide', () => { try { flush(true); } catch (e) {} });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { try { flush(true); } catch (e) {} } });

    // ── 고치는 곳에서 부르는 한 줄들 (욱진보드의 backend.update / set 자리) ──
    const findWord = (wOrId) => (wOrId && typeof wOrId === 'object') ? wOrId
        : (typeof vocabulary !== 'undefined' ? vocabulary.find(v => String(v.id) === String(wOrId)) : null);
    const api = {
        sentBytes: 0, sentCount: 0,
        primary: false,      // 불러올 때 v3 에서 읽었으면 core 가 켠다
        knownRev: null,      // 이 창이 마지막으로 서버와 맞춘 meta/rev
        sendingRev: null,
        force: false,        // '이 창 것으로 덮어쓰기'
        onConflict: null,
        flush,
        //   단어 하나 — 값은 보낼 때 읽는다 (같은 틱에 여러 번 고쳐도 한 번)
        word(wOrId) {
            const w = findWord(wOrId);
            if (!w || !w.id) return;
            const id = w.id;
            put('words/' + id, () => (typeof vocabulary !== 'undefined' ? vocabulary.find(v => v.id === id) : null) || null);
        },
        //   관용구 객체만 들고 있을 때 — 그 관용구를 가진 단어를 찾아 쓴다
        wordOfIdiom(it) {
            if (!it || typeof vocabulary === 'undefined') return;
            const w = vocabulary.find(v => Array.isArray(v.idioms) && v.idioms.indexOf(it) >= 0);
            if (w) api.word(w);
        },
        wordGone(id) { if (id) put('words/' + id, null); api.wordOrder(); },
        wordOrder() { put('meta/wordOrder', () => (typeof vocabulary !== 'undefined' ? vocabulary.map(v => v.id) : [])); },
        diary(date) {
            const ds = date || (typeof getLocalDateString === 'function' ? getLocalDateString() : '');
            if (!ds) return;
            put('diary/' + ds, () => (typeof nyanyaDiary !== 'undefined' ? nyanyaDiary[ds] : null) || null);
        },
        //   map/<이름>/<키> — 그 칸 하나 (지웠으면 null 로 간다)
        mapItem(name, key) {
            if (!name || key == null || !MAP_GET[name]) return;
            put(`map/${name}/${key}`, () => { const m = MAP_GET[name](); return m ? (m[key] === undefined ? null : m[key]) : null; });
        },
        idiom(key) { ['idiomScores', 'idiomReview'].forEach(n => api.mapItem(n, key)); },
        grammar(id) { ['grammarScores', 'grammarReview', 'grammarTransUsed', 'grammarDayGain', 'masteredGrammar'].forEach(n => api.mapItem(n, id)); },
        note(t) {
            const k = noteKey(t);
            put('notes/' + k, () => (typeof aiNotes !== 'undefined' ? aiNotes.find(n => n && noteKey(n.t) === k) : null) || null);
            put('meta/noteOrder', () => (typeof aiNotes !== 'undefined' ? aiNotes.map(n => noteKey(n.t)) : []));
        },
        table(id) {
            put('tables/' + id, () => (typeof customGrammarTables !== 'undefined' ? customGrammarTables.find(t => t.id === id) : null) || null);
            put('meta/tableOrder', () => (typeof customGrammarTables !== 'undefined' ? customGrammarTables.map(t => t.id) : []));
        },
        question(id) {
            put('questions/' + id, () => (typeof customQuestions !== 'undefined' ? customQuestions.find(q => q.id === id) : null) || null);
            put('meta/questionOrder', () => (typeof customQuestions !== 'undefined' ? customQuestions.map(q => q.id) : []));
        },
        //   작은 덩어리 하나 (eggState · learnerProfile · 설정들) — 이름은 buildDataPayload 의 칸 이름
        misc(name) {
            put('misc/' + name, () => { const p = (typeof buildDataPayload === 'function') ? buildDataPayload() : {}; return p[name] === undefined ? null : p[name]; });
        }
    };

    // ── 통째 payload ↔ 자리들 (첫 채우기 · 크로스체크 · 3단계 읽기에 같이 쓴다) ──
    function payloadToTree(p) {
        const tree = { words: {}, notes: {}, tables: {}, questions: {}, diary: {}, map: {}, misc: {}, meta: {} };
        Object.keys(p || {}).forEach(k => {
            if (SKIP_KEYS.has(k)) return;
            const v = p[k];
            if (LIST_KEYS[k]) {
                const [coll, order, keyOf] = LIST_KEYS[k];
                const arr = Array.isArray(v) ? v : [];
                arr.forEach(x => { if (x) tree[coll][keyOf(x)] = x; });
                tree.meta[order] = arr.filter(Boolean).map(keyOf);
            } else if (k === 'nyanyaDiary') {
                Object.keys(v || {}).forEach(ds => { tree.diary[ds] = v[ds]; });
            } else if (MAP_KEYS.includes(k)) {
                tree.map[k] = v || {};
            } else if (v !== undefined) {
                tree.misc[k] = v;
            }
        });
        return tree;
    }
    function treeToPayload(t) {
        t = t || {};
        const p = {};
        const meta = t.meta || {};
        Object.keys(LIST_KEYS).forEach(k => {
            const [coll, order] = LIST_KEYS[k];
            const items = t[coll] || {};
            const ord = Array.isArray(meta[order]) ? meta[order] : Object.keys(items);
            const seen = new Set();
            p[k] = ord.map(key => { seen.add(key); return items[key]; }).filter(Boolean)
                .concat(Object.keys(items).filter(key => !seen.has(key)).map(key => items[key]));   // 차례에 없는 것은 뒤에
        });
        p.nyanyaDiary = t.diary || {};
        MAP_KEYS.forEach(k => { p[k] = (t.map || {})[k] || {}; });
        Object.keys(t.misc || {}).forEach(k => { p[k] = t.misc[k]; });
        return p;
    }
    //   서버가 하는 대로 맞춘 비교용 모양 — null·빈 배열·빈 객체를 지우고 키를 정렬
    function s3Canon(v) {
        if (v === null || v === undefined) return undefined;
        if (Array.isArray(v)) {
            const a = v.map(s3Canon);
            //   서버는 배열 속 null 을 지우면 객체 {0:…,2:…} 로 돌려준다 — 칸 수만 맞추면 비교엔 충분하다
            const kept = a.filter(x => x !== undefined);
            return kept.length ? a.map(x => x === undefined ? null : x) : undefined;
        }
        if (typeof v === 'object') {
            const o = {};
            Object.keys(v).sort().forEach(k => { const c = s3Canon(v[k]); if (c !== undefined) o[k] = c; });
            return Object.keys(o).length ? o : undefined;
        }
        return v;
    }
    // ── 처음 한 번 채우기 · 크로스체크 (1·2단계) ──
    //   앱이 다 켜지고(불러온 뒤 돌던 정리들까지 끝나고) 조금 뒤에 부른다.
    //   ① 새 자리가 비어 있으면 지금 것을 통째로 한 번 채운다 (seededAt).
    //   ② 채워져 있으면 크로스체크 — 새 자리를 모아 만든 것과 지금(통째 저장에서 읽은) 것을 항목마다 견준다.
    //      다른 항목 = 고치는 곳에서 S3 한 줄을 빠뜨린 곳. 적어 두고(이 기기 + 서버 meta/checks) 그 항목은 고쳐 쓴다.
    //      ⚠️ 옛 버전이 켜진 기기에서 한 공부는 새 자리에 안 들어가니 차이로 잡힌다 — 그건 빠뜨린 곳이 아니다.
    //   기기마다 20분에 한 번만 (새 자리 전체를 받아오니 2MB).
    const CHECK_EVERY_MS = 20 * 60 * 1000;
    async function afterBoot() {
        const root = rootUrl();
        if (!root || (isDev() && !devOn())) return;
        await flush();
        if (api.primary) return dailyBackup();   // 주 저장소가 된 뒤엔 견주기를 불러올 때 백업과 한다 (backupCheck)
        try {
            const seeded = await readPath('meta/seededAt');   // 못 읽으면 던진다 — 채우지도 견주지도 않는다
            if (!seeded) return await seedAll();
            let last = 0;
            try { last = Number(localStorage.getItem('nyanya_v3_checkAt')) || 0; } catch (e) {}
            if (Date.now() - last < CHECK_EVERY_MS) return;
            try { localStorage.setItem('nyanya_v3_checkAt', String(Date.now())); } catch (e) {}
            await crossCheck();
        } catch (e) { console.warn('[v3] 켜진 뒤 확인 실패', e); }
    }
    async function seedAll() {
        const tree = clone(payloadToTree(buildDataPayload()));
        tree.meta.seededAt = Date.now();
        await writeAll(tree);
        console.info('[v3] 처음 채우기 끝');
    }
    //   항목 단위로 견준다 → [{ where: 'words/<id>' 같은 자리, label, fields: [다른 칸] }]
    function diffPayloads(local, remote) {
        const out = [];
        const lt = payloadToTree(local), rt = payloadToTree(remote);
        const cmpItem = (path, a, b, label) => {
            const ca = s3Canon(a), cb = s3Canon(b);
            if (JSON.stringify(ca) === JSON.stringify(cb)) return;
            const fields = [];
            if (ca && cb && typeof ca === 'object' && typeof cb === 'object' && !Array.isArray(ca)) {
                new Set(Object.keys(ca).concat(Object.keys(cb))).forEach(f => {
                    if (JSON.stringify(ca[f]) !== JSON.stringify(cb[f])) fields.push(f);
                });
            }
            out.push({ where: path, label: label || '', fields: fields.slice(0, 8), missing: cb === undefined ? 'remote' : (ca === undefined ? 'local' : '') });
        };
        ['words', 'notes', 'tables', 'questions', 'diary'].forEach(coll => {
            const a = lt[coll] || {}, b = rt[coll] || {};
            new Set(Object.keys(a).concat(Object.keys(b))).forEach(k => {
                const x = a[k] || b[k] || {};
                cmpItem(`${coll}/${k}`, a[k], b[k], x.word || x.title || x.question || x.mine || '');
            });
        });
        Object.keys(lt.meta).forEach(k => cmpItem('meta/' + k, lt.meta[k], rt.meta[k]));
        MAP_KEYS.forEach(n => {
            const a = lt.map[n] || {}, b = rt.map[n] || {};
            new Set(Object.keys(a).concat(Object.keys(b))).forEach(k => cmpItem(`map/${n}/${k}`, a[k], b[k]));
        });
        new Set(Object.keys(lt.misc).concat(Object.keys(rt.misc))).forEach(k => cmpItem('misc/' + k, lt.misc[k], rt.misc[k]));
        return out;
    }
    async function crossCheck() {
        const tree = await readPath('');
        const remote = treeToPayload(tree || {});
        const local = buildDataPayload();
        const diffs = diffPayloads(local, remote);
        const report = { t: Date.now(), n: diffs.length, items: diffs.slice(0, 60) };
        try { localStorage.setItem('nyanya_v3_check', JSON.stringify(report)); } catch (e) {}
        api.lastCheck = report;
        if (diffs.length) {
            console.warn(`[v3 크로스체크] 다른 항목 ${diffs.length}개`, diffs.slice(0, 20));
            //   서버에도 적어 둔다 — Claude 가 서버를 읽어 빠뜨린 곳을 찾는다
            put('meta/checks/' + report.t, { n: report.n, items: report.items.map(d => `${d.where}${d.label ? ' «' + String(d.label).slice(0, 30) + '»' : ''}${d.fields.length ? ' [' + d.fields.join(',') + ']' : ''}${d.missing ? ' (' + d.missing + '에 없음)' : ''}`) });
            //   고쳐 쓴다 — 지금(통째 저장 쪽)이 맞다
            const lt = payloadToTree(local);
            diffs.forEach(d => {
                const parts = d.where.split('/');
                let v = lt;
                for (const p of parts) v = (v == null) ? undefined : v[p];
                put(d.where, v === undefined ? null : clone(v));
            });
            await flush();
        } else {
            console.info('[v3 크로스체크] 다른 항목 없음 ✨');
            put('meta/lastCleanCheck', report.t);
        }
        return report;
    }
    // ── 3단계: 매일 한 번, 백업(통째)과 v3 를 견준다 (2026-10-17 냐냐님 "크로스체크를 매일 하자") ──
    //   불러올 때 둘을 같이 받아서, 이 창이 백업을 새로 덮기 **전의** 백업으로 견준다.
    //   백업에만 있는 것 = 어디선가 S3 한 줄을 빠뜨린 곳 (백업은 저장할 때마다 통째로 올라가니 다 들어 있다).
    //   어느 쪽이 맞는지 여기선 알 수 없어서 고치지 않고 적기만 한다 — Claude 가 meta/checks 를 읽고 고친다.
    //   ⚠️ 마지막 백업이 창을 닫느라 못 올라갔으면 v3 가 더 새것이라 차이로 보일 수 있다 (그건 빠뜨린 곳이 아님).
    function backupCheck(oldPayload, tree) {
        try {
            const old = Object.assign({}, oldPayload); delete old.savedRev;
            const cur = treeToPayload(tree || {});
            //   [냐냐 요청] 문법 보기 설정은 '바꾼 시각(at)' 이 있으니 더 나중 것으로 저절로 맞춘다 (2026-10-22).
            //   화면 모습뿐이라 매일 기록에 떠서 진짜 차이를 가렸다. 백업이 더 새것이면 v3 에 옮기고 견주기에서는 같은 것으로 본다.
            const autoFixed = [];
            const op = old.grammarPrefs, cp = cur.grammarPrefs;
            if (op && JSON.stringify(s3Canon(op)) !== JSON.stringify(s3Canon(cp))) {
                if ((op.at || 0) > ((cp && cp.at) || 0)) { put('misc/grammarPrefs', clone(op)); autoFixed.push('misc/grammarPrefs'); }
                cur.grammarPrefs = op;   // v3 가 더 새것이면 백업이 다음 저장 때 따라온다 — 어느 쪽이든 차이로 적지 않는다
            }
            const diffs = diffPayloads(old, cur);
            const t = Date.now();
            const report = { t, n: diffs.length, items: diffs.slice(0, 60), autoFixed };
            try { localStorage.setItem('nyanya_v3_check', JSON.stringify(report)); } catch (e) {}
            api.lastCheck = report;
            if (diffs.length) {
                console.warn(`[v3 백업 견주기] 다른 항목 ${diffs.length}개`, diffs.slice(0, 20));
                put('meta/checks/' + t, { kind: 'backup', n: report.n, autoFixed, items: report.items.map(d => `${d.where}${d.label ? ' «' + String(d.label).slice(0, 30) + '»' : ''}${d.fields.length ? ' [' + d.fields.join(',') + ']' : ''}${d.missing ? ' (' + (d.missing === 'remote' ? 'v3' : '백업') + '에 없음)' : ''}`) });
            } else {
                console.info('[v3 백업 견주기] 다른 항목 없음 ✨' + (autoFixed.length ? ` (저절로 맞춤: ${autoFixed.join(', ')})` : ''));
                put('meta/lastCleanCheck', t);
                if (autoFixed.length) put('meta/autoFixed/' + t, autoFixed);
            }
        } catch (e) { console.warn('[v3] 백업 견주기 실패', e); }
    }
    //   백업 파일 가져오기처럼 통째로 바꿀 때 — v3 도 통째로 다시 채운다 (seededAt 은 남긴다)
    async function replaceAll() {
        const root = rootUrl();
        if (!root || (isDev() && !devOn())) return;
        await flush();
        const tree = clone(payloadToTree(buildDataPayload()));
        tree.meta.seededAt = Date.now();
        tree.meta.rev = newRev();
        await writeAll(tree);
        api.knownRev = tree.meta.rev;
        console.info('[v3] 통째로 다시 채움');
    }
    // ── 날짜별 백업 (2026-10-19 냐냐님 "혹시 모르니까 하루씩 자동 백업") ──
    //   그날 처음 켠 기기가 v3 전체를 <주소>/vocab/<비밀번호>_bak_YYYYMMDD 에 통째로 복사한다 (약 2MB).
    //   최근 7일 치만 남긴다 — 무엇을 만들었는지 meta/backups 에 적어 두고 그보다 오래된 것을 지운다.
    //   두 기기가 같은 아침에 겹쳐 켜면 둘 다 복사할 수 있다 — 같은 자리라 해가 없다.
    const BACKUP_KEEP_DAYS = 7;
    async function dailyBackup() {
        try {
            const pw = (typeof getSyncPassword === 'function') ? getSyncPassword() : '';
            const url = (typeof getFirebaseDbUrl === 'function') ? getFirebaseDbUrl() : '';
            if (!pw || !url || isDev()) return;
            const day = (typeof getLocalDateString === 'function' ? getLocalDateString() : '').replace(/-/g, '');
            if (!day) return;
            const done = await readPath('meta/backups');
            if (done && done[day]) return;
            const tree = await readPath('');
            if (!tree || !tree.meta || !tree.meta.seededAt) return;
            const bak = `${String(url).replace(/\/$/, '')}/vocab/${encodeURIComponent(pw)}_bak_${day}.json`;
            const res = await fetch(bak, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tree) });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            put('meta/backups/' + day, Date.now());
            //   7일보다 오래된 것 지우기
            const cut = new Date(); cut.setDate(cut.getDate() - BACKUP_KEEP_DAYS);
            const cutKey = `${cut.getFullYear()}${String(cut.getMonth() + 1).padStart(2, '0')}${String(cut.getDate()).padStart(2, '0')}`;
            for (const d of Object.keys(done || {})) {
                if (d <= cutKey) {
                    await fetch(`${String(url).replace(/\/$/, '')}/vocab/${encodeURIComponent(pw)}_bak_${d}.json`, { method: 'DELETE' }).catch(() => {});
                    put('meta/backups/' + d, null);
                }
            }
            console.info('[v3] 오늘 백업 끝', day);
        } catch (e) { console.warn('[v3] 날짜별 백업 실패', e); }
    }
    api.dailyBackup = dailyBackup;
    api.backupCheck = backupCheck;
    api.replaceAll = replaceAll;
    api.afterBoot = afterBoot;
    api.crossCheck = crossCheck;
    api.diffPayloads = diffPayloads;
    api.payloadToTree = payloadToTree;
    api.treeToPayload = treeToPayload;
    api.canon = s3Canon;
    api.rootUrl = rootUrl;
    api.noteKey = noteKey;
    return api;
})();
