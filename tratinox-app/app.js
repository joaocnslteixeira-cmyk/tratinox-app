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

// --- PERSISTÊNCIA LOCAL (localStorage como backup que sobrevive ao fechar o browser) ---
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

// Carrega backup local imediatamente (antes do Firebase responder)
const localBackup = loadLocalBackup();
let localDB = localBackup || INITIAL_DATA;

let currentUser = JSON.parse(sessionStorage.getItem('currentUser')) || null;
let currentPage = sessionStorage.getItem('currentPage') || 'dashboard';

// Conectar em Tempo Real e Diagnóstico
if (dbRef) {
    const connectedRef = firebase.database().ref(".info/connected");
    connectedRef.on("value", (snap) => {
        if (snap.val() === true) {
            showToast("Nuvem Firebase Ativa ✅ (Sincronizado)");
        } else {
            showToast("Offline ou Ligação Pendente ⏳");
        }
    });

    dbRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) {
            // Firebase vazio: usar dados locais se existirem, senão escrever inicial
            const toWrite = loadLocalBackup() || INITIAL_DATA;
            dbRef.set(toWrite).catch(e => {
                showToast("Erro na BD Firebase: verifique se está no 'Modo de Teste'.");
            });
        } else {
            localDB = data;
            localDB.users = INITIAL_DATA.users;
            saveLocalBackup(localDB); // Atualiza backup local com dados frescos da nuvem
            if (currentUser) {
                refreshData(currentPage);
            }
        }
    }, (error) => {
        showToast("AVISO: sem ligação à nuvem. A usar dados guardados localmente.");
        console.error(error);
        // Tentar usar backup local
        const backup = loadLocalBackup();
        if(backup) { localDB = backup; localDB.users = INITIAL_DATA.users; }
        if(currentUser) refreshData(currentPage);
    });
}

function getDB() { return localDB; }
function saveDB(data) {
    saveLocalBackup(data); // Sempre guardar localmente primeiro
    if (dbRef) {
        dbRef.set(data).catch(() => showToast("Aviso: nuvem indisponível. Dados guardados localmente."));
    }
}

window.resetSystem = function() {
    if(currentUser.username !== 'joaoteixeira') return showToast('Apenas o João Teixeira pode zerar o sistema.');
    const pass = prompt("DANGER: Isto irá apagar TODAS as peças, clientes e serviços. Digite 'APAGAR' para confirmar:");
    if(pass === 'APAGAR') {
        const db = getDB();
        db.pecas = [];
        db.clientes = [];
        db.servicos = [];
        saveDB(db);
        showToast('Sistema reiniciado! Todos os dados foram apagados.');
        refreshData('dashboard');
    } else {
        showToast('Operação cancelada.');
    }
};

const showToast = (msg) => {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    c.appendChild(t); setTimeout(() => t.remove(), 3000);
};

const switchView = (id) => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(id).classList.add('active');
};

const switchPage = (id) => {
    currentPage = id;
    sessionStorage.setItem('currentPage', id);
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    document.getElementById(`page-${id}`).classList.add('active');
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

    document.querySelectorAll('.joao-only').forEach(el => {
        el.style.display = isJoao ? '' : 'none';
    });
    
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = isAdmin ? '' : 'none';
    });
}

