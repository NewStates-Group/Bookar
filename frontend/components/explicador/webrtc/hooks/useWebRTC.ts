"use client";

import { useCallback, useEffect, useRef } from "react";
import { SignalingService } from "../services/SignalingService";
import { PeerManager } from "../services/PeerManager";
import type { WebRTCSignal } from "../types/webrtc";
import type { SignalingSendFn } from "../types/signaling";
import { isImpolitePeer } from "../types/webrtc";

export interface UseWebRTCOptions {
  sendWSMessage: SignalingSendFn;
  connectionIdRef: React.MutableRefObject<string | null>;
  isMicMutedRef: React.MutableRefObject<boolean>;
  isForceMutedRef: React.MutableRefObject<boolean>;
}

export interface UseWebRTCReturn {
  localStreamRef: React.MutableRefObject<MediaStream | null>;
  peerManagerRef: React.MutableRefObject<PeerManager | null>;
  setLocalStream: React.Dispatch<React.SetStateAction<MediaStream | null>>;
  localStream: MediaStream | null;
  isMicMuted: boolean;
  setIsMicMuted: React.Dispatch<React.SetStateAction<boolean>>;
  acquireLocalStream: (opts?: { enabled?: boolean }) => Promise<MediaStream | null>;
  handleWebRTCSignal: (senderId: string, signal: WebRTCSignal) => Promise<void>;
  connectToPeer: (peerId: string) => Promise<void>;
  connectToAllPeers: (participantIds: string[]) => Promise<void>;
  syncPeersWithParticipants: (participantIds: string[]) => Promise<void>;
  cleanupPeer: (peerId: string) => void;
  closeAllPeers: () => void;
  debugRoomState: (participantIds: string[]) => void;
  broadcastAudioState: (isMicOn: boolean) => void;
  onRemoteMicOn: (peerId: string) => void;
}

export function useWebRTC(
  localStream: MediaStream | null,
  setLocalStream: React.Dispatch<React.SetStateAction<MediaStream | null>>,
  isMicMuted: boolean,
  setIsMicMuted: React.Dispatch<React.SetStateAction<boolean>>,
  options: UseWebRTCOptions
): UseWebRTCReturn {
  const { sendWSMessage, connectionIdRef, isMicMutedRef, isForceMutedRef } = options;

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerManagerRef = useRef<PeerManager | null>(null);
  const signalingRef = useRef<SignalingService | null>(null);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    isMicMutedRef.current = isMicMuted;
  }, [isMicMuted, isMicMutedRef]);

  useEffect(() => {
    signalingRef.current = new SignalingService(sendWSMessage);
    peerManagerRef.current = new PeerManager(
      (peerId, signal) => signalingRef.current!.sendWebRTCSignal(peerId, signal),
      () => localStreamRef.current,
      async () => acquireLocalStreamRef.current({ enabled: !isMicMutedRef.current })
    );

    return () => {
      peerManagerRef.current?.closeAll("hook_cleanup");
      peerManagerRef.current = null;
      signalingRef.current = null;
    };
  }, [sendWSMessage, isMicMutedRef]);

  const acquireLocalStreamRef = useRef<
    (opts?: { enabled?: boolean }) => Promise<MediaStream | null>
  >(async () => null);

  const acquireLocalStream = useCallback(
    async (opts?: { enabled?: boolean }) => {
      let stream = localStreamRef.current;
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          localStreamRef.current = stream;
          setLocalStream(stream);
        } catch (err) {
          console.warn("[WEBRTC] Failed to acquire local stream", err);
          return null;
        }
      }
      const enabled = opts?.enabled ?? (!isMicMutedRef.current && !isForceMutedRef.current);
      stream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
      return stream;
    },
    [setLocalStream, isMicMutedRef, isForceMutedRef]
  );

  acquireLocalStreamRef.current = acquireLocalStream;

  useEffect(() => {
    peerManagerRef.current?.setMyId(connectionIdRef.current);
  }, [connectionIdRef]);

  const handleWebRTCSignal = useCallback(async (senderId: string, signal: WebRTCSignal) => {
    await peerManagerRef.current?.handleSignal(senderId, signal);
  }, []);

  const connectToPeer = useCallback(async (peerId: string) => {
    await peerManagerRef.current?.connectToPeer(peerId);
  }, []);

  const connectToAllPeers = useCallback(async (participantIds: string[]) => {
    await peerManagerRef.current?.connectToAllPeers(participantIds);
  }, []);

  const syncPeersWithParticipants = useCallback(async (participantIds: string[]) => {
    await peerManagerRef.current?.syncWithParticipants(participantIds);
  }, []);

  const cleanupPeer = useCallback((peerId: string) => {
    peerManagerRef.current?.destroyPeer(peerId, "participant_left");
  }, []);

  const closeAllPeers = useCallback(() => {
    peerManagerRef.current?.closeAll("room_closed");
  }, []);

  const debugRoomState = useCallback((participantIds: string[]) => {
    peerManagerRef.current?.debugRoomState(participantIds);
  }, []);

  const broadcastAudioState = useCallback((isMicOn: boolean) => {
    signalingRef.current?.sendAudioState(isMicOn, true);
  }, []);

  const onRemoteMicOn = useCallback(
    (peerId: string) => {
      const myId = connectionIdRef.current;
      if (!myId || peerId === myId || !localStreamRef.current) return;
      if (isImpolitePeer(myId, peerId)) {
        void peerManagerRef.current?.connectToPeer(peerId);
      }
    },
    [connectionIdRef]
  );

  // Sync mic track enabled state with mute flags
  useEffect(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !isMicMuted && !isForceMutedRef.current;
    });
    signalingRef.current?.sendAudioState(!isMicMuted && !isForceMutedRef.current, true);
  }, [isMicMuted, isForceMutedRef]);

  return {
    localStreamRef,
    peerManagerRef,
    setLocalStream,
    localStream,
    isMicMuted,
    setIsMicMuted,
    acquireLocalStream,
    handleWebRTCSignal,
    connectToPeer,
    connectToAllPeers,
    syncPeersWithParticipants,
    cleanupPeer,
    closeAllPeers,
    debugRoomState,
    broadcastAudioState,
    onRemoteMicOn,
  };
}

// Expose debug helper on window in development
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  (window as unknown as { debugExplicadorWebRTC?: () => void }).debugExplicadorWebRTC =
    () => {
      console.info(
        "[WEBRTC] Call debugRoomState() from the room page via the hook, or inspect peerManagerRef."
      );
    };
}
