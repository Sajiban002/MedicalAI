import React, { useEffect, useState } from 'react';
import axios from 'axios';

const DoctorsList = () => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');

    axios.get('http://localhost:5001/api/chat/approved_doctors', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(response => {
        setDoctors(response.data);
        setLoading(false);
      })
      .catch(err => {
        setError('Ошибка при загрузке списка врачей');
        setLoading(false);
      });
  }, []);

  const createChat = async (doctorId) => {
    try {
      const token = localStorage.getItem('token');

      const response = await axios.post(
        'http://localhost:5001/api/chat/create_chat',
        { doctorId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      setMessage(`✅ Чат создан! ID чата: ${response.data.chatRoomId}`);
    } catch (err) {
      setMessage(`❌ Ошибка: ${err.response?.data?.message || 'неизвестная ошибка'}`);
    }
  };

  if (loading) return <div>Загрузка...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <h1>Список врачей</h1>
      {message && <div style={{ marginBottom: '1rem', color: 'green' }}>{message}</div>}
      <ul>
        {doctors.map((doctor, index) => (
          <li key={index} style={{ marginBottom: '1rem' }}>
            <strong>{doctor.fullName}</strong><br />
            Специализация: {doctor.specialization}<br />
            Опыт: {doctor.experienceYears} лет<br />
            Стоимость: {doctor.price} ₸<br />
            <button onClick={() => createChat(doctor.id)}>Создать чат</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DoctorsList;
