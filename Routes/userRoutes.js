const express = require('express');
const router = express.Router();

const AdminUser = require('../Models/AdminUser');
const AuditLog = require('../Models/AuditLog');
const authenticateAdmin = require('../src/middleware/authenticateAdmin');

// Admin protected
router.use(authenticateAdmin);

// Role check: Only 'admin' role can manage users
const requireAdminRole = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: Super administrator privileges required.' });
  }
  next();
};

// GET /api/users - List all users
router.get('/', async (req, res) => {
  try {
    const users = await AdminUser.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve users', error: err.message });
  }
});

// POST /api/users - Create new admin or editor user
router.post('/', requireAdminRole, async (req, res) => {
  try {
    const { name, email, password, role, title, status } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const existing = await AdminUser.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ message: 'A user with this email already exists' });
    }

    const newUser = new AdminUser({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password, // hashed in pre-save hook
      role: role || 'editor',
      title: title || 'Technical Documentation Lead',
      status: status || 'active'
    });

    await newUser.save();

    await AuditLog.create({
      action: 'User Created',
      module: 'Admin Users',
      details: `Created user ${newUser.email} (${newUser.role})`,
      userName: req.user?.name || 'Administrator',
      userId: req.user?.id || 'admin',
      severity: 'info'
    });

    const userJson = newUser.toJSON();
    res.status(201).json(userJson);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create user', error: err.message });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, title, role, status, password } = req.body;

    const user = await AdminUser.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name) user.name = name.trim();
    if (title) user.title = title.trim();
    if (role) user.role = role;
    if (status) user.status = status;
    if (password && password.trim().length >= 6) {
      user.password = password.trim();
    }

    await user.save();

    await AuditLog.create({
      action: 'User Updated',
      module: 'Admin Users',
      details: `Updated user ${user.email}`,
      userName: req.user?.name || 'Administrator',
      userId: req.user?.id || 'admin',
      severity: 'info'
    });

    res.json(user.toJSON());
  } catch (err) {
    res.status(500).json({ message: 'Failed to update user', error: err.message });
  }
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user?.id === id) {
      return res.status(400).json({ message: 'You cannot delete your own active administrator account' });
    }

    const user = await AdminUser.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await AuditLog.create({
      action: 'User Deleted',
      module: 'Admin Users',
      details: `Deleted user ${user.email}`,
      userName: req.user?.name || 'Administrator',
      userId: req.user?.id || 'admin',
      severity: 'warning'
    });

    res.json({ success: true, message: `User ${user.email} deleted` });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete user', error: err.message });
  }
});

module.exports = router;
