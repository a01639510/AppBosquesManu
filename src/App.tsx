/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import Header from './components/Header';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import ParamedicDashboard from './pages/ParamedicDashboard';
import AdminDashboard from './pages/AdminDashboard';
import QrCode from './pages/QrCode';
import Register from './pages/Register';
import UserDashboard from './pages/UserDashboard';

function AppContent() {
  const navigate = useNavigate();

  useEffect(() => {
    const loggedInUser = localStorage.getItem('loggedInUser');
    if (loggedInUser) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  return (
    <main className="p-4">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/qr/:userId" element={<QrCode />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute role="visitor">
              <UserDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/paramedic"
          element={
            <ProtectedRoute role="paramedic">
              <ParamedicDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute role="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <AppContent />
    </BrowserRouter>
  );
}
