// Testes locais dos defeitos reportados no celular; não usa serviços reais.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
class TestFile {
  constructor(chunks,name,options){this.name=name;this.type=options.type;this.bytes=chunks;this.size=chunks[0].size||chunks[0].length||0;}
}
function api(navigator,fetch=async()=>{throw Error('unexpected remote image fetch')}){
  return new Function('navigator','Blob','File','atob','fetch',source('presenter/api.js')+';return API;')(
    navigator,Blob,TestFile,atob,fetch);
}
test('PNG base64 e legenda Unicode ficam preparados antes de abrir o compartilhamento',async()=>{
  let called=0,last=null;
  const navigator={canShare:x=>x.files?.length===1,share:args=>{called++;last=args;return Promise.resolve();}};
  const a=api(navigator);
  const caption='🎉 Super Big Friday! ☕ Cafeteira 🛒 R$ 548,40 🎁';
  const p=await a.prepararCompartilhamento(caption,'data:image/png;base64,'+Buffer.from([137,80,78,71,13,10,26,10]).toString('base64'));
  assert.equal(p.file.name,'oferta.png');
  assert.equal(p.file.type,'image/png');
  assert.equal(p.texto,caption);
  assert.equal(called,0);
  const promise=a.compartilharPreparado(p);
  assert.equal(called,1,'Web Share deve começar antes do primeiro await');
  await promise;
  assert.equal(last.text,caption);
  assert.equal(last.files[0],p.file);
});
test('imagem externa é carregada antes do toque, nunca durante Web Share',async()=>{
  let fetches=0;
  const a=api({canShare:()=>true,share:async()=>{}},async()=>{
    fetches++;return {ok:true,blob:async()=>new Blob(['imagem'],{type:'image/jpeg'})};
  });
  const p=await a.prepararCompartilhamento('Legenda','https://example.org/image.jpg');
  assert.equal(fetches,1);
  const promise=a.compartilharPreparado(p);
  assert.equal(fetches,1);
  await promise;
});
test('sem suporte para arquivos não cai silenciosamente em WhatsApp de texto',async()=>{
  const a=api({canShare:()=>false,share:()=>{throw Error('não pode')}});
  const p=await a.prepararCompartilhamento('Oferta 🥳','data:image/png;base64,YQ==');
  assert.throws(()=>a.compartilharPreparado(p),/COMPARTILHAMENTO_IMAGEM_NAO_SUPORTADO/);
  await assert.rejects(a.prepararCompartilhamento('Oferta',''),/IMAGEM_OFERTA_AUSENTE/);
});
test('o segundo toque aciona Web Share antes de qualquer espera de API',async()=>{
  let chamadas=0;
  const oferta={id:'of_123',textoOferta:'Oferta ☕',urlImagem:'data:image/png;base64,YQ==',linkProduto:'https://www.martinello.com.br/cafeteira',campanha:'teste'};
  const cod={value:'19000'};const btn={disabled:false,querySelector:()=>({textContent:''})};
  const doc={addEventListener(){},getElementById:id=>id==='cod'?cod:id==='btnEnviar'?btn:null};
  const native={compartilharPreparado:()=>{
    chamadas++;return Promise.resolve({metodo:'share-com-imagem'});
  }};
  const p=new Function('document','API','Validators','isOfertaAtiva','getHorarioBrasilia','UI',
    source('presenter/index-presenter.js')+';return IndexPresenter;')(
    doc,native,{matricula:()=>true},()=>true,()=>new Date(),{erro:()=>{}});
  p.ofertaAtual=oferta;p.enviando=false;p._renderOferta=()=>{};p._fecharAlternativo=()=>{};
  p._compartilhamento={matricula:'19000',ofertaId:'of_123',textoOferta:oferta.textoOferta,
    urlImagem:oferta.urlImagem,linkProduto:oferta.linkProduto,campanha:oferta.campanha,
    criadoEm:Date.now(),preparado:{file:new TestFile([Buffer.from('img')],'oferta.png',{type:'image/png'}),texto:'Oferta ☕'},ativo:false};
  const job=p.enviar();
  assert.equal(chamadas,1,'compartilhamento não pode esperar Apps Script');
  await job;
});
test('pedido já registrado em outra sessão dispensa solicitar telefone novamente',async()=>{
  let solicitacoes=0;
  const local=new Map(),storage={getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v)};
  const win={};
  const doc={createElement:()=>({remove(){}}),head:{appendChild(el){
    const id=new URL(el.src).searchParams.get('requestId');
    queueMicrotask(()=>win.MartinelloTelefoneReceber({requestId:id,disponivel:true,validado:false,solicitado:true}));
  }}};
  const phone=new Function('window','document','CONFIG','localStorage','setTimeout','clearTimeout',
    source('model/telefone-portal.js')+';return TelefonePortal;')(win,doc,
    {environment:'OFICIAL',portalEventsApiUrl:'https://script.google.com/macros/s/EXEMPLO/exec'},storage,setTimeout,clearTimeout);
  phone.solicitar=()=>{solicitacoes++;return Promise.resolve(false);};
  assert.equal(await phone.garantir('19000'),true);
  assert.equal(solicitacoes,0);
  assert.equal(phone._cache('19000'),'solicitado');
  // Simula nova aba com base local preservada, não retorna ao formulário.
  assert.equal(await phone.garantir('19000'),true);
  assert.equal(solicitacoes,0);
});
test('HTML contém verificador de atualização automática nos portais, sem apagar armazenamento',()=>{
  for(const pagina of ['index.html','admin.html','gerentes.html']){
    const html=source(pagina);
    assert.match(html,/name="martinello-build"/);
    assert.match(html,/shared\/auto-update\.js\?v=/);
  }
  const src=source('shared/auto-update.js');
  assert.match(src,/cache:'no-store'/);
  assert.match(src,/location\.replace\(u\.href\)/);
  assert.doesNotMatch(src,/localStorage\.clear\(\)/);
  assert.doesNotThrow(()=>new vm.Script(src));
});
