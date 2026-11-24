-- Control privado de gastos: solo administradores. No altera stock ni reportes compartidos.
begin;
create table public.gastos (
 id uuid primary key,
 fecha date not null,
 concepto text not null check(length(btrim(concepto)) between 1 and 200),
 categoria text not null check(categoria in ('Mercadería','Servicios','Transporte','Mantenimiento','Personal','Alquiler','Otros')),
 monto numeric(14,2) not null check(monto>0),
 estado text not null check(estado in ('pagado','pendiente')),
 fecha_pago date,
 proveedor text not null default '' check(length(proveedor)<=200),
 observaciones text not null default '' check(length(observaciones)<=1000),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 version integer not null default 1,
 solicitud_inicial jsonb not null,
 check((estado='pagado')=(fecha_pago is not null))
);
create index gastos_fecha on public.gastos(fecha desc,id);
create table public.gastos_presupuestos (
 periodo date primary key check(extract(day from periodo)=1),
 monto numeric(14,2) not null check(monto>=0),
 version integer not null default 1,
 updated_by uuid not null references auth.users(id)
);
alter table public.gastos enable row level security;
alter table public.gastos_presupuestos enable row level security;
revoke all on public.gastos,public.gastos_presupuestos from public,anon,authenticated;
grant select on public.gastos,public.gastos_presupuestos to authenticated;
create policy gastos_admin on public.gastos for select to authenticated using((select public.app_rol())='administrador');
create policy presupuestos_admin on public.gastos_presupuestos for select to authenticated using((select public.app_rol())='administrador');
create trigger app_version before insert or update on public.gastos for each row execute function public.app_version_catalogo();
create trigger app_auditoria after insert or update on public.gastos for each row execute function public.app_auditar();
create trigger app_auditoria after insert or update on public.gastos_presupuestos for each row execute function public.app_auditar();

