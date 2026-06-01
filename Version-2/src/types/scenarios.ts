// Types de scénarios complets basés sur la V1

export type ScenarioType = 
  | 'BORNE'
  | 'COMPTOIR'
  | 'DRIVE'
  | 'GUICHET_EXTERIEUR'
  | 'MCCAFE'
  | 'CLICK_COLLECT_APP'
  | 'CLICK_COLLECT_WEB'
  | 'LIVRAISON'
  | 'TABLETTE';

export type ConsumptionType = 'SUR_PLACE' | 'A_EMPORTER';

export type PickupLocation = 
  | 'COMPTOIR'
  | 'MCCAFE'
  | 'TABLE'
  | 'DRIVE'
  | 'GUICHET_EXTERIEUR'
  | 'EXTERIEUR';

export type DeliveryPlatform =
  | 'UBER_EATS'
  | 'DELIVEROO'
  | 'JUST_EAT'
  | 'MCDO_APP';

export interface ScenarioConfig {
  type: ScenarioType;
  label: string;
  enabled: boolean;
  percentage: number; // Pourcentage de ce scénario parmi tous les scénarios
  variants?: {
    consumptionTypes?: {
      surPlace?: {
        enabled: boolean;
        percentage: number;
        pickupLocations: {
          comptoir?: boolean;
          mccafe?: boolean;
          table?: boolean;
        };
      };
      aEmporter?: {
        enabled: boolean;
        percentage: number;
        pickupLocations: {
          comptoir?: boolean;
          mccafe?: boolean;
          drive?: boolean;
        };
      };
    };
    pickupLocations?: {
      comptoir?: boolean;
      drive?: boolean;
      guichetExterieur?: boolean;
      exterieur?: boolean;
    };
    deliveryPlatforms?: {
      uberEats?: boolean;
      deliveroo?: boolean;
      justEat?: boolean;
      mcdoApp?: boolean;
    };
  };
}

export const SCENARIO_DEFINITIONS: Record<ScenarioType, { label: string; hasConsumption: boolean; hasPickup: boolean; hasDelivery: boolean }> = {
  BORNE: {
    label: 'Borne de commande',
    hasConsumption: true,
    hasPickup: false,
    hasDelivery: false
  },
  COMPTOIR: {
    label: 'Comptoir',
    hasConsumption: true,
    hasPickup: false,
    hasDelivery: false
  },
  DRIVE: {
    label: 'Drive',
    hasConsumption: false,
    hasPickup: false,
    hasDelivery: false
  },
  GUICHET_EXTERIEUR: {
    label: 'Guichet extérieur',
    hasConsumption: false,
    hasPickup: false,
    hasDelivery: false
  },
  MCCAFE: {
    label: 'McCafé',
    hasConsumption: true,
    hasPickup: false,
    hasDelivery: false
  },
  CLICK_COLLECT_APP: {
    label: 'Click & Collect (App)',
    hasConsumption: false,
    hasPickup: true,
    hasDelivery: false
  },
  CLICK_COLLECT_WEB: {
    label: 'Click & Collect (Web)',
    hasConsumption: false,
    hasPickup: true,
    hasDelivery: false
  },
  LIVRAISON: {
    label: 'Livraison',
    hasConsumption: false,
    hasPickup: false,
    hasDelivery: true
  },
  TABLETTE: {
    label: 'Tablette employé',
    hasConsumption: true,
    hasPickup: false,
    hasDelivery: false
  }
};

export interface RestaurantConfigData {
  // Rating Distribution
  ratingDistribution: {
    rating1: number;
    rating2: number;
    rating3: number;
    rating4: number;
    rating5: number;
  };
  
  // Age Distribution
  ageDistribution: {
    age15_24: number;
    age25_34: number;
    age35_49: number;
    age50Plus: number;
  };
  
  // Scenario Configurations
  scenarios: ScenarioConfig[];
  
  // Order Quality
  exactOrderPercent: number;
}
