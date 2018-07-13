const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {
  requireAuthorization,
  requireCorrectUser
} = require('../middleware/auth');
const { selectivePatchQuery } = require('../helpers/selective_query');

router.get('', requireAuthorization, async (req, res, next) => {
  // Return all users
  try {
    let data = await db.query(
      'SELECT username, first_name, last_name, email, photo, current_company FROM users'
    );

    // TODO Add applied to for each users
    data.rows.forEach(async user => {
      const jobData = await db.query(
        'SELECT id FROM applications WHERE username = $1',
        [user.username]
      );
      user.applied_to = [];
      jobData.rows.forEach(job => data.rows[0].applied_to.push(job.id));
    });
    return res.json(data.rows);
  } catch (e) {
    return next(e);
  }
});

router.post('', async (req, res, next) => {
  // Create a new user
  try {
    if (req.body.current_company) {
      // query companies to see if handle exists
      const companyResponse = await db.query(
        'SELECT * FROM companies WHERE handle=$1',
        [req.body.current_company]
      );
      //if not, throw an error
      if (companyResponse.rows.length === 0) {
        const badRequest = new Error('Company does not exist.');
        badRequest.status = 400;
        throw badRequest;
      }
    }
    //check if username exists in db
    const usernameCheck = await db.query(
      'SELECT username FROM users WHERE username=$1',
      [req.body.username]
    );
    if (usernameCheck.rows.length > 0) {
      const conflict = new Error('Username already exists.');
      conflict.status = 409;
      throw conflict;
    }

    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const data = await db.query(
      'INSERT INTO users (username, password, first_name, last_name, email, photo, current_company) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [
        req.body.username,
        hashedPassword,
        req.body.first_name,
        req.body.last_name,
        req.body.email,
        req.body.photo,
        req.body.current_company
      ]
    );
    //Don't return password field
    delete data.rows[0].password;
    return res.json(data.rows[0]);
  } catch (e) {
    return next(e);
  }
});

router.get('/:username', requireAuthorization, async (req, res, next) => {
  // Return a single user
  try {
    const data = await db.query('SELECT * FROM users WHERE username = $1', [
      req.params.username
    ]);
    const jobData = await db.query(
      'SELECT id FROM applications WHERE username = $1',
      [req.params.username]
    );
    delete data.rows[0].password;
    data.rows[0].applied_to = [];
    jobData.rows.forEach(job => data.rows[0].applied_to.push(job.id));
    return res.json(data.rows[0]);
  } catch (e) {
    return next(e);
  }
});

router.patch('/:username', requireCorrectUser, async (req, res, next) => {
  // Update and return a user
  try {
    if (req.body.current_company) {
      // query companies to see if handle exists
      const companyResponse = await db.query(
        'SELECT * FROM companies WHERE handle=$1',
        [req.body.current_company]
      );
      //if not, throw an error
      if (companyResponse.rows.length === 0) {
        const badRequest = new Error('Company does not exist.');
        badRequest.status = 400;
        throw badRequest;
      }
    }
    const query = await selectivePatchQuery(
      'users',
      req.body,
      'username',
      req.params.username
    );
    const data = await db.query(query.query, query.values);

    delete data.rows[0].password;
    return res.json(data.rows[0]);
  } catch (e) {
    return next(e);
  }
});

router.delete('/:username', requireCorrectUser, async (req, res, next) => {
  // Delete and return a user
  try {
    const data = await db.query('SELECT * FROM users WHERE username = $1', [
      req.params.username
    ]);
    await db.query('DELETE FROM users WHERE username = $1', [
      req.params.username
    ]);
    return res.json(data.rows[0]);
  } catch (e) {
    return next(e);
  }
});

module.exports = router;
