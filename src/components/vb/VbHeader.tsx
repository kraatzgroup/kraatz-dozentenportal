import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { User, CreditCard, LogOut, MessageCircle, Menu, X } from 'lucide-react';

export const VbHeader: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const additionalRoles = useAuthStore(state => state.additionalRoles);
  const navigate = useNavigate();
  const [userCredits, setUserCredits] = useState<number>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('account_credits')
            .eq('id', user.id)
            .single();

          if (!error && data) {
            setUserCredits(data.account_credits || 0);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }
    };

    fetchUserData();
  }, [user]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/vb');
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Mobile Menu Button */}
          {user && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-md hover:bg-gray-100 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-gray-600" />
              ) : (
                <Menu className="w-6 h-6 text-gray-600" />
              )}
            </button>
          )}
          
          {/* Login Link - when not logged in */}
          {!user && (
            <div className="flex items-center space-x-4">
              <Link
                to="/login"
                className="text-gray-600 hover:text-blue-600 transition-colors"
              >
                Login
              </Link>
            </div>
          )}

          <div className="flex items-center space-x-4 sm:space-x-8">
            <nav className="hidden md:flex items-center space-x-8">
              {user && additionalRoles?.includes('videobesprechung') && (
                <>
                  <Link
                    to="/vb/dashboard"
                    className="text-gray-600 hover:text-blue-600 transition-colors"
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/vb/chat"
                    className="text-gray-600 hover:text-blue-600 transition-colors flex items-center gap-1"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Chat
                  </Link>
                  <Link
                    to="/vb/results"
                    className="text-gray-600 hover:text-blue-600 transition-colors"
                  >
                    Ergebnisse
                  </Link>
                  <Link
                    to="/vb/masterclass"
                    className="text-gray-600 hover:text-blue-600 transition-colors"
                  >
                    Klausuren-Masterclass
                  </Link>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Logo */}
            <Link to="/vb" className="flex items-center flex-shrink-0 order-last">
              <img 
                src="/4 Kopie (1).png" 
                alt="Kraatz Logo" 
                className="h-8 sm:h-10 w-auto object-contain" 
              />
            </Link>
            
            {user && additionalRoles?.includes('videobesprechung') && (
              <>
                <div className="relative group hidden sm:block">
                  <Link 
                    to="/vb/packages"
                    className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    <CreditCard className="w-4 h-4 text-gray-600" />
                    <span className="text-sm text-gray-600 whitespace-nowrap">Credits: {userCredits}</span>
                  </Link>
                </div>

                <div className="relative group hidden md:block">
                  <button className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-100 transition-colors">
                    <User className="w-5 h-5 text-gray-600" />
                    <span className="text-sm text-gray-600 truncate max-w-[150px]">{user.email}</span>
                  </button>
                  
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="py-1">
                      <Link
                        to="/vb/profile"
                        className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-blue-600"
                      >
                        Profil
                      </Link>
                      <Link
                        to="/vb/settings"
                        className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-blue-600"
                      >
                        Einstellungen
                      </Link>
                      <button
                        onClick={handleSignOut}
                        className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-blue-600 flex items-center space-x-2"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Abmelden</span>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {user && mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4">
            <nav className="flex flex-col space-y-4">
              <Link
                to="/vb/dashboard"
                className="text-gray-600 hover:text-blue-600 transition-colors px-2 py-2 block"
                onClick={() => setMobileMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                to="/vb/chat"
                className="text-gray-600 hover:text-blue-600 transition-colors flex items-center gap-2 px-2 py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                <MessageCircle className="w-4 h-4" />
                Chat
              </Link>
              <Link
                to="/vb/results"
                className="text-gray-600 hover:text-blue-600 transition-colors px-2 py-2 block"
                onClick={() => setMobileMenuOpen(false)}
              >
                Ergebnisse
              </Link>
              <Link
                to="/vb/masterclass"
                className="text-gray-600 hover:text-blue-600 transition-colors px-2 py-2 block"
                onClick={() => setMobileMenuOpen(false)}
              >
                Klausuren-Masterclass
              </Link>

              <div className="border-t border-gray-200 pt-4 mt-4 space-y-4">
                <Link
                  to="/vb/packages"
                  className="flex items-center gap-2 px-2 py-2 text-gray-600 hover:text-blue-600 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Credits: {userCredits}</span>
                </Link>
                
                <div className="flex items-center gap-2 px-2 py-2">
                  <User className="w-5 h-5 text-gray-600" />
                  <span className="text-sm text-gray-600 truncate">{user.email}</span>
                </div>

                <Link
                  to="/vb/profile"
                  className="block px-2 py-2 text-gray-600 hover:text-blue-600 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Profil
                </Link>
                <Link
                  to="/vb/settings"
                  className="block px-2 py-2 text-gray-600 hover:text-blue-600 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Einstellungen
                </Link>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleSignOut();
                  }}
                  className="w-full text-left px-2 py-2 text-gray-600 hover:text-blue-600 transition-colors flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Abmelden</span>
                </button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};
