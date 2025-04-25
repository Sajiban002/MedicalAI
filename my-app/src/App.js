import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/Main';
import AboutUsPage from './pages/AboutUsPage';
import AuthForm from './pages/AuthPage';
import Generate from './components/generate';
import News from './components/News';


function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/generate" element={<Header />} />
          <Route path="*" element={<Header />} />
        </Routes>
        <Routes>
          <Route path="/" element={
            <>
              <HomePage />
              <Footer />
            </>
          } />
          <Route path="/about" element={
            <>
              <AboutUsPage />
              <Footer />
            </>
          } />
          <Route path="/auth" element={
            <>
              <AuthForm />
              <Footer />
            </>
          } />
          <Route path="/register" element={
            <>
              <AuthForm />
              <Footer />
            </>
          } />
          <Route path="/generate" element={
            <div className="medical-container">
              <Generate />
              <Footer />
            </div>
          } />
          <Route path="/news" element={
            <>
              <News />
              <Footer />
            </>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;