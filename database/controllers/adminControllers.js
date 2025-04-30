// adminController
const { User, Doctor, ChatRoom, ChatUser, ChatMessage, MedicalRecord, Patient } = require('../models/model');
const { Op } = require('sequelize');
const sequelize = require('../db');


class AdminControllerrr {
  
    async getnotApprovedDoctors(req, res) {
        try {
            // Получаем фильтры из тела запроса
            const { minPrice, maxPrice, name, specialization, minExperience, maxExperience } = req.body;
    
            console.log('Полученные параметры:', { minPrice, maxPrice, name, specialization, minExperience, maxExperience });
    
            // Основные фильтры для модели User
            const filters = {
                role: 'doctor',
                ...(name && {
                    [Op.or]: [
                        { first_name: { [Op.iLike]: `%${name}%` } },
                        { last_name: { [Op.iLike]: `%${name}%` } },
                    ],
                }),
            };
    
            // Фильтры для модели Doctor
            const doctorFilters = {
                is_approved: false,
                ...(specialization && { specialization: { [Op.iLike]: `%${specialization}%` } }),
                ...(minPrice && maxPrice && { price: { [Op.between]: [minPrice, maxPrice] } }),
                ...(minPrice && !maxPrice && { price: { [Op.gte]: minPrice } }),
                ...(maxPrice && !minPrice && { price: { [Op.lte]: maxPrice } }),
                ...(minExperience && maxExperience && { experience_years: { [Op.between]: [minExperience, maxExperience] } }),
                ...(minExperience && !maxExperience && { experience_years: { [Op.gte]: minExperience } }),
                ...(maxExperience && !minExperience && { experience_years: { [Op.lte]: maxExperience } }),
            };
    
            // Включение информации о докторе
            const doctorInclude = {
                model: Doctor,
                as: 'doctor',
                where: doctorFilters, // Используем фильтры для доктора
                attributes: ['specialization', 'is_approved', 'price', 'experience_years', 'bio'],
            };
    
            // Выполняем запрос
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
    
  
  async approveDoctor(req, res) {
    try {
        // Получаем ID пользователя, которого нужно одобрить
        const { userId } = req.body;  // ID передается в теле запроса

        if (!userId) {
            return res.status(400).json({ message: 'ID пользователя не передано' });
        }

        // Ищем пользователя с ролью 'doctor'
        const user = await User.findOne({
            where: { id: userId, role: 'doctor' },
        });

        if (!user) {
            return res.status(404).json({ message: 'Доктор не найден' });
        }

        // Ищем запись в таблице Doctor по user_id
        const doctor = await Doctor.findOne({
            where: { user_id: user.id },  // Поиск по внешнему ключу user_id
        });

        if (!doctor) {
            return res.status(404).json({ message: 'Запись доктора не найдена в таблице Doctor' });
        }

        // Обновляем статус одобрения
        doctor.is_approved = true;
        await doctor.save(); // Сохраняем изменения в таблице Doctor

        // Отправляем имя и фамилию доктора вместе с сообщением об одобрении
        return res.status(200).json({
            message: 'Доктор успешно одобрен',
            doctorName: `${user.name} ${user.second_name}`,  // Отправляем имя и фамилию доктора
        });
    } catch (error) {
        console.error('Ошибка при одобрении доктора:', error);
        return res.status(500).json({ message: 'Ошибка сервера', error: error.message });
    }
  }

  async deleteDoctorFromDB(req, res) {
    try {
        // Получаем ID пользователя, которого нужно удалить
        const { doctorId } = req.body;  // Получаем ID из тела запроса

        if (!doctorId) {
            return res.status(400).json({ message: 'ID пользователя не передано' });
        }

        // Ищем запись в таблице Doctor по doctorId
        const doctor = await Doctor.findOne({
            where: { id: doctorId }, // Поиск по id доктора
        });

        if (!doctor) {
            return res.status(404).json({ message: 'Доктор не найден' });
        }

        // Ищем пользователя (User) с соответствующим user_id
        const user = await User.findOne({
            where: { id: doctor.user_id, role: 'doctor' }, // Ищем пользователя с ролью doctor
        });

        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        // Удаляем запись из таблицы Doctor
        await doctor.destroy();

        // Удаляем пользователя из таблицы User
        await user.destroy();

        // Отправляем имя и фамилию доктора вместе с сообщением о его удалении
        return res.status(200).json({
            message: 'Доктор успешно удален',
            doctorName: `${user.name} ${user.second_name}`,  // Отправляем имя и фамилию доктора
        });
    } catch (error) {
        console.error('Ошибка при удалении доктора:', error);
        return res.status(500).json({ message: 'Ошибка сервера', error: error.message });
    }
}
 

}

module.exports = new AdminControllerrr();
