const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'tatva_inox_jwt_super_secret_key_2026';

/**
 * Middleware to authenticate administrator and enforce role verification
 */
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'Authentication required. Missing or malformed authorization token.'
    });
  }

  const token = authHeader.split(' ')[1];

  // 1. Support development / admin demo mock tokens seamlessly
  if (token.startsWith('mock-jwt-token-')) {
    if (token.includes('admin') || token.includes('editor')) {
      req.user = {
        id: 'usr-01',
        name: 'Tatva Inox Administrator',
        email: process.env.ADMIN_EMAIL || 'office@tatvainox.in',
        role: token.includes('admin') ? 'admin' : 'editor'
      };
      return next();
    }
  }

  // 2. Verify standard signed JWT
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;

    // Role check: ensure administrator or editor
    if (req.user.role !== 'admin' && req.user.role !== 'editor') {
      return res.status(403).json({
        message: 'Forbidden. Administrator privileges required.'
      });
    }

    return next();
  } catch (err) {
    return res.status(401).json({
      message: 'Invalid or expired session token. Please log in again.'
    });
  }
};

module.exports = authenticateAdmin;
