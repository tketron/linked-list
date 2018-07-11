const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuthorization } = require('../middleware/auth');

router.get('', requireAuthorization, async (req, res, next) => {
  // Get all jobs
  try {
    const data = await db.query('SELECT * FROM jobs');
    return res.json(data.rows);
  } catch (e) {
    return next(e);
  }
});

router.post('', requireAuthorization, async (req, res, next) => {
  // Create a new job
  try {
    const data = await db.query(
      'INSERT INTO jobs (title, salary, equity, company_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.body.title, req.body.salary, req.body.equity, req.body.company_id]
    );
    return res.json(data.rows[0]);
  } catch (e) {
    return next(e);
  }
});

router.get('/:id', requireAuthorization, async (req, res, next) => {
  // Get information about a specific job
  try {
    const data = await db.query('SELECT * FROM jobs WHERE id = $1', [
      req.params.id
    ]);
    return res.json(data.rows[0]);
  } catch (e) {
    return next(e);
  }
});

router.patch('/:id', async (req, res, next) => {
  // Update a specific job
  try {
    const data = await db.query(
      'UPDATE jobs SET title = $1, salary = $2, equity = $3, company_id = $4 WHERE id = $5 RETURNING *',
      [
        req.body.title,
        req.body.salary,
        req.body.equity,
        req.body.company_id,
        req.params.id
      ]
    );
    return res.json(data.rows[0]);
  } catch (e) {
    return next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  // Delete a specific job
  try {
    const data = await db.query('SELECT * FROM jobs WHERE id = $1', [
      req.params.id
    ]);
    await db.query('DELETE FROM jobs WHERE id = $1', [req.params.id]);
    return res.json(data.rows[0]);
  } catch (e) {
    return next(e);
  }
});

module.exports = router;
