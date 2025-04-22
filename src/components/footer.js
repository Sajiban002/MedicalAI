import React from 'react';
import '../style/header_footer.css'; // Styles for header and footer

function Footer() {
  return (
    <footer className="medical-footer">
      <p>© 2025 MedicalAI Analyzer | Powered by Gemini AI</p>
      <p className="footer-disclaimer">Для получения квалифицированной медицинской помощи обратитесь к врачу</p>
    </footer>
  );
}

export default Footer;