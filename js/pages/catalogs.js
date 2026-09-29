import { allRows, saveRecord } from '../services/data.js';
import { heading, field, openEditor, options, e, badge, table, pager, notice, loadError } from '../components/ui.js';
import { quantity } from '../utils/domain.js';
export const catalogConfig = {
 categorias: {title:'Categorías', singular:'categoría', description:'Organiza los productos y conserva su clasificación.', fields:[['nombre','Nombre'],['descripcion','Descripción','textarea']], columns:['Nombre','Descripción','Estado']},
 proveedores: {title:'Proveedores', singular:'proveedor', description:'Directorio de empresas y contactos de abastecimiento.', fields:[['nombre','Razón social / nombre'],['documento','RUC / documento'],['contacto','Persona de contacto'],['telefono','Teléfono','tel'],['email','Correo','email'],['direccion','Dirección']], columns:['Proveedor','Documento','Contacto','Teléfono','Correo','Estado']},
 sedes: {title:'Sedes', singular:'sede', description:'Sede operativa de La Liguria y futuras sucursales.', fields:[['nombre','Nombre'],['direccion','Dirección'],['responsable','Responsable']], columns:['Sede','Dirección','Responsable','Estado']},
 productos: {title:'Productos', singular:'producto', description:'Catálogo compartido. Las cantidades se registran mediante movimientos.', fields:[['codigo','Código / SKU'],['nombre','Nombre'],['descripcion','Descripción','textarea'],['marca','Marca'],['presentacion','Presentación'],['codigo_barras','Código de barras'],['precio','Precio de referencia (S/)','number']], columns:['Código','Producto','Categoría','Unidad','Tipo','Control de stock','Precio de referencia','Estado']},
};
export async function catalogPage(root, section, access) {
 const config = catalogConfig[section], canWrite = access.rol !== 'consulta';
 let rows = [], categories = [], page = 0;
 root.innerHTML = heading(config.title, config.description, canWrite ? '<button class="button primary" id="new-record">+ Nuevo registro</button>':'') +
 '<section class="panel"><div class="toolbar"><label class="search-label">Buscar<input type="search" id="search" placeholder="Nombre, código o contacto…"></label><label>Estado<select id="status"><option value="true" selected>Activos</option><option value="">Todos</option><option value="false">Inactivos</option></select></label><button class="button" id="refresh">Actualizar</button></div><div id="results"></div><div id="pager" class="pagination"></div></section>';
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
   if(section==='productos') cells=[e(row.codigo),e(row.nombre),e(categories.find(c=>String(c.id)===String(row.categoria_id))?.nombre||'Sin categoría'),e(row.unidad_medida),e({producto:'Producto',servicio:'Servicio',activo:'Activo',gasto:'Gasto'}[row.tipo_item]||'Producto'),row.controla_inventario===false?badge('No genera stock','neutral'):badge('Sí','success'),row.precio_confirmado&&Number(row.precio)>0?'S/ '+quantity(row.precio):'Sin dato',state];
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
   field('unidad_medida','Unidad base',{choices:['kg','g','litro','ml','unidad','caja','paquete'].map(value=>`<option ${(record.unidad_medida||'unidad')===value?'selected':''}>${value}</option>`).join(''),help:'No cambiar después de registrar existencias.'}),
   field('precio_confirmado','Precio confirmado',{choices:`<option value="false" ${record.precio_confirmado?'':'selected'}>No, todavía no</option><option value="true" ${record.precio_confirmado?'selected':''}>Sí, según documento validado</option>`}),
   field('tipo_item','Tipo de registro',{choices:`<option value="producto" ${record.tipo_item!=='servicio'&&record.tipo_item!=='activo'&&record.tipo_item!=='gasto'?'selected':''}>Producto</option><option value="servicio" ${record.tipo_item==='servicio'?'selected':''}>Servicio</option><option value="activo" ${record.tipo_item==='activo'?'selected':''}>Activo / equipo</option><option value="gasto" ${record.tipo_item==='gasto'?'selected':''}>Gasto</option>`}),
   field('controla_inventario','Controla existencias',{choices:`<option value="true" ${record.controla_inventario!==false?'selected':''}>Sí, usa lotes y saldos</option><option value="false" ${record.controla_inventario===false?'selected':''}>No, solo historial de compra</option>`,help:'Servicios, combustibles, mantenimiento y equipos normalmente no aumentan el stock.'}),
   field('es_perecible','Es perecible',{choices:`<option value="false" ${record.es_perecible?'':'selected'}>No</option><option value="true" ${record.es_perecible?'selected':''}>Sí</option>`}),
   field('requiere_lote','Requiere lote',{choices:`<option value="true" ${record.controla_inventario!==false?'selected':''}>Sí</option><option value="false" ${record.controla_inventario===false?'selected':''}>No</option>`,help:'Los artículos de stock usan lotes para conservar trazabilidad; los servicios no.'}));
  controls.push(field('estado','Estado',{choices:`<option value="true" ${record.estado!==false?'selected':''}>Activo</option><option value="false" ${record.estado===false?'selected':''}>Inactivo</option>`}));
  openEditor({title:(original?'Editar ':'Nueva ficha de ')+config.singular,fields:controls.join(''),save:async values=>{
   for(const key of Object.keys(values)) values[key]=values[key].trim();
   if(!values.nombre || (section==='productos'&&!values.codigo)) throw new Error('Completa los campos obligatorios.');
   values.estado=values.estado==='true';
    if(section==='productos') {
    values.precio=Number(values.precio||0); values.categoria_id=values.categoria_id||null; values.precio_confirmado=values.precio_confirmado==='true'&&values.precio>0; values.controla_inventario=values.controla_inventario==='true'; values.es_perecible=values.es_perecible==='true'; values.requiere_lote=values.controla_inventario;
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

export async function catalogHubPage(root, access, initialView = 'categorias') {
 const canWrite = access.rol !== 'consulta';
 let categories = [], products = [], view = initialView === 'productos' ? 'productos' : 'categorias', selectedCategory = '', page = 0;
 const state = { search: '', status: 'true' };

 root.innerHTML = heading('Catálogo','Administra categorías y productos del Inventario de La Liguria.') +
  '<section class="panel"><div class="catalog-tabs" role="tablist" aria-label="Sección del catálogo"><button type="button" class="button catalog-tab" data-view="categorias" role="tab">Categorías</button><button type="button" class="button catalog-tab" data-view="productos" role="tab">Productos</button></div><div id="catalog-view"></div></section>';

 function categoryName(id) {
  return categories.find(category => String(category.id) === String(id))?.nombre || 'Sin categoría';
 }

 function categoryView() {
  const filtered = categories.filter(row => (state.status === '' || String(row.estado) === state.status) && String(row.nombre || '').toLocaleLowerCase().includes(state.search));
  page = Math.min(page, Math.max(0, Math.ceil(filtered.length / 20) - 1));
 const content = filtered.slice(page * 20, (page + 1) * 20).map(row => {
   const count = products.filter(product => product.estado !== false && String(product.categoria_id) === String(row.id)).length;
   const actions = '<button type="button" class="button small" data-view-products="' + e(row.id) + '">Ver productos</button>' + (canWrite ? ' <button type="button" class="button small" data-edit-category="' + e(row.id) + '">Editar</button>' : '');
   return [e(row.nombre),String(count),actions];
  });
  return '<div class="toolbar"><label class="search-label">Buscar categoría<input id="catalog-search" type="search" value="' + e(state.search) + '" placeholder="Nombre de categoría…"></label><label>Estado<select id="catalog-status"><option value="true" ' + (state.status === 'true' ? 'selected' : '') + '>Activas</option><option value="" ' + (state.status === '' ? 'selected' : '') + '>Todas</option><option value="false" ' + (state.status === 'false' ? 'selected' : '') + '>Inactivas</option></select></label>' + (canWrite ? '<button type="button" class="button primary" id="new-category">+ Nueva categoría</button>' : '') + '</div>' +
   table(['Categoría','Productos','Acciones'],content) +
   '<div id="catalog-pager" class="pagination"></div>';
 }

 function productView() {
  const filtered = products.filter(row => (state.status === '' || String(row.estado) === state.status) &&
   (!selectedCategory || String(row.categoria_id) === String(selectedCategory)) &&
   [row.nombre,row.codigo,row.marca,row.presentacion].some(value => String(value || '').toLocaleLowerCase().includes(state.search)));
  page = Math.min(page, Math.max(0, Math.ceil(filtered.length / 20) - 1));
  const content = filtered.slice(page * 20, (page + 1) * 20).map(row => {
   const cells = [e(row.codigo),e(row.nombre),e(categoryName(row.categoria_id)),e(row.unidad_medida),e({producto:'Producto',servicio:'Servicio',activo:'Activo',gasto:'Gasto'}[row.tipo_item] || 'Producto'),row.controla_inventario === false ? badge('No genera stock','neutral') : badge('Sí','success'),row.precio_confirmado && Number(row.precio) > 0 ? 'S/ ' + quantity(row.precio) : 'Sin dato',badge(row.estado ? 'Activo' : 'Inactivo',row.estado ? 'success' : 'neutral')];
   if (canWrite) cells.push('<button type="button" class="button small" data-edit-product="' + e(row.id) + '">Editar</button>');
   return cells;
  });
  const context = selectedCategory ? '<div class="catalog-view-header"><div><h2>Productos · ' + e(categoryName(selectedCategory)) + '</h2><p class="muted">Productos asociados a esta categoría.</p></div><button type="button" class="button" id="back-categories">← Volver a categorías</button></div>' : '<div class="catalog-view-header"><div><h2>Productos</h2><p class="muted">Catálogo de artículos y servicios registrados.</p></div></div>';
  return context + '<div class="toolbar"><label class="search-label">Buscar producto<input id="catalog-search" type="search" value="' + e(state.search) + '" placeholder="Nombre, código o marca…"></label><label>Categoría<select id="catalog-category">' + options(categories,selectedCategory,'Todas las categorías') + '</select></label><label>Estado<select id="catalog-status"><option value="true" ' + (state.status === 'true' ? 'selected' : '') + '>Activos</option><option value="" ' + (state.status === '' ? 'selected' : '') + '>Todos</option><option value="false" ' + (state.status === 'false' ? 'selected' : '') + '>Inactivos</option></select></label>' + (canWrite ? '<button type="button" class="button primary" id="new-product">+ Nuevo producto</button>' : '') + '</div>' +
   table(['Código','Producto','Categoría','Unidad','Tipo','Control de stock','Precio de referencia','Estado',...(canWrite ? ['Acciones'] : [])],content) +
   '<div id="catalog-pager" class="pagination"></div>';
 }

 function bindView() {
  root.querySelectorAll('[data-view]').forEach(button => {
   const active = button.dataset.view === view;
   button.classList.toggle('primary',active);
   button.setAttribute('aria-selected',String(active));
  });
  root.querySelector('#catalog-view').innerHTML = view === 'categorias' ? categoryView() : productView();
  root.querySelector('#catalog-search').oninput = event => { state.search = event.target.value.toLocaleLowerCase().trim(); page = 0; bindView(); };
  root.querySelector('#catalog-status').onchange = event => { state.status = event.target.value; page = 0; bindView(); };
  root.querySelector('#catalog-category')?.addEventListener('change',event => { selectedCategory = event.target.value; page = 0; bindView(); });
  root.querySelector('#back-categories')?.addEventListener('click',() => { view = 'categorias'; selectedCategory = ''; state.search = ''; page = 0; bindView(); });
  root.querySelector('#new-category')?.addEventListener('click',() => edit('categorias'));
  root.querySelector('#new-product')?.addEventListener('click',() => edit('productos'));
  root.querySelectorAll('[data-edit-category]').forEach(button => button.onclick = () => edit('categorias',categories.find(row => String(row.id) === button.dataset.editCategory)));
  root.querySelectorAll('[data-edit-product]').forEach(button => button.onclick = () => edit('productos',products.find(row => String(row.id) === button.dataset.editProduct)));
  root.querySelectorAll('[data-view-products]').forEach(button => button.onclick = () => { view = 'productos'; selectedCategory = button.dataset.viewProducts; state.search = ''; page = 0; bindView(); });
  pager(root.querySelector('#catalog-pager'),(view === 'categorias' ? categories : products).filter(row => view === 'categorias' ? (state.status === '' || String(row.estado) === state.status) && String(row.nombre || '').toLocaleLowerCase().includes(state.search) : (state.status === '' || String(row.estado) === state.status) && (!selectedCategory || String(row.categoria_id) === String(selectedCategory)) && [row.nombre,row.codigo,row.marca,row.presentacion].some(value => String(value || '').toLocaleLowerCase().includes(state.search))),page,20,value => { page = value; bindView(); });
 }

 root.querySelectorAll('[data-view]').forEach(button => button.onclick = () => { view = button.dataset.view; selectedCategory = ''; state.search = ''; page = 0; bindView(); });

 function edit(section, original) {
  const config = catalogConfig[section], record = original || {};
  const controls = config.fields.map(([name,label,type='text']) => field(name,label,{value:record[name] ?? '',type,required:['nombre','codigo'].includes(name),min:type === 'number' ? 0 : undefined,step:type === 'number' ? '0.01' : undefined,maxLength:name === 'descripcion' ? 1000 : 200}));
  if (section === 'productos') controls.push(
   field('categoria_id','Categoría',{choices:options(categories,record.categoria_id,'Sin categoría')}),
   field('unidad_medida','Unidad base',{choices:['kg','g','litro','ml','unidad','caja','paquete'].map(value => '<option ' + ((record.unidad_medida || 'unidad') === value ? 'selected' : '') + '>' + value + '</option>').join(''),help:'No cambiar después de registrar existencias.'}),
   field('precio_confirmado','Precio confirmado',{choices:'<option value="false" ' + (record.precio_confirmado ? '' : 'selected') + '>No, todavía no</option><option value="true" ' + (record.precio_confirmado ? 'selected' : '') + '>Sí, según documento validado</option>'}),
   field('tipo_item','Tipo de registro',{choices:'<option value="producto" ' + (!['servicio','activo','gasto'].includes(record.tipo_item) ? 'selected' : '') + '>Producto</option><option value="servicio" ' + (record.tipo_item === 'servicio' ? 'selected' : '') + '>Servicio</option><option value="activo" ' + (record.tipo_item === 'activo' ? 'selected' : '') + '>Activo / equipo</option><option value="gasto" ' + (record.tipo_item === 'gasto' ? 'selected' : '') + '>Gasto</option>'}),
   field('controla_inventario','Controla existencias',{choices:'<option value="true" ' + (record.controla_inventario !== false ? 'selected' : '') + '>Sí, usa lotes y saldos</option><option value="false" ' + (record.controla_inventario === false ? 'selected' : '') + '>No, solo historial de compra</option>',help:'Servicios, combustibles, mantenimiento y equipos normalmente no aumentan el stock.'}),
   field('es_perecible','Es perecible',{choices:'<option value="false" ' + (record.es_perecible ? '' : 'selected') + '>No</option><option value="true" ' + (record.es_perecible ? 'selected' : '') + '>Sí</option>'}),
   field('requiere_lote','Requiere lote',{choices:'<option value="true" ' + (record.controla_inventario !== false ? 'selected' : '') + '>Sí</option><option value="false" ' + (record.controla_inventario === false ? 'selected' : '') + '>No</option>',help:'Los artículos de stock usan lotes para conservar trazabilidad; los servicios no.'})
  );
  controls.push(field('estado','Estado',{choices:'<option value="true" ' + (record.estado !== false ? 'selected' : '') + '>Activo</option><option value="false" ' + (record.estado === false ? 'selected' : '') + '>Inactivo</option>'}));
  openEditor({title:(original ? 'Editar ' : 'Nueva ficha de ') + config.singular,fields:controls.join(''),save:async values => {
   for (const key of Object.keys(values)) values[key] = values[key].trim();
   if (!values.nombre || (section === 'productos' && !values.codigo)) throw new Error('Completa los campos obligatorios.');
   values.estado = values.estado === 'true';
   if (section === 'productos') {
    values.precio = Number(values.precio || 0); values.categoria_id = values.categoria_id || null; values.precio_confirmado = values.precio_confirmado === 'true' && values.precio > 0; values.controla_inventario = values.controla_inventario === 'true'; values.es_perecible = values.es_perecible === 'true'; values.requiere_lote = values.controla_inventario;
    if (!Number.isFinite(values.precio) || values.precio < 0) throw new Error('El precio debe ser cero o mayor.');
   }
   await saveRecord(section,values,original); notice('Registro guardado.'); await refresh();
  }});
 }

 async function refresh() {
  try {
   [categories,products] = await Promise.all([allRows('categorias'),allRows('productos')]);
   loadError(null); bindView();
  } catch (error) { loadError(error); }
 }
 await refresh();
 return {refresh,tables:['categorias','productos']};
}
