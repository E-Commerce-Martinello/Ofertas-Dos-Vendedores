/* Regressões de compatibilidade com o ambiente oficial v1.6.18 enviado pelo responsável.
   Somente arquivos locais e simulações: NUNCA acessa produção. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const get=p=>JSON.parse(read(p));

test('manifestos mantêm execução como implantador e Web Apps acessíveis ao gateway',()=>{
  for(const servico of ['admin','coletor']){
    const m=get('infrastructure/apps-script/'+servico+'/appsscript.json');
    assert.equal(m.runtimeVersion,'V8');
    assert.equal(m.webapp.executeAs,'USER_DEPLOYING');
    assert.equal(m.webapp.access,'ANYONE_ANONYMOUS');
    assert.ok(m.oauthScopes.includes('https://www.googleapis.com/auth/spreadsheets'));
    assert.equal(m.timeZone,'America/Sao_Paulo');
  }
  const m=get('infrastructure/apps-script/admin/appsscript.json');
  assert.ok(m.dependencies.enabledAdvancedServices.some(s=>s.userSymbol==='Sheets'&&s.serviceId==='sheets'&&s.version==='v4'));
  assert.ok(m.oauthScopes.includes('https://www.googleapis.com/auth/script.scriptapp'));
});

test('regras oficiais preservam nomes legados e deixam sincronização privada',()=>{
  const r=get('infrastructure/firebase/database.rules.OFICIAL.json').rules;
  assert.equal(r['.read'],false);assert.equal(r['.write'],false);
  assert.equal(r.ofertasMartinello['.read'],true);
  assert.ok(r.gestaoVendedores['.read'].includes("root.child('adminUids')"));
  assert.equal(r.adminUids.$uid['.validate'],'newData.val() === true');
  assert.equal(r.aparenciaPortal['.read'],true);
  assert.ok(r.rascunhosOfertas['.write'].includes('email_verified'));
  assert.equal(r.adminSync['.read'],r.gestaoVendedores['.read']);
  assert.equal(r.adminSync['.write'],false);
  assert.ok(!Object.keys(r).some(k=>k.endsWith('_TESTE')));
});

test('Worker preserva diagnóstico sem dados privados e nunca repete POST',async()=>{
  const {default:worker}=await import(pathToFileURL(path.join(root,'infrastructure/cloudflare/worker.mjs')).href);
  const original=globalThis.fetch;
  const origin='https://e-commerce-martinello.github.io';
  const env={APPS_SCRIPT_URL:'https://script.google.com/macros/s/TEST_APPS_SCRIPT/exec'};
  const request=(action,token='x'.repeat(250))=>new Request('https://worker-exemplo.workers.dev/',{
    method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
    body:JSON.stringify({action,firebaseIdToken:token,requestId:'req_teste1234',payload:{}})
  });
  try{
    let post=0,get=0;
    globalThis.fetch=async(url,options)=>{
      if(options.method==='POST'){
        post++;
        return new Response(null,{status:302,headers:{Location:'https://script.googleusercontent.com/redirect?auth=PROIBIDO'}});
      }
      get++;
      if(get===1)return new Response('Não encontrado',{status:404});
      return new Response(JSON.stringify({tipo:'MART_VENDEDORES_API',requestId:'req_teste1234',ok:true,resultado:{teste:true}}),{status:200,headers:{'content-type':'application/json'}});
    };
    const retorno=await worker.fetch(request('listarVendedores'),env);
    const resposta=await retorno.json();
    assert.equal(retorno.status,200);
    assert.equal(resposta.ok,true);
    assert.equal(post,1);
    assert.equal(get,2);

    let chamado=false;
    globalThis.fetch=async()=>{chamado=true;throw new Error('rede privada: token secreto');};
    const erro=await (await worker.fetch(request('listarVendedores'),env)).json();
    assert.equal(erro.erro,'Diagnóstico: FALHA_POST_GOOGLE');
    assert.equal(chamado,true);
    assert.ok(!JSON.stringify(erro).includes('secreto'));

    globalThis.fetch=async()=>new Response('<html>sem JSON</html>',{headers:{'content-type':'text/html'}});
    const html=await (await worker.fetch(request('listarVendedores'),env)).json();
    assert.match(html.erro,/RESPOSTA_NAO_JSON_.*_HTML/);
    assert.ok(!JSON.stringify(html).includes('<html>'));

    let calls=0;globalThis.fetch=async()=>{calls++;return new Response('{}');};
    assert.equal((await worker.fetch(request('salvarVendedor',''),env)).status,401);
    assert.equal(calls,0);
    assert.equal((await worker.fetch(request('consultarPainelGerente',''),env)).status,502);
    assert.equal(calls,1);
  }finally{globalThis.fetch=original;}
});
