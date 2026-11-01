        // ============================================================
        // [냐냐 요청] 🎭 상황극 (2026-11-01) — 첨삭의 탭 하나.
        //   AI 에게 '상황 하나 정해서' 라고 맡기면 4번 다 카페 주문이었다 (첫마디 8번 시험).
        //   그래서 상황은 앱이 뽑고(장소·목표·상대·사건) AI 는 연기만 한다.
        //   ⚠️ 사건은 장소마다 손으로 묶었다 — 아무렇게나 섞으니 '약국 + 예약 기록 없음' 이 나왔다.
        //   ⚠️ 겹침도 앱이 뺀다 — AI 에게 '겹치지 마' 라고 하면 오히려 그걸 떠올린다.
        //   사건 ai = 학생이 모른다(AI 가 대화 중에 터뜨린다) · me = 학생이 안다(카드에 적어 준다).
        //   끝나면 학생 말만 모아 자유 작문 채점(submitAiTranslationEsKo)에 태운다 — 점수·첨삭 노트·보물상자가 같다.
        // ============================================================
        const ROLEPLAY_PLACES = [
            { name: '약국', icon: '💊', me: '손님',
              goals: ['머리가 아파서 약 사기', '기침약 고르기', '모기 물린 데 바를 것 사기'],
              who: ['이것저것 꼼꼼하게 묻는 약사', '말이 아주 빠른 약사', '농담을 좋아하는 나이 든 약사'],
              twists: [{ ai: '찾는 약이 오늘 다 떨어졌다. 대신 다른 것을 권한다' }, { ai: '약을 주기 전에 알레르기와 지금 먹는 약을 꼭 확인한다' }, { ai: '옆 손님과 헷갈려서 엉뚱한 약을 내민다' }, { me: '돈이 조금 모자란다. 더 싼 것이 있는지 물어봐야 한다' }] },
            { name: '식당', icon: '🍽️', me: '손님',
              goals: ['저녁 주문하기', '채식 메뉴가 있는지 묻고 주문하기', '추천을 받아 점심 주문하기'],
              who: ['막 일을 시작해서 긴장한 종업원', '추천을 쉬지 않고 하는 종업원', '바빠서 서두르는 종업원'],
              twists: [{ ai: '학생이 고른 음식이 방금 다 떨어졌다' }, { ai: '학생이 시키지 않은 음식을 잘못 가져온다' }, { ai: '오늘의 행사라며 자꾸 더 시키라고 권한다' }, { me: '지갑을 안 가져온 것을 방금 알았다' }] },
            { name: '호텔 프런트', icon: '🏨', me: '손님',
              goals: ['체크인하기', '하루 더 묵을 수 있는지 묻기'],
              who: ['아주 격식을 차리는 직원', '오늘 첫 출근한 직원', '수다스러운 직원'],
              twists: [{ ai: '단체 손님이 와서 정신이 없고 빈방이 거의 없다' }, { ai: '학생을 다른 손님으로 착각해 이름을 잘못 부른다' }, { ai: '남은 방의 에어컨이 고장 나 있다' }, { me: '여권이 가방에 안 보인다. 어떻게 하면 좋을지 물어봐야 한다' }] },
            { name: '기차역 창구', icon: '🚆', me: '손님',
              goals: ['바르셀로나행 표 사기', '표를 내일로 바꾸기', '돌아오는 표까지 왕복으로 사기'],
              who: ['말수가 적고 무뚝뚝한 직원', '기차 이야기를 좋아하는 직원', '퇴근 5분 전이라 서두르는 직원'],
              twists: [{ ai: '그 기차가 오늘 파업으로 취소됐다' }, { ai: '남은 자리가 비싼 1등석뿐이다' }, { ai: '학생이 말한 도시를 비슷한 다른 도시로 잘못 듣는다' }, { me: '기차 출발까지 10분밖에 안 남았다' }] },
            { name: '분실물 센터', icon: '🧳', me: '물건을 잃어버린 사람',
              goals: ['잃어버린 가방 찾기', '잃어버린 휴대폰 찾기', '잃어버린 우산 찾기'],
              who: ['오늘 첫 출근한 직원', '서류를 꼼꼼하게 챙기는 직원', '농담을 좋아하는 직원'],
              twists: [{ ai: '비슷한 물건이 세 개 있어서 색·크기를 자세히 묻는다' }, { ai: '학생을 다른 사람으로 착각한다' }, { ai: '조금 전에 다른 사람이 자기 것이라며 가져갔다고 한다' }, { me: '언제 어디서 잃어버렸는지 잘 기억나지 않는다' }] },
            { name: '시장', icon: '🍅', me: '손님',
              goals: ['과일 1킬로 사기', '저녁 재료 사기', '값을 깎아 달라고 하기'],
              who: ['말이 많은 과일 장수', '장사를 아주 잘하는 할머니', '맛보기를 계속 권하는 아저씨'],
              twists: [{ ai: '찾는 것이 없어서 제철인 다른 것을 권한다' }, { ai: '값을 잘못 계산한다' }, { ai: '맛을 보라고 계속 권하고 안 먹으면 서운해한다' }, { me: '현금이 거의 없어서 카드를 써야 한다' }] },
            { name: '옷 가게', icon: '👕', me: '손님',
              goals: ['친구 선물로 티셔츠 사기', '치수가 안 맞는 바지 바꾸기', '파티에 입을 옷 고르기'],
              who: ['칭찬을 아주 많이 하는 점원', '뭐든 솔직하게 말하는 점원', '수줍음이 많은 점원'],
              twists: [{ ai: '원하는 색이 없어서 다른 색을 권한다' }, { ai: '오늘 세일인데 두 개를 사야 깎아 준다고 한다' }, { ai: '맞는 치수가 창고에 있는지 모른다며 오래 기다리라고 한다' }, { me: '쓸 수 있는 돈이 30유로뿐이다' }] },
            { name: '미용실', icon: '💇', me: '손님',
              goals: ['머리 자르기', '앞머리만 다듬기', '머리 색 바꾸기'],
              who: ['유행 이야기를 좋아하는 미용사', '자기 생각대로 하고 싶어 하는 미용사', '손이 빠르고 말이 적은 미용사'],
              twists: [{ ai: '원하는 것과 다른 머리 모양을 강하게 권한다' }, { ai: '예약이 밀려 오래 기다려야 한다' }, { ai: '다른 손님과 착각해서 다른 머리 모양을 말한다' }, { me: '저녁에 중요한 약속이 있어서 1시간 안에 끝나야 한다' }] },
            { name: '동물병원', icon: '🐶', me: '보호자',
              goals: ['강아지가 밥을 안 먹어서 상담하기', '고양이 예방 주사 맞히기', '강아지 발 다친 것 보이기'],
              who: ['지나치게 친절한 직원', '아주 차분한 수의사', '동물 이야기를 멈추지 않는 수의사'],
              twists: [{ ai: '이름을 착각해서 다른 동물의 기록을 읽는다' }, { ai: '동물의 나이·몸무게·먹는 것을 자세히 묻는다' }, { ai: '오늘은 너무 바빠서 내일 오라고 한다' }, { me: '친구의 동물을 대신 데려와서 나이를 정확히 모른다' }] },
            { name: '우체국', icon: '📮', me: '손님',
              goals: ['한국으로 소포 보내기', '우표를 사서 편지 보내기', '나한테 온 소포 찾기'],
              who: ['규칙을 아주 따지는 직원', '친절하지만 느린 직원', '옆 직원과 수다를 떠는 직원'],
              twists: [{ ai: '곧 점심시간이라 문을 닫는다고 한다' }, { ai: '서류를 써야 한다며 이름과 주소를 묻는다' }, { ai: '상자가 너무 커서 그대로는 안 된다고 한다' }, { me: '신분증을 안 가져왔다' }] },
            { name: '공항 수속 창구', icon: '✈️', me: '여행객',
              goals: ['탑승 수속하기', '창가 자리 부탁하기', '가방 부치기'],
              who: ['아주 엄격한 직원', '늘 웃는 직원', '아직 일이 서툰 새 직원'],
              twists: [{ ai: '가방이 3킬로 넘는다' }, { ai: '비행기가 2시간 늦어진다' }, { ai: '남은 자리가 맨 뒤 가운데뿐이다' }, { me: '휴대폰에서 탑승권을 못 찾고 있다' }] },
            { name: '아파트 복도', icon: '🚪', me: '새로 이사 온 이웃',
              goals: ['이웃에게 인사하기', '소금 조금 빌리기', '밤 음악 소리를 줄여 달라고 부탁하기'],
              who: ['아주 수다스러운 할머니', '귀가 잘 안 들리는 할아버지', '요리를 좋아하는 아저씨'],
              twists: [{ ai: '자꾸 집으로 들어오라고 권한다' }, { ai: '학생을 전에 살던 사람으로 착각한다' }, { ai: '아파트의 이상한 규칙을 알려 준다' }, { me: '내 열쇠를 집 안에 두고 나왔다' }] },
            { name: '친구와 전화', icon: '📱', me: '친구',
              goals: ['토요일 약속 잡기', '약속 시간 바꾸기', '같이 갈 식당 정하기'],
              who: ['언제나 늦는 친구', '계획을 자주 바꾸는 친구', '뭐든 좋다고만 하는 친구'],
              twists: [{ ai: '그날 다른 일이 있다며 다른 날을 말한다' }, { ai: '다른 친구도 데려와도 되냐고 묻는다' }, { ai: '만나는 곳을 몰라서 어디인지 자꾸 되묻는다' }, { me: '돈이 별로 없어서 비싼 곳은 못 간다' }] },
            //   학생이 일하는 쪽 — 늘 손님만 하면 그것도 뻔하다
            { name: '꽃집', icon: '💐', me: '꽃집 직원',
              goals: ['손님에게 꽃을 권해서 팔기'],
              who: ['엄마 생일 꽃을 찾는 소심한 손님', '값을 깐깐하게 따지는 할머니 손님', '첫 데이트를 앞둔 대학생 손님'],
              twists: [{ ai: '꽃가루 알레르기가 있다고 뒤늦게 말한다' }, { ai: '돈이 모자란다고 한다' }, { ai: '꽃을 줄 사람 이야기를 자꾸 털어놓는다' }, { me: '오늘 장미가 다 떨어졌다' }] },
            { name: '관광 안내소', icon: '🗺️', me: '안내소 직원',
              goals: ['길 잃은 관광객에게 길 알려 주기', '근처 볼거리 추천하기'],
              who: ['방향 감각이 전혀 없는 관광객', '사진 찍느라 바쁜 관광객', '궁금한 것이 끝없는 어린이'],
              twists: [{ ai: '지금 다른 도시에 있는 줄 알고 있었다' }, { ai: '버스 타는 법까지 묻는다' }, { ai: '일행을 잃어버렸다고 갑자기 말한다' }, { me: '오늘은 박물관이 쉬는 날이다' }] }
        ];
        const ROLEPLAY_MAX_LINES = 6;     // 학생이 말하는 횟수 — 여기서 AI 가 장면을 닫는다
        const ROLEPLAY_MIN_LINES = 3;     // 이보다 일찍은 AI 가 장면을 못 닫는다
        const ROLEPLAY_AVOID_PLACES = 5;  // 최근 이만큼의 장소는 다시 안 낸다
        const ROLEPLAY_AVOID_TWISTS = 20; // 최근 이만큼의 사건도

        let aiRoleplay = null;       // 지금 장면 { name, icon, me, goal, who, twist, ask, words, msgs:[{ r:'ai'|'me', es, ko, hint, showKo, showHint }], done, graded }
        let aiRoleplayBusy = false;  // AI 답을 기다리는 중 (이때는 보내기·새 상황을 막는다)
        let aiRoleplaySeen = [];     // 첨삭까지 안 간 장면도 이번 접속 동안은 겹치지 않게

        function pickFrom(list) { return list[Math.floor(Math.random() * list.length)]; }

        //   최근 장면은 첨삭 노트의 ask 에서 읽는다 — 따로 저장하지 않아도 폰과 같이 맞는다
        function pickRoleplayScene() {
            const notes = (typeof aiNotes !== 'undefined' && Array.isArray(aiNotes)) ? aiNotes : [];
            const recent = aiRoleplaySeen.concat(notes.filter(n => n && n.mode === 'roleplay' && n.ask).map(n => n.ask));
            const nearPlaces = recent.slice(0, ROLEPLAY_AVOID_PLACES);
            const nearTwists = recent.slice(0, ROLEPLAY_AVOID_TWISTS);
            const places = ROLEPLAY_PLACES.filter(p => !nearPlaces.some(a => a.startsWith(p.name + ' — ')));
            const p = pickFrom(places.length ? places : ROLEPLAY_PLACES);
            const twists = p.twists.filter(t => !nearTwists.some(a => a.includes(t.ai || t.me)));
            const twist = pickFrom(twists.length ? twists : p.twists);
            const goal = pickFrom(p.goals), who = pickFrom(p.who);
            const ask = `${p.name} — ${goal} · 상대: ${who} · 사건: ${twist.ai || twist.me}`;
            aiRoleplaySeen.unshift(ask);
            return { name: p.name, icon: p.icon, me: p.me, goal, who, twist, ask, words: pickRoleplayWords(), msgs: [], done: false, graded: false };
        }

        //   곡선 안 낱말을 AI 대사에 재료로 건넨다 — 만나면 복습이 되라고. 어울릴 때만 쓰라고 일러 둔다.
        function pickRoleplayWords() {
            const pool = (typeof vocabulary !== 'undefined' ? vocabulary : [])
                .filter(w => w && w.word && w.lastWrongDate && (w.reviewStage || 0) < REVIEW_INTERVALS.length);
            const out = [];
            while (out.length < 8 && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
            return out.map(w => `${w.word} (${w.meaning || ''})`);
        }

        function roleplayTenseRule() {
            const have = registeredMissionTenses();
            const notYet = Object.keys(MISSION_TENSE_LABEL).filter(k => !have.includes(k));
            if (!have.length || !notYet.length) return '';
            return `
[시제 — 학생이 배운 것만 말한다]
써도 되는 것: ${have.map(k => MISSION_TENSE_LABEL[k]).join(' · ')}, 그리고 ir a · tener que · poder · querer + 동사원형.
쓰지 않는 것: ${notYet.map(k => MISSION_TENSE_LABEL[k]).join(' · ')}.
내보내기 전에 네 대사를 다시 읽고, 쓰지 않는 시제가 있으면 고쳐 말한다. 부탁은 ¿Puede + 동사원형? 으로.${notYet.includes('subjPresente') ? `
특히 necesito que · quiero que · espero que 뒤에 오는 동사는 접속법이다 → Tiene que + 동사원형 으로 말한다.` : ''}`;
        }

        function roleplaySystem(s) {
            const twistText = s.twist.ai
                ? `[사건 — 학생은 모른다] ${s.twist.ai}\n첫마디에는 꺼내지 말고, 학생의 첫째나 둘째 말에 답할 때 터뜨린다.`
                : `[학생의 사정 — 학생은 안다] ${s.twist.me}\n네가 먼저 꺼내지 말고, 학생이 말하면 인물답게 받는다.`;
            return `너는 스페인어 상황극에서 한 인물을 연기한다. 상대는 스페인어를 배우는 한국인 학생(A2 수준)이다.

[상황] 스페인의 어느 도시. 장소: ${s.name}
[너의 역할] ${s.who}
[학생의 역할] ${s.me}
[학생의 목표] ${s.goal}
${twistText}

[연기]
- 끝까지 그 인물로만 말한다. 선생님처럼 설명하거나 학생의 실수를 고쳐 주지 않는다 (첨삭은 끝나고 따로 한다).
- 한 번에 1~2문장, 합쳐서 20낱말 안쪽의 쉬운 말.
- 성격은 말로 설명하지 말고('천천히 말씀하세요' 처럼 역할 소개를 읊지 말고) 하는 말과 말투로 드러낸다. 앞에서 한 말을 되풀이하지 않는다.
- 장면을 닫을 때 말고는 학생이 답할 거리(질문이나 제안)를 꼭 남긴다.
- 학생 말에 실수가 있어도 뜻이 짐작되면 알아들은 대로 이어 간다. 정말 모르겠으면 인물답게 되묻는다. 한국어가 섞여 있으면 무슨 말인지 모르겠다고 스페인어로 되묻는다.
${roleplayTenseRule()}${s.words.length ? `

[낱말] 학생이 복습 중인 낱말이다. 이 장소에서 정말 쓸 법한 것만 네 대사에 넣는다. 어울리는 것이 없는 게 보통이고, 그러면 하나도 쓰지 않는다. 낱말에 맞추려고 상황을 비틀거나 말을 잘못한 척 끼워 넣지 않는다.
${s.words.join(' · ')}` : ''}

[내보내는 칸]
es: 네 대사 (스페인어만)
ko: 그 대사의 자연스러운 한국어 뜻
hint: 학생이 이 말에 무엇을 답하면 좋을지 한국어 한 줄 (스페인어는 쓰지 않는다). 예: '어디가 아픈지 말해 보세요'. 장면을 닫는 말이면 빈칸.
done: 이 말로 장면이 끝나면 true`;
        }

        function roleplayTranscript(s) {
            return s.msgs.map(m => `${m.r === 'me' ? '학생' : '너'}: ${m.es}`).join('\n');
        }

        async function askRoleplayLine(s) {
            const n = s.msgs.filter(m => m.r === 'me').length;
            const turn = n === 0
                ? `첫마디를 말한다. 네가 먼저 ${s.me} 역할의 학생에게 말을 건다. 뻔한 인사로만 끝내지 말고 이 인물답게 시작한다. done 은 false.`
                : n >= ROLEPLAY_MAX_LINES
                    ? `학생의 마지막 말이다. 장면을 자연스럽게 마무리하는 말을 한다. 질문하지 않는다. done 은 true.`
                    : n >= ROLEPLAY_MIN_LINES
                        ? `학생의 ${n}번째 말이다. 학생의 목표가 해결됐으면 장면을 마무리하고 done 을 true 로, 아니면 이어 가고 false 로 한다.`
                        : `학생의 ${n}번째 말이다. 장면을 이어 간다. done 은 false.`;
            const prompt = `${n ? `지금까지의 대화:\n${roleplayTranscript(s)}\n\n` : ''}${turn}`;
            const schema = {
                type: "OBJECT",
                properties: {
                    es: { type: "STRING" },
                    ko: { type: "STRING" },
                    hint: { type: "STRING" },
                    done: { type: "BOOLEAN" }
                },
                required: ["es", "ko", "hint", "done"]
            };
            //   3.5 Lite 가 스페인어 철자를 깨뜨리므로(todav&iacute;a) 보여주는 말은 3.5 Flash 를 먼저 받는다
            const r = extractAndParseJson(await callGeminiWithBackup(prompt, roleplaySystem(s), schema, BACKUP_CHAT));
            if (!r || !String(r.es || '').trim()) throw new Error('상황극 대사가 비어 있어요');
            //   장면을 닫는 때는 앱이 정한다 — AI 가 일찍 닫거나 끝없이 끌지 않게
            const done = n >= ROLEPLAY_MAX_LINES || (n >= ROLEPLAY_MIN_LINES && !!r.done);
            return { line: { r: 'ai', es: String(r.es).trim(), ko: String(r.ko || '').trim(), hint: done ? '' : String(r.hint || '').trim() }, done };
        }

        async function newRoleplay(confirmed) {
            if (aiRoleplayBusy) return;
            if (!hasGeminiApiKey()) {
                showToast("Gemini API 키가 없어서 상황극을 할 수 없어요. 우측 상단 배지에서 키를 등록해 주세요!", "error");
                openApiKeyModal();
                return;
            }
            //   주고받은 말이 있는데 첨삭을 안 받았으면 한 번 묻는다 — 쓴 문장이 날아간다
            const said = aiRoleplay && !aiRoleplay.graded && aiRoleplay.msgs.some(m => m.r === 'me');
            if (said && !confirmed) {
                showConfirm("새 상황을 뽑을까요?", "첨삭을 안 받은 대화가 있어요. 뽑으면 지금 대화는 없어져요.", () => newRoleplay(true), { okLabel: '새 상황 뽑기', okStyle: 'primary', icon: 'info' });
                return;
            }
            document.getElementById('ai-feedback-result')?.classList.add('hidden');
            const input = document.getElementById('ai-rp-input');
            if (input) input.value = '';
            const s = pickRoleplayScene();
            aiRoleplay = s;
            aiRoleplayBusy = true;
            renderRoleplay();
            if (typeof AudioFX !== 'undefined') AudioFX.playPunch();
            try {
                const { line } = await askRoleplayLine(s);
                s.msgs.push(line);
            } catch (e) {
                console.error(e);
                aiRoleplay = null;
                showToast(describeGeminiError(e), "error");
            } finally {
                aiRoleplayBusy = false;
                renderRoleplay();
            }
        }

        async function sendRoleplayLine() {
            const s = aiRoleplay;
            if (!s || aiRoleplayBusy || s.done) return;
            const input = document.getElementById('ai-rp-input');
            const text = input.value.trim();
            if (!text) { showToast("스페인어로 답을 적어 주세요!", "error"); return; }
            s.msgs.push({ r: 'me', es: text });
            input.value = '';
            aiRoleplayBusy = true;
            renderRoleplay();
            try {
                const { line, done } = await askRoleplayLine(s);
                s.msgs.push(line);
                s.done = done;
            } catch (e) {
                console.error(e);
                //   못 받았으면 쓴 말을 칸으로 되돌린다 — 다시 보내면 된다
                s.msgs.pop();
                input.value = text;
                showToast(describeGeminiError(e), "error");
            } finally {
                aiRoleplayBusy = false;
                renderRoleplay();
                if (!s.done) input.focus();
            }
        }

        async function gradeRoleplay() {
            const s = aiRoleplay;
            if (!s || aiRoleplayBusy || s.graded) return;
            const lines = s.msgs.filter(m => m.r === 'me').map(m => m.es);
            if (!lines.length) { showToast("아직 말한 게 없어요. 한 마디 해 보고 첨삭을 받아요!", "error"); return; }
            s.done = true;
            renderRoleplay();
            const ok = await submitAiTranslationEsKo({
                text: lines.join('\n'),
                //   보물상자는 문장마다 센다 — 온점 없이 쓴 말도 한 문장으로 치려고 끝을 맞춘다
                countText: lines.map(l => /[.!?…]$/.test(l) ? l : l + '.').join(' '),
                ask: s.ask,
                head: `This is a Spanish role-play. Setting: ${s.name}. The student plays: ${s.me} (goal: ${s.goal}). The other character: ${s.who}.
            The whole conversation, for context only ("너" is the other character — never grade those lines):
            ${roleplayTranscript(s).replace(/\n/g, '\n            ')}

            Grade ONLY the student's lines, listed here one per line:
            ${lines.join('\n            ')}

            Keep "correctedText" and "originalMarked" in that same order with one line per student line, separated by \\n.
            Short spoken answers such as "Sí, gracias." are complete and correct. Never ask for longer sentences and never add to a line that is already right.
            A line that is grammatical but does not fit what the other character just said is a meaning error: fix it and say so.
            "message" says in Korean, 1-2 sentences, how the conversation went and the one main thing to work on.`
            });
            if (ok) s.graded = true;
            renderRoleplay();
        }

        //   말풍선의 🔊·해석·힌트 — 대사를 onclick 에 적지 않고 번호로 넘긴다 (따옴표가 섞이면 호출이 깨진다)
        function speakRoleplayLine(i) {
            const m = aiRoleplay && aiRoleplay.msgs[i];
            if (m) speakSpanishVoice(m.es);
        }
        function toggleRoleplayKo(i) {
            const m = aiRoleplay && aiRoleplay.msgs[i];
            if (m) { m.showKo = !m.showKo; renderRoleplay(); }
        }
        function toggleRoleplayHint() {
            const m = aiRoleplay && aiRoleplay.msgs[aiRoleplay.msgs.length - 1];
            if (m && m.r === 'ai') { m.showHint = !m.showHint; renderRoleplay(); }
        }

        function renderRoleplay() {
            const s = aiRoleplay;
            const card = document.getElementById('ai-rp-card');
            const chat = document.getElementById('ai-rp-chat');
            const wrap = document.getElementById('ai-rp-input-wrap');
            const after = document.getElementById('ai-rp-after');
            if (!card || !chat || !wrap || !after) return;
            const newBtn = document.getElementById('ai-rp-new-btn');
            if (newBtn) newBtn.disabled = aiRoleplayBusy;
            if (!s) {
                card.innerHTML = `<div class="bg-orange-50 border border-orange-100 p-5 rounded-2xl text-sm font-bold text-slate-700">'🎲 상황 뽑기' 를 누르면 장소·상대가 정해지고 상대가 먼저 말을 걸어요.</div>`;
                chat.innerHTML = '';
                wrap.classList.add('hidden');
                after.classList.add('hidden');
                return;
            }
            const n = s.msgs.filter(m => m.r === 'me').length;
            card.innerHTML = `
                <div class="bg-orange-50 border border-orange-100 p-4 rounded-2xl space-y-1.5">
                    <div class="text-base font-extrabold text-slate-900">${s.icon} ${escapeHtml(s.name)}</div>
                    <div class="text-sm text-slate-800"><b class="text-orange-600">내 역할</b> ${escapeHtml(s.me)}</div>
                    <div class="text-sm text-slate-800"><b class="text-orange-600">할 일</b> ${escapeHtml(s.goal)}</div>
                    <div class="text-sm text-slate-800"><b class="text-orange-600">상대</b> ${escapeHtml(s.who)}</div>
                    ${s.twist.me ? `<div class="text-sm text-slate-800"><b class="text-orange-600">내 사정</b> ${escapeHtml(s.twist.me)}</div>` : ''}
                </div>`;
            chat.innerHTML = s.msgs.map((m, i) => m.r === 'me'
                ? `<div class="flex justify-end"><div class="max-w-[85%] bg-orange-100 text-slate-900 rounded-2xl rounded-br-md px-3.5 py-2 text-sm font-semibold whitespace-pre-wrap break-words">${escapeHtml(m.es)}</div></div>`
                : `<div class="flex justify-start"><div class="max-w-[85%] bg-slate-100 text-slate-900 rounded-2xl rounded-bl-md px-3.5 py-2 space-y-1">
                        <div class="text-sm font-semibold whitespace-pre-wrap break-words">${escapeHtml(m.es)}</div>
                        ${m.showKo ? `<div class="text-[13px] text-teal-700">${escapeHtml(m.ko || '')}</div>` : ''}
                        <div class="flex gap-3 text-[11px] font-bold text-slate-500">
                            <button type="button" onclick="speakRoleplayLine(${i})" class="hover:text-sky-600"><i class="fa-solid fa-volume-high"></i> 듣기</button>
                            <button type="button" onclick="toggleRoleplayKo(${i})" class="hover:text-teal-600"><i class="fa-solid fa-language"></i> ${m.showKo ? '해석 닫기' : '해석'}</button>
                        </div>
                   </div></div>`).join('')
                + (aiRoleplayBusy && !s.done ? `<div class="flex justify-start"><div class="bg-slate-100 text-slate-400 rounded-2xl rounded-bl-md px-3.5 py-2 text-sm"><i class="fa-solid fa-ellipsis fa-fade"></i></div></div>` : '');
            const last = s.msgs[s.msgs.length - 1];
            const hintBox = document.getElementById('ai-rp-hint-box');
            const hintBtn = document.getElementById('ai-rp-hint-btn');
            const hasHint = !!(last && last.r === 'ai' && last.hint);
            if (hintBtn) hintBtn.classList.toggle('hidden', !hasHint);
            if (hintBox) {
                hintBox.classList.toggle('hidden', !(hasHint && last.showHint));
                hintBox.innerText = hasHint ? `💡 ${last.hint}` : '';
            }
            const count = document.getElementById('ai-rp-count');
            if (count) count.innerText = `내 말 ${n} / ${ROLEPLAY_MAX_LINES}`;
            const sendBtn = document.getElementById('ai-rp-send-btn');
            if (sendBtn) sendBtn.disabled = aiRoleplayBusy;
            const stopBtn = document.getElementById('ai-rp-stop-btn');
            if (stopBtn) { stopBtn.classList.toggle('hidden', n === 0); stopBtn.disabled = aiRoleplayBusy; }
            wrap.classList.toggle('hidden', s.done);
            after.classList.toggle('hidden', !s.done);
            document.getElementById('ai-rp-grade-btn')?.classList.toggle('hidden', s.graded);
            document.getElementById('ai-rp-next-btn')?.classList.toggle('hidden', !s.graded);
        }

        //   새로고침으로 되살릴 때 (core.js restoreReloadStash) — 답을 기다리다 끊긴 말은 칸으로 되돌린다
        function restoreRoleplay(st, text) {
            if (!st || !Array.isArray(st.msgs)) return;
            let box = text || '';
            const last = st.msgs[st.msgs.length - 1];
            if (last && last.r === 'me' && !st.done) { st.msgs.pop(); box = last.es; }
            if (!st.msgs.length) return;
            aiRoleplay = st;
            const input = document.getElementById('ai-rp-input');
            if (input) input.value = box;
            renderRoleplay();
        }
