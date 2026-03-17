import { useState, useEffect } from 'react';
import { User, Incident } from '../types';
import ErrorBoundary from '../components/ErrorBoundary';

interface ScanAnalytic {
  paramedicId: string;
  scanCount: number;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  createdAt: string;
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [newNotification, setNewNotification] = useState({ title: '', message: '' });
  const [analytics, setAnalytics] = useState<ScanAnalytic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        const [usersRes, incidentsRes, notificationsRes, analyticsRes] = await Promise.all([
          fetch('/api/users'),
          fetch('/api/incidents'),
          fetch('/api/notifications'),
          fetch('/api/analytics/scans'),
        ]);

        if (!usersRes.ok) throw new Error('Failed to fetch users');
        if (!incidentsRes.ok) throw new Error('Failed to fetch incidents');
        if (!notificationsRes.ok) throw new Error('Failed to fetch notifications');
        if (!analyticsRes.ok) throw new Error('Failed to fetch analytics');

        const usersData = await usersRes.json();
        const incidentsData = await incidentsRes.json();
        const notificationsData = await notificationsRes.json();
        const analyticsData = await analyticsRes.json();

        setUsers(usersData);
        setIncidents(incidentsData);
        setNotifications(notificationsData);
        setAnalytics(analyticsData);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  if (loading) return <p>Loading data...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  const handleNotificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newNotification),
      });
      if (response.ok) {
        setNewNotification({ title: '', message: '' });
        // Refresh notifications list
        const res = await fetch('/api/notifications');
        const data = await res.json();
        setNotifications(data);
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to create notification');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h2 className="text-3xl font-bold mb-6 text-center text-green-800">Panel de Administración</h2>

      <div className="p-6 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg mb-8">
        <h3 className="text-2xl font-bold mb-4 text-green-800">Usuarios Registrados</h3>
        <div className="overflow-x-auto">
          <ErrorBoundary>
            <table className="min-w-full bg-white rounded-lg">
              <thead className="bg-green-700 text-white">
                <tr>
                  <th className="py-3 px-4 text-left">Nombre</th>
                  <th className="py-3 px-4 text-left">Correo Electrónico</th>
                  <th className="py-3 px-4 text-left">Teléfono</th>
                  <th className="py-3 px-4 text-left">Contacto de Emergencia</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b border-green-100 hover:bg-green-50">
                    <td className="py-3 px-4">{user.fullName}</td>
                    <td className="py-3 px-4">{user.email}</td>
                    <td className="py-3 px-4">{user.phone}</td>
                    <td className="py-3 px-4">{user.emergencyContactName} ({user.emergencyContactPhone})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ErrorBoundary>
        </div>
      </div>

      <div className="p-6 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg mb-8">
        <h3 className="text-2xl font-bold mb-4 text-green-800">Crear Notificación</h3>
        <form onSubmit={handleNotificationSubmit} className="space-y-4">
          <input 
            type="text" 
            placeholder="Título" 
            value={newNotification.title} 
            onChange={(e) => setNewNotification({ ...newNotification, title: e.target.value })} 
            required
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          />
          <textarea 
            placeholder="Mensaje"
            value={newNotification.message}
            onChange={(e) => setNewNotification({ ...newNotification, message: e.target.value })}
            required
            rows={3}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          />
          <button type="submit" className="w-full bg-orange-500 text-white px-4 py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors">Enviar Notificación</button>
        </form>
      </div>

      <div className="p-6 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg mb-8">
        <h3 className="text-2xl font-bold mb-4 text-green-800">Rendimiento de Paramédicos (Escaneos)</h3>
        <div className="overflow-x-auto">
          <ErrorBoundary>
            <table className="min-w-full bg-white rounded-lg">
              <thead className="bg-green-700 text-white">
                <tr>
                  <th className="py-3 px-4 text-left">ID de Paramédico</th>
                  <th className="py-3 px-4 text-left">Visitantes Atendidos</th>
                </tr>
              </thead>
              <tbody>
                {analytics.map(analytic => (
                  <tr key={analytic.paramedicId} className="border-b border-green-100 hover:bg-green-50">
                    <td className="py-3 px-4 font-mono text-sm">{analytic.paramedicId}</td>
                    <td className="py-3 px-4 text-center font-bold text-lg">{analytic.scanCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ErrorBoundary>
        </div>
      </div>

      <div className="p-6 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg">
        <h3 className="text-2xl font-bold mb-4 text-green-800">Incidentes Reportados</h3>
        <div className="overflow-x-auto">
          <ErrorBoundary>
            <table className="min-w-full bg-white rounded-lg">
              <thead className="bg-green-700 text-white">
                <tr>
                  <th className="py-3 px-4 text-left">ID de Usuario</th>
                  <th className="py-3 px-4 text-left">ID de Paramédico</th>
                  <th className="py-3 px-4 text-left">Fecha y Hora</th>
                  <th className="py-3 px-4 text-left">Notas</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map(incident => (
                  <tr key={incident.id} className="border-b border-green-100 hover:bg-green-50">
                    <td className="py-3 px-4 font-mono text-sm">{incident.userId}</td>
                    <td className="py-3 px-4 font-mono text-sm">{incident.paramedicId}</td>
                    <td className="py-3 px-4">{new Date(incident.timestamp).toLocaleString('es-ES')}</td>
                    <td className="py-3 px-4">{incident.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
