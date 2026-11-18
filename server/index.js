require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('./db');
const supabase = require('./supabase');
const { JWT_SECRET, authenticateToken, requireAuth, requireAdmin } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

function getLocalUserId(user) {
  if (!user?.username) return null;
  return db.prepare('SELECT id FROM users WHERE username = ?').get(user.username)?.id ?? null;
}

app.use(cors());
app.use(express.json());
app.use(authenticateToken);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ==========================================
// 1. AUTHENTICATION ROUTES (Supabase + Local Sync)
// ==========================================

// Register contestant
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, full_name, church, phone, password } = req.body;

    if (!username || !full_name || !password) {
      return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم، والاسم بالكامل، وكلمة المرور' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanFullName = full_name.trim();
    const cleanChurch = (church || '').trim();
    const cleanPhone = (phone || '').trim();

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    let userId = null;

    if (supabase) {
      // Check if user exists on Supabase
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (existing) {
        return res.status(400).json({ error: 'اسم المستخدم مسجل مسبقاً، يرجى اختيار اسم آخر أو تسجيل الدخول' });
      }

      // Insert into Supabase users table
      const { data: newUser, error: insErr } = await supabase
        .from('users')
        .insert({
          username: cleanUsername,
          full_name: cleanFullName,
          church: cleanChurch,
          phone: cleanPhone,
          password_hash: hash,
          role: 'contestant'
        })
        .select()
        .single();

      if (insErr || !newUser) {
        console.error('Supabase user insert error:', insErr);
        throw new Error('فشل تسجيل المستخدم في قاعدة بيانات سوبابيز');
      }

      userId = newUser.id;

      // Initialize user progress on Supabase
      const { error: progressError } = await supabase.from('user_progress').upsert({
        user_id: userId,
        last_chapter_id: 1,
        total_score: 0,
        total_time_seconds: 0,
        completed_chapters_count: 0
      });
      if (progressError) console.warn('Supabase progress initialization note:', progressError.message);
    }

    // Always mirror in local SQLite for caching and offline fallback
    try {
      const existingLocal = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
      if (!existingLocal) {
        const idInUse = userId && db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
        const info = userId && !idInUse
          ? db.prepare(`INSERT INTO users (id, username, full_name, church, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, ?, 'contestant')`).run(userId, cleanUsername, cleanFullName, cleanChurch, cleanPhone, hash)
          : db.prepare(`INSERT INTO users (username, full_name, church, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, 'contestant')`).run(cleanUsername, cleanFullName, cleanChurch, cleanPhone, hash);
        const localId = existingLocal?.id || (idInUse ? info.lastInsertRowid : userId || info.lastInsertRowid);
        db.prepare(`INSERT OR IGNORE INTO user_progress (user_id, last_chapter_id, total_score, total_time_seconds, completed_chapters_count) VALUES (?, 1, 0, 0, 0)`).run(localId);
      }
    } catch (e) {
      console.warn('Local SQLite sync note:', e.message);
    }

    const userPayload = {
      id: userId,
      username: cleanUsername,
      full_name: cleanFullName,
      church: cleanChurch,
      role: 'contestant'
    };

    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'تم التسجيل بنجاح، مرحباً بك في المسابقة',
      token,
      user: {
        ...userPayload,
        progress: {
          last_chapter_id: 1,
          total_score: 0,
          total_time_seconds: 0,
          completed_chapters_count: 0
        }
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء التسجيل، يرجى المحاولة مرة أخرى' });
  }
});

