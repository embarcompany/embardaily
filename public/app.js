const stages = [
  ['não_iniciado', 'Contato inicial', 'Ainda não enviado'],
  ['toque1_enviado', 'Aguardando resposta', 'Mensagem inicial enviada'],
  ['aguardando_resposta', 'Aguardando resposta', 'Acompanhar retorno'],
  ['depoimento_recebido', 'Depoimento recebido', 'Pronto para avaliação'],
  ['toque2_enviado', 'Avaliação Google', 'Aguardando confirmação'],
  ['toque3_enviado', 'Instagram', 'Aguardando autorização'],
  ['revisao_manual', 'Revisar agora', 'Precisa de uma pessoa'],
  ['concluido', 'Concluídos', 'Fluxo finalizado'],
];
const aliases = { nao_iniciado: 'não_iniciado', 'toque_1_enviado': 'toque1_enviado', 'toque_2_enviado': 'toque2_enviado', 'toque_3_enviado': 'toque3_enviado', toque_1_enviado: 'toque1_enviado' };
let contacts = [];
const board = document.querySelector('#board');
const summary = document.querySelector('#summary');
const dialog = document.querySelector('#detail');
const detail = document.querySelector('#detail-content');
const fmt = value => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: String(value).includes('T') ? 'short' : undefined }).format(new Date(value)) : '—';
const statusOf = contact => aliases[contact.status] || contact.status || 'não_iniciado';
const stage = contact => stages.find(([id]) => id === statusOf(contact)) || stages[0];
const esc = text => String(text || '—').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));

