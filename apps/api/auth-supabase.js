const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getUserByEmail, getUserById } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'TaskForce-JWT-Secret-2024-Super-Secure';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso necessário' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

const registerUser = async (email, password, name) => {
  if (!email || !password) {
    throw new Error('Email e senha são obrigatórios');
  }

  const existing = await getUserByEmail(email);
  if (existing) {
    throw new Error('Usuário já existe');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const { pool } = require('./db');
  const { rows } = await pool.query(
    `INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, 'user')
     RETURNING id, email, name, role`,
    [email, hashedPassword, name || null]
  );
  const user = rows[0];

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

  return {
    message: 'Usuário criado com sucesso',
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  };
};

const loginUser = async (email, password) => {
  if (!email || !password) {
    throw new Error('Email e senha são obrigatórios');
  }

  const user = await getUserByEmail(email);
  if (!user) {
    throw new Error('Credenciais inválidas');
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    throw new Error('Credenciais inválidas');
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

  return {
    message: 'Login realizado com sucesso',
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || 'user',
    },
  };
};

const getUserData = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      created_at: user.created_at,
    },
  };
};

module.exports = {
  authenticateToken,
  registerUser,
  loginUser,
  getUserData,
};
