export interface ScheduleFormValues {
  startDate?: string | null;
  endDate?: string | null;
}

export interface ScheduleContent {
  startsAt: string | null;
  endsAt: string | null;
}

export interface ContractDraft {
  title: string;
  schedule?: ScheduleContent | null;
}

export function normalizeCreateSchedule(values?: ScheduleFormValues): ScheduleContent | null {
  if (!values || (!values.startDate && !values.endDate)) return null;
  return {
    startsAt: values.startDate || null,
    endsAt: values.endDate || null,
  };
}

export function normalizeUpdateSchedule(
  values?: ScheduleFormValues,
): ScheduleContent | null | undefined {
  if (values === undefined) return undefined;
  if (!values.startDate && !values.endDate) return null;
  return {
    startsAt: values.startDate || null,
    endsAt: values.endDate || null,
  };
}

export function normalizePreviewSchedule(values?: ScheduleFormValues): ScheduleContent {
  return {
    startsAt: values?.startDate || null,
    endsAt: values?.endDate || null,
  };
}

export function createContract(title: string, schedule?: ScheduleFormValues): ContractDraft {
  return {
    title,
    schedule: normalizeCreateSchedule(schedule),
  };
}
