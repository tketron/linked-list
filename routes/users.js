const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {
  requireAuthorization,
  requireCorrectUser
} = require('../middleware/auth');

router.get('', requireAuthorization, async (req, res, next) => {
  // Return all users
  try {
    const data = await db.query(
      'SELECT id, username, first_name, last_name, email, photo, current_company_id FROM users'
    );
    return res.json(data.rows);
  } catch (e) {
    return next(e);
  }
});

router.post('', async (req, res, next) => {
  // Create a new user
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const data = await db.query(
      'INSERT INTO users (username, password, first_name, last_name, email, photo) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [
        req.body.username,
        hashedPassword,
        req.body.first_name,
        req.body.last_name,
        req.body.email,
        req.body.photo
      ]
    );
    //Don't return password field
    delete data.rows[0].password;
    return res.json(data.rows[0]);
  } catch (e) {
    return next(e);
  }
});

router.get('/:id', requireAuthorization, async (req, res, next) => {
  // Return a single user
  try {
    const data = await db.query('SELECT * FROM users WHERE id = $1', [
      req.params.id
    ]);
    delete data.rows[0].password;
    return res.json(data.rows[0]);
  } catch (e) {
    return next(e);
  }
});

router.patch('/:id', requireCorrectUser, async (req, res, next) => {
  // Update and return a user
  try {
    const data = await db.query(
      'UPDATE users SET first_name = $1, last_name  = $2, email = $3, photo = $4 WHERE id = $5 RETURNING *',
      [
        req.body.first_name,
        req.body.last_name,
        req.body.email,
        req.body.photo,
        req.params.id
      ]
    );
    return res.json(data.rows[0]);
  } catch (e) {
    return next(e);
  }
});

router.delete('/:id', requireCorrectUser, async (req, res, next) => {
  // Delete and return a user
  try {
    const data = await db.query('SELECT * FROM users WHERE id = $1', [
      req.params.id
    ]);
    await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    return res.json(data.rows[0]);
  } catch (e) {
    return next(e);
  }
});

router.post('/auth', async (req, res, next) => {
  // Authenticates a user and returns a JWT if successfully authenticated
  try {
    const userData = await db.query('SELECT * FROM users WHERE username = $1', [
      req.body.username
    ]);
    if (userData.rows.length > 0) {
      const match = await bcrypt.compare(
        req.body.password,
        userData.rows[0].password
      );
      if (match) {
        const token = jwt.sign(
          { user_id: userData.rows[0].id },
          'I_AM_THE_SECRET_KEY'
        );
        return res.json({ token });
      } else {
        return res.json({ message: 'invalid password' });
      }
    } else {
      return res.json({ message: 'invalid username' });
    }
  } catch (e) {
    return next(e);
  }
});

module.exports = router;
