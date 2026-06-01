import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { restaurantApi, planningApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Save, Trash2, Clock } from 'lucide-react';

const DAYS = [
  { key: 'MONDAY', label: 'Lundi', index: 1 },
  { key: 'TUESDAY', label: 'Mardi', index: 2 },
  { key: 'WEDNESDAY', label: 'Mercredi', index: 3 },
  { key: 'THURSDAY', label: 'Jeudi', index: 4 },
  { key: 'FRIDAY', label: 'Vendredi', index: 5 },
  { key: 'SATURDAY', label: 'Samedi', index: 6 },
  { key: 'SUNDAY', label: 'Dimanche', index: 0 },
];

export function PlanningsPage() {
  const { isAdmin } = useAuth();
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>('');
  const [plannings, setPlannings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Check if user can configure the selected restaurant
  const canConfigure = () => {
    if (isAdmin) return true;
    const restaurant = restaurants.find(r => r.id === selectedRestaurant);
    return restaurant?.userAccess?.canConfigure ?? false;
  };

  // Check if a planning is currently running
  const isPlanningActive = (planning: any) => {
    if (!planning.active) return false;

    const now = new Date();
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const currentDay = dayNames[now.getDay()];
    const currentTime = now.toTimeString().slice(0, 5); // Format: "HH:MM"

    return (
      planning.dayOfWeek === currentDay &&
      currentTime >= planning.startTime &&
      currentTime <= planning.endTime
    );
  };

  useEffect(() => {
    loadRestaurants();
  }, []);

  useEffect(() => {
    if (selectedRestaurant) {
      loadPlannings();
    }
  }, [selectedRestaurant]);

  const loadRestaurants = async () => {
    try {
      const response = await restaurantApi.getAll();
      setRestaurants(response.data);
      if (response.data.length > 0) {
        setSelectedRestaurant(response.data[0].id);
      }
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const loadPlannings = async () => {
    if (!selectedRestaurant) return;
    setLoading(true);
    try {
      const response = await planningApi.getByRestaurant(selectedRestaurant);
      setPlannings(response.data);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const addPlanning = () => {
    setPlannings([
      ...plannings,
      {
        id: `new-${Date.now()}`,
        restaurantId: selectedRestaurant,
        dayOfWeek: 'MONDAY',
        startTime: '09:00',
        endTime: '18:00',
        minScenarios: 45,
        maxScenarios: 55,
        active: true,
        _isNew: true,
      },
    ]);
  };

  const updatePlanning = (index: number, field: string, value: any) => {
    const updated = [...plannings];
    updated[index] = { ...updated[index], [field]: value };
    setPlannings(updated);
  };

  const deletePlanning = async (index: number, id: string) => {
    if (id.startsWith('new-')) {
      setPlannings(plannings.filter((_, i) => i !== index));
    } else {
      if (!confirm('Confirmer la suppression ?')) return;
      try {
        await planningApi.delete(id);
        loadPlannings();
      } catch (error: any) {
        alert(error.response?.data?.error || 'Erreur lors de la suppression');
      }
    }
  };

  const savePlannings = async () => {
    try {
      await planningApi.bulkCreate(selectedRestaurant, plannings);
      alert('Plannings sauvegardés avec succès !');
      loadPlannings();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de la sauvegarde');
    }
  };

  const selectedRestaurantData = restaurants.find((r) => r.id === selectedRestaurant);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Plannings</h1>
            <p className="text-muted-foreground mt-2">
              Configurez les plannings de scénarios par restaurant
            </p>
          </div>
        </div>

        {/* Restaurant selector */}
        <Card>
          <CardHeader>
            <CardTitle>Restaurant</CardTitle>
          </CardHeader>
          <CardContent>
            <select
              className="w-full p-2 border rounded-md"
              value={selectedRestaurant}
              onChange={(e) => setSelectedRestaurant(e.target.value)}
            >
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.code} - {restaurant.name}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        {selectedRestaurant && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                Plannings pour {selectedRestaurantData?.name}
              </CardTitle>
              {canConfigure() && (
                <div className="flex gap-2">
                  <Button onClick={addPlanning} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Ajouter
                  </Button>
                  <Button onClick={savePlannings} size="sm" variant="outline">
                    <Save className="mr-2 h-4 w-4" />
                    Sauvegarder tout
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : plannings.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Aucun planning configuré
                </p>
              ) : (
                <div className="space-y-4">
                  {plannings.map((planning, index) => {
                    const isActive = isPlanningActive(planning);
                    return (
                      <div
                        key={planning.id}
                        className={`grid grid-cols-7 gap-4 p-4 border rounded-lg items-end ${
                          isActive ? 'border-green-500 bg-green-500/10' : ''
                        }`}
                      >
                        <div className="space-y-2">
                          <label className="text-sm font-medium flex items-center gap-2">
                            Statut
                          </label>
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={planning.active}
                                onChange={(e) =>
                                  updatePlanning(index, 'active', e.target.checked)
                                }
                                disabled={!canConfigure()}
                                className="w-5 h-5 rounded border-input cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                              />
                              <span className="text-xs text-muted-foreground">
                                {planning.active ? 'Actif' : 'Inactif'}
                              </span>
                            </div>
                            {isActive && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400 animate-pulse">
                                <Clock className="h-3 w-3" />
                                🔴 EN COURS
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">                          <label className="text-sm font-medium">Jour</label>
                          <select
                            className="w-full p-2 border rounded-md"
                            value={planning.dayOfWeek}
                            onChange={(e) =>
                              updatePlanning(index, 'dayOfWeek', e.target.value)
                            }
                            disabled={!canConfigure()}
                          >
                            {DAYS.map((day) => (
                              <option key={day.key} value={day.key}>
                                {day.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Début</label>
                          <Input
                            type="time"
                            value={planning.startTime}
                            onChange={(e) =>
                              updatePlanning(index, 'startTime', e.target.value)
                            }
                            disabled={!canConfigure()}
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Fin</label>
                          <Input
                            type="time"
                            value={planning.endTime}
                            onChange={(e) =>
                              updatePlanning(index, 'endTime', e.target.value)
                            }
                            disabled={!canConfigure()}
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Min</label>
                          <Input
                            type="number"
                            value={planning.minScenarios}
                            onChange={(e) =>
                              updatePlanning(
                                index,
                                'minScenarios',
                                parseInt(e.target.value)
                              )
                            }
                            disabled={!canConfigure()}
                            min="0"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Max</label>
                          <Input
                            type="number"
                            value={planning.maxScenarios}
                            onChange={(e) =>
                              updatePlanning(
                                index,
                                'maxScenarios',
                                parseInt(e.target.value)
                              )
                            }
                            disabled={!canConfigure()}
                            min="0"
                          />
                        </div>

                        {canConfigure() && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deletePlanning(index, planning.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
