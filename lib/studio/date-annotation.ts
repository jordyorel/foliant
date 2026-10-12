export const dateFormats = ["numeric", "long", "iso"] as const;
export type DateAnnotationFormat = typeof dateFormats[number];

export function localToday(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatAnnotationDate(value: string, format: DateAnnotationFormat, locale: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return "";
  if (format === "iso") return value;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit", month: format === "long" ? "long" : "2-digit", year: "numeric", timeZone: "UTC"
  }).format(date);
}

export const dateAnnotationCopy = {
  fr: {title: "Ajouter une date", date: "Date", format: "Format", cancel: "Annuler", place: "Placer la date", close: "Fermer", preview: "Aperçu"},
  en: {title: "Add a date", date: "Date", format: "Format", cancel: "Cancel", place: "Place date", close: "Close", preview: "Preview"},
  es: {title: "Añadir una fecha", date: "Fecha", format: "Formato", cancel: "Cancelar", place: "Colocar fecha", close: "Cerrar", preview: "Vista previa"},
  pt: {title: "Adicionar uma data", date: "Data", format: "Formato", cancel: "Cancelar", place: "Posicionar data", close: "Fechar", preview: "Prévia"}
};
