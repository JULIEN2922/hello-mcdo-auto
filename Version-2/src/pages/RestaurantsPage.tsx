import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { restaurantApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Pencil, Trash2, MapPin, Settings } from 'lucide-react';

export function RestaurantsPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    address: '',
    city: '',
  });

  useEffect(() => {
    loadRestaurants();
  }, []);

  const loadRestaurants = async () => {
    try {
      const response = await restaurantApi.getAll();
      setRestaurants(response.data);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await restaurantApi.update(editingId, formData);
      } else {
        await restaurantApi.create(formData);
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ code: '', name: '', address: '', city: '' });
      loadRestaurants();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de la sauvegarde');
    }
  };

  const handleEdit = (restaurant: any) => {
    setFormData({
      code: restaurant.code,
      name: restaurant.name,
      address: restaurant.address || '',
      city: restaurant.city || '',
    });
    setEditingId(restaurant.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Confirmer la suppression ?')) return;
    
    try {
      await restaurantApi.delete(id);
      loadRestaurants();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de la suppression');
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ code: '', name: '', address: '', city: '' });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Restaurants</h1>
            <p className="text-muted-foreground mt-2">
              Gérez les restaurants et leurs accès
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau restaurant
            </Button>
          )}
        </div>

        {showForm && isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>
                {editingId ? 'Modifier' : 'Nouveau'} restaurant
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Code *</label>
                    <Input
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      required
                      placeholder="1318"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nom *</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="Paris Champs-Élysées"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Adresse</label>
                    <Input
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="123 Avenue des Champs-Élysées"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Ville</label>
                    <Input
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="Paris"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit">{editingId ? 'Mettre à jour' : 'Créer'}</Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Annuler
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : restaurants.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucun restaurant disponible
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Localisation</TableHead>
                    <TableHead>Plannings</TableHead>
                    <TableHead>Logs</TableHead>
                    {isAdmin && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {restaurants.map((restaurant) => (
                    <TableRow key={restaurant.id}>
                      <TableCell className="font-mono">{restaurant.code}</TableCell>
                      <TableCell className="font-medium">{restaurant.name}</TableCell>
                      <TableCell>
                        {restaurant.city ? (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span>{restaurant.city}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{restaurant._count?.plannings || 0}</TableCell>
                      <TableCell>{restaurant._count?.logs || 0}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate(`/restaurants/${restaurant.id}/config`)}
                              title="Configuration"
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(restaurant)}
                              title="Modifier"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(restaurant.id)}
                              title="Supprimer"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
