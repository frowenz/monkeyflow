export interface Option<T> {
  value: T;
  label: string;
}

export const OFF_ON: Option<boolean>[] = [
  { value: false, label: "off" },
  { value: true, label: "on" },
];
