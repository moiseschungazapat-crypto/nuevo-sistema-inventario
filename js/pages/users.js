import { rpc } from '../services/data.js';
import { heading,e,badge,table,field,options,openEditor,notice,loadError } from '../components/ui.js';
export async function usersPage(root,access){
 if(access.rol!=='administrador'){
  root.innerHTML=heading('Mi acceso','Solo un administrador puede gestionar las cuentas.')+'<section class="panel"><h2>'+e(access.nombre)+'</h2><p>'+badge(access.rol)+'</p><p class="muted">Contacta al administrador para cambiar tus permisos.</p></section>';
  return {refresh:async()=>{},tables:[]};
 }
 let rows=[];
 root.innerHTML=heading('Usuarios','Habilita cuentas, asigna permisos y controla quién puede operar el inventario.','<button id="new-user" class="button primary">+ Habilitar cuenta</button>')+
 '<section class="panel"><p class="muted">La cuenta debe existir primero en Supabase → Authentication → Users. Aquí se administra su acceso; nunca se almacenan contraseñas.</p><div class="toolbar"><label class="search-label">Buscar<input id="search" type="search" placeholder="Nombre o correo"></label><button id="refresh" class="button">Actualizar</button></div><div id="results"></div></section>';
 function render(){
  const query=root.querySelector('#search').value.toLowerCase();
  root.querySelector('#results').innerHTML=table(['Nombre','Correo','Rol','Estado','Acciones'],rows.filter(r=>[r.nombre,r.email].some(v=>String(v||'').toLowerCase().includes(query))).map(row=>[
   e(row.nombre),e(row.email),badge(row.rol),badge(row.activo?'Habilitado':'Inactivo',row.activo?'success':'neutral'),'<button class="button small" data-edit="'+e(row.user_id)+'">Editar</button>'
  ]));
  root.querySelectorAll('[data-edit]').forEach(button=>button.onclick=()=>edit(rows.find(r=>r.user_id===button.dataset.edit)));
 }
 async function refresh(){try{rows=await rpc('app_listar_usuarios');loadError(null);render();}catch(error){loadError(error);}}
 function edit(original){
  const row=original||{};
  openEditor({title:original?'Editar acceso':'Habilitar cuenta existente',fields:field('email','Correo de Authentication',{type:'email',required:true,value:row.email||''})+field('nombre','Nombre',{required:true,value:row.nombre||'',maxLength:150})+
   field('rol','Rol',{choices:options([{id:'consulta',nombre:'Consulta: solo lectura'},{id:'operador',nombre:'Operador: catálogos y movimientos'},{id:'administrador',nombre:'Administrador: usuarios y ajustes'}],row.rol||'consulta','Seleccionar rol'),required:true})+
   field('activo','Acceso',{choices:'<option value="true" '+(row.activo!==false?'selected':'')+'>Habilitado</option><option value="false" '+(row.activo===false?'selected':'')+'>Inactivo</option>'}),
   setup(form){if(original)form.elements.email.readOnly=true;},
   save:async values=>{
    await rpc('app_guardar_usuario',{p_email:values.email.trim(),p_nombre:values.nombre.trim(),p_rol:values.rol,p_activo:values.activo==='true'});
    notice('Acceso actualizado.');await refresh();
   }});
 }
 root.querySelector('#new-user').onclick=()=>edit();root.querySelector('#refresh').onclick=refresh;root.querySelector('#search').oninput=render;await refresh();
 return {refresh,tables:['auth_perfiles']};
}
