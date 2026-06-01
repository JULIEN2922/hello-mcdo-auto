import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { ExecutionStatusCard } from '../components/ExecutionStatusCard';
import { restaurantApi, scenarioApi } from '../lib/api';
import { Activity, Store, CheckCircle, XCircle } from 'lucide-react';

export function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, restaurantsRes] = await Promise.all([
        scenarioApi.getStats(),
        restaurantApi.getAll(),
      ]);
      setStats(statsRes.data);
      setRestaurants(restaurantsRes.data);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Tableau de bord</h1>
          <p className="text-muted-foreground mt-2">
            Vue d'ensemble de vos scénarios et restaurants
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total Scénarios
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Tous les scénarios exécutés
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Taux de succès
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.successRate || 0}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.successful || 0} réussis sur {stats?.total || 0}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Échecs</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.failed || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Scénarios en erreur
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Restaurants
              </CardTitle>
              <Store className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{restaurants.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Restaurants actifs
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Execution Status */}
        <ExecutionStatusCard />

        {/* Recent Restaurants */}
        <Card>
          <CardHeader>
            <CardTitle>Restaurants récents</CardTitle>
            <CardDescription>Liste des restaurants disponibles</CardDescription>
          </CardHeader>
          <CardContent>
            {restaurants.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucun restaurant disponible
              </p>
            ) : (
              <div className="space-y-3">
                {restaurants.slice(0, 5).map((restaurant) => (
                  <div
                    key={restaurant.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{restaurant.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Code: {restaurant.code}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p>{restaurant._count.plannings} plannings</p>
                      <p className="text-muted-foreground">
                        {restaurant._count.logs} logs
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
