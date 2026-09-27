import './style.css';

let db = [];
let currentLessonWords = [];
let currentIndex = 0;
let isCurrentWordAnswered = false;
let currentLang = 'en'; // Язык по умолчанию ('en', 'es', 'de')

// Конфигурация путей к файлам и настроек озвучки
const langConfig = {
    en: { paths: ['/data/words_group1.json', '/data/words_group2.json', '/data/words_group3.json'], voice: 'en-US' },
    es: { paths: ['/data/esp_group1.json'], voice: 'es-ES' },
    de: { paths: ['/data/deu_group1.json'], voice: 'de-DE' }
};

async function initDB() {
    try {
        document.getElementById('global-stats').innerHTML = "Загрузка базы данных...";
        
        // Динамически загружаем файлы выбранного языка
        const fetchPromises = langConfig[currentLang].paths.map(path => fetch(path).then(res => res.json()));
        const results = await Promise.all(fetchPromises);
        
        // Склеиваем массивы, если файлов несколько (как у английского)
        const fullRawDictionary = results.flat();

        // Ключ прогресса уникален для каждого языка: например, 'words_progress_en'
        const progressKey = `words_progress_${currentLang}`;
        const savedProgress = localStorage.getItem(progressKey);
        
        if (savedProgress) {
            const progressMap = JSON.parse(savedProgress);
            db = fullRawDictionary.map(item => {
                const savedItem = progressMap.find(p => p.id === item.id);
                return savedItem ? { ...item, ...savedItem } : { ...item, repeatsCount: 0, errorsCount: 0, lastRepeated: null };
            });
        } else {
            db = fullRawDictionary.map(item => ({
                ...item, repeatsCount: 0, errorsCount: 0, lastRepeated: null
            }));
        }

        // Сбрасываем интерфейс текущего урока при смене языка
        document.getElementById('main-card').style.display = 'none';
        document.getElementById('nav-zone').style.display = 'none';
        document.getElementById('btn-repeat').disabled = true;
        document.getElementById('lesson-title').textContent = "Выберите или сформируйте урок";

        saveDB();
        updateGlobalStats();
    } catch (error) {
        console.error("Ошибка загрузки:", error);
        document.getElementById('global-stats').innerHTML = "<span style='color:red;'>Ошибка загрузки JSON!</span>";
    }
}

function saveDB() {
    const progressToSave = db.map(w => ({
        id: w.id, repeatsCount: w.repeatsCount, errorsCount: w.errorsCount, lastRepeated: w.lastRepeated
    }));
    localStorage.setItem(`words_progress_${currentLang}`, JSON.stringify(progressToSave));
}

function updateGlobalStats() {
    const total = db.length;
    const learned = db.filter(w => w.repeatsCount > 0).length;
    document.getElementById('global-stats').innerHTML = `Язык: <strong>${currentLang.toUpperCase()}</strong> | Всего слов: <strong>${total}</strong> | Изучено: <strong>${learned}</strong>`;
}

function generateNewLesson() {
    let newWords = db.filter(w => w.repeatsCount === 0);
    let lessonNew = newWords.slice(0, 10);

    let oldWords = db.filter(w => w.repeatsCount > 0).sort((a, b) => {
        if (b.errorsCount !== a.errorsCount) return b.errorsCount - a.errorsCount;
        return (a.lastRepeated || 0) - (b.lastRepeated || 0);
    });
    let lessonOld = oldWords.slice(0, 5);

    currentLessonWords = [...lessonNew, ...lessonOld];

    if(currentLessonWords.length < 15) {
        let remaining = db.filter(w => !currentLessonWords.some(lw => lw.id === w.id));
        currentLessonWords = [...currentLessonWords, ...remaining.slice(0, 15 - currentLessonWords.length)];
    }

    currentLessonWords.sort(() => Math.random() - 0.5);
    startLesson("Обычный урок (10 новых + повторение)");
}

function repeatCurrentLesson() {
    if(currentLessonWords.length === 0) return;
    startLesson("Повторение текущего урока");
}

function startLesson(title) {
    currentIndex = 0;
    document.getElementById('lesson-title').textContent = title;
    document.getElementById('main-card').style.display = 'flex';
    document.getElementById('nav-zone').style.display = 'flex';
    document.getElementById('btn-repeat').disabled = false;
    renderWord();
}

