// src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedToken = localStorage.getItem('authToken');
        
        if (storedToken) {
          // Validate token here (optional)
          // const response = await axios.get('http://localhost:5001/api/user/verify', {
          //   headers: { Authorization: `Bearer ${storedToken}` }
          // });
          
          setToken(storedToken);
          setIsAuthenticated(true);
          
          // Optional: fetch user profile
          // const userResponse = await axios.get('http://localhost:5001/api/user/me', {
          //   headers: { Authorization: `Bearer ${storedToken}` }
          // });
          // setUserInfo(userResponse.data);
        }
      } catch (error) {
        // Invalid token
        localStorage.removeItem('authToken');
        setIsAuthenticated(false);
        setToken(null);
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  // Login function
  const login = (newToken, userData = null) => {
    localStorage.setItem('authToken', newToken);
    setToken(newToken);
    setIsAuthenticated(true);
    if (userData) {
      setUserInfo(userData);
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('authToken');
    setToken(null);
    setIsAuthenticated(false);
    setUserInfo(null);
  };

  // Update user profile
  const updateUserInfo = (data) => {
    setUserInfo({ ...userInfo, ...data });
  };

  // Context value
  const value = {
    isAuthenticated,
    token,
    loading,
    userInfo,
    login,
    logout,
    updateUserInfo
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;