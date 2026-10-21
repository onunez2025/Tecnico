/**
 * Transforma un texto a Title Case (Mayúscula Inicial) siguiendo las reglas del ecosistema SIATC.
 * Es la MISMA en todas las apps del ecosistema: si se cambia aquí, hay que copiarla a las demás.
 * Solo cambia cómo se MUESTRA: el dato de la base no se toca. En la base todo está en mayúsculas
 * («AC TECH», «T & G»), así que las siglas y razones sociales que se escriben en mayúsculas hay que
 * listarlas aquí; de otro modo salen «Ac Tech».
 *
 * @param text El texto a transformar (ej: "CODIGO SAP")
 * @returns El texto transformado (ej: "Código SAP")
 */

/** Se escriben siempre en mayúsculas: términos técnicos, tipos de sociedad y siglas de empresas CAS. */
const SIGLAS = new Set([
  'SAP', 'DNI', 'FSM', 'CAS', 'RUC', 'ID', 'MTC', 'POS', 'KM', 'GLN', 'AM', 'PM',
  'SAC', 'SRL', 'EIRL', 'II', 'III', 'IV',
  'AC', 'EMSS', 'VR',
  // Los que ya tenían EBM y Gestor FSM en su copia propia
  'EBM', 'CIF', 'ERP', 'SMTP', 'URL', 'CC', 'TO', 'ST', 'JSON', 'OAUTH', 'CSV', 'API',
]);

/** Minúscula salvo al inicio. Las letras sueltas («a», «o») no van aquí: pueden ser una inicial. */
const CONECTORES = new Set(['de', 'del', 'en', 'y', 'o', 'la', 'las', 'los', 'el', 'al', 'por', 'con', 'para']);

export const toTitleCase = (text: string | null | undefined): string => {
  if (!text) return '';

  return text
    .split(' ')
    .filter(word => word.length > 0)
    .map((word, index) => {
      const upperWord = word.replace(/[.,]/g, '').toUpperCase();

      // 1. Siglas y unidades técnicas
      if (SIGLAS.has(upperWord)) return upperWord;
      if (upperWord === 'KMG' || upperWord === 'KM/G') return 'Km/g';

      // 2. «A&D», «T&G»: con «&» pegado es una sigla de empresa
      if (word.length > 1 && word.includes('&')) return word.toUpperCase();

      const lowerWord = word.toLowerCase();

      // 3. La primera palabra siempre lleva mayúscula
      if (index === 0) return lowerWord.charAt(0).toUpperCase() + lowerWord.slice(1);

      // 4. Conectores en minúscula
      if (CONECTORES.has(lowerWord)) return lowerWord;

      // 5. Palabra normal
      return lowerWord.charAt(0).toUpperCase() + lowerWord.slice(1);
    })
    .join(' ');
};
