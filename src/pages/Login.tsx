import { useState } from 'react';
import BackButton from '../components/BackButton';
import { useNavigate } from 'react-router-dom';

type LoginStep = 'credentials' | 'verification';

export default function Login() {
  const [step, setStep] = useState<LoginStep>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleStart2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/start-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'No se pudo iniciar la verificación');
      }

      setChallengeId(data.challengeId);
      setMaskedPhone(data.maskedPhone);
      setVerificationCode('');
      setStep('verification');
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId, code: verificationCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Código incorrecto');
      }

      localStorage.removeItem('userRole');
      localStorage.removeItem('loggedInUser');

      if (data.role === 'admin') {
        localStorage.setItem('userRole', 'admin');
        navigate('/admin');
      } else if (data.role === 'paramedic') {
        localStorage.setItem('userRole', 'paramedic');
        navigate('/paramedic');
      } else if (data.role === 'visitor') {
        localStorage.setItem('loggedInUser', JSON.stringify(data.user));
        navigate('/dashboard');
      } else {
        throw new Error('Rol desconocido');
      }
    } catch (err: any) {
      setError(err.message || 'Error al verificar el código');
    } finally {
      setLoading(false);
    }
  };

  const resetToCredentials = () => {
    setStep('credentials');
    setVerificationCode('');
    setChallengeId('');
    setMaskedPhone('');
    setError('');
  };

  return (
    <div className="max-w-sm mx-auto p-8">
      <BackButton />

      <div className="p-8 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg">
        {step === 'credentials' ? (
          <>
            <h2 className="text-3xl font-bold mb-6 text-center text-green-800">
              Acceso con Verificación
            </h2>

            <form onSubmit={handleStart2FA} className="space-y-6">
              <p className="text-sm text-center text-gray-600">
                Visitantes: usen su correo y teléfono. Personal: usen su usuario y contraseña.
              </p>

              <InputField
                name="username"
                label="Usuario o Correo Electrónico"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />

              <InputField
                name="password"
                label="Contraseña o Teléfono"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              {error && (
                <p className="text-red-600 bg-red-100 p-3 rounded-lg text-center">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 text-white px-4 py-3 rounded-lg text-lg font-semibold hover:bg-green-700 transition-transform transform hover:scale-105 disabled:opacity-60"
              >
                {loading ? 'Enviando código...' : 'Enviar código SMS'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="text-3xl font-bold mb-6 text-center text-green-800">
              Verificación SMS
            </h2>

            <form onSubmit={handleVerify2FA} className="space-y-6">
              <p className="text-sm text-center text-gray-600">
                Enviamos un código de verificación al número {maskedPhone}.
              </p>

              <InputField
                name="verificationCode"
                label="Código de verificación"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                required
              />

              {error && (
                <p className="text-red-600 bg-red-100 p-3 rounded-lg text-center">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 text-white px-4 py-3 rounded-lg text-lg font-semibold hover:bg-green-700 transition-transform transform hover:scale-105 disabled:opacity-60"
              >
                {loading ? 'Verificando...' : 'Verificar y acceder'}
              </button>

              <button
                type="button"
                onClick={resetToCredentials}
                className="w-full bg-gray-100 text-gray-700 px-4 py-3 rounded-lg text-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                Cambiar datos
              </button>
            </form>
          </>
        )}
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
  required?: boolean;
}

const InputField = ({
  name,
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: InputFieldProps) => (
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
      required={required}
      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
    />
  </div>
);
