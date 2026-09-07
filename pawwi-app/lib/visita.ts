export const TIME_SLOTS = ["9:00am", "11:00am", "2:00pm", "4:00pm"] as const;
export type TimeSlot = (typeof TIME_SLOTS)[number];
