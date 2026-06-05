export type WebRTCLogEvent =
  | "participant_join"
  | "participant_leave"
  | "peer_created"
  | "peer_destroyed"
  | "offer_created"
  | "offer_received"
  | "offer_ignored_glare"
  | "answer_created"
  | "answer_received"
  | "ice_candidate_generated"
  | "ice_candidate_received"
  | "ice_candidate_queued"
  | "ice_candidate_flushed"
  | "remote_track_received"
  | "remote_stream_attached"
  | "negotiation_started"
  | "negotiation_completed"
  | "connection_state_change"
  | "ice_state_change"
  | "signaling_state_change"
  | "connect_to_peer_skipped"
  | "connect_to_peer_started"
  | "connect_to_all_peers"
  | "presence_sync"
  | "signaling_error"
  | "rollback_applied";

export interface WebRTCLogContext {
  event: WebRTCLogEvent;
  from?: string;
  to?: string;
  peerId?: string;
  myId?: string;
  state?: string;
  prevState?: string;
  count?: number;
  reason?: string;
  error?: unknown;
  [key: string]: unknown;
}

let loggingEnabled = true;

export function setWebRTCLoggingEnabled(enabled: boolean): void {
  loggingEnabled = enabled;
}

export function webrtcLog(context: WebRTCLogContext): void {
  if (!loggingEnabled) return;

  console.group("[WEBRTC]");
  Object.entries(context).forEach(([key, value]) => {
    if (value !== undefined) {
      console.log(`${key}:`, value);
    }
  });
  console.groupEnd();
}

export function webrtcWarn(message: string, context?: Record<string, unknown>): void {
  if (!loggingEnabled) return;
  console.warn("[WEBRTC]", message, context ?? "");
}

export function webrtcError(message: string, error?: unknown, context?: Record<string, unknown>): void {
  console.error("[WEBRTC]", message, error, context ?? "");
}
