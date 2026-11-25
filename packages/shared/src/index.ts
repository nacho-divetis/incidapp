// Contrato entre la API y la web. El front nunca redefine a mano un tipo que exista aquí.
// Efecto lateral intencionado: configura Zod en español antes de que nadie valide nada.
import './zod-locale';

export * from './audit';
export * from './auth';
export * from './authorization';
export * from './demo-users';
export * from './errors';
export * from './health';
export * from './status';
export * from './users';
