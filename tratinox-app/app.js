const firebaseConfig = {
  apiKey: "AIzaSyAq4PSPyTjQ7EEnvWfd84nK7rCq5ieo0Mc",
  authDomain: "tratinox-app.firebaseapp.com",
  databaseURL: "https://tratinox-app-default-rtdb.europe-west1.firebasedatabase.app/",
  projectId: "tratinox-app",
  storageBucket: "tratinox-app.firebasestorage.app",
  messagingSenderId: "555344981046",
  appId: "1:555344981046:web:5adc9658f1e4dc06ec7c97",
  measurementId: "G-0EPYT54JD8"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

let dbRef;
try {
    dbRef = firebase.database().ref('tratinox_producao_oficial');
} catch(e) {
    console.error("Firebase Realtime DB error", e);
}

const INITIAL_DATA = {
    users: [
        { username: 'joaoteixeira', password: 'joaoteixeira123', role: 'EDITOR', name: 'João Teixeira' },
        { username: 'carina', password: 'carina123', role: 'EDITOR', name: 'Carina' },
        { username: 'encarnacaoloureiro', password: 'encarnacaoloureiro123', role: 'VIEWER', name: 'Encarnação Loureiro' },
        { username: 'cristinaencarnacao', password: 'cristinaencarnacao123', role: 'VIEWER', name: 'Cristina Encarnação' },
        { username: 'monicaencarnacao', password: 'monicaencarnacao123', role: 'VIEWER', name: 'Mónica Encarnação' },
        { username: 'carlanunes', password: 'carlanunes123', role: 'VIEWER', name: 'Carla Nunes' }
    ],
    clientes: [],
    pecas: [],
    servicos: []
};

// --- PERSISTÊNCIA LOCAL ---
const LOCAL_KEY = 'tratinox_local_backup';

function loadLocalBackup() {
    try {
        const raw = localStorage.getItem(LOCAL_KEY);
        if(raw) return JSON.parse(raw);
    } catch(e) {}
    return null;
}

function saveLocalBackup(data) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)); } catch(e) {}
}

const localBackup = loadLocalBackup();
let localDB = localBackup || INITIAL_DATA;

let currentUser = JSON.parse(sessionStorage.getItem('currentUser')) || null;
let currentPage = sessionStorage.getItem('currentPage') || 'dashboard';
let historicoPage = 0;
const HIST_PAGE_SIZE = 30;

if (dbRef) {
    const connectedRef = firebase.database().ref(".info/connected");
    connectedRef.on("value", (snap) => {
        if (snap.val() === true) {
            showToast("Nuvem Firebase Ativa ✅");
        } else {
            showToast("Offline ou Ligação Pendente ⏳");
        }
    });

    dbRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) {
            const toWrite = loadLocalBackup() || INITIAL_DATA;
            dbRef.set(toWrite).catch(e => {});
        } else {
            localDB = data;
            localDB.users = INITIAL_DATA.users;
            localDB = fixPecasLegadas(localDB);
            saveLocalBackup(localDB);
            if (currentUser) refreshData(currentPage);
        }
    }, (error) => {
        showToast("AVISO: sem ligação à nuvem.");
        const backup = loadLocalBackup();
        if(backup) { localDB = backup; localDB.users = INITIAL_DATA.users; localDB = fixPecasLegadas(localDB); }
        if(currentUser) refreshData(currentPage);
    });
}

function fixPecasLegadas(db) {
    if (!db || !db.pecas) return db;
    let changed = false;
    db.pecas = db.pecas.map(p => {
        let pChanged = false;
        if (p.name && /^- ?/.test(p.name)) { p.name = p.name.replace(/^- ?/, '').trim(); pChanged = true; }
        if (p.ref && /^- ?/.test(p.ref)) { p.ref = p.ref.replace(/^- ?/, '').trim(); pChanged = true; }
        if (pChanged) changed = true;
        return p;
    });
    if (changed) { saveLocalBackup(db); if (dbRef) dbRef.set(db).catch(() => {}); }
    return db;
}

function getDB() { return localDB; }
function saveDB(data) {
    saveLocalBackup(data);
    if (dbRef) dbRef.set(data).catch(() => {});
}

window.resetSystem = function() {
    if(currentUser.username !== 'joaoteixeira') return showToast('Apenas o João Teixeira pode zerar o sistema.');
    const pass = prompt("DANGER: Digite 'APAGAR' para confirmar:");
    if(pass === 'APAGAR') {
        const db = getDB();
        db.pecas = []; db.clientes = []; db.servicos = [];
        saveDB(db); showToast('Sistema reiniciado!'); refreshData('dashboard');
    }
};

const showToast = (msg) => {
    const c = document.getElementById('toast-container');
    if(!c) return;
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    c.appendChild(t); setTimeout(() => t.remove(), 3000);
};

const switchPage = (id) => {
    currentPage = id;
    sessionStorage.setItem('currentPage', id);
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    const pg = document.getElementById(`page-${id}`);
    if(pg) pg.classList.add('active');
    const nl = document.querySelector(`.nav-links li[data-target="${id}"]`);
    if(nl) nl.classList.add('active');
    refreshData(id);
};

function enforceRoles() {
    const isE = currentUser.role === 'EDITOR';
    const isJoao = currentUser.username === 'joaoteixeira';
    const isAdmin = isJoao || currentUser.username === 'carina';
    document.querySelectorAll('.editor-only').forEach(el => {
        el.style.display = isE ? '' : 'none';
        if(['INPUT','SELECT','TEXTAREA'].includes(el.tagName)) el.disabled = !isE;
    });
    document.querySelectorAll('.joao-only').forEach(el => el.style.display = isJoao ? '' : 'none');
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = isAdmin ? '' : 'none');
}

