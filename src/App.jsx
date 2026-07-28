import React, { useState, useEffect } from 'react';
import Login from './Login';
import StudentDashboard from './StudentDashboard';
import TeacherDashboard from './TeacherDashboard';
import './index.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('currentUser');
      }
    }
    setLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    setUser(null);
  };

  if (loading) return null;

  if (!user) {
    return <Login onLogin={(u) => setUser(u)} />;
  }

  if (user.role === 'teacher') {
    return <TeacherDashboard user={user} onLogout={handleLogout} />;
  }

  return <StudentDashboard user={user} onLogout={handleLogout} />;
}
