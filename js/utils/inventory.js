import { expiryStatus } from './domain.js';
export function summarizeInventory(products, stock, minimums, categories, siteId) {
 const groups=new Map(),names=new Map(categories.map(c=>[String(c.id),c.nombre]));
 const add=p=>{
  const key=String(p.id);
  if(!groups.has(key))groups.set(key,{producto_id:key,codigo:p.codigo||'',producto:p.nombre||'',categoria:names.get(String(p.categoria_id))||'Sin categoría',unidad_medida:p.unidad_medida||'',cantidad:0,stock_minimo:0,lotes:[]});
  return groups.get(key);
 };
 products.filter(p=>p.controla_inventario!==false && p.estado!==false).forEach(add);
 for(const row of stock.filter(r=>String(r.sede_id)===String(siteId))) {
  const p=products.find(p=>String(p.id)===String(row.producto_id));
  if(p?.controla_inventario===false)continue;
  const group=add(p||{id:row.producto_id,codigo:row.codigo,nombre:row.producto,unidad_medida:row.unidad_medida});
  group.cantidad+=Number(row.cantidad)||0;group.lotes.push(row);group.stock_minimo=Number(row.stock_minimo)||0;
 }
 for(const minimum of minimums.filter(m=>String(m.sede_id)===String(siteId))) {
  const group=groups.get(String(minimum.producto_id));if(group)group.stock_minimo=Number(minimum.minimo)||0;
 }
 return [...groups.values()].map(row=>({...row,cantidad:Math.round(row.cantidad*1000)/1000})).sort((a,b)=>a.producto.localeCompare(b.producto,'es'));
}
export function inventoryStatus(row) {
 return row.cantidad<=0?{text:'Sin stock',tone:'danger'}:row.cantidad<row.stock_minimo?{text:'Stock bajo',tone:'warning'}:{text:'Normal',tone:'success'};
}
export function filterInventory(rows,{query='',filter=''},today) {
 return rows.filter(row=>{
  const matches=!query||[row.codigo,row.producto,row.categoria,...row.lotes.map(l=>l.lote)].some(v=>String(v||'').toLocaleLowerCase().includes(query));
  const stockAlert=inventoryStatus(row).tone!=='success';
  const expired=row.lotes.some(l=>Number(l.cantidad)>0 && expiryStatus(l.vencimiento,today).tone==='danger');
  const expiring=row.lotes.some(l=>Number(l.cantidad)>0 && expiryStatus(l.vencimiento,today).tone==='warning');
  return matches && (!filter || (filter==='alerts'&&(stockAlert||expired||expiring)) || (filter==='low'&&row.cantidad>0&&row.cantidad<row.stock_minimo) || (filter==='empty'&&row.cantidad<=0) || (filter==='expired'&&expired) || (filter==='expiry'&&expiring));
 });
}
