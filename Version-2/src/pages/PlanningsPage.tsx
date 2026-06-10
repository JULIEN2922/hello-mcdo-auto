import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { restaurantApi, planningApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Save, Trash2, Clock, Edit2 } from 'lucide-react';

const DAYS = [
  { key: 'MONDAY', label: 'Lundi', index: 1 },
  { key: 'TUESDAY', label: 'Mardi', index: 2 },
  { key: 'WEDNESDAY', label: 'Mercredi', index: 3 },
  { key: 'THURSDAY', label: 'Jeudi', index: 4 },
  { key: 'FRIDAY', label: 'Vendredi', index: 5 },
  { key: 'SATURDAY', label: 'Samedi', index: 6 },
  { key: 'SUNDAY', label: 'Dimanche', index: 0 },
];

// Timeline Component - Google Agenda style with current time indicator
function PlanningTimeline({ 
  plannings, 
  onPlanningClick, 
  onAddClick 
}: { 
  plannings: any[]; 
  onPlanningClick: (planning: any) => void;
  onAddClick: (day: string, hour: number) => void;
}) {
  const [currentTimePercent, setCurrentTimePercent] = useState(0);
  const [currentDay, setCurrentDay] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const percent = ((hours * 60 + minutes) / (24 * 60)) * 100;
      setCurrentTimePercent(percent);
      
      const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      setCurrentDay(dayNames[now.getDay()]);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const timeToPercent = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return ((hours * 60 + minutes) / (24 * 60)) * 100;
  };

  const hours = Array.from({ length: 25 }, (_, i) => i);
  
  const colors = [
    'bg-green-400/90 hover:bg-green-500 border-green-600 text-green-950',
    'bg-blue-400/90 hover:bg-blue-500 border-blue-600 text-blue-950',
    'bg-purple-400/90 hover:bg-purple-500 border-purple-600 text-purple-950',
    'bg-orange-400/90 hover:bg-orange-500 border-orange-600 text-orange-950',
    'bg-pink-400/90 hover:bg-pink-500 border-pink-600 text-pink-950',
  ];

  return (
    <div className="flex gap-0 border rounded-lg overflow-hidden bg-background shadow-sm">
      {/* Time column */}
      <div className="w-16 flex-shrink-0 border-r bg-muted/30">
        <div className="h-12 border-b"></div>
        {hours.map((hour) => (
          <div
            key={hour}
            className="h-12 border-b text-xs text-muted-foreground px-2 py-1 text-right"
          >
            {hour < 24 && `${hour.toString().padStart(2, '0')}:00`}
          </div>
        ))}
      </div>

      {/* Days columns */}
      {DAYS.map((day) => {
        const dayPlannings = plannings
          .filter((p) => p.dayOfWeek === day.key)
          .sort((a, b) => a.startTime.localeCompare(b.startTime));

        const isToday = day.key === currentDay;

        return (
          <div key={day.key} className="flex-1 border-r last:border-r-0 relative min-w-[120px]">
            {/* Day header */}
            <div className={`h-12 border-b flex items-center justify-center ${
              isToday ? 'bg-primary/20' : 'bg-muted/30'
            }`}>
              <div className={`text-sm uppercase font-semibold ${
                isToday ? 'text-primary' : 'text-muted-foreground'
              }`}>
                {day.label}
              </div>
            </div>

            {/* Hour grid */}
            <div className="relative">
              {hours.map((hour) => (
                <div 
                  key={hour} 
                  className="h-12 border-b border-border/50 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => onAddClick(day.key, hour)}
                ></div>
              ))}

              {/* Current time indicator */}
              {isToday && (
                <div
                  className="absolute left-0 right-0 z-20 pointer-events-none"
                  style={{ top: `${currentTimePercent}%` }}
                >
                  <div className="relative">
                    <div className="absolute left-0 w-2 h-2 rounded-full bg-red-500 -translate-x-1/2 -translate-y-1/2"></div>
                    <div className="h-px bg-red-500"></div>
                  </div>
                </div>
              )}

              {/* Planning blocks */}
              {dayPlannings.map((planning, idx) => {
                const start = timeToPercent(planning.startTime);
                const end = timeToPercent(planning.endTime);
                const height = end - start;
                const isInactive = !planning.active;

                return (
                  <div
                    key={planning.id}
                    className={`absolute left-1 right-1 rounded-md border-l-4 shadow-sm transition-all cursor-pointer group overflow-hidden z-10 ${
                      isInactive 
                        ? '!bg-gray-400/40 dark:!bg-gray-600/40 hover:!bg-gray-500/50 dark:hover:!bg-gray-500/50 !border-gray-600 dark:!border-gray-500 !text-gray-700 dark:!text-gray-400 !opacity-50'
                        : colors[idx % colors.length]
                    }`}
                    style={{
                      top: `${start}%`,
                      height: `${height}%`,
                      minHeight: '24px',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlanningClick(planning);
                    }}
                    title={`${isInactive ? '(Désactivé) ' : ''}Cliquer pour modifier`}
                  >
                    <div className="p-1.5 text-xs font-medium leading-tight h-full flex flex-col">
                      <div className="font-semibold truncate flex items-center gap-1">
                        <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        {planning.startTime}
                      </div>
                      {height > 4 && (
                        <div className="text-[10px] opacity-90 truncate">
                          {planning.minScenarios}-{planning.maxScenarios} scénarios
                        </div>
                      )}
                      {height > 8 && (
                        <div className="text-[10px] opacity-75 mt-auto">
                          → {planning.endTime}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PlanningsPage() {
  const { isAdmin } = useAuth();
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>('');
  const [plannings, setPlannings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlanning, setEditingPlanning] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    dayOfWeek: 'MONDAY',
    startTime: '09:00',
    endTime: '18:00',
    minScenarios: 45,
    maxScenarios: 55,
    active: true,
  });

  // Check if user can configure the selected restaurant
  const canConfigure = () => {
    if (isAdmin) return true;
    const restaurant = restaurants.find(r => r.id === selectedRestaurant);
    return restaurant?.userAccess?.canConfigure ?? false;
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

  const handlePlanningClick = (planning: any) => {
    if (!canConfigure()) return;
    setEditingPlanning(planning);
    setFormData({
      dayOfWeek: planning.dayOfWeek,
      startTime: planning.startTime,
      endTime: planning.endTime,
      minScenarios: planning.minScenarios,
      maxScenarios: planning.maxScenarios,
      active: planning.active,
    });
    setDialogOpen(true);
  };

  const handleAddClick = (day: string, hour: number) => {
    if (!canConfigure()) return;
    setEditingPlanning(null);
    setFormData({
      dayOfWeek: day,
      startTime: `${hour.toString().padStart(2, '0')}:00`,
      endTime: `${(hour + 1).toString().padStart(2, '0')}:00`,
      minScenarios: 45,
      maxScenarios: 55,
      active: true,
    });
    setDialogOpen(true);
  };

  const handleSavePlanning = async () => {
    try {
      // Save scroll position
      const scrollY = window.scrollY;
      
      if (editingPlanning) {
        // Update existing
        await planningApi.update(editingPlanning.id, formData);
      } else {
        // Create new
        await planningApi.create({ ...formData, restaurantId: selectedRestaurant });
      }
      setDialogOpen(false);
      await loadPlannings();
      
      // Restore scroll position after re-render
      setTimeout(() => window.scrollTo(0, scrollY), 0);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de la sauvegarde');
    }
  };

  const handleDeletePlanning = async () => {
    if (!editingPlanning) return;
    if (!confirm('Confirmer la suppression ?')) return;
    
    try {
      // Save scroll position
      const scrollY = window.scrollY;
      
      await planningApi.delete(editingPlanning.id);
      setDialogOpen(false);
      await loadPlannings();
      
      // Restore scroll position after re-render
      setTimeout(() => window.scrollTo(0, scrollY), 0);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de la suppression');
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
              Cliquez sur le graphique pour ajouter ou modifier un planning
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
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Plannings pour {selectedRestaurantData?.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {plannings.filter(p => p.active).length} planning(s) actif(s)
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="rounded-lg overflow-hidden">
                  <div className="bg-muted/20 px-4 py-3 border-b flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <h4 className="text-sm font-semibold">Vue hebdomadaire</h4>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {canConfigure() ? 'Cliquez pour ajouter ou modifier' : 'Lecture seule'}
                    </span>
                  </div>
                  <PlanningTimeline 
                    plannings={plannings} 
                    onPlanningClick={handlePlanningClick}
                    onAddClick={handleAddClick}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Planning Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen} modal={true}>
          <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>
                {editingPlanning ? 'Modifier le planning' : 'Nouveau planning'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Jour</label>
                <select
                  className="w-full p-2 border rounded-md"
                  value={formData.dayOfWeek}
                  onChange={(e) => setFormData({ ...formData, dayOfWeek: e.target.value })}
                >
                  {DAYS.map((day) => (
                    <option key={day.key} value={day.key}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Heure de début</label>
                  <Input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Heure de fin</label>
                  <Input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Scénarios min</label>
                  <Input
                    type="number"
                    value={formData.minScenarios}
                    onChange={(e) => setFormData({ ...formData, minScenarios: parseInt(e.target.value) })}
                    min="0"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Scénarios max</label>
                  <Input
                    type="number"
                    value={formData.maxScenarios}
                    onChange={(e) => setFormData({ ...formData, maxScenarios: parseInt(e.target.value) })}
                    min="0"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="w-5 h-5 rounded border-input cursor-pointer"
                />
                <label htmlFor="active" className="text-sm font-medium cursor-pointer">
                  Planning actif
                </label>
              </div>
            </div>

            <DialogFooter>
              <div className="flex justify-between w-full">
                <div>
                  {editingPlanning && (
                    <Button variant="destructive" onClick={handleDeletePlanning}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Supprimer
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleSavePlanning}>
                    <Save className="mr-2 h-4 w-4" />
                    Enregistrer
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
