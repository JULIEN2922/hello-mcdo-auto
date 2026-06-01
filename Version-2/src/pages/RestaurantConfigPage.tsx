import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { configApi } from '@/lib/api';
import api from '@/lib/api';
import { SCENARIO_DEFINITIONS, ScenarioType } from '@/types/scenarios';

interface RestaurantConfig {
  id: string;
  restaurantId: string;
  rating1Percent: number;
  rating2Percent: number;
  rating3Percent: number;
  rating4Percent: number;
  rating5Percent: number;
  age15_24Percent: number;
  age25_34Percent: number;
  age35_49Percent: number;
  age50PlusPercent: number;
  enabledScenarios: string[];
  scenarioVariants: Record<string, any>;
  exactOrderPercent: number;
  problemEncounteredPercent: number;
  concurrency: number;
  delayMinSeconds: number;
  delayMaxSeconds: number;
  headless: boolean;
  restaurant: {
    code: string;
    name: string;
  };
}

interface ConfigChangeLog {
  id: string;
  restaurantId: string;
  userId: string;
  changes: any;
  createdAt: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface ScenarioVariantConfig {
  enabled: boolean;
  consumption?: {
    surPlace?: { enabled: boolean; pickupLocations: { comptoir?: boolean; mccafe?: boolean; table?: boolean } };
    aEmporter?: { enabled: boolean; pickupLocations: { comptoir?: boolean; mccafe?: boolean; drive?: boolean } };
  };
  pickup?: { comptoir?: boolean; drive?: boolean; guichetExterieur?: boolean; exterieur?: boolean };
  delivery?: { uberEats?: boolean; deliveroo?: boolean; justEat?: boolean; mcdoApp?: boolean };
}

const SCENARIO_TYPES: Array<{ value: ScenarioType; label: string; icon: string }> = [
  { value: 'BORNE', label: 'Borne de commande', icon: '🖥️' },
  { value: 'COMPTOIR', label: 'Comptoir', icon: '👤' },
  { value: 'DRIVE', label: 'Drive', icon: '🚗' },
  { value: 'GUICHET_EXTERIEUR', label: 'Guichet extérieur', icon: '🪟' },
  { value: 'MCCAFE', label: 'McCafé', icon: '☕' },
  { value: 'CLICK_COLLECT_APP', label: 'Click & Collect (App)', icon: '📱' },
  { value: 'CLICK_COLLECT_WEB', label: 'Click & Collect (Web)', icon: '🌐' },
  { value: 'LIVRAISON', label: 'Livraison', icon: '🛵' },
  { value: 'TABLETTE', label: 'Tablette employé', icon: '📲' }
];

export default function RestaurantConfigPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [config, setConfig] = useState<RestaurantConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ConfigChangeLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Rating states
  const [rating1, setRating1] = useState(0);
  const [rating2, setRating2] = useState(0);
  const [rating3, setRating3] = useState(10);
  const [rating4, setRating4] = useState(20);
  const [rating5, setRating5] = useState(70);

  // Age states
  const [age15_24, setAge15_24] = useState(10);
  const [age25_34, setAge25_34] = useState(50);
  const [age35_49, setAge35_49] = useState(30);
  const [age50Plus, setAge50Plus] = useState(10);

  // Scenario states
  const [enabledScenarios, setEnabledScenarios] = useState<string[]>([]);
  const [scenarioVariants, setScenarioVariants] = useState<Record<string, ScenarioVariantConfig>>({});
  const [exactOrderPercent, setExactOrderPercent] = useState(100);
  const [problemEncounteredPercent, setProblemEncounteredPercent] = useState(0);
  
  // Execution states
  const [concurrency, setConcurrency] = useState(1);
  const [delayMin, setDelayMin] = useState(2);
  const [delayMax, setDelayMax] = useState(30);
  const [headless, setHeadless] = useState(true);

