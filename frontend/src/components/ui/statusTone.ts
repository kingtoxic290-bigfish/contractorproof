import {
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  CircleSlash,
  Clock3,
  FileWarning,
  type LucideIcon,
} from "lucide-react";

/**
 * Single source of truth for how verification and workflow states are presented.
 *
 * The four verification states (MATCH, MISMATCH, PENDING, UNAVAILABLE) are the
 * backend's states. They are never renamed here. Every tone pairs a colour with
 * an icon and an explicit text label so state is never conveyed by colour alone.
 */
export type StatusTone = {
  /** Border, background and text classes for the badge. */
  tone: string;
  icon: LucideIcon;
  /** Short factual sentence describing what the state means. */
  meaning: string;
};

const NEUTRAL: StatusTone = {
  tone: "border-stone-400 bg-stone-100 text-stone-800",
  icon: CircleSlash,
  meaning: "The service returned a state that this screen does not describe.",
};

export const VERIFICATION_TONES: Record<string, StatusTone> = {
  MATCH: {
    tone: "border-[#166534] bg-[#dcfce7] text-[#166534]",
    icon: CheckCircle2,
    meaning:
      "The submitted file matches the recorded evidence fingerprint. This is a technical comparison only and does not attest to the underlying claim.",
  },
  MISMATCH: {
    tone: "border-[#991b1b] bg-[#fee2e2] text-[#991b1b]",
    icon: AlertTriangle,
    meaning:
      "The submitted file does not match the recorded evidence fingerprint. This is a technical comparison result and does not establish why the bytes differ.",
  },
  PENDING: {
    tone: "border-[#92400e] bg-[#fef3c7] text-[#92400e]",
    icon: Clock3,
    meaning:
      "The comparison has not produced a result yet. No match or mismatch should be assumed.",
  },
  UNAVAILABLE: {
    tone: "border-stone-500 bg-stone-100 text-stone-700",
    icon: CircleOff,
    meaning:
      "The system could not establish the requested verification result. Nothing is being reported about the evidence.",
  },
};

/**
 * Evidence workflow states. These describe where an evidence record sits in the
 * record lifecycle. They are separate from the verification states above and are
 * never presented as a judgement about the evidence itself.
 */
export const WORKFLOW_TONES: Record<string, StatusTone> = {
  PENDING_VERIFICATION: {
    tone: "border-[#92400e] bg-[#fef3c7] text-[#92400e]",
    icon: Clock3,
    meaning: "This evidence record has not yet completed fingerprint verification.",
  },
  VERIFIED: {
    tone: "border-[#166534] bg-[#dcfce7] text-[#166534]",
    icon: CheckCircle2,
    meaning: "This evidence record completed its verification workflow.",
  },
  REJECTED: {
    tone: "border-[#991b1b] bg-[#fee2e2] text-[#991b1b]",
    icon: FileWarning,
    meaning: "This evidence record was rejected in the verification workflow.",
  },
  DISPUTED: {
    tone: "border-[#92400e] bg-[#fef3c7] text-[#92400e]",
    icon: AlertTriangle,
    meaning: "A dispute has been raised against this evidence record.",
  },
};

/** Resolves a verification state to its presentation, falling back to neutral. */
export function verificationTone(status: string): StatusTone {
  return VERIFICATION_TONES[status] ?? NEUTRAL;
}

/** Resolves an evidence workflow state to its presentation, falling back to neutral. */
export function workflowTone(status: string): StatusTone {
  return WORKFLOW_TONES[status] ?? NEUTRAL;
}

/** Resolves any known state (verification or workflow) to its presentation. */
export function stateTone(status: string): StatusTone {
  return VERIFICATION_TONES[status] ?? WORKFLOW_TONES[status] ?? NEUTRAL;
}

export function isKnownStatus(status: string): boolean {
  return status in VERIFICATION_TONES || status in WORKFLOW_TONES;
}