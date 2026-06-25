let flashcardOrder = [];

        function shuffleFlashcards() {
            // [냐냐 PATCH] 마스터한 단어는 복습 대상에서 제외 — 아직 안 외운 단어만 복습
            const pool = vocabulary.filter(w => !w.mastered);
            flashcardOrder = pool.map(w => ({ word: w, reversed: Math.random() < 0.5 }));
            for (let i = flashcardOrder.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [flashcardOrder[i], flashcardOrder[j]] = [flashcardOrder[j], flashcardOrder[i]];
            }
        }

        function renderFlashcard() {
            const total = flashcardOrder.length;
            const progressSpan = document.getElementById('card-progress');
            
            if (total === 0) {
                const allMastered = vocabulary.length > 0;
                progressSpan.innerText = '0 / 0';
                document.getElementById('card-word').innerText = allMastered ? '🎉' : '단어 없음';
                document.getElementById('card-meaning').innerText = allMastered ? '전부 마스터하셨어요! 복습할 단어가 없어요.' : '단어를 먼저 등록해 주세요!';
                document.getElementById('card-front-pos').innerText = '없음';
                document.getElementById('card-back-pos').innerText = '없음';
                document.getElementById('card-notes').innerText = '';
                document.getElementById('card-conjugations-box').classList.add('hidden');
                document.getElementById('card-front-irregular').innerText = '';
                return;
            }

            progressSpan.innerText = `${currentFlashcardIndex + 1} / ${total}`;
            const entry = flashcardOrder[currentFlashcardIndex];
            const w = entry.word;
            const reversed = entry.reversed;

            const frontSpeaker = document.getElementById('card-front-speaker-btn');
            const backSpeaker = document.getElementById('card-back-speaker-btn');
            const backLabel = document.getElementById('card-back-label');

            if (!reversed) {
                // 앞면: 스페인어 단어 / 뒷면: 한국어 뜻
                document.getElementById('card-word').innerText = w.word;
                document.getElementById('card-meaning').innerText = w.meaning;
                frontSpeaker.classList.remove('hidden');
                backSpeaker.classList.add('hidden');
                backLabel.innerText = '번역 결과';
                document.getElementById('card-front-irregular').innerText = (w.pos === 'verb' && w.verbClass === 'irregular') ? `⚠️ 불규칙 (${w.irregularType || '기타'})` : '';
            } else {
                // 앞면: 한국어 뜻 / 뒷면: 스페인어 단어 (랜덤으로 방향이 섞임)
                document.getElementById('card-word').innerText = w.meaning;
                document.getElementById('card-meaning').innerText = w.word;
                frontSpeaker.classList.add('hidden');
                backSpeaker.classList.remove('hidden');
                backLabel.innerText = '스페인어 단어';
                document.getElementById('card-front-irregular').innerText = '';
            }

            document.getElementById('card-front-pos').innerText = getPosAbbreviation(w.pos, w.gender);
            document.getElementById('card-back-pos').innerText = getPosAbbreviation(w.pos, w.gender);
            document.getElementById('card-notes').innerText = w.notes || '';

            const conjBox = document.getElementById('card-conjugations-box');
            if (w.pos === 'verb' && w.conjugations && Object.values(w.conjugations).some(v => v)) {
                conjBox.classList.remove('hidden');
                document.getElementById('card-conj-yo').innerText = w.conjugations.yo || '-';
                document.getElementById('card-conj-tu').innerText = w.conjugations.tu || '-';
                document.getElementById('card-conj-el').innerText = w.conjugations.el || '-';
                document.getElementById('card-conj-nos').innerText = w.conjugations.nos || '-';
                document.getElementById('card-conj-vos').innerText = w.conjugations.vos || '-';
                document.getElementById('card-conj-ellos').innerText = w.conjugations.ellos || '-';
            } else {
                conjBox.classList.add('hidden');
            }
        }

        function flipFlashcard() {
            const inner = document.getElementById('flashcard-inner');
            if (isFlashcardFlipped) {
                inner.classList.remove('rotate-y-180');
                isFlashcardFlipped = false;
            } else {
                inner.classList.add('rotate-y-180');
                isFlashcardFlipped = true;
                AudioFX.playPunch();
            }
        }

        function prevFlashcard() {
            if (flashcardOrder.length === 0) return;
            isFlashcardFlipped = false;
            document.getElementById('flashcard-inner').classList.remove('rotate-y-180');
            
            currentFlashcardIndex--;
            if (currentFlashcardIndex < 0) {
                currentFlashcardIndex = flashcardOrder.length - 1;
            }
            setTimeout(renderFlashcard, 150);
        }

        function nextFlashcard() {
            if (flashcardOrder.length === 0) return;
            isFlashcardFlipped = false;
            document.getElementById('flashcard-inner').classList.remove('rotate-y-180');
            
            currentFlashcardIndex++;
            if (currentFlashcardIndex >= flashcardOrder.length) {
                currentFlashcardIndex = 0;
            }
            setTimeout(renderFlashcard, 150);
        }

        // Get English-only Pos Abbreviation
        function getPosAbbreviation(pos, gender = 'none') {
            switch(pos) {
                case 'noun': 
                    if (gender === 'masculine') return 'M.';
                    if (gender === 'feminine') return 'F.';
                    return 'N.';
                case 'verb': return 'V.';
                case 'adjective': return 'Adj.';
                case 'adverb': return 'Adv.';
                case 'preposition': return 'Prep.';
                case 'conjunction': return 'Conj.';
                case 'pronoun': return 'Pron.';
                case 'phrase': return 'Phr.';
                default: return 'Oth.';
            }
        }

        // TAB 3: QUIZ GAME LOGICS (count-selectable, mixed MC/subjective, review panel, results screen)
