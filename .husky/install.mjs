// Instala los hooks de git con Husky (script `prepare`).
// Tolerante: no hace nada en CI, en producción, sin `.git` o si Husky no está instalado
// (p. ej., `npm ci --omit=dev`), para que `npm install` nunca falle por los hooks.
if (process.env.CI === 'true' || process.env.NODE_ENV === 'production') process.exit(0);

try {
  const { default: husky } = await import('husky');
  const message = husky();
  if (message) console.log(`husky: ${message}`);
} catch {
  console.log('husky: no está instalado; se omiten los hooks de git.');
}
