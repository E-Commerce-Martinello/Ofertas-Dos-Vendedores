// ============================================
// shared/diagnostico.js
// Painel de debug visual — visível no próprio celular
// REMOVER em produção final
// ============================================

(function() {
    // Criar painel flutuante
    const painel = document.createElement('div');
    painel.id = 'debug-painel';
    painel.style.cssText = `
        position: fixed; bottom: 0; left: 0; right: 0;
        max-height: 40vh; overflow-y: auto;
        background: rgba(0,0,0,0.92); color: #0f0;
        font-family: monospace; font-size: 11px;
        z-index: 99999; padding: 8px;
        border-top: 2px solid #0f0;
    `;

    const titulo = document.createElement('div');
    titulo.style.cssText = 'color:#ff0;font-weight:bold;margin-bottom:4px;display:flex;justify-content:space-between;';
    titulo.innerHTML = '<span>🔍 DEBUG</span><button onclick="document.getElementById(\'debug-painel\').style.display=\'none\'" style="background:red;color:white;border:none;padding:2px 8px;cursor:pointer;">✕</button>';
    painel.appendChild(titulo);

    const log = document.createElement('div');
    log.id = 'debug-log';
    painel.appendChild(log);

    document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(painel);
    });

    // Interceptar console.log / warn / error
    const cores = { log: '#0f0', warn: '#ff0', error: '#f44' };
    ['log', 'warn', 'error'].forEach(tipo => {
        const original = console[tipo].bind(console);
        console[tipo] = function(...args) {
            original(...args);
            const linha = document.createElement('div');
            linha.style.color = cores[tipo];
            linha.style.borderBottom = '1px solid #222';
            linha.style.padding = '2px 0';
            linha.textContent = `[${tipo.toUpperCase()}] ${args.map(a =>
                typeof a === 'object' ? JSON.stringify(a) : String(a)
            ).join(' ')}`;
            const logEl = document.getElementById('debug-log');
            if (logEl) {
                logEl.appendChild(linha);
                logEl.scrollTop = logEl.scrollHeight;
            }
        };
    });

    // Capturar erros não tratados
    window.addEventListener('error', e => {
        console.error(`❌ ERRO: ${e.message} (${e.filename?.split('/').pop()}:${e.lineno})`);
    });

    window.addEventListener('unhandledrejection', e => {
        console.error(`❌ PROMISE: ${e.reason?.message || e.reason}`);
    });

    console.log('🔍 Diagnóstico ativo — ' + navigator.userAgent.substring(0, 50));
    console.log('📱 ' + (navigator.userAgent.includes('iPhone') ? 'iPhone detectado' : 'Não é iPhone'));
})();
