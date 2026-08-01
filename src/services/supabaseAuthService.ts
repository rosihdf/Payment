import type { User } from '../domain/user/user';
import { getSupabaseClient } from '../lib/supabaseClient';
import { profileRowToUser, type ProfileRow } from '../repositories/supabase/mapProfile';

export interface SignInResult {
  user: User;
}

/**
 * Supabase Auth für Rollen admin und field_service.
 * Nach Login: invited → active und last_access_at via RPC.
 */
export class SupabaseAuthService {
  async signInWithPassword(email: string, password: string): Promise<SignInResult> {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error('Anmeldung fehlgeschlagen. E-Mail oder Passwort prüfen.');
    }
    if (!data.user) {
      throw new Error('Anmeldung fehlgeschlagen: keine Benutzerdaten.');
    }

    const profile = await this.activateAndLoadProfile();
    if (!profile) {
      await client.auth.signOut();
      throw new Error(
        'Anmeldung abgelehnt: kein aktives Profil mit Rolle admin oder field_service.',
      );
    }

    return { user: profile };
  }

  async completeInvitePassword(password: string): Promise<SignInResult> {
    const client = getSupabaseClient();
    const { error } = await client.auth.updateUser({ password });
    if (error) {
      throw new Error('Passwort konnte nicht gesetzt werden. Link prüfen oder erneut einladen lassen.');
    }
    const profile = await this.activateAndLoadProfile();
    if (!profile) {
      throw new Error('Profil nach Einladung nicht verfügbar.');
    }
    return { user: profile };
  }

  async signOut(): Promise<void> {
    const client = getSupabaseClient();
    const { error } = await client.auth.signOut();
    if (error) {
      throw new Error('Abmeldung fehlgeschlagen.');
    }
  }

  async getSessionUser(): Promise<User | null> {
    const client = getSupabaseClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error) {
      throw new Error('Sitzung prüfen fehlgeschlagen.');
    }
    if (!user) {
      return null;
    }
    return this.activateAndLoadProfile();
  }

  /** invited → active + last_access_at; deaktivierte Profile bleiben gesperrt. */
  async activateAndLoadProfile(): Promise<User | null> {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('mark_profile_active_on_login');

    if (!error && data) {
      const user = profileRowToUser(data as ProfileRow);
      if (user.role !== 'admin' && user.role !== 'field_service') {
        return null;
      }
      if (user.status !== 'active') {
        return null;
      }
      return user;
    }

    // Fallback falls RPC noch nicht deployed: nur aktive Profile
    const {
      data: { user: authUser },
    } = await client.auth.getUser();
    if (!authUser) {
      return null;
    }
    return this.loadActiveProfile(authUser.id);
  }

  private async loadActiveProfile(userId: string): Promise<User | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error('Profil laden fehlgeschlagen.');
    }
    if (!data) {
      return null;
    }

    const user = profileRowToUser(data as ProfileRow);
    if (user.status !== 'active') {
      return null;
    }
    if (user.role !== 'admin' && user.role !== 'field_service') {
      return null;
    }
    return user;
  }
}

export function createSupabaseAuthService(): SupabaseAuthService {
  return new SupabaseAuthService();
}
