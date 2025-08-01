import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore.js";
import { LogOut, Settings, User, BookOpen } from "lucide-react";

const Navbar = () => {
    const { logout, authUser } = useAuthStore();
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    if (!authUser) return null;

    const isActive = (path) => location.pathname === path;

    return (
        <div className="bg-gradient-to-b from-blue-600 to-blue-700 h-screen w-64 fixed left-0 top-0 shadow-xl">
            {/* Header */}
            <div className="p-6 border-b border-blue-500">
                <h1 className="text-white text-xl font-bold">FlashCard App</h1>
                <p className="text-blue-200 text-sm mt-1">Вчи ефективно</p>
            </div>

            {/* User Info */}
            <div className="p-4 border-b border-blue-500">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                        {authUser.profilePic ? (
                            <img
                                src={authUser.profilePic}
                                alt="Profile"
                                className="w-full h-full rounded-full object-cover"
                            />
                        ) : (
                            <User className="w-6 h-6 text-white" />
                        )}
                    </div>
                    <div>
                        <p className="text-white text-sm font-medium">{authUser.fullName}</p>
                        <p className="text-blue-200 text-xs">{authUser.email}</p>
                    </div>
                </div>
            </div>

            {/* Menu Items */}
            <nav className="mt-4">
                <ul className="space-y-2 px-4">
                    <li>
                        <Link
                            to="/"
                            className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                                isActive('/')
                                    ? 'bg-blue-500 text-white shadow-md'
                                    : 'text-blue-100 hover:bg-blue-600 hover:text-white'
                            }`}
                        >
                            <BookOpen className="w-5 h-5" />
                            <span>Флеш картки</span>
                        </Link>
                    </li>
                    <li>
                        <Link
                            to="/profile"
                            className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                                isActive('/profile')
                                    ? 'bg-blue-500 text-white shadow-md'
                                    : 'text-blue-100 hover:bg-blue-600 hover:text-white'
                            }`}
                        >
                            <User className="w-5 h-5" />
                            <span>Профіль</span>
                        </Link>
                    </li>
                    <li>
                        <Link
                            to="/settings"
                            className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                                isActive('/settings')
                                    ? 'bg-blue-500 text-white shadow-md'
                                    : 'text-blue-100 hover:bg-blue-600 hover:text-white'
                            }`}
                        >
                            <Settings className="w-5 h-5" />
                            <span>Налаштування</span>
                        </Link>
                    </li>
                </ul>
            </nav>

            {/* Logout Button */}
            <div className="absolute bottom-4 left-4 right-4">
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    <span>Вийти</span>
                </button>
            </div>
        </div>
    );
};

export default Navbar;