// controllers/chatController.js
const { ChatRoom, ChatUser, ChatMessage, User, Doctor, Patient, MedicalRecord } = require('../models/model');
const ApiError = require('../error/ApiError');
const { Op } = require('sequelize');

class ChatController {
  // Получить список одобренных врачей
  async  getApprovedDoctors(req, res, next) {
    try {
      const doctors = await Doctor.findAll({
        where: {
          is_approved: true, // Только утвержденные врачи
        },
        include: [{
          model: User,
          attributes: ['first_name', 'last_name'], // Получаем имя и фамилию
          as: 'med_user',
        }],
        attributes: ['id', 'specialization', 'experience_years', 'price'], // Дополнительные атрибуты
      });
  
      // Формируем список врачей с полными именами
      const doctorList = doctors.map(doctor => {
        const user = doctor.med_user ? doctor.med_user.get() : null;
        return {
          id: doctor.id, // Добавляем поле id
          fullName: user ? `${user.first_name} ${user.last_name}` : 'Не указан',
          specialization: doctor.specialization,
          experienceYears: doctor.experience_years,
          price: doctor.price
        };
      });
  
      res.json(doctorList);
    } catch (err) {
      console.error('Ошибка при получении списка врачей:', err);
      next(ApiError.internal('Не удалось получить список врачей'));
    }
  }
  


  

  async createChatWithDoctor(req, res, next) {
    try {
      const { doctorId } = req.body;
      const userId = req.user.id;

      // Проверка доктора
      const doctor = await Doctor.findOne({
        where: { id: doctorId, is_approved: true },
        include: [{ model: User, as: 'med_user' }],
      });
      if (!doctor) return next(ApiError.badRequest('Доктор не найден или не одобрен'));

      // Проверка пользователя
      const user = await User.findByPk(userId);
      if (!user) return next(ApiError.unauthorized('Пользователь не найден'));

      // Проверка баланса
      if (parseFloat(user.wallet) < parseFloat(doctor.price)) {
        return next(ApiError.badRequest('Недостаточно средств на кошельке'));
      }

      // Создание комнаты чата
      const chatRoom = await ChatRoom.create({
        name_chat_room: `Чат: ${user.first_name} и ${doctor.med_user.first_name}`,
        is_locked: false,
      });

      // Добавляем пользователей в чат
      await ChatUser.bulkCreate([
        { user_id: user.id, chat_room_id: chatRoom.id },
        { user_id: doctor.med_user.id, chat_room_id: chatRoom.id },
      ]);

      // Перевод средств
      user.wallet = parseFloat(user.wallet) - parseFloat(doctor.price);
      await user.save();
      
      const doctorUser = await User.findByPk(doctor.med_user.id);
      doctorUser.wallet = parseFloat(doctorUser.wallet) + parseFloat(doctor.price);
      await doctorUser.save();
      
      res.json({
        message: 'Чат создан и оплачен',
        chatRoomId: chatRoom.id,
      });
    } catch (err) {
      console.error('Ошибка создания чата с доктором:', err);
      next(ApiError.internal('Не удалось создать чат'));
    }
  }

  async sendMessage(req, res, next) {
    try {
      const { chatRoomId, content } = req.body;
      const senderId = req.user.id;
  
      // Проверка комнаты
      const chatRoom = await ChatRoom.findByPk(chatRoomId);
      if (!chatRoom) return next(ApiError.notFound('Чат не найден'));
      if (chatRoom.is_locked) return next(ApiError.badRequest('Чат заблокирован'));
  
      // Проверка участника
      const isMember = await ChatUser.findOne({
        where: { user_id: senderId, chat_room_id: chatRoomId },
      });
      if (!isMember) return next(ApiError.forbidden('Вы не участник этого чата'));
  
      // Создание сообщения
      const message = await ChatMessage.create({
        chat_room_id: chatRoomId,
        sender_id: senderId,
        content,
      });
  
      // Уведомление участников чата о новом сообщении через сокет
      // Здесь предполагаем, что у вас есть доступ к серверу сокетов (например, `io`).
      const io = req.app.get('socketio'); // Получаем инстанс socket.io из приложения
      io.to(chatRoomId).emit('newMessage', {
        chatRoomId: chatRoomId,
        content: message.content,
        from_self: false,
        senderId: senderId,
      });
  
      res.json(message);
    } catch (err) {
      console.error('Ошибка при отправке сообщения:', err);
      next(ApiError.internal('Не удалось отправить сообщение'));
    }
  }
  
  async getMessages(req, res, next) {
    try {
      const { chatRoomId } = req.params;
      const userId = req.user.id;
      const { page = 1, limit = 20 } = req.query;  // Параметры пагинации (по умолчанию 1 страница и 20 сообщений на страницу)
  
      // Проверка участия
      const isMember = await ChatUser.findOne({
        where: { user_id: userId, chat_room_id: chatRoomId },
      });
      if (!isMember) return next(ApiError.forbidden('Вы не участник этого чата'));
  
      // Получение сообщений с пагинацией
      const messages = await ChatMessage.findAll({
        where: { chat_room_id: chatRoomId },
        include: {
          model: User,
          as: 'sender',
          attributes: ['first_name', 'last_name'],
        },
        order: [['createdAt', 'ASC']],
        limit: limit,
        offset: (page - 1) * limit,  // Для пагинации
      });
  
      res.json(messages);
    } catch (err) {
      console.error('Ошибка при получении сообщений:', err);
      next(ApiError.internal('Не удалось получить сообщения'));
    }
  }
  

  async getMyChats(req, res, next) {
    try {
      const userId = req.user.id;
  
      const chatUsers = await ChatUser.findAll({
        where: { user_id: userId },
        include: [
          {
            model: ChatRoom,
            include: [
              {
                model: ChatUser,
                as: 'chatUsers', // Используем правильный алиас
                include: {
                  model: User,
                  as: 'user', // Используем правильный алиас
                  attributes: ['id', 'first_name', 'last_name'],
                },
              },
            ],
          },
        ],
      });
  
      const chats = chatUsers.map((cu) => {
        const chatRoom = cu.chat_room;
        const partner = chatRoom.chatUsers.find(u => u.user.id !== userId)?.user; // Используем chatUsers и user
        return {
          id: chatRoom.id,
          is_locked: chatRoom.is_locked,
          partnerName: `${partner?.first_name || ''} ${partner?.last_name || ''}`.trim(),
        };
      });
  
      res.json(chats);
    } catch (e) {
      console.error('Ошибка при получении чатов:', e);
      next(ApiError.internal('Не удалось получить чаты'));
    }
  }
  
  

  
}

module.exports = new ChatController();
