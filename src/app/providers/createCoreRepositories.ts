import { isSupabaseDataMode, requireSupabaseEnv } from '../../config/dataMode';
import type { LeadRepository } from '../../repositories/interfaces/LeadRepository';
import type { ProductRepository } from '../../repositories/interfaces/ProductRepository';
import type { TariffRepository } from '../../repositories/interfaces/TariffRepository';
import type { UserRepository } from '../../repositories/interfaces/UserRepository';
import { LocalLeadRepository } from '../../repositories/local/LocalLeadRepository';
import { LocalProductRepository } from '../../repositories/local/LocalProductRepository';
import { LocalTariffRepository } from '../../repositories/local/LocalTariffRepository';
import { LocalUserRepository } from '../../repositories/local/LocalUserRepository';
import { SupabaseLeadRepository } from '../../repositories/supabase/SupabaseLeadRepository';
import { SupabaseProductRepository } from '../../repositories/supabase/SupabaseProductRepository';
import { SupabaseTariffRepository } from '../../repositories/supabase/SupabaseTariffRepository';
import { SupabaseUserRepository } from '../../repositories/supabase/SupabaseUserRepository';

export interface CoreRepositories {
  userRepository: UserRepository;
  leadRepository: LeadRepository;
  tariffRepository: TariffRepository;
  productRepository: ProductRepository;
}

export function createCoreRepositories(): CoreRepositories {
  if (isSupabaseDataMode()) {
    requireSupabaseEnv();
    return {
      userRepository: new SupabaseUserRepository(),
      leadRepository: new SupabaseLeadRepository(),
      tariffRepository: new SupabaseTariffRepository(),
      productRepository: new SupabaseProductRepository(),
    };
  }

  return {
    userRepository: new LocalUserRepository(),
    leadRepository: new LocalLeadRepository(),
    tariffRepository: new LocalTariffRepository(),
    productRepository: new LocalProductRepository(),
  };
}
