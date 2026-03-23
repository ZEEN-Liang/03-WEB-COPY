const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const initSqlJs = require('sql.js');

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'forum_dev_secret_change_in_production';
const DB_FILE = path.join(__dirname, 'forum.db.bin');

// ── 管理员账号（在此修改用户名和密码）──────────────────────
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123456';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/avatars', express.static(path.join(__dirname, 'avatars')));

// ── Upload directory ────────────────────────────────────────
const uploadDir  = path.join(__dirname, 'uploads');
const avatarDir  = path.join(__dirname, 'avatars');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir);

// ── Multer config ───────────────────────────────────────────
const ALLOWED_MIME = [
  // Images
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  // Text
  'text/plain', 'text/markdown',
  // Documents
  'application/pdf',
  // Archives
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/vnd.rar',
  // Office
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Audio
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac',
  // Video
  'video/mp4', 'video/webm', 'video/ogg',
];

function safeExt(mimetype) {
  const map = {
    'image/jpeg':  '.jpg',  'image/png':  '.png',
    'image/gif':   '.gif',  'image/webp': '.webp',
    'text/plain':  '.txt',  'text/markdown': '.md',
    'application/pdf':  '.pdf',
    'application/zip':  '.zip',
    'application/x-zip-compressed': '.zip',
    'application/x-rar-compressed': '.rar',
    'application/vnd.rar': '.rar',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/ogg': '.ogg',
    'audio/flac': '.flac', 'audio/aac': '.aac',
    'video/mp4': '.mp4', 'video/webm': '.webm', 'video/ogg': '.ogv',
  };
  return map[mimetype] || '.bin';
}

// Avatar upload config
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarDir),
  filename:    (req, file, cb) => cb(null, 'avatar_' + req.user.id + safeExt(file.mimetype))
});
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg','image/png','image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('头像只支持 JPG / PNG / WebP'));
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2) + safeExt(file.mimetype));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },  // 50MB per file
  fileFilter: (req, file, cb) => {
    try { file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8'); } catch(e) {}
    if (ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
    else cb(new Error(`不支持的文件格式（${file.mimetype}），支持：图片、PDF、ZIP/RAR、Office 文档、音频、视频、文本`));
  }
});

// ── Database helpers ────────────────────────────────────────
let db;

function saveDb() {
  fs.writeFileSync(DB_FILE, Buffer.from(db.export()));
}

function dbGet(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// ── Auth middleware ─────────────────────────────────────────
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer '))
    return res.status(401).json({ error: '请先登录' });
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token 无效或已过期，请重新登录' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user.isAdmin)
      return res.status(403).json({ error: '无管理员权限' });
    next();
  });
}

