import { PrismaClient } from '@prisma/client';
import { generateScenarios, executeScenarios } from './scenario-executor.js';

const prisma = new PrismaClient();

interface ExecutionState {
  isRunning: boolean;
  restaurantId?: string;
  startedAt?: Date;
  totalScenarios?: number;
  completed?: number;
}

const executionState: ExecutionState = {
  isRunning: false
};

/**
 * Check if a planning is currently active
 */
function isPlanningActive(planning: any): boolean {
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
}

/**
 * Calculate number of scenarios to execute based on planning duration
 */
function calculateScenariosCount(planning: any): number {
  // Random count between min and max
  const min = planning.minScenarios;
  const max = planning.maxScenarios;
  
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate random execution times within the planning window
 */
function generateExecutionTimes(planning: any, count: number): Date[] {
  const now = new Date();
  const [startHour, startMin] = planning.startTime.split(':').map(Number);
  const [endHour, endMin] = planning.endTime.split(':').map(Number);
  
  const startDate = new Date(now);
  startDate.setHours(startHour, startMin, 0, 0);
  
  const endDate = new Date(now);
  endDate.setHours(endHour, endMin, 0, 0);
  
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();
  const duration = endTime - startTime;
  
  const times: Date[] = [];
  for (let i = 0; i < count; i++) {
    const randomTime = startTime + Math.random() * duration;
    times.push(new Date(randomTime));
  }
  
  // Sort by time
  return times.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Execute scenarios for an active planning
 */
async function executePlanning(planning: any): Promise<void> {
  if (executionState.isRunning) {
    console.log('⚠️  Execution already in progress, skipping...');
    return;
  }
  
  try {
    executionState.isRunning = true;
    executionState.restaurantId = planning.restaurantId;
    executionState.startedAt = new Date();
    
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: planning.restaurantId },
      include: { config: true }
    });
    
    if (!restaurant || !restaurant.config) {
      console.error('❌ Restaurant or config not found');
      return;
    }
    
    // Calculate number of scenarios to execute
    const count = calculateScenariosCount(planning);
    executionState.totalScenarios = count;
    executionState.completed = 0;
    
    console.log(`\n🎯 Planning active for restaurant ${restaurant.code}`);
    console.log(`📊 Will execute ${count} scenarios between ${planning.startTime} and ${planning.endTime}`);
    
    // Generate scenarios
    const scenarios = await generateScenarios(planning.restaurantId, count);
    
    // Generate execution times
    const executionTimes = generateExecutionTimes(planning, count);
    
    // Execute scenarios at scheduled times
    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i];
      const scheduledTime = executionTimes[i];
      const now = Date.now();
      const delay = scheduledTime.getTime() - now;
      
      if (delay > 0) {
        console.log(`⏰ Scenario ${i + 1}/${count} scheduled for ${scheduledTime.toLocaleTimeString('fr-FR')}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      console.log(`\n🚀 Executing scenario ${i + 1}/${count}...`);
      
      // Execute with concurrency control
      const results = await executeScenarios([scenario], restaurant.config.concurrency);
      const result = results[0];
      
      // Save to database
      await prisma.scenarioLog.create({
        data: {
          restaurantId: scenario.restaurantId,
          location: scenario.location,
          consumptionType: scenario.consumptionType,
          pickupLocation: scenario.pickupLocation,
          age: scenario.age,
          rating: scenario.rating,
          detailedNotes: JSON.stringify(scenario.detailedNotes),
          exactOrder: scenario.exactOrder,
          problemEncountered: scenario.problemEncountered,
          success: result.success,
          error: result.error,
          durationMs: result.durationMs,
          scheduledDate: scheduledTime,
          executedAt: new Date()
        }
      });
      
      executionState.completed = i + 1;
      
      console.log(`✅ Scenario ${i + 1}/${count} completed and saved`);
    }
    
    console.log(`\n🎉 All ${count} scenarios completed for planning!`);
    
  } catch (error: any) {
    console.error('❌ Error executing planning:', error.message);
  } finally {
    executionState.isRunning = false;
    executionState.restaurantId = undefined;
    executionState.startedAt = undefined;
    executionState.totalScenarios = undefined;
    executionState.completed = undefined;
  }
}

/**
 * Check all plannings and execute active ones
 */
export async function checkPlannings(): Promise<void> {
  try {
    // Get all active plannings
    const plannings = await prisma.planning.findMany({
      where: { active: true },
      include: {
        restaurant: {
          include: {
            config: true
          }
        }
      }
    });
    
    // Check each planning
    for (const planning of plannings) {
      if (isPlanningActive(planning)) {
        console.log(`\n✅ Active planning found: ${planning.restaurant.name} (${planning.dayOfWeek} ${planning.startTime}-${planning.endTime})`);
        
        // Check if we already executed the FULL batch for THIS specific time slot today
        const now = new Date();
        const [startHour, startMin] = planning.startTime.split(':').map(Number);
        const [endHour, endMin] = planning.endTime.split(':').map(Number);
        
        const slotStart = new Date(now);
        slotStart.setHours(startHour, startMin, 0, 0);
        
        const slotEnd = new Date(now);
        slotEnd.setHours(endHour, endMin, 0, 0);
        
        const existingLogs = await prisma.scenarioLog.findMany({
          where: {
            restaurantId: planning.restaurantId,
            scheduledDate: {
              gte: slotStart,
              lte: slotEnd
            }
          }
        });
        
        const expectedCount = planning.minScenarios; // Minimum expected
        
        if (existingLogs.length < expectedCount) {
          console.log(`🚀 Starting execution for this time slot (${existingLogs.length}/${expectedCount} scenarios executed)...`);
          await executePlanning(planning);
        } else {
          console.log(`⏭️  Already executed ${existingLogs.length} scenarios for this time slot (minimum ${expectedCount})`);
        }
      }
    }
  } catch (error: any) {
    console.error('❌ Error checking plannings:', error.message);
  }
}

/**
 * Start the scheduler (check every minute)
 */
export function startScheduler(): void {
  console.log('🔄 Scheduler started - checking plannings every minute...');
  
  // Initial check
  checkPlannings();
  
  // Check every minute
  setInterval(() => {
    checkPlannings();
  }, 60 * 1000); // 60 seconds
}

/**
 * Get current execution state
 */
export function getExecutionState(): ExecutionState {
  return { ...executionState };
}

/**
 * Manual execution for a specific restaurant (bypass planning)
 */
export async function manualExecution(
  restaurantId: string,
  count: number
): Promise<void> {
  if (executionState.isRunning) {
    throw new Error('Execution already in progress');
  }
  
  try {
    executionState.isRunning = true;
    executionState.restaurantId = restaurantId;
    executionState.startedAt = new Date();
    executionState.totalScenarios = count;
    executionState.completed = 0;
    
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: { config: true }
    });
    
    if (!restaurant || !restaurant.config) {
      throw new Error('Restaurant or config not found');
    }
    
    console.log(`\n🚀 Manual execution for restaurant ${restaurant.code}`);
    console.log(`📊 Executing ${count} scenarios...`);
    
    // Generate scenarios
    const scenarios = await generateScenarios(restaurantId, count);
    
    // Execute all scenarios
    const results = await executeScenarios(scenarios, restaurant.config.concurrency);
    
    // Save all results to database
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const scenario = scenarios[i];
      
      await prisma.scenarioLog.create({
        data: {
          restaurantId: scenario.restaurantId,
          location: scenario.location,
          consumptionType: scenario.consumptionType,
          pickupLocation: scenario.pickupLocation,
          age: scenario.age,
          rating: scenario.rating,
          detailedNotes: JSON.stringify(scenario.detailedNotes),
          exactOrder: scenario.exactOrder,
          problemEncountered: scenario.problemEncountered,
          success: result.success,
          error: result.error,
          durationMs: result.durationMs,
          executedAt: new Date()
        }
      });
      
      executionState.completed = i + 1;
    }
    
    console.log(`\n🎉 Manual execution completed!`);
    
  } finally {
    executionState.isRunning = false;
    executionState.restaurantId = undefined;
    executionState.startedAt = undefined;
    executionState.totalScenarios = undefined;
    executionState.completed = undefined;
  }
}
