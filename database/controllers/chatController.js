const { User, Doctor, ChatRoom, ChatUser, ChatMessage, MedicalRecord, Patient } = require('../models/model');
const { Op } = require('sequelize');
const sequelize = require('../db');

class DoctorController {
  async getApprovedDoctors(req, res) {
    try {
      const { minPrice, maxPrice, name, specialization } = req.body;
      console.log('Полученные параметры:', { minPrice, maxPrice, name, specialization });

      const filters = {
        role: 'doctor',
        ...(name && {
          [Op.or]: [
            { first_name: { [Op.iLike]: `%${name}%` } },
            { last_name: { [Op.iLike]: `%${name}%` } },
          ],
        }),
      };

      const doctorFilters = {
        is_approved: true,
        ...(specialization && { specialization: { [Op.iLike]: `%${specialization}%` } }),
        ...(minPrice && maxPrice && { price: { [Op.between]: [minPrice, maxPrice] } }),
        ...(minPrice && !maxPrice && { price: { [Op.gte]: minPrice } }),
        ...(maxPrice && !minPrice && { price: { [Op.lte]: maxPrice } }),
      };

      const doctorInclude = {
        model: Doctor,
        as: 'doctor',
        where: doctorFilters,
        attributes: ['specialization', 'is_approved', 'price', 'experience_years', 'bio'],
      };

      const doctors = await User.findAll({
        where: filters,
        include: [doctorInclude],
        attributes: ['id', ['first_name', 'name_user'], ['last_name', 'second_name'], 'wallet', 'role'],
      });

      return res.status(200).json(doctors);
    } catch (error) {
      console.error('Ошибка при получении одобренных докторов:', error);
      return res.status(500).json({ message: 'Ошибка сервера', error: error.message });
    }
  }

  async createChatAndTransfer(req, res) {
    try {
      console.log('Запрос на создание чата:', req.body);
      const { user_id, doctor_id } = req.body;

      if (!user_id || !doctor_id) {
        console.error('Ошибка: Не все поля заполнены');
        return res.status(400).json({ message: 'Не все поля заполнены' });
      }

      const user = await User.findOne({ where: { id: user_id } });
      if (!user) {
        console.error('Ошибка: Пользователь не найден, id:', user_id);
        return res.status(404).json({ message: 'Пользователь не найден' });
      }

      const doctorUser = await User.findOne({ where: { id: doctor_id } });
      if (!doctorUser) {
        console.error('Ошибка: Доктор не найден, id:', doctor_id);
        return res.status(404).json({ message: 'Доктор не найден' });
      }

      const doctor = await Doctor.findOne({ where: { user_id: doctor_id } });
      if (!doctor) {
        console.error('Ошибка: Профиль доктора не найден в таблице doctors');
        return res.status(404).json({ message: 'Доктор не найден в таблице doctors' });
      }

      const price = parseFloat(doctor.price);
      const userWallet = parseFloat(user.wallet);
      const doctorWallet = parseFloat(doctorUser.wallet);

      if (userWallet < price) {
        const shortage = (price - userWallet).toFixed(2);
        return res.status(400).json({
          message: `Недостаточно средств. Не хватает ${shortage} ₽ для начала консультации.`,
        });
      }

      const chatName = `${user.first_name} ${user.last_name} - ${doctorUser.first_name} ${doctorUser.last_name}`;
      const transaction = await sequelize.transaction();

      try {
        const chat = await ChatRoom.create(
          {
            name: chatName, // Исправлено с name_chat_room на name
            created_at: new Date(),
            is_locked: false,
          },
          { transaction }
        );

        await ChatUser.bulkCreate(
          [
            { user_id: user_id, chat_room_id: chat.id },
            { user_id: doctor_id, chat_room_id: chat.id },
          ],
          { transaction }
        );

        const userUpdate = await User.update(
          { wallet: userWallet - price },
          { where: { id: user_id }, transaction }
        );

        const doctorUpdate = await User.update(
          { wallet: doctorWallet + price },
          { where: { id: doctor_id }, transaction }
        );

        if (userUpdate[0] === 0 || doctorUpdate[0] === 0) {
          console.error('Ошибка при обновлении кошельков');
          return res.status(500).json({ message: 'Ошибка при обновлении кошельков' });
        }

        await transaction.commit();

        res.json({
          success: true,
          message: 'Чат успешно создан и средства переведены',
          chat,
        });
      } catch (error) {
        await transaction.rollback();
        console.error('Ошибка при создании чата и добавлении участников:', error);
        return res.status(500).json({ message: 'Ошибка при создании чата и добавлении участников' });
      }
    } catch (error) {
      console.error('Ошибка при обработке запроса:', error);
      return res.status(500).json({ message: 'Ошибка при обработке запроса' });
    }
  }

