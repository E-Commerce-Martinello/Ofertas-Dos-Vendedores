// Regressão local: buscas com filtros, publicação e identificação correta de ambiente.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const raiz=path.join(__dirname,'..');
const fonte=p=>fs.readFileSync(path.join(raiz,p),'utf8');
const urlBusca='https://www.martinello.com.br/busca?busca=geladeira%20frost%20free&preco=2500-4500&cor=preta&utm_source=antigo';

function adminSimulado(){
  const salvos=[],erros=[];
  const valores={
    dataInicio:{value:'2026-11-19T09:00'},dataFim:{value:'2026-11-30T23:00'},
    linkProduto:{value:urlBusca},textoOferta:{value:'Aproveite esta oferta!'},
    tituloPagina:{value:'Geladeira em várias cores'},campanhaOferta:{value:''},
    skuOferta:{value:''},rascunhoOferta:{checked:false},destaqueDiaOferta:{checked:false},
    destaqueInicioOferta:{value:''},destaqueFimOferta:{value:''},fileInput:{files:[]}
  };
  const doc={getElementById:id=>valores[id]};
  const v=new Function('CONFIG',fonte('model/validators.js')+';return Validators;')({maxImageSize:5000000,imagensPermitidas:['image/jpeg']});
  const ui={erro:msg=>erros.push(msg),ok:()=>{}};
  const storage={modificarOferta:async ({oferta})=>{salvos.push(oferta);return {ok:true,ofertas:[oferta]}}};
  const admin=new Function('CONFIG','document','Validators','UI','Storage','SegurancaPresenter',
    fonte('presenter/admin-presenter.js')+';return AdminPresenter;')(
      {environment:'OFICIAL'},doc,v,ui,storage,{registrarFirebase(){}});
  admin.editandoId='of_12345';
  admin.editandoBase='revisao';
  admin.ofertas=[{id:'of_12345',urlImagem:'data:image/jpeg;base64,YQ==',dataCriacao:'2026-01-01'}];
  admin.renderLista=()=>{};admin.cancelarEdicao=()=>{};
  return {admin,storage,salvos,erros,valores};
}

test('gerentes: em oficial badge permanece oculto, em teste aparece',()=>{
  const html=fonte('gerentes.html');
  assert.match(html,/<span class="gerentes-badge" id="gerentesAmbiente" hidden>/);
  assert.doesNotMatch(html,/<footer[^>]+>[^<]*Ambiente TESTE/);
  for(const ambiente of ['OFICIAL','TESTE']){
    const badge={hidden:true};
    const doc={addEventListener(){},getElementById:id=>id==='gerentesAmbiente'?badge:null};
    const presenter=new Function('CONFIG','document',
      fonte('presenter/gerentes-presenter.js')+';return GerentesPresenter;')({environment:ambiente},doc);
    presenter.atualizarAmbiente();
    assert.equal(badge.hidden,ambiente==='OFICIAL');
  }
});
test('publicar oferta com link de busca e preço aceita URL HTTPS oficial e SKU vazio',async()=>{
  const {admin,salvos,erros}=adminSimulado();
  assert.ok(!admin._pendenciasRascunho({tituloPagina:'Geladeira',linkProduto:urlBusca,
    textoOferta:'Oferta',dataInicio:'2026-11-19T09:00',dataFim:'2026-11-30T23:00',
    urlImagem:'data:image/jpeg;base64,YQ=='}).some(x=>/link/.test(x)));
  await admin.salvarOferta();
  assert.equal(erros.length,0,erros.join('; '));
  assert.equal(salvos.length,1);
  assert.equal(salvos[0].linkProduto,urlBusca);
  assert.equal(salvos[0].sku,'');
});
test('publicação continua bloqueando links externos',async()=>{
  const {admin,valores,salvos,erros}=adminSimulado();
  valores.linkProduto.value='https://exemplo.com/busca?busca=geladeira';
  await admin.salvarOferta();
  assert.equal(salvos.length,0);
  assert.ok(erros.some(x=>x.includes('Martinello')));
});
test('importação aceita busca filtrada e mantém parâmetros de variantes de produtos',()=>{
  const presenter=new Function('AdminPresenter',
    fonte('presenter/ofertas-import-presenter.js')+';return OfertasImportPresenter;')({ofertas:[],rascunhos:[]});
  presenter._ler=(row,field)=>String(row[field]||'');
  const dados={url:urlBusca,sku:'',titulo:'Geladeiras',texto:'Selecione sua cor',
    campanha:'novembro_2026',inicio:'2026-11-20',fim:'2026-11-30'};
  const result=presenter._produto(dados,0);
  assert.equal(result.busca,true);
  assert.equal(result.linkValido,true);
  assert.equal(result.sku,'');
  assert.equal(result.url,urlBusca);
  assert.deepEqual(result.erros,[]);
  const variacao=presenter._produto({...dados,url:'https://www.martinello.com.br/produto-123?cor=preto&sku=123'},1);
  assert.equal(new URL(variacao.url).searchParams.get('cor'),'preto');
  assert.equal(new URL(variacao.url).searchParams.get('sku'),'123');
});
test('UTMs do destino substituem somente UTMs anteriores, mantendo pesquisa e filtros',()=>{
  const portal=new Function(fonte('model/campanhas.js')+';return CampanhasPortal;')();
  portal.geral='novembro_2026';portal.utmSource='grupo_zap';portal.utmId='vendedores_zap';
  const link=new Function('CampanhasPortal',fonte('model/link-track.js')+';return LinkTrack;')(portal);
  const gerado=link.urlCompartilhavel({id:'of_12345',linkProduto:urlBusca},'19000');
  const externo=new URL(gerado);
  assert.equal(externo.pathname,'/parceiros/19000');
  const destino=new URL(externo.searchParams.get('redirect'));
  assert.equal(destino.pathname,'/busca');
  assert.equal(destino.searchParams.get('busca'),'geladeira frost free');
  assert.equal(destino.searchParams.get('preco'),'2500-4500');
  assert.equal(destino.searchParams.get('cor'),'preta');
  assert.equal(destino.searchParams.get('utm_source'),'grupo_zap');
  assert.equal(destino.searchParams.get('utm_campaign'),'novembro_2026');
  assert.equal(destino.searchParams.get('utm_id'),'vendedores_zap');
  assert.equal(destino.searchParams.getAll('utm_source').length,1);
});
