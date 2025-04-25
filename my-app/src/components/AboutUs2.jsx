import React from 'react';
import '../css/AboutUs.css';


const AboutAlt = () => {
  return (
    <section className="about-alt-section">
      <div className="about-alt-container">
        {/* Текст слева */}
        <div className="about-alt-block about-alt-text">
          <h2>Lorem ipsum</h2>
          <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
          Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. 
          Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. 
          Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

          </p>
        </div>

        {/* Картинка справа с параллаксом */}
        <div className="about-alt-block about-alt-image-block">
          <div className="about-alt-parallax">
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutAlt;
