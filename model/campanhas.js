// Configuração pública de campanhas no Sheets. Não consulta dados pessoais.
const CampanhasPortal = {
    geral:'',
    utmSource:'grupo_zap',
    utmId:'vendedores_zap',
    carregada:false,
    disponivel:false,
    consultadaEm:0,
    _pendente:null,
    slug(texto) {
        const t=String(texto||'').trim().toLowerCase();
        return /^[a-z0-9][a-z0-9_-]{0,59}$/.test(t)?t:'';
    },
    efetiva(oferta) {
        const individualBruto=this.slug(oferta?.campanha);
        const individual=individualBruto==='sem_campanha'?'':individualBruto;
        const geralBruto=this.slug(this.geral);
        const geral=geralBruto==='sem_campanha'?'':geralBruto;
        if(!individual&&!geral)
            throw new Error('Nenhuma campanha configurada. Defina a campanha geral no admin ou uma campanha individual nesta oferta.');
        return individual||geral;
    },
    _receber(dados) {
        if(!dados||dados.disponivel!==true||typeof dados.campanha!=='string')
            throw new Error('Não foi possível consultar a campanha geral. Verifique a conexão com o coletor.');
        this.geral=this.slug(dados.campanha);
        this.utmSource=this.slug(dados.utmSource)||'grupo_zap';
        this.utmId=this.slug(dados.utmId)||'vendedores_zap';
        this.carregada=true;
        this.disponivel=true;
        this.consultadaEm=Date.now();
        return this.geral;
    },
    carregar(forcar=false) {
        if(this._pendente)return this._pendente;
        if(!forcar&&this.carregada&&Date.now()-this.consultadaEm<30000)
            return Promise.resolve(this.geral);
        this._pendente=(async()=>{
            // Consulta servidor-a-servidor via Worker; evita redirecionamento do
            // Apps Script para conta Google do navegador normal do vendedor.
            if(typeof ColetorPublico!=='undefined'){
                const prox=await ColetorPublico.consultar('consultarCampanha');
                if(prox?.disponivel===true)return this._receber(prox);
                if(prox?.disponivel===false)
                    throw new Error('A campanha está indisponível na planilha do coletor. Confira as execuções do Apps Script.');
            }
            // Compatibilidade com Worker ainda não implantado.
            const dados=await this._consultarJsonp();
            return this._receber(dados);
        })().catch(e=>{
            this.disponivel=false;
            // Última campanha obtida nesta mesma sessão: aceita por até 15 min.
            // Evita bloquear vendedores por falha momentânea do Google.
            if(this.carregada&&Date.now()-this.consultadaEm<15*60*1000)
                return this.geral;
            this.carregada=false;
            throw e;
        }).finally(()=>{this._pendente=null;});
        return this._pendente;
    },
    _consultarJsonp() {
        const endpoint=String(CONFIG.portalEventsApiUrl||'');
        if(!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(endpoint))
            return Promise.reject(new Error('API pública de campanhas não configurada.'));
        return new Promise((resolve,reject)=>{
            let finalizado=false,script,timer;
            const req='cp_'+Date.now()+'_'+Math.random().toString(36).slice(2,13);
            const limpar=(dados,erro)=>{
                if(finalizado)return;
                finalizado=true;clearTimeout(timer);script?.remove();
                if(window.MartinelloCampanhaReceber===receber)delete window.MartinelloCampanhaReceber;
                if(erro||!dados||dados.disponivel!==true){
                    reject(new Error('Não foi possível atualizar a campanha geral. Verifique a conexão e o Apps Script coletor.'));
                    return;
                }
                resolve(dados);
            };
            const receber=d=>{if(d?.requestId===req)limpar(d,false);};
            window.MartinelloCampanhaReceber=receber;
            const url=new URL(endpoint);
            url.searchParams.set('action','consultarCampanha');
            url.searchParams.set('requestId',req);
            script=document.createElement('script');script.src=url.href;script.async=true;
            script.onerror=()=>limpar(null,true);
            timer=setTimeout(()=>limpar(null,true),10500);
            document.head.appendChild(script);
        });
    }
};
