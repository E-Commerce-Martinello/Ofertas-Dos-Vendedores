// ============================================
// model/storage.js — CAMADA DE DADOS UNIFICADA
// ============================================

const Storage = {

    _salvando: false,

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
                localStorage.setItem('ofertasMartinello', JSON.stringify(arr));
            }

            this._atualizarAtiva(arr);
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
        localStorage.setItem('ofertasMartinello', JSON.stringify(ofertas));
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
            localStorage.setItem('ofertaAtiva', JSON.stringify(ativa));
            console.log('🟢 Oferta ativa:', ativa.tituloPagina);
        } else {
            localStorage.removeItem('ofertaAtiva');
            console.log('⏸️ Nenhuma oferta ativa no momento');
        }
        return ativa;
    },

    ofertaAtivaDoCache() {
        try {
            const raw = localStorage.getItem('ofertaAtiva');
            if (!raw) return null;
            const oferta = JSON.parse(raw);
            if (isOfertaAtiva(oferta, getHorarioBrasilia())) {
                console.log('⚡ Oferta carregada do cache:', oferta.tituloPagina);
                return oferta;
            }
            console.log('⌛ Oferta do cache expirou — removendo');
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
        console.log('💾 Config "Em Breve" salva');
    },

    // ---------- PREFERÊNCIAS ----------

    salvarTema(tema)            { localStorage.setItem('tema', tema); },
    carregarTema()              { return localStorage.getItem('tema') || 'light'; },
    salvarUltimaMatricula(cod)  { localStorage.setItem('ultimaMatricula', cod); },
    carregarUltimaMatricula()   { return localStorage.getItem('ultimaMatricula') || ''; },
};
