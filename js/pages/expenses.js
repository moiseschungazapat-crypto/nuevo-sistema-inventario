import {rpc} from '../services/data.js';
import {heading,e,field,openEditor,table,badge,pager,notice,loadError} from '../components/ui.js';
import {confirmAction} from '../components/confirmation.js';

const categories=['Mercadería','Servicios','Transporte','Mantenimiento','Personal','Alquiler','Otros'];
const money=value=>new Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN'}).format(Number(value));
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const displayDate=value=>value?String(value).split('-').reverse().join('/'):'—';

export async function expensesPage(root,access){
 if(access.rol!=='administrador'){
  root.innerHTML=heading('Control de gastos','Acceso exclusivo del administrador o jefe autorizado.')+'<section class="panel"><p>No tienes permisos para consultar esta sección.</p></section>';
  return {refresh:async()=>{},tables:[]};
 }
 let data=null,page=0,sequence=0;
 root.innerHTML=heading('Control de gastos','Compras, pagos y obligaciones · Acceso exclusivo del administrador.','<button type="button" class="button primary" id="new-expense">+ Registrar gasto</button>')+
  `<div class="toolbar expense-period"><label>Período<input type="month" id="expense-month" value="${today().slice(0,7)}"></label><span class="expense-private"><i class="fa-solid fa-lock" aria-hidden="true"></i> Solo administrador o jefe</span><button type="button" class="button" id="expense-budget">Configurar presupuesto</button><button type="button" class="button" id="expense-refresh">Actualizar</button></div>`+
  '<div id="expense-kpis" class="kpi-grid expense-kpis"></div><section class="panel"><h2>Gastos registrados</h2><div class="toolbar"><label class="search-label">Buscar<input type="search" id="expense-search" placeholder="Concepto o proveedor…"></label><label>Estado<select id="expense-state"><option value="">Todos</option><option value="pagado">Pagados</option><option value="pendiente">Pendientes</option></select></label><label>Categoría<select id="expense-category"><option value="">Todas</option>'+categories.map(c=>`<option>${e(c)}</option>`).join('')+'</select></label></div><div id="expense-results"></div><div class="pagination" id="expense-pager"></div></section>';
 const month=()=>root.querySelector('#expense-month').value+'-01';
 function render(){
  if(!data)return;
  const budget=data.presupuesto;
  const available=budget?Number(budget.monto)-Number(data.total):null;
  root.querySelector('#expense-kpis').innerHTML=[
   ['Gastos del mes',money(data.total),`${data.cantidad} gastos registrados`],
   ['Pagado',money(data.pagado),'Gastos de este período ya pagados'],
   ['Pendiente de pago',money(data.pendiente),'Obligaciones por pagar'],
   ['Presupuesto disponible',available===null?'Sin configurar':money(available),budget?`Presupuesto: ${money(budget.monto)}`:'Define un presupuesto mensual'],
  ].map(([label,value,help])=>`<div class="kpi-card"><div class="kpi-info"><span class="kpi-label">${e(label)}</span><strong class="kpi-value">${e(value)}</strong><small>${e(help)}</small></div></div>`).join('');
  const q=root.querySelector('#expense-search').value.trim().toLocaleLowerCase(),state=root.querySelector('#expense-state').value,category=root.querySelector('#expense-category').value;
  const rows=data.gastos.filter(row=>(!state||row.estado===state)&&(!category||row.categoria===category)&&[row.concepto,row.proveedor].some(value=>String(value).toLocaleLowerCase().includes(q)));
  page=Math.min(page,Math.max(0,Math.ceil(rows.length/20)-1));
  root.querySelector('#expense-results').innerHTML=table(['Fecha','Concepto / proveedor','Categoría','Monto','Estado','Acciones'],rows.slice(page*20,(page+1)*20).map(row=>[
   e(displayDate(row.fecha)),`<strong>${e(row.concepto)}</strong>${row.proveedor?`<small class="expense-detail">${e(row.proveedor)}</small>`:''}${row.observaciones?`<small class="expense-detail">${e(row.observaciones)}</small>`:''}`,
   e(row.categoria),`<span class="expense-amount">${e(money(row.monto))}</span>`,badge(row.estado==='pagado'?'Pagado':'Pendiente',row.estado==='pagado'?'success':'warning')+(row.fecha_pago?`<small class="expense-detail">${e(displayDate(row.fecha_pago))}</small>`:''),
   `<div class="actions"><button type="button" class="button small" data-expense-edit="${e(row.id)}">Editar</button>${row.estado==='pendiente'?`<button type="button" class="button small" data-expense-pay="${e(row.id)}">Marcar pagado</button>`:''}</div>`,
  ]),'No hay gastos registrados para este período y filtros.');
  pager(root.querySelector('#expense-pager'),rows.length,page,20,value=>{page=value;render();});
  root.querySelectorAll('[data-expense-edit]').forEach(button=>button.onclick=()=>edit(data.gastos.find(row=>row.id===button.dataset.expenseEdit)));
  root.querySelectorAll('[data-expense-pay]').forEach(button=>button.onclick=()=>pay(data.gastos.find(row=>row.id===button.dataset.expensePay),button));
 }
 async function refresh(){
  const selected=month(),current=++sequence;
  if(!/^\d{4}-\d{2}-01$/.test(selected))return;
  try{
   const loaded=await rpc('app_gastos_mes',{p_mes:selected});
   if(current!==sequence)return;
   data=loaded;loadError(null);render();
  }catch(error){
   if(current!==sequence)return;
   data=null;root.querySelector('#expense-results').textContent='No se pudieron consultar los gastos.';
   root.querySelector('#expense-kpis').innerHTML='';root.querySelector('#expense-pager').innerHTML='';loadError(error);
  }
 }
 function edit(original){
  const row=original||{},operation=crypto.randomUUID();
  const choices=values=>values.map(([value,label])=>`<option value="${e(value)}" ${value===(row.estado||'pagado')?'selected':''}>${e(label)}</option>`).join('');
  openEditor({title:original?'Editar gasto':'Registrar gasto',fields:
   field('fecha','Fecha del gasto',{type:'date',required:true,value:row.fecha||today()})+
   field('concepto','Concepto',{required:true,maxLength:200,value:row.concepto||''})+
   field('categoria','Categoría',{required:true,choices:categories.map(c=>`<option ${c===(row.categoria||'Mercadería')?'selected':''}>${e(c)}</option>`).join('')})+
   field('monto','Monto (S/)',{type:'number',required:true,min:.01,step:'0.01',value:row.monto||''})+
   field('estado','Estado',{choices:choices([['pagado','Pagado'],['pendiente','Pendiente']])})+
   field('fecha_pago','Fecha de pago',{type:'date',value:row.fecha_pago||today(),help:'Solo se registra cuando el gasto está pagado.'})+
   field('proveedor','Proveedor (opcional)',{value:row.proveedor||'',maxLength:200})+
   field('observaciones','Observación (opcional)',{type:'textarea',maxLength:1000,value:row.observaciones||''}),
   setup:form=>{
    const update=()=>{form.elements.fecha_pago.disabled=form.elements.estado.value!=='pagado';};
    form.elements.estado.onchange=update;update();
   },save:async values=>{
    if(values.estado==='pendiente')values.fecha_pago=null;
    await rpc('app_guardar_gasto',{p_operacion:operation,p_datos:values,p_id:row.id||null,p_version:row.version||null});
    notice('Gasto guardado.');await refresh();
   }});
 }
 async function pay(row,button){
  if(!await confirmAction({title:'Confirmar pago',message:`¿Confirmas que se pagaron ${money(row.monto)} por ${row.concepto}? Se guardará la fecha de hoy.`}))return;
  button.disabled=true;
  try{await rpc('app_pagar_gasto',{p_id:row.id,p_version:row.version});notice('Pago confirmado.');await refresh();}
  catch(error){loadError(error);}finally{button.disabled=false;}
 }
 root.querySelector('#new-expense').onclick=()=>edit();
 root.querySelector('#expense-budget').onclick=()=>{
  if(!data)return;
  const selected=month(),budget=data.presupuesto;
  openEditor({title:`Presupuesto de ${selected.slice(0,7)}`,fields:field('monto','Presupuesto mensual (S/)',{type:'number',required:true,min:0,step:'0.01',value:budget?.monto??''}),save:async values=>{
   await rpc('app_presupuesto_gastos',{p_mes:selected,p_monto:values.monto,p_version:budget?.version??null});notice('Presupuesto guardado.');await refresh();
  }});
 };
 root.querySelector('#expense-refresh').onclick=refresh;
 root.querySelector('#expense-month').onchange=()=>{page=0;refresh();};
 for(const id of ['expense-state','expense-category'])root.querySelector('#'+id).onchange=()=>{page=0;render();};
 root.querySelector('#expense-search').oninput=()=>{page=0;render();};
 await refresh();return {refresh,tables:['gastos','gastos_presupuestos']};
}
