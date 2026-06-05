import {
  ICE_SERVERS,
  isImpolitePeer,
  type PeerConnectionSnapshot,
  type RoomDebugSnapshot,
  type WebRTCSignal,
} from "../types/webrtc";
import { webrtcError, webrtcLog, webrtcWarn } from "../utils/webrtcLogger";

export type SendSignalFn = (peerId: string, signal: WebRTCSignal) => void;
export type GetLocalStreamFn = () => MediaStream | null;
export type EnsureLocalStreamFn = () => Promise<MediaStream | null>;

interface PeerEntry {
  pc: RTCPeerConnection;
  remoteStreams: Set<MediaStream>;
  makingOffer: boolean;
}

/**
 * Manages a full-mesh of RTCPeerConnections (one per remote participant).
 * Uses perfect negotiation: higher connection_id is impolite (ignores glare offers).
 */
export class PeerManager {
  private myId: string | null = null;
  private peers = new Map<string, PeerEntry>();
  private pendingIce = new Map<string, RTCIceCandidateInit[]>();
  /** Serializes signaling per peer to prevent negotiation races. */
  private peerLocks = new Map<string, Promise<void>>();

  constructor(
    private sendSignal: SendSignalFn,
    private getLocalStream: GetLocalStreamFn,
    private ensureLocalStream: EnsureLocalStreamFn
  ) {}

  setMyId(id: string | null): void {
    this.myId = id;
  }

  getMyId(): string | null {
    return this.myId;
  }

  /** Attach audio element for remote stream playback. */
  attachRemoteStream(peerId: string, stream: MediaStream): void {
    let audioEl = document.getElementById(`audio-${peerId}`) as HTMLAudioElement | null;
    if (!audioEl) {
      audioEl = document.createElement("audio");
      audioEl.id = `audio-${peerId}`;
      audioEl.autoplay = true;
      document.body.appendChild(audioEl);
    }
    audioEl.srcObject = stream;
    audioEl.play().catch(() => {});
    webrtcLog({
      event: "remote_stream_attached",
      peerId,
      myId: this.myId ?? undefined,
    });
  }

