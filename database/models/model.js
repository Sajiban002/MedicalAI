// model.js
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

// Таблица пользователей
const User = sequelize.define('med_users', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  role: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'user',
    validate: { isIn: [['user', 'doctor', 'admin']] },
  },
  first_name: { type: DataTypes.STRING(50), allowNull: false },
  last_name: { type: DataTypes.STRING(50), allowNull: false },
  date_of_birth: { type: DataTypes.DATEONLY, allowNull: false },
  gender: {
    type: DataTypes.CHAR(1),
    allowNull: false,
    validate: { isIn: [['M', 'F']] },
  },
  email: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  wallet: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0.00 },
  avatar: { type: DataTypes.STRING(255), allowNull: true }, // Путь к файлу аватара
  ai_history_enabled: { type: DataTypes.BOOLEAN, defaultValue: true }, // Флаг для разрешения сохранения истории запросов
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  timestamps: false,
  tableName: 'med_users',
});

// Таблица пациентов
const Patient = sequelize.define('patients', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: { model: 'med_users', key: 'id' },
    onDelete: 'CASCADE',
  },
  phone: { type: DataTypes.STRING(20) },
  blood_type: { type: DataTypes.STRING(3) },
  allergies: { type: DataTypes.TEXT },
  chronic_conditions: { type: DataTypes.TEXT },
}, {
  timestamps: false,
  tableName: 'patients',
});

// Таблица врачей
const Doctor = sequelize.define('doctors', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: { model: 'med_users', key: 'id' },
    onDelete: 'CASCADE',
  },
  specialization: { type: DataTypes.STRING(100) },
  experience_years: { type: DataTypes.INTEGER },
  bio: { type: DataTypes.TEXT },
  is_approved: { type: DataTypes.BOOLEAN, defaultValue: false },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 500.00,
  },
}, {
  timestamps: false,
  tableName: 'doctors',
});

// Таблица для хранения истории диагнозов и запросов к нейронной сети
const DiagnosisHistory = sequelize.define('diagnosis_history', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  diagnosis_id: { type: DataTypes.STRING(36), allowNull: false, unique: true }, // UUID диагноза
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true, // Может быть null для анонимных пользователей
    references: { model: 'med_users', key: 'id' },
    onDelete: 'SET NULL',
  },
  symptoms: { type: DataTypes.TEXT, allowNull: false },
  diagnosis_data: { type: DataTypes.JSON, allowNull: false }, // Полные данные диагноза в JSON
  file_path: { type: DataTypes.STRING(255), allowNull: true }, // Путь к JSON файлу для бэкапа/восстановления
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  timestamps: false,
  tableName: 'diagnosis_history',
  indexes: [
    { fields: ['diagnosis_id'], unique: true },
    { fields: ['user_id'] },
    { fields: ['created_at'] }
  ]
});

// Комнаты чатов
const ChatRoom = sequelize.define('chat_rooms', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(255), allowNull: false },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  is_locked: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  timestamps: false,
  tableName: 'chat_rooms',
});

// Участники чатов
const ChatUser = sequelize.define('chat_users', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'med_users', key: 'id' },
    onDelete: 'CASCADE',
  },
  chat_room_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'chat_rooms', key: 'id' },
    onDelete: 'CASCADE',
  },
}, {
  timestamps: false,
  tableName: 'chat_users',
});

// Сообщения
const ChatMessage = sequelize.define('chat_messages', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  chat_room_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'chat_rooms', key: 'id' },
    onDelete: 'CASCADE',
  },
  sender_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'med_users', key: 'id' },
    onDelete: 'CASCADE',
  },
  content: { type: DataTypes.TEXT, allowNull: false },
  sent_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  timestamps: false,
  tableName: 'chat_messages',
});

// Медицинские записи
const MedicalRecord = sequelize.define('medical_records', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  patient_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'patients', key: 'id' },
    onDelete: 'CASCADE',
  },
  doctor_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'doctors', key: 'id' },
    onDelete: 'CASCADE',
  },
  diagnosis: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  treatment: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'medical_records',
  timestamps: false,
});

// Определение отношений между моделями
User.hasOne(Doctor, { foreignKey: 'user_id', as: 'doctor' });
Doctor.belongsTo(User, { foreignKey: 'user_id' });

User.hasOne(Patient, { foreignKey: 'user_id', as: 'patient' });
Patient.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(DiagnosisHistory, { foreignKey: 'user_id', as: 'diagnoses' });
DiagnosisHistory.belongsTo(User, { foreignKey: 'user_id' });

// Ассоциации чатов
User.belongsToMany(ChatRoom, {
  through: ChatUser,
  foreignKey: 'user_id',
  otherKey: 'chat_room_id',
  as: 'chatRooms',
});

ChatRoom.belongsToMany(User, {
  through: ChatUser,
  foreignKey: 'chat_room_id',
  otherKey: 'user_id',
  as: 'participants',
});

ChatRoom.hasMany(ChatMessage, { foreignKey: 'chat_room_id', as: 'messages' });
ChatMessage.belongsTo(ChatRoom, { foreignKey: 'chat_room_id' });

User.hasMany(ChatMessage, { foreignKey: 'sender_id', as: 'sentMessages' });
ChatMessage.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });

// Ассоциации для медицинских записей
Patient.hasMany(MedicalRecord, { foreignKey: 'patient_id', as: 'medicalRecords' });
Doctor.hasMany(MedicalRecord, { foreignKey: 'doctor_id', as: 'medicalRecords' });
MedicalRecord.belongsTo(Patient, { foreignKey: 'patient_id', as: 'patient' });
MedicalRecord.belongsTo(Doctor, { foreignKey: 'doctor_id', as: 'doctor' });

// Дополнительные связи для чатов
ChatRoom.hasMany(ChatUser, { foreignKey: 'chat_room_id', as: 'chatUsers' });
ChatUser.belongsTo(ChatRoom, { foreignKey: 'chat_room_id' });

ChatUser.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(ChatUser, { foreignKey: 'user_id', as: 'chatUsers' });

// Синхронизация с базой данных
sequelize.sync({ alter: true })
  .then(() => console.log('База данных синхронизирована!'))
  .catch((err) => console.error('Ошибка синхронизации базы данных:', err));

module.exports = {
  User,
  Patient,
  Doctor,
  DiagnosisHistory,
  ChatRoom,
  ChatUser,
  ChatMessage,
  MedicalRecord,
};