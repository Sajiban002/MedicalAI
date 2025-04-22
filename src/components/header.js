import React from 'react';
import { motion } from 'framer-motion';
import { FaHospital } from 'react-icons/fa';
import '../style/header_footer.css'; 

function Header() {
  return (
    <header className="medical-header">
      <motion.div
        className="logo-container"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <FaHospital className="logo-icon" />
        <h1>MedicalAI <span>Analyzer</span></h1>
      </motion.div>
      <p className="header-tagline">Интеллектуальный анализ симптомов с помощью Gemini AI</p>
    </header>
  );
}

export default Header;