// ── Start ───────────────────────────────────────────────────
async function startServer() {
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_FILE)
    ? new SQL.Database(fs.readFileSync(DB_FILE))
    : new SQL.Database();

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT NOT NULL UNIQUE,
      email      TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      title      TEXT NOT NULL,
      content    TEXT,
      status     TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS attachments (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id      INTEGER NOT NULL,
      filename     TEXT NOT NULL,
      originalname TEXT NOT NULL,
      mimetype     TEXT NOT NULL,
      size         INTEGER NOT NULL,
      FOREIGN KEY (post_id) REFERENCES posts(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id    INTEGER NOT NULL,
      user_id    INTEGER NOT NULL,
      content    TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (post_id) REFERENCES posts(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS views (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      viewed_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS likes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_key   TEXT NOT NULL,
      target     TEXT NOT NULL,
      target_id  INTEGER NOT NULL,
      UNIQUE(user_key, target, target_id)
    )
  `);

  // Add profile columns to users if not exist — saveDb() after each so they persist
  let profileColsChanged = false;
  for (const [col, name] of [
    ["ALTER TABLE users ADD COLUMN nickname    TEXT DEFAULT NULL", "nickname"],
    ["ALTER TABLE users ADD COLUMN bio         TEXT DEFAULT NULL", "bio"],
    ["ALTER TABLE users ADD COLUMN instruments TEXT DEFAULT NULL", "instruments"],
    ["ALTER TABLE users ADD COLUMN avatar       TEXT    DEFAULT NULL", "avatar"],
    ["ALTER TABLE users ADD COLUMN show_follows INTEGER DEFAULT 1",    "show_follows"],
  ]) {
    try {
      db.run(col);
      console.log(`✅ users 表新增列: ${name}`);
      profileColsChanged = true;
    } catch(e) { /* column already exists */ }
  }
  if (profileColsChanged) saveDb();

  // follows table
  db.run(`
    CREATE TABLE IF NOT EXISTS follows (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      follower_id INTEGER NOT NULL,
      followee_id INTEGER NOT NULL,
      created_at  TEXT DEFAULT (datetime('now')),
      UNIQUE(follower_id, followee_id)
    )
  `);

  // Add parent_id to comments if not exists (for replies)
  try {
    db.run('ALTER TABLE comments ADD COLUMN parent_id INTEGER DEFAULT NULL');
    console.log('✅ 已为 comments 表添加 parent_id 字段');
  } catch(e) {}

  // Add reply_to_username to comments if not exists
  try {
    db.run('ALTER TABLE comments ADD COLUMN reply_to TEXT DEFAULT NULL');
    console.log('✅ 已为 comments 表添加 reply_to 字段');
  } catch(e) {}

  // Add status column to existing posts table if it doesn't exist yet
  try {
    db.run(`ALTER TABLE posts ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'`);
    console.log('✅ 已为现有 posts 表添加 status 字段');
  } catch(e) {
    // Column already exists, ignore
  }

  saveDb();
  console.log('✅ 数据库已就绪');
  console.log(`   管理员账号：${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
  console.log(`   管理员页面：http://localhost:${PORT}/admin.html`);

  // ── Routes ────────────────────────────────────────────────

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  });

  // POST /api/register
  app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || username.length < 3)
      return res.status(400).json({ error: '用户名至少 3 位' });
    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username))
      return res.status(400).json({ error: '用户名只能包含字母、数字、下划线或中文' });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: '邮箱格式不正确' });
    if (!password || password.length < 8)
      return res.status(400).json({ error: '密码至少 8 位' });
    const existing = dbGet('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing)
      return res.status(409).json({ error: '用户名或邮箱已被注册' });
    const hashed = await bcrypt.hash(password, 10);
    try {
      db.run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashed]);
      const { id } = dbGet('SELECT last_insert_rowid() as id');
      const token = jwt.sign({ id, username, isAdmin: false }, JWT_SECRET, { expiresIn: '7d' });
      saveDb();
      res.status(201).json({ message: '注册成功', token, username });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服务器错误，请重试' });
    }
  });

  // POST /api/login  （管理员走同一个登录接口）
  app.post('/api/login', async (req, res) => {
    const { account, password } = req.body;
    if (!account || !password)
      return res.status(400).json({ error: '请填写账号和密码' });

    // Admin login
    if (account === ADMIN_USERNAME) {
      if (password !== ADMIN_PASSWORD)
        return res.status(401).json({ error: '管理员密码错误' });
      const token = jwt.sign({ id: 0, username: ADMIN_USERNAME, isAdmin: true }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ message: '登录成功', token, username: ADMIN_USERNAME, isAdmin: true });
    }

    // Regular user login
    const user = dbGet('SELECT * FROM users WHERE username = ? OR email = ?', [account, account]);
    if (!user) return res.status(401).json({ error: '账号不存在' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: '密码错误' });
    const token = jwt.sign({ id: user.id, username: user.username, isAdmin: false }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: '登录成功', token, username: user.username, isAdmin: false });
  });

  // GET /api/me
  app.get('/api/me', requireAuth, (req, res) => {
    if (req.user.isAdmin)
      return res.json({ id: 0, username: ADMIN_USERNAME, isAdmin: true });
    const user = dbGet('SELECT id, username, email, created_at FROM users WHERE id = ?', [req.user.id]);
    res.json({ ...user, isAdmin: false });
  });

  // POST /api/posts — submit new post (status = pending)
  app.post('/api/posts', requireAuth, (req, res) => {
    upload.array('files', 20)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: '单个文件不能超过 50MB' });
        return res.status(400).json({ error: err.message });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }
      const { title, content } = req.body;
      if (!title || title.trim().length === 0)
        return res.status(400).json({ error: '标题不能为空' });
      if (title.trim().length > 100)
        return res.status(400).json({ error: '标题不能超过 100 字' });
      try {
        db.run(
          'INSERT INTO posts (user_id, title, content, status) VALUES (?, ?, ?, ?)',
          [req.user.id, title.trim(), content || '', 'pending']
        );
        const { id: postId } = dbGet('SELECT last_insert_rowid() as id');
        if (req.files && req.files.length > 0) {
          for (const f of req.files) {
            db.run(
              'INSERT INTO attachments (post_id, filename, originalname, mimetype, size) VALUES (?, ?, ?, ?, ?)',
              [postId, f.filename, f.originalname, f.mimetype, f.size]
            );
          }
        }
        saveDb();
        res.status(201).json({ message: '投稿成功，等待管理员审核', postId });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: '投稿失败，请重试' });
      }
    });
  });

  // GET /api/posts — public feed, only published
  // ?sort=latest|views|likes|comments   ?limit=N
  app.get('/api/posts', (req, res) => {
    const sort  = req.query.sort  || 'latest';
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);

    const posts = dbAll(`
      SELECT p.id, p.title, p.content, p.created_at, p.status,
             u.username,
             CASE WHEN u.nickname IS NOT NULL AND u.nickname != '' THEN u.nickname ELSE u.username END as nickname,
             u.avatar
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.status = 'published'
      ORDER BY p.created_at DESC
      LIMIT ?
    `, [limit]);

    // Attach counts
    const result = posts.map(p => ({
      ...p,
      attachment_count: dbGet('SELECT COUNT(*) as n FROM attachments WHERE post_id=?', [p.id]).n,
      view_count:       dbGet('SELECT COUNT(*) as n FROM views       WHERE post_id=?', [p.id]).n,
      comment_count:    dbGet('SELECT COUNT(*) as n FROM comments    WHERE post_id=?', [p.id]).n,
      like_count:       dbGet("SELECT COUNT(*) as n FROM likes WHERE target='post' AND target_id=?", [p.id]).n,
    }));

    // Sort in JS after counts are attached (avoids GROUP BY issues)
    const sorted = result.sort((a, b) => {
      if (sort === 'views')    return b.view_count    - a.view_count;
      if (sort === 'likes')    return b.like_count    - a.like_count;
      if (sort === 'comments') return b.comment_count - a.comment_count;
      // latest (default)
      return new Date(b.created_at) - new Date(a.created_at);
    });

    res.json(sorted);
  });

  // GET /api/posts/:id — single post, respects status, records view
  app.get('/api/posts/:id', (req, res) => {
    const post = dbGet(`
      SELECT p.*, u.username, u.avatar, u.nickname
      FROM posts p JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `, [req.params.id]);
    if (!post) return res.status(404).json({ error: '帖子不存在' });
    const authHeader = req.headers.authorization;
    let isAdmin = false;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try { isAdmin = jwt.verify(authHeader.slice(7), JWT_SECRET).isAdmin; } catch(e) {}
    }
    if (!isAdmin && post.status !== 'published')
      return res.status(403).json({ error: '该文章暂未公开' });

    // Record view
    db.run('INSERT INTO views (post_id) VALUES (?)', [req.params.id]);
    saveDb();

    const attachments = dbAll(
      'SELECT id, filename, originalname, mimetype, size FROM attachments WHERE post_id = ?',
      [req.params.id]
    );
    const view_count    = dbGet('SELECT COUNT(*) as n FROM views    WHERE post_id = ?', [req.params.id]).n;
    const comment_count = dbGet('SELECT COUNT(*) as n FROM comments WHERE post_id = ?', [req.params.id]).n;
    const like_count    = dbGet("SELECT COUNT(*) as n FROM likes WHERE target='post' AND target_id=?", [req.params.id]).n;
    // Check if current user already liked (by user_key)
    const authHeader2 = req.headers.authorization;
    let userKey = 'guest:' + (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown');
    if (authHeader2 && authHeader2.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(authHeader2.slice(7), JWT_SECRET);
        userKey = 'user:' + payload.id;
      } catch(e) {}
    }
    const already_liked = !!dbGet("SELECT id FROM likes WHERE user_key=? AND target='post' AND target_id=?", [userKey, req.params.id]);
    res.json({ ...post, attachments, view_count, comment_count, like_count, already_liked });
  });

  // GET /api/posts/:id/comments
  app.get('/api/posts/:id/comments', (req, res) => {
    const post = dbGet('SELECT id, status FROM posts WHERE id = ?', [req.params.id]);
    if (!post) return res.status(404).json({ error: '帖子不存在' });

    const authHdr = req.headers.authorization;
    let ck = 'guest';
    if (authHdr && authHdr.startsWith('Bearer ')) {
      try { ck = 'user:' + jwt.verify(authHdr.slice(7), JWT_SECRET).id; } catch(e) {}
    }

    // No GROUP BY — fetch comments + user info cleanly, then attach counts separately
    const comments = dbAll(`
      SELECT c.id, c.content, c.created_at, c.parent_id, c.reply_to,
             CASE WHEN c.user_id = -1 OR u.username IS NULL THEN 'admin' ELSE u.username END as username,
             CASE WHEN c.user_id = -1 THEN 'admin'
                  WHEN u.nickname IS NOT NULL AND u.nickname != '' THEN u.nickname
                  ELSE u.username
             END as display_name,
             CASE WHEN c.user_id = -1 OR u.avatar IS NULL THEN NULL ELSE u.avatar END as avatar
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id AND c.user_id != -1
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `, [req.params.id]);

    // Attach like_count and already_liked per comment individually
    const result = comments.map(cm => {
      const like_count    = dbGet("SELECT COUNT(*) as n FROM likes WHERE target='comment' AND target_id=?", [cm.id]).n;
      const already_liked = !!dbGet("SELECT id FROM likes WHERE user_key=? AND target='comment' AND target_id=?", [ck, cm.id]);
      return { ...cm, like_count, already_liked };
    });

    res.json(result);
  });

  // POST /api/posts/:id/comments
  app.post('/api/posts/:id/comments', requireAuth, (req, res) => {
    const post = dbGet('SELECT id, status FROM posts WHERE id = ?', [req.params.id]);
    if (!post) return res.status(404).json({ error: '帖子不存在' });
    if (post.status !== 'published') return res.status(403).json({ error: '该文章暂未公开' });
    const { content, parent_id, reply_to } = req.body;
    if (!content || content.trim().length === 0)
      return res.status(400).json({ error: '评论内容不能为空' });
    if (content.trim().length > 500)
      return res.status(400).json({ error: '评论不能超过 500 字' });

    // Validate parent_id and resolve root — all replies hang under top-level comment
    let rootParentId = null;
    if (parent_id) {
      const parent = dbGet('SELECT id, parent_id FROM comments WHERE id = ?', [parent_id]);
      if (!parent) return res.status(404).json({ error: '回复的评论不存在' });
      // If the target is itself a reply, use its parent as root
      rootParentId = parent.parent_id ? parent.parent_id : parent.id;
    }

    const isAdminUser = req.user.isAdmin;
    const commenterName = req.user.username;

    if (isAdminUser) {
      db.run(
        'INSERT INTO comments (post_id, user_id, content, parent_id, reply_to) VALUES (?, ?, ?, ?, ?)',
        [req.params.id, -1, content.trim(), rootParentId, reply_to || null]
      );
      const { id: commentId } = dbGet('SELECT last_insert_rowid() as id');
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      saveDb();
      return res.status(201).json({
        id: commentId, content: content.trim(), created_at: now,
        username: commenterName, display_name: commenterName,
        parent_id: rootParentId, reply_to: reply_to || null,
        like_count: 0, already_liked: false
      });
    }

    db.run(
      'INSERT INTO comments (post_id, user_id, content, parent_id, reply_to) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, req.user.id, content.trim(), rootParentId, reply_to || null]
    );
    const { id: commentId } = dbGet('SELECT last_insert_rowid() as id');
    const comment = dbGet(`
      SELECT c.id, c.content, c.created_at, c.parent_id, c.reply_to,
             u.username,
             COALESCE(u.nickname, u.username) as display_name
      FROM comments c JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `, [commentId]);
    saveDb();
    res.status(201).json(comment);
  });

  // POST /api/like — toggle like for post or comment
  app.post('/api/like', requireAuth, (req, res) => {
    const { target, target_id } = req.body;
    if (!['post', 'comment'].includes(target) || !target_id)
      return res.status(400).json({ error: '参数错误' });

    const userKey = 'user:' + req.user.id;
    const existing = dbGet(
      'SELECT id FROM likes WHERE user_key=? AND target=? AND target_id=?',
      [userKey, target, target_id]
    );
    if (existing) {
      // Unlike
      db.run('DELETE FROM likes WHERE user_key=? AND target=? AND target_id=?',
        [userKey, target, target_id]);
      saveDb();
      const count = dbGet('SELECT COUNT(*) as n FROM likes WHERE target=? AND target_id=?', [target, target_id]).n;
      return res.json({ liked: false, count });
    } else {
      // Like
      db.run('INSERT INTO likes (user_key, target, target_id) VALUES (?, ?, ?)',
        [userKey, target, target_id]);
      saveDb();
      const count = dbGet('SELECT COUNT(*) as n FROM likes WHERE target=? AND target_id=?', [target, target_id]).n;
      return res.json({ liked: true, count });
    }
  });

  // ── Admin routes ───────────────────────────────────────────

  // GET /api/admin/posts — all posts with any status
  app.get('/api/admin/posts', requireAdmin, (req, res) => {
    const posts = dbAll(`
      SELECT p.id, p.title, p.content, p.created_at, p.status,
             u.username,
             CASE WHEN u.nickname IS NOT NULL AND u.nickname != '' THEN u.nickname ELSE u.username END as nickname
      FROM posts p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    `);
    const result = posts.map(p => ({
      ...p,
      attachment_count: dbGet('SELECT COUNT(*) as n FROM attachments WHERE post_id=?', [p.id]).n,
    }));
    res.json(result);
  });

  // PATCH /api/admin/posts/:id — update post status
  app.patch('/api/admin/posts/:id', requireAdmin, (req, res) => {
    const { status } = req.body;
    if (!['published', 'pending', 'hidden'].includes(status))
      return res.status(400).json({ error: '无效的状态值' });
    const post = dbGet('SELECT id FROM posts WHERE id = ?', [req.params.id]);
    if (!post) return res.status(404).json({ error: '帖子不存在' });
    db.run('UPDATE posts SET status = ? WHERE id = ?', [status, req.params.id]);
    saveDb();
    res.json({ message: '状态已更新', status });
  });

  // DELETE /api/admin/posts/:id — permanently delete post and its attachments
  app.delete('/api/admin/posts/:id', requireAdmin, (req, res) => {
    const post = dbGet('SELECT id FROM posts WHERE id = ?', [req.params.id]);
    if (!post) return res.status(404).json({ error: '帖子不存在' });

    // Delete physical files
    const attachments = dbAll(
      'SELECT filename FROM attachments WHERE post_id = ?', [req.params.id]
    );
    for (const a of attachments) {
      const filePath = path.join(uploadDir, a.filename);
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch(e) {}
    }

    db.run('DELETE FROM attachments WHERE post_id = ?', [req.params.id]);
    db.run('DELETE FROM posts WHERE id = ?', [req.params.id]);
    saveDb();
    res.json({ message: '已永久删除' });
  });

  // DELETE /api/admin/comments/:id — delete any comment
  app.delete('/api/admin/comments/:id', requireAdmin, (req, res) => {
    const comment = dbGet('SELECT id FROM comments WHERE id = ?', [req.params.id]);
    if (!comment) return res.status(404).json({ error: '评论不存在' });
    db.run('DELETE FROM comments WHERE id = ?', [req.params.id]);
    saveDb();
    res.json({ message: '评论已删除' });
  });

  // GET /api/admin/stats — dashboard numbers
  app.get('/api/admin/stats', requireAdmin, (req, res) => {
    const total     = dbGet('SELECT COUNT(*) as n FROM posts').n;
    const pending   = dbGet("SELECT COUNT(*) as n FROM posts WHERE status = 'pending'").n;
    const published = dbGet("SELECT COUNT(*) as n FROM posts WHERE status = 'published'").n;
    const hidden    = dbGet("SELECT COUNT(*) as n FROM posts WHERE status = 'hidden'").n;
    const users     = dbGet('SELECT COUNT(*) as n FROM users').n;
    res.json({ total, pending, published, hidden, users });
  });

  // GET /api/profile/:username — public profile
  app.get('/api/profile/:username', (req, res) => {
    const user = dbGet(
      'SELECT id, username, nickname, bio, instruments, avatar, show_follows, created_at FROM users WHERE username = ?',
      [req.params.username]
    );
    if (!user) return res.status(404).json({ error: '用户不存在' });
    const post_count      = dbGet("SELECT COUNT(*) as n FROM posts WHERE user_id = ? AND status = 'published'", [user.id]).n;
    const like_count      = dbGet("SELECT COUNT(*) as n FROM likes WHERE target='post' AND target_id IN (SELECT id FROM posts WHERE user_id = ?)", [user.id]).n;
    const follower_count  = dbGet('SELECT COUNT(*) as n FROM follows WHERE followee_id = ?', [user.id]).n;
    const following_count = dbGet('SELECT COUNT(*) as n FROM follows WHERE follower_id = ?', [user.id]).n;

    // Check if current viewer is following this user
    let is_following = false;
    const authHdr = req.headers.authorization;
    if (authHdr && authHdr.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(authHdr.slice(7), JWT_SECRET);
        if (!payload.isAdmin) {
          is_following = !!dbGet('SELECT id FROM follows WHERE follower_id=? AND followee_id=?', [payload.id, user.id]);
        }
      } catch(e) {}
    }

    res.json({ ...user, post_count, like_count, follower_count, following_count, is_following });
  });

  // GET /api/profile/:username/posts — public posts by user
  app.get('/api/profile/:username/posts', (req, res) => {
    const user = dbGet('SELECT id FROM users WHERE username = ?', [req.params.username]);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    const posts = dbAll(`
      SELECT p.id, p.title, p.content, p.created_at,
             COUNT(DISTINCT a.id)  as attachment_count,
             COUNT(DISTINCT v.id)  as view_count,
             COUNT(DISTINCT cm.id) as comment_count,
             COUNT(DISTINCT lk.id) as like_count
      FROM posts p
      LEFT JOIN attachments a  ON a.post_id  = p.id
      LEFT JOIN views      v   ON v.post_id  = p.id
      LEFT JOIN comments   cm  ON cm.post_id = p.id
      LEFT JOIN likes      lk  ON lk.target  = 'post' AND lk.target_id = p.id
      WHERE p.user_id = ? AND p.status = 'published'
      GROUP BY p.id ORDER BY p.created_at DESC
    `, [user.id]);
    res.json(posts);
  });

  // POST /api/follow/:username — toggle follow
  app.post('/api/follow/:username', requireAuth, (req, res) => {
    if (req.user.isAdmin) return res.status(403).json({ error: '管理员账号无法关注用户' });
    const target = dbGet('SELECT id FROM users WHERE username = ?', [req.params.username]);
    if (!target) return res.status(404).json({ error: '用户不存在' });
    if (target.id === req.user.id) return res.status(400).json({ error: '不能关注自己' });

    const existing = dbGet('SELECT id FROM follows WHERE follower_id=? AND followee_id=?', [req.user.id, target.id]);
    if (existing) {
      db.run('DELETE FROM follows WHERE follower_id=? AND followee_id=?', [req.user.id, target.id]);
      saveDb();
      const follower_count = dbGet('SELECT COUNT(*) as n FROM follows WHERE followee_id=?', [target.id]).n;
      return res.json({ following: false, follower_count });
    } else {
      db.run('INSERT INTO follows (follower_id, followee_id) VALUES (?, ?)', [req.user.id, target.id]);
      saveDb();
      const follower_count = dbGet('SELECT COUNT(*) as n FROM follows WHERE followee_id=?', [target.id]).n;
      return res.json({ following: true, follower_count });
    }
  });

  // GET /api/profile/:username/following — who this user follows
  app.get('/api/profile/:username/following', (req, res) => {
    const user = dbGet('SELECT id, show_follows FROM users WHERE username = ?', [req.params.username]);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    // Check if viewer is the owner
    const authHdr = req.headers.authorization;
    let viewerIsOwner = false;
    if (authHdr && authHdr.startsWith('Bearer ')) {
      try {
        const p = jwt.verify(authHdr.slice(7), JWT_SECRET);
        viewerIsOwner = !p.isAdmin && p.id === user.id;
      } catch(e) {}
    }
    if (!viewerIsOwner && !user.show_follows)
      return res.status(403).json({ error: 'hidden' });
    const list = dbAll(`
      SELECT u.username, u.nickname, u.avatar, u.bio,
             (SELECT COUNT(*) FROM posts WHERE user_id = u.id AND status = 'published') as post_count
      FROM follows f
      JOIN users u ON f.followee_id = u.id
      WHERE f.follower_id = ?
      ORDER BY f.created_at DESC
    `, [user.id]);
    res.json(list);
  });

  // GET /api/profile/:username/followers — who follows this user
  app.get('/api/profile/:username/followers', (req, res) => {
    const user = dbGet('SELECT id, show_follows FROM users WHERE username = ?', [req.params.username]);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    const authHdr = req.headers.authorization;
    let viewerIsOwner = false;
    if (authHdr && authHdr.startsWith('Bearer ')) {
      try {
        const p = jwt.verify(authHdr.slice(7), JWT_SECRET);
        viewerIsOwner = !p.isAdmin && p.id === user.id;
      } catch(e) {}
    }
    if (!viewerIsOwner && !user.show_follows)
      return res.status(403).json({ error: 'hidden' });
    const list = dbAll(`
      SELECT u.username, u.nickname, u.avatar, u.bio,
             (SELECT COUNT(*) FROM posts WHERE user_id = u.id AND status = 'published') as post_count
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      WHERE f.followee_id = ?
      ORDER BY f.created_at DESC
    `, [user.id]);
    res.json(list);
  });

  // PATCH /api/profile — update own profile
  app.patch('/api/profile', requireAuth, (req, res) => {
    if (req.user.isAdmin) return res.status(403).json({ error: '管理员账号无个人主页' });
    const { nickname, bio, instruments, show_follows } = req.body;
    if (nickname !== undefined && nickname.trim().length > 30)
      return res.status(400).json({ error: '昵称不能超过 30 字' });
    if (bio !== undefined && bio.trim().length > 200)
      return res.status(400).json({ error: '简介不能超过 200 字' });
    const cur = dbGet('SELECT nickname, bio, instruments, show_follows FROM users WHERE id=?', [req.user.id]);
    db.run('UPDATE users SET nickname=?, bio=?, instruments=?, show_follows=? WHERE id=?', [
      nickname    !== undefined ? (nickname.trim()    || null) : cur.nickname,
      bio         !== undefined ? (bio.trim()         || null) : cur.bio,
      instruments !== undefined ? (instruments.trim() || null) : cur.instruments,
      show_follows !== undefined ? (show_follows ? 1 : 0)     : cur.show_follows,
      req.user.id
    ]);
    saveDb();
    const updated = dbGet(
      'SELECT id, username, nickname, bio, instruments, avatar, show_follows FROM users WHERE id=?', [req.user.id]
    );
    res.json(updated);
  });

  // POST /api/profile/avatar — upload avatar
  app.post('/api/profile/avatar', requireAuth, (req, res) => {
    if (req.user.isAdmin) return res.status(403).json({ error: '管理员账号无个人主页' });
    uploadAvatar.single('avatar')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: '请选择图片' });
      const url = '/avatars/' + req.file.filename;
      db.run('UPDATE users SET avatar=? WHERE id=?', [url, req.user.id]);
      saveDb();
      res.json({ avatar: url });
    });
  });

  app.listen(PORT, () => {
    console.log(`\n🚀 论坛后端已启动：http://localhost:${PORT}`);
    console.log(`   登录页面：  http://localhost:${PORT}/`);
    console.log(`   投稿页面：  http://localhost:${PORT}/post.html`);
    console.log(`   管理页面：  http://localhost:${PORT}/admin.html\n`);
  });
}

startServer().catch(console.error);