function contactSignal(contact) {
  if (!contact.phone) return ['Dados pendentes', 'Telefone ausente', 'risk'];
  if (!contact.contacted) return ['Pendente', 'Contato inicial não enviado', 'risk'];
  if (contact.replyAt) return ['Respondido', `Resposta em ${fmt(contact.replyAt)}`, 'good'];
  return ['Enviado', contact.touch1At ? `Enviado em ${fmt(contact.touch1At)}` : 'Contato inicial realizado', 'good'];
}
function nextAction(contact) {
  if (contact.nextActionLabel) return contact.nextActionLabel;
  return { 'não_iniciado': 'Enviar contato inicial', toque1_enviado: 'Acompanhar resposta', aguardando_resposta: 'Conferir retorno do tutor', depoimento_recebido: 'Enviar pedido de avaliação', toque2_enviado: 'Aguardar avaliação', toque3_enviado: 'Aguardar autorização', revisao_manual: 'Ler e responder manualmente', concluido: 'Nenhuma ação pendente' }[statusOf(contact)] || 'Revisar caso';
}
function renderSummary() {
  const pending = contacts.filter(c => !c.contacted);
  const active = contacts.filter(c => statusOf(c) !== 'concluido');
  const review = contacts.filter(c => statusOf(c) === 'revisao_manual' || !c.phone);
  const coverage = contacts.length ? Math.round((1 - pending.length / contacts.length) * 100) : 0;
  summary.innerHTML = [[`${coverage}%`, 'contato inicial realizado'], [pending.length, 'ainda precisam de contato'], [active.length, 'embarques em acompanhamento'], [review.length, 'pendências para revisar']].map(([number, label], index) => `<article class="metric metric-${index}"><strong>${number}</strong><span>${label}</span></article>`).join('');
}
function card(contact) {
  const [signal, signalText, signalKind] = contactSignal(contact);
  const item = document.createElement('article');
  item.className = 'card'; item.draggable = true; item.dataset.id = contact.row;
  item.innerHTML = `<div class="card-top"><span class="card-company">${esc(contact.company || 'Embarpet')}</span><span class="pill ${signalKind}">${esc(signal)}</span></div><h3>${esc(contact.client || 'Sem nome')}</h3><p class="pet">🐾 ${esc(contact.pet || 'Pet não informado')}</p><div class="route"><span>${esc(contact.destination || 'Destino pendente')}</span><span>${contact.date ? fmt(contact.date) : 'Data pendente'}</span></div><div class="card-status"><b>${esc(signalText)}</b><span>${esc(nextAction(contact))}</span></div><footer><span>${contact.folderUrl ? 'Drive vinculado' : 'Sem arquivos'}</span><span>${contact.phone ? 'WhatsApp OK' : 'Telefone pendente'}</span></footer>`;
  item.onclick = () => openDetail(contact);
  item.ondragstart = () => item.classList.add('dragging');
  item.ondragend = () => item.classList.remove('dragging');
  return item;
}
function render() {
  const query = document.querySelector('#search').value.trim().toLowerCase();
  const onlyPending = document.querySelector('#uncontacted').checked;
  const filtered = contacts.filter(c => `${c.client} ${c.pet} ${c.destination}`.toLowerCase().includes(query) && (!onlyPending || !c.contacted));
  renderSummary(); board.innerHTML = '';
  stages.forEach(([id, label, hint]) => {
    const list = filtered.filter(c => statusOf(c) === id);
    const column = document.createElement('section'); column.className = 'column';
    column.innerHTML = `<header class="column-head"><div><b>${label}</b><small>${hint}</small></div><span class="count">${list.length}</span></header><div class="cards"></div>`;
    const target = column.querySelector('.cards'); target.ondragover = event => event.preventDefault(); target.ondrop = event => { event.preventDefault(); const dragged = document.querySelector('.dragging'); if (dragged) move(dragged.dataset.id, id); };
    list.forEach(c => target.append(card(c))); board.append(column);
  });
}
async function move(row, status) {
  const response = await fetch(`/api/contacts/${row}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) });
  if (!response.ok) return alert('Não foi possível salvar a etapa na planilha.');
  contacts.find(c => String(c.row) === String(row)).status = status; render();
}
function openDetail(contact) {
  const [signal, signalText, signalKind] = contactSignal(contact);
  detail.innerHTML = `<p class="eyebrow">${esc(stage(contact)[1])}</p><h2>${esc(contact.client)}</h2><p class="detail-subtitle">🐾 ${esc(contact.pet)} · ${esc(contact.company)}</p><section class="operation-grid"><div><b>Contato inicial</b><span class="pill ${signalKind}">${esc(signal)}</span><small>${esc(signalText)}</small></div><div><b>Próxima ação</b><strong>${esc(nextAction(contact))}</strong><small>${contact.reminderAttempts ? `${contact.reminderAttempts} lembrete(s) enviado(s)` : 'Nenhum lembrete enviado'}</small></div><div><b>WhatsApp</b><strong>${contact.phone ? 'Disponível' : 'Pendente'}</strong><small>${esc(contact.phone || 'Preencha o telefone do tutor')}</small></div><div><b>Arquivos</b><strong>${contact.folderUrl ? 'Pasta vinculada' : 'Sem pasta'}</strong><small>${contact.folderUrl ? 'Fotos e vídeos organizados' : 'Crie ao enviar o primeiro arquivo'}</small></div></section><section class="detail-list"><h3>Dados do embarque</h3>${[['Destino', contact.destination], ['Data', contact.date && fmt(contact.date)], ['Resumo', contact.notes], ['Depoimento', contact.testimonial]].filter(([, value]) => value).map(([label, value]) => `<p><b>${label}</b><span>${esc(value)}</span></p>`).join('')}</section>${contact.folderUrl ? `<a class="drive-link" href="${contact.folderUrl}" target="_blank">Abrir pasta no Drive ↗</a>` : ''}<div class="detail-actions"><button id="manual" class="secondary">Revisar manualmente</button></div>`;
  detail.querySelector('#manual').onclick = () => { move(contact.row, 'revisao_manual'); dialog.close(); };
  dialog.showModal();
}
async function load() {
  document.querySelector('#refresh').disabled = true;
  try { const response = await fetch('/api/contacts'); if (!response.ok) throw new Error(); const payload = await response.json(); contacts = Array.isArray(payload) ? payload : []; }
  catch { contacts = []; }
  document.querySelector('#updated-at').textContent = `Atualizado às ${new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(new Date())}`;
  document.querySelector('#refresh').disabled = false; render();
}
document.querySelector('#refresh').onclick = load;
document.querySelector('#search').oninput = render;
document.querySelector('#uncontacted').onchange = render;
dialog.querySelector('.close').onclick = () => dialog.close();
load();
