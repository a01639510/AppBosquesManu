import { useState } from 'react';
import BackButton from '../components/BackButton';
import { useNavigate } from 'react-router-dom';

type RegisterStep = 'form' | 'verification';

export default function Register() {
  const [step, setStep] = useState<RegisterStep>('form');

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    bloodType: '',
    allergies: '',
    medicalConditions: '',
    termsAccepted: false,
  });

  const [challengeId, setChallengeId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const { checked } = e.target as HTMLInputElement;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleStartRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!formData.termsAccepted) {
      setError('Debes aceptar los términos y condiciones.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/register/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          allergies: formData.allergies
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          medicalConditions: formData.medicalConditions
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'No se pudo enviar el código');
      }

      setChallengeId(data.challengeId);
      setMaskedPhone(data.maskedPhone);
      setVerificationCode('');
      setStep('verification');
    } catch (err: any) {
      setError(err.message || 'Error al iniciar el registro');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/register/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          challengeId,
          code: verificationCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Código incorrecto');
      }

      navigate(`/qr/${data.userId}`);
    } catch (err: any) {
      setError(err.message || 'Error al verificar el registro');
    } finally {
      setLoading(false);
    }
  };

  const returnToForm = () => {
    setStep('form');
    setVerificationCode('');
    setChallengeId('');
    setMaskedPhone('');
    setError('');
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <BackButton />

      <div className="p-8 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg">
        {step === 'form' ? (
          <>
            <h2 className="text-3xl font-bold mb-6 text-center text-green-800">
              Registro de Visitante
            </h2>

            <form onSubmit={handleStartRegister} className="space-y-6">
              <InputField
                name="fullName"
                label="Nombre Completo Legal"
                value={formData.fullName}
                onChange={handleChange}
                required
              />

              <InputField
                name="email"
                label="Correo Electrónico"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
              />

              <InputField
                name="phone"
                label="Número de Teléfono"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                required
              />

              <h3 className="text-2xl font-semibold pt-4 border-t border-green-200">
                Contacto de Emergencia
              </h3>

              <InputField
                name="emergencyContactName"
                label="Nombre Completo"
                value={formData.emergencyContactName}
                onChange={handleChange}
                required
              />

              <InputField
                name="emergencyContactPhone"
                label="Número de Teléfono"
                type="tel"
                value={formData.emergencyContactPhone}
                onChange={handleChange}
                required
              />

              <h3 className="text-2xl font-semibold pt-4 border-t border-green-200">
                Información Médica
              </h3>

              <div className="form-control">
                <label htmlFor="bloodType" className="label">
                  <span className="label-text text-gray-700">Tipo de Sangre</span>
                </label>

                <select
                  name="bloodType"
                  id="bloodType"
                  value={formData.bloodType}
                  onChange={handleChange}
                  required
                  className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-green-500"
                >
                  <option value="" disabled>
                    Seleccionar...
                  </option>
                  <option>A+</option>
                  <option>A-</option>
                  <option>B+</option>
                  <option>B-</option>
                  <option>AB+</option>
                  <option>AB-</option>
                  <option>O+</option>
                  <option>O-</option>
                </select>
              </div>

              <InputField
                name="allergies"
                label="Alergias (separadas por comas)"
                value={formData.allergies}
                onChange={handleChange}
              />

              <InputField
                name="medicalConditions"
                label="Condiciones Médicas Relevantes (separadas por comas)"
                value={formData.medicalConditions}
                onChange={handleChange}
              />

              <div className="form-control pt-4">
                <label className="label cursor-pointer justify-start gap-4 items-center">
                  <input
                    type="checkbox"
                    name="termsAccepted"
                    checked={formData.termsAccepted}
                    onChange={handleChange}
                    className="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />

                  <span className="label-text text-gray-700">
                    Acepto los términos y condiciones y doy mi consentimiento para el uso de mis datos médicos en una emergencia.
                  </span>
                </label>
              </div>

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
              Verifica tu teléfono
            </h2>

            <form onSubmit={handleVerifyRegister} className="space-y-6">
              <p className="text-sm text-center text-gray-600">
                Enviamos un código por SMS al número {maskedPhone}. Escríbelo para completar tu registro.
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
                {loading ? 'Verificando...' : 'Verificar y generar QR'}
              </button>

              <button
                type="button"
                onClick={returnToForm}
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
