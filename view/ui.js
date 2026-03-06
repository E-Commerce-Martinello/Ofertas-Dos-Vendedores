// ============================================
// view/ui.js — COMPONENTES DE INTERFACE
// ============================================

const UI = {

    // ----- TEMA -----
    tema: {
        aplicar(t) {
            document.body.classList.toggle('dark-mode', t === 'dark');
            Storage.salvarTema(t);
            const ic = document.querySelector('.dark-mode-toggle i');
            if (ic) ic.className = t === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        },
        toggle() {
            const isDark = document.body.classList.contains('dark-mode');
            this.aplicar(isDark ? 'light' : 'dark');
        },
    },

    // ----- NOTIFICAÇÕES -----
    notificar(msg, tipo = 'sucesso', ms = 3000) {
        const div = document.createElement('div');
        div.className = `notificacao notificacao-${tipo}`;
        div.innerHTML = `
            <span class="notif-icone">${tipo === 'sucesso' ? '✅' : '❌'}</span>
            <span>${msg}</span>`;
        document.body.appendChild(div);
        setTimeout(() => {
            div.classList.add('notificacao-saindo');
            setTimeout(() => div.remove(), 300);
        }, ms);
    },
    ok(msg)   { this.notificar(msg, 'sucesso'); },
    erro(msg) { this.notificar(msg, 'erro'); },

    // ----- IMAGEM -----
    async paraBase64(file) {
        return new Promise((res, rej) => {
            const r = new FileReader();
            r.onload  = () => res(r.result);
            r.onerror = rej;
            r.readAsDataURL(file);
        });
    },

    imagemFallback(imgEl, fallback) {
        imgEl.onerror = () => { imgEl.src = fallback; imgEl.onerror = null; };
        if (imgEl.complete && imgEl.naturalHeight === 0) imgEl.src = fallback;
    },
};

// Alias global para compatibilidade com onclick="TEMA.toggle()" no HTML
const TEMA = UI.tema;
