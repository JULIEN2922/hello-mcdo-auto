import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from './ui/button';
import { Home, Store, Calendar, FileText, Users, LogOut, Moon, Sun } from 'lucide-react';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const navigation = [
    { name: 'Tableau de bord', href: '/', icon: Home },
    { name: 'Restaurants', href: '/restaurants', icon: Store },
    { name: 'Plannings', href: '/plannings', icon: Calendar },
    { name: 'Logs', href: '/logs', icon: FileText },
    ...(isAdmin ? [{ name: 'Utilisateurs', href: '/users', icon: Users }] : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-card border-r">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center px-6 border-b">
            <h1 className="text-xl font-bold">Hello McDo Auto</h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <Icon size={20} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* User info */}
          <div className="p-4 border-t space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {user?.firstName} {user?.lastName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {user?.role}
                </span>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  title={theme === 'light' ? 'Mode sombre' : 'Mode clair'}
                >
                  {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={logout}
                  title="Déconnexion"
                >
                  <LogOut size={18} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="pl-64">
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
