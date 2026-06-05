"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  mapServerMembersToParticipants,
  type ExplicadorParticipant,
} from "@/lib/explicador-presence";

export interface UseParticipantsOptions {
  connectionIdRef: React.MutableRefObject<string | null>;
  onParticipantsChanged: (participants: ExplicadorParticipant[]) => Promise<void> | void;
  onParticipantLeft: (peerId: string) => void;
}

export interface UseParticipantsReturn {
  participants: ExplicadorParticipant[];
  participantsRef: React.MutableRefObject<ExplicadorParticipant[]>;
  roomMemberCount: number;
  roomMemberCountRef: React.MutableRefObject<number>;
  isSoloRoom: boolean;
  isMultiUserRoom: boolean;
  syncPresenceFromServer: (
    members: unknown,
    selfId?: string | null
  ) => ExplicadorParticipant[];
  setRoomMemberCount: React.Dispatch<React.SetStateAction<number>>;
  updateParticipantAudioState: (
    connectionId: string,
    isMicOn: boolean,
    isListening: boolean
  ) => void;
}

export function useParticipants(options: UseParticipantsOptions): UseParticipantsReturn {
  const { connectionIdRef, onParticipantsChanged, onParticipantLeft } = options;

  const [participants, setParticipants] = useState<ExplicadorParticipant[]>([]);
  const [roomMemberCount, setRoomMemberCount] = useState(1);
  const participantsRef = useRef<ExplicadorParticipant[]>([]);
  const roomMemberCountRef = useRef(1);

  const isSoloRoom = roomMemberCount <= 1;
  const isMultiUserRoom = !isSoloRoom;

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  useEffect(() => {
    roomMemberCountRef.current = roomMemberCount;
  }, [roomMemberCount]);

  const updateParticipantAudioState = useCallback(
    (connectionId: string, isMicOn: boolean, isListening: boolean) => {
      setParticipants((prev) =>
        prev.map((p) =>
          p.connectionId === connectionId
            ? { ...p, isMicOn, isListening, hasAudio: isMicOn }
            : p
        )
      );
    },
    []
  );

  const syncPresenceFromServer = useCallback(
    (members: unknown, selfId?: string | null) => {
      const rawMembers = (members as { connection_id?: string }[] | null) || [];
      setRoomMemberCount(rawMembers.length);
      roomMemberCountRef.current = rawMembers.length;

      const previousIds = new Set(participantsRef.current.map((p) => p.connectionId));
      const list = mapServerMembersToParticipants(
        members as Parameters<typeof mapServerMembersToParticipants>[0],
        selfId ?? connectionIdRef.current
      );
      setParticipants(list);
      participantsRef.current = list;

      const nextIds = new Set(list.map((p) => p.connectionId));
      previousIds.forEach((id) => {
        if (!nextIds.has(id)) onParticipantLeft(id);
      });

      void onParticipantsChanged(list);
      return list;
    },
    [connectionIdRef, onParticipantsChanged, onParticipantLeft]
  );

  return {
    participants,
    participantsRef,
    roomMemberCount,
    roomMemberCountRef,
    isSoloRoom,
    isMultiUserRoom,
    syncPresenceFromServer,
    setRoomMemberCount,
    updateParticipantAudioState,
  };
}
