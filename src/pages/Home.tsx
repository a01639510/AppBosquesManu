import { Link } from 'react-router-dom';
import { UserPlus, Search, ShieldCheck } from 'lucide-react';
import FindQrCode from '../components/FindQrCode';

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto p-6 md:p-12">
      <div className="text-center mb-12">
        <h1 className="text-5xl md:text-6xl font-extrabold mb-4 text-green-900 tracking-tight">
          Mas Bosques Manu
        </h1>
        <p className="text-xl text-green-700 font-medium">Sistema de Respuesta a Emergencias</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-16">
        {/* Visitor Section - Primary */}
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-green-100 flex flex-col items-center text-center transition-all hover:shadow-2xl hover:-translate-y-1">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mb-6">
            <UserPlus className="text-green-700 w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Visitantes</h2>
          <p className="text-gray-600 mb-8">Regístrate para obtener tu código QR de seguridad antes de ingresar al parque.</p>
          <Link 
            to="/register" 
            className="w-full bg-green-600 text-white px-6 py-4 rounded-2xl text-lg font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-200"
          >
            Registra tu Visita
          </Link>
        </div>

        {/* Find QR Section - Secondary */}
        <div className="bg-green-50 rounded-3xl p-8 border border-green-200 flex flex-col items-center text-center transition-all hover:shadow-lg">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-sm">
            <Search className="text-green-600 w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">¿Ya tienes QR?</h2>
          <p className="text-gray-600 mb-8">Si ya te registraste anteriormente, recupera tu código QR aquí mismo.</p>
          <a 
            href="#recuperar" 
            className="w-full bg-white text-green-700 border-2 border-green-600 px-6 py-4 rounded-2xl text-lg font-bold hover:bg-green-100 transition-colors"
          >
            Encuentra tu QR
          </a>
        </div>
      </div>

      {/* Find QR Component with ID for anchor */}
      <div id="recuperar" className="mb-16 scroll-mt-24">
        <FindQrCode />
      </div>

      {/* Staff Section - Discrete */}
      <div className="pt-12 border-t border-gray-200 text-center">
        <div className="inline-flex items-center gap-2 text-gray-500 mb-4">
          <ShieldCheck size={18} />
          <span className="text-sm font-semibold uppercase tracking-wider">Acceso Restringido</span>
        </div>
        <br />
        <Link 
          to="/login" 
          className="inline-block text-gray-600 font-bold hover:text-green-700 transition-colors py-2 px-4 rounded-xl hover:bg-gray-100"
        >
          Ingreso para Personal y Paramédicos →
        </Link>
      </div>
    </div>
  );
}

