import type { User } from '../domain/user/user';
import { getSupabaseClient } from '../lib/supabaseClient';
import { profileRowToUser, type ProfileRow } from '../repositories/supabase/mapProfile';

export interface SignInResult {
  user: User;
}

export class ProfileActivationError extends Error {
  readonly code:
    | 'session_invalid'
    | 'profile_missing'
    | 'profile_denied'
    | 'profile_deactivated'
    | 'activation_failed'
    | 'role_invalid';

  constructor(
    code: ProfileActivationError['code'],
    message: string,
  ) {
    super(message);
    this.name = 'ProfileActivationError';
    this.code = code;
  }
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
    const {
      data: { user: authUser },
      error: authError,
    } = await client.auth.getUser();

    if (authError || !authUser) {
      throw new ProfileActivationError(
        'session_invalid',
        'Sitzung ungültig oder abgelaufen. Bitte Einladungslink erneut öffnen.',
      );
    }

    const invitedProfile = await this.loadOwnProfile(authUser.id);
    if (!invitedProfile) {
      throw new ProfileActivationError(
        'profile_missing',
        'Für Ihre Anmeldung existiert kein Profil. Bitte den Administrator kontaktieren.',
      );
    }
    if (invitedProfile.status === 'deactivated') {
      throw new ProfileActivationError(
        'profile_deactivated',
        'Ihr Benutzerkonto ist deaktiviert. Bitte den Administrator kontaktieren.',
      );
    }
    if (invitedProfile.role !== 'admin' && invitedProfile.role !== 'field_service') {
      throw new ProfileActivationError(
        'role_invalid',
        'Ihr Profil hat keine zulässige Rolle. Bitte den Administrator kontaktieren.',
      );
    }

    const { error: passwordError } = await client.auth.updateUser({ password });
    if (passwordError) {
      throw new Error(
        'Passwort konnte nicht gesetzt werden. Link prüfen oder erneut einladen lassen.',
      );
    }

    const profile = await this.activateProfileOnLogin();
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
    try {
      return await this.activateProfileOnLogin();
    } catch (error) {
      if (error instanceof ProfileActivationError && error.code === 'profile_deactivated') {
        return null;
      }
      if (error instanceof ProfileActivationError) {
        throw error;
      }
    }

    const client = getSupabaseClient();
    const {
      data: { user: authUser },
    } = await client.auth.getUser();
    if (!authUser) {
      return null;
    }
    return this.loadActiveProfile(authUser.id);
  }

  private async loadOwnProfile(userId: string): Promise<User | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      const denied =
        error.code === '42501' ||
        error.message.toLowerCase().includes('permission') ||
        error.message.toLowerCase().includes('row-level');
      throw new ProfileActivationError(
        denied ? 'profile_denied' : 'profile_missing',
        denied
          ? 'Profil konnte nicht gelesen werden (Zugriff verweigert). Bitte den Administrator kontaktieren.'
          : 'Profil laden fehlgeschlagen.',
      );
    }
    if (!data) {
      return null;
    }
    return profileRowToUser(data as ProfileRow);
  }

  private async activateProfileOnLogin(): Promise<User> {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('mark_profile_active_on_login');

    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes('profile not available')) {
        throw new ProfileActivationError(
          'profile_missing',
          'Profilaktivierung fehlgeschlagen: kein gültiges Profil gefunden.',
        );
      }
      if (message.includes('not authenticated')) {
        throw new ProfileActivationError(
          'session_invalid',
          'Sitzung ungültig oder abgelaufen. Bitte erneut anmelden.',
        );
      }
      throw new ProfileActivationError(
        'activation_failed',
        'Profilaktivierung fehlgeschlagen. Bitte erneut anmelden oder den Administrator kontaktieren.',
      );
    }

    if (!data) {
      throw new ProfileActivationError(
        'activation_failed',
        'Profilaktivierung fehlgeschlagen. Bitte erneut anmelden.',
      );
    }

    const user = profileRowToUser(data as ProfileRow);
    if (user.role !== 'admin' && user.role !== 'field_service') {
      throw new ProfileActivationError(
        'role_invalid',
        'Ihr Profil hat keine zulässige Rolle. Bitte den Administrator kontaktieren.',
      );
    }
    if (user.status === 'deactivated') {
      throw new ProfileActivationError(
        'profile_deactivated',
        'Ihr Benutzerkonto ist deaktiviert. Bitte den Administrator kontaktieren.',
      );
    }
    if (user.status !== 'active') {
      throw new ProfileActivationError(
        'activation_failed',
        'Profilaktivierung unvollständig. Bitte erneut anmelden.',
      );
    }
    return user;
  }

  private async loadActiveProfile(userId: string): Promise<User | null> {
    const profile = await this.loadOwnProfile(userId);
    if (!profile) {
      return null;
    }
    if (profile.status !== 'active') {
      return null;
    }
    if (profile.role !== 'admin' && profile.role !== 'field_service') {
      return null;
    }
    return profile;
  }
}

export function createSupabaseAuthService(): SupabaseAuthService {
  return new SupabaseAuthService();
}
