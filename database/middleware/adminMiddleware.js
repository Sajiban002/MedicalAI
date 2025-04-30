// middleware/adminMiddleware.js
const ApiError = require('../error/ApiError');

module.exports = function(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return next(ApiError.forbidden('Доступ запрещен. Требуются права администратора'));
  }
};