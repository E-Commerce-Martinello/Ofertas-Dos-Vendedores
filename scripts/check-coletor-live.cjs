// Diagnóstico público do COLETOR oficial. Não envia matrículas reais nem credenciais.
// node scripts/check-coletor-live.cjs (requer acesso externo à rede)
'use strict';
const vm=require('node:vm'),fs=require('node:fs');
const origem='https://e-commerce-martinello.github.io/Ofertas-Dos-Vendedores/';
const source=fs.readFileSync('shared/config.js','utf8');
const url=vm.runInNewContext(source+';CONFIG.portalEventsApiUrl;',{
  window:{location:{hostname:'e-commerce-martinello.github.io',pathname:'/Ofertas-Dos-Vendedores/index.html'}}
});
if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url))
 throw Error('Configuração do coletor oficial inválida.');
const tests=[
 {acao:'consultarCampanha',requestId:'cp_diagnostico_20261119',fn:'MartinelloCampanhaReceber'},
 {acao:'rankingOfertas',requestId:'rk_diagnostico_20261119',fn:'MartinelloRankingReceber',ids:'of_DIAGNOSTICO'},
 {acao:'consultarMatricula',requestId:'ma_diagnostico_20261119',fn:'MartinelloMatriculaReceber',matricula:'000'}
];
(async()=>{
  let erros=0;
  for(const t of tests){
    const u=new URL(url);u.searchParams.set('action',t.acao);
    u.searchParams.set('requestId',t.requestId);
    if(t.ids)u.searchParams.set('ids',t.ids);
    if(t.matricula)u.searchParams.set('matricula',t.matricula);
    try{
      const r=await fetch(u,{redirect:'follow',signal:AbortSignal.timeout(22000)});
      const body=await r.text();
      // Não imprimir respostas: a campanha e outros valores podem ser internos.
      const prefix='window.'+t.fn+'&&window.'+t.fn+'(';
      const dados=body.startsWith(prefix)&&body.trim().endsWith(');')
       ? JSON.parse(body.slice(prefix.length,body.lastIndexOf(');'))) : null;
      const ok=r.ok && !!dados && dados.requestId===t.requestId &&
        (t.acao!=='consultarMatricula'||typeof dados.ativo==='boolean') &&
        (t.acao!=='consultarCampanha'||typeof dados.campanha==='string') &&
        (t.acao!=='rankingOfertas'||typeof dados.ofertaId==='string');
      console.log(t.acao+': '+(ok?'OK':'FALHA')+' HTTP '+r.status+
        ' callback='+(!!dados)+' disponivel='+(dados?.disponivel===false?'false':'desconhecido/ou-true'));
      if(!ok || dados?.disponivel===false)erros++;
    }catch(e){console.log(t.acao+': FALHA '+String(e.name||'Erro'));erros++;}
  }
  if(erros){console.error('Coletor não respondeu corretamente a '+erros+' de '+tests.length+' consultas públicas. Conferir versão implantada, acesso anônimo, logs e planilha oficial.');process.exitCode=1;}
})();
