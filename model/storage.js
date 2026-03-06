// ============================================
// model/storage.js — CAMADA DE DADOS UNIFICADA
// ============================================

const Storage = {

    _salvando: false,

    // URL do JSON de fallback no GitHub
    // Atualizado automaticamente pelo admin ao salvar ofertas
    _urlJsonFallback: null,

    _getUrlFallback() {
        // Detectar URL base do GitHub Pages automaticamente
        const origin = window.location.origin;
        const path   = window.location.pathname.split('/').slice(0, 2).join('/');
        return `${origin}${path}/ofertas.json`;
    },

    // ---------- VERSÃO DO CACHE ----------

    verificarVersao() {
        const versaoSalva = localStorage.getItem('cacheVersion');
        if (versaoSalva !== CONFIG.CACHE_VERSION) {
            console.log(`🔄 Versão do cache mudou (${versaoSalva} → ${CONFIG.CACHE_VERSION}) — limpando...`);
            ['ofertasMartinello', 'ofertaAtiva', 'ofertaAtivaImagem', 'configTelaEmBreve'].forEach(k => {
                try { localStorage.removeItem(k); } catch(e) {}
            });
            try { localStorage.setItem('cacheVersion', CONFIG.CACHE_VERSION); } catch(e) {}
            console.log('✅ Cache atualizado para v' + CONFIG.CACHE_VERSION);
        }
    },

    // ---------- QUOTA ----------

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
                console.warn('⚠️ localStorage cheio — limpando imagens...');
                this._limparImagensBase64();
                try { localStorage.setItem(chave, JSON.stringify(valor)); return true; }
                catch { console.error('❌ localStorage ainda cheio'); return false; }
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
        try { localStorage.setItem('_t', '1'); localStorage.removeItem('_t'); }
        catch(e) { this._limparImagensBase64(); }
    },

    // ---------- OFERTAS ----------

    async carregarOfertas() {
        if (this._salvando) {
            console.log('⏳ Save em andamento — usando localStorage');
            const local = JSON.parse(localStorage.getItem('ofertasMartinello') || '[]');
            this._atualizarAtiva(local);
            return local;
        }

        // 1. Tentar Firebase
        try {
            console.log('📡 Buscando ofertas no Firebase...');
            const snap  = await ofertasRef.once('value');
            const dados = snap.val();
            const arr   = Array.isArray(dados) ? dados
                        : dados && typeof dados === 'object' ? Object.values(dados)
                        : [];
            console.log(`✅ ${arr.length} oferta(s) carregada(s) do Firebase`);
            if (arr.length > 0 || dados !== null) {
                this._salvarLocalSafe('ofertasMartinello', arr.map(o => this._ofertaSemImagem(o)));
            }
            this._atualizarAtiva(arr);
            return arr;
        } catch (e) {
            console.warn('⚠️ Firebase indisponível:', e.message);
        }

        // 2. Tentar JSON do GitHub como fallback
        try {
            const url = this._getUrlFallback();
            console.log('📂 Tentando fallback JSON:', url);
            const res  = await fetch(url + '?t=' + Date.now()); // evitar cache do browser
            if (res.ok) {
                const arr = await res.json();
                console.log(`✅ ${arr.length} oferta(s) carregada(s) do JSON fallback`);
                this._atualizarAtiva(arr);
                return arr;
            }
        } catch (e) {
            console.warn('⚠️ JSON fallback indisponível:', e.message);
        }

        // 3. Último recurso: localStorage
        console.warn('⚠️ Usando localStorage como último recurso');
        const local = JSON.parse(localStorage.getItem('ofertasMartinello') || '[]');
        this._atualizarAtiva(local);
        return local;
    },

    async salvarOfertas(ofertas) {
        console.log('💾 Salvando', ofertas.length, 'oferta(s)...');
        this._salvarLocalSafe('ofertasMartinello', ofertas.map(o => this._ofertaSemImagem(o)));
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
            this._salvarLocalSafe('ofertaAtiva', this._ofertaSemImagem(ativa));
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
                console.log('⌛ Cache expirou — removendo');
                localStorage.removeItem('ofertaAtiva');
                localStorage.removeItem('ofertaAtivaImagem');
                return null;
            }
            const imgCache = localStorage.getItem('ofertaAtivaImagem');
            if (imgCache) oferta.urlImagem = imgCache;
            console.log('⚡ Oferta do cache:', oferta.tituloPagina);
            return oferta;
        } catch { return null; }
    },

    // ---------- CONFIG EM BREVE ----------

    carregarConfigEmBreve() {
        try { return JSON.parse(localStorage.getItem('configTelaEmBreve') || 'null'); }
        catch { return null; }
    },

    salvarConfigEmBreve(config) {
        const cfg = { ...config };
        if (cfg.imagem?.startsWith('data:') && cfg.imagem.length > 100000) {
            cfg.imagem = 'img/produto.png';
        }
        this._salvarLocalSafe('configTelaEmBreve', cfg);
        console.log('💾 Config "Em Breve" salva');
    },

    // ---------- PREFERÊNCIAS ----------

    salvarTema(tema)           { localStorage.setItem('tema', tema); },
    carregarTema()             { return localStorage.getItem('tema') || 'light'; },
    salvarUltimaMatricula(cod) { this._salvarLocalSafe('ultimaMatricula', cod); },
    carregarUltimaMatricula()  { return localStorage.getItem('ultimaMatricula') || ''; },
};
