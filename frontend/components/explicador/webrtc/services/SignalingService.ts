import type { WebRTCSignal } from "../types/webrtc";
import type { SignalingSendFn } from "../types/signaling";

export class SignalingService {
  constructor(private send: SignalingSendFn) {}

  sendWebRTCSignal(targetConnectionId: string, signal: WebRTCSignal): void {
    this.send({
      type: "webrtc_signal",
      target_connection_id: targetConnectionId,
      signal,
    });
  }

  sendAudioState(isMicOn: boolean, isListening = true): void {
    this.send({
      type: "audio_state",
      is_mic_on: isMicOn,
      is_listening: isListening,
    });
  }
}
