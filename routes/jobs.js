const express = require('express');
const router = express.Router();
const db = require('../db');
const { selectivePatchQuery } = require('../helpers/selective_query');
const {
  requireAuthorization,
  requireCompanyAuthorization,
  requireCorrectCompany,
  requireUserAuthorization
} = require('../middleware/auth');

router.get('', requireAuthorization, async (req, res, next) => {
  // Get all jobs
  try {
    const data = await db.query('SELECT * FROM jobs');
    data.rows.forEach(item => delete item.id);
    return res.json(data.rows);
  } catch (e) {
    return next(e);
  }
});

router.post('', requireCompanyAuthorization, async (req, res, next) => {
  // Create a new job
  try {
    const company = req.company;

    const data = await db.query(
      'INSERT INTO jobs (title, salary, equity, company) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.body.title, req.body.salary, req.body.equity, company]
    );
    delete data.rows[0].id;
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
    delete data.rows[0].id;
    return res.json(data.rows[0]);
  } catch (e) {
    return next(e);
  }
});

router.patch('/:id', requireCompanyAuthorization, async (req, res, next) => {
  // Update a specific job
  try {
    const jobData = await db.query('SELECT company FROM jobs WHERE id = $1', [
      req.params.id
    ]);

    if (req.company !== jobData.rows[0].company) {
      const forbidden = new Error('You are not allowed to edit this resource.');
      forbidden.status = 403;
      forbidden.title = 'Forbidden';
      throw forbidden;
    }

    const query = await selectivePatchQuery(
      'jobs',
      req.body,
      'id',
      req.params.id
    );
    const patchedData = await db.query(query.query, query.values);

    delete patchedData.rows[0].id;
    return res.json(patchedData.rows[0]);
  } catch (e) {
    return next(e);
  }
});

router.delete('/:id', requireCompanyAuthorization, async (req, res, next) => {
  // Delete a specific job
  try {
    const jobData = await db.query('SELECT * FROM jobs WHERE id = $1', [
      req.params.id
    ]);

    if (req.company !== jobData.rows[0].company) {
      const forbidden = new Error('You are not allowed to edit this resource.');
      forbidden.status = 403;
      forbidden.title = 'Forbidden';
      throw forbidden;
    }

    await db.query('DELETE FROM jobs WHERE id = $1', [req.params.id]);
    delete jobData.rows[0].id;
    return res.json(jobData.rows[0]);
  } catch (e) {
    return next(e);
  }
});

router.post(
  '/:id/applications',
  requireUserAuthorization,
  async (req, res, next) => {
    try {
      const jobUserData = await db.query(
        `INSERT INTO applications (job_id, username) VALUES ($1, $2)`,
        [req.params.id, req.username]
      );
      return res.json({ message: 'Successfully applied for job.' });
    } catch (e) {
      next(e);
    }
  }
);

router.delete(
  '/:id/applications/:applicationID',
  requireAuthorization,
  async (req, res, next) => {
    try {
      if (req.decodedToken.username) {
        const jobUserData = await db.query(
          `SELECT * FROM applications WHERE id=$1`,
          [req.params.applicationID]
        );
        if (jobUserData.rows[0].username !== req.decodedToken.username) {
          const forbidden = new Error(
            'You are not allowed to access this resource.'
          );
          forbidden.status = 403;
          throw forbidden;
        } else {
          const deleteJobUserData = await db.query(
            `DELETE FROM applications WHERE id=$1`,
            [req.params.applicationID]
          );
          return res.send({ message: 'Successfully deleted job application.' });
        }
      } else if (req.decodedToken.handle) {
        const targetJob = await db.query(
          `SELECT company FROM jobs WHERE id=$1`,
          [req.params.id]
        );
        if (targetJob.rows[0].company !== req.decodedToken.handle) {
          const forbidden = new Error(
            'You are not allowed to access this resource.'
          );
          forbidden.status = 403;
          throw forbidden;
        } else {
          const deleteJobUserData = await db.query(
            `DELETE FROM applications WHERE id=$1`,
            [req.params.applicationID]
          );
          return res.send({ message: 'Successfully deleted job application.' });
        }
        const unauthorized = new Error(
          'You need to authenticate before accessing this resource.'
        );
        unauthorized.status = 401;
        throw unauthorized;
      }
    } catch (e) {
      next(e);
    }
  }
);

module.exports = router;
