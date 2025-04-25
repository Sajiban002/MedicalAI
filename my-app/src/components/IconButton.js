// src/components/IconButton/IconButton.js
import React from 'react';
import '../css/AboutUs.css';

export const IconButton = ({ direction, onClick, disable }) => {
  return (
    <button 
      className={`icon-button ${direction}`} 
      onClick={onClick} 
      disabled={disable}
    >
      {direction === 'left' ? '←' : '→'}
    </button>
  );
};

// /dmodels/medicine_chest.glb