function refreshData(id) {
    const db = getDB();
    if(id === 'dashboard') {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('stat-curso').textContent = (db.servicos || []).filter(s => s.status === 'Em Curso').length;
        document.getElementById('stat-hoje').textContent = (db.servicos || []).filter(s => s.dataEntrada === today).length;
        document.getElementById('stat-concluidos').textContent = (db.servicos || []).filter(s => s.status === 'Concluído' && s.dataReal === today).length;
        
        const dlClientes = document.getElementById('dl-clientes');
        if(dlClientes) {
            dlClientes.innerHTML = '';
            [...(db.clientes || [])].sort((a,b) => a.name.localeCompare(b.name)).forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.name;
                dlClientes.appendChild(opt);
            });
        }

        const tMonitor = document.getElementById('table-monitor');
        if(tMonitor) {
            tMonitor.innerHTML = '';
            const emCurso = (db.servicos || []).filter(s => s.status === 'Em Curso');
            emCurso.forEach(s => {
                const p = (db.pecas || []).find(x => x.id === s.partId);
                const c = (db.clientes || []).find(x => x.id === s.clienteId);
                const decapStr = p ? (p.decap ? `${p.decap} <small>(${p.decapTempo || '-'})</small>` : '-') : '-';
                const electroStr = p ? (p.electro ? `${p.electro} <small>(${p.electroTempo || '-'})</small>` : '-') : '-';
                const passivStr = p ? (p.passiv ? `${p.passiv} <small>(${p.passivTempo || '-'})</small>` : '-') : '-';
                const qcIcon = s.qualidadeOk
                    ? '<i class="fa-solid fa-shield-check" style="color:#10b981;font-size:1rem;" title="Controlo de Qualidade OK"></i>'
                    : '<i class="fa-regular fa-circle" style="color:#d1d5db;font-size:1rem;" title="Pendente"></i>';
                tMonitor.innerHTML += `<tr><td><strong>${p ? p.name : '-'}</strong></td><td>${c ? c.name : '-'}</td><td style="color:#555;">${decapStr}</td><td style="color:var(--primary); font-weight:600; background: rgba(59,130,246,0.05);">${electroStr}</td><td style="color:#555;">${passivStr}</td><td style="text-align:center;">${qcIcon}</td></tr>`;
            });
            if(!emCurso.length) tMonitor.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--text-muted);">Sem trabalhos para visualização no monitor de produção.</td></tr>';
        }
    }
    if(id === 'trabalhos-curso') {
        const tbody = document.getElementById('table-trabalhos');
        tbody.innerHTML = '';
        const today = new Date().toISOString().split('T')[0];
        const emCurso = (db.servicos || []).filter(s => s.status === 'Em Curso');
        const grouped = {};
        emCurso.forEach(s => {
            if(!grouped[s.clienteId]) grouped[s.clienteId] = [];
            grouped[s.clienteId].push(s);
        });
        const clientIds = Object.keys(grouped).sort((a, b) => {
            const cA = (db.clientes || []).find(x => x.id === parseInt(a));
            const cB = (db.clientes || []).find(x => x.id === parseInt(b));
            return (cA ? cA.name : '').localeCompare(cB ? cB.name : '');
        });
        clientIds.forEach(cid => {
            const client = (db.clientes || []).find(x => x.id === parseInt(cid));
            const services = grouped[cid];
            const headerRow = document.createElement('tr');
            headerRow.className = 'client-group-header';
            headerRow.innerHTML = `<td colspan="8"><i class="fa-solid fa-chevron-right"></i> ${client ? client.name : 'Cliente Desconhecido'} <span class="badge">${services.length}</span></td>`;
            headerRow.onclick = () => {
                const isExpanded = headerRow.classList.toggle('expanded');
                const workRows = tbody.querySelectorAll(`.work-of-client-${cid}`);
                workRows.forEach(r => r.classList.toggle('work-row-hidden', !isExpanded));
                headerRow.querySelector('i').className = isExpanded ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-right';
            };
            tbody.appendChild(headerRow);
            services.forEach(s => {
                const p = (db.pecas || []).find(x => x.id === s.partId);
                const isLate = s.dataPrevista < today;
                const obsIcon = s.observacoes ? `<i class="fa-solid fa-comment-dots" title="Tem observações" style="color:#f59e0b;margin-left:4px;"></i>` : '';
                // Checkbox QC - editável apenas por João e Carina
                const canQC = currentUser.username === 'joaoteixeira' || currentUser.username === 'carina';
                const qcCell = canQC
                    ? `<td onclick="event.stopPropagation()" style="text-align:center;"><input type="checkbox" title="Controlo de Qualidade OK" ${s.qualidadeOk ? 'checked' : ''} onchange="toggleQualidade(${s.id})" style="width:18px;height:18px;cursor:pointer;accent-color:#10b981;"></td>`
                    : `<td style="text-align:center;" title="Controlo de Qualidade">${s.qualidadeOk ? '<i class="fa-solid fa-shield-check" style="color:#10b981;"></i>' : '<i class="fa-regular fa-circle" style="color:#d1d5db;"></i>'}</td>`;
                const tr = document.createElement('tr');
                tr.className = `clickable-row work-of-client-${cid} work-row-hidden`;
                tr.onclick = () => verServico(s.id);
                tr.innerHTML = `<td></td><td>${s.guia}${obsIcon}</td><td>${p ? p.name : '-'}</td><td>${s.qty}</td><td>${s.dataEntrada}</td><td>${s.dataPrevista}</td><td><span class="badge ${isLate ? 'danger' : 'success'}">${isLate ? 'NÃO CUMPRIU' : 'NO PRAZO'}</span></td>${qcCell}<td style="display:flex;gap:6px;flex-wrap:wrap;" onclick="event.stopPropagation()"><button class="btn small-btn editor-only" style="background:#475569;color:white;" onclick="abrirEdicao(${s.id})"><i class="fa-solid fa-pen-to-square"></i></button><button class="btn small-btn primary-btn editor-only" onclick="concluirServico(${s.id})"><i class="fa-solid fa-check"></i></button></td>`;
                tbody.appendChild(tr);
            });
        });
        if(!emCurso.length) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:3rem; color:var(--text-muted);">Sem trabalhos em curso.</td></tr>';
        enforceRoles();
    }
    if(id === 'historico') {
        const tbody = document.getElementById('table-historico');
        const filterSelect = document.getElementById('history-filter-cliente');
        const filterVal = filterSelect ? filterSelect.value : 'all';
        if(filterSelect) {
            const currentVal = filterSelect.value;
            const histClients = (db.clientes || []).filter(c => (db.servicos || []).some(s => s.status === 'Concluído' && s.clienteId === c.id)).sort((a,b) => a.name.localeCompare(b.name));
            filterSelect.innerHTML = '<option value="all">Todos os Clientes</option>';
            histClients.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name;
                filterSelect.appendChild(opt);
            });
            filterSelect.value = currentVal;
        }
        tbody.innerHTML = '';
        let servicosMostrados = (db.servicos || []).filter(s => s.status === 'Concluído');
        // Ordenar do mais recente para o mais antigo
        servicosMostrados.sort((a, b) => (b.dataReal || '').localeCompare(a.dataReal || ''));
        if(filterVal !== 'all') {
            const cid = parseInt(filterVal);
            servicosMostrados = servicosMostrados.filter(s => s.clienteId === cid);
        }
        // --- PAGINAÇÃO ---
        const total = servicosMostrados.length;
        const totalPages = Math.max(1, Math.ceil(total / HIST_PAGE_SIZE));
        if(historicoPage >= totalPages) historicoPage = totalPages - 1;
        const start = historicoPage * HIST_PAGE_SIZE;
        const end = Math.min(start + HIST_PAGE_SIZE, total);
        const paginados = servicosMostrados.slice(start, end);

        paginados.forEach(s => {
            const p = (db.pecas || []).find(x => x.id === s.partId);
            const c = (db.clientes || []).find(x => x.id === s.clienteId);
            const isLate = s.dataPrevista < s.dataReal;
            tbody.innerHTML += `<tr style="cursor:pointer;" onclick="verServico(${s.id})"><td>${c?c.name:'-'}</td><td>${s.guia}</td><td>${p?p.name:'-'}</td><td>${s.qty}</td><td>${s.dataEntrada}</td><td>${s.dataReal}</td><td><span class="badge ${isLate?'danger':'success'}">${isLate?'NÃO CUMPRIU':'NO PRAZO'}</span></td><td onclick="event.stopPropagation()" style="display:flex;gap:6px;"><button class="btn small-btn admin-only" onclick="abrirEdicao(${s.id})" title="Editar Registo" style="background-color:#475569;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;"><i class="fa-solid fa-pen-to-square"></i></button><button class="btn small-btn admin-only" onclick="reabrirServico(${s.id})" title="Retomar Produção" style="background-color:#f59e0b;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;"><i class="fa-solid fa-rotate-left"></i></button><button class="btn small-btn danger-btn editor-only" onclick="eliminarHistorico(${s.id})" style="background-color:#e74c3c;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;"><i class="fa-solid fa-trash"></i></button></td></tr>`;
        });
        if(!total) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color: #888;">Nenhum registo encontrado para este filtro.</td></tr>';

        // Controlos de paginação
        const paginDiv = document.getElementById('hist-pagination');
        if(paginDiv) {
            if(total <= HIST_PAGE_SIZE) {
                paginDiv.innerHTML = `<span style="font-size:0.85rem;color:#888;">${total} registo(s)</span>`;
            } else {
                paginDiv.innerHTML = `
                    <button class="btn small-btn secondary-btn" onclick="navHistorico(-1)" ${historicoPage === 0 ? 'disabled style="opacity:0.4;"' : ''}>← Anterior</button>
                    <span style="font-size:0.85rem;color:#888;">Página <strong>${historicoPage+1}</strong> de <strong>${totalPages}</strong> &mdash; ${start+1}–${end} de ${total} registos</span>
                    <button class="btn small-btn secondary-btn" onclick="navHistorico(1)" ${historicoPage >= totalPages-1 ? 'disabled style="opacity:0.4;"' : ''}>Próxima →</button>`;
            }
        }
        enforceRoles();
    }
    if(id === 'pecas') {
        const sCliente = document.getElementById('np-cliente');
        if(sCliente) sCliente.innerHTML = (db.clientes || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        const tbody = document.getElementById('table-pecas');
        tbody.innerHTML = '';
        (db.pecas || []).forEach(p => {
            const c = (db.clientes || []).find(x => x.id === p.clienteId);
            tbody.innerHTML += `<tr><td>${p.ref}</td><td>${p.refInterna||'-'}</td><td>${p.name}</td><td>${c?c.name:'-'}</td><td>${p.peso} kg</td><td>${p.ciclo||'0'}</td><td class="joao-only"><button class="btn small-btn danger-btn" onclick="eliminarPeca(${p.id})"><i class="fa-solid fa-trash"></i></button></td></tr>`;
        });
    }
    if(id === 'clientes') {
        const tbody = document.getElementById('table-clientes');
        tbody.innerHTML = '';
        (db.clientes || []).forEach(c => {
            const pecas = (db.pecas || []).filter(p => p.clienteId === c.id).length;
            const emCurso = (db.servicos || []).filter(s => s.clienteId === c.id && s.status === 'Em Curso').length;
            const concluidos = (db.servicos || []).filter(s => s.clienteId === c.id && s.status === 'Concluído').length;
            tbody.innerHTML += `<tr style="cursor:pointer;" onclick="abrirCliente(${c.id})"><td><strong>${c.name}</strong></td><td><span class="badge" style="background:rgba(59,130,246,0.15);color:#3b82f6;">${pecas}</span></td><td><span class="badge" style="background:rgba(168,85,247,0.15);color:#a855f7;">${emCurso}</span></td><td><span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981;">${concluidos}</span></td><td onclick="event.stopPropagation()"><button class="btn small-btn editor-only" style="background:#e74c3c;color:white;" onclick="eliminarCliente(${c.id})"><i class="fa-solid fa-trash"></i></button></td></tr>`;
        });
        if(!(db.clientes || []).length) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">Nenhum cliente registado ainda.</td></tr>';
        enforceRoles();
    }
}

