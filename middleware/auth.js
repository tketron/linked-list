const jwt = require('jsonwebtoken');

function requireAuthorization(req, res, next) {
  // Verifies token
  try {
    const token = req.headers.authorization;
    const decodedToken = jwt.verify(token, 'I_AM_THE_SECRET_KEY');
    return next();
  } catch (e) {
    return res.json({ message: 'unauthorized' });
  }
}

function requireCorrectUser(req, res, next) {
  // Verifies token and correct user
  try {
    const token = req.headers.authorization;
    const decodedToken = jwt.verify(token, 'I_AM_THE_SECRET_KEY');
    if (decodedToken.user_id === +req.params.id) {
      return next();
    } else {
      return res.json({ message: 'unauthorized' });
    }
  } catch (e) {
    return res.json({ message: 'unauthorized' });
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
      return res.json({ message: 'unauthorized' });
    }
  } catch (e) {
    return res.json({ message: 'unauthorized' });
  }
}

module.exports = {
  requireAuthorization,
  requireCorrectUser,
  requireCorrectCompany
};
