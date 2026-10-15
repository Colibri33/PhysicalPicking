/* ═══════════════════════════════════════════════════════════════
   logic/registroLegado.js
   Adaptador de registros guardados ANTES de v6 (con modulo
   cognitivo y clave "corporales") + retiro de % grasa / % muscular
   (ya no se capturan; solo cintura/cadera/ICC). Idempotente.
   - corporales            → antropometricas
   - consolidado[x].ajCorp → consolidado[x].ajAntrop
   - realesC, cognitivas y consolidado[x].ajCog se retiran del
     registro activo y se conservan intactos en `_legado` para no
     perder datos historicos del usuario de forma silenciosa.
   - `total` historico NO se recalcula (incluia el ajuste cognitivo).
   COPIA ESPEJO del frontend: src/logic/registroLegado.js (mantener
   ambas sincronizadas; mismos dos repos separados que validacion.js).
   ═══════════════════════════════════════════════════════════════ */

export function esRegistroLegado(r) {
  return !!r && typeof r === 'object' &&
    ('corporales' in r || 'realesC' in r || 'cognitivas' in r ||
      'grasa' in (r.antropometricas ?? {}) || 'muscular' in (r.antropometricas ?? {}) ||
      Object.values(r.consolidado ?? {}).some(c => c && typeof c === 'object' && ('ajCorp' in c || 'ajCog' in c)));
}

export function migrarRegistroLegado(registro) {
  if (!esRegistroLegado(registro)) return registro;
  const { corporales, realesC, cognitivas, ...resto } = registro;
  const ajCogPorVariable = {};
  const consolidado = Object.fromEntries(Object.entries(resto.consolidado ?? {}).map(([id, c]) => {
    if (!c || typeof c !== 'object') return [id, c];
    const { ajCog, ajCorp, ...otros } = c;
    if (ajCog !== undefined) ajCogPorVariable[id] = ajCog;
    return [id, { ...otros, ajAntrop: otros.ajAntrop ?? ajCorp ?? 0 }];
  }));
  return retirarGrasaMuscular({
    ...resto,
    antropometricas: resto.antropometricas ?? corporales ?? {},
    consolidado,
    _legado: {
      ...(resto._legado ?? {}),
      migradoDesde: 'v5_cognitivo_corporales',
      nota: 'El total consolidado historico incluye el ajuste cognitivo eliminado en v6.',
      ...(realesC !== undefined ? { realesC } : {}),
      ...(cognitivas !== undefined ? { cognitivas } : {}),
      ...(Object.keys(ajCogPorVariable).length ? { ajCog: ajCogPorVariable } : {}),
    },
  });
}

/*
 * retirarGrasaMuscular — % grasa y % muscular ya no se capturan.
 * Se retiran del registro activo a `_legado.antropometriaRetirada`
 * (conservados, nunca borrados). Idempotente.
 */
export function retirarGrasaMuscular(registro) {
  const a = registro?.antropometricas;
  if (!a || typeof a !== 'object' || (!('grasa' in a) && !('muscular' in a))) return registro;
  const { grasa, muscular, ...resto } = a;
  return {
    ...registro,
    antropometricas: resto,
    _legado: {
      ...(registro._legado ?? {}),
      antropometriaRetirada: {
        ...(registro._legado?.antropometriaRetirada ?? {}),
        ...(grasa !== undefined ? { grasa } : {}),
        ...(muscular !== undefined ? { muscular } : {}),
      },
    },
  };
}
