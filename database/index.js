require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const path = require('path');
const fileUpload = require('express-fileupload');  // Add this import

const sequelize = require('./db');
const models = require('./models/model');
const router = require('./routes/index');
const errorHandler = require('./middleware/ErrorHandlingMiddleware');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(fileUpload({  // Add file upload middleware
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  abortOnLimit: true
}));

// Serve static files from the database directory
app.use('/database', express.static(path.join(__dirname, 'database')));

app.use('/api', router);
app.use(errorHandler);

// Тестовый маршрут
app.get('/', (req, res) => {
  res.status(200).json({ message: 'WORKING!!!' });
});

// Функция получения пользователя из токена
const getUserFromToken = (token) => {
  try {
    return jwt.verify(token, process.env.SECRET_KEY);
  } catch {
    return null;
  }
};

// Socket.io события
io.on('connection', (socket) => {
  console.log('Пользователь подключен:', socket.id);

  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
  });

  socket.on('sendMessage', async (data) => {
    const { chatRoomId, content, token } = data;

    if (!token || !chatRoomId || !content) return;

    // Проверяем токен и получаем пользователя
    const user = getUserFromToken(token);
    if (!user) return;

    try {
      // Проверка, что пользователь в чате
      const isMember = await models.ChatUser.findOne({
        where: { user_id: user.id, chat_room_id: chatRoomId },
      });
      if (!isMember) return;

      const chatRoom = await models.ChatRoom.findByPk(chatRoomId);
      if (!chatRoom || chatRoom.is_locked) return;

      // Сохраняем сообщение в БД
      const savedMessage = await models.ChatMessage.create({
        chat_room_id: chatRoomId,
        sender_id: user.id,
        content,
      });

      // Рассылаем новое сообщение всем участникам комнаты
      io.to(chatRoomId).emit('newMessage', {
        chatRoomId,
        content: savedMessage.content,
        sender_id: user.id,
        createdAt: savedMessage.createdAt,
      });
    } catch (err) {
      console.error('Ошибка при обработке sendMessage:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('Отключен:', socket.id);
  });
});

// Запуск сервера
const start = async () => {
  try {
    await sequelize.authenticate();
    console.log('Подключение к базе данных прошло успешно');

    await sequelize.sync();
    server.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
  } catch (e) {
    console.error('Ошибка при запуске сервера:', e);
  }
};

start();