import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import BackButton from '../components/BackButton';
import QRCode, { QRCodeToDataURLOptions } from 'qrcode';
import { Download, Printer } from 'lucide-react';

export default function QrCode() {
  const { userId } = useParams<{ userId: string }>();
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  useEffect(() => {
    if (userId) {
      const opts: QRCodeToDataURLOptions = {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        margin: 1,
        width: 600, // Higher resolution for download
        color: {
          dark: '#05422C', // Dark green
          light: '#FFFFFF' // White background for the image file
        }
      }
      QRCode.toDataURL(userId, opts)
        .then(url => {
          setQrCodeUrl(url);
        })
        .catch(err => {
          console.error('Error al generar el código QR', err);
        });
    }
  }, [userId]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.download = `QR-MBM-${userId}.png`;
    link.href = qrCodeUrl;
    link.click();
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <BackButton />
      <div className="text-center p-8 bg-white rounded-3xl shadow-2xl border border-green-50">
        <h2 className="text-3xl font-black mb-2 text-green-900 tracking-tight">Tu Pase de Seguridad</h2>
        <p className="mb-8 text-gray-600 font-medium">Guarda este código. Es obligatorio para tu atención médica en el parque.</p>
        
        <div className="p-6 bg-green-50 rounded-3xl inline-block mb-8 shadow-inner border border-green-100">
          {qrCodeUrl ? (
            <img src={qrCodeUrl} alt="Tu Código QR" className="w-64 h-64 mx-auto rounded-xl shadow-sm" />
          ) : (
            <div className="w-64 h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700"></div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <button 
            onClick={handleDownload}
            className="w-full bg-green-700 text-white px-6 py-4 rounded-2xl text-lg font-bold hover:bg-green-800 transition-all flex items-center justify-center gap-3 shadow-lg shadow-green-100"
          >
            <Download size={24} />
            Descargar Imagen QR
          </button>
          
          <button 
            onClick={() => window.print()}
            className="w-full bg-white text-gray-700 border-2 border-gray-200 px-6 py-4 rounded-2xl text-lg font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-3"
          >
            <Printer size={24} />
            Imprimir Pase
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">ID de Seguridad</p>
          <span className="font-mono text-sm bg-gray-100 text-gray-600 px-4 py-2 rounded-full border border-gray-200">
            {userId}
          </span>
        </div>
      </div>
    </div>
  );
}

