import { Link } from "react-router-dom";

export function Header() {
  return (
    <header className="bg-black/50 backdrop-blur-sm border-b border-white/10">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link
          to="/"
          className="text-2xl font-bold text-white hover:text-purple-400 transition-colors"
        >
          Frank
        </Link>
        <nav className="flex gap-6">
          <Link
            to="/"
            className="text-gray-300 hover:text-white transition-colors"
          >
            Songs
          </Link>
        </nav>
      </div>
    </header>
  );
}