  async getChats(req, res) {
    const { user_id } = req.body;

    try {
      const user = await User.findOne({
        where: { id: user_id },
        attributes: ['role'],
      });

      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      const userRole = user.role;
      const chatRoomFilter = {};
      if (userRole === 'doctor') {
        chatRoomFilter.is_locked = false;
      }

      const chats = await ChatRoom.findAll({
        attributes: ['id', 'name', 'created_at'], // Исправлено с name_chat_room на name
        include: [
          {
            model: User,
            as: 'participants',
            where: { id: user_id },
            through: { attributes: [] },
            required: true,
          },
        ],
        where: chatRoomFilter,
      });

      return res.status(200).json({ chats, role: userRole });
    } catch (error) {
      console.error('Ошибка при получении чатов:', error.message);
      return res.status(500).json({
        error: 'Ошибка при получении чатов',
        details: error.message,
      });
    }
  }

  async getMessages(req, res) {
    const { chat_room_id } = req.body;

    try {
      const messages = await ChatMessage.findAll({
        where: { chat_room_id },
        order: [['sent_at', 'ASC']],
        attributes: ['id', 'sender_id', 'content', 'sent_at'],
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'first_name', 'last_name'],
          },
        ],
      });

      return res.status(200).json(messages);
    } catch (error) {
      console.error('Ошибка при получении сообщений для чата:', error.message);
      return res.status(500).json({
        message: 'Ошибка сервера',
        error: error.message,
      });
    }
  }

  async sendMessage(req, res) {
    const { chat_room_id, user_id, content } = req.body;

    try {
      const chatRoom = await ChatRoom.findByPk(chat_room_id);

      if (!chatRoom) {
        return res.status(404).json({ error: 'Чат не найден' });
      }

      if (chatRoom.is_locked) {
        return res.status(403).json({ error: 'Чат заблокирован. Отправка сообщений невозможна.' });
      }

      const newMessage = await ChatMessage.create({
        chat_room_id,
        sender_id: user_id,
        content,
      });

      return res.json({ message: 'Сообщение отправлено!', messageId: newMessage.id });
    } catch (error) {
      console.error('Ошибка при отправке сообщения:', error);
      res.status(500).json({ error: 'Ошибка при отправке сообщения', details: error.message });
    }
  }

  async lockChat(req, res) {
    const { chat_room_id } = req.body;

    try {
      console.log('Запрос на блокировку чата. ID чата:', chat_room_id);
      const t = await sequelize.transaction();

      try {
        console.log(`Блокировка чата с ID: ${chat_room_id}`);
        const lockResult = await ChatRoom.update(
          { is_locked: true },
          { where: { id: chat_room_id }, returning: true, transaction: t }
        );

        if (lockResult[0] === 0) {
          console.error('Ошибка: Чат с таким ID не найден');
          return res.status(404).json({ error: 'Чат с таким ID не найден' });
        }

        console.log('Чат заблокирован успешно:', lockResult[1][0]);
        await t.commit();

        res.json({
          success: true,
          message: 'Чат успешно заблокирован',
          chat: lockResult[1][0],
        });
      } catch (error) {
        console.error('Ошибка при блокировке чата:', error);
        await t.rollback();
        res.status(500).json({ success: false, error: error.message });
      }
    } catch (error) {
      console.error('Ошибка при получении данных чата:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async checkChatLock(req, res) {
    const { chat_room_id } = req.body;

    try {
      const chatRoom = await ChatRoom.findOne({
        where: { id: chat_room_id },
        attributes: ['is_locked'],
      });

      if (!chatRoom) {
        return res.status(404).json({ error: 'Чат не найден' });
      }

      res.json({ is_locked: chatRoom.is_locked });
    } catch (error) {
      console.error('Ошибка при проверке блокировки чата:', error);
      res.status(500).json({ error: 'Ошибка при проверке блокировки чата', details: error.message });
    }
  }

  async deleteChat(req, res) {
    const { chat_room_id } = req.body;

    try {
      console.log('Received chat_room_id:', chat_room_id);
      const chat = await ChatRoom.findOne({
        where: { id: chat_room_id },
      });

      if (!chat) {
        console.error('Chat not found');
        return res.status(404).json({ error: 'Чат не найден' });
      }

      console.log('Chat found, deleting associated data...');
      const chatUserDeleteResult = await ChatUser.destroy({
        where: { chat_room_id: chat_room_id },
      });

      if (chatUserDeleteResult === 0) {
        console.warn('No associated users found in chat_user table');
      }

      const messageDeleteResult = await ChatMessage.destroy({
        where: { chat_room_id: chat_room_id },
      });

      if (messageDeleteResult === 0) {
        console.warn('No messages found to delete in the ChatMessage table');
      }

      await chat.destroy();
      console.log('Chat and associated data successfully deleted');

      return res.json({ message: 'Чат успешно удален' });
    } catch (error) {
      console.error('Ошибка при удалении чата:', error);
      return res.status(500).json({ error: 'Ошибка при удалении чата', details: error.message });
    }
  }

  async getPatientFullInfo(req, res) {
    const { chatId } = req.params;

    if (!chatId) {
      return res.status(400).json({ error: 'chatId не передан в запросе' });
    }

    try {
      const chatRoom = await ChatRoom.findOne({ where: { id: chatId } });
      if (!chatRoom) {
        return res.status(404).json({ error: 'Чат не найден' });
      }

      const chatUsers = await ChatUser.findAll({
        where: { chat_room_id: chatId },
        attributes: ['user_id'],
      });

      if (!chatUsers || chatUsers.length === 0) {
        return res.status(404).json({ error: 'Участники чата не найдены' });
      }

      for (const chatUser of chatUsers) {
        const userId = chatUser.user_id;

        const userRole = await User.findOne({
          where: { id: userId },
          attributes: ['role', 'first_name', 'last_name'],
        });

        if (userRole && userRole.role === 'user') {
          const patientData = await Patient.findOne({
            where: { user_id: userId },
            include: [
              {
                model: MedicalRecord,
                as: 'medicalRecords',
                attributes: ['diagnosis', 'treatment', 'created_at'],
                include: [
                  {
                    model: Doctor,
                    as: 'doctor',
                    include: [
                      {
                        model: User,
                        attributes: ['first_name', 'last_name'],
                      },
                    ],
                  },
                ],
              },
            ],
          });

          if (!patientData) {
            return res.status(404).json({ error: 'Пациент не найден' });
          }

          const records = patientData.medicalRecords.map((record) => ({
            diagnosis: record.diagnosis,
            treatment: record.treatment,
            doctor_name: record.doctor?.med_user
              ? `${record.doctor.med_user.first_name} ${record.doctor.med_user.last_name}`
              : null,
          }));

          const patientInfo = {
            user: {
              first_name: userRole.first_name,
              last_name: userRole.last_name,
            },
            patient_details: {
              phone: patientData.phone || 'Не указано',
              blood_type: patientData.blood_type || 'Не указано',
              allergies: patientData.allergies || 'Не указаны',
              chronic_conditions: patientData.chronic_conditions || 'Не указаны',
            },
            records,
          };

          return res.json(patientInfo);
        }
      }

      return res.status(404).json({ error: 'Пациент с ролью "user" в этом чате не найден' });
    } catch (error) {
      console.error('Ошибка при получении данных пациента:', error);
      return res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
  }

  async addMedicalRecord(req, res) {
    const { diagnosis, treatment, chatId } = req.body;

    if (!diagnosis) {
      return res.status(400).json({ error: 'Диагноз не указан' });
    }

    if (!chatId) {
      return res.status(400).json({ error: 'chatId не передан в запросе' });
    }

    try {
      const chatRoom = await ChatRoom.findOne({ where: { id: chatId } });
      if (!chatRoom) {
        return res.status(404).json({ error: 'Чат не найден' });
      }

      const chatUsers = await ChatUser.findAll({
        where: { chat_room_id: chatId },
        attributes: ['user_id'],
      });

      if (!chatUsers || chatUsers.length === 0) {
        return res.status(404).json({ error: 'Участники чата не найдены' });
      }

      let patientUserId = null;
      let doctorId = null;

      for (let chatUser of chatUsers) {
        const user = await User.findOne({
          where: { id: chatUser.user_id },
          attributes: ['role'],
        });

        if (user && user.role === 'user') {
          patientUserId = chatUser.user_id;
        }
        if (user && user.role === 'doctor') {
          doctorId = chatUser.user_id;
        }
      }

      if (!patientUserId || !doctorId) {
        return res.status(404).json({ error: 'Не найден ни пациент, ни доктор в чате' });
      }

      const doctor = await Doctor.findOne({ where: { user_id: doctorId } });
      if (!doctor) {
        return res.status(404).json({ error: `Врач с ID ${doctorId} не найден в таблице doctors` });
      }

      const patient = await Patient.findOne({ where: { user_id: patientUserId } });
      if (!patient) {
        return res.status(404).json({ error: 'Пациент не найден в таблице patients' });
      }

      const newRecordData = {
        diagnosis,
        treatment: treatment || null,
        created_at: new Date(),
        patient_id: patient.id,
        doctor_id: doctor.id,
      };

      const newRecord = await MedicalRecord.create(newRecordData);

      return res.status(201).json({
        message: 'Медицинская запись успешно добавлена',
        data: newRecord,
      });
    } catch (error) {
      console.error('Ошибка при добавлении медицинской записи:', error);
      return res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
  }
}

module.exports = new DoctorController();