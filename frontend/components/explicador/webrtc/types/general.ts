import { ExplicadorParticipant } from "@/lib/explicador-presence";

export interface LockObject {
    connection_id: string;
    name: string;
}

export interface WhiteboardData {
    summary?: string;
    lock?: LockObject | null;
    show_whiteboard?: boolean;
    open_whiteboard?: boolean;
}

export interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    attachment?: {
        name: string;
        mime_type: string;
        url: string;
    };
}

export type Participant = ExplicadorParticipant;