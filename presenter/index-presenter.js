// Portal Martinello — seleção de várias ofertas simultâneas (1.6.2)
const IndexPresenter = {
    ofertas: [],
    ofertaAtual: null,
    buscando: false,
    enviando: false,
    intervalo: null,
    _assinatura: '',
    pararSyncOfertas: null,
    _rankingSolicitado: '',
    _ultimaTentativaRanking: 0,
    _aparenciaOuvindo: false,
    _selecaoManual: false,
    _destaqueAnterior: undefined,
    _avisosHoje: new Set(),
    _compartilhamento:null,
    _compartilhouAoMenosUmaVez:false,
    _preparoToken:0,
    _preparoTimer:null,
    _preparandoChave:'',
    _preparoFalha:null,

    async init() {
        Storage.verificarQuota();
        UI.tema.aplicar(Storage.carregarTema());
        UI.imagemFallback(document.getElementById('fotoProduto'), this._configEmBreve().imagem);
        const cod = Storage.carregarUltimaMatricula();
        if (cod) {
            const input = document.getElementById('cod');
            input.value = cod;
            this._atualizarBordaMatricula(input);
        }
        // O registro agora usa um coletor público limitado (Google Sheets).
        // Não requer login Firebase dos vendedores.
        this._renderCarregando();
        // Identificação de campanha não bloqueia a vitrine; registrar assim que for resolvida.
        CampanhasPortal.carregar().catch(()=> '').then(()=>AnalyticsService.registrarVisita())
            .catch(e=>console.warn('Visita não registrada:',e));
        const cache = Storage.ofertasDoCache();
        if (cache.length) this._aplicarOfertas(cache);
        this.intervalo = setInterval(() => this._tick(), 1000);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) { clearInterval(this.intervalo); this.intervalo = null; }
            else { this._syncFirebase(); if (!this.intervalo) this.intervalo = setInterval(() => this._tick(), 1000); }
        });
        await this._syncFirebase();
        this.pararSyncOfertas=Storage.escutarOfertas(ofertas => {
            this._aplicarOfertas(ofertas);
            this._assinatura=this._ativas().map(o=>String(o.id)).join(',');
        }, e=>console.warn('Sincronização de ofertas temporariamente indisponível:',e));
        // Identidade visual pública: atualizada em todos os celulares e computadores.
        this._carregarAparencia();
        // A assinatura do Firebase já notifica a cada alteração; evita consultas repetidas.
    },

    async _carregarAparencia() {
        try {
            const dados = await AparenciaPortal.carregar();
            this._aplicarAparencia(dados);
            // Atualizar identidade visual em tempo real nos dois portais.
            if (!this._aparenciaOuvindo) {
                this._aparenciaOuvindo=true;
                AparenciaPortal.referencia.on('value', snap => {
                    const dados = snap.exists() ? AparenciaPortal._normalizar(snap.val()) : {...AparenciaPortal.padrao};
                    AparenciaPortal.dados=dados;
                    this._aplicarAparencia(dados);
                },erro=>console.warn('Aparência: sincronização indisponível:',erro));
            }
        } catch (erro) {
            console.warn('Aparência pública indisponível, mantendo padrão:', erro.message);
        }
    },
    _aplicarAparencia(dados) {
        const logo=document.getElementById('logoPortal');
        if(logo)logo.src=dados?.logo||'img/logo.png';
        this._renderCatalogo(this._ativas());
        this._renderOferta(this.ofertaAtual);
    },

    _configEmBreve() {
        return AparenciaPortal.dados || Storage.carregarConfigEmBreve() || {
            imagem: 'img/produto.png', titulo: 'EM BREVE',
            mensagem: 'Estamos preparando novidades especiais! Fique ligado.'
        };
    },

    _ativas(agora = getHorarioBrasilia()) {
        return this.ofertas.filter(o => isOfertaAtiva(o, agora))
            .sort((a,b) => (a.tituloPagina || '').localeCompare(b.tituloPagina || '', 'pt-BR'));
    },

    _renderCarregando() {
        document.getElementById('tituloPagina').textContent = 'CARREGANDO...';
        document.getElementById('infoOferta').textContent = 'Verificando...';
        document.getElementById('infoStatus').textContent = 'CARREGANDO...';
        document.getElementById('infoStatus').className = 'status-text status-carregando';
        document.getElementById('cod').disabled = true;
        document.getElementById('btnEnviar').disabled = true;
        document.querySelector('#btnEnviar .btn-text').textContent = 'CARREGANDO...';
    },

    _aplicarOfertas(ofertas) {
        this.ofertas = Array.isArray(ofertas) ? ofertas : [];
        const ativas = this._ativas();
        const atual = ativas.find(o => String(o.id) === String(this.ofertaAtual?.id));
        if(!atual)this._selecaoManual=false;
        // A escolha manual só é interrompida pela entrada de um NOVO destaque.
        // Atualizações normais do Firebase/ranking não mudam a escolha do vendedor.
        const destaqueVigente=PortalPreferencias.destaque(ativas,getHorarioBrasilia());
        const destaqueId=destaqueVigente?String(destaqueVigente.id):'';
        if(this._destaqueAnterior!==undefined && destaqueId && destaqueId!==this._destaqueAnterior)
            this._selecaoManual=false;
        this._destaqueAnterior=destaqueId;
        this.ofertaAtual = PortalPreferencias.inicial(ativas,RankingOfertas.liderAtivas(ativas),atual,this._selecaoManual,getHorarioBrasilia());
        if(this._compartilhamento && !this._preparoValido(this.ofertaAtual,this._compartilhamento.matricula)){
            this._compartilhamento=null;
            this._preparoToken++;
            this._preparoFalha=null;
        }
        this._renderCatalogo(ativas);
        this._renderOferta(this.ofertaAtual);
        this._atualizarRanking(ativas);
    },

    _atualizarRanking(ativas) {
        const ids = ativas.map(o=>String(o.id)).sort().join(',');
        if (!ids) return;
        if (ids === this._rankingSolicitado && Date.now()-this._ultimaTentativaRanking<60000) return;
        this._rankingSolicitado = ids;
        this._ultimaTentativaRanking = Date.now();
        RankingOfertas.carregar(ativas).then(() => {
            // Nunca aplicar resultado de um conjunto desatualizado.
            if (this._rankingSolicitado !== ids) return;
            const atuais=this._ativas();
            this.ofertaAtual=PortalPreferencias.inicial(atuais,RankingOfertas.liderAtivas(atuais),this.ofertaAtual,this._selecaoManual||this.enviando,getHorarioBrasilia());
            this._renderCatalogo(atuais);
            this._renderOferta(this.ofertaAtual);
        }).catch(() => {});
    },

    _renderCatalogo(ativas) {
        const secao=document.getElementById('secaoCatalogo');
        const grid=document.getElementById('catalogoOfertas');
        const total=document.getElementById('totalCatalogo');
        const painel=document.getElementById('destaquesOfertas');
        if(!secao||!grid||!painel)return;
        const lider=RankingOfertas.liderAtivas(ativas);
        const escolhida=PortalPreferencias.destaque(ativas,getHorarioBrasilia());
        const cards=[];
        const mais=ativas.find(o=>String(o.id)===lider);
        if(mais)cards.push({o:mais,selo:'★ MAIS ACIONADA'});
        if(escolhida && String(escolhida.id)!==String(mais?.id))cards.push({o:escolhida,selo:'✦ DESTAQUE DO DIA'});
        // Caso coincidam, exibir um único card com identificação combinada.
        if(escolhida && mais && String(escolhida.id)===String(mais.id))cards[0].selo='★ MAIS ACIONADA · DESTAQUE DO DIA';
        const ids=new Set(cards.map(c=>String(c.o.id)));
        secao.hidden=ativas.length<2 && !cards.length;
        total.textContent=`${ativas.length} oferta${ativas.length===1?'':'s'} ${ativas.length===1?'disponível':'disponíveis'}`;
        painel.replaceChildren();grid.replaceChildren();
        const montar=(oferta,selo,classe)=>{
            const btn=document.createElement('button');btn.type='button';btn.className=classe;
            const selecionado=String(oferta.id)===String(this.ofertaAtual?.id);
            btn.setAttribute('aria-pressed',String(selecionado));
            if(selecionado)btn.classList.add('selecionada');
            const img=document.createElement('img');img.src=oferta.urlImagem||'img/produto.png';img.alt='';
            img.loading='lazy';img.decoding='async';img.onerror=()=>{img.onerror=null;img.src='img/produto.png';};
            const texto=document.createElement('strong');texto.textContent=oferta.tituloPagina||'Oferta';
            btn.append(img,texto);
            if(selo){const tag=document.createElement('small');tag.textContent=selo;btn.prepend(tag);}
            btn.addEventListener('click',()=>this.selecionarOferta(oferta.id));return btn;
        };
        for(const c of cards)painel.appendChild(montar(c.o,c.selo,'oferta-destaque'));
        for(const oferta of ativas.filter(o=>!ids.has(String(o.id))))
            grid.appendChild(montar(oferta,'','catalogo-item'));
    },

    selecionarOferta(id) {
        const oferta = this._ativas().find(o => String(o.id) === String(id));
        if (!oferta) return;
        this._selecaoManual = true;
        this.ofertaAtual = oferta;
        this._compartilhamento=null;
        this._compartilhouAoMenosUmaVez=false;
        this._preparoToken++;
        this._preparoFalha=null;
        clearTimeout(this._preparoTimer);
        this._fecharAlternativo();
        this._renderCatalogo(this._ativas());
        this._renderOferta(oferta);
        const botao=document.getElementById('btnEnviar');
        botao?.focus({preventScroll:true});
        botao?.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    },

    _renderOferta(oferta) {
        const cfg = this._configEmBreve();
        const info = document.getElementById('infoOferta');
        const status = document.getElementById('infoStatus');
        const msg = document.getElementById('mensagemEmBreve');
        const countdown = document.getElementById('infoCountdown');
        const btn = document.getElementById('btnEnviar');
        const titulo = oferta?.tituloPagina || cfg.titulo;
        document.getElementById('tituloPagina').textContent = titulo;
        document.getElementById('fotoProduto').src = oferta?.urlImagem || cfg.imagem;
        document.getElementById('cod').disabled = !oferta;
        btn.disabled = !oferta || this.enviando;
        const codigo=document.getElementById('cod')?.value?.trim()||'';
        const pronto=this._preparoValido(oferta,codigo);
        const copiar=document.getElementById('btnCopiarLegenda');
        if(copiar)copiar.hidden=!pronto;
        const valida=Validators.matricula(codigo);
        const falha=this._preparoFalha && this._preparoFalha.chave===this._chavePreparo(oferta,codigo);
        const mensagem=!oferta?'EM BREVE':!valida?'DIGITE SUA MATRÍCULA':pronto
            ?'GERAR E COMPARTILHAR ESTA OFERTA':falha?'TENTAR VALIDAR NOVAMENTE':'PREPARANDO OFERTA...';
        btn.querySelector('.btn-text').textContent=mensagem;
        // O botão só pode abrir o Web Share quando imagem + legenda + matrícula
        // já estão prontos. Assim o clique abre o seletor Android sem await.
        btn.disabled=!oferta || this.enviando || !valida || (!pronto&&!falha);
        if(oferta && valida && !pronto && !this.enviando)
            this._agendarPreparo(oferta,codigo);
        info.textContent = oferta ? titulo : 'EM BREVE';
        status.textContent = oferta ? '✅ OFERTA DISPONÍVEL' : '⏸️ SEM OFERTAS';
        status.className = `status-text ${oferta ? 'status-ativo' : 'status-embreve'}`;
        msg.textContent = oferta ? '' : cfg.mensagem;
        msg.style.display = !oferta && cfg.mensagem ? 'block' : 'none';
        if (countdown) {
            countdown.style.display = oferta ? '' : 'none';
            const el = countdown.querySelector('span');
            if (el) el.textContent = oferta ? `Encerra em ${countdownTexto(oferta.dataFim) || 'instantes'}` : '';
        }
    },

    _tick() {
        // Atualizar a oferta mais acionada quando voltar a conexão, inclusive no celular.
        if(!document.hidden && this.ofertas.length && Date.now()-this._ultimaTentativaRanking>=60000)
            this._atualizarRanking(this._ativas());
        const agora = getHorarioBrasilia();
        document.getElementById('infoHoraBrasilia').textContent = formatarBrasilia(agora);
        const atual = this._ativas(agora);
        const ids = atual.map(o => String(o.id)).join(',');
        // Detectar também destaques que iniciam por agendamento sem gravar no Firebase.
        const destaqueAgora=PortalPreferencias.destaque(atual,agora);
        const mudouDestaque=this._destaqueAnterior!==undefined
            && String(destaqueAgora?.id||'')!==this._destaqueAnterior;
        if (ids !== this._assinatura || mudouDestaque || (this.ofertaAtual && !isOfertaAtiva(this.ofertaAtual, agora))) {
            this._assinatura = ids;
            this._aplicarOfertas(this.ofertas);
            return;
        }
        if (this.ofertaAtual) {
            const el = document.querySelector('#infoCountdown span');
            if (el) el.textContent = `Encerra em ${countdownTexto(this.ofertaAtual.dataFim) || 'instantes'}`;
        }
    },

    async _syncFirebase() {
        if (this.buscando) return;
        this.buscando = true;
        try {
            const ofertas = await Storage.carregarOfertas();
            this._aplicarOfertas(ofertas);
            this._assinatura = this._ativas().map(o => String(o.id)).join(',');
        } catch (erro) {
            console.error('Não foi possível carregar ofertas:', erro);
            UI.erro('Não foi possível atualizar as ofertas.');
        } finally { this.buscando = false; }
    },

    validarMatriculaInput(input) {
        const anterior=input.value;
        input.value=input.value.replace(/\D/g,'').replace(/^0+/,'').slice(0,5);
        if(this._compartilhamento?.matricula!==input.value || anterior!==input.value){
            this._compartilhamento=null;
            this._preparoToken++;
            this._preparoFalha=null;
            clearTimeout(this._preparoTimer);
            this._fecharAlternativo();
        }
        this._atualizarBordaMatricula(input);
        this._renderOferta(this.ofertaAtual);
    },
    _atualizarBordaMatricula(input) {
        const valido = Validators.matricula(input.value);
        input.style.borderColor = !input.value ? '' : valido ? 'var(--whatsapp-color)' : '#dc3545';
    },

    async _avisarNaoVendedor(cod) {
        const hoje=PortalPreferencias.dia();
        const chave='mart:nao-vendedor:'+location.pathname+':'+cod;
        const memoria=chave+':'+hoje;
        if(this._avisosHoje.has(memoria))return;
        let armazenamento;try{armazenamento=window.localStorage;}catch(_){armazenamento=null;}
        if(!PortalPreferencias.deveAvisar(armazenamento,chave,hoje))return;
        const card=document.getElementById('avisoNaoVendedor');
        if(!card)return;
        this._avisosHoje.add(memoria);
        card.hidden=false;
        const continuar=document.getElementById('avisoNaoVendedorContinuar');
        continuar?.focus({preventScroll:true});
        // O aviso é mostrado ANTES de tentar abrir a tela de compartilhamento.
        // Continua após confirmação/fechamento ou, automaticamente, após 20 segundos.
        return await new Promise(resolve=>{
            this._avisoResolucao=resolve;
            clearInterval(this._avisoTimer);
            let restante=20;
            const contador=document.getElementById('avisoNaoVendedorContador');
            const atualizar=()=>{if(contador)contador.textContent=String(restante);};
            atualizar();
            this._avisoTimer=setInterval(()=>{
                if(document.hidden)return;
                restante--;
                atualizar();
                if(restante<=0)this.fecharAvisoNaoVendedor('tempo');
            },1000);
        });
    },
    fecharAvisoNaoVendedor(motivo='continuar'){
        clearInterval(this._avisoTimer);
        this._avisoTimer=null;
        const card=document.getElementById('avisoNaoVendedor');
        if(card)card.hidden=true;
        const resolver=this._avisoResolucao;
        this._avisoResolucao=null;
        if(resolver)resolver(motivo);
    },

    _preparoValido(oferta,matricula){
        const p=this._compartilhamento;
        return !!p&&!!oferta&&p.matricula===String(matricula||'')
            &&p.ofertaId===String(oferta.id)&&p.textoOferta===String(oferta.textoOferta||'')
            &&p.urlImagem===String(oferta.urlImagem||'')
            &&p.linkProduto===String(oferta.linkProduto||'')
            &&p.campanha===String(oferta.campanha||'')
            &&Date.now()-p.criadoEm<5*60*1000;
    },

    _fecharAlternativo(){
        const card=document.getElementById('compartilhamentoAlternativo');
        if(card)card.hidden=true;
    },
    _abrirAlternativo(){
        const card=document.getElementById('compartilhamentoAlternativo');
        if(card){card.hidden=false;card.scrollIntoView({behavior:'smooth',block:'center'});}
    },
    async copiarTextoAlternativo(){
        const txt=this._compartilhamento?.preparado?.texto;
        if(!txt)return;
        try{
            if(!navigator.clipboard?.writeText)throw Error('SEM_CLIPBOARD');
            await navigator.clipboard.writeText(txt);
            UI.ok('Texto copiado! Cole como legenda da imagem no WhatsApp.');
        }catch(_){UI.erro('Seu navegador não permitiu copiar automaticamente. Use outro navegador ou o compartilhamento nativo.');}
    },
    baixarImagemAlternativa(){
        const arquivo=this._compartilhamento?.preparado?.file;
        if(!arquivo)return;
        const url=URL.createObjectURL(arquivo),link=document.createElement('a');
        link.href=url;link.download=arquivo.name||'oferta.png';
        document.body.appendChild(link);link.click();link.remove();
        setTimeout(()=>URL.revokeObjectURL(url),30000);
        UI.ok('Imagem preparada. Anexe-a no WhatsApp e cole o texto.');
    },
    abrirWhatsAppAlternativo(){
        if(!this._compartilhamento)return;
        // O WhatsApp web não permite anexar arquivo pelo link wa.me.
        // Exigir ação explícita: imagem baixada e legenda copiada manualmente.
        window.open('https://wa.me/','_blank','noopener');
    },

    // O preparo é iniciado ao terminar de digitar a matrícula ou selecionar uma
    // oferta. A chamada real ao menu nativo fica exclusivamente no clique.
    _chavePreparo(oferta,matricula){
        if(!oferta)return '';
        return [oferta.id,matricula,oferta.urlImagem?.length||0,oferta.linkProduto,
            oferta.textoOferta?.length||0,oferta.campanha].join('|');
    },
    _agendarPreparo(oferta,matricula,forcar=false){
        if(!oferta||!Validators.matricula(matricula)||!oferta.urlImagem)return;
        const chave=this._chavePreparo(oferta,matricula);
        if(this._preparoValido(oferta,matricula)||this._preparandoChave===chave)return;
        if(this._preparoFalha?.chave===chave && !forcar)return;
        clearTimeout(this._preparoTimer);
        const token=++this._preparoToken;
        if(forcar)this._preparoFalha=null;
        this._preparoTimer=setTimeout(()=>this._prepararAutomaticamente(oferta,matricula,chave,token),forcar?0:650);
    },
    _preparoAindaAtual(oferta,matricula,chave,token){
        return token===this._preparoToken && this._chavePreparo(this.ofertaAtual,
            document.getElementById('cod')?.value.trim())===chave;
    },
    async _prepararAutomaticamente(oferta,matricula,chave,token){
        if(!this._preparoAindaAtual(oferta,matricula,chave,token))return;
        this._preparandoChave=chave;
        try{
            // Primeiro confirmação pelo servidor. Falha não equivale a matrícula
            // inexistente; nunca trocar silenciosamente um link de vendedor por genérico.
            const ativo=await TelefonePortal.consultarMatricula(matricula);
            if(!this._preparoAindaAtual(oferta,matricula,chave,token))return;
            let atribuicaoNaoConfirmada=false;
            if(ativo!==true&&ativo!==false){
                // Mantém o comportamento de emergência da versão antiga, mas
                // NUNCA troca silenciosamente a matrícula por link padrão.
                // O usuário decide sabendo que a atribuição pode falhar.
                const continuar=typeof window.confirm==='function' && window.confirm(
                    'Não foi possível consultar o Apps Script para confirmar a matrícula '+matricula+'.\n\n'+
                    'Deseja preparar um link de PARCEIRO usando esta matrícula mesmo assim? '+
                    'A atribuição da venda NÃO está garantida até a matrícula ser validada.\n\n'+
                    'CANCELAR = tentar validar novamente depois.');
                if(!continuar)
                    throw new Error('Matrícula não confirmada no Apps Script. Toque em TENTAR VALIDAR NOVAMENTE.');
                atribuicaoNaoConfirmada=true;
            }
            if(ativo===true){
                const continuar=await TelefonePortal.garantir(matricula);
                if(!continuar)return;
            }
            if(!this._preparoAindaAtual(oferta,matricula,chave,token))return;
            await CampanhasPortal.carregar().catch(e=>{
                // Campanha individual válida dispensa a geral para não bloquear
                // ofertas legítimas por uma consulta temporariamente indisponível.
                if(!CampanhasPortal.slug(oferta.campanha))throw e;
            });
            if(!this._preparoAindaAtual(oferta,matricula,chave,token))return;
            const link=LinkTrack.urlCompartilhavel(oferta,matricula,ativo===true||atribuicaoNaoConfirmada);
            const original=String(oferta.textoOferta||'');
            if(original.includes('\uFFFD'))throw new Error('O texto da oferta contém caracteres corrompidos (�). Corrija os emojis no admin.');
            const mensagem=formatarTexto(original,link,matricula);
            const preparado=await API.prepararCompartilhamento(mensagem,oferta.urlImagem);
            if(!this._preparoAindaAtual(oferta,matricula,chave,token))return;
            if(ativo===false) {
                // Mantém o aviso de não vendedor existente antes de disponibilizar
                // o botão. O link usado é o padrão sem atribuição.
                await this._avisarNaoVendedor(matricula);
                if(!this._preparoAindaAtual(oferta,matricula,chave,token))return;
            }
            this._compartilhouAoMenosUmaVez=false;
            this._compartilhamento={
                matricula,ofertaId:String(oferta.id),textoOferta:original,
                urlImagem:String(oferta.urlImagem),linkProduto:String(oferta.linkProduto||''),
                campanha:String(oferta.campanha||''),criadoEm:Date.now(),preparado,ativo:ativo===true
            };
            this._preparoFalha=null;
            if(atribuicaoNaoConfirmada)
                UI.erro('Atenção: link gerado com matrícula não confirmada. Confirme o cadastro para garantir a atribuição da venda.');
            Storage.salvarUltimaMatricula(matricula);
        }catch(e){
            if(this._preparoAindaAtual(oferta,matricula,chave,token)){
                const codigo=String(e?.message||'');
                this._preparoFalha={chave,mensagem:codigo};
                UI.erro(codigo.startsWith('IMAGEM_OFERTA_')
                    ?'Não foi possível preparar o banner desta oferta. Confira a imagem ou a conexão.'
                    :codigo||'Não foi possível preparar a oferta. Tente novamente.');
                console.warn('Preparo da oferta não concluído:',codigo);
            }
        }finally{
            if(this._preparandoChave===chave)this._preparandoChave='';
            if(token===this._preparoToken)this._renderOferta(this.ofertaAtual);
        }
    },

    // O clique chama o Web Share SINCRONAMENTE, já com arquivo e texto prontos.
    async enviar() {
        if(this.enviando)return;
        const oferta=this.ofertaAtual;
        if(!oferta||!isOfertaAtiva(oferta,getHorarioBrasilia())){
            UI.erro('Esta oferta não está mais disponível. Selecione outra.');return;
        }
        const codigo=document.getElementById('cod')?.value.trim()||'';
        if(!Validators.matricula(codigo)){
            UI.erro('Digite uma matrícula válida (3 a 5 números).');return;
        }
        if(!this._preparoValido(oferta,codigo)){
            this._preparoFalha=null;
            this._agendarPreparo(oferta,codigo,true);
            UI.erro('A oferta está sendo preparada. Compartilhe quando o botão estiver disponível.');
            this._renderOferta(oferta);
            return;
        }
        const btn=document.getElementById('btnEnviar');
        let share;
        try{
            // IMPORTANTE: este é o PRIMEIRO método assíncrono acionado no
            // clique; não aguardar Apps Script/Firebase/analytics antes dele.
            share=API.compartilharPreparado(this._compartilhamento.preparado);
        }catch(e){
            console.warn('Web Share indisponível:',e);
            this._abrirAlternativo();
            UI.erro('Não foi possível compartilhar imagem e texto juntos neste navegador. Use as opções abaixo para anexar manualmente.');
            return;
        }
        this.enviando=true;
        btn.disabled=true;
        // Início do compartilhamento, não confirmação de envio.
        if(this._compartilhamento.ativo===true){
            Promise.resolve().then(()=>AnalyticsService.registrarInicio(oferta,codigo))
                .catch(e=>console.warn('Rastreamento indisponível:',e));
            Promise.resolve().then(()=>API.rastrear(codigo,getBrowserName()))
                .catch(()=>{});
        }
        try{
            await share;
            this._compartilhouAoMenosUmaVez=true;
            this._fecharAlternativo();
        }catch(e){
            if(e?.name!=='AbortError'){
                this._abrirAlternativo();
                UI.erro('O compartilhamento com imagem não foi concluído. Tente de novo ou use as opções manuais.');
            }
        }finally{
            this.enviando=false;
            this._renderOferta(this.ofertaAtual);
        }
    }
};
document.addEventListener('DOMContentLoaded', () => IndexPresenter.init());
function enviar() { return IndexPresenter.enviar(); }
function validarMatricula(input) { IndexPresenter.validarMatriculaInput(input); }
