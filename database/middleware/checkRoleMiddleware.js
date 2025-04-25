module.exports = function (roles) {
    return function (req, res, next) {
      if (!req.user) {
        return next(ApiError.unauthorized('Пользователь не авторизован'));
      }
  
      if (!roles.includes(req.user.role)) {
        return next(ApiError.forbidden('Нет доступа'));
      }
  
      next();
    };
  };
  