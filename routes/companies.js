const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { selectivePatchQuery } = require('../helpers/selective_query');
const {
  requireAuthorization,
  requireCorrectCompany
} = require('../middleware/auth');

router.get('', requireAuthorization, async (req, res, next) => {
  // Return all companies
  try {
    let data = await db.query('SELECT * FROM companies');

    const updatedData = data.rows.map(async company => {
      delete company.password;
      const userData = await db.query(
        'SELECT username FROM users WHERE current_company = $1',
        [company.handle]
      );
      const jobData = await db.query('SELECT id FROM jobs WHERE company = $1', [
        company.handle
      ]);
      company.employees = userData.rows.map(item => item.username);
      company.jobs = jobData.rows.map(item => item.id);
      return company;
    });
    Promise.all(updatedData).then(val => {
      return res.json(val);
    });
  } catch (e) {
    return next(e);
  }
});

router.post('', async (req, res, next) => {
  // Create a new company
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const data = await db.query(
      'INSERT INTO companies (handle, password, name, logo, email) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [
        req.body.handle,
        hashedPassword,
        req.body.name,
        req.body.logo,
        req.body.email
      ]
    );
    delete data.rows[0].password;
    return res.json(data.rows[0]);
  } catch (e) {
    return next(e);
  }
});

router.get('/:handle', requireAuthorization, async (req, res, next) => {
  // Return a single company
  try {
    const companyData = await db.query(
      'SELECT * FROM companies WHERE handle = $1',
      [req.params.handle]
    );
    const userData = await db.query(
      'SELECT username FROM users WHERE current_company = $1',
      [req.params.handle]
    );
    const jobData = await db.query('SELECT id FROM jobs WHERE company = $1', [
      req.params.handle
    ]);
    delete companyData.rows[0].password;
    companyData.rows[0].users = userData.rows.map(item => item.username);
    companyData.rows[0].jobs = jobData.rows.map(item => item.id);
    return res.json(companyData.rows[0]);
  } catch (e) {
    return next(e);
  }
});

router.patch('/:handle', requireCorrectCompany, async (req, res, next) => {
  // Update and return a company
  try {
    const query = await selectivePatchQuery(
      'companies',
      req.body,
      'handle',
      req.params.handle
    );

    const companyData = await db.query(query.query, query.values);
    const userData = await db.query(
      'SELECT username FROM users WHERE current_company = $1',
      [req.params.handle]
    );
    const jobData = await db.query('SELECT id FROM jobs WHERE company = $1', [
      req.params.handle
    ]);
    delete companyData.rows[0].password;
    companyData.rows[0].users = userData.rows.map(item => item.username);
    companyData.rows[0].jobs = jobData.rows.map(item => item.id);
    return res.json(companyData.rows[0]);
  } catch (e) {
    return next(e);
  }
});

router.delete('/:handle', requireCorrectCompany, async (req, res, next) => {
  // Delete and return a user
  try {
    const companyData = await db.query(
      'SELECT * FROM companies WHERE handle = $1',
      [req.params.handle]
    );
    const userData = await db.query(
      'SELECT username FROM users WHERE current_company = $1',
      [req.params.handle]
    );
    const jobData = await db.query('SELECT id FROM jobs WHERE company = $1', [
      req.params.handle
    ]);
    companyData.rows[0].users = userData.rows.map(item => item.username);
    companyData.rows[0].jobs = jobData.rows.map(item => item.id);
    await db.query('DELETE FROM companies WHERE handle = $1', [
      req.params.handle
    ]);
    return res.json(companyData.rows[0]);
  } catch (e) {
    return next(e);
  }
});

module.exports = router;
