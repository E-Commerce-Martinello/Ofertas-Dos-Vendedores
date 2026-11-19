// Testes locais sem contatos reais ou chamadas à produção.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const ultima=(url,nome)=>new URL(url).searchParams.get(nome);
function ranking(simulador){
  let calls=0;
  const win={};
  const doc={createElement:()=>({remove(){},async:true}),head:{appendChild(el){
    calls++;const qs=new URL(el.src),requestId=qs.searchParams.get('requestId');
    queueMicrotask(()=>simulador(el,win,requestId,calls));
  }}};
  const r=new Function('window','document','CONFIG','URL','setTimeout','clearTimeout',
    src('model/ranking-ofertas.js')+';return RankingOfertas;')(win,doc,{portalEventsApiUrl:'https://script.google.com/macros/s/TESTE/exec'},URL,setTimeout,clearTimeout);
  return {r,win,getCalls:()=>calls};
}
test('erro de rede no ranking não vira cache vazio de 15 minutos; recupera no próximo acesso',async()=>{
  const x=ranking((el,w,req,n)=>{
    if(n===1)el.onerror();
    else w.MartinelloRankingReceber({requestId:req,ofertaId:'of_123'});
  });
  const ativas=[{id:'of_123'},{id:'of_456'}];
  assert.equal(await x.r.carregar(ativas),'');
  assert.equal(x.r._consultadoEm,0);
  assert.ok(x.r._ultimaFalhaEm);
  x.r._ultimaFalhaEm=Date.now()-31000;
  assert.equal(await x.r.carregar(ativas),'of_123');
  assert.equal(x.getCalls(),2);
  assert.equal(x.r.liderAtivas(ativas),'of_123');
});
test('resposta válida sem atividade não é inventada nem reconsultada imediatamente',async()=>{
  const x=ranking((el,w,req)=>w.MartinelloRankingReceber({requestId:req,ofertaId:''}));
  const ativas=[{id:'of_123'}];
  assert.equal(await x.r.carregar(ativas),'');
  assert.ok(x.r._consultadoEm>0);
  assert.equal(await x.r.carregar(ativas),'');
  assert.equal(x.getCalls(),1);
});
test('matrícula só retorna false quando o coletor confirma explicitamente inatividade',async()=>{
  let tries=0;
  const window={};
  const doc={createElement:()=>({remove(){}}),head:{appendChild(script){
    const requestId=ultima(script.src,'requestId');tries++;
    queueMicrotask(()=>{
      if(tries===1)script.onerror();
      else window.MartinelloMatriculaReceber({requestId,disponivel:true,ativo:true});
    });
  }}};
  const svc=new Function('window','document','CONFIG','URL','setTimeout','clearTimeout','localStorage',
    src('model/telefone-portal.js')+';return TelefonePortal;')(window,doc,
    {environment:'OFICIAL',portalEventsApiUrl:'https://script.google.com/macros/s/TESTE/exec'},
    URL,setTimeout,clearTimeout,{});
  assert.equal(await svc.consultarMatricula('19000'),true);
  assert.equal(tries,2);
  doc.head.appendChild=(script)=>{
    tries++;
    queueMicrotask(()=>window.MartinelloMatriculaReceber({requestId:ultima(script.src,'requestId'),disponivel:true,ativo:false}));
  };
  assert.equal(await svc.consultarMatricula('99999'),false);
  assert.equal(tries,3);
});
test('ranking pode ser reconsultado sem mudar ofertas após um minuto',()=>{
  const doc={hidden:false,addEventListener(){},getElementById:id=>({textContent:'',querySelector:()=>({textContent:''})}),querySelector:()=>({textContent:''})};
  const win={matchMedia:()=>({matches:true})};
  const p=new Function('document','window','getHorarioBrasilia','formatarBrasilia','isOfertaAtiva',
    src('presenter/index-presenter.js')+';return IndexPresenter;')(doc,win,()=>new Date(),()=>'',()=>true);
  let calls=0;
  p.ofertas=[{id:'of_123'}];p._ativas=()=>p.ofertas;
  p._atualizarRanking=()=>{calls++;p._ultimaTentativaRanking=Date.now()};
  p._ultimaTentativaRanking=Date.now()-61000;
  p._assinatura='of_123';
  p._tick();
  assert.equal(calls,1);
});
test('emojis Unicode são mantidos no texto, no link e na codificação do WhatsApp',()=>{
  const formatar=new Function(src('shared/utils.js')+';return formatarTexto;')();
  const msg='🔴 Geladeira 🧊 promoção 🎉\n[LINK]\nCódigo [CODIGO]';
  const texto=formatar(msg,'https://www.martinello.com.br/parceiros/19000','19000');
  assert.ok(texto.includes('🔴 Geladeira 🧊 promoção 🎉'));
  assert.ok(!texto.includes('\uFFFD'));
  assert.ok(decodeURIComponent(encodeURIComponent(texto)).includes('🎉'));
});
test('admin exibe aviso persistente se texto salvo já chegou com caracteres perdidos',()=>{
  const texto={value:'Oferta � com caracteres inválidos'};
  const aviso={hidden:true};
  const dom={addEventListener(){},getElementById(id){return id==='textoOferta'?texto:id==='textoOfertaAvisoCodificacao'?aviso:null;}};
  const admin=new Function('document','CONFIG',src('presenter/admin-presenter.js')+';return AdminPresenter;')(dom,{environment:'OFICIAL'});
  assert.equal(admin.verificarCodificacaoTexto(),true);
  assert.equal(aviso.hidden,false);
  texto.value='Oferta 🎉 válida';
  assert.equal(admin.verificarCodificacaoTexto(),false);
  assert.equal(aviso.hidden,true);
});