window.concluirServico = function(id) {
    if(currentUser.role !== 'EDITOR') return showToast('Sem permissão.');
    const db = getDB();
    const s = (db.servicos || []).find(x => x.id === id);
    if(s) {
        s.status = 'Concluído'; s.dataReal = new Date().toISOString().split('T')[0];
        saveDB(db); showToast('Serviço concluído!');
        if(currentPage === 'trabalhos-curso') refreshData('trabalhos-curso');
    }
};

window.reabrirServico = function(id) {
    if(currentUser.username !== 'joaoteixeira' && currentUser.username !== 'carina') return showToast('Apenas administradores.');
    if(!confirm("Retomar trabalho?")) return;
    const db = getDB();
    const s = (db.servicos || []).find(x => x.id === id);
    if(s) { s.status = 'Em Curso'; s.dataReal = null; saveDB(db); showToast('Retomado!'); refreshData(currentPage); }
};

window.eliminarHistorico = function(id) {
    if(currentUser.role !== 'EDITOR') return showToast('Sem permissão.');
    if(!confirm("Eliminar definitivamente?")) return;
    const db = getDB();
    if(db.servicos) { db.servicos = db.servicos.filter(x => x.id !== id); saveDB(db); showToast('Apagado!'); if(currentPage === 'historico') refreshData('historico'); }
};

