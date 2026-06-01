import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { userApi } from '../lib/api';
import api from '../lib/api';
import { Shield, User, Trash2, Edit, X } from 'lucide-react';

interface Restaurant {
  id: string;
  code: string;
  name: string;
}

interface RestaurantAccess {
  restaurantId: string;
  canView: boolean;
  canConfigure: boolean;
}

export function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [selectedRole, setSelectedRole] = useState<'ADMIN' | 'USER'>('USER');
  const [restaurantAccess, setRestaurantAccess] = useState<Map<string, RestaurantAccess>>(new Map());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersRes, restaurantsRes] = await Promise.all([
        userApi.getAll(),
        api.get('/restaurants')
      ]);
      setUsers(usersRes.data);
      setRestaurants(restaurantsRes.data);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (user: any) => {
    // Load detailed user info with restaurant access
    try {
      const response = await api.get(`/users/${user.id}`);
      const userData = response.data;
      
      setEditingUser(userData);
      setSelectedRole(userData.role);
      
      // Build map of restaurant access
      const accessMap = new Map<string, RestaurantAccess>();
      userData.restaurantAccess?.forEach((access: any) => {
        accessMap.set(access.restaurantId, {
          restaurantId: access.restaurantId,
          canView: access.canView,
          canConfigure: access.canConfigure
        });
      });
      setRestaurantAccess(accessMap);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    
    try {
      setSaving(true);
      
      // Update user role
      await api.put(`/users/${editingUser.id}`, {
        role: selectedRole
      });

      // Update restaurant access
      const accessArray = Array.from(restaurantAccess.values()).filter(
        access => access.canView || access.canConfigure
      );
      
      await api.post(`/users/${editingUser.id}/restaurants`, {
        restaurantAccess: accessArray
      });

      alert('Utilisateur mis à jour avec succès');
      setEditingUser(null);
      loadData();
    } catch (error: any) {
      console.error('Error saving user:', error);
      alert(error.response?.data?.error || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const toggleRestaurantAccess = (restaurantId: string, field: 'canView' | 'canConfigure') => {
    setRestaurantAccess(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(restaurantId) || {
        restaurantId,
        canView: false,
        canConfigure: false
      };
      
      let newAccess: RestaurantAccess;
      
      if (field === 'canView') {
        // Toggle view
        const newViewValue = !current.canView;
        
        // If disabling view, must also disable configure
        newAccess = {
          restaurantId,
          canView: newViewValue,
          canConfigure: newViewValue ? current.canConfigure : false
        };
      } else {
        // Toggle configure
        const newConfigValue = !current.canConfigure;
        
        // If enabling configure, must also enable view
        newAccess = {
          restaurantId,
          canView: newConfigValue ? true : current.canView,
          canConfigure: newConfigValue
        };
      }
      
      newMap.set(restaurantId, newAccess);
      return newMap;
    });
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Confirmer la suppression de cet utilisateur ?')) return;

    try {
      await userApi.delete(userId);
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de la suppression');
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const isUserOnline = (lastLogin: string | null) => {
    if (!lastLogin) return false;
    const lastLoginDate = new Date(lastLogin);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastLoginDate.getTime()) / (1000 * 60);
    return diffMinutes <= 15; // Online if logged in within last 15 minutes
  };

  const formatLastLogin = (lastLogin: string | null) => {
    if (!lastLogin) return 'Jamais';
    const lastLoginDate = new Date(lastLogin);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - lastLoginDate.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'À l\'instant';
    if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    
    return formatDate(lastLogin);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Utilisateurs</h1>
          <p className="text-muted-foreground mt-2">
            Gérez les utilisateurs, leurs rôles et accès aux restaurants
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Liste des utilisateurs</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : users.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucun utilisateur trouvé
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Statut</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Restaurants</TableHead>
                    <TableHead>Logs</TableHead>
                    <TableHead>Dernière connexion</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const online = isUserOnline(user.lastLogin);
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                online ? 'bg-green-500' : 'bg-gray-300'
                              }`}
                              title={online ? 'En ligne' : 'Hors ligne'}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {user.firstName} {user.lastName}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                              user.role === 'ADMIN'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary text-secondary-foreground'
                            }`}
                          >
                            {user.role === 'ADMIN' ? (
                              <Shield className="h-3 w-3" />
                            ) : (
                              <User className="h-3 w-3" />
                            )}
                            {user.role}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {user._count.restaurantAccess}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {user._count.logs}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatLastLogin(user.lastLogin)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(user)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(user.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>Modifier l'utilisateur</CardTitle>
                <CardDescription>
                  {editingUser.firstName} {editingUser.lastName} ({editingUser.email})
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingUser(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Role Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Rôle</label>
                <div className="flex gap-2">
                  <Button
                    variant={selectedRole === 'USER' ? 'default' : 'outline'}
                    onClick={() => setSelectedRole('USER')}
                    className="flex-1"
                  >
                    <User className="h-4 w-4 mr-2" />
                    Utilisateur
                  </Button>
                  <Button
                    variant={selectedRole === 'ADMIN' ? 'default' : 'outline'}
                    onClick={() => setSelectedRole('ADMIN')}
                    className="flex-1"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Administrateur
                  </Button>
                </div>
              </div>

              {/* Restaurant Access */}
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Accès aux restaurants</label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Définissez les restaurants accessibles et les permissions
                  </p>
                </div>
                
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Restaurant</TableHead>
                        <TableHead className="text-center">Voir</TableHead>
                        <TableHead className="text-center">Configurer</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {restaurants.map(restaurant => {
                        const access = restaurantAccess.get(restaurant.id);
                        return (
                          <TableRow key={restaurant.id}>
                            <TableCell className="font-medium">
                              {restaurant.code} - {restaurant.name}
                            </TableCell>
                            <TableCell className="text-center">
                              <input
                                type="checkbox"
                                checked={access?.canView ?? false}
                                onChange={() => toggleRestaurantAccess(restaurant.id, 'canView')}
                                className="w-4 h-4 cursor-pointer"
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <input
                                type="checkbox"
                                checked={access?.canConfigure ?? false}
                                onChange={() => toggleRestaurantAccess(restaurant.id, 'canConfigure')}
                                disabled={!access?.canView}
                                className="w-4 h-4 cursor-pointer disabled:opacity-30"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setEditingUser(null)}
                  disabled={saving}
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleSaveUser}
                  disabled={saving}
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Layout>
  );
}
