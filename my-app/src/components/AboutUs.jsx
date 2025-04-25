import React from 'react';
import '../css/AboutUs.css';
import aboutImage from '../images/robot.JPG'; // путь к изображению

const About = () => {
  return (
    <section className="about-section">
      <div className="about-container">
        {/* Картинка */}
        <div className="about-block image-block">
          <img
            src={aboutImage}
            alt="О нас"
            className="about-image"
          />
        </div>

        {/* Текст */}
        <div className="about-block text-block">
          <h2>О нас</h2>
          <p>
            Мы — команда, создающая удобные решения для современных пользователей.
            Наш фокус — технологии, дизайн и забота о клиентах.
          </p>
        </div>
      </div>
    </section>
  );
};

export default About;