create function public.app_gastos_mes(p_mes date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare inicio date; fin date; result jsonb;
begin
 if public.app_rol() is distinct from 'administrador' then raise exception 'Solo el administrador o jefe autorizado puede consultar gastos.' using errcode='42501'; end if;
 if p_mes is null then raise exception 'Selecciona un mes.'; end if;
 inicio:=date_trunc('month',p_mes)::date;fin:=(inicio+interval '1 month')::date;
 select jsonb_build_object(
  'gastos',coalesce(jsonb_agg(to_jsonb(g)-'solicitud_inicial' order by g.fecha desc,g.created_at desc),'[]'),
  'total',coalesce(sum(g.monto),0),'pagado',coalesce(sum(g.monto) filter(where g.estado='pagado'),0),
  'pendiente',coalesce(sum(g.monto) filter(where g.estado='pendiente'),0),'cantidad',count(*)
 ) into result from public.gastos g where g.fecha>=inicio and g.fecha<fin;
 return result||jsonb_build_object('presupuesto',(select jsonb_build_object('monto',p.monto,'version',p.version) from public.gastos_presupuestos p where p.periodo=inicio));
end $$;

create function public.app_guardar_gasto(p_operacion uuid,p_datos jsonb,p_id uuid default null,p_version integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m numeric; f date; fp date; v_concepto text; v_categoria text; v_estado text; v_proveedor text; nota text; result public.gastos%rowtype;
begin
 if public.app_rol() is distinct from 'administrador' then raise exception 'Solo el administrador o jefe autorizado puede registrar gastos.' using errcode='42501'; end if;
 m:=(p_datos->>'monto')::numeric;f:=(p_datos->>'fecha')::date;
 v_concepto:=btrim(coalesce(p_datos->>'concepto',''));v_categoria:=p_datos->>'categoria';v_estado:=p_datos->>'estado';
 v_proveedor:=btrim(coalesce(p_datos->>'proveedor',''));nota:=btrim(coalesce(p_datos->>'observaciones',''));
 if m is null or m<=0 or m>999999999999.99 or m<>round(m,2) then raise exception 'Indica un monto válido con hasta dos decimales.'; end if;
 if f is null or f>(now() at time zone 'America/Lima')::date then raise exception 'La fecha del gasto no puede ser futura.'; end if;
 if length(v_concepto) not between 1 and 200 or length(v_proveedor)>200 or length(nota)>1000 then raise exception 'Revisa el concepto y la longitud de los campos.'; end if;
 if v_categoria is null or v_categoria not in ('Mercadería','Servicios','Transporte','Mantenimiento','Personal','Alquiler','Otros') or v_estado is null or v_estado not in ('pagado','pendiente') then raise exception 'Selecciona una categoría y un estado válidos.'; end if;
 if v_estado='pagado' then
  fp:=coalesce(nullif(p_datos->>'fecha_pago','')::date,(now() at time zone 'America/Lima')::date);
  if fp<f or fp>(now() at time zone 'America/Lima')::date then raise exception 'La fecha de pago debe estar entre la fecha del gasto y hoy.'; end if;
 end if;
 if p_id is null then
  if p_operacion is null then raise exception 'Falta el identificador del registro.'; end if;
  insert into public.gastos(id,fecha,concepto,categoria,monto,estado,fecha_pago,proveedor,observaciones,created_by,solicitud_inicial)
  values(p_operacion,f,v_concepto,v_categoria,m,v_estado,fp,v_proveedor,nota,auth.uid(),p_datos)
  on conflict(id) do nothing returning * into result;
  if not found then
   select * into result from public.gastos where id=p_operacion;
   if result.solicitud_inicial is distinct from p_datos then raise exception 'El identificador ya fue usado para otro gasto.'; end if;
  end if;
 else
  update public.gastos set fecha=f,concepto=v_concepto,categoria=v_categoria,monto=m,estado=v_estado,fecha_pago=fp,proveedor=v_proveedor,observaciones=nota
  where id=p_id and version=p_version returning * into result;
  if not found then raise exception 'Otro administrador modificó el gasto. Actualiza y vuelve a abrirlo.'; end if;
 end if;
 return to_jsonb(result)-'solicitud_inicial';
end $$;

create function public.app_pagar_gasto(p_id uuid,p_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result public.gastos%rowtype;
begin
 if public.app_rol() is distinct from 'administrador' then raise exception 'Solo el administrador puede confirmar pagos.' using errcode='42501'; end if;
 update public.gastos set estado='pagado',fecha_pago=(now() at time zone 'America/Lima')::date
 where id=p_id and version=p_version and estado='pendiente' returning * into result;
 if not found then raise exception 'El gasto cambió o ya está pagado. Actualiza la lista.'; end if;
 return to_jsonb(result)-'solicitud_inicial';
end $$;

create function public.app_presupuesto_gastos(p_mes date,p_monto numeric,p_version integer default null) returns void
language plpgsql security definer set search_path='' as $$
declare inicio date;
begin
 if public.app_rol() is distinct from 'administrador' then raise exception 'Solo el administrador puede configurar presupuestos.' using errcode='42501'; end if;
 if p_mes is null or p_monto is null or p_monto<0 or p_monto>999999999999.99 or p_monto<>round(p_monto,2) then raise exception 'Indica un mes y presupuesto válidos.'; end if;
 inicio:=date_trunc('month',p_mes)::date;
 if p_version is null then
  insert into public.gastos_presupuestos(periodo,monto,updated_by) values(inicio,p_monto,auth.uid()) on conflict(periodo) do nothing;
  if not found then raise exception 'El presupuesto cambió. Actualiza la página.'; end if;
 else
  update public.gastos_presupuestos set monto=p_monto,version=version+1,updated_by=auth.uid() where periodo=inicio and version=p_version;
  if not found then raise exception 'El presupuesto cambió. Actualiza la página.'; end if;
 end if;
end $$;
revoke all on function public.app_gastos_mes(date),public.app_guardar_gasto(uuid,jsonb,uuid,integer),public.app_pagar_gasto(uuid,integer),public.app_presupuesto_gastos(date,numeric,integer) from public,anon,authenticated;
grant execute on function public.app_gastos_mes(date),public.app_guardar_gasto(uuid,jsonb,uuid,integer),public.app_pagar_gasto(uuid,integer),public.app_presupuesto_gastos(date,numeric,integer) to authenticated;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.gastos,public.gastos_presupuestos;
 end if;
end $$;
commit;