// Filtrar histórico resetando para página 0
window.filtrarHistorico = function() {
    historicoPage = 0;
    refreshData('historico');
};

// Navegar páginas do histórico
window.navHistorico = function(dir) {
    historicoPage += dir;
    if(historicoPage < 0) historicoPage = 0;
    refreshData('historico');
};

// Toggle Controlo de Qualidade (só João e Carina)
window.toggleQualidade = function(id) {
    if(currentUser.username !== 'joaoteixeira' && currentUser.username !== 'carina') {
        return showToast('Apenas João e Carina podem alterar o controlo de qualidade.');
    }
    const db = getDB();
    const s = (db.servicos || []).find(x => x.id === id);
    if(s) {
        s.qualidadeOk = !s.qualidadeOk;
        saveDB(db);
        refreshData(currentPage);
        showToast(s.qualidadeOk ? '✅ Qualidade marcada como OK!' : 'Qualidade desmarcada.');
    }
};

window.verServico = function(servicoId) {
    const db = getDB();
    const s = (db.servicos || []).find(x => x.id === servicoId);
    if(!s) return;
    const p = (db.pecas || []).find(x => x.id === s.partId);
    const c = (db.clientes || []).find(x => x.id === s.clienteId);
    document.getElementById('dv-cliente').value = c ? c.name : '-';
    document.getElementById('dv-guia').value = s.guia || '';
    document.getElementById('dv-qty').value = s.qty || '';
    document.getElementById('dv-entrada').value = s.dataEntrada || '';
    document.getElementById('dv-entrega').value = s.dataReal || '-';
    document.getElementById('dv-estado').value = s.status || '';
    document.getElementById('dv-observacoes').value = s.observacoes || '';
    // QC
    const dvQC = document.getElementById('dv-qualidade-ok');
    if(dvQC) dvQC.checked = s.qualidadeOk || false;
    if(p) {
        document.getElementById('dv-ref').value = p.ref || '';
        document.getElementById('dv-ref-interna').value = p.refInterna || '';
        document.getElementById('dv-nome').value = p.name || '';
        document.getElementById('dv-peso').value = p.peso ? p.peso + ' kg' : '';
        document.getElementById('dv-ciclo').value = p.ciclo || '';
        document.getElementById('dv-potencia').value = p.potencia ? p.potencia + ' A' : '';
        document.getElementById('dv-comprimento').value = p.comprimento || '';
        document.getElementById('dv-altura').value = p.altura || '';
        document.getElementById('dv-largura').value = p.largura || '';
        document.getElementById('dv-diametro').value = p.diametro || '';
        document.getElementById('dv-dm2').value = p.dm2 || '';
        document.getElementById('dv-deseng').value = p.deseng || '';
        document.getElementById('dv-deseng-tempo').value = p.desengTempo || '';
        document.getElementById('dv-decap').value = p.decap || '';
        document.getElementById('dv-decap-tempo').value = p.decapTempo || '';
        document.getElementById('dv-electro').value = p.electro || '';
        document.getElementById('dv-electro-tempo').value = p.electroTempo || '';
        document.getElementById('dv-passiv').value = p.passiv || '';
        document.getElementById('dv-passiv-tempo').value = p.passivTempo || '';
    }
    switchPage('detalhe-servico');
};

window.eliminarCliente = function(id) {
    if(currentUser.role !== 'EDITOR') return showToast('Sem permissão.');
    const db = getDB();
    const c = (db.clientes || []).find(x => x.id === id);
    if((db.servicos || []).some(s => s.clienteId === id && s.status === 'Em Curso')) return showToast('Cliente tem trabalhos em curso!');
    if(!confirm(`Eliminar ${c?.name}?`)) return;
    db.clientes = (db.clientes || []).filter(x => x.id !== id);
    saveDB(db); showToast('Eliminado!'); refreshData('clientes');
};

