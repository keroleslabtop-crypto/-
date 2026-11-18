const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'spiritual_contest_secret_key_2026';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      req.user = null;
      return next();
    }
    req.user = user;
    next();
  });
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً للقيام بهذا الإجراء' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'عفواً، هذه الصفحة مخصصة للمسؤول (الأدمن) فقط' });
  }
  next();
}

module.exports = {
  JWT_SECRET,
  authenticateToken,
  requireAuth,
  requireAdmin
};
