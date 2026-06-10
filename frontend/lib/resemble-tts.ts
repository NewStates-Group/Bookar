/**
 * Resemble AI WebSocket TTS client
 * Streams audio from Resemble's WebSocket API and plays chunks with low latency.
 */

export interface ResembleTTSCallbacks {
  onStart?: () => void;
  onChunk?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
}

export class ResembleTTS {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private isSpeaking = false;
  private shouldStop = false;
  private callbacks: ResembleTTSCallbacks;
  private resolvePromise: ((value: void) => void) | null = null;
  private rejectPromise: ((reason: Error) => void) | null = null;

  constructor(callbacks: ResembleTTSCallbacks = {}) {
    this.callbacks = callbacks;
  }

  async speak(text: string): Promise<void> {
    if (this.isSpeaking) {
      await this.stop();
    }

    const apiKey = process.env.NEXT_PUBLIC_RESEMBLE_API_KEY;
    const voiceUuid = process.env.NEXT_PUBLIC_RESEMBLE_VOICE_UUID;
    const projectUuid = process.env.NEXT_PUBLIC_RESEMBLE_PROJECT_UUID;

    if (!apiKey || !voiceUuid || !projectUuid) {
      const error = new Error(
        "Resemble TTS not configured. Set NEXT_PUBLIC_RESEMBLE_API_KEY, " +
        "NEXT_PUBLIC_RESEMBLE_VOICE_UUID, and NEXT_PUBLIC_RESEMBLE_PROJECT_UUID."
      );
      this.callbacks.onError?.(error);
      return Promise.reject(error);
    }

    this.isSpeaking = true;
    this.shouldStop = false;

    const wsUrl = `wss://websocket.cluster.resemble.ai/stream?api_key=${apiKey}`;

    return new Promise<void>((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;

      try {
        this.ws = new WebSocket(wsUrl);
      } catch (err) {
        this.isSpeaking = false;
        reject(err as Error);
        return;
      }

      const ws = this.ws;
      let requestId = 0;

      ws.onopen = () => {
        if (this.shouldStop) {
          ws.close();
          return;
        }

        const payload = {
          voice_uuid: voiceUuid,
          project_uuid: projectUuid,
          data: text.slice(0, 3000),
          model: "chatterbox-turbo",
          binary_response: false,
          request_id: requestId++,
          output_format: "wav",
          sample_rate: 32000,
          precision: "PCM_32",
          no_audio_header: false,
        };

        ws.send(JSON.stringify(payload));
        this.callbacks.onStart?.();
      };

      ws.onmessage = (event) => {
        if (this.shouldStop) return;

        try {
          const msg = JSON.parse(event.data);

          switch (msg.type) {
            case "audio":
              void this.playAudioChunk(msg.audio_content);
              this.callbacks.onChunk?.();
              break;

            case "audio_end":
              this.isSpeaking = false;
              ws.close();
              this.callbacks.onEnd?.();
              this.resolvePromise?.();
              break;

            case "error":
              this.isSpeaking = false;
              ws.close();
              const error = new Error(
                msg.message || "Resemble TTS error"
              );
              this.callbacks.onError?.(error);
              this.rejectPromise?.(error);
              break;
          }
        } catch (err) {
          console.error("Error processing Resemble message:", err);
        }
      };

      ws.onerror = () => {
        this.isSpeaking = false;
        const error = new Error("Resemble WebSocket connection failed");
        this.callbacks.onError?.(error);
        this.rejectPromise?.(error);
      };

      ws.onclose = () => {
        this.ws = null;
        if (this.isSpeaking) {
          this.isSpeaking = false;
          const error = new Error("Resemble WebSocket closed unexpectedly");
          this.callbacks.onError?.(error);
          this.rejectPromise?.(error);
          this.resolvePromise = null;
          this.rejectPromise = null;
        }
      };
    });
  }

  private async playAudioChunk(base64Audio: string): Promise<void> {
    try {
      const binaryStr = atob(base64Audio);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      if (!this.audioContext) {
        this.audioContext = new AudioContext();
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);
      }

      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      const audioBuffer = await this.audioContext.decodeAudioData(
        bytes.buffer
      );

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.gainNode!);
      source.start();
    } catch (err) {
      console.warn("Failed to play audio chunk:", err);
    }
  }

  async stop(): Promise<void> {
    this.shouldStop = true;
    this.isSpeaking = false;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
      this.gainNode = null;
    }

    this.resolvePromise?.();
    this.resolvePromise = null;
    this.rejectPromise = null;
  }

  get isActive(): boolean {
    return this.isSpeaking;
  }
}
