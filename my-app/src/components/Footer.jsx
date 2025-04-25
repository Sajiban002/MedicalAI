// src/components/Footer.js
import React from 'react';
import { Link } from 'react-router-dom';
import '../css/Header-Footer.css'; 
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFacebookF, 
  faTwitter, 
  faInstagram, 
  faLinkedinIn 
} from '@fortawesome/free-brands-svg-icons';
import { 
  faPhone, 
  faEnvelope, 
  faMapMarkerAlt, 
  faClock,
  faHeartbeat,
  faShieldAlt,
  faUserMd
} from '@fortawesome/free-solid-svg-icons';

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-waves">
        <div className="wave wave1"></div>
        <div className="wave wave2"></div>
        <div className="wave wave3"></div>
      </div>
      
      <div className="footer-content">
        <div className="footer-section about">
          <div className="footer-logo">
            <FontAwesomeIcon icon={faHeartbeat} className="pulse-icon" />
            <h2>MedicalAI</h2>
          </div>
          <p>
            Ваш надежный партнер в области здравоохранения. Мы предоставляем высококачественные 
            медицинские услуги с использованием современных технологий и индивидуального подхода.
          </p>
          <div className="contact">
            <div><FontAwesomeIcon icon={faPhone} /> <span>+7 (999) 123-45-67</span></div>
            <div><FontAwesomeIcon icon={faEnvelope} /> <span>info@medcenter.ru</span></div>
            <div><FontAwesomeIcon icon={faMapMarkerAlt} /> <span>Город: Астана</span></div>
            <div><FontAwesomeIcon icon={faClock} /> <span>Пн-Пт: 8:00-20:00, Сб-Вс: 9:00-18:00</span></div>
          </div>
          <div className="socials">
            <a href="#" className="social-icon"><FontAwesomeIcon icon={faFacebookF} /></a>
            <a href="#" className="social-icon"><FontAwesomeIcon icon={faTwitter} /></a>
            <a href="#" className="social-icon"><FontAwesomeIcon icon={faInstagram} /></a>
            <a href="#" className="social-icon"><FontAwesomeIcon icon={faLinkedinIn} /></a>
          </div>
        </div>

        <div className="footer-section links">
          <h3>Быстрые ссылки</h3>
          <ul>
            <li><Link to="/">Главная</Link></li>
            <li><Link to="/about">О нас</Link></li>
            <li><Link to="/services">Услуги</Link></li>
            <li><Link to="/doctors">Врачи</Link></li>
            <li><Link to="/ai">ИИ-консультант</Link></li>
            <li><Link to="/contact">Контакты</Link></li>
            <li><Link to="/faq">FAQ</Link></li>
          </ul>
        </div>

        <div className="footer-section services">
          <h3>Наши услуги</h3>
          <ul>
            <li><Link to="/services/diagnostics">Диагностика</Link></li>
            <li><Link to="/services/therapy">Терапия</Link></li>
            <li><Link to="/services/cardiology">Кардиология</Link></li>
            <li><Link to="/services/neurology">Неврология</Link></li>
            <li><Link to="/services/pediatrics">Педиатрия</Link></li>
            <li><Link to="/services/consultation">Онлайн-консультации</Link></li>
          </ul>
        </div>

        <div className="footer-section newsletter">
          <h3>Оставайтесь на связи</h3>
          <p>Подпишитесь на нашу рассылку, чтобы получать последние новости и специальные предложения</p>
          <form>
            <input type="email" placeholder="Введите ваш email" required />
            <button type="submit" className="btn-subscribe">Подписаться</button>
          </form>
          <div className="features">
            <div className="feature">
              <FontAwesomeIcon icon={faUserMd} className="feature-icon" />
              <span>Опытные врачи</span>
            </div>
            <div className="feature">
              <FontAwesomeIcon icon={faShieldAlt} className="feature-icon" />
              <span>Безопасность данных</span>
            </div>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-disclaimer">
          <p>Информация на сайте не является медицинской консультацией. Для диагностики и лечения обратитесь к квалифицированному специалисту.</p>
        </div>
        <div className="copyright">
          <p>&copy; {currentYear} МедЦентр. Все права защищены.</p>
        </div>
        <div className="footer-links">
          <Link to="/privacy">Политика конфиденциальности</Link>
          <Link to="/terms">Условия использования</Link>
        </div>
      </div>
    </footer>
  );
}

export default Footer;