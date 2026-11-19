/* Atualização automática segura em hospedagem estática (GitHub Pages).
   Compara scripts/estilos e identificador de build contra HTML remoto sem cache.
   Nunca apaga localStorage nem interfere em alterações não salvas do admin. */
(function(){
  'use strict';
  const page=location.pathname.split('/').pop()||'index.html';
  if(!['index.html','admin.html','gerentes.html'].includes(page))return;
  const nome='martinello-build';
  const paginaScripts=dom=>{
    const refs=[...dom.querySelectorAll('script[src],link[rel="stylesheet"][href]')]
      .map(el=>el.getAttribute('src')||el.getAttribute('href')||'')
      .filter(x=>x&&!/^https?:\/\//i.test(x)&&!x.startsWith('//'));
    const build=dom.querySelector('meta[name="'+nome+'"]')?.getAttribute('content')||'';
    return JSON.stringify({refs,build});
  };
  const inicial=paginaScripts(document);
  let verificando=false,ultimo=0;
  function podeRecarregar(){
    if(page==='admin.html')return false; // Preserva formulários e alterações abertas.
    if(page==='gerentes.html')
      return document.getElementById('gerentesPainel')?.hidden!==false;
    const p=typeof IndexPresenter==='undefined'?null:IndexPresenter;
    // Não recarregar durante a abertura do WhatsApp, preenchimento do telefone
    // ou antes de o vendedor compartilhar a mensagem que já foi preparada.
    // Depois de um compartilhamento concluído, a atualização volta a ser automática.
    return !p?.enviando && (!p?._compartilhamento || p._compartilhouAoMenosUmaVez===true)
      && document.getElementById('portalTelefoneModal')?.hidden!==false;
  }
  function banner(){
    if(document.getElementById('martAtualizacaoAviso'))return;
    const div=document.createElement('div');div.id='martAtualizacaoAviso';
    div.setAttribute('role','status');
    div.style.cssText='position:fixed;z-index:11001;bottom:14px;left:14px;right:14px;max-width:540px;margin:auto;padding:14px 16px;border-radius:12px;background:#252833;color:white;box-shadow:0 4px 20px #0006;font:600 14px Arial,sans-serif;display:flex;gap:12px;align-items:center;flex-wrap:wrap';
    const txt=document.createElement('span');txt.textContent='Uma versão mais recente está disponível. Atualize após terminar a ação atual.';
    const btn=document.createElement('button');btn.textContent='ATUALIZAR PORTAL';btn.type='button';
    btn.style.cssText='border:none;border-radius:8px;background:#da303a;color:white;padding:10px 14px;font:700 13px Arial;cursor:pointer';
    btn.onclick=atualizar;
    div.append(txt,btn);document.body.appendChild(div);
  }
  function atualizar(){
    try{
      if(page==='index.html')sessionStorage.setItem('martAtualizacaoMatricula',document.getElementById('cod')?.value||'');
    }catch(_){}
    const u=new URL(location.href);u.searchParams.set('portal_atualizado',String(Date.now()));
    // Query nova força novo HTML mesmo quando browser tem versão antiga em cache.
    location.replace(u.href);
  }
  async function verificar(){
    if(verificando||document.hidden||Date.now()-ultimo<15000)return;
    verificando=true;ultimo=Date.now();
    try{
      const u=new URL(page,location.href);
      u.searchParams.set('mart_versao',String(Date.now()));
      const res=await fetch(u.href,{cache:'no-store',credentials:'same-origin'});
      if(!res.ok)return;
      const doc=new DOMParser().parseFromString(await res.text(),'text/html');
      if(paginaScripts(doc)===inicial)return;
      if(podeRecarregar())atualizar();else banner();
    }catch(e){console.warn('Atualização automática indisponível:',e?.name||'erro');}
    finally{verificando=false;}
  }
  window.MartinelloAtualizacao={verificar,atualizar,versao:nome};
  document.addEventListener('DOMContentLoaded',()=>{
    if(page==='index.html'){
      try{
        const cod=sessionStorage.getItem('martAtualizacaoMatricula');
        if(cod&&document.getElementById('cod')){
          const input=document.getElementById('cod');
          input.value=cod;
          sessionStorage.removeItem('martAtualizacaoMatricula');
          // Atualiza a validação e prepara a imagem/legenda após o reload.
          input.dispatchEvent(new Event('input',{bubbles:true}));
        }
      }catch(_){}
    }
    setTimeout(verificar,3500);
    setInterval(verificar,120000);
    window.addEventListener('pageshow',()=>setTimeout(verificar,3000));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(verificar,2000);});
  });
})();
