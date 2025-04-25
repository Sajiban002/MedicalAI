import React from 'react';
import { useAuth } from '../context/AuthContext';

const HomePage = () => {
  const { user, logout } = useAuth();

  return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <h1>Добро пожаловать!</h1>
      {user && (
        <div>
          <p>Вы вошли как: {user.email}</p>
          <p>Роль: {user.role}</p>
          <button onClick={logout}>Выйти</button>
        </div>
      )}
    </div>
  );
};

export default HomePage;