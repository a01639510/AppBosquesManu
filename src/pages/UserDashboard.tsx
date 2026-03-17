import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User } from '../types';

interface Notification {
    id: string;
    title: string;
    message: string;
    createdAt: string;
}

export default function UserDashboard() {
    const [user, setUser] = useState<User | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        const loggedInUser = localStorage.getItem('loggedInUser');
        if (loggedInUser) {
            const userData = JSON.parse(loggedInUser);
            setUser(userData);
            fetchNotifications();
        } else {
            navigate('/login');
        }
    }, [navigate]);

    const fetchNotifications = async () => {
      try {
        const response = await fetch('/api/notifications');
        const data = await response.json();
        setNotifications(data);
      } catch (err) {
        console.error('Failed to fetch notifications');
      }
    };

    const handleLogout = () => {
        localStorage.removeItem('loggedInUser');
        navigate('/');
    };

    if (!user) {
        return <p>Cargando...</p>;
    }

    return (
        <div className="max-w-4xl mx-auto p-8">
            <h2 className="text-3xl font-bold mb-2 text-green-800">Hola, {user.fullName}</h2>
            <p className="text-gray-600 mb-6">Bienvenido a tu panel de visitante.</p>

            <div className="grid md:grid-cols-2 gap-8">
                <div className="p-6 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg text-center">
                    <h3 className="text-2xl font-bold mb-4 text-green-800">Tu Código QR</h3>
                    <p className="mb-4">Usa este botón para acceder rápidamente a tu código QR para el ingreso al parque.</p>
                    <Link to={`/qr/${user.id}`} className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors">Ver mi QR</Link>
                </div>
                <div className="p-6 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg">
                    <h3 className="text-2xl font-bold mb-4 text-green-800">Notificaciones y Descuentos</h3>
                    <div className="space-y-4">
                        {notifications.length > 0 ? (
                            notifications.map(notif => (
                                <div key={notif.id} className="p-4 bg-green-50 rounded-lg border border-green-200">
                                    <h4 className="font-bold text-green-900">{notif.title}</h4>
                                    <p className="text-gray-700">{notif.message}</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500">No hay notificaciones nuevas.</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="text-center mt-8">
                <button onClick={handleLogout} className="text-red-600 hover:underline">Cerrar Sesión</button>
            </div>
        </div>
    );
}
