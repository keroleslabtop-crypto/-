const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = process.env.VERCEL
  ? path.join(require('os').tmpdir(), 'competition.db')
  : path.join(__dirname, 'competition.db');
const db = new Database(dbPath);

// Enable foreign keys and WAL mode for reliability
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      church TEXT,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'contestant', -- 'admin' or 'contestant'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id INTEGER PRIMARY KEY, -- 1 to 21
      number INTEGER UNIQUE NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      text_content TEXT NOT NULL,
      video_url TEXT,
      video_title TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chapter_id INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      options_json TEXT NOT NULL, -- JSON array e.g. ["أ", "ب", "ج", "د"]
      correct_index INTEGER NOT NULL, -- 0-based
      explanation TEXT,
      points INTEGER DEFAULT 10,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      chapter_id INTEGER NOT NULL,
      score INTEGER NOT NULL,
      max_score INTEGER NOT NULL,
      time_spent_seconds INTEGER NOT NULL,
      answers_json TEXT,
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_progress (
      user_id INTEGER PRIMARY KEY,
      last_chapter_id INTEGER DEFAULT 1,
      total_score INTEGER DEFAULT 0,
      total_time_seconds INTEGER DEFAULT 0,
      completed_chapters_count INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT
    );
  `);
}

const chapterTitles = [
  { num: 1, title: 'الأصحاح الأول', sub: 'في البدء كان الكلمة، وشهادة المعمدان، ودعوة التلاميذ الأولين' },
  { num: 2, title: 'الأصحاح الثاني', sub: 'عرس قانا الجليل، وتطهير الهيكل' },
  { num: 3, title: 'الأصحاح الثالث', sub: 'حديث الرب يسوع مع نيقوديموس، وولادة الروح' },
  { num: 4, title: 'الأصحاح الرابع', sub: 'المسيح والسامرية عند بئر يعقوب، وشفاء ابن خادم الملك' },
  { num: 5, title: 'الأصحاح الخامس', sub: 'شفاء مريض بركة بيت حسدا يوم السبت، وسلطان الابن' },
  { num: 6, title: 'الأصحاح السادس', sub: 'معجزة إشباع الخمسة آلاف، والمسيح خبز الحياة' },
  { num: 7, title: 'الأصحاح السابع', sub: 'يسوع في عيد المظال: إن عطش أحد فليقبل إليّ ويشرب' },
  { num: 8, title: 'الأصحاح الثامن', sub: 'المرأة الممسكة في زنا، وأنا هو نور العالم والحق يحرركم' },
  { num: 9, title: 'الأصحاح التاسع', sub: 'شفاء المولود أعمى عند بركة سلوام' },
  { num: 10, title: 'الأصحاح العاشر', sub: 'أنا هو الراعي الصالح، والراعي يبذل نفسه عن الخراف' },
  { num: 11, title: 'الأصحاح الحادي عشر', sub: 'إقامة لعازر من بين الأموات بعد أربعة أيام' },
  { num: 12, title: 'الأصحاح الثاني عشر', sub: 'سكب الطيب في بيت عنيا، ودخول أورشليم الانتصاري' },
  { num: 13, title: 'الأصحاح الثالث عشر', sub: 'غسل أرجل التلاميذ في العلية، ووصية المحبة الجديدة' },
  { num: 14, title: 'الأصحاح الرابع عشر', sub: 'أنا هو الطريق والحق والحياة، والوعد بالمعزي الروح القدس' },
  { num: 15, title: 'الأصحاح الخامس عشر', sub: 'أنا الكرمة الحقيقية وأنتم الأغصان، اثبتوا فيّ' },
  { num: 16, title: 'الأصحاح السادس عشر', sub: 'عمل الروح القدس في العالم وفي الكنيسة، وثقة الغلبة' },
  { num: 17, title: 'الأصحاح السابع عشر', sub: 'الصلاة الشفاعية الوداعية للرب يسوع المسيح' },
  { num: 18, title: 'الأصحاح الثامن عشر', sub: 'القبض على يسوع في البستان، ومحاكمته أمام قيافا وبيلاطس' },
  { num: 19, title: 'الأصحاح التاسع عشر', sub: 'صلب السيد المسيح، وموته المحيي، ودفنه في القبر الجديد' },
  { num: 20, title: 'الأصحاح العشرون', sub: 'قيامة المسيح المجيدة، وظهوره لمريم المجدلية وللتلاميذ ولتوما' },
  { num: 21, title: 'الأصحاح الحادي والعشرون', sub: 'ظهور الرب عند بحيرة طبرية، وسؤال بطرس: أتحبني؟ ورعاية الخراف' }
];

// Seed initial data if tables are empty
function seedData() {
  // Check if admin exists
  const adminExists = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
  if (!adminExists) {
    const adminPassword = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? null : 'admin123');
    if (!adminPassword) {
      throw new Error('Set ADMIN_PASSWORD before starting the production server.');
    }
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(adminPassword, salt);
    db.prepare(`
      INSERT INTO users (username, full_name, church, phone, password_hash, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('admin', 'مسؤول المسابقة (الأدمن)', 'كنيسة مارجرجس', '01000000000', hash, 'admin');
    console.log('Admin user created.');
  }

  // Check if chapters exist
  const chapterCount = db.prepare('SELECT COUNT(*) as count FROM chapters').get().count;
  if (chapterCount < 21) {
    console.log('Seeding 21 chapters...');
    const insertChapter = db.prepare(`
      INSERT OR REPLACE INTO chapters (id, number, title, subtitle, text_content, video_url, video_title)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // Standard sample text for John's Gospel (21 chapters)
    const sampleTexts = {
      1: `١ فِي الْبَدْءِ كَانَ الْكَلِمَةُ، وَالْكَلِمَةُ كَانَ عِنْدَ اللهِ، وَكَانَ الْكَلِمَةُ اللهَ.
٢ هذَا كَانَ فِي الْبَدْءِ عِنْدَ اللهِ.
٣ كُلُّ شَيْءٍ بِهِ كَانَ، وَبِغَيْرِهِ لَمْ يَكُنْ شَيْءٌ مِمَّا كَانَ.
٤ فِيهِ كَانَتِ الْحَيَاةُ، وَالْحَيَاةُ كَانَتْ نُورَ النَّاسِ،
٥ وَالنُّورُ يُضِيءُ فِي الظُّلْمَةِ، وَالظُّلْمَةُ لَمْ تُدْرِكْهُ.
٦ كَانَ إِنْسَانٌ مُرْسَلٌ مِنَ اللهِ اسْمُهُ يُوحَنَّا.
٧ هذَا جَاءَ لِلشَّهَادَةِ لِيَشْهَدَ لِلنُّورِ، لِكَيْ يُؤْمِنَ الْكُلُّ بِوَاسِطَتِهِ.
٨ لَمْ يَكُنْ هُوَ النُّورَ، بَلْ لِيَشْهَدَ لِلنُّورِ.
٩ كَانَ النُّورُ الْحَقِيقِيُّ الَّذِي يُنِيرُ كُلَّ إِنْسَانٍ آتِيًا إِلَى الْعَالَمِ.
١٠ كَانَ فِي الْعَالَمِ، وَكُوِّنَ الْعَالَمُ بِهِ، وَلَمْ يَعْرِفْهُ الْعَالَمُ.
١١ إِلَى خَاصَّتِهِ جَاءَ، وَخَاصَّتُهُ لَمْ تَقْبَلْهُ.
١٢ وَأَمَّا كُلُّ الَّذِينَ قَبِلُوهُ فَأَعْطَاهُمْ سُلْطَانًا أَنْ يَصِيرُوا أَوْلاَدَ اللهِ، أَيِ الْمُؤْمِنُونَ بِاسْمِهِ.
١٣ اَلَّذِينَ وُلِدُوا لَيْسَ مِنْ دَمٍ، وَلاَ مِنْ مَشِيئَةِ جَسَدٍ، وَلاَ مِنْ مَشِيئَةِ رَجُلٍ، بَلْ مِنَ اللهِ.
١٤ وَالْكَلِمَةُ صَارَ جَسَدًا وَحَلَّ بَيْنَنَا، وَرَأَيْنَا مَجْدَهُ، مَجْدًا كَمَا لِوَحِيدٍ مِنَ الآبِ، مَمْلُوءًا نِعْمَةً وَحَقًّا.`,

      2: `١ وَفِي الْيَوْمِ الثَّالِثِ كَانَ عُرْسٌ فِي قَانَا الْجَلِيلِ، وَكَانَتْ أُمُّ يَسُوعَ هُنَاكَ.
٢ وَدُعِيَ أَيْضًا يَسُوعُ وَتَلاَمِيذُهُ إِلَى الْعُرْسِ.
٣ وَلَمَّا فَرَغَتِ الْخَمْرُ، قَالَتْ أُمُّ يَسُوعَ لَهُ: «لَيْسَ لَهُمْ خَمْرٌ».
٤ قَالَ لَهَا يَسُوعُ: «مَا لِي وَلَكِ يَا امْرَأَةُ؟ لَمْ تَأْتِ سَاعَتِي بَعْدُ».
٥ قَالَتْ أُمُّهُ لِلْخُدَّامِ: «مَهْمَا قَالَ لَكُمْ فَافْعَلُوهُ».
٦ وَكَانَتْ هُنَاكَ سِتَّةُ أَجْرَانٍ مِنْ حِجَارَةٍ مَوْضُوعَةً حَسَبَ تَطْهِيرِ الْيَهُودِ، يَسَعُ كُلُّ وَاحِدٍ مِطْرَيْنِ أَوْ ثَلاَثَةً.
٧ قَالَ لَهُمْ يَسُوعُ: «امْلأُوا الأَجْرَانَ مَاءً». فَمَلأُوهَا إِلَى فَوْقُ.
٨ ثُمَّ قَالَ لَهُمُ: «اسْتَقُوا الآنَ وَقَدِّمُوا إِلَى رَئِيسِ الْمُتَّكَإِ». فَقَدَّمُوا.
٩ فَلَمَّا ذَاقَ رَئِيسُ الْمُتَّكَإِ الْمَاءَ الْمُتَحَوِّلَ خَمْرًا، دَعَا الْعَرِيسَ
١٠ وَقَالَ لَهُ: «كُلُّ إِنْسَانٍ إِنَّمَا يَضَعُ الْخَمْرَ الْجَيِّدَةَ أَوَّلاً، وَمَتَى سَكِرُوا فَحِينَئِذٍ الدُّونَ. أَمَّا أَنْتَ فَقَدْ حَفِظْتَ الْخَمْرَ الْجَيِّدَةَ إِلَى الآنَ!».
١١ هذِهِ بِدَايَةُ الآيَاتِ فَعَلَهَا يَسُوعُ فِي قَانَا الْجَلِيلِ، وَأَظْهَرَ مَجْدَهُ، فَآمَنَ بِهِ تَلاَمِيذُهُ.`,

      3: `١ كَانَ إِنْسَانٌ مِنَ الْفَرِّيسِيِّينَ اسْمُهُ نِيقُودِيمُوسُ، رَئِيسٌ لِلْيَهُودِ.
٢ هذَا جَاءَ إِلَى يَسُوعَ لَيْلاً وَقَالَ لَهُ: «يَا مُعَلِّمُ، نَعْلَمُ أَنَّكَ قَدْ أَتَيْتَ مِنَ اللهِ مُعَلِّمًا، لأَنَّ لَيْسَ أَحَدٌ يَقْدِرُ أَنْ يَعْمَلَ هذِهِ الآيَاتِ الَّتِي أَنْتَ تَعْمَلُ إِنْ لَمْ يَكُنِ اللهُ مَعَهُ».
٣ أَجَابَ يَسُوعُ وَقَالَ لَهُ: «الْحَقَّ الْحَقَّ أَقُولُ لَكَ: إِنْ كَانَ أَحَدٌ لاَ يُولَدُ مِنْ فَوْقُ لاَ يَقْدِرُ أَنْ يَرَى مَلَكُوتَ اللهِ».
١٦ لأَنَّهُ هكَذَا أَحَبَّ اللهُ الْعَالَمَ حَتَّى بَذَلَ ابْنَهُ الْوَحِيدَ، لِكَيْ لاَ يَهْلِكَ كُلُّ مَنْ يُؤْمِنُ بِهِ، بَلْ تَكُونُ لَهُ الْحَيَاةُ الأَبَدِيَّةُ.
١٧ لأَنَّهُ لَمْ يُرْسِلِ اللهُ ابْنَهُ إِلَى الْعَالَمِ لِيَدِينَ الْعَالَمَ، بَلْ لِيَخْلُصَ بِهِ الْعَالَمُ.`
    };

    const defaultVideo = 'https://www.youtube.com/embed/dQw4w9WgXcQ'; // placeholder video or embed link

    for (const ch of chapterTitles) {
      const text = sampleTexts[ch.num] || `نص ${ch.title} المبارك:
١ هذَا هُوَ كَلاَمُ اللهِ الْحَيُّ الْمُقَدَّسُ الَّذِي يُنِيرُ دُرُوبَنَا.
٢ مَكْتُوبٌ لِتَعْلِيمِنَا وَبُنْيَانِنَا الرُّوحِيِّ فِي النِّعْمَةِ وَالْمَعْرِفَةِ.
٣ «كَلِمَتُكَ مِصْبَاحٌ لِرِجْلِي وَنُورٌ لِسَبِيلِي».
(يمكن للأدمن تحرير النص الكامل لهذا الأصحاح من لوحة الإدارة بكل سهولة)`;

      insertChapter.run(
        ch.num,
        ch.num,
        ch.title,
        ch.sub,
        text,
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // editable via admin
        `شرح وتأمل روحي في ${ch.title}`
      );
    }
  }

  // Seed sample questions for chapters if empty
  const qCount = db.prepare('SELECT COUNT(*) as count FROM questions').get().count;
  if (qCount === 0) {
    console.log('Seeding quiz questions for chapters...');
    const insertQ = db.prepare(`
      INSERT INTO questions (chapter_id, question_text, options_json, correct_index, explanation, points)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Questions for Chapter 1
    insertQ.run(
      1,
      'في مطلع الأصحاح الأول: «في البدء كان الكلمة، والكلمة كان عند الله، وكان الكلمة...»؟',
      JSON.stringify(['نبياً', 'اللهَ', 'ملاكاً', 'إنساناً']),
      1,
      'يوحنا ١: ١ - وكان الكلمة الله',
      10
    );
    insertQ.run(
      1,
      'ماذا كانت الحياة بالنسبة للناس في الأصحاح الأول؟',
      JSON.stringify(['طعام الناس', 'نور الناس', 'قوة الناس', 'فرح الناس']),
      1,
      'يوحنا ١: ٤ - فِيهِ كَانَتِ الْحَيَاةُ، وَالْحَيَاةُ كَانَتْ نُورَ النَّاسِ',
      10
    );
    insertQ.run(
      1,
      'من هو الإنسان المرسل من الله الذي جاء ليشهد للنور؟',
      JSON.stringify(['بطرس', 'يوحنا المعمدان', 'أندراوس', 'نيقوديموس']),
      1,
      'يوحنا ١: ٦ - كَانَ إِنْسَانٌ مُرْسَلٌ مِنَ اللهِ اسْمُهُ يُوحَنَّا',
      10
    );
    insertQ.run(
      1,
      '«وَأَمَّا كُلُّ الَّذِينَ قَبِلُوهُ فَأَعْطَاهُمْ سُلْطَانًا أَنْ يَصِيرُوا...»؟',
      JSON.stringify(['ملوكاً على الأرض', 'أَوْلاَدَ اللهِ', 'رؤساء كهنة', 'حكماء الدهر']),
      1,
      'يوحنا ١: ١٢ - سُلْطَانًا أَنْ يَصِيرُوا أَوْلاَدَ اللهِ، أَيِ الْمُؤْمِنُونَ بِاسْمِهِ',
      10
    );

    // Questions for Chapter 2
    insertQ.run(
      2,
      'أين حدثت معجزة تحويل الماء إلى خمر؟',
      JSON.stringify(['في أورشليم', 'في قانا الجليل', 'في كفرناحوم', 'في بيت عنيا']),
      1,
      'يوحنا ٢: ١ - كَانَ عُرْسٌ فِي قَانَا الْجَلِيلِ',
      10
    );
    insertQ.run(
      2,
      'ماذا قالت القديسة العذراء مريم للخدام في عرس قانا الجليل؟',
      JSON.stringify(['اذهبوا واشتروا خمراً', 'مهما قال لكم فافعلوه', 'لا تقلقوا ولا تخافوا', 'أخبروا رئيس المتكإ']),
      1,
      'يوحنا ٢: ٥ - قَالَتْ أُمُّهُ لِلْخُدَّامِ: «مَهْمَا قَالَ لَكُمْ فَافْعَلُوهُ»',
      10
    );
    insertQ.run(
      2,
      'كم كان عدد الأجران الحجرية الموضوعة للتطهير؟',
      JSON.stringify(['ثلاثة', 'سبعة', 'ستة أجران', 'اثنا عشر جرناً']),
      2,
      'يوحنا ٢: ٦ - وَكَانَتْ هُنَاكَ سِتَّةُ أَجْرَانٍ مِنْ حِجَارَةٍ',
      10
    );

    // Questions for Chapter 3
    insertQ.run(
      3,
      'من هو رئيس اليهود الذي جاء إلى يسوع ليلاً؟',
      JSON.stringify(['قيافا', 'حنانيا', 'نيقوديموس', 'غمالائيل']),
      2,
      'يوحنا ٣: ١ - كَانَ إِنْسَانٌ مِنَ الْفَرِّيسِيِّينَ اسْمُهُ نِيقُودِيمُوسُ',
      10
    );
    insertQ.run(
      3,
      '«لأَنَّهُ هكَذَا أَحَبَّ اللهُ الْعَالَمَ حَتَّى بَذَلَ...»؟',
      JSON.stringify(['ملاكه الشديد', 'ابْنَهُ الْوَحِيدَ', 'أنبياءه ورسله', 'خيرات الأرض']),
      1,
      'يوحنا ٣: ١٦ - حَتَّى بَذَلَ ابْنَهُ الْوَحِيدَ لِكَيْ لاَ يَهْلِكَ كُلُّ مَنْ يُؤْمِنُ بِهِ',
      10
    );

    // Add generic questions for chapters 4 to 21 so every chapter has a functional quiz ready
    for (let i = 4; i <= 21; i++) {
      insertQ.run(
        i,
        `سؤال تدريبي على ${chapterTitles[i - 1].title}: ما هو الموضوع الأساسي لهذا الأصحاح؟`,
        JSON.stringify([
          chapterTitles[i - 1].sub,
          'أنساب ملوك إسرائيل القديمة',
          'بناء أسوار أورشليم زمن نحميا',
          'شرائع التطهير في العهد القديم'
        ]),
        0,
        `يدور ${chapterTitles[i - 1].title} حول: ${chapterTitles[i - 1].sub}`,
        10
      );
      insertQ.run(
        i,
        `سؤال تأملي في آيات ${chapterTitles[i - 1].title}: كيف نطبق وصايا المسيح في هذا الأصحاح في حياتنا اليومية؟`,
        JSON.stringify([
          'بالمحبة العملية والثبات في النعمة والإيمان',
          'بالجدال والمناقشات العقيمة',
          'بالاكتفاء بالقراءة السطحية دون عمل',
          'بتجاهل صوت الروح القدس'
        ]),
        0,
        'يدعونا الكتاب المقدس إلى الإيمان العامل بالمحبة وحفظ الوصايا',
        10
      );
    }
  }

  // Seed sample contestants for the Leaderboard demonstration
  const contestantCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('contestant').count;
  if (contestantCount === 0) {
    console.log('Seeding demo contestants...');
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('123456', salt);

    const contestants = [
      { user: 'fadi_george', name: 'فادي جورج ميخائيل', church: 'كنيسة السيدة العذراء مريم - سموحة', score: 90, time: 145, ch: 9 },
      { user: 'mirna_samir', name: 'ميرنا سمير فؤاد', church: 'كنيسة مارمرقس - كليوباترا', score: 90, time: 182, ch: 9 },
      { user: 'peter_nabil', name: 'بيتر نبيل زكي', church: 'كنيسة رئيس الملائكة ميخائيل', score: 80, time: 120, ch: 8 },
      { user: 'maria_emad', name: 'ماريا عماد رشدي', church: 'كنيسة الشهيد العظيم مارجرجس', score: 70, time: 110, ch: 7 },
      { user: 'mina_adel', name: 'مينا عادل لبيب', church: 'كنيسة القديس الأنبا أنطونيوس', score: 60, time: 95, ch: 6 },
      { user: 'kyrillos_n', name: 'كيرلس ناجي صليب', church: 'كنيسة القديسة دميانة', score: 50, time: 80, ch: 5 },
      { user: 'veronica_m', name: 'فيرونيكا مجدي حنا', church: 'كنيسة العذراء والملاك رافائيل', score: 40, time: 65, ch: 4 },
      { user: 'john_youssef', name: 'جون يوسف غالي', church: 'كنيسة الشهيد أبي سيفين', score: 30, time: 50, ch: 3 }
    ];

    const insertUser = db.prepare(`
      INSERT INTO users (username, full_name, church, phone, password_hash, role)
      VALUES (?, ?, ?, ?, ?, 'contestant')
    `);
    const insertProgress = db.prepare(`
      INSERT INTO user_progress (user_id, last_chapter_id, total_score, total_time_seconds, completed_chapters_count)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const c of contestants) {
      const res = insertUser.run(c.user, c.name, c.church, '0123456789', hash);
      insertProgress.run(res.lastInsertRowid, c.ch, c.score, c.time, Math.floor(c.score / 10));
    }
  }
}

initSchema();
seedData();

module.exports = db;
