// ============================================
// model/storage.js — CAMADA DE DADOS UNIFICADA
// ============================================

const Storage = {

    _salvando: false,

    // ---------- VERSÃO DO CACHE ----------
    // Quando CACHE_VERSION muda, limpa localStorage antigo automaticamente
    // Resolve o problema de vendedores com dados de versões antigas

    verificarVersao() {
        const versaoSalva = localStorage.getItem('cacheVersion');
        if (versaoSalva !== CONFIG.CACHE_VERSION) {
            console.log(`🔄 Versão do cache mudou (${versaoSalva} → ${CONFIG.CACHE_VERSION}) — limpando dados antigos...`);
            const chaves = ['ofertasMartinello', 'ofertaAtiva', 'configTelaEmBreve', 'ultimaMatricula'];
            chaves.forEach(k => { try { localStorage.removeItem(k); } catch(e) {} });
            try { localStorage.setItem('cacheVersion', CONFIG.CACHE_VERSION); } catch(e) {}
            console.log('✅ Cache limpo e atualizado para v' + CONFIG.CACHE_VERSION);
        }
    },

    // ---------- UTILITÁRIOS DE QUOTA ----------

    _ofertaSemImagem(oferta) {
        if (!oferta) return oferta;
        const { urlImagem, ...resto } = oferta;
        const isBase64 = urlImagem && urlImagem.startsWith('data:');
        return isBase64 ? resto : oferta;
    },

    _salvarLocalSafe(chave, valor) {
        try {
            localStorage.setItem(chave, JSON.stringify(valor));
            return true;
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                console.warn('⚠️ localStorage cheio — limpando imagens base64...');
                this._limparImagensBase64();
                try {
                    localStorage.setItem(chave, JSON.stringify(valor));
                    return true;
                } catch {
                    console.error('❌ localStorage ainda cheio após limpeza');
                    return false;
                }
            }
            return false;
        }
    },

    _limparImagensBase64() {
        ['ofertasMartinello', 'ofertaAtiva', 'configTelaEmBreve'].forEach(k => {
            try {
                const raw = localStorage.getItem(k);
                if (raw && raw.indexOf('data:image') !== -1) {
                    localStorage.removeItem(k);
                    console.log('🧹 Removido (base64 pesado):', k);
                }
            } catch(e) {}
        });
    },

    verificarQuota() {
        try {
            localStorage.setItem('_t', '1');
            localStorage.removeItem('_t');
        } catch(e) {
            console.warn('⚠️ localStorage cheio na inicialização — limpando...');
            this._limparImagensBase64();
        }
    },

    // ---------- OFERTAS ----------

    async carregarOfertas() {
        if (this._salvando) {
            console.log('⏳ Save em andamento — usando localStorage');
            const local = JSON.parse(localStorage.getItem('ofertasMartinello') || '[]');
            this._atualizarAtiva(local);
            return local;
        }

        try {
            console.log('📡 Buscando ofertas no Firebase...');
            const snap  = await ofertasRef.once('value');
            const dados = snap.val();
            const arr   = Array.isArray(dados) ? dados
                        : dados && typeof dados === 'object' ? Object.values(dados)
                        : [];

            console.log(`✅ ${arr.length} oferta(s) carregada(s) do Firebase`);

            if (arr.length > 0 || dados !== null) {
                // Salvar sem base64 no localStorage (economiza quota)
                const semImagens = arr.map(o => this._ofertaSemImagem(o));
                this._salvarLocalSafe('ofertasMartinello', semImagens);
            }

            this._atualizarAtiva(arr); // array completo (com imagem) para a oferta ativa
            return arr;
        } catch (e) {
            console.warn('⚠️ Firebase indisponível — usando localStorage:', e.message);
            const local = JSON.parse(localStorage.getItem('ofertasMartinello') || '[]');
            this._atualizarAtiva(local);
            return local;
        }
    },

    async salvarOfertas(ofertas) {
        console.log('💾 Salvando', ofertas.length, 'oferta(s)...');

        const semImagens = ofertas.map(o => this._ofertaSemImagem(o));
        this._salvarLocalSafe('ofertasMartinello', semImagens);
        this._atualizarAtiva(ofertas);

        this._salvando = true;
        try {
            await ofertasRef.set(ofertas);
            this._salvando = false;
            console.log('☁️ Sincronizado com Firebase!');
            return true;
        } catch (e) {
            this._salvando = false;
            console.warn('⚠️ Firebase offline — salvo apenas localmente:', e.message);
            return false;
        }
    },

    _atualizarAtiva(ofertas) {
        const agora = getHorarioBrasilia();
        const ativa = ofertas.find(o => isOfertaAtiva(o, agora)) || null;
        if (ativa) {
            // Salvar metadados SEM imagem base64 + guardar urlImagem separado (só a string)
            this._salvarLocalSafe('ofertaAtiva', this._ofertaSemImagem(ativa));
            // Guardar só a URL da imagem separadamente — string pequena
            if (ativa.urlImagem) {
                this._salvarLocalSafe('ofertaAtivaImagem', ativa.urlImagem);
            } else {
                localStorage.removeItem('ofertaAtivaImagem');
            }
            console.log('🟢 Oferta ativa:', ativa.tituloPagina);
        } else {
            localStorage.removeItem('ofertaAtiva');
            localStorage.removeItem('ofertaAtivaImagem');
            console.log('⏸️ Nenhuma oferta ativa no momento');
        }
        return ativa;
    },

    ofertaAtivaDoCache() {
        try {
            const raw = localStorage.getItem('ofertaAtiva');
            if (!raw) return null;
            const oferta = JSON.parse(raw);
            if (!isOfertaAtiva(oferta, getHorarioBrasilia())) {
                console.log('⌛ Oferta do cache expirou — removendo');
                localStorage.removeItem('ofertaAtiva');
                localStorage.removeItem('ofertaAtivaImagem');
                return null;
            }
            // Recompor a imagem do cache separado
            const imgCache = localStorage.getItem('ofertaAtivaImagem');
            if (imgCache) oferta.urlImagem = imgCache;
            console.log('⚡ Oferta carregada do cache:', oferta.tituloPagina);
            return oferta;
        } catch { return null; }
    },

    // ---------- CONFIG EM BREVE ----------

    carregarConfigEmBreve() {
        try { return JSON.parse(localStorage.getItem('configTelaEmBreve') || 'null'); }
        catch { return null; }
    },

    salvarConfigEmBreve(config) {
        const cfgParaSalvar = { ...config };
        // Imagens base64 muito grandes não entram no localStorage
        if (cfgParaSalvar.imagem?.startsWith('data:') && cfgParaSalvar.imagem.length > 100000) {
            console.warn('⚠️ Imagem da config muito grande — não salva no cache local');
            cfgParaSalvar.imagem = 'img/produto.png';
        }
        this._salvarLocalSafe('configTelaEmBreve', cfgParaSalvar);
        console.log('💾 Config "Em Breve" salva');
    },

    // ---------- PREFERÊNCIAS ----------

    salvarTema(tema)            { localStorage.setItem('tema', tema); },
    carregarTema()              { return localStorage.getItem('tema') || 'light'; },
    salvarUltimaMatricula(cod)  { this._salvarLocalSafe('ultimaMatricula', cod); },
    carregarUltimaMatricula()   { return localStorage.getItem('ultimaMatricula') || ''; },
};