// Login (contestant or admin)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم وكلمة المرور' });
    }

    const cleanUsername = username.trim().toLowerCase();
    let user = null;
    let progress = null;

    if (supabase) {
      const { data: supaUser } = await supabase
        .from('users')
        .select('*')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (supaUser) {
        user = supaUser;
        const { data: supaProgress } = await supabase
          .from('user_progress')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        progress = supaProgress;
      }
    }

    // Fallback to local DB if not found or no Supabase
    if (!user) {
      user = db.prepare('SELECT * FROM users WHERE username = ?').get(cleanUsername);
      if (user) {
        progress = db.prepare('SELECT * FROM user_progress WHERE user_id = ?').get(user.id);
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    const useDeploymentAdminPassword = process.env.NODE_ENV === 'production'
      && user.role === 'admin'
      && user.username === 'admin';
    let isMatch;
    if (useDeploymentAdminPassword) {
      const expected = Buffer.from(process.env.ADMIN_PASSWORD || '');
      const supplied = Buffer.from(password);
      isMatch = expected.length > 0
        && supplied.length === expected.length
        && crypto.timingSafeEqual(supplied, expected);
    } else {
      isMatch = bcrypt.compareSync(password, user.password_hash);
    }
    // If a cloud account has a stale/bad hash, allow the corresponding local account to authenticate.
    if (!isMatch && !useDeploymentAdminPassword) {
      const localUser = db.prepare('SELECT * FROM users WHERE username = ?').get(cleanUsername);
      if (localUser && bcrypt.compareSync(password, localUser.password_hash)) {
        user = localUser;
        progress = db.prepare('SELECT * FROM user_progress WHERE user_id = ?').get(user.id);
        isMatch = true;
      }
    }
    if (!isMatch) {
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    const userPayload = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      church: user.church,
      role: user.role
    };

    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'تم تسجيل الدخول بنجاح',
      token,
      user: {
        ...userPayload,
        progress: progress || {
          last_chapter_id: 1,
          total_score: 0,
          total_time_seconds: 0,
          completed_chapters_count: 0
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الدخول' });
  }
});

// Current user profile & progress
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    let user = null;
    let progress = null;

    if (supabase) {
      const { data: supaUser } = await supabase
        .from('users')
        .select('id, username, full_name, church, phone, role, created_at')
        .eq('id', req.user.id)
        .maybeSingle();

      user = supaUser;

      if (user) {
        const { data: supaProgress } = await supabase
          .from('user_progress')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        progress = supaProgress;
      }
    }

    if (!user) {
      user = db.prepare('SELECT id, username, full_name, church, phone, role, created_at FROM users WHERE id = ?').get(req.user.id);
      if (user) {
        progress = db.prepare('SELECT * FROM user_progress WHERE user_id = ?').get(user.id);
      }
    }

    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    res.json({
      user: {
        ...user,
        progress: progress || {
          last_chapter_id: 1,
          total_score: 0,
          total_time_seconds: 0,
          completed_chapters_count: 0
        }
      }
    });
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب بيانات المستخدم' });
  }
});

// ==========================================
// 2. CHAPTERS ROUTES (Supabase + Local Sync)
// ==========================================

// Get all 21 chapters list
app.get('/api/chapters', async (req, res) => {
  try {
    let chapters = [];
    let attemptsMap = {};

    if (supabase) {
      const { data: supaChapters } = await supabase
        .from('chapters')
        .select('id, number, title, subtitle, video_url, video_title')
        .order('number', { ascending: true });

      const { data: allQuestions } = await supabase
        .from('questions')
        .select('chapter_id');

      const qCountMap = {};
      (allQuestions || []).forEach(q => {
        qCountMap[q.chapter_id] = (qCountMap[q.chapter_id] || 0) + 1;
      });

      if (req.user) {
        const { data: supaAttempts } = await supabase
          .from('quiz_attempts')
          .select('chapter_id, score, max_score, time_spent_seconds, completed_at')
          .eq('user_id', req.user.id);

        (supaAttempts || []).forEach(a => {
          attemptsMap[a.chapter_id] = a;
        });
      }

      chapters = (supaChapters || []).map(ch => ({
        ...ch,
        question_count: qCountMap[ch.id] || 0,
        has_video: Boolean(ch.video_url && ch.video_url.trim()),
        attempt: attemptsMap[ch.id] || null
      }));
    } else {
      chapters = db.prepare(`
        SELECT 
          c.id, 
          c.number, 
          c.title, 
          c.subtitle, 
          c.video_url, 
          c.video_title,
          (SELECT COUNT(*) FROM questions q WHERE q.chapter_id = c.id) as question_count
        FROM chapters c
        ORDER BY c.number ASC
      `).all();

      if (req.user) {
        const attempts = db.prepare(`
          SELECT chapter_id, score, max_score, time_spent_seconds, completed_at
          FROM quiz_attempts
          WHERE user_id = ?
        `).all(req.user.id);

        attempts.forEach(a => {
          attemptsMap[a.chapter_id] = a;
        });
      }

      chapters = chapters.map(ch => ({
        ...ch,
        has_video: Boolean(ch.video_url && ch.video_url.trim()),
        attempt: attemptsMap[ch.id] || null
      }));
    }

    res.json(chapters);
  } catch (error) {
    console.error('Get chapters error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب قائمة الأصحاحات' });
  }
});

