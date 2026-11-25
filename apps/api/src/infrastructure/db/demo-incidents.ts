// Datos demo de la empresa ficticia (RF-21, CA-07.1 a CA-07.4): usuarios adicionales e incidencias
// con su historial. Solo datos, sin lógica: los carga `seedDemoIncidents` (`seed.ts`) con los casos de
// uso reales y un reloj guionizado, así que cada paso pasa por la máquina de estados y la política.
// Todo es inventado: personas, clientes (C-nnnn), proveedores (P-nnn), pedidos y modelos de producto.
import type { Priority, Role, Status } from '@incidapp/shared';

/** Usuario adicional: actor creíble en otro departamento. No se puede entrar con él (contraseña aleatoria). */
export interface DemoStaffUser {
  readonly email: string;
  readonly name: string;
  readonly role: Extract<Role, 'MANAGER' | 'USER'>;
  readonly departmentCodes: readonly string[];
}

/** Momento de un paso: días antes del día del *seed* (≥ 1) y hora `HH:MM` (UTC). */
export type DemoMoment = readonly [daysAgo: number, time: string];

export type DemoStep =
  | {
      readonly action: 'assign';
      readonly at: DemoMoment;
      readonly actor: string;
      readonly assignee: string;
    }
  | {
      readonly action: 'transition';
      readonly at: DemoMoment;
      readonly actor: string;
      readonly to: Status;
      readonly comment?: string;
    };

export interface DemoIncident {
  /** Con el creador, identifica la incidencia demo: si ya existe, el *seed* no la vuelve a cargar. */
  readonly title: string;
  readonly description: string;
  /** Código del tipo (`INCIDENT_TYPES`): decide el departamento propietario. */
  readonly typeCode: string;
  readonly priority: Priority;
  /** Email del creador. */
  readonly createdBy: string;
  readonly createdAt: DemoMoment;
  /** Fecha objetivo en días desde el día del *seed* (negativa si ya venció). */
  readonly dueInDays?: number;
  /** Pasos en orden cronológico, cada uno con su actor (email). */
  readonly steps: readonly DemoStep[];
}

// Usuarios demo de `@incidapp/shared` (los que aparecen en el login).
const ADMIN = 'admin@incidapp.test';
const LOG_MANAGER = 'responsable@incidapp.test';
const LOG_USER = 'usuario@incidapp.test';

// Usuarios adicionales.
const ATC_MANAGER = 'marta.soler@incidapp.test';
const ATC_USER = 'diego.navarro@incidapp.test';
const COMP_MANAGER = 'raul.dominguez@incidapp.test';
const COMP_USER = 'sara.iglesias@incidapp.test';
const CAL_MANAGER = 'nuria.campos@incidapp.test';
const CAL_USER = 'ivan.rubio@incidapp.test';
const TEC_MANAGER = 'alberto.santos@incidapp.test';
const TEC_USER = 'lucia.herrera@incidapp.test';

/** Responsable y Usuario de ATC, COMP, CAL y TEC (decisión 1 de la spec de F07). */
export const DEMO_STAFF: readonly DemoStaffUser[] = [
  { email: ATC_MANAGER, name: 'Marta Soler', role: 'MANAGER', departmentCodes: ['ATC'] },
  { email: ATC_USER, name: 'Diego Navarro', role: 'USER', departmentCodes: ['ATC'] },
  { email: COMP_MANAGER, name: 'Raúl Domínguez', role: 'MANAGER', departmentCodes: ['COMP'] },
  { email: COMP_USER, name: 'Sara Iglesias', role: 'USER', departmentCodes: ['COMP'] },
  { email: CAL_MANAGER, name: 'Nuria Campos', role: 'MANAGER', departmentCodes: ['CAL'] },
  { email: CAL_USER, name: 'Iván Rubio', role: 'USER', departmentCodes: ['CAL'] },
  { email: TEC_MANAGER, name: 'Alberto Santos', role: 'MANAGER', departmentCodes: ['TEC'] },
  { email: TEC_USER, name: 'Lucía Herrera', role: 'USER', departmentCodes: ['TEC'] },
];

/**
 * Incidencias demo. Las de Transporte (LOG) cubren los 7 estados para el Responsable demo; el
 * Usuario demo crea algunas de otros departamentos y tiene varias asignadas.
 */
