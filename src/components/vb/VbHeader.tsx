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
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-16">
          {/* Mobile Menu Button */}
          {user && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-md hover:bg-gray-100 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              ) : (
                <Menu className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              )}
            </button>
          )}
          
          {/* Login Link - when not logged in */}
          {!user && (
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link
                to="/login"
                className="text-gray-600 hover:text-primary transition-colors text-sm sm:text-base"
              >
                Login
              </Link>
            </div>
          )}

          <div className="flex items-center space-x-2 sm:space-x-4 lg:space-x-8">
            <nav className="hidden md:flex items-center space-x-4 lg:space-x-8">
              {user && additionalRoles?.includes('videobesprechung') && (
                <>
                  <Link
                    to="/vb/dashboard"
                    className="text-gray-600 hover:text-primary transition-colors text-sm sm:text-base font-medium"
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/vb/chat"
                    className="text-gray-600 hover:text-primary transition-colors flex items-center gap-1 text-sm sm:text-base font-medium"
                  >
                    <MessageCircle className="w-4 h-4 text-primary" />
                    <span className="hidden sm:inline">Chat</span>
                  </Link>
                  <Link
                    to="/vb/results"
                    className="text-gray-600 hover:text-primary transition-colors text-sm sm:text-base font-medium"
                  >
                    Ergebnisse
                  </Link>
                  <Link
                    to="/vb/masterclass"
                    className="text-gray-600 hover:text-primary transition-colors text-sm sm:text-base font-medium"
                  >
                    Klausuren-Masterclass
                  </Link>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-4">
            {/* Logo */}
            <Link to="/vb" className="flex items-center flex-shrink-0 order-last">
              <img 
                src="https://kraatz-group.de/wp-content/uploads/2023/05/KraatzGroup_Logo_web.png" 
                alt="Kraatz Logo" 
                className="h-7 sm:h-8 lg:h-10 w-auto object-contain" 
              />
            </Link>
            
            {user && additionalRoles?.includes('videobesprechung') && (
              <>
                <div className="relative group hidden sm:block">
                  <Link 
                    to="/vb/packages"
                    className="flex items-center space-x-1 sm:space-x-2 p-1.5 sm:p-2 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                    <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap hidden lg:inline">Credits: {userCredits}</span>
                    <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap lg:hidden">{userCredits}</span>
                  </Link>
                </div>

                <div className="relative group hidden md:block">
                  <button className="flex items-center space-x-1 sm:space-x-2 p-1.5 sm:p-2 rounded-md hover:bg-gray-100 transition-colors">
                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    <span className="text-xs sm:text-sm text-gray-600 truncate max-w-[80px] sm:max-w-[120px] lg:max-w-[150px] hidden sm:inline">{user.email}</span>
                  </button>
                  
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="py-1">
                      <Link
                        to="/vb/profile"
                        className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-primary"
                      >
                        Profil
                      </Link>
                      <Link
                        to="/vb/settings"
                        className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-primary"
                      >
                        Einstellungen
                      </Link>
                      <button
                        onClick={handleSignOut}
                        className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-primary flex items-center space-x-2"
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
          <div className="md:hidden border-t border-gray-200 py-3 sm:py-4">
            <nav className="flex flex-col space-y-2 sm:space-y-4">
              <Link
                to="/vb/dashboard"
                className="text-gray-600 hover:text-primary transition-colors px-2 py-2 block text-sm sm:text-base font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                to="/vb/chat"
                className="text-gray-600 hover:text-primary transition-colors flex items-center gap-2 px-2 py-2 text-sm sm:text-base font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                <MessageCircle className="w-4 h-4 text-primary" />
                Chat
              </Link>
              <Link
                to="/vb/results"
                className="text-gray-600 hover:text-primary transition-colors px-2 py-2 block text-sm sm:text-base font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Ergebnisse
              </Link>
              <Link
                to="/vb/masterclass"
                className="text-gray-600 hover:text-primary transition-colors px-2 py-2 block text-sm sm:text-base font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Klausuren-Masterclass
              </Link>

              <div className="border-t border-gray-200 pt-3 sm:pt-4 mt-3 sm:mt-4 space-y-2 sm:space-y-4">
                <Link
                  to="/vb/packages"
                  className="flex items-center gap-2 px-2 py-2 text-gray-600 hover:text-primary transition-colors text-sm sm:text-base"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <CreditCard className="w-4 h-4 text-primary" />
                  <span>Credits: {userCredits}</span>
                </Link>
                
                <div className="flex items-center gap-2 px-2 py-2">
                  <User className="w-5 h-5 text-primary" />
                  <span className="text-sm text-gray-600 truncate">{user.email}</span>
                </div>

                <Link
                  to="/vb/profile"
                  className="block px-2 py-2 text-gray-600 hover:text-primary transition-colors text-sm sm:text-base font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Profil
                </Link>
                <Link
                  to="/vb/settings"
                  className="block px-2 py-2 text-gray-600 hover:text-primary transition-colors text-sm sm:text-base font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Einstellungen
                </Link>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleSignOut();
                  }}
                  className="w-full text-left px-2 py-2 text-gray-600 hover:text-primary transition-colors flex items-center gap-2 text-sm sm:text-base font-medium"
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
