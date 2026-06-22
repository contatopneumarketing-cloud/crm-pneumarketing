// ─── CONFIG ─────────────────────────────────────────────────────
// Substitua pelos seus valores do Supabase
const SUPABASE_URL = 'https://gidyntnykhcmptgdzuhl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpZHludG55a2hjbXB0Z2R6dWhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNTk5MzYsImV4cCI6MjA5NzYzNTkzNn0.cADR1ek8MXHzEHXD1ol93DZ---cKWayLeXqScaxmAyM';
// IDs dos boards Monday.com
const MONDAY_BOARDS = [
  { id: '18415073072', src: 'Formulário' },
  { id: '18417945184', src: 'Página de vendas' },
  { id: '18417602443', src: 'Instagram' },
];

// ─── CADÊNCIA ────────────────────────────────────────────────────
const CADENCIA = [
  { day: 0, canal: 'WhatsApp', icon: '💬', ch: 'ch-wa', title: 'Primeiro contato', desc: 'Mensagem imediata após chegada do lead.', script: 'Oi [Nome]! Vi que você se interessou pela Pneumarketing. Ajudo centros automotivos a lotarem os elevadores com consistência. Posso te mostrar como funciona em 15 minutos essa semana?' },
  { day: 0, canal: 'Ligação', icon: '📞', ch: 'ch-call', title: 'Ligação de ativação', desc: 'Ligar em até 5 minutos. Maior chance de contato.', script: 'Oi [Nome], aqui é o [SDR] da Pneumarketing. Vi que você pediu uma análise. Tenho 2 minutinhos para entender seu centro automotivo e já te falo o que dá pra fazer.' },
  { day: 1, canal: 'WhatsApp', icon: '💬', ch: 'ch-wa', title: 'Follow-up D1', desc: 'Reforço no dia seguinte sem resposta.', script: '[Nome], tudo bem? Tentei te ligar ontem. Quero entender como está o movimento no seu centro automotivo. Vale 15 minutos?' },
  { day: 2, canal: 'Ligação', icon: '📞', ch: 'ch-call', title: 'Segunda ligação', desc: 'Segunda tentativa com abordagem de dor.', script: '[Nome], aqui é o [SDR] novamente. O problema de movimento no pátio está te preocupando? Tenho algo que pode resolver nos próximos 30 dias.' },
  { day: 3, canal: 'WhatsApp', icon: '💬', ch: 'ch-wa', title: 'Prova social D3', desc: 'Resultado de cliente do mesmo segmento.', script: '[Nome], olha o resultado de um cliente parecido com o seu centro. Saiu de X para Y carros/dia em 60 dias. Quer saber como a gente fez?' },
  { day: 5, canal: 'Ligação', icon: '📞', ch: 'ch-call', title: 'Última tentativa ativa', desc: 'Ligação final do ciclo ativo.', script: '[Nome], não quero te incomodar. Essa é minha última tentativa. Se quiser saber como lotar o pátio, me responde. Se não, fica tranquilo — a gente entende.' },
  { day: 7, canal: 'WhatsApp', icon: '💬', ch: 'ch-wa', title: 'Encerramento D7', desc: 'Abre espaço para reativação futura.', script: '[Nome], deixo a porta aberta. Quando quiser saber como outros centros automotivos estão lotando o pátio, me chama.' },
  { day: 30, canal: 'WhatsApp', icon: '💬', ch: 'ch-wa', title: 'Reativação 30 dias', desc: 'Reabordar após silêncio de 30 dias.', script: '[Nome], sumiu! Como está o movimento? Temos uma estratégia nova que está lotando pátio em 3 semanas. Posso te mostrar?' },
];

// ─── STATE ───────────────────────────────────────────────────────
let leads = [];
let cadStates = {}; // { leadId: { currentStep, history, startDate } }
let regId = null;
let activeTab = 'hoje';
let activeCadLeadId = null;

// ─── SUPABASE ────────────────────────────────────────────────────
async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': opts.prefer || 'return=representation',
      ...opts.headers,
    },
  });
  if (!res.ok && res.status !== 204) {
    const err = await res.text();
    throw new Error(`Supabase ${res.status}: ${err}`);
  }
  return res.status === 204 ? null : res.json();
}

