// ============================================
// model/storage.js — CAMADA DE DADOS UNIFICADA
// ============================================

const Storage = {

    _salvando: false, // BUG FIX: flag para não sobrescrever durante save

    // ---------- OFERTAS ----------

    async carregarOfertas() {
        // BUG FIX: não buscar Firebase enquanto um save está em andamento
        // (evita race condition: save → Firebase demora → carregarOfertas sobrescreve)
        if (this._salvando) {
            const local = JSON.parse(localStorage.getItem('ofertasMartinello') || '[]');
            this._atualizarAtiva(local);
            return local;
        }

        try {
            const snap  = await ofertasRef.once('value');
            const dados = snap.val();
            const arr   = Array.isArray(dados) ? dados
                        : dados && typeof dados === 'object' ? Object.values(dados)
                        : [];

            // BUG FIX: só atualiza localStorage se Firebase retornou dados
            // Isso evita apagar dados recém-salvos caso o Firebase retorne vazio
            if (arr.length > 0 || dados !== null) {
                localStorage.setItem('ofertasMartinello', JSON.stringify(arr));
            }

            this._atualizarAtiva(arr);
            return arr;
        } catch {
            // Firebase offline/indisponível — usar localStorage como fallback
            const local = JSON.parse(localStorage.getItem('ofertasMartinello') || '[]');
            this._atualizarAtiva(local);
            return local;
        }
    },

    async salvarOfertas(ofertas) {
        // 1. Salvar no localStorage IMEDIATAMENTE (fonte de verdade local)
        localStorage.setItem('ofertasMartinello', JSON.stringify(ofertas));
        this._atualizarAtiva(ofertas);

        // 2. Tentar sincronizar com Firebase
        this._salvando = true;
        try {
            await ofertasRef.set(ofertas);
            this._salvando = false;
            return true;
        } catch (e) {
            console.warn('Firebase offline — salvo apenas localmente:', e.message);
            this._salvando = false;
            return false;
        }
    },

    _atualizarAtiva(ofertas) {
        const agora = getHorarioBrasilia();
        const ativa = ofertas.find(o => isOfertaAtiva(o, agora)) || null;
        if (ativa) {
            localStorage.setItem('ofertaAtiva', JSON.stringify(ativa));
        } else {
            localStorage.removeItem('ofertaAtiva');
        }
        return ativa;
    },

    ofertaAtivaDoCache() {
        try {
            const raw = localStorage.getItem('ofertaAtiva');
            if (!raw) return null;
            const oferta = JSON.parse(raw);
            if (isOfertaAtiva(oferta, getHorarioBrasilia())) return oferta;
            localStorage.removeItem('ofertaAtiva');
            return null;
        } catch { return null; }
    },

    // ---------- CONFIG EM BREVE ----------

    carregarConfigEmBreve() {
        try { return JSON.parse(localStorage.getItem('configTelaEmBreve') || 'null'); }
        catch { return null; }
    },

    salvarConfigEmBreve(config) {
        localStorage.setItem('configTelaEmBreve', JSON.stringify(config));
    },

    // ---------- PREFERÊNCIAS ----------

    salvarTema(tema)            { localStorage.setItem('tema', tema); },
    carregarTema()              { return localStorage.getItem('tema') || 'light'; },
    salvarUltimaMatricula(cod)  { localStorage.setItem('ultimaMatricula', cod); },
    carregarUltimaMatricula()   { return localStorage.getItem('ultimaMatricula') || ''; },
};
