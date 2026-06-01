import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { scenarioApi, restaurantApi } from '../lib/api';
import { CheckCircle, XCircle, Filter } from 'lucide-react';
import { Button } from '../components/ui/button';

export function LogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    restaurantId: '',
    success: '',
    startDate: '',
    endDate: '',
  });
  const [pagination, setPagination] = useState({
    limit: 50,
    offset: 0,
    total: 0,
  });

  useEffect(() => {
    loadRestaurants();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [filters, pagination.offset]);

  const loadRestaurants = async () => {
    try {
      const response = await restaurantApi.getAll();
      setRestaurants(response.data);
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = {
        ...filters,
        limit: pagination.limit,
        offset: pagination.offset,
      };
      
      // Remove empty filters
      Object.keys(params).forEach((key) => {
        if (params[key as keyof typeof params] === '') {
          delete params[key as keyof typeof params];
        }
      });

      const response = await scenarioApi.getAll(params);
      setLogs(response.data.logs);
      setPagination((prev) => ({ ...prev, total: response.data.total }));
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters({ ...filters, [field]: value });
    setPagination((prev) => ({ ...prev, offset: 0 }));
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Logs des scénarios</h1>
          <p className="text-muted-foreground mt-2">
            Historique de tous les scénarios exécutés
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtres
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Restaurant</label>
                <select
                  className="w-full p-2 border rounded-md"
                  value={filters.restaurantId}
                  onChange={(e) => handleFilterChange('restaurantId', e.target.value)}
                >
                  <option value="">Tous</option>
                  {restaurants.map((restaurant) => (
                    <option key={restaurant.id} value={restaurant.id}>
                      {restaurant.code} - {restaurant.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Statut</label>
                <select
                  className="w-full p-2 border rounded-md"
                  value={filters.success}
                  onChange={(e) => handleFilterChange('success', e.target.value)}
                >
                  <option value="">Tous</option>
                  <option value="true">Succès</option>
                  <option value="false">Échec</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Date début</label>
                <input
                  type="date"
                  className="w-full p-2 border rounded-md"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Date fin</label>
                <input
                  type="date"
                  className="w-full p-2 border rounded-md"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs table */}
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : logs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucun log trouvé
              </p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Restaurant</TableHead>
                      <TableHead>Lieu</TableHead>
                      <TableHead>Consommation</TableHead>
                      <TableHead>Récupération</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {formatDate(log.executedAt)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{log.restaurant.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {log.restaurant.code}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{log.location}</TableCell>
                        <TableCell className="text-sm">
                          {log.consumptionType}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.pickupLocation}
                        </TableCell>
                        <TableCell>
                          {log.rating ? (
                            <span className="text-sm">{log.rating}/5</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.success ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-sm">Succès</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-red-600">
                              <XCircle className="h-4 w-4" />
                              <span className="text-sm">Échec</span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Affichage de {pagination.offset + 1} à{' '}
                    {Math.min(pagination.offset + pagination.limit, pagination.total)}{' '}
                    sur {pagination.total} résultats
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.offset === 0}
                      onClick={() =>
                        setPagination((prev) => ({
                          ...prev,
                          offset: Math.max(0, prev.offset - prev.limit),
                        }))
                      }
                    >
                      Précédent
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        pagination.offset + pagination.limit >= pagination.total
                      }
                      onClick={() =>
                        setPagination((prev) => ({
                          ...prev,
                          offset: prev.offset + prev.limit,
                        }))
                      }
                    >
                      Suivant
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
