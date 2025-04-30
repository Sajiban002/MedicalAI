import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import '../css/profile.css';

const ProfileInfo = () => {
  const [profile, setProfile] = useState(null);
  const [doctorData, setDoctorData] = useState(null);
  const [editingDoctor, setEditingDoctor] = useState(false);
  const [editingPatient, setEditingPatient] = useState(false);
  const [doctorFormData, setDoctorFormData] = useState({
    specialization: '',
    experience_years: '',
    bio: '',
    price: '',
  });
  const [patientFormData, setPatientFormData] = useState({
    phone: '',
    allergies: '',
    chronic_conditions: '',
  });
  const [topUpAmount, setTopUpAmount] = useState('');
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [aiHistoryEnabled, setAiHistoryEnabled] = useState(true);
  const [diagnosisHistory, setDiagnosisHistory] = useState([]);
  const [historyStats, setHistoryStats] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Нет токена авторизации');
          return;
        }

        const response = await axios.get('http://localhost:5001/api/user/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });

        setProfile(response.data);
        setAiHistoryEnabled(response.data.ai_history_enabled);

        if (response.data.role === 'doctor') {
          const doctorRes = await axios.get('http://localhost:5001/api/doctor/me', {
            headers: { Authorization: `Bearer ${token}` },
          });

          setDoctorData(doctorRes.data);
          setDoctorFormData({
            specialization: doctorRes.data.specialization || '',
            experience_years: doctorRes.data.experience_years?.toString() || '',
            bio: doctorRes.data.bio || '',
            price: doctorRes.data.price?.toString() || '',
          });
        }

        if (response.data.role === 'user' && response.data.patient) {
          setPatientFormData({
            phone: response.data.patient.phone || '',
            allergies: response.data.patient.allergies || '',
            chronic_conditions: response.data.patient.chronic_conditions || '',
          });
        }

        // Загружаем историю диагнозов, если пользователь авторизован
        fetchDiagnosisHistory();
        fetchDiagnosisStats();

      } catch (err) {
        console.error(err);
        setError('Ошибка при получении профиля');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const fetchDiagnosisHistory = async () => {
    try {
      setHistoryLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      // Исправлено: используем правильный путь к API истории диагнозов
      const response = await axios.get('http://localhost:5001/api/diagnosis', {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 5, offset: 0 }
      });

      setDiagnosisHistory(response.data.rows);
    } catch (err) {
      console.error('Ошибка при загрузке истории диагнозов:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchDiagnosisStats = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Исправлено: используем правильный путь к API статистики диагнозов
      const response = await axios.get('http://localhost:5001/api/diagnosis/stats/user', {
        headers: { Authorization: `Bearer ${token}` },
      });

      setHistoryStats(response.data);
    } catch (err) {
      console.error('Ошибка при загрузке статистики диагнозов:', err);
    }
  };

  const handleDoctorChange = (e) => {
    setDoctorFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleDoctorSave = async () => {
    try {
      const token = localStorage.getItem('token');
      const payload = {
        ...doctorFormData,
        experience_years: parseInt(doctorFormData.experience_years),
        price: parseFloat(doctorFormData.price),
      };

      await axios.put('http://localhost:5001/api/doctor/me', payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const updatedDoctor = await axios.get('http://localhost:5001/api/doctor/me', {
        headers: { Authorization: `Bearer ${token}` },
      });

      setDoctorData(updatedDoctor.data);
      setDoctorFormData({
        specialization: updatedDoctor.data.specialization || '',
        experience_years: updatedDoctor.data.experience_years?.toString() || '',
        bio: updatedDoctor.data.bio || '',
        price: updatedDoctor.data.price?.toString() || '',
      });
      setEditingDoctor(false);
    } catch (err) {
      console.error(err);
      alert('Ошибка при обновлении данных врача');
    }
  };

  const handlePatientChange = (e) => {
    setPatientFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handlePatientSave = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put('http://localhost:5001/api/patient/me', patientFormData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setEditingPatient(false);

      const updated = await axios.get('http://localhost:5001/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfile(updated.data);
    } catch (err) {
      console.error(err);
      alert('Ошибка при обновлении данных пациента');
    }
  };

  const handleTopUp = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:5001/api/user/topup', {
        amount: parseFloat(topUpAmount),
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setShowTopUpModal(false);
      setTopUpAmount('');
      const updatedProfile = await axios.get('http://localhost:5001/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfile(updatedProfile.data);
    } catch (err) {
      console.error(err);
      alert('Ошибка при пополнении кошелька');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Вы уверены, что хотите удалить аккаунт?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete('http://localhost:5001/api/doctor/me', {
        headers: { Authorization: `Bearer ${token}` },
      });

      logout();
      navigate('/');
    } catch (err) {
      console.error(err);
      alert('Ошибка при удалении аккаунта');
    }
  };

  // Обработчик изменения файла аватара
  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
    }
  };

  // Загрузка аватара на сервер
  const handleAvatarUpload = async () => {
    if (!avatarFile) {
      alert('Сначала выберите файл');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('avatar', avatarFile);

      const response = await axios.post('http://localhost:5001/api/user/avatar', formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      // Обновляем профиль, чтобы увидеть новый аватар
      const updatedProfile = await axios.get('http://localhost:5001/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setProfile(updatedProfile.data);
      setAvatarFile(null);
      alert('Аватар успешно обновлен');
    } catch (err) {
      console.error('Ошибка при загрузке аватара:', err);
      alert('Ошибка при загрузке аватара');
    }
  };

  // Обработчик переключения настроек сохранения истории
  const handleAiHistoryToggle = async () => {
    try {
      const token = localStorage.getItem('token');
      const newValue = !aiHistoryEnabled;
      
      await axios.put('http://localhost:5001/api/user/ai-history-settings', 
        { enabled: newValue },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setAiHistoryEnabled(newValue);
      alert(`История диагнозов ${newValue ? 'включена' : 'отключена'}`);
    } catch (err) {
      console.error('Ошибка при обновлении настроек истории:', err);
      alert('Ошибка при обновлении настроек');
    }
  };

  // Удаление записи из истории диагнозов
  const handleDeleteDiagnosis = async (diagnosisId) => {
    if (!window.confirm('Удалить этот диагноз из истории?')) return;
    
    try {
      const token = localStorage.getItem('token');
      // Исправлено: используем правильный путь для удаления диагноза
      await axios.delete(`http://localhost:5001/api/diagnosis/${diagnosisId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Обновляем список и статистику
      fetchDiagnosisHistory();
      fetchDiagnosisStats();
      alert('Диагноз удален из истории');
    } catch (err) {
      console.error('Ошибка при удалении диагноза:', err);
      alert('Ошибка при удалении диагноза');
    }
  };

  if (loading) return <p>Загрузка...</p>;
  if (error) return <p className="error-text">{error}</p>;
  if (!profile) return null;

  // Определяем источник аватара из профиля
  const avatarSrc = profile.avatar 
    ? `http://localhost:5001${profile.avatar}` 
    : `/images/default-${profile.role === 'doctor' ? 'doctor' : 'patient'}.png`;

  return (
    <div className="profile-wrapper">
      <div className="profile-avatar-container">
        <img src={avatarSrc} alt="Профиль" className="profile-avatar" />
        
        {/* Форма загрузки аватара */}
        <div className="avatar-upload">
          <input 
            type="file" 
            id="avatar-upload" 
            onChange={handleAvatarChange}
            accept="image/jpeg,image/png,image/gif,image/webp"
          />
          <button className="btn" onClick={handleAvatarUpload} disabled={!avatarFile}>
            Загрузить аватар
          </button>
        </div>
      </div>

      <div className="profile-info">
        
        {/* Блок - Данные пользователя */}
        <div className="profile-block">
          <h3>Данные пользователя</h3>
          <p><strong>Имя:</strong> {profile.first_name} {profile.last_name}</p>
          <p><strong>Email:</strong> {profile.email}</p>
          <p><strong>Роль:</strong> {profile.role}</p>
          <p><strong>Дата рождения:</strong> {profile.date_of_birth}</p>
          <p><strong>Гендер:</strong> {profile.gender}</p>
          <p><strong>Баланс:</strong> {profile.wallet} ₸ 
            <button className="btn" onClick={() => setShowTopUpModal(true)}>Пополнить</button>
          </p>

          {/* Настройки сохранения истории AI */}
          <div className="ai-history-settings">
            <h4>Настройки истории диагнозов</h4>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={aiHistoryEnabled}
                onChange={handleAiHistoryToggle}
              />
              <span className="slider"></span>
            </label>
            <span>
              {aiHistoryEnabled ? 'История сохраняется' : 'История отключена'}
            </span>
          </div>
        </div>

        {/* Блок - Данные пациента */}
        {profile.role === 'user' && profile.patient && (
          <div className="profile-block">
            <h3>Данные пациента</h3>
            <p><strong>Телефон:</strong> {profile.patient.phone || 'Не указан'}</p>
            <p><strong>Аллергии:</strong> {profile.patient.allergies || 'Нет'}</p>
            <p><strong>Хронические болезни:</strong> {profile.patient.chronic_conditions || 'Нет'}</p>
            <button className="btn" onClick={() => setEditingPatient(true)}>Редактировать</button>
          </div>
        )}

        {/* Блок - Данные врача */}
        {profile.role === 'doctor' && doctorData && (
          <div className="profile-block">
            <h3>Данные врача</h3>
            <p><strong>Специализация:</strong> {doctorData.specialization}</p>
            <p><strong>Опыт:</strong> {doctorData.experience_years} лет</p>
            <p><strong>О себе:</strong> {doctorData.bio}</p>
            <p><strong>Цена за приём:</strong> {doctorData.price} ₸</p>
            <button className="btn" onClick={() => setEditingDoctor(true)}>Редактировать</button>
          </div>
        )}

        {/* Блок - История диагнозов */}
        <div className="profile-block diagnosis-history">
          <h3>История диагнозов</h3>
          
          {historyStats && (
            <div className="history-stats">
              <p><strong>Всего диагнозов:</strong> {historyStats.total_diagnoses}</p>
              {historyStats.first_diagnosis_date && 
                <p><strong>Первый диагноз:</strong> {new Date(historyStats.first_diagnosis_date).toLocaleDateString()}</p>
              }
              {historyStats.latest_diagnosis_date && 
                <p><strong>Последний диагноз:</strong> {new Date(historyStats.latest_diagnosis_date).toLocaleDateString()}</p>
              }
            </div>
          )}
          
          {historyLoading ? (
            <p>Загрузка истории...</p>
          ) : diagnosisHistory.length > 0 ? (
            <div className="diagnosis-list">
              {diagnosisHistory.map(item => (
                <div key={item.id} className="diagnosis-item">
                  <div className="diagnosis-info">
                    <p><strong>Дата:</strong> {new Date(item.created_at).toLocaleString()}</p>
                    <p><strong>Симптомы:</strong> {item.symptoms}</p>
                    <p><strong>Диагноз:</strong> {
                      item.diagnosis_data && item.diagnosis_data.diagnosis 
                        ? item.diagnosis_data.diagnosis.slice(0, 100) + '...' 
                        : item.main_diagnosis 
                          ? item.main_diagnosis.slice(0, 100) + '...'
                          : 'Нет данных'
                    }</p>
                  </div>
                  <div className="diagnosis-actions">
                    <button 
                      className="btn small"
                      onClick={() => navigate(`/diagnosis/${item.diagnosis_id}`)}
                    >
                      Просмотр
                    </button>
                    <button 
                      className="btn small danger-btn"
                      onClick={() => handleDeleteDiagnosis(item.diagnosis_id)}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
              <button 
                className="btn"
                onClick={() => navigate('/diagnosis-history')}
              >
                Показать полную историю
              </button>
            </div>
          ) : (
            <p>История диагнозов пуста</p>
          )}
        </div>

        {/* Блок - Действия */}
        <div className="profile-buttons">
          <button className="btn danger-btn" onClick={handleDelete}>Удалить аккаунт</button>
        </div>

      </div>

      {editingPatient && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Редактировать данные</h3>
            <label>Телефон:
              <input name="phone" value={patientFormData.phone} onChange={handlePatientChange} />
            </label>
            <label>Аллергии:
              <input name="allergies" value={patientFormData.allergies} onChange={handlePatientChange} />
            </label>
            <label>Хронические болезни:
              <input name="chronic_conditions" value={patientFormData.chronic_conditions} onChange={handlePatientChange} />
            </label>
            <div className="modal-buttons">
              <button className="btn" onClick={handlePatientSave}>Сохранить</button>
              <button className="btn cancel-btn" onClick={() => setEditingPatient(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {editingDoctor && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Редактировать профиль врача</h3>
            <label>Специализация:
              <input name="specialization" value={doctorFormData.specialization} onChange={handleDoctorChange} />
            </label>
            <label>Опыт (лет):
              <input name="experience_years" type="number" value={doctorFormData.experience_years} onChange={handleDoctorChange} />
            </label>
            <label>О себе:
              <input name="bio" value={doctorFormData.bio} onChange={handleDoctorChange} />
            </label>
            <label>Цена за приём:
              <input name="price" type="number" value={doctorFormData.price} onChange={handleDoctorChange} />
            </label>
            <div className="modal-buttons">
              <button className="btn" onClick={handleDoctorSave}>Сохранить</button>
              <button className="btn cancel-btn" onClick={() => setEditingDoctor(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {showTopUpModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Пополнение баланса</h3>
            <input
              type="number"
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              placeholder="Введите сумму"
            />
            <div className="modal-buttons">
              <button className="btn" onClick={handleTopUp}>Пополнить</button>
              <button className="btn cancel-btn" onClick={() => setShowTopUpModal(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileInfo;
