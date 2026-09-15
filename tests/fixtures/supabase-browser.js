// Solo pruebas de interfaz. Este archivo nunca se importa en producción.
const uid='11111111-1111-4111-8111-111111111111';
const key='browser-test-database';
const initial={
 auth_perfiles:[{user_id:uid,nombre:'Ana Administradora',activo:true,rol:'administrador'}],
 categorias:[{id:'c1',nombre:'Insumos',descripcion:'Materias primas',estado:true,version:1}],
 proveedores:[{id:'pr1',nombre:'Molino del Norte',contacto:'María',telefono:'999111222',email:'ventas@example.test',estado:true,version:1}],
 sedes:[{id:'s1',nombre:'Almacén Central',direccion:'Av. Industrial 120',estado:true,version:1},{id:'s2',nombre:'Sede Norte',estado:true,version:1}],
 productos:[{id:'p1',codigo:'HAR-001',nombre:'Harina de trigo',unidad_medida:'kg',precio:4.5,categoria_id:'c1',estado:true,version:1}],
 lotes:[{id:'l1',producto_id:'p1',codigo:'HAR-2026-09',vencimiento:'2099-10-20'}],
 inventario:[{id:'i1',producto_id:'p1',sede_id:'s1',lote_id:'l1',cantidad:25}],
 inventario_minimos:[{id:'mi1',producto_id:'p1',sede_id:'s1',minimo:10}],
 movimientos:[], operations:{}
};
function db(){return JSON.parse(localStorage.getItem(key)||JSON.stringify(initial));}
function save(value){localStorage.setItem(key,JSON.stringify(value));new BroadcastChannel('test-realtime').postMessage('change');}
function stock(data){return data.inventario.map(row=>({...row,codigo:data.productos.find(p=>p.id===row.producto_id)?.codigo,producto:data.productos.find(p=>p.id===row.producto_id)?.nombre,unidad_medida:'kg',sede:data.sedes.find(s=>s.id===row.sede_id)?.nombre,lote:data.lotes.find(l=>l.id===row.lote_id)?.codigo,vencimiento:data.lotes.find(l=>l.id===row.lote_id)?.vencimiento,total_sede:row.cantidad,stock_minimo:10}));}
function moves(data){return data.movimientos.map(row=>({...row,producto:data.productos.find(p=>p.id===row.producto_id)?.nombre,unidad_medida:'kg',sede:data.sedes.find(s=>s.id===row.sede_id)?.nombre,destino:data.sedes.find(s=>s.id===row.destino_id)?.nombre,lote:data.lotes.find(l=>l.id===row.lote_id)?.codigo}));}
class Query{
 constructor(table){this.table=table;this.conditions=[];this.start=0;this.end=Infinity;}
 select(){return this;}
 eq(key,value){this.conditions.push(row=>String(row[key])===String(value));return this;}
 gte(){return this;}lte(){return this;}or(){return this;}
 order(){return this;}
 range(start,end){this.start=start;this.end=end;return this;}
 insert(value){this.action='insert';this.value=value;return this;}
 update(value){this.action='update';this.value=value;return this;}
 maybeSingle(){this.single=true;return this;}
 then(resolve,reject){
  try{
   const data=db();let rows=this.table==='app_stock'?stock(data):this.table==='app_movimientos'?moves(data):data[this.table]||[];
   const matching=rows.filter(row=>this.conditions.every(fn=>fn(row)));
   if(this.action==='insert'){
    const row={...this.value,id:crypto.randomUUID(),version:1};data[this.table].push(row);save(data);return Promise.resolve({data:{id:row.id},error:null}).then(resolve,reject);
   }
   if(this.action==='update'){
    matching.forEach(row=>Object.assign(row,this.value,{version:row.version+1}));save(data);return Promise.resolve({data:matching[0]?{id:matching[0].id}:null,error:null}).then(resolve,reject);
   }
   return Promise.resolve({data:this.single?(matching[0]||null):matching.slice(this.start,this.end+1),count:matching.length,error:null}).then(resolve,reject);
  }catch(error){return Promise.reject(error).then(resolve,reject);}
 }
}
export const supabase={
 from(table){return new Query(table);},
 auth:{
  async getUser(){return {data:{user:{id:uid}},error:null};},
  onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};},
  async signOut(){return {error:null};}
 },
 channel(){
  const callbacks=[];const broadcast=new BroadcastChannel('test-realtime');broadcast.onmessage=()=>callbacks.forEach(fn=>fn());
  return {on(event,config,fn){callbacks.push(fn);return this;},subscribe(fn){setTimeout(()=>fn('SUBSCRIBED'),10);return this;},unsubscribe(){broadcast.close();}};
 },
 removeChannel(channel){channel.unsubscribe();},
 async rpc(name,args={}){
  const data=db();
  if(name==='app_mi_acceso')return {data:data.auth_perfiles[0],error:null};
  if(name==='app_exportar_movimientos')return {data:moves(data),error:null};
  if(name==='app_exportar_stock')return {data:stock(data),error:null};
  if(name==='app_resumen')return {data:{productos:data.productos.length,bajo_minimo:0,entradas:data.movimientos.filter(m=>m.tipo==='entrada').length,salidas:0,vencidos:0,por_vencer:0,actividad:['09','10','11','12','13','14','15'].map((day,i)=>({dia:'2026-09-'+day,total:i})),recientes:moves(data).slice(-8)},error:null};
  if(name==='app_crear_lote'){const id=crypto.randomUUID();data.lotes.push({id,producto_id:args.p_producto,codigo:args.p_codigo,vencimiento:args.p_vencimiento});save(data);return {data:id,error:null};}
  if(name==='app_configurar_minimo')return {data:null,error:null};
  if(name==='app_registrar_movimiento'){
   if(data.operations[args.p_operacion])return {data:{id:data.operations[args.p_operacion],repetido:true},error:null};
   const id=crypto.randomUUID();
   data.movimientos.push({id,fecha:new Date().toISOString(),tipo:args.p_tipo,producto_id:args.p_producto,lote_id:args.p_lote,sede_id:args.p_sede,destino_id:args.p_destino,cantidad:args.p_cantidad,responsable:'Ana Administradora',documento:args.p_documento,motivo:args.p_motivo});
   const row=data.inventario.find(i=>i.producto_id===args.p_producto&&i.lote_id===args.p_lote&&i.sede_id===args.p_sede);
   if(row)row.cantidad+=args.p_tipo==='salida'?-args.p_cantidad:args.p_cantidad;
   else data.inventario.push({id:crypto.randomUUID(),producto_id:args.p_producto,lote_id:args.p_lote,sede_id:args.p_sede,cantidad:args.p_cantidad});
   data.operations[args.p_operacion]=id;save(data);
   if(localStorage.getItem('test-network-failure')==='once'){localStorage.removeItem('test-network-failure');return {data:null,error:{message:'Failed to fetch'}};}
   return {data:{id,repetido:false},error:null};
  }
  if(name==='app_listar_usuarios')return {data:data.auth_perfiles.map(p=>({...p,email:'admin@example.test'})),error:null};
  if(name==='app_guardar_usuario')return {data:null,error:null};
  return {data:null,error:{code:'PGRST202'}};
 }
};
