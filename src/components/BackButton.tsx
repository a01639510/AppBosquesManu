import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function BackButton() {
    const navigate = useNavigate();
    return (
        <button 
            onClick={() => navigate(-1)} 
            className="flex items-center gap-2 text-green-700 hover:text-green-900 transition-colors mb-6 font-semibold"
        >
            <ArrowLeft size={20} />
            Regresar
        </button>
    );
}
