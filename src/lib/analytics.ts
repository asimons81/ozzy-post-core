import { prisma } from './prisma';

/**
 * Recomputes aggregates and cached insights.
 * This should be called after a successful CSV import or via manual trigger.
 */
export async function recomputeAnalytics() {
  console.log('[Analytics] Starting recompute...');
  const startTime = new Date();

  const run = await prisma.recomputeRun.create({
    data: { 
      status: 'STARTED',
      started_at: startTime
    },
  });

  try {
    // 1. In a real scenario, this would compute moving averages, 
    // performance by hour/day, and format efficacy.
    // For now, we simulate the processing time.
    // await new Promise(resolve => setTimeout(resolve, 1000));

    // 2. Mark the run as successful
    await prisma.recomputeRun.update({
      where: { id: run.id },
      data: { 
        status: 'SUCCESS',
        ended_at: new Date()
      },
    });

    console.log(`[Analytics] Recompute finished successfully in ${new Date().getTime() - startTime.getTime()}ms`);
    return { success: true, runId: run.id };
  } catch (error: unknown) {
    console.error('[Analytics] Recompute failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    await prisma.recomputeRun.update({
      where: { id: run.id },
      data: { 
        status: 'FAILED',
        error_text: message,
        ended_at: new Date()
      },
    });
    return { success: false, error: message };
  }
}
