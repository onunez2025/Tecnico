export interface TechnicalAssignment {
  ID_Tablero: string;
  Fecha_programada: string;
  Tecnico: string;
  Ayudante?: string;
  Chofer?: string;
  Placa?: string;
  Auxiliar?: string;
  Tipo?: string;
}

export interface TicketPago {
  ID_transaccion: string;
  Fecha_creacion: string;
  Ticket: string;
  Fecha_transaccion: string;
  Canal: 'POS' | 'Link' | 'Transferencia' | 'Efectivo' | 'DEPÓSITO';
  Importe: string;
  Voucher?: string;
  Lote?: string;
  Codigo_Izipay?: string;
  CodigoAutorizacion?: string;
  Codigo_transaccion?: string;
  Folio?: string;
  Adjunto?: string;
  Estado: 'NUEVO' | 'APROBADO' | 'LIQUIDADO' | 'LIQUIDADO_OBSERVADO' | 'RECHAZADO' | 'REVISAR' | 'COTIZACION GENERADA' | 'RECEPCIONADO' | 'OBSERVADO' | 'PENDIENTE_APROBACION';
  Fecha_liquidacion?: string;
  Fecha_recepcion?: string;
  Fecha_Facturacion?: string;
  FechaVisita?: string;
  MotivoAlerta?: string;
  TipoServicio?: string;
  Observacion?: string;
  Aprobacion_Comentario?: string;
  Aprobacion_Por?: string;
  Aprobacion_El?: string;
}

export type Permission =
  | 'tec.config.users'
  | 'tec.config.roles'
  | 'tec.config.audit'
  | 'tec.tickets.view'
  | 'tec.dashboard.view'
  | 'tec.payments.view'
  | 'tec.payments.view.all'
  | 'tec.payments.register';

export interface SessionConfig {
  timeoutMinutes: number;
  warningMinutes: number;
}

export interface User {
  id: string;
  full_name: string;
  username: string;
  email: string;
  password_hash?: string;
  role_id: string;
  role_name?: string;
  role?: string;
  management_id: string;
  management_name?: string;
  is_active: boolean;
  created_at: string;
  theme: string;
  avatar_url?: string;
  permissions?: Permission[];
  requires_password_change?: boolean;
  apps?: string;
}

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
  apps?: string;
}

export interface Management {
  id: string;
  name: string;
  code: string;
}
export interface POSReport {
  Codigo: string;
  Tipo_de_movimiento: string;
  Tipo_de_captura: string;
  Transaccion: string;
  Fecha_de_transaccion: string;
  Hora_de_transaccion: string;
  Fecha_de_cierre_de_lote: string;
  Fecha_de_proceso: string;
  Fecha_de_abono: string;
  Estado: string;
  Importe: string;
  Comision: string;
  IGV: string;
  Importe_neto: string;
  Abono_del_lote: string;
  Num_de_lote: string;
  Terminal: string;
  Num_de_ref_voucher: string;
  Marca_de_tarjeta: string;
  Num_de_tarjeta: string;
  Codigo_de_autorizacion: string;
  Cuotas: string;
  Observaciones: string;
  Moneda: string;
  Serie_terminal: string;
  // Match fields
  MatchedTicket?: string;
  MatchedStatus?: string;
  MatchedID?: string;
  MatchedFolio?: string;
}

export interface AssignedTicket {
  id: string;
  LlamadaFSM?: string;
  Asunto?: string;
  Estado?: string;
  FechaVisita?: string;
  FechaUltimaModificacion?: string;
  IdServicio?: string;
  Servicio?: string;
  IdCliente?: string;
  CodigoExternoCliente?: string;
  Cliente?: string;
  Email?: string;
  Celular1?: string;
  Celular2?: string;
  Telefono1?: string;
  Calle?: string;
  NumeroCalle?: string;
  Distrito?: string;
  Ciudad?: string;
  Pais?: string;
  CodigoPostal?: string;
  Referencia?: string;
  IdEquipo?: string;
  CodigoExternoEquipo?: string;
  NombreEquipo?: string;
  ComentarioProgramador?: string;
  IdCAS?: string;
  CAS?: string;
  CodigoTecnico?: string;
  NombreTecnico?: string;
  ApellidoTecnico?: string;
  VisitaRealizada?: string;
  TrabajoRealizado?: string;
  SolicitaNuevaVisita?: string;
  MotivoNuevaVisita?: string;
  CodMotivoIncidente?: string;
  FechaModificacionIT?: string;
  ComentarioTecnico?: string;
  CheckOut?: string;
  Latitud?: string;
  Longitud?: string;
  RangoHorario?: string;
  OrdenAtencion?: string;
  ComentarioHorario?: string;
  tienePago?: boolean;
}
