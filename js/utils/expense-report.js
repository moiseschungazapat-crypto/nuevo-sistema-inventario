// Agrega importes en céntimos y mantiene separadas las unidades físicas.
export function expenseReportRows(expenses){
 const groups=new Map();
 for(const row of expenses){
  const key=JSON.stringify([row.producto_codigo||'',row.producto_nombre||row.concepto,row.unidad||'',row.categoria]);
  if(!groups.has(key))groups.set(key,{codigo:row.producto_codigo||'',nombre:row.producto_nombre||row.concepto,categoria:row.categoria,cantidad:row.cantidad==null?null:0,unidad:row.unidad||'',cents:0});
  const group=groups.get(key);group.cents+=Math.round(Number(row.monto)*100);
  if(row.cantidad!=null)group.cantidad+=Number(row.cantidad);
 }
 return Array.from(groups.values()).sort((a,b)=>b.cents-a.cents).map(row=>[row.codigo,row.nombre,row.categoria,row.cantidad==null?null:Math.round(row.cantidad*1000)/1000,row.unidad,row.cents/100]);
}
