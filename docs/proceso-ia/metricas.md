# Métricas del desarrollo

Cifras del proyecto calculadas con `git` y los `tasks.md`, cada una con el comando que la reproduce. Se ejecutan desde la raíz del repositorio con Git Bash o cualquier *shell* POSIX.

> **Fecha de corte:** 25/11/2026, con F00–F04 en producción y F07 (entrega) cerrada salvo la comprobación final (T-07.08). Se recalculan al cerrar la entrega (T-07.08) con el *script* del final.

## Resumen

| Métrica | Valor | Comando |
|---|---|---|
| Features especificadas (SDD) | **6** (F00–F04 y F07) | `ls -d docs/specs/F*/ \| wc -l` |
| Features fuera del TFM | 2 (F05 adjuntos, F06 auditoría y cuadro de mando) | [requisitos.md § Trabajo futuro](../requisitos.md#trabajo-futuro) |
| Criterios de aceptación | **98** | `grep -h '^#### CA-' docs/specs/*/spec.md \| wc -l` |
| Tareas | **43** | `grep -h '^### T-' docs/specs/*/tasks.md \| wc -l` |
| Tareas hechas | **41** (todas las de F00–F04 y 8 de F07; queda T-07.08, la comprobación final) | `grep -h '^- Estado: hecha' docs/specs/*/tasks.md \| wc -l` |
| Tareas descartadas | 1 (T-07.03, CI ampliada) | `grep -h '^- Estado: descartada' docs/specs/*/tasks.md \| wc -l` |
| Commits (todas las ramas) | **72**, de ellos 13 *merges* | `git log --all --oneline \| wc -l` · `git log --all --merges --oneline \| wc -l` |
| Commits sin *merge* que citan su tarea `[T-xx.yy]` | **52 de 59** (el resto: 4 de specs, la configuración inicial y 2 sin tarea) | `git log --all --no-merges --format=%s \| grep -c '\[T-'` |
| PR integrados en `main` (*squash merge*) | **7** (el 8.º es el de esta documentación) | `gh pr list --state merged --limit 100 \| wc -l` |
| Commits en `main` | **8** | `git log main --oneline \| wc -l` |
| Tests | **2979** unitarios y de integración (shared 233 · api 2087 · web 659) + **15** E2E con Playwright | `npm test 2>&1 \| grep -E '^ +Tests'` |
| *Stories* de Storybook | **41** (40 componentes + tokens) | `find apps/web/src -name '*.stories.tsx' \| wc -l` |
| ADR | **9** | `ls docs/adr/0*.md \| wc -l` |

## Reparto de tareas por agente

| Agente | Tareas |
|---|---|
| `backend-dev` | 14 |
| `frontend-dev` | 14 |
| principal (despliegue, documentación, integración) | 11 |
| `qa-tester` | 4 |

```bash
grep -h '^- Agente:' docs/specs/*/tasks.md | sed -E 's/- Agente: ([a-z-]+).*/\1/' | sort | uniq -c
```

## Hallazgos de revisión

| Métrica | Valor | Comando |
|---|---|---|
| Hallazgos corregidos registrados como evidencia | **4** en 3 tareas (T-00.03, T-01.02, T-03.02) | `grep -c '^\| T-' docs/proceso-ia/hallazgos-revisores.md` |
| … por gravedad | 3 media · 1 baja que resultó un bug de *build* | `grep -o '^\| T-[^\|]*\| [^\|]*\| [^\|]*\|' docs/proceso-ia/hallazgos-revisores.md` |
| Tareas cuyas notas registran un hallazgo **medio** | 5 (T-00.03, T-01.02, T-02.03, T-02.07, T-03.03) | ver abajo |
| Tareas con algún hallazgo medio (unión de las dos fuentes) | **6** (las 5 anteriores + T-03.02) | — |
| Hallazgos altos o críticos pendientes | **0** | revisión de cada tarea (*Definition of Done*) |

```bash
awk '/^### T-/{id=$2} /[Hh]allazgos? medio/{print id}' docs/specs/*/tasks.md | sort -u
```

De los 5 hallazgos medios de las notas, 3 se corrigieron (T-00.03, T-01.02, T-02.07) y 2 se aceptaron con el motivo anotado en la tarea (T-02.03: una carrera entre Admin solo duplicaría una fila de auditoría; T-03.03: un error de validación que puede reaparecer sin perder datos). El hallazgo de T-03.02 se describe en [flujo.md](flujo.md).

## Ritmo

| Día | Commits |
|---|---|
| 23/11/2026 | 28 |
| 25/11/2026 | 44 |

```bash
git log --all --format='%ad' --date=short | sort | uniq -c
```

## Recalcular todo

```bash
echo "features:     $(ls -d docs/specs/F*/ | wc -l)"
echo "criterios:    $(grep -h '^#### CA-' docs/specs/*/spec.md | wc -l)"
echo "tareas:       $(grep -h '^### T-' docs/specs/*/tasks.md | wc -l)"
echo "hechas:       $(grep -h '^- Estado: hecha' docs/specs/*/tasks.md | wc -l)"
echo "descartadas:  $(grep -h '^- Estado: descartada' docs/specs/*/tasks.md | wc -l)"
echo "commits:      $(git log --all --oneline | wc -l) (merges: $(git log --all --merges --oneline | wc -l))"
echo "con tarea:    $(git log --all --no-merges --format=%s | grep -c '\[T-') de $(git log --all --no-merges --oneline | wc -l)"
echo "en main:      $(git log main --oneline | wc -l)"
echo "PR:           $(gh pr list --state merged --limit 100 | wc -l)"
echo "stories:      $(find apps/web/src -name '*.stories.tsx' | wc -l)"
echo "ADR:          $(ls docs/adr/0*.md | wc -l)"
echo "hallazgos:    $(grep -c '^| T-' docs/proceso-ia/hallazgos-revisores.md)"
npm test 2>&1 | grep -E '^ +(Test Files|Tests)'
```

**Nota:** `git log --all` cuenta también las ramas locales de trabajo (las de los *worktrees* de tareas en paralelo). En un clon nuevo solo se ven las ramas publicadas, así que el total puede ser algo menor (66 commits a la fecha de corte, con `git log --remotes`).

## Cómo se ha usado la IA

El código, los tests y la documentación los han escrito agentes de Claude Code siguiendo el proceso de [flujo.md](flujo.md) y el *harness* de [harness.md](harness.md); la persona ha aprobado las specs y los planes, ha revisado la interfaz en el navegador y ha confirmado cada `push`, instalación de dependencias, PR y *merge*. Todos los commits sin *merge* llevan la línea `Co-Authored-By` del agente:

```bash
git log --all --no-merges --format='%(trailers:key=Co-Authored-By,valueonly)' | grep -c Claude
```

El vídeo de la demo también lo genera el agente principal (T-07.09): grabación automática del navegador con Playwright, narración con la voz sintética de Windows y subtítulos.
