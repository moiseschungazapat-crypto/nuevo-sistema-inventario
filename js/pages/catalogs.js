import { allRows, saveRecord } from '../services/data.js';
import { heading, field, openEditor, options, e, badge, table, pager, notice, loadError } from '../components/ui.js';
import { quantity } from '../utils/domain.js';
export const catalogConfig = {
 categorias: {title:'Categorías', singular:'categoría', description:'Organiza los productos y conserva su clasificación.', fields:[['nombre','Nombre'],['descripcion','Descripción','textarea']], columns:['Nombre','Descripción','Estado']},
 proveedores: {title:'Proveedores', singular:'proveedor', description:'Directorio de empresas y contactos de abastecimiento.', fields:[['nombre','Razón social / nombre'],['documento','RUC / documento'],['contacto','Persona de contacto'],['telefono','Teléfono','tel'],['email','Correo','email'],['direccion','Dirección']], columns:['Proveedor','Documento','Contacto','Teléfono','Correo','Estado']},
 sedes: {title:'Sedes', singular:'sede', description:'Locales y almacenes que comparten este inventario.', fields:[['nombre','Nombre'],['direccion','Dirección'],['responsable','Responsable']], columns:['Sede','Dirección','Responsable','Estado']},
 productos: {title:'Productos', singular:'producto', description:'Catálogo compartido. Las cantidades se registran mediante movimientos.', fields:[['codigo','Código / SKU'],['nombre','Nombre'],['descripcion','Descripción','textarea'],['precio','Precio de referencia (S/)','number']], columns:['Código','Producto','Categoría','Unidad','Precio de referencia','Estado']},
};
export async function catalogPage(root, section, access) {
 const config = catalogConfig[section], canWrite = access.rol !== 'consulta';
 let rows = [], categories = [], page = 0;
 root.innerHTML = heading(config.title, config.description, canWrite ? '<button class="button primary" id="new-record">+ Nuevo registro</button>':'') +
 '<section class="panel"><div class="toolbar"><label class="search-label">Buscar<input type="search" id="search" placeholder="Nombre, código o contacto…"></label><label>Estado<select id="status"><option value="">Todos</option><option value="true">Activos</option><option value="false">Inactivos</option></select></label><button class="button" id="refresh">Actualizar</button></div><div id="results"></div><div id="pager" class="pagination"></div></section>';
 function render() {
  const query = root.querySelector('#search').value.toLocaleLowerCase().trim(), status = root.querySelector('#status').value;
  const filtered = rows.filter(row => (status==='' || String(row.estado)===status) && [row.nombre,row.codigo,row.contacto,row.documento,row.email].some(v=>String(v||'').toLocaleLowerCase().includes(query)));
  page = Math.min(page, Math.max(0, Math.ceil(filtered.length/20)-1));
  const content = filtered.slice(page*20,(page+1)*20).map(row=>{
   const state = badge(row.estado?'Activo':'Inactivo',row.estado?'success':'neutral');
   let cells;
   if(section==='categorias') cells=[e(row.nombre), e(row.descripcion||'—'),state];
   if(section==='proveedores') cells=[e(row.nombre),e(row.documento||'—'),e(row.contacto||'—'),e(row.telefono||'—'),e(row.email||'—'),state];
   if(section==='sedes') cells=[e(row.nombre),e(row.direccion||'—'),e(row.responsable||'—'),state];
   if(section==='productos') cells=[e(row.codigo),e(row.nombre),e(categories.find(c=>String(c.id)===String(row.categoria_id))?.nombre||'Sin categoría'),e(row.unidad_medida),'S/ '+quantity(row.precio),state];
   if(canWrite) cells.push(`<button class="button small" data-edit="${e(row.id)}">Editar</button>`);
   return cells;
  });
  root.querySelector('#results').innerHTML=table([...config.columns,...(canWrite?['Acciones']:[])],content);
  root.querySelectorAll('[data-edit]').forEach(btn=>btn.onclick=()=>edit(rows.find(row=>String(row.id)===btn.dataset.edit)));
  pager(root.querySelector('#pager'),filtered.length,page,20,value=>{page=value;render();});
 }
 async function refresh() {
  try {
   const loaded = await Promise.all([allRows(section), section==='productos'?allRows('categorias'):Promise.resolve([])]);
   [rows,categories]=loaded; loadError(null); render();
  } catch(error){loadError(error);}
 }
 function edit(original) {
  const record = original || {};
  const controls = config.fields.map(([name,label,type='text'])=>field(name,label,{value:record[name]??'',type,required:['nombre','codigo'].includes(name),min:type==='number'?0:undefined,step:type==='number'?'0.01':undefined,maxLength:name==='descripcion'?1000:200}));
  if(section==='productos') controls.push(
   field('categoria_id','Categoría',{choices:options(categories,record.categoria_id,'Sin categoría')}),
   field('unidad_medida','Unidad base',{choices:['kg','g','litro','ml','unidad','caja','paquete'].map(value=>`<option ${(record.unidad_medida||'unidad')===value?'selected':''}>${value}</option>`).join(''),help:'No cambiar después de registrar existencias.'}));
  controls.push(field('estado','Estado',{choices:`<option value="true" ${record.estado!==false?'selected':''}>Activo</option><option value="false" ${record.estado===false?'selected':''}>Inactivo</option>`}));
  openEditor({title:(original?'Editar ':'Nueva ficha de ')+config.singular,fields:controls.join(''),save:async values=>{
   for(const key of Object.keys(values)) values[key]=values[key].trim();
   if(!values.nombre || (section==='productos'&&!values.codigo)) throw new Error('Completa los campos obligatorios.');
   values.estado=values.estado==='true';
   if(section==='productos') {
    values.precio=Number(values.precio||0); values.categoria_id=values.categoria_id||null;
    if(!Number.isFinite(values.precio)||values.precio<0) throw new Error('El precio debe ser cero o mayor.');
   }
   await saveRecord(section,values,original); notice('Registro guardado.'); await refresh();
  }});
 }
 root.querySelector('#new-record')?.addEventListener('click',()=>edit());
 for(const id of ['search','status']) root.querySelector('#'+id).addEventListener(id==='search'?'input':'change',()=>{page=0;render();});
 root.querySelector('#refresh').onclick=refresh;
 await refresh();
 return {refresh,tables:[section,...(section==='productos'?['categorias']:[])]};
}