// Get single chapter details
app.get('/api/chapters/:id', async (req, res) => {
  try {
    const chapterId = parseInt(req.params.id, 10);
    let chapter = null;
    let questionCount = 0;
    let userAttempt = null;

    if (supabase) {
      const { data: supaCh } = await supabase
        .from('chapters')
        .select('*')
        .eq('id', chapterId)
        .maybeSingle();

      chapter = supaCh;

      if (chapter) {
        const { count } = await supabase
          .from('questions')
          .select('*', { count: 'exact', head: true })
          .eq('chapter_id', chapterId);

        questionCount = count || 0;

        if (req.user) {
          const { data: attempt } = await supabase
            .from('quiz_attempts')
            .select('*')
            .eq('user_id', req.user.id)
            .eq('chapter_id', chapterId)
            .maybeSingle();

          userAttempt = attempt;
        }
      }
    }

    if (!chapter) {
      chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(chapterId);
      if (chapter) {
        questionCount = db.prepare('SELECT COUNT(*) as count FROM questions WHERE chapter_id = ?').get(chapterId).count;
        if (req.user) {
          userAttempt = db.prepare(`
            SELECT * FROM quiz_attempts 
            WHERE user_id = ? AND chapter_id = ?
            LIMIT 1
          `).get(req.user.id, chapterId);
        }
      }
    }

    if (!chapter) {
      return res.status(404).json({ error: 'الأصحاح غير موجود' });
    }

    res.json({
      ...chapter,
      question_count: questionCount,
      user_attempt: userAttempt
    });
  } catch (error) {
    console.error('Get chapter error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحميل بيانات الأصحاح' });
  }
});

