export type WebRTCSignalType = "offer" | "answer" | "candidate";

export interface WebRTCSignalOffer {
  type: "offer";
  sdp: string;
}

export interface WebRTCSignalAnswer {
  type: "answer";
  sdp: string;
}

export interface WebRTCSignalCandidate {
  type: "candidate";
  candidate: RTCIceCandidateInit;
}

export type WebRTCSignal =
  | WebRTCSignalOffer
  | WebRTCSignalAnswer
  | WebRTCSignalCandidate;

export interface PeerConnectionSnapshot {
  peerId: string;
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  signalingState: RTCSignalingState;
  pendingIceCount: number;
  remoteStreamCount: number;
  senders: number;
  receivers: number;
}

export interface RoomDebugSnapshot {
  myId: string | null;
  participants: string[];
  peerConnections: Record<string, string[]>;
  peers: PeerConnectionSnapshot[];
}

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

/** Higher connection_id is the impolite (offer-initiating) peer in a pair. */
export function isImpolitePeer(myId: string, peerId: string): boolean {
  return myId > peerId;
}
