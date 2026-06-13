/**
 * Transforma un texto a Title Case (Mayúscula Inicial) siguiendo las reglas del español
 * para conectores y preposiciones.
 * 
 * @param text El texto a transformar (ej: "LINCE DE LIMA")
 * @returns El texto transformado (ej: "Lince de Lima")
 */
export const toTitleCase = (text: string | null | undefined): string => {
  if (!text) return '';

  // Lista de conectores que deben permanecer en minúscula
  const connectors = [
    'de', 'del', 'y', 'la', 'el', 'las', 'los', 
    'por', 'en', 'con', 'para', 'o', 'un', 'a', 'al'
  ];

  return text
    .toLowerCase()
    .split(' ')
    .filter(word => word.length > 0)
    .map((word, index) => {
      // Siempre capitalizar la primera palabra
      if (index === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }

      // Si la palabra es un conector, mantener en minúscula
      if (connectors.includes(word)) {
        return word;
      }

      // Capitalizar palabra normal
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};
