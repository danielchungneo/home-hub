export const TASK_FREQUENCIES = ['daily', 'weekly'] as const;
export type TaskFrequency = (typeof TASK_FREQUENCIES)[number];

export const MEMBER_ROLES = ['parent', 'child'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const PROFILE_KINDS = ['person', 'kiosk'] as const;
export type ProfileKind = (typeof PROFILE_KINDS)[number];

export const REDEMPTION_STATUSES = ['requested', 'approved', 'denied'] as const;
export type RedemptionStatus = (typeof REDEMPTION_STATUSES)[number];
