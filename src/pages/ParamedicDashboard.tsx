import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { Html5QrcodeScanner } from 'html5-qrcode';
import ErrorBoundary from '../components/ErrorBoundary';
import { User } from '../types';
import { addIncidentToOutbox } from '../../db/offline';
import { Phone, MessageSquare, AlertCircle, RefreshCw, User as UserIcon, Search } from 'lucide-react';

// A type specific to the data paramedics need, handling the JSON strings
type ParamedicUser = Omit<User, 'allergies' | 'medicalConditions'> & {
    allergies: string[];
    medicalConditions: string[];
};

export default function ParamedicDashboard() {
  const [users, setUsers] = useState<ParamedicUser[]>([]);
  const [scannedUser, setScannedUser] = useState<ParamedicUser | null>(null);
  const [error, setError] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [incidentNotes, setIncidentNotes] = useState('');
  const [isSubmittingIncident, setIsSubmittingIncident] = useState(false);

  const usersRef = useRef<ParamedicUser[]>([]);
  usersRef.current = users;

  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('loggedInUser');
    navigate('/');
  };

  useEffect(() => {
      
    // Load users from local storage on component mount
    const localUsers = localStorage.getItem('syncedUsers');
    if (localUsers) {
      setUsers(JSON.parse(localUsers));
    }
  }, []);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      { fps: 10, qrbox: 250 },
      false
    );

    function onScanSuccess(decodedText: string) {
      scanner.clear();
      const user = usersRef.current.find(u => u.id === decodedText);
      if (user) {
        setScannedUser(user);
        setError('');
        fetch('/api/scans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, paramedicId: 'paramedic-001' }),
        }).catch(err => console.error('Failed to log scan:', err));
      } else {
        setScannedUser(null);
        setError('Usuario no encontrado en los datos locales. Por favor, sincronice los datos.');
      }
    }

    scanner.render(onScanSuccess, undefined);

    return () => {
      scanner.clear().catch(err => console.error('Failed to clear scanner', err));
    };
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    setError('');
    try {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch data');
      const data: User[] = await response.json();
      
      const parsedData: ParamedicUser[] = data.map(user => ({
        ...user,
        allergies: Array.isArray(user.allergies)
          ? user.allergies
          : JSON.parse((user.allergies as unknown as string) || '[]'),
        medicalConditions: Array.isArray(user.medicalConditions)
          ? user.medicalConditions
          : JSON.parse((user.medicalConditions as unknown as string) || '[]'),
      }));

      localStorage.setItem('syncedUsers', JSON.stringify(parsedData));
      setUsers(parsedData);
      alert('Data synced successfully!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleIncidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedUser) return;

    setIsSubmittingIncident(true);
    setError('');

    const incident = {
      id: crypto.randomUUID(),
      userId: scannedUser.id,
      paramedicId: 'paramedic-001', // Mock paramedic ID
      notes: incidentNotes,
      timestamp: new Date().toISOString(),
      // TODO: Add geolocation
    };

    try {
      await addIncidentToOutbox(incident);
      console.log('Incident saved to outbox.');

      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then(swRegistration => {
          return (swRegistration as any).sync.register('sync-incidents');
        }).then(() => {
            console.log('Background sync registered.');
        });
      } else {
        // Fallback for browsers that don't support background sync
        // Try to send immediately
        await fetch('/api/incidents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(incident)
        });
      }

      alert('Incident report saved. It will be synced with the server when online.');
      setIncidentNotes('');
      setScannedUser(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmittingIncident(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h2 className="text-4xl font-black text-green-900 tracking-tight">Panel Paramédico</h2>
        <div className="flex flex-col sm:flex-row gap-3">
            <button 
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center gap-2 bg-white border-2 border-green-600 text-green-700 px-6 py-2 rounded-2xl font-bold hover:bg-green-50 transition-all disabled:opacity-50 shadow-sm"
            >
          <RefreshCw size={20} className={isSyncing ? 'animate-spin' : ''} />
          {isSyncing ? 'Sincronizando...' : 'Sincronizar Datos'}
        </button>
            <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-6 py-2 rounded-2xl font-bold hover:bg-red-700 transition-all shadow-sm"
                >
                Cerrar sesión
            </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Left Column: Scanner */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-green-700">
                <Search size={24} />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Escanear Visitante</h3>
            </div>
            <ErrorBoundary>
              <div id="qr-reader" className="rounded-2xl overflow-hidden border-4 border-green-50 shadow-inner"></div>
            </ErrorBoundary>
            <p className="text-sm text-gray-400 mt-4 text-center font-medium">Usuarios en base local: {users.length}</p>
          </div>
        </div>

        {/* Right Column: Scanned User Info */}
        <div className="lg:col-span-7">
          {error && (
            <div className="bg-red-50 border-2 border-red-100 text-red-700 p-4 rounded-2xl flex items-center gap-3 mb-6 animate-pulse">
              <AlertCircle size={24} />
              <p className="font-bold">{error}</p>
            </div>
          )}

          {scannedUser ? (
            <div className="bg-white rounded-3xl shadow-2xl border border-green-50 overflow-hidden">
              {/* Header Info */}
              <div className="bg-green-900 p-8 text-white">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-green-300 text-xs font-bold uppercase tracking-widest mb-1">Paciente Identificado</p>
                    <h3 className="text-3xl font-black tracking-tight">{scannedUser.fullName}</h3>
                  </div>
                  <div className="bg-red-500 text-white px-4 py-2 rounded-2xl font-black text-xl shadow-lg">
                    {scannedUser.bloodType}
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-8">
                {/* Medical Info Grid */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 p-4 rounded-2xl">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Alergias</h4>
                    <p className="text-gray-800 font-bold">{scannedUser.allergies.join(', ') || 'Ninguna'}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Condiciones</h4>
                    <p className="text-gray-800 font-bold">{scannedUser.medicalConditions.join(', ') || 'Ninguna'}</p>
                  </div>
                </div>

                {/* Emergency Contact - GOOGLE MAPS STYLE CALL BUTTON */}
                <div className="bg-green-50 p-6 rounded-3xl border border-green-100">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <h4 className="text-xs font-black text-green-700 uppercase tracking-widest mb-2">Contacto de Emergencia</h4>
                      <p className="text-xl font-black text-green-900">{scannedUser.emergencyContactName}</p>
                      <p className="text-green-700 font-bold">{scannedUser.emergencyContactPhone}</p>
                    </div>
                    <div className="flex gap-3">
                      <a 
                        href={`tel:${scannedUser.emergencyContactPhone}`} 
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-green-600 text-white px-8 py-4 rounded-2xl font-black hover:bg-green-700 transition-all shadow-lg shadow-green-200 active:scale-95"
                      >
                        <Phone size={24} fill="currentColor" />
                        LLAMAR AHORA
                      </a>
                      <a 
                        href={`sms:${scannedUser.emergencyContactPhone}`} 
                        className="flex items-center justify-center w-16 h-16 bg-white border-2 border-green-600 text-green-600 rounded-2xl hover:bg-green-50 transition-all active:scale-95"
                      >
                        <MessageSquare size={28} />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Incident Report Form */}
                <form onSubmit={handleIncidentSubmit} className="pt-6 border-t border-gray-100">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertCircle size={20} className="text-red-500" />
                    <h4 className="font-black text-gray-800 uppercase tracking-tight">Reportar Incidente</h4>
                  </div>
                  <textarea
                      value={incidentNotes}
                      onChange={(e) => setIncidentNotes(e.target.value)}
                      placeholder="Describe la situación, tratamiento aplicado y estado del paciente..."
                      className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-green-100 focus:border-green-500 transition-all mb-4 font-medium"
                      rows={4}
                      required
                  />
                  <button
                      type="submit"
                      disabled={isSubmittingIncident}
                      className="w-full bg-red-600 text-white px-6 py-4 rounded-2xl font-black text-lg hover:bg-red-700 disabled:opacity-50 transition-all shadow-lg shadow-red-100"
                  >
                      {isSubmittingIncident ? 'Enviando...' : 'FINALIZAR Y GUARDAR REPORTE'}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[400px] bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-300 mb-4">
                <UserIcon size={48} />
              </div>
              <h3 className="text-xl font-bold text-gray-400 mb-2">Esperando Escaneo</h3>
              <p className="text-gray-400 max-w-xs">Utiliza la cámara para escanear el código QR del visitante y ver su ficha médica.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