window.eliminarPeca = function(id) {
    if(currentUser.username !== 'joaoteixeira') return showToast('Admin apenas.');
    const db = getDB();
    if((db.servicos || []).some(s => s.partId === id && s.status === 'Em Curso')) return showToast('Peça em curso!');
    if(!confirm("Eliminar peça?")) return;
    db.pecas = (db.pecas || []).filter(x => x.id !== id);
    saveDB(db); showToast('Eliminada!'); refreshData('pecas');
};

window.abrirCliente = function(clienteId) {
    const db = getDB();
    const c = (db.clientes || []).find(x => x.id === clienteId);
    if(!c) return;
    document.getElementById('cliente-detalhe-nome').textContent = c.name;
    const pecas = (db.pecas || []).filter(p => p.clienteId === clienteId);
    const servicosCurso = (db.servicos || []).filter(s => s.clienteId === clienteId && s.status === 'Em Curso');
    const servicosHist = (db.servicos || []).filter(s => s.clienteId === clienteId && s.status === 'Concluído');
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('cd-stat-pecas').textContent = pecas.length;
    document.getElementById('cd-stat-curso').textContent = servicosCurso.length;
    document.getElementById('cd-stat-historico').textContent = servicosHist.length;
    const tbodyCurso = document.getElementById('cd-table-curso');
    tbodyCurso.innerHTML = '';
    servicosCurso.forEach(s => {
        const p = pecas.find(x => x.id === s.partId);
        const isLate = s.dataPrevista < today;
        tbodyCurso.innerHTML += `<tr style="cursor:pointer;" onclick="verServico(${s.id})"><td>${s.guia}</td><td>${p?p.name:'-'}</td><td>${s.qty}</td><td>${s.dataEntrada}</td><td>${s.dataPrevista}</td><td><span class="badge ${isLate?'danger':'success'}">${isLate?'NÃO CUMPRIU':'NO PRAZO'}</span></td></tr>`;
    });
    const tbodyHist = document.getElementById('cd-table-historico');
    tbodyHist.innerHTML = '';
    servicosHist.forEach(s => {
        const p = pecas.find(x => x.id === s.partId);
        const isLate = s.dataPrevista < s.dataReal;
        tbodyHist.innerHTML += `<tr style="cursor:pointer;" onclick="verServico(${s.id})"><td>${s.guia}</td><td>${p?p.name:'-'}</td><td>${s.qty}</td><td>${s.dataEntrada}</td><td>${s.dataReal || '-'}</td><td><span class="badge ${isLate?'danger':'success'}">${isLate?'NÃO CUMPRIU':'NO PRAZO'}</span></td><td><button class="btn small-btn admin-only" onclick="abrirEdicao(${s.id})"><i class="fa-solid fa-pen-to-square"></i></button></td></tr>`;
    });
    switchPage('cliente-detalhe'); enforceRoles();
};

window.abrirEdicao = function(servicoId) {
    if(currentUser.role !== 'EDITOR') return showToast('Sem permissão.');
    const db = getDB();
    const s = (db.servicos || []).find(x => x.id === servicoId);
    if(!s) return;
    if (s.status === 'Concluído' && currentUser.username !== 'joaoteixeira' && currentUser.username !== 'carina') return showToast('Admin apenas.');
    const p = (db.pecas || []).find(x => x.id === s.partId);
    document.getElementById('ed-servico-id').value = servicoId;
    document.getElementById('ed-peca-id').value = s.partId;
    const sCliente = document.getElementById('ed-cliente');
    if(sCliente) { sCliente.innerHTML = (db.clientes || []).map(c => `<option value="${c.id}">${c.name}</option>`).join(''); sCliente.value = s.clienteId; }
    document.getElementById('ed-guia').value = s.guia || '';
    document.getElementById('ed-data-entrada').value = s.dataEntrada || '';
    document.getElementById('ed-data-prevista').value = s.dataPrevista || '';
    document.getElementById('ed-quantidade').value = s.qty || '';
    const realGroup = document.getElementById('ed-data-real-group');
    if (s.status === 'Concluído') { realGroup.style.display = 'block'; document.getElementById('ed-data-real').value = s.dataReal || ''; }
    else realGroup.style.display = 'none';
    document.getElementById('ed-observacoes').value = s.observacoes || '';
    // QC - visível a todos, editável apenas por João e Carina
    const edQC = document.getElementById('ed-qualidade-ok');
    if(edQC) {
        edQC.checked = s.qualidadeOk || false;
        const canQC = currentUser.username === 'joaoteixeira' || currentUser.username === 'carina';
        edQC.disabled = !canQC;
        edQC.style.cursor = canQC ? 'pointer' : 'not-allowed';
        edQC.style.opacity = canQC ? '1' : '0.6';
    }
    if(p) {
        document.getElementById('ed-dm2').value = p.dm2 || '';
        document.getElementById('ed-potencia').value = p.potencia || '';
        document.getElementById('ed-peso').value = p.peso || '';
        document.getElementById('ed-ref-interna').value = p.refInterna || '';
        document.getElementById('ed-comprimento').value = p.comprimento || '';
        document.getElementById('ed-altura').value = p.altura || '';
        document.getElementById('ed-largura').value = p.largura || '';
        document.getElementById('ed-diametro').value = p.diametro || '';
        document.getElementById('ed-deseng').value = p.deseng || '';
        document.getElementById('ed-deseng-tempo').value = p.desengTempo || '';
        document.getElementById('ed-decap').value = p.decap || '';
        document.getElementById('ed-decap-tempo').value = p.decapTempo || '';
        document.getElementById('ed-electro').value = p.electro || '';
        document.getElementById('ed-electro-tempo').value = p.electroTempo || '';
        document.getElementById('ed-passiv').value = p.passiv || '';
        document.getElementById('ed-passiv-tempo').value = p.passivTempo || '';
    }
    switchPage('edicao'); enforceRoles();
};

