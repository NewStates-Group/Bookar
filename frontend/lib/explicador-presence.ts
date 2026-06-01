export interface ExplicadorParticipant {
  connectionId: string;
  name: string;
  isOwner: boolean;
  hasAudio: boolean;
  avatar?: string | null;
  userId?: number | null;
  isMicOn?: boolean;
  isListening?: boolean;
}

export function mapServerMembersToParticipants(
  members: Array<{
    connection_id?: string;
    name?: string;
    is_owner?: boolean;
    is_mic_on?: boolean;
    avatar?: string | null;
    user_id?: number | null;
    is_listening?: boolean;
  }> | null | undefined,
  selfConnectionId: string | null
): ExplicadorParticipant[] {
  const seen = new Set<string>();
  return (members || [])
    .filter((m) => m.connection_id && m.connection_id !== selfConnectionId)
    .filter((m) => {
      const id = m.connection_id!;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((m) => ({
      connectionId: m.connection_id!,
      name: m.name || "Visitante",
      isOwner: Boolean(m.is_owner),
      hasAudio: Boolean(m.is_mic_on),
      avatar: m.avatar ?? null,
      userId: m.user_id ?? null,
      isMicOn: Boolean(m.is_mic_on),
      isListening: m.is_listening !== false,
    }));
}
