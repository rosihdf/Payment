import type { User } from '../../domain/user/user';
import { getSupabaseClient } from '../../lib/supabaseClient';
import type { UserRepository } from '../interfaces/UserRepository';
import { profileRowToUser, userToProfileRow, type ProfileRow } from './mapProfile';

export class SupabaseUserRepository implements UserRepository {
  async getAll(): Promise<User[]> {
    const client = getSupabaseClient();
    const { data, error } = await client.from('profiles').select('*').order('display_name');
    if (error) {
      throw new Error(`Profile laden fehlgeschlagen: ${error.message}`);
    }
    return (data as ProfileRow[]).map(profileRowToUser);
  }

  async getById(id: string): Promise<User | null> {
    const client = getSupabaseClient();
    const { data, error } = await client.from('profiles').select('*').eq('user_id', id).maybeSingle();
    if (error) {
      throw new Error(`Profil laden fehlgeschlagen: ${error.message}`);
    }
    return data ? profileRowToUser(data as ProfileRow) : null;
  }

  async getCurrentUser(): Promise<User | null> {
    const client = getSupabaseClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await client.auth.getUser();

    if (authError) {
      throw new Error(`Auth-Sitzung prüfen fehlgeschlagen: ${authError.message}`);
    }
    if (!authUser) {
      return null;
    }

    const { data: activated, error: rpcError } = await client.rpc('mark_profile_active_on_login');
    if (!rpcError && activated) {
      const user = profileRowToUser(activated as ProfileRow);
      if (user.status !== 'active') {
        throw new Error('Zugriff verweigert: das Profil ist deaktiviert.');
      }
      return user;
    }

    const profile = await this.getById(authUser.id);
    if (!profile) {
      throw new Error(
        'Zugriff verweigert: für die Anmeldung existiert kein Profil (profiles).',
      );
    }
    if (profile.status === 'invited') {
      // RPC fehlt ggf. noch – Einladung muss erst Passwort setzen
      throw new Error(
        'Zugriff verweigert: Einladung noch nicht abgeschlossen. Bitte Passwort über den Einladungslink setzen.',
      );
    }
    if (profile.status !== 'active') {
      throw new Error('Zugriff verweigert: das Profil ist deaktiviert.');
    }
    return profile;
  }

  async setCurrentUser(id: string): Promise<User | null> {
    const current = await this.getCurrentUser();
    if (!current) {
      throw new Error(
        'Supabase-Auth: kein angemeldeter Benutzer. Demo-Benutzerwechsel ist im Supabase-Modus deaktiviert.',
      );
    }
    if (current.id !== id) {
      throw new Error(
        'Supabase-Auth: Benutzerwechsel nur über Anmeldung. Kein stiller LocalStorage-Fallback.',
      );
    }
    return current;
  }

  async save(user: User): Promise<User> {
    const client = getSupabaseClient();
    const row = userToProfileRow(user);
    const { data, error } = await client
      .from('profiles')
      .upsert(row, { onConflict: 'user_id' })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Profil speichern fehlgeschlagen: ${error.message}`);
    }
    return profileRowToUser(data as ProfileRow);
  }

  async saveAll(users: User[]): Promise<User[]> {
    const client = getSupabaseClient();
    const rows = users.map(userToProfileRow);
    const { data, error } = await client
      .from('profiles')
      .upsert(rows, { onConflict: 'user_id' })
      .select('*');

    if (error) {
      throw new Error(`Profile speichern fehlgeschlagen: ${error.message}`);
    }
    return (data as ProfileRow[]).map(profileRowToUser);
  }
}
