import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function FindQrCode() {
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            const response = await fetch(`/api/users/find?fullName=${encodeURIComponent(fullName)}&phone=${encodeURIComponent(phone)}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'No se pudo encontrar al usuario');
            }

            navigate(`/qr/${data.userId}`);
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="p-8 bg-white rounded-3xl shadow-xl border border-green-100">
            <h3 className="text-2xl font-black mb-2 text-center text-green-900 tracking-tight">Recuperar mi Pase</h3>
            <p className="text-center text-gray-500 mb-8 font-medium">Ingresa tus datos para volver a ver tu código QR.</p>
            <form onSubmit={handleSearch} className="space-y-6">
                <div>
                    <label htmlFor="searchFullName" className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Nombre Completo</label>
                    <input 
                        type="text" 
                        id="searchFullName" 
                        value={fullName} 
                        onChange={(e) => setFullName(e.target.value)} 
                        required 
                        placeholder="Ej: Juan Pérez"
                        className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-green-100 focus:border-green-500 transition-all font-medium"
                    />
                </div>
                <div>
                    <label htmlFor="searchPhone" className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Número de Teléfono</label>
                    <input 
                        type="tel" 
                        id="searchPhone" 
                        value={phone} 
                        onChange={(e) => setPhone(e.target.value)} 
                        required 
                        placeholder="Ej: 987654321"
                        className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-green-100 focus:border-green-500 transition-all font-medium"
                    />
                </div>
                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-center font-bold border border-red-100 animate-shake">
                        {error}
                    </div>
                )}
                <button 
                    type="submit" 
                    className="w-full bg-green-800 text-white px-6 py-4 rounded-2xl text-lg font-black hover:bg-green-900 transition-all shadow-lg shadow-green-100 active:scale-95"
                >
                    BUSCAR MI CÓDIGO QR
                </button>
            </form>
        </div>
    );
}
