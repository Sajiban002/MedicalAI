import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const ProfileInfo = () => {
  const [profile, setProfile] = useState(null);
  const [doctorData, setDoctorData] = useState(null);
  const [price, setPrice] = useState('');
  const [editingPrice, setEditingPrice] = useState(false);
  const [editingPatient, setEditingPatient] = useState(false);
  const [patientFormData, setPatientFormData] = useState({
    phone: '',
    allergies: '',
    chronic_conditions: '',
  });
  const [topUpAmount, setTopUpAmount] = useState('');
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

        if (response.data.role === 'doctor') {
          const doctorRes = await axios.get('http://localhost:5001/api/doctor/me', {
            headers: { Authorization: `Bearer ${token}` },
          });

          setDoctorData(doctorRes.data);
          setPrice(doctorRes.data.price?.toString() || '');
        }

        if (response.data.role === 'user' && response.data.patient) {
          setPatientFormData({
            phone: response.data.patient.phone || '',
            allergies: response.data.patient.allergies || '',
            chronic_conditions: response.data.patient.chronic_conditions || '',
          });
        }

      } catch (err) {
        console.error(err);
        setError('Ошибка при получении профиля');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

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

  const handlePriceUpdate = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        'http://localhost:5001/api/doctor/me',
        { price: parseFloat(price) },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const updatedDoctor = await axios.get('http://localhost:5001/api/doctor/me', {
        headers: { Authorization: `Bearer ${token}` },
      });

      setDoctorData(updatedDoctor.data);
      setPrice(updatedDoctor.data.price?.toString() || '');
      setEditingPrice(false);
    } catch (err) {
      console.error(err);
      alert('Ошибка при обновлении цены');
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

  if (loading) return <p>Загрузка...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;
  if (!profile) return null;

  return (
    <div>
      <h2>Мой профиль</h2>
      <p><strong>Имя:</strong> {profile.first_name} {profile.last_name}</p>
      <p><strong>Email:</strong> {profile.email}</p>
      <p><strong>Роль:</strong> {profile.role}</p>
      <p><strong>Дата рождения:</strong> {profile.date_of_birth}</p>
      <p><strong>Гендер:</strong> {profile.gender}</p>
      <p><strong>Баланс:</strong> {profile.wallet} ₸ <button onClick={() => setShowTopUpModal(true)}>Пополнить</button></p>

      {profile.role === 'user' && profile.patient && (
        <>
          <p><strong>Телефон:</strong> {profile.patient.phone || 'не указан'}</p>
          <p><strong>Аллергии:</strong> {profile.patient.allergies || 'нет'}</p>
          <p><strong>Хронические болезни:</strong> {profile.patient.chronic_conditions || 'нет'}</p>
          <button onClick={() => setEditingPatient(true)}>Редактировать данные пациента</button>
        </>
      )}

      {profile.role === 'doctor' && doctorData && (
        <>
          <p><strong>Специализация:</strong> {doctorData.specialization}</p>
          <p><strong>Опыт:</strong> {doctorData.experience_years} лет</p>
          <p><strong>О себе:</strong> {doctorData.bio}</p>
          <p><strong>Цена за приём:</strong>
            {editingPrice ? (
              <>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  style={{ marginLeft: '10px', width: '80px' }}
                />
                <button onClick={handlePriceUpdate} style={{ marginLeft: '10px' }}>Сохранить</button>
                <button onClick={() => setEditingPrice(false)} style={{ marginLeft: '5px' }}>Отмена</button>
              </>
            ) : (
              <>
                {doctorData.price} ₸
                <button onClick={() => setEditingPrice(true)} style={{ marginLeft: '10px' }}>Изменить</button>
              </>
            )}
          </p>
        </>
      )}

      <div style={{ marginTop: '20px' }}>
        <button onClick={handleDelete} style={{ color: 'red', marginLeft: '10px' }}>
          Удалить аккаунт
        </button>
      </div>

      {editingPatient && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%',
          height: '100%', backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
        }}>
          <div style={{
            backgroundColor: 'white', padding: '20px',
            borderRadius: '10px', width: '300px'
          }}>
            <h3>Редактировать данные</h3>
            <label>Телефон: <input name="phone" value={patientFormData.phone} onChange={handlePatientChange} /></label><br />
            <label>Аллергии: <input name="allergies" value={patientFormData.allergies} onChange={handlePatientChange} /></label><br />
            <label>Хронические болезни: <input name="chronic_conditions" value={patientFormData.chronic_conditions} onChange={handlePatientChange} /></label><br />
            <button onClick={handlePatientSave}>Сохранить</button>
            <button onClick={() => setEditingPatient(false)} style={{ marginLeft: '10px' }}>Отмена</button>
          </div>
        </div>
      )}

      {showTopUpModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%',
          height: '100%', backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
        }}>
          <div style={{
            backgroundColor: 'white', padding: '20px',
            borderRadius: '10px', width: '300px'
          }}>
            <h3>Пополнение баланса</h3>
            <input
              type="number"
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              placeholder="Введите сумму"
              style={{ width: '100%', marginBottom: '10px' }}
            />
            <button onClick={handleTopUp}>Пополнить</button>
            <button onClick={() => setShowTopUpModal(false)} style={{ marginLeft: '10px' }}>Отмена</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileInfo;
