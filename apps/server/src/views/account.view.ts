import type { Profile } from '@vela/api';
import type { ProfileRow } from '../models/profile.model';
import type { SessionUser } from '../types';

export function profileView(row: ProfileRow | null, current: SessionUser, email: string | null, provider: Profile['provider']): Profile {
  return {
    name: row?.name ?? (current.name === 'Traveller' ? '' : current.name),
    email: row?.email ?? email,
    phone: row?.phone ?? current.phoneNumber,
    provider,
  };
}
