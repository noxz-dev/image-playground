const OPTIONS = {
  translate: 'TRANSLATE',
  placeholder: 'PLACEHOLDER',
} as const

type EnumValues<T> = T[keyof T];

export type Options = EnumValues<typeof OPTIONS>;

export const activeMode = ref<Options>(OPTIONS.translate)
