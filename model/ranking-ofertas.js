// Ranking público: somente a oferta líder, sem nomes, matrícula ou contagens.
const RankingOfertas = {
    _chave:'', _lider:'', _consultadoEm:0, _pendente:null, _ultimaFalhaEm:0,
    liderAtivas(ativas) {
        const id=String(this._lider||'');
        return (ativas||[]).some(o=>String(o.id)===id) ? id : '';
    },
    carregar(ativas) {
        const ids=[...new Set((ativas||[]).map(o=>String(o.id))
          .filter(id=>/^[A-Za-z0-9_-]{1,40}$/.test(id)))].sort().slice(0,40);
        if(!ids.length)return Promise.resolve('');
        const chave=ids.join(',');
        const agora=Date.now();
        if(this._chave===chave && agora-this._consultadoEm<15*60*1000)
            return Promise.resolve(this.liderAtivas(ativas));
        if(this._pendente?.chave===chave)return this._pendente.promessa;
        // Após falha de rede, nunca confundir ausência de resposta com ausência de atividade.
        // Reconsultar em 30s, e não bloquear 15 minutos por uma falha.
        if(this._ultimaFalhaEm && agora-this._ultimaFalhaEm<30000)
            return Promise.resolve(this.liderAtivas(ativas));
        const endpoint=String(CONFIG.portalEventsApiUrl||'');
        if(!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(endpoint)){
            this._ultimaFalhaEm=Date.now();return Promise.resolve(this.liderAtivas(ativas));
        }
        const promessa=new Promise(resolve=>{
            let script,timeout,acabou=false;
            const requestId=`rk_${Date.now()}_${Math.random().toString(36).slice(2,14)}`;
            const callback=d=>{
                if(d?.requestId===requestId && typeof d.ofertaId==='string')
                    finalizar({ok:true,id:d.ofertaId});
            };
            function finalizar(resultado){
                if(acabou)return;
                acabou=true;clearTimeout(timeout);script?.remove();
                if(window.MartinelloRankingReceber===callback)delete window.MartinelloRankingReceber;
                resolve(resultado);
            }
            window.MartinelloRankingReceber=callback;
            const url=new URL(endpoint);
            url.searchParams.set('action','rankingOfertas');
            url.searchParams.set('requestId',requestId);
            url.searchParams.set('ids',chave);
            script=document.createElement('script');script.src=url.href;script.async=true;
            script.onerror=()=>finalizar({ok:false,id:''});
            timeout=setTimeout(()=>finalizar({ok:false,id:''}),14000);
            document.head.appendChild(script);
        }).then(resultado=>{
            if(this._pendente?.chave===chave){
                if(resultado.ok){
                    this._chave=chave;
                    this._lider=ids.includes(resultado.id)?resultado.id:'';
                    this._consultadoEm=Date.now();
                    this._ultimaFalhaEm=0;
                }else{
                    this._ultimaFalhaEm=Date.now();
                    // Preservar último líder conhecido do mesmo conjunto sem apresentar
                    // contagem inventada. Uma falha não vale como resposta vazia.
                    if(this._chave!==chave)this._lider='';
                }
            }
            return this.liderAtivas(ativas);
        }).finally(()=>{if(this._pendente?.chave===chave)this._pendente=null;});
        this._pendente={chave,promessa};
        return promessa;
    }
};
