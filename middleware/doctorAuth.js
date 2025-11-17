// Middleware to protect doctor routes
module.exports = function (req, res, next) {
  if (req.session && req.session.doctor) {
    return next();
  } else {
    return res.redirect('/doctors/login');
  }
};