window.guardarEdicao = function() {
    if(currentUser.role !== 'EDITOR') return showToast('Sem permissão.');
    const db = getDB();
    const servicoId = parseInt(document.getElementById('ed-servico-id').value);
    const pecaId = parseInt(document.getElementById('ed-peca-id').value);
    const s = (db.servicos || []).find(x => x.id === servicoId);
    if(s) {
        s.observacoes = document.getElementById('ed-observacoes').value;
        s.dataEntrada = document.getElementById('ed-data-entrada').value;
        s.dataPrevista = document.getElementById('ed-data-prevista').value;
        s.guia = document.getElementById('ed-guia').value || s.guia;
        s.qty = parseInt(document.getElementById('ed-quantidade').value) || s.qty;
        s.clienteId = parseInt(document.getElementById('ed-cliente').value);
        if (s.status === 'Concluído') s.dataReal = document.getElementById('ed-data-real').value;
        // Guardar QC se o utilizador tiver permissão
        const canQC = currentUser.username === 'joaoteixeira' || currentUser.username === 'carina';
        if(canQC) {
            const edQC = document.getElementById('ed-qualidade-ok');
            if(edQC) s.qualidadeOk = edQC.checked;
        }
    }
    const p = (db.pecas || []).find(x => x.id === pecaId);
    if(p) {
        p.clienteId = parseInt(document.getElementById('ed-cliente').value);
        p.dm2 = document.getElementById('ed-dm2').value;
        p.potencia = parseFloat(document.getElementById('ed-potencia').value) || p.potencia;
        p.peso = parseFloat(document.getElementById('ed-peso').value.toString().replace(',','.')) || p.peso;
        p.refInterna = document.getElementById('ed-ref-interna').value;
        p.comprimento = document.getElementById('ed-comprimento').value;
        p.altura = document.getElementById('ed-altura').value;
        p.largura = document.getElementById('ed-largura').value;
        p.diametro = document.getElementById('ed-diametro').value;
        p.deseng = document.getElementById('ed-deseng').value;
        p.desengTempo = document.getElementById('ed-deseng-tempo').value;
        p.decap = document.getElementById('ed-decap').value;
        p.decapTempo = document.getElementById('ed-decap-tempo').value;
        p.electro = document.getElementById('ed-electro').value;
        p.electroTempo = document.getElementById('ed-electro-tempo').value;
        p.passiv = document.getElementById('ed-passiv').value;
        p.passivTempo = document.getElementById('ed-passiv-tempo').value;
    }
    saveDB(db); showToast('Guardado!'); if (s && s.status === 'Concluído') switchPage('historico'); else switchPage('trabalhos-curso');
};

