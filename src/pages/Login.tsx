import { useState } from 'react';
import BackButton from '../components/BackButton';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock authentication
    if (username === 'admin' && password === 'admin') {
      localStorage.setItem('userRole', 'admin');
      navigate('/admin');
    } else if (username === 'paramedic' && password === 'paramedic') {
      localStorage.setItem('userRole', 'paramedic');
      navigate('/paramedic');
    } else {
      // Attempt visitor login
      handleVisitorLogin(username, password);
    }
  };

  const handleVisitorLogin = async (email: string, phone: string) => {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Error de inicio de sesión');
      }
      localStorage.setItem('loggedInUser', JSON.stringify(data));
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-sm mx-auto p-8">
      <BackButton />
      <div className="p-8 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg">
      <h2 className="text-3xl font-bold mb-6 text-center text-green-800">Acceso del Personal</h2>
      <form onSubmit={handleLogin} className="space-y-6">
        <p className="text-sm text-center text-gray-600">Visitantes: usen su correo y teléfono para acceder.</p>
        <InputField name="username" label="Usuario o Correo Electrónico" value={username} onChange={(e) => setUsername(e.target.value)} />
        <InputField name="password" label="Contraseña o Teléfono" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-red-600 bg-red-100 p-3 rounded-lg text-center">{error}</p>}
        <button type="submit" className="w-full bg-green-600 text-white px-4 py-3 rounded-lg text-lg font-semibold hover:bg-green-700 transition-transform transform hover:scale-105">Acceder</button>
      </form>
      </div>
    </div>
  );
}

interface InputFieldProps {
    name: string;
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    type?: string;
}

const InputField = ({ name, label, value, onChange, type = 'text' }: InputFieldProps) => (
    <div className="form-control">
        <label htmlFor={name} className="label">
            <span className="label-text text-gray-700">{label}</span>
        </label>
        <input 
            type={type} 
            id={name} 
            name={name} 
            value={value} 
            onChange={onChange} 
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
        />
    </div>
);
