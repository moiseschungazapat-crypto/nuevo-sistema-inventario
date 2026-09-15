import { supabase } from '../supabase.js';
export async function movementPage(filters, page=0, size=25) {
 let query=supabase.from('app_movimientos').select('*',{count:'exact'});
 if(filters.producto) query=query.eq('producto_id',filters.producto);
 if(filters.sede) query=query.or('sede_id.eq.'+filters.sede+',destino_id.eq.'+filters.sede);
 if(filters.tipo) query=query.eq('tipo',filters.tipo);
 if(filters.desde) query=query.gte('fecha',filters.desde+'T00:00:00-05:00');
 if(filters.hasta) query=query.lte('fecha',filters.hasta+'T23:59:59.999999-05:00');
 const {data,error,count}=await query.order('fecha',{ascending:false}).order('id',{ascending:false}).range(page*size,page*size+size-1);
 if(error) throw error;
 return {rows:data||[],count:count||0};
}