export const DEMO_INCIDENTS: readonly DemoIncident[] = [
  // ── Transporte · LOG ────────────────────────────────────────────────────────────────────────
  {
    title: 'Mercancía dañada en la entrega al cliente C-1042',
    description:
      'El cliente C-1042 avisa de que dos de las cinco cajas del pedido PV-26-0861 llegaron con golpes y el producto rayado. Ha enviado fotos al comercial y pide la reposición.',
    typeCode: 'TRANSPORT',
    priority: 'HIGH',
    createdBy: LOG_USER,
    createdAt: [1, '08:40'],
    steps: [],
  },
  {
    title: 'Retraso en la recogida de la ruta de Levante',
    description:
      'La agencia de transporte no ha pasado a recoger los palés de la ruta de Levante a la hora acordada. Hay seis pedidos preparados en el muelle 2.',
    typeCode: 'TRANSPORT',
    priority: 'MEDIUM',
    createdBy: LOG_MANAGER,
    createdAt: [2, '09:10'],
    dueInDays: 2,
    steps: [{ action: 'assign', at: [2, '09:25'], actor: LOG_MANAGER, assignee: LOG_USER }],
  },
  {
    title: 'Entrega errónea: el cliente C-2210 ha recibido el pedido de otro cliente',
    description:
      'Se intercambiaron las etiquetas de dos expediciones del mismo día. El cliente C-2210 ha recibido el pedido PV-26-0844 y el suyo está en otra provincia.',
    typeCode: 'TRANSPORT',
    priority: 'URGENT',
    createdBy: LOG_MANAGER,
    createdAt: [6, '11:05'],
    dueInDays: 1,
    steps: [
      { action: 'assign', at: [6, '11:20'], actor: LOG_MANAGER, assignee: LOG_USER },
      { action: 'transition', at: [6, '12:00'], actor: LOG_USER, to: 'IN_PROGRESS' },
    ],
  },
  {
    title: 'Falta un bulto en la expedición EXP-26-1187',
    description:
      'El albarán de la expedición EXP-26-1187 indica cuatro bultos y el cliente solo ha recibido tres. En el almacén no queda ninguno de ese pedido.',
    typeCode: 'TRANSPORT',
    priority: 'HIGH',
    createdBy: LOG_USER,
    createdAt: [9, '10:30'],
    steps: [
      { action: 'assign', at: [9, '11:00'], actor: LOG_MANAGER, assignee: LOG_USER },
      { action: 'transition', at: [9, '11:30'], actor: LOG_USER, to: 'IN_PROGRESS' },
      {
        action: 'transition',
        at: [8, '16:10'],
        actor: LOG_USER,
        to: 'PENDING_THIRD_PARTY',
        comment:
          'Reclamado a la agencia de transporte: están buscando el bulto en su nave de tránsito.',
      },
    ],
  },
  {
    title: 'Albarán sin firmar en la entrega del pedido PV-26-0815',
    description:
      'El conductor no recogió la firma del cliente en el albarán del pedido PV-26-0815 y Administración no puede cerrar la factura.',
    typeCode: 'TRANSPORT',
    priority: 'LOW',
    createdBy: LOG_USER,
    createdAt: [12, '09:00'],
    steps: [
      { action: 'transition', at: [12, '09:30'], actor: LOG_USER, to: 'IN_PROGRESS' },
      {
        action: 'transition',
        at: [11, '13:20'],
        actor: LOG_USER,
        to: 'RESOLVED',
        comment:
          'La agencia ha enviado el albarán firmado escaneado y se ha archivado con el pedido.',
      },
    ],
  },
  {
    title: 'Camión sin plataforma elevadora para la descarga en obra',
    description:
      'El camión que llevaba el pedido a la obra del cliente C-3890 no tenía plataforma elevadora y no se pudo descargar. El cliente pide una nueva entrega.',
    typeCode: 'TRANSPORT',
    priority: 'MEDIUM',
    createdBy: LOG_MANAGER,
    createdAt: [20, '08:15'],
    steps: [
      { action: 'assign', at: [20, '08:30'], actor: LOG_MANAGER, assignee: LOG_USER },
      { action: 'transition', at: [20, '10:00'], actor: LOG_USER, to: 'IN_PROGRESS' },
      {
        action: 'transition',
        at: [19, '12:45'],
        actor: LOG_USER,
        to: 'RESOLVED',
        comment:
          'Nueva entrega hecha con un camión con plataforma. Se añade el requisito a la ficha del cliente.',
      },
      { action: 'transition', at: [18, '09:00'], actor: LOG_MANAGER, to: 'CLOSED' },
    ],
  },
  {
    title: 'Retraso en la entrega del pedido PV-26-0790',
    description: 'El cliente C-1520 pregunta por su pedido, que esperaba recibir esta semana.',
    typeCode: 'TRANSPORT',
    priority: 'LOW',
    createdBy: LOG_USER,
    createdAt: [15, '17:20'],
    steps: [
      {
        action: 'transition',
        at: [14, '09:10'],
        actor: LOG_MANAGER,
        to: 'REJECTED',
        comment:
          'No es una incidencia: la fecha de entrega acordada con el cliente es el viernes. Se informa al comercial.',
      },
    ],
  },
  {
    title: 'Rotura de embalaje en los envíos a las islas',
    description:
      'En el último mes, tres envíos a las islas han llegado con el embalaje roto. El transporte combina barco y camión, con varias manipulaciones.',
    typeCode: 'TRANSPORT',
    priority: 'HIGH',
    createdBy: LOG_MANAGER,
    createdAt: [25, '10:00'],
    dueInDays: 3,
    steps: [
      { action: 'assign', at: [25, '10:15'], actor: LOG_MANAGER, assignee: LOG_USER },
      { action: 'transition', at: [24, '09:00'], actor: LOG_USER, to: 'IN_PROGRESS' },
      {
        action: 'transition',
        at: [24, '12:00'],
        actor: LOG_USER,
        to: 'PENDING_THIRD_PARTY',
        comment: 'Pedidas muestras de caja de doble canal al proveedor de embalaje.',
      },
      { action: 'transition', at: [22, '10:30'], actor: LOG_USER, to: 'IN_PROGRESS' },
      {
        action: 'transition',
        at: [21, '16:00'],
        actor: LOG_USER,
        to: 'RESOLVED',
        comment: 'Se cambia a caja de doble canal con esquineros en todos los envíos a las islas.',
      },
      { action: 'transition', at: [20, '09:30'], actor: LOG_MANAGER, to: 'CLOSED' },
      {
        action: 'transition',
        at: [5, '11:45'],
        actor: LOG_MANAGER,
        to: 'REOPENED',
        comment:
          'Dos envíos de esta semana han vuelto a llegar con el embalaje roto. Hay que revisar la solución.',
      },
    ],
  },

  // ── Proveedor · COMP ────────────────────────────────────────────────────────────────────────
  {
    title: 'Tornillería del proveedor P-207 con la rosca defectuosa',
    description:
      'En la recepción del pedido de compra OC-26-0412 se han encontrado varias cajas de tornillos M8 con la rosca mal tallada. El lote está apartado en la zona de cuarentena.',
    typeCode: 'SUPPLIER',
    priority: 'HIGH',
    createdBy: LOG_USER,
    createdAt: [10, '09:45'],
    steps: [
      { action: 'assign', at: [10, '11:00'], actor: COMP_MANAGER, assignee: COMP_USER },
      { action: 'transition', at: [9, '09:15'], actor: COMP_USER, to: 'IN_PROGRESS' },
      {
        action: 'transition',
        at: [9, '13:30'],
        actor: COMP_USER,
        to: 'PENDING_THIRD_PARTY',
        comment: 'Pedida al proveedor la sustitución del lote; queda en confirmar la fecha.',
      },
    ],
  },
  {
    title: 'Retraso de tres semanas en el pedido de chapa galvanizada OC-26-0388',
    description:
      'El proveedor P-031 no ha servido la chapa galvanizada en la fecha comprometida y Producción solo tiene material para cuatro días.',
    typeCode: 'SUPPLIER',
    priority: 'URGENT',
    createdBy: COMP_USER,
    createdAt: [17, '12:00'],
    steps: [
      { action: 'assign', at: [17, '12:30'], actor: COMP_MANAGER, assignee: COMP_USER },
      { action: 'transition', at: [17, '13:00'], actor: COMP_USER, to: 'IN_PROGRESS' },
      {
        action: 'transition',
        at: [13, '10:00'],
        actor: COMP_USER,
        to: 'RESOLVED',
        comment:
          'Material recibido el lunes. Se acuerda con el proveedor una penalización para próximos retrasos.',
      },
      { action: 'transition', at: [12, '09:00'], actor: COMP_MANAGER, to: 'CLOSED' },
    ],
  },
  {
    title: 'Precio unitario distinto del ofertado en el pedido OC-26-0455',
    description:
      'La confirmación del proveedor P-118 trae un precio unitario un 8 % superior al de su oferta. Hay que aclararlo antes de aceptar el pedido.',
    typeCode: 'SUPPLIER',
    priority: 'MEDIUM',
    createdBy: COMP_MANAGER,
    createdAt: [3, '16:30'],
    dueInDays: 4,
    steps: [],
  },
  {
    title: 'El proveedor P-115 envía cajas de cartón de un tamaño distinto al pedido',
    description:
      'Las cajas recibidas miden 40 × 30 cm en lugar de 60 × 40 cm. No sirven para el embalaje del producto terminado.',
    typeCode: 'SUPPLIER',
    priority: 'LOW',
    createdBy: COMP_USER,
    createdAt: [22, '09:00'],
    steps: [
      { action: 'assign', at: [22, '09:30'], actor: COMP_MANAGER, assignee: COMP_USER },
      { action: 'transition', at: [22, '10:00'], actor: COMP_USER, to: 'IN_PROGRESS' },
      {
        action: 'transition',
        at: [21, '12:00'],
        actor: COMP_USER,
        to: 'RESOLVED',
        comment: 'El proveedor repone el material correcto sin coste y retira las cajas erróneas.',
      },
      { action: 'transition', at: [20, '10:00'], actor: COMP_MANAGER, to: 'CLOSED' },
    ],
  },

  // ── Cliente / Reclamación · ATC ─────────────────────────────────────────────────────────────
  {
    title: 'Queja del cliente C-3315 por el plazo de respuesta del servicio postventa',
    description:
      'El cliente C-3315 llamó tres veces la semana pasada sin que nadie le devolviera la llamada. Está molesto y amenaza con no renovar el contrato de mantenimiento.',
    typeCode: 'CUSTOMER',
    priority: 'MEDIUM',
    createdBy: ATC_USER,
    createdAt: [23, '10:20'],
    steps: [
      { action: 'assign', at: [23, '11:00'], actor: ATC_MANAGER, assignee: ATC_USER },
      { action: 'transition', at: [23, '11:30'], actor: ATC_USER, to: 'IN_PROGRESS' },
      {
        action: 'transition',
        at: [22, '17:00'],
        actor: ATC_USER,
        to: 'RESOLVED',
        comment: 'Llamado el cliente para disculparnos; se le da prioridad en la próxima visita.',
      },
      { action: 'transition', at: [21, '09:15'], actor: ATC_MANAGER, to: 'CLOSED' },
    ],
  },
  {
    title: 'Devolución de 12 unidades del modelo CL-200 por color distinto al pedido',
    description:
      'El cliente C-2876 pidió el acabado gris grafito y ha recibido el blanco. Solicita la devolución y una nueva entrega antes de fin de mes.',
    typeCode: 'CUSTOMER',
    priority: 'HIGH',
    createdBy: ATC_USER,
    createdAt: [7, '09:30'],
    dueInDays: 5,
    steps: [
      { action: 'assign', at: [7, '10:00'], actor: ATC_MANAGER, assignee: ATC_USER },
      { action: 'transition', at: [6, '09:00'], actor: ATC_USER, to: 'IN_PROGRESS' },
    ],
  },
  {
    title: 'Solicitud de devolución fuera de plazo del cliente C-2876',
    description:
      'El cliente quiere devolver un equipo CL-120 que se le entregó hace dos meses porque ya no lo necesita.',
    typeCode: 'CUSTOMER',
    priority: 'LOW',
    createdBy: ATC_MANAGER,
    createdAt: [4, '12:15'],
    steps: [
      {
        action: 'transition',
        at: [3, '10:00'],
        actor: ATC_MANAGER,
        to: 'REJECTED',
        comment:
          'Han pasado más de 30 días desde la entrega. Se le ofrece una revisión técnica gratuita en su lugar.',
      },
    ],
  },
  {
    title: 'El cliente C-1520 recibe la documentación de garantía en inglés',
    description:
      'Con el último equipo entregado al cliente C-1520 se envió la documentación de garantía solo en inglés. Pide la versión en español.',
    typeCode: 'CUSTOMER',
    priority: 'LOW',
    createdBy: ATC_USER,
    createdAt: [1, '17:05'],
    steps: [],
  },
  {
    title: 'El cliente C-4102 reclama la visita técnica comprometida para esta semana',
    description:
      'Se le prometió una visita para revisar la instalación y nadie le ha llamado para concretar el día.',
    typeCode: 'CUSTOMER',
    priority: 'HIGH',
    createdBy: ATC_MANAGER,
    createdAt: [11, '10:45'],
    steps: [
      { action: 'assign', at: [11, '11:00'], actor: ATC_MANAGER, assignee: ATC_USER },
      { action: 'transition', at: [11, '11:30'], actor: ATC_USER, to: 'IN_PROGRESS' },
      {
        action: 'transition',
        at: [10, '17:00'],
        actor: ATC_USER,
        to: 'RESOLVED',
        comment:
          'Visita coordinada con el Departamento Técnico para el jueves; el cliente está conforme.',
      },
    ],
  },

  // ── Calidad · CAL ───────────────────────────────────────────────────────────────────────────
  {
    title: 'Etiquetas de lote ilegibles en los palés de producto terminado',
    description:
      'Al preparar los envíos de hoy se ve que las etiquetas de lote de 14 palés salen borrosas y el lector no las reconoce.',
    typeCode: 'QUALITY',
    priority: 'MEDIUM',
    createdBy: LOG_USER,
    createdAt: [13, '08:50'],
    steps: [
      { action: 'assign', at: [13, '10:00'], actor: CAL_MANAGER, assignee: CAL_USER },
      { action: 'transition', at: [12, '09:30'], actor: CAL_USER, to: 'IN_PROGRESS' },
      {
        action: 'transition',
        at: [10, '12:00'],
        actor: CAL_USER,
        to: 'RESOLVED',
        comment:
          'Sustituido el cabezal de la impresora de etiquetas y reetiquetados los 14 palés afectados.',
      },
    ],
  },
  {
    title: 'No conformidad interna: soldaduras fuera de tolerancia en el bastidor B-40',
    description:
      'La inspección de control del lote 26-118 encuentra cordones de soldadura fuera de tolerancia en 5 de 20 bastidores B-40.',
    typeCode: 'QUALITY',
    priority: 'URGENT',
    createdBy: CAL_USER,
    createdAt: [19, '11:40'],
    steps: [
      { action: 'assign', at: [19, '12:00'], actor: CAL_MANAGER, assignee: CAL_USER },
      { action: 'transition', at: [19, '12:30'], actor: CAL_USER, to: 'IN_PROGRESS' },
      {
        action: 'transition',
        at: [16, '15:00'],
        actor: CAL_USER,
        to: 'RESOLVED',
        comment: 'Recalibrado el robot de soldadura y revisado el lote: 3 bastidores retirados.',
      },
      {
        action: 'transition',
        at: [15, '09:00'],
        actor: CAL_MANAGER,
        to: 'IN_PROGRESS',
        comment:
          'La medición de control sigue dando 2 piezas fuera de tolerancia: hay que revisar también el utillaje.',
      },
      {
        action: 'transition',
        at: [11, '13:00'],
        actor: CAL_USER,
        to: 'RESOLVED',
        comment:
          'Sustituido el utillaje de sujeción; las mediciones de los dos últimos lotes son correctas.',
      },
      { action: 'transition', at: [10, '09:00'], actor: CAL_MANAGER, to: 'CLOSED' },
    ],
  },
  {
    title: 'Registros de calibración incompletos en el laboratorio',
    description:
      'La auditoría interna de noviembre detecta que faltan los registros de calibración de dos calibres y un micrómetro.',
    typeCode: 'QUALITY',
    priority: 'MEDIUM',
    createdBy: CAL_MANAGER,
    createdAt: [2, '13:00'],
    dueInDays: 10,
    steps: [{ action: 'assign', at: [2, '13:20'], actor: CAL_MANAGER, assignee: CAL_USER }],
  },

  // ── Técnica / Instalación · TEC ─────────────────────────────────────────────────────────────
  {
    title: 'Avería en el equipo CL-350 instalado en la obra del cliente C-4102',
    description:
      'El equipo se detiene con un código de error de la placa de control. El cliente no puede usar la instalación por las tardes.',
    typeCode: 'TECHNICAL',
    priority: 'URGENT',
    createdBy: ATC_USER,
    createdAt: [16, '10:10'],
    steps: [
      { action: 'assign', at: [16, '10:30'], actor: TEC_MANAGER, assignee: TEC_USER },
      { action: 'transition', at: [16, '11:00'], actor: TEC_USER, to: 'IN_PROGRESS' },
      {
        action: 'transition',
        at: [15, '18:00'],
        actor: TEC_USER,
        to: 'PENDING_THIRD_PARTY',
        comment: 'Pendiente de recibir la placa de control de repuesto.',
      },
      { action: 'transition', at: [11, '09:00'], actor: TEC_USER, to: 'IN_PROGRESS' },
      {
        action: 'transition',
        at: [11, '14:30'],
        actor: TEC_USER,
        to: 'RESOLVED',
        comment: 'Sustituida la placa de control y probado el equipo con el cliente.',
      },
      { action: 'transition', at: [9, '10:00'], actor: TEC_MANAGER, to: 'CLOSED' },
      {
        action: 'transition',
        at: [3, '09:40'],
        actor: TEC_MANAGER,
        to: 'REOPENED',
        comment: 'El cliente avisa de que el equipo vuelve a pararse por la noche.',
      },
    ],
  },
  {
    title: 'Fallo en la puesta en marcha de la instalación de la nave 3 del cliente C-3890',
    description:
      'En la puesta en marcha, dos de los cuatro equipos no arrancan. Las primeras pruebas apuntan a la tensión de la acometida.',
    typeCode: 'TECHNICAL',
    priority: 'HIGH',
    createdBy: TEC_USER,
    createdAt: [8, '08:30'],
    steps: [
      { action: 'assign', at: [8, '09:00'], actor: TEC_MANAGER, assignee: TEC_USER },
      { action: 'transition', at: [8, '09:15'], actor: TEC_USER, to: 'IN_PROGRESS' },
      {
        action: 'transition',
        at: [7, '12:00'],
        actor: TEC_USER,
        to: 'PENDING_THIRD_PARTY',
        comment: 'Esperando a que el cliente termine la acometida eléctrica.',
      },
    ],
  },
  {
    title: 'Revisión de garantía solicitada por el cliente C-2210',
    description:
      'El cliente pide revisar un equipo CL-200 que hace más ruido de lo normal. Está dentro del periodo de garantía.',
    typeCode: 'TECHNICAL',
    priority: 'LOW',
    createdBy: TEC_MANAGER,
    createdAt: [5, '15:00'],
    dueInDays: 14,
    steps: [],
  },
  {
    title: 'Error en el esquema eléctrico del manual de instalación del modelo CL-350',
    description:
      'Los instaladores avisan de que el esquema de la página 14 no coincide con el cableado real del equipo.',
    typeCode: 'TECHNICAL',
    priority: 'MEDIUM',
    createdBy: TEC_MANAGER,
    createdAt: [26, '09:00'],
    steps: [
      { action: 'assign', at: [26, '09:30'], actor: TEC_MANAGER, assignee: TEC_USER },
      { action: 'transition', at: [25, '10:00'], actor: TEC_USER, to: 'IN_PROGRESS' },
      {
        action: 'transition',
        at: [21, '11:00'],
        actor: TEC_USER,
        to: 'RESOLVED',
        comment: 'Corregido el esquema y publicada la revisión B del manual.',
      },
      { action: 'transition', at: [19, '09:00'], actor: TEC_MANAGER, to: 'CLOSED' },
    ],
  },

  // ── Administrativa · ADM ────────────────────────────────────────────────────────────────────
  {
    title: 'Factura duplicada al cliente C-3315',
    description:
      'Al cliente C-3315 se le han emitido dos facturas por el mismo pedido y se le ha cobrado dos veces el recibo.',
    typeCode: 'ADMINISTRATIVE',
    priority: 'HIGH',
    createdBy: ATC_MANAGER,
    createdAt: [18, '10:00'],
    steps: [
      { action: 'assign', at: [18, '10:30'], actor: ADMIN, assignee: ADMIN },
      { action: 'transition', at: [18, '11:00'], actor: ADMIN, to: 'IN_PROGRESS' },
      {
        action: 'transition',
        at: [17, '12:00'],
        actor: ADMIN,
        to: 'RESOLVED',
        comment: 'Emitida la factura rectificativa y devuelto el cobro duplicado.',
      },
      { action: 'transition', at: [16, '09:00'], actor: ADMIN, to: 'CLOSED' },
    ],
  },
  {
    title: 'Cobro pendiente del pedido PV-26-0731 vencido hace 45 días',
    description:
      'El cliente C-1042 no ha pagado la factura del pedido PV-26-0731 y no responde al primer aviso.',
    typeCode: 'ADMINISTRATIVE',
    priority: 'MEDIUM',
    createdBy: COMP_MANAGER,
    createdAt: [6, '13:30'],
    dueInDays: -2,
    steps: [
      { action: 'assign', at: [6, '14:00'], actor: ADMIN, assignee: ADMIN },
      { action: 'transition', at: [5, '09:30'], actor: ADMIN, to: 'IN_PROGRESS' },
      {
        action: 'transition',
        at: [5, '10:15'],
        actor: ADMIN,
        to: 'PENDING_THIRD_PARTY',
        comment: 'Enviado el segundo aviso; esperando respuesta del cliente.',
      },
    ],
  },
  {
    title: 'Certificado del seguro de mercancías caducado en la documentación de transporte',
    description:
      'La agencia de transporte pide el certificado del seguro de mercancías en vigor; el que tiene es del año pasado.',
    typeCode: 'ADMINISTRATIVE',
    priority: 'MEDIUM',
    createdBy: LOG_MANAGER,
    createdAt: [4, '09:00'],
    dueInDays: 7,
    steps: [],
  },

  // ── Interna / Operativa · PROD (sin personal propio: la trabaja el Admin) ───────────────────
  {
    title: 'Carretilla elevadora 2 con fuga de aceite hidráulico',
    description:
      'La carretilla 2 deja manchas de aceite en el pasillo B. Se ha retirado del servicio y se ha señalizado la zona.',
    typeCode: 'INTERNAL',
    priority: 'HIGH',
    createdBy: LOG_MANAGER,
    createdAt: [14, '07:50'],
    steps: [
      { action: 'transition', at: [14, '09:00'], actor: ADMIN, to: 'IN_PROGRESS' },
      {
        action: 'transition',
        at: [12, '16:00'],
        actor: ADMIN,
        to: 'RESOLVED',
        comment: 'El servicio de mantenimiento ha cambiado el latiguillo hidráulico.',
      },
      { action: 'transition', at: [11, '09:00'], actor: ADMIN, to: 'CLOSED' },
    ],
  },
  {
    title: 'Compresor de la línea de pintura con paradas intermitentes',
    description:
      'El compresor de la línea de pintura se para varias veces por turno y la línea pierde unos 40 minutos al día.',
    typeCode: 'INTERNAL',
    priority: 'URGENT',
    createdBy: CAL_USER,
    createdAt: [9, '08:00'],
    steps: [{ action: 'transition', at: [9, '08:30'], actor: ADMIN, to: 'IN_PROGRESS' }],
  },
  {
    title: 'Procedimiento para el préstamo de herramientas del taller',
    description:
      'Se propone un registro de entrada y salida de las herramientas del taller para que no se pierdan.',
    typeCode: 'INTERNAL',
    priority: 'LOW',
    createdBy: TEC_USER,
    createdAt: [1, '12:30'],
    steps: [
      {
        action: 'transition',
        at: [1, '15:00'],
        actor: ADMIN,
        to: 'REJECTED',
        comment:
          'No es una incidencia: se tratará como propuesta de mejora en la reunión de procesos.',
      },
    ],
  },
];
