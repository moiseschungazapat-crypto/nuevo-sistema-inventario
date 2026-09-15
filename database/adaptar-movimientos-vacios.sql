-- Alternativa puntual para tu estructura actual, si prefieres ejecutar esto antes.
-- Tu consulta mostró movimientos vacía, IDs bigint y una restricción antigua de tipo.
-- Ejecuta una sola vez; después vuelve a ejecutar la migración completa.
do $$
declare c record;
begin
 for c in
  select conname from pg_constraint
  where conrelid='public.movimientos'::regclass and contype='c'
    and pg_get_constraintdef(oid) ilike '%tipo%'
 loop
  execute format('alter table public.movimientos drop constraint %I', c.conname);
 end loop;
end $$;
