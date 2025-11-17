// Middleware to protect patient routes
module.exports = function (req, res, next) {
  if (req.session && req.session.patient) {
    return next();
  } else {
    return res.redirect('/patients/login');
  }
};
