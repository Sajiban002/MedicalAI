// src/components/Header.js
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../css/Header-Footer.css';
import logo from '../images/med.avif';
import { useAuth } from '../context/AuthContext';

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  const toggleMenu = () => {
    setMenuOpen(prev => !prev);
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <header className={`header ${scrolled ? 'scrolled' : ''}`}>
      <div className="medical-bg-element"></div>
      <nav className="nav">
        <Link to="/" className="logo">
          <img src={logo} alt="МедЦентр" className="logo-img" />
        </Link>

        <div className={`burger ${menuOpen ? 'active' : ''}`} onClick={toggleMenu}>
          <div></div>
          <div></div>
          <div></div>
        </div>

        <div className={`overlay ${menuOpen ? 'active' : ''}`} onClick={toggleMenu}></div>

        <ul className={`nav-links ${menuOpen ? 'active' : ''}`}>
          <li>
            <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
              Главная
            </Link>
          </li>
          <li>
            <Link to="/about" className={location.pathname === '/about' ? 'active' : ''}>
              О нас
            </Link>
          </li>
          <li>
            <Link to="/news" className={location.pathname === '/news' ? 'active' : ''}>
              Новости
            </Link>
          </li>
          <li>
            <Link to="/generate" className={location.pathname === '/ai-consultant' ? 'active' : ''}>
              ИИ-консультант
            </Link>
          </li>
          <li>
            <Link to="/doctors" className={location.pathname === '/doctors' ? 'active' : ''}>
              Врачи
            </Link>
          </li>
          <li>
            <Link to="/contact" className={location.pathname === '/contact' ? 'active' : ''}>
              Контакты
            </Link>
          </li>
          {!isAuthenticated ? (
            <>
              <li>
                <Link to="/login" className={location.pathname === '/login' ? 'active' : ''}>
                  Вход
                </Link>
              </li>
              <li>
                <Link to="/register" className={location.pathname === '/register' ? 'active' : ''}>
                  Регистрация
                </Link>
              </li>
            </>
          ) : (
            <>
              <li>
                <Link to="/profile" className={location.pathname === '/profile' ? 'active' : ''}>
                  Профиль
                </Link>
              </li>
              <li>
                <button className="logout-btn" onClick={handleLogout}>
                  Выход
                </button>
              </li>
            </>
          )}
        </ul>
      </nav>
    </header>
  );
}

export default Header;