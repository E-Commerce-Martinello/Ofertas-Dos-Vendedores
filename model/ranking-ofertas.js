// Ranking público: somente o ID da oferta líder, sem nomes, matrícula ou contagens.
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
        if(this._chave===chave&&agora-this._consultadoEm<15*60*1000)
            return Promise.resolve(this.liderAtivas(ativas));
        if(this._pendente?.chave===chave)return this._pendente.promessa;
        if(this._ultimaFalhaEm&&agora-this._ultimaFalhaEm<30000)
            return Promise.resolve(this.liderAtivas(ativas));
        const promessa=(async()=>{
            if(typeof ColetorPublico!=='undefined'){
                const prox=await ColetorPublico.consultar('rankingOfertas',{ids:chave});
                if(prox?.disponivel===true&&typeof prox.ofertaId==='string')
                    return {ok:true,id:prox.ofertaId};
                if(prox?.disponivel===false)return {ok:false,id:''};
            }
            return this._carregarJsonp(chave);
        })().then(resultado=>{
            if(this._pendente?.chave===chave){
                if(resultado.ok){
                    this._chave=chave;
                    this._lider=ids.includes(resultado.id)?resultado.id:'';
                    this._consultadoEm=Date.now();
                    this._ultimaFalhaEm=0;
                }else{
                    this._ultimaFalhaEm=Date.now();
                    if(this._chave!==chave)this._lider='';
                }
            }
            return this.liderAtivas(ativas);
        }).finally(()=>{if(this._pendente?.chave===chave)this._pendente=null;});
        this._pendente={chave,promessa};
        return promessa;
    },
    _carregarJsonp(chave) {
        const endpoint=String(CONFIG.portalEventsApiUrl||'');
        if(!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(endpoint))
            return Promise.resolve({ok:false,id:''});
        return new Promise(resolve=>{
            let script,timeout,acabou=false;
            const requestId=`rk_${Date.now()}_${Math.random().toString(36).slice(2,14)}`;
            const callback=d=>{
                if(d?.requestId===requestId&&typeof d.ofertaId==='string')
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
            timeout=setTimeout(()=>finalizar({ok:false,id:''}),12000);
            document.head.appendChild(script);
        });
    }
};