async function loadFromSupabase() {
  try {
    const [dbLeads, dbStates] = await Promise.all([
      sbFetch('/leads?select=*&order=created_at.desc&limit=200'),
      sbFetch('/cadencia_states?select=*'),
    ]);

    if (dbLeads && dbLeads.length > 0) {
      leads = dbLeads.map(r => ({
        id: r.monday_id,
        name: r.name,
        phone: r.phone || '',
        src: r.source,
        created: r.created_at?.slice(0, 10) || today(),
        extra: r.extra || '',
        dbId: r.id,
      }));
    }

    if (dbStates) {
      dbStates.forEach(r => {
        cadStates[r.monday_id] = {
          currentStep: r.current_step || 0,
          history: r.history || [],
          startDate: r.start_date || today(),
          dbId: r.id,
        };
      });
    }

    setSyncInfo(`${leads.length} leads carregados · Supabase conectado`);
  } catch (e) {
    console.error('Supabase load error:', e);
    setSyncInfo('Supabase offline — usando dados locais');
    useSeedLeads();
  }
}

async function saveStateToSupabase(leadId) {
  const st = getState(leadId);
  try {
    if (st.dbId) {
      await sbFetch(`/cadencia_states?id=eq.${st.dbId}`, {
        method: 'PATCH',
        body: JSON.stringify({ current_step: st.currentStep, history: st.history, updated_at: new Date().toISOString() }),
        prefer: 'return=minimal',
      });
    } else {
      const res = await sbFetch('/cadencia_states', {
        method: 'POST',
        body: JSON.stringify({ monday_id: leadId, current_step: st.currentStep, history: st.history, start_date: st.startDate }),
      });
      if (res && res[0]) st.dbId = res[0].id;
    }
  } catch (e) {
    console.error('Save state error:', e);
    showToast('Erro ao salvar — tente novamente', 'error');
  }
}

async function saveLeadToSupabase(lead) {
  try {
    const res = await sbFetch('/leads', {
      method: 'POST',
      body: JSON.stringify({ monday_id: lead.id, name: lead.name, phone: lead.phone, source: lead.src, extra: lead.extra || '', created_at: lead.created }),
    });
    if (res && res[0]) lead.dbId = res[0].id;
  } catch (e) {
    console.error('Save lead error:', e);
  }
}

// ─── MONDAY SYNC ─────────────────────────────────────────────────
async function syncAll() {
  setSyncing(true);
  try {
    const res = await fetch('/api/sync-monday');
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    const existing = new Set(leads.map(l => l.id));
    let added = 0;
    (data.leads || []).forEach(item => {
      if (!existing.has(item.id)) {
        leads.push(item);
        if (!cadStates[item.id]) {
          cadStates[item.id] = { currentStep: 0, history: [], startDate: item.created };
        }
        saveLeadToSupabase(item);
        added++;
        existing.add(item.id);
      }
    });
    showToast(`Sincronizado · ${added} leads novos`, 'success');
    setSyncInfo(`${leads.length} leads · ${added} novos · ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`);
  } catch (e) {
    showToast('Erro ao sincronizar com Monday.com', 'error');
  }
  setSyncing(false);
  render();
}

