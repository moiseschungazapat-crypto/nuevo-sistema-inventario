// Cantidad: tres decimales; costo unitario: cuatro; total: céntimos.
// Aritmética entera para coincidir con round(numeric,2) de PostgreSQL.
export function entryCostTotal(quantity,cost){
 if(!Number.isFinite(Number(quantity))||!Number.isFinite(Number(cost))||Number(quantity)<0||Number(cost)<0||Number(quantity)>999999999||Number(cost)>999999999999.99)return 0;
 const q=BigInt(Number(quantity).toFixed(3).replace('.',''));
 const c=BigInt(Number(cost).toFixed(4).replace('.',''));
 return Number((q*c+50000n)/100000n)/100;
}
