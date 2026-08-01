import type { BestPayComparisonSession } from '../../domain/bestPayComparison/bestPayComparisonSession';

export interface BestPayComparisonRepository {
  getAll(): Promise<BestPayComparisonSession[]>;
  getById(id: string): Promise<BestPayComparisonSession | null>;
  save(session: BestPayComparisonSession): Promise<BestPayComparisonSession>;
  delete(id: string): Promise<void>;
  getActiveSessionId(userId: string): Promise<string | null>;
  setActiveSessionId(userId: string, sessionId: string | null): Promise<void>;
}
