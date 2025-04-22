import React from 'react';
import Generate from './components/generate';
import Header from './components/header';
import Footer from './components/footer';

function App() {
  return (
    <div className="medical-container">
      <Header />
      <Generate />
      <Footer />
    </div>
  );
}

export default App;