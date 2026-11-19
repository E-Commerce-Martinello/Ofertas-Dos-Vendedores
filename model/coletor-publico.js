/**
 * Portal de Ofertas — ponte de leitura pública via Cloudflare Worker.
 * O navegador não carrega mais diretamente URLs /exec do Google quando o proxy
 * está disponível. A versão antiga por JSONP continua como contingência.
 * Esta API nunca retorna dados de vendedor, apenas status booleanos e campanha.
 */
const ColetorPublico = {
    _acoes: Object.freeze({
        consultarMatricula:'ma_', consultarTelefone:'q_',
        consultarCampanha:'cp_', rankingOfertas:'rk_'
    }),
    endpoint(){
        const base=String(CONFIG.adminProxyUrl||'').trim();
        if(!/^https:\/\/[A-Za-z0-9.-]+\.workers\.dev\/?$/.test(base))return '';
        try{return new URL('/portal-status',base).href;}catch(_){return '';}
    },
    async consultar(acao, argumentos={}){
        const prefixo=this._acoes[acao];
        const endpoint=this.endpoint();
        if(!prefixo||!endpoint)return null;
        const requestId=prefixo+Date.now()+'_'+Math.random().toString(36).slice(2,12);
        const url=new URL(endpoint);
        url.searchParams.set('action',acao);
        url.searchParams.set('requestId',requestId);
        if(acao==='consultarMatricula'||acao==='consultarTelefone'){
            const rubi=String(argumentos.matricula||'');
            if(!/^\d{3,5}$/.test(rubi))return null;
            url.searchParams.set('matricula',rubi);
        } else if(acao==='rankingOfertas'){
            const ids=String(argumentos.ids||'');
            if(!ids||ids.length>1600||!ids.split(',').every(v=>/^[A-Za-z0-9_-]{1,40}$/.test(v)))return null;
            url.searchParams.set('ids',ids);
        }
        const ctrl=new AbortController();
        const timeout=setTimeout(()=>ctrl.abort(),11500);
        try{
            const res=await fetch(url.href,{
                method:'GET',mode:'cors',cache:'no-store',credentials:'omit',
                referrerPolicy:'no-referrer',signal:ctrl.signal
            });
            if(!res.ok)throw new Error('HTTP_'+res.status);
            const dados=await res.json();
            if(dados?.requestId!==requestId||dados?.ok!==true||
                typeof dados.disponivel!=='boolean')throw new Error('RESPOSTA_INVALIDA');
            return dados;
        }catch(e){
            // Não registrar matrícula, dados pessoais nem URLs com parâmetros.
            console.warn('Coletor via Worker indisponível:',String(e?.name||e?.message||'Erro'));
            return null;
        }finally{clearTimeout(timeout);}
    }
};
