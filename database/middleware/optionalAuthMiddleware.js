// middleware/optionalAuthMiddleware.js
const jwt = require('jsonwebtoken');

// Middleware для обработки как авторизованных, так и анонимных запросов
module.exports = function(req, res, next) {
    try {
        const token = req.headers.authorization?.split(' ')[1]; // Bearer TOKEN
        
        if (token) {
            const decoded = jwt.verify(token, process.env.SECRET_KEY);
            req.user = decoded;
        }
        
        next();
    } catch (e) {
        console.log('Ошибка аутентификации, продолжаем как анонимный пользователь:', e.message);
        next();
    }
};