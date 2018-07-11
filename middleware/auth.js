const jwt = require('jsonwebtoken');

function requireAuthorization(req, res, next) {
  // Verifies token
  try {
    const token = req.headers.authorization;
    const decodedToken = jwt.verify(token, 'I_AM_THE_SECRET_KEY');
    return next();
  } catch (e) {
    const unauthorized = new Error(
      'You need to authenticate before accessing this resource.'
    );
    unauthorized.status = 401;
    unauthorized.title = 'Unauthorized';
    return next(unauthorized);
  }
}

function requireCorrectUser(req, res, next) {
  // Verifies token and correct user
  try {
    const token = req.headers.authorization;
    const decodedToken = jwt.verify(token, 'I_AM_THE_SECRET_KEY');
    if (decodedToken.username === req.params.username) {
      return next();
    } else {
      throw 'Forbidden';
    }
  } catch (e) {
    const forbidden = new Error('You are not allowed to access this resource.');
    forbidden.status = 403;
    forbidden.title = 'Forbidden';
    return next(forbidden);
  }
}

function requireCorrectCompany(req, res, next) {
  //Verifies the token and correct company
  try {
    const token = req.headers.authorization;
    const decodedToken = jwt.verify(token, 'I_AM_THE_SECRET_KEY');
    if (decodedToken.company_id === +req.params.id) {
      return next();
    } else {
      throw 'Forbidden';
    }
  } catch (e) {
    const forbidden = new Error('You are not allowed to access this resource.');
    forbidden.status = 403;
    forbidden.title = 'Forbidden';
    return next(forbidden);
  }
}

module.exports = {
  requireAuthorization,
  requireCorrectUser,
  requireCorrectCompany
};
