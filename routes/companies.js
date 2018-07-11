const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {
  requireAuthorization,
  requireCorrectCompany
} = require('../middleware/auth');

router.get('', requireAuthorization, async (req, res, next) => {
  // Return all companies
  try {
    const data = await db.query('SELECT * FROM companies');
    return res.json(data.rows);
  } catch (e) {
    return next(e);
  }
});

router.post('', async (req, res, next) => {
  // Create a new company
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const data = await db.query(
      'INSERT INTO companies (handle, password, name, logo) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.body.handle, hashedPassword, req.body.name, req.body.logo]
    );
    return res.json(data.rows[0]);
  } catch (e) {
    return next(e);
  }
});

router.get('/:id', requireAuthorization, async (req, res, next) => {
  // Return a single company
  try {
    const companyData = await db.query(
      'SELECT * FROM companies WHERE id = $1',
      [req.params.id]
    );
    const userData = await db.query(
      'SELECT id FROM users WHERE current_company_id = $1',
      [req.params.id]
    );
    const jobData = await db.query(
      'SELECT id FROM jobs WHERE company_id = $1',
      [req.params.id]
    );
    companyData.rows[0].users = userData.rows.map(item => item.id);
    companyData.rows[0].jobs = jobData.rows.map(item => item.id);
    return res.json(companyData.rows[0]);
  } catch (e) {
    return next(e);
  }
});

router.patch('/:id', requireCorrectCompany, async (req, res, next) => {
  // Update and return a company
  try {
    const companyData = await db.query(
      'UPDATE companies SET name = $1, logo = $2 WHERE id = $3 RETURNING *',
      [req.body.name, req.body.logo, req.params.id]
    );
    const userData = await db.query(
      'SELECT id FROM users WHERE current_company_id = $1',
      [req.params.id]
    );
    const jobData = await db.query(
      'SELECT id FROM jobs WHERE company_id = $1',
      [req.params.id]
    );
    companyData.rows[0].users = userData.rows.map(item => item.id);
    companyData.rows[0].jobs = jobData.rows.map(item => item.id);
    return res.json(companyData.rows[0]);
  } catch (e) {
    return next(e);
  }
});

router.delete('/:id', requireCorrectCompany, async (req, res, next) => {
  // Delete and return a user
  try {
    const companyData = await db.query('SELECT FROM companies WHERE id = $1', [
      req.params.id
    ]);
    const userData = await db.query(
      'SELECT id FROM users WHERE current_company_id = $1',
      [req.params.id]
    );
    const jobData = await db.query(
      'SELECT id FROM jobs WHERE company_id = $1',
      [req.params.id]
    );
    companyData.rows[0].users = userData.rows.map(item => item.id);
    companyData.rows[0].jobs = jobData.rows.map(item => item.id);
    await db.query('DELETE FROM companies WHERE id = $1', [req.params.id]);
    return res.json(companyData.rows[0]);
  } catch (e) {
    return next(e);
  }
});

router.post('/auth', async (req, res, next) => {
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
          { company_id: companyData.rows[0].id },
          'I_AM_THE_SECRET_KEY'
        );
        return res.json({ token });
      } else {
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