// Update last visited chapter
app.post('/api/user/current-chapter', requireAuth, async (req, res) => {
  try {
    const { chapter_id } = req.body;
    const cid = parseInt(chapter_id, 10);
    if (!cid || cid < 1 || cid > 21) {
      return res.status(400).json({ error: 'رقم أصحاح غير صالح' });
    }

    if (supabase) {
      await supabase
        .from('user_progress')
        .update({ last_chapter_id: cid, updated_at: new Date().toISOString() })
        .eq('user_id', req.user.id);
    }

    const localUserId = getLocalUserId(req.user);
    if (localUserId) db.prepare(`
      UPDATE user_progress 
      SET last_chapter_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(cid, localUserId);

    res.json({ success: true, last_chapter_id: cid });
  } catch (error) {
    console.error('Update current chapter error:', error);
    res.status(500).json({ error: 'تعذر تحديث الأصحاح الحالي' });
  }
});

// ==========================================
// 3. QUIZ ROUTES (With NO RETAKE Rule & Supabase Sync)
// ==========================================

// Get quiz questions for a chapter
app.get('/api/chapters/:id/quiz', async (req, res) => {
  try {
    const schedules = await getQuizSchedules();
    const schedule = getQuizSchedule(parseInt(req.params.id, 10), schedules);
    if (!isQuizOpen(schedule)) return res.status(403).json({ error: getQuizClosedMessage(schedule), quiz_closed: true, schedule });
    const chapterId = parseInt(req.params.id, 10);
    let questions = [];

    if (supabase) {
      const { data: supaQs } = await supabase
        .from('questions')
        .select('id, chapter_id, question_text, options_json, points')
        .eq('chapter_id', chapterId)
        .order('id', { ascending: true });

      questions = (supaQs || []).map(q => ({
        id: q.id,
        chapter_id: q.chapter_id,
        question_text: q.question_text,
        options: Array.isArray(q.options_json) ? q.options_json : JSON.parse(q.options_json || '[]'),
        points: q.points || 10
      }));
    } else {
      const dbQs = db.prepare(`
        SELECT id, chapter_id, question_text, options_json, points
        FROM questions
        WHERE chapter_id = ?
        ORDER BY id ASC
      `).all(chapterId);

      questions = dbQs.map(q => ({
        id: q.id,
        chapter_id: q.chapter_id,
        question_text: q.question_text,
        options: JSON.parse(q.options_json),
        points: q.points || 10
      }));
    }

    res.json({
      chapter_id: chapterId,
      questions,
      total_points: questions.reduce((sum, q) => sum + (q.points || 10), 0)
    });
  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب أسئلة الاختبار' });
  }
});

// Submit quiz answers (STRICT: ONLY 1 ATTEMPT PER CHAPTER - NO RETAKES!)
app.post('/api/chapters/:id/quiz/submit', requireAuth, async (req, res) => {
  try {
    const schedules = await getQuizSchedules();
    const schedule = getQuizSchedule(parseInt(req.params.id, 10), schedules);
    if (!isQuizOpen(schedule)) return res.status(403).json({ error: getQuizClosedMessage(schedule), quiz_closed: true, schedule });
    const chapterId = parseInt(req.params.id, 10);
    const { answers, time_spent_seconds } = req.body;

    // 1. STRICT CHECK: Check if user already took this quiz!
    let existingAttempt = null;

    if (supabase) {
      const { data: attempt } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('user_id', req.user.id)
        .eq('chapter_id', chapterId)
        .maybeSingle();

      existingAttempt = attempt;
    }

    const localUserId = getLocalUserId(req.user);
    if (!existingAttempt && localUserId) {
      existingAttempt = db.prepare('SELECT * FROM quiz_attempts WHERE user_id = ? AND chapter_id = ?').get(localUserId, chapterId);
    }

    if (existingAttempt) {
      return res.status(403).json({
        error: 'لقد قمت بإجراء اختبار هذا الأصحاح مسبقاً! غير مسموح بإعادة الامتحان لضمان النزاهة وتكافؤ الفرص في لوحة المتصدرين.',
        already_completed: true,
        recorded_score: existingAttempt.score,
        recorded_time: existingAttempt.time_spent_seconds
      });
    }

    // 2. Fetch questions with correct answers to grade
    let questions = [];
    if (supabase) {
      const { data: supaQuestions } = await supabase
        .from('questions')
        .select('*')
        .eq('chapter_id', chapterId);
      questions = supaQuestions || [];
    } else {
      questions = db.prepare('SELECT * FROM questions WHERE chapter_id = ?').all(chapterId);
    }

    if (questions.length === 0) {
      return res.status(400).json({ error: 'لا توجد أسئلة مسجلة لهذا الأصحاح حالياً' });
    }

    let calculatedScore = 0;
    let maxScore = 0;
    const reviewDetails = [];

    for (const q of questions) {
      const qPoints = q.points || 10;
      maxScore += qPoints;
      const chosen = answers ? answers[q.id] : undefined;
      const isCorrect = chosen !== undefined && Number(chosen) === Number(q.correct_index);

      if (isCorrect) {
        calculatedScore += qPoints;
      }

      const options = Array.isArray(q.options_json) ? q.options_json : JSON.parse(q.options_json || '[]');

      reviewDetails.push({
        question_id: q.id,
        question_text: q.question_text,
        options,
        chosen_index: chosen !== undefined ? Number(chosen) : null,
        correct_index: q.correct_index,
        is_correct: isCorrect,
        explanation: q.explanation || '',
        points_earned: isCorrect ? qPoints : 0,
        max_points: qPoints
      });
    }

    const timeSpent = Math.max(1, parseInt(time_spent_seconds, 10) || 10);

    // 3. Save Attempt directly in Supabase
    if (supabase) {
      const { error: attemptErr } = await supabase.from('quiz_attempts').insert({
        user_id: req.user.id,
        chapter_id: chapterId,
        score: calculatedScore,
        max_score: maxScore,
        time_spent_seconds: timeSpent,
        answers_json: answers || {}
      });

      if (attemptErr) {
        console.error('Error inserting attempt to Supabase:', attemptErr);
      }

      // Recalculate user progress across all attempts on Supabase
      const { data: allUserAttempts } = await supabase
        .from('quiz_attempts')
        .select('score, time_spent_seconds, chapter_id')
        .eq('user_id', req.user.id);

      const totalScore = (allUserAttempts || []).reduce((sum, a) => sum + (a.score || 0), 0);
      const totalTime = (allUserAttempts || []).reduce((sum, a) => sum + (a.time_spent_seconds || 0), 0);
      const completedCount = (allUserAttempts || []).length;
      const nextChapter = Math.min(21, chapterId + 1);

      await supabase.from('user_progress').upsert({
        user_id: req.user.id,
        last_chapter_id: nextChapter,
        total_score: totalScore,
        total_time_seconds: totalTime,
        completed_chapters_count: completedCount,
        updated_at: new Date().toISOString()
      });
    }

    // Also mirror to local SQLite for backup
    try {
      if (!localUserId) throw new Error('لا يوجد مستخدم محلي مطابق؛ تم حفظ المحاولة في Supabase فقط');
      db.prepare(`
        INSERT INTO quiz_attempts (user_id, chapter_id, score, max_score, time_spent_seconds, answers_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        localUserId,
        chapterId,
        calculatedScore,
        maxScore,
        timeSpent,
        JSON.stringify(answers || {})
      );

      const bestAttempts = db.prepare(`
        SELECT chapter_id, MAX(score) as best_score, MIN(time_spent_seconds) as best_time
        FROM quiz_attempts
        WHERE user_id = ?
        GROUP BY chapter_id
      `).all(localUserId);

      const totalScore = bestAttempts.reduce((sum, a) => sum + a.best_score, 0);
      const totalTime = bestAttempts.reduce((sum, a) => sum + a.best_time, 0);
      const completedCount = bestAttempts.length;
      const nextChapter = Math.min(21, chapterId + 1);

      db.prepare(`
        INSERT OR REPLACE INTO user_progress (user_id, last_chapter_id, total_score, total_time_seconds, completed_chapters_count, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(localUserId, nextChapter, totalScore, totalTime, completedCount);
    } catch (e) {
      console.warn('Local SQLite attempt mirror note:', e.message);
    }

    res.json({
      message: 'تم تسجيل إجاباتك بنجاح في سوبابيز وحفظ درجاتك وسرعتك في لوحة المتصدرين!',
      score: calculatedScore,
      max_score: maxScore,
      percentage: Math.round((calculatedScore / maxScore) * 100),
      time_spent_seconds: timeSpent,
      review: reviewDetails,
      next_chapter_id: Math.min(21, chapterId + 1)
    });
  } catch (error) {
    console.error('Submit quiz error:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء تصحيح الاختبار' });
  }
});

// ==========================================
// 4. LEADERBOARD ROUTE (From Supabase: Rank by Score then Speed)
// ==========================================

app.get('/api/leaderboard', async (req, res) => {
  try {
    let ranked = [];

    if (supabase) {
      // 1. Fetch user_progress joined with users table
      const { data: leaderboard, error: lbErr } = await supabase
        .from('user_progress')
        .select(`
          user_id,
          total_score,
          total_time_seconds,
          completed_chapters_count,
          last_chapter_id,
          users (
            id,
            full_name,
            church,
            role
          )
        `)
        .order('total_score', { ascending: false })
        .order('total_time_seconds', { ascending: true })
        .order('completed_chapters_count', { ascending: false })
        .limit(100);

      if (!lbErr && leaderboard) {
        ranked = leaderboard
          .filter(row => row.users && row.users.role === 'contestant')
          .map((row, index) => ({
            rank: index + 1,
            user_id: row.user_id,
            full_name: row.users.full_name,
            church: row.users.church,
            total_score: row.total_score,
            total_time_seconds: row.total_time_seconds,
            completed_chapters_count: row.completed_chapters_count,
            last_chapter_id: row.last_chapter_id
          }));
      }
    }

    // Fallback to local SQLite if Supabase returns empty or offline
    if (ranked.length === 0) {
      const localLb = db.prepare(`
        SELECT 
          u.id as user_id,
          u.full_name,
          u.church,
          p.total_score,
          p.total_time_seconds,
          p.completed_chapters_count,
          p.last_chapter_id
        FROM user_progress p
        JOIN users u ON u.id = p.user_id
        WHERE u.role = 'contestant'
        ORDER BY p.total_score DESC, p.total_time_seconds ASC, p.completed_chapters_count DESC
        LIMIT 100
      `).all();

      ranked = localLb.map((row, index) => ({
        rank: index + 1,
        ...row
      }));
    }

    res.json(ranked);
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحميل لوحة الشرف والمتصدرين' });
  }
});

// ==========================================
// 5. ADMIN MANAGEMENT ROUTES (Supabase + Local)
// ==========================================

function getLocalQuizSchedules() {
  const row = db.prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'quiz_schedules'").get();
  try { return row?.setting_value ? JSON.parse(row.setting_value) : {}; } catch { return {}; }
}

async function getQuizSchedules() {
  if (supabase) {
    const { data, error } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'quiz_schedules')
      .maybeSingle();
    if (error && !['PGRST205', '42P01'].includes(error.code)) throw error;
    if (error) console.warn('Supabase app_settings table is missing; using local schedule storage until migration is applied.');
    if (data?.setting_value) {
      try { return JSON.parse(data.setting_value); } catch { return {}; }
    }
  }
  return getLocalQuizSchedules();
}

function getQuizSchedule(chapterId, schedules) {

  // Keep schedules configured before per-exam scheduling as the initial default.
  if (Object.hasOwn(schedules, chapterId)) return schedules[chapterId];
  const legacyRow = db.prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'quiz_schedule'").get();
  if (legacyRow?.setting_value) {
    try { return JSON.parse(legacyRow.setting_value); } catch { /* use the open default */ }
  }
  return { opens_at: null, closes_at: null };
}

function isQuizOpen(schedule) {
  const now = Date.now();
  const opens = schedule.opens_at ? Date.parse(schedule.opens_at) : null;
  const closes = schedule.closes_at ? Date.parse(schedule.closes_at) : null;
  return (!opens || now >= opens) && (!closes || now <= closes);
}

function getQuizClosedMessage(schedule) {
  if (schedule.opens_at && Date.now() < Date.parse(schedule.opens_at)) return `الامتحان لم يفتح بعد. موعد الفتح: ${schedule.opens_at}`;
  return `انتهى وقت الامتحان${schedule.closes_at ? ` في ${schedule.closes_at}` : ''}.`;
}

app.get('/api/quiz-schedule', async (req, res) => {
  const chapterId = parseInt(req.query.chapter_id, 10);
  if (!Number.isInteger(chapterId) || chapterId < 1 || chapterId > 21) {
    return res.status(400).json({ error: 'رقم الامتحان غير صحيح' });
  }
  try {
    const schedules = await getQuizSchedules();
    const schedule = getQuizSchedule(chapterId, schedules);
    res.json({ ...schedule, is_open: isQuizOpen(schedule) });
  } catch (error) {
    console.error('Quiz schedule load error:', error);
    res.status(500).json({ error: 'تعذر تحميل مواعيد الامتحان' });
  }
});

app.put('/api/admin/quiz-schedule', requireAdmin, async (req, res) => {
  const chapterId = parseInt(req.body.chapter_id, 10);
  if (!Number.isInteger(chapterId) || chapterId < 1 || chapterId > 21) {
    return res.status(400).json({ error: 'رقم الامتحان غير صحيح' });
  }
  const opensAt = req.body.opens_at || null;
  const closesAt = req.body.closes_at || null;
  if ((opensAt && !Number.isFinite(Date.parse(opensAt))) || (closesAt && !Number.isFinite(Date.parse(closesAt)))) {
    return res.status(400).json({ error: 'صيغة موعد الفتح أو الإغلاق غير صحيحة' });
  }
  if (opensAt && closesAt && Date.parse(opensAt) >= Date.parse(closesAt)) {
    return res.status(400).json({ error: 'موعد الإغلاق يجب أن يكون بعد موعد الفتح' });
  }
  const schedule = { opens_at: opensAt, closes_at: closesAt };
  try {
    const schedules = await getQuizSchedules();
    schedules[chapterId] = schedule;
    const settingValue = JSON.stringify(schedules);
    if (supabase) {
      const { error } = await supabase.from('app_settings').upsert({
        setting_key: 'quiz_schedules',
        setting_value: settingValue
      }, { onConflict: 'setting_key' });
      if (error && !['PGRST205', '42P01'].includes(error.code)) throw error;
      if (error) console.warn('Supabase app_settings table is missing; schedule changes will use local storage until migration is applied.');
    }
    db.prepare("INSERT INTO app_settings (setting_key, setting_value) VALUES ('quiz_schedules', ?) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value").run(settingValue);
  } catch (error) {
    console.error('Quiz schedule save error:', error);
    return res.status(500).json({ error: 'تعذر حفظ مواعيد الامتحان في قاعدة البيانات' });
  }
  res.json({ ...schedule, is_open: isQuizOpen(schedule), message: 'تم حفظ مواعيد الامتحان' });
});

// Update chapter content
app.put('/api/admin/chapters/:id', requireAdmin, async (req, res) => {
  try {
    const chapterId = parseInt(req.params.id, 10);
    const { title, subtitle, text_content, video_url, video_title } = req.body;

    if (!title || !text_content) {
      return res.status(400).json({ error: 'عنوان الأصحاح والنص مطلوبان' });
    }

    const payload = {
      title: title.trim(),
      subtitle: (subtitle || '').trim(),
      text_content,
      video_url: (video_url || '').trim(),
      video_title: (video_title || '').trim(),
      updated_at: new Date().toISOString()
    };

    let updated = null;
    if (supabase) {
      const { data, error } = await supabase
        .from('chapters')
        .update(payload)
        .eq('id', chapterId)
        .select()
        .single();

      if (data) updated = data;
      if (error) console.error('Supabase update chapter error:', error);
    }

    db.prepare(`
      UPDATE chapters
      SET title = ?, subtitle = ?, text_content = ?, video_url = ?, video_title = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(payload.title, payload.subtitle, payload.text_content, payload.video_url, payload.video_title, chapterId);

    if (!updated) {
      updated = db.prepare('SELECT * FROM chapters WHERE id = ?').get(chapterId);
    }

    res.json({ message: 'تم حفظ تعديلات الأصحاح بنجاح في سوبابيز', chapter: updated });
  } catch (error) {
    console.error('Admin update chapter error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حفظ الأصحاح' });
  }
});

// Admin: Get questions for a chapter
app.get('/api/admin/chapters/:id/questions', requireAdmin, async (req, res) => {
  try {
    const chapterId = parseInt(req.params.id, 10);
    let questions = [];

    if (supabase) {
      const { data } = await supabase
        .from('questions')
        .select('*')
        .eq('chapter_id', chapterId)
        .order('id', { ascending: true });

      questions = (data || []).map(q => ({
        ...q,
        options: Array.isArray(q.options_json) ? q.options_json : JSON.parse(q.options_json || '[]')
      }));
    } else {
      const rows = db.prepare('SELECT * FROM questions WHERE chapter_id = ? ORDER BY id ASC').all(chapterId);
      questions = rows.map(q => ({
        ...q,
        options: JSON.parse(q.options_json)
      }));
    }

    res.json(questions);
  } catch (error) {
    console.error('Admin get questions error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الأسئلة' });
  }
});

