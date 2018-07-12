const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {
  requireAuthorization,
  requireCorrectUser,
  requireCorrectCompany
} = require('../middleware/auth');

// USER AUTHORIZATION
router.post('/user-auth', async (req, res, next) => {
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
          { username: userData.rows[0].username },
          'I_AM_THE_SECRET_KEY'
        );
        return res.json({ token });
      } else {
        // TODO : throw more descriptive errors with titles and status
        return res.json({ message: 'invalid password' });
      }
    } else {
      return res.json({ message: 'invalid username' });
    }
  } catch (e) {
    return next(e);
  }
});

// COMPANY AUTHORIZATION

router.post('/company-auth', async (req, res, next) => {
  // Return a jwt if properly authenticated
  try {
    const companyData = await db.query(
      'SELECT * FROM companies WHERE handle = $1',
      [req.body.handle]
    );
    if (companyData.rows.length > 0) {
      const match = await bcrypt.compare(
        req.body.password,
        companyData.rows[0].password
      );
      if (match) {
        const token = jwt.sign(
          { handle: companyData.rows[0].handle },
          'I_AM_THE_SECRET_KEY'
        );
        return res.json({ token });
      } else {
        // TODO : Throw more descriptive errors with titles and status
        return res.json({ message: 'invalid password' });
      }
    } else {
      return res.json({ message: 'invalid handle' });
    }
  } catch (e) {
    return next(e);
  }
});

module.exports = router;