document.addEventListener('DOMContentLoaded', () => {
    const d = new Date();
    document.getElementById('current-date').textContent = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
    if (currentUser) {
        document.getElementById('current-username').textContent = currentUser.username;
        document.getElementById('current-role').textContent = currentUser.role;
        document.getElementById('login-view').classList.remove('active');
        document.getElementById('app-view').classList.add('active');
        switchPage(currentPage); enforceRoles();
    }
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const u = document.getElementById('username').value;
        const p = document.getElementById('password').value;
        const db = getDB();
        const found = (db.users || []).find(x => x.username === u && x.password === p);
        if(found) {
            currentUser = found; sessionStorage.setItem('currentUser', JSON.stringify(found));
            document.getElementById('current-username').textContent = u; document.getElementById('current-role').textContent = found.role;
            document.getElementById('login-view').classList.remove('active');
            document.getElementById('app-view').classList.add('active');
            switchPage('dashboard'); enforceRoles(); showToast('Ligado!');
        } else alert('Errado.');
    });
    document.getElementById('logout-btn').onclick = () => { currentUser = null; sessionStorage.clear(); location.reload(); };
    document.querySelectorAll('.nav-links li, .nav-btn').forEach(el => el.onclick = (e) => { const t = e.currentTarget.getAttribute('data-target'); if(t) switchPage(t); });

    const nsInpCliente = document.getElementById('ns-search-cliente');
    const nsInpPeca = document.getElementById('ns-search-peca');
    const dlPecas = document.getElementById('dl-pecas');
    if(nsInpCliente) {
        nsInpCliente.oninput = () => {
            const val = nsInpCliente.value.trim(); const db = getDB();
            const found = (db.clientes || []).find(c => c.name.toLowerCase() === val.toLowerCase());
            dlPecas.innerHTML = ''; document.getElementById('ns-cliente-id').value = found ? found.id : '';
            if(val.length > 0) {
                nsInpPeca.disabled = false;
                if(found) {
                    (db.pecas || []).filter(p => p.clienteId === found.id).forEach(p => {
                        const opt = document.createElement('option');
                        opt.value = (p.ref && p.name && p.ref !== p.name) ? `${p.ref} - ${p.name}` : (p.name || p.ref);
                        dlPecas.appendChild(opt);
                    });
                }
            } else {
                // Campo 1 apagado: limpar campo 2 e esconder formulário
                nsInpPeca.disabled = true;
                nsInpPeca.value = '';
                document.getElementById('ns-part-id').value = '';
                document.getElementById('new-service-form').classList.add('hidden');
            }
        };
    }
    if(nsInpPeca) {
        nsInpPeca.oninput = () => {
            const val = nsInpPeca.value.trim().toLowerCase().replace(/^- ?/, '');
            const db = getDB(); const cid = parseInt(document.getElementById('ns-cliente-id').value);
            let found = null;
            if(cid) {
                found = (db.pecas || []).find(p => {
                    if (p.clienteId !== cid) return false;
                    const r = (p.ref || '').toLowerCase().replace(/^- ?/, '');
                    const n = (p.name || '').toLowerCase().replace(/^- ?/, '');
                    return r === val || n === val || `${r} - ${n}` === val;
                });
            }
            document.getElementById('new-service-form').classList.remove('hidden');
            document.getElementById('ns-part-id').value = found ? found.id : '';
            document.getElementById('ns-data-entrada').value = new Date().toISOString().split('T')[0];
            const p = found || {};
            document.getElementById('ns-parametros').innerHTML = `
                <div class="input-group"><label>Ref Interna</label><input type="text" id="ns-p-ref-interna" value="${p.refInterna||''}"></div>
                <div class="input-group"><label>Área (dm²)</label><input type="text" id="ns-p-dm2" value="${p.dm2||''}"></div>
                <div class="input-group"><label>Peso (kg)</label><input type="text" id="ns-p-peso" value="${p.peso||0}"></div>
                <div class="input-group"><label>Potência (A)</label><input type="text" id="ns-p-potencia" value="${p.potencia||0}"></div>
                <div class="input-group"><label>Peças/Ciclo</label><input type="number" id="ns-p-ciclo" value="${p.ciclo||0}"></div>
                <div class="input-group"><label>Comp. (mm)</label><input type="text" id="ns-p-comp" value="${p.comprimento||''}"></div>
                <div class="input-group"><label>Alt. (mm)</label><input type="text" id="ns-p-alt" value="${p.altura||''}"></div>
                <div class="input-group"><label>Larg. (mm)</label><input type="text" id="ns-p-larg" value="${p.largura||''}"></div>
                <div class="input-group"><label>Diâm. (mm)</label><input type="text" id="ns-p-diam" value="${p.diametro||''}"></div>
                <div class="input-group"><label>Deseng.</label><input type="text" id="ns-p-deseng" value="${p.deseng||'Smart Cleaner'}"></div>
                <div class="input-group"><label>Tempo Des.</label><input type="text" id="ns-p-deseng-t" value="${p.desengTempo||'10'}"></div>
                <div class="input-group"><label>Decap.</label><input type="text" id="ns-p-decap" value="${p.decap||'Ecoinox'}"></div>
                <div class="input-group"><label>Tempo Dec.</label><input type="text" id="ns-p-decap-t" value="${p.decapTempo||'1h'}"></div>
                <div class="input-group"><label>Electro.</label><input type="text" id="ns-p-electro" value="${p.electro||'LE2000'}"></div>
                <div class="input-group"><label>Tempo El.</label><input type="text" id="ns-p-electro-t" value="${p.electroTempo||'10'}"></div>
                <div class="input-group"><label>Passiv.</label><input type="text" id="ns-p-passiv" value="${p.passiv||'Passivante P'}"></div>
                <div class="input-group"><label>Tempo Pas.</label><input type="text" id="ns-p-passiv-t" value="${p.passivTempo||'10'}"></div>
            `;
        };
    }

    document.getElementById('new-service-form').onsubmit = (e) => {
        e.preventDefault(); if(currentUser.role !== 'EDITOR') return;
        const db = getDB(); let cid = parseInt(document.getElementById('ns-cliente-id').value);
        let pid = parseInt(document.getElementById('ns-part-id').value);
        if(!cid) {
            const n = nsInpCliente.value.trim(); if(!n) return;
            cid = Date.now(); if(!db.clientes) db.clientes = []; db.clientes.push({ id: cid, name: n });
        }
        if(!pid) {
            const d = nsInpPeca.value.trim().replace(/^- ?/, ''); if(!d) return;
            pid = Date.now() + 1; if(!db.pecas) db.pecas = [];
            const di = d.indexOf('-');
            const r = (di > 0) ? d.substring(0, di).trim() : '';
            const nm = (di > 0 && d.substring(di + 1).trim()) ? d.substring(di + 1).trim() : d;
            db.pecas.push({
                id: pid, clienteId: cid, ref: r, name: nm,
                refInterna: document.getElementById('ns-p-ref-interna').value,
                dm2: document.getElementById('ns-p-dm2').value,
                peso: parseFloat(document.getElementById('ns-p-peso').value.toString().replace(',','.')) || 0,
                potencia: parseFloat(document.getElementById('ns-p-potencia').value) || 0,
                ciclo: parseInt(document.getElementById('ns-p-ciclo').value) || 0,
                comprimento: document.getElementById('ns-p-comp').value,
                altura: document.getElementById('ns-p-alt').value,
                largura: document.getElementById('ns-p-larg').value,
                diametro: document.getElementById('ns-p-diam').value,
                deseng: document.getElementById('ns-p-deseng').value,
                desengTempo: document.getElementById('ns-p-deseng-t').value,
                decap: document.getElementById('ns-p-decap').value,
                decapTempo: document.getElementById('ns-p-decap-t').value,
                electro: document.getElementById('ns-p-electro').value,
                electroTempo: document.getElementById('ns-p-electro-t').value,
                passiv: document.getElementById('ns-p-passiv').value,
                passivTempo: document.getElementById('ns-p-passiv-t').value
            });
        } else {
            const p = db.pecas.find(x => x.id === pid);
            if(p) {
                p.refInterna = document.getElementById('ns-p-ref-interna').value;
                p.dm2 = document.getElementById('ns-p-dm2').value;
                p.peso = parseFloat(document.getElementById('ns-p-peso').value.toString().replace(',','.')) || 0;
                p.potencia = parseFloat(document.getElementById('ns-p-potencia').value) || 0;
                p.ciclo = parseInt(document.getElementById('ns-p-ciclo').value) || 0;
                p.comprimento = document.getElementById('ns-p-comp').value;
                p.altura = document.getElementById('ns-p-alt').value;
                p.largura = document.getElementById('ns-p-larg').value;
                p.diametro = document.getElementById('ns-p-diam').value;
                p.deseng = document.getElementById('ns-p-deseng').value;
                p.desengTempo = document.getElementById('ns-p-deseng-t').value;
                p.decap = document.getElementById('ns-p-decap').value;
                p.decapTempo = document.getElementById('ns-p-decap-t').value;
                p.electro = document.getElementById('ns-p-electro').value;
                p.electroTempo = document.getElementById('ns-p-electro-t').value;
                p.passiv = document.getElementById('ns-p-passiv').value;
                p.passivTempo = document.getElementById('ns-p-passiv-t').value;
            }
        }
        if(!db.servicos) db.servicos = [];
        db.servicos.push({
            id: Date.now() + 2, partId: pid, clienteId: cid,
            guia: document.getElementById('ns-guia').value, qty: parseInt(document.getElementById('ns-quantidade').value),
            dataEntrada: document.getElementById('ns-data-entrada').value, dataPrevista: document.getElementById('ns-data-prevista').value,
            status: document.getElementById('ns-estado').value, dataReal: null,
            observacoes: document.getElementById('ns-observacoes').value || ''
        });
        saveDB(db); showToast('Guardado!'); e.target.reset();
        document.getElementById('new-service-form').classList.add('hidden');
        // Limpar campos 1 e 2 para ficha nova
        nsInpCliente.value = '';
        nsInpPeca.value = '';
        nsInpPeca.disabled = true;
        document.getElementById('ns-cliente-id').value = '';
        document.getElementById('ns-part-id').value = '';
        document.getElementById('ns-parametros').innerHTML = '';
        refreshData('dashboard');
    };

    document.getElementById('btn-cancel-service').onclick = () => { 
        document.getElementById('new-service-form').classList.add('hidden'); nsInpPeca.disabled = true; 
    };

    const btnNovaPeca = document.getElementById('btn-nova-peca');
    if(btnNovaPeca) btnNovaPeca.onclick = () => {
        document.getElementById('form-nova-peca').classList.toggle('hidden');
        document.getElementById('np-data-entrada').value = new Date().toISOString().split('T')[0];
        document.getElementById('np-data-prevista').value = new Date().toISOString().split('T')[0];
    };

    const btnGuardarPeca = document.getElementById('btn-guardar-peca');
    if(btnGuardarPeca) {
        btnGuardarPeca.onclick = () => {
            if(currentUser.role !== 'EDITOR') return showToast("Sem Permissão");
            const db = getDB(); if(!db.pecas) db.pecas=[];
            const nid = Date.now(); const cid = parseInt(document.getElementById('np-cliente').value) || 0;
            db.pecas.push({
                id: nid, ref: document.getElementById('np-ref').value, refInterna: document.getElementById('np-ref-interna').value,
                name: document.getElementById('np-nome').value, clienteId: cid,
                peso: parseFloat(document.getElementById('np-peso').value.toString().replace(',','.')) || 0,
                ciclo: parseInt(document.getElementById('np-ciclo').value) || 0,
                potencia: parseFloat(document.getElementById('np-potencia').value) || 0,
                dm2: document.getElementById('np-dm2').value, deseng: document.getElementById('np-deseng').value,
                desengTempo: document.getElementById('np-deseng-tempo').value, decap: document.getElementById('np-decap').value,
                decapTempo: document.getElementById('np-decap-tempo').value, electro: document.getElementById('np-electro').value,
                electroTempo: document.getElementById('np-electro-tempo').value, passiv: document.getElementById('np-passiv').value,
                passivTempo: document.getElementById('np-passiv-tempo').value, comprimento: document.getElementById('np-comprimento').value,
                altura: document.getElementById('np-altura').value, largura: document.getElementById('np-largura').value, diametro: document.getElementById('np-diametro').value
            });
            const g = document.getElementById('np-guia').value;
            if(g) {
                if(!db.servicos) db.servicos = [];
                db.servicos.push({
                    id: Date.now() + 1, partId: nid, clienteId: cid, guia: g,
                    qty: parseInt(document.getElementById('np-quantidade').value) || 1,
                    dataEntrada: document.getElementById('np-data-entrada').value || new Date().toISOString().split('T')[0],
                    dataPrevista: document.getElementById('np-data-prevista').value || new Date().toISOString().split('T')[0],
                    status: 'Em Curso', dataReal: null, observacoes: document.getElementById('np-observacoes').value || ''
                });
            }
            saveDB(db); showToast('Guardado!'); location.reload();
        };
    }

    const btnNovoCliente = document.getElementById('btn-novo-cliente');
    if(btnNovoCliente) {
        btnNovoCliente.onclick = () => {
            if(currentUser.role !== 'EDITOR') return showToast("Sem Permissão");
            const n = prompt("Nome do Cliente:");
            if(n) { const db = getDB(); if(!db.clientes) db.clientes=[]; db.clientes.push({ id: Date.now(), name: n }); saveDB(db); showToast('Adicionado!'); refreshData('pecas'); refreshData('clientes'); }
        };
    }
    const btnNovoClientePg = document.getElementById('btn-novo-cliente-pg');
    if(btnNovoClientePg) {
        btnNovoClientePg.onclick = () => {
            if(currentUser.role !== 'EDITOR') return showToast("Sem Permissão");
            const n = prompt("Nome do Cliente:");
            if(n) { const db = getDB(); if(!db.clientes) db.clientes=[]; db.clientes.push({ id: Date.now(), name: n }); saveDB(db); showToast('Adicionado!'); refreshData('clientes'); }
        };
    }
});
