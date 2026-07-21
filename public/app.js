const stages = [['não_iniciado', 'Prontos para contato'], ['toque1_enviado', 'Depoimento solicitado'], ['aguardando_resposta', 'Aguardando resposta'], ['depoimento_recebido', 'Depoimento recebido'], ['toque2_enviado', 'Avaliação Google'], ['toque3_enviado', 'Autorização Instagram'], ['revisao_manual', 'Revisar manualmente'], ['concluido', 'Concluídos']];
let contacts = [];
document.querySelector('header .actions').insertAdjacentHTML('afterbegin', '<a class="back" href="/novo-embarque">Novo embarque</a>');
const board = document.querySelector('#board'), summary = document.querySelector('#summary'), dialog = document.querySelector('#detail'), detail = document.querySelector('#detail-content');
const stageName = status => stages.find(([id]) => id === status)?.[1] || status || 'Prontos para contato';

function card(contact) {
  const element = document.createElement('article'); element.className = 'card'; element.draggable = true; element.dataset.id = contact.row;
  element.innerHTML = `<h3>${contact.client || 'Sem nome'}</h3><p>${contact.pet || 'Pet não informado'} · ${contact.company || 'Empresa não informada'}</p><p>${contact.destination || 'Destino não informado'} · ${contact.date || 'Data não informada'}</p><span class="tag ${contact.contacted ? '' : 'warning'}">${contact.contacted ? 'Contato realizado' : contact.phone ? 'Ainda não contatado' : 'Sem telefone'}</span>`;
  element.onclick = () => openDetail(contact); element.ondragstart = () => element.classList.add('dragging'); element.ondragend = () => element.classList.remove('dragging'); return element;
}

function render() {
  const query = document.querySelector('#search').value.toLowerCase(); const onlyUncontacted = document.querySelector('#uncontacted').checked;
  const filtered = contacts.filter(contact => `${contact.client} ${contact.pet}`.toLowerCase().includes(query) && (!onlyUncontacted || !contact.contacted)); const missing = contacts.filter(contact => !contact.contacted);
  summary.innerHTML = `<div class="metric"><b>${contacts.length}</b><span>clientes no CRM</span></div><div class="metric"><b>${missing.length}</b><span>ainda não contatados</span></div><div class="metric"><b>${contacts.filter(contact => contact.phone).length}</b><span>com WhatsApp</span></div><div class="metric"><b>${contacts.filter(contact => contact.status === 'revisao_manual').length}</b><span>para revisar</span></div>`;
  board.innerHTML = '';
  stages.forEach(([status, label]) => { const list = filtered.filter(contact => (contact.status || 'não_iniciado') === status); const column = document.createElement('section'); column.className = 'column'; column.innerHTML = `<div class="column-head"><span>${label}</span><span class="count">${list.length}</span></div><div class="cards"></div>`; const target = column.querySelector('.cards'); target.ondragover = event => event.preventDefault(); target.ondrop = async event => { event.preventDefault(); const dragged = document.querySelector('.dragging'); if (dragged) await move(dragged.dataset.id, status); }; list.forEach(contact => target.append(card(contact))); board.append(column); });
}

async function move(row, status) { const response = await fetch(`/api/contacts/${row}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) }); if (!response.ok) return alert('Não foi possível atualizar a etapa.'); contacts.find(contact => contact.row == row).status = status; render(); }
function fields(contact) { return [['Pet', contact.pet], ['Telefone', contact.phone], ['Empresa', contact.company], ['Embarque', contact.date], ['Destino', contact.destination], ['Observações', contact.notes], ['Depoimento', contact.testimonial]].filter(([, value]) => value).map(([label, value]) => `<div class="detail-row"><b>${label}</b>${value}</div>`).join(''); }
function openDetail(contact) {
  detail.innerHTML = `<p class="eyebrow">${stageName(contact.status)}</p><h2>${contact.client || 'Sem nome'}</h2>${fields(contact)}${contact.folderUrl ? `<a class="drive-link" target="_blank" href="${contact.folderUrl}">Abrir pasta no Drive ↗</a>` : '<button class="drive-link" id="folder">Criar pasta no Drive</button>'}<form class="upload" id="upload"><b>Fotos e vídeos do caso</b><input type="file" name="file" accept="image/*,video/*" required><button>Enviar ao Drive</button><div class="status"></div></form><div class="detail-actions"><button id="send">Enviar próxima mensagem</button><button id="manual">Mover para revisão</button></div>`;
  detail.querySelector('#manual').onclick = () => { move(contact.row, 'revisao_manual'); dialog.close(); };
  detail.querySelector('#send').onclick = async () => { const response = await fetch(`/api/contacts/${contact.row}/send`, { method: 'POST' }); if (response.ok) { alert('Mensagem enviada.'); await load(); } else alert('Não foi possível enviar. Confira o telefone e a Evolution API.'); };
  detail.querySelector('#folder')?.addEventListener('click', async () => { const response = await fetch(`/api/contacts/${contact.row}/folder`, { method: 'POST' }); if (!response.ok) return alert(`Não foi possível criar a pasta: ${await response.text()}`); const { folderUrl } = await response.json(); window.open(folderUrl, '_blank'); await load(); dialog.close(); openDetail({ ...contact, folderUrl }); });
  detail.querySelector('#upload').onsubmit = async event => { event.preventDefault(); const status = event.currentTarget.querySelector('.status'); status.textContent = 'Enviando...'; const response = await fetch(`/api/contacts/${contact.row}/upload`, { method: 'POST', body: new FormData(event.currentTarget) }); status.textContent = response.ok ? 'Arquivo enviado ao Drive.' : `Erro: ${await response.text()}`; if (response.ok) await load(); };
  dialog.showModal();
}
async function load() { const response = await fetch('/api/contacts'); contacts = await response.json(); render(); }
document.querySelector('#refresh').onclick = load; document.querySelector('#search').oninput = render; document.querySelector('#uncontacted').onchange = render; dialog.querySelector('.close').onclick = () => dialog.close(); load();