function renderWord() {
    const wordData = currentLessonWords[currentIndex];
    const globalWord = db.find(w => w.id === wordData.id);
    
    let mainWord = globalWord.word;
    let verbForms = [];

    if (mainWord.includes('(')) {
        const parts = mainWord.split('(');
        mainWord = parts[0].trim();
        const formsString = parts[1].replace(')', '');
        verbForms = formsString.split(/[-—,]/).map(f => f.trim());
    }

    document.getElementById('w-eng').textContent = mainWord;
    document.getElementById('w-type').textContent = globalWord.type;
    
    const formsContainer = document.getElementById('w-forms-container');
    formsContainer.innerHTML = "";
    
    if (verbForms.length > 0) {
        verbForms.forEach((form, idx) => {
            const span = document.createElement('span');
            span.className = "verb-form-badge";
            span.innerHTML = `<small>V${idx + 1}:</small> ${form}`;
            formsContainer.appendChild(span);
        });
    }

    const isNew = globalWord.repeatsCount === 0;
    document.getElementById('w-status').textContent = isNew ? "Новое" : `Повторение (${globalWord.errorsCount} ош.)`;
    document.getElementById('w-status').style.background = isNew ? "#2ecc71" : "#f1c40f";
    document.getElementById('w-status').style.color = isNew ? "white" : "black";

    document.getElementById('user-input').value = "";
    document.getElementById('result-text').style.display = "none";
    document.getElementById('btn-check').style.display = "block";
    
    document.getElementById('w-trans').textContent = globalWord.translation.toUpperCase();
    document.getElementById('w-syn').textContent = globalWord.synonyms || "-";
    document.getElementById('w-ant').textContent = globalWord.antonyms || "-";
    
    const exList = document.getElementById('w-examples');
    exList.innerHTML = "";
    globalWord.examples.forEach(ex => {
        let li = document.createElement('li');
        li.innerHTML = `${ex.en} <span class="ex-ru">${ex.ru}</span>`;
        exList.appendChild(li);
    });

    if (isNew) {
        document.getElementById('quiz-instruction').textContent = "Новое слово! Ознакомьтесь и нажмите Вперед.";
        document.getElementById('user-input').style.display = "none";
        document.getElementById('btn-check').style.display = "none";
        document.getElementById('info-zone').className = "hidden-content visible";
        isCurrentWordAnswered = true;
    } else {
        document.getElementById('quiz-instruction').textContent = "Введите перевод на русский язык:";
        document.getElementById('user-input').style.display = "block";
        document.getElementById('info-zone').className = "hidden-content";
        isCurrentWordAnswered = false;
    }

    document.getElementById('card-counter').textContent = `${currentIndex + 1} / ${currentLessonWords.length}`;
}

function checkAnswer() {
    if(isCurrentWordAnswered) return;

    const wordData = currentLessonWords[currentIndex];
    const globalWord = db.find(w => w.id === wordData.id);
    const userAns = document.getElementById('user-input').value.trim().toLowerCase();
    const correctAns = globalWord.translation.trim().toLowerCase();

    const resText = document.getElementById('result-text');
    resText.style.display = "block";

    if (userAns !== "" && correctAns.includes(userAns)) {
        resText.textContent = "Правильно! 🎉";
        resText.style.color = "var(--success)";
        globalWord.repeatsCount += 1;
    } else {
        resText.textContent = `Ошибка! Правильный перевод: "${globalWord.translation}"`;
        resText.style.color = "var(--danger)";
        globalWord.errorsCount += 1;
        globalWord.repeatsCount += 1;
    }

    globalWord.lastRepeated = Date.now();
    saveDB();
    updateGlobalStats();

    document.getElementById('info-zone').className = "hidden-content visible";
    document.getElementById('btn-check').style.display = "none";
    isCurrentWordAnswered = true;
}

function changeWord(direction) {
    let newIndex = currentIndex + direction;
    if (newIndex >= 0 && newIndex < currentLessonWords.length) {
        currentIndex = newIndex;
        renderWord();
    }
}

function speakWord() {
    const wordText = document.getElementById('w-eng').textContent;
    if (!wordText || wordText === "Word") return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(wordText);
    
    // Подставляем нужный язык для синтеза речи (en-US, es-ES, de-DE)
    utterance.lang = langConfig[currentLang].voice;
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
}

// Переключение языков
function switchLanguage(e) {
    const selectedLang = e.target.getAttribute('data-lang');
    if (selectedLang === currentLang) return;

    currentLang = selectedLang;

    // Меняем активный класс у кнопок
    document.querySelectorAll('.btn-lang').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');

    // Переинициализируем БД под новый язык
    initDB();
}

document.addEventListener('DOMContentLoaded', () => {
    initDB();
    document.getElementById('btn-new-lesson').addEventListener('click', generateNewLesson);
    document.getElementById('btn-repeat').addEventListener('click', repeatCurrentLesson);
    document.getElementById('btn-check').addEventListener('click', checkAnswer);
    document.getElementById('btn-prev').addEventListener('click', () => changeWord(-1));
    document.getElementById('btn-next').addEventListener('click', () => changeWord(1));
    document.getElementById('btn-speak').addEventListener('click', speakWord);
    
    // Вешаем события на кнопки языков
    document.querySelectorAll('.btn-lang').forEach(btn => {
        btn.addEventListener('click', switchLanguage);
    });
});