  useEffect(() => {
    loadConfig();
  }, [id]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/restaurant-configs/${id}`);
      const data = response.data;
      
      setConfig(data);
      setRating1(data.rating1Percent);
      setRating2(data.rating2Percent);
      setRating3(data.rating3Percent);
      setRating4(data.rating4Percent);
      setRating5(data.rating5Percent);
      setAge15_24(data.age15_24Percent);
      setAge25_34(data.age25_34Percent);
      setAge35_49(data.age35_49Percent);
      setAge50Plus(data.age50PlusPercent);
      setEnabledScenarios(data.enabledScenarios);
      
      // Initialize variants for enabled scenarios if not present
      const initializedVariants = { ...(data.scenarioVariants || {}) };
      data.enabledScenarios.forEach((scenarioType: string) => {
        if (!initializedVariants[scenarioType]) {
          const def = SCENARIO_DEFINITIONS[scenarioType as ScenarioType];
          if (def) {
            const initialConfig: ScenarioVariantConfig = { enabled: true };
            
            if (def.hasConsumption) {
              initialConfig.consumption = {
                surPlace: { 
                  enabled: true, 
                  pickupLocations: { comptoir: true, mccafe: false, table: false } 
                },
                aEmporter: { 
                  enabled: true, 
                  pickupLocations: { comptoir: true, mccafe: false, drive: false } 
                }
              };
            }
            
            if (def.hasPickup) {
              initialConfig.pickup = {
                comptoir: true,
                drive: false,
                guichetExterieur: false,
                exterieur: false
              };
            }
            
            if (def.hasDelivery) {
              initialConfig.delivery = {
                uberEats: true,
                deliveroo: false,
                justEat: false,
                mcdoApp: false
              };
            }
            
            initializedVariants[scenarioType] = initialConfig;
          }
        }
      });
      
      setScenarioVariants(initializedVariants);
      setExactOrderPercent(data.exactOrderPercent);
      setProblemEncounteredPercent(data.problemEncounteredPercent || 0);
      setConcurrency(data.concurrency || 1);
      setDelayMin(data.delayMinSeconds || 2);
      setDelayMax(data.delayMaxSeconds || 30);
      setHeadless(data.headless ?? true);
    } catch (error) {
      console.error('Error loading config:', error);
      alert('Erreur lors du chargement de la configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const ratingTotal = rating1 + rating2 + rating3 + rating4 + rating5;
    if (ratingTotal !== 100) {
      alert('La somme des notes doit être égale à 100%');
      return;
    }

    const ageTotal = age15_24 + age25_34 + age35_49 + age50Plus;
    if (ageTotal !== 100) {
      alert('La somme des tranches d\'âge doit être égale à 100%');
      return;
    }

    try {
      setSaving(true);
      await api.put(`/restaurant-configs/${id}`, {
        rating1Percent: rating1,
        rating2Percent: rating2,
        rating3Percent: rating3,
        rating4Percent: rating4,
        rating5Percent: rating5,
        age15_24Percent: age15_24,
        age25_34Percent: age25_34,
        age35_49Percent: age35_49,
        age50PlusPercent: age50Plus,
        enabledScenarios,
        scenarioVariants,
        exactOrderPercent,
        problemEncounteredPercent,
        concurrency,
        delayMinSeconds: delayMin,
        delayMaxSeconds: delayMax,
        headless
      });
      alert('Configuration enregistrée avec succès');
      navigate('/restaurants'); // Redirect to restaurants list
    } catch (error: any) {
      console.error('Error saving config:', error);
      alert(error.response?.data?.error || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Êtes-vous sûr de vouloir réinitialiser la configuration aux valeurs par défaut ?')) {
      return;
    }

    try {
      setSaving(true);
      await api.post(`/restaurant-configs/${id}/reset`);
      await loadConfig();
      alert('Configuration réinitialisée');
    } catch (error) {
      console.error('Error resetting config:', error);
      alert('Erreur lors de la réinitialisation');
    } finally {
      setSaving(false);
    }
  };

  const loadHistory = async () => {
    if (!id) return;
    
    try {
      setLoadingHistory(true);
      const response = await configApi.getHistory(id);
      setHistory(response.data);
      setShowHistory(true);
    } catch (error) {
      console.error('Error loading history:', error);
      alert('Erreur lors du chargement de l\'historique');
    } finally {
      setLoadingHistory(false);
    }
  };

  const formatHistoryDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toggleScenario = (scenario: string) => {
    setEnabledScenarios(prev =>
      prev.includes(scenario)
        ? prev.filter(s => s !== scenario)
        : [...prev, scenario]
    );
    
    // Initialize variant config if not exists
    if (!scenarioVariants[scenario]) {
      const def = SCENARIO_DEFINITIONS[scenario as ScenarioType];
      const initialConfig: ScenarioVariantConfig = { enabled: true };
      
      if (def.hasConsumption) {
        initialConfig.consumption = {
          surPlace: { 
            enabled: true, 
            pickupLocations: { comptoir: true, mccafe: false, table: false } 
          },
          aEmporter: { 
            enabled: true, 
            pickupLocations: { comptoir: true, mccafe: false, drive: false } 
          }
        };
      }
      
      if (def.hasPickup) {
        initialConfig.pickup = {
          comptoir: true,
          drive: false,
          guichetExterieur: false,
          exterieur: false
        };
      }
      
      if (def.hasDelivery) {
        initialConfig.delivery = {
          uberEats: true,
          deliveroo: false,
          justEat: false,
          mcdoApp: false
        };
      }
      
      setScenarioVariants(prev => ({ ...prev, [scenario]: initialConfig }));
    }
  };

  const updateScenarioVariant = (scenario: string, path: string[], value: any) => {
    setScenarioVariants(prev => {
      const updated = { ...prev };
      if (!updated[scenario]) updated[scenario] = { enabled: true };
      
      let current: any = updated[scenario];
      for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) current[path[i]] = {};
        current = current[path[i]];
      }
      current[path[path.length - 1]] = value;
      
      return updated;
    });
  };

  const ratingTotal = rating1 + rating2 + rating3 + rating4 + rating5;
  const ageTotal = age15_24 + age25_34 + age35_49 + age50Plus;

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Configuration du restaurant</h1>
          <p className="text-muted-foreground">
            {config?.restaurant.name} (#{config?.restaurant.code})
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadHistory} disabled={loadingHistory}>
            📊 Historique
          </Button>
          <Button variant="outline" onClick={() => navigate('/restaurants')}>
            ← Retour
          </Button>
        </div>
      </div>

      {/* Distribution des notes */}
      <Card>
        <CardHeader>
          <CardTitle>⭐ Distribution des notes</CardTitle>
          <CardDescription>
            Définissez le pourcentage de chaque type d'avis. Total: {ratingTotal}%
            {ratingTotal !== 100 && <span className="text-destructive ml-2">(doit être 100%)</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: 'Très mauvais (1★)', value: rating1, setValue: setRating1 },
            { label: 'Mauvais (2★)', value: rating2, setValue: setRating2 },
            { label: 'Moyen (3★)', value: rating3, setValue: setRating3 },
            { label: 'Bon (4★)', value: rating4, setValue: setRating4 },
            { label: 'Excellent (5★)', value: rating5, setValue: setRating5 }
          ].map((item, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{item.label}</label>
                <span className="text-sm font-semibold">{item.value}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={item.value}
                onChange={(e) => item.setValue(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Distribution des âges */}
      <Card>
        <CardHeader>
          <CardTitle>👥 Distribution des tranches d'âge</CardTitle>
          <CardDescription>
            Définissez le pourcentage de chaque tranche d'âge. Total: {ageTotal}%
            {ageTotal !== 100 && <span className="text-destructive ml-2">(doit être 100%)</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: 'Entre 15 et 24 ans', value: age15_24, setValue: setAge15_24 },
            { label: 'Entre 25 et 34 ans', value: age25_34, setValue: setAge25_34 },
            { label: 'Entre 35 et 49 ans', value: age35_49, setValue: setAge35_49 },
            { label: '50 ans et plus', value: age50Plus, setValue: setAge50Plus }
          ].map((item, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{item.label}</label>
                <span className="text-sm font-semibold">{item.value}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={item.value}
                onChange={(e) => item.setValue(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Types de scénarios */}
      <Card>
        <CardHeader>
          <CardTitle>🎯 Types de scénarios activés</CardTitle>
          <CardDescription>
            Sélectionnez les types de commande à utiliser dans les scénarios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SCENARIO_TYPES.map((scenario) => (
              <label
                key={scenario.value}
                className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={enabledScenarios.includes(scenario.value)}
                  onChange={() => toggleScenario(scenario.value)}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">{scenario.icon} {scenario.label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Configuration détaillée des scénarios activés */}
      {enabledScenarios.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>⚙️ Configuration détaillée des scénarios</CardTitle>
            <CardDescription>
              Configurez les sous-types pour chaque scénario activé
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {enabledScenarios.map((scenarioType) => {
              const scenario = SCENARIO_TYPES.find(s => s.value === scenarioType);
              const def = SCENARIO_DEFINITIONS[scenarioType as ScenarioType];
              const variant = scenarioVariants[scenarioType] || {};
              
              if (!scenario) return null;
              
              return (
                <div key={scenarioType} className="border rounded-lg p-4 space-y-4">
                  <h3 className="font-semibold text-lg">{scenario.icon} {scenario.label}</h3>
                  
                  {/* Scénarios avec consommation (Borne, Comptoir, McCafé, Tablette) */}
                  {def.hasConsumption && (
                    <div className="space-y-4 pl-4 border-l-2">
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={variant.consumption?.surPlace?.enabled ?? true}
                            onChange={(e) => updateScenarioVariant(scenarioType, ['consumption', 'surPlace', 'enabled'], e.target.checked)}
                            className="w-4 h-4"
                          />
                          <span className="font-medium">🍽️ Sur place</span>
                        </label>
                        {variant.consumption?.surPlace?.enabled && (
                          <div className="pl-6 space-y-1 text-sm">
                            <p className="text-muted-foreground mb-2">Lieux de récupération :</p>
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={variant.consumption?.surPlace?.pickupLocations?.comptoir ?? true}
                                onChange={(e) => updateScenarioVariant(scenarioType, ['consumption', 'surPlace', 'pickupLocations', 'comptoir'], e.target.checked)}
                                className="w-3 h-3"
                              />
                              <span>Au comptoir</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={variant.consumption?.surPlace?.pickupLocations?.mccafe ?? false}
                                onChange={(e) => updateScenarioVariant(scenarioType, ['consumption', 'surPlace', 'pickupLocations', 'mccafe'], e.target.checked)}
                                className="w-3 h-3"
                              />
                              <span>Au McCafé</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={variant.consumption?.surPlace?.pickupLocations?.table ?? false}
                                onChange={(e) => updateScenarioVariant(scenarioType, ['consumption', 'surPlace', 'pickupLocations', 'table'], e.target.checked)}
                                className="w-3 h-3"
                              />
                              <span>En service à table</span>
                            </label>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={variant.consumption?.aEmporter?.enabled ?? true}
                            onChange={(e) => updateScenarioVariant(scenarioType, ['consumption', 'aEmporter', 'enabled'], e.target.checked)}
                            className="w-4 h-4"
                          />
                          <span className="font-medium">🥡 À emporter</span>
                        </label>
                        {variant.consumption?.aEmporter?.enabled && (
                          <div className="pl-6 space-y-1 text-sm">
                            <p className="text-muted-foreground mb-2">Lieux de récupération :</p>
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={variant.consumption?.aEmporter?.pickupLocations?.comptoir ?? true}
                                onChange={(e) => updateScenarioVariant(scenarioType, ['consumption', 'aEmporter', 'pickupLocations', 'comptoir'], e.target.checked)}
                                className="w-3 h-3"
                              />
                              <span>Au comptoir</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={variant.consumption?.aEmporter?.pickupLocations?.mccafe ?? false}
                                onChange={(e) => updateScenarioVariant(scenarioType, ['consumption', 'aEmporter', 'pickupLocations', 'mccafe'], e.target.checked)}
                                className="w-3 h-3"
                              />
                              <span>Au McCafé</span>
                            </label>
                            {scenarioType === 'TABLETTE' && (
                              <label className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={variant.consumption?.aEmporter?.pickupLocations?.drive ?? false}
                                  onChange={(e) => updateScenarioVariant(scenarioType, ['consumption', 'aEmporter', 'pickupLocations', 'drive'], e.target.checked)}
                                  className="w-3 h-3"
                                />
                                <span>Au drive</span>
                              </label>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Scénarios Click & Collect (lieux de récupération) */}
                  {def.hasPickup && (
                    <div className="space-y-2 pl-4 border-l-2">
                      <p className="font-medium">📍 Lieux de récupération :</p>
                      <div className="space-y-1 text-sm">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={variant.pickup?.comptoir ?? true}
                            onChange={(e) => updateScenarioVariant(scenarioType, ['pickup', 'comptoir'], e.target.checked)}
                            className="w-3 h-3"
                          />
                          <span>Au comptoir</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={variant.pickup?.drive ?? false}
                            onChange={(e) => updateScenarioVariant(scenarioType, ['pickup', 'drive'], e.target.checked)}
                            className="w-3 h-3"
                          />
                          <span>Au drive</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={variant.pickup?.guichetExterieur ?? false}
                            onChange={(e) => updateScenarioVariant(scenarioType, ['pickup', 'guichetExterieur'], e.target.checked)}
                            className="w-3 h-3"
                          />
                          <span>Au guichet extérieur</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={variant.pickup?.exterieur ?? false}
                            onChange={(e) => updateScenarioVariant(scenarioType, ['pickup', 'exterieur'], e.target.checked)}
                            className="w-3 h-3"
                          />
                          <span>À l'extérieur du restaurant</span>
                        </label>
                      </div>
                    </div>
                  )}
                  
                  {/* Scénarios Livraison (plateformes) */}
                  {def.hasDelivery && (
                    <div className="space-y-2 pl-4 border-l-2">
                      <p className="font-medium">🛵 Plateformes de livraison :</p>
                      <div className="space-y-1 text-sm">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={variant.delivery?.uberEats ?? true}
                            onChange={(e) => updateScenarioVariant(scenarioType, ['delivery', 'uberEats'], e.target.checked)}
                            className="w-3 h-3"
                          />
                          <span>Uber Eats</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={variant.delivery?.deliveroo ?? false}
                            onChange={(e) => updateScenarioVariant(scenarioType, ['delivery', 'deliveroo'], e.target.checked)}
                            className="w-3 h-3"
                          />
                          <span>Deliveroo</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={variant.delivery?.justEat ?? false}
                            onChange={(e) => updateScenarioVariant(scenarioType, ['delivery', 'justEat'], e.target.checked)}
                            className="w-3 h-3"
                          />
                          <span>Just Eat</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={variant.delivery?.mcdoApp ?? false}
                            onChange={(e) => updateScenarioVariant(scenarioType, ['delivery', 'mcdoApp'], e.target.checked)}
                            className="w-3 h-3"
                          />
                          <span>Application mobile McDo+</span>
                        </label>
                      </div>
                    </div>
                  )}
                  
                  {/* Scénarios simples (Drive, Guichet) */}
                  {!def.hasConsumption && !def.hasPickup && !def.hasDelivery && (
                    <p className="text-sm text-muted-foreground pl-4">✓ Ce scénario n'a pas d'options supplémentaires</p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Qualité de commande */}
      <Card>
        <CardHeader>
          <CardTitle>✓ Qualité de commande</CardTitle>
          <CardDescription>
            Configuration de la qualité des commandes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Commande exacte</label>
              <span className="text-sm font-semibold">{exactOrderPercent}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={exactOrderPercent}
              onChange={(e) => setExactOrderPercent(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Problème rencontré</label>
              <span className="text-sm font-semibold">{problemEncounteredPercent}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={problemEncounteredPercent}
              onChange={(e) => setProblemEncounteredPercent(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>
        </CardContent>
      </Card>

      {/* Paramètres d'exécution */}
      <Card>
        <CardHeader>
          <CardTitle>⚙️ Paramètres d'exécution</CardTitle>
          <CardDescription>
            Configuration de l'exécution automatique des scénarios
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Concurrence (parallèle)</label>
              <span className="text-sm font-semibold">{concurrency}</span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <p className="text-xs text-muted-foreground">
              Nombre de scénarios à exécuter en parallèle (1-20)
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Délai minimum (secondes)</label>
              <span className="text-sm font-semibold">{delayMin}s</span>
            </div>
            <input
              type="range"
              min="1"
              max="60"
              step="1"
              value={delayMin}
              onChange={(e) => setDelayMin(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <p className="text-xs text-muted-foreground">
              Temps d'attente minimum entre les actions (1-60s)
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Délai maximum (secondes)</label>
              <span className="text-sm font-semibold">{delayMax}s</span>
            </div>
            <input
              type="range"
              min="1"
              max="120"
              step="1"
              value={delayMax}
              onChange={(e) => setDelayMax(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <p className="text-xs text-muted-foreground">
              Temps d'attente maximum entre les actions (1-120s)
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="headless"
              checked={headless}
              onChange={(e) => setHeadless(e.target.checked)}
              className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary focus:ring-2"
            />
            <label htmlFor="headless" className="text-sm font-medium">
              Mode headless (sans interface visible)
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end space-x-4">
        <Button variant="outline" onClick={handleReset} disabled={saving}>
          Réinitialiser
        </Button>
        <Button onClick={handleSave} disabled={saving || ratingTotal !== 100 || ageTotal !== 100}>
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </div>

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowHistory(false)}>
          <div className="bg-background rounded-lg shadow-lg max-w-4xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Historique des modifications</h2>
                <Button variant="ghost" onClick={() => setShowHistory(false)}>✕</Button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {loadingHistory ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : history.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Aucune modification enregistrée
                </p>
              ) : (
                <div className="space-y-4">
                  {history.map((log) => (
                    <Card key={log.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base">
                              {log.user.firstName} {log.user.lastName}
                            </CardTitle>
                            <CardDescription>{log.user.email}</CardDescription>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {formatHistoryDate(log.createdAt)}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {log.changes.created ? (
                          <p className="text-sm text-muted-foreground">Configuration créée</p>
                        ) : (
                          <div className="space-y-2">
                            {Object.entries(log.changes).map(([key, value]: [string, any]) => (
                              <div key={key} className="text-sm">
                                <span className="font-medium">{key}</span>:{' '}
                                <span className="text-muted-foreground">
                                  {typeof value === 'object' && value.from !== undefined ? (
                                    <>
                                      {JSON.stringify(value.from)} → {JSON.stringify(value.to)}
                                    </>
                                  ) : (
                                    JSON.stringify(value)
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
