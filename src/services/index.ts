import type { LeadDraftRepository } from '../repositories/interfaces/LeadDraftRepository';
import type { LeadEditDraftRepository } from '../repositories/interfaces/LeadEditDraftRepository';
import type { LeadRepository } from '../repositories/interfaces/LeadRepository';
import type { TariffRepository } from '../repositories/interfaces/TariffRepository';
import type { UserRepository } from '../repositories/interfaces/UserRepository';
import { LeadDraftService } from './leadDraftService';
import { LeadEditDraftService } from './leadEditDraftService';
import { LeadService } from './leadService';
import { TariffService } from './tariffService';
import { UserService } from './userService';

export interface AppServices {
  userService: UserService;
  leadService: LeadService;
  leadDraftService: LeadDraftService;
  leadEditDraftService: LeadEditDraftService;
  tariffService: TariffService;
}

export interface AppRepositories {
  userRepository: UserRepository;
  leadRepository: LeadRepository;
  leadDraftRepository: LeadDraftRepository;
  leadEditDraftRepository: LeadEditDraftRepository;
  tariffRepository: TariffRepository;
}

export function createServices(repositories: AppRepositories): AppServices {
  return {
    userService: new UserService(repositories.userRepository),
    leadService: new LeadService(repositories.leadRepository),
    leadDraftService: new LeadDraftService(repositories.leadDraftRepository),
    leadEditDraftService: new LeadEditDraftService(repositories.leadEditDraftRepository),
    tariffService: new TariffService(repositories.tariffRepository),
  };
}
