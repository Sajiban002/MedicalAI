const jwt = require('jsonwebtoken');
const ApiError = require('../error/ApiError');

module.exports = function (req, res, next) {
  if (req.method === 'OPTIONS') {
    return next();
  }

  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return next(ApiError.unauthorized('Пользователь не авторизован'));
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return next(ApiError.unauthorized('Пользователь не авторизован'));
    }

    const decoded = jwt.verify(token, process.env.SECRET_KEY);

    req.user = decoded;

    next();
  } catch (e) {
    return next(ApiError.unauthorized('Пользователь не авторизован'));
  }
};
