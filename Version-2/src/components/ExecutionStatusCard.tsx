import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { executionApi, ExecutionStatus, RecentExecution } from '@/lib/execution-api';
import { Play, Loader2, CheckCircle, Clock } from 'lucide-react';

interface Props {
  restaurantId?: string;
}

export function ExecutionStatusCard({ restaurantId }: Props) {
  const [status, setStatus] = useState<ExecutionStatus | null>(null);
  const [recentExecutions, setRecentExecutions] = useState<RecentExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualCount, setManualCount] = useState(10);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadStatus = async () => {
    try {
      const data = await executionApi.getStatus();
      setStatus(data);
      
      // Load recent executions if running
      if (data.isRunning || !status?.isRunning) {
        const recent = await executionApi.getRecent(data.restaurantId, 5);
        setRecentExecutions(recent);
      }
    } catch (error) {
      console.error('Error loading status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartManual = async () => {
    if (!restaurantId) {
      alert('Veuillez sélectionner un restaurant');
      return;
    }

    if (status?.isRunning) {
      alert('Une exécution est déjà en cours');
      return;
    }

    try {
      setStarting(true);
      await executionApi.startManual(restaurantId, manualCount);
      alert(`Exécution de ${manualCount} scénarios lancée`);
      loadStatus();
    } catch (error: any) {
      console.error('Error starting execution:', error);
      alert(error.response?.data?.error || 'Erreur lors du lancement');
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>🚀 État d'exécution</span>
          {status?.isRunning && (
            <span className="flex items-center text-sm font-normal text-green-600">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              En cours
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Surveillance de l'exécution automatique des scénarios
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status?.isRunning ? (
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Restaurant:</span>
                <span className="font-medium">
                  {status.restaurant ? `${status.restaurant.name} (#${status.restaurant.code})` : status.restaurantId?.slice(0, 8) + '...'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Démarré:</span>
                <span className="font-medium">
                  {status.startedAt && new Date(status.startedAt).toLocaleString('fr-FR')}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progression:</span>
                <span className="font-medium">
                  {status.completed}/{status.totalScenarios} ({status.progress}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${status.progress}%` }}
                ></div>
              </div>
            </div>

            {/* Recent scenarios during execution */}
            {recentExecutions.length > 0 && (
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Scénarios récents</span>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {recentExecutions.map((exec) => (
                    <div
                      key={exec.id}
                      className={`flex items-start justify-between text-xs p-2 rounded border ${
                        exec.success 
                          ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950' 
                          : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950'
                      }`}
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          {exec.success ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <Loader2 className="h-3 w-3 text-red-600" />
                          )}
                          <span className="font-medium">
                            {exec.location} • {exec.consumptionType}
                          </span>
                        </div>
                        <div className="text-muted-foreground ml-5">
                          {exec.pickupLocation} • Note: {exec.rating}/5
                          {exec.durationMs && ` • ${Math.round(exec.durationMs / 1000)}s`}
                        </div>
                        <div className="text-muted-foreground ml-5">
                          {new Date(exec.executedAt).toLocaleTimeString('fr-FR')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-center py-4 text-muted-foreground">
              <CheckCircle className="h-5 w-5 mr-2" />
              <span>Aucune exécution en cours</span>
            </div>

            {/* Show recent executions even when not running */}
            {recentExecutions.length > 0 && (
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Derniers scénarios exécutés</span>
                </div>
                <div className="space-y-2">
                  {recentExecutions.slice(0, 3).map((exec) => (
                    <div
                      key={exec.id}
                      className="flex items-start justify-between text-xs p-2 rounded border"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          {exec.success ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <Loader2 className="h-3 w-3 text-red-600" />
                          )}
                          <span className="font-medium">
                            {exec.restaurant.name}
                          </span>
                        </div>
                        <div className="text-muted-foreground ml-5">
                          {exec.location} • {exec.consumptionType} • Note: {exec.rating}/5
                        </div>
                        <div className="text-muted-foreground ml-5">
                          {new Date(exec.executedAt).toLocaleString('fr-FR')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {restaurantId && (
              <div className="space-y-2 border-t pt-4">
                <label className="text-sm font-medium">Exécution manuelle</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={manualCount}
                    onChange={(e) => setManualCount(Number(e.target.value))}
                    className="flex-1 px-3 py-2 border rounded-md text-sm"
                    placeholder="Nombre de scénarios"
                  />
                  <Button
                    onClick={handleStartManual}
                    disabled={starting}
                    size="sm"
                  >
                    {starting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Lancement...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Lancer
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Lancer une exécution manuelle pour ce restaurant
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
