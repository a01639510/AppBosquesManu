import { Link } from 'react-router-dom';

export default function Header() {
  return (
    <header className="bg-white border-b border-gray-100 p-4 sticky top-0 z-50 backdrop-blur-md bg-white/90">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 bg-green-700 rounded-xl flex items-center justify-center text-white font-black text-xl group-hover:rotate-6 transition-transform">
            M
          </div>
          <span className="text-xl font-black text-green-900 tracking-tight">Mas Bosque Manu</span>
        </Link>
        <nav>
          <Link to="/login" className="text-sm font-bold text-gray-500 hover:text-green-700 transition-colors uppercase tracking-widest">Personal</Link>
        </nav>
      </div>
    </header>
  );
}