// ─── HELPERS ─────────────────────────────────────────────────────
function today() { return new Date().toISOString().slice(0, 10); }
function daysIn(d) { if (!d) return 0; return Math.max(0, Math.round((new Date() - new Date(d)) / 86400000)); }
function initials(n) { return n.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '??'; }
function waLink(p) { if (!p) return null; const d = p.replace(/\D/g, ''); return d.length >= 8 ? `https://wa.me/${d.startsWith('55') ? d : '55' + d}` : null; }
function srcBadge(src) { return src === 'Formulário' ? 'badge-form' : src === 'Instagram' ? 'badge-ig' : 'badge-lp'; }
function srcAvatar(src) { return src === 'Formulário' ? 'av-form' : src === 'Instagram' ? 'av-ig' : 'av-lp'; }
function getState(id) { if (!cadStates[id]) cadStates[id] = { currentStep: 0, history: [], startDate: today() }; return cadStates[id]; }
function isDue(lead) { const st = getState(lead.id); if (st.currentStep >= CADENCIA.length) return false; return CADENCIA[st.currentStep].day <= daysIn(st.startDate); }
function statusInfo(lead) {
  const st = getState(lead.id);
  if (st.currentStep >= CADENCIA.length) return { label: 'Concluída', cls: 'badge-done' };
  const step = CADENCIA[st.currentStep]; const d = step.day - daysIn(st.startDate);
  if (d < 0) return { label: 'Atrasado', cls: 'badge-urgent' };
  if (d === 0) return { label: 'Fazer hoje', cls: 'badge-today' };
  return { label: `D+${step.day} em ${d}d`, cls: 'badge-waiting' };
}
function setSyncInfo(msg) { document.getElementById('sync-info').textContent = msg; }
function setSyncing(v) {
  document.getElementById('sync-spinner').style.display = v ? 'inline' : 'none';
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ─── TABS ─────────────────────────────────────────────────────────
const TITLES = { hoje: 'Hoje', leads: 'Todos os leads', cadencia: 'Cadência' };
function goTab(tab, btn) {
  activeTab = tab;
  document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('page-title').textContent = TITLES[tab] || tab;
  ['hoje', 'leads', 'cadencia'].forEach(v => document.getElementById('view-' + v).style.display = v === tab ? 'block' : 'none');
  render();
}

function filterSource(src) {
  document.getElementById('f-src').value = src;
}

// ─── RENDER ──────────────────────────────────────────────────────
function render() {
  updateBadges();
  if (activeTab === 'hoje') renderHoje();
  else if (activeTab === 'leads') renderLeads();
  else if (activeTab === 'cadencia' && activeCadLeadId) openCadencia(activeCadLeadId);
}

function updateBadges() {
  const due = leads.filter(isDue).length;
  const nb = document.getElementById('nb-hoje');
  nb.textContent = due; nb.style.display = due ? 'inline' : 'none';
}

function renderHoje() {
  const due = leads.filter(isDue);
  const late = leads.filter(l => { const st = getState(l.id); if (st.currentStep >= CADENCIA.length) return false; return CADENCIA[st.currentStep].day < daysIn(st.startDate); });
  const done = leads.filter(l => getState(l.id).currentStep >= CADENCIA.length);

  document.getElementById('hoje-metrics').innerHTML = `
    <div class="metric"><div class="metric-label">Para fazer hoje</div><div class="metric-val" style="color:#f5b942">${due.length}</div><div class="metric-sub">Contatos pendentes</div></div>
    <div class="metric"><div class="metric-label">Em cadência</div><div class="metric-val">${leads.length}</div><div class="metric-sub">Total de leads</div></div>
    <div class="metric"><div class="metric-label">Atrasados</div><div class="metric-val" style="color:#f57a79">${late.length}</div><div class="metric-sub">Precisam de ação</div></div>
    <div class="metric"><div class="metric-label">Concluídos</div><div class="metric-val" style="color:#4cd9a8">${done.length}</div><div class="metric-sub">Cadência finalizada</div></div>
  `;

  const list = document.getElementById('hoje-list');
  if (!due.length) {
    list.innerHTML = '<div class="empty"><div class="empty-icon">✅</div>Nada para hoje. Bom trabalho, Matheus!</div>';
    return;
  }
  list.innerHTML = due.map(l => {
    const st = getState(l.id); const step = CADENCIA[st.currentStep]; const wa = waLink(l.phone);
    return `<div class="today-step">
      <div class="ch-icon ${step.ch}">${step.icon}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
          <span style="font-size:14px;font-weight:500">${l.name}</span>
          <span class="badge ${srcBadge(l.src)}">${l.src}</span>
        </div>
        <div style="font-size:12px;color:var(--text3)">${step.canal} · ${step.title} · Dia ${step.day}</div>
        ${wa ? `<a href="${wa}" target="_blank" class="wa-link" style="margin-top:5px">${step.icon} Abrir WhatsApp</a>` : ''}
        <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
          <button class="btn sm" onclick="openCadencia('${l.id}')">📋 Ver cadência</button>
          <button class="btn sm primary" onclick="openReg('${l.id}')">✓ Registrar</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderLeads() {
  const fs = document.getElementById('f-src').value;
  const fst = document.getElementById('f-status').value;
  let filtered = leads.filter(l => {
    if (fs && l.src !== fs) return false;
    const info = statusInfo(l);
    if (fst === 'due' && !isDue(l)) return false;
    if (fst === 'late' && info.cls !== 'badge-urgent') return false;
    if (fst === 'waiting' && info.cls !== 'badge-waiting') return false;
    if (fst === 'done' && info.cls !== 'badge-done') return false;
    return true;
  });

  const el = document.getElementById('leads-list');
  if (!filtered.length) { el.innerHTML = '<div class="empty">Nenhum lead encontrado.</div>'; return; }

  el.innerHTML = filtered.map(l => {
    const st = getState(l.id); const info = statusInfo(l);
    const prog = st.currentStep >= CADENCIA.length ? 100 : Math.round((st.currentStep / CADENCIA.length) * 100);
    const wa = waLink(l.phone);
    return `<div class="lead-row">
      <div class="lead-avatar ${srcAvatar(l.src)}">${initials(l.name)}</div>
      <div class="lead-info">
        <div class="lead-name">${l.name}</div>
        <div class="lead-meta">${l.src} · Passo ${Math.min(st.currentStep + 1, CADENCIA.length)} de ${CADENCIA.length}${l.extra ? ' · ' + l.extra : ''}</div>
        <div class="prog-wrap"><div class="prog-fill" style="width:${prog}%"></div></div>
      </div>
      <div class="lead-actions">
        <span class="badge ${info.cls}">${info.label}</span>
        ${wa ? `<a href="${wa}" target="_blank" class="btn sm">💬</a>` : ''}
        <button class="btn sm" onclick="openCadencia('${l.id}')">📋</button>
        <button class="btn sm primary" onclick="openReg('${l.id}')">✓</button>
      </div>
    </div>`;
  }).join('');
}

// ─── CADÊNCIA VIEW ───────────────────────────────────────────────
function openCadencia(leadId) {
  activeCadLeadId = leadId;
  const l = leads.find(x => x.id === leadId); if (!l) return;
  const st = getState(leadId);
  const d = daysIn(st.startDate);
  const prog = st.currentStep >= CADENCIA.length ? 100 : Math.round((st.currentStep / CADENCIA.length) * 100);
  const wa = waLink(l.phone);

  let html = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:1.25rem;gap:10px;flex-wrap:wrap">
      <div>
        <div style="font-size:16px;font-weight:600;margin-bottom:4px">${l.name} <span class="badge ${srcBadge(l.src)}" style="font-size:11px">${l.src}</span></div>
        <div style="font-size:12px;color:var(--text3)">Dia ${d} na cadência${l.extra ? ' · ' + l.extra : ''}</div>
        ${wa ? `<a href="${wa}" target="_blank" class="wa-link" style="margin-top:6px">${l.phone}</a>` : ''}
      </div>
      <button class="btn sm" onclick="activeCadLeadId=null;document.getElementById('cadencia-content').innerHTML='<div class=empty><div class=empty-icon>🔍</div>Selecione um lead</div>'">← Voltar</button>
    </div>
    <div class="prog-header"><span>Progresso da cadência</span><span>${st.currentStep} de ${CADENCIA.length} passos</span></div>
    <div class="prog-full"><div class="prog-full-fill" style="width:${prog}%"></div></div>
  `;

  if (st.history.length) {
    html += `<div class="section-lbl" style="margin-bottom:10px">Histórico de contatos</div>`;
    html += st.history.slice().reverse().map(h => `
      <div class="tl-item">
        <div class="tl-dot"></div>
        <div class="tl-text"><strong>${CADENCIA[h.step]?.title || 'Passo'}</strong> · ${h.date}<br>${h.outcome}${h.note ? ' — ' + h.note : ''}</div>
      </div>`).join('');
    html += `<div style="margin-bottom:1.25rem"></div>`;
  }

  html += `<div class="section-lbl" style="margin-bottom:10px">Todos os passos</div>`;
  CADENCIA.forEach((step, i) => {
    const done = i < st.currentStep, active = i === st.currentStep;
    const numCls = done ? 'sn-done' : active ? 'sn-active' : 'sn-locked';
    const icon = done ? '✓' : i + 1;
    const hist = st.history.find(h => h.step === i);
    html += `<div class="cad-step ${active ? 'active' : ''} ${i > st.currentStep ? 'locked' : ''}">
      <div class="step-num ${numCls}">${icon}</div>
      <div class="step-body">
        <div class="step-title">${step.title}</div>
        <div class="step-meta">D+${step.day} · ${step.canal}</div>
        <div class="step-meta">${step.desc}</div>
        ${hist ? `<div class="step-hist">✓ ${hist.outcome}${hist.note ? ' — ' + hist.note : ''}</div>` : ''}
        ${active ? `
        <div class="step-actions">
          <button class="btn sm" onclick="var s=document.getElementById('sc${i}');s.style.display=s.style.display==='block'?'none':'block'">📄 Script</button>
          <button class="btn sm primary" onclick="openReg('${leadId}')">✓ Registrar</button>
        </div>
        <div class="step-script" id="sc${i}">${step.script.replace(/\[Nome\]/g, l.name.split(' ')[0])}</div>
        ` : ''}
      </div>
    </div>`;
  });

  document.getElementById('cadencia-content').innerHTML = html;
  goTab('cadencia', document.getElementById('nav-cad'));
}

// ─── REGISTRO ────────────────────────────────────────────────────
function openReg(id) {
  regId = id;
  const l = leads.find(x => x.id === id);
  const st = getState(id);
  const step = CADENCIA[Math.min(st.currentStep, CADENCIA.length - 1)];
  document.getElementById('reg-title').textContent = `${step.canal} · ${l.name.split(' ')[0]} · ${step.title}`;
  document.getElementById('reg-outcome').value = '';
  document.getElementById('reg-note').value = '';
  document.getElementById('modal-reg').classList.add('open');
}

async function saveReg() {
  const outcome = document.getElementById('reg-outcome').value;
  if (!outcome) { showToast('Selecione o resultado', 'error'); return; }
  const note = document.getElementById('reg-note').value.trim();
  const st = getState(regId);
  st.history.push({ step: st.currentStep, date: today(), outcome, note });
  if (outcome !== 'Desqualificado') st.currentStep = Math.min(st.currentStep + 1, CADENCIA.length);
  else st.currentStep = CADENCIA.length;
  closeModal('modal-reg');
  showToast('Contato registrado!', 'success');
  await saveStateToSupabase(regId);
  if (activeTab === 'cadencia') openCadencia(regId);
  else render();
}

// ─── NOVO LEAD ───────────────────────────────────────────────────
function openNewLead() { document.getElementById('modal-new').classList.add('open'); }
async function createLead() {
  const name = document.getElementById('nl-name').value.trim();
  if (!name) { showToast('Informe o nome', 'error'); return; }
  const lead = {
    id: 'manual-' + Date.now(),
    name,
    phone: document.getElementById('nl-phone').value.trim(),
    src: document.getElementById('nl-src').value,
    created: today(),
    extra: document.getElementById('nl-company').value.trim(),
  };
  leads.unshift(lead);
  cadStates[lead.id] = { currentStep: 0, history: [], startDate: today() };
  ['nl-name', 'nl-company', 'nl-phone'].forEach(id => document.getElementById(id).value = '');
  closeModal('modal-new');
  showToast(`${lead.name} adicionado à cadência`, 'success');
  await saveLeadToSupabase(lead);
  render();
}

// ─── MODAL ───────────────────────────────────────────────────────
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ─── SEED (fallback offline) ─────────────────────────────────────
function useSeedLeads() {
  const seed = [
    { id: '12247838919', name: 'Bruno Felipe Buss', phone: '+554187012070', src: 'Formulário', created: '2026-06-10' },
    { id: '12244326317', name: 'Daniel Bochenski', phone: '+5542998089219', src: 'Formulário', created: '2026-06-10' },
    { id: '12224872457', name: 'Luis Zorgetz', phone: '+5521964662820', src: 'Formulário', created: '2026-06-08' },
    { id: '12204216867', name: 'João Vítor Romano', phone: '+5527997395422', src: 'Formulário', created: '2026-06-05' },
    { id: '12236477228', name: 'Alê Vicco', phone: '+5511968090926', src: 'Formulário', created: '2026-06-09' },
    { id: '12259154134', name: 'Jorge Costa', phone: '+5565999121823', src: 'Formulário', created: '2026-06-12' },
    { id: '12330887965', name: 'Teste LP', phone: '343422432434', src: 'Página de vendas', created: '2026-06-21' },
    { id: '12292010494', name: 'Sulyani', phone: '5585999052850', src: 'Instagram', created: '2026-06-16', extra: 'Mercadão do Pneu · Até R$50k · Urgente' },
    { id: '12305321032', name: 'Daniela Pizarro', phone: '5553981185483', src: 'Instagram', created: '2026-06-17', extra: 'R$250k-500k · Pesquisando' },
  ];
  seed.forEach(l => {
    if (!leads.find(x => x.id === l.id)) {
      leads.push(l);
      if (!cadStates[l.id]) cadStates[l.id] = { currentStep: 0, history: [], startDate: l.created };
    }
  });
}

// ─── INIT ─────────────────────────────────────────────────────────
async function init() {
  setSyncing(true);
  await loadFromSupabase();
  setSyncing(false);
  render();
}

init();
