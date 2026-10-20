// js/i18n.js - Multi-Language Internationalization (English, Russian, Hebrew)

export const TRANSLATIONS = {
    en: {
        page_title: 'Skyline Player · Multi-Universe 3D/2D Visualizer',
        intro_title_1: 'Skyline',
        intro_title_2: 'Player',
        intro_desc: 'Your music is already loaded. Click Play to start, and the city lights will pulse with the rhythm. Cars travel along the highways, people walk through the park, and day turns into night. The visualizer loops smoothly until auto-stop.',
        btn_play_music: '▶ Play Music',
        btn_choose_device: 'Choose audio file',
        intro_worlds_note: 'In the "World" menu, you can switch to Snowy North, Medieval Village, Yennefer\'s Chamber, Hogwarts, Minas Tirith, or Jedi Council.',
        intro_keys_note: '<kbd>Space</kbd> Play/Pause · <kbd>F</kbd> Fullscreen · Controls auto-hide after 3.5s of inactivity',
        aria_play: 'Play/Pause',
        track_default: 'Cities Skylines 2 · Click Play',
        ctl_volume: 'Volume',
        ctl_react: 'Reactivity',
        ctl_stop_after: 'Auto-Stop',
        stop_0: 'Disabled',
        stop_1: 'After 1 hour',
        stop_2: 'After 2 hours',
        stop_4: 'After 4 hours',
        stop_8: 'After 8 hours',
        ctl_world: 'World',
        world_city: '2D City Skyline',
        world_north: '2D Snowy North',
        world_medieval: '2D Medieval Village',
        world_yennefer: 'Witcher · Yennefer\'s Chamber',
        world_harry_potter: 'Harry Potter · Hogwarts',
        world_lotr: 'LOTR · Minas Tirith & White Tree',
        world_star_wars: 'Star Wars · Jedi Council',
        ctl_cycle: 'Day & Night',
        cycle_600: '10-minute cycle',
        cycle_1800: '30-minute cycle',
        cycle_3600: '1-hour cycle',
        cycle_real: 'Real-time clock',
        cycle_night: 'Always Night',
        cycle_day: 'Always Day',
        ctl_language: 'Language',
        btn_choose_file: 'Choose audio',
        btn_fullscreen: 'Fullscreen',
        drop_overlay: 'Drop your audio file here',
        loading_world: 'Loading 3D World...',
        loading_yennefer: 'Loading Kaer Morhen · Yennefer\'s Chamber...',
        loading_hp_gryff: 'Loading Hogwarts · Gryffindor Common Room...',
        loading_hp_dumb: 'Loading Hogwarts · Dumbledore\'s Office...',
        loading_lotr: 'Loading Minas Tirith (optimizing geometry)...',
        loading_sw: 'Loading Jedi Council Chamber (Coruscant)...',
        mafia_active: '🎥 Cinematic Camera (Active)',
        mafia_timer: '🎥 Auto-Camera ({s}s)',
        // Hogwarts panel
        hp_gryff: '🦁 Gryffindor',
        hp_dumb: '🦉 Dumbledore\'s Office',
        hp_auto: '⏳ Auto-Switch (45s)',
        hp_auto_title: 'Auto-switch rooms every 45 seconds',
        // LOTR panel
        lotr_streets: '🏰 Streets & Walls',
        lotr_tree: '🌳 White Tree',
        lotr_eagle: '🦅 Eagle Flight',
        lotr_cycle: '🎬 Director Mode (Cycle)',
        // Star Wars panel
        sw_captain: '🎖️ Captain Stormtrooper',
        sw_yoda: '🧙 Master Yoda',
        sw_r2d2: '🤖 R2-D2',
        sw_k2so: '🦾 K-2SO Droid',
        sw_dancing: '💃 Dancing Trooper',
        sw_add_folder: '📂 Add Folder (.GLB)',
        sw_folder_title: 'Add custom .GLB models from folder',
        sw_no_models_found: 'No .GLB or .GLTF files found in selected folder!',
        // YouTube modal
        btn_youtube: '🔗 YouTube',
        btn_youtube_label: 'YouTube',
        yt_modal_title: 'YouTube Music Loader',
        yt_btn_find: '🔍 Find',
        yt_loading_info: 'Fetching video details...',
        yt_btn_stream: '⚡ Play Instantly',
        yt_btn_download: '💾 Download MP3 (320k)',
        yt_library_title: '📁 Saved Library',
        yt_library_empty: 'No downloaded tracks yet',
        yt_invalid_url: 'Please enter a valid YouTube link',
        yt_error_fetching: 'Failed to retrieve video details'
    },
    ru: {
        page_title: 'נגן קו הרקיע · Мульти-вселенский 3D/2D Визуализатор',
        intro_title_1: 'Линия горизонта',
        intro_title_2: 'Города',
        intro_desc: 'Музыка уже загружена. Нажмите «Играть», и огни города будут пульсировать в такт треку. Автомобили едут по шоссе, люди гуляют в парке, а день сменяется ночью. Плеер работает по кругу до авто-остановки.',
        btn_play_music: '▶ Играть музыку',
        btn_choose_device: 'Выбрать другой файл',
        intro_worlds_note: 'В меню «Мир» можно переключиться на Заснеженный Север, Средневековую деревню, Покои Йеннифэр, Хогвартс, Минас Тирит или Совет Джедаев.',
        intro_keys_note: '<kbd>Пробел</kbd> Пауза/Старт · <kbd>F</kbd> Полный экран · Панель скрывается через 3.5 секунды без движения',
        aria_play: 'Воспроизведение/Пауза',
        track_default: 'Cities Skylines 2 · Нажмите Play',
        ctl_volume: 'Громкость',
        ctl_react: 'Чувствительность',
        ctl_stop_after: 'Авто-выключение',
        stop_0: 'Без остановки',
        stop_1: 'Через 1 час',
        stop_2: 'Через 2 часа',
        stop_4: 'Через 4 часа',
        stop_8: 'Через 8 часов',
        ctl_world: 'Мир',
        world_city: '2D Небоскребы',
        world_north: '2D Снежный Север',
        world_medieval: '2D Средневековая деревня',
        world_yennefer: 'Ведьмак · Покои Йеннифэр',
        world_harry_potter: 'Гарри Поттер · Хогвартс',
        world_lotr: 'Властелин Колец · Минас Тирит',
        world_star_wars: 'Звездные Войны · Совет Джедаев',
        ctl_cycle: 'День и Ночь',
        cycle_600: '10-минутный цикл',
        cycle_1800: '30-минутный цикл',
        cycle_3600: 'Часовой цикл',
        cycle_real: 'Реальное время',
        cycle_night: 'Всегда ночь',
        cycle_day: 'Всегда день',
        ctl_language: 'Язык',
        btn_choose_file: 'Другой файл',
        btn_fullscreen: 'Полный экран',
        drop_overlay: 'Перетащите аудиофайл сюда',
        loading_world: 'Загрузка 3D Мира...',
        loading_yennefer: 'Загрузка Каэр Морхен · Покои Йеннифэр...',
        loading_hp_gryff: 'Загрузка Хогвартс · Гостиная Гриффиндора...',
        loading_hp_dumb: 'Загрузка Хогвартс · Кабинет Дамблдора...',
        loading_lotr: 'Загрузка и оптимизация Минас Тирит (слияние геометрий)...',
        loading_sw: 'Загрузка Зала Совета Джедаев (Корусант)...',
        mafia_active: '🎥 Кинематографичная камера (Активна)',
        mafia_timer: '🎥 Авто-камера ({s}с)',
        // Hogwarts panel
        hp_gryff: '🦁 Гриффиндор',
        hp_dumb: '🦉 Кабинет Дамблдора',
        hp_auto: '⏳ Авто-смена (45с)',
        hp_auto_title: 'Авто-смена комнат каждые 45 секунд',
        // LOTR panel
        lotr_streets: '🏰 По улицам и стенам',
        lotr_tree: '🌳 К Белому Древу',
        lotr_eagle: '🦅 Полет за птицей',
        lotr_cycle: '🎬 Авто-режиссер (Цикл)',
        // Star Wars panel
        sw_captain: '🎖️ Капитан Штурмовиков',
        sw_yoda: '🧙 Магистр Йода',
        sw_r2d2: '🤖 R2-D2',
        sw_k2so: '🦾 Дроид K-2SO',
        sw_dancing: '💃 Танцующий Штурмовик',
        sw_add_folder: '📂 Добавить папку (.GLB)',
        sw_folder_title: 'Добавить свои .GLB модели из выбранной папки',
        sw_no_models_found: 'В выбранной папке не найдено файлов .GLB или .GLTF!',
        // YouTube modal
        btn_youtube: '🔗 YouTube',
        btn_youtube_label: 'YouTube',
        yt_modal_title: 'Загрузка музыки из YouTube',
        yt_btn_find: '🔍 Найти',
        yt_loading_info: 'Получение данных о видео...',
        yt_btn_stream: '⚡ Слушать сразу',
        yt_btn_download: '💾 Скачать MP3 (320k)',
        yt_library_title: '📁 Сохранённая музыка',
        yt_library_empty: 'Пока нет сохранённых треков',
        yt_invalid_url: 'Пожалуйста, укажите верную ссылку на YouTube',
        yt_error_fetching: 'Не удалось получить данные о видео'
    },
    he: {
        page_title: 'נגן קו הרקיע · ויזואלייזר תלת-ממד ודו-ממד רב-יקומי',
        intro_title_1: 'קו הרקיע',
        intro_title_2: 'של העיר',
        intro_desc: 'המוזיקה שלך כבר בפנים. לחץ על נגן, והעיר תדליק ותכבה אורות לפי המוזיקה. מכוניות נוסעות בכביש, אנשים מטיילים בפארק, והיום והלילה מתחלפים. הנגינה ממשיכה בלופ עד לעצירה האוטומטית.',
        btn_play_music: '▶ נגן את המוזיקה',
        btn_choose_device: 'קובץ אחר מהמכשיר',
        intro_worlds_note: 'בתפריט "עולם" אפשר לעבור לצפון מושלג, לכפר ימי-ביניים, לחדר של ינפר, להוגוורטס, למינאס טירית או למועצת הג\'דיי.',
        intro_keys_note: '<kbd>רווח</kbd> ניגון/השהיה · <kbd>F</kbd> מסך מלא · הפקדים נעלמים אחרי 3.5 שניות בלי תזוזה',
        aria_play: 'ניגון/השהיה',
        track_default: 'Cities Skylines 2 · לחץ על ניגון',
        ctl_volume: 'עוצמה',
        ctl_react: 'רגישות',
        ctl_stop_after: 'כיבוי אוטומטי',
        stop_0: 'בלי',
        stop_1: 'אחרי שעה',
        stop_2: 'אחרי שעתיים',
        stop_4: 'אחרי 4 שעות',
        stop_8: 'אחרי 8 שעות',
        ctl_world: 'עולם',
        world_city: '2D קו רקיע של עיר',
        world_north: '2D צפון מושלג',
        world_medieval: '2D כפר ימי-ביניים',
        world_yennefer: 'Witcher · החדר של ינפר',
        world_harry_potter: 'Harry Potter · הוגוורטס',
        world_lotr: 'LOTR · מינאס טירית והעץ הלבן',
        world_star_wars: 'Star Wars · מועצת הג\'דיי',
        ctl_cycle: 'יום ולילה',
        cycle_600: 'מחזור של 10 דקות',
        cycle_1800: 'מחזור של 30 דקות',
        cycle_3600: 'מחזור של שעה',
        cycle_real: 'לפי השעה האמיתית',
        cycle_night: 'תמיד לילה',
        cycle_day: 'תמיד יום',
        ctl_language: 'שפה',
        btn_choose_file: 'קובץ אחר',
        btn_fullscreen: 'מסך מלא',
        drop_overlay: 'שחרר כאן את הקובץ',
        loading_world: 'טוען עולם תלת-ממד...',
        loading_yennefer: 'טוען קאר מורהן · החדר של ינפר...',
        loading_hp_gryff: 'טוען הוגוורטס · חדר המועדון של גריפינדור...',
        loading_hp_dumb: 'טוען הוגוורטס · משרדו של דמבלדור...',
        loading_lotr: 'טוען מינאס טירית (ממזג גיאומטריה)...',
        loading_sw: 'טוען מועצת הג\'דיי (קורוסנט)...',
        mafia_active: '🎥 מצב קולנועי (פעיל)',
        mafia_timer: '🎥 מצלמה אוטומטית ({s} שנ\')',
        // Hogwarts panel
        hp_gryff: '🦁 גריפינדור',
        hp_dumb: '🦉 משרדו של דמבלדור',
        hp_auto: '⏳ החלפה אוטומטית (45 שניות)',
        hp_auto_title: 'החלפת חדרים אוטומטית כל 45 שניות',
        // LOTR panel
        lotr_streets: '🏰 רחובות וחומות',
        lotr_tree: '🌳 העץ הלבן',
        lotr_eagle: '🦅 טיסה עם הנשר',
        lotr_cycle: '🎬 מצב במאי (מחזורי)',
        // Star Wars panel
        sw_captain: '🎖️ קפטן סטורמטרופר',
        sw_yoda: '🧙 מאסטר יודה',
        sw_r2d2: '🤖 R2-D2',
        sw_k2so: '🦾 דרואיד K-2SO',
        sw_dancing: '💃 טרופר רוקד',
        sw_add_folder: '📂 הוסף תיקייה (.GLB)',
        sw_folder_title: 'הוסף מודלים .GLB מתיקייה מקומית',
        sw_no_models_found: 'לא נמצאו קובצי .GLB או .GLTF בתיקייה שנבחרה!',
        // YouTube modal
        btn_youtube: '🔗 יוטיוב',
        btn_youtube_label: 'יוטיוב',
        yt_modal_title: 'טוען מוזיקה מיוטיוב',
        yt_btn_find: '🔍 מצא',
        yt_loading_info: 'טוען פרטי סרטון...',
        yt_btn_stream: '⚡ השמע מיידית',
        yt_btn_download: '💾 הורד MP3 (320k)',
        yt_library_title: '📁 רצועות שמורות',
        yt_library_empty: 'אין עדיין רצועות שמורות',
        yt_invalid_url: 'נא להזין קישור תקין ליוטיוב',
        yt_error_fetching: 'טעינת פרטי הסרטון נכשלה'
    }
};

