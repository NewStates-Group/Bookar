import type { WebRTCSignal } from "./webrtc";

export interface WebRTCSignalMessage {
  type: "webrtc_signal";
  target_connection_id: string;
  sender_connection_id: string;
  signal: WebRTCSignal;
}

export interface AudioStateMessage {
  type: "audio_state";
  connection_id: string;
  is_mic_on: boolean;
  is_listening: boolean;
}

export type SignalingSendFn = (payload: Record<string, unknown>) => void;