// Admin: Add new question to chapter
app.post('/api/admin/chapters/:id/questions', requireAdmin, async (req, res) => {
  try {
    const chapterId = parseInt(req.params.id, 10);
    const { question_text, options, correct_index, explanation, points } = req.body;

    if (!question_text || !Array.isArray(options) || options.length < 2 || correct_index === undefined) {
      return res.status(400).json({ error: 'يرجى إدخال نص السؤال وخيارين على الأقل وتحديد الإجابة الصحيحة' });
    }

    let questionId = null;

    if (supabase) {
      const { data, error } = await supabase.from('questions').insert({
        chapter_id: chapterId,
        question_text: question_text.trim(),
        options_json: options.map(o => String(o).trim()),
        correct_index: parseInt(correct_index, 10),
        explanation: (explanation || '').trim(),
        points: parseInt(points, 10) || 10
      }).select().single();

      if (data) questionId = data.id;
    }

    // Mirror to local SQLite
    const insertLocal = db.prepare(`
      INSERT INTO questions (chapter_id, question_text, options_json, correct_index, explanation, points)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const resLocal = insertLocal.run(
      chapterId,
      question_text.trim(),
      JSON.stringify(options.map(o => String(o).trim())),
      parseInt(correct_index, 10),
      (explanation || '').trim(),
      parseInt(points, 10) || 10
    );

    res.json({
      message: 'تمت إضافة السؤال بنجاح إلى سوبابيز',
      questionId: questionId || resLocal.lastInsertRowid
    });
  } catch (error) {
    console.error('Admin add question error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إضافة السؤال' });
  }
});

// Admin: Update existing question
app.put('/api/admin/questions/:questionId', requireAdmin, async (req, res) => {
  try {
    const questionId = parseInt(req.params.questionId, 10);
    const { question_text, options, correct_index, explanation, points } = req.body;

    if (supabase) {
      await supabase.from('questions').update({
        question_text: question_text.trim(),
        options_json: options.map(o => String(o).trim()),
        correct_index: parseInt(correct_index, 10),
        explanation: (explanation || '').trim(),
        points: parseInt(points, 10) || 10
      }).eq('id', questionId);
    }

    db.prepare(`
      UPDATE questions
      SET question_text = ?, options_json = ?, correct_index = ?, explanation = ?, points = ?
      WHERE id = ?
    `).run(
      question_text.trim(),
      JSON.stringify(options.map(o => String(o).trim())),
      parseInt(correct_index, 10),
      (explanation || '').trim(),
      parseInt(points, 10) || 10,
      questionId
    );

    res.json({ message: 'تم تعديل السؤال بنجاح في سوبابيز والداتابيز' });
  } catch (error) {
    console.error('Admin update question error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تعديل السؤال' });
  }
});

// Admin: Delete question
app.delete('/api/admin/questions/:questionId', requireAdmin, async (req, res) => {
  try {
    const questionId = parseInt(req.params.questionId, 10);
    if (supabase) {
      await supabase.from('questions').delete().eq('id', questionId);
    }
    db.prepare('DELETE FROM questions WHERE id = ?').run(questionId);
    res.json({ message: 'تم حذف السؤال بنجاح' });
  } catch (error) {
    console.error('Admin delete question error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف السؤال' });
  }
});

// Admin: Statistics & contestants management
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    let contestantsCount = 0;
    let attemptsCount = 0;
    let avgScore = 0;
    let questionsCount = 0;
    let contestantsList = [];

    if (supabase) {
      const { count: cCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'contestant');
      const { count: aCount } = await supabase.from('quiz_attempts').select('*', { count: 'exact', head: true });
      const { count: qCount } = await supabase.from('questions').select('*', { count: 'exact', head: true });

      contestantsCount = cCount || 0;
      attemptsCount = aCount || 0;
      questionsCount = qCount || 0;

      const { data: cList } = await supabase
        .from('users')
        .select(`
          id, username, full_name, church, phone, created_at,
          user_progress ( last_chapter_id, total_score, total_time_seconds, completed_chapters_count )
        `)
        .eq('role', 'contestant');

      contestantsList = (cList || []).map(u => ({
        id: u.id,
        username: u.username,
        full_name: u.full_name,
        church: u.church,
        phone: u.phone,
        created_at: u.created_at,
        last_chapter_id: u.user_progress?.[0]?.last_chapter_id || 1,
        total_score: u.user_progress?.[0]?.total_score || 0,
        total_time_seconds: u.user_progress?.[0]?.total_time_seconds || 0,
        completed_chapters_count: u.user_progress?.[0]?.completed_chapters_count || 0
      }));
    } else {
      contestantsCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('contestant').count;
      attemptsCount = db.prepare('SELECT COUNT(*) as count FROM quiz_attempts').get().count;
      avgScore = db.prepare('SELECT AVG(score) as avg_score FROM quiz_attempts').get().avg_score || 0;
      questionsCount = db.prepare('SELECT COUNT(*) as count FROM questions').get().count;
      contestantsList = db.prepare(`
        SELECT u.id, u.username, u.full_name, u.church, u.phone, u.created_at,
               p.last_chapter_id, p.total_score, p.total_time_seconds, p.completed_chapters_count
        FROM users u
        LEFT JOIN user_progress p ON p.user_id = u.id
        WHERE u.role = 'contestant'
        ORDER BY p.total_score DESC, p.total_time_seconds ASC
      `).all();
    }

    res.json({
      contestantsCount,
      attemptsCount,
      avgScore: Math.round(avgScore),
      questionsCount,
      contestantsList
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب إحصائيات لوحة التحكم' });
  }
});

// Admin: Reset contestant attempts & progress
app.post('/api/admin/reset-contestant/:userId', requireAdmin, async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.userId, 10);
    let localTargetId = targetUserId;
    if (supabase) {
      const { data: cloudUser, error: userError } = await supabase.from('users').select('username').eq('id', targetUserId).maybeSingle();
      if (userError) throw userError;
      if (cloudUser?.username) localTargetId = getLocalUserId(cloudUser);
      await supabase.from('quiz_attempts').delete().eq('user_id', targetUserId);
      await supabase.from('user_progress').update({
        last_chapter_id: 1,
        total_score: 0,
        total_time_seconds: 0,
        completed_chapters_count: 0,
        updated_at: new Date().toISOString()
      }).eq('user_id', targetUserId);
    }

    if (localTargetId) db.prepare('DELETE FROM quiz_attempts WHERE user_id = ?').run(localTargetId);
    if (localTargetId) db.prepare(`
      UPDATE user_progress 
      SET last_chapter_id = 1, total_score = 0, total_time_seconds = 0, completed_chapters_count = 0, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(localTargetId);

    res.json({ message: 'تمت إعادة ضبط درجات وتقدم المتسابق بنجاح في سوبابيز' });
  } catch (error) {
    console.error('Admin reset error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إعادة ضبط المتسابق' });
  }
});