let currentLanguage = 'en'; // Default to English as requested
const changeCallbacks = new Set();

export function getCurrentLanguage() {
    return currentLanguage;
}

export function t(key, params = {}) {
    const langDict = TRANSLATIONS[currentLanguage] || TRANSLATIONS.en;
    let text = langDict[key] || TRANSLATIONS.en[key] || key;
    for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
    return text;
}

export function onLanguageChange(fn) {
    changeCallbacks.add(fn);
    return () => changeCallbacks.delete(fn);
}

export function setLanguage(lang) {
    if (!TRANSLATIONS[lang]) lang = 'en';
    currentLanguage = lang;
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('vibeplayer_lang', lang);
        }
    } catch (e) {}

    const isRtl = (lang === 'he');

    if (typeof document !== 'undefined') {
        // Update document language and text direction
        document.documentElement.lang = lang;
        document.documentElement.dir = isRtl ? 'rtl' : 'ltr';

        const introEl = document.getElementById('intro');
        if (introEl) introEl.dir = isRtl ? 'rtl' : 'ltr';

        const uiEl = document.getElementById('ui');
        if (uiEl) uiEl.dir = isRtl ? 'rtl' : 'ltr';

        // Update document title
        document.title = t('page_title');

        // Update all elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach((el) => {
            const key = el.getAttribute('data-i18n');
            el.innerHTML = t(key);
        });

        // Update all elements with data-i18n-title
        document.querySelectorAll('[data-i18n-title]').forEach((el) => {
            const key = el.getAttribute('data-i18n-title');
            el.title = t(key);
        });

        // Update all elements with data-i18n-aria
        document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
            const key = el.getAttribute('data-i18n-aria');
            el.setAttribute('aria-label', t(key));
        });

        // Update language select in bottom bar
        const langSelect = document.getElementById('langSelect');
        if (langSelect && langSelect.value !== lang) {
            langSelect.value = lang;
        }

        // Update language pills in intro and anywhere else
        document.querySelectorAll('.lang-pill').forEach((btn) => {
            btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
        });
    }

    // Notify listeners
    changeCallbacks.forEach((fn) => {
        try { fn(lang); } catch (err) { console.error('Error in language listener:', err); }
    });
}

export function initI18n() {
    let saved = 'en';
    try {
        if (typeof localStorage !== 'undefined') {
            saved = localStorage.getItem('vibeplayer_lang') || 'en';
        }
    } catch (e) {}
    setLanguage(saved);
}