  private async withPeerLock<T>(peerId: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.peerLocks.get(peerId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.peerLocks.set(
      peerId,
      previous.then(() => gate)
    );
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  private logStateChange(
    peerId: string,
    kind: "connection_state_change" | "ice_state_change" | "signaling_state_change",
    prevState: string,
    state: string
  ): void {
    webrtcLog({
      event: kind,
      peerId,
      myId: this.myId ?? undefined,
      prevState,
      state,
    });
  }

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const entry: PeerEntry = { pc, remoteStreams: new Set(), makingOffer: false };
    this.peers.set(peerId, entry);

    let connectionState = pc.connectionState;
    let iceConnectionState = pc.iceConnectionState;
    let signalingState = pc.signalingState;

    pc.onconnectionstatechange = () => {
      const prev = connectionState;
      connectionState = pc.connectionState;
      this.logStateChange(peerId, "connection_state_change", prev, connectionState);
      if (pc.connectionState === "failed") {
        webrtcWarn("Peer connection failed — will retry on next sync", { peerId });
      }
    };

    pc.oniceconnectionstatechange = () => {
      const prev = iceConnectionState;
      iceConnectionState = pc.iceConnectionState;
      this.logStateChange(peerId, "ice_state_change", prev, iceConnectionState);
    };

    pc.onsignalingstatechange = () => {
      const prev = signalingState;
      signalingState = pc.signalingState;
      this.logStateChange(peerId, "signaling_state_change", prev, signalingState);
    };

    pc.onnegotiationneeded = () => {
      webrtcLog({
        event: "negotiation_started",
        peerId,
        myId: this.myId ?? undefined,
        signalingState: pc.signalingState,
      });
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      webrtcLog({
        event: "ice_candidate_generated",
        from: this.myId ?? undefined,
        to: peerId,
        peerId,
      });
      this.sendSignal(peerId, {
        type: "candidate",
        candidate: event.candidate.toJSON(),
      });
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (!remoteStream) return;
      entry.remoteStreams.add(remoteStream);
      webrtcLog({
        event: "remote_track_received",
        peerId,
        myId: this.myId ?? undefined,
        trackKind: event.track.kind,
      });
      this.attachRemoteStream(peerId, remoteStream);
    };

    webrtcLog({
      event: "peer_created",
      peerId,
      myId: this.myId ?? undefined,
    });

    return pc;
  }

  private getOrCreatePeer(peerId: string): RTCPeerConnection {
    let entry = this.peers.get(peerId);
    if (!entry) {
      this.createPeerConnection(peerId);
      entry = this.peers.get(peerId)!;
    }
    return entry.pc;
  }

  private addLocalTracks(pc: RTCPeerConnection, stream: MediaStream): void {
    stream.getTracks().forEach((track) => {
      const alreadyAdded = pc.getSenders().some((sender) => sender.track === track);
      if (!alreadyAdded) {
        pc.addTrack(track, stream);
      }
    });
  }

  private async flushPendingIceCandidates(peerId: string, pc: RTCPeerConnection): Promise<void> {
    const pending = this.pendingIce.get(peerId) ?? [];
    if (pending.length === 0) return;

    this.pendingIce.delete(peerId);
    webrtcLog({
      event: "ice_candidate_flushed",
      peerId,
      count: pending.length,
      myId: this.myId ?? undefined,
    });

    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        webrtcError("Error flushing ICE candidate", error, { peerId });
      }
    }
  }

  private queueIceCandidate(peerId: string, candidate: RTCIceCandidateInit): void {
    const pending = this.pendingIce.get(peerId) ?? [];
    pending.push(candidate);
    this.pendingIce.set(peerId, pending);
    webrtcLog({
      event: "ice_candidate_queued",
      peerId,
      count: pending.length,
      myId: this.myId ?? undefined,
    });
  }

  private isNegotiationInProgress(pc: RTCPeerConnection): boolean {
    return (
      pc.signalingState === "have-local-offer" ||
      pc.signalingState === "have-remote-offer"
    );
  }

  private shouldSkipOutboundOffer(peerId: string, pc: RTCPeerConnection): string | null {
    if (pc.connectionState === "connected") {
      return "already_connected";
    }
    if (pc.connectionState === "connecting") {
      return "already_connecting";
    }
    if (this.isNegotiationInProgress(pc)) {
      return "negotiation_in_progress";
    }
    const entry = this.peers.get(peerId);
    if (entry?.makingOffer) {
      return "making_offer";
    }
    return null;
  }

  /**
   * Initiate (or ensure) a connection to a peer when we are the impolite side.
   * Does NOT require mic to be unmuted — mesh must form for receive path too.
   */
  async connectToPeer(peerId: string): Promise<void> {
    const myId = this.myId;
    if (!myId || peerId === myId) return;

    if (!isImpolitePeer(myId, peerId)) {
      webrtcLog({
        event: "connect_to_peer_skipped",
        peerId,
        myId,
        reason: "polite_peer_waits_for_offer",
      });
      return;
    }

    const stream = this.getLocalStream() ?? (await this.ensureLocalStream());
    if (!stream) {
      webrtcLog({
        event: "connect_to_peer_skipped",
        peerId,
        myId,
        reason: "no_local_stream",
      });
      return;
    }

    await this.withPeerLock(peerId, async () => {
      const existing = this.peers.get(peerId);
      if (existing) {
        const skipReason = this.shouldSkipOutboundOffer(peerId, existing.pc);
        if (skipReason) {
          webrtcLog({
            event: "connect_to_peer_skipped",
            peerId,
            myId,
            reason: skipReason,
            signalingState: existing.pc.signalingState,
            connectionState: existing.pc.connectionState,
          });
          return;
        }
        if (existing.pc.connectionState === "failed" || existing.pc.connectionState === "closed") {
          this.destroyPeer(peerId, "failed_or_closed");
        }
      }

      webrtcLog({
        event: "connect_to_peer_started",
        from: myId,
        to: peerId,
        peerId,
      });

      const entry = this.peers.get(peerId);
      const pc = entry?.pc ?? this.createPeerConnection(peerId);
      const peerEntry = this.peers.get(peerId)!;
      peerEntry.makingOffer = true;

      try {
        this.addLocalTracks(pc, stream);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        webrtcLog({
          event: "offer_created",
          from: myId,
          to: peerId,
          peerId,
        });

        this.sendSignal(peerId, { type: "offer", sdp: offer.sdp ?? "" });
        await this.flushPendingIceCandidates(peerId, pc);

        webrtcLog({
          event: "negotiation_completed",
          peerId,
          myId,
          direction: "outbound_offer",
        });
      } catch (error) {
        webrtcError("Failed to connect to peer", error, { peerId, myId });
      } finally {
        peerEntry.makingOffer = false;
      }
    });
  }

  async connectToAllPeers(participantIds: string[]): Promise<void> {
    webrtcLog({
      event: "connect_to_all_peers",
      myId: this.myId ?? undefined,
      count: participantIds.length,
      participants: participantIds,
    });
    await Promise.all(participantIds.map((id) => this.connectToPeer(id)));
  }

  async handleSignal(senderId: string, signal: WebRTCSignal): Promise<void> {
    await this.withPeerLock(senderId, async () => {
      if (signal.type === "offer") {
        await this.handleOffer(senderId, signal);
      } else if (signal.type === "answer") {
        await this.handleAnswer(senderId, signal);
      } else if (signal.type === "candidate") {
        await this.handleCandidate(senderId, signal);
      }
    });
  }

  private async handleOffer(
    senderId: string,
    signal: { type: "offer"; sdp: string }
  ): Promise<void> {
    const myId = this.myId;
    if (!myId) return;

    webrtcLog({
      event: "offer_received",
      from: senderId,
      to: myId,
      peerId: senderId,
    });

    const pc = this.getOrCreatePeer(senderId);
    const impolite = isImpolitePeer(myId, senderId);
    const offerCollision =
      this.isNegotiationInProgress(pc) || this.peers.get(senderId)?.makingOffer;

    if (offerCollision) {
      if (impolite) {
        webrtcLog({
          event: "offer_ignored_glare",
          from: senderId,
          to: myId,
          peerId: senderId,
          reason: "impolite_peer_keeps_local_offer",
        });
        return;
      }

      webrtcLog({
        event: "rollback_applied",
        peerId: senderId,
        myId,
        reason: "polite_peer_accepts_remote_offer",
      });
      await pc.setLocalDescription({ type: "rollback" });
    }

    await pc.setRemoteDescription({ type: "offer", sdp: signal.sdp });

    const stream = this.getLocalStream() ?? (await this.ensureLocalStream());
    if (stream) {
      this.addLocalTracks(pc, stream);
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    webrtcLog({
      event: "answer_created",
      from: myId,
      to: senderId,
      peerId: senderId,
    });

    this.sendSignal(senderId, { type: "answer", sdp: answer.sdp ?? "" });
    await this.flushPendingIceCandidates(senderId, pc);

    webrtcLog({
      event: "negotiation_completed",
      peerId: senderId,
      myId,
      direction: "inbound_offer",
    });
  }

  private async handleAnswer(
    senderId: string,
    signal: { type: "answer"; sdp: string }
  ): Promise<void> {
    const entry = this.peers.get(senderId);
    if (!entry) {
      webrtcWarn("Answer received for unknown peer", { senderId });
      return;
    }

    webrtcLog({
      event: "answer_received",
      from: senderId,
      to: this.myId ?? undefined,
      peerId: senderId,
      signalingState: entry.pc.signalingState,
    });

    if (entry.pc.signalingState !== "have-local-offer") {
      webrtcWarn("Ignoring answer — unexpected signaling state", {
        senderId,
        signalingState: entry.pc.signalingState,
      });
      return;
    }

    await entry.pc.setRemoteDescription({ type: "answer", sdp: signal.sdp });
    await this.flushPendingIceCandidates(senderId, entry.pc);

    webrtcLog({
      event: "negotiation_completed",
      peerId: senderId,
      myId: this.myId ?? undefined,
      direction: "inbound_answer",
    });
  }

  private async handleCandidate(
    senderId: string,
    signal: { type: "candidate"; candidate: RTCIceCandidateInit }
  ): Promise<void> {
    webrtcLog({
      event: "ice_candidate_received",
      from: senderId,
      to: this.myId ?? undefined,
      peerId: senderId,
    });

    const pc = this.peers.has(senderId)
      ? this.peers.get(senderId)!.pc
      : this.createPeerConnection(senderId);

    if (pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      } catch (error) {
        webrtcError("Error adding received ICE candidate", error, { senderId });
      }
    } else {
      this.queueIceCandidate(senderId, signal.candidate);
    }
  }

  /**
   * Sync mesh with current participant list.
   * Impolite side initiates missing connections; stale peers are removed.
   */
  async syncWithParticipants(participantIds: string[]): Promise<void> {
    const myId = this.myId;
    if (!myId) return;

    const nextIds = new Set(participantIds.filter((id) => id !== myId));

    for (const peerId of this.peers.keys()) {
      if (!nextIds.has(peerId)) {
        this.destroyPeer(peerId, "participant_left");
      }
    }

    webrtcLog({
      event: "presence_sync",
      myId,
      participants: [...nextIds],
    });

    await this.connectToAllPeers([...nextIds]);
  }

  destroyPeer(peerId: string, reason = "manual"): void {
    const entry = this.peers.get(peerId);
    if (!entry) return;

    entry.pc.close();
    this.peers.delete(peerId);
    this.pendingIce.delete(peerId);
    this.peerLocks.delete(peerId);
    document.getElementById(`audio-${peerId}`)?.remove();

    webrtcLog({
      event: "peer_destroyed",
      peerId,
      myId: this.myId ?? undefined,
      reason,
    });
  }

  closeAll(reason = "room_closed"): void {
    for (const peerId of [...this.peers.keys()]) {
      this.destroyPeer(peerId, reason);
    }
    this.pendingIce.clear();
    this.peerLocks.clear();
  }

  getPeerSnapshot(peerId: string): PeerConnectionSnapshot | null {
    const entry = this.peers.get(peerId);
    if (!entry) return null;
    const { pc, remoteStreams } = entry;
    return {
      peerId,
      connectionState: pc.connectionState,
      iceConnectionState: pc.iceConnectionState,
      signalingState: pc.signalingState,
      pendingIceCount: this.pendingIce.get(peerId)?.length ?? 0,
      remoteStreamCount: remoteStreams.size,
      senders: pc.getSenders().length,
      receivers: pc.getReceivers().length,
    };
  }

  debugRoomState(participantIds: string[]): RoomDebugSnapshot {
    const myId = this.myId;
    const participants = participantIds.filter((id) => id !== myId);

    const peerConnections: Record<string, string[]> = {};
    if (myId) {
      peerConnections[myId] = [...this.peers.keys()];
    }

    const snapshot: RoomDebugSnapshot = {
      myId,
      participants,
      peerConnections,
      peers: [...this.peers.keys()]
        .map((id) => this.getPeerSnapshot(id))
        .filter((s): s is PeerConnectionSnapshot => s !== null),
    };

    console.group("[WEBRTC] debugRoomState");
    console.log("Participants:", participants);
    console.log("Peer Connections:", peerConnections);
    snapshot.peers.forEach((peer) => {
      console.log(`Peer ${peer.peerId}:`, {
        connection: peer.connectionState,
        ice: peer.iceConnectionState,
        signaling: peer.signalingState,
        pendingIce: peer.pendingIceCount,
        remoteStreams: peer.remoteStreamCount,
        senders: peer.senders,
        receivers: peer.receivers,
      });
    });
    console.groupEnd();

    return snapshot;
  }
}