function refreshData(id) {
    const db = getDB();
    if(id === 'dashboard') {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('stat-curso').textContent = (db.servicos || []).filter(s => s.status === 'Em Curso').length;
        document.getElementById('stat-hoje').textContent = (db.servicos || []).filter(s => s.dataEntrada === today).length;
        document.getElementById('stat-concluidos').textContent = (db.servicos || []).filter(s => s.status === 'Concluído' && s.dataReal === today).length;
        
        // Povoar datalist de clientes no Dashboard
        const dlClientes = document.getElementById('dl-clientes');
        if(dlClientes) {
            dlClientes.innerHTML = '';
            [...(db.clientes || [])].sort((a,b) => a.name.localeCompare(b.name)).forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.name;
                dlClientes.appendChild(opt);
            });
        }

        // --- Monitor de Produção (Novo) ---
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
                
                tMonitor.innerHTML += `<tr>
                    <td><strong>${p ? p.name : '-'}</strong></td>
                    <td>${c ? c.name : '-'}</td>
                    <td style="color:#555;">${decapStr}</td>
                    <td style="color:var(--primary); font-weight:600; background: rgba(59,130,246,0.05);">${electroStr}</td>
                    <td style="color:#555;">${passivStr}</td>
                </tr>`;
            });
            if(!emCurso.length) tMonitor.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:3rem; color:var(--text-muted);">Sem trabalhos para visualização no monitor de produção.</td></tr>';
        }
    }
    if(id === 'trabalhos-curso') {
        const tbody = document.getElementById('table-trabalhos');
        tbody.innerHTML = '';
        const today = new Date().toISOString().split('T')[0];
        (db.servicos || []).filter(s => s.status === 'Em Curso').forEach(s => {
            const p = (db.pecas || []).find(x => x.id === s.partId);
            const c = (db.clientes || []).find(x => x.id === s.clienteId);
            const isLate = s.dataPrevista < today;
            const obsIcon = s.observacoes ? '<i class="fa-solid fa-comment-dots" title="Tem observações" style="color:#f59e0b;margin-left:4px;"></i>' : '';
            tbody.innerHTML += `<tr class="clickable-row" onclick="verServico(${s.id})">
                <td>${c?c.name:'-'}</td><td>${s.guia}${obsIcon}</td><td>${p?p.name:'-'}</td><td>${s.qty}</td>
                <td>${s.dataEntrada}</td><td>${s.dataPrevista}</td>
                <td><span class="badge ${isLate?'danger':'success'}">${isLate?'NÃO CUMPRIU':'NO PRAZO'}</span></td>
                <td style="display:flex;gap:6px;flex-wrap:wrap;" onclick="event.stopPropagation()">
                    <button class="btn small-btn editor-only" style="background:#475569;color:white;" onclick="abrirEdicao(${s.id})"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="btn small-btn primary-btn editor-only" onclick="concluirServico(${s.id})"><i class="fa-solid fa-check"></i></button>
                </td>
            </tr>`;
        });
        enforceRoles();
    }
    if(id === 'historico') {
        const tbody = document.getElementById('table-historico');
        const filterSelect = document.getElementById('history-filter-cliente');
        const filterVal = filterSelect ? filterSelect.value : 'all';
        
        // Atualizar lista de clientes no filtro (apenas os que têm histórico)
        if(filterSelect) {
            const currentVal = filterSelect.value;
            const histClients = (db.clientes || []).filter(c => 
                (db.servicos || []).some(s => s.status === 'Concluído' && s.clienteId === c.id)
            ).sort((a,b) => a.name.localeCompare(b.name));
            
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
        
        if(filterVal !== 'all') {
            const cid = parseInt(filterVal);
            servicosMostrados = servicosMostrados.filter(s => s.clienteId === cid);
        }

        servicosMostrados.forEach(s => {
            const p = (db.pecas || []).find(x => x.id === s.partId);
            const c = (db.clientes || []).find(x => x.id === s.clienteId);
            const isLate = s.dataPrevista < s.dataReal;
            tbody.innerHTML += `<tr style="cursor:pointer;" onclick="verServico(${s.id})">
                <td>${c?c.name:'-'}</td><td>${s.guia}</td><td>${p?p.name:'-'}</td><td>${s.qty}</td>
                <td>${s.dataEntrada}</td><td>${s.dataReal}</td>
                <td><span class="badge ${isLate?'danger':'success'}">${isLate?'NÃO CUMPRIU':'NO PRAZO'}</span></td>
                <td onclick="event.stopPropagation()" style="display:flex;gap:6px;">
                    <button class="btn small-btn admin-only" onclick="abrirEdicao(${s.id})" title="Editar Registo" style="background-color:#475569;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="btn small-btn admin-only" onclick="reabrirServico(${s.id})" title="Retomar Produção" style="background-color:#f59e0b;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;"><i class="fa-solid fa-rotate-left"></i></button>
                    <button class="btn small-btn danger-btn editor-only" onclick="eliminarHistorico(${s.id})" style="background-color:#e74c3c;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
        });
        if(!servicosMostrados.length) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color: #888;">Nenhum registo encontrado para este filtro.</td></tr>';
        enforceRoles();
    }
    if(id === 'pecas') {
        const sCliente = document.getElementById('np-cliente');
        if(sCliente) sCliente.innerHTML = (db.clientes || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        
        const tbody = document.getElementById('table-pecas');
        tbody.innerHTML = '';
        (db.pecas || []).forEach(p => {
            const c = (db.clientes || []).find(x => x.id === p.clienteId);
            tbody.innerHTML += `<tr><td>${p.ref}</td><td>${p.refInterna||'-'}</td><td>${p.name}</td><td>${c?c.name:'-'}</td><td>${p.peso} kg</td></tr>`;
        });
    }
    if(id === 'clientes') {
        const tbody = document.getElementById('table-clientes');
        tbody.innerHTML = '';
        (db.clientes || []).forEach(c => {
            const pecas = (db.pecas || []).filter(p => p.clienteId === c.id).length;
            const emCurso = (db.servicos || []).filter(s => s.clienteId === c.id && s.status === 'Em Curso').length;
            const concluidos = (db.servicos || []).filter(s => s.clienteId === c.id && s.status === 'Concluído').length;
            tbody.innerHTML += `<tr style="cursor:pointer;" onclick="abrirCliente(${c.id})">
                <td><strong>${c.name}</strong></td>
                <td><span class="badge" style="background:rgba(59,130,246,0.15);color:#3b82f6;">${pecas}</span></td>
                <td><span class="badge" style="background:rgba(168,85,247,0.15);color:#a855f7;">${emCurso}</span></td>
                <td><span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981;">${concluidos}</span></td>
                <td onclick="event.stopPropagation()">
                    <button class="btn small-btn editor-only" style="background:#e74c3c;color:white;" onclick="eliminarCliente(${c.id})"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
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
        saveDB(db); showToast('Serviço concluído na Nuvem!');
        if(currentPage === 'trabalhos-curso') refreshData('trabalhos-curso');
    }
};

window.reabrirServico = function(id) {
    if(currentUser.username !== 'joaoteixeira' && currentUser.username !== 'carina') return showToast('Apenas administradores podem retomar trabalhos.');
    if(!confirm("Deseja colocar este trabalho novamente Em Curso? (Será removido do Histórico)")) return;
    const db = getDB();
    const s = (db.servicos || []).find(x => x.id === id);
    if(s) {
        s.status = 'Em Curso';
        s.dataReal = null;
        saveDB(db);
        showToast('Trabalho retomado com sucesso! ✅');
        refreshData(currentPage);
    }
};

window.eliminarHistorico = function(id) {
    if(currentUser.role !== 'EDITOR') return showToast('Sem permissão.');
    if(!confirm("Atenção! Tem a certeza que quer eliminar definitivamente este serviço histórico?")) return;
    const db = getDB();
    if(db.servicos) {
        db.servicos = db.servicos.filter(x => x.id !== id);
        saveDB(db); showToast('Registo apagado da base de dados!');
        if(currentPage === 'historico') refreshData('historico');
    }
};

window.verServico = function(servicoId) {
    const db = getDB();
    const s = (db.servicos || []).find(x => x.id === servicoId);
    if(!s) return;
    const p = (db.pecas || []).find(x => x.id === s.partId);
    const c = (db.clientes || []).find(x => x.id === s.clienteId);

    // Informa\u00e7\u00e3o do servi\u00e7o
    document.getElementById('dv-cliente').value = c ? c.name : '-';
    document.getElementById('dv-guia').value = s.guia || '';
    document.getElementById('dv-qty').value = s.qty || '';
    document.getElementById('dv-entrada').value = s.dataEntrada || '';
    document.getElementById('dv-entrega').value = s.dataReal || '-';
    document.getElementById('dv-estado').value = s.status || '';
    document.getElementById('dv-observacoes').value = s.observacoes || '(sem observa\u00e7\u00f5es)';

    // Dados da pe\u00e7a
    if(p) {
        document.getElementById('dv-ref').value = p.ref || '';
        document.getElementById('dv-ref-interna').value = p.refInterna || '';
        document.getElementById('dv-nome').value = p.name || '';
        document.getElementById('dv-peso').value = p.peso ? p.peso + ' kg' : '';
        document.getElementById('dv-ciclo').value = p.ciclo || '';
        document.getElementById('dv-potencia').value = p.potencia ? p.potencia + ' A' : '';
        document.getElementById('dv-comprimento').value = p.comprimento ? p.comprimento + ' mm' : '';
        document.getElementById('dv-altura').value = p.altura ? p.altura + ' mm' : '';
        document.getElementById('dv-largura').value = p.largura ? p.largura + ' mm' : '';
        document.getElementById('dv-diametro').value = p.diametro ? p.diametro + ' mm' : '';
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
    const temServicos = (db.servicos || []).some(s => s.clienteId === id && s.status === 'Em Curso');
    if(temServicos) return showToast('Não pode eliminar: cliente tem trabalhos Em Curso!');
    if(!confirm(`Eliminar o cliente "${c?.name}"? As suas peças e histórico permanecem registados.`)) return;
    db.clientes = (db.clientes || []).filter(x => x.id !== id);
    saveDB(db);
    showToast('Cliente eliminado!');
    refreshData('clientes');
};

window.abrirCliente = function(clienteId) {
    const db = getDB();
    const c = (db.clientes || []).find(x => x.id === clienteId);
    if(!c) return;
    
    document.getElementById('cliente-detalhe-nome').textContent = c.name;
    
    const pecas = (db.pecas || []).filter(p => p.clienteId === clienteId);
    const pecaIds = pecas.map(p => p.id);
    const servicosCurso = (db.servicos || []).filter(s => s.clienteId === clienteId && s.status === 'Em Curso');
    const servicosHist = (db.servicos || []).filter(s => s.clienteId === clienteId && s.status === 'Concluído');
    const today = new Date().toISOString().split('T')[0];
    
    document.getElementById('cd-stat-pecas').textContent = pecas.length;
    document.getElementById('cd-stat-curso').textContent = servicosCurso.length;
    document.getElementById('cd-stat-historico').textContent = servicosHist.length;
    
    // Trabalhos Em Curso
    const tbodyCurso = document.getElementById('cd-table-curso');
    tbodyCurso.innerHTML = '';
    if(servicosCurso.length) {
        servicosCurso.forEach(s => {
            const p = pecas.find(x => x.id === s.partId);
            const isLate = s.dataPrevista < today;
            tbodyCurso.innerHTML += `<tr>
                <td>${s.guia}</td><td>${p?p.name:'-'}</td><td>${s.qty}</td>
                <td>${s.dataEntrada}</td><td>${s.dataPrevista}</td>
                <td><span class="badge ${isLate?'danger':'success'}">${isLate?'NÃO CUMPRIU':'NO PRAZO'}</span></td>
            </tr>`;
        });
    } else {
        tbodyCurso.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">Sem trabalhos em curso.</td></tr>';
    }
    
    // Histórico
    const tbodyHist = document.getElementById('cd-table-historico');
    tbodyHist.innerHTML = '';
    if(servicosHist.length) {
        servicosHist.forEach(s => {
            const p = pecas.find(x => x.id === s.partId);
            const isLate = s.dataPrevista < s.dataReal;
            tbodyHist.innerHTML += `<tr>
                <td>${s.guia}</td><td>${p?p.name:'-'}</td><td>${s.qty}</td>
                <td>${s.dataEntrada}</td><td>${s.dataReal || '-'}</td>
                <td><span class="badge ${isLate?'danger':'success'}">${isLate?'NÃO CUMPRIU':'NO PRAZO'}</span></td>
                <td onclick="event.stopPropagation()" style="display:flex;gap:6px;">
                    <button class="btn small-btn admin-only" onclick="abrirEdicao(${s.id})" title="Editar Registo" style="background-color:#475569;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="btn small-btn admin-only" onclick="reabrirServico(${s.id})" title="Retomar Produção" style="background-color:#f59e0b;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;"><i class="fa-solid fa-rotate-left"></i></button>
                </td>
            </tr>`;
        });
    } else {
        tbodyHist.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">Sem histórico para este cliente.</td></tr>';
    }
    
    switchPage('cliente-detalhe');
    enforceRoles();
};

window.abrirEdicao = function(servicoId) {
    if(currentUser.role !== 'EDITOR') return showToast('Sem permissão.');
    const db = getDB();
    const s = (db.servicos || []).find(x => x.id === servicoId);
    if(!s) return;
    
    if (s.status === 'Concluído' && currentUser.username !== 'joaoteixeira' && currentUser.username !== 'carina') {
        return showToast('Admin apenas. João e Carina podem editar Histórico.');
    }

    const p = (db.pecas || []).find(x => x.id === s.partId);
    
    // Preencher IDs ocultos
    document.getElementById('ed-servico-id').value = servicoId;
    document.getElementById('ed-peca-id').value = s.partId;
    
    // Popular Lista de Clientes
    const sCliente = document.getElementById('ed-cliente');
    if(sCliente) {
        sCliente.innerHTML = (db.clientes || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        sCliente.value = s.clienteId;
    }

    // Datas do serviço
    document.getElementById('ed-data-entrada').value = s.dataEntrada || '';
    document.getElementById('ed-data-prevista').value = s.dataPrevista || '';
    
    const realGroup = document.getElementById('ed-data-real-group');
    if (s.status === 'Concluído') {
        realGroup.style.display = 'block';
        document.getElementById('ed-data-real').value = s.dataReal || '';
    } else {
        realGroup.style.display = 'none';
    }

    // Observações do serviço
    document.getElementById('ed-observacoes').value = s.observacoes || '';
    
    // Parâmetros da Peça Mestre
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
    
    switchPage('edicao');
    enforceRoles();
};

window.guardarEdicao = function() {
    if(currentUser.role !== 'EDITOR') return showToast('Sem permissão.');
    const db = getDB();
    const servicoId = parseInt(document.getElementById('ed-servico-id').value);
    const pecaId = parseInt(document.getElementById('ed-peca-id').value);
    
    // Atualizar Observações e Cliente no Serviço
    const s = (db.servicos || []).find(x => x.id === servicoId);
    if(s) {
        s.observacoes = document.getElementById('ed-observacoes').value;
        s.dataEntrada = document.getElementById('ed-data-entrada').value;
        s.dataPrevista = document.getElementById('ed-data-prevista').value;
        s.clienteId = parseInt(document.getElementById('ed-cliente').value);
        if (s.status === 'Concluído') {
            s.dataReal = document.getElementById('ed-data-real').value;
        }
    }
    
    // Atualizar Peça Mestre (Opção A — atualiza para toda a gente no futuro)
    const p = (db.pecas || []).find(x => x.id === pecaId);
    const parsePeso = (v) => parseFloat(v.toString().replace(',', '.')) || 0;
    if(p) {
        p.clienteId = parseInt(document.getElementById('ed-cliente').value);
        p.dm2 = document.getElementById('ed-dm2').value;
        p.potencia = parseFloat(document.getElementById('ed-potencia').value) || p.potencia;
        p.peso = parsePeso(document.getElementById('ed-peso').value) || p.peso;
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
    
    saveDB(db);
    showToast('Alterações guardadas com sucesso!');
    if (s && s.status === 'Concluído') switchPage('historico');
    else switchPage('trabalhos-curso');
};

document.addEventListener('DOMContentLoaded', () => {
    const d = new Date();
    document.getElementById('current-date').textContent = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
    
    if (currentUser) {
        document.getElementById('current-username').textContent = currentUser.username;
        document.getElementById('current-role').textContent = currentUser.role;
        switchView('app-view'); 
        switchPage(currentPage); 
        enforceRoles();
    }
    
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const u = document.getElementById('username').value;
        const p = document.getElementById('password').value;
        const db = getDB();
        const found = (db.users || []).find(x => x.username === u && x.password === p);
        if(found) {
            currentUser = found;
            sessionStorage.setItem('currentUser', JSON.stringify(found));
            document.getElementById('current-username').textContent = u;
            document.getElementById('current-role').textContent = found.role;
            switchView('app-view'); switchPage('dashboard'); enforceRoles();
            showToast('Sincronizado com a Firebase Cloud!');
        } else alert('Credenciais erradas.');
    });
    
    document.getElementById('logout-btn').addEventListener('click', () => { 
        currentUser = null; 
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('currentPage');
        switchView('login-view'); 
    });
    
    document.querySelectorAll('.nav-links li, .nav-btn').forEach(el => {
        el.addEventListener('click', (e) => {
            const t = e.currentTarget.getAttribute('data-target');
            if(t) switchPage(t);
        });
    });

    // --- Lógica Novo Serviço Inteligente (Input + Datalist) ---
    const nsInpCliente = document.getElementById('ns-search-cliente');
    const nsInpPeca = document.getElementById('ns-search-peca');
    const dlPecas = document.getElementById('dl-pecas');
    
    if(nsInpCliente) {
        nsInpCliente.addEventListener('input', () => {
            const val = nsInpCliente.value.trim();
            const db = getDB();
            const found = (db.clientes || []).find(c => c.name.toLowerCase() === val.toLowerCase());
            
            dlPecas.innerHTML = '';
            document.getElementById('ns-cliente-id').value = found ? found.id : '';
            
            if(val.length > 0) {
                nsInpPeca.disabled = false;
                if(found) {
                    const pecas = (db.pecas || []).filter(p => p.clienteId === found.id);
                    pecas.forEach(p => {
                        const opt = document.createElement('option');
                        opt.value = `${p.ref} - ${p.name}`;
                        dlPecas.appendChild(opt);
                    });
                }
            } else {
                nsInpPeca.disabled = true;
                document.getElementById('new-service-form').classList.add('hidden');
            }
        });
    }

    if(nsInpPeca) {
        nsInpPeca.addEventListener('input', () => {
            const val = nsInpPeca.value.trim();
            const db = getDB();
            const cid = parseInt(document.getElementById('ns-cliente-id').value);
            
            let found = null;
            if(cid) {
                found = (db.pecas || []).find(p => p.clienteId === cid && (`${p.ref} - ${p.name}`.toLowerCase() === val.toLowerCase() || p.ref.toLowerCase() === val.toLowerCase()));
            }

            document.getElementById('new-service-form').classList.remove('hidden');
            document.getElementById('ns-part-id').value = found ? found.id : '';
            document.getElementById('ns-data-entrada').value = new Date().toISOString().split('T')[0];

            const paramsDiv = document.getElementById('ns-parametros');
            // Se encontrou a peça, preenche os campos. Se não, deixa vazios para registar nova.
            const p = found || {};
            paramsDiv.innerHTML = `
                <div class="input-group"><label>Ref Interna</label><input type="text" id="ns-p-ref-interna" value="${p.refInterna||''}"></div>
                <div class="input-group"><label>Área (dm²)</label><input type="text" id="ns-p-dm2" value="${p.dm2||''}"></div>
                <div class="input-group"><label>Peso (kg)</label><input type="text" id="ns-p-peso" value="${p.peso||0}"></div>
                <div class="input-group"><label>Potência (A)</label><input type="text" id="ns-p-potencia" value="${p.potencia||0}"></div>
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
        });
    }

    document.getElementById('new-service-form').addEventListener('submit', (e) => {
        e.preventDefault(); if(currentUser.role !== 'EDITOR') return;
        const db = getDB(); 
        let cid = parseInt(document.getElementById('ns-cliente-id').value);
        let pid = parseInt(document.getElementById('ns-part-id').value);
        
        // 1. CRIAR NOVO CLIENTE SE NECESSÁRIO
        if(!cid) {
            const nomeC = nsInpCliente.value.trim();
            if(!nomeC) return showToast("Por favor, insira o nome do Cliente.");
            cid = Date.now();
            if(!db.clientes) db.clientes = [];
            db.clientes.push({ id: cid, name: nomeC });
        }

        // 2. CRIAR NOVA PEÇA SE NECESSÁRIO
        const parsePeso = (v) => parseFloat(v.toString().replace(',', '.')) || 0;
        if(!pid) {
            const descP = nsInpPeca.value.trim();
            if(!descP) return showToast("Por favor, identifique a Peça (Ref ou Nome).");
            pid = Date.now() + 1;
            if(!db.pecas) db.pecas = [];
            db.pecas.push({
                id: pid,
                clienteId: cid,
                ref: descP.split('-')[0].trim(),
                name: descP.split('-')[1] ? descP.split('-')[1].trim() : descP,
                refInterna: document.getElementById('ns-p-ref-interna').value,
                dm2: document.getElementById('ns-p-dm2').value,
                peso: parsePeso(document.getElementById('ns-p-peso').value),
                potencia: parseFloat(document.getElementById('ns-p-potencia').value) || 0,
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
            // ATUALIZAR PEÇA EXISTENTE (OPÇÃO A)
            const p = db.pecas.find(x => x.id === pid);
            if(p) {
                p.refInterna = document.getElementById('ns-p-ref-interna').value;
                p.dm2 = document.getElementById('ns-p-dm2').value;
                p.peso = parsePeso(document.getElementById('ns-p-peso').value);
                p.potencia = parseFloat(document.getElementById('ns-p-potencia').value) || 0;
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

        // 3. REGISTAR SERVIÇO
        if(!db.servicos) db.servicos = [];
        db.servicos.push({
            id: Date.now() + 2, partId: pid, clienteId: cid,
            guia: document.getElementById('ns-guia').value, qty: parseInt(document.getElementById('ns-quantidade').value),
            dataEntrada: document.getElementById('ns-data-entrada').value, dataPrevista: document.getElementById('ns-data-prevista').value,
            status: document.getElementById('ns-estado').value, dataReal: null,
            observacoes: document.getElementById('ns-observacoes').value || ''
        });

        saveDB(db); 
        showToast('Novo registo sincronizado com sucesso! ✅'); 
        e.target.reset(); 
        document.getElementById('new-service-form').classList.add('hidden');
        if(nsInpCliente) nsInpCliente.value = '';
        if(nsInpPeca) { nsInpPeca.value = ''; nsInpPeca.disabled = true; }
        refreshData('dashboard');
    });

    document.getElementById('btn-cancel-service').onclick = () => { 
        document.getElementById('new-service-form').classList.add('hidden'); 
        if(nsInpCliente) nsInpCliente.value = ''; 
        if(nsInpPeca) { nsInpPeca.value = ''; nsInpPeca.disabled = true; }
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
            const newPecaId = Date.now();
            const clienteId = parseInt(document.getElementById('np-cliente').value) || 0;
            const parsePeso = (v) => parseFloat(v.toString().replace(',', '.')) || 0;
            
            db.pecas.push({
                id: newPecaId,
                ref: document.getElementById('np-ref').value,
                refInterna: document.getElementById('np-ref-interna').value,
                name: document.getElementById('np-nome').value,
                clienteId: clienteId,
                peso: parsePeso(document.getElementById('np-peso').value),
                ciclo: parseInt(document.getElementById('np-ciclo').value) || 0,
                potencia: parseFloat(document.getElementById('np-potencia').value) || 0,
                dm2: document.getElementById('np-dm2').value,
                deseng: document.getElementById('np-deseng').value,
                desengTempo: document.getElementById('np-deseng-tempo').value,
                decap: document.getElementById('np-decap').value,
                decapTempo: document.getElementById('np-decap-tempo').value,
                electro: document.getElementById('np-electro').value,
                electroTempo: document.getElementById('np-electro-tempo').value,
                passiv: document.getElementById('np-passiv').value,
                passivTempo: document.getElementById('np-passiv-tempo').value,
                comprimento: document.getElementById('np-comprimento').value,
                altura: document.getElementById('np-altura').value,
                largura: document.getElementById('np-largura').value,
                diametro: document.getElementById('np-diametro').value
            });
            
            let toastMsg = 'Peça Mestre guardada!';
            
            const guia = document.getElementById('np-guia').value;
            if(guia) {
                if(!db.servicos) db.servicos = [];
                db.servicos.push({
                    id: Date.now() + 1,
                    partId: newPecaId,
                    clienteId: clienteId,
                    guia: guia,
                    qty: parseInt(document.getElementById('np-quantidade').value) || 1,
                    dataEntrada: document.getElementById('np-data-entrada').value || new Date().toISOString().split('T')[0],
                    dataPrevista: document.getElementById('np-data-prevista').value || new Date().toISOString().split('T')[0],
                    status: 'Em Curso',
                    dataReal: null,
                    observacoes: document.getElementById('np-observacoes').value || ''
                });
                toastMsg = 'Peça e Trabalho Inicial guardados!';
            }

            saveDB(db); showToast(toastMsg);
            
            document.getElementById('np-ref').value = ''; document.getElementById('np-nome').value = '';
            document.getElementById('np-ref-interna').value = '';
            document.getElementById('np-peso').value = ''; document.getElementById('np-ciclo').value = ''; document.getElementById('np-potencia').value = '';
            document.getElementById('np-dm2').value = ''; document.getElementById('np-deseng').value = ''; document.getElementById('np-decap').value = '';
            document.getElementById('np-electro').value = ''; document.getElementById('np-passiv').value = '';
            document.getElementById('np-deseng-tempo').value = ''; document.getElementById('np-decap-tempo').value = '';
            document.getElementById('np-electro-tempo').value = ''; document.getElementById('np-passiv-tempo').value = '';
            document.getElementById('np-comprimento').value = ''; document.getElementById('np-altura').value = '';
            document.getElementById('np-largura').value = ''; document.getElementById('np-diametro').value = '';
            document.getElementById('np-guia').value = ''; document.getElementById('np-quantidade').value = '';

            document.getElementById('form-nova-peca').classList.add('hidden');
            refreshData('pecas');
        };
    }

    const btnNovoCliente = document.getElementById('btn-novo-cliente');
    if(btnNovoCliente) {
        btnNovoCliente.onclick = () => {
            if(currentUser.role !== 'EDITOR') return showToast("Sem Permissão");
            const nome = prompt("Nome do Novo Cliente a Registar:");
            if(nome) {
                const db = getDB(); if(!db.clientes) db.clientes=[];
                db.clientes.push({ id: Date.now(), name: nome });
                saveDB(db); showToast('Cliente adicionado!');
                refreshData('pecas');
                refreshData('clientes');
            }
        };
    }

    const btnNovoClientePg = document.getElementById('btn-novo-cliente-pg');
    if(btnNovoClientePg) {
        btnNovoClientePg.onclick = () => {
            if(currentUser.role !== 'EDITOR') return showToast("Sem Permissão");
            const nome = prompt("Nome do Novo Cliente a Registar:");
            if(nome) {
                const db = getDB(); if(!db.clientes) db.clientes=[];
                db.clientes.push({ id: Date.now(), name: nome });
                saveDB(db); showToast('Cliente adicionado!');
                refreshData('clientes');
            }
        };
    }
});