app.delete('/api/admin/contestants/:userId', requireAdmin, async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.userId, 10);
    if (!Number.isSafeInteger(targetUserId) || targetUserId < 1) return res.status(400).json({ error: 'معرّف متسابق غير صالح' });
    if (targetUserId === Number(req.user.id)) return res.status(400).json({ error: 'لا يمكن حذف حسابك الحالي' });
    let targetUsername = null;
    const localUser = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(targetUserId);
    if (localUser?.role === 'admin') return res.status(403).json({ error: 'لا يمكن حذف حساب مسؤول' });
    if (localUser) targetUsername = localUser.username;
    if (supabase) {
      const { data: target, error: readError } = await supabase.from('users').select('id, username, role').eq('id', targetUserId).maybeSingle();
      if (readError) throw readError;
      if (target?.role === 'admin') return res.status(403).json({ error: 'لا يمكن حذف حساب مسؤول' });
      if (target) {
        targetUsername = target.username;
        const { error } = await supabase.from('users').delete().eq('id', targetUserId);
        if (error) throw error;
      }
    }
    if (targetUsername) db.prepare('DELETE FROM users WHERE username = ? AND role = ?').run(targetUsername, 'contestant');
    res.json({ message: 'تم حذف حساب المتسابق ونتائجه' });
  } catch (error) {
    console.error('Delete contestant error:', error);
    res.status(500).json({ error: 'تعذر حذف حساب المتسابق' });
  }
});

// ==========================================
// 6. STATIC ASSETS & SPA SERVING
// ==========================================

const distPath = path.join(__dirname, '../client/dist');
app.use(express.static(distPath));

// For SPA routing, send index.html if not an API route
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      res.send(`Backend API server running on port ${PORT}. Please visit Vite frontend on port 3000.`);
    }
  });
});

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server started on http://localhost:${PORT}`);
  });
}

module.exports = app;
